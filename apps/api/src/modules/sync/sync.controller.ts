import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { syncPushSchema, SyncPushInput } from "@perfume/validation";
import { SyncService } from "./sync.service";
import { CurrentUser, OutletId, RequestUser, TenantId } from "../../common/context";
import { ZodPipe } from "../../common/zod-pipe";

@Controller("sync")
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get("snapshot")
  snapshot(@TenantId() tenantId: string, @OutletId() outletId: string) {
    return this.sync.snapshot(tenantId, outletId);
  }

  @Get("pull")
  pull(@TenantId() tenantId: string, @OutletId() outletId: string, @Query("since") since?: string) {
    return this.sync.pull(tenantId, outletId, since);
  }

  @Post("push")
  push(
    @TenantId() tenantId: string,
    @OutletId() outletId: string,
    @CurrentUser() user: RequestUser,
    @Body(new ZodPipe(syncPushSchema)) body: SyncPushInput,
  ) {
    return this.sync.push(tenantId, outletId, user, body);
  }
}
