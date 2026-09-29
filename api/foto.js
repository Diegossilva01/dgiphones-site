const {query}=require('../lib/db');
module.exports=async(req,res)=>{
  const id=String(req.query.id||'');
  if(!/^[0-9a-f-]{36}$/.test(id))return res.status(404).end();
  try{
    const r=await query("SELECT mime_type,encode(bytes,'base64') AS base64 FROM ct_photos WHERE photo_id=$1",[id]);
    if(!r.length)return res.status(404).end();
    res.setHeader('Content-Type',r[0].mime_type);res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    return res.end(Buffer.from(r[0].base64,'base64'));
  }catch(e){console.error(e);return res.status(503).end()}
};
