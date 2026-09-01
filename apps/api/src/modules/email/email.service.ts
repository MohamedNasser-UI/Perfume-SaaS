import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import { passwordChangedEmail, passwordResetEmail } from "./email.templates";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendPasswordReset(input: { to: string; displayName: string; resetUrl: string; expiresMinutes: number }) {
    const message = passwordResetEmail(input);
    await this.send({ to: input.to, ...message });
  }

  async sendPasswordChanged(input: { to: string; displayName: string }) {
    const message = passwordChangedEmail(input);
    await this.send({ to: input.to, ...message });
  }

  async send(message: EmailMessage) {
    const provider = (this.config.get<string>("EMAIL_PROVIDER") ?? "console").toLowerCase();
    if (provider === "resend") {
      await this.sendResend(message);
      return;
    }
    if (provider === "smtp") {
      await this.sendSmtp(message);
      return;
    }
    this.logger.log(`Email (${provider}) to ${message.to}\n${message.subject}\n${message.text}`);
  }

  private async sendSmtp(message: EmailMessage) {
    const host = this.config.get<string>("SMTP_HOST")?.trim();
    const user = this.config.get<string>("SMTP_USER")?.trim();
    const pass = this.config.get<string>("SMTP_PASS");
    const from = this.config.get<string>("EMAIL_FROM")?.trim() || user;
    const secure = this.isTruthy(this.config.get<string>("SMTP_SECURE") ?? "true");
    const port = Number(this.config.get<string>("SMTP_PORT") ?? (secure ? 465 : 587));
    if (!host || !user || !pass || !from) {
      this.logger.error("SMTP_HOST, SMTP_USER, SMTP_PASS, and EMAIL_FROM are required when EMAIL_PROVIDER=smtp");
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      this.logger.log(`SMTP sent to ${message.to}: ${message.subject}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : "unknown error";
      this.logger.error(`SMTP failed: ${detail}`);
    }
  }

  private isTruthy(value: string) {
    return value.toLowerCase() === "true" || value === "1";
  }

  private async sendResend(message: EmailMessage) {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("EMAIL_FROM");
    if (!apiKey || !from) {
      this.logger.error("RESEND_API_KEY and EMAIL_FROM are required when EMAIL_PROVIDER=resend");
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`Resend failed (${res.status}): ${body}`);
    }
  }
}
