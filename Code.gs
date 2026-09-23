const CONFIG={TIMEZONE:'America/Sao_Paulo',TOKEN_HORAS:8,COMISSAO_PERCENTUAL:0.02,ABAS:{FUNCIONARIOS:'Funcionarios',COMPRAS:'Compras',ESTOQUE:'Estoque',VENDAS:'Vendas',LOG:'LogExclusoes',COTACOES:'CotacoesSite',MANUTENCOES:'ManutencoesSite',PAGAMENTOS:'PagamentosEquipe',VALES:'ValeSolicitacoes'}};

const ACOES_EXIGEM_CONFIRMACAO_SENHA_=[
  'cadastrarCompra','excluirCompra','editarCompra',
  'atualizarProdutoSite','excluirProdutoSite',
  'cadastrarVenda','excluirVenda','editarVenda',
  'cadastrarFuncionario','excluirFuncionario','removerFuncionario','deletarFuncionario',
  'salvarMeuPix','alterarStatusComissaoVenda','registrarPagamentoEquipe',
  'solicitarVale','alterarStatusVale','cadastrarRevendedor'
];

function configurarSistema(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  criarAba_(ss,CONFIG.ABAS.FUNCIONARIOS,['ID','Nome','Usuário','Senha Hash','Perfil','Status','Data de cadastro','Salário','Chave PIX','Vale refeição dia','Dias por semana','Tipo chave PIX']);
  criarAba_(ss,CONFIG.ABAS.COMPRAS,['ID Compra','Data da compra','Data de cadastro','Nome do vendedor','CPF','Telefone','Modelo','Armazenamento','Cor','IMEI','IMEI 2','Valor da compra','Forma de pagamento','Observações','Funcionário responsável','ID Funcionário']);
  criarAba_(ss,CONFIG.ABAS.ESTOQUE,['ID Estoque','ID Compra','Data de entrada','Modelo','Armazenamento','Cor','IMEI','IMEI 2','Valor de custo','Status','ID Venda','Data da venda','Funcionário responsável','Preço site','Categoria site','Condição site','Bateria site','Status site','Foto URL','Foto ID','Fotos URLs','Fotos IDs','Preço revenda','Comentário revendedor']);
  criarAba_(ss,CONFIG.ABAS.VENDAS,['ID Venda','Data da venda','Data de cadastro','Nome do cliente','CPF','Telefone','ID Estoque','Modelo','Armazenamento','Cor','IMEI','IMEI 2','Valor de custo','Valor da venda','Lucro','Forma de pagamento','Observações','Funcionário responsável','ID Funcionário','Status comissão','Comissão atualizada por','Comissão atualizada em']);
  criarAba_(ss,CONFIG.ABAS.LOG,['ID Log','Data e hora','Tipo de registro','ID do registro','Motivo','Funcionário responsável','ID Funcionário','Dados removidos']);
  criarAba_(ss,CONFIG.ABAS.COTACOES,['ID Cotação','Data e hora','Nome','WhatsApp','Modelo','Armazenamento','Cor','Liga normalmente','Tela','Traseira','Saúde da bateria','Peças trocadas','UTM Source','UTM Medium','UTM Campaign','GCLID','FBCLID','Página','Dispositivo','E-mail enviado','E-mail destino']);
  criarAba_(ss,CONFIG.ABAS.MANUTENCOES,['ID Manutenção','Data e hora','WhatsApp','Modelo','Reparos','Detalhes','UTM Source','UTM Medium','UTM Campaign','GCLID','FBCLID','Página','Dispositivo','Status']);
  criarAba_(ss,CONFIG.ABAS.PAGAMENTOS,['ID Controle','Mês','ID Funcionário','Funcionário','Status comissão','Comissão paga','Salário pago','Valor comissão pago','Valor salário pago','Data pagamento comissão','Data pagamento salário','Atualizado por','Atualizado em','Vale refeição pago','Valor vale refeição pago','Data pagamento vale refeição']);
  const shVales=criarAba_(ss,CONFIG.ABAS.VALES,['ID Vale','Data solicitação','Mês','ID Funcionário','Funcionário','Valor','Motivo','Status','Decidido por','Data decisão','Data pagamento']);
  shVales.getRange('C:C').setNumberFormat('@');
  normalizarMesesVales_();
  migrarIMEI2_();
  const sh=ss.getSheetByName(CONFIG.ABAS.FUNCIONARIOS);
  if(sh.getLastRow()===1)sh.appendRow([id_('FUNC'),'Administrador','admin',hash_('Trocar@123'),'Administrador','Ativo',new Date(),0,'',0,6,'']);
  formatar_();
}

function doGet(e){if(e&&e.parameter&&e.parameter.acao==='produtosSite')return produtosPublicos_();return json_({sucesso:true,sistema:'DGIPHONES - Sistema Interno',status:'online',dataHora:fmtDH_(new Date())})}
function doPost(e){
  try{
    const d=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    const acao=String(d.acao||'');
    // Cotação pública do site: não exige login. Salva o lead e dispara o e-mail antes do WhatsApp.
    if(acao==='receberCotacaoSite')return json_(receberCotacaoSite_(d));
    if(acao==='receberManutencaoSite')return json_(receberManutencaoSite_(d));
    if(!['login','verificarToken','logout'].includes(acao)){
      const usuario=auth_(d.token);
      if(txt_(usuario.perfil).toLowerCase()==='revendedor'&&acao!=='listarCatalogoRevendedor')throw new Error('Seu acesso é exclusivo ao catálogo de revenda.');
      if(ACOES_EXIGEM_CONFIRMACAO_SENHA_.includes(acao))confirmarSenhaAtual_(usuario,d.senhaConfirmacao);
    }
    let r;
    switch(acao){
      case 'login':r=login_(d);break;
      case 'verificarToken':r={sucesso:true,funcionario:auth_(d.token)};break;
      case 'logout':r=logout_(d);break;
      case 'cadastrarCompra':r=cadastrarCompra_(d);break;
      case 'listarCompras':r=listarCompras_(d);break;
      case 'excluirCompra':r=excluirCompra_(d);break;
      case 'editarCompra':r=editarCompra_(d);break;
      case 'listarEstoque':r=listarEstoque_(d);break;
      case 'listarProdutosSite':r=listarProdutosSite_(d);break;
      case 'listarCatalogoRevendedor':r=listarCatalogoRevendedor_(d);break;
      case 'atualizarProdutoSite':r=atualizarProdutoSite_(d);break;
      case 'excluirProdutoSite':r=excluirProdutoSite_(d);break;
      case 'cadastrarVenda':r=cadastrarVenda_(d);break;
      case 'listarVendas':r=listarVendas_(d);break;
      case 'excluirVenda':r=excluirVenda_(d);break;
      case 'editarVenda':r=editarVenda_(d);break;
      case 'dashboard':r=dashboard_(d);break;
      case 'dadosSistema':r=dadosSistema_(d);break;
      case 'cadastrarFuncionario':r=cadastrarFuncionario_(d);break;
      case 'listarFuncionarios':r=listarFuncionarios_(d);break;
      case 'cadastrarRevendedor':r=cadastrarRevendedor_(d);break;
      case 'listarRevendedores':r=listarRevendedores_(d);break;
      case 'listarFinanceiroEquipe':r=listarFinanceiroEquipe_(d);break;
      case 'listarVendasComissao':r=listarVendasComissao_(d);break;
      case 'salvarMeuPix':r=salvarMeuPix_(d);break;
      case 'alterarStatusComissaoVenda':r=alterarStatusComissaoVenda_(d);break;
      case 'registrarPagamentoEquipe':r=registrarPagamentoEquipe_(d);break;
      case 'listarVales':r=listarVales_(d);break;
      case 'solicitarVale':r=solicitarVale_(d);break;
      case 'alterarStatusVale':r=alterarStatusVale_(d);break;
      case 'excluirFuncionario':
      case 'removerFuncionario':
      case 'deletarFuncionario':r=excluirFuncionario_(d);break;
      default:r={sucesso:false,mensagem:'Ação inválida.'};
    }
    return json_(r);
  }catch(err){return json_({sucesso:false,mensagem:String(err.message||err)})}
}


