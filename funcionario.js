const SISTEMA_API_URL = "https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec";

const state={token:localStorage.getItem("ct_token")||"",user:null,chart:null,estoque:[],historico:[],dados:null};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const isAdmin=()=>String(state.user?.perfil||"").toLowerCase()==="administrador";
const isRevendedor=()=>String(state.user?.perfil||"").toLowerCase()==="revendedor";
const podeEditar=r=>isAdmin()||String(r?.['ID Funcionário']||'')===String(state.user?.id||'');

async function api(acao,dados={}){
  const r=await fetch(SISTEMA_API_URL+"?t="+Date.now(),{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({acao,token:state.token,...dados})});
  const j=await r.json();
  if(!j.sucesso) throw new Error(j.mensagem||"Não foi possível concluir.");
  return j;
}

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function dataBR(v){if(!v)return "";const d=String(v).slice(0,10).split("-");return d.length===3?`${d[2]}/${d[1]}/${d[0]}`:String(v)}
function receiptShell(title,number,body,terms){return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#151515;margin:0;background:#eee}.sheet{width:190mm;min-height:270mm;margin:10px auto;background:#fff;padding:15mm;border-top:8px solid #f5ce00}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:14px}.brand{font-size:25px;font-weight:900}.brand span{color:#d8b400}.doc{text-align:right}.doc h1{font-size:21px;margin:0 0 6px}.doc small{color:#555}.intro{font-size:14px;line-height:1.55;margin:18px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #bbb}.item{padding:10px;border-bottom:1px solid #ddd}.item:nth-child(odd){border-right:1px solid #ddd}.item.full{grid-column:1/-1;border-right:0}.label{display:block;font-size:10px;text-transform:uppercase;color:#666;font-weight:bold;margin-bottom:4px}.value{font-size:14px;font-weight:600;word-break:break-word}.amount{font-size:22px;font-weight:900}.terms{margin-top:20px;border:1px solid #bbb;padding:14px}.terms h2{font-size:14px;margin:0 0 9px}.terms p,.terms li{font-size:11px;line-height:1.5}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin-top:55px}.sign{text-align:center;border-top:1px solid #111;padding-top:7px;font-size:11px}.footer{text-align:center;margin-top:28px;font-size:10px;color:#666}.actions{position:fixed;right:18px;top:18px}.actions button{background:#111;color:#ffd600;border:0;padding:12px 18px;border-radius:8px;font-weight:bold;cursor:pointer}@media print{body{background:#fff}.sheet{margin:0;width:auto;min-height:auto;padding:0;border-top:8px solid #f5ce00}.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">Imprimir recibo</button></div><main class="sheet"><div class="head"><div class="brand">CellTech <span>Panamby</span></div><div class="doc"><h1>${esc(title)}</h1><small>Nº ${esc(number)}</small></div></div>${body}<section class="terms">${terms}</section><div class="signatures"><div class="sign">CellTech Panamby / Responsável</div><div class="sign">Cliente / Declarante</div></div><div class="footer">Documento emitido eletronicamente pelo sistema interno da CellTech Panamby.</div></main></body></html>`}
function openReceipt(win,html){const w=win&&!win.closed?win:window.open("","_blank");if(!w){toast("O navegador bloqueou o recibo. Libere os pop-ups e tente novamente.");return}w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),500)}
function vendaReceipt(d,aparelho,id){const garantia=Math.max(0,Number(d.garantiaDias||0));const body=`<p class="intro">Recebemos de <strong>${esc(d.nome)}</strong>, CPF <strong>${esc(d.cpf)}</strong>, o valor abaixo referente à compra do aparelho descrito neste documento.</p><div class="grid"><div class="item"><span class="label">Data da venda</span><span class="value">${esc(dataBR(d.dataVenda))}</span></div><div class="item"><span class="label">Forma de pagamento</span><span class="value">${esc(d.formaPagamento)}</span></div><div class="item"><span class="label">Cliente</span><span class="value">${esc(d.nome)}</span></div><div class="item"><span class="label">CPF</span><span class="value">${esc(d.cpf)}</span></div><div class="item"><span class="label">Telefone</span><span class="value">${esc(d.telefone||"Não informado")}</span></div><div class="item"><span class="label">Funcionário</span><span class="value">${esc(d.funcionarioResponsavel||state.user?.nome||"")}</span></div><div class="item"><span class="label">Aparelho</span><span class="value">${esc(`${aparelho?.['Modelo']||''} ${aparelho?.['Armazenamento']||''} ${aparelho?.['Cor']||''}`.trim())}</span></div><div class="item"><span class="label">IMEI 1</span><span class="value">${esc(aparelho?.['IMEI']||"")}</span></div><div class="item"><span class="label">IMEI 2</span><span class="value">${esc(aparelho?.['IMEI 2']||"Não informado")}</span></div><div class="item full"><span class="label">Valor total</span><span class="value amount">${esc(money(d.valorVenda))}</span></div><div class="item full"><span class="label">Observações</span><span class="value">${esc(d.observacoes||"Sem observações")}</span></div></div>`;const terms=`<h2>GARANTIA E CONDIÇÕES</h2><p>Garantia informada pela loja: <strong>${garantia} dias</strong>, contados da data da venda, sem prejuízo dos direitos previstos na legislação aplicável.</p><ul><li>Para atendimento, apresente este recibo e o aparelho com o IMEI indicado.</li><li>A garantia cobre defeitos de funcionamento constatados após avaliação técnica.</li><li>Danos decorrentes de queda, impacto, contato com líquido, oxidação, violação, reparo por terceiros, uso inadequado ou acessórios externos serão avaliados e podem não ser cobertos quando não tiverem relação com defeito do produto.</li><li>Senhas, contas e cópias de segurança são responsabilidade do cliente. A loja não se responsabiliza por perda de dados.</li></ul>`;return receiptShell("RECIBO DE VENDA",id,body,terms)}
function compraReceipt(d,id){const body=`<p class="intro">Eu, <strong>${esc(d.nome)}</strong>, CPF <strong>${esc(d.cpf)}</strong>, declaro que vendi e entreguei à CellTech Panamby o aparelho descrito abaixo, recebendo o valor indicado.</p><div class="grid"><div class="item"><span class="label">Data da compra</span><span class="value">${esc(dataBR(d.dataCompra))}</span></div><div class="item"><span class="label">Forma de pagamento</span><span class="value">${esc(d.formaPagamento||"Não informado")}</span></div><div class="item"><span class="label">Vendedor do aparelho</span><span class="value">${esc(d.nome)}</span></div><div class="item"><span class="label">CPF</span><span class="value">${esc(d.cpf)}</span></div><div class="item"><span class="label">Telefone</span><span class="value">${esc(d.telefone||"Não informado")}</span></div><div class="item"><span class="label">Funcionário responsável</span><span class="value">${esc(d.funcionarioResponsavel||state.user?.nome||"")}</span></div><div class="item"><span class="label">Aparelho</span><span class="value">${esc(`${d.modelo||''} ${d.armazenamento||''} ${d.cor||''}`.trim())}</span></div><div class="item"><span class="label">IMEI 1</span><span class="value">${esc(d.imei)}</span></div><div class="item"><span class="label">IMEI 2</span><span class="value">${esc(d.imei2||"Não informado")}</span></div><div class="item full"><span class="label">Valor recebido</span><span class="value amount">${esc(money(d.valorCompra))}</span></div><div class="item full"><span class="label">Observações</span><span class="value">${esc(d.observacoes||"Sem observações")}</span></div></div>`;const terms=`<h2>DECLARAÇÃO DE PROPRIEDADE E ENTREGA</h2><p>O declarante confirma ser legítimo proprietário e responsável pela procedência do aparelho, autorizando sua compra e posterior revenda.</p><ul><li>Declara que o aparelho não é produto de furto, roubo, fraude, apropriação indevida ou outra origem ilícita.</li><li>Declara que informou corretamente o IMEI, o estado do aparelho e eventuais defeitos.</li><li>Compromete-se a remover contas, senhas, bloqueios de ativação e vínculos com operadoras ou instituições financeiras.</li><li>Confirma o recebimento integral do valor indicado, dando quitação desta compra, ressalvadas informações falsas ou vícios de procedência.</li></ul>`;return receiptShell("RECIBO DE COMPRA",id,body,terms)}

