import { Controller, Get, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { TenantId, OutletId } from "../../common/context";
import { RequirePage, SkipOutlet } from "../../common/guards";

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @RequirePage("dashboard")
  @Get("reports/dashboard")
  dashboard(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.reports.dashboard(tenantId, outletId);
  }

  @RequirePage("reports")
  @Get("reports/sales")
  sales(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.reports.sales(tenantId, outletId, from, to);
  }

  @RequirePage("reports")
  @Get("reports/inventory")
  inventory(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.reports.inventory(tenantId, outletId);
  }

  @RequirePage("reports")
  @Get("reports/procurement")
  procurement(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.reports.procurement(tenantId, outletId);
  }

  @RequirePage("reports")
  @SkipOutlet()
  @Get("reports/customers")
  customers(@TenantId() tenantId: string) {
    return this.reports.customers(tenantId);
  }

  @RequirePage("reports")
  @Get("reports/profitability")
  profitability(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.reports.profitability(tenantId, outletId);
  }

  @RequirePage("reports")
  @SkipOutlet()
  @Get("reports/audit")
  audit(@TenantId() tenantId: string) {
    return this.reports.audit(tenantId);
  }
}
