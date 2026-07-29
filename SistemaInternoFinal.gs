const CONFIG={TIMEZONE:'America/Sao_Paulo',TOKEN_HORAS:8,ABAS:{FUNCIONARIOS:'Funcionarios',COMPRAS:'Compras',ESTOQUE:'Estoque',VENDAS:'Vendas',LOG:'LogExclusoes'}};

function configurarSistema(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  criarAba_(ss,CONFIG.ABAS.FUNCIONARIOS,['ID','Nome','Usuário','Senha Hash','Perfil','Status','Data de cadastro']);
  criarAba_(ss,CONFIG.ABAS.COMPRAS,['ID Compra','Data da compra','Data de cadastro','Nome do vendedor','CPF','Telefone','Modelo','Armazenamento','Cor','IMEI','IMEI 2','Valor da compra','Forma de pagamento','Observações','Funcionário responsável','ID Funcionário']);
  criarAba_(ss,CONFIG.ABAS.ESTOQUE,['ID Estoque','ID Compra','Data de entrada','Modelo','Armazenamento','Cor','IMEI','IMEI 2','Valor de custo','Status','ID Venda','Data da venda','Funcionário responsável','Preço site','Categoria site','Condição site','Bateria site','Status site','Foto URL','Foto ID','Fotos URLs','Fotos IDs']);
  criarAba_(ss,CONFIG.ABAS.VENDAS,['ID Venda','Data da venda','Data de cadastro','Nome do cliente','CPF','Telefone','ID Estoque','Modelo','Armazenamento','Cor','IMEI','IMEI 2','Valor de custo','Valor da venda','Lucro','Forma de pagamento','Observações','Funcionário responsável','ID Funcionário']);
  criarAba_(ss,CONFIG.ABAS.LOG,['ID Log','Data e hora','Tipo de registro','ID do registro','Motivo','Funcionário responsável','ID Funcionário','Dados removidos']);
  migrarIMEI2_();
  const sh=ss.getSheetByName(CONFIG.ABAS.FUNCIONARIOS);
  if(sh.getLastRow()===1)sh.appendRow([id_('FUNC'),'Administrador','admin',hash_('Trocar@123'),'Administrador','Ativo',new Date()]);
  formatar_();
}

function doGet(e){if(e&&e.parameter&&e.parameter.acao==='produtosSite')return produtosPublicos_();return json_({sucesso:true,sistema:'DGIPHONES - Sistema Interno',status:'online',dataHora:fmtDH_(new Date())})}
function doPost(e){
  try{
    const d=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    let r;
    switch(String(d.acao||'')){
      case 'login':r=login_(d);break;
      case 'verificarToken':r={sucesso:true,funcionario:auth_(d.token)};break;
      case 'logout':r=logout_(d);break;
      case 'cadastrarCompra':r=cadastrarCompra_(d);break;
      case 'listarCompras':r=listarCompras_(d);break;
      case 'excluirCompra':r=excluirCompra_(d);break;
      case 'editarCompra':r=editarCompra_(d);break;
      case 'listarEstoque':r=listarEstoque_(d);break;
      case 'listarProdutosSite':r=listarProdutosSite_(d);break;
      case 'atualizarProdutoSite':r=atualizarProdutoSite_(d);break;
      case 'excluirProdutoSite':r=excluirProdutoSite_(d);break;
      case 'cadastrarVenda':r=cadastrarVenda_(d);break;
      case 'listarVendas':r=listarVendas_(d);break;
      case 'excluirVenda':r=excluirVenda_(d);break;
      case 'editarVenda':r=editarVenda_(d);break;
      case 'dashboard':r=dashboard_(d);break;
      case 'dadosSistema':r=dadosSistema_(d);break;
      case 'cadastrarFuncionario':r=cadastrarFuncionario_(d);break;
      default:r={sucesso:false,mensagem:'Ação inválida.'};
    }
    return json_(r);
  }catch(err){return json_({sucesso:false,mensagem:String(err.message||err)})}
}

