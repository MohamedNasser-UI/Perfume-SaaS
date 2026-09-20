import type { PrismaClient } from "@prisma/client";
import { seedCatalog } from "./catalog";
import { seedParties } from "./parties";
import { StockLedger } from "./stock";
import { seedOpeningBalances, seedHistory, type HistoryResult } from "./transactions";

export type SeedDemoContentResult = {
  history: HistoryResult;
};

/** Populate an existing tenant with the shared demo catalog, parties, stock, and history. */
export async function seedDemoTemplateContent(
  prisma: PrismaClient,
  opts: {
    tenantId: string;
    outletId: string;
    createdById: string;
    forceReseed?: boolean;
    log?: (message: string) => void;
  },
): Promise<SeedDemoContentResult> {
  const log = opts.log ?? (() => undefined);

  log("Seeding catalog…");
  const catalog = await seedCatalog(prisma, opts.tenantId);

  log("Seeding suppliers & customers…");
  const parties = await seedParties(prisma, opts.tenantId, opts.createdById);

  log("Seeding opening balances…");
  const ledger = new StockLedger();
  await seedOpeningBalances(prisma, opts.tenantId, opts.outletId, opts.createdById, catalog, ledger);

  log("Seeding purchase/sales/return history…");
  const history = await seedHistory(prisma, {
    tenantId: opts.tenantId,
    outletId: opts.outletId,
    ownerId: opts.createdById,
    catalog,
    parties,
    ledger,
    forceReseed: opts.forceReseed,
  });

  return { history };
}
