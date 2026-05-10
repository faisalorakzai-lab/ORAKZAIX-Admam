import { pgTable, text, serial, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portfoliosTable = pgTable("portfolios", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),

  totalBalance: real("total_balance").notNull().default(0),
  availableBalance: real("available_balance").notNull().default(0),
  peakBalance: real("peak_balance").notNull().default(0),
  startBalance: real("start_balance").notNull().default(0),

  unrealizedPnl: real("unrealized_pnl").notNull().default(0),
  realizedPnlToday: real("realized_pnl_today").notNull().default(0),
  realizedPnlTotal: real("realized_pnl_total").notNull().default(0),
  totalFees: real("total_fees").notNull().default(0),

  currentDrawdown: real("current_drawdown").notNull().default(0),
  maxDrawdown: real("max_drawdown").notNull().default(0),
  drawdownPercent: real("drawdown_percent").notNull().default(0),

  totalTrades: serial("total_trades"),
  winningTrades: serial("winning_trades"),
  losingTrades: serial("losing_trades"),

  allocation: jsonb("allocation").$type<Record<string, number>>().default({}),
  exposure: jsonb("exposure").$type<Record<string, number>>().default({}),
  openPositions: jsonb("open_positions").$type<unknown[]>().default([]),

  lastSnapshotAt: timestamp("last_snapshot_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const portfolioSnapshotsTable = pgTable("portfolio_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  totalBalance: real("total_balance").notNull(),
  realizedPnl: real("realized_pnl").notNull().default(0),
  unrealizedPnl: real("unrealized_pnl").notNull().default(0),
  drawdownPercent: real("drawdown_percent").notNull().default(0),
  tradeCount: serial("trade_count"),
  winRate: real("win_rate").default(0),
  allocation: jsonb("allocation").$type<Record<string, number>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPortfolioSchema = createInsertSchema(portfoliosTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type Portfolio = typeof portfoliosTable.$inferSelect;
export type PortfolioSnapshot = typeof portfolioSnapshotsTable.$inferSelect;
