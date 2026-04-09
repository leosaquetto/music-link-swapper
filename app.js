const API_URL = "/api/convert";

const REQUESTED_ADAPTERS = [
  "appleMusic",
  "spotify",
  "youTube",
  "deezer",
  "soundCloud",
  "pandora",
  "qobuz",
  "bandcamp",
  "tidal"
];

const STREAMING_HOST_HINTS = [
  "music.apple.com",
  "open.spotify.com",
  "spotify.link",
  "youtube.com",
  "youtu.be",
  "music.youtube.com",
  "deezer.com",
  "soundcloud.com",
  "tidal.com",
  "pandora.com",
  "qobuz.com",
  "bandcamp.com"
];

const PLATFORM_META = {
  appleMusic: { name: "apple music", icon: "", section: "principais", order: 1 },
  spotify: { name: "spotify", icon: "♬", section: "principais", order: 2 },
  youTube: { name: "youtube music", icon: "▶︎", section: "principais", order: 3 },
  youtube: { name: "youtube music", icon: "▶︎", section: "principais", order: 3 },
  youtubeMusic: { name: "youtube music", icon: "▶︎", section: "principais", order: 3 },
  deezer: { name: "deezer", icon: "≋", section: "outras", order: 4 },
  soundCloud: { name: "soundcloud", icon: "☁︎", section: "outras", order: 5 },
  pandora: { name: "pandora", icon: "p", section: "outras", order: 6 },
  qobuz: { name: "qobuz", icon: "q", section: "outras", order: 7 },
  bandcamp: { name: "bandcamp", icon: "b", section: "extras", order: 8 },
  tidal: { name: "tidal", icon: "◇", section: "extras", order: 9 }
};

const state = {
  currentResult: null
};

const els = {
  input: document.getElementById("linkInput"),
  convertButton: document.getElementById("convertButton"),
  clearButton: document.getElementById("clearButton"),
  pasteButton: document.getElementById("pasteButton"),
  statusCard: document.getElementById("statusCard"),
  resultCard: document.getElementById("resultCard"),
  coverImage: document.getElementById("coverImage"),
  resultTitle: document.getElementById("resultTitle"),
  resultArtist: document.getElementById("resultArtist"),
  resultAlbum: document.getElementById("resultAlbum"),
  platformGroups: document.getElementById("platformGroups"),
  copyAllButton: document.getElementById("copyAllButton"),
  resultFooterActions: document.getElementById("resultFooterActions"),
  spotifyWarning: document.getElementById("spotifyWarning")
};

// --- Initialization ---

bootstrap();

function bootstrap() {
  bindEvents();
  hydrateFromQuery();
}

function bindEvents() {
  els.convertButton.addEventListener("click", onConvert);
  els.clearButton.addEventListener("click", resetForm);

  els.pasteButton.addEventListener("click", async () => {
    els.input.focus();
    if (!navigator.clipboard?.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      const url = extractUrl(text);
      if (url) els.input.value = url;
    } catch (_error) {
      console.error("Erro ao colar:", _error);
    }
  });

  els.copyAllButton.addEventListener("click", async () => {
    if (!state.currentResult) return;
    await copyText(buildAllLinksText(state.currentResult));
    showStatus("lista completa copiada.", "success");
  });

  els.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConvert();
    }
  });
}

function hydrateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const incomingUrl = extractUrl(params.get("url") || "");
  if (incomingUrl) {
    els.input.value = incomingUrl;
  }
}

// --- Core Logic ---

async function onConvert() {
  const link = extractUrl(els.input.value.trim());

  if (!link) {
    showStatus("cole um link válido para continuar.", "error");
    return;
  }

  if (!isSupportedStreamingUrl(link)) {
    showStatus("isso não parece um link de streaming suportado.", "error");
    return;
  }

  setLoading(true);
  hideResult();
  showStatus("convertendo link...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        link,
        adapters: REQUESTED_ADAPTERS
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload?.ok || !Array.isArray(payload?.data?.links)) {
      const msg = payload?.error || "não consegui converter esse link agora.";
      showStatus(msg, "error");
      return;
    }

    const result = normalizeApiPayload(payload.data, link);
    if (!result) {
      showStatus("não encontrei plataformas para esse link.", "error");
      return;
    }

    state.currentResult = result;
    renderResult(result);
    showStatus(
      `encontrei ${result.links.length} plataforma${result.links.length === 1 ? "" : "s"}.`,
      "success"
    );
  } catch (_error) {
    showStatus("deu erro na conversão. tente novamente em instantes.", "error");
  } finally {
    setLoading(false);
  }
}

// --- Data Normalization ---

function normalizeApiPayload(data, originalUrl) {
  const links = normalizeLinks(data.links);
  if (!links.length) return null;

  const title = cleanText(data.title || "música encontrada");
  const description = cleanText(data.description || "");
  const parsed = splitDescription(description);

  const spotifyMissing =
    !links.some((item) => item.key === "spotify") &&
    !originalUrl.toLowerCase().includes("open.spotify.com");

  return {
    title,
    artist: parsed.artist,
    album: parsed.album,
    image: data.image || null,
    links,
    spotifyMissing
  };
}

