/* 학생 화면 보기 (모든 실시간 게임 공통)
   - 학생 태블릿: 지금 보이는 화면을 그대로 서버에 올려요(바뀔 때만, 0.7초 모아서). 🙋 도와주세요 버튼.
   - 선생님 화면: 👀 학생 화면 버튼 → 학생마다 같은 크기의 글자 카드(단계·지금 하는 일·쓰는 중인 글자·도움 요청·멈춤).
     카드를 누르면 그 학생 화면을 태블릿 세로 크기(820px)로 고정해서 보여 줘요(기기 크기·회전·스크롤과 상관없이).
     '단계별 화면' 탭: 단계마다 학생이 보는 화면을 입력 글자 없이 깨끗하게 보여 줘요(TV로 안내할 때).
     ?room=1234#watch 로 열면 선생님 휴대폰에서 학생 화면만 볼 수 있어요.
   - 학생 시작 화면 도우미: 1·2·3 단계 표시, "번호"와 "이름" 칸 나누기, 무엇이 빠졌는지 바로 알려 주기.
   데이터는 rooms/<방 번호>_watch/<기기> 에 저장해요(게임 방 데이터와 따로라 TV 화면이 느려지지 않아요).
   쓰는 법(게임 쪽):
     ClassWatch.student({db, room, root})   방 번호를 알게 되면 (QR 주소나 들어가기 뒤)
     ClassWatch.who(번호, 이름)               들어가기 뒤
     ClassWatch.step('조 고르기', {n:2, total:4, wait:false})   화면이 바뀔 때
     ClassWatch.detail(()=>({q:'문제: …', w:'쓰는 중인 글자'}))  카드에 보일 '지금 하는 일' (없으면 화면 제목·입력 글자로 알아서)
     ClassWatch.teacher({db, room})          선생님 화면에서
     ClassWatch.steps(['들어가기','조 고르기','기다리기','게임'], 1)  학생 화면 위에 붙일 단계 표시 HTML
     ClassWatch.joinForm({checks:[{label:'나라 고르기', ok:()=>!!pick}]})  들어가기 화면을 그린 뒤 */
(function(){
const TS=()=>firebase.database.ServerValue.TIMESTAMP;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}};
const MAX_HTML=60000;
let skew=0,skewOn=false;
const now=()=>Date.now()+skew;
function trackSkew(db){if(skewOn)return;skewOn=true;db.ref('.info/serverTimeOffset').on('value',s=>{skew=s.val()||0;});}
const wref=(db,room)=>db.ref('rooms/'+room+'_watch');