function receberCotacaoSite_(d){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sh=criarAba_(ss,CONFIG.ABAS.COTACOES,['ID Cotação','Data e hora','Nome','WhatsApp','Modelo','Armazenamento','Cor','Liga normalmente','Tela','Traseira','Saúde da bateria','Peças trocadas','UTM Source','UTM Medium','UTM Campaign','GCLID','FBCLID','Página','Dispositivo','E-mail enviado','E-mail destino']);
  const idCotacao=txt_(d.idCotacao)||id_('COT');
  const nome=txt_(d.nome),telefone=txt_(d.telefone),modelo=txt_(d.modelo);
  if(!nome||!telefone||!modelo)throw new Error('Dados incompletos para a cotação.');

  // Evita duplicar a mesma cotação caso o navegador repita o envio.
  const ids=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues().flat():[];
  if(ids.some(x=>String(x)===idCotacao))return{sucesso:true,idCotacao,duplicada:true};

  const agora=new Date();
  const destino=emailCotacoes_();
  let emailEnviado='Não';
  let erroEmail='';
  if(destino){
    try{
      MailApp.sendEmail({
        to:destino,
        subject:'Nova cotação de iPhone - '+modelo+' - '+nome,
        name:'CellTech Panamby',
        body:montarEmailCotacaoTexto_(d,idCotacao,agora),
        htmlBody:montarEmailCotacaoHtml_(d,idCotacao,agora)
      });
      emailEnviado='Sim';
    }catch(err){
      erroEmail=String(err&&err.message?err.message:err);
    }
  }else{
    erroEmail='E-mail de destino não configurado.';
  }

  sh.appendRow([
    idCotacao,agora,nome,telefone,modelo,txt_(d.armazenamento),txt_(d.cor),txt_(d.liga),txt_(d.tela),txt_(d.traseira),txt_(d.bateria),txt_(d.pecas),
    txt_(d.utm_source),txt_(d.utm_medium),txt_(d.utm_campaign),txt_(d.gclid),txt_(d.fbclid),txt_(d.pagina),txt_(d.dispositivo),emailEnviado,destino
  ]);
  SpreadsheetApp.flush();
  return{sucesso:true,idCotacao,emailEnviado:emailEnviado==='Sim',emailDestino:destino||'',aviso:erroEmail};
}

function receberManutencaoSite_(d){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const sh=criarAba_(ss,CONFIG.ABAS.MANUTENCOES,['ID Manutenção','Data e hora','WhatsApp','Modelo','Reparos','Detalhes','UTM Source','UTM Medium','UTM Campaign','GCLID','FBCLID','Página','Dispositivo','Status']);
  const idManutencao=txt_(d.idManutencao)||id_('MAN');
  const whatsapp=txt_(d.whatsapp),modelo=txt_(d.modelo);
  const reparos=Array.isArray(d.reparos)?d.reparos.map(txt_).filter(Boolean):String(d.reparos||'').split('|').map(txt_).filter(Boolean);
  if(!whatsapp||!modelo||!reparos.length)throw new Error('Dados incompletos para a manutenção.');

  const ids=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues().flat():[];
  if(ids.some(x=>String(x)===idManutencao))return{sucesso:true,idManutencao,duplicada:true};

  sh.appendRow([
    idManutencao,new Date(),whatsapp,modelo,reparos.join(' | '),txt_(d.detalhes),
    txt_(d.utm_source),txt_(d.utm_medium),txt_(d.utm_campaign),txt_(d.gclid),txt_(d.fbclid),
    txt_(d.pagina),txt_(d.dispositivo),'Novo'
  ]);
  SpreadsheetApp.flush();
  return{sucesso:true,idManutencao};
}

function emailCotacoes_(){
  const props=PropertiesService.getScriptProperties();
  const configurado=txt_(props.getProperty('EMAIL_COTACOES'));
  if(configurado)return configurado;
  try{return txt_(Session.getEffectiveUser().getEmail())}catch(e){return''}
}

// Opcional: execute uma vez no editor do Apps Script se quiser definir outro e-mail de recebimento.
function configurarEmailCotacoes(email){
  const valor=txt_(email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor))throw new Error('Informe um e-mail válido.');
  PropertiesService.getScriptProperties().setProperty('EMAIL_COTACOES',valor);
  return 'E-mail de cotações configurado: '+valor;
}

