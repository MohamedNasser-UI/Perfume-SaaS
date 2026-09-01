import { Module } from "@nestjs/common";
import { PlatformService } from "./platform.service";
import { PlatformController } from "./platform.controller";
import { AuthModule } from "../auth/auth.module";
import { DevicesModule } from "../devices/devices.module";

@Module({
  imports: [AuthModule, DevicesModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
