/* 섭외 메일 작업실 (국어 6-2 2단원 「궁금한 점을 해결해요」 면담 섭외 2~3)
   1 메일 탐정(퀴즈) → 2 조별 초안 쓰기(생각 먼저 쓰기) → 3 다른 조와 바꿔 읽기(높임말 퀴즈 + 점검표) → 4 고쳐 쓰고 선생님 확인 → 보내기
   조(2인 1조) 초안은 rooms/<방>/teams/<조>/f 에 함께 저장돼요. 짝이 같은 조를 고르면 같은 초안을 함께 고쳐요. */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCSSwT67k7lXoYDz4qsmHHDRXUqTS0Zh14",
  authDomain: "classroom-games-7ae7d.firebaseapp.com",
  databaseURL: "https://classroom-games-7ae7d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "classroom-games-7ae7d",
  storageBucket: "classroom-games-7ae7d.firebasestorage.app",
  messagingSenderId: "433158756735",
  appId: "1:433158756735:web:254d9b0b2e36502b4de24a"
};
const APP='mail';
const STAGES=[null,
  {k:'메일 탐정',t:'두 메일 비교하기 (월)',tm:7},
  {k:'초안 쓰기',t:'조별 섭외 메일 초안 (월)',tm:18},
  {k:'바꿔 읽기',t:'높임말 퀴즈 + 다른 조 메일 점검 (화)',tm:12},
  {k:'고쳐 보내기',t:'고쳐 쓰고 선생님 확인 → 보내기 (화)',tm:15}];
const NST=4, NT=4;
/* 방법을 보여 주는 예시는 다른 주제(동네 빵집 제빵사)로 */
const MAIL_A={subj:'(제목 없음)',body:`안녕하세요ㅎㅎ\n저희 학교 숙제로 인터뷰를 해야 되는데 해 주실 수 있나요??\n내일 가게로 가도 돼요?\n답장 빨리 주세요!!`};
const MAIL_B={subj:'[면담 요청] 제빵사의 하루가 궁금한 6학년 학생입니다',body:`한빛빵집 박○○ 제빵사님께\n\n안녕하세요. 저는 ○○초등학교 6학년 이○○입니다.\n매일 아침 가게 앞을 지나며 갓 구운 빵 냄새를 맡다가, 제빵사의 하루가 궁금해져 연락드리게 되었습니다.\n면담에서는 제빵사가 되는 방법과 하루 일과에 대해 여쭙고 싶습니다.\n12월 14일부터 18일 사이 편하신 날, 20분 정도 가게에서 만나 뵙거나 화상으로 이야기 나눌 수 있을까요? 메일로 답해 주셔도 좋습니다.\n여쭙고 싶은 질문은 ‘제빵사가 되려면 어떤 공부를 해야 하나요?’, ‘빵을 만들 때 가장 보람 있는 순간은 언제인가요?’입니다. 허락해 주시면 면담 내용을 녹음해 보고서를 쓰는 데에만 쓰겠습니다.\n바쁘신 중에 읽어 주셔서 감사합니다. 12월 9일까지 이 메일로 답장 주시면 정말 기쁘겠습니다.\n\n이○○ 올림 (지도 교사: ○○초등학교 6학년 담임 김○○)`};
const QUIZ1=[
  {id:'q1',q:'답장을 받을 가능성이 더 큰 메일은 어느 것일까요?',a:'🅑 메일',o:['🅐 메일']},
  {id:'q2',q:'🅐 메일에 빠진 것은 무엇일까요?',a:'나는 누구인지(학교·학년·이름)',o:['인사','부탁하는 말','물음표']},
  {id:'q3',q:'🅐의 “내일 가게로 가도 돼요?”는 무엇이 아쉬울까요?',a:'받는 분이 편한 때를 묻지 않았다',o:['너무 공손하다','날짜를 정확히 썼다']},
  {id:'q4',q:'섭외 메일 제목으로 가장 알맞은 것은?',a:'[면담 요청] 제빵사의 하루가 궁금한 6학년 학생입니다',o:['안녕하세요','급해요!! 꼭 읽어 주세요']},
  {id:'q5',q:'면담을 녹음하고 싶을 때 메일에 어떻게 써야 할까요?',a:'녹음해도 되는지 먼저 허락을 구한다',o:['말하지 않고 녹음한다','녹음 파일을 친구들에게 나눠 준다고 쓴다']},
  {id:'q6',q:'🅑 메일 끝에 지도 교사를 함께 쓴 까닭은?',a:'어린이가 보낸 메일임을 믿고 안심하게 하려고',o:['글자 수를 늘리려고','선생님께 칭찬받으려고']}];
const QUIZ3=[
  {id:'r1',q:'“내일 시간 돼요?”를 바르게 고친 것은?',a:'편하신 날을 알려 주실 수 있을까요?',o:['내일 시간 되죠?','내일 꼭 시간 내세요.']},
  {id:'r2',q:'“답장 빨리 주세요!!”를 바르게 고친 것은?',a:'12월 9일까지 답장 주시면 감사하겠습니다.',o:['답장 안 하시면 안 돼요.','빨리빨리 답장 주세요~']},
  {id:'r3',q:'받는 분을 부르는 말로 알맞은 것은?',a:'박○○ 제빵사님께',o:['빵집 아저씨!','제빵사야']}];
