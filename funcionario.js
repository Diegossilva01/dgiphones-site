const SISTEMA_API_URL = "https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec";

const state={token:localStorage.getItem("ct_token")||"",user:null,chart:null,estoque:[],historico:[],dados:null};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const isAdmin=()=>String(state.user?.perfil||"").toLowerCase()==="administrador";

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
function vendaReceipt(d,aparelho,id){const garantia=Math.max(0,Number(d.garantiaDias||0));const body=`<p class="intro">Recebemos de <strong>${esc(d.nome)}</strong>, CPF <strong>${esc(d.cpf)}</strong>, o valor abaixo referente à compra do aparelho descrito neste documento.</p><div class="grid"><div class="item"><span class="label">Data da venda</span><span class="value">${esc(dataBR(d.dataVenda))}</span></div><div class="item"><span class="label">Forma de pagamento</span><span class="value">${esc(d.formaPagamento)}</span></div><div class="item"><span class="label">Cliente</span><span class="value">${esc(d.nome)}</span></div><div class="item"><span class="label">CPF</span><span class="value">${esc(d.cpf)}</span></div><div class="item"><span class="label">Telefone</span><span class="value">${esc(d.telefone||"Não informado")}</span></div><div class="item"><span class="label">Funcionário</span><span class="value">${esc(state.user?.nome||"")}</span></div><div class="item"><span class="label">Aparelho</span><span class="value">${esc(`${aparelho?.['Modelo']||''} ${aparelho?.['Armazenamento']||''} ${aparelho?.['Cor']||''}`.trim())}</span></div><div class="item"><span class="label">IMEI 1</span><span class="value">${esc(aparelho?.['IMEI']||"")}</span></div><div class="item"><span class="label">IMEI 2</span><span class="value">${esc(aparelho?.['IMEI 2']||"Não informado")}</span></div><div class="item full"><span class="label">Valor total</span><span class="value amount">${esc(money(d.valorVenda))}</span></div><div class="item full"><span class="label">Observações</span><span class="value">${esc(d.observacoes||"Sem observações")}</span></div></div>`;const terms=`<h2>GARANTIA E CONDIÇÕES</h2><p>Garantia informada pela loja: <strong>${garantia} dias</strong>, contados da data da venda, sem prejuízo dos direitos previstos na legislação aplicável.</p><ul><li>Para atendimento, apresente este recibo e o aparelho com o IMEI indicado.</li><li>A garantia cobre defeitos de funcionamento constatados após avaliação técnica.</li><li>Danos decorrentes de queda, impacto, contato com líquido, oxidação, violação, reparo por terceiros, uso inadequado ou acessórios externos serão avaliados e podem não ser cobertos quando não tiverem relação com defeito do produto.</li><li>Senhas, contas e cópias de segurança são responsabilidade do cliente. A loja não se responsabiliza por perda de dados.</li></ul>`;return receiptShell("RECIBO DE VENDA",id,body,terms)}
function compraReceipt(d,id){const body=`<p class="intro">Eu, <strong>${esc(d.nome)}</strong>, CPF <strong>${esc(d.cpf)}</strong>, declaro que vendi e entreguei à CellTech Panamby o aparelho descrito abaixo, recebendo o valor indicado.</p><div class="grid"><div class="item"><span class="label">Data da compra</span><span class="value">${esc(dataBR(d.dataCompra))}</span></div><div class="item"><span class="label">Forma de pagamento</span><span class="value">${esc(d.formaPagamento||"Não informado")}</span></div><div class="item"><span class="label">Vendedor do aparelho</span><span class="value">${esc(d.nome)}</span></div><div class="item"><span class="label">CPF</span><span class="value">${esc(d.cpf)}</span></div><div class="item"><span class="label">Telefone</span><span class="value">${esc(d.telefone||"Não informado")}</span></div><div class="item"><span class="label">Funcionário responsável</span><span class="value">${esc(state.user?.nome||"")}</span></div><div class="item"><span class="label">Aparelho</span><span class="value">${esc(`${d.modelo||''} ${d.armazenamento||''} ${d.cor||''}`.trim())}</span></div><div class="item"><span class="label">IMEI 1</span><span class="value">${esc(d.imei)}</span></div><div class="item"><span class="label">IMEI 2</span><span class="value">${esc(d.imei2||"Não informado")}</span></div><div class="item full"><span class="label">Valor recebido</span><span class="value amount">${esc(money(d.valorCompra))}</span></div><div class="item full"><span class="label">Observações</span><span class="value">${esc(d.observacoes||"Sem observações")}</span></div></div>`;const terms=`<h2>DECLARAÇÃO DE PROPRIEDADE E ENTREGA</h2><p>O declarante confirma ser legítimo proprietário e responsável pela procedência do aparelho, autorizando sua compra e posterior revenda.</p><ul><li>Declara que o aparelho não é produto de furto, roubo, fraude, apropriação indevida ou outra origem ilícita.</li><li>Declara que informou corretamente o IMEI, o estado do aparelho e eventuais defeitos.</li><li>Compromete-se a remover contas, senhas, bloqueios de ativação e vínculos com operadoras ou instituições financeiras.</li><li>Confirma o recebimento integral do valor indicado, dando quitação desta compra, ressalvadas informações falsas ou vícios de procedência.</li></ul>`;return receiptShell("RECIBO DE COMPRA",id,body,terms)}

