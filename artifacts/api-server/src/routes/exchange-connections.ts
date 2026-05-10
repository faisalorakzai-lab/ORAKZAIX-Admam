import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { exchangeConnectionsTable, userRiskSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/exchange-crypto";
import {
  getExchangeClient,
  validateBinanceCredentials,
  validateBybitCredentials,
  getBinanceBalance,
  getBybitBalance,
  placeBinanceOrder,
  placeBybitOrder,
} from "../lib/exchange-client";
import { riskManager } from "../lib/risk-manager";
import {
  sendAlert,
  alertEmergencyStop,
  alertDailyLossLimit,
  alertDailyLossWarning,
  alertCooldownStarted,
  alertTradeExecuted,
} from "../lib/alert-system";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── CONNECT EXCHANGE ────────────────────────────────────────────────────────
router.post("/exchange/connect", async (req, res): Promise<void> => {
  const { userId, exchange, label, apiKey, secret, extra } = req.body as {
    userId: string;
    exchange: string;
    label?: string;
    apiKey: string;
    secret: string;
    extra?: Record<string, string>;
  };

  if (!userId || !exchange || !apiKey || !secret) {
    res.status(400).json({ error: "userId, exchange, apiKey, and secret are required" });
    return;
  }

  const validExchanges = ["binance", "bybit", "mt5"];
  if (!validExchanges.includes(exchange)) {
    res.status(400).json({ error: `exchange must be one of: ${validExchanges.join(", ")}` });
    return;
  }

  try {
    const encryptedApiKey = encrypt(apiKey);
    const encryptedSecret = encrypt(secret);
    const encryptedExtra = extra ? encrypt(JSON.stringify(extra)) : null;

    let permissions: string[] = [];
    let validationError: string | undefined;

    if (exchange === "binance") {
      const result = await validateBinanceCredentials({ exchange: "binance", apiKey, secret, baseUrl: "https://api.binance.com" });
      if (!result.valid) {
        res.status(400).json({ error: `Binance credential validation failed: ${result.error}` });
        return;
      }
      permissions = result.permissions;
    } else if (exchange === "bybit") {
      const result = await validateBybitCredentials({ exchange: "bybit", apiKey, secret, baseUrl: "https://api.bybit.com" });
      if (!result.valid) {
        res.status(400).json({ error: `Bybit credential validation failed: ${result.error}` });
        return;
      }
      permissions = result.permissions;
    }

    const [conn] = await db
      .insert(exchangeConnectionsTable)
      .values({
        userId,
        exchange,
        label: label ?? `My ${exchange.charAt(0).toUpperCase() + exchange.slice(1)} Account`,
        encryptedApiKey,
        encryptedSecret,
        encryptedExtra,
        permissions,
        status: "active",
        tradingMode: "manual",
        lastValidatedAt: new Date(),
      })
      .returning();

    req.log.info({ userId, exchange, connectionId: conn.id }, "Exchange connected");

    res.status(201).json({
      success: true,
      connection: {
        id: conn.id,
        userId: conn.userId,
        exchange: conn.exchange,
        label: conn.label,
        permissions: conn.permissions,
        status: conn.status,
        tradingMode: conn.tradingMode,
        lastValidatedAt: conn.lastValidatedAt,
        createdAt: conn.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to connect exchange");
    const message = err instanceof Error ? err.message : "Failed to connect exchange";
    res.status(500).json({ error: message });
  }
});

// ─── LIST CONNECTIONS ────────────────────────────────────────────────────────
router.get("/exchange/connections/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const connections = await db
    .select()
    .from(exchangeConnectionsTable)
    .where(eq(exchangeConnectionsTable.userId, userId));

  res.json({
    connections: connections.map((c) => ({
      id: c.id,
      userId: c.userId,
      exchange: c.exchange,
      label: c.label,
      permissions: c.permissions,
      status: c.status,
      tradingMode: c.tradingMode,
      lastValidatedAt: c.lastValidatedAt,
      createdAt: c.createdAt,
    })),
    count: connections.length,
  });
});

// ─── VALIDATE / TEST CONNECTION ──────────────────────────────────────────────
router.post("/exchange/validate/:connectionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.connectionId) ? req.params.connectionId[0] : req.params.connectionId;
  const connectionId = parseInt(rawId, 10);
  const { userId } = req.body as { userId: string };

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    const client = await getExchangeClient(connectionId, userId);

    let result: { valid: boolean; permissions: string[]; error?: string } = { valid: false, permissions: [] };

    if (client.exchange === "binance") {
      result = await validateBinanceCredentials(client);
    } else if (client.exchange === "bybit") {
      result = await validateBybitCredentials(client);
    } else if (client.exchange === "mt5") {
      result = { valid: true, permissions: ["trade", "read"] };
    }

    if (result.valid) {
      await db
        .update(exchangeConnectionsTable)
        .set({ status: "active", permissions: result.permissions, lastValidatedAt: new Date() })
        .where(and(eq(exchangeConnectionsTable.id, connectionId), eq(exchangeConnectionsTable.userId, userId)));
    }

    res.json({ ...result, connectionId, timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Validation failed";
    res.status(400).json({ error: message });
  }
});

// ─── GET LIVE BALANCE ────────────────────────────────────────────────────────
router.get("/exchange/balance/:connectionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.connectionId) ? req.params.connectionId[0] : req.params.connectionId;
  const connectionId = parseInt(rawId, 10);
  const rawUserId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
  const userId = typeof rawUserId === "string" ? rawUserId : "";

  if (!userId) {
    res.status(400).json({ error: "userId query param is required" });
    return;
  }

  try {
    const client = await getExchangeClient(connectionId, userId);

    let balances: { asset: string; free: number; locked: number }[] = [];

    if (client.exchange === "binance") {
      balances = await getBinanceBalance(client);
    } else if (client.exchange === "bybit") {
      balances = await getBybitBalance(client);
    } else if (client.exchange === "mt5") {
      balances = [{ asset: "USD", free: 0, locked: 0 }];
    }

    const totalUsdApprox = balances
      .filter((b) => b.asset === "USDT" || b.asset === "USD" || b.asset === "BUSD")
      .reduce((acc, b) => acc + b.free + b.locked, 0);

    res.json({ connectionId, balances, totalUsdApprox, timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch balance";
    res.status(400).json({ error: message });
  }
});

// ─── EXECUTE TRADE VIA USER'S EXCHANGE ───────────────────────────────────────
router.post("/exchange/trade", async (req, res): Promise<void> => {
  const {
    connectionId,
    userId,
    symbol,
    side,
    quantity,
    price,
    stopLoss,
    takeProfit,
    balance = 10000,
  } = req.body as {
    connectionId: number;
    userId: string;
    symbol: string;
    side: "BUY" | "SELL";
    quantity: number;
    price?: number;
    stopLoss?: number;
    takeProfit?: number;
    balance?: number;
  };

  if (!connectionId || !userId || !symbol || !side || !quantity) {
    res.status(400).json({ error: "connectionId, userId, symbol, side, and quantity are required" });
    return;
  }

  const riskCheck = riskManager.validateTrade({ balance, tradeValue: (price ?? 0) * quantity, openPositionsCount: 0 });
  if (!riskCheck.allowed) {
    res.status(403).json({ error: riskCheck.reason, riskStatus: riskManager.getStatus(balance) });
    return;
  }

  try {
    const client = await getExchangeClient(connectionId, userId);
    const userSettings = await db
      .select()
      .from(userRiskSettingsTable)
      .where(eq(userRiskSettingsTable.userId, userId));

    const settings = userSettings[0];
    const alertConfig = settings
      ? {
          telegramToken: settings.alertTelegramToken ?? undefined,
          telegramChatId: settings.alertTelegramChatId ?? undefined,
          email: settings.alertEmail ?? undefined,
          enabled: settings.alertsEnabled === "true",
        }
      : { enabled: false };

    let orderResult: any;

    if (client.exchange === "binance") {
      orderResult = await placeBinanceOrder(client, symbol, side, quantity, price);
    } else if (client.exchange === "bybit") {
      const bybitSide = side === "BUY" ? "Buy" : "Sell";
      orderResult = await placeBybitOrder(client, symbol, bybitSide, quantity, price);
    } else {
      res.status(400).json({ error: "MT5 trades must be placed via the MT5 bridge endpoint" });
      return;
    }

    const tradeRecord = {
      id: `${Date.now()}-${symbol}`,
      market: "crypto" as const,
      symbol,
      side,
      entryPrice: price ?? orderResult?.price ?? 0,
      qty: quantity,
      timestamp: new Date().toISOString(),
      status: "OPEN" as const,
    };
    riskManager.recordTradeOpen(tradeRecord);

    await alertTradeExecuted(alertConfig, symbol, side, price ?? 0, quantity, userId);

    req.log.info({ userId, exchange: client.exchange, symbol, side, quantity }, "Trade executed");

    res.json({
      success: true,
      order: orderResult,
      riskStatus: riskManager.getStatus(balance),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trade execution failed";
    req.log.error({ err, userId, symbol }, "Trade failed");
    res.status(500).json({ error: message });
  }
});

// ─── UPDATE TRADING MODE ─────────────────────────────────────────────────────
router.patch("/exchange/connections/:connectionId/mode", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.connectionId) ? req.params.connectionId[0] : req.params.connectionId;
  const connectionId = parseInt(rawId, 10);
  const { userId, tradingMode } = req.body as { userId: string; tradingMode: string };

  if (!userId || !tradingMode) {
    res.status(400).json({ error: "userId and tradingMode are required" });
    return;
  }

  const validModes = ["manual", "assisted", "autonomous"];
  if (!validModes.includes(tradingMode)) {
    res.status(400).json({ error: `tradingMode must be one of: ${validModes.join(", ")}` });
    return;
  }

  const [updated] = await db
    .update(exchangeConnectionsTable)
    .set({ tradingMode })
    .where(and(eq(exchangeConnectionsTable.id, connectionId), eq(exchangeConnectionsTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  res.json({ success: true, connectionId, tradingMode: updated.tradingMode, timestamp: new Date().toISOString() });
});

// ─── DISCONNECT EXCHANGE ─────────────────────────────────────────────────────
router.delete("/exchange/connections/:connectionId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.connectionId) ? req.params.connectionId[0] : req.params.connectionId;
  const connectionId = parseInt(rawId, 10);
  const rawUserId2 = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
  const userId = typeof rawUserId2 === "string" ? rawUserId2 : "";

  if (!userId) {
    res.status(400).json({ error: "userId query param is required" });
    return;
  }

  const [deleted] = await db
    .delete(exchangeConnectionsTable)
    .where(and(eq(exchangeConnectionsTable.id, connectionId), eq(exchangeConnectionsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Connection not found" });
    return;
  }

  req.log.info({ userId, connectionId, exchange: deleted.exchange }, "Exchange disconnected");
  res.json({ success: true, message: `${deleted.exchange} connection removed`, timestamp: new Date().toISOString() });
});

// ─── USER RISK SETTINGS ──────────────────────────────────────────────────────
router.post("/exchange/risk-settings", async (req, res): Promise<void> => {
  const {
    userId,
    maxRiskPercent,
    maxDailyLossPercent,
    maxTradeSizePercent,
    stopLossPercent,
    takeProfitRatio,
    maxLeverage,
    maxOpenPositions,
    maxDailyTrades,
    cooldownMinutes,
    consecutiveLossesForCooldown,
    tradingMode,
    alertTelegramToken,
    alertTelegramChatId,
    alertEmail,
    alertsEnabled,
  } = req.body as {
    userId: string;
    maxRiskPercent?: number;
    maxDailyLossPercent?: number;
    maxTradeSizePercent?: number;
    stopLossPercent?: number;
    takeProfitRatio?: number;
    maxLeverage?: number;
    maxOpenPositions?: number;
    maxDailyTrades?: number;
    cooldownMinutes?: number;
    consecutiveLossesForCooldown?: number;
    tradingMode?: string;
    alertTelegramToken?: string;
    alertTelegramChatId?: string;
    alertEmail?: string;
    alertsEnabled?: boolean;
  };

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const updatePayload: Partial<typeof userRiskSettingsTable.$inferInsert> = {};
  if (maxRiskPercent !== undefined) updatePayload.maxRiskPercent = maxRiskPercent;
  if (maxDailyLossPercent !== undefined) updatePayload.maxDailyLossPercent = maxDailyLossPercent;
  if (maxTradeSizePercent !== undefined) updatePayload.maxTradeSizePercent = maxTradeSizePercent;
  if (stopLossPercent !== undefined) updatePayload.stopLossPercent = stopLossPercent;
  if (takeProfitRatio !== undefined) updatePayload.takeProfitRatio = takeProfitRatio;
  if (maxLeverage !== undefined) updatePayload.maxLeverage = maxLeverage;
  if (maxOpenPositions !== undefined) updatePayload.maxOpenPositions = maxOpenPositions;
  if (maxDailyTrades !== undefined) updatePayload.maxDailyTrades = maxDailyTrades;
  if (cooldownMinutes !== undefined) updatePayload.cooldownMinutes = cooldownMinutes;
  if (consecutiveLossesForCooldown !== undefined) updatePayload.consecutiveLossesForCooldown = consecutiveLossesForCooldown;
  if (tradingMode !== undefined) updatePayload.tradingMode = tradingMode;
  if (alertTelegramToken !== undefined) updatePayload.alertTelegramToken = alertTelegramToken;
  if (alertTelegramChatId !== undefined) updatePayload.alertTelegramChatId = alertTelegramChatId;
  if (alertEmail !== undefined) updatePayload.alertEmail = alertEmail;
  if (alertsEnabled !== undefined) updatePayload.alertsEnabled = alertsEnabled ? "true" : "false";

  const insertPayload: typeof userRiskSettingsTable.$inferInsert = { userId, ...updatePayload };

  const [existing] = await db
    .select()
    .from(userRiskSettingsTable)
    .where(eq(userRiskSettingsTable.userId, userId));

  let result: any;
  if (existing) {
    const [updated] = await db
      .update(userRiskSettingsTable)
      .set(updatePayload)
      .where(eq(userRiskSettingsTable.userId, userId))
      .returning();
    result = updated;
  } else {
    const [inserted] = await db
      .insert(userRiskSettingsTable)
      .values(insertPayload)
      .returning();
    result = inserted;
  }

  if (maxDailyLossPercent !== undefined || cooldownMinutes !== undefined || maxTradeSizePercent !== undefined) {
    riskManager.updateConfig({
      ...(maxDailyLossPercent !== undefined ? { maxDailyLossPercent } : {}),
      ...(cooldownMinutes !== undefined ? { cooldownMinutes } : {}),
      ...(maxTradeSizePercent !== undefined ? { maxTradeSizePercent } : {}),
      ...(consecutiveLossesForCooldown !== undefined ? { consecutiveLossesForCooldown } : {}),
    });
  }

  res.json({ success: true, settings: result, timestamp: new Date().toISOString() });
});

router.get("/exchange/risk-settings/:userId", async (req, res): Promise<void> => {
  const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

  const [settings] = await db
    .select()
    .from(userRiskSettingsTable)
    .where(eq(userRiskSettingsTable.userId, userId));

  if (!settings) {
    res.json({
      userId,
      settings: null,
      defaults: {
        maxRiskPercent: 2,
        maxDailyLossPercent: 5,
        maxTradeSizePercent: 10,
        stopLossPercent: 2,
        takeProfitRatio: 2,
        maxLeverage: 10,
        maxOpenPositions: 5,
        maxDailyTrades: 20,
        cooldownMinutes: 60,
        consecutiveLossesForCooldown: 3,
        tradingMode: "manual",
        alertsEnabled: false,
      },
    });
    return;
  }

  const safe = { ...settings, alertTelegramToken: settings.alertTelegramToken ? "***configured***" : null };
  res.json({ userId, settings: safe, timestamp: new Date().toISOString() });
});

// ─── ALERT CONFIGURATION & TEST ──────────────────────────────────────────────
router.post("/exchange/alerts/test", async (req, res): Promise<void> => {
  const { userId, telegramToken, telegramChatId, email } = req.body as {
    userId: string;
    telegramToken?: string;
    telegramChatId?: string;
    email?: string;
  };

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const alertConfig = {
    telegramToken,
    telegramChatId,
    email,
    enabled: true,
  };

  await sendAlert(alertConfig, {
    level: "info",
    title: "Alert Test Successful",
    message: "Your TradeMind alerts are working correctly! You will receive notifications for: stop-loss hits, daily loss limits, emergency stops, and cooldown periods.",
    userId,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true, message: "Test alert sent — check your Telegram or email", timestamp: new Date().toISOString() });
});

// ─── EMERGENCY STOP WITH ALERTS ──────────────────────────────────────────────
router.post("/exchange/emergency-stop", async (req, res): Promise<void> => {
  const { userId, active } = req.body as { userId: string; active: boolean };

  riskManager.setEmergencyStop(active);

  if (userId) {
    const [settings] = await db
      .select()
      .from(userRiskSettingsTable)
      .where(eq(userRiskSettingsTable.userId, userId));

    if (settings?.alertsEnabled === "true") {
      await alertEmergencyStop(
        {
          telegramToken: settings.alertTelegramToken ?? undefined,
          telegramChatId: settings.alertTelegramChatId ?? undefined,
          email: settings.alertEmail ?? undefined,
          enabled: true,
        },
        active,
        userId
      );
    }
  }

  res.json({
    success: true,
    emergencyStopActive: active,
    message: active ? "EMERGENCY STOP ACTIVATED — all trading halted" : "Emergency stop deactivated — trading resumed",
    timestamp: new Date().toISOString(),
  });
});

// ─── GENERATE ENCRYPTION KEY (ADMIN / SETUP) ─────────────────────────────────
router.get("/exchange/generate-key", async (_req, res): Promise<void> => {
  const { generateKey } = await import("../lib/exchange-crypto");
  const key = generateKey();
  res.json({
    key,
    instructions: "Set this as the EXCHANGE_ENCRYPTION_KEY secret in your environment. Keep it safe — losing it means losing access to all stored credentials.",
    length: key.length,
    timestamp: new Date().toISOString(),
  });
});

export default router;