function htmlCotacao_(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
function montarEmailCotacaoTexto_(d,idCotacao,agora){
  const linhas=[
    'NOVA COTAÇÃO DE IPHONE - CELLTECH PANAMBY','',
    'Cotação: '+idCotacao,
    'Data: '+fmtDH_(agora),
    'Nome: '+txt_(d.nome),
    'WhatsApp: '+txt_(d.telefone),'',
    'Modelo: '+txt_(d.modelo),
    'Armazenamento: '+txt_(d.armazenamento),
    'Cor: '+txt_(d.cor),
    'Liga normalmente: '+txt_(d.liga),
    'Tela: '+txt_(d.tela),
    'Traseira: '+txt_(d.traseira),
    'Saúde da bateria: '+txt_(d.bateria),
    'Peças trocadas: '+txt_(d.pecas),'',
    'Página: '+txt_(d.pagina),
    'UTM Source: '+txt_(d.utm_source),
    'UTM Medium: '+txt_(d.utm_medium),
    'UTM Campaign: '+txt_(d.utm_campaign),
    'GCLID: '+txt_(d.gclid),
    'FBCLID: '+txt_(d.fbclid)
  ];
  return linhas.join('\n');
}
function montarEmailCotacaoHtml_(d,idCotacao,agora){
  const linha=(rotulo,valor)=>'<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;color:#666;font-size:12px">'+htmlCotacao_(rotulo)+'</td><td style="padding:8px 10px;border-bottom:1px solid #eee;font-weight:700">'+htmlCotacao_(txt_(valor)||'Não informado')+'</td></tr>';
  const origem=[txt_(d.utm_source),txt_(d.utm_medium),txt_(d.utm_campaign)].filter(Boolean).join(' / ')||'Não informada';
  return '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#171717">'
    +'<div style="background:#111;color:#fff;padding:22px;border-radius:14px 14px 0 0"><div style="font-size:12px;color:#f5b400;font-weight:800">CELLTECH PANAMBY</div><h2 style="margin:6px 0 0">Nova cotação de iPhone</h2></div>'
    +'<table style="width:100%;border-collapse:collapse;border:1px solid #eee">'
    +linha('Cotação',idCotacao)+linha('Data',fmtDH_(agora))+linha('Nome',d.nome)+linha('WhatsApp',d.telefone)
    +linha('Modelo',d.modelo)+linha('Armazenamento',d.armazenamento)+linha('Cor',d.cor)+linha('Liga normalmente',d.liga)
    +linha('Tela',d.tela)+linha('Traseira',d.traseira)+linha('Saúde da bateria',d.bateria)+linha('Peças trocadas',d.pecas)
    +linha('Origem',origem)+linha('Página',d.pagina)
    +'</table><div style="padding:14px;background:#fff8dc;border-radius:0 0 14px 14px;font-size:12px">O cliente foi direcionado ao WhatsApp com estas mesmas informações.</div></div>';
}

function mapaCabecalho_(sh){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];const m={};h.forEach((x,i)=>m[txt_(x).toLowerCase()]=i);return m}
function funcionarioLinha_(r,m){
  const dataCadastroRaw=m['data de cadastro']!==undefined?r[m['data de cadastro']]:'';
  const dataCadastro=dataCadastroRaw instanceof Date?Utilities.formatDate(dataCadastroRaw,CONFIG.TIMEZONE,'yyyy-MM-dd'):txt_(dataCadastroRaw);
  let dataCadastroMs=0;
  if(dataCadastroRaw instanceof Date&&!isNaN(dataCadastroRaw.getTime()))dataCadastroMs=dataCadastroRaw.getTime();
  else{const dt=dataPorISO_(dataISOInterna_(dataCadastro));if(dt)dataCadastroMs=dt.getTime()}
  return{
    id:r[m['id']],nome:r[m['nome']],usuario:r[m['usuário']]??r[m['usuario']],perfil:r[m['perfil']]||'Funcionário',status:r[m['status']]||'Ativo',
    salario:num_(m['salário']!==undefined?r[m['salário']]:0),chavePix:txt_(m['chave pix']!==undefined?r[m['chave pix']]:''),
    tipoChavePix:txt_(m['tipo chave pix']!==undefined?r[m['tipo chave pix']]:''),
    valeRefeicaoDia:num_(m['vale refeição dia']!==undefined?r[m['vale refeição dia']]:0),
    diasSemana:[5,6].includes(Number(m['dias por semana']!==undefined?r[m['dias por semana']]:6))?Number(m['dias por semana']!==undefined?r[m['dias por semana']]:6):6,
    dataCadastro,dataCadastroMs
  };
}
function login_(d){
  const u=txt_(d.usuario).toLowerCase(),senha=String(d.senha||''),sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh);
  const cUsuario=m['usuário']??m['usuario'],cSenha=m['senha hash'],cStatus=m['status'];
  for(let i=1;i<vals.length;i++)if(txt_(vals[i][cUsuario]).toLowerCase()===u&&txt_(vals[i][cSenha])===hash_(senha)&&txt_(vals[i][cStatus]).toLowerCase()==='ativo'){
    const funcionario=funcionarioLinha_(vals[i],m);
    const token=Utilities.getUuid().replace(/-/g,'');
    PropertiesService.getScriptProperties().setProperty('TOKEN_'+token,JSON.stringify({funcionario,expiraEm:Date.now()+CONFIG.TOKEN_HORAS*3600000}));
    return{sucesso:true,token,funcionario};
  }
  return{sucesso:false,mensagem:'Usuário ou senha inválidos.'};
}
function auth_(token){
  const p=PropertiesService.getScriptProperties(),k='TOKEN_'+txt_(token),raw=p.getProperty(k);
  if(!raw)throw new Error('Sessão expirada. Faça login novamente.');
  const s=JSON.parse(raw);if(Date.now()>Number(s.expiraEm)){p.deleteProperty(k);throw new Error('Sessão expirada. Faça login novamente.')}
  const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh),cId=m['id'];
  for(let i=1;i<vals.length;i++)if(String(vals[i][cId])===String(s.funcionario.id)){
    const atual=funcionarioLinha_(vals[i],m);
    if(txt_(atual.status).toLowerCase()!=='ativo'){p.deleteProperty(k);throw new Error('Usuário inativo.')}
    s.funcionario=atual;p.setProperty(k,JSON.stringify(s));return atual;
  }
  p.deleteProperty(k);throw new Error('Usuário não encontrado.');
}
function logout_(d){PropertiesService.getScriptProperties().deleteProperty('TOKEN_'+txt_(d.token));return{sucesso:true}}
function admin_(u){if(txt_(u.perfil).toLowerCase()!=='administrador')throw new Error('Apenas administradores podem executar esta ação.')}
function confirmarSenhaAtual_(u,senha){
  senha=String(senha||'');
  if(!senha)throw new Error('Digite sua senha para confirmar a operação.');
  const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh),cId=m['id'],cSenha=m['senha hash'];
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][cId])!==String(u.id))continue;
    if(txt_(vals[i][cSenha])!==hash_(senha))throw new Error('Senha de confirmação incorreta.');
    return true;
  }
  throw new Error('Usuário não encontrado.');
}


function cadastrarCompra_(d){
  const u=auth_(d.token),cpf=cpfLimpo_(d.cpf),imei=imei_(d.imei),imei2=imei_(d.imei2),valor=num_(d.valorCompra),data=data_(d.dataCompra);
  if(!txt_(d.nome)||!cpfValido_(cpf)||!txt_(d.modelo)||imei.length!==15||valor<=0)throw new Error('Confira os campos obrigatórios.');
  if(imei2&&imei2.length!==15)throw new Error('O IMEI 2 deve possuir 15 números.');
  verificarIMEI_(imei,imei2);
  const idCompra=id_('COMPRA'),idEstoque=id_('ESTOQUE'),agora=new Date(),lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    aba_(CONFIG.ABAS.COMPRAS).appendRow([idCompra,data,agora,txt_(d.nome),cpfFmt_(cpf),txt_(d.telefone),txt_(d.modelo),txt_(d.armazenamento),txt_(d.cor),imei,imei2,valor,txt_(d.formaPagamento),txt_(d.observacoes),u.nome,u.id]);
    const fotos=salvarFotosProduto_(d.fotosData,d.fotosNomes,d.fotoData,d.fotoNome,idEstoque);
    const principal=fotos[0]||{url:'',id:''};
    aba_(CONFIG.ABAS.ESTOQUE).appendRow([idEstoque,idCompra,data,txt_(d.modelo),txt_(d.armazenamento),txt_(d.cor),imei,imei2,valor,'Disponível','','',u.nome,num_(d.precoSite),txt_(d.categoriaSite)||'iPhone',txt_(d.condicaoSite)||'Seminovo',txt_(d.bateriaSite),['Publicado','Oculto','Reservado'].includes(txt_(d.statusSite))?txt_(d.statusSite):'Oculto',principal.url,principal.id,JSON.stringify(fotos.map(f=>f.url)),JSON.stringify(fotos.map(f=>f.id)),num_(d.precoRevenda),txt_(d.comentarioRevendedor)]);
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
  aba_(CONFIG.ABAS.VENDAS).appendRow([idVenda,data,new Date(),txt_(d.nome),cpfFmt_(cpf),txt_(d.telefone),idEstoque,a[3],a[4],a[5],a[6],a[7],custo,valor,lucro,txt_(d.formaPagamento),txt_(d.observacoes),u.nome,u.id,'Pendente','','']);
  sh.getRange(row,10,1,4).setValues([['Vendido',idVenda,data,u.nome]]);sh.getRange(row,18).setValue('Vendido');
  return{sucesso:true,idVenda,lucro,mensagem:'Venda cadastrada.'};
}


