/**
 * SISTEMA INTERNO CELLTECH PANAMBY
 * Use este código em uma NOVA planilha / novo projeto Apps Script.
 * Execute configurarSistema() uma vez e depois implante como App da Web.
 */
const SYS={
  VENDAS:'Vendas',COMPRAS:'Compras',FUNCIONARIOS:'Funcionarios',LOG:'LogExclusoes',
  TZ:'America/Sao_Paulo',SESSION_SECONDS:21600
};

function configurarSistema(){
  const ss=SpreadsheetApp.getActive();
  criarAba_(ss,SYS.VENDAS,['ID','Criado em','Data da venda','Nome do cliente','CPF','Telefone','Produto / modelo','IMEI / Série','Forma de pagamento','Valor da venda','Funcionário','Usuário','Observações','Status']);
  criarAba_(ss,SYS.COMPRAS,['ID','Criado em','Data da compra','Nome da pessoa','CPF','Telefone','Modelo do aparelho','IMEI','Valor pago','Condição','Funcionário','Usuário','Observações','Status']);
  criarAba_(ss,SYS.FUNCIONARIOS,['ID','Nome','Usuário','Senha hash','Perfil','Ativo','Criado em']);
  criarAba_(ss,SYS.LOG,['Data e hora','Tipo','ID do registro','Usuário responsável','Dados excluídos']);
  const sh=ss.getSheetByName(SYS.FUNCIONARIOS);
  if(sh.getLastRow()===1) sh.appendRow([Utilities.getUuid(),'Administrador','admin',hash_('Trocar@123'),'admin','SIM',new Date()]);
  SpreadsheetApp.flush();
}
function criarAba_(ss,nome,cab){let sh=ss.getSheetByName(nome);if(!sh)sh=ss.insertSheet(nome);if(sh.getLastRow()===0){sh.appendRow(cab);sh.setFrozenRows(1);sh.getRange(1,1,1,cab.length).setFontWeight('bold').setBackground('#ffc400');sh.autoResizeColumns(1,cab.length)}}

function doGet(){return json_({success:true,message:'Sistema interno online.'})}
function doPost(e){
  try{
    const req=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    if(req.action==='login')return json_(login_(req));
    const user=validarSessao_(req.token);
    switch(req.action){
      case 'sessao':return json_({success:true,usuario:user});
      case 'salvarVenda':return json_(salvarVenda_(req.dados,user));
      case 'salvarCompra':return json_(salvarCompra_(req.dados,user));
      case 'listar':return json_(listar_(req,user));
      case 'dashboard':return json_(dashboard_(req,user));
      case 'excluir':return json_(excluir_(req,user));
      case 'criarFuncionario':return json_(criarFuncionario_(req.dados,user));
      default:throw new Error('Ação inválida.');
    }
  }catch(err){return json_({success:false,message:String(err.message||err)})}
}

function login_(r){
  const u=texto_(r.usuario).toLowerCase(),senha=String(r.senha||'');if(!u||!senha)throw new Error('Informe usuário e senha.');
  const rows=ler_(SYS.FUNCIONARIOS);const row=rows.find(x=>String(x[2]).toLowerCase()===u&&String(x[5]).toUpperCase()==='SIM');
  if(!row||row[3]!==hash_(senha))throw new Error('Usuário ou senha inválidos.');
  const token=Utilities.getUuid()+Utilities.getUuid();const usuario={id:row[0],nome:row[1],usuario:row[2],perfil:row[4]};
  CacheService.getScriptCache().put('sessao_'+token,JSON.stringify(usuario),SYS.SESSION_SECONDS);return{success:true,token,usuario};
}
function validarSessao_(token){if(!token)throw new Error('Sessão expirada. Entre novamente.');const raw=CacheService.getScriptCache().get('sessao_'+token);if(!raw)throw new Error('Sessão expirada. Entre novamente.');return JSON.parse(raw)}

function salvarVenda_(d,u){
  validarCampos_(d,['nomeCliente','cpf','data','produto','imei','pagamento','valor']);if(!cpfValido_(d.cpf))throw new Error('CPF inválido.');const valor=numero_(d.valor);if(valor<=0)throw new Error('Valor da venda inválido.');
  const id=Utilities.getUuid();SpreadsheetApp.getActive().getSheetByName(SYS.VENDAS).appendRow([id,new Date(),data_(d.data),texto_(d.nomeCliente),cpf_(d.cpf),texto_(d.telefone),texto_(d.produto),texto_(d.imei),texto_(d.pagamento),valor,u.nome,u.usuario,texto_(d.observacoes),'ATIVO']);return{success:true,id};
}
function salvarCompra_(d,u){
  validarCampos_(d,['nomePessoa','cpf','data','modelo','imei','valor','condicao']);if(!cpfValido_(d.cpf))throw new Error('CPF inválido.');const valor=numero_(d.valor);if(valor<=0)throw new Error('Valor da compra inválido.');
  const id=Utilities.getUuid();SpreadsheetApp.getActive().getSheetByName(SYS.COMPRAS).appendRow([id,new Date(),data_(d.data),texto_(d.nomePessoa),cpf_(d.cpf),texto_(d.telefone),texto_(d.modelo),texto_(d.imei),valor,texto_(d.condicao),u.nome,u.usuario,texto_(d.observacoes),'ATIVO']);return{success:true,id};
}
function criarFuncionario_(d,u){if(u.perfil!=='admin')throw new Error('Somente administradores podem cadastrar funcionários.');validarCampos_(d,['nome','usuario','senha']);if(String(d.senha).length<6)throw new Error('A senha deve ter pelo menos 6 caracteres.');const rows=ler_(SYS.FUNCIONARIOS);if(rows.some(r=>String(r[2]).toLowerCase()===texto_(d.usuario).toLowerCase()))throw new Error('Este usuário já existe.');SpreadsheetApp.getActive().getSheetByName(SYS.FUNCIONARIOS).appendRow([Utilities.getUuid(),texto_(d.nome),texto_(d.usuario).toLowerCase(),hash_(String(d.senha)),d.perfil==='admin'?'admin':'funcionario','SIM',new Date()]);return{success:true}}

