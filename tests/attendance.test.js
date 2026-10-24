const test=require('node:test');
const assert=require('node:assert/strict');
const attendance=require('../lib/attendance');
const finance=require('../lib/finance');
const c=require('../lib/common');
const admin={id:'A1',nome:'Admin',perfil:'Administrador'};
const common={...c,today:()=> '2026-10-24'};
function setup(){
  const records={Funcionarios:[{ID:'F1',Nome:'Ana',Perfil:'Funcionário',Status:'Ativo','Salário':2200,'Horas mensais':220,'Horário de entrada':'10:00','Data de cadastro':'2026-01-01'}],ChegadasEquipe:[],PagamentosEquipe:[],Vendas:[],ValeSolicitacoes:[]};
  const db={rows:async name=>structuredClone(records[name]||[]),get:async(name,id)=>structuredClone((records[name]||[]).find(r=>(r.ID||r.id||r['ID Controle'])===id)),clean:r=>{const {_key,_linha,...v}=r;return v},query:async(sql,params)=>{const [id,json,version]=params;const r=JSON.parse(json),i=records.ChegadasEquipe.findIndex(x=>x.id===id);if(i>=0&&records.ChegadasEquipe[i].versao!==version)return [];if(i<0)records.ChegadasEquipe.push(r);else records.ChegadasEquipe[i]=r;return [{record_key:id}]},add:async(name,id,r)=>records[name].push(structuredClone(r)),put:async(name,id,r)=>{records[name][records[name].findIndex(x=>x['ID Controle']===id)]=structuredClone(r)}};
  return {records,db};
}
const input={idFuncionario:'F1',data:'2026-10-23',previsto:'10:00',chegada:'10:30'};

test('arrival calculations: early, on time, tolerance, threshold, hour and custom divisor',()=>{
  for(const chegada of ['09:30','10:00','10:05'])assert.equal(attendance.calculate({previsto:'10:00',chegada,salario:2200,horasMensais:220}).desconto,0);
  assert.equal(attendance.calculate({previsto:'10:00',chegada:'10:06',salario:2200,horasMensais:220}).desconto,1);
  assert.equal(attendance.calculate({previsto:'10:00',chegada:'11:00',salario:2200,horasMensais:220}).desconto,10);
  assert.equal(attendance.calculate({previsto:'10:00',chegada:'10:30',salario:3000,horasMensais:200}).desconto,7.5);
  assert.equal(attendance.calculate({previsto:'10:00',chegada:'10:30',salario:2200,horasMensais:220,abonado:true}).desconto,0);
  assert.throws(()=>attendance.settingsInput({horasMensais:0}));assert.throws(()=>attendance.settingsInput({toleranciaMinutos:4}));
});

test('save validates admin, date, time, salary, employee and duplicate versions',async()=>{
  const {db,records}=setup();
  await assert.rejects(attendance.save(db,common,input,{perfil:'Funcionário'}),/administradores/);
  for(const data of ['2026-02-30','2026-10-25','wrong'])await assert.rejects(attendance.save(db,common,{...input,data},admin),/data válida/);
  await assert.rejects(attendance.save(db,common,{...input,chegada:'24:00'},admin),/HH:MM/);
  await assert.rejects(attendance.save(db,common,{...input,idFuncionario:'missing'},admin),/Funcionário/);
  records.Funcionarios[0]['Salário']=0;await assert.rejects(attendance.save(db,common,input,admin),/salário/);records.Funcionarios[0]['Salário']=2200;
  await attendance.save(db,common,input,admin);
  await assert.rejects(attendance.save(db,common,input,admin),/registro mudou/);
  assert.equal(records.ChegadasEquipe.length,1);
});

test('correction, abono, cancellation and restoration preserve basis and audit history',async()=>{
  const {db,records}=setup();let r=(await attendance.save(db,common,input,admin)).registro;
  records.Funcionarios[0]['Salário']=4400;records.Funcionarios[0]['Horas mensais']=200;
  await assert.rejects(attendance.save(db,common,{...input,versao:r.versao},admin),/justificativa/);
  r=(await attendance.save(db,common,{...input,versao:r.versao,chegada:'11:00',observacao:'Corrigir hora'},admin)).registro;
  assert.equal(r.desconto,10);assert.equal(r.salario,2200);assert.equal(r.horasMensais,220);assert.equal(r.historico.length,1);
  r=(await attendance.save(db,common,{...input,versao:r.versao,abonado:true,observacao:'Atestado'},admin)).registro;
  assert.equal(r.desconto,0);assert.equal(r.historico.length,2);
  r=(await attendance.save(db,common,{...input,versao:r.versao,cancelado:true,observacao:'Lançamento incorreto'},admin)).registro;
  assert.equal((await attendance.totals(db,'2026-10','F1')).descontoAtrasos,0);
  r=(await attendance.save(db,common,{...input,versao:r.versao,observacao:'Restaurar lançamento'},admin)).registro;
  assert.equal(r.cancelado,false);assert.equal((await attendance.totals(db,'2026-10','F1')).descontoAtrasos,5);
  assert.equal((await attendance.totals(db,'2026-09','F1')).descontoAtrasos,0);
});

test('deduction flows into salary, advance balance and paid value, locking the month',async()=>{
  const {db,records}=setup();await attendance.save(db,common,input,admin);
  records.ValeSolicitacoes.push({'ID Vale':'V1',Mês:'2026-10','ID Funcionário':'F1',Valor:100,Status:'Aprovado'});
  const data={mes:'2026-10',idFuncionario:'F1',tipo:'salario'};
  const item=(await finance.team(db,common,data,admin)).itens[0];
  assert.equal(item.descontoAtrasos,5);assert.equal(item.minutosDescontados,30);assert.equal(item.salarioLiquido,2095);
  assert.equal((await finance.listAdvances(db,common,data,{id:'F1',perfil:'Funcionário'})).saldoDisponivel,2095);
  await finance.payment(db,common,data,admin);assert.equal(records.PagamentosEquipe[0]['Valor salário pago'],2095);
  await assert.rejects(attendance.save(db,common,{...input,versao:records.ChegadasEquipe[0].versao,observacao:'Corrigir'},admin),/já foi pago/);
  await finance.payment(db,common,{...data,pago:false},admin);
  assert.equal((await finance.team(db,common,data,admin)).itens[0].salarioPendente,2095);
  await assert.rejects(attendance.list(db,common,{mes:'2026-10'},{perfil:'Funcionário'}),/administradores/);
  assert.equal((await attendance.list(db,common,{mes:'2026-09'},admin)).registros.length,0);
});
