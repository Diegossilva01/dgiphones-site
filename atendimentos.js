(function(){
  let todos=[],visiveis=[];
  const get=id=>document.getElementById(id);
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normal=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const camposCotacao=[['Armazenamento','Armazenamento'],['Cor','Cor'],['Liga normalmente','Liga normalmente'],['Tela','Tela'],['Traseira','Traseira'],['Saúde da bateria','Saúde da bateria'],['Peças trocadas','Peças trocadas']];
  const camposManutencao=[['Reparos','Reparos solicitados'],['Detalhes','Detalhes informados']];
  const situacoes=['Novo','Em contato','Atendido','Celular comprado','Não fechou'];
  function telefoneWhatsapp(raw){
    let number=String(raw??'').replace(/\D/g,'');
    if(number.length===10||number.length===11)number='55'+number;
    return /^55\d{10,11}$/.test(number)?number:'';
  }
  function mensagem(lead){
    const nome=String(lead.nome||'').trim().split(' ')[0];
    return lead.tipo==='cotacao'
      ?`Olá${nome?', '+nome:''}! Recebemos sua cotação do ${lead.modelo||'iPhone'} pelo site. Posso falar com você sobre a avaliação?`
      :`Olá${nome?', '+nome:''}! Recebemos seu pedido de manutenção do ${lead.modelo||'celular'} pelo site. Como posso ajudar?`;
  }
  function detalhes(lead){
    const pairs=lead.tipo==='cotacao'?camposCotacao:camposManutencao;
    return pairs.filter(([key])=>String(lead.dados?.[key]??'').trim()).map(([key,label])=>`<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(lead.dados[key])}</strong></div>`).join('');
  }
  function cartao(lead,index){
    const telefone=telefoneWhatsapp(lead.whatsapp),statusOptions=situacoes.filter(s=>lead.tipo==='cotacao'||s!=='Celular comprado').map(s=>`<option value="${s}"${lead.status===s?' selected':''}>${s}</option>`).join('');
    const link=telefone?`<a class="lead-whatsapp" href="https://wa.me/${telefone}?text=${encodeURIComponent(mensagem(lead))}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> Chamar no WhatsApp</a>`:'<span class="lead-no-phone">WhatsApp não informado ou inválido</span>';
    return `<article class="lead-card" data-index="${index}">
      <div class="lead-head"><div><span class="lead-type">${lead.tipo==='cotacao'?'Cotação de iPhone':'Pedido de manutenção'}</span><h3>${escapeHtml(lead.nome||'Cliente sem nome')}</h3><p>${escapeHtml(lead.data)} · ${escapeHtml(lead.id)}</p></div><span class="lead-status">${escapeHtml(lead.status)}</span></div>
      <div class="lead-data"><div><small>WhatsApp</small><strong>${escapeHtml(lead.whatsapp||'—')}</strong></div><div><small>Modelo</small><strong>${escapeHtml(lead.modelo||'—')}</strong></div>${detalhes(lead)}</div>
      <div class="lead-actions">${link}<label>Situação<select class="lead-select">${statusOptions}</select></label></div>
      <label class="lead-note-label">Observação interna<textarea class="lead-note" rows="2" maxlength="2000" placeholder="Ex.: Cliente recebeu proposta; aguardando resposta.">${escapeHtml(lead.observacao)}</textarea></label>
      <div class="lead-footer"><span>${lead.atualizadoPor?`Atualizado por ${escapeHtml(lead.atualizadoPor)} · ${escapeHtml(lead.atualizadoEm)}`:'Ainda sem atendimento registrado'}</span><button class="secondary lead-save" type="button">Salvar atendimento</button></div>
    </article>`;
  }
  function render(){
    get('leadsTotal').textContent=`${todos.length} solicitações`;
    get('leadsNovos').textContent=`${todos.filter(x=>x.status==='Novo').length} novos`;
    get('leadsComprados').textContent=`${todos.filter(x=>x.status==='Celular comprado').length} celulares comprados`;
    const tipo=get('atendimentosTipo').value,status=get('atendimentosStatus').value,query=normal(get('atendimentosBusca').value.trim());
    visiveis=todos.filter(x=>(!tipo||x.tipo===tipo)&&(!status||x.status===status)&&(!query||normal([x.nome,x.whatsapp,x.modelo,x.id,x.dados?.Reparos].join(' ')).includes(query)));
    get('atendimentosLista').innerHTML=visiveis.length?visiveis.map(cartao).join(''):'<p class="leads-empty">Nenhuma solicitação encontrada neste filtro.</p>';
  }
  window.carregarAtendimentos=async function(){
    const message=get('atendimentosMsg');message.textContent='Carregando solicitações...';
    try{const result=await api('listarLeadsSite');todos=result.leads||[];render();message.textContent=''}
    catch(err){message.textContent=err.message;get('atendimentosLista').innerHTML=''}
  };
  get('atualizarAtendimentos').addEventListener('click',window.carregarAtendimentos);
  for(const id of ['atendimentosTipo','atendimentosStatus','atendimentosBusca'])get(id).addEventListener(id==='atendimentosBusca'?'input':'change',render);
  get('atendimentosLista').addEventListener('click',async event=>{
    const button=event.target.closest('.lead-save');if(!button)return;
    const card=button.closest('.lead-card'),lead=visiveis[Number(card?.dataset.index)];if(!lead)return;
    const status=card.querySelector('.lead-select').value,observacao=card.querySelector('.lead-note').value;
    button.disabled=true;button.textContent='Salvando...';
    try{
      const response=await api('atualizarLeadSite',{tipo:lead.tipo,id:lead.id,status,observacao});
      const pos=todos.findIndex(x=>x.tipo===lead.tipo&&x.id===lead.id);
      if(pos>=0)todos[pos]=response.lead;
      render();get('atendimentosMsg').textContent='Atendimento salvo.';
    }catch(err){get('atendimentosMsg').textContent=err.message;button.disabled=false;button.textContent='Salvar atendimento'}
  });
})();
