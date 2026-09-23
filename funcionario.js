const SISTEMA_API_URL = "https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec";

const state={token:localStorage.getItem("ct_token")||"",user:null,chart:null,estoque:[],historico:[],dados:null,funcionarios:[],revendedores:[],financeiro:null,ordensServico:[]};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const isAdmin=()=>String(state.user?.perfil||"").toLowerCase()==="administrador";
const isRevendedor=()=>String(state.user?.perfil||"").toLowerCase()==="revendedor";
const podeEditar=r=>isAdmin()||String(r?.['ID Funcionário']||'')===String(state.user?.id||'');

const API_TIMEOUT_MS=25000;
const API_TENTATIVAS_LEITURA=4;
const ACOES_RETRY_SEGURO=new Set([
  'verificarToken','dashboard','dadosSistema','listarCompras','listarEstoque',
  'listarProdutosSite','listarCatalogoRevendedor','listarVendas','listarFuncionarios',
  'listarFinanceiroEquipe','listarVendasComissao','listarVales','listarRevendedores','listarOS'
]);
const esperar=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ACOES_CONFIRMAR_SENHA=new Set([
  'cadastrarCompra','excluirCompra','editarCompra',
  'atualizarProdutoSite','excluirProdutoSite',
  'cadastrarVenda','excluirVenda','editarVenda',
  'cadastrarFuncionario','excluirFuncionario','removerFuncionario','deletarFuncionario',
  'salvarMeuPix','alterarStatusComissaoVenda','registrarPagamentoEquipe',
  'solicitarVale','alterarStatusVale','cadastrarRevendedor','cadastrarOS','cadastrarNotaProduto'
]);
const ROTULOS_CONFIRMACAO_SENHA={
  cadastrarCompra:'salvar esta compra',
  excluirCompra:'excluir esta compra',
  editarCompra:'alterar esta compra',
  atualizarProdutoSite:'alterar este produto',
  excluirProdutoSite:'excluir este produto',
  cadastrarVenda:'salvar esta venda',
  excluirVenda:'excluir esta venda',
  editarVenda:'alterar esta venda',
  cadastrarFuncionario:'salvar este usuário',
  excluirFuncionario:'excluir este usuário',
  salvarMeuPix:'salvar esta chave Pix',
  alterarStatusComissaoVenda:'alterar o status desta comissão',
  registrarPagamentoEquipe:'registrar esta alteração de pagamento',
  solicitarVale:'solicitar este vale',
  alterarStatusVale:'alterar o status deste vale',
  cadastrarRevendedor:'cadastrar este revendedor',
  cadastrarOS:'salvar esta ordem de serviço',
  cadastrarNotaProduto:'salvar esta nota de produto'
};
let confirmarSenhaResolver=null;
function fecharConfirmacaoSenha(valor){
  const modal=$("#confirmPasswordModal"),form=$("#confirmPasswordForm"),erro=$("#confirmPasswordError");
  if(modal)modal.classList.add('hidden');
  if(form)form.reset();
  if(erro)erro.textContent='';
  const resolver=confirmarSenhaResolver;confirmarSenhaResolver=null;
  if(resolver)resolver(valor);
}
function pedirSenhaConfirmacao(acao){
  return new Promise(resolve=>{
    const modal=$("#confirmPasswordModal"),input=$("#confirmPasswordInput"),texto=$("#confirmPasswordAction"),erro=$("#confirmPasswordError");
    if(!modal||!input){resolve(null);return}
    if(confirmarSenhaResolver){resolve(null);return}
    confirmarSenhaResolver=resolve;
    if(texto)texto.textContent=`Para ${ROTULOS_CONFIRMACAO_SENHA[acao]||'confirmar esta operação'}, digite a senha de ${state.user?.nome||'quem está logado'}.`;
    if(erro)erro.textContent='';
    modal.classList.remove('hidden');
    setTimeout(()=>input.focus(),30);
  });
}

function erroDeSessao(mensagem){
  return /sess[aã]o expirada|token inv[aá]lido|fa[cç]a login|n[aã]o autenticado/i.test(String(mensagem||''));
}

async function api(acao,dados={}){
  let payload={...dados};
  if(ACOES_CONFIRMAR_SENHA.has(String(acao))&&!Object.prototype.hasOwnProperty.call(payload,'senhaConfirmacao')){
    const senha=await pedirSenhaConfirmacao(String(acao));
    if(senha===null)throw new Error('Operação cancelada.');
    payload.senhaConfirmacao=senha;
  }
  const podeRepetir=ACOES_RETRY_SEGURO.has(String(acao));
  const maxTentativas=podeRepetir?API_TENTATIVAS_LEITURA:1;
  let ultimoErro=null;

  for(let tentativa=1;tentativa<=maxTentativas;tentativa++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);
    try{
      const r=await fetch(SISTEMA_API_URL+"?t="+Date.now(),{
        method:"POST",
        headers:{"Content-Type":"text/plain;charset=utf-8","Accept":"application/json,text/plain,*/*"},
        body:JSON.stringify({acao,token:state.token,...payload}),
        cache:"no-store",
        redirect:"follow",
        signal:controller.signal
      });

      const texto=await r.text();
      if(!r.ok){
        const err=new Error(`Servidor indisponível (${r.status}).`);
        err.transitorio=r.status===408||r.status===429||r.status>=500;
        throw err;
      }

      if(!String(texto||'').trim()){
        const err=new Error('O servidor respondeu sem dados.');
        err.transitorio=true;
        throw err;
      }

      let j;
      try{
        j=JSON.parse(texto);
      }catch(_){
        const html=/^\s*</.test(texto)||/<!doctype|<html/i.test(texto);
        const err=new Error(html?'O servidor retornou uma página temporária em vez dos dados.':'O servidor retornou uma resposta inválida.');
        err.transitorio=true;
        throw err;
      }

      if(!j.sucesso){
        const err=new Error(j.mensagem||"Não foi possível concluir.");
        err.aplicacao=true;
        err.sessaoExpirada=erroDeSessao(err.message);
        throw err;
      }
      return j;
    }catch(err){
      ultimoErro=err;
      if(err?.aplicacao)throw err;
      if(!podeRepetir||tentativa>=maxTentativas)break;
      await esperar(Math.min(700*tentativa,2200));
    }finally{
      clearTimeout(timer);
    }
  }

  const falha=new Error(ultimoErro?.name==='AbortError'
    ?'O servidor demorou para responder. O sistema tentou novamente automaticamente.'
    :'Conexão temporariamente instável. O sistema tentou reconectar automaticamente. Tente a ação novamente em alguns segundos.');
  falha.transitorio=true;
  throw falha;
}

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function dataBR(v){if(!v)return "";const d=String(v).slice(0,10).split("-");return d.length===3?`${d[2]}/${d[1]}/${d[0]}`:String(v)}
function receiptShell(title,number,body,terms,printLabel="Imprimir recibo",mostrarAssinaturas=true){return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(title)}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#151515;margin:0;background:#eee}.sheet{width:190mm;min-height:270mm;margin:10px auto;background:#fff;padding:15mm;border-top:8px solid #f5ce00}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:14px}.brand{font-size:25px;font-weight:900}.brand span{color:#d8b400}.doc{text-align:right}.doc h1{font-size:21px;margin:0 0 6px}.doc small{color:#555}.intro{font-size:14px;line-height:1.55;margin:18px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #bbb}.item{padding:10px;border-bottom:1px solid #ddd}.item:nth-child(odd){border-right:1px solid #ddd}.item.full{grid-column:1/-1;border-right:0}.label{display:block;font-size:10px;text-transform:uppercase;color:#666;font-weight:bold;margin-bottom:4px}.value{font-size:14px;font-weight:600;word-break:break-word}.amount{font-size:22px;font-weight:900}.terms{margin-top:20px;border:1px solid #bbb;padding:14px}.terms h2{font-size:14px;margin:0 0 9px}.terms p,.terms li{font-size:11px;line-height:1.5}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin-top:55px}.sign{text-align:center;border-top:1px solid #111;padding-top:7px;font-size:11px}.footer{text-align:center;margin-top:28px;font-size:10px;color:#666}.actions{position:fixed;right:18px;top:18px}.actions button{background:#111;color:#ffd600;border:0;padding:12px 18px;border-radius:8px;font-weight:bold;cursor:pointer}@media print{body{background:#fff}.sheet{margin:0;width:auto;min-height:auto;padding:0;border-top:8px solid #f5ce00}.actions{display:none}}</style></head><body><div class="actions"><button onclick="window.print()">${esc(printLabel)}</button></div><main class="sheet"><div class="head"><div class="brand">CellTech <span>Panamby</span></div><div class="doc"><h1>${esc(title)}</h1><small>Nº ${esc(number)}</small></div></div>${body}<section class="terms">${terms}</section>${mostrarAssinaturas?`<div class="signatures"><div class="sign">CellTech Panamby / Responsável</div><div class="sign">Cliente / Declarante</div></div>`:""}<div class="footer">Documento emitido eletronicamente pelo sistema interno da CellTech Panamby.</div></main></body></html>`}
function openReceipt(win,html){const w=win&&!win.closed?win:window.open("","_blank");if(!w){toast("O navegador bloqueou o recibo. Libere os pop-ups e tente novamente.");return}w.document.open();w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),500)}
function vendaReceipt(d,aparelho,id){const garantia=Math.max(0,Number(d.garantiaDias||0));const body=`<p class="intro">Recebemos de <strong>${esc(d.nome)}</strong>, CPF <strong>${esc(d.cpf)}</strong>, o valor abaixo referente à compra do aparelho descrito neste documento.</p><div class="grid"><div class="item"><span class="label">Data da venda</span><span class="value">${esc(dataBR(d.dataVenda))}</span></div><div class="item"><span class="label">Forma de pagamento</span><span class="value">${esc(d.formaPagamento)}</span></div><div class="item"><span class="label">Cliente</span><span class="value">${esc(d.nome)}</span></div><div class="item"><span class="label">CPF</span><span class="value">${esc(d.cpf)}</span></div><div class="item"><span class="label">Telefone</span><span class="value">${esc(d.telefone||"Não informado")}</span></div><div class="item"><span class="label">Funcionário</span><span class="value">${esc(d.funcionarioResponsavel||state.user?.nome||"")}</span></div><div class="item"><span class="label">Aparelho</span><span class="value">${esc(`${aparelho?.['Modelo']||''} ${aparelho?.['Armazenamento']||''} ${aparelho?.['Cor']||''}`.trim())}</span></div><div class="item"><span class="label">IMEI 1</span><span class="value">${esc(aparelho?.['IMEI']||"")}</span></div><div class="item"><span class="label">IMEI 2</span><span class="value">${esc(aparelho?.['IMEI 2']||"Não informado")}</span></div><div class="item full"><span class="label">Valor total</span><span class="value amount">${esc(money(d.valorVenda))}</span></div><div class="item full"><span class="label">Observações</span><span class="value">${esc(d.observacoes||"Sem observações")}</span></div></div>`;const terms=`<h2>GARANTIA E CONDIÇÕES</h2><p>Garantia informada pela loja: <strong>${garantia} dias</strong>, contados da data da venda, sem prejuízo dos direitos previstos na legislação aplicável.</p><ul><li>Para atendimento, apresente este recibo e o aparelho com o IMEI indicado.</li><li>A garantia cobre defeitos de funcionamento constatados após avaliação técnica.</li><li>Danos decorrentes de queda, impacto, contato com líquido, oxidação, violação, reparo por terceiros, uso inadequado ou acessórios externos serão avaliados e podem não ser cobertos quando não tiverem relação com defeito do produto.</li><li>Senhas, contas e cópias de segurança são responsabilidade do cliente. A loja não se responsabiliza por perda de dados.</li></ul>`;return receiptShell("RECIBO DE VENDA",id,body,terms)}
function compraReceipt(d,id){const body=`<p class="intro">Eu, <strong>${esc(d.nome)}</strong>, CPF <strong>${esc(d.cpf)}</strong>, declaro que vendi e entreguei à CellTech Panamby o aparelho descrito abaixo, recebendo o valor indicado.</p><div class="grid"><div class="item"><span class="label">Data da compra</span><span class="value">${esc(dataBR(d.dataCompra))}</span></div><div class="item"><span class="label">Forma de pagamento</span><span class="value">${esc(d.formaPagamento||"Não informado")}</span></div><div class="item"><span class="label">Vendedor do aparelho</span><span class="value">${esc(d.nome)}</span></div><div class="item"><span class="label">CPF</span><span class="value">${esc(d.cpf)}</span></div><div class="item"><span class="label">Telefone</span><span class="value">${esc(d.telefone||"Não informado")}</span></div><div class="item"><span class="label">Funcionário responsável</span><span class="value">${esc(d.funcionarioResponsavel||state.user?.nome||"")}</span></div><div class="item"><span class="label">Aparelho</span><span class="value">${esc(`${d.modelo||''} ${d.armazenamento||''} ${d.cor||''}`.trim())}</span></div><div class="item"><span class="label">IMEI 1</span><span class="value">${esc(d.imei)}</span></div><div class="item"><span class="label">IMEI 2</span><span class="value">${esc(d.imei2||"Não informado")}</span></div><div class="item full"><span class="label">Valor recebido</span><span class="value amount">${esc(money(d.valorCompra))}</span></div><div class="item full"><span class="label">Observações</span><span class="value">${esc(d.observacoes||"Sem observações")}</span></div></div>`;const terms=`<h2>DECLARAÇÃO DE PROPRIEDADE E ENTREGA</h2><p>O declarante confirma ser legítimo proprietário e responsável pela procedência do aparelho, autorizando sua compra e posterior revenda.</p><ul><li>Declara que o aparelho não é produto de furto, roubo, fraude, apropriação indevida ou outra origem ilícita.</li><li>Declara que informou corretamente o IMEI, o estado do aparelho e eventuais defeitos.</li><li>Compromete-se a remover contas, senhas, bloqueios de ativação e vínculos com operadoras ou instituições financeiras.</li><li>Confirma o recebimento integral do valor indicado, dando quitação desta compra, ressalvadas informações falsas ou vícios de procedência.</li></ul>`;return receiptShell("RECIBO DE COMPRA",id,body,terms)}


