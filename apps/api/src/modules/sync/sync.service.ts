import { BadRequestException, HttpException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SyncPushInput } from "@perfume/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { SalesService } from "../sales/sales.service";
import { InventoryService } from "../inventory/inventory.service";
import { CatalogService } from "../catalog/catalog.service";
import { ProcurementService } from "../procurement/procurement.service";
import { ReturnsService } from "../returns/returns.service";
import { ConfigurationService } from "../configuration/configuration.service";
import { RequestUser } from "../../common/context";
import { normalizeMobile } from "../../common/mobile";

const OWNER_ONLY = new Set([
  "PURCHASE",
  "WASTE",
  "ADJUSTMENT",
  "OIL_CREATE",
  "OIL_UPDATE",
  "BOTTLE_CREATE",
  "BOTTLE_UPDATE",
  "ALCOHOL_CREATE",
  "STABILIZER_CREATE",
  "PUMP_CREATE",
  "PACKAGING_CREATE",
  "PRODUCT_CREATE",
  "OTHER_CREATE",
  "OTHER_UPDATE",
  "CONCENTRATION_CREATE",
  "CONCENTRATION_UPDATE",
  "DISCOUNT_CREATE",
  "DISCOUNT_UPDATE",
  "PAYMENT_METHOD_CREATE",
  "SUPPLIER_CREATE",
]);

const APPLY_ORDER = [
  "CUSTOMER",
  "SUPPLIER_CREATE",
  "OIL_CREATE",
  "ALCOHOL_CREATE",
  "STABILIZER_CREATE",
  "PUMP_CREATE",
  "BOTTLE_CREATE",
  "PACKAGING_CREATE",
  "PRODUCT_CREATE",
  "OTHER_CREATE",
  "CONCENTRATION_CREATE",
  "DISCOUNT_CREATE",
  "PAYMENT_METHOD_CREATE",
  "OIL_UPDATE",
  "BOTTLE_UPDATE",
  "OTHER_UPDATE",
  "CONCENTRATION_UPDATE",
  "DISCOUNT_UPDATE",
  "PURCHASE",
  "ADJUSTMENT",
  "SALE",
  "RETURN",
  "WASTE",
];

