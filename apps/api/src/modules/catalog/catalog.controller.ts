import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  bottleSchema,
  bottleUpdateSchema,
  oilSchema,
  oilUpdateSchema,
  othersSchema,
  othersUpdateSchema,
  packagingSchema,
  packagingUpdateSchema,
  pumpSchema,
  pumpUpdateSchema,
  readyMadeSchema,
  readyMadeUpdateSchema,
} from "@perfume/validation";
import { CatalogService } from "./catalog.service";
import { TenantId } from "../../common/context";
import { Roles, SkipOutlet } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";
import { BOTTLE_IMAGE_MAX_BYTES, BOTTLE_IMAGE_MIMES } from "../../common/uploads";

@SkipOutlet()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("catalog/items")
  items(@TenantId() tenantId: string) {
    return this.catalog.listItems(tenantId);
  }

  @Get("oils")
  oils(@TenantId() tenantId: string) {
    return this.catalog.listOils(tenantId);
  }

  @Roles("OWNER")
  @Post("oils")
  createOil(@TenantId() tenantId: string, @Body(new ZodPipe(oilSchema)) body: Parameters<CatalogService["createOil"]>[1]) {
    return this.catalog.createOil(tenantId, body);
  }

  @Roles("OWNER")
  @Patch("oils/:id")
  updateOil(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(oilUpdateSchema)) body: Parameters<CatalogService["updateOil"]>[2],
  ) {
    return this.catalog.updateOil(tenantId, id, body);
  }

  @Roles("OWNER")
  @Delete("oils/:id")
  deleteOil(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.catalog.deleteOil(tenantId, id);
  }

  @Get("alcohols")
  alcohols(@TenantId() tenantId: string) {
    return this.catalog.listAlcohols(tenantId);
  }

  @Roles("OWNER")
  @Post("alcohols")
  createAlcohol(@TenantId() tenantId: string, @Body(new ZodPipe(oilSchema)) body: Parameters<CatalogService["createAlcohol"]>[1]) {
    return this.catalog.createAlcohol(tenantId, body);
  }

  @Roles("OWNER")
  @Patch("alcohols/:id")
  updateAlcohol(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(oilUpdateSchema)) body: Parameters<CatalogService["updateAlcohol"]>[2],
  ) {
    return this.catalog.updateAlcohol(tenantId, id, body);
  }

  @Roles("OWNER")
  @Delete("alcohols/:id")
  deleteAlcohol(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.catalog.deleteAlcohol(tenantId, id);
  }

  @Get("stabilizers")
  stabilizers(@TenantId() tenantId: string) {
    return this.catalog.listStabilizers(tenantId);
  }

  @Roles("OWNER")
  @Post("stabilizers")
  createStabilizer(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(oilSchema)) body: Parameters<CatalogService["createStabilizer"]>[1],
  ) {
    return this.catalog.createStabilizer(tenantId, body);
  }

  @Roles("OWNER")
  @Patch("stabilizers/:id")
  updateStabilizer(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(oilUpdateSchema)) body: Parameters<CatalogService["updateStabilizer"]>[2],
  ) {
    return this.catalog.updateStabilizer(tenantId, id, body);
  }

  @Roles("OWNER")
  @Delete("stabilizers/:id")
  deleteStabilizer(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.catalog.deleteStabilizer(tenantId, id);
  }

  @Get("pumps")
  pumps(@TenantId() tenantId: string) {
    return this.catalog.listPumps(tenantId);
  }

  @Roles("OWNER")
  @Post("pumps")
  createPump(@TenantId() tenantId: string, @Body(new ZodPipe(pumpSchema)) body: Parameters<CatalogService["createPump"]>[1]) {
    return this.catalog.createPump(tenantId, body);
  }

  @Roles("OWNER")
  @Patch("pumps/:id")
  updatePump(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(pumpUpdateSchema)) body: Parameters<CatalogService["updatePump"]>[2],
  ) {
    return this.catalog.updatePump(tenantId, id, body);
  }

  @Roles("OWNER")
  @Delete("pumps/:id")
  deletePump(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.catalog.deletePump(tenantId, id);
  }

  @Get("bottles")
  bottles(@TenantId() tenantId: string) {
    return this.catalog.listBottles(tenantId);
  }

  @Roles("OWNER")
  @Post("bottles")
  createBottle(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(bottleSchema)) body: Parameters<CatalogService["createBottle"]>[1],
  ) {
    return this.catalog.createBottle(tenantId, body);
  }

  @Roles("OWNER")
  @Patch("bottles/:id")
  updateBottle(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(bottleUpdateSchema)) body: Parameters<CatalogService["updateBottle"]>[2],
  ) {
    return this.catalog.updateBottle(tenantId, id, body);
  }

  @Roles("OWNER")
  @Delete("bottles/:id")
  deleteBottle(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.catalog.deleteBottle(tenantId, id);
  }

  @Roles("OWNER")
  @Post("bottles/:id/image")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: BOTTLE_IMAGE_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!BOTTLE_IMAGE_MIMES.includes(file.mimetype)) {
          cb(new BadRequestException("Use a JPEG, PNG, WebP, or GIF image"), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadBottleImage(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: BOTTLE_IMAGE_MAX_BYTES })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.catalog.saveBottleImage(tenantId, id, file);
  }

  @Get("packaging")
  packaging(@TenantId() tenantId: string) {
    return this.catalog.listPackaging(tenantId);
  }

  @Roles("OWNER")
  @Post("packaging")
  createPackaging(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(packagingSchema)) body: Parameters<CatalogService["createPackaging"]>[1],
  ) {
    return this.catalog.createPackaging(tenantId, body);
  }

  @Roles("OWNER")
  @Patch("packaging/:id")
  updatePackaging(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(packagingUpdateSchema)) body: Parameters<CatalogService["updatePackaging"]>[2],
  ) {
    return this.catalog.updatePackaging(tenantId, id, body);
  }

  @Roles("OWNER")
  @Delete("packaging/:id")
  deletePackaging(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.catalog.deletePackaging(tenantId, id);
  }

  @Get("products")
  products(@TenantId() tenantId: string) {
    return this.catalog.listReadyMade(tenantId);
  }

  @Roles("OWNER")
  @Post("products")
  createProduct(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(readyMadeSchema)) body: Parameters<CatalogService["createReadyMade"]>[1],
  ) {
    return this.catalog.createReadyMade(tenantId, body);
  }

  @Roles("OWNER")
  @Patch("products/:id")
  updateProduct(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(readyMadeUpdateSchema)) body: Parameters<CatalogService["updateReadyMade"]>[2],
  ) {
    return this.catalog.updateReadyMade(tenantId, id, body);
  }

  @Roles("OWNER")
  @Delete("products/:id")
  deleteProduct(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.catalog.deleteReadyMade(tenantId, id);
  }

  @Get("products/barcode/:barcode")
  byBarcode(@TenantId() tenantId: string, @Param("barcode") barcode: string) {
    return this.catalog.findByBarcode(tenantId, barcode);
  }

  @Get("others")
  others(@TenantId() tenantId: string) {
    return this.catalog.listOthers(tenantId);
  }

  @Roles("OWNER")
  @Post("others")
  createOthers(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(othersSchema)) body: Parameters<CatalogService["createOthers"]>[1],
  ) {
    return this.catalog.createOthers(tenantId, body);
  }

  @Roles("OWNER")
  @Patch("others/:id")
  updateOthers(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(othersUpdateSchema)) body: Parameters<CatalogService["updateOthers"]>[2],
  ) {
    return this.catalog.updateOthers(tenantId, id, body);
  }

  @Roles("OWNER")
  @Delete("others/:id")
  deleteOthers(@TenantId() tenantId: string, @Param("id") id: string) {
    return this.catalog.deleteOthers(tenantId, id);
  }
}