function osReceipt(d,id){
  const cpf=d.cpf||'Não informado';
  const body=`<p class="intro">Ordem de serviço emitida para <strong>${esc(d.nome)}</strong>, referente ao atendimento e serviço descritos abaixo.</p><div class="grid"><div class="item"><span class="label">Data da OS</span><span class="value">${esc(dataBR(d.dataOS))}</span></div><div class="item"><span class="label">Forma de pagamento</span><span class="value">${esc(d.formaPagamento||"Não informado")}</span></div><div class="item"><span class="label">Cliente</span><span class="value">${esc(d.nome)}</span></div><div class="item"><span class="label">CPF</span><span class="value">${esc(cpf)}</span></div><div class="item"><span class="label">Telefone</span><span class="value">${esc(d.telefone||"Não informado")}</span></div><div class="item"><span class="label">Funcionário responsável</span><span class="value">${esc(d.funcionarioResponsavel||state.user?.nome||"")}</span></div><div class="item"><span class="label">Status</span><span class="value">${esc(d.status||"Recebido")}</span></div><div class="item full"><span class="label">Aparelho / produto</span><span class="value">${esc(d.produto||"Não informado")}</span></div><div class="item full"><span class="label">Descrição do serviço</span><span class="value">${esc(d.descricao||"").replace(/\n/g,"<br>")}</span></div><div class="item full"><span class="label">Valor do serviço</span><span class="value amount">${esc(money(d.valor))}</span></div><div class="item full"><span class="label">Observações</span><span class="value">${esc(d.observacoes||"Sem observações").replace(/\n/g,"<br>")}</span></div></div>`;
  const terms=`<h2>ORDEM DE SERVIÇO</h2><p>Este documento registra a manutenção ou troca de peça informada acima, juntamente com o valor cobrado.</p><ul><li>Peças, serviços adicionais ou alterações não descritas devem ser registrados em nova autorização.</li><li>Senhas, contas e cópias de segurança permanecem sob responsabilidade do cliente.</li><li>Quando aplicável, condições específicas de garantia devem constar nas observações desta ordem de serviço.</li></ul>`;
  return receiptShell("ORDEM DE SERVIÇO",id,body,terms,"Imprimir OS",false);
}
function notaProdutoReceipt(d,id){
  const garantia=Math.max(0,Number(d.garantiaDias||0));
  const body=`<p class="intro">Recibo emitido para <strong>${esc(d.nome)}</strong>, referente ao acessório descrito abaixo.</p><div class="grid"><div class="item"><span class="label">Data da venda</span><span class="value">${esc(dataBR(d.dataVenda))}</span></div><div class="item"><span class="label">Forma de pagamento</span><span class="value">${esc(d.formaPagamento||"Não informado")}</span></div><div class="item"><span class="label">Cliente</span><span class="value">${esc(d.nome)}</span></div><div class="item"><span class="label">CPF</span><span class="value">${esc(d.cpf||"Não informado")}</span></div><div class="item"><span class="label">Telefone</span><span class="value">${esc(d.telefone||"Não informado")}</span></div><div class="item"><span class="label">Funcionário responsável</span><span class="value">${esc(d.funcionarioResponsavel||state.user?.nome||"")}</span></div><div class="item full"><span class="label">Acessório vendido</span><span class="value">${esc(d.produto)}</span></div><div class="item"><span class="label">Quantidade</span><span class="value">${esc(d.quantidade||1)}</span></div><div class="item"><span class="label">Garantia informada</span><span class="value">${garantia} dias</span></div><div class="item full"><span class="label">Valor total</span><span class="value amount">${esc(money(d.valor))}</span></div><div class="item full"><span class="label">Observações</span><span class="value">${esc(d.observacoes||"Sem observações").replace(/\n/g,"<br>")}</span></div></div>`;
  const terms=`<h2>RECIBO DE ACESSÓRIO</h2><p>Garantia informada pela loja: <strong>${garantia} dias</strong>, quando aplicável, sem prejuízo dos direitos previstos na legislação.</p><ul><li>Guarde este documento para identificação da venda e eventual atendimento.</li><li>Danos por mau uso, impacto, líquido, violação ou reparo por terceiros serão avaliados conforme o caso.</li><li>Este documento é um comprovante simples de venda do sistema interno e não substitui documento fiscal quando houver obrigação legal de emissão.</li></ul>`;
  return receiptShell("RECIBO DE ACESSÓRIO",id,body,terms,"Imprimir recibo",false);
}

function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function validCPF(cpf){cpf=String(cpf).replace(/\D/g,"");if(cpf.length!==11||/^(\d)\1+$/.test(cpf))return false;let s=0;for(let i=0;i<9;i++)s+=+cpf[i]*(10-i);let d=11-(s%11);if(d>=10)d=0;if(d!==+cpf[9])return false;s=0;for(let i=0;i<10;i++)s+=+cpf[i]*(11-i);d=11-(s%11);if(d>=10)d=0;return d===+cpf[10]}
function parseMoney(v){return Number(String(v).replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",","."))||0}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function setMsg(form,msg,ok=false){const e=form.querySelector(".form-message");e.textContent=msg;e.classList.toggle("success",ok)}
function ativarPagina(page){
  const btn=$(`.nav-btn[data-page="${page}"]`),sec=$(`#page-${page}`);
  if(!btn||!sec||btn.style.display==='none')return false;
  $$('.nav-btn').forEach(b=>b.classList.remove('active'));
  $$('.page').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active');sec.classList.add('active');
  $('#tituloPagina').textContent=btn.textContent.trim();
  return true;
}
function showApp(){
  $("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");$("#usuarioLogado").textContent=`${state.user.nome} • ${state.user.perfil}`;
  $$('.admin-only').forEach(e=>e.style.display=isAdmin()?'':'none');
  $$('.worker-only').forEach(e=>e.style.display=(!isAdmin()&&!isRevendedor())?'':'none');
  $$('.staff-only').forEach(e=>e.style.display=!isRevendedor()?'':'none');
  if(isRevendedor()){
    $$('.nav-btn').forEach(e=>e.style.display='none');$$('.page').forEach(e=>e.classList.remove('active'));
    $$('.reseller-only').forEach(e=>e.style.display='');
    const botao=$('.nav-btn[data-page="revendedor"]');if(botao){botao.style.display='';botao.classList.add('active')}
    $('#page-revendedor').classList.add('active');$('#tituloPagina').textContent='Catálogo de revenda';loadCatalogoRevendedor();
  }else{
    if(isAdmin()){ativarPagina('dashboard');loadDashboard()}else ativarPagina('venda');
    loadEstoque();
    if(isAdmin())loadFuncionarios();
  }
}
async function logout(){try{await api("logout")}catch(e){}localStorage.removeItem("ct_token");location.reload()}