function salvarFotosProduto_(fotosData,fotosNomes,fotoData,fotoNome,idEstoque){
  let dados=Array.isArray(fotosData)?fotosData.filter(Boolean):[];
  let nomes=Array.isArray(fotosNomes)?fotosNomes:[];
  // Compatibilidade com o cadastro antigo de uma única foto.
  if(!dados.length&&txt_(fotoData)){dados=[fotoData];nomes=[fotoNome||'produto.jpg']}
  if(!dados.length)return [];
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
function valorPositivoCampos_(registro,campos){
  for(const campo of campos){
    const valor=num_(registro[campo]);
    if(valor>0)return valor;
  }
  const normalizados={};
  Object.keys(registro||{}).forEach(k=>normalizados[txt_(k).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')]=registro[k]);
  for(const campo of campos){
    const chave=txt_(campo).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const valor=num_(normalizados[chave]);
    if(valor>0)return valor;
  }
  return 0;
}
function listarCatalogoRevendedor_(d){
  const u=auth_(d.token);if(txt_(u.perfil).toLowerCase()!=='revendedor')throw new Error('Acesso permitido somente para revendedores.');
  const produtos=registrosDisplay_(aba_(CONFIG.ABAS.ESTOQUE)).filter(r=>txt_(r.Status).toLowerCase()==='disponível'&&txt_(r['Status site'])==='Publicado'&&num_(r['Preço revenda'])>0).map(r=>{
    const fotos=listaJson_(r['Fotos URLs']);if(!fotos.length&&txt_(r['Foto URL']))fotos.push(r['Foto URL']);
    const precoNormal=valorPositivoCampos_(r,['Preço site','Preço no PIX','Preço PIX','Preço normal','Valor de venda','Valor venda','Preço']);
    return{id:r['ID Estoque'],modelo:r.Modelo,armazenamento:r.Armazenamento,cor:r.Cor,precoNormal,precoRevenda:num_(r['Preço revenda']),categoria:r['Categoria site']||'iPhone',condicao:r['Condição site']||'Seminovo',bateria:r['Bateria site']||'',comentarioRevendedor:r['Comentário revendedor']||'',foto:fotos[0]||'',fotos:fotos};
  });
  return{sucesso:true,produtos};
}
function atualizarProdutoSite_(d){
  auth_(d.token);const sh=aba_(CONFIG.ABAS.ESTOQUE),v=sh.getDataRange().getValues();let row=-1,registro;
  for(let i=1;i<v.length;i++)if(String(v[i][0])===txt_(d.idEstoque)){row=i+1;registro=v[i];break}if(row<0)throw new Error('Produto não encontrado.');
  if(txt_(registro[9]).toLowerCase()==='vendido')throw new Error('Produto já vendido.');
  if(d.valorCusto!==undefined){const custo=num_(d.valorCusto);if(custo<=0)throw new Error('Valor pago inválido.');sh.getRange(row,9).setValue(custo);const idCompra=txt_(registro[1]);if(idCompra){const shCompras=aba_(CONFIG.ABAS.COMPRAS),cv=shCompras.getDataRange().getValues();for(let c=1;c<cv.length;c++){if(String(cv[c][0])===idCompra){shCompras.getRange(c+1,12).setValue(custo);break}}}}
  if(d.precoSite!==undefined){const preco=num_(d.precoSite);if(preco<=0)throw new Error('Preço inválido.');sh.getRange(row,14).setValue(preco)}
  if(d.precoRevenda!==undefined){const precoRevenda=num_(d.precoRevenda);if(precoRevenda<0)throw new Error('Preço de revenda inválido.');sh.getRange(row,23).setValue(precoRevenda)}
  if(d.comentarioRevendedor!==undefined){const m=mapaCabecalho_(sh),col=m['comentário revendedor'];if(col===undefined)throw new Error('Execute configurarSistema() para criar o campo de comentário do revendedor.');sh.getRange(row,col+1).setValue(txt_(d.comentarioRevendedor))}
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
  const u=auth_(d.token);admin_(u);
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
  if(d.precoRevenda!==undefined){const precoRevenda=num_(d.precoRevenda);if(precoRevenda<0)throw new Error('Preço de revenda inválido.');shE.getRange(re,23).setValue(precoRevenda)}
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
function listarFuncionarios_(d){
  const u=auth_(d.token);admin_(u);
  const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh);
  const funcionarios=vals.slice(1).filter(r=>r.some(x=>x!=='' )).map(r=>{const f=funcionarioLinha_(r,m);return{id:f.id,nome:f.nome,usuario:f.usuario,perfil:f.perfil,status:f.status,salario:f.salario,chavePix:f.chavePix,tipoChavePix:f.tipoChavePix,valeRefeicaoDia:f.valeRefeicaoDia,diasSemana:f.diasSemana,dataCadastro:f.dataCadastro}});
  return{sucesso:true,funcionarios};
}

function cadastrarFuncionario_(d){
  const u=auth_(d.token);admin_(u);
  if(!txt_(d.nome)||txt_(d.usuario).length<3)throw new Error('Confira os dados do funcionário.');
  const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh);
  const id=txt_(d.idFuncionario),usuario=txt_(d.usuario).toLowerCase(),senha=String(d.senha||'');
  const perfis=['Administrador','Revendedor','Funcionário','Vendedora','Técnico'];
  const perfil=perfis.includes(txt_(d.perfil))?txt_(d.perfil):'Funcionário';
  const salario=Math.max(0,num_(d.salario)),valeRefeicaoDia=Math.max(0,num_(d.valeRefeicaoDia)),diasSemana=[5,6].includes(Number(d.diasSemana))?Number(d.diasSemana):6;
  let linha=-1;
  if(id){for(let i=1;i<vals.length;i++)if(String(vals[i][m['id']])===id){linha=i+1;break}}
  if(vals.slice(1).some((r,i)=>txt_(r[m['usuário']??m['usuario']]).toLowerCase()===usuario&&(linha<0||i+2!==linha)))throw new Error('Este usuário já existe.');
  if(linha<0&&senha.length<6)throw new Error('A senha deve ter pelo menos 6 caracteres.');
  if(linha>0){
    const row=vals[linha-1].slice();
    row[m['nome']]=txt_(d.nome);row[m['usuário']??m['usuario']]=usuario;row[m['perfil']]=perfil;row[m['status']]=txt_(d.status)==='Inativo'?'Inativo':'Ativo';
    if(senha)row[m['senha hash']]=hash_(senha);
    if(m['salário']!==undefined)row[m['salário']]=salario;
    if(m['chave pix']!==undefined&&d.chavePix!==undefined)row[m['chave pix']]=txt_(d.chavePix);
    if(m['tipo chave pix']!==undefined&&d.tipoChavePix!==undefined)row[m['tipo chave pix']]=txt_(d.tipoChavePix);
    if(m['vale refeição dia']!==undefined)row[m['vale refeição dia']]=valeRefeicaoDia;
    if(m['dias por semana']!==undefined)row[m['dias por semana']]=diasSemana;
    sh.getRange(linha,1,1,row.length).setValues([row]);
    return{sucesso:true,mensagem:'Funcionário atualizado.'};
  }
  sh.appendRow([id_('FUNC'),txt_(d.nome),usuario,hash_(senha),perfil,txt_(d.status)==='Inativo'?'Inativo':'Ativo',new Date(),salario,txt_(d.chavePix),valeRefeicaoDia,diasSemana,txt_(d.tipoChavePix)]);
  return{sucesso:true,mensagem:'Funcionário cadastrado.'};
}

function listarRevendedores_(d){
  const u=auth_(d.token);
  if(txt_(u.perfil).toLowerCase()==='revendedor')throw new Error('Acesso não autorizado.');
  const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh);
  const revendedores=vals.slice(1).filter(r=>r.some(x=>x!=='')).map(r=>funcionarioLinha_(r,m))
    .filter(f=>txt_(f.perfil).toLowerCase()==='revendedor')
    .map(f=>({id:f.id,nome:f.nome,usuario:f.usuario,status:f.status,dataCadastro:f.dataCadastro}));
  return{sucesso:true,revendedores};
}
function cadastrarRevendedor_(d){
  const u=auth_(d.token);
  if(txt_(u.perfil).toLowerCase()==='revendedor')throw new Error('Acesso não autorizado.');
  const nome=txt_(d.nome),usuario=txt_(d.usuario).toLowerCase(),senha=String(d.senha||'');
  if(!nome||usuario.length<3)throw new Error('Confira o nome e o usuário do revendedor.');
  if(senha.length<6)throw new Error('A senha do revendedor deve ter pelo menos 6 caracteres.');
  const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh),cUsuario=m['usuário']??m['usuario'];
  if(vals.slice(1).some(r=>txt_(r[cUsuario]).toLowerCase()===usuario))throw new Error('Este usuário já existe.');
  const id=id_('FUNC');
  sh.appendRow([id,nome,usuario,hash_(senha),'Revendedor','Ativo',new Date(),0,'',0,6,'']);
  return{sucesso:true,idRevendedor:id,mensagem:'Revendedor cadastrado com sucesso.'};
}