function listar_(req,u){
  const tipo=req.tipo==='compras'?'compras':'vendas',aba=tipo==='compras'?SYS.COMPRAS:SYS.VENDAS,rows=ler_(aba),ini=req.inicio?data_(req.inicio):null,fim=req.fim?data_(req.fim):null,q=texto_(req.busca).toLowerCase();if(fim)fim=new Date(fim.getFullYear(),fim.getMonth(),fim.getDate(),23,59,59);
  const ativos=rows.filter(r=>String(r[r.length-1]).toUpperCase()==='ATIVO').filter(r=>{const dt=new Date(r[2]);if(ini&&dt<ini)return false;if(fim&&dt>fim)return false;if(q&&!r.join(' ').toLowerCase().includes(q))return false;return true}).reverse().slice(0,1000);
  const registros=ativos.map(r=>tipo==='vendas'?{id:r[0],data:fmtData_(r[2]),nomeCliente:r[3],cpf:r[4],telefone:r[5],produto:r[6],imei:r[7],pagamento:r[8],valor:r[9],funcionario:r[10],observacoes:r[12]}:{id:r[0],data:fmtData_(r[2]),nomePessoa:r[3],cpf:r[4],telefone:r[5],modelo:r[6],imei:r[7],valor:r[8],condicao:r[9],funcionario:r[10],observacoes:r[12]});return{success:true,registros};
}
function dashboard_(req,u){
  let ini=req.inicio?data_(req.inicio):new Date(new Date().getFullYear(),new Date().getMonth(),1),fim=req.fim?data_(req.fim):new Date();fim=new Date(fim.getFullYear(),fim.getMonth(),fim.getDate(),23,59,59);
  const vendas=ler_(SYS.VENDAS).filter(r=>String(r[13]).toUpperCase()==='ATIVO'&&new Date(r[2])>=ini&&new Date(r[2])<=fim);const compras=ler_(SYS.COMPRAS).filter(r=>String(r[13]).toUpperCase()==='ATIVO'&&new Date(r[2])>=ini&&new Date(r[2])<=fim);
  const fat=vendas.reduce((s,r)=>s+numero_(r[9]),0),comp=compras.reduce((s,r)=>s+numero_(r[8]),0),dias={};vendas.forEach(r=>{const k=Utilities.formatDate(new Date(r[2]),SYS.TZ,'dd/MM');dias[k]=(dias[k]||0)+numero_(r[9])});
  return{success:true,resumo:{faturamento:fat,vendas:vendas.length,ticketMedio:vendas.length?fat/vendas.length:0,compras:comp,lucro:fat-comp},grafico:Object.keys(dias).map(data=>({data,valor:dias[data]}))};
}
function excluir_(req,u){
  if(u.perfil!=='admin')throw new Error('Somente administradores podem excluir registros.');const aba=req.tipo==='compras'?SYS.COMPRAS:SYS.VENDAS,sh=SpreadsheetApp.getActive().getSheetByName(aba),vals=sh.getDataRange().getValues();for(let i=1;i<vals.length;i++){if(String(vals[i][0])===String(req.id)){if(String(vals[i][vals[i].length-1]).toUpperCase()!=='ATIVO')throw new Error('Registro já excluído.');sh.getRange(i+1,vals[i].length).setValue('EXCLUÍDO');SpreadsheetApp.getActive().getSheetByName(SYS.LOG).appendRow([new Date(),req.tipo,req.id,u.usuario,JSON.stringify(vals[i])]);return{success:true}}}throw new Error('Registro não encontrado.');
}

function ler_(aba){const sh=SpreadsheetApp.getActive().getSheetByName(aba);if(!sh)throw new Error('Execute configurarSistema() primeiro.');const v=sh.getDataRange().getValues();return v.slice(1)}
function validarCampos_(d,campos){campos.forEach(c=>{if(d==null||d[c]==null||String(d[c]).trim()==='')throw new Error('Preencha todos os campos obrigatórios.')})}
function texto_(v){return String(v==null?'':v).trim().replace(/[<>]/g,'')}
function numero_(v){if(typeof v==='number')return v;return Number(String(v||'').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.'))||0}
function data_(v){if(v instanceof Date)return new Date(v.getFullYear(),v.getMonth(),v.getDate());const p=String(v).slice(0,10).split('-').map(Number);if(p.length!==3||!p[0])throw new Error('Data inválida.');return new Date(p[0],p[1]-1,p[2])}
function fmtData_(v){return Utilities.formatDate(new Date(v),SYS.TZ,'dd/MM/yyyy')}
function cpf_(v){const n=String(v).replace(/\D/g,'');return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')}
function cpfValido_(v){const c=String(v).replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;let s=0;for(let i=0;i<9;i++)s+=Number(c[i])*(10-i);let d=(s*10)%11;if(d===10)d=0;if(d!==Number(c[9]))return false;s=0;for(let i=0;i<10;i++)s+=Number(c[i])*(11-i);d=(s*10)%11;if(d===10)d=0;return d===Number(c[10])}
function hash_(s){const b=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8);return b.map(x=>(x+256)%256).map(x=>x.toString(16).padStart(2,'0')).join('')}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
