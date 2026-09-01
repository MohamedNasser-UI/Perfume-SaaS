import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PUBLIC_KEY, SKIP_OUTLET_KEY } from "../../common/guards";
import { RequestUser } from "../../common/context";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as RequestUser | undefined;
    if (!user) throw new UnauthorizedException();

    if (user.role === "PLATFORM_ADMIN") {
      req.tenantId = null;
      req.outletId = null;
      return true;
    }

    if (!user.tenantId) throw new ForbiddenException("User is not assigned to a tenant");

    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) throw new ForbiddenException("Tenant not found");
    if (tenant.status === "SUSPENDED") {
      throw new ForbiddenException("This business account is suspended");
    }

    req.tenantId = user.tenantId;
    req.tenant = tenant;

    const skipOutlet = this.reflector.getAllAndOverride<boolean>(SKIP_OUTLET_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipOutlet) return true;

    const outletId = (req.headers["x-outlet-id"] as string | undefined) ?? undefined;
    if (!outletId) throw new ForbiddenException("X-Outlet-Id header is required");

    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, tenantId: user.tenantId, active: true },
    });
    if (!outlet) throw new ForbiddenException("Outlet not found");

    if (user.role !== "OWNER" && !user.outletIds.includes(outletId)) {
      throw new ForbiddenException("You do not have access to this outlet");
    }

    req.outletId = outletId;
    return true;
  }
}
