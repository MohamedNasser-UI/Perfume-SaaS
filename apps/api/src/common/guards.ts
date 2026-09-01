import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { RequestUser, StaffPage } from "./context";

export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const SKIP_OUTLET_KEY = "skipOutlet";
export const SkipOutlet = () => SetMetadata(SKIP_OUTLET_KEY, true);

export const PAGE_KEY = "staffPage";
export const RequirePage = (page: StaffPage) => SetMetadata(PAGE_KEY, page);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest().user as RequestUser | undefined;
    if (!user) throw new UnauthorizedException();
    if (!roles.includes(user.role)) throw new ForbiddenException("Insufficient role");
    return true;
  }
}

@Injectable()
export class PageAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const page = this.reflector.getAllAndOverride<StaffPage>(PAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!page) return true;
    const user = context.switchToHttp().getRequest().user as RequestUser | undefined;
    if (!user) throw new UnauthorizedException();
    if (user.role === "OWNER" || user.role === "PLATFORM_ADMIN") return true;
    if (user.role === "STAFF" && user.staffPages.includes(page)) return true;
    throw new ForbiddenException("This page is not available for your account");
  }
}
