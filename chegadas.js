// Controle de chegadas disponível apenas no painel administrativo.
(() => {
  const form=$('#chegadaForm');if(!form)return;
  let registros=[],equipe=[],editando=null,request=0;
  let calendarMonth="",calendarRecords=[],calendarRequest=0,calendarLoading=false,calendarError="";
  const duration=n=>`${Math.floor(n/60)}h ${n%60}min`;
  const spToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const field=name=>form.elements.namedItem(name);
  function reset(){form.reset();editando=null;field('idFuncionario').disabled=false;field('data').disabled=false;field('data').value=spToday();field('data').max=spToday();setMsg(form,'');preview();calendarMonth=spToday().slice(0,7);syncDate();refreshCalendar()}
  function expected(){
    if(editando)return;
    const f=equipe.find(x=>x.id===field('idFuncionario').value),day=new Date(`${field('data').value}T12:00:00`).getDay();
    field('previsto').value=(day===6?f?.horarioSabado||f?.horarioEntrada:f?.horarioEntrada)||'';preview();
  }
  function preview(){
    const f=equipe.find(x=>x.id===field('idFuncionario').value),base=editando||f;
    const p=field('previsto').value,a=field('chegada').value,el=$('#chegadaCalculo');
    if(!base||!p||!a){el.textContent='Configure o horário previsto e informe a chegada para conferir o cálculo.';return}
    const mins=v=>Number(v.slice(0,2))*60+Number(v.slice(3)),atraso=Math.max(0,mins(a)-mins(p)),tolerancia=Number(base.toleranciaMinutos??5),descontar=field('tratamento').value!=='abonar'&&atraso>tolerancia?atraso:0;
    const salario=Number(base.salario||0),horas=Number(base.horasMensais||220);
    el.textContent=`Atraso: ${duration(atraso)} • Descontável: ${duration(descontar)} • Desconto: ${money(salario/horas/60*descontar)} • Base: ${money(salario)} / ${horas}h • Tolerância: ${tolerancia}min${editando?' • Base preservada do registro original':''}.`;
  }
  async function load(){
    if(!isAdmin())return;const seq=++request,body=$('#chegadasBody'),month=$('#chegadasMes'),filter=$('#chegadasFuncionario');
    if(!month.value)month.value=spToday().slice(0,7);body.innerHTML='<tr><td colspan="8">Carregando...</td></tr>';$('#chegadasMsg').textContent='';
    try{
      const [users,data]=await Promise.all([api('listarFuncionarios'),api('listarChegadas',{mes:month.value,idFuncionario:filter.value})]);if(seq!==request)return;
      equipe=(users.funcionarios||[]).filter(x=>!['administrador','revendedor'].includes(String(x.perfil).toLowerCase()));registros=data.registros||[];
      for(const select of [field('idFuncionario'),filter]){const value=select.value;select.innerHTML=`<option value="">${select===filter?'Todos':'Selecione'}</option>`+equipe.map(x=>`<option value="${esc(x.id)}">${esc(x.nome)}${x.status==='Inativo'?' (inativo)':''}</option>`).join('');select.value=value}
      const active=registros.filter(r=>!r.cancelado),groups=new Map();
      for(const r of active){const g=groups.get(r.idFuncionario)||{nome:r.nome,dias:0,atraso:0,tempo:0,desconto:0};g.dias++;g.atraso+=r.atrasoMinutos;g.tempo+=r.minutosDescontados;g.desconto+=r.desconto;groups.set(r.idFuncionario,g)}
      $('#chegadasResumo').textContent=`${active.length} chegada(s) • Atraso total: ${duration(active.reduce((s,r)=>s+r.atrasoMinutos,0))} • Desconto no mês: ${money(active.reduce((s,r)=>s+r.desconto,0))}.`;
      $('#chegadasTotaisBody').innerHTML=[...groups.values()].map(g=>`<tr><td>${esc(g.nome)}</td><td>${g.dias}</td><td>${duration(g.atraso)}</td><td>${duration(g.tempo)}</td><td><strong>${money(g.desconto)}</strong></td></tr>`).join('')||'<tr><td colspan="5">Nenhuma chegada ativa neste período.</td></tr>';
      body.innerHTML=registros.map((r,i)=>`<tr><td>${esc(dataBR(r.data))}</td><td><strong>${esc(r.nome)}</strong><br><small>${money(r.salario)} / ${Number(r.horasMensais)}h</small></td><td>${esc(r.previsto)}</td><td>${esc(r.chegada)}</td><td>${duration(r.atrasoMinutos)}</td><td><strong>${money(r.cancelado?0:r.desconto)}</strong><br><small>${r.cancelado?'Cancelado':r.abonado?'Abonado':r.minutosDescontados?'Descontado':'Sem desconto'}</small></td><td>${esc(r.observacao||'—')}<br><small>${esc(r.atualizadoPor)} • ${esc(new Date(r.atualizadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</small></td><td><div class="actions"><button type="button" class="secondary compact" data-edit="${i}">${r.cancelado?'Restaurar':'Corrigir'}</button>${!r.cancelado?`<button type="button" class="secondary compact" data-cancel="${i}">Cancelar</button>`:''}<button type="button" class="secondary compact" data-history="${i}">Histórico</button></div></td></tr>`).join('')||'<tr><td colspan="8">Nenhuma chegada registrada neste período.</td></tr>';
      if(!field('data').value)reset();else {preview();syncDate();await refreshCalendar()}
    }catch(e){if(seq!==request)return;registros=[];body.innerHTML='<tr><td colspan="8">Não foi possível carregar os registros.</td></tr>';$('#chegadasTotaisBody').innerHTML='';$('#chegadasResumo').textContent='';$('#chegadasMsg').textContent=e.message}
  }
  function edit(r){editando=r;field('idFuncionario').value=r.idFuncionario;field('data').value=r.data;field('previsto').value=r.previsto;field('chegada').value=r.chegada;field('tratamento').value=r.abonado?'abonar':'descontar';field('observacao').value='';field('idFuncionario').disabled=true;field('data').disabled=true;setMsg(form,'Este dia já está cadastrado. Informe a justificativa para salvar uma correção.');preview();calendarMonth=r.data.slice(0,7);syncDate();closeCalendar();refreshCalendar();form.scrollIntoView({behavior:'smooth',block:'start'})}
  form.addEventListener('submit',async e=>{
    e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;setMsg(form,'Salvando...');
    const d={idFuncionario:field('idFuncionario').value,data:field('data').value,previsto:field('previsto').value,chegada:field('chegada').value,abonado:field('tratamento').value==='abonar',observacao:field('observacao').value,versao:editando?.versao||editando?.atualizadoEm||''};
    try{await api('salvarChegada',d);$('#chegadasMes').value=d.data.slice(0,7);reset();field('idFuncionario').value=d.idFuncionario;field('data').value=d.data;calendarMonth=d.data.slice(0,7);expected();syncDate();setMsg(form,'Chegada salva e desconto atualizado.',true);await load()}catch(e){setMsg(form,e.message)}finally{button.disabled=false}
  });
  $('#chegadasBody').addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.edit!==undefined){edit(registros[Number(b.dataset.edit)]);return}
    if(b.dataset.history!==undefined){const r=registros[Number(b.dataset.history)],history=[r,...(r.historico||[]).slice().reverse()];alert(history.map(x=>`${x.atualizadoPor} • ${new Date(x.atualizadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}\nPrevisto ${x.previsto} / chegada ${x.chegada} • ${money(x.cancelado?0:x.desconto)}${x.cancelado?' • Cancelado':x.abonado?' • Abonado':''}\n${x.observacao||'Sem observação'}`).join('\n\n'));return}
    if(b.dataset.cancel!==undefined){const r=registros[Number(b.dataset.cancel)],observacao=prompt('Justificativa para cancelar esta chegada:');if(!observacao?.trim())return;b.disabled=true;try{await api('salvarChegada',{idFuncionario:r.idFuncionario,data:r.data,previsto:r.previsto,chegada:r.chegada,abonado:r.abonado,cancelado:true,observacao,versao:r.versao||r.atualizadoEm});if(editando?.id===r.id)reset();await load()}catch(e){$('#chegadasMsg').textContent=e.message}finally{b.disabled=false}}
  });
  field('idFuncionario').addEventListener('change',()=>{expected();refreshCalendar()});field('data').addEventListener('change',()=>{expected();syncDate();refreshCalendar()});form.addEventListener('input',preview);
  $('#cancelarEdicaoChegada').addEventListener('click',reset);$('#chegadasMes').addEventListener('change',load);$('#chegadasFuncionario').addEventListener('change',load);$('#atualizarChegadas').addEventListener('click',load);
  $('.nav-btn[data-page="chegadas"]').addEventListener('click',()=>{if(isAdmin())load()});

  function syncDate(){
    $('#chegadaDataValor').textContent=dataBR(field('data').value);
    $('#chegadaDataToggle').disabled=field('data').disabled;
    $('#chegadaDataToggle').classList.toggle('has-record',calendarRecords.some(r=>r.data===field('data').value&&r.idFuncionario===field('idFuncionario').value));
  }
  function closeCalendar(){ $('#chegadaCalendario').classList.add('hidden');$('#chegadaDataToggle').setAttribute('aria-expanded','false') }
  function renderCalendar(){
    const [year,month]=calendarMonth.split('-').map(Number),first=new Date(year,month-1,1,12),count=new Date(year,month,0,12).getDate(),offset=(first.getDay()+6)%7;
    const dateLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(first);
    $('#chegadaCalendarioMes').textContent=dateLabel;
    $('#chegadaMesSeguinte').disabled=calendarMonth>=spToday().slice(0,7);
    const byDate=new Map(calendarRecords.filter(r=>r.idFuncionario===field('idFuncionario').value).map(r=>[r.data,r]));
    let html='<span aria-hidden="true"></span>'.repeat(offset);
    for(let day=1;day<=count;day++){
      const date=`${calendarMonth}-${String(day).padStart(2,'0')}`,r=byDate.get(date),selected=date===field('data').value;
      const label=`${dataBR(date)}${r? r.cancelado?' — registro cancelado':' — já cadastrado':''}${date===spToday()?' — hoje':''}`;
      html+=`<button type="button" class="arrival-calendar-day${r?' registered':''}${selected?' selected':''}${date===spToday()?' today':''}" data-date="${date}" aria-label="${esc(label)}" aria-pressed="${selected}" ${date>spToday()||calendarLoading||calendarError?'disabled':''}>${day}${r?'<span class="arrival-day-dot" aria-hidden="true"></span>':''}</button>`;
    }
    $('#chegadaCalendarioDias').innerHTML=html;
    $('#chegadaCalendarioAviso').textContent=calendarLoading?'Consultando dias cadastrados...':calendarError||(!field('idFuncionario').value?'Selecione um funcionário para ver os dias já cadastrados.':'Dias cadastrados para o funcionário selecionado.');
    syncDate();
  }
  async function refreshCalendar(){
    if(!calendarMonth)calendarMonth=field('data').value.slice(0,7)||spToday().slice(0,7);
    const seq=++calendarRequest,idFuncionario=field('idFuncionario').value;
    calendarRecords=[];calendarError='';calendarLoading=!!idFuncionario;renderCalendar();
    if(!idFuncionario)return;
    try{const result=await api('listarChegadas',{mes:calendarMonth,idFuncionario});if(seq!==calendarRequest)return;calendarRecords=result.registros||[]}
    catch(e){if(seq!==calendarRequest)return;calendarError='Não foi possível conferir os dias. Feche e abra o calendário para tentar novamente.'}
    finally{if(seq===calendarRequest){calendarLoading=false;renderCalendar()}}
  }
  $('#chegadaDataToggle').addEventListener('click',()=>{
    const calendar=$('#chegadaCalendario'),opening=calendar.classList.contains('hidden');
    calendar.classList.toggle('hidden',!opening);$('#chegadaDataToggle').setAttribute('aria-expanded',String(opening));
    if(opening){calendarMonth=field('data').value.slice(0,7)||spToday().slice(0,7);refreshCalendar()}
  });
  for(const [id,delta] of [['chegadaMesAnterior',-1],['chegadaMesSeguinte',1]])$('#'+id).addEventListener('click',()=>{
    const [year,month]=calendarMonth.split('-').map(Number),date=new Date(year,month-1+delta,1,12);
    calendarMonth=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;refreshCalendar();
  });
  $('#chegadaCalendarioDias').addEventListener('click',e=>{
    const button=e.target.closest('button[data-date]');if(!button||button.disabled||calendarLoading||calendarError)return;
    const existing=calendarRecords.find(r=>r.data===button.dataset.date&&r.idFuncionario===field('idFuncionario').value);
    if(existing){edit(existing);field('chegada').focus();return}
    field('data').value=button.dataset.date;expected();syncDate();closeCalendar();$('#chegadaDataToggle').focus();
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.arrival-date-field'))closeCalendar()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#chegadaCalendario').classList.contains('hidden')){closeCalendar();$('#chegadaDataToggle').focus()}});

  reset();
})();

