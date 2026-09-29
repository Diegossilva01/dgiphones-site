const {get}=require('../lib/db');
const {text}=require('../lib/common');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{
    const id=text(req.query.idOS),chave=text(req.query.chave);
    if(!id||!chave)return res.status(400).json({sucesso:false,mensagem:'Link incompleto.'});
    const r=await get('OrdensServico',id);
    if(!r||text(r['Chave pública'])!==chave)return res.status(404).json({sucesso:false,mensagem:'Link de acompanhamento inválido.'});
    return res.json({sucesso:true,ordem:{idOS:id,status:r.Status||'Recebido',aparelho:r['Aparelho / produto'],servico:r['Descrição do serviço'],dataOS:r['Data da OS'],atualizadoEm:r['Status atualizado em']||r['Data de cadastro']}});
  }catch(e){console.error(e);return res.status(503).json({sucesso:false,mensagem:'Serviço indisponível.'})}
};
