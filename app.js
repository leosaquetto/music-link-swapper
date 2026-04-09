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

    if (!data || !Array.isArray(data.links)) {
      status.innerHTML = "não foi possível converter esse link";
      return;
    }

    status.innerHTML = `<span class="badge verificado">● convertido</span>`;

    data.links.forEach((item) => {
      if (!item?.url) return;

      const div = document.createElement("div");
      div.className = "platform";

      if (item.type === "spotify" && item.notAvailable) {
        div.classList.add("spotify", "off");
      }

      const badgeClass = item.isVerified ? "verificado" : "encontrado";
      const badgeText = item.isVerified ? "● verificado" : "● encontrado";

      div.innerHTML = `
        <strong>${item.type}</strong><br/>
        <span class="badge ${badgeClass}">${badgeText}</span><br/><br/>
        <a href="${item.url}" target="_blank">abrir</a>
      `;

      result.appendChild(div);
    });

  } catch (e) {
    status.innerHTML = "erro ao converter. tente novamente.";
  }
}
