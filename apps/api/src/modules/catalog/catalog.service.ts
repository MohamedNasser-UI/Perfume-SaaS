import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ItemType, PackagingType, ProductClassification, Unit } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BOTTLE_IMAGE_MIMES, deleteUploadedFile, saveBottleImage as writeBottleImageFile } from "../../common/uploads";

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

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

  listOils(tenantId: string) {
    return this.prisma.oil.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createOil(tenantId: string, data: { code: string; name: string; active?: boolean; lowStockThreshold?: number }) {
    const item = await this.createItem(tenantId, {
      code: data.code,
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
        code: data.code,
        name: data.name,
        active: data.active ?? true,
      },
      include: { inventoryItem: true },
    });
  }

  async updateOil(tenantId: string, id: string, data: { name?: string; active?: boolean }) {
    const oil = await this.prisma.oil.findFirst({ where: { id, tenantId } });
    if (!oil) throw new NotFoundException();
    return this.prisma.oil.update({
      where: { id },
      data: {
        name: data.name,
        active: data.active,
        inventoryItem: { update: { name: data.name, active: data.active } },
      },
      include: { inventoryItem: true },
    });
  }

  listAlcohols(tenantId: string) {
    return this.prisma.alcohol.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createAlcohol(tenantId: string, data: { code: string; name: string; active?: boolean }) {
    const item = await this.createItem(tenantId, {
      code: data.code,
      name: data.name,
      itemType: "ALCOHOL",
      purchaseUnit: "L",
      stockUnit: "ML",
    });
    return this.prisma.alcohol.create({
      data: { tenantId, inventoryItemId: item.id, code: data.code, name: data.name, active: data.active ?? true },
      include: { inventoryItem: true },
    });
  }

  listStabilizers(tenantId: string) {
    return this.prisma.stabilizer.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createStabilizer(tenantId: string, data: { code: string; name: string; active?: boolean }) {
    const item = await this.createItem(tenantId, {
      code: data.code,
      name: data.name,
      itemType: "STABILIZER",
      purchaseUnit: "L",
      stockUnit: "ML",
    });
    return this.prisma.stabilizer.create({
      data: { tenantId, inventoryItemId: item.id, code: data.code, name: data.name, active: data.active ?? true },
      include: { inventoryItem: true },
    });
  }

  listPumps(tenantId: string) {
    return this.prisma.pump.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createPump(tenantId: string, data: { code: string; name: string; active?: boolean }) {
    const item = await this.createItem(tenantId, {
      code: data.code,
      name: data.name,
      itemType: "PUMP",
      purchaseUnit: "PCS",
      stockUnit: "PCS",
    });
    return this.prisma.pump.create({
      data: { tenantId, inventoryItemId: item.id, code: data.code, name: data.name, active: data.active ?? true },
      include: { inventoryItem: true },
    });
  }

  listBottles(tenantId: string) {
    return this.prisma.bottle.findMany({
      where: { tenantId },
      include: { inventoryItem: true, pump: { include: { inventoryItem: true } } },
      orderBy: { design: "asc" },
    });
  }

  async createBottle(
    tenantId: string,
    data: { code: string; design: string; sizeMl: number; pumpId?: string; active?: boolean },
  ) {
    const item = await this.createItem(tenantId, {
      code: data.code,
      name: `${data.design} ${data.sizeMl}ml`,
      itemType: "BOTTLE",
      purchaseUnit: "PCS",
      stockUnit: "PCS",
    });
    return this.prisma.bottle.create({
      data: {
        tenantId,
        inventoryItemId: item.id,
        code: data.code,
        design: data.design,
        sizeMl: data.sizeMl,
        pumpId: data.pumpId,
        active: data.active ?? true,
      },
      include: { inventoryItem: true, pump: true },
    });
  }

  async updateBottle(tenantId: string, id: string, data: { pumpId?: string; active?: boolean; design?: string }) {
    const bottle = await this.prisma.bottle.findFirst({ where: { id, tenantId } });
    if (!bottle) throw new NotFoundException();
    return this.prisma.bottle.update({
      where: { id },
      data: { pumpId: data.pumpId, active: data.active, design: data.design },
      include: { inventoryItem: true, pump: true },
    });
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

  async createPackaging(
    tenantId: string,
    data: { code: string; name: string; type: PackagingType; active?: boolean },
  ) {
    const item = await this.createItem(tenantId, {
      code: data.code,
      name: data.name,
      itemType: "PACKAGING",
      purchaseUnit: "PCS",
      stockUnit: "PCS",
    });
    return this.prisma.packagingItem.create({
      data: {
        tenantId,
        inventoryItemId: item.id,
        code: data.code,
        name: data.name,
        type: data.type,
        active: data.active ?? true,
      },
      include: { inventoryItem: true },
    });
  }

  listReadyMade(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      include: { inventoryItem: true },
      orderBy: { name: "asc" },
    });
  }

  async createReadyMade(
    tenantId: string,
    data: {
      sku: string;
      name: string;
      brand?: string;
      classification: ProductClassification;
      sizeMl: number;
      barcode?: string;
      sellingPrice: number;
      active?: boolean;
    },
  ) {
    const item = await this.createItem(tenantId, {
      code: data.sku,
      name: data.name,
      itemType: "READY_MADE",
      purchaseUnit: "PCS",
      stockUnit: "PCS",
    });
    return this.prisma.product.create({
      data: {
        tenantId,
        inventoryItemId: item.id,
        sku: data.sku,
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
  }

  async findByBarcode(tenantId: string, barcode: string) {
    return this.prisma.product.findFirst({
      where: { tenantId, barcode, active: true },
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