const ITEMS=[...QUIZ1.map(x=>({...x,st:1})),...QUIZ3.map(x=>({...x,st:3}))];
/* 섭외 메일 7요소 = 입력 칸 (받는 분 + 제목 + 본문 6칸) */
const FIELDS=[
  {k:'to',n:'받는 분',big:false,h:['누구에게 보내나요? 이름과 하는 일을 함께 써요.','<b>○○○ ○○님께</b> (예: 이름 + 하는 일 + 님께)']},
  {k:'subj',n:'① 제목',big:false,h:['받는 분이 제목만 보고 “무슨 메일인지” 알 수 있나요?','<b>[면담 요청] …이/가 궁금한 6학년 학생입니다</b>']},
  {k:'hello',n:'② 인사·나 소개',h:['나는 누구인가요? 학교·학년·이름을 밝혔나요?','안녕하세요. 저는 <b>…초등학교 6학년 …</b>입니다.']},
  {k:'why',n:'③ 연락한 까닭',h:['이분을 어떻게 알게 되었나요? 왜 꼭 이분께 묻고 싶나요?','<b>…</b>을/를 보고 <b>…</b>이/가 궁금해져 연락드리게 되었습니다.']},
  {k:'purpose',n:'④ 면담 목적',h:['면담으로 무엇을 알고 싶나요? 한 문장으로!','면담에서는 <b>…</b>에 대해 여쭙고 싶습니다.']},
  {k:'how',n:'⑤ 방식·날짜',h:['만나서? 화상으로? 메일로 답을? 언제, 몇 분쯤?','12월 <b>…</b>일부터 <b>…</b>일 사이 편하신 날, <b>…</b>분 정도 <b>…</b>(으)로 면담을 부탁드려도 될까요?']},
  {k:'qs',n:'⑥ 질문 미리 보기·녹음',h:['가장 궁금한 질문 2개는? 녹음해도 되는지 물었나요?','여쭙고 싶은 질문은 ‘<b>…</b>’, ‘<b>…</b>’입니다. 허락해 주시면 <b>…</b>']},
  {k:'end',n:'⑦ 감사·답장·지도 교사',h:['감사 인사, 언제까지 답장을 받고 싶은지, 지도 교사를 썼나요?','바쁘신 중에 읽어 주셔서 감사합니다. <b>…</b>까지 답장 주시면 <b>…</b> / <b>…</b> 올림 (지도 교사: <b>…</b>)']}];
const EX=MAIL_B.body.split('\n').filter(Boolean).concat([MAIL_B.subj]);
const CHECKS=['제목만 보고 무슨 메일인지 알 수 있어요','누가 보냈는지(학교·학년·이름) 알 수 있어요','왜 이분께 연락했는지 나와요','면담 목적이 분명해요','방식·날짜·시간을 받는 분이 고를 수 있어요','질문 미리 보기와 녹음 허락이 있어요','감사 인사·답장 날짜·지도 교사가 있어요','높임말을 바르게 썼어요','맞춤법·띄어쓰기를 확인했어요'];
const reviewTarget=t=>t%NT+1;

const $=(s,el=document)=>el.querySelector(s), $$=(s,el=document)=>[...el.querySelectorAll(s)];
const app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k));localStorage.setItem(k,JSON.stringify(v));}catch(e){return null;}}
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const RM=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function rec(id,ok){
  if(!me||!id)return;
  if(ME.ans&&ME.ans[id]!==undefined)return;
  ME.ans={...(ME.ans||{}),[id]:ok};
  roomRef(me.room).child(`students/${me.num}/ans/${id}`).transaction(v=>v===null?ok:undefined);
}
function pick(box,{id,q,a,o,onOk,fig=''}){
  const opts=shuffle([a,...o]);let first=true;
  box.innerHTML=`<div class="quiz">${fig}<div class="q">${q}</div><div class="opts">${opts.map(x=>`<button data-o="${esc(x)}">${esc(x)}</button>`).join('')}</div><div class="msg" id="pm" role="status"></div></div>`;
  $$('.opts button',box).forEach(b=>b.onclick=()=>{
    const ok=b.dataset.o===a;if(first){rec(id,ok);first=false;}
    if(ok){b.classList.add('right');$$('.opts button',box).forEach(x=>x.disabled=true);$('#pm',box).className='msg ok';$('#pm',box).textContent='맞았어요!';setTimeout(onOk,RM?0:650);}
    else{b.classList.add('wrong');b.disabled=true;box.classList.remove('shake');void box.offsetWidth;box.classList.add('shake');$('#pm',box).className='msg bad';$('#pm',box).textContent='다시 골라 봐요';}
  });
}
const mailHTML=(m,tag)=>`<div class="mailbox"><div class="mh"><span class="band">${tag}</span> <b>제목:</b> ${esc(m.subj)}</div><div class="mb">${esc(m.body)}</div></div>`;
function composed(f={}){
  const body=[f.to,'',f.hello,f.why,f.purpose,f.how,f.qs,f.end].filter((x,i)=>i===1||(x&&x.trim())).join('\n');
  return {subj:f.subj||'',body};
}
const filled=f=>FIELDS.filter(x=>f&&f[x.k]&&f[x.k].trim().length>=2).length;

function startView(){
  clearOffs();clearInterval(tick);ClassWatch.teacherStop();
  $('#sub').textContent='6학년 국어 · 2. 궁금한 점을 해결해요 (면담 섭외)';
  app.innerHTML=`<section class="hero"><div class="grid"><h1>섭외 메일<br>작업실</h1>
   <p>답장을 받는 메일에는 무엇이 들어 있을까요? 두 메일을 비교하고, 짝과 함께 진짜 면담 대상자에게 보낼 섭외 메일을 써요. 다른 조와 바꿔 읽고 고친 뒤 선생님 확인을 받아 보내요.</p></div>
   <div class="panel">${mailHTML(MAIL_A,'🅐')}</div></section>
   <div class="choose"><button id="goStu">학생으로 참여하기</button><button class="ghost" id="goTv">선생님 화면 (TV)</button></div>`;
  $('#goStu').onclick=joinView; $('#goTv').onclick=()=>{location.hash='teacher';teacherView();};
}
function saver(n,R){return async p=>{Object.assign(R,p);ME['s'+n]={...R};await roomRef(me.room).child('students/'+me.num+'/s'+n).update(p);drawSteps();};}
function layout(n,title,side){
  shell(`<div class="two"><div class="panel grid"><div><span class="band">${n}단계 · ${STAGES[n].k}</span></div><h2>${title}</h2>${side}</div><div class="panel grid" id="work"></div></div>`);
  return $('#work');
}
function doneView(n,html){shell(`<div class="panel quiz pop"><div><span class="band">${n}단계 끝</span></div>${html}<p class="muted">TV를 보며 기다려요.</p></div>`);}

