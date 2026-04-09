const API_URL = "/api/convert";
const SAMPLE_URL = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";

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
  currentResult: null,
  currentOriginalUrl: null
};

const els = {
  input: document.getElementById("linkInput"),
  convertButton: document.getElementById("convertButton"),
  clearButton: document.getElementById("clearButton"),
  pasteButton: document.getElementById("pasteButton"),
  useSampleButton: document.getElementById("useSampleButton"),
  supportedChips: document.getElementById("supportedChips"),
  statusCard: document.getElementById("statusCard"),
  resultCard: document.getElementById("resultCard"),
  coverImage: document.getElementById("coverImage"),
  resultDescription: document.getElementById("resultDescription"),
  resultTitle: document.getElementById("resultTitle"),
  resultMeta: document.getElementById("resultMeta"),
  resultActions: document.getElementById("resultActions"),
  platformGroups: document.getElementById("platformGroups"),
  copyAllButton: document.getElementById("copyAllButton"),
  copyOriginalButton: document.getElementById("copyOriginalButton"),
  copyUniversalButton: document.getElementById("copyUniversalButton")
};

bootstrap();

function bootstrap() {
  renderSupportedChips();
  bindEvents();
  hydrateFromQuery();
  tryAutoPasteFromClipboard();
}

function bindEvents() {
  els.convertButton.addEventListener("click", onConvert);
  els.clearButton.addEventListener("click", resetForm);

  els.pasteButton.addEventListener("click", async () => {
    const pasted = await smartPasteIntoInput({ announce: true });
    if (!pasted) {
      els.input.focus();
      els.input.select?.();
      showStatus("toque e cole o link no campo.", "default");
    }
  });

  els.useSampleButton.addEventListener("click", () => {
    els.input.value = SAMPLE_URL;
    hideStatus();
    els.input.focus();
  });

  els.copyAllButton.addEventListener("click", async () => {
    if (!state.currentResult) return;
    await copyText(buildAllLinksText(state.currentResult));
    showStatus("lista completa copiada.", "success");
  });

  els.copyOriginalButton.addEventListener("click", async () => {
    if (!state.currentOriginalUrl) return;
    await copyText(state.currentOriginalUrl);
    showStatus("link original copiado.", "success");
  });

  els.copyUniversalButton.addEventListener("click", async () => {
    if (!state.currentResult?.universalLink) return;
    await copyText(state.currentResult.universalLink);
    showStatus("link universal copiado.", "success");
  });

  els.input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConvert();
    }
  });

  els.input.addEventListener("paste", () => {
    setTimeout(() => {
      hideStatus();
    }, 80);
  });
}

function hydrateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const incomingUrl = extractUrl(params.get("url") || "");
  if (incomingUrl) {
    els.input.value = incomingUrl;
    showStatus("link recebido automaticamente.", "success");
  }
}

async function tryAutoPasteFromClipboard() {
  if (els.input.value.trim()) return;
  if (window.Telegram?.WebApp) return;
  if (!navigator.clipboard?.readText) return;

  try {
    const text = await navigator.clipboard.readText();
    const url = extractUrl(text);
    if (url && isSupportedStreamingUrl(url)) {
      els.input.value = url;
    }
  } catch (_error) {}
}

async function smartPasteIntoInput({ announce = false } = {}) {
  if (!navigator.clipboard?.readText) return false;

  try {
    const text = await navigator.clipboard.readText();
    const url = extractUrl(text);

    if (url) {
      els.input.value = url;
      if (announce) showStatus("link colado no campo.", "success");
      return true;
    }

    return false;
  } catch (_error) {
    return false;
  }
}

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
  showStatus("swapando...", "default");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        link,
        adapters: REQUESTED_ADAPTERS
      })
    });

    const payload = await response.json();

    if (!response.ok || !payload?.ok || !Array.isArray(payload?.data?.links)) {
      showStatus(
        payload?.error || "não consegui converter esse link agora. tente novamente em instantes.",
        "error"
      );
      return;
    }

    const result = normalizeApiPayload(payload.data);
    if (!result) {
      showStatus("não encontrei plataformas para esse link.", "error");
      return;
    }

    state.currentOriginalUrl = link;
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

function normalizeApiPayload(data) {
  const links = normalizeLinks(data.links);
  if (!links.length) return null;

  const title = cleanText(data.title || "música encontrada");
  const description = cleanText(data.description || "");
  const parsed = parsePreview(title, description);

  return {
    title: parsed.title,
    description: parsed.description,
    meta: parsed.meta,
    image: data.image || null,
    universalLink: data.universalLink || null,
    links
  };
}

