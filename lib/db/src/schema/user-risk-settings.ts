import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRiskSettingsTable = pgTable("user_risk_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  maxRiskPercent: real("max_risk_percent").notNull().default(2),
  maxDailyLossPercent: real("max_daily_loss_percent").notNull().default(5),
  maxTradeSizePercent: real("max_trade_size_percent").notNull().default(10),
  stopLossPercent: real("stop_loss_percent").notNull().default(2),
  takeProfitRatio: real("take_profit_ratio").notNull().default(2),
  maxLeverage: integer("max_leverage").notNull().default(10),
  maxOpenPositions: integer("max_open_positions").notNull().default(5),
  maxDailyTrades: integer("max_daily_trades").notNull().default(20),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
  consecutiveLossesForCooldown: integer("consecutive_losses_for_cooldown").notNull().default(3),
  tradingMode: text("trading_mode").notNull().default("manual"),
  alertTelegramToken: text("alert_telegram_token"),
  alertTelegramChatId: text("alert_telegram_chat_id"),
  alertEmail: text("alert_email"),
  alertsEnabled: text("alerts_enabled").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserRiskSettingsSchema = createInsertSchema(userRiskSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserRiskSettings = z.infer<typeof insertUserRiskSettingsSchema>;
export type UserRiskSettings = typeof userRiskSettingsTable.$inferSelect;
