import { Body, Controller, Get, Post } from "@nestjs/common";
import { createReturnSchema } from "@perfume/validation";
import { CreateReturnInput } from "@perfume/validation";
import { ReturnsService } from "./returns.service";
import { CurrentUser, OutletId, RequestUser, TenantId } from "../../common/context";
import { ZodPipe } from "../../common/zod-pipe";

@Controller()
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get("returns")
  list(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.returns.list(tenantId, outletId);
  }

  @Post("returns")
  create(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(createReturnSchema)) body: CreateReturnInput,
  ) {
    return this.returns.create(tenantId, outletId, user.id, body);
  }

  @Get("finished-customized")
  finished(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.returns.listFinished(tenantId, outletId);
  }
}
