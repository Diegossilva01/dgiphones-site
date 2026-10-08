const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const db=require('../lib/db');
const c=require('../lib/common');
const handler=require('../api/interna');
const {action}=handler._internals;
const staff={id:'STAFF',nome:'Operador',perfil:'Funcionário'};
const admin={id:'ADMIN',nome:'Admin',perfil:'Administrador'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this},end(body){this.body=body;return this}});

test('staff cannot edit privileged users through reseller registration',async()=>{
  const original={...db};let writes=0;
  try{
    db.get=async()=>{throw Error('must not read target')};
    db.put=db.add=db.query=async()=>{writes++;return []};
    await assert.rejects(action('cadastrarRevendedor',{idFuncionario:'ADMIN',nome:'Alterado',usuario:'admin',senha:'secret123',perfil:'Administrador'},staff),/editar usuários/);
    await assert.rejects(action('cadastrarFuncionario',{idFuncionario:'ADMIN'},staff),/administradores/);
    assert.equal(writes,0);
  }finally{Object.assign(db,original)}
});

test('reseller registration ignores privileges, salary and Pix supplied by staff',async()=>{
  const original={...db};let saved;
  try{
    db.rows=async()=>[];db.add=async(name,id,data)=>{saved=data;return [{record_key:id}]};
    await action('cadastrarRevendedor',{nome:'Revenda',usuario:'revenda',senha:'secret123',perfil:'Administrador',salario:9999,chavePix:'alterado',valeRefeicaoDia:100},staff);
    assert.equal(saved.Perfil,'Revendedor');assert.equal(saved['Salário'],0);assert.equal(saved['Chave PIX'],'');assert.equal(saved['Vale refeição dia'],0);
    await assert.rejects(action('cadastrarRevendedor',{nome:'R',usuario:'revenda',senha:'secret123'},{perfil:'Revendedor'}),/Sem permissão/);
  }finally{Object.assign(db,original)}
});

test('admin edit still works and password change revokes existing sessions',async()=>{
  const original={...db};let saved,revoked;
  try{
    db.rows=async()=>[{ID:'F1','Usuário':'operador'}];
    db.get=async()=>({ID:'F1',Perfil:'Funcionário',Status:'Ativo'});
    db.put=async(name,id,data)=>{saved=data;return [{record_key:id}]};
    db.query=async(sql,params)=>{assert.match(sql,/DELETE FROM ct_sessions/);revoked=params[0];return []};
    await action('cadastrarFuncionario',{idFuncionario:'F1',nome:'Operador',usuario:'operador',senha:'nova123456',perfil:'Funcionário',salario:2000},admin);
    assert.equal(saved['Salário'],2000);assert.equal(saved['Senha Hash'],c.hash('nova123456'));assert.equal(revoked,'F1');
  }finally{Object.assign(db,original)}
});

test('public login contains no internal forms and protected shell requires a valid active session',async()=>{
  const html=fs.readFileSync(require.resolve('../funcionario.html'),'utf8');
  assert.ok(html.includes('id="loginForm"'));assert.ok(!html.includes('id="usuarioForm"'));assert.ok(!html.includes('id="app"'));
  const panel=require('../api/painel');const original={...db};
  try{
    const noSession=response();await panel({method:'GET',headers:{}},noSession);
    assert.equal(noSession.code,303);assert.equal(noSession.headers.Location,'/funcionario.html');assert.equal(noSession.body,undefined);
    db.query=async()=>[];const expired=response();await panel({method:'GET',headers:{cookie:'ct_session=expired'}},expired);assert.equal(expired.code,303);
    db.query=async()=>[{employee_id:'STAFF'}];db.get=async()=>({ID:'STAFF',Nome:'Operador',Perfil:'Funcionário',Status:'Ativo'});
    const valid=response();await panel({method:'GET',headers:{cookie:'ct_session=valid'}},valid);
    assert.equal(valid.code,200);assert.ok(valid.body.includes('id="app"'));assert.ok(valid.body.includes('<base href="/">'));assert.match(valid.headers['Cache-Control'],/no-store/);
    db.get=async()=>({ID:'STAFF',Perfil:'Funcionário',Status:'Inativo'});
    const inactive=response();await panel({method:'GET',headers:{cookie:'ct_session=valid'}},inactive);assert.equal(inactive.code,303);
  }finally{Object.assign(db,original)}
});

test('unauthenticated internal API request never reads employee data',async()=>{
  const original={...db};
  try{
    db.rows=async()=>{throw Error('unexpected database read')};
    const res=response();await handler({method:'POST',headers:{host:'example.test'},body:{acao:'listarFuncionarios'}},res);
    assert.equal(res.body.sucesso,false);assert.match(res.body.mensagem,/Sessão expirada/);
  }finally{Object.assign(db,original)}
});
