export default async function handler(req, res) {
  const url = req.method === "GET" ? req.query.url : req.body?.url;

  if (!url) {
    return res.status(400).json({ error: "missing url" });
  }

  try {
    const response = await fetch("https://idonthavespotify.sjdonado.com/api/search?v=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        link: url,
        adapters: [
          "appleMusic",
          "spotify",
          "youTube",
          "deezer",
          "soundCloud",
          "pandora",
          "qobuz",
          "bandcamp",
          "tidal"
        ]
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "conversion failed",
      details: error.message
    });
  }
}
