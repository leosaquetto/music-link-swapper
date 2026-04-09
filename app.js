const input = document.getElementById("linkInput");
const convertBtn = document.getElementById("convertBtn");
const clearBtn = document.getElementById("clearBtn");
const result = document.getElementById("result");
const status = document.getElementById("status");

const params = new URLSearchParams(window.location.search);
const urlParam = params.get("url");

if (urlParam) {
  input.value = decodeURIComponent(urlParam);
  convert();
}

convertBtn.onclick = convert;

clearBtn.onclick = () => {
  input.value = "";
  result.innerHTML = "";
  result.classList.add("hidden");
  setStatus("");
};

async function convert() {
  const url = input.value.trim();

  if (!url) {
    setStatus("cole um link válido", "error");
    return;
  }

  setStatus("convertendo...");
  result.innerHTML = "";
  result.classList.add("hidden");

  try {
    const res = await fetch(`/api/convert?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!data || !Array.isArray(data.links) || !data.links.length) {
      setStatus("não foi possível converter esse link", "error");
      return;
    }

    renderResult(data, url);
    setStatus("● convertido", "success");
  } catch (e) {
    setStatus("erro ao converter. tente novamente.", "error");
  }
}

function setStatus(text, type = "") {
  status.textContent = text;
  status.className = "status";
  if (type) status.classList.add(type);
}

function renderResult(data, originalUrl) {
  const links = data.links.filter(item => item?.url);
  if (!links.length) {
    setStatus("não encontrei plataformas para esse link", "error");
    return;
  }

  const grouped = links
    .slice()
    .sort((a, b) => {
      const aOrder = platformOrder(a.type);
      const bOrder = platformOrder(b.type);
      return aOrder - bOrder;
    });

  const metaCard = `
    <section class="meta-card card">
      <div class="meta-top">
        ${data.image ? `<img class="cover" src="${escapeHtml(data.image)}" alt="">` : ""}
        <div class="meta-copy">
          <h2 class="track-title">${escapeHtml(data.title || "música encontrada")}</h2>
          ${buildArtistLine(data.description)}
          ${buildAlbumLine(data.description)}
        </div>
      </div>
    </section>
  `;

  const platformCards = grouped
    .map(item => {
      const isSpotifyOff = item.type === "spotify" && item.notAvailable;
      const badgeClass = item.isVerified ? "verificado" : "encontrado";
      const badgeText = item.isVerified ? "● verificado" : "● encontrado";
      const prettyName = prettifyPlatform(item.type);

      return `
        <article class="platform-card ${isSpotifyOff ? "spotify-off" : ""}">
          <div class="platform-top">
            <div>
              <h3 class="platform-name">${escapeHtml(prettyName)}</h3>
              <div class="platform-badge ${badgeClass}">${badgeText}</div>
            </div>
          </div>

          <div class="platform-actions">
            <button class="platform-action copy" onclick='copyLink(${JSON.stringify(item.url)})'>
              copiar
            </button>
            <a class="platform-action open" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
              abrir
            </a>
          </div>
        </article>
      `;
    })
    .join("");

  const copyAllCard = `
    <section class="copy-all-card card">
      <button class="copy-all-btn" onclick='copyAll(${JSON.stringify(buildAllText(data))})'>
        copiar tudo
      </button>
    </section>
  `;

  result.innerHTML = `
    ${metaCard}
    <section class="platform-list">
      ${platformCards}
    </section>
    ${copyAllCard}
  `;

  result.classList.remove("hidden");
}

function buildArtistLine(description) {
  if (!description) return "";
  const parts = splitDescription(description);
  if (!parts.artist) return "";
  return `<p class="track-artist">${escapeHtml(parts.artist)}</p>`;
}

function buildAlbumLine(description) {
  if (!description) return "";
  const parts = splitDescription(description);
  if (!parts.album) return "";
  return `<p class="track-album">álbum: ${escapeHtml(parts.album)}</p>`;
}

function splitDescription(description) {
  const clean = String(description || "").trim();
  if (!clean) return { artist: "", album: "" };

  const parts = clean
    .split(/[-–•|]/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      artist: parts[0],
      album: parts.slice(1).join(" • ")
    };
  }

  return {
    artist: clean,
    album: ""
  };
}

function platformOrder(type) {
  const order = {
    appleMusic: 1,
    spotify: 2,
    youTube: 3,
    youtube: 3,
    youtubeMusic: 3,
    deezer: 4,
    soundCloud: 5,
    pandora: 6,
    qobuz: 7,
    bandcamp: 8,
    tidal: 9
  };
  return order[type] || 999;
}

function prettifyPlatform(type) {
  const names = {
    appleMusic: "apple music",
    spotify: "spotify",
    youTube: "youtube music",
    youtube: "youtube music",
    youtubeMusic: "youtube music",
    deezer: "deezer",
    soundCloud: "soundcloud",
    pandora: "pandora",
    qobuz: "qobuz",
    bandcamp: "bandcamp",
    tidal: "tidal"
  };
  return names[type] || String(type || "");
}

function buildAllText(data) {
  const lines = [];
  lines.push(data.title || "música encontrada");
  if (data.description) lines.push(data.description);
  lines.push("");

  (data.links || []).forEach(item => {
    if (!item?.url) return;
    lines.push(`${prettifyPlatform(item.type)}: ${item.url}`);
  });

  return lines.join("\n");
}

async function copyLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    setStatus("link copiado", "success");
  } catch {
    fallbackCopy(url);
    setStatus("link copiado", "success");
  }
}

async function copyAll(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus("lista completa copiada", "success");
  } catch {
    fallbackCopy(text);
    setStatus("lista completa copiada", "success");
  }
}

function fallbackCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