function login_(d){
  const u=txt_(d.usuario).toLowerCase(),senha=String(d.senha||'');
  const vals=aba_(CONFIG.ABAS.FUNCIONARIOS).getDataRange().getValues();
  for(let i=1;i<vals.length;i++)if(txt_(vals[i][2]).toLowerCase()===u&&txt_(vals[i][3])===hash_(senha)&&txt_(vals[i][5]).toLowerCase()==='ativo'){
    const funcionario={id:vals[i][0],nome:vals[i][1],usuario:vals[i][2],perfil:vals[i][4]};
    const token=Utilities.getUuid().replace(/-/g,'');
    PropertiesService.getScriptProperties().setProperty('TOKEN_'+token,JSON.stringify({funcionario,expiraEm:Date.now()+CONFIG.TOKEN_HORAS*3600000}));
    return{sucesso:true,token,funcionario};
  }
  return{sucesso:false,mensagem:'Usuário ou senha inválidos.'};
}
function auth_(token){
  const p=PropertiesService.getScriptProperties(),k='TOKEN_'+txt_(token),raw=p.getProperty(k);
  if(!raw)throw new Error('Sessão expirada. Faça login novamente.');
  const s=JSON.parse(raw);if(Date.now()>Number(s.expiraEm)){p.deleteProperty(k);throw new Error('Sessão expirada. Faça login novamente.')}return s.funcionario;
}
function logout_(d){PropertiesService.getScriptProperties().deleteProperty('TOKEN_'+txt_(d.token));return{sucesso:true}}
function admin_(u){if(txt_(u.perfil).toLowerCase()!=='administrador')throw new Error('Apenas administradores podem executar esta ação.')}

function cadastrarCompra_(d){
  const u=auth_(d.token),cpf=cpfLimpo_(d.cpf),imei=imei_(d.imei),imei2=imei_(d.imei2),valor=num_(d.valorCompra),data=data_(d.dataCompra);
  if(!txt_(d.nome)||!cpfValido_(cpf)||!txt_(d.modelo)||imei.length!==15||valor<=0)throw new Error('Confira os campos obrigatórios.');
  if(imei2&&imei2.length!==15)throw new Error('O IMEI 2 deve possuir 15 números.');
  verificarIMEI_(imei,imei2);
  const idCompra=id_('COMPRA'),idEstoque=id_('ESTOQUE'),agora=new Date(),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    aba_(CONFIG.ABAS.COMPRAS).appendRow([idCompra,data,agora,txt_(d.nome),cpfFmt_(cpf),txt_(d.telefone),txt_(d.modelo),txt_(d.armazenamento),txt_(d.cor),imei,imei2,valor,txt_(d.formaPagamento),txt_(d.observacoes),u.nome,u.id]);
    const fotos=salvarFotosProduto_(d.fotosData,d.fotosNomes,d.fotoData,d.fotoNome,idEstoque);
    const principal=fotos[0];
    aba_(CONFIG.ABAS.ESTOQUE).appendRow([idEstoque,idCompra,data,txt_(d.modelo),txt_(d.armazenamento),txt_(d.cor),imei,imei2,valor,'Disponível','','',u.nome,num_(d.precoSite),txt_(d.categoriaSite)||'iPhone',txt_(d.condicaoSite)||'Seminovo',txt_(d.bateriaSite),['Publicado','Oculto','Reservado'].includes(txt_(d.statusSite))?txt_(d.statusSite):'Oculto',principal.url,principal.id,JSON.stringify(fotos.map(f=>f.url)),JSON.stringify(fotos.map(f=>f.id))]);
    return{sucesso:true,idCompra,idEstoque,mensagem:'Compra cadastrada.'};
  }finally{lock.releaseLock()}
}

function excluirProdutoSite_(d){
  const u=auth_(d.token);admin_(u);
  const idEstoque=txt_(d.idEstoque),motivo=txt_(d.motivo);
  if(!idEstoque)throw new Error('Produto não informado.');
  if(!motivo)throw new Error('Informe o motivo da exclusão.');
  const sh=aba_(CONFIG.ABAS.ESTOQUE),vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][0])!==String(idEstoque))continue;
    if(txt_(vals[i][9]).toLowerCase()==='vendido')throw new Error('Não é possível excluir um produto já vendido.');
    const removido=obj_(vals[0],vals[i]);
    excluirFotosProduto_(vals[i][21]||vals[i][19]);
    sh.deleteRow(i+1);
    log_('Produto do site',idEstoque,motivo,u,removido);
    return{sucesso:true,mensagem:'Produto excluído do estoque e do site.'};
  }
  throw new Error('Produto não encontrado.');
}

