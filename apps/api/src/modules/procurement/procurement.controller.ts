import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { purchaseInvoiceSchema } from "@perfume/validation";
import { ProcurementService } from "./procurement.service";
import { CurrentUser, OutletId, RequestUser, TenantId } from "../../common/context";
import { RequirePage } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";

@RequirePage("procurement")
@Controller("purchases")
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Get()
  list(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.procurement.list(tenantId, outletId);
  }

  @Get(":id")
  get(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.procurement.get(tenantId, id);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(purchaseInvoiceSchema))
    body: Parameters<ProcurementService["create"]>[3],
  ) {
    return this.procurement.create(tenantId, outletId, user.id, body);
  }
}