function normalizeLinks(links) {
  const seen = new Set();
  const normalized = [];

  for (const item of links) {
    if (!item || !item.url || item.notAvailable) continue;

    const type = normalizePlatformKey(item.type);
    const meta = PLATFORM_META[type] || {
      name: prettifyPlatform(type),
      icon: "•",
      section: "extras",
      order: 999
    };

    const dedupe = `${type}|${item.url}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    normalized.push({
      key: type,
      name: meta.name,
      icon: meta.icon,
      section: meta.section,
      order: meta.order,
      url: item.url,
      isVerified: !!item.isVerified
    });
  }

  return normalized.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.isVerified && !b.isVerified) return -1;
    if (!a.isVerified && b.isVerified) return 1;
    return a.name.localeCompare(b.name);
  });
}

// --- UI Rendering ---

function renderResult(result) {
  els.resultCard.classList.remove("hidden");
  els.platformGroups.innerHTML = "";
  els.resultTitle.textContent = result.title || "resultado";

  // Artist & Album Display
  if (result.artist) {
    els.resultArtist.textContent = result.artist;
    els.resultArtist.classList.remove("hidden");
  } else {
    els.resultArtist.classList.add("hidden");
  }

  if (result.album) {
    els.resultAlbum.textContent = `álbum: ${result.album}`;
    els.resultAlbum.classList.remove("hidden");
  } else {
    els.resultAlbum.classList.add("hidden");
  }

  // Cover Image
  if (result.image) {
    els.coverImage.src = result.image;
    els.coverImage.classList.remove("hidden");
  } else {
    els.coverImage.classList.add("hidden");
    els.coverImage.removeAttribute("src");
  }

  // Spotify Warning
  if (result.spotifyMissing) {
    els.spotifyWarning.textContent = "spotify indisponível agora para este conteúdo.";
    els.spotifyWarning.classList.remove("hidden");
  } else {
    els.spotifyWarning.classList.add("hidden");
  }

  // Group Rendering
  const groups = ["principais", "outras", "extras"];
  for (const groupName of groups) {
    const items = result.links.filter((item) => item.section === groupName);
    if (!items.length) continue;

    const section = document.createElement("section");
    const title = document.createElement("p");
    title.className = "group-title";
    title.textContent = groupName;
    section.appendChild(title);

    const list = document.createElement("div");
    list.className = "platform-list";
    items.forEach((item) => list.appendChild(createPlatformItem(item)));
    
    section.appendChild(list);
    els.platformGroups.appendChild(section);
  }

  els.resultFooterActions.classList.remove("hidden");
}

function createPlatformItem(item) {
  const row = document.createElement("article");
  row.className = "platform-item";

  const note = item.isVerified ? "● verificado" : "● encontrado";
  const noteClass = item.isVerified ? "platform-note is-verified" : "platform-note is-found";

  row.innerHTML = `
    <div class="platform-icon">${escapeHtml(item.icon)}</div>
    <div class="platform-copy">
      <div class="platform-name">${escapeHtml(item.name)}</div>
      <div class="${noteClass}">${note}</div>
    </div>
    <div class="platform-actions">
      <button class="mini-action copy" type="button" data-action="copy">copiar</button>
      <button class="mini-action open" type="button" data-action="open">abrir</button>
    </div>
  `;

  row.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    await copyText(item.url);
    showStatus(`${item.name} copiado.`, "success");
  });

  row.querySelector('[data-action="open"]').addEventListener("click", () => {
    window.open(item.url, "_blank", "noopener,noreferrer");
  });

  return row;
}

// --- Helper Functions ---

function showStatus(message, tone = "default") {
  els.statusCard.textContent = message;
  els.statusCard.classList.remove("hidden", "is-error", "is-success");
  if (tone === "error") els.statusCard.classList.add("is-error");
  if (tone === "success") els.statusCard.classList.add("is-success");
}

function setLoading(loading) {
  els.convertButton.disabled = loading;
  els.convertButton.textContent = loading ? "convertendo..." : "converter";
}

function resetForm() {
  els.input.value = "";
  hideResult();
  els.statusCard.classList.add("hidden");
  state.currentResult = null;
}

function hideResult() {
  els.resultCard.classList.add("hidden");
  els.platformGroups.innerHTML = "";
  els.resultFooterActions.classList.add("hidden");
  els.spotifyWarning.classList.add("hidden");
}

function extractUrl(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

function isSupportedStreamingUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return STREAMING_HOST_HINTS.some((hint) => lower.includes(hint));
}

function splitDescription(description) {
  if (!description) return { artist: "", album: "" };
  const parts = description.split(/[-–•|]/).map(p => cleanText(p)).filter(Boolean);
  return parts.length >= 2 
    ? { artist: parts[0], album: parts.slice(1).join(" • ") }
    : { artist: description, album: "" };
}

function normalizePlatformKey(key) {
  return (key === "youtube" || key === "youtubeMusic") ? "youTube" : key;
}

function prettifyPlatform(key) {
  return String(key || "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim();
}

function buildAllLinksText(result) {
  const lines = [result.title];
  if (result.artist) lines.push(`artista: ${result.artist}`);
  if (result.album) lines.push(`álbum: ${result.album}`);
  lines.push("");
  result.links.forEach(item => lines.push(`${item.name}: ${item.url}`));
  return lines.join("\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const temp = document.createElement("textarea");
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  temp.remove();
}

function cleanText(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
