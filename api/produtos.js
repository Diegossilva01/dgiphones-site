const {rows,clean}=require('../lib/db');
const {normal,money,photos}=require('../lib/common');
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=60');
  try{
    const produtos=(await rows('Estoque')).map(clean).filter(r=>normal(r.Status)==='disponivel'&&['Publicado','Reservado'].includes(r['Status site'])).map(r=>{
      const fotos=photos(r['Fotos URLs']);if(!fotos.length&&r['Foto URL'])fotos.push(r['Foto URL']);
      return {id:r['ID Estoque'],modelo:r.Modelo,armazenamento:r.Armazenamento,cor:r.Cor,preco:money(r['Preço site']),categoria:r['Categoria site']||'iPhone',condicao:r['Condição site']||'Seminovo',bateria:r['Bateria site']||'',status:r['Status site'],foto:fotos[0]||'',fotos};
    });
    return res.json({sucesso:true,produtos});
  }catch(e){console.error(e);return res.status(503).json({sucesso:false,mensagem:'Catálogo indisponível.'})}
};
