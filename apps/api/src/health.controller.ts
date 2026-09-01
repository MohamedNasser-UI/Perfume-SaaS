import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/guards";

@Public()
@Controller("health")
export class HealthController {
  @Get()
  health() {
    return { ok: true, service: "perfume-saas-api" };
  }
}