const CSS=`
.cw-help{position:fixed;right:max(14px,env(safe-area-inset-right,0px));bottom:max(14px,env(safe-area-inset-bottom,0px));z-index:80;font-family:var(--display,system-ui);font-size:1.05rem;border:0;border-radius:999px;padding:.65em 1.1em;background:#fff;color:var(--ink,#333);box-shadow:0 3px 12px rgba(0,0,0,.18);border:2px solid var(--line,#ddd);cursor:pointer}
.cw-help[aria-pressed="true"]{background:var(--gold,#E9B04F);border-color:var(--gold,#E9B04F);color:#fff}
.cw-toast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:90;background:var(--ink,#333);color:#fff;font-family:var(--display,system-ui);font-size:1.1rem;border-radius:14px;padding:.6em 1.1em;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:calc(100vw - 32px);text-align:center}
.cw-steps{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:0 auto 4px;list-style:none;padding:0}
.cw-steps li{font-family:var(--display,system-ui);font-size:1rem;background:#fff;border:2px solid var(--line,#ddd);color:var(--muted,#888);border-radius:999px;padding:.2em .8em}
.cw-steps li b{font-weight:400;display:inline-grid;place-items:center;width:1.5em;height:1.5em;border-radius:50%;background:var(--line,#ddd);color:#fff;margin-right:.3em;font-size:.9em}
.cw-steps li.on{border-color:var(--coral,#E0704F);color:var(--ink,#333);background:var(--cream,#FFF4DF)}
.cw-steps li.on b{background:var(--coral,#E0704F)}
.cw-steps li.done b{background:var(--ok,#3F8A5A)}
.cw-steps li.done{color:var(--ok,#3F8A5A)}
.cw-todo{font-family:var(--display,system-ui);font-size:1.15rem;display:grid;gap:4px;margin:0;padding:0;list-style:none}
.cw-todo li{display:flex;gap:.5em;align-items:center}
.cw-todo li::before{content:'';flex:none;width:1.2em;height:1.2em;border-radius:50%;border:2px solid var(--line,#ccc);background:#fff}
.cw-todo li.ok{color:var(--ok,#3F8A5A)} .cw-todo li.ok::before{content:'✓';display:grid;place-items:center;color:#fff;background:var(--ok,#3F8A5A);border-color:var(--ok,#3F8A5A);font-size:.8em}
.cw-todo li.no{color:var(--ink,#333)} .cw-todo li.no::before{border-color:var(--coral,#E0704F)}
.cw-who{display:grid;grid-template-columns:7.5em 1fr;gap:10px}
.cw-who label{display:grid;gap:4px;font-family:var(--display,system-ui);font-size:1.05rem}
.cw-who input{font-size:1.4rem}
.cw-roomok{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:var(--display,system-ui);font-size:1.3rem}
.cw-roomok .cw-chg{font-size:.9rem;padding:.3em .8em}
.cw-open{position:fixed;left:max(14px,env(safe-area-inset-left,0px));bottom:max(14px,env(safe-area-inset-bottom,0px));z-index:80;font-family:var(--display,system-ui);font-size:1.1rem;border-radius:999px;padding:.6em 1.1em;box-shadow:0 3px 12px rgba(0,0,0,.2)}
.cw-open .cw-badge{display:inline-block;background:var(--bad,#C8452D);color:#fff;border-radius:999px;padding:0 .5em;margin-left:.4em}
@media (prefers-reduced-motion:no-preference){.cw-open.alert{animation:cwp 1s ease-in-out infinite alternate}@keyframes cwp{to{transform:scale(1.06)}}}
.cw-ov,.cw-toast,.cw-steps,.cw-todo,.cw-help,.cw-open,.cw-who,.cw-roomok{word-break:keep-all;overflow-wrap:break-word}
.cw-ov{position:fixed;inset:0;z-index:100;background:var(--wall,#EEE);overflow:auto;padding:12px max(12px,env(safe-area-inset-right,0px)) 40px max(12px,env(safe-area-inset-left,0px))}
.cw-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between;margin-bottom:10px}
.cw-bar h2{font-family:var(--display,system-ui);font-weight:400;margin:0;font-size:1.6rem}
.cw-sum{display:flex;gap:8px;flex-wrap:wrap}
.cw-sum span{font-family:var(--display,system-ui);background:#fff;border:2px solid var(--line,#ddd);border-radius:999px;padding:.15em .8em}
.cw-sum .h{border-color:var(--gold,#E9B04F);background:#FFF1D0}
.cw-sum .s{border-color:var(--coral,#E0704F)}
.cw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(var(--cw-w,250px),1fr));gap:10px}
.cw-card{background:#fff;border:3px solid var(--line,#ddd);border-radius:14px;overflow:hidden;display:grid;grid-template-rows:auto auto 1fr auto;height:200px;cursor:pointer;text-align:left;padding:0;color:var(--ink,#333);font-family:var(--text,system-ui);font-size:1rem;line-height:1.4}
.cw-card.help{border-color:var(--gold,#E9B04F);box-shadow:0 0 0 3px #FFE3A3}
.cw-card.stuck{border-color:var(--coral,#E0704F)}
.cw-card.off{opacity:.45}
.cw-hd{display:flex;gap:6px;align-items:center;justify-content:space-between;padding:6px 10px;font-family:var(--display,system-ui);font-size:1.15rem;background:var(--cream,#F7E8C2)}
.cw-hd b{font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cw-stp{padding:6px 10px 0;font-family:var(--display,system-ui);font-size:1.3rem;color:var(--coral2,#C0583A);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cw-stp small{font-size:.8em;color:var(--muted,#888);margin-right:.3em}
.cw-ln{padding:2px 10px;display:grid;gap:2px;align-content:start;overflow:hidden}
.cw-ln p{margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cw-ln .w{font-family:var(--en,system-ui);font-weight:700;color:var(--blue,#3D6E8C);-webkit-line-clamp:1}
.cw-ln .m{color:var(--muted,#777);font-size:.92rem;-webkit-line-clamp:1}
.cw-st{display:flex;gap:6px;flex-wrap:wrap;padding:5px 10px 7px;font-size:.88rem;color:var(--muted,#777)}
.cw-st .hp{background:var(--gold,#E9B04F);color:#fff;border-radius:6px;padding:0 .4em}
.cw-st .sk{background:var(--coral,#E0704F);color:#fff;border-radius:6px;padding:0 .4em}
.cw-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.cw-tabs button{font-family:var(--display,system-ui);background:#fff;color:var(--ink,#333);border:2px solid var(--line,#ddd);padding:.4em 1em}
.cw-tabs button[aria-pressed="true"]{background:var(--ink,#333);border-color:var(--ink,#333);color:#fff}
.cw-scr{position:relative;overflow:hidden;background:var(--wall,#eee);margin:0 auto}
.cw-scr>.cw-in{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;padding-block:12px}
.cw-zoom{max-width:980px;margin:0 auto;display:grid;gap:10px}
.cw-zoom .cw-scr{border:3px solid var(--line,#ddd);border-radius:14px}
.cw-who2{font-family:var(--display,system-ui);font-size:1.1rem;display:flex;gap:6px;flex-wrap:wrap}
.cw-who2 span{background:#fff;border:2px solid var(--line,#ddd);border-radius:999px;padding:.1em .7em}
.cw-qr{background:#fff;border-radius:12px;padding:10px;display:grid;justify-items:center;gap:4px;font-size:.85rem;max-width:240px}
.cw-qr div img,.cw-qr div canvas{display:block}
`;
function css(){if(document.getElementById('cw-css'))return;const s=document.createElement('style');s.id='cw-css';s.textContent=CSS;document.head.appendChild(s);}
function toast(msg,ms=3500){css();const t=document.createElement('div');t.className='cw-toast';t.setAttribute('role','status');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),ms);}
function ding(){try{const A=window.AudioContext||window.webkitAudioContext;const a=ding.a||(ding.a=new A());[880,1175].forEach((f,i)=>{const o=a.createOscillator(),g=a.createGain();o.frequency.value=f;o.type='triangle';const t=a.currentTime+i*.12;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+.35);});}catch(e){}}