function cadastrarVenda_(d){
  const u=auth_(d.token),cpf=cpfLimpo_(d.cpf),valor=num_(d.valorVenda),data=data_(d.dataVenda),idEstoque=txt_(d.idEstoque);
  if(!txt_(d.nome)||!cpfValido_(cpf)||!idEstoque||valor<=0)throw new Error('Confira os campos obrigatórios.');
  const sh=aba_(CONFIG.ABAS.ESTOQUE),vals=sh.getDataRange().getValues();let row=-1,a;
  for(let i=1;i<vals.length;i++)if(String(vals[i][0])===idEstoque){row=i+1;a=vals[i];break}
  if(!a)throw new Error('Aparelho não encontrado.');if(txt_(a[9]).toLowerCase()!=='disponível')throw new Error('Este aparelho não está disponível.');
  const idVenda=id_('VENDA'),custo=Number(a[8])||0,lucro=valor-custo;
  aba_(CONFIG.ABAS.VENDAS).appendRow([idVenda,data,new Date(),txt_(d.nome),cpfFmt_(cpf),txt_(d.telefone),idEstoque,a[3],a[4],a[5],a[6],a[7],custo,valor,lucro,txt_(d.formaPagamento),txt_(d.observacoes),u.nome,u.id]);
  sh.getRange(row,10,1,4).setValues([['Vendido',idVenda,data,u.nome]]);sh.getRange(row,18).setValue('Vendido');
  return{sucesso:true,idVenda,lucro,mensagem:'Venda cadastrada.'};
}


function salvarFotosProduto_(fotosData,fotosNomes,fotoData,fotoNome,idEstoque){
  let dados=Array.isArray(fotosData)?fotosData.filter(Boolean):[];
  let nomes=Array.isArray(fotosNomes)?fotosNomes:[];
  // Compatibilidade com o cadastro antigo de uma única foto.
  if(!dados.length&&txt_(fotoData)){dados=[fotoData];nomes=[fotoNome||'produto.jpg']}
  if(!dados.length)throw new Error('Adicione pelo menos uma foto do produto.');
  if(dados.length>6)throw new Error('É permitido enviar no máximo 6 fotos por produto.');
  const props=PropertiesService.getScriptProperties();let folderId=props.getProperty('PASTA_FOTOS_PRODUTOS_ID'),folder;
  try{folder=folderId?DriveApp.getFolderById(folderId):null}catch(e){folder=null}
  if(!folder){folder=DriveApp.createFolder('DGIPHONES - Fotos dos Produtos');props.setProperty('PASTA_FOTOS_PRODUTOS_ID',folder.getId())}
  return dados.map((dataUrl,i)=>{
    const m=String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);if(!m)throw new Error('Formato inválido na foto '+(i+1)+'.');
    const nome=(txt_(nomes[i])||('foto-'+(i+1)+'.jpg')).replace(/[^a-zA-Z0-9._-]/g,'-');
    const blob=Utilities.newBlob(Utilities.base64Decode(m[2]),m[1],idEstoque+'-'+(i+1)+'-'+nome);
    const file=folder.createFile(blob);file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
    return{id:file.getId(),url:'https://drive.google.com/thumbnail?id='+file.getId()+'&sz=w1600'};
  });
}
function listaJson_(valor){
  if(Array.isArray(valor))return valor.filter(Boolean);
  if(!txt_(valor))return [];
  try{const a=JSON.parse(String(valor));return Array.isArray(a)?a.filter(Boolean):[]}catch(e){return String(valor).split('|').map(txt_).filter(Boolean)}
}
function listarProdutosSite_(d){auth_(d.token);return{sucesso:true,produtos:registrosDisplay_(aba_(CONFIG.ABAS.ESTOQUE)).filter(r=>txt_(r.Status).toLowerCase()!=='vendido').reverse()}}
function atualizarProdutoSite_(d){
  auth_(d.token);const sh=aba_(CONFIG.ABAS.ESTOQUE),v=sh.getDataRange().getValues();let row=-1,registro;
  for(let i=1;i<v.length;i++)if(String(v[i][0])===txt_(d.idEstoque)){row=i+1;registro=v[i];break}if(row<0)throw new Error('Produto não encontrado.');
  if(txt_(registro[9]).toLowerCase()==='vendido')throw new Error('Produto já vendido.');
  if(d.precoSite!==undefined){const preco=num_(d.precoSite);if(preco<=0)throw new Error('Preço inválido.');sh.getRange(row,14).setValue(preco)}
  if(d.categoriaSite!==undefined)sh.getRange(row,15).setValue(txt_(d.categoriaSite)||'iPhone');
  if(d.condicaoSite!==undefined)sh.getRange(row,16).setValue(txt_(d.condicaoSite)||'Seminovo');
  if(d.bateriaSite!==undefined)sh.getRange(row,17).setValue(txt_(d.bateriaSite));
  if(d.statusSite!==undefined){const st=txt_(d.statusSite);if(!['Publicado','Oculto','Reservado'].includes(st))throw new Error('Status inválido.');sh.getRange(row,18).setValue(st)}
  const novasFotos=Array.isArray(d.fotosData)?d.fotosData.filter(Boolean):[];
  if(novasFotos.length){
    excluirFotosProduto_(registro[21]||registro[19]);
    const fotos=salvarFotosProduto_(novasFotos,d.fotosNomes,'','',registro[0]);
    sh.getRange(row,19,1,4).setValues([[fotos[0].url,fotos[0].id,JSON.stringify(fotos.map(f=>f.url)),JSON.stringify(fotos.map(f=>f.id))]]);
  }
  return{sucesso:true,mensagem:'Produto atualizado.'};
}
function produtosPublicos_(){
  const itens=registrosDisplay_(aba_(CONFIG.ABAS.ESTOQUE)).filter(r=>txt_(r.Status).toLowerCase()==='disponível'&&['Publicado','Reservado'].includes(txt_(r['Status site']))).map(r=>{const fotos=listaJson_(r['Fotos URLs']);if(!fotos.length&&txt_(r['Foto URL']))fotos.push(r['Foto URL']);return{id:r['ID Estoque'],modelo:r.Modelo,armazenamento:r.Armazenamento,cor:r.Cor,preco:num_(r['Preço site']),categoria:r['Categoria site']||'iPhone',condicao:r['Condição site']||'Seminovo',bateria:r['Bateria site']||'',status:r['Status site'],foto:fotos[0]||'',fotos:fotos};});
  return json_({sucesso:true,produtos:itens});
}

