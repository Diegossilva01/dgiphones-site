// COLE A URL DA NOVA IMPLANTAÇÃO DO GOOGLE APPS SCRIPT AQUI.
const SISTEMA_API_URL = "https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec";

const state={token:localStorage.getItem("ct_token")||"",user:null,chart:null};
const $=s=>document.querySelector(s); const $$=s=>document.querySelectorAll(s);
const money=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const today=()=>new Date().toISOString().slice(0,10);

async function api(action,data={}){
  if(SISTEMA_API_URL.includes("https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec")) throw new Error("Configure a URL do Google Apps Script no arquivo funcionario.js.");
  const r=await fetch(SISTEMA_API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,token:state.token,...data})});
  const j=await r.json(); if(!j.success) throw new Error(j.message||"Não foi possível concluir."); return j;
}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function validCPF(cpf){cpf=cpf.replace(/\D/g,"");if(cpf.length!==11||/^(\d)\1+$/.test(cpf))return false;let s=0;for(let i=0;i<9;i++)s+=+cpf[i]*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==+cpf[9])return false;s=0;for(let i=0;i<10;i++)s+=+cpf[i]*(11-i);d=(s*10)%11;if(d===10)d=0;return d===+cpf[10]}
function parseMoney(v){return Number(String(v).replace(/[^\d,.-]/g,"").replace(/\./g,"").replace(",","."))||0}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function setMsg(form,msg,ok=false){const e=form.querySelector(".form-message");e.textContent=msg;e.classList.toggle("success",ok)}
function showApp(){ $("#loginScreen").classList.add("hidden");$("#app").classList.remove("hidden");$("#usuarioLogado").textContent=`${state.user.nome} • ${state.user.perfil}`;$$('.admin-only').forEach(e=>e.style.display=state.user.perfil==='admin'?'':'none');loadDashboard() }
function logout(){localStorage.removeItem("ct_token");location.reload()}