function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function validCPF(cpf){cpf=String(cpf).replace(/\D/g,"");if(cpf.length!==11||/^(\d)\1+$/.test(cpf))return false;let s=0;for(let i=0;i<9;i++)s+=+cpf[i]*(10-i);let d=11-(s%11);if(d>=10)d=0;if(d!==+cpf[9])return false;s=0;for(let i=0;i<10;i++)s+=+cpf[i]*(11-i);d=11-(s%11);if(d>=10)d=0;return d===+cpf[10]}
function parseMoney(v){return Number(String(v).replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",","."))||0}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function setMsg(form,msg,ok=false){const e=form.querySelector(".form-message");e.textContent=msg;e.classList.toggle("success",ok)}
function showApp(){
  $("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");$("#usuarioLogado").textContent=`${state.user.nome} • ${state.user.perfil}`;
  $$('.admin-only').forEach(e=>e.style.display=isAdmin()?'':'none');
  if(isRevendedor()){
    $$('.nav-btn').forEach(e=>e.style.display='none');$$('.page').forEach(e=>e.classList.remove('active'));
    $$('.reseller-only').forEach(e=>e.style.display='');
    const botao=$('.nav-btn[data-page="revendedor"]');if(botao){botao.style.display='';botao.classList.add('active')}
    $('#page-revendedor').classList.add('active');$('#tituloPagina').textContent='Catálogo de revenda';loadCatalogoRevendedor();
  }else{loadDashboard();loadEstoque();if(isAdmin())loadFuncionarios()}
}
async function logout(){try{await api("logout")}catch(e){}localStorage.removeItem("ct_token");location.reload()}