/* ---------- 1. 메일 탐정 ---------- */
function stage1(){
  const R={i:0,...(ME.s1||{})};const save=saver(1,R);
  if(R.done)return doneView(1,`<div class="emoji">🕵️</div><h2>메일 탐정 끝!</h2><p>답장을 받는 메일에는 무엇이 들어 있었나요? 짝과 말해 봐요.</p>`);
  const work=layout(1,'두 메일을 비교해요',`${mailHTML(MAIL_A,'🅐')}${mailHTML(MAIL_B,'🅑')}`);
  const Q=QUIZ1[R.i];
  work.innerHTML=`<div class="prog">${QUIZ1.map((_,k)=>`<span class="${k<R.i?'on':k===R.i?'cur':''}"></span>`).join('')}</div><div id="qb"></div>`;
  pick($('#qb'),{...Q,onOk:async()=>{const last=R.i+1>=QUIZ1.length;await save({i:R.i+1,...(last?{done:true,at:Date.now()}:{})});stage1();}});
}

/* ---------- 2. 초안 쓰기 (조별) ---------- */
let TEAMV={}, tfs={};
function teamPicker(n,then){
  shell(`<div class="panel grid" style="max-width:640px;margin:0 auto"><div><span class="band">${n}단계 · ${STAGES[n].k}</span></div><h2>우리 조를 골라요</h2><p class="muted">짝과 <b>같은 조</b>를 골라요. 같은 조는 메일 한 통을 함께 써요.</p>
    <div class="lvl" style="grid-template-columns:repeat(4,1fr)">${Array.from({length:NT},(_,i)=>`<button data-t="${i+1}"><b>${i+1}</b>조</button>`).join('')}</div></div>`);
  $$('.lvl button').forEach(b=>b.onclick=async()=>{const t=+b.dataset.t;ME.team=t;await roomRef(me.room).child('students/'+me.num+'/team').set(t);then();});
}
function listenTeam(t,cb){listen(roomRef(me.room).child('teams/'+t),s=>{TEAMV[t]=s.val()||{};cb&&cb();});}
function fieldsForm(t,stageN){
  const f=(TEAMV[t]&&TEAMV[t].f)||{};
  return `<div class="form" id="fform">${FIELDS.map(x=>`<div class="fld"><label for="f-${x.k}">${x.n}</label>
    ${x.big===false?`<input id="f-${x.k}" data-k="${x.k}" autocomplete="off" value="${esc(f[x.k]||'')}">`:`<textarea id="f-${x.k}" data-k="${x.k}" rows="2">${esc(f[x.k]||'')}</textarea>`}
    <div class="tfbox" data-k="${x.k}"></div><div class="msg bad" data-m="${x.k}" role="status"></div></div>`).join('')}</div>`;
}
function wireFields(t,stageN){
  $$('#fform [data-k]').forEach(el=>{
    if(!el.matches('input,textarea'))return;
    const k=el.dataset.k;let tmr=null;
    const push=async()=>{
      const v=el.value.trim();const m=$(`[data-m="${k}"]`);
      const cp=v.length>8&&ThinkFirst.copied(v,EX,0.7);
      if(cp){m.textContent='예시 메일과 거의 같아요. 우리 조의 대상자와 까닭으로 바꿔 써요.';return;}
      m.textContent='';
      const lv=(tfs[k]&&tfs[k].level())||0;
      await roomRef(me.room).child('teams/'+t).update({['f/'+k]:el.value,['hint/'+k]:Math.max(lv,(TEAMV[t]&&TEAMV[t].hint&&TEAMV[t].hint[k])||0),['by/'+k]:me.num});
    };
    /* 내가 고친 칸만 올려요(짝이 쓴 칸을 빈 글로 덮지 않게) */
    el.oninput=()=>{el.dataset.dirty='1';clearTimeout(tmr);tmr=setTimeout(()=>{if(el.dataset.dirty){el.dataset.dirty='';push();}},700);};
    el.onblur=()=>{clearTimeout(tmr);if(!el.dataset.dirty)return Promise.resolve();el.dataset.dirty='';return push();};
  });
  $$('.tfbox').forEach(box=>{const x=FIELDS.find(z=>z.k===box.dataset.k);tfs[x.k]=ThinkFirst.mount(box,{key:`${me.room}-${t}-${x.k}-${stageN}`,wait:40,hints:x.h.map(h=>`<p style="margin:2px 0">${h}</p>`)});});
}
const domF=()=>{const f={};$$('#fform input,#fform textarea').forEach(el=>f[el.dataset.k]=el.value);return f;};
const flush=()=>Promise.all($$('#fform input,#fform textarea').map(el=>el.onblur&&el.onblur()));
function syncFields(t){
  const f=(TEAMV[t]&&TEAMV[t].f)||{};
  $$('#fform input,#fform textarea').forEach(el=>{if(!el.dataset.dirty&&(document.activeElement!==el||!el.value)&&el.value!==(f[el.dataset.k]||''))el.value=f[el.dataset.k]||'';});
  const p=$('#prev');if(p)p.innerHTML=mailHTML(composed(f),`${t}조`);
  const c=$('#fcnt');if(c)c.textContent=`${filled(f)}/${FIELDS.length}칸`;
}
function stage2(){
  const R={...(ME.s2||{})};const save=saver(2,R);
  if(!ME.team)return teamPicker(2,stage2);
  const t=ME.team;
  const work=layout(2,`${t}조 섭외 메일 초안`,`<div class="rules"><b>섭외 메일 7요소</b><ul><li>① 제목 ② 인사·나 소개 ③ 연락한 까닭 ④ 면담 목적</li><li>⑤ 방식·날짜 ⑥ 질문 미리 보기·녹음 허락 ⑦ 감사·답장·지도 교사</li></ul></div>
    <p class="muted" style="margin:0">짝과 칸을 나누어 써도 돼요. 쓴 글은 짝 화면에도 바로 보여요. <span id="fcnt"></span></p><div id="prev"></div>`);
  work.innerHTML=fieldsForm(t,2)+`<div class="row"><button id="fin">다 썼어요 ✓</button><span class="msg" id="fm" role="status"></span></div>`;
  wireFields(t,2);
  listenTeam(t,()=>syncFields(t));syncFields(t);
  $('#fin').onclick=async()=>{
    await flush();
    const n=filled(domF());
    if(n<FIELDS.length){$('#fm').className='msg bad';$('#fm').textContent=`아직 빈 칸이 있어요 (${n}/${FIELDS.length}). 짝과 나누어 채워요.`;return;}
    await save({done:true,at:Date.now()});
    $('#fm').className='msg ok';$('#fm').textContent='저장했어요! 짝과 함께 소리 내어 읽어 보며 더 고쳐도 돼요.';
  };
}