/* ---------- 학생 ---------- */
const S={on:false,db:null,room:'',root:null,ref:null,dev:'',last:'',timer:0,first:0,info:{},help:0,obs:null,hb:0};
function devId(){let d=ls('cw-dev');if(!d){d=Math.random().toString(36).slice(2,8);ls('cw-dev',d);}return d;}
// 지금 화면을 복사해요. 입력한 글자, 고른 칸, 캔버스 그림까지 함께 보여요
function snapshot(root){
  const c=root.cloneNode(true);
  const a=root.querySelectorAll('input,textarea,select,canvas'),b=c.querySelectorAll('input,textarea,select,canvas');
  a.forEach((e,i)=>{const d=b[i];if(!d)return;
    if(e.tagName==='CANVAS'){let u='';try{u=e.toDataURL('image/webp',.5);}catch(x){}
      const im=document.createElement('img');if(u.length<40000)im.src=u;im.width=e.width;im.height=e.height;im.style.cssText=(e.getAttribute('style')||'')+';background:#fff';im.className=e.className;d.replaceWith(im);return;}
    if(e.type==='checkbox'||e.type==='radio'){e.checked?d.setAttribute('checked',''):d.removeAttribute('checked');}
    else if(e.tagName==='SELECT'){[...d.options].forEach((o,k)=>{e.options[k]&&e.options[k].selected?o.setAttribute('selected',''):o.removeAttribute('selected');});}
    else if(e.tagName==='TEXTAREA')d.textContent=e.value;
    else if(e.type!=='password')d.setAttribute('value',e.value);
    if(e===document.activeElement)d.setAttribute('data-cw-focus','');
  });
  c.querySelectorAll('script').forEach(x=>x.remove());
  let h=c.innerHTML;
  if(h.length>MAX_HTML)h=h.replace(/src="data:[^"]*"/g,'src=""');
  if(h.length>MAX_HTML)h=`<div class="panel"><p>${esc(root.innerText.slice(0,3000))}</p></div>`;
  return h;
}
function view(){
  const r=S.root.getBoundingClientRect();
  return {w:Math.round(innerWidth),vh:Math.round(innerHeight),y:Math.max(0,Math.round(-r.top)),top:Math.max(0,Math.round(r.top)),cls:S.root.className||''};
}
// 선생님 카드에 보일 '지금 하는 일': 화면 제목, 문제, 쓰고 있는 글자, 화면에 뜬 안내
function detail(){
  const r=S.root,txt=el=>el?el.textContent.replace(/\s+/g,' ').trim().slice(0,90):'';
  const shown=el=>el&&el.getClientRects().length>0;
  const d={t:txt([...r.querySelectorAll('h1,h2,h3')].find(e=>shown(e)&&!e.closest('.cw-steps,.cw-todo')))};
  if(S.detailFn){try{Object.assign(d,S.detailFn()||{});}catch(e){}}
  if(d.w==null){const el=S.lastIn&&S.lastIn.isConnected?S.lastIn:document.activeElement;
    if(el&&/^(INPUT|TEXTAREA)$/.test(el.tagName)&&r.contains(el)&&el.type!=='password'&&shown(el)&&el.value)d.w=el.value.slice(0,90);}
  const todo=r.querySelector('.cw-todo');
  if(todo&&todo.dataset.left)d.m='아직 안 한 것: '+todo.dataset.left;
  else{const m=[...r.querySelectorAll('.msg,[role=status]')].filter(shown).map(txt).find(Boolean);if(m)d.m=m;}
  Object.keys(d).forEach(k=>{if(d[k]==null||d[k]==='')delete d[k];else d[k]=String(d[k]).slice(0,120);});
  return d;
}
function send(force){
  clearTimeout(S.timer);S.timer=0;S.first=0;
  if(!S.on||!S.ref)return;
  const h=snapshot(S.root),v=view(),up={at:TS(),on:true,v,d:detail()};
  if(h!==S.last||force){up.html=h;up.ch=TS();S.last=h;}
  S.ref.update(up).catch(()=>{});
}
function later(){
  if(!S.on)return;
  const t=Date.now();if(!S.first)S.first=t;
  clearTimeout(S.timer);
  S.timer=setTimeout(send,t-S.first>2000?0:700);
}
function helpBtn(){
  css();
  let b=document.querySelector('.cw-help');
  if(!b){b=document.createElement('button');b.className='cw-help';b.type='button';document.body.appendChild(b);
    b.onclick=()=>{S.help=S.help?0:1;S.ref&&S.ref.update({help:S.help?TS():0});draw();if(S.help)toast('선생님 화면에 🙋 표시가 떴어요. 잠깐 기다려요!');};}
  const draw=()=>{b.setAttribute('aria-pressed',S.help?'true':'false');b.textContent=S.help?'🙋 선생님을 불렀어요 (취소)':'🙋 도와주세요';};
  b.hidden=!S.on;draw();helpBtn.draw=draw;
}
function student(o){
  if(!o.room||!/^\d{4}$/.test(String(o.room)))return;
  const room=String(o.room);
  if(S.on&&S.room===room)return;
  stop();
  Object.assign(S,{on:true,db:o.db,room,root:o.root||document.getElementById('app')||document.body,dev:devId(),last:'',help:0});
  trackSkew(S.db);
  S.ref=wref(S.db,room).child(S.dev);
  S.ref.onDisconnect().update({on:false});
  S.ref.update({...S.info,dev:S.dev,on:true,at:TS(),help:0,ua:/iPad|iPhone|Android|Mobile/.test(navigator.userAgent)?'tab':'pc'}).catch(()=>{});
  // 선생님이 확인을 누르면 학생 화면에 알려요
  const ackRef=S.ref.child('ack');let first=true;
  const h=ackRef.on('value',s=>{if(first){first=false;return;}if(s.val()){S.help=0;helpBtn.draw&&helpBtn.draw();toast('👍 선생님이 확인했어요. 곧 와서 도와줄게요!',4500);}});
  S.offAck=()=>ackRef.off('value',h);
  // 타이머 숫자만 바뀌는 건 올리지 않아요 (다른 게 바뀔 때 함께 올라가요)
  const ign=o.ignore||'.timer,.count,[data-cw-ignore]';
  S.obs=new MutationObserver(ms=>{if(ms.some(m=>{const el=m.target.nodeType===1?m.target:m.target.parentElement;return !(el&&el.closest(ign));}))later();});
  S.obs.observe(S.root,{subtree:true,childList:true,attributes:true,characterData:true});
  S.onInput=e=>{if(e&&e.target&&/^(INPUT|TEXTAREA)$/.test(e.target.tagName))S.lastIn=e.target;later();};
  document.addEventListener('input',S.onInput,true);document.addEventListener('change',S.onInput,true);
  window.addEventListener('scroll',S.onInput,{passive:true});window.addEventListener('resize',S.onInput);
  S.hb=setInterval(()=>S.ref&&S.ref.update({at:TS(),on:true}).catch(()=>{}),20000);
  helpBtn();send(true);
}
function stop(){
  if(!S.on)return;
  S.on=false;clearTimeout(S.timer);clearInterval(S.hb);S.obs&&S.obs.disconnect();S.offAck&&S.offAck();
  document.removeEventListener('input',S.onInput,true);document.removeEventListener('change',S.onInput,true);
  window.removeEventListener('scroll',S.onInput);window.removeEventListener('resize',S.onInput);
  S.ref&&S.ref.update({on:false}).catch(()=>{});S.ref&&S.ref.onDisconnect().cancel();
  const b=document.querySelector('.cw-help');if(b)b.hidden=true;
}
function who(num,name){if(S.info.num===(num==null?null:+num)&&S.info.name===(name==null?null:String(name)))return;S.info.num=num==null?null:+num;S.info.name=name==null?null:String(name);S.ref&&S.ref.update({num:S.info.num,name:S.info.name}).catch(()=>{});}
function setDetail(fn){S.detailFn=fn||null;later();}
function step(label,o={}){
  const s={step:String(label||''),n:o.n||0,total:o.total||0,wait:!!o.wait,stAt:TS()};
  if(S.info.step===s.step)return;
  S.info.step=s.step;S.info.n=s.n;S.info.total=s.total;S.info.wait=s.wait;
  S.ref&&S.ref.update(s).catch(()=>{});
}
function steps(names,cur){
  css();
  return `<ol class="cw-steps" aria-label="순서">${names.map((t,i)=>`<li class="${i+1<cur?'done':i+1===cur?'on':''}"${i+1===cur?' aria-current="step"':''}><b>${i+1<cur?'✓':i+1}</b>${esc(t)}</li>`).join('')}</ol>`;
}