function funcionariosComissao_(){
  const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh);
  return vals.slice(1).filter(r=>r.some(x=>x!=='' )).map(r=>funcionarioLinha_(r,m)).filter(f=>txt_(f.status).toLowerCase()==='ativo'&&!['administrador','revendedor'].includes(txt_(f.perfil).toLowerCase()));
}
function mesReferencia_(v){const m=txt_(v);return /^\d{4}-\d{2}$/.test(m)?m:Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM')}
function controlePagamento_(mes,funcionario,criar){
  const sh=aba_(CONFIG.ABAS.PAGAMENTOS),vals=sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++)if(String(vals[i][1])===mes&&String(vals[i][2])===String(funcionario.id))return{sh,row:i+1,valores:vals[i]};
  if(!criar)return null;
  const linha=[id_('PAG'),mes,funcionario.id,funcionario.nome,'Pendente','Não','Não',0,0,'','', '',new Date(),'Não',0,''];
  sh.appendRow(linha);return{sh,row:sh.getLastRow(),valores:linha};
}

function dataISOInterna_(v){
  if(v instanceof Date)return Utilities.formatDate(v,CONFIG.TIMEZONE,'yyyy-MM-dd');
  const s=txt_(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}
function dataPorISO_(s){const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12):null}
function isoDataObj_(d){return Utilities.formatDate(d,CONFIG.TIMEZONE,'yyyy-MM-dd')}
function hojeLocal_(){return dataPorISO_(Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd'))}
function ultimoDiaMes_(ano,mes0){return new Date(ano,mes0+1,0,12)}
function feriadoNacionalOuSextaSanta_(d){
  const md=Utilities.formatDate(d,CONFIG.TIMEZONE,'MM-dd');
  const fixos=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'];
  if(fixos.includes(md))return true;
  const a=d.getFullYear(),A=a%19,B=Math.floor(a/100),C=a%100,D=Math.floor(B/4),E=B%4,F=Math.floor((B+8)/25),G=Math.floor((B-F+1)/3),H=(19*A+B-D-G+15)%30,I=Math.floor(C/4),K=C%4,L=(32+2*E+2*I-H-K)%7,M=Math.floor((A+11*H+22*L)/451),mes=Math.floor((H+L-7*M+114)/31)-1,dia=((H+L-7*M+114)%31)+1;
  const pascoa=new Date(a,mes,dia,12),sexta=new Date(pascoa);sexta.setDate(pascoa.getDate()-2);
  return isoDataObj_(sexta)===isoDataObj_(d);
}
function ehDiaUtilPagamento_(d){return d.getDay()!==0&&!feriadoNacionalOuSextaSanta_(d)}
function quintoDiaUtilMes_(ano,mes0){
  let c=0,d=new Date(ano,mes0,1,12);
  while(c<5){if(ehDiaUtilPagamento_(d))c++;if(c<5)d.setDate(d.getDate()+1)}
  return d;
}
function vencimentoFolhaMes_(mes){
  const m=String(mes||'').match(/^(\d{4})-(\d{2})$/);if(!m)return null;
  const base=new Date(Number(m[1]),Number(m[2]),1,12);
  return quintoDiaUtilMes_(base.getFullYear(),base.getMonth());
}
function diffDiasCalendario_(a,b){return Math.round((new Date(b.getFullYear(),b.getMonth(),b.getDate(),12)-new Date(a.getFullYear(),a.getMonth(),a.getDate(),12))/86400000)}
function ehDiaPrevistoTrabalho_(d,diasSemana){
  if(feriadoNacionalOuSextaSanta_(d))return false;
  const w=d.getDay();if(w===0)return false;
  return Number(diasSemana)===5?w>=1&&w<=5:true;
}
function contarDiasPrevistos_(inicio,fim,diasSemana){
  if(!inicio||!fim||inicio>fim)return 0;let total=0,d=new Date(inicio);
  while(d<=fim){if(ehDiaPrevistoTrabalho_(d,diasSemana))total++;d.setDate(d.getDate()+1)}
  return total;
}
function calcularFolhaFuncionario_(f,mes){
  const mm=String(mes||'').match(/^(\d{4})-(\d{2})$/);if(!mm)return{salarioCalculado:0,valeRefeicaoCalculado:0,diasSalario:0,diasVale:0};
  const ano=Number(mm[1]),mes0=Number(mm[2])-1,iniMes=new Date(ano,mes0,1,12),fimMes=ultimoDiaMes_(ano,mes0),hoje=hojeLocal_();
  let adm=dataPorISO_(dataISOInterna_(f.dataCadastro))||iniMes;
  if(adm<iniMes)adm=iniMes;
  let corte=fimMes;if(hoje<fimMes)corte=hoje;
  if(corte<iniMes||adm>fimMes||adm>corte){
    const ven=vencimentoFolhaMes_(mes),diasAte=ven?diffDiasCalendario_(hoje,ven):0;
    return{salarioCalculado:0,valeRefeicaoCalculado:0,diasSalario:0,diasVale:0,dataInicio:'',dataFim:'',dataPagamento:ven?isoDataObj_(ven):'',dataPagamentoBR:ven?Utilities.formatDate(ven,CONFIG.TIMEZONE,'dd/MM/yyyy'):'',diasAtePagamento:diasAte};
  }
  const admOriginal=dataPorISO_(dataISOInterna_(f.dataCadastro))||iniMes;
  let diasSalario;
  if(admOriginal<=iniMes&&corte>=fimMes)diasSalario=30;
  else diasSalario=Math.min(30,Math.max(0,diffDiasCalendario_(adm,corte)+1));
  const salarioCalculado=Number((num_(f.salario)/30*diasSalario).toFixed(2));
  const diasVale=contarDiasPrevistos_(adm,corte,f.diasSemana||6);
  const valeRefeicaoCalculado=Number((diasVale*num_(f.valeRefeicaoDia)).toFixed(2));
  const ven=vencimentoFolhaMes_(mes),diasAte=ven?diffDiasCalendario_(hoje,ven):0;
  return{salarioCalculado,valeRefeicaoCalculado,diasSalario,diasVale,dataInicio:isoDataObj_(adm),dataFim:isoDataObj_(corte),dataPagamento:ven?isoDataObj_(ven):'',dataPagamentoBR:ven?Utilities.formatDate(ven,CONFIG.TIMEZONE,'dd/MM/yyyy'):'',diasAtePagamento:diasAte};
}
function vendasMesComissao_(mes){return registrosRaw_(aba_(CONFIG.ABAS.VENDAS)).filter(v=>chaveData_(v['Data da venda']).slice(0,7)===mes)}
function statusComissaoVenda_(v){
  const s=txt_(v&&v['Status comissão']);
  if(s==='Aprovada')return'Aprovada';
  if(s==='Negada'||s==='Recusada')return'Negada';
  return'Pendente';
}
function vendasAprovadasComissao_(mes){return vendasMesComissao_(mes).filter(v=>statusComissaoVenda_(v)==='Aprovada')}
function inicioComissaoFuncionarioMs_(f){
  const ms=Number(f&&f.dataCadastroMs||0);if(ms>0)return ms;
  const d=dataPorISO_(dataISOInterna_(f&&f.dataCadastro));return d?d.getTime():0;
}
function instanteVendaComissaoMs_(v){
  const cadastro=v&&v['Data de cadastro'];
  if(cadastro instanceof Date&&!isNaN(cadastro.getTime()))return cadastro.getTime();
  const texto=txt_(cadastro);
  if(texto){const dt=new Date(texto);if(!isNaN(dt.getTime()))return dt.getTime()}
  const dia=dataPorISO_(chaveData_(v&&v['Data da venda']));return dia?dia.getTime():0;
}
function vendasElegiveisComissao_(mes,f){
  const inicio=inicioComissaoFuncionarioMs_(f);
  // Só vendas aprovadas e registradas depois da entrada do funcionário geram comissão.
  if(!inicio)return [];
  return vendasAprovadasComissao_(mes).filter(v=>{const quando=instanteVendaComissaoMs_(v);return quando>0&&quando>=inicio});
}
function mesComissaoPossuiPagamento_(mes){
  const sh=aba_(CONFIG.ABAS.PAGAMENTOS),vals=sh.getDataRange().getDisplayValues();
  if(vals.length<2)return false;
  const h=vals[0].map(x=>normalizarCabecalho_(x)),cMes=h.indexOf('mes'),cPago=h.indexOf('comissao paga');
  if(cMes<0||cPago<0)return false;
  return vals.slice(1).some(r=>txt_(r[cMes])===mes&&txt_(r[cPago]).toLowerCase()==='sim');
}
function listarVendasComissao_(d){
  const u=auth_(d.token),mes=mesReferencia_(d.mes),inicioUsuario=inicioComissaoFuncionarioMs_(u);
  const ehFuncionario=!['administrador','revendedor'].includes(txt_(u.perfil).toLowerCase());
  const vendas=vendasMesComissao_(mes).slice().sort((a,b)=>instanteVendaComissaoMs_(b)-instanteVendaComissaoMs_(a)).map(v=>{
    const status=statusComissaoVenda_(v),quando=instanteVendaComissaoMs_(v);
    const elegivelUsuario=ehFuncionario&&inicioUsuario>0&&quando>=inicioUsuario;
    const valor=num_(v['Valor da venda']);
    return{
      id:txt_(v['ID Venda']),data:chaveData_(v['Data da venda']),cliente:txt_(v['Nome do cliente']),
      modelo:txt_(v['Modelo']),armazenamento:txt_(v['Armazenamento']),valor,responsavel:txt_(v['Funcionário responsável']),
      statusComissao:status,atualizadoPor:txt_(v['Comissão atualizada por']),
      atualizadoEm:v['Comissão atualizada em'] instanceof Date?fmtDH_(v['Comissão atualizada em']):txt_(v['Comissão atualizada em']),
      elegivelUsuario,comissaoUsuario:status==='Aprovada'&&elegivelUsuario?Number((valor*CONFIG.COMISSAO_PERCENTUAL).toFixed(2)):0
    };
  });
  return{
    sucesso:true,mes,percentual:CONFIG.COMISSAO_PERCENTUAL*100,vendas,
    resumo:{
      total:vendas.length,
      pendentes:vendas.filter(v=>v.statusComissao==='Pendente').length,
      aprovadas:vendas.filter(v=>v.statusComissao==='Aprovada').length,
      negadas:vendas.filter(v=>v.statusComissao==='Negada').length
    }
  };
}
function alterarStatusComissaoVenda_(d){
  const u=auth_(d.token);admin_(u);
  const id=txt_(d.idVenda),status=txt_(d.status);
  if(!id)throw new Error('Venda não informada.');
  if(!['Pendente','Aprovada','Negada'].includes(status))throw new Error('Status de comissão inválido.');
  const sh=aba_(CONFIG.ABAS.VENDAS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh);
  const cId=m['id venda'],cStatus=m['status comissão'],cPor=m['comissão atualizada por'],cEm=m['comissão atualizada em'];
  if([cId,cStatus,cPor,cEm].some(c=>c===undefined))throw new Error('Execute configurarSistema() para atualizar a aba Vendas.');
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][cId])!==id)continue;
    const mes=chaveData_(vals[i][m['data da venda']]).slice(0,7);
    const atual=txt_(vals[i][cStatus])||'Pendente';
    if(atual!==status&&mesComissaoPossuiPagamento_(mes))throw new Error('Já existe comissão paga neste mês. Reabra os pagamentos de comissão antes de alterar esta venda.');
    sh.getRange(i+1,cStatus+1).setValue(status);
    sh.getRange(i+1,cPor+1).setValue(u.nome);
    sh.getRange(i+1,cEm+1).setValue(new Date());
    return{sucesso:true,status,mensagem:'Status da comissão da venda atualizado.'};
  }
  throw new Error('Venda não encontrada.');
}

