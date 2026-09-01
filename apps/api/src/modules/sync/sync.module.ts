import { Module } from "@nestjs/common";
import { SyncService } from "./sync.service";
import { SyncController } from "./sync.controller";
import { SalesModule } from "../sales/sales.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CatalogModule } from "../catalog/catalog.module";
import { ProcurementModule } from "../procurement/procurement.module";
import { ReturnsModule } from "../returns/returns.module";
import { ConfigurationModule } from "../configuration/configuration.module";

@Module({
  imports: [SalesModule, InventoryModule, CatalogModule, ProcurementModule, ReturnsModule, ConfigurationModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
