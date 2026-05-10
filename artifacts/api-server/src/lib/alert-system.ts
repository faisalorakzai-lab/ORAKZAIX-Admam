import { logger } from "./logger";

export interface AlertConfig {
  telegramToken?: string;
  telegramChatId?: string;
  email?: string;
  enabled: boolean;
}

export type AlertLevel = "info" | "warning" | "critical";

export interface AlertPayload {
  level: AlertLevel;
  title: string;
  message: string;
  userId?: string;
  symbol?: string;
  value?: number;
  timestamp?: string;
}

async function sendTelegram(token: string, chatId: string, text: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await resp.json() as any;
    if (!data.ok) {
      logger.warn({ error: data.description }, "Telegram alert failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Telegram alert error");
    return false;
  }
}

function formatAlert(payload: AlertPayload): string {
  const emoji = payload.level === "critical" ? "🚨" : payload.level === "warning" ? "⚠️" : "ℹ️";
  const ts = payload.timestamp ?? new Date().toISOString();
  let msg = `${emoji} <b>TradeMind Alert — ${payload.title}</b>\n\n`;
  msg += `${payload.message}\n`;
  if (payload.symbol) msg += `\n📊 Symbol: <code>${payload.symbol}</code>`;
  if (payload.value !== undefined) msg += `\n📈 Value: <b>${payload.value.toFixed(2)}</b>`;
  if (payload.userId) msg += `\n👤 User: ${payload.userId}`;
  msg += `\n\n🕒 ${ts}`;
  return msg;
}

export async function sendAlert(config: AlertConfig, payload: AlertPayload): Promise<void> {
  if (!config.enabled) return;

  const text = formatAlert(payload);
  const results: Promise<boolean>[] = [];

  if (config.telegramToken && config.telegramChatId) {
    results.push(sendTelegram(config.telegramToken, config.telegramChatId, text));
  }

  if (config.email) {
    logger.info({ to: config.email, title: payload.title }, "Email alert queued (configure SMTP to enable delivery)");
  }

  await Promise.allSettled(results);
  logger.info({ level: payload.level, title: payload.title }, "Alert dispatched");
}

export async function alertStopLoss(config: AlertConfig, symbol: string, loss: number, userId?: string): Promise<void> {
  return sendAlert(config, {
    level: "critical",
    title: "Stop Loss Hit",
    message: `Your position on <b>${symbol}</b> has been stopped out.`,
    symbol,
    value: loss,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function alertDailyLossLimit(config: AlertConfig, pct: number, limit: number, userId?: string): Promise<void> {
  return sendAlert(config, {
    level: "critical",
    title: "Daily Loss Limit Reached",
    message: `Daily loss of <b>${pct.toFixed(2)}%</b> has reached the configured limit of ${limit}%. All trading is now blocked for today.`,
    value: pct,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function alertDailyLossWarning(config: AlertConfig, pct: number, limit: number, userId?: string): Promise<void> {
  return sendAlert(config, {
    level: "warning",
    title: "Approaching Daily Loss Limit",
    message: `Daily loss is at <b>${pct.toFixed(2)}%</b>, approaching the limit of ${limit}%. Consider reducing position sizes.`,
    value: pct,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function alertEmergencyStop(config: AlertConfig, activated: boolean, userId?: string): Promise<void> {
  return sendAlert(config, {
    level: "critical",
    title: activated ? "Emergency Stop ACTIVATED" : "Emergency Stop Deactivated",
    message: activated
      ? "All trading has been immediately halted. No new orders will be placed."
      : "Trading has been resumed. Emergency stop is now off.",
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function alertCooldownStarted(config: AlertConfig, consecutiveLosses: number, minutes: number, userId?: string): Promise<void> {
  return sendAlert(config, {
    level: "warning",
    title: "Cooldown Period Started",
    message: `After ${consecutiveLosses} consecutive losses, a ${minutes}-minute cooldown has been applied. No new trades until cooldown ends.`,
    value: consecutiveLosses,
    userId,
    timestamp: new Date().toISOString(),
  });
}

export async function alertTradeExecuted(config: AlertConfig, symbol: string, side: "BUY" | "SELL", price: number, size: number, userId?: string): Promise<void> {
  return sendAlert(config, {
    level: "info",
    title: `Trade Executed — ${side} ${symbol}`,
    message: `${side === "BUY" ? "📈" : "📉"} <b>${side}</b> ${size} ${symbol} @ $${price.toLocaleString()}`,
    symbol,
    value: price,
    userId,
    timestamp: new Date().toISOString(),
  });
}
