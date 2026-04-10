const API_URL = "/api/convert";
const SAMPLE_URL = "https://music.apple.com/br/album/swim/1868862375?i=1868862384";

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

const SVG_ICONS = {
  paste: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M7.5 6h1.67A3.001 3.001 0 0 0 12 8h6a3.001 3.001 0 0 0 2.83-2h1.67A1.5 1.5 0 0 1 24 7.5a1 1 0 1 0 2 0A3.5 3.5 0 0 0 22.5 4h-1.67A3.001 3.001 0 0 0 18 2h-6a3.001 3.001 0 0 0-2.83 2H7.5A3.5 3.5 0 0 0 4 7.5v19A3.5 3.5 0 0 0 7.5 30H12a1 1 0 1 0 0-2H7.5A1.5 1.5 0 0 1 6 26.5v-19A1.5 1.5 0 0 1 7.5 6ZM12 4h6a1 1 0 1 1 0 2h-6a1 1 0 1 1 0-2Zm5.5 6a3.5 3.5 0 0 0-3.5 3.5v13a3.5 3.5 0 0 0 3.5 3.5h8a3.5 3.5 0 0 0 3.5-3.5v-13a3.5 3.5 0 0 0-3.5-3.5h-8ZM16 13.5a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5v-13Z"/></svg>`,
  clear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m23 1l-6 6M9 6q4-3 8 1t1 8l-6 8l-6-6l1-3l-3 1l-3-3Zm0 0l9 9"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M18.327 7.286h-8.044a1.932 1.932 0 0 0-1.925 1.938v10.088c0 1.07.862 1.938 1.925 1.938h8.044a1.932 1.932 0 0 0 1.925-1.938V9.224c0-1.07-.862-1.938-1.925-1.938"/><path d="M15.642 7.286V4.688c0-.514-.203-1.007-.564-1.37a1.918 1.918 0 0 0-1.361-.568H5.673c-.51 0-1 .204-1.36.568a1.945 1.945 0 0 0-.565 1.37v10.088c0 .514.203 1.007.564 1.37c.361.364.85.568 1.361.568h2.685"/></g></svg>`,
  open: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M7 17L17 7m0 0H9m8 0v8"/></svg>`,
  share: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M12 16V4m0 0l-4 4m4-4l4 4"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M5 13.5v3.25A2.25 2.25 0 0 0 7.25 19h9.5A2.25 2.25 0 0 0 19 16.75V13.5"/></svg>`,
  spotify: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.9 10.9C14.7 9 9.35 8.8 6.3 9.75c-.5.15-1-.15-1.15-.6c-.15-.5.15-1 .6-1.15c3.55-1.05 9.4-.85 13.1 1.35c.45.25.6.85.35 1.3c-.25.35-.85.5-1.3.25m-.1 2.8c-.25.35-.7.5-1.05.25c-2.7-1.65-6.8-2.15-9.95-1.15c-.4.1-.85-.1-.95-.5c-.1-.4.1-.85.5-.95c3.65-1.1 8.15-.55 11.25 1.35c.3.15.45.65.2 1m-1.2 2.75c-.2.3-.55.4-.85.2c-2.35-1.45-5.3-1.75-8.8-.95c-.35.1-.65-.15-.75-.45c-.1-.35.15-.65.45-.75c3.8-.85 7.1-.5 9.7 1.1c.35.15.4.55.25.85M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2Z"/></svg>`,
  qobuz: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M39.203 39.203A21.433 21.433 0 0 0 45.5 24c0-11.874-9.626-21.5-21.5-21.5S2.5 12.126 2.5 24S12.126 45.5 24 45.5c4.89 0 9.4-1.633 13.012-4.383"/><circle cx="24" cy="24" r="4.873" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M32.944 32.944L45.5 45.5"/></svg>`,
  pandora: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M1.882 0v24H8.32a1.085 1.085 0 0 0 1.085-1.085v-4.61h1.612c7.88 0 11.103-4.442 11.103-9.636C22.119 2.257 17.247 0 12.662 0H1.882Z"/></svg>`,
  soundCloud: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 622" aria-hidden="true"><path fill="currentColor" d="M864 576H512V49Q567 0 640 0q80 0 136 56t56 136q0 37-14 71q25-7 46-7q66 0 113 47t47 113t-47 113t-113 47zm-416 0h-64V132q35 7 64 29v415zM256 161q28-22 64-29v444h-64V161zM128 573V259q16-3 32-3q15 0 32 4v316h-32q-16 0-32-3zM64 289v254q-30-22-47-55.5T0 416t17-71.5T64 289z"/></svg>`,
  appleMusic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.84 12.15c.03 3.11 2.73 4.15 2.76 4.16c-.02.07-.43 1.5-1.42 2.96c-.86 1.27-1.75 2.54-3.15 2.57c-1.38.03-1.83-.82-3.41-.82s-2.08.79-3.38.85c-1.35.05-2.39-1.35-3.26-2.62c-1.78-2.58-3.14-7.29-1.31-10.47c.91-1.58 2.53-2.58 4.29-2.6c1.34-.03 2.6.9 3.41.9c.81 0 2.34-1.11 3.95-.95c.67.03 2.56.27 3.77 2.04c-.1.06-2.25 1.31-2.23 3.98ZM14.26 4.45c.72-.87 1.2-2.08 1.07-3.28c-1.04.04-2.3.69-3.05 1.56c-.67.77-1.26 2.01-1.1 3.19c1.16.09 2.35-.59 3.08-1.47Z"/></svg>`,
  youTube: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.58 7.19a2.98 2.98 0 0 0-2.1-2.11C17.62 4.5 12 4.5 12 4.5s-5.62 0-7.48.58a2.98 2.98 0 0 0-2.1 2.11A31.2 31.2 0 0 0 2 12a31.2 31.2 0 0 0 .42 4.81a2.98 2.98 0 0 0 2.1 2.11c1.86.58 7.48.58 7.48.58s5.62 0 7.48-.58a2.98 2.98 0 0 0 2.1-2.11c.28-1.52.42-3.15.42-4.81c0-1.66-.14-3.29-.42-4.81ZM10 15.46V8.54L16 12l-6 3.46Z"/></svg>`,
  deezer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 16h4v3H3zm0-5h4v3H3zm0-5h4v3H3zm5 10h4v3H8zm0-5h4v3H8zm5 5h4v3h-4zm0-5h4v3h-4zm0-5h4v3h-4zm5 10h3v3h-3zm0-5h3v3h-3z"/></svg>`,
  bandcamp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.29 6L2 18h14.71L22 6z"/></svg>`,
  tidal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4l3 3l-3 3l-3-3zm-5 5l3 3l-3 3l-3-3zm10 0l3 3l-3 3l-3-3zm-5 5l3 3l-3 3l-3-3z"/></svg>`
};

