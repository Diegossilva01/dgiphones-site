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

/* ==========================
INICIAR
========================== */

const start = document.getElementById("start");

if (start) {

start.addEventListener("click", () => {

document.getElementById("quote").scrollIntoView({
behavior:"smooth"
});

});

}

/* ==========================
ATUALIZA PROGRESSO
========================== */

function updateProgress(){

const percent=((currentStep+1)/totalSteps)*100;

progressFill.style.width=percent+"%";

progressNumber.innerHTML=`${currentStep+1} / ${totalSteps}`;

}

/* ==========================
MOSTRAR ETAPA
========================== */

function showStep(index){

steps.forEach(step=>step.classList.remove("active"));

steps[index].classList.add("active");

currentStep=index;

updateProgress();

}

/* ==========================
BOTÕES DE OPÇÃO
========================== */

document.querySelectorAll(".option").forEach(button=>{

button.addEventListener("click",()=>{

const parent=button.parentElement;

parent.querySelectorAll(".option").forEach(btn=>{

btn.classList.remove("selected");

});

button.classList.add("selected");

const question=button.closest(".step").querySelector("h2").innerText;

answers[question]=button.innerText;

setTimeout(()=>{

if(currentStep<totalSteps-1){

showStep(currentStep+1);

window.scrollTo({

top:document.getElementById("quote").offsetTop-80,

behavior:"smooth"

});

}

},250);

});

});

/* ==========================
BUSCA MODELOS
========================== */

const search=document.getElementById("search");

if(search){

search.addEventListener("keyup",()=>{

const value=search.value.toLowerCase();

document.querySelectorAll("#quote .option").forEach(card=>{

if(card.innerText.toLowerCase().includes(value)){

card.style.display="flex";

}else{

card.style.display="none";

}

});

});

}

/* ==========================
BOTÃO VOLTAR
========================== */

const back=document.getElementById("backButton");

if(back){

back.addEventListener("click",()=>{

if(currentStep>0){

showStep(currentStep-1);

}

});

}

/* ==========================
ENVIO
========================== */

form.addEventListener("submit",async(e)=>{

e.preventDefault();

answers.nome=document.getElementById("nome").value;

answers.telefone=document.getElementById("telefone").value;

quote.style.display="none";

loading.style.display="block";

/* ==========
GOOGLE SHEETS
========== */

try{

await fetch("COLE_AQUI_URL_DO_APPS_SCRIPT",{

method:"POST",

mode:"no-cors",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify(answers)

});

}catch(error){

console.log(error);

}

setTimeout(()=>{

loading.style.display="none";

success.style.display="block";

window.scrollTo({

top:0,

behavior:"smooth"

});

},2500);

});

/* ==========================
NOVA AVALIAÇÃO
========================== */

const newQuote=document.getElementById("newQuote");

if(newQuote){

newQuote.addEventListener("click",(e)=>{

e.preventDefault();

location.reload();

});

}

/* ==========================
INICIAR
========================== */

updateProgress();

showStep(0);
