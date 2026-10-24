const test=require('node:test');
const assert=require('node:assert/strict');
const attendance=require('../lib/attendance');
const common=require('../lib/common');
const db=require('../lib/db');
const handler=require('../api/interna');
const records=[
 {id:'F1:2026-10-20',idFuncionario:'F1',data:'2026-10-20',previsto:'10:00',chegada:'10:30',toleranciaMinutos:10,atrasoMinutos:30,minutosDescontados:30,desconto:5,salario:2200,observacao:'Nota interna',historico:[{salario:1000}],atualizadoPor:'Admin'},
 {id:'F1:2026-10-21',idFuncionario:'F1',data:'2026-10-21',previsto:'10:00',chegada:'10:10',toleranciaMinutos:10,atrasoMinutos:10,minutosDescontados:0,desconto:0},
 {id:'F1:2026-10-22',idFuncionario:'F1',data:'2026-10-22',previsto:'10:00',chegada:'10:40',toleranciaMinutos:10,atrasoMinutos:40,minutosDescontados:0,desconto:0,abonado:true},
 {id:'OTHER',idFuncionario:'F2',data:'2026-10-20',desconto:500},
 {id:'CANCELLED',idFuncionario:'F1',data:'2026-10-23',desconto:300,cancelado:true},
 {id:'SEPTEMBER',idFuncionario:'F1',data:'2026-09-20',desconto:100}
];
const worker={id:'F1',perfil:'Funcionário'};
const mock={rows:async()=>structuredClone(records)};

test('employee sees only own active arrivals for the selected month, even with another employee ID in request',async()=>{
 const result=await attendance.myHistory(mock,common,{mes:'2026-10',idFuncionario:'F2'},worker);
 assert.deepEqual(result.registros.map(r=>r.data),['2026-10-22','2026-10-21','2026-10-20']);
 assert.deepEqual(result.resumo,{diasRegistrados:3,atrasoMinutos:80,minutosDescontados:30,descontoAtrasos:5});
 assert.equal(result.resumo.descontoAtrasos,(await attendance.totals(mock,'2026-10','F1')).descontoAtrasos);
 const json=JSON.stringify(result);for(const secret of ['salario','historico','observacao','Nota interna','atualizadoPor','F2'])assert.equal(json.includes(secret),false);
 assert.equal(result.registros[0].abonado,true);
});

test('personal history validates role and month, and returns an explicit zero for empty months',async()=>{
 for(const user of [{id:'F1',perfil:'Revendedor'},{id:'A1',perfil:'Administrador'},{perfil:'Funcionário'}])await assert.rejects(attendance.myHistory(mock,common,{mes:'2026-10'},user),/exclusiva/);
 for(const mes of ['2026-00','2026-13','bad',''])await assert.rejects(attendance.myHistory(mock,common,{mes},worker),/mês válido/);
 const empty=await attendance.myHistory(mock,common,{mes:'2026-08'},worker);assert.equal(empty.registros.length,0);assert.equal(empty.resumo.descontoAtrasos,0);
});

test('authenticated worker can query personal history but cannot read admin history or save arrivals',async()=>{
 const original={get:db.get,rows:db.rows,query:db.query};
 const response=()=>({setHeader(){},status(n){this.code=n;return this},json(body){this.body=body;return this}});
 const request=body=>({method:'POST',headers:{host:'example.test',origin:'https://example.test',cookie:'ct_session=test-session'},body});
 try{
  db.query=async()=>[{employee_id:'F1'}];db.get=async()=>({ID:'F1',Nome:'Ana',Perfil:'Funcionário',Status:'Ativo'});db.rows=mock.rows;
  const mine=response();await handler(request({acao:'listarMinhasChegadas',mes:'2026-10',idFuncionario:'F2'}),mine);assert.equal(mine.body.sucesso,true);assert.equal(mine.body.resumo.descontoAtrasos,5);
  const all=response();await handler(request({acao:'listarChegadas',mes:'2026-10'}),all);assert.equal(all.body.sucesso,false);assert.match(all.body.mensagem,/administradores/);
  const save=response();await handler(request({acao:'salvarChegada',idFuncionario:'F1',data:'2026-10-23',previsto:'10:00',chegada:'10:00'}),save);assert.equal(save.body.sucesso,false);assert.match(save.body.mensagem,/administradores/);
  const anonymous=response(),req=request({acao:'listarMinhasChegadas',mes:'2026-10'});req.headers.cookie='';await handler(req,anonymous);assert.equal(anonymous.body.sucesso,false);assert.match(anonymous.body.mensagem,/Sessão expirada/);
 }finally{Object.assign(db,original)}
});
