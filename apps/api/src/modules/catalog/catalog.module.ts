import { Module } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { CatalogController } from "./catalog.controller";
import { MediaController } from "./media.controller";

@Module({
  controllers: [CatalogController, MediaController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