function errorMessage(err: unknown): string {
  if (err instanceof HttpException) {
    const res = err.getResponse();
    if (typeof res === "string") return res;
    if (typeof res === "object" && res && "message" in res) {
      const message = (res as { message: unknown }).message;
      if (typeof message === "string") return message;
      if (Array.isArray(message)) return message.join("; ");
    }
  }
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
    private readonly inventory: InventoryService,
    private readonly catalog: CatalogService,
    private readonly procurement: ProcurementService,
    private readonly returns: ReturnsService,
    private readonly configuration: ConfigurationService,
  ) {}

  async snapshot(tenantId: string, outletId: string) {
    const [
      oils,
      alcohols,
      stabilizers,
      bottles,
      pumps,
      packaging,
      products,
      settings,
      customers,
      suppliers,
      inventory,
      finished,
      sales,
      purchases,
      waste,
      adjustments,
      items,
      outlets,
      others,
    ] = await Promise.all([
      this.catalog.listOils(tenantId),
      this.catalog.listAlcohols(tenantId),
      this.catalog.listStabilizers(tenantId),
      this.catalog.listBottles(tenantId),
      this.catalog.listPumps(tenantId),
      this.catalog.listPackaging(tenantId),
      this.catalog.listReadyMade(tenantId),
      this.configuration.get(tenantId),
      this.prisma.customer.findMany({ where: { tenantId }, orderBy: { name: "asc" }, take: 2000 }),
      this.prisma.supplier.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      this.inventory.overview(tenantId, outletId),
      this.prisma.finishedCustomizedItem.findMany({
        where: { tenantId, outletId, status: "AVAILABLE" },
        include: { configuration: { include: { oil: true, bottle: true } } },
      }),
      this.prisma.salesOrder.findMany({
        where: { tenantId, outletId },
        include: { customer: true, paymentMethod: true, lines: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      this.procurement.list(tenantId, outletId),
      this.prisma.wasteTransaction.findMany({
        where: { tenantId, outletId },
        include: { item: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.stockAdjustment.findMany({
        where: { tenantId, outletId },
        include: { item: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.catalog.listItems(tenantId),
      this.prisma.outlet.findMany({ where: { tenantId, active: true }, orderBy: { name: "asc" } }),
      this.catalog.listOthers(tenantId),
    ]);

    return {
      serverTime: new Date().toISOString(),
      oils,
      alcohols,
      stabilizers,
      bottles,
      pumps,
      packaging,
      products,
      others,
      settings,
      customers,
      suppliers,
      inventory,
      finished,
      sales,
      purchases,
      waste,
      adjustments,
      items,
      outlets,
    };
  }

  async pull(tenantId: string, outletId: string, since?: string) {
    const snapshot = await this.snapshot(tenantId, outletId);
    if (!since) return snapshot;
    const sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) return snapshot;
    return {
      ...snapshot,
      sales: snapshot.sales.filter((s) => s.createdAt >= sinceDate),
      purchases: snapshot.purchases.filter((p) => p.createdAt >= sinceDate),
      waste: snapshot.waste.filter((w) => w.createdAt >= sinceDate),
      adjustments: snapshot.adjustments.filter((a) => a.createdAt >= sinceDate),
    };
  }

  async push(tenantId: string, defaultOutletId: string, pusher: RequestUser, body: SyncPushInput) {
    const device = await this.prisma.device.findFirst({
      where: { id: body.deviceId, tenantId },
      include: { users: true },
    });
    if (!device) throw new BadRequestException("Unknown device for this business");

    await this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    const authorizedUserIds = new Set(device.users.map((u) => u.userId));
    authorizedUserIds.add(pusher.id);

    const sorted = [...body.operations].sort(
      (a, b) => APPLY_ORDER.indexOf(a.type) - APPLY_ORDER.indexOf(b.type) || a.createdAt.localeCompare(b.createdAt),
    );

    const results: {
      localId: string;
      status: "APPLIED" | "REJECTED" | "DUPLICATE";
      serverId?: string;
      error?: string;
    }[] = [];

    for (const op of sorted) {
      const existing = await this.prisma.syncMutation.findUnique({
        where: { tenantId_deviceId_localId: { tenantId, deviceId: body.deviceId, localId: op.localId } },
      });
      if (existing) {
        results.push({
          localId: op.localId,
          status: existing.status === "APPLIED" ? "DUPLICATE" : "REJECTED",
          serverId: existing.serverId ?? undefined,
          error: existing.error ?? undefined,
        });
        continue;
      }

      const actorId = op.userId && authorizedUserIds.has(op.userId) ? op.userId : pusher.id;
      const actor = await this.prisma.user.findFirst({
        where: { id: actorId, tenantId, active: true },
      });
      if (!actor) {
        await this.record(tenantId, body.deviceId, op.localId, op.type, "REJECTED", "User is not active on this device");
        results.push({ localId: op.localId, status: "REJECTED", error: "User is not active on this device" });
        continue;
      }
      if (OWNER_ONLY.has(op.type) && actor.role !== "OWNER") {
        await this.record(tenantId, body.deviceId, op.localId, op.type, "REJECTED", "Insufficient role");
        results.push({ localId: op.localId, status: "REJECTED", error: "Insufficient role" });
        continue;
      }

      const outletId = op.outletId || defaultOutletId;
      try {
        const applied = await this.apply(tenantId, outletId, actorId, op.type, op.payload);
        const serverId = applied && typeof applied === "object" && "id" in applied ? String((applied as { id: string }).id) : undefined;
        await this.record(tenantId, body.deviceId, op.localId, op.type, "APPLIED", null, serverId);
        results.push({ localId: op.localId, status: "APPLIED", serverId });
      } catch (err) {
        const message = errorMessage(err);
        await this.record(tenantId, body.deviceId, op.localId, op.type, "REJECTED", message);
        results.push({ localId: op.localId, status: "REJECTED", error: message });
      }
    }

    return { serverTime: new Date().toISOString(), results };
  }

  private async record(
    tenantId: string,
    deviceId: string,
    localId: string,
    type: string,
    status: string,
    error: string | null,
    serverId?: string,
  ) {
    await this.prisma.syncMutation.create({
      data: { tenantId, deviceId, localId, type, status, error: error ?? undefined, serverId },
    });
  }

  private async apply(tenantId: string, outletId: string, userId: string, type: string, raw: unknown) {
    const payload = (raw ?? {}) as Record<string, unknown>;
    switch (type) {
      case "SALE":
        return this.sales.create(tenantId, outletId, userId, payload as Parameters<SalesService["create"]>[3]);
      case "CUSTOMER":
        return this.upsertCustomer(tenantId, payload);
      case "PURCHASE":
        return this.procurement.create(tenantId, outletId, userId, payload as Parameters<ProcurementService["create"]>[3]);
      case "WASTE":
        return this.inventory.createWaste(tenantId, outletId, userId, payload as Parameters<InventoryService["createWaste"]>[3]);
      case "ADJUSTMENT":
        return this.inventory.createAdjustment(tenantId, outletId, userId, payload as Parameters<InventoryService["createAdjustment"]>[3]);
      case "RETURN":
        return this.returns.create(tenantId, outletId, userId, payload as Parameters<ReturnsService["create"]>[3]);
      case "OIL_CREATE":
        return this.catalog.createOil(tenantId, payload as Parameters<CatalogService["createOil"]>[1]);
      case "OIL_UPDATE":
        return this.catalog.updateOil(tenantId, String(payload.id), {
          name: payload.name as string | undefined,
          active: payload.active as boolean | undefined,
        });
      case "OIL_DELETE":
        return this.catalog.deleteOil(tenantId, String(payload.id));
      case "BOTTLE_CREATE":
        return this.catalog.createBottle(tenantId, payload as Parameters<CatalogService["createBottle"]>[1]);
      case "BOTTLE_UPDATE":
        return this.catalog.updateBottle(tenantId, String(payload.id), {
          pumpId: payload.pumpId as string | undefined,
          active: payload.active as boolean | undefined,
          design: payload.design as string | undefined,
          sizeMl: payload.sizeMl as number | undefined,
        });
      case "BOTTLE_DELETE":
        return this.catalog.deleteBottle(tenantId, String(payload.id));
      case "ALCOHOL_CREATE":
        return this.catalog.createAlcohol(tenantId, payload as Parameters<CatalogService["createAlcohol"]>[1]);
      case "ALCOHOL_UPDATE":
        return this.catalog.updateAlcohol(tenantId, String(payload.id), {
          name: payload.name as string | undefined,
          active: payload.active as boolean | undefined,
        });
      case "ALCOHOL_DELETE":
        return this.catalog.deleteAlcohol(tenantId, String(payload.id));
      case "STABILIZER_CREATE":
        return this.catalog.createStabilizer(tenantId, payload as Parameters<CatalogService["createStabilizer"]>[1]);
      case "STABILIZER_UPDATE":
        return this.catalog.updateStabilizer(tenantId, String(payload.id), {
          name: payload.name as string | undefined,
          active: payload.active as boolean | undefined,
        });
      case "STABILIZER_DELETE":
        return this.catalog.deleteStabilizer(tenantId, String(payload.id));
      case "PUMP_CREATE":
        return this.catalog.createPump(tenantId, payload as Parameters<CatalogService["createPump"]>[1]);
      case "PUMP_UPDATE":
        return this.catalog.updatePump(tenantId, String(payload.id), {
          name: payload.name as string | undefined,
          active: payload.active as boolean | undefined,
        });
      case "PUMP_DELETE":
        return this.catalog.deletePump(tenantId, String(payload.id));
      case "PACKAGING_CREATE":
        return this.catalog.createPackaging(tenantId, payload as Parameters<CatalogService["createPackaging"]>[1]);
      case "PACKAGING_UPDATE":
        return this.catalog.updatePackaging(tenantId, String(payload.id), {
          name: payload.name as string | undefined,
          type: payload.type as Parameters<CatalogService["updatePackaging"]>[2]["type"],
          active: payload.active as boolean | undefined,
        });
      case "PACKAGING_DELETE":
        return this.catalog.deletePackaging(tenantId, String(payload.id));
      case "PRODUCT_CREATE":
        return this.catalog.createReadyMade(tenantId, payload as Parameters<CatalogService["createReadyMade"]>[1]);
      case "PRODUCT_UPDATE":
        return this.catalog.updateReadyMade(tenantId, String(payload.id), payload as Parameters<CatalogService["updateReadyMade"]>[2]);
      case "PRODUCT_DELETE":
        return this.catalog.deleteReadyMade(tenantId, String(payload.id));
      case "OTHER_CREATE":
        return this.catalog.createOthers(tenantId, payload as Parameters<CatalogService["createOthers"]>[1]);
      case "OTHER_UPDATE":
        return this.catalog.updateOthers(tenantId, String(payload.id), payload as Parameters<CatalogService["updateOthers"]>[2]);
      case "OTHER_DELETE":
        return this.catalog.deleteOthers(tenantId, String(payload.id));
      case "CONCENTRATION_CREATE":
        return this.configuration.createConcentration(tenantId, payload as { name: string; oilPercentage: number; active?: boolean });
      case "CONCENTRATION_UPDATE":
        return this.configuration.updateConcentration(tenantId, String(payload.id), userId, {
          name: payload.name as string | undefined,
          oilPercentage: payload.oilPercentage as number | undefined,
          active: payload.active as boolean | undefined,
        });
      case "DISCOUNT_CREATE":
        return this.configuration.createDiscount(tenantId, payload as { name: string; percentage: number; active?: boolean });
      case "DISCOUNT_UPDATE":
        return this.configuration.updateDiscount(tenantId, String(payload.id), {
          name: payload.name as string | undefined,
          percentage: payload.percentage as number | undefined,
          active: payload.active as boolean | undefined,
        });
      case "PAYMENT_METHOD_CREATE":
        return this.configuration.createPaymentMethod(tenantId, payload as { name: string; code: string; active?: boolean });
      case "SUPPLIER_CREATE":
        return this.createSupplier(tenantId, payload);
      default:
        throw new BadRequestException(`Unsupported sync type: ${type}`);
    }
  }

  private async upsertCustomer(tenantId: string, payload: Record<string, unknown>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const mobile = normalizeMobile(String(payload.mobile ?? ""), tenant?.country ?? "EG");
    const existing = await this.prisma.customer.findUnique({
      where: { tenantId_mobile: { tenantId, mobile } },
    });
    if (existing) return existing;
    try {
      return await this.prisma.customer.create({
        data: {
          ...(typeof payload.id === "string" ? { id: payload.id } : {}),
          tenantId,
          name: String(payload.name ?? ""),
          mobile,
          gender: (payload.gender as "MALE" | "FEMALE" | "OTHER" | undefined) ?? undefined,
          notes: typeof payload.notes === "string" ? payload.notes : undefined,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.prisma.customer.findUniqueOrThrow({ where: { tenantId_mobile: { tenantId, mobile } } });
      }
      throw err;
    }
  }

  private async createSupplier(tenantId: string, payload: Record<string, unknown>) {
    const name = String(payload.name ?? "").trim();
    if (!name) throw new BadRequestException("Supplier name is required");
    const existing = await this.prisma.supplier.findFirst({ where: { tenantId, name } });
    if (existing) return existing;
    return this.prisma.supplier.create({
      data: {
        tenantId,
        name,
        phone: typeof payload.phone === "string" ? payload.phone : undefined,
        address: typeof payload.address === "string" ? payload.address : undefined,
        contactPerson: typeof payload.contactPerson === "string" ? payload.contactPerson : undefined,
        creditTerms: typeof payload.creditTerms === "string" ? payload.creditTerms : undefined,
        creditLimit: typeof payload.creditLimit === "number" ? payload.creditLimit : undefined,
        notes: typeof payload.notes === "string" ? payload.notes : undefined,
        active: payload.active !== false,
      },
    });
  }
}
