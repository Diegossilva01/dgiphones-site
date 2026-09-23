const API_URL="https://script.google.com/macros/s/AKfycbzuAvirygI5_NanIKnxua2Aep5gFPGRgUUvdl9VOA3j2dtjloUr_W0SAUu0TcojsHbV/exec";
const ETAPAS=['Recebido','Em manutenção','Aguardando peça','Pronto para retirada','Entregue'];
const DESCRICOES={
  'Recebido':'Seu aparelho foi recebido pela loja e está aguardando o início do atendimento.',
  'Em manutenção':'Seu aparelho está com a equipe técnica e o serviço está em andamento.',
  'Aguardando peça':'A manutenção está aguardando a chegada ou disponibilidade de uma peça.',
  'Pronto para retirada':'O serviço foi concluído e seu aparelho está pronto para retirada.',
  'Entregue':'A manutenção foi finalizada e o aparelho já foi entregue.'
};
const ICONES={'Recebido':'1','Em manutenção':'2','Aguardando peça':'3','Pronto para retirada':'✓','Entregue':'✓'};
const $=s=>document.querySelector(s);
function classeStatus(v){return 'status-'+String(v||'Recebido').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function parametros(){const p=new URLSearchParams(location.search);return{os:p.get('os')||'',chave:p.get('chave')||''}}
function mostrarErro(msg){$('#loadingCard').classList.add('hidden');$('#trackingContent').classList.add('hidden');$('#errorCard').classList.remove('hidden');$('#errorMessage').textContent=msg||'Confira se o link enviado pela loja está completo.'}
function renderTimeline(status){const atual=Math.max(0,ETAPAS.indexOf(status));$('#timeline').innerHTML=ETAPAS.map((etapa,i)=>{const done=i<atual,current=i===atual;return `<div class="step ${done?'done':''} ${current?'current '+classeStatus(etapa):''}"><div class="step-dot">${done?'✓':i+1}</div><strong>${esc(etapa)}</strong><small>${done?'Concluído':current?'Etapa atual':'Próxima etapa'}</small></div>`}).join('')}
function render(os){const status=ETAPAS.includes(os.status)?os.status:'Recebido',cls=classeStatus(status);$('#loadingCard').classList.add('hidden');$('#errorCard').classList.add('hidden');$('#trackingContent').classList.remove('hidden');$('#osNumero').textContent=os.idOS||'—';$('#statusBadge').className='status-badge '+cls;$('#statusBadge').textContent=status;$('#statusIcon').className='current-icon '+cls;$('#statusIcon').textContent=ICONES[status]||'•';$('#statusTitle').textContent=status;$('#statusDescription').textContent=DESCRICOES[status]||'Acompanhe o andamento da sua manutenção.';$('#aparelho').textContent=os.aparelho||'Não informado';$('#dataOS').textContent=os.dataOS||'—';$('#servico').textContent=os.servico||'Não informado';$('#atualizadoEm').textContent=os.atualizadoEm||'—';renderTimeline(status)}
async function carregar(){const {os,chave}=parametros();if(!os||!chave)return mostrarErro('Este link de acompanhamento está incompleto. Peça um novo link à loja.');const btn=$('#refreshBtn');if(btn)btn.disabled=true;try{const url=new URL(API_URL);url.searchParams.set('acao','acompanharOS');url.searchParams.set('idOS',os);url.searchParams.set('chave',chave);url.searchParams.set('t',Date.now());const r=await fetch(url,{cache:'no-store'});const j=await r.json();if(!j.sucesso)throw new Error(j.mensagem||'Não foi possível localizar esta OS.');render(j.ordem)}catch(err){mostrarErro(err.message)}finally{if(btn)btn.disabled=false}}
$('#refreshBtn')?.addEventListener('click',carregar);
carregar();
setInterval(()=>{if(!document.hidden)carregar()},60000);
