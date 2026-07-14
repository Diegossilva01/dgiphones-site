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

document.getElementById("start")?.addEventListener("click", () => {
  quote.classList.add("quote-open");
  scrollToQuote();
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

form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!validarFormulario()) return;

  answers.nome = nome.value.trim();
  answers.telefone = telefone.value.trim();

  quote.style.display = "none";
  loading.style.display = "block";
  scrollTo({ top: 0, behavior: "smooth" });

  try {
    await fetch(
      "https://script.google.com/macros/s/AKfycbxMu3BP2bif1gnx7VYLf_uc3C9fxJRcKqlUo38ejHRrVYHRVfkP8spefwegJrEFUet9/exec",
      {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers)
      }
    );
  } catch (error) {
    console.error(error);
  }

  setTimeout(() => {
    loading.style.display = "none";
    success.style.display = "block";
    scrollTo({ top: 0, behavior: "smooth" });
  }, 2200);
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

validarFormulario();
showStep(0);
