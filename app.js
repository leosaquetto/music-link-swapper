const API_URL = "https://idonthavespotify.sjdonado.com/api/search?v=1";

const input = document.getElementById("linkInput");
const convertBtn = document.getElementById("convertButton");
const statusCard = document.getElementById("statusCard");
const resultCard = document.getElementById("resultCard");

convertBtn.onclick = async () => {
  const link = input.value.trim();
  if (!link) return showStatus("cole um link válido");

  showStatus("convertendo...");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link })
    });

    const data = await res.json();
    if (!data.links) return showStatus("erro ao converter");

    renderResult(data);
  } catch (e) {
    showStatus("erro na requisição");
  }
};

function showStatus(msg){
  statusCard.textContent = msg;
  statusCard.classList.remove("hidden");
}

function renderResult(data){
  statusCard.classList.add("hidden");
  resultCard.classList.remove("hidden");
  document.getElementById("resultTitle").textContent = data.title || "resultado";
}
