export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "método não permitido"
    });
  }

  try {
    const { link, adapters } = req.body || {};

    if (!link || typeof link !== "string") {
      return res.status(400).json({
        ok: false,
        error: "link inválido"
      });
    }

    const upstream = await fetch("https://idonthavespotify.sjdonado.com/api/search?v=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        link,
        adapters: Array.isArray(adapters) && adapters.length ? adapters : undefined
      })
    });

    const text = await upstream.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (_error) {
      return res.status(502).json({
        ok: false,
        error: "a api externa retornou uma resposta inválida"
      });
    }

    if (!upstream.ok) {
      const upstreamMessage =
        data?.message ||
        data?.error ||
        data?.details ||
        "erro ao consultar a api externa";

      return res.status(upstream.status).json({
        ok: false,
        error: normalizeUpstreamError(upstreamMessage)
      });
    }

    return res.status(200).json({
      ok: true,
      data
    });
  } catch (_error) {
    return res.status(500).json({
      ok: false,
      error: "erro interno ao converter"
    });
  }
}

function normalizeUpstreamError(message) {
  const text = String(message || "").toLowerCase();

  if (text.includes("spotify metadata not found")) {
    return "não consegui buscar os metadados desse link no spotify agora. tente outro link ou tente novamente depois.";
  }

  return String(message || "erro ao consultar a api externa");
}