function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function validCPF(cpf){cpf=String(cpf).replace(/\D/g,"");if(cpf.length!==11||/^(\d)\1+$/.test(cpf))return false;let s=0;for(let i=0;i<9;i++)s+=+cpf[i]*(10-i);let d=11-(s%11);if(d>=10)d=0;if(d!==+cpf[9])return false;s=0;for(let i=0;i<10;i++)s+=+cpf[i]*(11-i);d=11-(s%11);if(d>=10)d=0;return d===+cpf[10]}
function parseMoney(v){return Number(String(v).replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",","."))||0}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function setMsg(form,msg,ok=false){const e=form.querySelector(".form-message");e.textContent=msg;e.classList.toggle("success",ok)}
function showApp(){$("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");$("#usuarioLogado").textContent=`${state.user.nome} • ${state.user.perfil}`;$$('.admin-only').forEach(e=>e.style.display=isAdmin()?'':'none');loadDashboard();loadEstoque()}
async function logout(){try{await api("logout")}catch(e){}localStorage.removeItem("ct_token");location.reload()}

$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("#loginMsg");m.textContent="Entrando...";try{const j=await api("login",{usuario:$("#loginUsuario").value,senha:$("#loginSenha").value});state.token=j.token;state.user=j.funcionario;localStorage.setItem("ct_token",state.token);showApp()}catch(err){m.textContent=err.message}});
$("#logoutBtn").onclick=logout;$("#menuBtn").onclick=()=>$(".sidebar").classList.toggle("open");
$$('.nav-btn').forEach(btn=>btn.onclick=()=>{if(btn.style.display==='none')return;$$('.nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$$('.page').forEach(p=>p.classList.remove('active'));$(`#page-${btn.dataset.page}`).classList.add('active');$("#tituloPagina").textContent=btn.textContent.trim();$(".sidebar").classList.remove("open");if(btn.dataset.page==='historico')loadHistorico();if(btn.dataset.page==='dashboard')loadDashboard();if(btn.dataset.page==='venda')loadEstoque();if(btn.dataset.page==='comissao')loadComissao()});

$$('.cpf').forEach(i=>i.addEventListener('input',()=>{let v=i.value.replace(/\D/g,'').slice(0,11);i.value=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')}));
$$('.money').forEach(i=>i.addEventListener('blur',()=>{const v=parseMoney(i.value);if(v)i.value=money(v)}));
$$('input[type=date]').forEach(i=>{if(!i.value)i.value=today()});


$("#compraForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f),printar=f.querySelector('[name=gerarRecibo]').checked,win=printar?window.open("","_blank"):null;if(win)win.document.write("<p style=font-family:Arial;padding:30px>Gerando recibo...</p>");if(!validCPF(d.cpf)){if(win)win.close();return setMsg(f,"CPF inválido.")}if(String(d.imei).replace(/\D/g,'').length!==15){if(win)win.close();return setMsg(f,"O IMEI 1 deve ter 15 números.")}if(d.imei2&&String(d.imei2).replace(/\D/g,'').length!==15){if(win)win.close();return setMsg(f,"O IMEI 2 deve ter 15 números.")}d.valorCompra=parseMoney(d.valorCompra);if(d.valorCompra<=0){if(win)win.close();return setMsg(f,"Informe um valor válido.")}delete d.gerarRecibo;setMsg(f,"Salvando...");try{const j=await api("cadastrarCompra",d);if(printar)openReceipt(win,compraReceipt(d,j.idCompra));f.reset();f.querySelector('[name=dataCompra]').value=today();f.querySelector('[name=gerarRecibo]').checked=true;setMsg(f,"Compra salva e recibo gerado.",true);toast("Compra cadastrada");state.dados=null;loadEstoque();loadDashboard()}catch(err){if(win)win.close();setMsg(f,err.message)}});

$("#vendaForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f),printar=f.querySelector('[name=gerarRecibo]').checked,win=printar?window.open("","_blank"):null;if(win)win.document.write("<p style=font-family:Arial;padding:30px>Gerando recibo...</p>");if(!validCPF(d.cpf)){if(win)win.close();return setMsg(f,"CPF inválido.")}d.valorVenda=parseMoney(d.valorVenda);if(d.valorVenda<=0){if(win)win.close();return setMsg(f,"Informe um valor válido.")}const aparelho=state.estoque.find(x=>String(x['ID Estoque'])===String(d.idEstoque));delete d.gerarRecibo;setMsg(f,"Salvando...");try{const j=await api("cadastrarVenda",d);if(printar)openReceipt(win,vendaReceipt(d,aparelho,j.idVenda));f.reset();f.querySelector('[name=dataVenda]').value=today();f.querySelector('[name=garantiaDias]').value=90;f.querySelector('[name=gerarRecibo]').checked=true;setMsg(f,"Venda salva e recibo gerado.",true);toast("Venda cadastrada");state.dados=null;loadEstoque();loadDashboard()}catch(err){if(win)win.close();setMsg(f,err.message)}});

$("#usuarioForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;setMsg(f,"Salvando...");try{await api("cadastrarFuncionario",formData(f));f.reset();setMsg(f,"Funcionário cadastrado.",true)}catch(err){setMsg(f,err.message)}});

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
    const j=await carregarDadosSistema(true), vendas=j.vendas||[], estoque=j.estoque||[];
    const hoje=today(), mes=hoje.slice(0,7);
    const vendasHoje=vendas.filter(r=>chaveDia(r['Data da venda'])===hoje);
    const vendasMes=vendas.filter(r=>chaveDia(r['Data da venda']).slice(0,7)===mes);
    const soma=(arr,campo)=>arr.reduce((t,r)=>t+numeroPlanilha(r[campo]),0);
    const faturamentoHoje=soma(vendasHoje,'Valor da venda');
    const faturamentoMes=soma(vendasMes,'Valor da venda');
    const lucroMes=soma(vendasMes,'Lucro');
    const disponiveis=estoque.filter(r=>String(r['Status']||'').trim().toLowerCase()==='disponível');
    $("#kpiFaturamentoHoje").textContent=money(faturamentoHoje);
    $("#kpiFaturamentoMes").textContent=money(faturamentoMes);
    $("#kpiVendasMes").textContent=vendasMes.length;
    $("#kpiTicket").textContent=money(vendasMes.length?faturamentoMes/vendasMes.length:0);
    $("#kpiLucroMes").textContent=money(lucroMes);
    $("#kpiEstoque").textContent=disponiveis.length;
    const dias=[];
    for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;dias.push({data:`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,valor:soma(vendas.filter(r=>chaveDia(r['Data da venda'])===k),'Valor da venda')})}
    if(state.chart)state.chart.destroy();
    state.chart=new Chart($("#salesChart"),{type:'bar',data:{labels:dias.map(x=>x.data),datasets:[{label:'Faturamento',data:dias.map(x=>x.valor)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
  }catch(e){toast(e.message)}
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
      head.innerHTML='<tr><th>Data</th><th>Cliente</th><th>CPF</th><th>Produto</th><th>IMEI 1</th><th>IMEI 2</th><th>Pagamento</th><th>Valor</th><th>Funcionário</th><th>Ações</th></tr>';
      body.innerHTML=regs.map(r=>`<tr><td>${esc(r['Data da venda'])}</td><td>${esc(r['Nome do cliente'])}</td><td>${esc(r['CPF'])}</td><td>${esc(`${r['Modelo']||''} ${r['Armazenamento']||''}`)}</td><td>${esc(r['IMEI'])}</td><td>${esc(r['IMEI 2']||'')}</td><td>${esc(r['Forma de pagamento'])}</td><td>${money(numeroPlanilha(r['Valor da venda']))}</td><td>${esc(r['Funcionário responsável'])}</td><td><button class="print-btn" onclick="imprimirHistorico('venda','${esc(r['ID Venda'])}')"><i class="fa-solid fa-print"></i></button>${isAdmin()?`<button class="delete-btn" onclick="excluirRegistro('venda','${esc(r['ID Venda'])}')"><i class="fa-solid fa-trash"></i></button>`:''}</td></tr>`).join('');
    }else{
      head.innerHTML='<tr><th>Data</th><th>Vendedor</th><th>CPF</th><th>Modelo</th><th>IMEI 1</th><th>IMEI 2</th><th>Valor pago</th><th>Funcionário</th><th>Ações</th></tr>';
      body.innerHTML=regs.map(r=>`<tr><td>${esc(r['Data da compra'])}</td><td>${esc(r['Nome do vendedor'])}</td><td>${esc(r['CPF'])}</td><td>${esc(`${r['Modelo']||''} ${r['Armazenamento']||''}`)}</td><td>${esc(r['IMEI'])}</td><td>${esc(r['IMEI 2']||'')}</td><td>${money(numeroPlanilha(r['Valor da compra']))}</td><td>${esc(r['Funcionário responsável'])}</td><td><button class="print-btn" onclick="imprimirHistorico('compra','${esc(r['ID Compra'])}')"><i class="fa-solid fa-print"></i></button>${isAdmin()?`<button class="delete-btn" onclick="excluirRegistro('compra','${esc(r['ID Compra'])}')"><i class="fa-solid fa-trash"></i></button>`:''}</td></tr>`).join('');
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
    const vendas=(j.vendas||[]).filter(r=>chaveDia(r['Data da venda']).slice(0,7)===mes);
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

window.excluirRegistro=async(tipo,id)=>{const motivo=prompt('Informe o motivo da exclusão:');if(!motivo)return;try{await api(tipo==='venda'?'excluirVenda':'excluirCompra',tipo==='venda'?{idVenda:id,motivo}:{idCompra:id,motivo});toast('Registro excluído');state.dados=null;loadHistorico();loadEstoque();loadDashboard()}catch(e){toast(e.message)}};
$("#buscarHistorico").onclick=loadHistorico;$("#histTipo").onchange=loadHistorico;

(async()=>{if(!state.token)return;try{const j=await api('verificarToken');state.user=j.funcionario;showApp()}catch(e){localStorage.removeItem('ct_token')}})();
