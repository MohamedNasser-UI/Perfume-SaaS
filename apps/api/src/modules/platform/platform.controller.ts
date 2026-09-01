import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { createTenantSchema, updateTenantStatusSchema } from "@perfume/validation";
import { PlatformService } from "./platform.service";
import { DevicesService } from "../devices/devices.service";
import { Roles, SkipOutlet } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";
import { CurrentUser, RequestUser } from "../../common/context";

@SkipOutlet()
@Roles("PLATFORM_ADMIN")
@Controller("platform/tenants")
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly devices: DevicesService,
  ) {}

  @Get()
  list() {
    return this.platform.listTenants();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.platform.getTenant(id);
  }

  @Get(":id/devices")
  devicesForTenant(@Param("id") id: string) {
    return this.devices.listForTenant(id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(createTenantSchema)) body: Parameters<PlatformService["createTenant"]>[0],
  ) {
    return this.platform.createTenant(body, user.id);
  }

  @Patch(":id/status")
  status(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(updateTenantStatusSchema)) body: { status: "ACTIVE" | "SUSPENDED"; notes?: string },
  ) {
    return this.platform.updateStatus(id, body.status, body.notes, user.id);
  }
}
