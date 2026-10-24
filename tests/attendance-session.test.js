const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db');
const c=require('../lib/common');
const handler=require('../api/interna');

test('arrival save uses the administrator session without password confirmation; other protections remain',async()=>{
  const original={get:db.get,rows:db.rows,query:db.query};
  const admin={ID:'A1',Nome:'Admin',Perfil:'Administrador',Status:'Ativo','Senha Hash':c.hash('test-password')};
  const f={ID:'F1',Nome:'Ana',Perfil:'Funcionário',Status:'Ativo','Salário':2200,'Horas mensais':220};
  let inserts=0;
  const response=()=>({setHeader(){},status(n){this.code=n;return this},json(r){this.body=r;return this}});
  const request=(body,cookie='ct_session=test-session')=>({method:'POST',headers:{host:'example.test',origin:'https://example.test',cookie},body});
  try{
    db.get=async(name,id)=>name==='Funcionarios'?(id==='A1'?admin:f):null;
    db.rows=async()=>[];
    db.query=async(sql)=>{if(sql.startsWith('SELECT employee_id'))return [{employee_id:'A1'}];if(sql.includes('INSERT INTO ct_records')){inserts++;return [{record_key:'F1:2026-10-23'}]}return []};
    const payload={acao:'salvarChegada',idFuncionario:'F1',data:'2026-10-23',previsto:'10:00',chegada:'10:00'};
    const saved=response();await handler(request(payload),saved);assert.equal(saved.body.sucesso,true);assert.equal(saved.body.registro.desconto,0);assert.equal(inserts,1);
    const anonymous=response();await handler(request(payload,''),anonymous);assert.equal(anonymous.body.sucesso,false);assert.match(anonymous.body.mensagem,/Sessão expirada/);
    admin.Perfil='Funcionário';const worker=response();await handler(request(payload),worker);assert.equal(worker.body.sucesso,false);assert.match(worker.body.mensagem,/administradores/);assert.equal(inserts,1);
    admin.Perfil='Administrador';const payroll=response();await handler(request({acao:'registrarPagamentoEquipe',mes:'2026-10',idFuncionario:'F1',tipo:'salario'}),payroll);assert.equal(payroll.body.sucesso,false);assert.match(payroll.body.mensagem,/Senha de confirmação incorreta/);
  }finally{Object.assign(db,original)}
});
