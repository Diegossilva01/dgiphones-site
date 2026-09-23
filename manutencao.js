const WHATSAPP_MANUTENCAO = "5511977030517";
const MANUTENCAO_API_URL = "https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec";

const modelos = [
  "iPhone 7", "iPhone 7 Plus", "iPhone 8", "iPhone 8 Plus", "iPhone X",
  "iPhone XR", "iPhone XS", "iPhone XS Max", "iPhone SE (2ª geração)",
  "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
  "iPhone 12 mini", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
  "iPhone 13 mini", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max", "iPhone SE (3ª geração)",
  "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
  "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
  "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max",
  "iPhone 17", "iPhone 17 Air", "iPhone 17 Pro", "iPhone 17 Pro Max"
];

const $ = selector => document.querySelector(selector);
const modelList = $("#modelList");
const modelSearch = $("#modelSearch");
const summaryModel = $("#summaryModel");
const summaryRepairs = $("#summaryRepairs");
const repairDetails = $("#repairDetails");
const charCount = $("#charCount");
const sendWhatsapp = $("#sendWhatsapp");
const menuToggle = $("#menuToggle");
const mainNav = $("#mainNav");
const leadModal = $("#leadModal");
const leadForm = $("#leadForm");
const customerWhatsapp = $("#customerWhatsapp");
const leadError = $("#leadError");
const leadSubmit = $("#leadSubmit");

let selectedModel = "";
const selectedRepairs = new Set();

function normalizeText(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function renderModels(filter = "") {
  const normalizedFilter = normalizeText(filter.trim());
  const filtered = modelos.filter(modelo => normalizeText(modelo).includes(normalizedFilter));
  modelList.innerHTML = "";

  if (!filtered.length) {
    modelList.innerHTML = '<p class="models-empty">Nenhum modelo encontrado.</p>';
    return;
  }

  filtered.forEach(modelo => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "model-button" + (selectedModel === modelo ? " selected" : "");
    button.innerHTML = `<span>${modelo}</span><i class="fa-solid fa-check"></i>`;
    button.addEventListener("click", () => {
      selectedModel = modelo;
      modelSearch.value = modelo;
      renderModels(modelo);
      updateSummary();
    });
    modelList.appendChild(button);
  });
}

function updateSummary() {
  summaryModel.textContent = selectedModel || "Não selecionado";
  summaryRepairs.innerHTML = "";

  if (!selectedRepairs.size) {
    summaryRepairs.innerHTML = "<em>Nenhum selecionado</em>";
  } else {
    selectedRepairs.forEach(repair => {
      const chip = document.createElement("span");
      chip.className = "repair-chip";
      chip.textContent = repair;
      summaryRepairs.appendChild(chip);
    });
  }

  sendWhatsapp.disabled = !(selectedModel && selectedRepairs.size);
}

function formatPhone(value = "") {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function phoneDigits(value = "") {
  return value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
}

function validPhone(value = "") {
  const digits = phoneDigits(value);
  return digits.length === 10 || digits.length === 11;
}

function openLeadModal() {
  if (!selectedModel || !selectedRepairs.size) return;
  leadError.textContent = "";
  leadModal.classList.add("open");
  leadModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => customerWhatsapp.focus(), 80);
}

function closeLeadModal() {
  leadModal.classList.remove("open");
  leadModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function getTracking() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    gclid: params.get("gclid") || "",
    fbclid: params.get("fbclid") || ""
  };
}

function makeLeadId() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `MAN-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function saveMaintenanceLead(lead) {
  try {
    const request = fetch(MANUTENCAO_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ acao: "receberManutencaoSite", ...lead }),
      keepalive: true
    });
    await Promise.race([request, new Promise(resolve => setTimeout(resolve, 2500))]);
    return true;
  } catch (error) {
    console.warn("Não foi possível registrar o atendimento na planilha.", error);
    return false;
  }
}

function buildWhatsappMessage(lead) {
  const repairs = lead.reparos.map(item => `• ${item}`).join("\n");
  return [
    "Olá! Vim pelo site da CellTech Panamby e preciso de uma avaliação para manutenção do meu iPhone.",
    "",
    `📋 *Atendimento:* ${lead.idManutencao}`,
    `📞 *Meu WhatsApp:* ${lead.whatsapp}`,
    `📱 *Modelo:* ${lead.modelo}`,
    "🔧 *Problema(s):*",
    repairs,
    lead.detalhes ? `\n📝 *Detalhes:* ${lead.detalhes}` : "",
    "",
    "Gostaria de saber como funciona a avaliação e o reparo."
  ].filter(Boolean).join("\n");
}

modelSearch?.addEventListener("input", () => {
  if (modelSearch.value !== selectedModel) {
    selectedModel = "";
    updateSummary();
  }
  renderModels(modelSearch.value);
});

document.querySelectorAll(".repair-option").forEach(button => {
  button.addEventListener("click", () => {
    const repair = button.dataset.repair;
    button.classList.toggle("selected");
    if (button.classList.contains("selected")) selectedRepairs.add(repair);
    else selectedRepairs.delete(repair);
    updateSummary();
  });
});

repairDetails?.addEventListener("input", () => {
  charCount.textContent = repairDetails.value.length;
});

sendWhatsapp?.addEventListener("click", openLeadModal);

document.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeLeadModal));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && leadModal?.classList.contains("open")) closeLeadModal();
});

customerWhatsapp?.addEventListener("input", () => {
  customerWhatsapp.value = formatPhone(customerWhatsapp.value);
  leadError.textContent = "";
});

leadForm?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!validPhone(customerWhatsapp.value)) {
    leadError.textContent = "Digite um WhatsApp válido com DDD.";
    customerWhatsapp.focus();
    return;
  }

  const tracking = getTracking();
  const lead = {
    idManutencao: makeLeadId(),
    whatsapp: `+55 ${formatPhone(customerWhatsapp.value)}`,
    modelo: selectedModel,
    reparos: [...selectedRepairs],
    detalhes: repairDetails.value.trim(),
    ...tracking,
    pagina: window.location.href,
    dispositivo: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
    enviadoEm: new Date().toISOString()
  };

  leadSubmit.disabled = true;
  leadSubmit.classList.add("loading");
  leadSubmit.querySelector("span").textContent = "Registrando atendimento...";

  await saveMaintenanceLead(lead);

  try {
    localStorage.setItem("celltech_ultima_manutencao", JSON.stringify(lead));
  } catch (_) {}

  const message = buildWhatsappMessage(lead);
  const whatsappUrl = `https://wa.me/${WHATSAPP_MANUTENCAO}?text=${encodeURIComponent(message)}`;
  window.location.href = whatsappUrl;

  setTimeout(() => {
    leadSubmit.disabled = false;
    leadSubmit.classList.remove("loading");
    leadSubmit.querySelector("span").textContent = "Enviar e falar com a loja";
  }, 1500);
});

document.querySelectorAll(".faq-item button").forEach(button => {
  button.addEventListener("click", () => {
    const item = button.closest(".faq-item");
    document.querySelectorAll(".faq-item").forEach(other => {
      if (other !== item) other.classList.remove("open");
    });
    item.classList.toggle("open");
  });
});

menuToggle?.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
});

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
    if (menuToggle) menuToggle.innerHTML = '<i class="fa-solid fa-bars"></i>';
  });
});

renderModels();
updateSummary();
