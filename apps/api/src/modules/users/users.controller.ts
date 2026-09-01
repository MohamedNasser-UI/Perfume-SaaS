import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { adminResetPasswordSchema, createUserSchema, DEFAULT_STAFF_PAGES, updateStaffPagesSchema, type StaffPage } from "@perfume/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { CurrentUser, RequestUser, TenantId } from "../../common/context";
import { RequirePage, Roles, SkipOutlet } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  active: true,
  staffPages: true,
  seeItemCost: true,
  outlets: { include: { outlet: true } },
  createdAt: true,
} as const;

@SkipOutlet()
@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  @RequirePage("settings")
  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: userSelect,
      orderBy: { displayName: "asc" },
    });
  }

  @RequirePage("settings")
  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Body(new ZodPipe(createUserSchema))
    body: { email: string; displayName: string; password: string; role: "OWNER" | "STAFF"; outletIds?: string[] },
  ) {
    if (body.role === "OWNER" && actor.role !== "OWNER") {
      throw new ForbiddenException("Only an owner can invite another owner");
    }
    const taken = await this.prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (taken) throw new BadRequestException("Email already in use");
    const passwordHash = await this.auth.hashPassword(body.password);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: body.email.toLowerCase(),
        displayName: body.displayName,
        passwordHash,
        role: body.role,
        staffPages: body.role === "STAFF" ? [...DEFAULT_STAFF_PAGES] : [],
      },
    });
    const outletIds = body.outletIds ?? [];
    if (outletIds.length) {
      await this.prisma.userOutlet.createMany({
        data: outletIds.map((outletId) => ({ userId: user.id, outletId })),
      });
    }
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      staffPages: user.staffPages,
      seeItemCost: user.seeItemCost,
    };
  }

  @Roles("OWNER")
  @Patch(":id/pages")
  async updatePages(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(updateStaffPagesSchema)) body: { pages: StaffPage[]; seeItemCost?: boolean },
  ) {
    const target = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!target) throw new NotFoundException();
    if (target.role !== "STAFF") throw new BadRequestException("Page access can only be set for staff");
    return this.prisma.user.update({
      where: { id },
      data: {
        staffPages: body.pages,
        ...(body.seeItemCost !== undefined ? { seeItemCost: body.seeItemCost } : {}),
      },
      select: userSelect,
    });
  }

  @Roles("OWNER")
  @Post(":id/reset-password")
  resetPassword(
    @TenantId() tenantId: string,
    @CurrentUser() actor: RequestUser,
    @Param("id") id: string,
    @Body(new ZodPipe(adminResetPasswordSchema)) body: { newPassword: string },
  ) {
    return this.auth.adminResetPassword(actor, tenantId, id, body.newPassword);
  }
}
