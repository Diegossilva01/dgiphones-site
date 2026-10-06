const fmt=x=>Number(x.toFixed(2));
const month=(c,v)=>/^\d{4}-\d{2}$/.test(c.text(v))?v:c.today().slice(0,7);
const status=v=>v==='Aprovada'?'Aprovada':v==='Negada'||v==='Recusada'?'Negada':'Pendente';
const localDate=(c,v)=>{const iso=c.iso(v);return /^\d{4}-\d{2}-\d{2}$/.test(iso)?new Date(`${iso}T12:00:00`):null};
const dateISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const plusDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n,12);
function holiday(d){
  const md=dateISO(d).slice(5),fixed=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'];if(fixed.includes(md))return true;
  const y=d.getFullYear(),A=y%19,B=Math.floor(y/100),C=y%100,D=Math.floor(B/4),E=B%4,F=Math.floor((B+8)/25),G=Math.floor((B-F+1)/3),H=(19*A+B-D-G+15)%30,I=Math.floor(C/4),K=C%4,L=(32+2*E+2*I-H-K)%7,M=Math.floor((A+11*H+22*L)/451),m=Math.floor((H+L-7*M+114)/31)-1,day=((H+L-7*M+114)%31)+1;
  return dateISO(plusDays(new Date(y,m,day,12),-2))===dateISO(d);
}
function payday(m){
  const [y,mm]=m.split('-').map(Number);let date=new Date(y,mm,1,12),n=0;
  while(n<5){if(date.getDay()!==0&&!holiday(date))n++;if(n<5)date=plusDays(date,1)}
  return date;
}
function payroll(c,f,m){
  const [y,mm]=m.split('-').map(Number),first=new Date(y,mm-1,1,12),last=new Date(y,mm,0,12),admission=localDate(c,f.dataCadastro)||first,pay=payday(m);
  const active=admission<=last;
  // Início acordado do vale: 06/10/2026. Não avança com a data de consulta.
  // Meses anteriores mantêm a regra anterior para preservar o histórico.
  const mealStartPolicy=localDate(c,'2026-10-06');
  let mealStart=first;
  if(m>='2026-10'){
    if(mealStartPolicy>mealStart)mealStart=mealStartPolicy;
    if(admission>mealStart)mealStart=admission;
  }
  let mealDays=0;
  if(active)for(let day=mealStart;day<=last;day=plusDays(day,1))if(day.getDay()!==0&&!holiday(day)&&(Number(f.diasSemana)!==5||day.getDay()!==6))mealDays++;
  return {salarioCalculado:active?fmt(c.money(f.salario)):0,valeRefeicaoCalculado:fmt(c.money(f.valeRefeicaoDia)*mealDays),dataPagamento:dateISO(pay),dataPagamentoBR:c.br(dateISO(pay))};
}
async function people(db,c){return (await db.rows('Funcionarios')).map(f=>({id:f.ID,nome:f.Nome,perfil:f.Perfil,status:f.Status,salario:c.money(f['Salário']),chavePix:f['Chave PIX']||'',tipoChavePix:f['Tipo chave PIX']||'',valeRefeicaoDia:c.money(f['Vale refeição dia']),diasSemana:Number(f['Dias por semana'])||6,dataCadastro:c.iso(f['Data de cadastro']),dataCadastroMs:c.stamp(f['Data de cadastro'])})).filter(f=>c.normal(f.status)==='ativo'&&!['administrador','revendedor'].includes(c.normal(f.perfil)))}
async function sales(db,c,m){return (await db.rows('Vendas')).filter(v=>c.iso(v['Data da venda']).slice(0,7)===m)}
const saleTime=(c,v)=>c.stamp(v['Data de cadastro'])||c.stamp(v['Data da venda']);
const eligible=(c,v,f)=>status(v['Status comissão'])==='Aprovada'&&saleTime(c,v)>=(f.dataCadastroMs||c.stamp(f.dataCadastro)||Infinity);
async function controls(db,m,id){return (await db.rows('PagamentosEquipe')).find(p=>String(p.Mês)===m&&String(p['ID Funcionário'])===String(id))}
async function advances(db,c,m){return (await db.rows('ValeSolicitacoes')).filter(v=>c.text(v.Mês)===m).map(v=>({id:v['ID Vale'],dataSolicitacao:v['Data solicitação'],mes:v.Mês,idFuncionario:v['ID Funcionário'],funcionario:v.Funcionário,valor:c.money(v.Valor),motivo:v.Motivo,status:v.Status||'Pendente',decididoPor:v['Decidido por'],dataDecisao:v['Data decisão'],dataPagamento:v['Data pagamento']}))}
async function commissions(db,c,d,u){
  const m=month(c,d.mes),all=await sales(db,c,m),employee=!['administrador','revendedor'].includes(c.normal(u.perfil));
  const vendas=all.sort((a,b)=>saleTime(c,b)-saleTime(c,a)).map(v=>{const s=status(v['Status comissão']),ok=employee&&saleTime(c,v)>=(u.dataCadastroMs||Infinity),value=c.money(v['Valor da venda']);return {id:v['ID Venda'],data:c.iso(v['Data da venda']),cliente:v['Nome do cliente'],modelo:v.Modelo,armazenamento:v.Armazenamento,valor:value,responsavel:v['Funcionário responsável'],statusComissao:s,atualizadoPor:v['Comissão atualizada por'],atualizadoEm:v['Comissão atualizada em'],elegivelUsuario:ok,comissaoUsuario:s==='Aprovada'&&ok?fmt(value*.02):0}});
  return {sucesso:true,mes:m,percentual:2,vendas,resumo:{total:vendas.length,pendentes:vendas.filter(v=>v.statusComissao==='Pendente').length,aprovadas:vendas.filter(v=>v.statusComissao==='Aprovada').length,negadas:vendas.filter(v=>v.statusComissao==='Negada').length}};
}
async function changeCommission(db,c,d,u){
  if(c.normal(u.perfil)!=='administrador')throw Error('Apenas administradores podem executar esta ação.');
  if(!['Pendente','Aprovada','Negada'].includes(d.status))throw Error('Status de comissão inválido.');
  const v=await db.get('Vendas',d.idVenda);if(!v)throw Error('Venda não encontrada.');
  const m=c.iso(v['Data da venda']).slice(0,7);if(status(v['Status comissão'])!==d.status&&(await db.rows('PagamentosEquipe')).some(p=>p.Mês===m&&c.normal(p['Comissão paga'])==='sim'))throw Error('Já existe comissão paga neste mês. Reabra os pagamentos antes de alterar esta venda.');
  Object.assign(v,{'Status comissão':d.status,'Comissão atualizada por':u.nome,'Comissão atualizada em':c.now()});await db.put('Vendas',d.idVenda,db.clean(v));return {sucesso:true,status:d.status,mensagem:'Status da comissão da venda atualizado.'};
}
async function listAdvances(db,c,d,u){
  const m=month(c,d.mes),admin=c.normal(u.perfil)==='administrador',all=await advances(db,c,m),vales=admin?all:all.filter(v=>String(v.idFuncionario)===String(u.id));
  vales.reverse();let saldoDisponivel=0;
  if(!admin){const f=(await people(db,c)).find(x=>x.id===u.id)||u;saldoDisponivel=fmt(payroll(c,f,m).salarioCalculado-vales.filter(v=>['Aprovado','Pendente'].includes(v.status)).reduce((s,v)=>s+v.valor,0))}
  return {sucesso:true,mes:m,vales,saldoDisponivel,resumo:{pendentes:vales.filter(v=>v.status==='Pendente').length,aprovados:vales.filter(v=>v.status==='Aprovado').length,negados:vales.filter(v=>v.status==='Negado').length,valorAprovado:vales.filter(v=>v.status==='Aprovado').reduce((s,v)=>s+v.valor,0),valorPendente:vales.filter(v=>v.status==='Pendente').reduce((s,v)=>s+v.valor,0)}};
}
async function requestAdvance(db,c,d,u){
  if(['administrador','revendedor'].includes(c.normal(u.perfil)))throw Error('Esta solicitação é exclusiva para funcionários.');
  const valor=fmt(c.money(d.valor)),m=month(c),ctrl=await controls(db,m,u.id);if(valor<=0)throw Error('Informe um valor válido.');if(ctrl&&c.normal(ctrl['Salário pago'])==='sim')throw Error('O salário deste mês já foi pago.');
  const id=c.id('VALE'),f=(await people(db,c)).find(x=>x.id===u.id)||u;
  const current=(await advances(db,c,m)).filter(v=>v.idFuncionario===u.id&&['Aprovado','Pendente'].includes(v.status)).reduce((s,v)=>s+v.valor,0);
  const row={'ID Vale':id,'Data solicitação':c.now(),Mês:m,'ID Funcionário':u.id,Funcionário:u.nome,Valor:valor,Motivo:c.text(d.motivo),Status:'Pendente','Decidido por':'','Data decisão':'','Data pagamento':''};
  await db.add('ValeSolicitacoes',id,row);
  return {sucesso:true,mes:m,saldoDisponivel:fmt(payroll(c,f,m).salarioCalculado-current-valor),vale:{id,dataSolicitacao:row['Data solicitação'],mes:m,idFuncionario:u.id,funcionario:u.nome,valor,motivo:row.Motivo,status:'Pendente'},mensagem:'Solicitação de vale enviada para aprovação.'};
}
async function changeAdvance(db,c,d,u){
  if(c.normal(u.perfil)!=='administrador')throw Error('Apenas administradores podem executar esta ação.');
  if(!['Pendente','Aprovado','Negado'].includes(d.status))throw Error('Status inválido.');
  const r=await db.get('ValeSolicitacoes',d.idVale);if(!r)throw Error('Solicitação não encontrada.');
  const ctrl=await controls(db,c.text(r.Mês),r['ID Funcionário']);if(r.Status!==d.status&&ctrl&&c.normal(ctrl['Salário pago'])==='sim')throw Error('O salário deste funcionário já foi pago. Reabra antes de alterar o vale.');
  Object.assign(r,{Status:d.status,'Decidido por':d.status==='Pendente'?'':u.nome,'Data decisão':d.status==='Pendente'?'':c.now(),'Data pagamento':d.status==='Aprovado'?c.now():''});await db.put('ValeSolicitacoes',d.idVale,db.clean(r));return {sucesso:true,status:d.status,mensagem:'Status do vale atualizado.'};
}
async function team(db,c,d,u){
  const m=month(c,d.mes),all=await people(db,c),filt=c.normal(u.perfil)==='administrador'?all:all.filter(f=>f.id===u.id),approved=(await sales(db,c,m)).filter(v=>status(v['Status comissão'])==='Aprovada'),vals=await advances(db,c,m);
  const itens=[];
  for(const f of filt){
    const folha=payroll(c,f,m),vv=approved.filter(v=>eligible(c,v,f)),faturamento=vv.reduce((s,v)=>s+c.money(v['Valor da venda']),0),comissao=fmt(faturamento*.02),va=vals.filter(v=>v.idFuncionario===f.id),valesAprovados=va.filter(v=>v.status==='Aprovado').reduce((s,v)=>s+v.valor,0),valesPendentes=va.filter(v=>v.status==='Pendente').reduce((s,v)=>s+v.valor,0),salarioLiquido=fmt(folha.salarioCalculado-valesAprovados),saldoSalarioAtual=fmt(salarioLiquido-valesPendentes),ctrl=await controls(db,m,f.id),comissaoPaga=c.normal(ctrl?.['Comissão paga'])==='sim',salarioPago=c.normal(ctrl?.['Salário pago'])==='sim',valeRefeicaoPago=c.normal(ctrl?.['Vale refeição pago'])==='sim',comissaoPendente=comissaoPaga?0:comissao,salarioPendente=salarioPago?0:Math.max(0,salarioLiquido),valeRefeicaoPendente=valeRefeicaoPago?0:folha.valeRefeicaoCalculado,totalAcumulado=fmt(salarioLiquido+folha.valeRefeicaoCalculado+comissao);
    itens.push({...f,...folha,salarioLiquido,saldoSalarioAtual:salarioPago?0:saldoSalarioAtual,valesAprovados,valesPendentes,vendas:vv.length,faturamento,comissaoCalculada:comissao,comissaoPaga,salarioPago,valeRefeicaoPago,valorComissaoPago:c.money(ctrl?.['Valor comissão pago']),valorSalarioPago:c.money(ctrl?.['Valor salário pago']),valorValeRefeicaoPago:c.money(ctrl?.['Valor vale refeição pago']),comissaoPendente,salarioPendente,valeRefeicaoPendente,totalPagar:fmt(comissaoPendente+salarioPendente+valeRefeicaoPendente),totalSaldoAtual:fmt((salarioPago?0:saldoSalarioAtual)+comissaoPendente+valeRefeicaoPendente),totalAcumulado,totalPrevisto:totalAcumulado});
  }
  const pay=payday(m),resumo={salarios:0,salariosLiquidos:0,valesAprovados:0,valeRefeicao:0,comissoes:0,totalAcumulado:0,totalPrevisto:0,totalPagar:0};for(const x of itens)for(const [k,v] of Object.entries({salarios:x.salarioCalculado,salariosLiquidos:x.salarioLiquido,valesAprovados:x.valesAprovados,valeRefeicao:x.valeRefeicaoCalculado,comissoes:x.comissaoCalculada,totalAcumulado:x.totalAcumulado,totalPrevisto:x.totalPrevisto,totalPagar:x.totalPagar}))resumo[k]+=v;
  return {sucesso:true,mes:m,percentual:2,vendasCompartilhadas:approved.length,faturamentoCompartilhado:approved.reduce((s,v)=>s+c.money(v['Valor da venda']),0),dataPagamento:dateISO(pay),dataPagamentoBR:c.br(dateISO(pay)),itens,resumo};
}
async function payment(db,c,d,u){
  if(c.normal(u.perfil)!=='administrador')throw Error('Apenas administradores podem executar esta ação.');
  const m=month(c,d.mes),f=(await people(db,c)).find(x=>x.id===d.idFuncionario),tipo=c.text(d.tipo).toLowerCase(),paid=d.pago!==false&&d.pago!=='false';
  if(!f||!['comissao','salario','total'].includes(tipo))throw Error('Funcionário ou tipo de pagamento inválido.');
  const folha=payroll(c,f,m),vv=(await sales(db,c,m)).filter(v=>eligible(c,v,f)),comissao=fmt(vv.reduce((s,v)=>s+c.money(v['Valor da venda']),0)*.02),va=(await advances(db,c,m)).filter(v=>v.idFuncionario===f.id&&v.status==='Aprovado').reduce((s,v)=>s+v.valor,0),salario=Math.max(0,fmt(folha.salarioCalculado-va));
  if(tipo==='comissao'&&paid&&comissao<=0)throw Error('Não há comissão aprovada para baixar neste mês.');
  let r=await controls(db,m,f.id);const create=!r;if(!r)r={'ID Controle':c.id('PAG'),Mês:m,'ID Funcionário':f.id,Funcionário:f.nome,'Status comissão':'Pendente','Comissão paga':'Não','Salário pago':'Não','Valor comissão pago':0,'Valor salário pago':0,'Data pagamento comissão':'','Data pagamento salário':'','Atualizado por':'','Atualizado em':'','Vale refeição pago':'Não','Valor vale refeição pago':0,'Data pagamento vale refeição':''};
  if(tipo==='comissao'||tipo==='total')Object.assign(r,{'Comissão paga':paid?'Sim':'Não','Valor comissão pago':paid?comissao:0,'Data pagamento comissão':paid?c.now():''});
  if(tipo==='salario'||tipo==='total')Object.assign(r,{'Salário pago':paid?'Sim':'Não','Valor salário pago':paid?salario:0,'Data pagamento salário':paid?c.now():'','Vale refeição pago':paid?'Sim':'Não','Valor vale refeição pago':paid?folha.valeRefeicaoCalculado:0,'Data pagamento vale refeição':paid?c.now():''});
  r['Atualizado por']=u.nome;r['Atualizado em']=c.now();if(create)await db.add('PagamentosEquipe',r['ID Controle'],r);else await db.put('PagamentosEquipe',r['ID Controle'],db.clean(r));
  return {sucesso:true,mensagem:paid?'Pagamento baixado com sucesso.':'Pagamento reaberto.',salario,valeRefeicao:folha.valeRefeicaoCalculado,comissao};
}
module.exports={commissions,changeCommission,listAdvances,requestAdvance,changeAdvance,team,payment,payroll,holiday};
