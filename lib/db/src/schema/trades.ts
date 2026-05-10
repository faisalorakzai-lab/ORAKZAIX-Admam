import { pgTable, text, serial, timestamp, real, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tradesTable = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  connectionId: integer("connection_id"),
  exchange: text("exchange").notNull(),
  symbol: text("symbol").notNull(),
  market: text("market").notNull().default("crypto"),
  side: text("side").notNull(),
  status: text("status").notNull().default("OPEN"),
  tradingMode: text("trading_mode").notNull().default("manual"),

  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  quantity: real("quantity").notNull(),
  leverage: real("leverage").notNull().default(1),
  notionalValue: real("notional_value"),

  stopLoss: real("stop_loss"),
  takeProfit1: real("take_profit_1"),
  takeProfit2: real("take_profit_2"),
  trailingStop: real("trailing_stop"),

  realizedPnl: real("realized_pnl"),
  unrealizedPnl: real("unrealized_pnl"),
  fees: real("fees").default(0),
  fundingCost: real("funding_cost").default(0),

  riskScore: real("risk_score"),
  confidenceScore: real("confidence_score"),
  volatilityScore: real("volatility_score"),
  riskLevel: text("risk_level"),

  aiReasoning: text("ai_reasoning"),
  aiSignal: text("ai_signal"),
  marketConditions: jsonb("market_conditions").$type<Record<string, unknown>>(),
  indicators: jsonb("indicators").$type<Record<string, unknown>>(),

  tags: text("tags").array().default([]),
  notes: text("notes"),

  entryTime: timestamp("entry_time", { withTimezone: true }).notNull().defaultNow(),
  exitTime: timestamp("exit_time", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTradeSchema = createInsertSchema(tradesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof tradesTable.$inferSelect;
