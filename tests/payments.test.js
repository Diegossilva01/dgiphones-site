const test=require('node:test');
const assert=require('node:assert/strict');
const finance=require('../lib/finance');
const common=require('../lib/common');

test('monthly salary stays fixed throughout the month and rolls payment into next year',()=>{
  const f={salario:2094,valeRefeicaoDia:21.5,diasSemana:6,dataCadastro:'2026-07-28'};
  const early=finance.payroll({...common,today:()=> '2026-10-01'},f,'2026-10');
  const late=finance.payroll({...common,today:()=> '2026-10-31'},f,'2026-10');
  assert.deepEqual(early,late);
  assert.equal(early.salarioCalculado,2094);
  assert.equal(early.dataPagamento,'2026-11-07');
  // Sábado conta; domingo e o feriado de 2 de novembro não contam.
  assert.equal(finance.payroll(common,f,'2026-09').dataPagamento,'2026-10-06');
  assert.equal(finance.payroll(common,f,'2026-12').dataPagamento,'2027-01-07');
  assert.equal(finance.payroll(common,{...f,dataCadastro:'2026-11-01'},'2026-10').salarioCalculado,0);
});

test('paying and reopening a month preserves advances and other paid months',async()=>{
  const records={Funcionarios:[{ID:'F1',Nome:'Teste',Perfil:'Funcionário',Status:'Ativo','Salário':3000,'Vale refeição dia':20,'Dias por semana':5,'Data de cadastro':'2026-01-01'}],Vendas:[],ValeSolicitacoes:[{'ID Vale':'V1',Mês:'2026-10','ID Funcionário':'F1',Valor:500,Status:'Aprovado'}],PagamentosEquipe:[{'ID Controle':'OLD',Mês:'2026-09','ID Funcionário':'F1','Salário pago':'Sim','Vale refeição pago':'Sim','Comissão paga':'Sim','Valor salário pago':2900}]};
  const db={rows:async name=>structuredClone(records[name]||[]),clean:r=>r,add:async(name,id,r)=>records[name].push(structuredClone(r)),put:async(name,id,r)=>{records[name][records[name].findIndex(x=>x['ID Controle']===id)]=structuredClone(r)}};
  const u={id:'ADMIN',nome:'Admin',perfil:'Administrador'},d={mes:'2026-10',idFuncionario:'F1',tipo:'total'};
  const before=await finance.team(db,common,d,u);
  assert.equal(before.itens[0].salarioPendente,2500);
  await finance.payment(db,common,d,u);
  const paid=await finance.team(db,common,d,u);
  assert.equal(paid.itens[0].totalPagar,0);
  assert.equal(paid.itens[0].saldoSalarioAtual,0);
  assert.equal(paid.itens[0].valorSalarioPago,2500);
  assert.equal(records.PagamentosEquipe[0]['Valor salário pago'],2900);
  await finance.payment(db,common,{...d,pago:false},u);
  const reopened=await finance.team(db,common,d,u);
  assert.equal(reopened.itens[0].salarioPendente,2500);
  assert.equal(reopened.itens[0].totalPagar,before.itens[0].totalPagar);
});
