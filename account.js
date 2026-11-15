(()=>{"use strict";
const $=id=>document.getElementById(id);
let auth=null,guestName="",readyResolve;
window.TLS_READY=new Promise(resolve=>readyResolve=resolve);
window.TLS_STATE={guestName:"",user:null,profile:null};
const synthetic=u=>u.toLowerCase()+"@accounts.tlegacystore.invalid";
function modal(){
 if($("tlsModal"))return;
 const el=document.createElement("div");el.id="tlsModal";el.className="tls-overlay hidden";
 el.innerHTML='<section class="tls-modal" role="dialog" aria-modal="true"><button class="tls-close" id="tlsClose" aria-label="Закрыть" type="button">×</button><h2>Аккаунт TLegacyStore</h2><p id="tlsHint" class="muted">Войди или создай аккаунт. Email не требуется.</p><label>Логин<input id="tlsLogin" maxlength="24" autocomplete="username" placeholder="Твой логин"></label><label>Пароль<input id="tlsPassword" type="password" minlength="8" autocomplete="current-password" placeholder="Не менее 8 символов"></label><div class="tls-actions"><button id="tlsSignIn" type="button">Войти</button><button id="tlsSignUp" class="secondary" type="button">Регистрация</button></div><p id="tlsError" class="tls-error" aria-live="polite"></p></section>';
 document.body.appendChild(el);
 $("tlsClose").onclick=()=>el.classList.add("hidden");
 el.addEventListener("click",e=>{if(e.target===el)el.classList.add("hidden")});
 $("tlsSignIn").onclick=signIn;$("tlsSignUp").onclick=signUp;
}
function openModal(message){
 modal();$("tlsModal").classList.remove("hidden");$("tlsError").textContent="";
 if(message)$("tlsHint").textContent=message;
 if(!auth)$("tlsError").textContent="Firebase Auth пока не подключён. Проверь настройки Firebase и обнови страницу.";
}
function validLogin(u){return /^[a-zA-Z0-9_]{3,24}$/.test(u)&&!u.toLowerCase().startsWith("guest_")}
async function signIn(){
 const u=$("tlsLogin").value.trim(),p=$("tlsPassword").value;
 if(!auth){openModal();return}
 if(!validLogin(u)){$("tlsError").textContent="Логин: 3–24 символа, латиница, цифры и _.";return}
 try{await auth.signInWithEmailAndPassword(synthetic(u),p);$("tlsModal").classList.add("hidden")}
 catch(e){$("tlsError").textContent="Не удалось войти. Проверь логин, пароль и включённый Email/Password в Firebase Authentication.";console.error(e)}
}
async function signUp(){
 const u=$("tlsLogin").value.trim(),p=$("tlsPassword").value;
 if(!auth){openModal();return}
 if(!validLogin(u)){$("tlsError").textContent="Логин: 3–24 символа, латиница, цифры и _. guest_ зарезервирован.";return}
 if(p.length<8){$("tlsError").textContent="Пароль должен содержать минимум 8 символов.";return}
 try{
  if(auth.currentUser&&auth.currentUser.isAnonymous){
   const credential=firebase.auth.EmailAuthProvider.credential(synthetic(u),p);
   await auth.currentUser.linkWithCredential(credential);
  }else await auth.createUserWithEmailAndPassword(synthetic(u),p);
  const call=firebase.app().functions("europe-west1").httpsCallable("claimUsername");
  await call({username:u});
  $("tlsModal").classList.add("hidden");
 }catch(e){
  $("tlsError").textContent=e.code==="auth/email-already-in-use"||e.code==="functions/already-exists"?"Этот логин уже занят.":(e.message||"Не удалось создать аккаунт.");
  console.error(e);
 }
}
async function ensureGuest(user){
 if(!user||!user.isAnonymous)return;
 try{
  const call=firebase.app().functions("europe-west1").httpsCallable("allocateGuest");
  const result=await call({});
  guestName=result.data.guestName||"";
 }catch(e){console.error("Guest allocation failed",e);guestName="Гость";}
 window.TLS_STATE.guestName=guestName;
}
async function updateHeader(user){
 const b=$("accountOpen");if(!b)return;
 if(user&&!user.isAnonymous){
  const snap=await firebase.firestore().collection("users").doc(user.uid).get().catch(()=>null);
  window.TLS_STATE.profile=snap&&snap.exists?snap.data():null;
  b.textContent=(window.TLS_STATE.profile&&window.TLS_STATE.profile.username)||"Аккаунт";
  b.title="Нажми, чтобы выйти";
  b.onclick=async()=>{if(confirm("Выйти из аккаунта?"))await auth.signOut()};
 }else{
  b.textContent=guestName||"Гость";b.title="Войти или зарегистрироваться";b.onclick=()=>openModal();
 }
}
function initFirebase(){
 const cfg=window.FIREBASE_CONFIG;
 if(!cfg||!window.firebase){readyResolve();return}
 try{
  if(!firebase.apps.length)firebase.initializeApp(cfg);
  auth=firebase.auth();window.TLS_AUTH=auth;
  auth.onAuthStateChanged(async user=>{
   try{
    if(!user){await auth.signInAnonymously();return}
    window.TLS_STATE.user=user;
    if(user.isAnonymous)await ensureGuest(user);
    await updateHeader(user);
   }catch(e){console.error("TLegacyStore auth:",e)}
   finally{readyResolve()}
  },e=>{console.error(e);readyResolve()});
 }catch(e){console.error("Firebase initialization:",e);readyResolve()}
}
document.addEventListener("DOMContentLoaded",()=>{
 modal();
 const theme=$("themeToggle");
 if(localStorage.getItem("tls-theme")==="dark")document.body.classList.add("dark");
 if(theme)theme.addEventListener("click",()=>{
  document.body.classList.toggle("dark");
  localStorage.setItem("tls-theme",document.body.classList.contains("dark")?"dark":"light");
 });
 const account=$("accountOpen");if(account)account.addEventListener("click",()=>openModal());
 const contact=$("contactOpen");if(contact)contact.addEventListener("click",()=>openModal("Войди или зарегистрируйся, чтобы написать администратору."));
 initFirebase();
});
})();