$("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const m=$("#loginMsg");m.textContent="Entrando...";try{const j=await api("login",{usuario:$("#loginUsuario").value,senha:$("#loginSenha").value});state.token=j.token;state.user=j.usuario;localStorage.setItem("ct_token",state.token);showApp()}catch(err){m.textContent=err.message}});
$("#logoutBtn").onclick=logout;$("#menuBtn").onclick=()=>$(".sidebar").classList.toggle("open");
$$('.nav-btn').forEach(btn=>btn.onclick=()=>{if(btn.style.display==='none')return;$$('.nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$$('.page').forEach(p=>p.classList.remove('active'));$(`#page-${btn.dataset.page}`).classList.add('active');$("#tituloPagina").textContent=btn.textContent.trim();$(".sidebar").classList.remove("open");if(btn.dataset.page==='historico')loadHistorico();if(btn.dataset.page==='dashboard')loadDashboard()});

$$('.cpf').forEach(i=>i.addEventListener('input',()=>{let v=i.value.replace(/\D/g,'').slice(0,11);i.value=v.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')}));
$$('.money').forEach(i=>i.addEventListener('blur',()=>{const v=parseMoney(i.value);if(v)i.value=money(v)}));
$$('input[type=date]').forEach(i=>{if(!i.value)i.value=today()});

$("#vendaForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f);if(!validCPF(d.cpf))return setMsg(f,"CPF inválido.");d.valor=parseMoney(d.valor);if(d.valor<=0)return setMsg(f,"Informe um valor válido.");setMsg(f,"Salvando...");try{await api("salvarVenda",{dados:d});f.reset();f.querySelector('[name=data]').value=today();setMsg(f,"Venda salva com sucesso.",true);toast("Venda cadastrada") }catch(err){setMsg(f,err.message)}});
$("#compraForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,d=formData(f);if(!validCPF(d.cpf))return setMsg(f,"CPF inválido.");d.valor=parseMoney(d.valor);if(d.valor<=0)return setMsg(f,"Informe um valor válido.");setMsg(f,"Salvando...");try{await api("salvarCompra",{dados:d});f.reset();f.querySelector('[name=data]').value=today();setMsg(f,"Compra salva com sucesso.",true);toast("Compra cadastrada") }catch(err){setMsg(f,err.message)}});
$("#usuarioForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;setMsg(f,"Salvando...");try{await api("criarFuncionario",{dados:formData(f)});f.reset();setMsg(f,"Funcionário cadastrado.",true)}catch(err){setMsg(f,err.message)}});

function dashDates(){const p=$("#dashPeriodo").value,n=new Date();let ini,fim=today();if(p==='hoje')ini=fim;else if(p==='mes')ini=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;else if(p==='ano')ini=`${n.getFullYear()}-01-01`;else{ini=$("#dashInicio").value;fim=$("#dashFim").value}return{inicio:ini,fim}}
async function loadDashboard(){try{const j=await api("dashboard",dashDates());$("#kpiFaturamento").textContent=money(j.resumo.faturamento);$("#kpiVendas").textContent=j.resumo.vendas;$("#kpiTicket").textContent=money(j.resumo.ticketMedio);$("#kpiCompras").textContent=money(j.resumo.compras);$("#kpiLucro").textContent=money(j.resumo.lucro);if(state.chart)state.chart.destroy();state.chart=new Chart($("#salesChart"),{type:'bar',data:{labels:j.grafico.map(x=>x.data),datasets:[{label:'Faturamento',data:j.grafico.map(x=>x.valor)}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}})}catch(e){toast(e.message)}}
$("#atualizarDash").onclick=loadDashboard;

async function loadHistorico(){const body=$("#histBody"),head=$("#histHead"),tipo=$("#histTipo").value;body.innerHTML='<tr><td>Carregando...</td></tr>';try{const j=await api("listar",{tipo,inicio:$("#histInicio").value,fim:$("#histFim").value,busca:$("#histBusca").value});const admin=state.user.perfil==='admin';if(tipo==='vendas'){head.innerHTML='<tr><th>Data</th><th>Cliente</th><th>CPF</th><th>Produto</th><th>IMEI</th><th>Pagamento</th><th>Valor</th><th>Funcionário</th><th>Ações</th></tr>';body.innerHTML=j.registros.map(r=>`<tr><td>${r.data}</td><td>${r.nomeCliente}</td><td>${r.cpf}</td><td>${r.produto}</td><td>${r.imei}</td><td>${r.pagamento}</td><td>${money(r.valor)}</td><td>${r.funcionario}</td><td>${admin?`<button class="delete-btn" onclick="excluirRegistro('vendas','${r.id}')"><i class="fa-solid fa-trash"></i></button>`:''}</td></tr>`).join('')}else{head.innerHTML='<tr><th>Data</th><th>Vendedor</th><th>CPF</th><th>Modelo</th><th>IMEI</th><th>Condição</th><th>Valor pago</th><th>Funcionário</th><th>Ações</th></tr>';body.innerHTML=j.registros.map(r=>`<tr><td>${r.data}</td><td>${r.nomePessoa}</td><td>${r.cpf}</td><td>${r.modelo}</td><td>${r.imei}</td><td>${r.condicao}</td><td>${money(r.valor)}</td><td>${r.funcionario}</td><td>${admin?`<button class="delete-btn" onclick="excluirRegistro('compras','${r.id}')"><i class="fa-solid fa-trash"></i></button>`:''}</td></tr>`).join('')}if(!j.registros.length)body.innerHTML='<tr><td colspan="9">Nenhum registro encontrado.</td></tr>'}catch(e){body.innerHTML='';$("#histMsg").textContent=e.message}}
window.excluirRegistro=async(tipo,id)=>{if(!confirm('Tem certeza que deseja excluir este registro? Essa ação ficará registrada.'))return;try{await api('excluir',{tipo,id});toast('Registro excluído');loadHistorico()}catch(e){toast(e.message)}};
$("#buscarHistorico").onclick=loadHistorico;$("#histTipo").onchange=loadHistorico;

(async()=>{if(!state.token)return;try{const j=await api('sessao');state.user=j.usuario;showApp()}catch(e){localStorage.removeItem('ct_token')}})();