$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("#loginMsg");m.textContent="Entrando...";try{const j=await api("login",{usuario:$("#loginUsuario").value,senha:$("#loginSenha").value});state.token=j.token;state.user=j.funcionario;localStorage.setItem("ct_token",state.token);showApp()}catch(err){m.textContent=err.message}});
$("#logoutBtn").onclick=logout;$("#menuBtn").onclick=()=>$(".sidebar").classList.toggle("open");
$$('.nav-btn').forEach(btn=>btn.onclick=()=>{if(btn.style.display==='none')return;$$('.nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$$('.page').forEach(p=>p.classList.remove('active'));$(`#page-${btn.dataset.page}`).classList.add('active');$("#tituloPagina").textContent=btn.textContent.trim();$(".sidebar").classList.remove("open");if(btn.dataset.page==='historico')loadHistorico();if(btn.dataset.page==='dashboard')loadDashboard();if(btn.dataset.page==='venda')loadEstoque();if(btn.dataset.page==='comissao')loadComissao();if(btn.dataset.page==='site')loadSiteProdutos();if(btn.dataset.page==='revendedor')loadCatalogoRevendedor();if(btn.dataset.page==='usuarios')loadFuncionarios()});

$$('.cpf').forEach(i=>i.addEventListener('input',()=>{let v=i.value.replace(/\D/g,'').slice(0,11);i.value=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')}));
$$('.money').forEach(i=>i.addEventListener('blur',()=>{const v=parseMoney(i.value);if(v)i.value=money(v)}));
$$('input[type=date]').forEach(i=>{if(!i.value)i.value=today()});


$("#compraForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f),printar=f.querySelector('[name=gerarRecibo]').checked,win=printar?window.open("","_blank"):null;if(win)win.document.write("<p style=font-family:Arial;padding:30px>Gerando recibo...</p>");if(!validCPF(d.cpf)){if(win)win.close();return setMsg(f,"CPF inválido.")}if(String(d.imei).replace(/\D/g,'').length!==15){if(win)win.close();return setMsg(f,"O IMEI 1 deve ter 15 números.")}if(d.imei2&&String(d.imei2).replace(/\D/g,'').length!==15){if(win)win.close();return setMsg(f,"O IMEI 2 deve ter 15 números.")}d.valorCompra=parseMoney(d.valorCompra);d.precoSite=parseMoney(d.precoSite);d.precoRevenda=parseMoney(d.precoRevenda);if(d.valorCompra<=0||d.precoSite<=0||d.precoRevenda<=0){if(win)win.close();return setMsg(f,"Informe valores válidos.")}const fotos=[...f.querySelector('[name=fotosProduto]').files];if(!fotos.length){if(win)win.close();return setMsg(f,"Selecione pelo menos uma foto do produto.")}if(fotos.length>6){if(win)win.close();return setMsg(f,"Selecione no máximo 6 fotos.")}setMsg(f,`Preparando ${fotos.length} foto(s)...`);const imagens=[];for(const foto of fotos)imagens.push(await prepararImagem(foto));d.fotosData=imagens.map(x=>x.data);d.fotosNomes=imagens.map(x=>x.nome);delete d.fotosProduto;delete d.gerarRecibo;setMsg(f,`Salvando produto e ${fotos.length} foto(s)...`);try{const j=await api("cadastrarCompra",d);if(printar)openReceipt(win,compraReceipt(d,j.idCompra));f.reset();f.querySelector('[name=dataCompra]').value=today();f.querySelector('[name=gerarRecibo]').checked=true;setMsg(f,"Compra salva, fotos enviadas e produto integrado ao site.",true);toast("Compra cadastrada");state.dados=null;loadEstoque();loadDashboard();loadSiteProdutos()}catch(err){if(win)win.close();setMsg(f,err.message)}});

$("#vendaForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f),printar=f.querySelector('[name=gerarRecibo]').checked,win=printar?window.open("","_blank"):null;if(win)win.document.write("<p style=font-family:Arial;padding:30px>Gerando recibo...</p>");if(!validCPF(d.cpf)){if(win)win.close();return setMsg(f,"CPF inválido.")}d.valorVenda=parseMoney(d.valorVenda);if(d.valorVenda<=0){if(win)win.close();return setMsg(f,"Informe um valor válido.")}const aparelho=state.estoque.find(x=>String(x['ID Estoque'])===String(d.idEstoque));delete d.gerarRecibo;setMsg(f,"Salvando...");try{const j=await api("cadastrarVenda",d);if(printar)openReceipt(win,vendaReceipt(d,aparelho,j.idVenda));f.reset();f.querySelector('[name=dataVenda]').value=today();f.querySelector('[name=garantiaDias]').value=90;f.querySelector('[name=gerarRecibo]').checked=true;setMsg(f,"Venda salva e recibo gerado.",true);toast("Venda cadastrada");state.dados=null;loadEstoque();loadDashboard()}catch(err){if(win)win.close();setMsg(f,err.message)}});

$("#usuarioForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;setMsg(f,"Salvando...");try{await api("cadastrarFuncionario",formData(f));f.reset();setMsg(f,"Funcionário cadastrado.",true);loadFuncionarios()}catch(err){setMsg(f,err.message)}});

async function carregarDadosSistema(forcar=false){
  if(state.dados&&!forcar)return state.dados;
  const j=await api("dadosSistema");
  state.dados=j;
  return j;
}
function chaveDia(v){
  const s=String(v||"").trim();
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}
function numeroPlanilha(v){
  if(typeof v==="number")return v;
  let s=String(v??"").replace(/R\$/g,"").replace(/\s/g,"");
  if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",", ".");
  else if(s.includes(","))s=s.replace(",", ".");
  return Number(s)||0;
}
async function loadDashboard(){
  try{
    const j=await api('dashboard'), k=j.resumo||{}, grafico=j.grafico||[];
    $("#kpiFaturamentoHoje").textContent=money(numeroPlanilha(k.faturamentoHoje));
    $("#kpiFaturamentoMes").textContent=money(numeroPlanilha(k.faturamentoMes));
    $("#kpiVendasMes").textContent=Number(k.quantidadeVendasMes||0);
    $("#kpiTicket").textContent=money(numeroPlanilha(k.ticketMedioMes));
    $("#kpiLucroMes").textContent=money(numeroPlanilha(k.lucroMes));
    $("#kpiEstoque").textContent=Number(k.aparelhosDisponiveis||0);
    try{
      const produtosResp=await api('listarProdutosSite'), produtos=produtosResp.produtos||[];
      const disponiveis=produtos.filter(x=>String(x['Status']||'Disponível').toLowerCase()!=='vendido');
      const custoTotal=disponiveis.reduce((s,x)=>s+numeroPlanilha(x['Valor de custo']??x['Valor da compra']??x['Custo']??x['Preço de custo']),0);
      const vendaTotal=disponiveis.reduce((s,x)=>s+numeroPlanilha(x['Preço site']),0);
      const lucroPotencial=vendaTotal-custoTotal;
      const margemMedia=vendaTotal>0?(lucroPotencial/vendaTotal)*100:0;
      $("#kpiCustoEstoque").textContent=money(custoTotal);
      $("#kpiVendaEstoque").textContent=money(vendaTotal);
      $("#kpiLucroPotencial").textContent=money(lucroPotencial);
      $("#kpiMargemMedia").textContent=margemMedia.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
    }catch(_){
      $("#kpiCustoEstoque").textContent='R$ 0,00';
      $("#kpiVendaEstoque").textContent='R$ 0,00';
      $("#kpiLucroPotencial").textContent='R$ 0,00';
      $("#kpiMargemMedia").textContent='0%';
    }
    const canvas=$("#salesChart");
    if(window.Chart&&canvas){
      if(state.chart)state.chart.destroy();
      state.chart=new Chart(canvas,{type:'bar',data:{labels:grafico.map(x=>x.data),datasets:[{label:'Faturamento',data:grafico.map(x=>numeroPlanilha(x.faturamento))}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
    }
  }catch(e){toast('Dashboard: '+e.message)}
}
async function loadEstoque(){try{const j=await carregarDadosSistema(true);state.estoque=(j.estoque||[]).filter(x=>String(x['Status']||'').trim().toLowerCase()==='disponível');const s=$("#estoqueSelect");s.innerHTML='<option value="">Selecione o aparelho</option>'+state.estoque.map(x=>`<option value="${esc(x['ID Estoque'])}">${esc(`${x['Modelo']||''} ${x['Armazenamento']||''} ${x['Cor']||''} • IMEI ${x['IMEI']||''}`)}</option>`).join('')}catch(e){toast(e.message)}}
async function loadHistorico(){
  const body=$("#histBody"),head=$("#histHead"),tipo=$("#histTipo").value;
  body.innerHTML='<tr><td>Carregando...</td></tr>';$("#histMsg").textContent='';
  try{
    const j=await carregarDadosSistema(true);
    let regs=(tipo==='vendas'?j.vendas:j.compras)||[];
    const ini=$("#histInicio").value,fim=$("#histFim").value,q=$("#histBusca").value.trim().toLowerCase();
    const campo=tipo==='vendas'?'Data da venda':'Data da compra';
    regs=regs.filter(r=>{const k=chaveDia(r[campo]);if(ini&&k<ini)return false;if(fim&&k>fim)return false;if(q&&!Object.values(r).some(v=>String(v??'').toLowerCase().includes(q)))return false;return true}).reverse();
    state.historico=regs;
    if(tipo==='vendas'){
      head.innerHTML='<tr><th>Editar</th><th>Data</th><th>Cliente</th><th>CPF</th><th>Produto</th><th>IMEI 1</th><th>IMEI 2</th><th>Pagamento</th><th>Valor</th><th>Funcionário</th><th>Ações</th></tr>';
      body.innerHTML=regs.map(r=>`<tr><td>${podeEditar(r)?`<button class="edit-btn edit-main" onclick="editarRegistro('venda','${esc(r['ID Venda'])}')"><i class="fa-solid fa-pen"></i> Editar</button>`:'—'}</td><td>${esc(r['Data da venda'])}</td><td>${esc(r['Nome do cliente'])}</td><td>${esc(r['CPF'])}</td><td>${esc(`${r['Modelo']||''} ${r['Armazenamento']||''}`)}</td><td>${esc(r['IMEI'])}</td><td>${esc(r['IMEI 2']||'')}</td><td>${esc(r['Forma de pagamento'])}</td><td>${money(numeroPlanilha(r['Valor da venda']))}</td><td>${esc(r['Funcionário responsável'])}</td><td><button class="print-btn" onclick="imprimirHistorico('venda','${esc(r['ID Venda'])}')"><i class="fa-solid fa-print"></i></button>${isAdmin()?`<button class="delete-btn" onclick="excluirRegistro('venda','${esc(r['ID Venda'])}')"><i class="fa-solid fa-trash"></i></button>`:''}</td></tr>`).join('');
    }else{
      head.innerHTML='<tr><th>Editar</th><th>Data</th><th>Vendedor</th><th>CPF</th><th>Modelo</th><th>IMEI 1</th><th>IMEI 2</th><th>Valor pago</th><th>Funcionário</th><th>Ações</th></tr>';
      body.innerHTML=regs.map(r=>`<tr><td>${podeEditar(r)?`<button class="edit-btn edit-main" onclick="editarRegistro('compra','${esc(r['ID Compra'])}')"><i class="fa-solid fa-pen"></i> Editar</button>`:'—'}</td><td>${esc(r['Data da compra'])}</td><td>${esc(r['Nome do vendedor'])}</td><td>${esc(r['CPF'])}</td><td>${esc(`${r['Modelo']||''} ${r['Armazenamento']||''}`)}</td><td>${esc(r['IMEI'])}</td><td>${esc(r['IMEI 2']||'')}</td><td>${money(numeroPlanilha(r['Valor da compra']))}</td><td>${esc(r['Funcionário responsável'])}</td><td><button class="print-btn" onclick="imprimirHistorico('compra','${esc(r['ID Compra'])}')"><i class="fa-solid fa-print"></i></button>${isAdmin()?`<button class="delete-btn" onclick="excluirRegistro('compra','${esc(r['ID Compra'])}')"><i class="fa-solid fa-trash"></i></button>`:''}</td></tr>`).join('');
    }
    if(!regs.length)body.innerHTML='<tr><td colspan="10">Nenhum registro encontrado.</td></tr>';
  }catch(e){body.innerHTML='';$("#histMsg").textContent=e.message}
}


function mesAtual(){return today().slice(0,7)}

async function loadComissao(){
  const mesEl=$("#comissaoMes"), body=$("#comissaoBody"), msg=$("#comissaoMsg");
  if(!mesEl.value)mesEl.value=mesAtual();
  const mes=mesEl.value;
  body.innerHTML='<tr><td colspan="4">Calculando...</td></tr>';
  msg.textContent='';
  try{
    const j=await carregarDadosSistema(true);
    let vendas=(j.vendas||[]).filter(r=>chaveDia(r['Data da venda']).slice(0,7)===mes);
    if(!isAdmin())vendas=vendas.filter(r=>String(r['ID Funcionário']||'')===String(state.user?.id||''));
    const faturamento=vendas.reduce((total,r)=>total+numeroPlanilha(r['Valor da venda']),0);
    const comissao=faturamento*0.03;

    $("#comissaoFaturamento").textContent=money(faturamento);
    $("#comissaoValor").textContent=money(comissao);
    $("#comissaoVendas").textContent=vendas.length;

    const porFuncionario={};
    vendas.forEach(r=>{
      const nome=String(r['Funcionário responsável']||'Não informado').trim()||'Não informado';
      if(!porFuncionario[nome])porFuncionario[nome]={quantidade:0,faturamento:0};
      porFuncionario[nome].quantidade++;
      porFuncionario[nome].faturamento+=numeroPlanilha(r['Valor da venda']);
    });

    const linhas=Object.entries(porFuncionario).sort((a,b)=>b[1].faturamento-a[1].faturamento);
    body.innerHTML=linhas.length?linhas.map(([nome,dados])=>`<tr><td>${esc(nome)}</td><td>${dados.quantidade}</td><td>${money(dados.faturamento)}</td><td><strong>${money(dados.faturamento*0.03)}</strong></td></tr>`).join(''):'<tr><td colspan="4">Nenhuma venda encontrada neste mês.</td></tr>';
  }catch(e){
    body.innerHTML='<tr><td colspan="4">Não foi possível calcular.</td></tr>';
    msg.textContent=e.message;
  }
}

$("#buscarComissao").onclick=loadComissao;
$("#comissaoMes").onchange=loadComissao;


function valorInput(v){return numeroPlanilha(v).toFixed(2).replace('.',',')}
function fotosDoRegistroEstoque(est){
  if(!est)return [];
  try{const a=JSON.parse(est['Fotos URLs']||'[]');if(Array.isArray(a)&&a.length)return a.filter(Boolean)}catch(e){}
  return est['Foto URL']?[est['Foto URL']]:[];
}
function abrirEditor(tipo,r){
  const venda=tipo==='venda';
  const est=!venda?(state.dados?.estoque||[]).find(x=>String(x['ID Compra'])===String(r['ID Compra'])):null;
  const fotosAtuais=fotosDoRegistroEstoque(est);
  const modal=document.createElement('div');modal.className='edit-modal';
  modal.innerHTML=`<div class="edit-card"><div class="edit-head"><h2>Editar ${venda?'venda':'compra e produto'}</h2><button type="button" class="edit-close">×</button></div><form id="editRegistroForm" class="grid-form">
    <label>Nome<input name="nome" required value="${esc(r[venda?'Nome do cliente':'Nome do vendedor'])}"></label>
    <label>CPF<input name="cpf" required value="${esc(r['CPF'])}"></label>
    <label>Telefone<input name="telefone" value="${esc(r['Telefone']||'')}"></label>
    <label>Data<input type="date" name="${venda?'dataVenda':'dataCompra'}" required value="${chaveDia(r[venda?'Data da venda':'Data da compra'])}"></label>
    ${venda?'':`<label>Modelo<input name="modelo" required value="${esc(r['Modelo']||'')}"></label><label>Armazenamento<input name="armazenamento" value="${esc(r['Armazenamento']||'')}"></label><label>Cor<input name="cor" value="${esc(r['Cor']||'')}"></label><label>IMEI 1<input name="imei" required maxlength="15" value="${esc(r['IMEI']||'')}"></label><label>IMEI 2<input name="imei2" maxlength="15" value="${esc(r['IMEI 2']||'')}"></label>`}
    <label>Valor<input name="${venda?'valorVenda':'valorCompra'}" required value="${valorInput(r[venda?'Valor da venda':'Valor da compra'])}"></label>
    <label>Forma de pagamento<select name="formaPagamento"><option value="">Selecione</option>${['PIX','Dinheiro','Transferência','Cartão','Outro'].map(x=>`<option ${String(r['Forma de pagamento']||'')===x?'selected':''}>${x}</option>`).join('')}</select></label>
    ${venda?'':`<label>Preço no PIX<input name="precoSite" required value="${valorInput(est?.['Preço site']||0)}"></label><label>Preço para revendedor<input name="precoRevenda" required value="${valorInput(est?.['Preço revenda']||0)}"></label><label>Categoria<select name="categoriaSite">${['iPhone','iPad','MacBook','Apple Watch','Acessório'].map(x=>`<option value="${x}" ${String(est?.['Categoria site']||'iPhone')===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Condição<input name="condicaoSite" value="${esc(est?.['Condição site']||'Seminovo')}"></label><label>Saúde da bateria<input name="bateriaSite" value="${esc(est?.['Bateria site']||'')}"></label><label>Publicação<select name="statusSite">${['Publicado','Oculto','Reservado'].map(x=>`<option ${String(est?.['Status site']||'Oculto')===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="full">Substituir fotos<input name="fotosProduto" type="file" accept="image/*" multiple><small class="field-help">Opcional. Se selecionar novas fotos, elas substituirão as atuais. Máximo de 6.</small></label><div class="full edit-photo-list">${fotosAtuais.map((f,i)=>`<img src="${esc(f)}" alt="Foto ${i+1}">`).join('')||'<small>Nenhuma foto cadastrada.</small>'}</div>`}
    <label class="full">Observações<textarea name="observacoes" rows="3">${esc(r['Observações']||'')}</textarea></label>
    <div class="full actions"><button class="primary" type="submit">Salvar alterações</button><span class="message form-message"></span></div>
  </form></div>`;
  document.body.appendChild(modal);modal.querySelector('.edit-close').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove()};
  modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f);d[venda?'valorVenda':'valorCompra']=parseMoney(d[venda?'valorVenda':'valorCompra']);d[venda?'idVenda':'idCompra']=r[venda?'ID Venda':'ID Compra'];
    if(!venda){d.precoSite=parseMoney(d.precoSite);d.precoRevenda=parseMoney(d.precoRevenda);const fotos=[...f.querySelector('[name=fotosProduto]').files];if(fotos.length>6)return setMsg(f,'Selecione no máximo 6 fotos.');if(fotos.length){setMsg(f,`Preparando ${fotos.length} foto(s)...`);const imgs=[];for(const foto of fotos)imgs.push(await prepararImagem(foto));d.fotosData=imgs.map(x=>x.data);d.fotosNomes=imgs.map(x=>x.nome)}delete d.fotosProduto}
    setMsg(f,'Salvando...');try{await api(venda?'editarVenda':'editarCompra',d);modal.remove();toast('Registro alterado');state.dados=null;await carregarDadosSistema(true);loadHistorico();loadEstoque();loadDashboard();loadComissao();loadSiteProdutos()}catch(err){setMsg(f,err.message)}};
}
window.editarRegistro=(tipo,id)=>{const campo=tipo==='venda'?'ID Venda':'ID Compra';const r=state.historico.find(x=>String(x[campo])===String(id));if(!r)return toast('Registro não encontrado.');abrirEditor(tipo,r)};

window.imprimirHistorico=(tipo,id)=>{
  const campo=tipo==='venda'?'ID Venda':'ID Compra';
  const r=state.historico.find(x=>String(x[campo])===String(id));
  if(!r)return toast('Registro não encontrado.');
  const win=window.open('','_blank');
  if(!win)return toast('O navegador bloqueou o recibo. Libere os pop-ups e tente novamente.');
  win.document.write('<p style=\"font-family:Arial;padding:30px\">Gerando recibo...</p>');
  try{
    if(tipo==='venda'){
      const d={
        dataVenda:r['Data da venda'],
        nome:r['Nome do cliente'],
        cpf:r['CPF'],
        telefone:r['Telefone']||'',
        formaPagamento:r['Forma de pagamento']||'',
        valorVenda:numeroPlanilha(r['Valor da venda']),
        garantiaDias:r['Garantia (dias)']||r['Garantia']||90,
        observacoes:r['Observações']||'',
        funcionarioResponsavel:r['Funcionário responsável']||''
      };
      const aparelho={
        'Modelo':r['Modelo']||'',
        'Armazenamento':r['Armazenamento']||'',
        'Cor':r['Cor']||'',
        'IMEI':r['IMEI']||'',
        'IMEI 2':r['IMEI 2']||''
      };
      openReceipt(win,vendaReceipt(d,aparelho,r['ID Venda']));
    }else{
      const d={
        dataCompra:r['Data da compra'],
        nome:r['Nome do vendedor'],
        cpf:r['CPF'],
        telefone:r['Telefone']||'',
        modelo:r['Modelo']||'',
        armazenamento:r['Armazenamento']||'',
        cor:r['Cor']||'',
        imei:r['IMEI']||'',
        imei2:r['IMEI 2']||'',
        formaPagamento:r['Forma de pagamento']||'',
        valorCompra:numeroPlanilha(r['Valor da compra']),
        observacoes:r['Observações']||'',
        funcionarioResponsavel:r['Funcionário responsável']||''
      };
      openReceipt(win,compraReceipt(d,r['ID Compra']));
    }
  }catch(e){win.close();toast('Não foi possível emitir o recibo: '+e.message)}
};

window.excluirRegistro=async(tipo,id)=>{const motivo=prompt('Informe o motivo da exclusão:');if(!motivo)return;try{await api(tipo==='venda'?'excluirVenda':'excluirCompra',tipo==='venda'?{idVenda:id,motivo}:{idCompra:id,motivo});toast('Registro excluído');state.dados=null;loadHistorico();loadEstoque();loadDashboard()}catch(e){toast(e.message)}};
$("#buscarHistorico").onclick=loadHistorico;$("#histTipo").onchange=loadHistorico;

(async()=>{if(!state.token)return;try{const j=await api('verificarToken');state.user=j.funcionario;showApp()}catch(e){localStorage.removeItem('ct_token')}})();


async function prepararImagem(file){
  const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Não foi possível ler a foto.'));r.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Foto inválida.'));i.src=dataUrl});
  const max=1200,escala=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*escala);canvas.height=Math.round(img.height*escala);
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  return {data:canvas.toDataURL('image/jpeg',0.78),nome:(file.name||'produto').replace(/\.[^.]+$/,'')+'.jpg'};
}

async function loadSiteProdutos(){
  const body=$("#siteProdutosBody"),msg=$("#siteProdutosMsg");if(!body)return;body.innerHTML='<tr><td colspan="8">Carregando...</td></tr>';msg.textContent='';
  try{
    const j=await api('listarProdutosSite'),itens=j.produtos||[];state.siteProdutos=itens;
    body.innerHTML=itens.length?itens.map((x,index)=>{
      const preco=numeroPlanilha(x['Preço site']);
      const precoRevenda=numeroPlanilha(x['Preço revenda']);
      const custo=numeroPlanilha(x['Valor de custo']??x['Valor da compra']??x['Custo']??x['Preço de custo']);
      const lucro=preco-custo;
      const margem=preco>0?(lucro/preco)*100:0;
      const lucroClass=lucro<0?'negative':'';
      return `<tr><td>${x['Foto URL']?`<div class="thumb-stack"><img class="product-thumb" src="${esc(x['Foto URL'])}" alt=""><small>${fotosDoRegistroEstoque(x).length||1} foto(s)</small></div>`:'Sem foto'}</td><td><strong>${esc(x.Modelo||'')}</strong><br><small>${esc([x.Armazenamento,x.Cor,x.IMEI].filter(Boolean).join(' • '))}</small></td><td class="cell-price">${money(preco)}</td><td class="cell-resale">${precoRevenda>0?money(precoRevenda):'<span class="muted-price">Não informado</span>'}</td><td class="cell-cost">${money(custo)}</td><td class="cell-profit ${lucroClass}">${money(lucro)}</td><td class="cell-margin ${lucroClass}">${margem.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%</td><td><span class="status-pill">${esc(x['Status site']||'Oculto')}</span></td><td><div class="site-actions"><button class="edit-main" onclick="editarProdutoSite('${esc(x['ID Estoque'])}')"><i class="fa-solid fa-pen"></i><span>Editar</span></button><button class="publish" title="Publicar" onclick="alterarProdutoSite('${esc(x['ID Estoque'])}','Publicado')"><i class="fa-solid fa-eye"></i><span>Publicar</span></button><button class="hide" title="Ocultar" onclick="alterarProdutoSite('${esc(x['ID Estoque'])}','Oculto')"><i class="fa-solid fa-eye-slash"></i><span>Ocultar</span></button><button class="reserve" title="Reservar" onclick="alterarProdutoSite('${esc(x['ID Estoque'])}','Reservado')"><i class="fa-solid fa-bookmark"></i><span>Reservar</span></button></div></td></tr>`
    }).join(''):'<tr><td colspan="8">Nenhum produto cadastrado.</td></tr>'
  }catch(e){body.innerHTML='<tr><td colspan="8">Erro ao carregar.</td></tr>';msg.textContent=e.message}
}
window.editarProdutoSite=id=>{const x=(state.siteProdutos||[]).find(p=>String(p['ID Estoque'])===String(id));if(!x)return toast('Produto não encontrado.');const modal=document.createElement('div');modal.className='edit-modal';const fotos=fotosDoRegistroEstoque(x);modal.innerHTML=`<div class="edit-card"><div class="edit-head"><h2>Editar produto do site</h2><button type="button" class="edit-close">×</button></div><form class="grid-form"><label>Valor pago no aparelho<input name="valorCusto" required value="${valorInput(x['Valor de custo']??x['Valor da compra']??0)}"></label><label>Preço no PIX<input name="precoSite" required value="${valorInput(x['Preço site'])}"></label><label>Preço para revendedor<input name="precoRevenda" required value="${valorInput(x['Preço revenda']||0)}"></label><label>Categoria<input name="categoriaSite" value="${esc(x['Categoria site']||'iPhone')}"></label><label>Condição<input name="condicaoSite" value="${esc(x['Condição site']||'Seminovo')}"></label><label>Saúde da bateria<input name="bateriaSite" value="${esc(x['Bateria site']||'')}"></label><label>Publicação<select name="statusSite">${['Publicado','Oculto','Reservado'].map(s=>`<option ${String(x['Status site'])===s?'selected':''}>${s}</option>`).join('')}</select></label><label class="full">Comentário exclusivo para revendedores<textarea name="comentarioRevendedor" rows="3" maxlength="600" placeholder="Informe troca de peça ou detalhe importante">${esc(x['Comentário revendedor']||'')}</textarea><small class="field-help">Visível somente no catálogo de revenda.</small></label><label class="full">Substituir fotos<input type="file" name="fotosProduto" accept="image/*" multiple><small class="field-help">Opcional. Máximo de 6 fotos.</small></label><div class="full edit-photo-list">${fotos.map((f,i)=>`<img src="${esc(f)}" alt="Foto ${i+1}">`).join('')}</div><div class="full actions"><button class="primary">Salvar</button>${isAdmin()?'<button type="button" class="delete-btn delete-product-site"><i class="fa-solid fa-trash"></i> Excluir produto</button>':''}<span class="message form-message"></span></div></form></div>`;document.body.appendChild(modal);modal.querySelector('.edit-close').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove()};const btnExcluir=modal.querySelector('.delete-product-site');if(btnExcluir)btnExcluir.onclick=async()=>{if(!confirm('Tem certeza que deseja excluir este produto do estoque e do site? Esta ação não poderá ser desfeita.'))return;const motivo=prompt('Informe o motivo da exclusão:');if(!motivo||!motivo.trim())return;btnExcluir.disabled=true;btnExcluir.textContent='Excluindo...';try{await api('excluirProdutoSite',{idEstoque:id,motivo:motivo.trim()});modal.remove();toast('Produto excluído');state.dados=null;loadSiteProdutos();loadEstoque();loadDashboard()}catch(err){btnExcluir.disabled=false;btnExcluir.innerHTML='<i class="fa-solid fa-trash"></i> Excluir produto';toast(err.message)}};modal.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f);d.idEstoque=id;d.valorCusto=parseMoney(d.valorCusto);d.precoSite=parseMoney(d.precoSite);d.precoRevenda=parseMoney(d.precoRevenda);if(d.valorCusto<=0)return setMsg(f,'Informe o valor pago no aparelho.');const arq=[...f.querySelector('[name=fotosProduto]').files];if(arq.length>6)return setMsg(f,'Selecione no máximo 6 fotos.');if(arq.length){setMsg(f,'Preparando fotos...');const imgs=[];for(const foto of arq)imgs.push(await prepararImagem(foto));d.fotosData=imgs.map(a=>a.data);d.fotosNomes=imgs.map(a=>a.nome)}delete d.fotosProduto;setMsg(f,'Salvando...');try{await api('atualizarProdutoSite',d);modal.remove();toast('Produto atualizado');state.dados=null;loadSiteProdutos()}catch(err){setMsg(f,err.message)}}};
window.alterarProdutoSite=async(idEstoque,statusSite)=>{try{await api('atualizarProdutoSite',{idEstoque,statusSite});toast('Status atualizado');state.dados=null;loadSiteProdutos()}catch(e){toast(e.message)}};
const btnSite=document.querySelector('#atualizarSiteProdutos');if(btnSite)btnSite.onclick=loadSiteProdutos;


// Alternador de tema: claro por padrão e preferência salva no navegador.
(function configurarTema(){
  const STORAGE_KEY='celltech_tema';
  const botoes=[document.getElementById('themeToggle'),document.getElementById('loginThemeToggle')].filter(Boolean);

  function aplicarTema(tema){
    const escuro=tema==='dark';
    document.body.classList.toggle('dark-theme',escuro);
    botoes.forEach(botao=>{
      const icon=botao.querySelector('i');
      const texto=botao.querySelector('span');
      if(icon) icon.className=escuro?'fa-solid fa-sun':'fa-solid fa-moon';
      if(texto) texto.textContent=escuro?'Tema claro':'Tema escuro';
      botao.setAttribute('aria-label',escuro?'Ativar tema claro':'Ativar tema escuro');
      botao.title=escuro?'Ativar tema claro':'Ativar tema escuro';
    });
  }

  let tema='light';
  try{tema=localStorage.getItem(STORAGE_KEY)==='dark'?'dark':'light'}catch(e){}
  aplicarTema(tema);

  botoes.forEach(botao=>botao.addEventListener('click',()=>{
    const proximo=document.body.classList.contains('dark-theme')?'light':'dark';
    try{localStorage.setItem(STORAGE_KEY,proximo)}catch(e){}
    aplicarTema(proximo);
  }));
})();



async function loadFuncionarios(){
  if(!isAdmin())return;const body=$("#funcionariosBody"),msg=$("#funcionariosMsg");if(!body)return;body.innerHTML='<tr><td colspan="6">Carregando...</td></tr>';msg.textContent='';
  try{const r=await api('listarFuncionarios'),itens=r.funcionarios||[];body.innerHTML=itens.length?itens.map(x=>`<tr><td>${esc(x.nome)}</td><td>${esc(x.usuario)}</td><td><span class="role-badge">${esc(x.perfil)}</span></td><td><span class="status-badge ${String(x.status).toLowerCase()==='ativo'?'active':'inactive'}">${esc(x.status)}</span></td><td>${esc(x.dataCadastro||'')}</td><td>${String(x.id)===String(state.user?.id)?'<small>Usuário atual</small>':`<button type="button" class="delete-btn user-delete-btn" onclick="excluirFuncionario('${esc(x.id)}','${esc(x.nome)}')"><i class="fa-solid fa-trash"></i> Excluir</button>`}</td></tr>`).join(''):'<tr><td colspan="6">Nenhum funcionário cadastrado.</td></tr>'}catch(e){body.innerHTML='<tr><td colspan="6">Não foi possível carregar.</td></tr>';msg.textContent=e.message}
}
window.excluirFuncionario=async(id,nome)=>{
  if(!confirm(`Excluir o cadastro de ${nome}? Essa pessoa perderá o acesso ao sistema.`))return;
  const motivo=prompt('Informe o motivo da exclusão:','Cadastro removido pelo administrador');if(motivo===null)return;
  try{await api('excluirFuncionario',{idFuncionario:String(id).trim(),motivo:(motivo.trim()||'Cadastro removido pelo administrador')});toast('Cadastro excluído');await loadFuncionarios()}catch(e){toast(e.message==='Ação inválida.'?'Atualize o Code.gs e publique uma nova versão do Apps Script.':e.message)}
};
const atualizarFuncionarios=$("#atualizarFuncionarios");if(atualizarFuncionarios)atualizarFuncionarios.onclick=loadFuncionarios;
async function loadCatalogoRevendedor(){
  const box=$("#revendedorCatalogo"),msg=$("#revendedorMsg");if(!box)return;box.innerHTML='<div class="panel">Carregando produtos...</div>';msg.textContent='';
  try{
    const j=await api('listarCatalogoRevendedor');state.catalogoRevendedor=j.produtos||[];
    const condicao=null;
    renderCatalogoRevendedor(state.catalogoRevendedor);
    const input=$("#buscaModeloRevendedor"),limpar=$("#limparBuscaRevendedor"),ordem=$("#ordemRevendedor");
    if(input&&!input.dataset.ready){
      input.dataset.ready='1';
      input.addEventListener('input',()=>filtrarCatalogoRevendedor());
      if(limpar)limpar.onclick=()=>{input.value='';filtrarCatalogoRevendedor();input.focus()};
      if(condicao)condicao.addEventListener('change',filtrarCatalogoRevendedor);
      if(ordem)ordem.addEventListener('change',filtrarCatalogoRevendedor);
    }
  }catch(e){box.innerHTML='<div class="panel empty-catalog">Não foi possível carregar os produtos.</div>';msg.textContent=e.message}
}
function filtrarCatalogoRevendedor(){
  const termo=String($("#buscaModeloRevendedor")?.value||'').trim().toLowerCase();
  const condicao=String($("#filtroCondicaoRevendedor")?.value||'').trim().toLowerCase();
  const ordem=String($("#ordemRevendedor")?.value||'recentes');
  const itens=(state.catalogoRevendedor||[]).filter(x=>{
    const bateBusca=[x.modelo,x.armazenamento,x.cor,x.condicao].some(v=>String(v||'').toLowerCase().includes(termo));
    const bateCondicao=!condicao||String(x.condicao||'').trim().toLowerCase()===condicao;
    return bateBusca&&bateCondicao;
  });
  if(ordem==='menor')itens.sort((a,b)=>numeroPlanilha(a.precoRevenda)-numeroPlanilha(b.precoRevenda));
  if(ordem==='maior-desconto')itens.sort((a,b)=>(numeroPlanilha(b.precoNormal)-numeroPlanilha(b.precoRevenda))-(numeroPlanilha(a.precoNormal)-numeroPlanilha(a.precoRevenda)));
  if(ordem==='modelo')itens.sort((a,b)=>String(a.modelo||'').localeCompare(String(b.modelo||''),'pt-BR'));
  renderCatalogoRevendedor(itens,termo||condicao);
}
function renderCatalogoRevendedor(itens,termo=''){
  const box=$("#revendedorCatalogo");if(!box)return;
  const contador=$("#contadorRevendedor");if(contador)contador.textContent=`${itens.length} ${itens.length===1?'produto':'produtos'}`;
  box.innerHTML=itens.length?itens.map((x,index)=>{
      const fotos=(Array.isArray(x.fotos)&&x.fotos.length?x.fotos:[x.foto]).filter(Boolean);
      const galleryId=`reseller-gallery-${index}`;
      const galeria=fotos.length?`<div class="reseller-gallery-wrap" id="${galleryId}"><div class="reseller-gallery">${fotos.map((f,i)=>`<img src="${esc(f)}" alt="${esc(x.modelo||'Produto')} - foto ${i+1}" loading="lazy">`).join('')}</div>${fotos.length>1?`<button type="button" class="gallery-arrow gallery-prev" onclick="moveResellerGallery('${galleryId}',-1)" aria-label="Foto anterior"><i class="fa-solid fa-chevron-left"></i></button><button type="button" class="gallery-arrow gallery-next" onclick="moveResellerGallery('${galleryId}',1)" aria-label="Próxima foto"><i class="fa-solid fa-chevron-right"></i></button><div class="gallery-dots">${fotos.map((_,i)=>`<button type="button" class="gallery-dot ${i===0?'active':''}" onclick="goToResellerPhoto('${galleryId}',${i})" aria-label="Ver foto ${i+1}"></button>`).join('')}</div><span class="gallery-count">1/${fotos.length}</span>`:''}</div>`:`<div class="reseller-photo-empty"><i class="fa-solid fa-mobile-screen-button"></i></div>`;
      const desconto=Math.max(0,numeroPlanilha(x.precoNormal)-numeroPlanilha(x.precoRevenda));
      const aviso=x.comentarioRevendedor?`<div class="reseller-note"><i class="fa-solid fa-circle-info"></i><div><strong>Informação importante</strong><p>${esc(x.comentarioRevendedor)}</p></div></div>`:'';
      const detalhes=[x.modelo,x.armazenamento,x.cor].filter(Boolean).join(' • ');
      const whatsappTexto=encodeURIComponent(`Olá! Sou revendedor e tenho interesse neste produto:

${detalhes}
Preço para revendedor: ${money(x.precoRevenda)}

Meu nome: ${state.user?.nome||''}`);
      const whatsappUrl=`https://wa.me/5511977030517?text=${whatsappTexto}`;
      const badges=[x.condicao?`<span><i class="fa-solid fa-circle-check"></i>${esc(x.condicao)}</span>`:'',x.armazenamento?`<span><i class="fa-solid fa-database"></i>${esc(x.armazenamento)}</span>`:'',x.bateria?`<span><i class="fa-solid fa-battery-three-quarters"></i>${esc(x.bateria)}</span>`:''].filter(Boolean).join('');
      return `<article class="reseller-card">${galeria}<div class="reseller-body"><div class="reseller-card-top"><span class="reseller-category">${esc(x.categoria||'Produto')}</span><span class="reseller-available"><i class="fa-solid fa-circle"></i> Disponível</span></div><h2>${esc(x.modelo||'')}</h2><div class="reseller-badges">${badges}</div>${aviso}<div class="reseller-prices"><div class="reseller-price-normal"><small>Preço normal no site</small><strong>${money(x.precoNormal)}</strong></div><div class="reseller-price"><small>Preço exclusivo</small><strong>${money(x.precoRevenda)}</strong></div></div>${desconto>0?`<div class="reseller-saving"><i class="fa-solid fa-arrow-trend-down"></i><strong>Economia de ${money(desconto)}</strong><span> para aumentar sua margem</span></div>`:''}<a class="reseller-whatsapp" href="${whatsappUrl}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i><span>Comprar pelo WhatsApp</span></a></div></article>`
    }).join(''):`<div class="panel empty-catalog">${termo?'Nenhum produto encontrado para essa pesquisa.':'Nenhum produto disponível para revenda no momento.'}</div>`;
}


window.goToResellerPhoto=(galleryId,index)=>{
  const wrap=document.getElementById(galleryId);if(!wrap)return;
  const gallery=wrap.querySelector('.reseller-gallery');const slides=[...gallery.querySelectorAll('img')];if(!slides.length)return;
  const target=Math.max(0,Math.min(Number(index)||0,slides.length-1));
  gallery.scrollTo({left:target*gallery.clientWidth,behavior:'smooth'});
  updateResellerGallery(wrap,target);
};
window.moveResellerGallery=(galleryId,direction)=>{
  const wrap=document.getElementById(galleryId);if(!wrap)return;
  const gallery=wrap.querySelector('.reseller-gallery');const total=gallery.querySelectorAll('img').length;if(!total)return;
  const current=Math.round(gallery.scrollLeft/Math.max(gallery.clientWidth,1));
  const next=(current+Number(direction)+total)%total;
  window.goToResellerPhoto(galleryId,next);
};
function updateResellerGallery(wrap,index){
  wrap.querySelectorAll('.gallery-dot').forEach((dot,i)=>dot.classList.toggle('active',i===index));
  const count=wrap.querySelector('.gallery-count');const total=wrap.querySelectorAll('.reseller-gallery img').length;
  if(count)count.textContent=`${index+1}/${total}`;
}
document.addEventListener('scroll',e=>{
  const gallery=e.target.closest?.('.reseller-gallery');if(!gallery)return;
  const wrap=gallery.closest('.reseller-gallery-wrap');
  const index=Math.round(gallery.scrollLeft/Math.max(gallery.clientWidth,1));
  updateResellerGallery(wrap,index);
},true);
