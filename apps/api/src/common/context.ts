import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export type StaffPage = "dashboard" | "procurement" | "suppliers" | "reports" | "settings";

export type RequestUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string | null;
  outletIds: string[];
  staffPages: StaffPage[];
  seeItemCost: boolean;
};

export type RequestContext = {
  user: RequestUser;
  tenantId: string | null;
  outletId: string | null;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user as RequestUser;
});

export function canSeeItemCost(user: Pick<RequestUser, "role" | "seeItemCost">): boolean {
  if (user.role === "OWNER" || user.role === "PLATFORM_ADMIN") return true;
  return user.seeItemCost;
}

export const OutletId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().outletId as string;
});

export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().tenantId as string;
});

export const CurrentSessionId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().authSessionId as string | undefined;
});
