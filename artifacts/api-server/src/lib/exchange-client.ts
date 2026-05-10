import { decrypt } from "./exchange-crypto";
import { db } from "@workspace/db";
import { exchangeConnectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

export type ExchangeName = "binance" | "bybit" | "mt5";

export interface BinanceClient {
  exchange: "binance";
  apiKey: string;
  secret: string;
  baseUrl: string;
}

export interface BybitClient {
  exchange: "bybit";
  apiKey: string;
  secret: string;
  baseUrl: string;
}

export interface MT5Client {
  exchange: "mt5";
  brokerServer: string;
  login: string;
  password: string;
}

export type ExchangeClient = BinanceClient | BybitClient | MT5Client;

export async function getExchangeClient(connectionId: number, userId: string): Promise<ExchangeClient> {
  const [conn] = await db
    .select()
    .from(exchangeConnectionsTable)
    .where(and(eq(exchangeConnectionsTable.id, connectionId), eq(exchangeConnectionsTable.userId, userId)));

  if (!conn) {
    throw new Error(`Exchange connection ${connectionId} not found for user ${userId}`);
  }
  if (conn.status !== "active") {
    throw new Error(`Exchange connection ${connectionId} is ${conn.status}`);
  }

  const apiKey = decrypt(conn.encryptedApiKey);
  const secret = decrypt(conn.encryptedSecret);
  const extra = conn.encryptedExtra ? JSON.parse(decrypt(conn.encryptedExtra)) : {};

  if (conn.exchange === "binance") {
    return { exchange: "binance", apiKey, secret, baseUrl: "https://api.binance.com" };
  }
  if (conn.exchange === "bybit") {
    return { exchange: "bybit", apiKey, secret, baseUrl: "https://api.bybit.com" };
  }
  if (conn.exchange === "mt5") {
    return { exchange: "mt5", brokerServer: extra.brokerServer ?? "", login: apiKey, password: secret };
  }

  throw new Error(`Unsupported exchange: ${conn.exchange}`);
}

function binanceSignature(params: Record<string, string>, secret: string): string {
  const { createHmac } = require("crypto");
  const qs = new URLSearchParams(params).toString();
  return createHmac("sha256", secret).update(qs).digest("hex");
}

function bybitSignature(params: Record<string, string>, secret: string, timestamp: number): string {
  const { createHmac } = require("crypto");
  const qs = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  const payload = `${timestamp}${params["api_key"] ?? ""}5000${qs}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function validateBinanceCredentials(client: BinanceClient): Promise<{ valid: boolean; permissions: string[]; error?: string }> {
  try {
    const timestamp = Date.now().toString();
    const params: Record<string, string> = { timestamp };
    const sig = binanceSignature(params, client.secret);
    const url = `${client.baseUrl}/api/v3/account?timestamp=${timestamp}&signature=${sig}`;
    const resp = await fetch(url, { headers: { "X-MBX-APIKEY": client.apiKey } });
    const data = await resp.json() as any;
    if (!resp.ok) return { valid: false, permissions: [], error: data.msg ?? "Invalid credentials" };
    const perms: string[] = data.permissions ?? [];
    return { valid: true, permissions: perms };
  } catch (err) {
    logger.error({ err }, "Binance validation error");
    return { valid: false, permissions: [], error: "Connection failed" };
  }
}

export async function validateBybitCredentials(client: BybitClient): Promise<{ valid: boolean; permissions: string[]; error?: string }> {
  try {
    const timestamp = Date.now();
    const params: Record<string, string> = { api_key: client.apiKey, timestamp: timestamp.toString() };
    const sign = bybitSignature(params, client.secret, timestamp);
    const url = `${client.baseUrl}/v5/user/query-api`;
    const resp = await fetch(url, {
      headers: {
        "X-BAPI-API-KEY": client.apiKey,
        "X-BAPI-TIMESTAMP": timestamp.toString(),
        "X-BAPI-SIGN": sign,
        "X-BAPI-RECV-WINDOW": "5000",
      },
    });
    const data = await resp.json() as any;
    if (data.retCode !== 0) return { valid: false, permissions: [], error: data.retMsg ?? "Invalid credentials" };
    const perms: string[] = data.result?.permissions ? Object.keys(data.result.permissions) : [];
    return { valid: true, permissions: perms };
  } catch (err) {
    logger.error({ err }, "Bybit validation error");
    return { valid: false, permissions: [], error: "Connection failed" };
  }
}

export async function getBinanceBalance(client: BinanceClient): Promise<{ asset: string; free: number; locked: number }[]> {
  const timestamp = Date.now().toString();
  const params: Record<string, string> = { timestamp };
  const sig = binanceSignature(params, client.secret);
  const url = `${client.baseUrl}/api/v3/account?timestamp=${timestamp}&signature=${sig}`;
  const resp = await fetch(url, { headers: { "X-MBX-APIKEY": client.apiKey } });
  const data = await resp.json() as any;
  if (!resp.ok) throw new Error(data.msg ?? "Failed to fetch Binance balance");
  return (data.balances as any[])
    .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
    .map((b: any) => ({ asset: b.asset, free: parseFloat(b.free), locked: parseFloat(b.locked) }));
}

export async function getBybitBalance(client: BybitClient): Promise<{ asset: string; free: number; locked: number }[]> {
  const timestamp = Date.now();
  const resp = await fetch(`${client.baseUrl}/v5/account/wallet-balance?accountType=UNIFIED`, {
    headers: {
      "X-BAPI-API-KEY": client.apiKey,
      "X-BAPI-TIMESTAMP": timestamp.toString(),
      "X-BAPI-SIGN": bybitSignature({ accountType: "UNIFIED" }, client.secret, timestamp),
      "X-BAPI-RECV-WINDOW": "5000",
    },
  });
  const data = await resp.json() as any;
  if (data.retCode !== 0) throw new Error(data.retMsg ?? "Failed to fetch Bybit balance");
  const coins: any[] = data.result?.list?.[0]?.coin ?? [];
  return coins.map((c: any) => ({
    asset: c.coin,
    free: parseFloat(c.availableToWithdraw ?? c.walletBalance ?? 0),
    locked: parseFloat(c.locked ?? 0),
  }));
}

export async function placeBinanceOrder(
  client: BinanceClient,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
  price?: number,
  stopPrice?: number
): Promise<any> {
  const timestamp = Date.now().toString();
  const params: Record<string, string> = {
    symbol: symbol.toUpperCase(),
    side,
    type: price ? "LIMIT" : "MARKET",
    quantity: quantity.toString(),
    timestamp,
    ...(price ? { price: price.toString(), timeInForce: "GTC" } : {}),
    ...(stopPrice ? { stopPrice: stopPrice.toString() } : {}),
  };
  const sig = binanceSignature(params, client.secret);
  const body = new URLSearchParams({ ...params, signature: sig }).toString();
  const resp = await fetch(`${client.baseUrl}/api/v3/order`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": client.apiKey, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await resp.json() as any;
  if (!resp.ok) throw new Error(data.msg ?? "Binance order failed");
  return data;
}

export async function placeBybitOrder(
  client: BybitClient,
  symbol: string,
  side: "Buy" | "Sell",
  quantity: number,
  price?: number
): Promise<any> {
  const body = JSON.stringify({
    category: "spot",
    symbol: symbol.toUpperCase(),
    side,
    orderType: price ? "Limit" : "Market",
    qty: quantity.toString(),
    ...(price ? { price: price.toString() } : {}),
  });
  const timestamp = Date.now();
  const resp = await fetch(`${client.baseUrl}/v5/order/create`, {
    method: "POST",
    headers: {
      "X-BAPI-API-KEY": client.apiKey,
      "X-BAPI-TIMESTAMP": timestamp.toString(),
      "X-BAPI-SIGN": bybitSignature({}, client.secret, timestamp),
      "X-BAPI-RECV-WINDOW": "5000",
      "Content-Type": "application/json",
    },
    body,
  });
  const data = await resp.json() as any;
  if (data.retCode !== 0) throw new Error(data.retMsg ?? "Bybit order failed");
  return data.result;
}