$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("#loginMsg");m.textContent="Entrando...";try{const j=await api("login",{usuario:$("#loginUsuario").value,senha:$("#loginSenha").value});state.token=j.token;state.user=j.funcionario;localStorage.setItem("ct_token",state.token);showApp()}catch(err){m.textContent=err.message}});
$("#logoutBtn").onclick=logout;$("#menuBtn").onclick=()=>$(".sidebar").classList.toggle("open");
$("#confirmPasswordForm")?.addEventListener('submit',e=>{e.preventDefault();const senha=$("#confirmPasswordInput")?.value||'';if(!senha){if($("#confirmPasswordError"))$("#confirmPasswordError").textContent='Digite sua senha.';return}fecharConfirmacaoSenha(senha)});
$("#cancelConfirmPassword")?.addEventListener('click',()=>fecharConfirmacaoSenha(null));
$("#confirmPasswordModal")?.addEventListener('click',e=>{if(e.target===e.currentTarget)fecharConfirmacaoSenha(null)});
$$('.nav-btn').forEach(btn=>btn.onclick=()=>{if(btn.style.display==='none'||(btn.dataset.page==='dashboard'&&!isAdmin()))return;if(!ativarPagina(btn.dataset.page))return;$(".sidebar").classList.remove("open");if(btn.dataset.page==='historico')loadHistorico();if(btn.dataset.page==='dashboard')loadDashboard();if(btn.dataset.page==='venda')loadEstoque();if(btn.dataset.page==='comissao')loadComissao();if(btn.dataset.page==='pagamentos')loadPagamentos();if(btn.dataset.page==='site')loadSiteProdutos();if(btn.dataset.page==='revendedor')loadCatalogoRevendedor();if(btn.dataset.page==='usuarios')loadFuncionarios();if(btn.dataset.page==='cadastro-revendedor')loadRevendedores();if(btn.dataset.page==='os-notas'){ativarDocTab('nova-os');preencherDatasDocumentos()}});