const PLATFORM_META = {
  appleMusic: { name: "apple music", icon: SVG_ICONS.appleMusic, section: "principais", order: 1, isPrimaryCopy: true },
  spotify: { name: "spotify", icon: SVG_ICONS.spotify, section: "principais", order: 2, isPrimaryCopy: true },
  youTube: { name: "youtube music", icon: SVG_ICONS.youTube, section: "principais", order: 3, isPrimaryCopy: true },
  youtube: { name: "youtube music", icon: SVG_ICONS.youTube, section: "principais", order: 3, isPrimaryCopy: true },
  youtubeMusic: { name: "youtube music", icon: SVG_ICONS.youTube, section: "principais", order: 3, isPrimaryCopy: true },
  deezer: { name: "deezer", icon: SVG_ICONS.deezer, section: "principais", order: 4, isPrimaryCopy: true },
  tidal: { name: "tidal", icon: SVG_ICONS.tidal, section: "principais", order: 5, isPrimaryCopy: true },
  soundCloud: { name: "soundcloud", icon: SVG_ICONS.soundCloud, section: "outras", order: 6, isPrimaryCopy: false },
  pandora: { name: "pandora", icon: SVG_ICONS.pandora, section: "outras", order: 7, isPrimaryCopy: false },
  qobuz: { name: "qobuz", icon: SVG_ICONS.qobuz, section: "outras", order: 8, isPrimaryCopy: false },
  bandcamp: { name: "bandcamp", icon: SVG_ICONS.bandcamp, section: "outras", order: 9, isPrimaryCopy: false }
};