function chaveMesVale_(valor,dataSolicitacao){
  if(valor instanceof Date&&!isNaN(valor.getTime()))return Utilities.formatDate(valor,CONFIG.TIMEZONE,'yyyy-MM');
  const s=txt_(valor).replace(/^'/,'');
  let m=s.match(/^(\d{4})[-\/]?(\d{2})(?:[-\/]\d{1,2})?/);if(m)return m[1]+'-'+m[2];
  m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);if(m)return m[3]+'-'+String(m[2]).padStart(2,'0');
  const chave=chaveData_(valor);if(chave)return chave.slice(0,7);
  const data=chaveData_(dataSolicitacao);return data?data.slice(0,7):'';
}
function normalizarMesesVales_(){
  const sh=aba_(CONFIG.ABAS.VALES);if(!sh||sh.getLastRow()<2)return;
  const vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh),cMes=m['mês']??m['mes'],cData=m['data solicitação'];if(cMes===undefined||cData===undefined)return;
  for(let i=1;i<vals.length;i++){
    if(!vals[i].some(x=>x!==''))continue;
    const mes=chaveMesVale_(vals[i][cMes],vals[i][cData]);
    if(mes){const cel=sh.getRange(i+1,cMes+1);cel.setNumberFormat('@');cel.setValue(mes)}
  }
  SpreadsheetApp.flush();
}
function valesMes_(mes){
  const sh=aba_(CONFIG.ABAS.VALES),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh),cMes=m['mês']??m['mes'],cData=m['data solicitação'];
  return vals.slice(1).map((r,idx)=>({r,idx,mesLinha:chaveMesVale_(cMes===undefined?'':r[cMes],cData===undefined?'':r[cData])})).filter(x=>x.r.some(v=>v!=='' )&&x.mesLinha===mes).map(({r,idx,mesLinha})=>({
    _linha:idx+2,id:txt_(r[m['id vale']]),dataRaw:r[m['data solicitação']],dataSolicitacao:r[m['data solicitação']] instanceof Date?fmtDH_(r[m['data solicitação']]):txt_(r[m['data solicitação']]),
    mes:mesLinha,idFuncionario:txt_(r[m['id funcionário']??m['id funcionario']]),funcionario:txt_(r[m['funcionário']??m['funcionario']]),valor:num_(r[m['valor']]),motivo:txt_(r[m['motivo']]),status:txt_(r[m['status']])||'Pendente',
    decididoPor:txt_(r[m['decidido por']]),dataDecisao:r[m['data decisão']] instanceof Date?fmtDH_(r[m['data decisão']]):txt_(r[m['data decisão']]),dataPagamento:r[m['data pagamento']] instanceof Date?fmtDH_(r[m['data pagamento']]):txt_(r[m['data pagamento']])
  }));
}
function totalValesFuncionarioMes_(mes,idFuncionario,status){return valesMes_(mes).filter(v=>String(v.idFuncionario)===String(idFuncionario)&&(!status||v.status===status)).reduce((s,v)=>s+num_(v.valor),0)}
function listarVales_(d){
  const u=auth_(d.token),mes=mesReferencia_(d.mes),admin=txt_(u.perfil).toLowerCase()==='administrador';
  let vales=valesMes_(mes);if(!admin)vales=vales.filter(v=>String(v.idFuncionario)===String(u.id));
  vales.sort((a,b)=>{const da=a.dataRaw instanceof Date?a.dataRaw.getTime():0,db=b.dataRaw instanceof Date?b.dataRaw.getTime():0;return db-da});
  let saldoDisponivel=0;
  if(!admin){const f=funcionariosComissao_().find(x=>String(x.id)===String(u.id))||u,folha=calcularFolhaFuncionario_(f,mes),aprov=totalValesFuncionarioMes_(mes,u.id,'Aprovado'),pend=totalValesFuncionarioMes_(mes,u.id,'Pendente');saldoDisponivel=Number((folha.salarioCalculado-aprov-pend).toFixed(2))}
  return{sucesso:true,mes,vales,saldoDisponivel,resumo:{pendentes:vales.filter(v=>v.status==='Pendente').length,aprovados:vales.filter(v=>v.status==='Aprovado').length,negados:vales.filter(v=>v.status==='Negado').length,valorAprovado:vales.filter(v=>v.status==='Aprovado').reduce((s,v)=>s+v.valor,0),valorPendente:vales.filter(v=>v.status==='Pendente').reduce((s,v)=>s+v.valor,0)}};
}
function solicitarVale_(d){
  const u=auth_(d.token);if(['administrador','revendedor'].includes(txt_(u.perfil).toLowerCase()))throw new Error('Esta solicitação é exclusiva para funcionários.');
  const valor=Math.round(num_(d.valor)*100)/100;if(valor<=0)throw new Error('Informe um valor de vale válido.');
  const mes=Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM'),f=funcionariosComissao_().find(x=>String(x.id)===String(u.id))||u,folha=calcularFolhaFuncionario_(f,mes);
  const ctrl=controlePagamento_(mes,f,false);if(ctrl&&txt_(ctrl.valores[6]).toLowerCase()==='sim')throw new Error('O salário deste mês já foi pago. Não é possível solicitar novo vale neste período.');
  const aprovados=totalValesFuncionarioMes_(mes,u.id,'Aprovado'),pendentes=totalValesFuncionarioMes_(mes,u.id,'Pendente'),saldoAtual=Number((folha.salarioCalculado-aprovados-pendentes-valor).toFixed(2));
  const shVales=aba_(CONFIG.ABAS.VALES),idVale=id_('VALE'),agora=new Date(),motivo=txt_(d.motivo);
  shVales.appendRow([idVale,agora,'',u.id,u.nome,valor,motivo,'Pendente','','','']);
  const mVales=mapaCabecalho_(shVales),cMes=mVales['mês']??mVales['mes'];if(cMes!==undefined){const cel=shVales.getRange(shVales.getLastRow(),cMes+1);cel.setNumberFormat('@');cel.setValue(mes)}
  SpreadsheetApp.flush();
  return{sucesso:true,mes,saldoDisponivel:saldoAtual,vale:{id:idVale,dataSolicitacao:fmtDH_(agora),mes,idFuncionario:u.id,funcionario:u.nome,valor,motivo,status:'Pendente'},mensagem:'Solicitação de vale enviada para aprovação.'};
}
function alterarStatusVale_(d){
  const u=auth_(d.token);admin_(u);const id=txt_(d.idVale),status=txt_(d.status);if(!id)throw new Error('Vale não informado.');if(!['Pendente','Aprovado','Negado'].includes(status))throw new Error('Status inválido.');
  const sh=aba_(CONFIG.ABAS.VALES),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh),cId=m['id vale'];
  for(let i=1;i<vals.length;i++){
    if(String(vals[i][cId])!==id)continue;const mes=chaveMesVale_(vals[i][m['mês']??m['mes']],vals[i][m['data solicitação']]),idFunc=txt_(vals[i][m['id funcionário']??m['id funcionario']]),valor=num_(vals[i][m['valor']]),statusAtual=txt_(vals[i][m['status']])||'Pendente';
    const fAtual=funcionariosComissao_().find(x=>String(x.id)===idFunc);if(statusAtual!==status&&fAtual){const ctrl=controlePagamento_(mes,fAtual,false);if(ctrl&&txt_(ctrl.valores[6]).toLowerCase()==='sim')throw new Error('O salário deste funcionário já foi pago neste mês. Reabra o pagamento do salário antes de alterar o vale.')}
    if(status==='Aprovado'&&!fAtual)throw new Error('Funcionário não encontrado ou inativo.');
    sh.getRange(i+1,m['status']+1).setValue(status);sh.getRange(i+1,m['decidido por']+1).setValue(status==='Pendente'?'':u.nome);sh.getRange(i+1,m['data decisão']+1).setValue(status==='Pendente'?'':new Date());sh.getRange(i+1,m['data pagamento']+1).setValue(status==='Aprovado'?new Date():'');SpreadsheetApp.flush();
    return{sucesso:true,status,mensagem:status==='Aprovado'?'Vale aprovado, registrado como pago e descontado do salário.':status==='Negado'?'Vale negado.':'Solicitação reaberta.'};
  }
  throw new Error('Solicitação de vale não encontrada.');
}

