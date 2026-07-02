import {
  isDeezerMatchingEnabled,
  searchDeezerTracks
} from "../../server/lib/deezer.js";

const MAX_QUERY_LENGTH = 160;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "método não permitido" });
  }

  if (!isDeezerMatchingEnabled()) {
    return res.status(503).json({ ok: false, error: "busca Deezer desativada" });
  }

  const query = getQueryParam(req, "q");
  if (!isQuerySafe(query)) {
    return res.status(400).json({ ok: false, error: "consulta inválida" });
  }

  const limit = clampNumber(getQueryParam(req, "limit"), 1, MAX_LIMIT, DEFAULT_LIMIT);
  const index = Math.max(0, Number.parseInt(getQueryParam(req, "index"), 10) || 0);

  try {
    const data = await searchDeezerTracks({ q: query.trim(), limit, index });
    return res.status(200).json({
      ok: true,
      data: {
        query: data.query,
        index: data.index,
        limit: data.limit,
        results: data.results
      }
    });
  } catch (error) {
    const status = error?.temporary || error?.statusCode === 503 ? 503 : 502;
    return res.status(status).json({
      ok: false,
      error: status === 503 ? "Deezer indisponível agora" : "erro ao buscar na Deezer"
    });
  }
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

function isQuerySafe(query) {
  const normalized = String(query || "").trim();
  if (!normalized || normalized.length > MAX_QUERY_LENGTH) return false;
  if (/([a-z0-9])\1{8,}/i.test(normalized)) return false;
  if (!/[a-z0-9]/i.test(normalized)) return false;
  return true;
}

function clampNumber(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
