const input = document.getElementById("linkInput");
const convertBtn = document.getElementById("convertBtn");
const clearBtn = document.getElementById("clearBtn");
const result = document.getElementById("result");
const status = document.getElementById("status");

// suporta ?url=
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
  status.innerHTML = "";
};

async function convert() {
  const url = input.value.trim();

  if (!url) {
    status.innerHTML = "cole um link válido";
    return;
  }

  status.innerHTML = "convertendo...";
  result.innerHTML = "";

  try {
    const res = await fetch(`/api/convert?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (!data || !data.linksByPlatform) {
      status.innerHTML = "não foi possível converter esse link";
      return;
    }

    status.innerHTML = `<span class="badge verificado">● verificado</span>`;

    Object.entries(data.linksByPlatform).forEach(([platform, link]) => {
      const div = document.createElement("div");
      div.className = "platform";

      if (platform === "spotify" && !link) {
        div.classList.add("spotify", "off");
      }

      div.innerHTML = `
        <strong>${platform}</strong><br/>
        <a href="${link}" target="_blank">abrir</a>
      `;

      result.appendChild(div);
    });

  } catch (e) {
    status.innerHTML = "erro ao converter. tente novamente.";
  }
}