function listarCompras_(d){
  auth_(d.token);
  return {sucesso:true,compras:listarPeriodoDisplay_(CONFIG.ABAS.COMPRAS,'Data da compra',d,['Nome do vendedor','CPF','Telefone','Modelo','IMEI','IMEI 2']).reverse()};
}
function listarVendas_(d){
  auth_(d.token);
  return {sucesso:true,vendas:listarPeriodoDisplay_(CONFIG.ABAS.VENDAS,'Data da venda',d,['Nome do cliente','CPF','Telefone','Modelo','IMEI','IMEI 2','Funcionário responsável']).reverse()};
}

// Lê os valores exatamente como aparecem na planilha. Isso evita falhas
// com datas, moedas, localidade e fuso horário.
function listarPeriodoDisplay_(nomeAba,campoData,d,camposBusca){
  const sh=aba_(nomeAba);
  const vals=sh.getDataRange().getDisplayValues();
  if(vals.length<2)return [];

  const h=vals[0].map(v=>txt_(v));
  const idxData=indiceCabecalho_(h,campoData);
  if(idxData<0)throw new Error('Coluna de data não encontrada: '+campoData);

  const ini=chaveData_(d.dataInicial);
  const fim=chaveData_(d.dataFinal);
  const q=txt_(d.pesquisa).toLowerCase();

  return vals.slice(1)
    .filter(r=>r.some(v=>txt_(v)!==''))
    .filter(r=>{
      const dataRegistro=chaveData_(r[idxData]);
      if(ini && dataRegistro < ini)return false;
      if(fim && dataRegistro > fim)return false;
      if(q){
        const achou=camposBusca.some(c=>{
          const idx=indiceCabecalho_(h,c);
          return idx>=0 && txt_(r[idx]).toLowerCase().includes(q);
        });
        if(!achou)return false;
      }
      return true;
    })
    .map(r=>objDisplay_(h,r));
}

