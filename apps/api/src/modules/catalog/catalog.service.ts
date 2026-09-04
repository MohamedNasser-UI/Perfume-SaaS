import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ItemType, PackagingType, Prisma, ProductClassification, Unit } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BOTTLE_IMAGE_MIMES, deleteUploadedFile, saveBottleImage as writeBottleImageFile } from "../../common/uploads";
import { CATALOG_PREFIX, nextCatalogCodeFromList } from "./catalog-codes";

const STOCK_MESSAGE = "Cannot delete an item that has stock";
const IN_USE_MESSAGE = "This item was used in sales or inventory history and cannot be deleted";
const READY_MADE_CLASSES: ProductClassification[] = ["ORIGINAL", "HIGH_COPY"];
const OTHER_CLASS = "OTHER" as string as ProductClassification;
const OTHER_ITEM_TYPE = "OTHER" as string as ItemType;

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  private catalogError(code: "ITEM_HAS_STOCK" | "ITEM_IN_USE", message: string): never {
    throw new BadRequestException({ message, code });
  }

  private isCodeClash(err: unknown): boolean {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return true;
    if (err instanceof BadRequestException) {
      const res = err.getResponse();
      const message =
        typeof res === "string"
          ? res
          : typeof res === "object" && res && "message" in res
            ? String((res as { message: unknown }).message)
            : "";
      return /already exists/i.test(message);
    }
    return false;
  }

  async nextCatalogCode(tenantId: string, prefix: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, code: { startsWith: prefix } },
      select: { code: true },
    });
    return nextCatalogCodeFromList(
      prefix,
      items.map((item) => item.code),
    );
  }

  private async withAssignedCode<T>(tenantId: string, prefix: string, fn: (code: string) => Promise<T>): Promise<T> {
    const code = await this.nextCatalogCode(tenantId, prefix);
    try {
      return await fn(code);
    } catch (err) {
      if (!this.isCodeClash(err)) throw err;
      const retry = await this.nextCatalogCode(tenantId, prefix);
      return fn(retry);
    }
  }

  private async createItem(
    tenantId: string,
    data: {
      code: string;
      name: string;
      itemType: ItemType;
      purchaseUnit: Unit;
      stockUnit: Unit;
      lowStockThreshold?: number;
    },
  ) {
    const exists = await this.prisma.inventoryItem.findUnique({
      where: { tenantId_code: { tenantId, code: data.code } },
    });
    if (exists) throw new BadRequestException(`Code ${data.code} already exists`);
    return this.prisma.inventoryItem.create({
      data: {
        tenantId,
        code: data.code,
        name: data.name,
        itemType: data.itemType,
        purchaseUnit: data.purchaseUnit,
        stockUnit: data.stockUnit,
        lowStockThreshold: data.lowStockThreshold ?? 0,
      },
    });
  }

  async assertCanDeleteInventoryItem(itemId: string, extraInUse = false) {
    const balances = await this.prisma.inventoryBalance.findMany({ where: { itemId } });
    const stock = balances.reduce((sum, row) => sum + Number(row.quantityOnHand), 0);
    if (stock > 0) this.catalogError("ITEM_HAS_STOCK", STOCK_MESSAGE);

    const [movements, purchases, waste, adjustments, finished] = await Promise.all([
      this.prisma.inventoryMovement.count({ where: { itemId } }),
      this.prisma.purchaseInvoiceLine.count({ where: { itemId } }),
      this.prisma.wasteTransaction.count({ where: { itemId } }),
      this.prisma.stockAdjustment.count({ where: { itemId } }),
      this.prisma.finishedCustomizedItem.count({ where: { inventoryItemId: itemId } }),
    ]);
    if (extraInUse || movements || purchases || waste || adjustments || finished) {
      this.catalogError("ITEM_IN_USE", IN_USE_MESSAGE);
    }
  }

  private async removeInventoryItem(itemId: string) {
    await this.prisma.inventoryBalance.deleteMany({ where: { itemId } });
    await this.prisma.inventoryItem.delete({ where: { id: itemId } });
  }

  listOils(tenantId: string) {
    return this.prisma.oil.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createOil(tenantId: string, data: { name: string; active?: boolean; lowStockThreshold?: number }) {
    return this.withAssignedCode(tenantId, CATALOG_PREFIX.OIL, async (code) => {
      const item = await this.createItem(tenantId, {
        code,
        name: data.name,
        itemType: "OIL",
        purchaseUnit: "L",
        stockUnit: "ML",
        lowStockThreshold: data.lowStockThreshold,
      });
      return this.prisma.oil.create({
        data: {
          tenantId,
          inventoryItemId: item.id,
          code,
          name: data.name,
          active: data.active ?? true,
        },
        include: { inventoryItem: true },
      });
    });
  }

  async updateOil(tenantId: string, id: string, data: { name?: string; active?: boolean; lowStockThreshold?: number }) {
    const oil = await this.prisma.oil.findFirst({ where: { id, tenantId } });
    if (!oil) throw new NotFoundException();
    return this.prisma.oil.update({
      where: { id },
      data: {
        name: data.name,
        active: data.active,
        inventoryItem: {
          update: {
            name: data.name,
            active: data.active,
            lowStockThreshold: data.lowStockThreshold,
          },
        },
      },
      include: { inventoryItem: true },
    });
  }

  async deleteOil(tenantId: string, id: string) {
    const oil = await this.prisma.oil.findFirst({ where: { id, tenantId } });
    if (!oil) throw new NotFoundException();
    const used =
      (await this.prisma.customizedConfiguration.count({ where: { oilId: id } })) > 0 ||
      (await this.prisma.customerPreference.count({ where: { favoriteOilId: id } })) > 0;
    await this.assertCanDeleteInventoryItem(oil.inventoryItemId, used);
    await this.prisma.oil.delete({ where: { id } });
    await this.removeInventoryItem(oil.inventoryItemId);
    return { ok: true };
  }

  listAlcohols(tenantId: string) {
    return this.prisma.alcohol.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createAlcohol(tenantId: string, data: { name: string; active?: boolean }) {
    return this.withAssignedCode(tenantId, CATALOG_PREFIX.ALCOHOL, async (code) => {
      const item = await this.createItem(tenantId, {
        code,
        name: data.name,
        itemType: "ALCOHOL",
        purchaseUnit: "L",
        stockUnit: "ML",
      });
      return this.prisma.alcohol.create({
        data: { tenantId, inventoryItemId: item.id, code, name: data.name, active: data.active ?? true },
        include: { inventoryItem: true },
      });
    });
  }

  async updateAlcohol(tenantId: string, id: string, data: { name?: string; active?: boolean }) {
    const row = await this.prisma.alcohol.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException();
    return this.prisma.alcohol.update({
      where: { id },
      data: {
        name: data.name,
        active: data.active,
        inventoryItem: { update: { name: data.name, active: data.active } },
      },
      include: { inventoryItem: true },
    });
  }

  async deleteAlcohol(tenantId: string, id: string) {
    const row = await this.prisma.alcohol.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException();
    await this.assertCanDeleteInventoryItem(row.inventoryItemId);
    await this.prisma.alcohol.delete({ where: { id } });
    await this.removeInventoryItem(row.inventoryItemId);
    return { ok: true };
  }

  listStabilizers(tenantId: string) {
    return this.prisma.stabilizer.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createStabilizer(tenantId: string, data: { name: string; active?: boolean }) {
    return this.withAssignedCode(tenantId, CATALOG_PREFIX.STABILIZER, async (code) => {
      const item = await this.createItem(tenantId, {
        code,
        name: data.name,
        itemType: "STABILIZER",
        purchaseUnit: "L",
        stockUnit: "ML",
      });
      return this.prisma.stabilizer.create({
        data: { tenantId, inventoryItemId: item.id, code, name: data.name, active: data.active ?? true },
        include: { inventoryItem: true },
      });
    });
  }

  async updateStabilizer(tenantId: string, id: string, data: { name?: string; active?: boolean }) {
    const row = await this.prisma.stabilizer.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException();
    return this.prisma.stabilizer.update({
      where: { id },
      data: {
        name: data.name,
        active: data.active,
        inventoryItem: { update: { name: data.name, active: data.active } },
      },
      include: { inventoryItem: true },
    });
  }

  async deleteStabilizer(tenantId: string, id: string) {
    const row = await this.prisma.stabilizer.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException();
    const used = (await this.prisma.customizedConfiguration.count({ where: { stabilizerId: id } })) > 0;
    await this.assertCanDeleteInventoryItem(row.inventoryItemId, used);
    await this.prisma.stabilizer.delete({ where: { id } });
    await this.removeInventoryItem(row.inventoryItemId);
    return { ok: true };
  }

  listPumps(tenantId: string) {
    return this.prisma.pump.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createPump(tenantId: string, data: { name: string; active?: boolean }) {
    return this.withAssignedCode(tenantId, CATALOG_PREFIX.PUMP, async (code) => {
      const item = await this.createItem(tenantId, {
        code,
        name: data.name,
        itemType: "PUMP",
        purchaseUnit: "PCS",
        stockUnit: "PCS",
      });
      return this.prisma.pump.create({
        data: { tenantId, inventoryItemId: item.id, code, name: data.name, active: data.active ?? true },
        include: { inventoryItem: true },
      });
    });
  }

  async updatePump(tenantId: string, id: string, data: { name?: string; active?: boolean }) {
    const row = await this.prisma.pump.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException();
    return this.prisma.pump.update({
      where: { id },
      data: {
        name: data.name,
        active: data.active,
        inventoryItem: { update: { name: data.name, active: data.active } },
      },
      include: { inventoryItem: true },
    });
  }

  async deletePump(tenantId: string, id: string) {
    const row = await this.prisma.pump.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException();
    const used =
      (await this.prisma.bottle.count({ where: { pumpId: id } })) > 0 ||
      (await this.prisma.customizedConfiguration.count({ where: { pumpId: id } })) > 0;
    await this.assertCanDeleteInventoryItem(row.inventoryItemId, used);
    await this.prisma.pump.delete({ where: { id } });
    await this.removeInventoryItem(row.inventoryItemId);
    return { ok: true };
  }

  listBottles(tenantId: string) {
    return this.prisma.bottle.findMany({
      where: { tenantId },
      include: { inventoryItem: true, pump: { include: { inventoryItem: true } } },
      orderBy: { design: "asc" },
    });
  }

  async createBottle(tenantId: string, data: { design: string; sizeMl: number; pumpId?: string; active?: boolean }) {
    return this.withAssignedCode(tenantId, CATALOG_PREFIX.BOTTLE, async (code) => {
      const item = await this.createItem(tenantId, {
        code,
        name: `${data.design} ${data.sizeMl}ml`,
        itemType: "BOTTLE",
        purchaseUnit: "PCS",
        stockUnit: "PCS",
      });
      return this.prisma.bottle.create({
        data: {
          tenantId,
          inventoryItemId: item.id,
          code,
          design: data.design,
          sizeMl: data.sizeMl,
          pumpId: data.pumpId,
          active: data.active ?? true,
        },
        include: { inventoryItem: true, pump: true },
      });
    });
  }

  async updateBottle(
    tenantId: string,
    id: string,
    data: { pumpId?: string | null; active?: boolean; design?: string; sizeMl?: number },
  ) {
    const bottle = await this.prisma.bottle.findFirst({ where: { id, tenantId } });
    if (!bottle) throw new NotFoundException();
    const design = data.design ?? bottle.design;
    const sizeMl = data.sizeMl ?? bottle.sizeMl;
    const itemName = `${design} ${sizeMl}ml`;
    const pumpId = data.pumpId === undefined ? undefined : data.pumpId === "" || data.pumpId === null ? null : data.pumpId;
    return this.prisma.bottle.update({
      where: { id },
      data: {
        active: data.active,
        design: data.design,
        sizeMl: data.sizeMl,
        pump: pumpId === undefined ? undefined : pumpId ? { connect: { id: pumpId } } : { disconnect: true },
        inventoryItem: {
          update: {
            name: itemName,
            active: data.active,
          },
        },
      },
      include: { inventoryItem: true, pump: true },
    });
  }

  async deleteBottle(tenantId: string, id: string) {
    const bottle = await this.prisma.bottle.findFirst({ where: { id, tenantId } });
    if (!bottle) throw new NotFoundException();
    const used = (await this.prisma.customizedConfiguration.count({ where: { bottleId: id } })) > 0;
    await this.assertCanDeleteInventoryItem(bottle.inventoryItemId, used);
    await this.prisma.bottle.delete({ where: { id } });
    await this.removeInventoryItem(bottle.inventoryItemId);
    deleteUploadedFile(bottle.imageUrl);
    return { ok: true };
  }

  async saveBottleImage(tenantId: string, id: string, file: { buffer: Buffer; mimetype: string }) {
    if (!BOTTLE_IMAGE_MIMES.includes(file.mimetype)) {
      throw new BadRequestException("Use a JPEG, PNG, WebP, or GIF image");
    }
    const bottle = await this.prisma.bottle.findFirst({ where: { id, tenantId } });
    if (!bottle) throw new NotFoundException();
    const imageUrl = writeBottleImageFile(file.buffer, file.mimetype);
    deleteUploadedFile(bottle.imageUrl);
    return this.prisma.bottle.update({
      where: { id },
      data: { imageUrl },
      include: { inventoryItem: true, pump: true },
    });
  }

  listPackaging(tenantId: string) {
    return this.prisma.packagingItem.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createPackaging(tenantId: string, data: { name: string; type: PackagingType; active?: boolean }) {
    return this.withAssignedCode(tenantId, CATALOG_PREFIX.PACKAGING, async (code) => {
      const item = await this.createItem(tenantId, {
        code,
        name: data.name,
        itemType: "PACKAGING",
        purchaseUnit: "PCS",
        stockUnit: "PCS",
      });
      return this.prisma.packagingItem.create({
        data: {
          tenantId,
          inventoryItemId: item.id,
          code,
          name: data.name,
          type: data.type,
          active: data.active ?? true,
        },
        include: { inventoryItem: true },
      });
    });
  }

  async updatePackaging(tenantId: string, id: string, data: { name?: string; type?: PackagingType; active?: boolean }) {
    const row = await this.prisma.packagingItem.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException();
    return this.prisma.packagingItem.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        active: data.active,
        inventoryItem: { update: { name: data.name, active: data.active } },
      },
      include: { inventoryItem: true },
    });
  }

  async deletePackaging(tenantId: string, id: string) {
    const row = await this.prisma.packagingItem.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException();
    const used =
      (await this.prisma.customizedConfiguration.count({ where: { packagingId: id } })) > 0 ||
      (await this.prisma.customerPreference.count({ where: { preferredPackagingId: id } })) > 0;
    await this.assertCanDeleteInventoryItem(row.inventoryItemId, used);
    await this.prisma.packagingItem.delete({ where: { id } });
    await this.removeInventoryItem(row.inventoryItemId);
    return { ok: true };
  }

  listReadyMade(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId, classification: { in: READY_MADE_CLASSES } },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createReadyMade(
    tenantId: string,
    data: {
      name: string;
      brand?: string;
      classification: ProductClassification;
      sizeMl: number;
      barcode?: string;
      sellingPrice: number;
      active?: boolean;
    },
  ) {
    if (data.classification !== "ORIGINAL" && data.classification !== "HIGH_COPY") {
      throw new BadRequestException("Invalid ready-made classification");
    }
    return this.withAssignedCode(tenantId, CATALOG_PREFIX.READY_MADE, async (code) => {
      const item = await this.createItem(tenantId, {
        code,
        name: data.name,
        itemType: "READY_MADE",
        purchaseUnit: "PCS",
        stockUnit: "PCS",
      });
      return this.prisma.product.create({
        data: {
          tenantId,
          inventoryItemId: item.id,
          sku: code,
          name: data.name,
          brand: data.brand,
          classification: data.classification,
          sizeMl: data.sizeMl,
          barcode: data.barcode,
          sellingPrice: data.sellingPrice,
          active: data.active ?? true,
        },
        include: { inventoryItem: true },
      });
    });
  }

  async updateReadyMade(
    tenantId: string,
    id: string,
    data: {
      name?: string;
      brand?: string;
      classification?: ProductClassification;
      sizeMl?: number;
      barcode?: string;
      sellingPrice?: number;
      active?: boolean;
    },
  ) {
    const row = await this.prisma.product.findFirst({
      where: { id, tenantId, classification: { in: READY_MADE_CLASSES } },
    });
    if (!row) throw new NotFoundException();
    const classification =
      data.classification && READY_MADE_CLASSES.includes(data.classification) ? data.classification : undefined;
    return this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        brand: data.brand,
        classification,
        sizeMl: data.sizeMl,
        barcode: data.barcode,
        sellingPrice: data.sellingPrice,
        active: data.active,
        inventoryItem: { update: { name: data.name, active: data.active } },
      },
      include: { inventoryItem: true },
    });
  }

  async deleteReadyMade(tenantId: string, id: string) {
    const row = await this.prisma.product.findFirst({
      where: { id, tenantId, classification: { in: READY_MADE_CLASSES } },
    });
    if (!row) throw new NotFoundException();
    const used = (await this.prisma.salesOrderLine.count({ where: { productId: id } })) > 0;
    await this.assertCanDeleteInventoryItem(row.inventoryItemId, used);
    await this.prisma.product.delete({ where: { id } });
    await this.removeInventoryItem(row.inventoryItemId);
    return { ok: true };
  }

  listOthers(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId, classification: OTHER_CLASS },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createOthers(tenantId: string, data: { name: string; sellingPrice: number; active?: boolean }) {
    return this.withAssignedCode(tenantId, CATALOG_PREFIX.OTHER, async (code) => {
      const item = await this.createItem(tenantId, {
        code,
        name: data.name,
        itemType: OTHER_ITEM_TYPE,
        purchaseUnit: "PCS",
        stockUnit: "PCS",
      });
      return this.prisma.product.create({
        data: {
          tenantId,
          inventoryItemId: item.id,
          sku: code,
          name: data.name,
          classification: OTHER_CLASS,
          sizeMl: 0,
          sellingPrice: data.sellingPrice,
          active: data.active ?? true,
        },
        include: { inventoryItem: true },
      });
    });
  }

  async updateOthers(tenantId: string, id: string, data: { name?: string; sellingPrice?: number; active?: boolean }) {
    const row = await this.prisma.product.findFirst({ where: { id, tenantId, classification: OTHER_CLASS } });
    if (!row) throw new NotFoundException();
    return this.prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        sellingPrice: data.sellingPrice,
        active: data.active,
        inventoryItem: { update: { name: data.name, active: data.active } },
      },
      include: { inventoryItem: true },
    });
  }

  async deleteOthers(tenantId: string, id: string) {
    const row = await this.prisma.product.findFirst({ where: { id, tenantId, classification: OTHER_CLASS } });
    if (!row) throw new NotFoundException();
    const used = (await this.prisma.salesOrderLine.count({ where: { productId: id } })) > 0;
    await this.assertCanDeleteInventoryItem(row.inventoryItemId, used);
    await this.prisma.product.delete({ where: { id } });
    await this.removeInventoryItem(row.inventoryItemId);
    return { ok: true };
  }

  async findByBarcode(tenantId: string, barcode: string) {
    return this.prisma.product.findFirst({
      where: { tenantId, barcode, active: true, classification: { in: READY_MADE_CLASSES } },
      include: { inventoryItem: true },
    });
  }

  listItems(tenantId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { tenantId, active: true },
      orderBy: [{ itemType: "asc" }, { name: "asc" }],
    });
  }
}
