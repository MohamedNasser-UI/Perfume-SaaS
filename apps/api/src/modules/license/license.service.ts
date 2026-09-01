import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { LicensePayload, SignedLicense, signLicense, verifyLicense } from "./license.crypto";

@Injectable()
export class LicenseService {
  private readonly log = new Logger(LicenseService.name);
  private readonly privateKey: string;
  private readonly publicKey: string;
  readonly durationHours: number;

  constructor(private readonly config: ConfigService) {
    this.privateKey = this.config.get<string>("LICENSE_PRIVATE_KEY") ?? "";
    this.publicKey = this.config.get<string>("LICENSE_PUBLIC_KEY") ?? "";
    this.durationHours = Number(this.config.get<string>("OFFLINE_LICENSE_DURATION_HOURS") ?? 168);
    if (!this.privateKey || !this.publicKey) {
      this.log.warn("LICENSE_PRIVATE_KEY / LICENSE_PUBLIC_KEY are not set; device licenses cannot be issued");
    }
  }

  get durationMs() {
    return Math.max(1, this.durationHours) * 60 * 60 * 1000;
  }

  issue(input: { tenantId: string; deviceId: string; subscriptionStatus: "active" | "suspended" }): SignedLicense {
    if (!this.privateKey) {
      throw new ServiceUnavailableException("License signing is not configured");
    }
    const now = new Date();
    const expires = new Date(now.getTime() + this.durationMs);
    const payload: LicensePayload = {
      licenseId: randomUUID(),
      tenantId: input.tenantId,
      deviceId: input.deviceId,
      issuedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      subscriptionStatus: input.subscriptionStatus,
      licenseVersion: 1,
      serverTime: now.toISOString(),
    };
    return signLicense(payload, this.privateKey);
  }

  verify(license: SignedLicense) {
    if (!this.publicKey) return false;
    return verifyLicense(license, this.publicKey);
  }
}