$$('.cpf').forEach(i=>i.addEventListener('input',()=>{let v=i.value.replace(/\D/g,'').slice(0,11);i.value=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')}));
$$('.money').forEach(i=>i.addEventListener('blur',()=>{const v=parseMoney(i.value);if(v)i.value=money(v)}));
$$('#vendaForm input[type=date],#compraForm input[type=date],#osForm input[type=date],#notaProdutoForm input[type=date]').forEach(i=>{if(!i.value)i.value=today()});


$("#compraForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f),printar=f.querySelector('[name=gerarRecibo]').checked,win=printar?window.open("","_blank"):null;if(win)win.document.write("<p style=font-family:Arial;padding:30px>Gerando recibo...</p>");if(!validCPF(d.cpf)){if(win)win.close();return setMsg(f,"CPF inválido.")}if(String(d.imei).replace(/\D/g,'').length!==15){if(win)win.close();return setMsg(f,"O IMEI 1 deve ter 15 números.")}if(d.imei2&&String(d.imei2).replace(/\D/g,'').length!==15){if(win)win.close();return setMsg(f,"O IMEI 2 deve ter 15 números.")}d.valorCompra=parseMoney(d.valorCompra);d.precoSite=parseMoney(d.precoSite);d.precoRevenda=parseMoney(d.precoRevenda);if(d.valorCompra<=0||d.precoSite<=0||d.precoRevenda<=0){if(win)win.close();return setMsg(f,"Informe valores válidos.")}const fotos=[...f.querySelector('[name=fotosProduto]').files];if(fotos.length>6){if(win)win.close();return setMsg(f,"Selecione no máximo 6 fotos.")}const imagens=[];if(fotos.length){setMsg(f,`Preparando ${fotos.length} foto(s)...`);for(const foto of fotos)imagens.push(await prepararImagem(foto))}d.fotosData=imagens.map(x=>x.data);d.fotosNomes=imagens.map(x=>x.nome);delete d.fotosProduto;delete d.gerarRecibo;setMsg(f,fotos.length?`Salvando produto e ${fotos.length} foto(s)...`:"Salvando compra...");try{const j=await api("cadastrarCompra",d);if(printar)openReceipt(win,compraReceipt(d,j.idCompra));f.reset();f.querySelector('[name=dataCompra]').value=today();f.querySelector('[name=gerarRecibo]').checked=true;setMsg(f,fotos.length?"Compra salva, fotos enviadas e produto integrado ao site.":"Compra salva e produto integrado ao site. As fotos podem ser adicionadas depois.",true);toast("Compra cadastrada");state.dados=null;loadEstoque();if(isAdmin())loadDashboard();loadSiteProdutos()}catch(err){if(win)win.close();setMsg(f,err.message)}});

$("#vendaForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f),printar=f.querySelector('[name=gerarRecibo]').checked,win=printar?window.open("","_blank"):null;if(win)win.document.write("<p style=font-family:Arial;padding:30px>Gerando recibo...</p>");if(!validCPF(d.cpf)){if(win)win.close();return setMsg(f,"CPF inválido.")}d.valorVenda=parseMoney(d.valorVenda);if(d.valorVenda<=0){if(win)win.close();return setMsg(f,"Informe um valor válido.")}const aparelho=state.estoque.find(x=>String(x['ID Estoque'])===String(d.idEstoque));delete d.gerarRecibo;setMsg(f,"Salvando...");try{const j=await api("cadastrarVenda",d);if(printar)openReceipt(win,vendaReceipt(d,aparelho,j.idVenda));f.reset();f.querySelector('[name=dataVenda]').value=today();f.querySelector('[name=garantiaDias]').value=90;f.querySelector('[name=gerarRecibo]').checked=true;setMsg(f,"Venda salva e recibo gerado.",true);toast("Venda cadastrada");state.dados=null;loadEstoque();if(isAdmin())loadDashboard()}catch(err){if(win)win.close();setMsg(f,err.message)}});


function preencherDatasDocumentos(){
  const a=$("#osForm [name=dataOS]"),b=$("#notaProdutoForm [name=dataVenda]");
  if(a&&!a.value)a.value=today();if(b&&!b.value)b.value=today();
}
function ativarDocTab(nome){
  $$('.doc-tab').forEach(b=>b.classList.toggle('active',b.dataset.docTab===nome));
  $$('.doc-tab-panel').forEach(p=>p.classList.toggle('active',p.id===`doc-tab-${nome}`));
  if(nome==='consultar-os')loadOS();if(nome==='manutencoes')loadManutencoes();if(nome==='lucro-manutencao')loadLucroManutencao();
}
$$('.doc-tab').forEach(btn=>btn.addEventListener('click',()=>ativarDocTab(btn.dataset.docTab)));
preencherDatasDocumentos();

$("#osForm")?.addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget,d=formData(f),printar=f.querySelector('[name=gerarDocumento]').checked,win=printar?window.open("","_blank"):null;
  if(win)win.document.write("<p style=font-family:Arial;padding:30px>Gerando OS...</p>");
  if(d.cpf&&!validCPF(d.cpf)){if(win)win.close();return setMsg(f,"CPF inválido.")}
  d.valor=parseMoney(d.valor);d.custoPeca=d.custoPeca?parseMoney(d.custoPeca):'';if(d.valor<=0){if(win)win.close();return setMsg(f,"Informe um valor válido.")}
  if(d.custoPeca!==''&&d.custoPeca<0){if(win)win.close();return setMsg(f,"Informe um custo válido.")}
  delete d.gerarDocumento;setMsg(f,"Salvando OS...");
  try{const j=await api("cadastrarOS",d);if(printar)openReceipt(win,osReceipt({...d,funcionarioResponsavel:state.user?.nome||''},j.idOS));f.reset();f.querySelector('[name=dataOS]').value=today();f.querySelector('[name=status]').value='Recebido';f.querySelector('[name=gerarDocumento]').checked=true;setMsg(f,`OS ${j.idOS} salva com sucesso.`,true);toast("Ordem de serviço gerada");state.ordensServico=[]}catch(err){if(win)win.close();setMsg(f,err.message)}
});

$("#notaProdutoForm")?.addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget,d=formData(f),printar=f.querySelector('[name=gerarDocumento]').checked,win=printar?window.open("","_blank"):null;
  if(win)win.document.write("<p style=font-family:Arial;padding:30px>Gerando recibo...</p>");
  if(d.cpf&&!validCPF(d.cpf)){if(win)win.close();return setMsg(f,"CPF inválido.")}
  d.valor=parseMoney(d.valor);d.quantidade=Math.max(1,Number(d.quantidade||1));d.garantiaDias=Math.max(0,Number(d.garantiaDias||0));
  if(d.valor<=0){if(win)win.close();return setMsg(f,"Informe um valor válido.")}
  delete d.gerarDocumento;setMsg(f,"Salvando recibo...");
  try{const j=await api("cadastrarNotaProduto",d);if(printar)openReceipt(win,notaProdutoReceipt({...d,funcionarioResponsavel:state.user?.nome||''},j.idNota));f.reset();f.querySelector('[name=dataVenda]').value=today();f.querySelector('[name=quantidade]').value=1;f.querySelector('[name=garantiaDias]').value=90;f.querySelector('[name=gerarDocumento]').checked=true;setMsg(f,`Recibo ${j.idNota} salvo com sucesso.`,true);toast("Recibo de acessório gerado")}catch(err){if(win)win.close();setMsg(f,err.message)}
});

function osRegistroParaDocumento(r){return{dataOS:r['Data da OS'],nome:r['Nome do cliente'],cpf:r['CPF']||'',telefone:r['Telefone']||'',produto:r['Aparelho / produto']||'',descricao:r['Descrição do serviço']||'',valor:numeroPlanilha(r['Valor']),formaPagamento:r['Forma de pagamento']||'',observacoes:r['Observações']||'',funcionarioResponsavel:r['Funcionário responsável']||'',status:r['Status']||'Recebido'}}
function custoOSInformado(r){return String(r?.['Custo da peça / serviço']??'').trim()!==''}
function custoOS(r){return numeroPlanilha(r?.['Custo da peça / serviço']||0)}
function lucroOS(r){return custoOSInformado(r)?numeroPlanilha(r?.['Valor']||0)-custoOS(r):null}
function statusOSClasse(status){return 'status-'+String(status||'Recebido').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function statusOSPill(status){const s=status||'Recebido';return `<span class="status-pill ${statusOSClasse(s)}">${esc(s)}</span>`}
function statusOSOptions(atual){return ['Recebido','Em manutenção','Aguardando peça','Pronto para retirada','Entregue'].map(s=>`<option${s===(atual||'Recebido')?' selected':''}>${esc(s)}</option>`).join('')}
function linkAcompanhamentoOS(r){
  const id=String(r?.['ID OS']||''),chave=String(r?.['Chave pública']||'');if(!id||!chave)return'';
  const u=new URL('acompanhamento.html',window.location.href);u.searchParams.set('os',id);u.searchParams.set('chave',chave);return u.href;
}
window.compartilharAcompanhamentoOS=async id=>{
  let r=state.ordensServico.find(x=>String(x['ID OS'])===String(id));
  if(!r||!r['Chave pública']){try{const j=await api('listarOS',{pesquisa:id});r=(j.ordens||[]).find(x=>String(x['ID OS'])===String(id))}catch(err){return toast(err.message)}}
  const link=linkAcompanhamentoOS(r);if(!link)return toast('Não foi possível gerar o link desta OS.');
  const texto=`Acompanhe o status da sua manutenção na CellTech Panamby: ${link}`;
  try{
    if(navigator.share){await navigator.share({title:`Acompanhamento ${id}`,text:texto,url:link});return}
    await navigator.clipboard.writeText(link);toast('Link de acompanhamento copiado');
  }catch(err){try{await navigator.clipboard.writeText(link);toast('Link de acompanhamento copiado')}catch(_){prompt('Copie o link de acompanhamento:',link)}}
}
function atualizarContadoresOS(lista){
  const cont={};lista.forEach(r=>{const s=r['Status']||'Recebido';cont[s]=(cont[s]||0)+1});
  const mapa={osCountRecebido:'Recebido',osCountManutencao:'Em manutenção',osCountPeca:'Aguardando peça',osCountPronto:'Pronto para retirada',osCountEntregue:'Entregue'};
  Object.entries(mapa).forEach(([id,s])=>{const el=$(`#${id}`);if(el)el.textContent=cont[s]||0});
}
async function loadManutencoes(){
  const body=$("#manutencaoBody"),msg=$("#manutencaoMsg");if(!body)return;
  body.innerHTML='<tr><td colspan="11">Carregando manutenções...</td></tr>';if(msg)msg.textContent='';
  const status=$("#manutencaoStatus")?.value??'ativos',pesquisa=$("#manutencaoBusca")?.value||'';
  try{
    const [filtrado,todos]=await Promise.all([api('listarOS',{status,pesquisa}),api('listarOS',{})]);
    const lista=filtrado.ordens||[];state.ordensServico=lista;atualizarContadoresOS(todos.ordens||[]);
    body.innerHTML=lista.length?lista.map(r=>{const st=r['Status']||'Recebido',atualizado=r['Status atualizado em']||r['Data de cadastro']||'—',custo=custoOS(r),temCusto=custoOSInformado(r),lucro=lucroOS(r),custoPor=r['Custo atualizado por']||'';return `<tr data-os-id="${esc(r['ID OS'])}"><td><strong>${esc(r['ID OS'])}</strong></td><td>${esc(r['Data da OS']||'')}</td><td><strong>${esc(r['Nome do cliente']||'')}</strong><br><small>${esc(r['Telefone']||'')}</small></td><td>${esc(r['Aparelho / produto']||'—')}</td><td class="os-description-cell">${esc(r['Descrição do serviço']||'—')}</td><td><strong>${money(numeroPlanilha(r['Valor']))}</strong></td><td><div class="os-cost-editor"><input class="os-cost-input" inputmode="decimal" value="${esc(temCusto?money(custo):'')}" placeholder="R$ 0,00"><button class="cost-save-btn" type="button" onclick="salvarCustoOS('${esc(r['ID OS'])}',this)" title="Salvar custo"><i class="fa-solid fa-floppy-disk"></i></button></div>${custoPor?`<small>por ${esc(custoPor)}</small>`:''}</td><td><strong class="os-profit ${lucro!=null&&lucro<0?'negative':''}">${lucro==null?'—':money(lucro)}</strong></td><td><select class="status-select ${statusOSClasse(st)}" onchange="this.className='status-select '+statusOSClasse(this.value);alterarStatusOSPainel('${esc(r['ID OS'])}',this)">${statusOSOptions(st)}</select></td><td><small>${esc(atualizado)}</small><br><small>${esc(r['Status atualizado por']||r['Funcionário responsável']||'')}</small></td><td><div class="os-action-buttons"><button class="share-btn" type="button" onclick="compartilharAcompanhamentoOS('${esc(r['ID OS'])}')" title="Compartilhar acompanhamento"><i class="fa-solid fa-share-nodes"></i></button><button class="print-btn" type="button" onclick="imprimirOS('${esc(r['ID OS'])}')" title="Imprimir OS"><i class="fa-solid fa-print"></i></button></div></td></tr>`}).join(''):'<tr><td colspan="11">Nenhuma manutenção encontrada neste filtro.</td></tr>';
    if(msg)msg.textContent=`${lista.length} aparelho${lista.length===1?'':'s'} neste acompanhamento.`;
  }catch(err){body.innerHTML='<tr><td colspan="11">Não foi possível carregar as manutenções.</td></tr>';if(msg)msg.textContent=err.message}
}
window.alterarStatusOSPainel=async(id,select)=>{
  const antigo=state.ordensServico.find(r=>String(r['ID OS'])===String(id))?.['Status']||'Recebido',novo=select.value,row=select.closest('tr');
  if(novo===antigo)return;
  row?.classList.add('maintenance-updating');select.disabled=true;
  try{await api('alterarStatusOS',{idOS:id,status:novo});toast(`OS ${id}: ${novo}`);await loadManutencoes()}catch(err){select.value=antigo;toast(err.message)}finally{row?.classList.remove('maintenance-updating');select.disabled=false}
};
window.salvarCustoOS=async(id,button)=>{
  const row=button?.closest('tr'),input=row?.querySelector('.os-cost-input');if(!input)return;
  const custo=parseMoney(input.value);if(custo<0)return toast('Informe um custo válido.');
  button.disabled=true;row?.classList.add('maintenance-updating');
  try{await api('atualizarCustoOS',{idOS:id,custoPeca:custo});toast(`Custo da OS ${id} atualizado`);await loadManutencoes()}catch(err){toast(err.message)}finally{button.disabled=false;row?.classList.remove('maintenance-updating')}
};

function inicioMesAtual(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`}
function preencherDatasLucroOS(){const ini=$("#lucroOSInicio"),fim=$("#lucroOSFim");if(ini&&!ini.value)ini.value=inicioMesAtual();if(fim&&!fim.value)fim.value=today()}
async function loadLucroManutencao(){
  const body=$("#lucroOSBody"),msg=$("#lucroOSMsg");if(!body)return;preencherDatasLucroOS();
  body.innerHTML='<tr><td colspan="9">Carregando painel de lucro...</td></tr>';if(msg)msg.textContent='';
  try{
    const j=await api('listarOS',{dataInicial:$("#lucroOSInicio")?.value||'',dataFinal:$("#lucroOSFim")?.value||'',status:$("#lucroOSStatus")?.value||''});
    const lista=j.ordens||[];let faturamento=0,custo=0,lucro=0,faturamentoApurado=0,pendentes=0;
    lista.forEach(r=>{const valor=numeroPlanilha(r['Valor']);faturamento+=valor;if(custoOSInformado(r)){const c=custoOS(r);custo+=c;lucro+=valor-c;faturamentoApurado+=valor}else pendentes++});
    const margem=faturamentoApurado>0?(lucro/faturamentoApurado)*100:0;
    if($("#lucroOSFaturamento"))$("#lucroOSFaturamento").textContent=money(faturamento);
    if($("#lucroOSCusto"))$("#lucroOSCusto").textContent=money(custo);
    if($("#lucroOSLucro")){$("#lucroOSLucro").textContent=money(lucro);$("#lucroOSLucro").classList.toggle('negative',lucro<0)}
    if($("#lucroOSMargem"))$("#lucroOSMargem").textContent=margem.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
    if($("#lucroOSPendente"))$("#lucroOSPendente").textContent=pendentes;
    body.innerHTML=lista.length?lista.map(r=>{const valor=numeroPlanilha(r['Valor']),tem=custoOSInformado(r),c=tem?custoOS(r):0,l=tem?valor-c:null,m=tem&&valor>0?(l/valor)*100:null;return `<tr><td><strong>${esc(r['ID OS'])}</strong></td><td>${esc(r['Data da OS']||'')}</td><td>${esc(r['Nome do cliente']||'')}</td><td>${esc(r['Aparelho / produto']||'—')}</td><td>${statusOSPill(r['Status']||'Recebido')}</td><td><strong>${money(valor)}</strong></td><td>${tem?money(c):'<span class="cost-pending">Pendente</span>'}</td><td><strong class="os-profit ${l!=null&&l<0?'negative':''}">${l==null?'—':money(l)}</strong></td><td>${m==null?'—':m.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'}</td></tr>`}).join(''):'<tr><td colspan="9">Nenhuma OS encontrada neste período.</td></tr>';
    if(msg)msg.textContent=`${lista.length} OS no período • ${pendentes} com custo pendente.`;
  }catch(err){body.innerHTML='<tr><td colspan="9">Não foi possível carregar o painel de lucro.</td></tr>';if(msg)msg.textContent=err.message}
}

async function loadOS(){
  const body=$("#osBody"),msg=$("#osMsg");if(!body)return;
  body.innerHTML='<tr><td colspan="11">Carregando ordens de serviço...</td></tr>';if(msg)msg.textContent='';
  try{const j=await api('listarOS',{dataInicial:$("#osInicio")?.value||'',dataFinal:$("#osFim")?.value||'',pesquisa:$("#osBusca")?.value||''});const lista=j.ordens||[];state.ordensServico=lista;
    body.innerHTML=lista.length?lista.map(r=>`<tr><td><strong>${esc(r['ID OS'])}</strong></td><td>${esc(r['Data da OS'])}</td><td><strong>${esc(r['Nome do cliente'])}</strong><br><small>${esc(r['Telefone']||'')}</small></td><td>${esc(r['Aparelho / produto']||'—')}</td><td class="os-description-cell">${esc(r['Descrição do serviço']||'—')}</td><td>${statusOSPill(r['Status']||'Recebido')}</td><td><strong>${money(numeroPlanilha(r['Valor']))}</strong></td><td>${custoOSInformado(r)?money(custoOS(r)):'—'}</td><td><strong class="os-profit ${lucroOS(r)!=null&&lucroOS(r)<0?'negative':''}">${lucroOS(r)==null?'—':money(lucroOS(r))}</strong></td><td>${esc(r['Funcionário responsável']||'—')}</td><td><div class="os-action-buttons"><button class="share-btn" type="button" onclick="compartilharAcompanhamentoOS('${esc(r['ID OS'])}')" title="Compartilhar acompanhamento"><i class="fa-solid fa-share-nodes"></i></button><button class="print-btn" type="button" onclick="imprimirOS('${esc(r['ID OS'])}')" title="Imprimir OS"><i class="fa-solid fa-print"></i></button></div></td></tr>`).join(''):'<tr><td colspan="11">Nenhuma OS encontrada.</td></tr>';
    if(msg)msg.textContent=`${lista.length} OS encontrada${lista.length===1?'':'s'}.`;
  }catch(err){body.innerHTML='<tr><td colspan="11">Não foi possível carregar as OS.</td></tr>';if(msg)msg.textContent=err.message}
}
window.imprimirOS=id=>{const r=state.ordensServico.find(x=>String(x['ID OS'])===String(id));if(!r)return toast('OS não encontrada. Faça a busca novamente.');const win=window.open('','_blank');if(!win)return toast('O navegador bloqueou a impressão. Libere os pop-ups e tente novamente.');win.document.write('<p style="font-family:Arial;padding:30px">Gerando OS...</p>');openReceipt(win,osReceipt(osRegistroParaDocumento(r),r['ID OS']))};
$("#buscarOS")?.addEventListener('click',loadOS);$("#osInicio")?.addEventListener('change',loadOS);$("#osFim")?.addEventListener('change',loadOS);$("#osBusca")?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadOS()}});
$("#atualizarManutencoes")?.addEventListener('click',loadManutencoes);$("#manutencaoStatus")?.addEventListener('change',loadManutencoes);$("#manutencaoBusca")?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();loadManutencoes()}});
$("#atualizarLucroOS")?.addEventListener('click',loadLucroManutencao);$("#lucroOSInicio")?.addEventListener('change',loadLucroManutencao);$("#lucroOSFim")?.addEventListener('change',loadLucroManutencao);$("#lucroOSStatus")?.addEventListener('change',loadLucroManutencao);

