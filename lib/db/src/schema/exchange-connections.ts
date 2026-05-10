import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exchangeConnectionsTable = pgTable("exchange_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  exchange: text("exchange").notNull(),
  label: text("label").notNull().default("My Account"),
  encryptedApiKey: text("encrypted_api_key").notNull(),
  encryptedSecret: text("encrypted_secret").notNull(),
  encryptedExtra: text("encrypted_extra"),
  permissions: jsonb("permissions").$type<string[]>().default([]),
  status: text("status").notNull().default("active"),
  tradingMode: text("trading_mode").notNull().default("manual"),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertExchangeConnectionSchema = createInsertSchema(exchangeConnectionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExchangeConnection = z.infer<typeof insertExchangeConnectionSchema>;
export type ExchangeConnection = typeof exchangeConnectionsTable.$inferSelect;