/* ---------- 3. 바꿔 읽기 ---------- */
function stage3(){
  const R={i:0,...(ME.s3||{})};const save=saver(3,R);
  if(!ME.team)return teamPicker(3,stage3);
  if(R.i<QUIZ3.length){
    const work=layout(3,'먼저, 높임말 고치기',`<p>받는 분은 처음 연락하는 어른이에요. 공손하고 정확하게!</p>${mailHTML(MAIL_A,'🅐')}`);
    work.innerHTML=`<div class="prog">${QUIZ3.map((_,k)=>`<span class="${k<R.i?'on':k===R.i?'cur':''}"></span>`).join('')}</div><div id="qb"></div>`;
    return pick($('#qb'),{...QUIZ3[R.i],onOk:async()=>{await save({i:R.i+1});stage3();}});
  }
  const tg=reviewTarget(ME.team);
  if(R.done)return doneView(3,`<div class="emoji">🤝</div><h2>${tg}조 메일 점검 끝!</h2><p>우리 조 메일에 온 점검은 4단계에서 볼 수 있어요.</p>`);
  const work=layout(3,`${tg}조 메일을 읽고 점검해요`,`<div id="prev"></div>`);
  listenTeam(tg,()=>{const p=$('#prev');if(p)p.innerHTML=mailHTML(composed((TEAMV[tg]||{}).f),`${tg}조`);});
  work.innerHTML=`<div class="form"><h3>점검표 (잘된 것에 ✓)</h3><div class="chks">${CHECKS.map((c,i)=>`<label class="chk"><input type="checkbox" data-c="${i}"> ${c}</label>`).join('')}</div>
    <label for="good">👍 가장 잘 쓴 곳</label><textarea id="good" rows="2"></textarea>
    <label for="fix">✏️ 이렇게 고치면 좋겠어요 (어느 칸을 어떻게)</label><textarea id="fix" rows="3"></textarea>
    <div class="row"><button id="send">점검 보내기</button><span class="msg bad" id="sm" role="status"></span></div></div>`;
  $('#send').onclick=async()=>{
    const good=$('#good').value.trim(),fix=$('#fix').value.trim();
    if(good.length<4||fix.length<4){$('#sm').textContent='잘한 곳과 고칠 곳을 한 가지씩 꼭 써요.';return;}
    const checks=$$('.chks input').filter(x=>x.checked).map(x=>+x.dataset.c);
    await roomRef(me.room).child(`teams/${tg}/rev/${me.num}`).set({by:`${me.num} ${me.name}`,from:ME.team,checks,good,fix,at:Date.now()});
    await save({done:true,at:Date.now()});stage3();
  };
}

/* ---------- 4. 고쳐 쓰고 보내기 ---------- */
function stage4(){
  if(!ME.team)return teamPicker(4,stage4);
  const t=ME.team;
  const work=layout(4,`${t}조 메일 고치기`,`<div id="revs"></div><div id="stat"></div>`);
  work.innerHTML=fieldsForm(t,4)+`<div id="prev"></div><div class="row"><button id="ask">🙋 선생님 확인 받기</button><span class="msg" id="am" role="status"></span></div>`;
  wireFields(t,4);
  const draw=()=>{
    syncFields(t);
    const T=TEAMV[t]||{};const revs=Object.values(T.rev||{});
    $('#revs').innerHTML=`<h3>다른 조가 보낸 점검</h3>`+(revs.map(r=>`<div class="card2"><small>${esc(r.by)} (${r.from}조)</small>✓ ${(r.checks||[]).length}/${CHECKS.length}개${(r.checks||[]).length<CHECKS.length?` · 빠진 것: ${CHECKS.filter((_,i)=>!(r.checks||[]).includes(i)).map(esc).join(', ')}`:''}<br>👍 ${esc(r.good)}<br>✏️ ${esc(r.fix)}</div>`).join('')||'<p class="muted">아직 온 점검이 없어요.</p>');
    const st=T.ok?`<div class="okbox">✅ 선생님 확인 완료! 학급 메일로 보내요. 받는 분 주소를 선생님과 함께 한 번 더 확인해요.</div>`:T.back?`<div class="backbox">✏️ 선생님: ${esc(T.back)}</div>`:T.ask?`<div class="card2">🙋 선생님 확인을 기다리는 중이에요. 그동안 소리 내어 한 번 더 읽어 봐요.</div>`:'';
    $('#stat').innerHTML=st;
    const done=!!T.ok;
    if(done&&!(ME.s4&&ME.s4.done)){ME.s4={done:true};roomRef(me.room).child('students/'+me.num+'/s4').update({done:true,at:Date.now()});drawSteps();}
  };
  listenTeam(t,draw);draw();
  $('#ask').onclick=async()=>{
    await flush();
    if(filled(domF())<FIELDS.length){$('#am').className='msg bad';$('#am').textContent='빈 칸을 먼저 채워요.';return;}
    await roomRef(me.room).child('teams/'+t).update({ask:Date.now(),back:null,ok:null});
    $('#am').className='msg ok';$('#am').textContent='선생님께 보냈어요!';
  };
}

