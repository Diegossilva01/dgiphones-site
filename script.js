/* DGIPHONES — SCRIPT.JS */

const steps = [...document.querySelectorAll(".step")];
const progressFill = document.querySelector(".progressFill");
const progressNumber = document.getElementById("progressNumber");
const loading = document.getElementById("loading");
const success = document.getElementById("success");
const quote = document.getElementById("quote");
const form = document.getElementById("quoteForm");

let currentStep = 0;
const totalSteps = steps.length;
const answers = {};

const WHATSAPP_COTACAO = "5511960688383";
const COTACAO_API_URL = "https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec";
const COTACOES_LOCAL_KEY = "celltech_cotacoes_enviadas";

function gerarIdCotacao() {
  const agora = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `CT-${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}-${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
}

function salvarCotacaoLocal(cotacao) {
  try {
    const atual = JSON.parse(localStorage.getItem(COTACOES_LOCAL_KEY) || "[]");
    const lista = Array.isArray(atual) ? atual : [];
    lista.push(cotacao);
    localStorage.setItem(COTACOES_LOCAL_KEY, JSON.stringify(lista.slice(-20)));
    localStorage.setItem("celltech_ultima_cotacao", JSON.stringify(cotacao));
  } catch (error) {
    console.warn("Não foi possível salvar a cotação localmente.", error);
  }
}

async function enviarCotacaoServidor(cotacao) {
  try {
    const envio = fetch(COTACAO_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ acao: "receberCotacaoSite", ...cotacao }),
      keepalive: true
    });

    // Dá tempo para o Apps Script registrar na planilha e disparar o e-mail,
    // sem impedir o cliente de seguir ao WhatsApp se houver instabilidade.
    await Promise.race([
      envio,
      new Promise(resolve => setTimeout(resolve, 3500))
    ]);
    return true;
  } catch (error) {
    console.warn("Cotação não enviada ao servidor; seguindo para o WhatsApp.", error);
    return false;
  }
}

function montarMensagemWhatsApp(cotacao) {
  const valor = (campo, padrao = "Não informado") => String(cotacao[campo] || "").trim() || padrao;
  const origem = [
    cotacao.utm_source ? `utm_source: ${cotacao.utm_source}` : "",
    cotacao.utm_medium ? `utm_medium: ${cotacao.utm_medium}` : "",
    cotacao.utm_campaign ? `utm_campaign: ${cotacao.utm_campaign}` : "",
    cotacao.gclid ? `gclid: ${cotacao.gclid}` : "",
    cotacao.fbclid ? `fbclid: ${cotacao.fbclid}` : ""
  ].filter(Boolean).join(" | ");

  return [
    "Olá! Quero vender meu iPhone para a CellTech Panamby.",
    "",
    `📋 *COTAÇÃO ${cotacao.idCotacao}*`,
    `👤 *Nome:* ${valor("nome")}`,
    `📞 *WhatsApp:* ${valor("telefone")}`,
    "",
    `📱 *Modelo:* ${valor("modelo")}`,
    `💾 *Armazenamento:* ${valor("armazenamento")}`,
    `🎨 *Cor:* ${valor("cor")}`,
    `⚡ *Liga normalmente:* ${valor("liga")}`,
    `🖥️ *Tela:* ${valor("tela")}`,
    `📲 *Traseira:* ${valor("traseira")}`,
    `🔋 *Saúde da bateria:* ${valor("bateria")}`,
    `🔧 *Peças trocadas:* ${valor("pecas")}`,
    "",
    `🕒 *Enviado em:* ${new Date(cotacao.enviadoEm).toLocaleString("pt-BR")}`,
    origem ? `📣 *Origem:* ${origem}` : ""
  ].filter(Boolean).join("\n");
}

const params = new URLSearchParams(window.location.search);
answers.utm_source = params.get("utm_source") || "";
answers.utm_medium = params.get("utm_medium") || "";
answers.utm_campaign = params.get("utm_campaign") || "";
answers.gclid = params.get("gclid") || "";
answers.fbclid = params.get("fbclid") || "";
answers.dispositivo = navigator.userAgent;

function scrollToQuote() {
  if (!quote) return;

  const header = document.querySelector(".simple-header");
  const headerOffset = (header?.offsetHeight || 72) + 12;
  const top = quote.getBoundingClientRect().top + window.scrollY - headerOffset;

  window.scrollTo({
    top: Math.max(0, top),
    behavior: "smooth"
  });
}

function keepActiveStepVisible(step) {
  if (!step) return;

  // No celular, evitamos o scroll automático que puxava a página
  // de volta para o começo do formulário a cada resposta.
  if (window.matchMedia("(max-width: 768px)").matches) {
    const header = document.querySelector(".simple-header");
    const headerOffset = (header?.offsetHeight || 72) + 12;
    const rect = step.getBoundingClientRect();
    const visibleTop = headerOffset;
    const visibleBottom = window.innerHeight - 24;

    if (rect.top < visibleTop || rect.top > visibleBottom) {
      window.scrollTo({
        top: Math.max(0, rect.top + window.scrollY - headerOffset),
        behavior: "auto"
      });
    }
    return;
  }

  step.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("start")?.addEventListener("click", event => {
  const link = event.currentTarget;
  if (link.tagName === "A") {
    event.preventDefault();
    const query = window.location.search || "";
    window.location.href = link.getAttribute("href") + query;
  }
});

function updateProgress() {
  const percent = ((currentStep + 1) / totalSteps) * 100;
  progressFill.style.width = `${percent}%`;
  progressNumber.textContent = `${currentStep + 1} / ${totalSteps}`;
}

function showStep(index) {
  if (!steps[index]) return;

  steps.forEach(step => step.classList.remove("active"));
  steps[index].classList.add("active");
  currentStep = index;
  updateProgress();

  requestAnimationFrame(() => keepActiveStepVisible(steps[index]));
}

function saveStepAnswer(step) {
  const field = step.dataset.field;
  const selected = [...step.querySelectorAll(".option.selected")]
    .map(button => button.textContent.trim());

  if (!field || field === "contato") return;

  answers[field] = step.dataset.mode === "multi"
    ? selected.join(", ")
    : (selected[0] || "");
}

function updateContinueButton(step) {
  const button = step.querySelector(".continue-button");
  if (!button) return;

  button.disabled = !step.querySelector(".option.selected");
}

document.querySelectorAll(".option").forEach(button => {
  button.addEventListener("click", () => {
    const step = button.closest(".step");
    const mode = step.dataset.mode;

    if (mode === "multi") {
      const isExclusive = button.classList.contains("exclusive-option");

      if (isExclusive) {
        step.querySelectorAll(".option").forEach(item => {
          if (item !== button) item.classList.remove("selected");
        });

        button.classList.toggle("selected");
      } else {
        step.querySelectorAll(".exclusive-option").forEach(item => {
          item.classList.remove("selected");
        });

        button.classList.toggle("selected");
      }

      saveStepAnswer(step);
      updateContinueButton(step);
      return;
    }

    step.querySelectorAll(".option").forEach(item => item.classList.remove("selected"));
    button.classList.add("selected");
    saveStepAnswer(step);

    setTimeout(() => {
      if (currentStep < totalSteps - 1) showStep(currentStep + 1);
    }, 220);
  });
});

document.querySelectorAll(".continue-button").forEach(button => {
  button.disabled = true;

  button.addEventListener("click", () => {
    const step = button.closest(".step");
    saveStepAnswer(step);

    if (!step.querySelector(".option.selected")) return;
    if (currentStep < totalSteps - 1) showStep(currentStep + 1);
  });
});

const search = document.getElementById("search");

search?.addEventListener("input", () => {
  const value = search.value.trim().toLowerCase();

  steps[0].querySelectorAll(".option").forEach(button => {
    button.style.display = button.textContent.toLowerCase().includes(value)
      ? "flex"
      : "none";
  });
});

document.getElementById("backButton")?.addEventListener("click", () => {
  if (currentStep > 0) showStep(currentStep - 1);
});

const telefone = document.getElementById("telefone");
const nome = document.getElementById("nome");
const finishButton = document.getElementById("finishButton");
const nomeErro = document.getElementById("nomeErro");
const telefoneErro = document.getElementById("telefoneErro");

function mascaraTelefone(valor) {
  const numeros = valor.replace(/\D/g, "").slice(0, 11);

  if (numeros.length > 10) {
    return numeros.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
  }

  if (numeros.length > 6) {
    return numeros.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  }

  if (numeros.length > 2) {
    return numeros.replace(/(\d{2})(\d+)/, "($1) $2");
  }

  return numeros;
}

telefone?.addEventListener("input", () => {
  telefone.value = mascaraTelefone(telefone.value);
  validarFormulario();
});

nome?.addEventListener("input", validarFormulario);

function validarFormulario() {
  const nomeValido = nome.value.trim().length >= 3;
  const telefoneValido = telefone.value.replace(/\D/g, "").length === 11;

  nome.classList.toggle("input-error", nome.value.length > 0 && !nomeValido);
  nome.classList.toggle("input-ok", nomeValido);

  telefone.classList.toggle("input-error", telefone.value.length > 0 && !telefoneValido);
  telefone.classList.toggle("input-ok", telefoneValido);

  nomeErro.textContent = nome.value.length > 0 && !nomeValido
    ? "Digite pelo menos 3 caracteres."
    : "";

  telefoneErro.textContent = telefone.value.length > 0 && !telefoneValido
    ? "Digite um WhatsApp com DDD e 11 números."
    : "";

  finishButton.disabled = !(nomeValido && telefoneValido);
  return nomeValido && telefoneValido;
}

form?.addEventListener("submit", async event => {
  event.preventDefault();

  if (!validarFormulario()) return;

  answers.nome = nome.value.trim();
  answers.telefone = telefone.value.trim();

  const cotacao = {
    ...answers,
    idCotacao: gerarIdCotacao(),
    enviadoEm: new Date().toISOString(),
    pagina: window.location.href
  };

  // Salva antes do redirecionamento para evitar perda das respostas.
  salvarCotacaoLocal(cotacao);

  // Registra a cotação e dispara o e-mail antes de abrir o WhatsApp.
  // Se o servidor falhar, o WhatsApp continua funcionando normalmente.
  finishButton.disabled = true;
  finishButton.innerHTML = 'Enviando cotação... <i class="fa-solid fa-paper-plane"></i>';
  await enviarCotacaoServidor(cotacao);

  const mensagem = montarMensagemWhatsApp(cotacao);
  const whatsappUrl = `https://wa.me/${WHATSAPP_COTACAO}?text=${encodeURIComponent(mensagem)}`;

  finishButton.innerHTML = 'Abrindo WhatsApp <i class="fa-brands fa-whatsapp"></i>';

  if (quote) quote.style.display = "none";
  if (loading) loading.style.display = "block";
  scrollTo({ top: 0, behavior: "smooth" });

  setTimeout(() => {
    window.location.href = whatsappUrl;

    // Se o cliente voltar do WhatsApp para o site, exibe a confirmação.
    setTimeout(() => {
      if (loading) loading.style.display = "none";
      if (success) success.style.display = "block";
    }, 1800);
  }, 450);
});

document.getElementById("newQuote")?.addEventListener("click", event => {
  event.preventDefault();
  window.location.reload();
});

document.querySelectorAll(".faq-question").forEach(button => {
  button.addEventListener("click", () => {
    button.closest(".faq-item").classList.toggle("active");
  });
});

if (form) {
  validarFormulario();
  showStep(0);
}
