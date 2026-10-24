// Controle de chegadas disponível apenas no painel administrativo.
(() => {
  const form=$('#chegadaForm');if(!form)return;
  let registros=[],equipe=[],editando=null,request=0;
  const duration=n=>`${Math.floor(n/60)}h ${n%60}min`;
  const spToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
  const field=name=>form.elements.namedItem(name);
  function reset(){form.reset();editando=null;field('idFuncionario').disabled=false;field('data').disabled=false;field('data').value=spToday();field('data').max=spToday();setMsg(form,'');preview()}
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
      if(!field('data').value)reset();else preview();
    }catch(e){if(seq!==request)return;registros=[];body.innerHTML='<tr><td colspan="8">Não foi possível carregar os registros.</td></tr>';$('#chegadasTotaisBody').innerHTML='';$('#chegadasResumo').textContent='';$('#chegadasMsg').textContent=e.message}
  }
  function edit(r){editando=r;field('idFuncionario').value=r.idFuncionario;field('data').value=r.data;field('previsto').value=r.previsto;field('chegada').value=r.chegada;field('tratamento').value=r.abonado?'abonar':'descontar';field('observacao').value='';field('idFuncionario').disabled=true;field('data').disabled=true;setMsg(form,'Informe a justificativa para salvar a correção.');preview();form.scrollIntoView({behavior:'smooth',block:'start'})}
  form.addEventListener('submit',async e=>{
    e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;setMsg(form,'Salvando...');
    const d={idFuncionario:field('idFuncionario').value,data:field('data').value,previsto:field('previsto').value,chegada:field('chegada').value,abonado:field('tratamento').value==='abonar',observacao:field('observacao').value,versao:editando?.versao||editando?.atualizadoEm||''};
    try{await api('salvarChegada',d);$('#chegadasMes').value=d.data.slice(0,7);reset();setMsg(form,'Chegada salva e desconto atualizado.',true);await load()}catch(e){setMsg(form,e.message)}finally{button.disabled=false}
  });
  $('#chegadasBody').addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.edit!==undefined){edit(registros[Number(b.dataset.edit)]);return}
    if(b.dataset.history!==undefined){const r=registros[Number(b.dataset.history)],history=[r,...(r.historico||[]).slice().reverse()];alert(history.map(x=>`${x.atualizadoPor} • ${new Date(x.atualizadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}\nPrevisto ${x.previsto} / chegada ${x.chegada} • ${money(x.cancelado?0:x.desconto)}${x.cancelado?' • Cancelado':x.abonado?' • Abonado':''}\n${x.observacao||'Sem observação'}`).join('\n\n'));return}
    if(b.dataset.cancel!==undefined){const r=registros[Number(b.dataset.cancel)],observacao=prompt('Justificativa para cancelar esta chegada:');if(!observacao?.trim())return;b.disabled=true;try{await api('salvarChegada',{idFuncionario:r.idFuncionario,data:r.data,previsto:r.previsto,chegada:r.chegada,abonado:r.abonado,cancelado:true,observacao,versao:r.versao||r.atualizadoEm});if(editando?.id===r.id)reset();await load()}catch(e){$('#chegadasMsg').textContent=e.message}finally{b.disabled=false}}
  });
  field('idFuncionario').addEventListener('change',expected);field('data').addEventListener('change',expected);form.addEventListener('input',preview);
  $('#cancelarEdicaoChegada').addEventListener('click',reset);$('#chegadasMes').addEventListener('change',load);$('#chegadasFuncionario').addEventListener('change',load);$('#atualizarChegadas').addEventListener('click',load);
  $('.nav-btn[data-page="chegadas"]').addEventListener('click',()=>{if(isAdmin())load()});
  reset();
})();
