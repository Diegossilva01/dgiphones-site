const {neon}=require('@neondatabase/serverless');
let connection;
const query=(sql,params=[])=>{
  if(!process.env.DATABASE_URL)throw Error('DATABASE_URL não configurada na Vercel.');
  return (connection ||= neon(process.env.DATABASE_URL)).query(sql,params);
};
const rows=async name=>(await query('SELECT record_key,source_row,data FROM ct_records WHERE collection=$1 ORDER BY source_row',[name])).map(r=>({...r.data,_key:r.record_key,_linha:r.source_row}));
const get=async(name,key)=>{
  const r=await query('SELECT record_key,source_row,data FROM ct_records WHERE collection=$1 AND record_key=$2',[name,String(key||'')]);
  return r[0]&&{...r[0].data,_key:r[0].record_key,_linha:r[0].source_row};
};
const add=async(name,key,data)=>query("INSERT INTO ct_records(collection,record_key,source_row,data) VALUES($1,$2,nextval('ct_row_seq'),$3::jsonb) ON CONFLICT DO NOTHING RETURNING record_key",[name,key,JSON.stringify(data)]);
const put=async(name,key,data)=>query('UPDATE ct_records SET data=$3::jsonb WHERE collection=$1 AND record_key=$2 RETURNING record_key',[name,key,JSON.stringify(data)]);
const del=async(name,key)=>query('DELETE FROM ct_records WHERE collection=$1 AND record_key=$2 RETURNING data',[name,String(key)]);
const clean=r=>{if(!r)return r;const {_key,_linha,...rest}=r;return rest};
module.exports={query,rows,get,add,put,del,clean};