function parsePreview(title, description) {
  const cleanTitle = cleanText(title);
  const cleanDescription = cleanText(description);

  if (!cleanDescription) {
    return {
      title: cleanTitle,
      description: "",
      meta: ""
    };
  }

  const normalizedTitle = cleanTitle.toLowerCase();
  const normalizedDescription = cleanDescription.toLowerCase();

  if (normalizedDescription === normalizedTitle) {
    return {
      title: cleanTitle,
      description: "",
      meta: ""
    };
  }

  if (normalizedDescription.includes(normalizedTitle) && cleanDescription.length <= cleanTitle.length + 30) {
    return {
      title: cleanTitle,
      description: cleanDescription,
      meta: ""
    };
  }

  const separators = [" - ", " – ", " • ", " | "];
  let parts = [cleanDescription];

  for (const separator of separators) {
    if (cleanDescription.includes(separator)) {
      parts = cleanDescription.split(separator).map(cleanText).filter(Boolean);
      break;
    }
  }

  if (parts.length >= 2) {
    const first = parts[0];
    const rest = parts.slice(1).join(" • ");

    if (first.toLowerCase() !== normalizedTitle) {
      return {
        title: cleanTitle,
        description: first,
        meta: rest
      };
    }
  }

  return {
    title: cleanTitle,
    description: cleanDescription,
    meta: ""
  };
}

function renderSupportedChips() {
  const names = ["apple music", "spotify", "youtube music", "deezer", "soundcloud", "tidal"];
  els.supportedChips.innerHTML = names.map(name => `<span class="chip">${name}</span>`).join("");
}

function renderResult(result) {
  els.resultCard.classList.remove("hidden");
  els.platformGroups.innerHTML = "";

  els.resultTitle.textContent = result.title || "resultado";
  els.resultMeta.textContent = buildMeta(result);

  if (result.description) {
    els.resultDescription.textContent = result.description;
    els.resultDescription.classList.remove("hidden");
  } else {
    els.resultDescription.classList.add("hidden");
  }

  if (result.image) {
    els.coverImage.src = result.image;
    els.coverImage.classList.remove("hidden");
  } else {
    els.coverImage.classList.add("hidden");
    els.coverImage.removeAttribute("src");
  }

  els.resultActions.classList.remove("hidden");
  if (result.universalLink) {
    els.copyUniversalButton.classList.remove("hidden");
  } else {
    els.copyUniversalButton.classList.add("hidden");
  }

  const groups = ["principais", "outras", "extras"];
  for (const groupName of groups) {
    const items = result.links.filter(item => item.section === groupName);
    if (!items.length) continue;

    const section = document.createElement("section");
    const title = document.createElement("p");
    title.className = "group-title";
    title.textContent = groupName;
    section.appendChild(title);

    const list = document.createElement("div");
    list.className = "platform-list";

    items.forEach(item => list.appendChild(createPlatformItem(item)));
    section.appendChild(list);
    els.platformGroups.appendChild(section);
  }
}

function createPlatformItem(item) {
  const row = document.createElement("article");
  row.className = "platform-item";

  row.innerHTML = `
    <div class="platform-icon">${escapeHtml(item.icon)}</div>
    <div class="platform-copy">
      <div class="platform-name">${escapeHtml(item.name)}</div>
      <div class="platform-note ${item.isVerified ? "is-verified" : "is-found"}">${
        item.isVerified ? "link verificado" : "link encontrado"
      }</div>
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

function hideResult() {
  els.resultCard.classList.add("hidden");
  els.platformGroups.innerHTML = "";
}

function showStatus(message, tone = "default") {
  els.statusCard.textContent = message;
  els.statusCard.classList.remove("hidden", "is-error", "is-success");
  if (tone === "error") els.statusCard.classList.add("is-error");
  if (tone === "success") els.statusCard.classList.add("is-success");
}

function hideStatus() {
  els.statusCard.classList.add("hidden");
}

function setLoading(loading) {
  els.convertButton.disabled = loading;
  els.convertButton.textContent = loading ? "swapando..." : "swap";
}

function resetForm() {
  els.input.value = "";
  hideStatus();
  hideResult();
  state.currentResult = null;
  state.currentOriginalUrl = null;
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

  normalized.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    if (a.isVerified && !b.isVerified) return -1;
    if (!a.isVerified && b.isVerified) return 1;
    return a.name.localeCompare(b.name);
  });

  return normalized;
}

function normalizePlatformKey(key) {
  if (!key) return "";
  if (key === "youtube" || key === "youtubeMusic") return "youTube";
  return key;
}

function prettifyPlatform(key) {
  return String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
}

function buildMeta(result) {
  const pieces = [];
  if (result.meta) pieces.push(result.meta);
  if (result.links?.length) pieces.push(`${result.links.length} plataformas`);
  if (result.universalLink) pieces.push("link universal disponível");
  return pieces.join(" • ");
}

function buildAllLinksText(result) {
  const lines = [];
  if (result.description) lines.push(result.description);
  lines.push(result.title);
  lines.push("");
  result.links.forEach(item => lines.push(`${item.name}: ${item.url}`));
  return lines.join("\n");
}

function extractUrl(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const direct = trimmed.match(/^https?:\/\/\S+$/i);
  if (direct) return direct[0];
  const embedded = trimmed.match(/https?:\/\/[^\s]+/i);
  if (embedded) return embedded[0];
  return null;
}

function isSupportedStreamingUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return STREAMING_HOST_HINTS.some(hint => lower.includes(hint));
}

function cleanText(str) {
  return String(str || "").replace(/\s+/g, " ").trim();
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}