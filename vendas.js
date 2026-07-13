const API_URL="https://script.google.com/macros/s/AKfycbxZ-9LT1naICjHDIT9ZZRGbmc4fmg3GOg7fDpr_Us2L7G7NfY2uBElYRkhDxg4Tp9nDEg/exec";

function parsePrice(text){
  const clean=(text||"").replace(/\s/g,"").replace("R$","").replace(/[^\d,.-]/g,"");
  if(!clean)return NaN;
  return clean.includes(",")?Number(clean.replace(/\./g,"").replace(",",".")):Number(clean);
}
function money(v){return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
function findPrice(card){
  for(const el of card.querySelectorAll(".preco,strong,b,.info p")){
    if((el.textContent||"").includes("R$"))return el;
  }
  return null;
}
function enhance(){
  document.querySelectorAll(".produto").forEach(card=>{
    if(card.dataset.done)return;
    card.dataset.done="1";
    const priceEl=findPrice(card);
    if(!priceEl)return;
    const pix=parsePrice(priceEl.textContent);
    if(!Number.isFinite(pix))return;
    const cardPrice=pix*1.12;
    const installment=cardPrice/12;
    (priceEl.closest("p")||priceEl).classList.add("preco-original");
    const box=document.createElement("div");
    box.className="pricing-box";
    box.innerHTML=`<span>Preço no cartão</span><div class="card-price">${money(cardPrice)}</div><div class="installment">ou 12x de ${money(installment)} sem juros</div><div class="pix-row"><span class="pix-badge">10% OFF</span><span class="pix-price">${money(pix)}</span><span>no PIX</span></div>`;
    const info=card.querySelector(".info")||card;
    const whatsapp=info.querySelector(".whatsapp");
    if(whatsapp){info.insertBefore(box,whatsapp);whatsapp.innerHTML='<i class="fa-brands fa-whatsapp"></i> Comprar pelo WhatsApp'}else info.appendChild(box);
  });
}
function filtrarProdutos(t){
  t=t.toLowerCase();
  document.querySelectorAll(".produto").forEach(p=>p.style.display=p.innerText.toLowerCase().includes(t)?"flex":"none");
}
function filtrarCategoria(cat,btn){
  document.querySelectorAll(".produto").forEach(p=>{
    const c=(p.getAttribute("data-categoria")||"").toLowerCase();
    p.style.display=(cat==="todos"||c===cat)?"flex":"none";
  });
  document.querySelectorAll("#filtros button").forEach(b=>b.classList.remove("ativo"));
  btn?.classList.add("ativo");
}
function gerarFiltros(){
  const set=new Set();
  document.querySelectorAll(".produto").forEach(p=>{const c=(p.getAttribute("data-categoria")||"").trim().toLowerCase();if(c)set.add(c)});
  const f=document.getElementById("filtros");f.innerHTML="";
  const all=document.createElement("button");all.textContent="Todos";all.className="ativo";all.onclick=()=>filtrarCategoria("todos",all);f.appendChild(all);
  set.forEach(c=>{const b=document.createElement("button");b.textContent=c.charAt(0).toUpperCase()+c.slice(1);b.onclick=()=>filtrarCategoria(c,b);f.appendChild(b)});
}
async function carregar(){
  const c=document.getElementById("produtos");
  try{
    const r=await fetch(API_URL,{cache:"no-store"});
    c.innerHTML=await r.text();
    gerarFiltros();enhance();
  }catch(e){
    c.innerHTML="<p>Não foi possível carregar os produtos.</p>";
  }
}
document.querySelectorAll(".faq button").forEach(b=>b.onclick=()=>b.closest("article").classList.toggle("active"));
carregar();