import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { createOutletSchema } from "@perfume/validation";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantId } from "../../common/context";
import { RequirePage, SkipOutlet } from "../../common/guards";
import { ZodPipe } from "../../common/zod-pipe";
import { ensureSequences } from "../../common/sequences";

@SkipOutlet()
@Controller("outlets")
export class OutletsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.prisma.outlet.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  }

  @RequirePage("settings")
  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body(new ZodPipe(createOutletSchema)) body: { name: string; address?: string; phone?: string },
  ) {
    const outlet = await this.prisma.outlet.create({
      data: { tenantId, name: body.name, address: body.address, phone: body.phone },
    });
    await ensureSequences(this.prisma, tenantId, outlet.id);
    return outlet;
  }

  @RequirePage("settings")
  @Patch(":id")
  update(
    @TenantId() tenantId: string,
    @Param("id") id: string,
    @Body() body: { name?: string; address?: string; phone?: string; active?: boolean },
  ) {
    return this.prisma.outlet.update({ where: { id }, data: body });
  }
}
