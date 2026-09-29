(function(){
  let todos=[],visiveis=[],aba='Novo';
  const get=id=>document.getElementById(id);
  const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normal=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const camposCotacao=[['Armazenamento','Armazenamento'],['Cor','Cor'],['Liga normalmente','Liga normalmente'],['Tela','Tela'],['Traseira','Traseira'],['Saúde da bateria','Saúde da bateria'],['Peças trocadas','Peças trocadas']];
  const camposManutencao=[['Reparos','Reparos solicitados'],['Detalhes','Detalhes informados']];
  const situacoes=['Novo','Em contato','Atendido','Celular comprado','Oferta recusada','Serviço finalizado'];
  function telefoneWhatsapp(raw){
    let number=String(raw??'').replace(/\D/g,'');
    if(number.length===10||number.length===11)number='55'+number;
    return /^55\d{10,11}$/.test(number)?number:'';
  }
  function mensagem(lead){
    const nome=String(lead.nome||'').trim().split(' ')[0];
    return lead.tipo==='cotacao'
      ?`Olá${nome?' '+nome:''}, eu sou a Yasmin da CellTech. Vi que você tem interesse em vender seu ${lead.modelo||'celular'}. Você já recebeu alguma proposta?`
      :`Olá${nome?' '+nome:''}, eu sou a Yasmin da CellTech. Vi seu pedido de manutenção do ${lead.modelo||'celular'}. Pode me contar mais sobre o problema?`;
  }
  function detalhes(lead){
    const pairs=lead.tipo==='cotacao'?camposCotacao:camposManutencao;
    return pairs.filter(([key])=>String(lead.dados?.[key]??'').trim()).map(([key,label])=>`<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(lead.dados[key])}</strong></div>`).join('');
  }
  function cartao(lead,index){
    const telefone=telefoneWhatsapp(lead.whatsapp),statusOptions=situacoes.filter(s=>lead.tipo==='cotacao'?s!=='Serviço finalizado':s!=='Celular comprado').map(s=>`<option value="${s}"${lead.status===s?' selected':''}>${s}</option>`).join('');
    const link=telefone?`<a class="lead-whatsapp" href="https://wa.me/${telefone}?text=${encodeURIComponent(mensagem(lead))}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> Chamar no WhatsApp</a>`:'<span class="lead-no-phone">WhatsApp não informado ou inválido</span>';
    const osButton=lead.tipo==='manutencao'?'<button type="button" class="secondary lead-find-os"><i class="fa-solid fa-file-medical"></i> Consultar OS do cliente</button>':'';
    return `<article class="lead-card" data-index="${index}">
      <div class="lead-head"><div><span class="lead-type">${lead.tipo==='cotacao'?'Cotação de iPhone':'Pedido de manutenção'}</span><h3>${escapeHtml(lead.nome||'Cliente sem nome')}</h3><p>${escapeHtml(lead.data)} · ${escapeHtml(lead.id)}</p></div><span class="lead-status">${escapeHtml(lead.status)}</span></div>
      <div class="lead-data"><div><small>WhatsApp</small><strong>${escapeHtml(lead.whatsapp||'—')}</strong></div><div><small>Modelo</small><strong>${escapeHtml(lead.modelo||'—')}</strong></div>${detalhes(lead)}</div>
      <div class="lead-actions">${link}${osButton}<label>Situação<select class="lead-select">${statusOptions}</select></label></div>
      <div class="lead-os-results" hidden></div>
      <label class="lead-note-label">Observação interna<textarea class="lead-note" rows="2" maxlength="2000" placeholder="Ex.: Cliente recebeu proposta; aguardando resposta.">${escapeHtml(lead.observacao)}</textarea></label>
      <div class="lead-footer"><span>${lead.atualizadoPor?`Atualizado por ${escapeHtml(lead.atualizadoPor)} · ${escapeHtml(lead.atualizadoEm)}`:'Ainda sem atendimento registrado'}</span><button class="secondary lead-save" type="button">Salvar atendimento</button></div>
    </article>`;
  }
  function render(){
    get('leadsTabs').querySelectorAll('.lead-tab').forEach(tab=>{
      const selected=tab.dataset.status===aba;
      tab.classList.toggle('active',selected);tab.setAttribute('aria-pressed',String(selected));
      const key=tab.dataset.status||'todos',count=key==='todos'?todos.length:todos.filter(x=>x.status===key).length;
      tab.querySelector('strong').textContent=count;
    });
    const tipo=get('atendimentosTipo').value,query=normal(get('atendimentosBusca').value.trim());
    visiveis=todos.filter(x=>(!aba||x.status===aba)&&(!tipo||x.tipo===tipo)&&(!query||normal([x.nome,x.whatsapp,x.modelo,x.id,x.dados?.Reparos].join(' ')).includes(query)));
    get('atendimentosLista').innerHTML=visiveis.length?visiveis.map(cartao).join(''):`<p class="leads-empty">${aba==='Novo'?'Nenhum contato novo aguardando atendimento.':'Nenhuma solicitação encontrada neste filtro.'}</p>`;
  }
  window.carregarAtendimentos=async function(){
    const message=get('atendimentosMsg');message.textContent='Carregando solicitações...';
    try{const result=await api('listarLeadsSite');todos=result.leads||[];render();message.textContent=''}
    catch(err){message.textContent=err.message;get('atendimentosLista').innerHTML=''}
  };
  get('atualizarAtendimentos').addEventListener('click',window.carregarAtendimentos);
  get('leadsTabs').addEventListener('click',event=>{const button=event.target.closest('.lead-tab');if(!button)return;aba=button.dataset.status;render()});
  for(const id of ['atendimentosTipo','atendimentosBusca'])get(id).addEventListener(id==='atendimentosBusca'?'input':'change',render);
  get('atendimentosLista').addEventListener('click',async event=>{
    const whatsapp=event.target.closest('.lead-whatsapp');
    if(whatsapp){
      const card=whatsapp.closest('.lead-card'),lead=visiveis[Number(card?.dataset.index)];
      if(lead?.status==='Novo'){
        try{const response=await api('atualizarLeadSite',{tipo:lead.tipo,id:lead.id,status:'Em contato',observacao:card.querySelector('.lead-note').value});const pos=todos.findIndex(x=>x.tipo===lead.tipo&&x.id===lead.id);if(pos>=0)todos[pos]=response.lead;render()}
        catch(err){get('atendimentosMsg').textContent=`WhatsApp aberto; não foi possível atualizar a situação: ${err.message}`}
      }
      return;
    }
    const find=event.target.closest('.lead-find-os');
    if(find){
      const card=find.closest('.lead-card'),lead=visiveis[Number(card?.dataset.index)],results=card.querySelector('.lead-os-results');
      if(!lead)return;find.disabled=true;results.hidden=false;results.textContent='Buscando OS pelo telefone...';
      try{
        const response=await api('localizarOSContato',{telefone:lead.whatsapp});
        results.innerHTML=response.ordens.length?`<strong>OS encontradas:</strong> ${response.ordens.map(os=>`<button type="button" class="lead-open-os" data-os="${escapeHtml(os.idOS)}">${escapeHtml(os.idOS)} · ${escapeHtml(os.aparelho)} · ${escapeHtml(os.status)}</button>`).join('')}`:'Nenhuma OS encontrada com este telefone.';
      }catch(err){results.textContent=err.message}finally{find.disabled=false}
      return;
    }
    const open=event.target.closest('.lead-open-os');
    if(open){
      if(!ativarPagina('os-notas'))return;
      const search=get('osBusca');if(search)search.value=open.dataset.os;
      ativarDocTab('consultar-os');window.scrollTo({top:0,behavior:'smooth'});
      return;
    }
    const button=event.target.closest('.lead-save');if(!button)return;
    const card=button.closest('.lead-card'),lead=visiveis[Number(card?.dataset.index)];if(!lead)return;
    const status=card.querySelector('.lead-select').value,observacao=card.querySelector('.lead-note').value;
    button.disabled=true;button.textContent='Salvando...';
    try{
      const response=await api('atualizarLeadSite',{tipo:lead.tipo,id:lead.id,status,observacao});
      const pos=todos.findIndex(x=>x.tipo===lead.tipo&&x.id===lead.id);
      if(pos>=0)todos[pos]=response.lead;
      render();get('atendimentosMsg').textContent=status==='Novo'?'Contato devolvido aos novos.':`Atendimento salvo em “${status}”.`;
    }catch(err){get('atendimentosMsg').textContent=err.message;button.disabled=false;button.textContent='Salvar atendimento'}
  });
})();