$("#usuarioForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f);d.salario=parseMoney(d.salario);d.valeRefeicaoDia=parseMoney(d.valeRefeicaoDia);d.diasSemana=Number(d.diasSemana||6);setMsg(f,"Salvando...");try{const editando=!!d.idFuncionario;await api("cadastrarFuncionario",d);resetFuncionarioForm();setMsg(f,editando?"Funcionário atualizado.":"Funcionário cadastrado.",true);await loadFuncionarios();if($("#page-comissao")?.classList.contains("active"))await loadComissao();if($("#page-pagamentos")?.classList.contains("active"))await loadPagamentos()}catch(err){setMsg(f,err.message)}});

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
function chaveMomento(v,dataFallback=""){
  const s=String(v||"").trim();
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(m)return `${m[1]}-${m[2]}-${m[3]}T${m[4]||'00'}:${m[5]||'00'}:${m[6]||'00'}`;
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ ,T]+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(m)return `${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:${m[6]||'00'}`;
  return `${dataFallback||'0000-00-00'}T00:00:00`;
}
function numeroPlanilha(v){
  if(typeof v==="number")return v;
  let s=String(v??"").replace(/R\$/g,"").replace(/\s/g,"");
  if(s.includes(",")&&s.includes("."))s=s.replace(/\./g,"").replace(",", ".");
  else if(s.includes(","))s=s.replace(",", ".");
  return Number(s)||0;
}
async function loadDashboard(){
  if(!isAdmin())return;
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
  head.innerHTML='<tr><th>Tipo</th><th>Data</th><th>Cliente / vendedor</th><th>CPF</th><th>Produto</th><th>IMEI 1</th><th>IMEI 2</th><th>Pagamento</th><th>Valor</th><th>Funcionário</th><th>Ações</th></tr>';
  body.innerHTML='<tr><td colspan="11">Carregando histórico...</td></tr>';$("#histMsg").textContent='';
  try{
    const j=await carregarDadosSistema(true);
    const ini=$("#histInicio").value,fim=$("#histFim").value,q=$("#histBusca").value.trim().toLowerCase();
    const vendas=(j.vendas||[]).map((registro,ordem)=>{const data=chaveDia(registro['Data da venda']);return{tipo:'venda',registro,data,momento:chaveMomento(registro['Data de cadastro'],data),ordem}});
    const compras=(j.compras||[]).map((registro,ordem)=>{const data=chaveDia(registro['Data da compra']);return{tipo:'compra',registro,data,momento:chaveMomento(registro['Data de cadastro'],data),ordem}});
    let itens=[...vendas,...compras];
    if(tipo==='vendas')itens=itens.filter(x=>x.tipo==='venda');
    if(tipo==='compras')itens=itens.filter(x=>x.tipo==='compra');
    itens=itens.filter(x=>{
      if(ini&&x.data<ini)return false;
      if(fim&&x.data>fim)return false;
      if(q&&!Object.values(x.registro).some(v=>String(v??'').toLowerCase().includes(q)))return false;
      return true;
    }).sort((a,b)=>b.momento.localeCompare(a.momento)||b.data.localeCompare(a.data)||b.ordem-a.ordem);
    state.historico=itens.map(x=>x.registro);
    body.innerHTML=itens.map(({tipo,registro:r})=>{
      const venda=tipo==='venda',id=r[venda?'ID Venda':'ID Compra'];
      const pessoa=r[venda?'Nome do cliente':'Nome do vendedor'];
      const valor=numeroPlanilha(r[venda?'Valor da venda':'Valor da compra']);
      const data=r[venda?'Data da venda':'Data da compra'];
      const acoes=[];
      if(podeEditar(r))acoes.push(`<button class="edit-btn edit-main" onclick="editarRegistro('${tipo}','${esc(id)}')" title="Editar ${venda?'venda':'compra'}"><i class="fa-solid fa-pen"></i> Editar</button>`);
      acoes.push(`<button class="print-btn" onclick="imprimirHistorico('${tipo}','${esc(id)}')" title="Imprimir recibo"><i class="fa-solid fa-print"></i></button>`);
      if(isAdmin())acoes.push(`<button class="delete-btn" onclick="excluirRegistro('${tipo}','${esc(id)}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>`);
      return `<tr><td><span class="history-type ${venda?'sale':'purchase'}"><i class="fa-solid fa-${venda?'cart-shopping':'mobile-screen-button'}"></i> ${venda?'Venda':'Compra'}</span></td><td>${esc(data)}</td><td><strong>${esc(pessoa)}</strong></td><td>${esc(r['CPF'])}</td><td>${esc(`${r['Modelo']||''} ${r['Armazenamento']||''}`.trim())}</td><td>${esc(r['IMEI'])}</td><td>${esc(r['IMEI 2']||'')}</td><td>${esc(r['Forma de pagamento']||'—')}</td><td><strong>${money(valor)}</strong></td><td>${esc(r['Funcionário responsável']||'—')}</td><td><div class="history-actions">${acoes.join('')}</div></td></tr>`;
    }).join('')||'<tr><td colspan="11">Nenhum registro encontrado.</td></tr>';
    $("#histMsg").textContent=`${itens.length} movimentação${itens.length===1?'':'ões'} encontrada${itens.length===1?'':'s'}.`;
  }catch(e){body.innerHTML='<tr><td colspan="11">Não foi possível carregar o histórico.</td></tr>';$("#histMsg").textContent=e.message}
}

