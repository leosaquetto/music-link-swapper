import {
  isMusicLibraryEnabled,
  readCachedResultByTrackId
} from "./lib/music-library.js";

const TRACK_ID_PATTERN = /^trk_[a-f0-9]{20}$/i;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "método não permitido" });
  }

  const trackId = getTrackId(req);
  if (!trackId || !TRACK_ID_PATTERN.test(trackId)) {
    return res.status(400).json({ ok: false, error: "trackId inválido" });
  }

  if (!isMusicLibraryEnabled()) {
    return res.status(503).json({
      ok: false,
      error: "biblioteca persistente não configurada"
    });
  }

  const result = await readCachedResultByTrackId(trackId, { cacheStatus: "hit" });
  if (!result) {
    return res.status(404).json({
      ok: false,
      error: "card público não encontrado"
    });
  }

  return res.status(200).json({ ok: true, data: result });
}

function getTrackId(req) {
  const queryValue = req?.query?.trackId;
  if (typeof queryValue === "string") return queryValue.trim();
  if (Array.isArray(queryValue)) return String(queryValue[0] || "").trim();

  try {
    const url = new URL(req?.url || "", "http://localhost");
    return String(url.searchParams.get("trackId") || "").trim();
  } catch (_error) {
    return "";
  }
}
