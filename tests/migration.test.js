const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db');
const common=require('../lib/common');
const finance=require('../lib/finance');

test('imported hash authenticates and session cookie is HttpOnly',async()=>{
  const originalRows=db.rows,originalQuery=db.query;
  try{
    db.rows=async()=>[{ID:'FUNC-1',Nome:'Teste','Usuário':'operador','Senha Hash':common.hash('SenhaForte123'),Perfil:'Funcionário',Status:'Ativo','Data de cadastro':'01/01/2025'}];
    db.query=async()=>[];
    const handler=require('../api/interna');
    const req={method:'POST',body:{acao:'login',usuario:'operador',senha:'SenhaForte123'},headers:{host:'example.test',origin:'https://example.test'}};
    const res={headers:{},setHeader(k,v){this.headers[k]=v},status(x){this.code=x;return this},json(x){this.body=x;return this}};
    await handler(req,res);
    assert.equal(res.body.sucesso,true);
    assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/);
    assert.equal(res.body.funcionario.id,'FUNC-1');
  }finally{db.rows=originalRows;db.query=originalQuery}
});

test('catalog only exposes available published products',async()=>{
  const original=db.rows;
  try{
    db.rows=async()=>[
      {'ID Estoque':'1',Status:'Disponível','Status site':'Publicado',Modelo:'iPhone', 'Preço site':1234,'Fotos URLs':'["/api/foto?id=abc"]'},
      {'ID Estoque':'2',Status:'Vendido','Status site':'Publicado',Modelo:'Vendido'},
      {'ID Estoque':'3',Status:'Disponível','Status site':'Oculto',Modelo:'Oculto'}
    ];
    const {catalog}=require('../api/interna')._internals;
    const result=await catalog();
    assert.deepEqual(result.map(x=>x.id),['1']);
    assert.equal(result[0].foto,'/api/foto?id=abc');
  }finally{db.rows=original}
});

test('existing OS requires matching private key and never discloses CPF',async()=>{
  const original=db.get;
  try{
    db.get=async()=>({'ID OS':'OS-1','Chave pública':'secret',Status:'Recebido',CPF:'000.000.000-00','Aparelho / produto':'iPhone','Descrição do serviço':'Tela','Data da OS':'01/09/2026'});
    const handler=require('../api/acompanhar-os');
    const response=()=>({setHeader(){},status(x){this.code=x;return this},json(x){this.body=x;return this}});
    const wrong=response();await handler({query:{idOS:'OS-1',chave:'wrong'}},wrong);assert.equal(wrong.code,404);
    const good=response();await handler({query:{idOS:'OS-1',chave:'secret'}},good);assert.equal(good.body.sucesso,true);assert.equal(JSON.stringify(good.body).includes('CPF'),false);
  }finally{db.get=original}
});

test('fixed monthly salary is independent of elapsed days and admission within the month',()=>{
  const full=finance.payroll(common,{salario:3000,valeRefeicaoDia:20,diasSemana:5,dataCadastro:'2025-01-01'},'2026-08');
  assert.equal(full.salarioCalculado,3000);
  assert.ok(full.valeRefeicaoCalculado>0&&full.valeRefeicaoCalculado<=460);
  const later=finance.payroll(common,{salario:3000,valeRefeicaoDia:20,diasSemana:5,dataCadastro:'2026-08-25'},'2026-08');
  assert.equal(later.salarioCalculado,3000);
  assert.equal(later.valeRefeicaoCalculado,full.valeRefeicaoCalculado);
  assert.equal(later.dataPagamento,'2026-09-05');
});

test('panel lists historical quotes and maintenance requests and saves attendance',async()=>{
  const originalRows=db.rows,originalQuery=db.query;
  try{
    db.rows=async name=>name==='CotacoesSite'?
      [{'ID Cotação':'COT-1','Data e hora':'01/09/2026 14:00:00',Nome:'Ana',WhatsApp:'11999999999',Modelo:'iPhone 14'}]:
      [{'ID Manutenção':'MAN-1','Data e hora':'02/09/2026 14:00:00',WhatsApp:'11988888888',Modelo:'iPhone 13',Reparos:'Tela'}];
    const {action}=require('../api/interna')._internals;
    const listed=await action('listarLeadsSite',{}, {nome:'Operador',perfil:'Funcionário'});
    assert.equal(listed.leads.length,2);
    assert.equal(listed.leads.find(x=>x.id==='COT-1').status,'Novo');
    assert.equal(listed.leads[0].tipo,'manutencao');
    db.query=async(sql,params)=>{
      assert.match(sql,/WHERE collection=\$1 AND record_key=\$2/);
      assert.equal(params[0],'CotacoesSite');assert.equal(params[1],'COT-1');
      const update=JSON.parse(params[2]);assert.equal(update['Situação atendimento'],'Celular comprado');
      return [{data:{...listed.leads[1].dados,...update}}];
    };
    const saved=await action('atualizarLeadSite',{tipo:'cotacao',id:'COT-1',status:'Celular comprado',observacao:'Compra confirmada'}, {nome:'Operador',perfil:'Funcionário'});
    assert.equal(saved.lead.status,'Celular comprado');
    await assert.rejects(action('atualizarLeadSite',{tipo:'manutencao',id:'MAN-1',status:'Celular comprado'}, {nome:'Operador'}),/situação/);
  }finally{db.rows=originalRows;db.query=originalQuery}
});