const SUPPORTED_PLATFORM_CHIPS = [
  "appleMusic",
  "spotify",
  "youTube",
  "deezer",
  "tidal"
];

const state = {
  currentResult: null,
  currentOriginalUrl: null,
  autoConvertedFromQuery: false,
  statusHideTimer: null,
  floatingToastTimer: null
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
  copyPrimaryButton: document.getElementById("copyPrimaryButton"),
  copyOriginalButton: document.getElementById("copyOriginalButton"),
  copyUniversalButton: document.getElementById("copyUniversalButton"),
  floatingToast: document.getElementById("floatingToast")
};

bootstrap();

function bootstrap() {
  injectButtonIcons();
  renderSupportedChips();
  bindEvents();
  hydrateFromQuery();
  tryAutoPasteFromClipboard();
}

function injectButtonIcons() {
  if (els.pasteButton) {
    els.pasteButton.innerHTML = `<span class="button-icon">${SVG_ICONS.paste}</span>`;
  }

  if (els.clearButton) {
    els.clearButton.innerHTML = `<span class="button-icon">${SVG_ICONS.clear}</span>`;
  }

  if (els.copyPrimaryButton) {
    els.copyPrimaryButton.innerHTML = `<span class="button-icon">${SVG_ICONS.copy}</span>`;
  }
}

function bindEvents() {
  els.convertButton?.addEventListener("click", onConvert);
  els.clearButton?.addEventListener("click", resetForm);

  els.pasteButton?.addEventListener("click", async () => {
    const pasted = await smartPasteIntoInput({ announce: true, autoConvert: true });

    if (!pasted) {
      els.input?.focus();
      els.input?.select?.();
      showFloatingToast("toque e cole o link no campo.");
    }
  });

  els.useSampleButton?.addEventListener("click", () => {
    els.input.value = SAMPLE_URL;
    hideStatus();
    softlyDismissKeyboard();
  });

  els.copyPrimaryButton?.addEventListener("click", async () => {
    if (!state.currentResult) return;
    const text = buildPrimaryLinksText(state.currentResult);
    if (!text) return;
    await copyText(text);
    showFloatingToast("principais copiadas.");
  });

  els.copyOriginalButton?.addEventListener("click", async () => {
    if (!state.currentOriginalUrl) return;
    await copyText(state.currentOriginalUrl);
    showFloatingToast("link original copiado.");
  });

  els.copyUniversalButton?.addEventListener("click", async () => {
    if (!state.currentResult?.universalLink) return;
    await copyText(state.currentResult.universalLink);
    showFloatingToast("link universal copiado.");
  });

  els.input?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConvert();
    }
  });

  els.input?.addEventListener("paste", () => {
    setTimeout(async () => {
      hideStatus();
      softlyDismissKeyboard();
      if (isSupportedStreamingUrl(extractUrl(els.input.value.trim()) || "")) {
        await onConvert();
      }
    }, 110);
  });
}

function hydrateFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const incomingUrl = extractUrl(params.get("url") || "");

  if (incomingUrl) {
    els.input.value = incomingUrl;
    state.autoConvertedFromQuery = true;
    showStatus("link recebido automaticamente.", "success", { autoHide: true });

    requestAnimationFrame(() => {
      setTimeout(() => {
        onConvert();
      }, 120);
    });
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

async function smartPasteIntoInput({ announce = false, autoConvert = false } = {}) {
  if (!navigator.clipboard?.readText) return false;

  try {
    const text = await navigator.clipboard.readText();
    const url = extractUrl(text);

    if (url) {
      els.input.value = url;
      softlyDismissKeyboard();
      if (announce) showFloatingToast("link colado no campo.");
      if (autoConvert && isSupportedStreamingUrl(url)) {
        setTimeout(() => onConvert(), 60);
      }
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

  softlyDismissKeyboard();
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
      `${result.links.length} swap${result.links.length === 1 ? "" : "s"} encontrado${result.links.length === 1 ? "" : "s"}!`,
      "success"
    );

    requestAnimationFrame(() => {
      setTimeout(() => {
        els.statusCard?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, state.autoConvertedFromQuery ? 40 : 100);
    });
  } catch (_error) {
    showStatus("deu erro na conversão. tente novamente em instantes.", "error");
  } finally {
    setLoading(false);
    state.autoConvertedFromQuery = false;
  }
}

function normalizeApiPayload(data) {
  const links = normalizeLinks(data.links);
  if (!links.length) return null;

  const rawTitle = cleanText(data.title || "música encontrada");
  const rawDescription = cleanText(data.description || "");
  const preview = parsePreview(rawTitle, rawDescription);

  return {
    title: preview.title,
    artist: preview.artist,
    album: preview.album || cleanText(data.album || ""),
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
      artist: "",
      album: ""
    };
  }

  const titleLower = cleanTitle.toLowerCase();
  const descriptionLower = cleanDescription.toLowerCase();

  if (descriptionLower === titleLower) {
    return {
      title: cleanTitle,
      artist: "",
      album: ""
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

  const filtered = parts.filter(part => part.toLowerCase() !== titleLower);

  if (!filtered.length) {
    return {
      title: cleanTitle,
      artist: "",
      album: ""
    };
  }

  return {
    title: cleanTitle,
    artist: filtered[0] || "",
    album: filtered.slice(1).join(" • ")
  };
}

function renderSupportedChips() {
  if (!els.supportedChips) return;

  els.supportedChips.innerHTML = SUPPORTED_PLATFORM_CHIPS
    .map(key => {
      const meta = PLATFORM_META[key];
      return `<span class="chip icon-chip" title="${escapeHtml(meta.name)}" aria-label="${escapeHtml(meta.name)}">${meta.icon}</span>`;
    })
    .join("");
}

function renderResult(result) {
  els.resultCard.classList.remove("hidden");
  els.resultCard.classList.add("result-card-live");
  els.platformGroups.innerHTML = "";

  els.resultTitle.textContent = result.title || "resultado";
  els.resultMeta.textContent = buildMeta(result);

  if (result.artist) {
    els.resultDescription.textContent = result.artist;
    els.resultDescription.classList.remove("hidden");
  } else {
    els.resultDescription.classList.add("hidden");
    els.resultDescription.textContent = "";
  }

  if (result.image) {
    els.coverImage.src = result.image;
    els.coverImage.classList.remove("hidden");
  } else {
    els.coverImage.classList.add("hidden");
    els.coverImage.removeAttribute("src");
  }

  const primaryText = buildPrimaryLinksText(result);
  if (primaryText) {
    els.copyPrimaryButton.classList.remove("hidden");
  } else {
    els.copyPrimaryButton.classList.add("hidden");
  }

  els.resultActions.classList.remove("hidden");
  if (result.universalLink) {
    els.copyUniversalButton.classList.remove("hidden");
  } else {
    els.copyUniversalButton.classList.add("hidden");
  }

  const groups = ["principais", "outras"];
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

  setTimeout(() => {
    els.resultCard.classList.remove("result-card-live");
  }, 520);
}

function createPlatformItem(item) {
  const row = document.createElement("article");
  row.className = "platform-item";

  row.innerHTML = `
    <div class="platform-icon">${item.icon}</div>
    <div class="platform-copy">
      <div class="platform-name">${escapeHtml(item.name)}</div>
      <div class="platform-note ${item.isVerified ? "is-verified" : "is-found"}">${
        item.isVerified ? "link verificado" : "link encontrado"
      }</div>
    </div>
    <div class="platform-actions">
      <button class="mini-action copy" type="button" data-action="copy" aria-label="copiar" title="copiar">
        <span class="button-icon">${SVG_ICONS.copy}</span>
      </button>
      <button class="mini-action share" type="button" data-action="share" aria-label="compartilhar" title="compartilhar">
        <span class="button-icon">${SVG_ICONS.share}</span>
      </button>
      <button class="mini-action open" type="button" data-action="open" aria-label="abrir" title="abrir">
        <span class="button-icon">${SVG_ICONS.open}</span>
      </button>
    </div>
  `;

  row.querySelector('[data-action="copy"]').addEventListener("click", async () => {
    await copyText(item.url);
    showInlineToast(row, `${item.name} copiado.`);
  });

  row.querySelector('[data-action="share"]').addEventListener("click", async () => {
    const shared = await shareLink(item);
    if (shared) {
      showInlineToast(row, `${item.name} compartilhado.`);
    } else {
      await copyText(item.url);
      showInlineToast(row, `${item.name} copiado.`);
    }
  });

  row.querySelector('[data-action="open"]').addEventListener("click", () => {
    openExternalUrl(item.url);
  });

  return row;
}

async function shareLink(item) {
  const titleBits = [state.currentResult?.title, state.currentResult?.artist].filter(Boolean).join(" • ");
  const shareTitle = titleBits || item.name;
  const shareText = [shareTitle, `${item.name}: ${item.url}`].filter(Boolean).join("\n");

  if (navigator.share) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: item.url
      });
      return true;
    } catch (_error) {
      return false;
    }
  }

  return false;
}