/* ---------- student: room ---------- */
let me=null, ROOMV={}, ME={}, cur=1, onMe=null;
function enterRoom(){
  clearOffs();ClassWatch.student({db,room:me.room,root:app});ClassWatch.who(me.num,me.name);
  $('#sub').textContent=`${me.num}번 ${me.name}`;
  app.innerHTML='<div class="panel"><h2>들어가는 중…</h2></div>';
  let ready=false;ROOMV={};onMe=null;
  baseOffs=[];
  listen(roomRef(me.room).child('students/'+me.num),s=>{
    const v=s.val();
    if(!v){store(APP+'-student',null);me=null;clearOffs();return joinView();}
    ME=v;
    if(!ready){ready=true;if(ROOMV.stage){cur=ROOMV.stage;renderStage();}return;}
    if(typeof onMe==='function')onMe();
  });
  listen(roomRef(me.room).child('stage'),s=>{
    const st=s.val()||1;const was=ROOMV.stage;ROOMV.stage=st;
    if(!ready)return;
    if(was!==st){cur=st;renderStage();} else drawSteps();
  });
  listen(roomRef(me.room).child('go'),s=>{
    const g=s.val()||0;const was=ROOMV.go||0;ROOMV.go=g;
    if(!ready)return;
    if((cur>was)!==(cur>g))renderStage(); else drawSteps();
  });
  baseOffs=offs.slice();
}
let baseOffs=[];
function dropStageListeners(){offs.filter(f=>!baseOffs.includes(f)).forEach(f=>f());offs=baseOffs.slice();tfs={};}
function waitView(){
  ClassWatch.step('대기',{n:cur,total:NST,wait:true});
  shell(`<div class="panel quiz pop"><div><span class="band">${cur}단계 · ${STAGES[cur].k}</span></div><div class="emoji" aria-hidden="true">👂</div>
    <h2 style="font-size:1.8rem">선생님 설명을 들어요</h2><p>선생님이 <b>시작</b>을 누르면 활동이 열려요. 태블릿은 잠깐 내려놓아요.</p></div>`);
}
function stepDone(n){return !!(ME['s'+n]&&ME['s'+n].done);}
function drawSteps(){
  const el=$('#steps');if(!el)return;
  el.innerHTML=Array.from({length:NST},(_,i)=>i+1).map(n=>`<button data-s="${n}" ${n>ROOMV.stage||n>(ROOMV.go||0)?'disabled':''} ${n===cur?'aria-current="step"':''} class="${stepDone(n)?'done':''}"><b>${n}</b>${STAGES[n].k}${stepDone(n)?' ✓':''}</button>`).join('');
  $$('#steps button').forEach(b=>b.onclick=()=>{cur=+b.dataset.s;renderStage();});
}
function shell(inner){
  app.innerHTML=`<div class="grid"><nav class="steps" id="steps" aria-label="활동 단계" style="grid-template-columns:repeat(4,1fr)"></nav>${inner}<div style="text-align:right"><button class="ghost" id="relog" style="font-size:.85rem;padding:.4em .8em">다른 이름으로 들어가기</button></div></div>`;
  $('#relog').onclick=()=>{store(APP+'-student',null);me=null;clearOffs();joinView();};
  drawSteps();
}
function renderStage(){
  dropStageListeners();
  if(cur>(ROOMV.go||0))return waitView();
  ClassWatch.step(STAGES[cur].k,{n:cur,total:NST,wait:stepDone(cur)});
  onMe=()=>drawSteps();
  if(cur===1)return stage1();
  if(cur===2)return stage2();
  if(cur===3)return stage3();
  return stage4();
}

function withTimeout(pr,ms=10000){return Promise.race([pr,new Promise((_,rej)=>setTimeout(()=>rej(new Error('TIMEOUT')),ms))]);}
function showError(e){
  const m=String(e&&(e.code||e.message)||e);
  let why='알 수 없는 오류가 났어요.';
  if(/permission/i.test(m)) why='Firebase 데이터베이스의 <b>규칙</b>이 막고 있어요. Realtime Database → 규칙 탭을 확인해 주세요.';
  else if(/TIMEOUT/.test(m)) why='Firebase 서버에 10초 동안 연결되지 않았어요. 학교 인터넷이 Firebase를 막고 있을 수 있어요.';
  $('#sub').textContent='연결 문제';
  app.innerHTML=`<div class="panel grid"><h2 style="color:var(--bad)">서버에 연결하지 못했어요</h2><p>${why}</p><p class="muted">오류 내용: <code>${esc(m)}</code></p><div class="row"><button id="retry">다시 시도</button><button class="ghost" id="home">처음으로</button></div></div>`;
  $('#retry').onclick=()=>location.reload(); $('#home').onclick=()=>{location.hash='';startView();};
}
window.addEventListener('unhandledrejection',ev=>showError(ev.reason));
firebase.initializeApp(FIREBASE_CONFIG);
const db=firebase.database();
const roomRef=c=>db.ref('rooms/'+c);
const params=new URLSearchParams(location.search);
let ROOM=params.get('room')||'';
let offs=[];const clearOffs=()=>{offs.forEach(f=>f());offs=[];baseOffs=[];};
function listen(ref,cb){const h=ref.on('value',cb);const off=()=>ref.off('value',h);offs.push(off);return off;}

