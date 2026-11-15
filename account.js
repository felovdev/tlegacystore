(()=>{"use strict";
const cfg=window.FIREBASE_CONFIG;
if(!cfg||!window.firebase)return;
const auth=firebase.auth();
const fn=()=>firebase.app().functions("europe-west1");
const synthetic=u=>u.toLowerCase()+"@accounts.tlegacystore.invalid";
const $=id=>document.getElementById(id);
let guestName="",readyResolve;
window.TLS_READY=new Promise(resolve=>readyResolve=resolve);
window.TLS_AUTH=auth;
window.TLS_STATE={guestName:"",user:null,profile:null};
function modal(){
 if($("tlsModal"))return;
 const el=document.createElement("div");el.id="tlsModal";el.className="tls-overlay hidden";
 el.innerHTML='<section class="tls-modal" role="dialog" aria-modal="true"><button class="tls-close" id="tlsClose" aria-label="Закрыть">×</button><h2 id="tlsTitle">Аккаунт TLegacyStore</h2><p id="tlsHint" class="muted">Войди или создай аккаунт. Email не требуется.</p><label>Логин<input id="tlsLogin" maxlength="24" autocomplete="username" placeholder="Твой логин"></label><label>Пароль<input id="tlsPassword" type="password" minlength="8" autocomplete="current-password" placeholder="Не менее 8 символов"></label><div class="tls-actions"><button id="tlsSignIn">Войти</button><button id="tlsSignUp" class="secondary">Регистрация</button></div><p id="tlsError" class="tls-error" aria-live="polite"></p></section>';
 document.body.appendChild(el);
 $("tlsClose").onclick=()=>el.classList.add("hidden");
 el.addEventListener("click",e=>{if(e.target===el)el.classList.add("hidden")});
 $("tlsSignIn").onclick=()=>signIn();
 $("tlsSignUp").onclick=()=>signUp();
}
function openModal(){modal();$("tlsModal").classList.remove("hidden");$("tlsError").textContent="";}
function validLogin(u){return /^[a-zA-Z0-9_]{3,24}$/.test(u)&&!u.toLowerCase().startsWith("guest_")}
async function signIn(){
 const u=$("tlsLogin").value.trim(),p=$("tlsPassword").value;
 if(!validLogin(u)){ $("tlsError").textContent="Логин: 3–24 символа, латиница, цифры и _.";return}
 try{await auth.signInWithEmailAndPassword(synthetic(u),p);$("tlsModal").classList.add("hidden")}
 catch(e){$("tlsError").textContent="Не удалось войти. Проверь логин и пароль."}
}
async function signUp(){
 const u=$("tlsLogin").value.trim(),p=$("tlsPassword").value;
 if(!validLogin(u)){ $("tlsError").textContent="Логин: 3–24 символа, латиница, цифры и _. guest_ зарезервирован.";return}
 if(p.length<8){$("tlsError").textContent="Пароль должен содержать минимум 8 символов.";return}
 try{
   let cred;
   if(auth.currentUser&&auth.currentUser.isAnonymous){
     const ec=firebase.auth.EmailAuthProvider.credential(synthetic(u),p);
     cred=await auth.currentUser.linkWithCredential(ec);
   }else cred=await auth.createUserWithEmailAndPassword(synthetic(u),p);
   await fn().httpsCallable("claimUsername")({username:u});
   $("tlsModal").classList.add("hidden");
 }catch(e){
   $("tlsError").textContent=e.code==="auth/email-already-in-use"||e.code==="functions/already-exists"?"Этот логин уже занят.":"Не удалось создать аккаунт: "+(e.message||"попробуй позже");
 }
}
async function ensureGuest(user){
 if(!user||!user.isAnonymous)return;
 try{
   const res=await fn().httpsCallable("allocateGuest")({});
   guestName=res.data.guestName||"";
   window.TLS_STATE.guestName=guestName;
 }catch(e){console.error("Guest allocation failed",e);guestName="Гость";window.TLS_STATE.guestName=guestName}
}
async function updateHeader(user){
 const b=$("accountOpen");if(!b)return;
 if(user&&!user.isAnonymous){
  const p=await firebase.firestore().collection("users").doc(user.uid).get().catch(()=>null);
  window.TLS_STATE.profile=p&&p.exists?p.data():null;
  b.textContent=(window.TLS_STATE.profile&&window.TLS_STATE.profile.username)||"Аккаунт";
  b.title="Нажми, чтобы выйти";
  b.onclick=async()=>{if(confirm("Выйти из аккаунта?"))await auth.signOut()};
 }else{
  b.textContent=guestName||"Гость";
  b.title="Войти или зарегистрироваться";
  b.onclick=openModal;
 }
}
async function start(){
 modal();
 auth.onAuthStateChanged(async user=>{
  window.TLS_STATE.user=user||null;
  if(!user){try{await auth.signInAnonymously()}catch(e){console.error(e);readyResolve();return}}
  else{
   if(user.isAnonymous)await ensureGuest(user);
   await updateHeader(user);
   if($("accountOpen")&&user.isAnonymous)$("accountOpen").onclick=openModal;
   readyResolve();
  }
 });
}
document.addEventListener("DOMContentLoaded",()=>{
 const theme=$("themeToggle");
 const saved=localStorage.getItem("tls-theme");
 if(saved==="dark")document.body.classList.add("dark");
 if(theme)theme.onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("tls-theme",document.body.classList.contains("dark")?"dark":"light")};
 if($("accountOpen"))$("accountOpen").onclick=openModal;
 if($("contactOpen"))$("contactOpen").onclick=()=>{openModal();$("tlsHint").textContent="Войди или зарегистрируйся, чтобы написать администратору."};
});
start();
})();