function listarFinanceiroEquipe_(d){
  const u=auth_(d.token),mes=mesReferencia_(d.mes),vendasAprovadas=vendasAprovadasComissao_(mes),hoje=hojeLocal_();
  let funcionarios=funcionariosComissao_();
  if(txt_(u.perfil).toLowerCase()!=='administrador')funcionarios=funcionarios.filter(f=>String(f.id)===String(u.id));
  const itens=funcionarios.map(f=>{
    const folha=calcularFolhaFuncionario_(f,mes),vendas=vendasElegiveisComissao_(mes,f),faturamento=vendas.reduce((s,v)=>s+num_(v['Valor da venda']),0),comissaoBase=Number((faturamento*CONFIG.COMISSAO_PERCENTUAL).toFixed(2));
    const valesAprovados=Number(totalValesFuncionarioMes_(mes,f.id,'Aprovado').toFixed(2)),valesPendentes=Number(totalValesFuncionarioMes_(mes,f.id,'Pendente').toFixed(2)),salarioLiquido=Number((folha.salarioCalculado-valesAprovados).toFixed(2)),saldoSalarioAtual=Number((folha.salarioCalculado-valesAprovados-valesPendentes).toFixed(2));
    const ctrl=controlePagamento_(mes,f,true),c=ctrl.valores,comissaoPaga=txt_(c[5]).toLowerCase()==='sim',salarioPago=txt_(c[6]).toLowerCase()==='sim';
    const valorComissaoPago=num_(c[7]),valorSalarioPago=num_(c[8]),vrRaw=txt_(c[13]),valeRefeicaoPago=vrRaw?vrRaw.toLowerCase()==='sim':salarioPago,valorValeRefeicaoPago=num_(c[14]);
    const comissaoPendente=!comissaoPaga?comissaoBase:0,salarioPendente=!salarioPago?Math.max(0,salarioLiquido):0,valeRefeicaoPendente=!valeRefeicaoPago?folha.valeRefeicaoCalculado:0;
    const totalAcumulado=Number((salarioLiquido+folha.valeRefeicaoCalculado+comissaoBase).toFixed(2)),totalPagar=Number((salarioPendente+valeRefeicaoPendente+comissaoPendente).toFixed(2)),totalSaldoAtual=Number(((salarioPago?0:saldoSalarioAtual)+valeRefeicaoPendente+comissaoPendente).toFixed(2));
    return{id:f.id,nome:f.nome,perfil:f.perfil,salario:num_(f.salario),salarioCalculado:folha.salarioCalculado,salarioLiquido,saldoSalarioAtual,valesAprovados,valesPendentes,diasSalario:folha.diasSalario,valeRefeicaoDia:num_(f.valeRefeicaoDia),valeRefeicaoCalculado:folha.valeRefeicaoCalculado,diasVale:folha.diasVale,diasSemana:f.diasSemana,chavePix:f.chavePix,tipoChavePix:f.tipoChavePix,dataCadastro:f.dataCadastro,vendas:vendas.length,faturamento,comissaoCalculada:comissaoBase,comissaoPaga,salarioPago,valeRefeicaoPago,valorComissaoPago,valorSalarioPago,valorValeRefeicaoPago,comissaoPendente,salarioPendente,valeRefeicaoPendente,totalPagar,totalSaldoAtual,totalAcumulado,totalPrevisto:totalAcumulado,dataPagamento:folha.dataPagamento,dataPagamentoBR:folha.dataPagamentoBR,diasAtePagamento:folha.diasAtePagamento};
  });
  const venc=vencimentoFolhaMes_(mes),diasAte=venc?diffDiasCalendario_(hoje,venc):0;
  return{sucesso:true,mes,percentual:CONFIG.COMISSAO_PERCENTUAL*100,vendasCompartilhadas:vendasAprovadas.length,faturamentoCompartilhado:vendasAprovadas.reduce((s,v)=>s+num_(v['Valor da venda']),0),dataPagamento:venc?isoDataObj_(venc):'',dataPagamentoBR:venc?Utilities.formatDate(venc,CONFIG.TIMEZONE,'dd/MM/yyyy'):'',diasAtePagamento:diasAte,itens,resumo:{salarios:itens.reduce((s,x)=>s+x.salarioCalculado,0),salariosLiquidos:itens.reduce((s,x)=>s+x.salarioLiquido,0),valesAprovados:itens.reduce((s,x)=>s+x.valesAprovados,0),valeRefeicao:itens.reduce((s,x)=>s+x.valeRefeicaoCalculado,0),comissoes:itens.reduce((s,x)=>s+x.comissaoCalculada,0),totalAcumulado:itens.reduce((s,x)=>s+x.totalAcumulado,0),totalPrevisto:itens.reduce((s,x)=>s+x.totalAcumulado,0),totalPagar:itens.reduce((s,x)=>s+x.totalPagar,0)}};
}
function salvarMeuPix_(d){
  const u=auth_(d.token),pix=txt_(d.chavePix),tipo=txt_(d.tipoChavePix);
  const tipos=['Telefone','E-mail','CPF/CNPJ','Chave aleatória'];
  if(!tipos.includes(tipo))throw new Error('Selecione o tipo da chave Pix.');
  if(pix.length<3)throw new Error('Informe uma chave Pix válida.');
  if(tipo==='E-mail'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pix))throw new Error('Informe um e-mail válido para a chave Pix.');
  if(tipo==='Telefone'&&pix.replace(/\D/g,'').length<10)throw new Error('Informe um telefone válido para a chave Pix.');
  if(tipo==='CPF/CNPJ'&&![11,14].includes(pix.replace(/\D/g,'').length))throw new Error('Informe um CPF ou CNPJ válido para a chave Pix.');
  const sh=aba_(CONFIG.ABAS.FUNCIONARIOS),vals=sh.getDataRange().getValues(),m=mapaCabecalho_(sh);
  if(m['chave pix']===undefined||m['tipo chave pix']===undefined)throw new Error('Execute configurarSistema() para atualizar os campos da chave Pix.');
  for(let i=1;i<vals.length;i++)if(String(vals[i][m['id']])===String(u.id)){
    sh.getRange(i+1,m['chave pix']+1).setValue(pix);
    sh.getRange(i+1,m['tipo chave pix']+1).setValue(tipo);
    return{sucesso:true,chavePix:pix,tipoChavePix:tipo,mensagem:'Chave Pix salva.'};
  }
  throw new Error('Funcionário não encontrado.');
}
function registrarPagamentoEquipe_(d){
  const u=auth_(d.token);admin_(u);const mes=mesReferencia_(d.mes),id=txt_(d.idFuncionario),tipo=txt_(d.tipo).toLowerCase(),pago=d.pago===false||txt_(d.pago).toLowerCase()==='false'?false:true;
  if(!['comissao','salario','total'].includes(tipo))throw new Error('Tipo de pagamento inválido.');
  const f=funcionariosComissao_().find(x=>String(x.id)===id);if(!f)throw new Error('Funcionário não encontrado.');
  const c=controlePagamento_(mes,f,true),sh=c.sh,row=c.row,agora=new Date(),folha=calcularFolhaFuncionario_(f,mes);
  const vendas=vendasElegiveisComissao_(mes,f);
  const faturamento=vendas.reduce((s,v)=>s+num_(v['Valor da venda']),0),valorComissao=Number((faturamento*CONFIG.COMISSAO_PERCENTUAL).toFixed(2));
  if(tipo==='comissao'||tipo==='total'){
    if(pago&&valorComissao<=0&&tipo==='comissao')throw new Error('Não há comissão aprovada para baixar neste mês.');
    sh.getRange(row,6).setValue(pago?'Sim':'Não');sh.getRange(row,8).setValue(pago?valorComissao:0);sh.getRange(row,10).setValue(pago?agora:'');
  }
  if(tipo==='salario'||tipo==='total'){
    const valesAprovados=totalValesFuncionarioMes_(mes,f.id,'Aprovado'),salarioLiquido=Math.max(0,Number((folha.salarioCalculado-valesAprovados).toFixed(2)));
    sh.getRange(row,7).setValue(pago?'Sim':'Não');sh.getRange(row,9).setValue(pago?salarioLiquido:0);sh.getRange(row,11).setValue(pago?agora:'');
    sh.getRange(row,14).setValue(pago?'Sim':'Não');sh.getRange(row,15).setValue(pago?folha.valeRefeicaoCalculado:0);sh.getRange(row,16).setValue(pago?agora:'');
  }
  sh.getRange(row,12,1,2).setValues([[u.nome,agora]]);
  const valesAprovadosRet=totalValesFuncionarioMes_(mes,f.id,'Aprovado'),salarioLiquidoRet=Math.max(0,Number((folha.salarioCalculado-valesAprovadosRet).toFixed(2)));
  return{sucesso:true,mensagem:pago?'Pagamento baixado com sucesso.':'Pagamento reaberto.',salario:salarioLiquidoRet,valeRefeicao:folha.valeRefeicaoCalculado,comissao:valorComissao};
}