/* ---------- 들어가기 화면 도우미 ----------
   게임이 그린 #rm(방 번호) #nm("번호 이름") #enter 를 그대로 두고,
   "번호" 칸과 "이름" 칸을 따로 보여 준 뒤 #nm 에 "7 김민수"로 맞춰 넣어요.
   무엇이 빠져서 버튼이 안 눌리는지 바로 아래에 보여 줘요. */
function joinForm(o={}){
  css();
  const rm=document.querySelector(o.rm||'#rm'),nm=document.querySelector(o.nm||'#nm'),enter=document.querySelector(o.enter||'#enter');
  if(!rm||!enter)return;
  const fire=el=>{el.dispatchEvent(new Event('input',{bubbles:true}));};
  // QR로 들어오면 방 번호는 이미 맞아요
  if(/^\d{4}$/.test(rm.value)){
    const box=rm.closest('.panel')||rm.parentNode;
    const ok=document.createElement('div');ok.className='cw-roomok';
    ok.innerHTML=`<span>방 번호 <b>${esc(rm.value)}</b> ✔ 맞게 들어왔어요</span><button type="button" class="ghost cw-chg">방 번호 바꾸기</button>`;
    rm.hidden=true;box.querySelector('h2')&&(box.querySelector('h2').textContent='① 방 번호');box.appendChild(ok);
    ok.querySelector('button').onclick=()=>{rm.hidden=false;ok.remove();rm.focus();};
  }else{const h=(rm.closest('.panel')||{}).querySelector?.('h2');if(h)h.textContent='① 방 번호 (TV에 보이는 4자리)';}
  let numEl=null,nameEl=null;
  if(nm){
    const box=nm.closest('.panel')||nm.parentNode;
    const h=box.querySelector('h2');if(h)h.textContent='② 내 번호와 이름';
    const w=document.createElement('div');w.className='cw-who';
    w.innerHTML=`<label>번호<input id="cw-num" inputmode="numeric" maxlength="2" placeholder="예) 7" autocomplete="off"></label><label>이름<input id="cw-name" placeholder="예) 김민수" autocomplete="off"></label>`;
    nm.hidden=true;nm.after(w);
    numEl=w.querySelector('#cw-num');nameEl=w.querySelector('#cw-name');
    const sync=()=>{
      // 이름 칸에 "7 김민수"를 한꺼번에 써도 나눠 줘요
      const m=nameEl.value.match(/^\s*(\d{1,2})\s*번?\s*(.*)$/);
      if(m&&!numEl.value){numEl.value=m[1];nameEl.value=m[2];}
      numEl.value=numEl.value.replace(/\D/g,'').slice(0,2);
      nm.value=numEl.value&&nameEl.value.trim()?`${+numEl.value} ${nameEl.value.trim()}`:'';fire(nm);
    };
    numEl.oninput=sync;nameEl.oninput=sync;
    numEl.onkeydown=nameEl.onkeydown=e=>{if(e.key==='Enter'&&!enter.disabled)enter.click();};
    if(nm.value){const m=nm.value.match(/^(\d{1,2})\s*(.*)$/);if(m){numEl.value=m[1];nameEl.value=m[2];}}
  }
  const todo=document.createElement('ul');todo.className='cw-todo';todo.setAttribute('aria-live','polite');
  const row=enter.closest('.row')||enter;row.before(todo);
  const list=[{label:'방 번호 4자리',ok:()=>/^\d{4}$/.test(rm.value)}];
  if(nm){list.push({label:'번호 쓰기 (숫자만)',ok:()=>/^\d{1,2}$/.test(numEl.value)&&+numEl.value>0});list.push({label:'이름 쓰기',ok:()=>!!nameEl.value.trim()});}
  (o.checks||[]).forEach(c=>list.push(c));
  const draw=()=>{if(!todo.isConnected)return clearInterval(t);
    const k=list.map(c=>!!c.ok());
    const h=k.every(Boolean)?`<li class="ok">다 됐어요! 아래 <b>&nbsp;${esc(enter.textContent)}&nbsp;</b> 버튼을 눌러요</li>`:list.map((c,i)=>`<li class="${k[i]?'ok':'no'}">${esc(c.label)}</li>`).join('');
    if(h!==draw.h){draw.h=h;todo.innerHTML=h;todo.dataset.left=list.filter((c,i)=>!k[i]).map(c=>c.label).join(', ');}};
  const t=setInterval(draw,300);draw();
  todo.parentNode.addEventListener('input',()=>setTimeout(draw));todo.parentNode.addEventListener('click',()=>setTimeout(draw));
  if(numEl&&!numEl.value)setTimeout(()=>numEl.focus(),60);
}

