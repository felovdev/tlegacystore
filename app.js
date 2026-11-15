(()=>{"use strict";
const $=id=>document.getElementById(id), esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])), v=id=>$(id).value.trim(), PAGE=50;
let page=1,rows=[],total=0,busy=false,db=null;
const cfg=window.FIREBASE_CONFIG;
if(cfg&&cfg.apiKey!=="PASTE_API_KEY"&&cfg.projectId!=="YOUR_PROJECT_ID"&&window.firebase){try{firebase.initializeApp(cfg);db=firebase.firestore()}catch(e){console.warn(e)}}
function say(s){$("status").textContent=s;$("status").classList.remove("hidden")}
function year(r){let m=String(r.date||r.year||"").match(/(?:19|20)\d{2}/);return m?+m[0]:0}
function txt(r){return [r.title,r.description,r.subject,r.collection,r.identifier].join(" ").toLowerCase()}
function ios(r){return (txt(r).match(/(?:ios|iphone\s*os|firmware)[\s:=_-]*(\d{1,2}(?:\.\d{1,2})?)/i)||[])[1]||""}
function cmp(a,b){let x=a.split(".").map(Number),y=b.split(".").map(Number);for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]||0)!==(y[i]||0))return(x[i]||0)-(y[i]||0)}return 0}
function cat(r){let t=txt(r);return /collection|bundle|pack|compilation|сборник/.test(t)?"collection":/game|games|игр|arcade|puzzle|racing/.test(t)?"game":/emulator/.test(t)?"emulator":/utility|tools?/.test(t)?"utility":"app"}
function filtered(){
 let lo=v("iosMin"),hi=v("iosMax"),yf=+v("yearFrom")||0,yt=+v("yearTo")||9999,c=v("category"),d=v("decrypt"),k=v("crack");
 return rows.filter(r=>{
  let t=txt(r),i=ios(r),y=year(r),de=/decrypted/.test(t),cr=/cracked/.test(t);
  return (!lo||i&&cmp(i,lo)>=0)&&(!hi||i&&cmp(i,hi)<=0)&&(!(yf||yt!==9999)||y&&y>=yf&&y<=yt)&&(!c||cat(r)===c)&&(d!=="decrypted"||de)&&(d!=="encrypted"||!de)&&(k!=="cracked"||cr)&&(k!=="notcracked"||!cr)
 }).sort((a,b)=>v("sort")==="title"?String(a.title||"").localeCompare(String(b.title||"")):v("sort")==="oldest"?year(a)-year(b):year(b)-year(a))
}
function draw(){let a=filtered();$("resultCount").textContent=a.length+" записей на странице";$("pageLabel").textContent="Страница "+page;$("prevPage").disabled=page<=1;$("nextPage").disabled=page*PAGE>=total;if(!a.length){$("resultsList").innerHTML="";say("По этим условиям ничего не найдено на текущей странице.");return}$("status").classList.add("hidden");$("resultsList").innerHTML=a.map(r=>{let id=esc(r.identifier),title=esc(r.title||r.identifier),i=ios(r),c=cat(r),tags=[i?"iOS "+i:"iOS неизвестна",({game:"Игра",collection:"Сборник",emulator:"Эмулятор",utility:"Утилита",app:"Приложение"})[c],/decrypted/.test(txt(r))?"Decrypted":"",/cracked/.test(txt(r))?"Cracked":""].filter(Boolean);return '<a class="app-card" href="?id='+encodeURIComponent(r.identifier)+'"><img class="app-icon" loading="lazy" src="https://archive.org/services/img/'+encodeURIComponent(r.identifier)+'" alt="" onerror="this.style.display=\'none\'"><span class="app-info"><span class="app-title">'+title+'</span><span class="app-meta">'+(year(r)||"Год неизвестен")+' · '+id+'</span>'+tags.map(t=>'<span class="pill">'+esc(t)+'</span>').join("")+'<span class="app-desc">'+esc(String(r.description||"").replace(/<[^>]*>/g,"").slice(0,180))+'</span></span></a>'}).join("")}
function archiveQuery(){
 const raw=v("searchInput");
 if(!raw)return "collection:ipaarchive";
 const phrase=raw.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/[+\-!(){}\[\]^~*?:\/]/g,"\\$&");
 return 'collection:ipaarchive AND (title:"'+phrase+'" OR identifier:"'+phrase+'" OR description:"'+phrase+'" OR subject:"'+phrase+'")';
}
async function load(){
 if(busy)return;
 busy=true;
 say(v("searchInput")?"Ищу по всему каталогу Internet Archive…":"Загружаю каталог Internet Archive…");
 try{
  const params=new URLSearchParams({
   q:archiveQuery(),
   fl:"identifier,title,description,date,year,subject,collection",
   rows:String(PAGE),
   page:String(page),
   output:"json",
   sort:"date desc"
  });
  const response=await fetch("https://archive.org/advancedsearch.php?"+params.toString(),{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Archive.org HTTP "+response.status);
  const data=await response.json();
  if(!data.response||!Array.isArray(data.response.docs))throw new Error("Invalid Archive.org response");
  rows=data.response.docs;
  total=Number(data.response.numFound)||0;
  draw();
  if(v("searchInput")&&total===0)say("По запросу «"+v("searchInput")+"» ничего не найдено в коллекции IPA.");
 }catch(error){
  say("Не удалось загрузить каталог. Попробуй обновить страницу.");
  console.error("TLegacyStore catalog load:",error);
 }finally{
  busy=false;
  $("prevPage").disabled=page<=1;
  $("nextPage").disabled=page*PAGE>=total;
 }
}
function detailHTML(d,id){let m=d.metadata||{},files=(d.files||[]).filter(f=>String(f.name||"").toLowerCase().endsWith(".ipa")),all=JSON.stringify(m).toLowerCase(),desc=String(m.description||"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim(),yr=String(m.date||m.year||"").match(/(?:19|20)\d{2}/),iv=(all.match(/(?:ios|iphone\s*os)[\s:=_-]*(\d{1,2}(?:\.\d{1,2})?)/i)||[])[1]||"Не указана";$("detailContent").innerHTML='<article class="detail"><h1>'+esc(m.title||id)+'</h1><div class="muted">Archive identifier: '+esc(id)+'</div><div class="detail-grid"><div><p>'+esc(desc||"Описание отсутствует.")+'</p><table class="meta-table"><tr><td>Год</td><td>'+esc(yr?yr[0]:"Не указан")+'</td></tr><tr><td>Предполагаемая iOS</td><td>'+esc(iv)+'</td></tr><tr><td>Decrypted</td><td>'+(/decrypted/.test(all)?"Упоминается в метаданных":"Не подтверждено")+'</td></tr><tr><td>Cracked</td><td>'+(/cracked/.test(all)?"Упоминается в метаданных":"Не подтверждено")+'</td></tr><tr><td>Оригинал</td><td><a target="_blank" rel="noopener" href="https://archive.org/details/'+encodeURIComponent(id)+'">Archive.org</a></td></tr></table><h2>Файлы IPA ('+files.length+')</h2>'+(files.length?'<ul class="file-list">'+files.map(f=>'<li><a target="_blank" rel="noopener" href="https://archive.org/download/'+encodeURIComponent(id)+'/'+encodeURIComponent(f.name)+'">'+esc(f.name)+'</a> <span class="muted">'+(f.size?Math.round(+f.size/104857.6)/10+" MB":"")+'</span></li>').join("")+'</ul>':'<p class="muted">IPA-файлы не найдены.</p>')+'</div><aside class="detail-side"><img src="https://archive.org/services/img/'+encodeURIComponent(id)+'" alt="Обложка"><p><a target="_blank" rel="noopener" href="https://archive.org/details/'+encodeURIComponent(id)+'">Открыть оригинал ↗</a></p></aside></div><section class="comments"><h2>Комментарии</h2><div id="commentNotice" class="muted"></div><div id="commentList">Загрузка…</div><form id="commentForm"><label for="commentName">Имя (до 40 символов)</label><input id="commentName" maxlength="40" required><label for="commentMessage">Сообщение (до 500 символов)</label><textarea id="commentMessage" maxlength="500" required></textarea><div class="comment-tools"><span id="charCounter" class="counter">0 / 500</span><span id="cooldownLabel" class="cooldown"></span></div><button id="sendComment" type="submit">Отправить</button></form></section></article>';comments(id)}
async function openDetail(id){$("homeView").classList.add("hidden");$("detailView").classList.remove("hidden");try{let r=await fetch("https://archive.org/metadata/"+encodeURIComponent(id));if(!r.ok)throw Error(r.status);detailHTML(await r.json(),id)}catch(e){$("detailContent").textContent="Не удалось загрузить запись."}}
function comments(item){
 const $n=$("commentNotice"),$list=$("commentList"),$form=$("commentForm"),$msg=$("commentMessage"),$name=$("commentName"),$send=$("sendComment"),$count=$("charCounter"),$timer=$("cooldownLabel");
 $name.disabled=true;$name.placeholder="Имя назначается автоматически";$name.value="";
 $n.textContent="Подключаем гостевой профиль…";
 const key="tls-comment-last-send",wait=20000;
 let last=+(localStorage.getItem(key)||0),unsubscribe=null;
 $msg.addEventListener("input",()=>$count.textContent=$msg.value.length+" / 500");
 function clock(){let left=Math.max(0,wait-(Date.now()-last));$send.disabled=left>0||!db;$timer.textContent=left?"Повторная отправка через "+Math.ceil(left/1000)+" сек.":""}
 clock();
 if(!db){$n.textContent="Комментарии временно недоступны: Firebase не подключён.";$list.textContent="";$send.disabled=true;return}
 (async()=>{
  if(window.TLS_READY)await window.TLS_READY;
  const auth=firebase.auth(),user=auth.currentUser;
  if(!user){$n.textContent="Не удалось создать гостевой профиль. Обнови страницу.";$send.disabled=true;return}
  let displayName="Гость";
  if(user.isAnonymous){
   displayName=window.TLS_STATE.guestName||"Гость";
   $n.textContent="Ты пишешь как "+displayName+". Зарегистрируйся, чтобы получить возможность редактировать и удалять свои комментарии.";
  }else{
   const p=await db.collection("users").doc(user.uid).get();
   displayName=(p.exists&&p.data().username)||"Пользователь";
   $n.textContent="Ты вошёл как "+displayName+".";
  }
  $name.value=displayName;
  unsubscribe=db.collection("comments").where("itemId","==",item).limit(100).onSnapshot(s=>{
   let docs=s.docs.slice().sort((x,y)=>{let a=x.data().createdAt,b=y.data().createdAt;return(b&&b.toMillis?b.toMillis():0)-(a&&a.toMillis?a.toMillis():0)});
   $list.innerHTML=docs.length?docs.map(doc=>{
    let c=doc.data(),dt=c.createdAt&&c.createdAt.toDate?c.createdAt.toDate().toLocaleString():"",own=c.ownerUid===user.uid&&!user.isAnonymous;
    return '<div class="comment"><strong>'+esc(c.name)+'</strong><time>'+esc(dt)+'</time><div class="comment-body">'+esc(c.message)+'</div>'+(own?'<div class="comment-actions"><button type="button" data-edit="'+esc(doc.id)+'">Изменить</button> <button type="button" class="secondary" data-delete="'+esc(doc.id)+'">Удалить</button></div>':'')+'</div>'
   }).join(""):"Пока нет комментариев. Будь первым!";
   $list.querySelectorAll("[data-edit]").forEach(btn=>btn.onclick=async()=>{
    const doc=docs.find(x=>x.id===btn.dataset.edit);if(!doc)return;
    const next=prompt("Измени комментарий:",doc.data().message);if(next===null)return;
    const msg=next.trim();if(!msg||msg.length>500){alert("Сообщение должно быть от 1 до 500 символов.");return}
    try{await db.collection("comments").doc(doc.id).update({message:msg})}catch(e){alert("Не удалось изменить комментарий.")}
   });
   $list.querySelectorAll("[data-delete]").forEach(btn=>btn.onclick=async()=>{
    if(!confirm("Удалить свой комментарий?"))return;
    try{await db.collection("comments").doc(btn.dataset.delete).delete()}catch(e){alert("Не удалось удалить комментарий.")}
   });
  },e=>{$list.textContent="Ошибка чтения Firestore. Проверь правила и авторизацию.";console.error(e)});
  $form.addEventListener("submit",async e=>{
   e.preventDefault();let m=$msg.value.trim();if(!m||m.length>500){$n.textContent="Сообщение должно быть от 1 до 500 символов.";return}
   if(Date.now()-last<wait){clock();return}
   $send.disabled=true;$n.textContent="Отправка…";
   try{
    await db.collection("comments").add({itemId:item,name:displayName,message:m,ownerUid:user.uid,isGuest:user.isAnonymous,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    last=Date.now();localStorage.setItem(key,String(last));$msg.value="";$count.textContent="0 / 500";$n.textContent="Комментарий опубликован.";clock()
   }catch(e){$n.textContent="Ошибка отправки. Проверь авторизацию и правила Firestore.";console.error(e);clock()}
  });
  clock();setInterval(clock,500);
 })();
}
$("searchForm").addEventListener("submit",e=>{e.preventDefault();page=1;load()});$("applyFilters").addEventListener("click",draw);$("resetFilters").addEventListener("click",()=>{["searchInput","iosMin","iosMax","yearFrom","yearTo","category","decrypt","crack"].forEach(x=>$(x).value="");$("sort").value="newest";page=1;load()});$("prevPage").addEventListener("click",()=>{if(page>1){page--;load()}});$("nextPage").addEventListener("click",()=>{if(page*PAGE<total){page++;load()}});let id=new URLSearchParams(location.search).get("id");if(id)openDetail(id);else load()
})();