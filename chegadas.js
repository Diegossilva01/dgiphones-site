// Pendências geradas pela data atual; lançamentos só são gravados após confirmação.
(() => {
  const page=$('#page-chegadas'),form=$('#chegadaForm');if(!page||!form)return;
  const dates=ChegadasDias,month=$('#chegadasMes'),filter=$('#chegadasFuncionario');
  const body=$('#chegadasPendentesBody'),history=$('#chegadasBody');
  const drafts=new Map();let equipe=[],registros=[],mesesPagos=[],pendentes=[],editando=null,request=0,busy=false,loading=false,loadedDay='';
  const todaySP=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const duration=n=>`${Math.floor(n/60)}h ${n%60}min`;
  const field=n=>form.elements.namedItem(n);
  const selectedPeople=()=>equipe.filter(f=>!filter.value||f.id===filter.value);
  const paid=r=>mesesPagos.some(p=>p.idFuncionario===r.idFuncionario&&p.mes===r.data.slice(0,7));
  const draft=p=>drafts.get(p.id)||{chegada:'',abonado:false,observacao:''};
  const basis=p=>p.anterior||p.funcionario;
  function preview(p,d){return dates.calculation({previsto:p.previsto,chegada:d.chegada,salario:basis(p).salario,horasMensais:basis(p).horasMensais||220,toleranciaMinutos:basis(p).toleranciaMinutos??10,abonado:d.abonado})}
  function resultText(value,d){
    if(!value)return 'Informe a chegada';
    return `${value.atrasado?'Atraso':'Dentro da tolerância'}: ${duration(value.atraso)} • ${money(value.desconto)}${d.abonado?' • Abonado':''}`;
  }
  function setBusy(value){
    busy=value;
    for(const el of page.querySelectorAll('input,select,button')){
      if(value){el.dataset.busyDisabled=String(el.disabled);el.disabled=true}
      else if(el.dataset.busyDisabled!==undefined){el.disabled=el.dataset.busyDisabled==='true';delete el.dataset.busyDisabled}
    }
  }
  function closeEdit(){editando=null;form.reset();$('#chegadaEdicaoPanel').classList.add('hidden');setMsg(form,'')}
  function render(){
    const inicio=dates.fifthBusinessDay(month.value),fim=todaySP(),people=selectedPeople();
    const all=registros.filter(r=>!filter.value||r.idFuncionario===filter.value),filled=all.filter(r=>!r.cancelado);
    pendentes=dates.pending({inicio,fim,funcionarios:people,registros:all,mesesPagos,incluirFolgas:$('#chegadasIncluirFolgas').checked});
    $('#chegadasPeriodo').textContent=`${dataBR(inicio)} (5º dia útil de ${month.value.split('-').reverse().join('/')}) até ${dataBR(fim)} • ${people.length} funcionário(s).`;
    $('#chegadasPendentesQtd').textContent=pendentes.length;$('#chegadasPreenchidasQtd').textContent=filled.length;
    body.innerHTML=pendentes.map((p,i)=>{const d=draft(p),value=preview(p,d),f=p.funcionario;
      return `<tr data-pending="${i}"><td><strong>${esc(dataBR(p.data))}</strong><br><small>${esc(new Date(p.data+'T12:00:00Z').toLocaleDateString('pt-BR',{weekday:'long',timeZone:'UTC'}))}${p.folga?' • folga prevista':''}</small></td><td>${esc(f.nome)}</td><td>${p.previsto?`<strong>${esc(p.previsto)}</strong><br><small>Tolerância: ${Number(basis(p).toleranciaMinutos??10)} min</small>`:'<span class="arrival-warning">Cadastre o horário em Usuários</span>'}${p.anterior?'<br><small>Registro cancelado: exige justificativa para reativar.</small>':''}</td><td><div class="arrival-quick-time"><input type="time" data-field="chegada" aria-label="Chegada de ${esc(f.nome)} em ${esc(dataBR(p.data))}" value="${esc(d.chegada)}" ${!p.previsto?'disabled':''}><button type="button" class="arrival-on-time" data-ontime="${i}" aria-label="Marcar ${esc(f.nome)} no horário previsto, ${esc(p.previsto)}, em ${esc(dataBR(p.data))}" ${!p.previsto?'disabled':''}>✓ No horário</button></div></td><td><span data-result class="arrival-inline-result ${value?.atrasado?'late':value?'ontime':''}">${esc(resultText(value,d))}</span></td><td><label class="arrival-checkbox"><input type="checkbox" data-field="abonado" ${d.abonado?'checked':''}> Abonar atraso</label><input type="text" data-field="observacao" maxlength="1000" aria-label="Observação de ${esc(f.nome)} em ${esc(dataBR(p.data))}" value="${esc(d.observacao)}" placeholder="${p.anterior?'Justificativa da reativação':'Observação (obrigatória para abonar)'}"></td><td><button type="button" class="primary compact" data-save="${i}" ${!p.previsto?'disabled':''}>Salvar dia</button></td></tr>`;
    }).join('')||'<tr><td colspan="7">Todos os dias deste período estão preenchidos ou pertencem a meses já pagos.</td></tr>';
    $('#salvarChegadasPreenchidas').disabled=!pendentes.length;
    history.innerHTML=filled.map((r,i)=>{const late=Number(r.atrasoMinutos)>Number(r.toleranciaMinutos??5),label=late?'Em atraso':r.atrasoMinutos?'Dentro da tolerância':'No horário';
      return `<tr class="${late?'arrival-row-late':'arrival-row-ontime'}" data-record="${i}"><td><strong>${esc(dataBR(r.data))}</strong></td><td>${esc(r.nome)}</td><td>${esc(r.previsto)}</td><td><strong>${esc(r.chegada)}</strong></td><td><strong>${label}</strong><br><small>${duration(r.atrasoMinutos||0)}${r.abonado?' • Abonado':''}${paid(r)?' • Salário do mês já pago':''}</small></td><td><strong>${money(r.desconto||0)}</strong></td><td>${esc(r.observacao||'—')}</td><td><div class="actions"><button type="button" class="secondary compact" data-edit="${esc(r.id)}" ${paid(r)?'disabled':''}>Corrigir</button><button type="button" class="secondary compact" data-cancel="${esc(r.id)}" ${paid(r)?'disabled':''}>Cancelar</button><button type="button" class="secondary compact" data-history="${esc(r.id)}">Histórico</button></div></td></tr>`;
    }).join('')||'<tr><td colspan="8">Nenhum dia preenchido neste período.</td></tr>';
    $('#chegadasResumo').textContent=`${filled.length} dia(s) registrado(s) • Atraso total: ${duration(filled.reduce((s,r)=>s+Number(r.atrasoMinutos||0),0))} • Desconto no período: ${money(filled.reduce((s,r)=>s+Number(r.desconto||0),0))}.`;
  }
  async function load(){
    if(!isAdmin()||busy||loading)return;
    const seq=++request;if(!month.value)month.value=dates.initialMonth(todaySP());month.max=todaySP().slice(0,7);
    const inicio=dates.fifthBusinessDay(month.value),fim=todaySP();
    if(inicio>fim){pendentes=[];registros=[];body.innerHTML='<tr><td colspan="7">O 5º dia útil desse mês ainda não chegou. Selecione um mês anterior.</td></tr>';history.innerHTML='<tr><td colspan="8">Período ainda não iniciado.</td></tr>';$('#salvarChegadasPreenchidas').disabled=true;$('#chegadasPendentesQtd').textContent='0';$('#chegadasPreenchidasQtd').textContent='0';$('#chegadasResumo').textContent='';$('#chegadasPeriodo').textContent='';return}
    const previous=filter.value;loading=true;pendentes=[];$('#salvarChegadasPreenchidas').disabled=true;
    for(const el of [month,filter,$('#chegadasIncluirFolgas'),$('#atualizarChegadas')])el.disabled=true;
    body.innerHTML='<tr><td colspan="7">Carregando dias...</td></tr>';history.innerHTML='<tr><td colspan="8">Carregando registros...</td></tr>';$('#chegadasMsg').textContent='';
    try{
      const [users,data]=await Promise.all([api('listarFuncionarios'),api('listarChegadas',{inicio,fim})]);if(seq!==request)return;
      equipe=(users.funcionarios||[]).filter(f=>!['administrador','revendedor'].includes(String(f.perfil).toLowerCase()));
      filter.innerHTML='<option value="">Todos os funcionários</option>'+equipe.map(f=>`<option value="${esc(f.id)}">${esc(f.nome)}${f.status==='Inativo'?' (inativo)':''}</option>`).join('');filter.value=previous;
      registros=data.registros||[];mesesPagos=data.mesesPagos||[];loadedDay=fim;render();
    }catch(e){if(seq!==request)return;pendentes=[];body.innerHTML='<tr><td colspan="7">Não foi possível carregar os dias. Clique em Atualizar.</td></tr>';history.innerHTML='<tr><td colspan="8">Não foi possível carregar os registros.</td></tr>';$('#chegadasMsg').textContent=e.message;$('#salvarChegadasPreenchidas').disabled=true}
    finally{if(seq===request){loading=false;for(const el of [month,filter,$('#chegadasIncluirFolgas'),$('#atualizarChegadas')])el.disabled=false}}
  }
  body.addEventListener('input',e=>{
    const tr=e.target.closest('[data-pending]'),name=e.target.dataset.field;if(!tr||!name||busy)return;
    const p=pendentes[Number(tr.dataset.pending)],d={...draft(p),[name]:name==='abonado'?e.target.checked:e.target.value};drafts.set(p.id,d);
    const value=preview(p,d),result=tr.querySelector('[data-result]');result.textContent=resultText(value,d);result.className=`arrival-inline-result ${value?.atrasado?'late':value?'ontime':''}`;
  });
  function validate(p,d){
    const f=basis(p);if(!p.previsto)throw Error(`Defina a entrada prevista de ${p.funcionario.nome} na aba Usuários.`);
    if(!preview(p,d)||!Number.isFinite(Number(f.salario))||Number(f.salario)<=0||Number(f.horasMensais||220)<=0)throw Error(`Confira a chegada, o salário e a jornada de ${p.funcionario.nome} em ${dataBR(p.data)}.`);
    if((d.abonado||p.anterior)&&!d.observacao.trim())throw Error(`Informe a justificativa de ${p.funcionario.nome} em ${dataBR(p.data)}.`);
  }
  async function savePending(items){
    if(busy||loading)return;const msg=$('#chegadasPendentesMsg');msg.textContent='';
    const chosen=items.map(p=>({p,d:{...draft(p)}}));
    if(!chosen.length){msg.textContent='Informe pelo menos um horário de chegada para salvar.';return}
    try{for(const {p,d} of chosen)validate(p,d)}catch(e){msg.textContent=e.message;return}
    setBusy(true);
    let saved=0,error='';
    try{
      for(const {p,d} of chosen){
        try{const result=await api('salvarChegada',{idFuncionario:p.funcionario.id,data:p.data,previsto:p.previsto,chegada:d.chegada,abonado:d.abonado,observacao:d.observacao,versao:p.anterior?.versao||p.anterior?.atualizadoEm||''});registros=registros.filter(r=>r.id!==result.registro.id);registros.push(result.registro);drafts.delete(p.id);saved++;msg.textContent=`Salvando: ${saved} de ${chosen.length}...`}
        catch(e){error=`${p.funcionario.nome} • ${dataBR(p.data)}: ${e.message}`;break}
      }
    }finally{setBusy(false);registros.sort((a,b)=>b.data.localeCompare(a.data)||a.nome.localeCompare(b.nome));render()}
    msg.textContent=`${saved} dia(s) salvo(s).${error?' '+error+' Os campos ainda não salvos foram preservados.':''}`;
  }
  body.addEventListener('click',e=>{
    if(busy||loading)return;
    const quick=e.target.closest('[data-ontime]');
    if(quick){
      const p=pendentes[Number(quick.dataset.ontime)];if(!p?.previsto||quick.disabled)return;
      const tr=quick.closest('[data-pending]'),input=tr.querySelector('[data-field=chegada]');
      drafts.set(p.id,{...draft(p),abonado:false});tr.querySelector('[data-field=abonado]').checked=false;
      input.value=p.previsto;input.dispatchEvent(new Event('input',{bubbles:true}));return;
    }
    const b=e.target.closest('[data-save]');if(b)savePending([pendentes[Number(b.dataset.save)]]);
  });
  $('#salvarChegadasPreenchidas').addEventListener('click',()=>savePending(pendentes.filter(p=>draft(p).chegada)));
  function edit(r){
    if(paid(r)){ $('#chegadasMsg').textContent='Reabra o salário deste mês em Pagamentos antes de corrigir a chegada.';return }
    editando=r;field('idFuncionario').value=r.idFuncionario;field('data').value=r.data;field('previsto').value=r.previsto;field('chegada').value=r.chegada;field('tratamento').value=r.abonado?'abonar':'descontar';field('observacao').value='';
    $('#chegadaEdicaoTitulo').textContent=`${r.nome} • ${dataBR(r.data)}`;$('#chegadaEdicaoPanel').classList.remove('hidden');setMsg(form,'Informe a justificativa da correção.');editPreview();$('#chegadaEdicaoPanel').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function editPreview(){if(!editando)return;const d={abonado:field('tratamento').value==='abonar'},value=dates.calculation({...editando,previsto:field('previsto').value,chegada:field('chegada').value,...d});$('#chegadaCalculo').textContent=resultText(value,d)}
  form.addEventListener('input',editPreview);
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!editando||busy)return;const r=editando;
    const payload={idFuncionario:r.idFuncionario,data:r.data,previsto:field('previsto').value,chegada:field('chegada').value,abonado:field('tratamento').value==='abonar',observacao:field('observacao').value,versao:r.versao||r.atualizadoEm};setBusy(true);
    try{const result=await api('salvarChegada',payload);registros=registros.map(x=>x.id===r.id?result.registro:x);closeEdit();render();$('#chegadasMsg').textContent='Chegada corrigida.'}catch(e){setMsg(form,e.message)}finally{setBusy(false)}
  });
  history.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b||busy)return;
    const id=b.dataset.edit||b.dataset.cancel||b.dataset.history,r=registros.find(x=>x.id===id);if(!r)return;
    if(b.dataset.edit){edit(r);return}
    if(b.dataset.history){alert([r,...(r.historico||[]).slice().reverse()].map(x=>`${x.atualizadoPor} • ${new Date(x.atualizadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}\nPrevisto ${x.previsto} / chegada ${x.chegada} • ${money(x.cancelado?0:x.desconto)}${x.cancelado?' • Cancelado':x.abonado?' • Abonado':''}\n${x.observacao||'Sem observação'}`).join('\n\n'));return}
    if(b.dataset.cancel){const observacao=prompt('Justificativa para cancelar esta chegada:');if(!observacao?.trim())return;try{const result=await api('salvarChegada',{idFuncionario:r.idFuncionario,data:r.data,previsto:r.previsto,chegada:r.chegada,abonado:r.abonado,cancelado:true,observacao,versao:r.versao||r.atualizadoEm});registros=registros.map(x=>x.id===r.id?result.registro:x);if(editando?.id===r.id)closeEdit();render();$('#chegadasMsg').textContent='Registro cancelado. O dia voltou para a lista de preenchimento.'}catch(e){$('#chegadasMsg').textContent=e.message}}
  });
  $('#cancelarEdicaoChegada').addEventListener('click',closeEdit);
  month.addEventListener('change',()=>{closeEdit();load()});filter.addEventListener('change',()=>{closeEdit();if(!loading)render()});$('#chegadasIncluirFolgas').addEventListener('change',()=>{if(!loading)render()});$('#atualizarChegadas').addEventListener('click',load);
  $('.nav-btn[data-page="chegadas"]').addEventListener('click',()=>{if(isAdmin())load()});
  function nextDay(){if(isAdmin()&&!busy&&page.classList.contains('active')&&loadedDay&&loadedDay!==todaySP())load()}
  window.addEventListener('focus',nextDay);document.addEventListener('visibilitychange',()=>{if(!document.hidden)nextDay()});setInterval(nextDay,60000);
})();