function mesAtual(){return today().slice(0,7)}
let valeSaldoDisponivelAtual=0;
function badgeFinanceiro(texto,tipo='pending'){return `<span class="finance-badge ${tipo}">${esc(texto)}</span>`}
function badgeComissaoVenda(status){
  const s=String(status||'Pendente');
  const tipo=s==='Aprovada'?'paid':s==='Negada'||s==='Recusada'?'rejected':'pending';
  const icone=s==='Aprovada'?'circle-check':tipo==='rejected'?'circle-xmark':'clock';
  return `<span class="finance-badge ${tipo}"><i class="fa-solid fa-${icone}"></i> ${esc(s==='Recusada'?'Negada':s)}</span>`;
}
function statusPagamento(item){return `<div class="payment-statuses">${item.salarioPago?badgeFinanceiro('Salário pago','paid'):badgeFinanceiro('Salário pendente','pending')}${item.valeRefeicaoPago?badgeFinanceiro('VR pago','paid'):badgeFinanceiro('VR pendente','pending')}${item.comissaoPaga?badgeFinanceiro('Comissão paga','paid'):badgeFinanceiro('Comissão pendente','pending')}</div>`}
function acoesPagamento(item,mes){
  if(!isAdmin())return '—';
  const a=[];
  if(Number(item.comissaoCalculada||0)>0)a.push(`<button class="mini-action pay" onclick="baixarPagamentoEquipe('${esc(item.id)}','comissao','${mes}',${item.comissaoPaga?'false':'true'})"><i class="fa-solid fa-${item.comissaoPaga?'rotate-left':'money-bill-transfer'}"></i> ${item.comissaoPaga?'Reabrir comissão':'Baixar comissão'}</button>`);
  a.push(`<button class="mini-action salary" onclick="baixarPagamentoEquipe('${esc(item.id)}','salario','${mes}',${item.salarioPago?'false':'true'})"><i class="fa-solid fa-${item.salarioPago?'rotate-left':'wallet'}"></i> ${item.salarioPago?'Reabrir salário + VR':'Baixar salário + VR'}</button>`);
  if(!item.salarioPago||(!item.comissaoPaga&&Number(item.comissaoCalculada||0)>0))a.push(`<button class="mini-action total" onclick="baixarPagamentoEquipe('${esc(item.id)}','total','${mes}',true)"><i class="fa-solid fa-circle-check"></i> Baixar tudo</button>`);
  return `<div class="finance-actions">${a.join('')}</div>`;
}
function prazoPagamentoTexto(dias){
  const n=Number(dias||0);if(n===0)return 'Vence hoje';if(n>0)return `Faltam ${n} dia${n===1?'':'s'}`;const a=Math.abs(n);return `Atrasado ${a} dia${a===1?'':'s'}`;
}
async function loadValesFuncionario(mes){
  const body=$("#workerValesBody"),saldo=$("#valeSaldoDisponivel");if(!body||isAdmin())return;
  try{
    const j=await api('listarVales',{mes});
    valeSaldoDisponivelAtual=Number(j.saldoDisponivel??0);
    if(saldo){saldo.textContent=`Saldo de salário atual: ${money(valeSaldoDisponivelAtual)}`;saldo.classList.toggle('negative-balance',valeSaldoDisponivelAtual<0)}
    const lista=j.vales||[];
    body.innerHTML=lista.length?lista.map(v=>`<tr><td>${esc(v.dataSolicitacao||'—')}</td><td><strong>${money(v.valor||0)}</strong></td><td>${esc(v.motivo||'—')}</td><td>${badgeVale(v.status)}</td><td>${v.decididoPor?`${esc(v.decididoPor)}<br><small>${esc(v.dataDecisao||'')}</small>`:'—'}</td></tr>`).join(''):'<tr><td colspan="5">Nenhum vale solicitado neste mês.</td></tr>';
  }catch(e){valeSaldoDisponivelAtual=0;body.innerHTML=`<tr><td colspan="5">${esc(e.message)}</td></tr>`}
}
function badgeVale(status){const s=String(status||'Pendente');const cls=s==='Aprovado'?'approved':s==='Negado'?'denied':'pending';const icon=s==='Aprovado'?'circle-check':s==='Negado'?'circle-xmark':'clock';return `<span class="advance-status ${cls}"><i class="fa-solid fa-${icon}"></i>${esc(s)}</span>`}
let pixAtualSalvo={chave:'',tipo:''};
function configurarPix(chave,tipo=''){
  const form=$("#pixForm"),saved=$("#pixSavedView"),input=$("#meuPix"),tipoInput=$("#tipoMeuPix"),value=$("#pixSavedValue"),typeValue=$("#pixSavedType"),cancel=$("#cancelarPix"),submit=$("#pixSubmitText");if(!form||!saved)return;
  const tem=String(chave||'').trim().length>0;pixAtualSalvo={chave:chave||'',tipo:tipo||''};
  if(input)input.value=chave||'';if(tipoInput)tipoInput.value=tipo||'';if(value)value.textContent=chave||'—';if(typeValue)typeValue.textContent=tipo||'Tipo não informado';
  saved.classList.toggle('hidden',!tem);form.classList.toggle('hidden',tem);if(cancel)cancel.classList.toggle('hidden',!tem);if(submit)submit.textContent=tem?'Salvar alteração':'Cadastrar chave Pix';
}
async function loadComissao(){
  const mesEl=$("#comissaoMes");if(!mesEl)return;
  if(!mesEl.value)mesEl.value=mesAtual();const mes=mesEl.value;

  if(!isAdmin()){
    const workerMsg=$("#workerCommissionMsg"),workerBody=$("#workerCommissionSalesBody");
    if(workerMsg)workerMsg.textContent='Atualizando suas comissões...';
    if(workerBody)workerBody.innerHTML='<tr><td colspan="7">Carregando...</td></tr>';
    try{
      const [financeiro,historico]=await Promise.all([
        api('listarFinanceiroEquipe',{mes}),
        api('listarVendasComissao',{mes})
      ]);
      const item=(financeiro.itens||[])[0]||{},vendas=historico.vendas||[],percentual=Number(historico.percentual||2);
      const comissaoAprovada=Number(item.comissaoPendente??item.comissaoCalculada??0);
      const pendentesElegiveis=vendas.filter(v=>v.elegivelUsuario&&v.statusComissao==='Pendente');
      const comissaoPendente=pendentesElegiveis.reduce((s,v)=>s+(Number(v.valor||0)*percentual/100),0);
      if($("#workerComissao"))$("#workerComissao").textContent=money(comissaoAprovada);
      if($("#workerComissaoPendente"))$("#workerComissaoPendente").textContent=money(comissaoPendente);
      if($("#workerComissaoPendenteInfo"))$("#workerComissaoPendenteInfo").textContent=`${pendentesElegiveis.length} venda${pendentesElegiveis.length===1?'':'s'} aguardando análise`;
      if(workerBody){
        workerBody.innerHTML=vendas.length?vendas.map(v=>{
          const elegivel=!!v.elegivelUsuario,status=String(v.statusComissao||'Pendente'),valorVenda=Number(v.valor||0),valorPotencial=Number((valorVenda*percentual/100).toFixed(2));
          let situacao,valorComissao='R$ 0,00';
          if(!elegivel){
            situacao='<span class="worker-commission-status ineligible"><i class="fa-solid fa-ban"></i> Sem direito — entrou depois desta venda</span>';
          }else if(status==='Aprovada'){
            situacao='<span class="worker-commission-status approved"><i class="fa-solid fa-circle-check"></i> Comissão aprovada</span>';
            valorComissao=`<strong class="commission-earned">${money(Number(v.comissaoUsuario||valorPotencial))}</strong>`;
          }else if(status==='Negada'){
            situacao='<span class="worker-commission-status denied"><i class="fa-solid fa-circle-xmark"></i> Comissão negada</span>';
          }else{
            situacao='<span class="worker-commission-status pending"><i class="fa-solid fa-clock"></i> Aguardando aprovação</span>';
            valorComissao=`<strong class="commission-pending-value">${money(valorPotencial)}</strong><br><small>pendente</small>`;
          }
          return `<tr><td>${esc(v.data||'—')}</td><td><strong>${esc(v.cliente||'—')}</strong></td><td>${esc([v.modelo,v.armazenamento].filter(Boolean).join(' ')||'—')}</td><td><strong>${money(valorVenda)}</strong></td><td>${badgeComissaoVenda(status)}</td><td>${situacao}</td><td>${valorComissao}</td></tr>`;
        }).join(''):'<tr><td colspan="7">Nenhuma venda encontrada neste mês.</td></tr>';
      }
      const semDireito=vendas.filter(v=>!v.elegivelUsuario).length;
      if(workerMsg)workerMsg.textContent=`${pendentesElegiveis.length} comissão${pendentesElegiveis.length===1?'':'ões'} pendente${pendentesElegiveis.length===1?'':'s'}${semDireito?` • ${semDireito} venda${semDireito===1?'':'s'} anterior${semDireito===1?'':'es'} ao seu cadastro`:''}.`;
    }catch(e){
      if(workerMsg)workerMsg.textContent=e.message;
      if(workerBody)workerBody.innerHTML='<tr><td colspan="7">Não foi possível carregar o histórico de comissões.</td></tr>';
    }
    return;
  }

  const body=$("#commissionSalesBody"),msg=$("#comissaoMsg");if(!body)return;
  body.innerHTML='<tr><td colspan="7">Carregando...</td></tr>';if(msg)msg.textContent='';
  try{
    const j=await api('listarVendasComissao',{mes}),vendas=j.vendas||[];
    $("#commissionSalesTotal").textContent=Number(j.resumo?.total||0);
    $("#commissionSalesPending").textContent=Number(j.resumo?.pendentes||0);
    $("#commissionSalesApproved").textContent=Number(j.resumo?.aprovadas||0);
    $("#commissionSalesRejected").textContent=Number(j.resumo?.negadas||0);
    body.innerHTML=vendas.length?vendas.map(v=>{
      const acoes=`<div class="commission-sale-actions">
        ${v.statusComissao!=='Aprovada'?`<button class="mini-action approve" onclick="alterarStatusComissaoVenda('${esc(v.id)}','Aprovada','${mes}')"><i class="fa-solid fa-check"></i> Aprovar</button>`:''}
        ${v.statusComissao!=='Negada'?`<button class="mini-action reject" onclick="alterarStatusComissaoVenda('${esc(v.id)}','Negada','${mes}')"><i class="fa-solid fa-xmark"></i> Negar</button>`:''}
        ${v.statusComissao!=='Pendente'?`<button class="mini-action" onclick="alterarStatusComissaoVenda('${esc(v.id)}','Pendente','${mes}')"><i class="fa-solid fa-rotate-left"></i> Reabrir</button>`:''}
      </div>`;
      return `<tr><td>${esc(v.data||'—')}</td><td><strong>${esc(v.cliente||'—')}</strong></td><td>${esc([v.modelo,v.armazenamento].filter(Boolean).join(' ')||'—')}</td><td><strong>${money(v.valor||0)}</strong></td><td>${esc(v.responsavel||'—')}</td><td>${badgeComissaoVenda(v.statusComissao)}${v.atualizadoPor?`<br><small>${esc(v.atualizadoPor)} • ${esc(v.atualizadoEm||'')}</small>`:''}</td><td>${acoes}</td></tr>`;
    }).join(''):'<tr><td colspan="7">Nenhuma venda encontrada no mês.</td></tr>';
    if(msg)msg.textContent=`${vendas.length} venda${vendas.length===1?'':'s'} no período.`;
  }catch(e){body.innerHTML='<tr><td colspan="7">Não foi possível carregar.</td></tr>';if(msg)msg.textContent=e.message}
}
async function loadValesAdmin(mes){
  if(!isAdmin())return;const body=$("#adminValesBody"),msg=$("#adminValesMsg");if(!body)return;body.innerHTML='<tr><td colspan="7">Carregando...</td></tr>';
  try{
    const j=await api('listarVales',{mes});const lista=j.vales||[];$("#valesPendentesAdmin").textContent=Number(j.resumo?.pendentes||0);$("#valesAprovadosAdmin").textContent=money(j.resumo?.valorAprovado||0);
    body.innerHTML=lista.length?lista.map(v=>{const actions=`<div class="commission-sale-actions">${v.status!=='Aprovado'?`<button class="mini-action approve" onclick="alterarStatusVale('${esc(v.id)}','Aprovado','${mes}')"><i class="fa-solid fa-check"></i> Aprovar</button>`:''}${v.status!=='Negado'?`<button class="mini-action reject" onclick="alterarStatusVale('${esc(v.id)}','Negado','${mes}')"><i class="fa-solid fa-xmark"></i> Negar</button>`:''}${v.status!=='Pendente'?`<button class="mini-action" onclick="alterarStatusVale('${esc(v.id)}','Pendente','${mes}')"><i class="fa-solid fa-rotate-left"></i> Reabrir</button>`:''}</div>`;return `<tr><td>${esc(v.dataSolicitacao||'—')}</td><td><strong>${esc(v.funcionario||'—')}</strong></td><td><strong>${money(v.valor||0)}</strong></td><td>${esc(v.motivo||'—')}</td><td>${badgeVale(v.status)}</td><td>${v.decididoPor?`${esc(v.decididoPor)}<br><small>${esc(v.dataDecisao||'')}</small>`:'—'}</td><td>${actions}</td></tr>`}).join(''):'<tr><td colspan="7">Nenhuma solicitação de vale neste mês.</td></tr>';
    if(msg)msg.textContent=`${lista.length} solicitação${lista.length===1?'':'ões'} no período.`;
  }catch(e){body.innerHTML='<tr><td colspan="7">Não foi possível carregar as solicitações.</td></tr>';if(msg)msg.textContent=e.message}
}
async function loadPagamentos(){
  const mesEl=$("#pagamentosMes");if(!mesEl)return;
  if(!mesEl.value)mesEl.value=mesAtual();const mes=mesEl.value;

  if(!isAdmin()){
    const workerMsg=$("#workerFinanceMsg");if(workerMsg)workerMsg.textContent='Atualizando seus pagamentos...';
    try{
      const financeiro=await api('listarFinanceiroEquipe',{mes}),item=(financeiro.itens||[])[0]||{};
      const saldoSalario=Number(item.saldoSalarioAtual??item.salarioPendente??item.salarioLiquido??0);
      const comissao=Number(item.comissaoPendente??item.comissaoCalculada??0);
      const totalAtual=Number(item.totalSaldoAtual??item.totalPagar??item.totalAcumulado??0);
      const salarioEl=$("#workerSalario"),totalEl=$("#workerTotal");
      if(salarioEl){salarioEl.textContent=money(saldoSalario);salarioEl.classList.toggle('negative-balance',saldoSalario<0)}
      if($("#workerVale"))$("#workerVale").textContent=money(item.valeRefeicaoPendente??item.valeRefeicaoCalculado??0);
      if($("#workerPagamentoComissao"))$("#workerPagamentoComissao").textContent=money(comissao);
      if(totalEl){totalEl.textContent=money(totalAtual);totalEl.classList.toggle('negative-balance',totalAtual<0)}
      if($("#workerPagamentoData"))$("#workerPagamentoData").textContent=item.dataPagamentoBR||financeiro.dataPagamentoBR||'—';
      if($("#workerPagamentoPrazo"))$("#workerPagamentoPrazo").textContent=prazoPagamentoTexto(item.diasAtePagamento??financeiro.diasAtePagamento??0);
      if($("#workerPagamentoStatus"))$("#workerPagamentoStatus").innerHTML=statusPagamento(item);
      configurarPix(item.chavePix||'',item.tipoChavePix||'');
      await loadValesFuncionario(mes);
      if(workerMsg)workerMsg.textContent=`Pagamentos atualizados para ${mes.split('-').reverse().join('/')}.`;
    }catch(e){
      if(workerMsg)workerMsg.textContent=e.message;
    }
    return;
  }

  const body=$("#pagamentosBody"),msg=$("#pagamentosMsg");if(!body)return;
  body.innerHTML='<tr><td colspan="9">Carregando...</td></tr>';msg.textContent='';
  try{
    const j=await api('listarFinanceiroEquipe',{mes});state.financeiro=j;const itens=j.itens||[];
    $("#financeVencimento").textContent=j.dataPagamentoBR||'—';$("#financeDiasPagamento").textContent=prazoPagamentoTexto(j.diasAtePagamento);
    $("#financeSalario").textContent=money(j.resumo?.salariosLiquidos??j.resumo?.salarios??0);$("#financeVale").textContent=money(j.resumo?.valeRefeicao||0);$("#financeComissao").textContent=money(j.resumo?.comissoes||0);$("#financeTotal").textContent=money(j.resumo?.totalPagar??j.resumo?.totalAcumulado??0);
    $("#financeVendas").textContent=Number(j.vendasCompartilhadas||0);
    body.innerHTML=itens.length?itens.map(item=>{const prazo=prazoPagamentoTexto(item.diasAtePagamento);const prazoClass=Number(item.diasAtePagamento)<0?'late':Number(item.diasAtePagamento)===0?'today':'future';return `<tr><td><strong>${esc(item.nome)}</strong><br><small>${esc(item.perfil||'')} • desde ${esc(item.dataCadastro||'—')}</small></td><td><strong>${money(item.salarioLiquido??item.salarioCalculado)}</strong><br><small>${item.diasSalario||0}/30 dias • bruto ${money(item.salarioCalculado)}${Number(item.valesAprovados||0)>0?` • vales -${money(item.valesAprovados)}`:''}</small></td><td><strong>${money(item.valeRefeicaoCalculado)}</strong><br><small>${item.diasVale||0} dias × ${money(item.valeRefeicaoDia||0)}</small></td><td><strong>${money(item.comissaoCalculada)}</strong><br><small>2% de ${money(item.faturamento)} • ${item.vendas||0} venda(s) aprovada(s)</small></td><td><strong>${money(item.totalPagar)}</strong><br><small>Total ainda a pagar</small></td><td><span class="pay-date">${esc(item.dataPagamentoBR||'—')}</span><br><span class="pay-countdown ${prazoClass}">${esc(prazo)}</span></td><td>${item.chavePix?`<span class="pix-key"><i class="fa-brands fa-pix"></i><span>${esc(item.chavePix)}<small>${esc(item.tipoChavePix||'Tipo não informado')}</small></span></span>`:'<span class="muted">Não cadastrada</span>'}</td><td>${statusPagamento(item)}</td><td>${acoesPagamento(item,mes)}</td></tr>`}).join(''):'<tr><td colspan="9">Nenhum funcionário participante da comissão.</td></tr>';
    await loadValesAdmin(mes);
  }catch(e){body.innerHTML='<tr><td colspan="9">Não foi possível carregar.</td></tr>';msg.textContent=e.message}
}
window.alterarStatusComissaoVenda=async(id,status,mes)=>{if(!confirm(`${status==='Aprovada'?'Aprovar':status==='Negada'?'Negar':'Reabrir'} a comissão desta venda?`))return;try{await api('alterarStatusComissaoVenda',{idVenda:id,status});toast('Status da venda atualizado');await loadComissao();if($("#page-pagamentos")?.classList.contains("active"))await loadPagamentos()}catch(e){toast(e.message)}};
window.baixarPagamentoEquipe=async(id,tipo,mes,pago=true)=>{const texto=pago?'registrar a baixa':'reabrir o pagamento';if(!confirm(`Deseja ${texto}?`))return;try{await api('registrarPagamentoEquipe',{idFuncionario:id,tipo,mes,pago});toast(pago?'Pagamento baixado':'Pagamento reaberto');await loadPagamentos()}catch(e){toast(e.message)}};
window.alterarStatusVale=async(id,status,mes)=>{const verbo=status==='Aprovado'?'aprovar e registrar este vale como pago':status==='Negado'?'negar esta solicitação':'reabrir esta solicitação';if(!confirm(`Deseja ${verbo}?`))return;try{await api('alterarStatusVale',{idVale:id,status});toast(status==='Aprovado'?'Vale aprovado e descontado do salário':status==='Negado'?'Vale negado':'Solicitação reaberta');await loadPagamentos();if($("#page-comissao")?.classList.contains('active'))await loadComissao()}catch(e){toast(e.message)}};
$("#buscarComissao").onclick=loadComissao;$("#comissaoMes").onchange=loadComissao;
$("#buscarPagamentos")?.addEventListener('click',loadPagamentos);$("#pagamentosMes")?.addEventListener('change',loadPagamentos);$("#atualizarValesAdmin")?.addEventListener('click',()=>loadValesAdmin($("#pagamentosMes")?.value||mesAtual()));
$("#editarPix")?.addEventListener('click',()=>{$("#pixSavedView")?.classList.add('hidden');$("#pixForm")?.classList.remove('hidden');$("#cancelarPix")?.classList.remove('hidden');$("#pixSubmitText").textContent='Salvar alteração';$("#tipoMeuPix").value=pixAtualSalvo.tipo||'';$("#meuPix").value=pixAtualSalvo.chave||'';$("#meuPix")?.focus()});
$("#cancelarPix")?.addEventListener('click',()=>configurarPix(pixAtualSalvo.chave,pixAtualSalvo.tipo));
$("#pixForm")?.addEventListener('submit',async e=>{e.preventDefault();const pix=$("#meuPix"),tipo=$("#tipoMeuPix"),msg=$("#pixMsg");if(!tipo.value){msg.textContent='Selecione o tipo da chave Pix.';return}msg.textContent='Salvando...';try{const j=await api('salvarMeuPix',{chavePix:pix.value,tipoChavePix:tipo.value});msg.textContent='';toast('Chave Pix atualizada');configurarPix(j.chavePix||pix.value,j.tipoChavePix||tipo.value)}catch(err){msg.textContent=err.message;msg.classList.remove('success')}});
$("#abrirVale")?.addEventListener('click',()=>{const form=$("#valeForm"),campo=$("#valorVale"),msg=$("#valeMsg");form?.classList.remove('hidden');if(msg)msg.textContent='Informe o valor que deseja solicitar. O administrador irá analisar e aprovar ou negar o vale.';if(campo)campo.focus()});
$("#cancelarVale")?.addEventListener('click',()=>{$("#valeForm")?.classList.add('hidden');$("#valeForm")?.reset();if($("#valeMsg"))$("#valeMsg").textContent=''});
$("#valeForm")?.addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,msg=$("#valeMsg"),valor=parseMoney($("#valorVale")?.value),motivo=$("#motivoVale")?.value||'';if(valor<=0){msg.textContent='Informe um valor válido.';return}msg.textContent='Enviando...';const botao=f.querySelector('button[type=submit]');if(botao)botao.disabled=true;try{const j=await api('solicitarVale',{valor,motivo});toast('Solicitação enviada para aprovação');f.reset();f.classList.add('hidden');msg.textContent='';const mes=j.mes||mesAtual();if($("#pagamentosMes"))$("#pagamentosMes").value=mes;valeSaldoDisponivelAtual=Number(j.saldoDisponivel??valeSaldoDisponivelAtual);await loadPagamentos()}catch(err){msg.textContent=err.message}finally{if(botao)botao.disabled=false}});

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
    setMsg(f,'Salvando...');try{await api(venda?'editarVenda':'editarCompra',d);modal.remove();toast('Registro alterado');state.dados=null;await carregarDadosSistema(true);loadHistorico();loadEstoque();if(isAdmin())loadDashboard();loadComissao();if($("#page-pagamentos")?.classList.contains("active"))loadPagamentos();loadSiteProdutos()}catch(err){setMsg(f,err.message)}};
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