function showInlineToast(container, message) {
  const existing = container.querySelector(".platform-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "platform-toast";
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.remove();
  }, 1900);
}

function openExternalUrl(url) {
  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(url, { try_instant_view: false });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function softlyDismissKeyboard() {
  try {
    els.input.blur();
    document.activeElement?.blur?.();
  } catch (_error) {}
}

function hideResult() {
  els.resultCard.classList.add("hidden");
  els.platformGroups.innerHTML = "";
  els.copyPrimaryButton.classList.add("hidden");
}

function showStatus(message, tone = "default", { autoHide = false } = {}) {
  clearTimeout(state.statusHideTimer);
  els.statusCard.textContent = message;
  els.statusCard.classList.remove("hidden", "is-error", "is-success");
  if (tone === "error") els.statusCard.classList.add("is-error");
  if (tone === "success") els.statusCard.classList.add("is-success");

  if (autoHide) {
    state.statusHideTimer = setTimeout(() => {
      hideStatus();
    }, 2200);
  }
}

function hideStatus() {
  clearTimeout(state.statusHideTimer);
  els.statusCard.classList.add("hidden");
}

function showFloatingToast(message) {
  if (!els.floatingToast) return;

  clearTimeout(state.floatingToastTimer);
  els.floatingToast.textContent = message;
  els.floatingToast.classList.remove("hidden", "show");

  requestAnimationFrame(() => {
    els.floatingToast.classList.add("show");
  });

  state.floatingToastTimer = setTimeout(() => {
    els.floatingToast.classList.remove("show");
    els.floatingToast.classList.add("hidden");
  }, 2050);
}

function setLoading(loading) {
  els.convertButton.disabled = loading;
  els.convertButton.textContent = loading ? "swapando..." : "swap";
}

function resetForm() {
  els.input.value = "";
  softlyDismissKeyboard();
  hideStatus();
  hideResult();
  state.currentResult = null;
  state.currentOriginalUrl = null;
  state.autoConvertedFromQuery = false;
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
      section: "outras",
      order: 999,
      isPrimaryCopy: false
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
      isVerified: !!item.isVerified,
      isPrimaryCopy: !!meta.isPrimaryCopy
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
  if (result.album) pieces.push(result.album);
  return pieces.join(" • ");
}

function buildPrimaryLinksText(result) {
  const items = result.links.filter(item => item.isPrimaryCopy);
  if (!items.length) return "";

  const lines = [];
  const heading = [result.artist, result.title].filter(Boolean).join("\n");
  if (heading) lines.push(heading);
  lines.push("");

  items.forEach((item, index) => {
    lines.push(`${item.name}: ${item.url}`);
    if (index < items.length - 1) lines.push("");
  });

  return lines.join("\n").trim();
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
  if (window.Telegram?.WebApp?.Clipboard?.writeText) {
    window.Telegram.WebApp.Clipboard.writeText(text);
    return;
  }

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