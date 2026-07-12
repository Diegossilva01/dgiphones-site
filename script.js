/* ==========================
   DGIPHONES - script.js
========================== */

const steps = document.querySelectorAll(".step");
const progressFill = document.querySelector(".progressFill");
const progressNumber = document.getElementById("progressNumber");

const loading = document.getElementById("loading");
const success = document.getElementById("success");
const quote = document.getElementById("quote");

const form = document.getElementById("quoteForm");

let currentStep = 0;
const totalSteps = steps.length;

const answers = {};
const fields = [
    "modelo",
    "armazenamento",
    "cor",
    "liga",
    "tela",
    "traseira",
    "bateria",
    "pecas"
];

const params = new URLSearchParams(window.location.search);

answers.utm_source = params.get("utm_source") || "";
answers.utm_medium = params.get("utm_medium") || "";
answers.utm_campaign = params.get("utm_campaign") || "";
answers.gclid = params.get("gclid") || "";
answers.fbclid = params.get("fbclid") || "";
answers.dispositivo = navigator.userAgent;
/* ==========================
INICIAR
========================== */

const start = document.getElementById("start");

if (start) {
    start.addEventListener("click", () => {
        document.getElementById("quote").scrollIntoView({
            behavior: "smooth"
        });
    });
}

/* ==========================
ATUALIZA PROGRESSO
========================== */

function updateProgress() {
    const percent = ((currentStep + 1) / totalSteps) * 100;
    progressFill.style.width = percent + "%";
    progressNumber.innerHTML = `${currentStep + 1} / ${totalSteps}`;
}

/* ==========================
MOSTRAR ETAPA
========================== */

function showStep(index) {
    steps.forEach(step => step.classList.remove("active"));

    if (steps[index]) {
        steps[index].classList.add("active");
        currentStep = index;
        updateProgress();
    }
}

/* ==========================
BOTÕES DE OPÇÃO
========================== */

document.querySelectorAll(".option").forEach(button => {

    button.addEventListener("click", () => {

        const step = button.closest(".step");

        step.querySelectorAll(".option").forEach(btn => {
            btn.classList.remove("selected");
        });

        button.classList.add("selected");

        const question = step.querySelector("h2").innerText;

const index = [...steps].indexOf(step);

if (fields[index]) {
    answers[fields[index]] = button.innerText;
}
        setTimeout(() => {

            if (currentStep < totalSteps - 1) {

                showStep(currentStep + 1);

                window.scrollTo({
                    top: document.getElementById("quote").offsetTop - 80,
                    behavior: "smooth"
                });

            }

        }, 250);

    });

});

/* ==========================
BUSCA MODELOS
========================== */

const search = document.getElementById("search");

if (search) {

    search.addEventListener("keyup", () => {

        const value = search.value.toLowerCase();

        document.querySelectorAll(".step:first-child .option").forEach(card => {

            if (card.innerText.toLowerCase().includes(value)) {
                card.style.display = "flex";
            } else {
                card.style.display = "none";
            }

        });

    });

}

/* ==========================
BOTÃO VOLTAR
========================== */

const back = document.getElementById("backButton");

if (back) {

    back.addEventListener("click", () => {

        if (currentStep > 0) {
            showStep(currentStep - 1);
        }

    });

}

/* ==========================
ENVIO
========================== */

form.addEventListener("submit", async (e) => {

    e.preventDefault();

    answers.nome = document.getElementById("nome").value;
    answers.telefone = document.getElementById("telefone").value;

    quote.style.display = "none";
    loading.style.display = "block";

    try {

        await fetch("https://script.google.com/macros/s/AKfycbxMu3BP2bif1gnx7VYLf_uc3C9fxJRcKqlUo38ejHRrVYHRVfkP8spefwegJrEFUet9/exec", {

            method: "POST",
            mode: "no-cors",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(answers)

        });

    } catch (error) {

        console.log(error);

    }

    setTimeout(() => {

        loading.style.display = "none";
        success.style.display = "block";

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }, 2500);

});

/* ==========================
NOVA AVALIAÇÃO
========================== */

const newQuote = document.getElementById("newQuote");

if (newQuote) {

    newQuote.addEventListener("click", (e) => {

        e.preventDefault();

        location.reload();

    });

}

/* ==========================
INICIAR
========================== */

// Máscara do telefone
const telefone = document.getElementById("telefone");

if (telefone) {
    telefone.addEventListener("input", function () {
        let v = this.value.replace(/\D/g, "");

        if (v.length > 11) v = v.slice(0, 11);

        if (v.length > 6) {
            this.value = v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
        } else if (v.length > 2) {
            this.value = v.replace(/(\d{2})(\d+)/, "($1) $2");
        } else {
            this.value = v;
        }
    });

   // Validação do nome e telefone
const nome = document.getElementById("nome");
const botao = document.getElementById("finishButton");

function validarFormulario() {
    const nomeValido = nome.value.trim().length >= 3;
    const telefoneValido = telefone.value.replace(/\D/g, "").length === 11;

    botao.disabled = !(nomeValido && telefoneValido);
}

nome.addEventListener("input", validarFormulario);
telefone.addEventListener("input", validarFormulario);

validarFormulario();
}

showStep(0);