window.excluirRegistro=async(tipo,id)=>{const motivo=prompt('Informe o motivo da exclusão:');if(!motivo)return;try{await api(tipo==='venda'?'excluirVenda':'excluirCompra',tipo==='venda'?{idVenda:id,motivo}:{idCompra:id,motivo});toast('Registro excluído');state.dados=null;loadHistorico();loadEstoque();if(isAdmin())loadDashboard()}catch(e){toast(e.message)}};
$("#buscarHistorico").onclick=loadHistorico;$("#histTipo").onchange=loadHistorico;$("#histInicio").onchange=loadHistorico;$("#histFim").onchange=loadHistorico;$("#histBusca").addEventListener("keydown",e=>{if(e.key==="Enter")loadHistorico()});

async function restaurarSessao(tentativa=1){
  if(!state.token)return;
  try{
    const j=await api('verificarToken');
    state.user=j.funcionario;
    showApp();
  }catch(e){
    if(e?.sessaoExpirada){
      localStorage.removeItem('ct_token');
      state.token='';
      const m=$('#loginMsg');if(m)m.textContent='Sua sessão expirou. Entre novamente.';
      return;
    }
    const m=$('#loginMsg');if(m)m.textContent='Reconectando ao sistema automaticamente...';
    if(tentativa<6)setTimeout(()=>restaurarSessao(tentativa+1),Math.min(1800*tentativa,7000));
    else if(m)m.textContent='Conexão instável. Você pode tentar entrar normalmente; não é necessário atualizar a página.';
  }
}
restaurarSessao();


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



