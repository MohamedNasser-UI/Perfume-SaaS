import { Body, Controller, Get, Post } from "@nestjs/common";
import { licenseRenewSchema, LicenseRenewInput } from "@perfume/validation";
import { DevicesService } from "./devices.service";
import { CurrentUser, RequestUser, TenantId } from "../../common/context";
import { RequirePage, Roles, SkipOutlet } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";

@SkipOutlet()
@Controller("devices")
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Roles("OWNER", "STAFF")
  @Post("license")
  renew(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(licenseRenewSchema)) body: LicenseRenewInput,
  ) {
    return this.devices.issue({
      tenantId,
      userId: user.id,
      deviceId: body.deviceId,
      deviceLabel: body.deviceLabel,
    });
  }

  @RequirePage("settings")
  @Get()
  list(@TenantId() tenantId: string) {
    return this.devices.listForTenant(tenantId);
  }
}
