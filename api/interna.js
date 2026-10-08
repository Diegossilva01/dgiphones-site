const crypto=require('node:crypto');
const db=require('../lib/db');
const c=require('../lib/common');
const finance=require('../lib/finance');

const confirmation=new Set(['cadastrarCompra','excluirCompra','editarCompra','atualizarProdutoSite','excluirProdutoSite','cadastrarVenda','excluirVenda','editarVenda','cadastrarNotaProduto','cadastrarOS','cadastrarFuncionario','excluirFuncionario','removerFuncionario','deletarFuncionario','salvarMeuPix','alterarStatusComissaoVenda','registrarPagamentoEquipe','solicitarVale','alterarStatusVale','cadastrarRevendedor']);
const key={Compras:'ID Compra',Estoque:'ID Estoque',Vendas:'ID Venda',Funcionarios:'ID',OrdensServico:'ID OS'};
const bad=message=>{throw Error(message)};
const requiredAdmin=u=>{if(c.normal(u.perfil)!=='administrador')bad('Apenas administradores podem executar esta ação.')};
const isAdmin=u=>c.normal(u.perfil)==='administrador';
const active=u=>c.normal(u.Status)==='ativo';
const publicUser=f=>({id:f.ID,nome:f.Nome,usuario:f['Usuário'],perfil:f.Perfil||'Funcionário',status:f.Status||'Ativo',salario:c.money(f['Salário']),chavePix:f['Chave PIX']||'',tipoChavePix:f['Tipo chave PIX']||'',valeRefeicaoDia:c.money(f['Vale refeição dia']),diasSemana:Number(f['Dias por semana'])||6,dataCadastro:c.iso(f['Data de cadastro']),dataCadastroMs:c.stamp(f['Data de cadastro'])});
const cookieValue=req=>{const match=String(req.headers.cookie||'').match(/(?:^|;\s*)ct_session=([^;]+)/);return match?decodeURIComponent(match[1]):''};
const cookie=(res,token='',seconds=0)=>res.setHeader('Set-Cookie',`ct_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`);
async function authenticate(req){
  const token=cookieValue(req);if(!token)bad('Sessão expirada. Faça login novamente.');
  const digest=c.hash(token);
  const result=await db.query('SELECT employee_id FROM ct_sessions WHERE token_hash=$1 AND expires_at>now()',[digest]);
  if(!result.length)bad('Sessão expirada. Faça login novamente.');
  const f=await db.get('Funcionarios',result[0].employee_id);
  if(!f||!active(f))bad('Usuário inativo ou não encontrado.');
  return {user:publicUser(f),record:f};
}
async function login(d,res){
  const all=await db.rows('Funcionarios');
  const f=all.find(x=>c.normal(x['Usuário'])===c.normal(d.usuario)&&active(x)&&crypto.timingSafeEqual(Buffer.from(c.hash(d.senha||'')),Buffer.from(String(x['Senha Hash']||'').padEnd(64,' ').slice(0,64))));
  if(!f)return {sucesso:false,mensagem:'Usuário ou senha inválidos.'};
  const token=crypto.randomBytes(32).toString('hex');
  await db.query("INSERT INTO ct_sessions(token_hash,employee_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[c.hash(token),String(f.ID)]);
  cookie(res,token,8*3600);
  return {sucesso:true,token:'cookie',funcionario:publicUser(f)};
}
const list=async name=>(await db.rows(name)).map(db.clean);
const one=async(name,id)=>{const r=await db.get(name,id);if(!r)bad('Registro não encontrado.');return r};
const save=async(name,r)=>{const keyName=key[name]||Object.keys(r).find(x=>x.startsWith('ID '));const id=r[keyName];const rows=await db.put(name,id,db.clean(r));if(!rows.length)bad('Registro não encontrado.');return r};
const numbered=(name,idName)=>db.rows(name).then(x=>x.filter(r=>r[idName]));
async function storePhotos(d){
  const raw=Array.isArray(d.fotosData)&&d.fotosData.length?d.fotosData:(d.fotoData?[d.fotoData]:[]);
  if(raw.length>6)bad('É permitido enviar no máximo 6 fotos por produto.');
  const stored=[];
  for(const item of raw){
    const match=String(item).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if(!match)bad('Formato de foto inválido. Use JPG, PNG ou WebP.');
    const content=Buffer.from(match[2],'base64');
    if(!content.length||content.length>400000)bad('Cada foto deve ter no máximo 400 KB.');
    const photoId=crypto.randomUUID();
    await db.query('INSERT INTO ct_photos(photo_id,mime_type,bytes) VALUES($1,$2,decode($3,\'base64\'))',[photoId,match[1],match[2]]);
    stored.push({id:photoId,url:`/api/foto?id=${photoId}`});
  }
  return stored;
}
function attachPhotos(r,stored){if(!stored.length)return;r['Foto URL']=stored[0].url;r['Foto ID']=stored[0].id;r['Fotos URLs']=JSON.stringify(stored.map(f=>f.url));r['Fotos IDs']=JSON.stringify(stored.map(f=>f.id))}
async function catalog(){
  return (await list('Estoque')).filter(r=>c.normal(r.Status)==='disponivel'&&['Publicado','Reservado'].includes(r['Status site'])).map(r=>{
    const fotos=c.photos(r['Fotos URLs']);if(!fotos.length&&r['Foto URL'])fotos.push(r['Foto URL']);
    return {id:r['ID Estoque'],modelo:r.Modelo,armazenamento:r.Armazenamento,cor:r.Cor,preco:c.money(r['Preço site']),categoria:r['Categoria site']||'iPhone',condicao:r['Condição site']||'Seminovo',bateria:r['Bateria site']||'',status:r['Status site'],foto:fotos[0]||'',fotos};
  });
}
async function quote(d){
  if(!c.text(d.nome)||!c.text(d.telefone)||!c.text(d.modelo))bad('Dados incompletos para a cotação.');
  const idCotacao=c.text(d.idCotacao)||c.id('COT');
  const r={'ID Cotação':idCotacao,'Data e hora':c.now(),Nome:c.text(d.nome),WhatsApp:c.text(d.telefone),Modelo:c.text(d.modelo),Armazenamento:c.text(d.armazenamento),Cor:c.text(d.cor),'Liga normalmente':c.text(d.liga),Tela:c.text(d.tela),Traseira:c.text(d.traseira),'Saúde da bateria':c.text(d.bateria),'Peças trocadas':c.text(d.pecas),'UTM Source':c.text(d.utm_source),'UTM Medium':c.text(d.utm_medium),'UTM Campaign':c.text(d.utm_campaign),GCLID:c.text(d.gclid),FBCLID:c.text(d.fbclid),'Página':c.text(d.pagina),Dispositivo:c.text(d.dispositivo),'E-mail enviado':'Não','E-mail destino':''};
  const created=await db.add('CotacoesSite',idCotacao,r);
  if(!created.length)return {sucesso:true,idCotacao,duplicada:true,emailEnviado:false};
  const to=process.env.COTACOES_EMAIL,from=process.env.EMAIL_FROM,apiKey=process.env.RESEND_API_KEY;
  let emailEnviado=false,aviso='Cotação salva no banco; aviso por e-mail não configurado.';
  if(to&&from&&apiKey){
    try{
      const mail=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject:`Nova cotação de iPhone - ${c.text(d.modelo)} - ${c.text(d.nome)}`,text:Object.entries(r).filter(([k])=>!['E-mail enviado','E-mail destino'].includes(k)).map(([k,v])=>`${k}: ${v}`).join('\n')}),signal:AbortSignal.timeout(8000)});
      if(!mail.ok)throw Error(`Resposta ${mail.status}`);
      r['E-mail enviado']='Sim';r['E-mail destino']=to;await db.put('CotacoesSite',idCotacao,r);emailEnviado=true;aviso='';
    }catch(err){console.error('Falha no aviso por e-mail',err.message);aviso='Cotação salva, mas o aviso por e-mail falhou.'}
  }
  return {sucesso:true,idCotacao,emailEnviado,emailDestino:emailEnviado?to:'',aviso};
}
async function maintenance(d){
  const reparos=Array.isArray(d.reparos)?d.reparos.filter(Boolean):c.text(d.reparos).split('|').filter(Boolean);
  if(!c.text(d.whatsapp)||!c.text(d.modelo)||!reparos.length)bad('Dados incompletos para a manutenção.');
  const idManutencao=c.text(d.idManutencao)||c.id('MAN');
  const r={'ID Manutenção':idManutencao,'Data e hora':c.now(),WhatsApp:c.text(d.whatsapp),Modelo:c.text(d.modelo),Reparos:reparos.join(' | '),Detalhes:c.text(d.detalhes),'UTM Source':c.text(d.utm_source),'UTM Medium':c.text(d.utm_medium),'UTM Campaign':c.text(d.utm_campaign),GCLID:c.text(d.gclid),FBCLID:c.text(d.fbclid),'Página':c.text(d.pagina),Dispositivo:c.text(d.dispositivo),Status:'Novo'};
  const created=await db.add('ManutencoesSite',idManutencao,r);
  return {sucesso:true,idManutencao,duplicada:!created.length};
}
const leadCollections={cotacao:['CotacoesSite','ID Cotação'],manutencao:['ManutencoesSite','ID Manutenção']};
const leadStatus=['Novo','Em contato','Atendido','Celular comprado','Oferta recusada','Serviço finalizado'];
function leadView(tipo,r){
  const idField=leadCollections[tipo][1];
  const status=r['Situação atendimento']==='Não fechou'?'Oferta recusada':r['Situação atendimento']||'Novo';
  return {tipo,id:String(r[idField]||''),data:r['Data e hora']||'',nome:r.Nome||'',whatsapp:r.WhatsApp||'',modelo:r.Modelo||'',status,observacao:r['Observação interna']||'',atualizadoPor:r['Atendimento atualizado por']||'',atualizadoEm:r['Atendimento atualizado em']||'',dados:db.clean(r)};
}
function phoneDigits(value){
  const digits=c.text(value).replace(/\D/g,'');
  return digits.startsWith('55')&&digits.length>11?digits.slice(2):digits;
}
function filtered(items,d,date,fields){const start=c.iso(d.dataInicial),end=c.iso(d.dataFinal),q=c.normal(d.pesquisa);return items.filter(r=>{const day=c.iso(r[date]);return (!start||day>=start)&&(!end||day<=end)&&(!q||fields.some(f=>c.normal(r[f]).includes(q)))}).reverse()}
function summary(vendas,compras,estoque){
  const today=c.today(),month=today.slice(0,7),sum=(a,k)=>a.reduce((s,r)=>s+c.money(r[k]),0);
  const vh=vendas.filter(r=>c.iso(r['Data da venda'])===today),vm=vendas.filter(r=>c.iso(r['Data da venda']).slice(0,7)===month),ch=compras.filter(r=>c.iso(r['Data da compra'])===today),cm=compras.filter(r=>c.iso(r['Data da compra']).slice(0,7)===month),disp=estoque.filter(r=>c.normal(r.Status)==='disponivel');
  const resumo={faturamentoHoje:sum(vh,'Valor da venda'),faturamentoMes:sum(vm,'Valor da venda'),lucroHoje:sum(vh,'Lucro'),lucroMes:sum(vm,'Lucro'),quantidadeVendasHoje:vh.length,quantidadeVendasMes:vm.length,comprasHoje:ch.length,comprasMes:cm.length,valorComprasHoje:sum(ch,'Valor da compra'),valorComprasMes:sum(cm,'Valor da compra'),aparelhosDisponiveis:disp.length,valorEstoque:sum(disp,'Valor de custo'),ticketMedioMes:vm.length?sum(vm,'Valor da venda')/vm.length:0};
  const grafico=Array.from({length:30},(_,i)=>{const date=new Date(Date.now()-(29-i)*864e5).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),items=vendas.filter(v=>c.iso(v['Data da venda'])===date);return {data:`${date.slice(8)}/${date.slice(5,7)}`,faturamento:sum(items,'Valor da venda'),lucro:sum(items,'Lucro'),quantidade:items.length}});
  return {sucesso:true,resumo,grafico};
}
async function action(a,d,u){
  let r,items;
  switch(a){
    case 'listarLeadsSite':{
      const both=await Promise.all(Object.entries(leadCollections).map(async([tipo,[collection]])=>(await db.rows(collection)).map(r=>leadView(tipo,r))));
      const leads=both.flat().sort((x,y)=>c.stamp(y.data)-c.stamp(x.data));
      return {sucesso:true,leads};
    }
    case 'atualizarLeadSite':{
      const tipo=c.text(d.tipo),config=leadCollections[tipo],leadId=c.text(d.id),status=c.text(d.status),observacao=c.text(d.observacao);
      if(!config||!leadId||!leadStatus.includes(status)||(tipo==='manutencao'&&status==='Celular comprado')||(tipo==='cotacao'&&status==='Serviço finalizado'))bad('Confira o atendimento e a situação selecionada.');
      if(observacao.length>2000)bad('A observação deve ter até 2000 caracteres.');
      const changes={'Situação atendimento':status,'Observação interna':observacao,'Atendimento atualizado por':u.nome,'Atendimento atualizado em':c.now()};
      const updated=await db.query('UPDATE ct_records SET data=data || $3::jsonb WHERE collection=$1 AND record_key=$2 RETURNING data',[config[0],leadId,JSON.stringify(changes)]);
      if(!updated.length)bad('Solicitação não encontrada. Atualize a lista.');
      return {sucesso:true,lead:leadView(tipo,updated[0].data),mensagem:'Atendimento salvo.'};
    }
    case 'listarCompras':return {sucesso:true,compras:filtered(await list('Compras'),d,'Data da compra',['Nome do vendedor','CPF','Telefone','Modelo','IMEI','IMEI 2'])};
    case 'listarVendas':return {sucesso:true,vendas:filtered(await list('Vendas'),d,'Data da venda',['Nome do cliente','CPF','Telefone','Modelo','IMEI','IMEI 2','Funcionário responsável'])};
    case 'listarEstoque':return {sucesso:true,estoque:(await list('Estoque')).filter(x=>(!d.status||c.normal(x.Status)===c.normal(d.status))&&(!d.pesquisa||['Modelo','Armazenamento','Cor','IMEI','IMEI 2'].some(k=>c.normal(x[k]).includes(c.normal(d.pesquisa))))).reverse()};
    case 'listarProdutosSite':return {sucesso:true,produtos:(await list('Estoque')).filter(x=>c.normal(x.Status)!=='vendido').reverse()};
    case 'listarCatalogoRevendedor':{
      if(c.normal(u.perfil)!=='revendedor')bad('Acesso permitido somente para revendedores.');
      const produtos=(await catalog()).filter(x=>x.status==='Publicado');
      const inventory=await list('Estoque');
      return {sucesso:true,produtos:produtos.map(p=>{const x=inventory.find(r=>r['ID Estoque']===p.id);return {...p,precoNormal:p.preco,precoRevenda:c.money(x['Preço revenda']),comentarioRevendedor:x['Comentário revendedor']||''}}).filter(p=>p.precoRevenda>0)};
    }
    case 'dadosSistema':return {sucesso:true,agora:c.now(),vendas:await list('Vendas'),compras:await list('Compras'),estoque:await list('Estoque')};
    case 'dashboard':requiredAdmin(u);return summary(await list('Vendas'),await list('Compras'),await list('Estoque'));
    case 'cadastrarCompra':{
      const cpf=c.text(d.cpf).replace(/\D/g,''),imei=c.text(d.imei).replace(/\D/g,''),imei2=c.text(d.imei2).replace(/\D/g,''),valor=c.money(d.valorCompra);
      if(!c.text(d.nome)||!c.cpfOk(cpf)||!c.text(d.modelo)||imei.length!==15||valor<=0||imei2&&imei2.length!==15)bad('Confira os campos obrigatórios.');
      const all=await list('Estoque');if(all.some(x=>[x.IMEI,x['IMEI 2']].includes(imei)||(imei2&&[x.IMEI,x['IMEI 2']].includes(imei2))))bad('Um dos IMEIs já está cadastrado.');
      const idCompra=c.id('COMPRA'),idEstoque=c.id('ESTOQUE');
      const compra={'ID Compra':idCompra,'Data da compra':c.br(d.dataCompra),'Data de cadastro':c.now(),'Nome do vendedor':c.text(d.nome),CPF:c.cpf(cpf),Telefone:c.text(d.telefone),Modelo:c.text(d.modelo),Armazenamento:c.text(d.armazenamento),Cor:c.text(d.cor),IMEI:imei,'IMEI 2':imei2,'Valor da compra':valor,'Forma de pagamento':c.text(d.formaPagamento),'Observações':c.text(d.observacoes),'Funcionário responsável':u.nome,'ID Funcionário':u.id};
      const estoque={'ID Estoque':idEstoque,'ID Compra':idCompra,'Data de entrada':c.br(d.dataCompra),Modelo:compra.Modelo,Armazenamento:compra.Armazenamento,Cor:compra.Cor,IMEI:imei,'IMEI 2':imei2,'Valor de custo':valor,Status:'Disponível','ID Venda':'','Data da venda':'','Funcionário responsável':u.nome,'Preço site':c.money(d.precoSite),'Categoria site':c.text(d.categoriaSite)||'iPhone','Condição site':c.text(d.condicaoSite)||'Seminovo','Bateria site':c.text(d.bateriaSite),'Status site':['Publicado','Oculto','Reservado'].includes(d.statusSite)?d.statusSite:'Oculto','Foto URL':'','Foto ID':'','Fotos URLs':'[]','Fotos IDs':'[]','Preço revenda':c.money(d.precoRevenda),'Comentário revendedor':c.text(d.comentarioRevendedor)};
      attachPhotos(estoque,await storePhotos(d));
      // A compra e o estoque entram juntos em uma instrução atômica.
      await db.query("WITH compra AS (INSERT INTO ct_records(collection,record_key,source_row,data) VALUES('Compras',$1,nextval('ct_row_seq'),$2::jsonb) RETURNING record_key) INSERT INTO ct_records(collection,record_key,source_row,data) SELECT 'Estoque',$3,nextval('ct_row_seq'),$4::jsonb FROM compra",[idCompra,JSON.stringify(compra),idEstoque,JSON.stringify(estoque)]);
      return {sucesso:true,idCompra,idEstoque,mensagem:'Compra cadastrada.'};
    }
    case 'cadastrarVenda':{
      const valor=c.money(d.valorVenda),cpf=c.text(d.cpf).replace(/\D/g,'');if(!c.text(d.nome)||!c.cpfOk(cpf)||!d.idEstoque||valor<=0)bad('Confira os campos obrigatórios.');
      const x=await one('Estoque',d.idEstoque);if(c.normal(x.Status)!=='disponivel')bad('Este aparelho não está disponível.');
      const idVenda=c.id('VENDA'),lucro=valor-c.money(x['Valor de custo']);
      const venda={'ID Venda':idVenda,'Data da venda':c.br(d.dataVenda),'Data de cadastro':c.now(),'Nome do cliente':c.text(d.nome),CPF:c.cpf(cpf),Telefone:c.text(d.telefone),'ID Estoque':x['ID Estoque'],Modelo:x.Modelo,Armazenamento:x.Armazenamento,Cor:x.Cor,IMEI:x.IMEI,'IMEI 2':x['IMEI 2'],'Valor de custo':c.money(x['Valor de custo']),'Valor da venda':valor,Lucro:lucro,'Forma de pagamento':c.text(d.formaPagamento),'Observações':c.text(d.observacoes),'Funcionário responsável':u.nome,'ID Funcionário':u.id,'Status comissão':'Pendente','Comissão atualizada por':'','Comissão atualizada em':''};
      const updated={...db.clean(x),Status:'Vendido','ID Venda':idVenda,'Data da venda':c.br(d.dataVenda),'Funcionário responsável':u.nome,'Status site':'Vendido'};
      // Reserva atômica do item: duas vendas concorrentes não podem vender o mesmo aparelho.
      const rows=await db.query("WITH reservado AS (UPDATE ct_records SET data=$2::jsonb WHERE collection='Estoque' AND record_key=$1 AND data->>'Status'='Disponível' RETURNING record_key) INSERT INTO ct_records(collection,record_key,source_row,data) SELECT 'Vendas',$3,nextval('ct_row_seq'),$4::jsonb FROM reservado RETURNING record_key",[d.idEstoque,JSON.stringify(updated),idVenda,JSON.stringify(venda)]);
      if(!rows.length)bad('Este aparelho já foi vendido. Atualize o estoque.');
      return {sucesso:true,idVenda,lucro,mensagem:'Venda cadastrada.'};
    }
    case 'editarVenda':{
      r=await one('Vendas',d.idVenda);if(!isAdmin(u)&&r['ID Funcionário']!==u.id)bad('Você só pode editar suas próprias vendas.');
      if(!c.cpfOk(d.cpf)||c.money(d.valorVenda)<=0)bad('Confira os campos obrigatórios.');
      Object.assign(r,{'Data da venda':c.br(d.dataVenda),'Nome do cliente':c.text(d.nome),CPF:c.cpf(d.cpf),Telefone:c.text(d.telefone),'Valor da venda':c.money(d.valorVenda),Lucro:c.money(d.valorVenda)-c.money(r['Valor de custo']),'Forma de pagamento':c.text(d.formaPagamento),'Observações':c.text(d.observacoes)});
      await save('Vendas',r);const inv=await one('Estoque',r['ID Estoque']);inv['Data da venda']=r['Data da venda'];await save('Estoque',inv);
      return {sucesso:true,lucro:r.Lucro,mensagem:'Venda alterada com sucesso.'};
    }
    case 'excluirVenda':{
      requiredAdmin(u);r=await one('Vendas',d.idVenda);const inv=await one('Estoque',r['ID Estoque']);
      const restored={...db.clean(inv),Status:'Disponível','ID Venda':'','Data da venda':'','Funcionário responsável':u.nome,'Status site':'Oculto'};
      await db.query("WITH deleted AS (DELETE FROM ct_records WHERE collection='Vendas' AND record_key=$1 RETURNING data) UPDATE ct_records SET data=$3::jsonb WHERE collection='Estoque' AND record_key=$2 AND EXISTS(SELECT 1 FROM deleted)",[d.idVenda,inv['ID Estoque'],JSON.stringify(restored)]);
      await log('Venda',d.idVenda,d.motivo,u,r);return {sucesso:true};
    }
    case 'editarCompra':{
      r=await one('Compras',d.idCompra);if(!isAdmin(u)&&r['ID Funcionário']!==u.id)bad('Você só pode editar suas próprias compras.');
      const inv=(await db.rows('Estoque')).find(x=>x['ID Compra']===d.idCompra);if(!inv||c.normal(inv.Status)==='vendido')bad('Não é possível alterar uma compra vendida.');
      const cpf=c.text(d.cpf).replace(/\D/g,''),imei=c.text(d.imei).replace(/\D/g,''),imei2=c.text(d.imei2).replace(/\D/g,'');if(!c.cpfOk(cpf)||imei.length!==15||imei2&&imei2.length!==15||c.money(d.valorCompra)<=0)bad('Confira os campos obrigatórios.');
      if((await list('Estoque')).some(x=>x['ID Estoque']!==inv['ID Estoque']&&[x.IMEI,x['IMEI 2']].some(v=>v===imei||imei2&&v===imei2)))bad('Um dos IMEIs já está cadastrado.');
      Object.assign(r,{'Data da compra':c.br(d.dataCompra),'Nome do vendedor':c.text(d.nome),CPF:c.cpf(cpf),Telefone:c.text(d.telefone),Modelo:c.text(d.modelo),Armazenamento:c.text(d.armazenamento),Cor:c.text(d.cor),IMEI:imei,'IMEI 2':imei2,'Valor da compra':c.money(d.valorCompra),'Forma de pagamento':c.text(d.formaPagamento),'Observações':c.text(d.observacoes)});
      Object.assign(inv,{'Data de entrada':r['Data da compra'],Modelo:r.Modelo,Armazenamento:r.Armazenamento,Cor:r.Cor,IMEI:imei,'IMEI 2':imei2,'Valor de custo':r['Valor da compra']});
      if(d.precoSite!==undefined)inv['Preço site']=c.money(d.precoSite);
      if(d.precoRevenda!==undefined)inv['Preço revenda']=c.money(d.precoRevenda);
      if(d.categoriaSite!==undefined)inv['Categoria site']=c.text(d.categoriaSite);
      if(d.condicaoSite!==undefined)inv['Condição site']=c.text(d.condicaoSite);
      if(d.bateriaSite!==undefined)inv['Bateria site']=c.text(d.bateriaSite);
      if(d.statusSite!==undefined)inv['Status site']=d.statusSite;
      attachPhotos(inv,await storePhotos(d));await save('Compras',r);await save('Estoque',inv);
      return {sucesso:true,mensagem:'Compra e informações do site alteradas com sucesso.'};
    }
    case 'excluirCompra':{
      requiredAdmin(u);r=await one('Compras',d.idCompra);const inv=(await db.rows('Estoque')).find(x=>x['ID Compra']===d.idCompra);
      if(inv&&c.normal(inv.Status)==='vendido')bad('O aparelho já foi vendido.');
      await db.query("WITH removed AS (DELETE FROM ct_records WHERE collection='Compras' AND record_key=$1 RETURNING record_key) DELETE FROM ct_records WHERE collection='Estoque' AND data->>'ID Compra'=$1 AND EXISTS(SELECT 1 FROM removed)",[d.idCompra]);
      await log('Compra',d.idCompra,d.motivo,u,r);return {sucesso:true};
    }
    case 'atualizarProdutoSite':{
      r=await one('Estoque',d.idEstoque);if(c.normal(r.Status)==='vendido')bad('Produto já vendido.');
      if(d.valorCusto!==undefined){if(c.money(d.valorCusto)<=0)bad('Valor pago inválido.');r['Valor de custo']=c.money(d.valorCusto);const purchase=await db.get('Compras',r['ID Compra']);if(purchase){purchase['Valor da compra']=r['Valor de custo'];await save('Compras',purchase)}}
      for(const [field,source] of [['Preço site','precoSite'],['Preço revenda','precoRevenda']])if(d[source]!==undefined)r[field]=c.money(d[source]);
      for(const [field,source] of [['Categoria site','categoriaSite'],['Condição site','condicaoSite'],['Bateria site','bateriaSite'],['Status site','statusSite'],['Comentário revendedor','comentarioRevendedor']])if(d[source]!==undefined)r[field]=c.text(d[source]);
      if(!['Publicado','Oculto','Reservado'].includes(r['Status site'])||d.precoSite!==undefined&&c.money(r['Preço site'])<=0)bad('Confira o preço e o status do produto.');
      attachPhotos(r,await storePhotos(d));await save('Estoque',r);return {sucesso:true,mensagem:'Produto atualizado.'};
    }
    case 'excluirProdutoSite':{
      requiredAdmin(u);if(!c.text(d.motivo))bad('Informe o motivo da exclusão.');r=await one('Estoque',d.idEstoque);if(c.normal(r.Status)==='vendido')bad('Não é possível excluir um produto vendido.');
      await db.del('Estoque',d.idEstoque);await log('Produto do site',d.idEstoque,d.motivo,u,r);return {sucesso:true,mensagem:'Produto excluído.'};
    }
    case 'listarOS':{
      items=filtered(await list('OrdensServico'),d,'Data da OS',['ID OS','Nome do cliente','Telefone','Aparelho / produto','Descrição do serviço']);
      if(d.status==='ativos')items=items.filter(x=>x.Status!=='Entregue');else if(d.status)items=items.filter(x=>x.Status===d.status);
      return {sucesso:true,ordens:items};
    }
    case 'localizarOSContato':{
      const digits=phoneDigits(d.telefone);
      if(digits.length<10)bad('Número de telefone insuficiente para buscar OS.');
      const ordens=(await list('OrdensServico')).filter(os=>phoneDigits(os.Telefone)===digits).map(os=>({idOS:os['ID OS'],dataOS:os['Data da OS'],status:os.Status||'Recebido',aparelho:os['Aparelho / produto']||''})).reverse();
      return {sucesso:true,ordens};
    }
    case 'cadastrarOS':{
      if(!c.text(d.nome)||!c.text(d.descricao)||c.money(d.valor)<=0||d.cpf&&!c.cpfOk(d.cpf))bad('Confira os dados da OS.');
      const idOS=c.id('OS'),status=d.status||'Recebido';if(!['Recebido','Em manutenção','Aguardando peça','Pronto para retirada','Entregue'].includes(status))bad('Status inválido.');
      r={'ID OS':idOS,'Data da OS':c.br(d.dataOS),'Data de cadastro':c.now(),'Nome do cliente':c.text(d.nome),CPF:d.cpf?c.cpf(d.cpf):'',Telefone:c.text(d.telefone),'Aparelho / produto':c.text(d.produto),'Descrição do serviço':c.text(d.descricao),Valor:c.money(d.valor),'Custo da peça / serviço':d.custoPeca===''?'':c.money(d.custoPeca),'Forma de pagamento':c.text(d.formaPagamento),'Observações':c.text(d.observacoes),'Funcionário responsável':u.nome,'ID Funcionário':u.id,Status:status,'Status atualizado por':u.nome,'Status atualizado em':c.now(),'Custo atualizado por':d.custoPeca!==''?u.nome:'','Custo atualizado em':d.custoPeca!==''?c.now():'','Chave pública':crypto.randomBytes(16).toString('hex')};
      await db.add('OrdensServico',idOS,r);return {sucesso:true,idOS,mensagem:'OS salva.'};
    }
    case 'alterarStatusOS':case 'atualizarCustoOS':{
      r=await one('OrdensServico',d.idOS);
      if(a==='alterarStatusOS'){
        if(!['Recebido','Em manutenção','Aguardando peça','Pronto para retirada','Entregue'].includes(d.status))bad('Status inválido.');
        Object.assign(r,{Status:d.status,'Status atualizado por':u.nome,'Status atualizado em':c.now()});await save('OrdensServico',r);
        if(d.status==='Entregue'){
          const phone=phoneDigits(r.Telefone);
          if(phone.length>=10){
            const candidates=(await db.rows('ManutencoesSite')).filter(lead=>phoneDigits(lead.WhatsApp)===phone&&!['Serviço finalizado','Oferta recusada','Não fechou'].includes(lead['Situação atendimento']));
            if(candidates.length===1){
              const lead=candidates[0];
              await db.query('UPDATE ct_records SET data=data || $3::jsonb WHERE collection=$1 AND record_key=$2',[ 'ManutencoesSite',lead['ID Manutenção'],JSON.stringify({'Situação atendimento':'Serviço finalizado','ID OS vinculada':d.idOS,'Atendimento atualizado por':u.nome,'Atendimento atualizado em':c.now()})]);
            }
          }
        }
        return {sucesso:true,idOS:d.idOS,status:d.status};
      }
      if(d.custoPeca===''||d.custoPeca==null||c.money(d.custoPeca)<0)bad('Informe um custo válido.');
      Object.assign(r,{'Custo da peça / serviço':c.money(d.custoPeca),'Custo atualizado por':u.nome,'Custo atualizado em':c.now()});await save('OrdensServico',r);return {sucesso:true,idOS:d.idOS,custoPeca:r['Custo da peça / serviço']};
    }
    case 'cadastrarNotaProduto':{
      if(!c.text(d.nome)||!c.text(d.produto)||c.money(d.valor)<=0||Number(d.quantidade)<1||d.cpf&&!c.cpfOk(d.cpf))bad('Confira os dados do recibo.');
      const idNota=c.id('RECIBO');r={'ID Nota':idNota,'Data da venda':c.br(d.dataVenda),'Data de cadastro':c.now(),'Nome do cliente':c.text(d.nome),CPF:d.cpf?c.cpf(d.cpf):'',Telefone:c.text(d.telefone),'Acessório vendido':c.text(d.produto),Quantidade:Number(d.quantidade), 'Valor total':c.money(d.valor),'Forma de pagamento':c.text(d.formaPagamento),'Garantia (dias)':Number(d.garantiaDias)||0,'Observações':c.text(d.observacoes),'Funcionário responsável':u.nome,'ID Funcionário':u.id};
      await db.add('RecibosAcessorios',idNota,r);return {sucesso:true,idNota,mensagem:'Recibo salvo.'};
    }
    case 'listarFuncionarios':requiredAdmin(u);return {sucesso:true,funcionarios:(await list('Funcionarios')).map(publicUser)};
    case 'listarRevendedores':return {sucesso:true,revendedores:(await list('Funcionarios')).filter(f=>c.normal(f.Perfil)==='revendedor').map(f=>{const x=publicUser(f);return {id:x.id,nome:x.nome,usuario:x.usuario,status:x.status,dataCadastro:x.dataCadastro}})};
    case 'cadastrarFuncionario':case 'cadastrarRevendedor':{
      if(a==='cadastrarFuncionario')requiredAdmin(u);
      const userName=c.normal(d.usuario),name=c.text(d.nome),password=String(d.senha||'');
      if(!name||userName.length<3||!d.idFuncionario&&password.length<6)bad('Confira o nome, usuário e senha (mínimo 6 caracteres).');
      const all=await db.rows('Funcionarios');if(all.some(x=>c.normal(x['Usuário'])===userName&&x.ID!==d.idFuncionario))bad('Este usuário já existe.');
      if(d.idFuncionario){r=await one('Funcionarios',d.idFuncionario);Object.assign(r,{Nome:name,'Usuário':userName,Perfil:d.perfil||'Funcionário',Status:d.status==='Inativo'?'Inativo':'Ativo','Salário':c.money(d.salario),'Vale refeição dia':c.money(d.valeRefeicaoDia),'Dias por semana':Number(d.diasSemana)||6});if(password)r['Senha Hash']=c.hash(password);if(d.chavePix!==undefined)r['Chave PIX']=c.text(d.chavePix);if(d.tipoChavePix!==undefined)r['Tipo chave PIX']=c.text(d.tipoChavePix);await save('Funcionarios',r);return {sucesso:true,mensagem:'Funcionário atualizado.'}}
      const idFunc=c.id('FUNC');r={ID:idFunc,Nome:name,'Usuário':userName,'Senha Hash':c.hash(password),Perfil:a==='cadastrarRevendedor'?'Revendedor':d.perfil||'Funcionário',Status:d.status==='Inativo'?'Inativo':'Ativo','Data de cadastro':c.now(),'Salário':c.money(d.salario),'Chave PIX':c.text(d.chavePix),'Vale refeição dia':c.money(d.valeRefeicaoDia),'Dias por semana':Number(d.diasSemana)||6,'Tipo chave PIX':c.text(d.tipoChavePix)};
      await db.add('Funcionarios',idFunc,r);return {sucesso:true,idRevendedor:a==='cadastrarRevendedor'?idFunc:undefined,mensagem:'Usuário cadastrado.'};
    }
    case 'salvarMeuPix':{
      const tipo=c.text(d.tipoChavePix),pix=c.text(d.chavePix);if(!['Telefone','E-mail','CPF/CNPJ','Chave aleatória'].includes(tipo)||pix.length<3)bad('Informe uma chave Pix válida.');
      r=await one('Funcionarios',u.id);r['Chave PIX']=pix;r['Tipo chave PIX']=tipo;await save('Funcionarios',r);return {sucesso:true,chavePix:pix,tipoChavePix:tipo,mensagem:'Chave Pix salva.'};
    }
    case 'excluirFuncionario':case 'removerFuncionario':case 'deletarFuncionario':{
      requiredAdmin(u);if(d.idFuncionario===u.id)bad('Você não pode excluir o seu próprio usuário.');
      r=await one('Funcionarios',d.idFuncionario);await db.del('Funcionarios',d.idFuncionario);await db.query('DELETE FROM ct_sessions WHERE employee_id=$1',[d.idFuncionario]);await log('Funcionário',d.idFuncionario,d.motivo||'Cadastro excluído pelo administrador',u,r);return {sucesso:true,mensagem:'Usuário excluído.'};
    }
    case 'listarVendasComissao':return finance.commissions(db,c,d,u);
    case 'alterarStatusComissaoVenda':return finance.changeCommission(db,c,d,u);
    case 'listarVales':return finance.listAdvances(db,c,d,u);
    case 'solicitarVale':return finance.requestAdvance(db,c,d,u);
    case 'alterarStatusVale':return finance.changeAdvance(db,c,d,u);
    case 'listarFinanceiroEquipe':return finance.team(db,c,d,u);
    case 'registrarPagamentoEquipe':return finance.payment(db,c,d,u);
    default:bad('Ação inválida.');
  }
}
async function log(type,id,reason,u,r){const logId=c.id('LOG');await db.add('LogExclusoes',logId,{'ID Log':logId,'Data e hora':c.now(),'Tipo de registro':type,'ID do registro':id,Motivo:c.text(reason),'Funcionário responsável':u.nome,'ID Funcionário':u.id,'Dados removidos':JSON.stringify(db.clean(r))})}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method!=='POST')return res.status(405).json({sucesso:false,mensagem:'Método inválido.'});
  const origin=req.headers.origin,host=req.headers.host;
  if(origin&&new URL(origin).host!==host)return res.status(403).json({sucesso:false,mensagem:'Origem não autorizada.'});
  try{
    const d=typeof req.body==='string'?JSON.parse(req.body):req.body||{},a=c.text(d.acao);
    if(a==='receberCotacaoSite')return res.json(await quote(d));
    if(a==='receberManutencaoSite')return res.json(await maintenance(d));
    if(a==='login')return res.json(await login(d,res));
    if(a==='logout'){const token=cookieValue(req);if(token)await db.query('DELETE FROM ct_sessions WHERE token_hash=$1',[c.hash(token)]);cookie(res);return res.json({sucesso:true})}
    const {user,record}=await authenticate(req);
    if(a==='verificarToken')return res.json({sucesso:true,funcionario:user});
    if(c.normal(user.perfil)==='revendedor'&&a!=='listarCatalogoRevendedor')bad('Seu acesso é exclusivo ao catálogo de revenda.');
    if(confirmation.has(a)&&c.hash(d.senhaConfirmacao||'')!==record['Senha Hash'])bad('Senha de confirmação incorreta.');
    return res.json(await action(a,d,user));
  }catch(err){
    console.error('Erro na API',err.message);
    return res.status(200).json({sucesso:false,mensagem:err.message||'Erro ao processar solicitação.'});
  }
};
module.exports._internals={publicUser,filtered,summary,catalog,action};