/* ---------- 선생님 ---------- */
const T={rt:0,cache:{},db:null,room:'',data:{},open:false,zoom:'',seen:new Set(),btn:null,ov:null,off:null,tick:0,solo:false,qr:''};
const ago=ms=>{const s=Math.max(0,Math.round(ms/1000));return s<60?`${s}초`:`${Math.floor(s/60)}분`;};
function cleanHtml(html){
  const t=document.createElement('template');t.innerHTML=String(html||'');
  t.content.querySelectorAll('script,iframe,object,embed,link,meta,style,base,frame,frameset').forEach(x=>x.remove());
  t.content.querySelectorAll('*').forEach(el=>{
    [...el.attributes].forEach(a=>{const n=a.name.toLowerCase(),v=a.value.trim();
      if(n.startsWith('on')||n==='autofocus'||n==='srcdoc')el.removeAttribute(a.name);
      else if(n==='id'){el.removeAttribute('id');}
      else if(['href','src','xlink:href','action','formaction','poster','srcset'].includes(n)&&!/^(https?:|data:image\/|[^:]*$)/i.test(v))el.removeAttribute(a.name);
    });
    if(el.hasAttribute('data-cw-focus'))el.style.outline='4px solid #3D6E8C';
    if(/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)){el.setAttribute('tabindex','-1');}
  });
  return t.content;
}
// 순서: 도움 요청(먼저 부른 순) → 이름을 아직 안 쓴 기기 → 번호 순 → 연결 끊긴 기기
function list(){
  const t=now();
  const rank=v=>v.off?3:v.help?0:!v.name?1:2;
  return Object.entries(T.data||{}).filter(([k,v])=>v&&typeof v==='object').map(([k,v])=>{const off=v.on===false||t-(v.at||0)>120000;
    return {k,...v,off,stuck:!off&&!v.wait&&!!v.ch&&t-v.ch>60000};})
    .sort((a,b)=>rank(a)-rank(b)||(a.help&&b.help?a.help-b.help:0)||(a.num??999)-(b.num??999)||a.k.localeCompare(b.k));
}
// 학생 화면을 태블릿 세로 크기(820px)로 고정해서 그려요. 기기 크기·회전·스크롤과 상관없이 늘 위에서부터 전체가 보여요.
// blank: 입력한 글자를 지워 학생이 보는 화면 모양만 보여 줘요(단계별 화면)
const FIXW=820;
function screen(v,boxW,o={}){
  const sc=Math.min(1,boxW/FIXW);
  const box=document.createElement('div');box.className='cw-scr';box.style.width=Math.round(FIXW*sc)+'px';
  const inn=document.createElement('div');inn.className='cw-in';inn.style.width=FIXW+'px';inn.setAttribute('inert','');inn.setAttribute('aria-hidden','true');
  inn.style.transform=`scale(${sc})`;
  const m=document.createElement('main');m.className=(v.v&&v.v.cls)||'';m.appendChild(cleanHtml(v.html));
  if(o.blank){m.querySelectorAll('input').forEach(x=>{x.removeAttribute('value');x.removeAttribute('checked');});m.querySelectorAll('textarea').forEach(x=>{x.textContent='';});m.querySelectorAll('[style*="outline"]').forEach(x=>{x.style.outline='';});}
  inn.appendChild(m);box.appendChild(inn);
  const fit=()=>{box.style.height=Math.max(200,Math.ceil(inn.scrollHeight*sc))+'px';};
  box.style.height='400px';requestAnimationFrame(fit);setTimeout(fit,400);
  m.querySelectorAll('img').forEach(im=>im.addEventListener('load',fit,{once:true}));
  return box;
}
function label(v){return v.num!=null&&v.name?`${v.num}번 ${esc(v.name)}`:v.name?esc(v.name):'<span style="color:var(--coral2,#c60)">이름 아직 안 씀</span>';}
function stepTxt(v){return v.step?`${v.n&&v.total?`<small>${v.n}/${v.total}</small> `:''}${esc(v.step)}`:'<small>단계 정보 없음</small>';}
function status(v){
  const t=now();
  return `${v.help&&!v.off?`<span class="hp">🙋 ${ago(t-v.help)} 전 도움 요청</span>`:''}${v.off?'<span>연결 끊김</span>':v.stuck?`<span class="sk">${ago(t-v.ch)}째 그대로</span>`:v.ch?`<span>${ago(t-v.ch)} 전 바뀜</span>`:''}`;
}
function lines(v){
  const d=v.d||{};
  return `${d.q||d.t?`<p>${esc(d.q||d.t)}</p>`:''}${d.w?`<p class="w">✏️ ${esc(d.w)}</p>`:''}${d.m?`<p class="m">💬 ${esc(d.m)}</p>`:''}`;
}
function ack(k){wref(T.db,T.room).child(k).update({help:0,ack:TS()});}
// 단계마다 지금 그 단계에 있는 학생들 (단계 번호 순)
function byStep(L){
  const G=new Map();
  L.filter(v=>!v.off&&v.step&&v.html).forEach(v=>{const g=G.get(v.step)||{step:v.step,n:v.n||0,total:v.total||0,list:[]};g.list.push(v);G.set(v.step,g);});
  return [...G.values()].sort((a,b)=>(a.n||99)-(b.n||99));
}
function render(){
  if(!T.ov||!T.open)return;
  const L=list(),help=L.filter(v=>v.help&&!v.off),stuck=L.filter(v=>v.stuck&&!v.help),noname=L.filter(v=>!v.name&&!v.off),on=L.filter(v=>!v.off);
  if(T.zoom){
    const v=L.find(x=>x.k===T.zoom);if(!v){T.zoom='';return render();}
    T.ov.innerHTML=`<div class="cw-zoom"><div class="cw-bar"><h2>${label(v)} · ${stepTxt(v)}</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${v.help?'<button class="cw-ack">👍 확인했어요 (도움 끝)</button>':''}<button class="ghost cw-back">← 모든 학생</button></div></div><div class="cw-st" style="font-size:1rem">${status(v)}</div><div class="cw-slot"></div></div>`;
    const slot=T.ov.querySelector('.cw-slot');
    const key='z|'+(slot.clientWidth||900)+'|'+(v.html||'');
    let c=T.cache[v.k];if(!c||c.key!==key)c=T.cache[v.k]={key,el:screen(v,slot.clientWidth||900)};
    slot.appendChild(c.el);
    T.ov.querySelector('.cw-back').onclick=()=>{T.zoom='';render();};
    const a=T.ov.querySelector('.cw-ack');if(a)a.onclick=()=>ack(v.k);
    return;
  }
  const sum=`<span>접속 ${on.length}대</span>${help.length?`<span class="h">🙋 도움 요청 ${help.length}</span>`:''}${noname.length?`<span class="s">이름 아직 ${noname.length}</span>`:''}${stuck.length?`<span class="s">1분 넘게 그대로 ${stuck.length}</span>`:''}`;
  T.ov.innerHTML=`<div class="cw-bar"><h2>👀 학생 화면</h2><div class="cw-sum">${sum}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${T.solo?'':'<button class="ghost cw-phone">📱 내 휴대폰으로 보기</button>'}<button class="ghost cw-clear" title="연결이 끊긴 기기를 목록에서 지워요">끊긴 기기 지우기</button>${T.solo?'':'<button class="cw-close">닫기</button>'}</div></div>
   <div class="cw-qrbox"></div>
   <div class="cw-tabs" role="group" aria-label="보기"><button data-tab="cards" aria-pressed="${T.tab!=='steps'}">학생별</button><button data-tab="steps" aria-pressed="${T.tab==='steps'}">단계별 화면</button></div>
   <div class="cw-body"></div>`;
  T.ov.querySelectorAll('.cw-tabs button').forEach(b=>b.onclick=()=>{T.tab=b.dataset.tab;render();});
  const body=T.ov.querySelector('.cw-body');
  if(!L.length)body.innerHTML='<p style="font-family:var(--display,system-ui);font-size:1.3rem;word-break:keep-all">아직 들어온 학생이 없어요. 학생이 QR로 들어오면 여기에 보여요.</p>';
  else if(T.tab==='steps')renderSteps(body,L);
  else{
    const g=document.createElement('div');g.className='cw-grid';g.style.setProperty('--cw-w',(on.length>20?210:250)+'px');body.appendChild(g);
    L.forEach(v=>{
      const b=document.createElement('button');b.type='button';b.className='cw-card'+(v.help&&!v.off?' help':'')+(v.stuck?' stuck':'')+(v.off?' off':'');b.dataset.k=v.k;
      b.setAttribute('aria-label',`${(v.num!=null?v.num+'번 ':'')+(v.name||'이름 없음')} 화면 크게 보기`);
      b.innerHTML=`<div class="cw-hd"><b>${label(v)}</b>${v.help&&!v.off?'<span>🙋</span>':''}</div><div class="cw-stp">${stepTxt(v)}</div><div class="cw-ln">${lines(v)}</div><div class="cw-st">${status(v)}</div>`;
      b.onclick=()=>{T.zoom=v.k;render();};
      g.appendChild(b);
    });
  }
  const cl=T.ov.querySelector('.cw-close');if(cl)cl.onclick=()=>show(false);
  T.ov.querySelector('.cw-clear').onclick=()=>{const up={};L.filter(v=>v.off).forEach(v=>{up[v.k]=null;});if(Object.keys(up).length)wref(T.db,T.room).update(up);};
  const ph=T.ov.querySelector('.cw-phone');
  if(ph)ph.onclick=()=>{const q=T.ov.querySelector('.cw-qrbox');T.qr=T.qr?'':'1';drawQr(q);};
  if(T.qr)drawQr(T.ov.querySelector('.cw-qrbox'));
}
// 단계별 화면: 학생이 그 단계에서 보는 화면을 입력 글자 없이 크게. TV로 "지금 이 화면이에요" 하고 안내할 때 써요
function renderSteps(body,L){
  const G=byStep(L);
  if(!G.length){body.innerHTML='<p style="font-family:var(--display,system-ui);font-size:1.2rem">학생 화면이 아직 없어요.</p>';return;}
  let g=G.find(x=>x.step===T.stepSel);
  if(!g){g=G.slice().sort((a,b)=>b.list.length-a.list.length)[0];T.stepSel=g.step;}
  const rep=g.list.slice().sort((a,b)=>(b.ch||0)-(a.ch||0))[0];
  body.innerHTML=`<div class="cw-tabs" role="group" aria-label="단계">${G.map(x=>`<button data-s="${esc(x.step)}" aria-pressed="${x===g}">${x.n&&x.total?x.n+'. ':''}${esc(x.step)} · ${x.list.length}명</button>`).join('')}</div>
    <div class="cw-zoom"><div class="cw-who2">${g.list.map(v=>`<span>${label(v)}</span>`).join('')}</div><p style="margin:0;font-family:var(--display,system-ui);font-size:1.2rem;word-break:keep-all">이 단계에서 학생 화면은 이렇게 보여요</p><div class="cw-slot"></div></div>`;
  body.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{T.stepSel=b.dataset.s;render();});
  const slot=body.querySelector('.cw-slot');
  const key='s|'+(slot.clientWidth||900)+'|'+(rep.html||'');
  let c=T.cache['step:'+g.step];if(!c||c.key!==key)c=T.cache['step:'+g.step]={key,el:screen(rep,slot.clientWidth||900,{blank:true})};
  slot.appendChild(c.el);
}
function watchUrl(){return location.origin+location.pathname+'?room='+T.room+'#watch';}
function drawQr(q){
  if(!q)return;q.innerHTML='';if(!T.qr)return;
  q.innerHTML=`<div class="cw-qr"><b>선생님 휴대폰으로 찍어요</b><div></div><span style="word-break:break-all">${esc(watchUrl())}</span><span style="color:#888">학생에게는 보여 주지 마세요</span></div>`;
  if(window.QRCode){try{new QRCode(q.querySelector('.cw-qr div'),{text:watchUrl(),width:180,height:180});}catch(e){}}
}
function badge(){
  if(!T.btn)return;
  const L=list(),h=L.filter(v=>v.help&&!v.off).length,on=L.filter(v=>!v.off).length;
  T.btn.innerHTML=`👀 학생 화면 <small>${on}</small>${h?`<span class="cw-badge">🙋 ${h}</span>`:''}`;
  T.btn.classList.toggle('alert',h>0);
}
function show(open){
  T.open=open;
  if(open){if(!T.ov){T.ov=document.createElement('div');T.ov.className='cw-ov';T.ov.setAttribute('role','dialog');T.ov.setAttribute('aria-label','학생 화면');document.body.appendChild(T.ov);}T.ov.hidden=false;render();}
  else if(T.ov){T.ov.hidden=true;T.zoom='';}
  if(T.btn)T.btn.hidden=open&&!T.solo;
}
// 학생 화면이 자주 바뀌어도 TV는 0.8초에 한 번만 다시 그려요
function soon(){if(T.rt)return;T.rt=setTimeout(()=>{T.rt=0;render();},800);}
function teacher(o){
  css();
  if(T.off&&T.room===String(o.room))return;
  teacherStop();
  Object.assign(T,{db:o.db,room:String(o.room),data:{},seen:new Set(),solo:!!o.solo,zoom:'',qr:'',cache:{}});
  trackSkew(T.db);
  let first=true;
  const ref=wref(T.db,T.room);
  const h=ref.on('value',s=>{
    T.data=s.val()||{};
    // 새 도움 요청이 오면 소리와 알림
    const fresh=Object.entries(T.data).filter(([k,v])=>v&&v.help&&!T.seen.has(k+':'+v.help));
    Object.entries(T.data).forEach(([k,v])=>{if(v&&v.help)T.seen.add(k+':'+v.help);});
    if(!first&&fresh.length){ding();if(!T.open)toast(`🙋 ${fresh.map(([k,v])=>v.num!=null?`${v.num}번 ${v.name||''}`:v.name||'이름 안 쓴 학생').join(', ')}이(가) 도움을 요청했어요`,5000);}
    first=false;
    badge();
    if(T.open)soon();
  });
  T.off=()=>ref.off('value',h);
  T.tick=setInterval(()=>{badge();if(T.open)render();},5000);
  if(T.solo){show(true);return;}
  T.btn=document.createElement('button');T.btn.type='button';T.btn.className='cw-open';T.btn.onclick=()=>show(true);document.body.appendChild(T.btn);badge();
}
function teacherStop(){T.off&&T.off();T.off=null;clearInterval(T.tick);T.btn&&T.btn.remove();T.btn=null;T.ov&&T.ov.remove();T.ov=null;T.open=false;}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&T.open&&!T.solo){if(T.zoom){T.zoom='';render();}else show(false);}});

window.ClassWatch={student,stop,who,step,detail:setDetail,steps,joinForm,teacher,teacherStop,show,toast,_S:S,_T:T,cleanHtml};
})();
