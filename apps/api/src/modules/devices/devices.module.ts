import { Module } from "@nestjs/common";
import { LicenseService } from "../license/license.service";
import { DevicesService } from "./devices.service";
import { DevicesController } from "./devices.controller";

@Module({
  controllers: [DevicesController],
  providers: [LicenseService, DevicesService],
  exports: [LicenseService, DevicesService],
})
export class DevicesModule {}