function parseName(s){const m=String(s).trim().match(/^(\d{1,2})\s*[번.]?\s*(.+)$/);return m?{num:+m[1],name:m[2].trim()}:null;}
function joinView(){
  clearOffs();
  const saved=store(APP+'-student');
  if(saved&&ROOM&&saved.room===ROOM){me=saved;return enterRoom();}
  $('#sub').textContent='학생 화면';
  ClassWatch.student({db,room:ROOM,root:app});ClassWatch.step('들어가기');
  app.innerHTML=`<div class="grid" style="max-width:560px;margin:0 auto">
   <div class="panel grid"><h2>방 번호</h2><input id="rm" inputmode="numeric" maxlength="4" placeholder="TV에 보이는 4자리" value="${esc(ROOM)}"></div>
   <div class="panel grid"><h2>"번호 이름"을 써요</h2><input id="nm" placeholder="예) 7 김민수" autocomplete="off"></div>
   <div class="msg bad" id="jm" role="status"></div>
   <div class="row"><button id="enter" disabled>들어가기</button><button class="ghost" id="home">처음으로</button></div></div>`;
  const chk=()=>{$('#enter').disabled=!(/^\d{4}$/.test($('#rm').value)&&parseName($('#nm').value));};
  $('#rm').oninput=chk;$('#nm').oninput=chk;
  $('#home').onclick=startView;
  ClassWatch.joinForm();
  $('#enter').onclick=async()=>{
    const code=$('#rm').value, p=parseName($('#nm').value);
    $('#enter').disabled=true;
    try{
      const open=await withTimeout(roomRef(code).child('open').get());
      if(!open.exists()){$('#jm').textContent='방 번호를 다시 확인해요.';return chk();}
      const r=await withTimeout(roomRef(code).child('students/'+p.num).transaction(c=>c?undefined:{name:p.name,joinedAt:Date.now()},undefined,false));
      if(!r.committed){const c=r.snapshot.val();
        if(!(c&&c.name===p.name)){$('#jm').textContent=`${p.num}번은 이미 "${c.name}" 이름으로 들어와 있어요. 번호를 확인해요.`;return chk();}}
    }catch(e){$('#jm').textContent='연결 문제: '+(e.code||e.message);return chk();}
    ROOM=code;me={room:code,num:p.num,name:p.name};store(APP+'-student',me);
    history.replaceState(null,'','?room='+code);
    enterRoom();
  };
}

