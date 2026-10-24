// Datas civis: cálculos em UTC, sem avançar ou retroceder com o fuso do navegador.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ChegadasDias=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const date=v=>new Date(`${v}T12:00:00Z`),iso=d=>d.toISOString().slice(0,10);
  function initialMonth(today){const d=date(today);d.setUTCMonth(d.getUTCMonth()-1,1);return iso(d).slice(0,7)}
  function holiday(d){
    const md=iso(d).slice(5);if(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'].includes(md))return true;
    const y=d.getUTCFullYear(),A=y%19,B=Math.floor(y/100),C=y%100,D=Math.floor(B/4),E=B%4,F=Math.floor((B+8)/25),G=Math.floor((B-F+1)/3),H=(19*A+B-D-G+15)%30,I=Math.floor(C/4),K=C%4,L=(32+2*E+2*I-H-K)%7,M=Math.floor((A+11*H+22*L)/451),m=Math.floor((H+L-7*M+114)/31)-1,day=((H+L-7*M+114)%31)+1;
    return iso(new Date(Date.UTC(y,m,day-2,12)))===iso(d);
  }
  function fifthBusinessDay(month){
    const [year,m]=month.split('-').map(Number),d=new Date(Date.UTC(year,m-1,1,12));let count=0;
    while(count<5){if(d.getUTCDay()!==0&&!holiday(d))count++;if(count<5)d.setUTCDate(d.getUTCDate()+1)}
    return iso(d);
  }
  function pending({inicio,fim,funcionarios,registros=[],mesesPagos=[],incluirFolgas=false}){
    const saved=new Map(registros.map(r=>[`${r.idFuncionario}:${r.data}`,r]));
    const paid=new Set(mesesPagos.map(p=>`${p.idFuncionario}:${p.mes}`)),items=[];
    for(let day=date(inicio);day<=date(fim);day.setUTCDate(day.getUTCDate()+1)){
      const data=iso(day),week=day.getUTCDay();
      for(const f of funcionarios){
        if(String(f.status).toLowerCase()!=='ativo'||f.dataCadastro&&data<f.dataCadastro.slice(0,10)||paid.has(`${f.id}:${data.slice(0,7)}`))continue;
        const old=saved.get(`${f.id}:${data}`);if(old&&!old.cancelado)continue;
        const folga=week===0||week===6&&Number(f.diasSemana)===5;if(folga&&!incluirFolgas)continue;
        items.push({id:`${f.id}:${data}`,data,funcionario:f,anterior:old,folga,previsto:old?.previsto||(week===6?f.horarioSabado||f.horarioEntrada:f.horarioEntrada)||''});
      }
    }
    return items;
  }
  function calculation({previsto,chegada,salario,horasMensais=220,toleranciaMinutos=5,abonado=false}){
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(previsto)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(chegada))return null;
    const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3)),atraso=Math.max(0,minutes(chegada)-minutes(previsto)),atrasado=atraso>Number(toleranciaMinutos);
    return {atraso,atrasado,desconto:Math.round((abonado||!atrasado?0:Number(salario)/Number(horasMensais)/60*atraso)*100)/100};
  }
  return {initialMonth,fifthBusinessDay,pending,calculation};
});
