import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  concentrationSchema,
  discountSchema,
  discountUpdateSchema,
  markupSchema,
  paymentMethodSchema,
  themeSchema,
  updateBusinessProfileSchema,
} from "@perfume/validation";
import { ConfigurationService } from "./configuration.service";
import { CurrentUser, RequestUser, TenantId } from "../../common/context";
import { RequirePage, SkipOutlet } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";

@SkipOutlet()
@Controller("settings")
export class ConfigurationController {
  constructor(private readonly config: ConfigurationService) {}

  @Get()
  get(@TenantId() tenantId: string) {
    return this.config.get(tenantId);
  }

  @RequirePage("settings")
  @Patch("profile")
  profile(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(updateBusinessProfileSchema)) body: Parameters<ConfigurationService["updateProfile"]>[2],
  ) {
    return this.config.updateProfile(tenantId, user.id, body);
  }

  @RequirePage("settings")
  @Post("concentrations")
  createConc(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(concentrationSchema)) body: { name: string; oilPercentage: number; active?: boolean },
  ) {
    return this.config.createConcentration(tenantId, body);
  }

  @RequirePage("settings")
  @Patch("concentrations/:id")
  updateConc(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { name?: string; oilPercentage?: number; active?: boolean },
  ) {
    return this.config.updateConcentration(tenantId, id, user.id, body);
  }

  @RequirePage("settings")
  @Patch("pricing")
  markup(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(markupSchema)) body: { markupPercentage: number },
  ) {
    return this.config.updateMarkup(tenantId, user.id, body.markupPercentage);
  }

  @RequirePage("settings")
  @Patch("theme")
  theme(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(themeSchema)) body: { theme: string },
  ) {
    return this.config.updateTheme(tenantId, user.id, body.theme);
  }

  @RequirePage("settings")
  @Post("discounts")
  createDiscount(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(discountSchema)) body: { name: string; percentage: number; active?: boolean },
  ) {
    return this.config.createDiscount(tenantId, body);
  }

  @RequirePage("settings")
  @Patch("discounts/:id")
  updateDiscount(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body(new ZodPipe(discountUpdateSchema)) body: { active?: boolean; name?: string; percentage?: number },
  ) {
    return this.config.updateDiscount(tenantId, id, body);
  }

  @RequirePage("settings")
  @Post("payment-methods")
  createPm(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(paymentMethodSchema)) body: { name: string; code: string; active?: boolean },
  ) {
    return this.config.createPaymentMethod(tenantId, body);
  }

  @RequirePage("settings")
  @Patch("payment-methods/:id")
  updatePm(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body() body: { active?: boolean; name?: string },
  ) {
    return this.config.updatePaymentMethod(tenantId, id, body);
  }
}
