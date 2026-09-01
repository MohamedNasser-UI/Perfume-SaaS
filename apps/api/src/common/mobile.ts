export function normalizeMobile(raw: string, country = "EG"): string {
  const digits = raw.replace(/\D/g, "");
  if (country === "EG") {
    if (digits.startsWith("0020")) return "0" + digits.slice(4);
    if (digits.startsWith("20") && digits.length >= 11) return "0" + digits.slice(2);
    if (digits.startsWith("0")) return digits;
    if (digits.length === 10) return "0" + digits;
  }
  return digits;
}
