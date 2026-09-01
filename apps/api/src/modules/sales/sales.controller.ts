import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { createSaleSchema, pricingPreviewSchema, CreateSaleInput, PricingPreviewInput } from "@perfume/validation";
import { SalesService } from "./sales.service";
import { CurrentUser, OutletId, RequestUser, TenantId, canSeeItemCost } from "../../common/context";
import { ZodPipe } from "../../common/zod-pipe";

@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post("pricing/preview")
  async preview(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(pricingPreviewSchema)) body: PricingPreviewInput,
  ) {
    const result = await this.sales.preview(tenantId, outletId, body);
    if (canSeeItemCost(user)) return result;
    const { materialCost: _cost, ...rest } = result;
    return rest;
  }

  @Get("sales")
  list(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @Query("q") q?: string,
    @Query("customerId") customerId?: string,
  ) {
    return this.sales.list(tenantId, outletId, { q, customerId });
  }

  @Get("sales/:id")
  async get(@TenantId() tenantId: string, @CurrentUser() user: RequestUser, @Param("id") id: string) {
    const data = await this.sales.get(tenantId, id);
    if (canSeeItemCost(user)) return data;
    const { materialCost: _mc, grossProfit: _gp, lines, ...rest } = data as typeof data & {
      materialCost?: unknown;
      grossProfit?: unknown;
      lines: Array<Record<string, unknown> & { configuration?: Record<string, unknown> | null }>;
    };
    return {
      ...rest,
      lines: lines.map(({ costAtSale: _c, configuration, ...line }) => ({
        ...line,
        configuration: configuration
          ? (({ materialCost: _cfg, ...cfg }) => cfg)(configuration)
          : configuration,
      })),
    };
  }

  @Post("sales")
  create(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(createSaleSchema)) body: CreateSaleInput,
  ) {
    return this.sales.create(tenantId, outletId, user.id, body);
  }
}
