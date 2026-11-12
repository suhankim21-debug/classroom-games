/* 생각 먼저 쓰기 (자기 생각을 쓰는 활동 공통)
   아이들이 생각하지 않고 보기·예시를 그대로 고르는 것을 막아요.
   - 처음에는 실마리가 잠겨 있어요. 먼저 스스로 써 보고, 정해 둔 시간(기본 40초)이 지나야 💡 실마리를 열 수 있어요.
   - 실마리는 두 단계: ① 생각을 여는 질문(베낄 글이 없음) → ② 빈칸(…)이 있는 문장 시작 틀. 완성된 답 예시는 주지 않아요.
   - 낸 글이 예시·보기·친구 글과 거의 같으면 "내 생각으로 바꿔 써요" 하고 다시 쓰게 해요 (ThinkFirst.copied).
   - 몇 단계 실마리를 썼는지 저장해서 선생님 화면에 보여 줘요 (ThinkFirst.tag / ThinkFirst.summary).
   - 주소에 ?tfwait=초 를 붙이면 기다리는 시간을 바꿔요(자동 테스트용).

   사용:
     const tf = ThinkFirst.mount(상자, {key:'방-번호-단계', wait:40,
       hints:['<질문 실마리 HTML>', '<시작 틀 HTML>'], onShow:(단계, 상자)=>{...버튼 연결...}});
     tf.level()  → 0(실마리 안 씀) · 1(질문 실마리) · 2(시작 틀)
     ThinkFirst.copied(글, [예시들], 0.6) → 너무 비슷한 예시 글(없으면 null)
*/
(function(){
  const css=`.tf{display:grid;gap:8px;word-break:keep-all;overflow-wrap:break-word}
.tf .tf-btn{justify-self:start;background:#FFF4DF;color:#5A3B00;border:2px dashed #E3B04B;border-radius:12px;padding:8px 14px;font:inherit;font-size:1rem;cursor:pointer}
.tf .tf-btn:disabled{opacity:.65;cursor:default}
.tf .tf-hint{background:#FFF9EC;border-left:6px solid #E3B04B;border-radius:10px;padding:8px 12px;line-height:1.5}
.tf .tf-hint ul{margin:4px 0 0;padding-left:20px}
.tf .tf-note{margin:0;color:#6B5B45;font-size:.95rem}`;
  const addCss=()=>{if(document.getElementById('tf-css'))return;const s=document.createElement('style');s.id='tf-css';s.textContent=css;document.head.appendChild(s);};
  const ss={get(k){try{return sessionStorage.getItem(k);}catch(e){return null;}},set(k,v){try{sessionStorage.setItem(k,v);}catch(e){}}};
  const WP=(()=>{const m=/[?&]tfwait=(\d+)/.exec(location.search+location.hash.replace("#","&"));return m?+m[1]:null;})();  // 처음 주소에서 읽어 둬요(들어간 뒤 주소가 바뀌어요)
  const waitParam=()=>WP;
  const LABEL=['','💡 질문 실마리','✏️ 시작 틀'];

  function mount(box,o){
    addCss();
    const key='tf:'+(o.key||'x'), hints=o.hints||[], wp=waitParam(), wait=wp!=null?wp:(o.wait??40);
    let start=+ss.get(key+':t')||0; if(!start){start=Date.now();ss.set(key+':t',String(start));}
    let lv=Math.min(+ss.get(key+':l')||0,hints.length);
    box.classList.add('tf');
    const draw=()=>{
      const left=Math.max(0,Math.ceil((start+wait*1000-Date.now())/1000));
      const shown=hints.slice(0,lv).map((h,i)=>`<div class="tf-hint" data-lv="${i+1}"><b>${LABEL[i+1]||'💡 실마리'}</b>${h}</div>`).join('');
      let btn='';
      if(lv<hints.length){
        const name=lv===0?'💡 막히면 실마리 보기':'✏️ 그래도 막히면 시작 틀 보기';
        btn=left>0?`<button type="button" class="tf-btn" disabled>${name} (${left}초 뒤 열려요)</button>`:`<button type="button" class="tf-btn">${name}</button>`;
      }
      box.innerHTML=(lv===0?`<p class="tf-note">🧠 먼저 내 생각으로 써 봐요. 정답은 없어요.</p>`:'')+shown+btn;
      const b=box.querySelector('.tf-btn:not([disabled])');
      if(b)b.onclick=()=>{lv++;ss.set(key+':l',String(lv));start=Date.now()-(Math.max(0,wait-15))*1000;ss.set(key+':t',String(start));draw();o.onLevel&&o.onLevel(lv);};
      for(let i=1;i<=lv;i++)o.onShow&&o.onShow(i,box.querySelector(`.tf-hint[data-lv="${i}"]`));
      return left;
    };
    let last=-1;
    const t=setInterval(()=>{if(!document.contains(box)){clearInterval(t);return;}
      const left=Math.max(0,Math.ceil((start+wait*1000-Date.now())/1000));
      if(left!==last&&lv<hints.length){last=left;draw();}},1000);
    draw();
    return {level:()=>lv};
  }

  const norm=s=>String(s||'').replace(/[\s.,!?？！~·…"'“”‘’()\-]/g,'');
  const grams=s=>{const g=new Map();for(let i=0;i<s.length-1;i++){const k=s.slice(i,i+2);g.set(k,(g.get(k)||0)+1);}return g;};
  function similar(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.length<2||b.length<2)return 0;
    const A=grams(a),B=grams(b);let m=0;A.forEach((v,k)=>{m+=Math.min(v,B.get(k)||0);});return 2*m/(a.length-1+b.length-1);}
  function copied(text,list,th){th=th??0.6;let best=null,bs=0;(list||[]).forEach(x=>{const s=similar(text,x);if(s>=th&&s>bs){bs=s;best=x;}});return best;}
  const tag=lv=>LABEL[lv||0]||'';
  function summary(levels){const c=[0,0,0];levels.forEach(l=>c[Math.min(2,l||0)]++);
    return `🧠 스스로 ${c[0]}명 · 💡 질문 실마리 ${c[1]}명 · ✏️ 시작 틀 ${c[2]}명`;}
  window.ThinkFirst={mount,similar,copied,tag,summary};
})();
