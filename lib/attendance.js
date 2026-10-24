const {randomUUID}=require('node:crypto');
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
const timeOK=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
function settings(f){return {horarioEntrada:f['Horário de entrada']||'',horarioSabado:f['Horário de sábado']||'',horasMensais:Number(f['Horas mensais'])||220,toleranciaMinutos:Number(f['Tolerância entrada']??5)}}
function settingsInput(d){
  const r={};
  for(const [field,key] of [['horarioEntrada','Horário de entrada'],['horarioSabado','Horário de sábado']])if(d[field]!==undefined){if(d[field]!==''&&!timeOK(d[field]))throw Error('Horário inválido. Use HH:MM.');r[key]=d[field]}
  if(d.horasMensais!==undefined){const n=Number(d.horasMensais);if(!Number.isFinite(n)||n<=0||n>744)throw Error('Informe uma jornada mensal entre 0 e 744 horas.');r['Horas mensais']=n}
  if(d.toleranciaMinutos!==undefined){const n=Number(d.toleranciaMinutos);if(!Number.isInteger(n)||n<5||n>120)throw Error('A tolerância de entrada deve ser entre 5 e 120 minutos.');r['Tolerância entrada']=n}
  return r;
}
function calculate({previsto,chegada,salario,horasMensais,toleranciaMinutos=5,abonado=false}){
  if(!timeOK(previsto)||!timeOK(chegada))throw Error('Informe o horário previsto e a chegada em HH:MM.');
  if(!Number.isFinite(salario)||salario<=0||!Number.isFinite(horasMensais)||horasMensais<=0)throw Error('Cadastre salário e jornada mensal válidos antes de registrar a chegada.');
  const atrasoMinutos=Math.max(0,minutes(chegada)-minutes(previsto)),minutosDescontados=abonado||atrasoMinutos<=toleranciaMinutos?0:atrasoMinutos;
  return {atrasoMinutos,minutosDescontados,valorHora:salario/horasMensais,desconto:round(salario/horasMensais/60*minutosDescontados)};
}
async function totals(db,m,id){
  const records=(await db.rows('ChegadasEquipe')).filter(r=>r.data?.slice(0,7)===m&&(!id||r.idFuncionario===id)&&!r.cancelado);
  return records.reduce((s,r)=>({atrasoMinutos:s.atrasoMinutos+Number(r.atrasoMinutos||0),minutosDescontados:s.minutosDescontados+Number(r.minutosDescontados||0),descontoAtrasos:round(s.descontoAtrasos+Number(r.desconto||0))}),{atrasoMinutos:0,minutosDescontados:0,descontoAtrasos:0});
}
const admin=(c,u)=>{if(c.normal(u.perfil)!=='administrador')throw Error('Apenas administradores podem executar esta ação.')};
function validDate(v){const date=new Date(`${v}T12:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v}
async function list(db,c,d,u){
  admin(c,u);
  let inicio,fim,range=d.inicio!==undefined||d.fim!==undefined;
  if(range){
    inicio=c.text(d.inicio);fim=c.text(d.fim);
    if(!validDate(inicio)||!validDate(fim)||inicio>fim||fim>c.today()||(Date.parse(fim)-Date.parse(inicio))/86400000>366)throw Error('Informe um período válido de até um ano, sem datas futuras.');
  }else{
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.mes||''))throw Error('Selecione um mês válido.');
    inicio=`${d.mes}-01`;const [y,m]=d.mes.split('-').map(Number);fim=`${d.mes}-${new Date(y,m,0).getDate()}`;
  }
  const registros=(await db.rows('ChegadasEquipe')).filter(r=>r.data>=inicio&&r.data<=fim&&(!d.idFuncionario||r.idFuncionario===d.idFuncionario)).map(db.clean).sort((a,b)=>b.data.localeCompare(a.data)||a.nome.localeCompare(b.nome));
  const mesesPagos=range?(await db.rows('PagamentosEquipe')).filter(p=>c.normal(p['Salário pago'])==='sim'&&(!d.idFuncionario||p['ID Funcionário']===d.idFuncionario)).map(p=>({idFuncionario:p['ID Funcionário'],mes:p.Mês})):[];
  return {sucesso:true,registros,mesesPagos};
}
async function save(db,c,d,u){
  admin(c,u);
  const date=c.text(d.data),parsed=new Date(`${date}T12:00:00Z`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date||date>c.today())throw Error('Informe uma data válida até hoje.');
  const f=await db.get('Funcionarios',d.idFuncionario);
  if(!f||['administrador','revendedor'].includes(c.normal(f.Perfil)))throw Error('Funcionário inválido.');
  const id=`${f.ID}:${date}`,old=await db.get('ChegadasEquipe',id);
  if((old?.versao||old?.atualizadoEm||'')!==(d.versao||''))throw Error('Este registro mudou. Atualize a lista antes de salvar.');
  if(d.cancelado===true&&!old)throw Error('Registro não encontrado.');
  const paid=(await db.rows('PagamentosEquipe')).some(p=>p.Mês===date.slice(0,7)&&p['ID Funcionário']===f.ID&&c.normal(p['Salário pago'])==='sim');
  if(paid)throw Error('O salário deste mês já foi pago. Reabra o pagamento antes de alterar chegadas.');
  const conf=settings(f),cancelado=d.cancelado===true,abonado=d.abonado===true,observacao=c.text(d.observacao).slice(0,1000);
  if((old||abonado||cancelado)&&!observacao)throw Error('Informe a justificativa da alteração, abono ou cancelamento.');
  const previsto=c.text(d.previsto),chegada=c.text(d.chegada),salario=old?.salario??c.money(f['Salário']),horasMensais=old?.horasMensais??conf.horasMensais,toleranciaMinutos=old?.toleranciaMinutos??conf.toleranciaMinutos;
  const values=calculate({previsto,chegada,salario,horasMensais,toleranciaMinutos,abonado});
  const row={id,idFuncionario:f.ID,nome:f.Nome,data:date,previsto,chegada,salario,horasMensais,toleranciaMinutos,abonado,cancelado,observacao,...values,versao:randomUUID(),atualizadoPor:u.nome,atualizadoEm:new Date().toISOString(),historico:old?[...(old.historico||[]),{...db.clean(old),historico:undefined}]:[]};
  // Chave única por funcionário/dia; versão impede sobrescrita por outro administrador.
  const result=await db.query(`INSERT INTO ct_records(collection,record_key,source_row,data)
    SELECT 'ChegadasEquipe',$1,nextval('ct_row_seq'),$2::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM ct_records WHERE collection='PagamentosEquipe' AND data->>'Mês'=$4 AND data->>'ID Funcionário'=$5 AND data->>'Salário pago'='Sim')
    ON CONFLICT(collection,record_key) DO UPDATE SET data=EXCLUDED.data
    WHERE COALESCE(ct_records.data->>'versao',ct_records.data->>'atualizadoEm')=$3 RETURNING record_key`,[id,JSON.stringify(row),d.versao||'',date.slice(0,7),f.ID]);
  if(!result.length)throw Error('O registro ou pagamento mudou. Atualize a lista e tente novamente.');
  return {sucesso:true,mensagem:cancelado?'Registro cancelado.':'Chegada salva.',registro:row};
}
module.exports={settings,settingsInput,calculate,totals,list,save};

