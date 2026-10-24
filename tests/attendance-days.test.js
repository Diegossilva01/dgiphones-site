const test=require('node:test');
const assert=require('node:assert/strict');
const days=require('../chegadas-dias');
const finance=require('../lib/finance');
const c=require('../lib/common');
const attendance=require('../lib/attendance');

test('start date follows the same fifth business day as payroll across holidays and year rollover',()=>{
  assert.equal(days.fifthBusinessDay('2026-10'),'2026-10-06');
  assert.equal(days.fifthBusinessDay('2026-11'),'2026-11-07');
  assert.equal(days.initialMonth('2027-01-31'),'2026-12');
  for(let y=2026;y<=2027;y++)for(let m=1;m<=12;m++){
    const month=`${y}-${String(m).padStart(2,'0')}`,previous=days.initialMonth(`${month}-15`);
    assert.equal(days.fifthBusinessDay(month),finance.payroll(c,{salario:2200,dataCadastro:'2020-01-01'},previous).dataPagamento);
  }
});

test('pending list includes working days only, pulls scheduled times and excludes registered or paid days',()=>{
  const f={id:'F1',status:'Ativo',nome:'Ana',diasSemana:6,dataCadastro:'2026-09-01',horarioEntrada:'10:00',horarioSabado:'09:00'};
  const input={inicio:'2026-10-06',fim:'2026-10-12',funcionarios:[f]};
  const initial=days.pending(input);
  assert.deepEqual(initial.map(p=>p.data),['2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-12']);
  assert.equal(initial.find(p=>p.data==='2026-10-10').previsto,'09:00');
  assert.equal(days.pending({...input,funcionarios:[{...f,diasSemana:5}]}).length,5);
  assert.equal(days.pending({...input,incluirFolgas:true}).length,7);
  assert.equal(days.pending({...input,funcionarios:[{...f,status:'Inativo'}]}).length,0);
  assert.equal(days.pending({...input,funcionarios:[{...f,dataCadastro:'2026-10-12'}]}).length,1);
  const saved={idFuncionario:'F1',data:'2026-10-06',cancelado:false};
  assert.equal(days.pending({...input,registros:[saved]}).length,5);
  assert.equal(days.pending({...input,registros:[{...saved,cancelado:true,previsto:'08:00'}]})[0].previsto,'08:00');
  assert.equal(days.pending({...input,mesesPagos:[{idFuncionario:'F1',mes:'2026-10'}]}).length,0);
  assert.equal(days.pending({...input,mesesPagos:[{idFuncionario:'F2',mes:'2026-10'}]}).length,6);
});

test('new calendar days generate new pending rows without a database insertion',()=>{
  const input={inicio:'2026-10-06',funcionarios:[{id:'F1',status:'Ativo',diasSemana:6}]};
  const monday=days.pending({...input,fim:'2026-10-19'}),tuesday=days.pending({...input,fim:'2026-10-20'});
  assert.equal(tuesday.length,monday.length+1);assert.equal(tuesday.at(-1).data,'2026-10-20');
});

test('inline preview matches backend calculation including tolerance and abono',()=>{
  for(const chegada of ['09:00','10:00','10:05','10:06','11:30'])for(const abonado of [true,false]){
    const input={previsto:'10:00',chegada,salario:2200,horasMensais:220,toleranciaMinutos:5,abonado};
    const ui=days.calculation(input),server=attendance.calculate(input);
    assert.equal(ui.atraso,server.atrasoMinutos);assert.equal(ui.desconto,server.desconto);assert.equal(ui.atrasado,server.atrasoMinutos>5);
  }
});

test('range API combines months and returns paid months; invalid ranges and non-admin users are rejected',async()=>{
  const records={ChegadasEquipe:[{id:'A',idFuncionario:'F1',nome:'Ana',data:'2026-09-07'},{id:'B',idFuncionario:'F1',nome:'Ana',data:'2026-10-20'},{id:'C',idFuncionario:'F2',nome:'Bruno',data:'2026-10-20'},{id:'OLD',idFuncionario:'F1',nome:'Ana',data:'2026-09-01'}],PagamentosEquipe:[{'ID Funcionário':'F1',Mês:'2026-09','Salário pago':'Sim'},{'ID Funcionário':'F2',Mês:'2026-09','Salário pago':'Não'}]};
  const db={rows:async n=>records[n],clean:r=>r},common={...c,today:()=> '2026-10-24'},admin={perfil:'Administrador'};
  const r=await attendance.list(db,common,{inicio:'2026-09-05',fim:'2026-10-24',idFuncionario:'F1'},admin);
  assert.deepEqual(r.registros.map(x=>x.id),['B','A']);assert.deepEqual(r.mesesPagos,[{idFuncionario:'F1',mes:'2026-09'}]);
  assert.equal((await attendance.list(db,common,{mes:'2026-10'},admin)).registros.length,2);
  for(const d of [{inicio:'2026-02-30',fim:'2026-10-24'},{inicio:'2026-10-25',fim:'2026-10-24'},{inicio:'2026-10-01',fim:'2026-10-25'},{inicio:'2024-01-01',fim:'2026-10-24'}])await assert.rejects(attendance.list(db,common,d,admin),/período válido/);
  await assert.rejects(attendance.list(db,common,{inicio:'2026-09-05',fim:'2026-10-24'},{perfil:'Funcionário'}),/administradores/);
});
