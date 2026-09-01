import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { OutletsModule } from "./modules/outlets/outlets.module";
import { UsersModule } from "./modules/users/users.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { ConfigurationModule } from "./modules/configuration/configuration.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { ProcurementModule } from "./modules/procurement/procurement.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { SalesModule } from "./modules/sales/sales.module";
import { ReturnsModule } from "./modules/returns/returns.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { DevicesModule } from "./modules/devices/devices.module";
import { SyncModule } from "./modules/sync/sync.module";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../../.env", ".env"] }),
    PrismaModule,
    AuthModule,
    PlatformModule,
    OutletsModule,
    UsersModule,
    CatalogModule,
    ConfigurationModule,
    InventoryModule,
    SuppliersModule,
    ProcurementModule,
    CustomersModule,
    SalesModule,
    ReturnsModule,
    ReportsModule,
    DevicesModule,
    SyncModule,
  ],
})
export class AppModule {}