/* ---------- teacher ---------- */
let tick=null,RD={};
async function teacherView(){
  clearOffs();
  $('#sub').textContent='선생님 화면 · 연결 중';
  app.innerHTML='<div class="panel grid" style="text-align:center"><h2>방을 만드는 중이에요…</h2></div>';
  let code=store(APP+'-teacher-room');
  try{
    if(!code||!(await withTimeout(roomRef(code).child('open').get())).exists()){
      code=String(Math.floor(1000+Math.random()*9000));
      await withTimeout(roomRef(code).set({open:Date.now(),app:APP,stage:1,timer:{min:STAGES[1].tm,left:STAGES[1].tm*60,endAt:0}}));
      store(APP+'-teacher-room',code);
    }
  }catch(e){return showError(e);}
  ROOM=code;
  ClassWatch.teacher({db,room:code});
  const url=location.origin+location.pathname+'?room='+code;
  $('#sub').textContent='선생님 화면 · TV에 띄워 주세요';
  app.innerHTML=`<div class="tv">
   <div class="grid">
    <div class="panel qr"><h2>태블릿으로 접속</h2><div id="qrbox"></div><div>방 번호 <span class="roomcode">${code}</span></div><p class="muted" style="word-break:break-all;font-size:.75rem;margin:0">${esc(url)}</p><p class="muted" style="font-size:.85rem;margin:0">월·화 두 시간 모두 <b>같은 방</b>을 써요. [새 방]을 누르지 마세요.</p></div>
    <div class="panel grid"><div class="timer" id="tm">5:00</div><div class="row" style="justify-content:center"><button class="ghost" id="minus" aria-label="1분 줄이기">－1</button><button id="go">시작</button><button class="ghost" id="plus" aria-label="1분 늘리기">＋1</button></div><div class="msg" id="gostat" role="status" style="text-align:center;font-size:1rem"></div></div>
    <div class="panel grid"><h2>단계 열기</h2><div class="tsteps" id="tsteps"></div></div>
    <div class="panel grid"><div class="row" style="justify-content:space-between"><h2>참여</h2><span class="muted" id="cnt"></span></div><div class="people" id="ppl"></div></div>
    <div class="row"><button class="ghost" id="newroom">새 방</button><button class="ghost" id="home">처음으로</button></div>
   </div>
   <div class="grid" id="main"></div></div>`;
  if(window.QRCode){try{new QRCode($('#qrbox'),{text:url,width:200,height:200,correctLevel:QRCode.CorrectLevel.M});}catch(e){}}
  const ref=roomRef(code);
  listen(ref,s=>{RD=s.val()||{};renderTV();});
  const tm=()=>RD.timer||{min:5,left:300,endAt:0};
  $('#minus').onclick=()=>{const t=tm();if(!t.endAt){const m=Math.max(1,t.min-1);ref.child('timer').set({min:m,left:m*60,endAt:0});}};
  $('#plus').onclick=()=>{const t=tm();if(!t.endAt){const m=Math.min(30,t.min+1);ref.child('timer').set({min:m,left:m*60,endAt:0});}};
  $('#go').onclick=()=>{const t=tm();if(t.endAt)ref.child('timer').set({min:t.min,left:Math.max(0,Math.round((t.endAt-Date.now())/1000)),endAt:0});else{const l=t.left>0?t.left:t.min*60;ref.child('timer').set({min:t.min,left:l,endAt:Date.now()+l*1000});const st=RD.stage||1;if((RD.go||0)<st)ref.child('go').set(st);}};
  $('#newroom').onclick=()=>{if(confirmNew())return;};
  $('#home').onclick=()=>{location.hash='';startView();};
  clearInterval(tick);tick=setInterval(renderTime,250);
}
let newArm=0;
function confirmNew(){ /* 실수로 누르지 않게 두 번 눌러야 새 방 */
  if(Date.now()-newArm<3000){store(APP+'-teacher-room',null);teacherView();return true;}
  newArm=Date.now();$('#newroom').textContent='한 번 더 누르면 새 방';setTimeout(()=>{const b=$('#newroom');if(b)b.textContent='새 방';},3000);return false;
}
function setStage(n){roomRef(ROOM).update({stage:n,timer:{min:STAGES[n].tm,left:STAGES[n].tm*60,endAt:0}});}
function renderTime(){
  const el=$('#tm');if(!el)return clearInterval(tick);
  const t=RD.timer||{min:5,left:300,endAt:0};
  const left=t.endAt?Math.max(0,Math.round((t.endAt-Date.now())/1000)):t.left;
  el.textContent=left===0&&t.endAt?'시간 끝!':`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  el.classList.toggle('end',!!t.endAt&&left===0);
  const waitSt=(RD.go||0)<(RD.stage||1);
  $('#go').textContent=t.endAt?'멈춤':waitSt?'▶ 활동 시작':'시작';
  const gs=$('#gostat');if(gs){gs.textContent=waitSt?`학생들은 대기 중이에요. 설명을 마치면 [▶ 활동 시작]을 눌러요.`:`${RD.stage||1}단계 활동이 열려 있어요.`;gs.className='msg '+(waitSt?'bad':'ok');}$('#minus').disabled=$('#plus').disabled=!!t.endAt;
}
const students=()=>{const s=RD.students||{};return Object.keys(s).map(Number).sort((a,b)=>a-b).map(n=>({n,...s[n]}));};
let tvStage=0,tvAll=false,showWrong=false,tvBig=0;
function renderTV(){
  const main=$('#main');if(!main)return;
  const ae=document.activeElement;if(ae&&ae.id&&ae.id.startsWith('bk-')){setTimeout(renderTV,1500);return;}
  const st=RD.stage||1, S=students();
  $('#tsteps').innerHTML=Array.from({length:NST},(_,i)=>i+1).map(n=>`<button data-s="${n}" ${n===st?'aria-current="step"':''}><b>${n}</b> ${STAGES[n].t}</button>`).join('');
  $$('#tsteps button').forEach(b=>b.onclick=()=>setStage(+b.dataset.s));
  const doneIn=x=>!!(x['s'+st]&&x['s'+st].done);
  $('#cnt').textContent=`${S.length}명 · 이 단계 끝 ${S.filter(doneIn).length}명`;
  $('#ppl').innerHTML=S.map(x=>`<span class="${doneIn(x)?'ok':''}">${x.n} ${esc(x.name)}${x.team?` · ${x.team}조`:''}</span>`).join('')||'<span class="muted" style="background:none">아직 아무도 없어요</span>';
  if(tvStage!==st){tvStage=st;tvBig=0;}
  const mid=st===1?`<div class="panel grid"><h2>🕵️ 어느 메일이 답장을 받을까?</h2><div class="two">${mailHTML(MAIL_A,'🅐')}${mailHTML(MAIL_B,'🅑')}</div>
      <div class="rules"><b>함께 이야기해요</b><ul><li>🅐를 받은 제빵사는 어떤 기분일까요?</li><li>🅑에만 있는 것을 모두 찾아봐요.</li></ul></div></div>`
    :teamsBox(S,st);
  main.innerHTML=`<div id="tvmid">${mid}</div><div id="tvq">${quizBox(S,st)}</div>`;
  $$('[data-big]').forEach(b=>b.onclick=()=>{tvBig=tvBig===+b.dataset.big?0:+b.dataset.big;renderTV();});
  $$('[data-ok]').forEach(b=>b.onclick=()=>roomRef(ROOM).child('teams/'+b.dataset.ok).update({ok:Date.now(),back:null}));
  $$('[data-back]').forEach(b=>b.onclick=()=>{const t=b.dataset.back;const inp=$(`#bk-${t}`);const msg=(inp&&inp.value.trim())||'빠진 요소를 채우고 높임말을 다시 확인해요.';roomRef(ROOM).child('teams/'+t).update({back:msg,ok:null,ask:null});});
  $$('[data-copy]').forEach(b=>b.onclick=async()=>{const T=(RD.teams||{})[b.dataset.copy]||{};const m=composed(T.f);const txt=b.dataset.what==='subj'?m.subj:m.body;try{await navigator.clipboard.writeText(txt);b.textContent='복사했어요 ✓';}catch(e){b.textContent='복사 안 됨: 글을 드래그해 복사';}});
  const w=$('#wrongT');if(w)w.onclick=()=>{showWrong=!showWrong;renderTV();};
  const a=$('#allT');if(a)a.onclick=()=>{tvAll=!tvAll;renderTV();};
}
function teamsBox(S,st){
  const TM=RD.teams||{};
  const cards=Array.from({length:NT},(_,i)=>i+1).map(t=>{
    const T=TM[t]||{};const who=S.filter(x=>x.team===t);const m=composed(T.f);const revs=Object.values(T.rev||{});
    const hints=FIELDS.map(x=>(T.hint||{})[x.k]||0);
    const status=T.ok?'<span class="okc">✅ 보내도 좋아요</span>':T.ask?'<b style="color:var(--coral2)">🙋 확인 요청</b>':T.back?'✏️ 고치는 중':'';
    const big=tvBig===t;
    return `<div class="panel grid ${big?'tvwide':''}"><div class="row" style="justify-content:space-between"><h3>${t}조 <span class="muted" style="font-size:1rem">${who.map(x=>x.n+' '+esc(x.name)).join(', ')||'아직 없음'}</span></h3><span>${filled(T.f)}/${FIELDS.length}칸 ${status}</span></div>
      ${mailHTML(m,t+'조')}
      <p class="muted" style="margin:0;font-size:.9rem">${ThinkFirst.summary(hints)} (칸 기준)${revs.length?` · 받은 점검 ${revs.length}개`:''}</p>
      ${big&&revs.length?revs.map(r=>`<div class="card2"><small>${esc(r.by)}</small>👍 ${esc(r.good)}<br>✏️ ${esc(r.fix)}</div>`).join(''):''}
      <div class="row"><button class="ghost" data-big="${t}">${big?'작게':'크게 보기'}</button>
       ${st===4?`<button data-ok="${t}">✅ 보내도 좋아요</button><input id="bk-${t}" placeholder="고칠 점 (비우면 기본 안내)" style="max-width:16em"><button class="ghost" data-back="${t}">✏️ 고쳐 와요</button>`:''}
       ${st===4&&T.ok?`<button class="ghost" data-copy="${t}" data-what="subj">📋 제목 복사</button><button class="ghost" data-copy="${t}" data-what="body">📋 본문 복사</button>`:''}</div></div>`;
  }).join('');
  const head=st===2?'✍️ 조별 섭외 메일 초안 (실시간)':st===3?'🤝 바꿔 읽기: 1조→2조→3조→4조→1조 메일을 점검해요':'📨 고쳐 쓰고 보내기: 확인 요청이 오면 읽고 [✅ 보내도 좋아요]';
  return `<div class="panel grid"><h2>${head}</h2>${st===4?'<p class="muted" style="margin:0">확인한 메일은 [📋 복사]로 학급 메일에 붙여 넣고, 조 아이들이 받는 분 주소를 함께 확인한 뒤 직접 [보내기]를 눌러요.</p>':''}</div><div class="gal2">${cards}</div>`;
}
function quizStats(S,st){
  return ITEMS.map(q=>({q,no:ITEMS.filter(x=>x.st===q.st).indexOf(q)+1})).filter(r=>tvAll||r.q.st===st).map(r=>{
    const done=S.filter(x=>x.ans&&x.ans[r.q.id]!==undefined);
    const miss=done.filter(x=>x.ans[r.q.id]===false);
    const ok=done.length-miss.length;
    return {...r,done:done.length,ok,miss,rate:done.length?Math.round(ok/done.length*100):null};
  });
}
function quizBox(S,st){
  const R=quizStats(S,st).sort((a,b)=>(a.rate??101)-(b.rate??101)||a.q.st-b.q.st||a.no-b.no);
  const btns=`<div class="row"><button class="ghost" id="allT">${tvAll?'이 단계만':'모든 단계 보기'}</button><button class="ghost" id="wrongT">${showWrong?'이름 가리기':'틀린 학생 이름 보기'}</button></div>`;
  if(!R.length)return `<div class="panel grid" id="qstat"><div class="row" style="justify-content:space-between"><h2>문제별 정답률 (${st}단계)</h2>${btns}</div><p class="muted" style="margin:0">이 단계는 쓰기 활동이라 문제가 없어요. 위에서 조별 메일을 크게 띄워 함께 봐요.</p></div>`;
  return `<div class="panel grid" id="qstat"><div class="row" style="justify-content:space-between"><h2>문제별 정답률 ${tvAll?'(모든 단계)':`(${st}단계)`}</h2>${btns}</div>
   <p class="muted" style="margin:0">처음 답한 것이 맞은 비율이에요. 낮은 문제부터 보여요. 다시 골라서 맞힌 학생도 틀린 학생에 들어가요.</p>
   <div class="qrate">${R.map(r=>`<div class="qrow${r.rate!==null&&r.rate<70?' low':''}" data-q="${r.q.id}">
     <div class="qt"><b>${r.q.st}-${r.no}</b> ${esc(r.q.q)}<br><small class="muted cw-ans">정답: ${esc(r.q.a)}</small></div>
     <div class="qb cw-ans"><div class="track"><div style="width:${r.rate||0}%"></div></div><span class="pc">${r.rate===null?'-':r.rate+'%'}</span><small class="muted">${r.ok}/${r.done}명</small></div>
     <div class="qw cw-ans">${r.miss.length?`틀린 학생 <b>${r.miss.length}명</b>${showWrong?`: <span class="who">${r.miss.map(x=>`<span style="white-space:nowrap">${esc(x.n)} ${esc(x.name)}</span>`).join(', ')}</span>`:''}`:'<span class="muted">틀린 학생 없음</span>'}</div></div>`).join('')}</div></div>`;
}

/* ---------- route ---------- */
if(location.hash==='#watch'&&ROOM){$('#sub').textContent='학생 화면 보기 · 선생님 전용';ClassWatch.teacher({db,room:ROOM,solo:true});}
else if(location.hash==='#teacher')teacherView();
else if(ROOM)joinView();
else startView();
