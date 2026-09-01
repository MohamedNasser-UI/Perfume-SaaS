import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { adjustmentSchema, wasteSchema } from "@perfume/validation";
import { InventoryService } from "./inventory.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CurrentUser, OutletId, RequestUser, TenantId, canSeeItemCost } from "../../common/context";
import { ZodPipe } from "../../common/zod-pipe";
import { Roles } from "../../common/guards";

@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async overview(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Query("itemType") itemType?: string,
  ) {
    const rows = await this.inventory.overview(tenantId, outletId, itemType);
    if (canSeeItemCost(user)) return rows;
    return rows.map(({ averageCost: _c, value: _v, ...rest }) => rest);
  }

  @Get("movements")
  movements(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @Query("itemId") itemId?: string,
  ) {
    return this.inventory.movements(tenantId, outletId, itemId);
  }

  @Get("waste")
  listWaste(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.prisma.wasteTransaction.findMany({
      where: { tenantId, outletId },
      include: { item: true, createdBy: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  @Roles("OWNER")
  @Post("waste")
  createWaste(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(wasteSchema))
    body: {
      itemId: string;
      quantity: number;
      unit: "ML" | "L" | "PCS";
      reason: "SPILLAGE" | "DAMAGE" | "WRONG_MIX" | "OTHER";
      notes?: string;
    },
  ) {
    return this.inventory.createWaste(tenantId, outletId, user.id, body);
  }

  @Get("adjustments")
  listAdjustments(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.prisma.stockAdjustment.findMany({
      where: { tenantId, outletId },
      include: { item: true, createdBy: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  @Roles("OWNER")
  @Post("adjustments")
  createAdjustment(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(adjustmentSchema))
    body: {
      itemId: string;
      quantity: number;
      unit: "ML" | "L" | "PCS";
      reason: string;
      notes?: string;
      isOpeningBalance?: boolean;
      isStockCount?: boolean;
      unitCost?: number;
    },
  ) {
    return this.inventory.createAdjustment(tenantId, outletId, user.id, body);
  }
}
