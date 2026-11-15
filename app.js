(() => {
"use strict";
const $ = id => document.getElementById(id);
const state = {page:1, rows:[], total:0, loading:false};
const PAGE_SIZE = 50;
const SEARCH_URL = "https://archive.org/advancedsearch.php";
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const val = id => $(id).value.trim();
const hasFirebase = () => window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.FIREBASE_CONFIG.apiKey !== "PASTE_API_KEY" && window.FIREBASE_CONFIG.projectId && window.FIREBASE_CONFIG.projectId !== "YOUR_PROJECT_ID";
let db = null;
if (hasFirebase() && window.firebase) {
  try { firebase.initializeApp(window.FIREBASE_CONFIG); db = firebase.firestore(); } catch (e) { console.warn("Firebase init:", e); }
}
function status(message) { $("status").textContent = message; $("status").classList.remove("hidden"); }
function recordYear(r) {
  const d = String(r.date || r.year || "");
  const m = d.match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : 0;
}
function metaText(r) { return [r.title,r.description,r.subject,r.collection,r.identifier].join(" ").toLowerCase(); }
function getIOS(r) {
  const m = metaText(r).match(/(?:ios|iphone\s*os|firmware)[\s:=_-]*(\d{1,2}(?:\.\d{1,2})?)/i);
  return m ? m[1] : "";
}
function compareVersion(a,b) {
  const aa = String(a).split(".").map(Number), bb = String(b).split(".").map(Number);
  for(let i=0;i<Math.max(aa.length,bb.length);i++){const x=aa[i]||0,y=bb[i]||0;if(x!==y)return x-y;} return 0;
}
function inferCategory(r) {
  const t=metaText(r);
  if(/collection|bundle|pack|compilation|сборник/.test(t)) return "collection";
  if(/game|games|игр|arcade|puzzle|racing/.test(t)) return "game";
  if(/emulator|emulation/.test(t)) return "emulator";
  if(/utility|utilities|tool|tools/.test(t)) return "utility";
  return "app";
}
function filterRows(rows) {
  const q=val("searchInput").toLowerCase(), min=val("iosMin"), max=val("iosMax"), yf=Number(val("yearFrom"))||0, yt=Number(val("yearTo"))||9999, cat=val("category"), dec=val("decrypt"), crack=val("crack");
  return rows.filter(r=>{
    const t=metaText(r), ios=getIOS(r), year=recordYear(r), isDec=/decrypted|decrypt(ed)?/.test(t), isCrack=/cracked|crack(ed)?/.test(t);
    if(q && !t.includes(q)) return false;
    if(min && (!ios || compareVersion(ios,min)<0)) return false;
    if(max && (!ios || compareVersion(ios,max)>0)) return false;
    if((yf||yt!==9999) && (!year || year<yf || year>yt)) return false;
    if(cat && inferCategory(r)!==cat) return false;
    if(dec==="decrypted"&&!isDec) return false;
    if(dec==="encrypted"&&isDec) return false;
    if(crack==="cracked"&&!isCrack) return false;
    if(crack==="notcracked"&&isCrack) return false;
    return true;
  }).sort((a,b)=>{
    if(val("sort")==="title") return String(a.title||"").localeCompare(String(b.title||""));
    return val("sort")==="oldest" ? recordYear(a)-recordYear(b) : recordYear(b)-recordYear(a);
  });
}
function renderList() {
  const rows=filterRows(state.rows);
  $("resultCount").textContent = rows.length + " записей на странице";
  $("pageLabel").textContent = "Страница " + state.page;
  $("prevPage").disabled=state.page<=1;
  $("nextPage").disabled=state.rows.length===0 || state.page*PAGE_SIZE>=state.total;
  if(!rows.length){$("resultsList").innerHTML="";status("По этим условиям ничего не найдено на текущей странице. Попробуй изменить фильтры или перейти дальше.");return;}
  $("status").classList.add("hidden");
  $("resultsList").innerHTML=rows.map(r=>{
    const id=esc(r.identifier), title=esc(r.title||r.identifier), year=recordYear(r)||"Год неизвестен", ios=getIOS(r), cat=inferCategory(r);
    const badges=[ios?"iOS "+ios:"iOS неизвестна",cat==="game"?"Игра":cat==="collection"?"Сборник":cat==="emulator"?"Эмулятор":cat==="utility"?"Утилита":"Приложение",/decrypted/.test(metaText(r))?"Decrypted":"",/cracked/.test(metaText(r))?"Cracked":""].filter(Boolean);
    const img="https://archive.org/services/img/"+encodeURIComponent(r.identifier);
    return '<a class="app-card" href="?id='+encodeURIComponent(r.identifier)+'"><img class="app-icon" loading="lazy" src="'+img+'" alt="" onerror="this.src=\'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22%3E%3Crect width=%2260%22 height=%2260%22 rx=%2210%22 fill=%22%23e3e9ed%22/%3E%3Ctext x=%2230%22 y=%2238%22 font-size=%2228%22 text-anchor=%22middle%22 fill=%22%236b7b87%22%3E▣%3C/text%3E%3C/svg%3E\'"><span class="app-info"><span class="app-title">'+title+'</span><span class="app-meta">'+esc(year)+' · '+esc(id)+'</span><span>'+badges.map(x=>'<span class="pill">'+esc(x)+'</span>').join("")+'</span><span class="app-desc">'+esc((r.description||"").replace(/<[^>]*>/g,"").slice(0,180))+'</span></span></a>';
  }).join("");
}
async function loadPage() {
  if(state.loading)return; state.loading=true; status("Загружаю записи Internet Archive…");
  $("prevPage").disabled=$("nextPage").disabled=true;
  try{
    const params=new URLSearchParams({q:"collection:ipaarchive",fl:"identifier,title,description,date,year,subject,collection",rows:String(PAGE_SIZE),page:String(state.page),output:"json",sort:"date desc"});
    const res=await fetch(SEARCH_URL+"?"+params.toString()); if(!res.ok)throw new Error("HTTP "+res.status);
    const data=await res.json(); state.rows=data.response.docs||[]; state.total=data.response.numFound||0;
    renderList();
  }catch(e){console.error(e);status("Не удалось загрузить каталог. Проверь соединение и попробуй обновить страницу.");}
  finally{state.loading=false;$("prevPage").disabled=state.page<=1;$("nextPage").disabled=state.page*PAGE_SIZE>=state.total;}
}
function renderDetail(data,id) {
  const m=data.metadata||{}, files=(data.files||[]).filter(f=>String(f.name||"").toLowerCase().endsWith(".ipa"));
  const title=m.title||id, desc=String(m.description||"").replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const all=JSON.stringify(m).toLowerCase(), ios=(all.match(/(?:ios|iphone\s*os)[\s:=_-]*(\d{1,2}(?:\.\d{1,2})?)/i)||[])[1]||"Не указана";
  const year=String(m.date||m.year||"").match(/(?:19|20)\d{2}/);
  $("detailContent").innerHTML='<article class="detail"><h1>'+esc(title)+'</h1><div class="muted">Archive identifier: '+esc(id)+'</div><div class="detail-grid"><div><p>'+esc(desc||"Описание отсутствует в метаданных архива.")+'</p><table class="meta-table"><tr><td>Год</td><td>'+esc(year?year[0]:"Не указан")+'</td></tr><tr><td>Предполагаемая iOS</td><td>'+esc(ios)+'</td></tr><tr><td>Decrypted</td><td>'+(/decrypted/.test(all)?"Упоминается в метаданных":"Не подтверждено")+'</td></tr><tr><td>Cracked</td><td>'+(/cracked/.test(all)?"Упоминается в метаданных":"Не подтверждено")+'</td></tr><tr><td>Оригинальная запись</td><td><a href="https://archive.org/details/'+encodeURIComponent(id)+'" target="_blank" rel="noopener">Открыть на Archive.org</a></td></tr></table><h2>Файлы IPA ('+files.length+')</h2>'+(files.length?'<ul class="file-list">'+files.map(f=>'<li><a href="https://archive.org/download/'+encodeURIComponent(id)+'/'+encodeURIComponent(f.name)+'" target="_blank" rel="noopener">'+esc(f.name)+'</a> <span class="muted">'+(f.size?Math.round(Number(f.size)/1024/1024*10)/10+" MB":"")+'</span></li>').join("")+'</ul>':'<p class="muted">Файлы .ipa не найдены в открытых метаданных этой записи.</p>')+'</div><aside class="detail-side"><img src="https://archive.org/services/img/'+encodeURIComponent(id)+'" alt="Иконка или обложка" onerror="this.style.display=\'none\'"><p><a href="https://archive.org/details/'+encodeURIComponent(id)+'" target="_blank" rel="noopener">Страница Internet Archive ↗</a></p></aside></div><section class="comments"><h2>Комментарии</h2><div id="commentNotice" class="muted"></div><div id="commentList">Загрузка комментариев…</div><form id="commentForm"><label for="commentName">Имя (до 40 символов)</label><input id="commentName" maxlength="40" required placeholder="Как к тебе обращаться?"><label for="commentMessage">Сообщение (до 500 символов)</label><textarea id="commentMessage" maxlength="500" required placeholder="Напиши комментарий…"></textarea><div class="comment-tools"><span id="charCounter" class="counter">0 / 500</span><span id="cooldownLabel" class="cooldown"></span></div><button id="sendComment" type="submit">Отправить комментарий</button></form></section></article>';
  initComments(id);
}
async function loadDetail(id) {
  $("homeView").classList.add("hidden"); $("detailView").classList.remove("hidden");
  try{const r=await fetch("https://archive.org/metadata/"+encodeURIComponent(id));if(!r.ok)throw new Error("HTTP "+r.status);const d=await r.json();renderDetail(d,id);}
  catch(e){$("detailContent").textContent="Не удалось загрузить запись. Попробуй вернуться в каталог.";}
}
function initComments(itemId) {
  const notice=$("commentNotice"), list=$("commentList"), form=$("commentForm"), message=$("commentMessage"), name=$("commentName"), send=$("sendComment"), counter=$("charCounter"), cooldown=$("cooldownLabel");
  const key="ipa-comment-last-send", wait=20000;
  let last=Number(localStorage.getItem(key)||0), tick=null;
  message.addEventListener("input",()=>counter.textContent=message.value.length+" / 500");
  function updateTimer(){
    const remain=Math.max(0,wait-(Date.now()-last));
    if(remain>0){send.disabled=true;cooldown.textContent="Следующая отправка через "+Math.ceil(remain/1000)+" сек.";}
    else{send.disabled=!db;cooldown.textContent="";}
  }
  updateTimer(); tick=setInterval(updateTimer,500);
  if(!db){
    notice.textContent="Комментарии появятся после настройки Firebase. См. README.md и firebase-config.js.";
    list.textContent="Firebase пока не настроен."; send.disabled=true; return;
  }
  db.collection("comments").where("itemId","==",itemId).orderBy("createdAt","desc").limit(100).onSnapshot(snap=>{
    if(!snap.size){list.textContent="Пока нет комментариев. Будь первым!";return;}
    list.innerHTML=snap.docs.map(doc=>{const c=doc.data(),date=c.createdAt&&c.createdAt.toDate?c.createdAt.toDate().toLocaleString():"";return '<div class="comment"><strong>'+esc(c.name)+'</strong><time>'+esc(date)+'</time><div class="comment-body">'+esc(c.message)+'</div></div>';}).join("");
  },err=>{console.error(err);list.textContent="Не удалось загрузить комментарии. Проверь настройки Firestore и индекс.";});
  form.addEventListener("submit",async e=>{
    e.preventDefault();const n=name.value.trim(),m=message.value.trim();
    if(!n||n.length>40){notice.textContent="Имя должно содержать от 1 до 40 символов.";return;}
    if(!m||m.length>500){notice.textContent="Комментарий должен содержать от 1 до 500 символов.";return;}
    const remaining=wait-(Date.now()-last);if(remaining>0){notice.textContent="Подожди ещё "+Math.ceil(remaining/1000)+" сек.";updateTimer();return;}
    send.disabled=true;notice.textContent="Отправляю…";
    try{
      await db.collection("comments").add({itemId,name:n,message:m,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      last=Date.now();localStorage.setItem(key,String(last));message.value="";counter.textContent="0 / 500";notice.textContent="Комментарий опубликован.";updateTimer();
    }catch(err){console.error(err);notice.textContent="Не удалось отправить. Проверь правила Firestore и подключение.";updateTimer();}
  });
}
$("searchForm").addEventListener("submit",e=>{e.preventDefault();renderList();});
$("applyFilters").addEventListener("click",renderList);
$("resetFilters").addEventListener("click",()=>{["searchInput","iosMin","iosMax","yearFrom","yearTo","category","decrypt","crack"].forEach(id=>$(id).value="");$("sort").value="newest";renderList();});
$("prevPage").addEventListener("click",()=>{if(state.page>1){state.page--;loadPage();}});
$("nextPage").addEventListener("click",()=>{if(state.page*PAGE_SIZE<state.total){state.page++;loadPage();}});
const id=new URLSearchParams(location.search).get("id");
if(id)loadDetail(id);else loadPage();
})();