function resetFuncionarioForm(){const f=$("#usuarioForm");if(!f)return;f.reset();f.idFuncionario.value='';f.senha.required=true;$("#senhaAjuda").textContent='Mínimo de 6 caracteres.';$("#usuarioFormTitulo").textContent='Cadastrar funcionário';$("#salvarFuncionarioBtn").textContent='Cadastrar funcionário';$("#cancelarEdicaoFuncionario").classList.add('hidden')}
async function loadFuncionarios(){
  if(!isAdmin())return;const body=$("#funcionariosBody"),msg=$("#funcionariosMsg");if(!body)return;body.innerHTML='<tr><td colspan="10">Carregando...</td></tr>';msg.textContent='';
  try{
    const r=await api('listarFuncionarios'),itens=r.funcionarios||[];state.funcionarios=itens;
    body.innerHTML=itens.length?itens.map(x=>`<tr>
      <td><strong>${esc(x.nome)}</strong></td><td>${esc(x.usuario)}</td><td><span class="role-badge">${esc(x.perfil)}</span></td>
      <td><strong>${money(x.salario||0)}</strong></td><td>${money(x.valeRefeicaoDia||0)}</td><td>${Number(x.diasSemana||6)===5?'Seg–Sex':'Seg–Sáb'}</td>
      <td>${esc(x.dataCadastro||'—')}</td><td>${x.chavePix?`<span class="pix-key"><i class="fa-brands fa-pix"></i><span>${esc(x.chavePix)}<small>${esc(x.tipoChavePix||'Tipo não informado')}</small></span></span>`:'<span class="muted">Não cadastrada</span>'}</td>
      <td><span class="status-badge ${String(x.status).toLowerCase()==='ativo'?'active':'inactive'}">${esc(x.status)}</span></td>
      <td><div class="user-actions"><button type="button" class="edit-btn" onclick="editarFuncionario('${esc(x.id)}')"><i class="fa-solid fa-pen"></i> Editar</button>${String(x.id)===String(state.user?.id)?'<small>Usuário atual</small>':`<button type="button" class="delete-btn user-delete-btn" onclick="excluirFuncionario('${esc(x.id)}','${esc(x.nome)}')"><i class="fa-solid fa-trash"></i> Excluir</button>`}</div></td>
    </tr>`).join(''):'<tr><td colspan="10">Nenhum funcionário cadastrado.</td></tr>';
  }catch(e){body.innerHTML='<tr><td colspan="10">Não foi possível carregar.</td></tr>';msg.textContent=e.message}
}
window.editarFuncionario=id=>{const x=(state.funcionarios||[]).find(f=>String(f.id)===String(id));if(!x)return;const f=$("#usuarioForm");f.idFuncionario.value=x.id;f.nome.value=x.nome||'';f.usuario.value=x.usuario||'';f.perfil.value=x.perfil||'Funcionário';f.salario.value=Number(x.salario||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});f.valeRefeicaoDia.value=Number(x.valeRefeicaoDia||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});f.diasSemana.value=String(x.diasSemana||6);f.status.value=x.status||'Ativo';f.senha.value='';f.senha.required=false;$("#senhaAjuda").textContent='Deixe em branco para manter a senha atual.';$("#usuarioFormTitulo").textContent='Editar funcionário';$("#salvarFuncionarioBtn").textContent='Salvar alterações';$("#cancelarEdicaoFuncionario").classList.remove('hidden');f.scrollIntoView({behavior:'smooth',block:'start'})};
$("#cancelarEdicaoFuncionario")?.addEventListener('click',resetFuncionarioForm);
window.excluirFuncionario=async(id,nome)=>{
  if(!confirm(`Excluir o cadastro de ${nome}? Essa pessoa perderá o acesso ao sistema.`))return;
  const motivo=prompt('Informe o motivo da exclusão:','Cadastro removido pelo administrador');if(motivo===null)return;
  try{await api('excluirFuncionario',{idFuncionario:String(id).trim(),motivo:(motivo.trim()||'Cadastro removido pelo administrador')});toast('Cadastro excluído');await loadFuncionarios()}catch(e){toast(e.message==='Ação inválida.'?'Atualize o Code.gs e publique uma nova versão do Apps Script.':e.message)}
};
const atualizarFuncionarios=$("#atualizarFuncionarios");if(atualizarFuncionarios)atualizarFuncionarios.onclick=loadFuncionarios;
async function loadRevendedores(){
  if(isRevendedor())return;
  const body=$("#revendedoresBody"),msg=$("#revendedoresMsg");if(!body)return;
  body.innerHTML='<tr><td colspan="4">Carregando...</td></tr>';if(msg)msg.textContent='';
  try{
    const j=await api('listarRevendedores'),itens=j.revendedores||[];state.revendedores=itens;
    body.innerHTML=itens.length?itens.map(x=>`<tr><td><strong>${esc(x.nome)}</strong></td><td>${esc(x.usuario)}</td><td><span class="status-badge ${String(x.status||'').toLowerCase()==='ativo'?'active':'inactive'}">${esc(x.status||'—')}</span></td><td>${esc(x.dataCadastro||'—')}</td></tr>`).join(''):'<tr><td colspan="4">Nenhum revendedor cadastrado.</td></tr>';
  }catch(e){body.innerHTML='<tr><td colspan="4">Não foi possível carregar.</td></tr>';if(msg)msg.textContent=e.message}
}
$("#revendedorForm")?.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.currentTarget,d=formData(f);setMsg(f,'Salvando...');
  try{
    await api('cadastrarRevendedor',d);
    f.reset();setMsg(f,'Revendedor cadastrado com sucesso.',true);toast('Revendedor cadastrado');
    await loadRevendedores();
  }catch(err){setMsg(f,err.message)}
});
$("#atualizarRevendedores")?.addEventListener('click',loadRevendedores);

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