function indiceCabecalho_(cabecalhos,nome){
  const alvo=normalizarCabecalho_(nome);
  return cabecalhos.findIndex(v=>normalizarCabecalho_(v)===alvo);
}
function normalizarCabecalho_(v){
  return txt_(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function objDisplay_(h,r){
  const o={};
  h.forEach((k,i)=>o[txt_(k)]=r[i]);
  return o;
}

// Converte qualquer data visível na planilha ou enviada pelo site em AAAA-MM-DD.
function chaveData_(v){
  if(v instanceof Date && !isNaN(v.getTime())){
    return Utilities.formatDate(v,CONFIG.TIMEZONE,'yyyy-MM-dd');
  }
  const s=txt_(v);
  if(!s)return '';
  let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return m[1]+'-'+m[2]+'-'+m[3];
  m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1];
  m=s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if(m)return m[3]+'-'+m[2]+'-'+m[1];
  const dt=new Date(s);
  if(!isNaN(dt.getTime()))return Utilities.formatDate(dt,CONFIG.TIMEZONE,'yyyy-MM-dd');
  return '';
}

function listarEstoque_(d){
  auth_(d.token);
  const regs=registrosDisplay_(aba_(CONFIG.ABAS.ESTOQUE));
  const st=txt_(d.status).toLowerCase(),q=txt_(d.pesquisa).toLowerCase();
  return {sucesso:true,estoque:regs.filter(r=>(!st||txt_(r.Status).toLowerCase()===st)&&(!q||[r.Modelo,r.Armazenamento,r.Cor,r.IMEI,r['IMEI 2']].some(v=>txt_(v).toLowerCase().includes(q)))).reverse()};
}

function dadosSistema_(d){
  auth_(d.token);
  return {
    sucesso:true,
    agora:Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm:ss'),
    vendas:registrosDisplay_(aba_(CONFIG.ABAS.VENDAS)),
    compras:registrosDisplay_(aba_(CONFIG.ABAS.COMPRAS)),
    estoque:registrosDisplay_(aba_(CONFIG.ABAS.ESTOQUE))
  };
}

function dashboard_(d){
  auth_(d.token);
  const vendas=registrosDisplay_(aba_(CONFIG.ABAS.VENDAS));
  const compras=registrosDisplay_(aba_(CONFIG.ABAS.COMPRAS));
  const estoque=registrosDisplay_(aba_(CONFIG.ABAS.ESTOQUE));

  const hoje=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd');
  const mes=hoje.slice(0,7);

  const vh=vendas.filter(x=>chaveData_(x['Data da venda'])===hoje);
  const vm=vendas.filter(x=>chaveData_(x['Data da venda']).slice(0,7)===mes);
  const ch=compras.filter(x=>chaveData_(x['Data da compra'])===hoje);
  const cm=compras.filter(x=>chaveData_(x['Data da compra']).slice(0,7)===mes);
  const disp=estoque.filter(x=>txt_(x.Status).toLowerCase()==='disponível');

  return {sucesso:true,resumo:{
    faturamentoHoje:soma_(vh,'Valor da venda'),
    faturamentoMes:soma_(vm,'Valor da venda'),
    lucroHoje:soma_(vh,'Lucro'),
    lucroMes:soma_(vm,'Lucro'),
    quantidadeVendasHoje:vh.length,
    quantidadeVendasMes:vm.length,
    comprasHoje:ch.length,
    comprasMes:cm.length,
    valorComprasHoje:soma_(ch,'Valor da compra'),
    valorComprasMes:soma_(cm,'Valor da compra'),
    aparelhosDisponiveis:disp.length,
    valorEstoque:soma_(disp,'Valor de custo'),
    ticketMedioMes:vm.length?soma_(vm,'Valor da venda')/vm.length:0
  },grafico:graficoDisplay_(vendas)};
}

function registrosDisplay_(sh){
  const v=sh.getDataRange().getDisplayValues();
  if(v.length<2)return [];
  const h=v[0].map(x=>txt_(x));
  return v.slice(1).filter(r=>r.some(x=>txt_(x)!=='')).map(r=>objDisplay_(h,r));
}

function graficoDisplay_(vendas){
  const mapa={};
  vendas.forEach(v=>{
    const k=chaveData_(v['Data da venda']);
    if(!k)return;
    if(!mapa[k])mapa[k]={faturamento:0,lucro:0,quantidade:0};
    mapa[k].faturamento+=num_(v['Valor da venda']);
    mapa[k].lucro+=num_(v['Lucro']);
    mapa[k].quantidade++;
  });
  const a=[];
  for(let i=29;i>=0;i--){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const k=Utilities.formatDate(d,CONFIG.TIMEZONE,'yyyy-MM-dd');
    const x=mapa[k]||{faturamento:0,lucro:0,quantidade:0};
    a.push({data:Utilities.formatDate(d,CONFIG.TIMEZONE,'dd/MM'),faturamento:x.faturamento,lucro:x.lucro,quantidade:x.quantidade});
  }
  return a;
}


function excluirFotosProduto_(ids){
  listaJson_(ids).forEach(id=>{try{DriveApp.getFileById(id).setTrashed(true)}catch(e){}});
}

function editarCompra_(d){
  const u=auth_(d.token);
  const cpf=cpfLimpo_(d.cpf),imei=imei_(d.imei),imei2=imei_(d.imei2),valor=num_(d.valorCompra),data=data_(d.dataCompra),idCompra=txt_(d.idCompra);
  if(!idCompra||!txt_(d.nome)||!cpfValido_(cpf)||!txt_(d.modelo)||imei.length!==15||valor<=0)throw new Error('Confira os campos obrigatórios.');
  if(imei2&&imei2.length!==15)throw new Error('O IMEI 2 deve possuir 15 números.');
  const shC=aba_(CONFIG.ABAS.COMPRAS),vc=shC.getDataRange().getValues(),hc=vc[0];let rc=-1;
  for(let i=1;i<vc.length;i++)if(String(vc[i][0])===idCompra){rc=i+1;break}
  if(rc<0)throw new Error('Compra não encontrada.');
  if(txt_(u.perfil).toLowerCase()!=='administrador'&&String(vc[rc-1][15])!==String(u.id))throw new Error('Você só pode editar suas próprias compras.');
  const shE=aba_(CONFIG.ABAS.ESTOQUE),ve=shE.getDataRange().getValues();let re=-1;
  for(let i=1;i<ve.length;i++)if(String(ve[i][1])===idCompra){re=i+1;break}
  if(re<0)throw new Error('Registro de estoque não encontrado.');
  if(txt_(ve[re-1][9]).toLowerCase()==='vendido')throw new Error('Não é possível alterar a compra porque o aparelho já foi vendido.');
  for(let i=1;i<ve.length;i++){
    if(i+1===re)continue;
    const atuais=[imei_(ve[i][6]),imei_(ve[i][7])];
    if(atuais.includes(imei)||(imei2&&atuais.includes(imei2)))throw new Error('Um dos IMEIs já está cadastrado.');
  }
  const original=vc[rc-1];
  shC.getRange(rc,1,1,hc.length).setValues([[
    original[0],data,original[2],txt_(d.nome),cpfFmt_(cpf),txt_(d.telefone),txt_(d.modelo),txt_(d.armazenamento),txt_(d.cor),imei,imei2,valor,txt_(d.formaPagamento),txt_(d.observacoes),original[14],original[15]
  ]]);
  shE.getRange(re,3,1,7).setValues([[data,txt_(d.modelo),txt_(d.armazenamento),txt_(d.cor),imei,imei2,valor]]);

  if(d.precoSite!==undefined){const preco=num_(d.precoSite);if(preco<=0)throw new Error('Preço de venda inválido.');shE.getRange(re,14).setValue(preco)}
  if(d.categoriaSite!==undefined)shE.getRange(re,15).setValue(txt_(d.categoriaSite)||'iPhone');
  if(d.condicaoSite!==undefined)shE.getRange(re,16).setValue(txt_(d.condicaoSite)||'Seminovo');
  if(d.bateriaSite!==undefined)shE.getRange(re,17).setValue(txt_(d.bateriaSite));
  if(d.statusSite!==undefined){const st=txt_(d.statusSite);if(!['Publicado','Oculto','Reservado'].includes(st))throw new Error('Status do site inválido.');shE.getRange(re,18).setValue(st)}

  const novasFotos=Array.isArray(d.fotosData)?d.fotosData.filter(Boolean):[];
  if(novasFotos.length){
    excluirFotosProduto_(ve[re-1][21]||ve[re-1][19]);
    const fotos=salvarFotosProduto_(novasFotos,d.fotosNomes,'','',ve[re-1][0]);
    shE.getRange(re,19,1,4).setValues([[fotos[0].url,fotos[0].id,JSON.stringify(fotos.map(f=>f.url)),JSON.stringify(fotos.map(f=>f.id))]]);
  }
  return{sucesso:true,mensagem:'Compra e informações do site alteradas com sucesso.'};
}
function editarVenda_(d){
  const u=auth_(d.token);
  const cpf=cpfLimpo_(d.cpf),valor=num_(d.valorVenda),data=data_(d.dataVenda),idVenda=txt_(d.idVenda);
  if(!idVenda||!txt_(d.nome)||!cpfValido_(cpf)||valor<=0)throw new Error('Confira os campos obrigatórios.');
  const shV=aba_(CONFIG.ABAS.VENDAS),vv=shV.getDataRange().getValues();let rv=-1;
  for(let i=1;i<vv.length;i++)if(String(vv[i][0])===idVenda){rv=i+1;break}
  if(rv<0)throw new Error('Venda não encontrada.');
  if(txt_(u.perfil).toLowerCase()!=='administrador'&&String(vv[rv-1][18])!==String(u.id))throw new Error('Você só pode editar suas próprias vendas.');
  const original=vv[rv-1],custo=num_(original[12]),lucro=valor-custo;
  original[1]=data;original[3]=txt_(d.nome);original[4]=cpfFmt_(cpf);original[5]=txt_(d.telefone);original[13]=valor;original[14]=lucro;original[15]=txt_(d.formaPagamento);original[16]=txt_(d.observacoes);
  shV.getRange(rv,1,1,original.length).setValues([original]);
  const shE=aba_(CONFIG.ABAS.ESTOQUE),ve=shE.getDataRange().getValues();
  for(let i=1;i<ve.length;i++)if(String(ve[i][10])===idVenda){shE.getRange(i+1,12).setValue(data);break}
  return{sucesso:true,lucro,mensagem:'Venda alterada com sucesso.'};
}

function excluirVenda_(d){const u=auth_(d.token);admin_(u);const rem=remover_(CONFIG.ABAS.VENDAS,'ID Venda',d.idVenda);if(!rem)throw new Error('Venda não encontrada.');const sh=aba_(CONFIG.ABAS.ESTOQUE),vals=sh.getDataRange().getValues();for(let i=1;i<vals.length;i++)if(String(vals[i][10])===String(d.idVenda)){sh.getRange(i+1,10,1,4).setValues([['Disponível','','',u.nome]]);sh.getRange(i+1,18).setValue('Oculto');break}log_('Venda',d.idVenda,d.motivo,u,rem);return{sucesso:true}}
function excluirCompra_(d){const u=auth_(d.token);admin_(u);const est=aba_(CONFIG.ABAS.ESTOQUE).getDataRange().getValues();for(let i=1;i<est.length;i++)if(String(est[i][1])===String(d.idCompra)&&txt_(est[i][9]).toLowerCase()==='vendido')throw new Error('O aparelho já foi vendido.');const rem=remover_(CONFIG.ABAS.COMPRAS,'ID Compra',d.idCompra);if(!rem)throw new Error('Compra não encontrada.');remover_(CONFIG.ABAS.ESTOQUE,'ID Compra',d.idCompra);log_('Compra',d.idCompra,d.motivo,u,rem);return{sucesso:true}}
function cadastrarFuncionario_(d){const u=auth_(d.token);admin_(u);if(!txt_(d.nome)||txt_(d.usuario).length<3||String(d.senha||'').length<6)throw new Error('Confira os dados do funcionário.');const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues();if(vals.slice(1).some(r=>txt_(r[2]).toLowerCase()===txt_(d.usuario).toLowerCase()))throw new Error('Este usuário já existe.');sh.appendRow([id_('FUNC'),txt_(d.nome),txt_(d.usuario).toLowerCase(),hash_(String(d.senha)),txt_(d.perfil)==='Administrador'?'Administrador':'Funcionário',txt_(d.status)==='Inativo'?'Inativo':'Ativo',new Date()]);return{sucesso:true}}

function migrarIMEI2_(){
  [[CONFIG.ABAS.COMPRAS,'IMEI'],[CONFIG.ABAS.ESTOQUE,'IMEI'],[CONFIG.ABAS.VENDAS,'IMEI']].forEach(([nome,antes])=>{const sh=aba_(nome),h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];if(h.indexOf('IMEI 2')<0){const c=h.indexOf(antes)+1;sh.insertColumnAfter(c);sh.getRange(1,c+1).setValue('IMEI 2')}});
}
function criarAba_(ss,nome,h){let sh=ss.getSheetByName(nome);if(!sh)sh=ss.insertSheet(nome);sh.getRange(1,1,1,h.length).setValues([h]);sh.setFrozenRows(1)}
function formatar_(){Object.values(CONFIG.ABAS).forEach(n=>{const sh=aba_(n),c=sh.getLastColumn();sh.getRange(1,1,1,c).setFontWeight('bold').setBackground('#111111').setFontColor('#FFD700');sh.autoResizeColumns(1,c)})}
function aba_(n){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n);if(!sh)throw new Error('Execute configurarSistema().');return sh}
function registros_(sh){const v=sh.getDataRange().getValues();if(v.length<2)return[];return v.slice(1).filter(r=>r.some(x=>x!=='' )).map(r=>obj_(v[0],r))}
function registrosRaw_(sh){const v=sh.getDataRange().getValues();if(v.length<2)return[];return v.slice(1).filter(r=>r.some(x=>x!=='' )).map(r=>{const o={};v[0].forEach((h,i)=>o[h]=r[i]);return o})}
function obj_(h,r){const o={};h.forEach((k,i)=>o[k]=r[i] instanceof Date?fmtDH_(r[i]):r[i]);return o}
function remover_(aba,campo,id){const sh=aba_(aba),v=sh.getDataRange().getValues(),c=v[0].indexOf(campo);for(let i=1;i<v.length;i++)if(String(v[i][c])===String(id)){const o=obj_(v[0],v[i]);sh.deleteRow(i+1);return o}return null}
function log_(t,id,m,u,o){aba_(CONFIG.ABAS.LOG).appendRow([id_('LOG'),new Date(),t,id,txt_(m),u.nome,u.id,JSON.stringify(o)])}
function verificarIMEI_(i1,i2){const regs=registrosRaw_(aba_(CONFIG.ABAS.ESTOQUE));if(regs.some(r=>[String(r.IMEI||''),String(r['IMEI 2']||'')].includes(i1)||i2&&[String(r.IMEI||''),String(r['IMEI 2']||'')].includes(i2)))throw new Error('Um dos IMEIs já está cadastrado.')}
function grafico_(v){const a=[];for(let i=29;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);const x=v.filter(r=>mesma_(r['Data da venda'],d));a.push({data:Utilities.formatDate(d,CONFIG.TIMEZONE,'dd/MM'),faturamento:soma_(x,'Valor da venda'),lucro:soma_(x,'Lucro'),quantidade:x.length})}return a}
function soma_(a,c){return a.reduce((s,r)=>s+num_(r[c]),0)}
function data_(v){if(v instanceof Date)return new Date(v.getFullYear(),v.getMonth(),v.getDate(),12);const s=String(v||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return new Date(+m[1],+m[2]-1,+m[3],12);m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1],12);throw new Error('Data inválida.')}
function parseDataBR_(v){try{return data_(v)}catch(e){return null}}
function dataSeg_(v){return v instanceof Date?v:parseDataBR_(v)}
function inicio_(d){d=new Date(d);d.setHours(0,0,0,0);return d}function fim_(d){d=new Date(d);d.setHours(23,59,59,999);return d}function mesma_(a,b){a=dataSeg_(a);b=dataSeg_(b);return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
function txt_(v){return String(v==null?'':v).trim()}function num_(v){if(typeof v==='number')return v;let s=String(v||'').replace(/[R$\s]/g,'');if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(',','.');return Number(s)||0}
function imei_(v){return String(v||'').replace(/\D/g,'')}function cpfLimpo_(v){return String(v||'').replace(/\D/g,'')}function cpfFmt_(c){return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')}
function cpfValido_(c){c=cpfLimpo_(c);if(c.length!==11||/^(\d)\1+$/.test(c))return false;let s=0;for(let i=0;i<9;i++)s+=+c[i]*(10-i);let d=11-s%11;if(d>=10)d=0;if(d!==+c[9])return false;s=0;for(let i=0;i<10;i++)s+=+c[i]*(11-i);d=11-s%11;if(d>=10)d=0;return d===+c[10]}
function hash_(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(b=>('0'+((b<0?b+256:b).toString(16))).slice(-2)).join('')}
function id_(p){return p+'-'+Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyyMMddHHmmss')+'-'+Math.floor(1000+Math.random()*9000)}
function fmtDH_(d){return Utilities.formatDate(new Date(d),CONFIG.TIMEZONE,'dd/MM/yyyy HH:mm:ss')}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
