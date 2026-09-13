const API_URL="https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec";
const WHATSAPP="5511977030517";
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
let produtos=[];
function render(lista){
  const c=document.getElementById('produtos');
  if(!lista.length){c.innerHTML='<p class="sem-produtos">Nenhum aparelho disponível no momento.</p>';return}
  c.innerHTML=lista.map(p=>{
    const cartao=p.preco*1.14,parcela=cartao/12,reservado=p.status==='Reservado';
    const texto=encodeURIComponent(`Olá, tenho interesse no ${p.modelo} ${p.armazenamento} ${p.cor} por ${money(p.preco)} no PIX.`);
    const fotos=(Array.isArray(p.fotos)&&p.fotos.length?p.fotos:[p.foto]).filter(Boolean);
    const imagens=fotos.map((foto,i)=>`<img src="${esc(foto)}" alt="${esc(p.modelo)} - foto ${i+1}" loading="lazy" class="gallery-image ${i===0?'active':''}">`).join('');
    const controles=fotos.length>1?`<button class="gallery-arrow prev" type="button" aria-label="Foto anterior">‹</button><button class="gallery-arrow next" type="button" aria-label="Próxima foto">›</button><div class="gallery-dots">${fotos.map((_,i)=>`<button type="button" class="${i===0?'active':''}" data-index="${i}" aria-label="Ver foto ${i+1}"></button>`).join('')}</div>`:'';
    return `<article class="produto" data-categoria="${esc(String(p.categoria).toLowerCase())}"><div class="produto-imagem product-gallery" data-index="0">${imagens||'<div class="no-image">Sem foto</div>'}${controles}${reservado?'<span class="reserved-badge">RESERVADO</span>':''}</div><div class="info"><span class="product-condition">${esc(p.condicao)}</span><h3>${esc(p.modelo)}</h3><p>${esc([p.armazenamento,p.cor,p.bateria?`Bateria ${p.bateria}`:''].filter(Boolean).join(' • '))}</p><div class="pricing-box"><span>Preço no cartão</span><div class="card-price">${money(cartao)}</div><div class="installment">ou 12x de ${money(parcela)} sem juros</div><div class="pix-row"><span class="pix-badge">14% OFF</span><span class="pix-price">${money(p.preco)}</span><span>no PIX</span></div></div>${reservado?'<button class="whatsapp disabled" disabled>Produto reservado</button>':`<a class="whatsapp" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP}?text=${texto}"><i class="fa-brands fa-whatsapp"></i> Comprar pelo WhatsApp</a>`}</div></article>`
  }).join('');
  ativarGalerias();
}
function ativarGalerias(){
  document.querySelectorAll('.product-gallery').forEach(g=>{
    const imgs=[...g.querySelectorAll('.gallery-image')],dots=[...g.querySelectorAll('.gallery-dots button')];if(imgs.length<2)return;
    const mostrar=n=>{n=(n+imgs.length)%imgs.length;g.dataset.index=n;imgs.forEach((img,i)=>img.classList.toggle('active',i===n));dots.forEach((dot,i)=>dot.classList.toggle('active',i===n))};
    g.querySelector('.prev').onclick=e=>{e.preventDefault();e.stopPropagation();mostrar(Number(g.dataset.index)-1)};
    g.querySelector('.next').onclick=e=>{e.preventDefault();e.stopPropagation();mostrar(Number(g.dataset.index)+1)};
    dots.forEach(dot=>dot.onclick=e=>{e.preventDefault();e.stopPropagation();mostrar(Number(dot.dataset.index))});
  });
}
function filtrarProdutos(t){t=t.toLowerCase();render(produtos.filter(p=>[p.modelo,p.armazenamento,p.cor,p.categoria].join(' ').toLowerCase().includes(t)))}
function filtrarCategoria(cat,btn){render(cat==='todos'?produtos:produtos.filter(p=>String(p.categoria).toLowerCase()===cat));document.querySelectorAll('#filtros button').forEach(b=>b.classList.remove('ativo'));btn?.classList.add('ativo')}
function gerarFiltros(){const f=document.getElementById('filtros'),cats=[...new Set(produtos.map(p=>String(p.categoria||'iPhone').toLowerCase()))];f.innerHTML='<button class="ativo" data-cat="todos">Todos</button>'+cats.map(c=>`<button data-cat="${esc(c)}">${esc(c.charAt(0).toUpperCase()+c.slice(1))}</button>`).join('');f.querySelectorAll('button').forEach(b=>b.onclick=()=>filtrarCategoria(b.dataset.cat,b))}
async function carregar(){const c=document.getElementById('produtos');try{const r=await fetch(API_URL+'?acao=produtosSite&t='+Date.now(),{cache:'no-store'}),j=await r.json();if(!j.sucesso)throw new Error(j.mensagem||'Erro');produtos=j.produtos||[];gerarFiltros();render(produtos)}catch(e){c.innerHTML='<p>Não foi possível carregar os produtos.</p>'}}
document.querySelectorAll('.faq button').forEach(b=>b.onclick=()=>b.closest('article').classList.toggle('active'));carregar();
