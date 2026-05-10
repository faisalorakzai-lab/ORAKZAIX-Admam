import { pgTable, text, serial, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const riskLogsTable = pgTable("risk_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  tradeId: serial("trade_id"),
  symbol: text("symbol"),
  value: real("value"),
  threshold: real("threshold"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  resolved: text("resolved").notNull().default("false"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiAnalysisTable = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  tradeId: serial("trade_id"),
  symbol: text("symbol").notNull(),
  analysisType: text("analysis_type").notNull(),
  signal: text("signal"),
  reasoning: text("reasoning").notNull(),
  confidenceScore: real("confidence_score"),
  riskScore: real("risk_score"),
  volatilityScore: real("volatility_score"),
  probabilityRating: real("probability_rating"),
  riskLevel: text("risk_level"),
  entryPrice: real("entry_price"),
  stopLoss: real("stop_loss"),
  takeProfit1: real("take_profit_1"),
  takeProfit2: real("take_profit_2"),
  riskRewardRatio: real("risk_reward_ratio"),
  indicators: jsonb("indicators").$type<Record<string, unknown>>().default({}),
  marketConditions: jsonb("market_conditions").$type<Record<string, unknown>>().default({}),
  outcome: text("outcome"),
  actualPnl: real("actual_pnl"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRiskLogSchema = createInsertSchema(riskLogsTable).omit({ id: true, createdAt: true });
export const insertAiAnalysisSchema = createInsertSchema(aiAnalysisTable).omit({ id: true, createdAt: true });
export type InsertRiskLog = z.infer<typeof insertRiskLogSchema>;
export type RiskLog = typeof riskLogsTable.$inferSelect;
export type AiAnalysis = typeof aiAnalysisTable.$inferSelect;
