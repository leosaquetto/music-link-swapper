import { timingSafeEqual } from "node:crypto";

import {
  isMusicLibraryEnabled,
  readMusicLibraryStats
} from "../../server/lib/music-library.js";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "método não permitido" });
  }

  if (!isAuthorized(req)) {
    return res.status(getConfiguredToken() ? 401 : 503).json({
      ok: false,
      error: getConfiguredToken() ? "não autorizado" : "admin stats não configurado"
    });
  }

  if (!isMusicLibraryEnabled()) {
    return res.status(503).json({
      ok: false,
      error: "biblioteca persistente não configurada"
    });
  }

  const days = clampNumber(getQueryParam(req, "days"), 1, MAX_DAYS, DEFAULT_DAYS);
  const limit = clampNumber(getQueryParam(req, "limit"), 1, MAX_LIMIT, DEFAULT_LIMIT);

  try {
    const data = await readMusicLibraryStats({ days, recentLimit: limit });
    return res.status(200).json({ ok: true, data });
  } catch (_error) {
    return res.status(500).json({
      ok: false,
      error: "erro ao ler estatísticas da biblioteca"
    });
  }
}

function isAuthorized(req) {
  const configured = getConfiguredToken();
  if (!configured) return false;

  const received = getRequestToken(req);
  if (!received) return false;

  const left = Buffer.from(received);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}

function getConfiguredToken() {
  return String(process.env.ADMIN_STATS_TOKEN || "").trim();
}

function getRequestToken(req) {
  const header = String(req?.headers?.authorization || req?.headers?.Authorization || "").trim();
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }

  return getQueryParam(req, "token").trim();
}

function getQueryParam(req, key) {
  const value = req?.query?.[key];
  if (Array.isArray(value)) return String(value[0] || "");
  if (value !== undefined) return String(value || "");

  try {
    const parsed = new URL(req?.url || "", "https://music-link-swapper.local");
    return parsed.searchParams.get(key) || "";
  } catch (_error) {
    return "";
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function setCorsHeaders(res) {
  if (typeof res?.setHeader !== "function") return;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  res.setHeader("Access-Control-Max-Age", "86400");
}
