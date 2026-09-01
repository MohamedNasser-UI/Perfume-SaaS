export function passwordResetEmail(input: { displayName: string; resetUrl: string; expiresMinutes: number }) {
  const subject = "Reset your Perfume Outlet password";
  const text = [
    `Hi ${input.displayName},`,
    "",
    "We received a request to reset your password.",
    `This link expires in ${input.expiresMinutes} minutes:`,
    input.resetUrl,
    "",
    "If you did not request this, you can ignore this email. Your password will stay the same.",
  ].join("\n");
  const html = `
    <p>Hi ${escapeHtml(input.displayName)},</p>
    <p>We received a request to reset your password. This link expires in ${input.expiresMinutes} minutes.</p>
    <p><a href="${escapeHtml(input.resetUrl)}" style="display:inline-block;padding:10px 16px;background:#1c1917;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p>
    <p>If the button does not work, copy this URL:</p>
    <p>${escapeHtml(input.resetUrl)}</p>
    <p>If you did not request this, ignore this email. Your password will stay the same.</p>
  `;
  return { subject, text, html };
}

export function passwordChangedEmail(input: { displayName: string }) {
  const subject = "Your Perfume Outlet password was changed";
  const text = [
    `Hi ${input.displayName},`,
    "",
    "Your password was just changed. If you did this, no further action is needed.",
    "If you did not change it, reset your password immediately and contact the shop owner.",
  ].join("\n");
  const html = `
    <p>Hi ${escapeHtml(input.displayName)},</p>
    <p>Your password was just changed. If you did this, no further action is needed.</p>
    <p>If you did not change it, reset your password immediately and contact the shop owner.</p>
  `;
  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