function excluirFuncionario_(d){
  const u=auth_(d.token);admin_(u);const id=txt_(d.idFuncionario);
  if(!id)throw new Error('Funcionário não informado.');
  if(String(id)===String(u.id))throw new Error('Você não pode excluir o seu próprio usuário.');
  const removido=remover_(CONFIG.ABAS.FUNCIONARIOS,'ID',id);
  if(!removido)throw new Error('Funcionário não encontrado.');
  const props=PropertiesService.getScriptProperties(),todas=props.getProperties();
  Object.keys(todas).filter(k=>k.indexOf('TOKEN_')===0).forEach(k=>{try{const sessao=JSON.parse(todas[k]);if(String(sessao.funcionario&&sessao.funcionario.id)===String(id))props.deleteProperty(k)}catch(e){}});
  log_('Funcionário',id,txt_(d.motivo)||'Cadastro excluído pelo administrador',u,removido);
  return{sucesso:true,mensagem:'Cadastro excluído.'};
}

function migrarIMEI2_(){
  [[CONFIG.ABAS.COMPRAS,'IMEI'],[CONFIG.ABAS.ESTOQUE,'IMEI'],[CONFIG.ABAS.VENDAS,'IMEI']].forEach(([nome,antes])=>{const sh=aba_(nome),h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];if(h.indexOf('IMEI 2')<0){const c=h.indexOf(antes)+1;sh.insertColumnAfter(c);sh.getRange(1,c+1).setValue('IMEI 2')}});
}
function criarAba_(ss,nome,h){let sh=ss.getSheetByName(nome);if(!sh)sh=ss.insertSheet(nome);sh.getRange(1,1,1,h.length).setValues([h]);sh.setFrozenRows(1);return sh}
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
