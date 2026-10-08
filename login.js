const form=document.querySelector('#loginForm');
const message=document.querySelector('#loginMsg');
async function request(body){
  const response=await fetch('/api/interna',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok||!result.sucesso)throw Error(result.mensagem||'Não foi possível entrar.');
  return result;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=form.querySelector('button[type="submit"]');button.disabled=true;message.textContent='Entrando...';
  try{
    await request({acao:'login',usuario:document.querySelector('#loginUsuario').value,senha:document.querySelector('#loginSenha').value});
    localStorage.setItem('ct_token','cookie');
    location.replace('/api/painel');
  }catch(error){message.textContent=error.message;button.disabled=false;}
});
function applyTheme(){
  const dark=localStorage.getItem('celltech_tema')==='dark';
  document.body.classList.toggle('dark-theme',dark);
  document.querySelector('#loginThemeToggle i').className=dark?'fa-solid fa-sun':'fa-solid fa-moon';
}
document.querySelector('#loginThemeToggle').addEventListener('click',()=>{
  localStorage.setItem('celltech_tema',document.body.classList.contains('dark-theme')?'light':'dark');applyTheme();
});
applyTheme();
request({acao:'verificarToken'}).then(()=>{localStorage.setItem('ct_token','cookie');location.replace('/api/painel');}).catch(()=>{});
