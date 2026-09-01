export const STAFF_PAGES = ["dashboard", "procurement", "suppliers", "reports", "settings"] as const;
export type StaffPage = (typeof STAFF_PAGES)[number];
export const DEFAULT_STAFF_PAGES: StaffPage[] = ["dashboard", "suppliers"];

export function hasStaffPage(
  role: string | undefined,
  staffPages: string[] | undefined,
  page: StaffPage,
): boolean {
  if (role === "OWNER" || role === "PLATFORM_ADMIN") return true;
  return (staffPages ?? DEFAULT_STAFF_PAGES).includes(page);
}

export function canSeeItemCost(role: string | undefined, seeItemCost?: boolean): boolean {
  if (role === "OWNER" || role === "PLATFORM_ADMIN") return true;
  return seeItemCost !== false;
}

export function homePathForUser(role: string | undefined, staffPages?: string[]): string {
  if (role === "PLATFORM_ADMIN") return "/platform";
  if (hasStaffPage(role, staffPages, "dashboard")) return "/";
  return "/sales/new";
}
