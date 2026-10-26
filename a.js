/* 안 a — 홍콩 여행 앱. A(3탭 + 도구 서랍) 기반, 여행 탭만 동선 지도 + 시트(C), 목록↔지도 연동.
   데이터는 hk-data.js(공유 상수), 순수 로직은 base2.html 에서 옮겨 왔다(주석에 원본 이름). */
(()=>{
'use strict';
const DAYS=TRIP_DAYS;
const $=id=>document.getElementById(id);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const BEH=()=>RM()?'instant':'smooth';
const svg=(d,sw=1.8,extra='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}><path d="${d}"/></svg>`;
const CHEV=svg('m9 5 7 7-7 7',2.4,' class="chev"');
const ICO={
 check:svg('M5 12l5 5L20 7',2.6),
 star:svg(paths.star,1.8),
 starSm:`<svg viewBox="0 0 24 24" aria-label="별" role="img"><path d="${paths.star}"/></svg>`,
 cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 10l5-2v8l-5-2"/></svg>',
 map:svg('M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14'),
 phone:svg('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'),
 play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>',
 plane:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
 arrive:svg('M5 12l5 5L20 7',2.4),
 cal:'<span class="kico" style="background:#ff9f0a"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg></span>'
};
const kicoBox=(c,inner)=>`<span class="kico" style="background:${c}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg></span>`;

/* ── 날짜·모드 (홍콩 시각, QA 훅 ?today= ?now=) ── */
const Q=new URLSearchParams(location.search);
const hkDate=()=>Q.get('today')||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong'}).format(new Date());
const hkMin=()=>{const q=Q.get('now');if(q){const [h,m]=q.split(':');return +h*60+(+m||0)}const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).split(':');return +h*60+ +m};
const nowMs=()=>Q.get('today')?Date.parse(`${Q.get('today')}T${(Q.get('now')||'09:00').padStart(5,'0')}:00+08:00`):Date.now();
const mode=()=>{const d=hkDate();return d<'2026-11-24'?'pre':d>'2026-11-28'?'post':'trip'};
const todayChip=()=>mode()==='trip'?String(+hkDate().slice(8)):null;

/* ── 견적 상태 S (base2 견적 스크립트) ── */
const S={dep:24,o:'UO12:25',day:28,r:null,pax:2,type:'all',area:'all',stay:null,ex:{},outAll:false,meal:{b:'cha',l:'noodle',d:'rest',snack:true}};
try{Object.assign(S,JSON.parse(localStorage.getItem('hk-quote-web3')||'{}'))}catch{}
S.day=28;S.r='16:40'; // 11/28(토) 16:40 귀국 확정 (2026-10-21 발권)
EXTRAS.forEach(e=>{if(!S.ex||typeof S.ex!=='object')S.ex={};if(!(e[0] in S.ex))S.ex[e[0]]=!!e[5]});S.meal={b:'cha',l:'noodle',d:'rest',snack:true,...(S.meal||{})};
if(![1,2].includes(S.pax))S.pax=2;
if(S.type!=='all'&&!TYPES.some(t=>t.k===S.type))S.type='all';
if(S.area!=='all'&&!AREAS.some(a=>a.k===S.area))S.area='all';
const stayById=id=>ST.find(s=>s[0]===id);
if(!S.stay||!stayById(S.stay))S.stay=ST.filter(s=>s[2]==='hotel').sort((a,b)=>a[6]-b[6])[0][0];
const mealPrice=k=>MEALS[k][1].find(o=>o[0]===S.meal[k])?.[2]??0;
const save=()=>{try{localStorage.setItem('hk-quote-web3',JSON.stringify(S))}catch{}};
const won=v=>v==null?'—':'₩'+Math.round(v).toLocaleString('ko-KR');
const man=v=>(Math.round(v/1000)/10).toLocaleString('ko-KR')+'만';
const N=4; // 숙소 4박(11/24 체크인 → 11/28 체크아웃), 원본 nightsOf(28,{d:'16:40'})
const BOOKING={perPerson:333500,pair:667000,discount:-6282,paid:660718,site:'트립닷컴',date:'10/21',fare:94700,tax:228800,fee:10000};
const RET={d:'16:40',a:'21:05',p:BOOKING.perPerson};
window.FWL=window.FWL||{28:BOOKING.perPerson,29:BOOKING.perPerson};
/* 원본 render() 의 밥값·합계 식만(순수) */
function quoteTotals(){
 const fd=EXTRAS.find(x=>x[0]==='food'),dd=mealPrice('b')+mealPrice('l')+mealPrice('d');
 fd[3]=Math.round((dd*N+(S.meal.snack?SNACK*(N+1):0))*HKD);fd[2]=`1인 · 끼니 하루 HK$${dd} × ${N}일치${S.meal.snack?` + 간식 HK$${SNACK} × ${N+1}일`:''} (첫날 저녁~마지막 날 점심)`;
 const sel=stayById(S.stay),air=RET.p*S.pax,stay=sel?sel[6]*N:0;let extra=0;
 EXTRAS.forEach(([k,,,u,per])=>{if(!S.ex[k]||per==='leg')return;extra+=u*S.pax*(per==='day'?N+1:1)});
 return {per:(air+stay+extra)/S.pax,total:air+stay+extra,air,stay,extra};
}

/* ── TripState (base2 그대로) ── */
window.TripState=(()=>{
 const key='hk-trip-state-v1';let memory=null;
 const rd=()=>{try{return JSON.parse(localStorage.getItem(key))||memory}catch{return memory}};
 return {get:()=>({...(rd()||{hotel:null}),returnDay:28}),
 set(value){memory=value;try{localStorage.setItem(key,JSON.stringify(value))}catch{}window.dispatchEvent(new Event('hk-trip-change'))}};
})();
window.publishTripFromQuote=()=>{const h=stayById(S.stay);const next={returnDay:28,hotel:h?{ko:h[0],en:h[12]||h[0],zh:'',addrZh:'',addrEn:'',lat:h[8],lng:h[9],area:h[1]}:null};if(JSON.stringify(next)!==JSON.stringify(TripState.get()))TripState.set(next)};
if(read('hk-trip-state-v1',null)==null&&S.stay)window.publishTripFromQuote();

/* ── 체크·별·메모·건너뛰기 ── */
let checks=read('hk-check',{}),favs=read('hk-fav',{}),notes=read('hk-note',{});
const merged=new Set(); // 옛 앱의 return-hotel·return-hkia-t2 → d4- 로 메모리에서만 합친 키
function mergeOld(){merged.clear();['hotel','hkia-t2'].forEach(k=>{if(checks['return-'+k]&&!checks['d4-'+k]){checks['d4-'+k]=true;merged.add('d4-'+k)}})}
mergeOld();
const checksOut=()=>{const o={...checks};merged.forEach(k=>delete o[k]);return o};
function saveChecks(){const o=checksOut();window.markSync?.('hk-check',o);return write('hk-check',o)}
function setCheck(id,val){checks[id]=val;merged.delete(id);const m=id.match(/^d4-(hotel|hkia-t2)$/);if(m)checks['return-'+m[1]]=val;saveChecks()}
const saveFavs=()=>{window.markSync?.('hk-fav',favs);return write('hk-fav',favs)};
const saveNotes=()=>{window.markSync?.('hk-note',notes);return write('hk-note',notes)};
let gchk=read('hk-a-gchk-v1',{});
const nextPin={};let lastArrive=null;

/* ── 일정 데이터 (base2 일정 IIFE) ── */
const DAYKEYS=['24','25','26','27','28'];
const LEGACY={24:'d1',25:'disney',26:'d2',27:'d3',28:'d4'};
const DATES=[['24','24 화','도착'],['25','25 수','디즈니'],['26','26 목','센트럴'],['27','27 금','구룡'],['28','28 토','귀국']];
let day=read('hk-trip-day-v1','24');if(day==='return')day='28';if(!DAYKEYS.includes(day))day='24';
if(todayChip())day=todayChip();
const directions=s=>'https://www.google.com/maps/dir/?api=1&travelmode=transit&destination='+encodeURIComponent([s[3]||s[4],s[5]||'',s[4]].join(' '));
const hotelStop=(time='숙소')=>{const h=TripState.get().hotel;return ['hotel',time,h?.ko||'숙소 미정',h?.zh||'',h?.en||'',h?.addrZh||h?.addrEn||'',h?.lat,h?.lng,'','']};
const airport=(time='14:10')=>['hkia-t2',time,'홍콩국제공항 T2 (체크인)','香港國際機場 二號客運大樓','HKIA Terminal 2','大嶼山赤鱲角',22.3168,113.9363,'홍콩익스프레스 U 구역 체크인·수하물 → T2 출국심사 → APM으로 탑승구 · UO626 16:40 출발',''];
function disney(){const home=hotelStop('08:30');home[8]=routes[TripState.get().hotel?.area]||'가까운 MTR → 퉁청선 → 써니베이';return [home,
 ['sunny','09:10쯤','써니베이역 환승','欣澳站','Sunny Bay Station','',22.3317,114.0290,'퉁청선 → 디즈니랜드 리조트선',''],
 ['disney-station','09:20쯤','디즈니랜드역','迪士尼站','Disneyland Resort Station','',22.3155,114.0452,'파크까지 걷기 · 게이트 대기',''],
 ['disney','10:00','홍콩 디즈니랜드','香港迪士尼樂園','Hong Kong Disneyland','大嶼山 香港迪士尼樂園',22.3130,114.0413,'겨울왕국부터. 오전은 광산열차·아이언맨·하이퍼스페이스 마운틴, 오후는 미스틱 매너. 대기시간은 앱에서 확인.',''],
 ['disney-show','저녁','모멘터스 야간쇼','迪士尼星夢光影之旅','Momentous, Hong Kong Disneyland','香港迪士尼樂園',22.3130,114.0413,'운영 10:00~20:30 · 야간쇼 시각은 당일 확인. 자리는 미리 잡기.','night'],
 ['disney-last','쇼 이후','디즈니랜드역 → 숙소','迪士尼站','Disneyland Resort Station','',22.3155,114.0452,'써니베이에서 시내 방향 환승. 기존 자료 막차 00:19~00:40 · 당일 역에서 확인.','']];}
function proc(title,steps,open){return `<details class="dcard"${open?' open':''}><summary><span>${esc(title)}</span>${CHEV}</summary><ol>${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></details>`}
/* 원본 buildDay — 28일은 토요일 귀국 고정 분기 + «시간 되면» 5곳(opt) */
function buildDay(k=day){let stops,title,legacy=LEGACY[k],steps='',opt=null;
 if(k==='24'){title='11/24(화) · 도착';const arrival=[...DAYS.d1.stops[0]];arrival[1]='15:30';const rail=[...DAYS.d1.stops[1]];rail[1]='입국 후';rail[8]='숙소 위치에 맞춰 공항철도·버스·택시 선택';if(['cen','cwb','np'].includes(TripState.get().hotel?.area)){rail[2]='공항철도 홍콩역';rail[3]='機場快綫 香港站';rail[4]='Airport Express Hong Kong Station';rail[5]='中環港景街1號';rail[6]=22.2849;rail[7]=114.1584}stops=[arrival,rail,hotelStop('체크인'),...DAYS.d1.stops.slice(2)];steps=DEPART.map((d,i)=>proc(d.t,i===4?d.steps.filter(s=>!s.includes('무료 셔틀')):d.steps)+(i===1?proc('6100 공항버스 · 07:17 ~ 08:32 차',BUS_OUT,true):'')).join('')}
 if(k==='25'){title='11/25(수) · 디즈니';stops=disney();steps=proc('챙길 것',['날짜 지정 티켓·파크 예약·QR 저장','외부 음식 반입 가능 · 작은 우산·겉옷','바퀴 달린 캐리어는 숙소에 맡기기'])+`<div class="card flush"><button type="button" class="lrow ico" data-open="disneySheet" aria-haspopup="dialog">${kicoBox('#ff9f0a',KSVG.star)}<span class="t"><b>디즈니 안내</b><small>티켓·가는 길·하루 예시·챙길 것</small></span>${CHEV}</button></div>`}
 if(k==='26'||k==='27'){title=k==='26'?'11/26(목) · 센트럴':'11/27(금) · 구룡';stops=DAYS[legacy].stops;steps=`<div class="card"><p style="font-size:.9375rem;line-height:1.55">${esc(DAYS[legacy].desc)}</p></div>`}
 if(k==='28'){title='11/28(토) · 귀국';const short=[...DAYS.d4.stops.find(x=>x[0]==='yick')];short[1]='09:00';short[8]+=' · 숙소(코즈웨이베이)에서 MTR 10분';stops=[short,hotelStop('11:00 · 짐 찾기'),airport()];opt=DAYS.d4.stops.filter(x=>x[0]!=='yick');steps=proc('귀국 준비',RETURN.map(s=>s==='공항 출발 2시간 30분 전'?'14:10 홍콩공항 도착':s),true)+proc('6100 공항버스 · 22:05 ~ 23:20(막차)',BUS_RET,true)}
 return {k,stops,title,legacy,steps,opt}}
let curD=buildDay();
function findStop(key){return key==='hotel'?hotelStop():curD.stops.find(s=>s[0]===key)||curD.opt?.find(s=>s[0]===key)||disney().find(s=>s[0]===key)||(key==='hkia-t2'?airport():null)||Object.values(DAYS).flatMap(d=>d.stops).find(s=>s[0]===key)}
const kmBetween=(a,b)=>{if(![a[6],a[7],b[6],b[7]].every(Number.isFinite))return null;const R=6371,r=x=>x*Math.PI/180,dl=r(b[6]-a[6]),dn=r(b[7]-a[7]);return 2*R*Math.asin(Math.sqrt(Math.sin(dl/2)**2+Math.cos(r(a[6]))*Math.cos(r(b[6]))*Math.sin(dn/2)**2))};
/* 원본 nextOf + «시간 되면» 지정 폴백 */
function nextOf(d){const L=d.legacy,sk=(read('hk-skip',{})[L])||[],left=d.stops.filter(x=>!checks[L+'-'+x[0]]),p=nextPin[L];
 return left.find(x=>x[0]===p)||(p&&!checks[L+'-'+p]&&d.opt?.find(x=>x[0]===p))||left.find(x=>!sk.includes(x[0]))||left[0]||null}
const kindOf=s=>{const k=s[0],n=s[2]||'';if(/^hkia/.test(k))return['plane','#0a84ff'];if(k==='hotel')return['bed','#bf5af2'];if(/ferry|페리/.test(k+n))return['boat','#30d158'];if(k==='kowloon'||/공항철도|역$|트램|MTR/.test(n))return['train','#40c8e0'];if(s[9]==='night')return['moon','#5e5ce6'];if(/disney/.test(k))return['star','#ff9f0a'];return['pin','#ff375f']};
const kIco=s=>{const [k,c]=kindOf(s);return kicoBox(c,KSVG[k])};
const legText=(a,b)=>{const km=a&&kmBetween(a,b);return km==null?'':km<1.3?`걸어서 ${Math.max(2,Math.round(km*17))}분`:km<15?'MTR·택시':`약 ${Math.round(km)}km`};
let hotelBooked=false;
const hotelBadge=()=>hotelBooked?'예약 완료':'후보 · 예약 전';
const AREA_EN={tst:'Tsim Sha Tsui, Kowloon',cen:'Central / Sheung Wan, Hong Kong Island',cwb:'Causeway Bay / Wan Chai, Hong Kong Island',np:'North Point, Hong Kong Island',mk:'Mong Kok / Yau Ma Tei, Kowloon'};
const TALK_CTX={hkia:'공항 도착 · 입국',kowloon:'MTR · 옥토퍼스',sunny:'MTR · 옥토퍼스','disney-station':'MTR · 옥토퍼스','disney-last':'MTR · 옥토퍼스',hotel:'호텔',disney:'디즈니','disney-show':'디즈니',lfy:'식당 · 차찬텡',adc:'식당 · 차찬텡',bakehouse:'식당 · 차찬텡',bubba:'식당 · 차찬텡',duck:'식당 · 차찬텡',lkf:'식당 · 차찬텡',sim:'쇼핑 · 결제',apliu:'쇼핑 · 결제',mk:'쇼핑 · 결제','hkia-t2':'귀국'};
const BUCKET={'지금':'지금','출발 1주 전':'이번 주','날짜 확정 후':'이번 주','출발 2~3일 전':'출발 직전','출발 2~3일 전 설치':'출발 직전','출발 전':'출발 직전','출발 전 확인':'출발 직전'};
const TILE='https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/* ══ 여행 탭: 지도 + 시트 ══════════════════════════════ */
const sheet=$('sheet'),sp1=sheet.querySelector('.sp1'),sp2=sheet.querySelector('.sp2'),sbody=sheet.querySelector('.sbody'),slist=$('tripDay');
const wide=()=>matchMedia('(min-width:900px)').matches;
const probe=document.createElement('div');probe.style.cssText='position:fixed;top:0;height:env(safe-area-inset-top,0px);width:0;visibility:hidden;pointer-events:none';document.body.append(probe);
const safeTop=()=>probe.offsetHeight;
const dockH=()=>{const r=document.querySelector('.dock').getBoundingClientRect();return innerHeight-r.top+8};
const detTop=()=>({peek:0,half:sp1.offsetHeight,full:Math.max(sp1.offsetHeight,sp1.offsetHeight+sp2.offsetHeight-(safeTop()+56))});
const bodyTopFor=n=>wide()?0:sp1.offsetHeight+sp2.offsetHeight-detTop()[n];
function curDetent(){if(wide())return 'wide';const t=sheet.scrollTop,D=detTop();if(t>=D.full-24)return 'full';if(Math.abs(t-D.half)<=24)return 'half';if(t<D.half/2)return 'peek';return t-D.half<D.full-t?'half':'full'}
/* 반 단 본문 위 끝 --half: 화면 크기마다 한 값(날짜·도착·건너뛰기로 안 바뀜 → 날짜 캡슐·지도 자리 고정).
   min(50dvh, 탭바 위 8px − 카드 몫 HALF_CARD), 아래 한계 = 날짜 캡슐+지도 160. 맨 위 다음 갈 곳 카드가 그 몫을 넘으면 .tight(사진 숨김 — 배지는 글 위로, 확인할 것 한 줄로 접기). 바뀌었으면 true */
const HALF_CARD=370;
function fitHalf(){const c=$('nextCard'),f=c?.querySelector('.gfold');if(c){c.classList.remove('tight');if(f)f.open=true}if(wide())return false;
 const dockTop=innerHeight-dockH()+8,T=Math.round(Math.max(safeTop()+56+160,Math.min(innerHeight/2,dockTop-8-HALF_CARD))),a=c?.querySelector('.acts');
 if(a&&slist.offsetParent&&c===slist.firstElementChild&&a.getBoundingClientRect().bottom-slist.getBoundingClientRect().top+slist.scrollTop+slist.offsetTop>dockTop-8-T){c.classList.add('tight');if(f)f.open=false}
 if(sheet.style.getPropertyValue('--half')===T+'px')return false;
 sheet.style.setProperty('--half',T+'px');if(sheet.dataset.detent==='half')sheet.scrollTo({top:sp1.offsetHeight,behavior:'instant'});return true}
/* 반·접힘에선 목록을 손으로 못 내리므로, 선택이 없으면 맨 위(다음 갈 곳)로 되돌린다 */
function updatePad(n){if(n==='wide'){slist.style.paddingBottom='';return}const hidden=Math.max(0,bodyTopFor(n)+sbody.offsetHeight-innerHeight);slist.style.paddingBottom=(hidden+dockH()+16)+'px'}
function setDetent(n,instant){if(wide())return;updatePad(n);sheet.dataset.detent=n;sheet.scrollTo({top:detTop()[n],behavior:instant?'instant':BEH()});$('grabber').setAttribute('aria-label',n==='full'?'목록 작게 보기':'목록 크게 보기')}
{let tm=null;sheet.addEventListener('scroll',()=>{clearTimeout(tm);tm=setTimeout(()=>{const n=curDetent();if(sheet.dataset.detent!==n){sheet.dataset.detent=n;updatePad(n);$('grabber').setAttribute('aria-label',n==='full'?'목록 작게 보기':'목록 크게 보기')}},140)},{passive:true})}
{const g=sbody.querySelector('.grab');let y0=0,t0=0,top0=0,drag=false,moved=false,last=[];
 g.addEventListener('pointerdown',e=>{if(wide())return;drag=true;moved=false;y0=e.clientY;top0=sheet.scrollTop;last=[[e.clientY,e.timeStamp]];g.setPointerCapture(e.pointerId)});
 g.addEventListener('pointermove',e=>{if(!drag)return;const dy=y0-e.clientY;if(Math.abs(dy)>6)moved=true;if(!moved)return;const D=detTop();sheet.scrollTop=Math.max(D.peek,Math.min(D.full,top0+dy));last.push([e.clientY,e.timeStamp]);if(last.length>5)last.shift()});
 const end=e=>{if(!drag)return;drag=false;if(!moved)return;const [a,b]=[last[0],last[last.length-1]],v=b&&a&&b[1]>a[1]?(a[0]-b[0])/(b[1]-a[1]):0,D=detTop(),t=sheet.scrollTop+v*180;
  const n=Object.entries({peek:D.peek,half:D.half,full:D.full}).sort((x,y)=>Math.abs(x[1]-t)-Math.abs(y[1]-t))[0][0];setDetent(n)};
 g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
 $('grabber').addEventListener('click',e=>{if(moved){moved=false;return}const n=curDetent();setDetent(n==='peek'?'half':n==='half'?'full':'half')})}

/* 지도 */
let tmap=null,pinLayer=null,optLayer=null,markers={},tileErr=0,meMarker=null,lastPts=[];
function mapOffline(){$('mapOff').hidden=false;if(!wide()&&curDetent()!=='full')setDetent('full')}
function initTripMap(){if(tmap)return true;if(!window.L){mapOffline();return false}
 tmap=L.map('map',{zoomControl:false,attributionControl:false,tap:true}).setView([22.30,114.17],12);
 const tl=L.tileLayer(TILE,{maxZoom:19}).addTo(tmap);
 tl.on('tileerror',()=>{if(++tileErr>=3)mapOffline()});tl.on('tileload',()=>{if(tileErr){tileErr=0;$('mapOff').hidden=true}});
 pinLayer=L.layerGroup().addTo(tmap);optLayer=L.layerGroup();
 tmap.on('click',()=>{if(selKey)select(null)});tmap.on('zoomend',spreadPins);
 addEventListener('resize',()=>{tmap.invalidateSize();if(fitHalf()&&!selKey)fitAll()});
 return true}
function mapPad(n){const H=innerHeight;if(wide())return {paddingTopLeft:[48,84],paddingBottomRight:[48,96]};return {paddingTopLeft:[40,safeTop()+12],paddingBottomRight:[40,H-bodyTopFor(n)+56+8]}}
const pinHtml=(cls,txt)=>`<div class="mpin ${cls}">${txt}</div>`;
function pinIcon(s,i,isOpt,nx){const id=curD.legacy+'-'+s[0];const cls=[isOpt?'opt':'',nx&&nx[0]===s[0]?'next':'',checks[id]?'done':'',favs[s[0]]?'fav':'',selKey===s[0]?'sel':''].join(' ');
 return L.divIcon({className:'',iconSize:[28,28],iconAnchor:[14,14],html:pinHtml(cls,isOpt?'+':i+1)})}
function drawPins(fit){if(!tmap)return;pinLayer.clearLayers();optLayer.clearLayers();markers={};const d=curD,nx=nextOf(d),pts=[];let prev=null;
 d.stops.forEach((s,i)=>{if(!Number.isFinite(s[6])||!Number.isFinite(s[7]))return;const ll=[s[6],s[7]];pts.push(ll);
  if(prev){const km=kmBetween(prev,s);L.polyline([[prev[6],prev[7]],ll],{color:getComputedStyle(document.documentElement).getPropertyValue('--blue').trim()||'#007aff',weight:km<1.3?2.5:2.5,opacity:.9,dashArray:km<1.3?null:'6 8',interactive:false}).addTo(pinLayer)}prev=s;
  addMarker(s,i,false,nx,pinLayer)});
 (d.opt||[]).forEach(s=>{if(Number.isFinite(s[6]))addMarker(s,0,true,nx,optLayer)});
 if($('optFold')?.open)optLayer.addTo(tmap);
 lastPts=pts;if(fit)fitAll();spreadPins()}
function addMarker(s,i,isOpt,nx,layer){const m=L.marker([s[6],s[7]],{icon:pinIcon(s,i,isOpt,nx),keyboard:false,zIndexOffset:nx&&nx[0]===s[0]?500:0,riseOnHover:true}).addTo(layer);
 m.on('click',e=>{L.DomEvent.stopPropagation(e);select(s[0],{from:'pin'})});
 m.on('contextmenu',e=>{L.DomEvent.preventDefault(e.originalEvent||e);setNext(s[0])});
 m._hk={s,i,isOpt};markers[s[0]]=m}
function refreshPins(){const nx=nextOf(curD);Object.values(markers).forEach(m=>{m.setIcon(pinIcon(m._hk.s,m._hk.i,m._hk.isOpt,nx));m.setZIndexOffset(selKey===m._hk.s[0]?800:nx&&nx[0]===m._hk.s[0]?500:0)});spreadPins()}
/* 화면에서 맞닿은 핀(중심 거리 < 두 반지름+2)을 무리로 묶는다 — 동선 순서대로 앞 핀(씨앗)과 맞닿은 핀만 그 무리에(사슬처럼 번지지 않게).
   무리는 가운데를 중심으로 원형으로 펼치되(좌표는 그대로, 아이콘만 CSS translate), 실제 자리에서 SPREAD_MAX 넘게 밀리면 «1–6» 묶음 하나로.
   펼친 결과끼리 또 맞닿으면 두 무리를 합쳐 다시 잰다. 선택 핀은 묶음에 넣지 않고 제자리. 묶음을 누르면 그 무리로 확대.
   반지름은 보이는 크기대로: 기본 14 · 다음 17 · «+» 11, 선택은 ×1.15 + 고리 5. 줌·선택이 바뀔 때마다 다시 잼 */
const SPREAD_MAX=30;let grpLayer=null;
const grpLabel=mem=>{const n=mem.filter(m=>!m._hk.isOpt).map(m=>m._hk.i+1).sort((a,b)=>a-b),out=[];if(!n.length)return '+'+mem.length;
 for(let j=0;j<n.length;){let k=j;while(n[k+1]===n[k]+1)k++;out.push(k>j+1?n[j]+'–'+n[k]:n.slice(j,k+1).join('·'));j=k+1}return out.join('·')+(n.length<mem.length?' +':'')};
function spreadPins(){if(!tmap)return;grpLayer=grpLayer||L.layerGroup().addTo(tmap);grpLayer.clearLayers();
 const ms=Object.values(markers).filter(m=>m._icon&&tmap.hasLayer(m)).sort((a,b)=>a._hk.isOpt-b._hk.isOpt||a._hk.i-b._hk.i);ms.forEach(m=>m._icon.style.display='');
 const P=ms.map(m=>tmap.latLngToLayerPoint(m.getLatLng()));
 const R=ms.map(m=>{const c=m._icon.firstElementChild.classList,b=c.contains('opt')?11:c.contains('next')?17:14;return c.contains('sel')?b*1.15+5:b});
 const isSel=i=>ms[i]._hk.s[0]===selKey;
 let C=[];ms.forEach((_,i)=>{const c=C.find(c=>P[c[0]].distanceTo(P[i])<R[c[0]]+R[i]+2);c?c.push(i):C.push([i])});
 // 무리 하나를 놓는다: 원(밀림 ≤ SPREAD_MAX) 또는 묶음 → 놓인 원들 [{x,y,r,i?}]
 const place=c=>{c=[...c].sort((a,b)=>a-b);if(c.length<2)return {c,dots:[{p:P[c[0]],r:R[c[0]],i:c[0]}]};const cx=c.reduce((a,i)=>a+P[i].x,0)/c.length,cy=c.reduce((a,i)=>a+P[i].y,0)/c.length,w=2*Math.max(...c.map(i=>R[i]))+2,r=w/(2*Math.sin(Math.PI/c.length));
  const dots=c.map((i,n)=>{const t=-Math.PI/2+2*Math.PI*n/c.length;return {p:L.point(cx+r*Math.cos(t),cy+r*Math.sin(t)),r:R[i],i}});
  if(Math.max(...dots.map(d=>Math.round(d.p.distanceTo(P[d.i]))))<=SPREAD_MAX)return {c,dots};
  const mem=c.filter(i=>!isSel(i));if(mem.length<2)return {c,dots};const lab=grpLabel(mem.map(i=>ms[i])),gx=mem.reduce((a,i)=>a+P[i].x,0)/mem.length,gy=mem.reduce((a,i)=>a+P[i].y,0)/mem.length;
  return {c,mem,grp:lab,dots:[{p:L.point(gx,gy),r:14,w:Math.max(14,lab.length*3.5+10)},...c.filter(isSel).map(i=>({p:P[i],r:R[i],i}))]}};
 // 맞닿음: 핀은 원, 묶음은 가로로 긴 알약(반폭 w·반높이 14)이라 상자로 잰다
 const hitDot=(x,y)=>x.w||y.w?Math.abs(x.p.x-y.p.x)<(x.w||x.r)+(y.w||y.r)+2&&Math.abs(x.p.y-y.p.y)<x.r+y.r+2:x.p.distanceTo(y.p)<x.r+y.r+2;
 let S=C.map(place);
 for(let k=0;k<6;k++){let hit=null;for(let a=0;a<S.length&&!hit;a++)for(let b=a+1;b<S.length&&!hit;b++)if(S[a].dots.some(x=>S[b].dots.some(y=>hitDot(x,y))))hit=[a,b];
  if(!hit)break;const m=place([...S[hit[0]].c,...S[hit[1]].c]);S=S.filter((_,j)=>j!==hit[0]&&j!==hit[1]);S.push(m)}
 const D=P.map(p=>p.clone());
 S.forEach(g=>{g.dots.forEach(d=>{if(d.i!=null)D[d.i]=d.p});if(!g.grp)return;
  const mem=g.mem.map(i=>ms[i]),ll=tmap.layerPointToLatLng(g.dots[0].p);mem.forEach(m=>m._icon.style.display='none');
  L.marker(ll,{icon:L.divIcon({className:'',iconSize:null,html:`<div class="mgrp${mem.some(m=>m._icon.firstElementChild.classList.contains('next'))?' next':''}" role="button" aria-label="${mem.length}곳 묶음 · 누르면 확대">${g.grp}</div>`}),keyboard:false,zIndexOffset:400}).addTo(grpLayer)
   .on('click',e=>{L.DomEvent.stopPropagation(e);const z0=tmap.getZoom();tmap.fitBounds(mem.map(m=>m.getLatLng()),{...mapPad(curDetent()),maxZoom:18,animate:false});if(tmap.getZoom()<=z0)tmap.setZoomAround(ll,z0+1,{animate:false})})});
 ms.forEach((m,i)=>{const dx=Math.round(D[i].x-P[i].x),dy=Math.round(D[i].y-P[i].y);m._icon.style.translate=dx||dy?`${dx}px ${dy}px`:''})}
function fitAll(n=curDetent()){if(!tmap||!lastPts.length)return;tmap.invalidateSize();if(lastPts.length===1)tmap.setView(lastPts[0],15,{animate:false});else tmap.fitBounds(lastPts,{...mapPad(n==='wide'?'wide':n),maxZoom:16,animate:false})}
function flyToStop(s,n){if(!tmap)return;const z=Math.max(tmap.getZoom(),16),sz=tmap.getSize();const top=wide()?60:0,bottom=wide()?sz.y:bodyTopFor(n);const targetY=(top+bottom)/2;const p=tmap.project([s[6],s[7]],z);const c=tmap.unproject(p.add([0,sz.y/2-targetY]),z);if(RM())tmap.setView(c,z,{animate:false});else tmap.flyTo(c,z,{duration:.45})}
function panToStop(s,n){if(!tmap)return;tmap.panInside([s[6],s[7]],{...mapPad(n),animate:!RM()})}
$('fitBtn').onclick=()=>fitAll();
$('locBtn').onclick=()=>{if(!navigator.geolocation||!tmap)return toast('위치를 가져올 수 없어요');navigator.geolocation.getCurrentPosition(p=>{const ll=[p.coords.latitude,p.coords.longitude];if(meMarker)meMarker.remove();meMarker=L.layerGroup([L.circle(ll,{radius:p.coords.accuracy,weight:0,fillOpacity:.12}),L.marker(ll,{icon:L.divIcon({className:'',iconSize:[16,16],html:'<div class="me-dot"></div>'}),keyboard:false,interactive:false})]).addTo(tmap);tmap.panInside(ll,mapPad(curDetent()))},()=>toast('위치를 가져올 수 없어요'),{timeout:8000})};
let toastT=null;function toast(t){let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast glass';el.setAttribute('role','status');document.body.append(el)}el.textContent=t;el.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(()=>el.style.opacity=0,2000)}

/* 날짜 캡슐 */
function renderDates(){const t=todayChip();$('dates').innerHTML=DATES.map(([k,lab,sub])=>`<button type="button" role="tab" id="date-${k}" data-day="${k}" class="${k===t?'today':''}" aria-selected="${k===day}" tabindex="${k===day?0:-1}" aria-controls="tripDay" aria-label="${lab} ${sub}${k===t?' · 오늘':''}">${k}</button>`).join('')}
$('dates').addEventListener('click',e=>{const b=e.target.closest('[data-day]');if(b)setDay(b.dataset.day)});
$('dates').addEventListener('keydown',e=>{const i=DAYKEYS.indexOf(day);const n=e.key==='ArrowRight'?(i+1)%5:e.key==='ArrowLeft'?(i+4)%5:e.key==='Home'?0:e.key==='End'?4:null;if(n==null)return;e.preventDefault();setDay(DAYKEYS[n]);$('date-'+DAYKEYS[n]).focus()});
function setDay(k){if(!DAYKEYS.includes(k))return;day=k;write('hk-trip-day-v1',k);selKey=null;renderTrip({fit:true});slist.scrollTo({top:0,behavior:'instant'})}

/* 카드·행 마크업 */
const gchkId=(L,k)=>L+'-'+k;
function gchkList(L,key,list){const on=gchk[gchkId(L,key)]||[];return `<ul class="gchk">${list.map((c,i)=>`<li><button type="button" data-gchk="${gchkId(L,key)}:${i}" aria-pressed="${on.includes(i)}"><span class="chk">${ICO.check}</span><span>${esc(c)}</span></button></li>`).join('')}</ul>`}
const goHtml=t=>esc(t).replace(/\([^)]{1,12}\)/g,m=>`<span class="nw">${m}</span>`);
const appLinks=g=>(g.apps||[]).map(([l,u])=>` <a href="${u}" target="_blank" rel="noopener">${LINK_ICON}${esc(l)}</a>`).join('');
const viewTail=key=>VIEW[key]?`<span> · 날씨캠 «${esc(VIEW[key])}» 화면 · 안개면 일정 변경</span>`:'';
function actsRow(s,L,tail=''){const k=s[0],ko=s[2];return `<div class="acts"><a class="act" href="${directions(s)}" target="_blank" rel="noopener">${ACT_GO}<span>길찾기</span></a>${VIEW[k]&&!tail?`<a class="act" href="${HKO_CAM}" target="_blank" rel="noopener" aria-label="기상청 실시간 카메라 · ${esc(VIEW[k])} 화면">${ICO.cam}<span>날씨캠</span></a>`:''}<button type="button" class="act" data-trip-taxi="${k}">${ACT_TAXI}<span>택시</span></button><button type="button" class="act" data-trip-note="${k}" aria-expanded="${!!notes[k]}" aria-controls="note-${L}-${k}">${ACT_MEMO}<span>메모</span></button>${TIP_AT[k]?`<button type="button" class="act" data-ig-title="${esc(ko)}" data-tip-list="${TIP_AT[k].join('|')}" aria-label="관련 꿀팁 ${TIP_AT[k].length}개">${TIP_ICON}<span>꿀팁 <b>${TIP_AT[k].length}</b></span></button>`:''}${IG_AT[k]?`<button type="button" class="act" data-ig-title="${esc(ko)}" data-ig-list="${IG_AT[k].join(',')}" aria-label="관련 인스타 ${IG_AT[k].length}개">${IG_ICON}<span>인스타 <b>${IG_AT[k].length}</b></span></button>`:''}${tail}</div><label class="note-w" id="note-${L}-${k}" ${notes[k]?'':'hidden'}><span class="sr">${esc(ko)} 메모</span><textarea data-note-input="${k}" placeholder="메모">${esc(notes[k]||'')}</textarea><span aria-live="polite"></span></label>`}
function nextCard(d,nx){
 if(!nx)return `<section class="card next end" id="nextCard" aria-label="다음 갈 곳"><div class="in"><h3>오늘 일정 끝 · 수고했어요</h3><p class="muted" style="font-size:.875rem;margin-top:4px">내일 일정은 위 날짜에서</p></div></section>`;
 const s=nx,L=d.legacy,inList=d.stops.includes(s),i=d.stops.indexOf(s),g=GUIDE[s[0]]||{};
 let prev=null;if(inList)prev=i>0?d.stops[i-1]:null;else{const done=d.stops.filter(x=>checks[L+'-'+x[0]]);prev=done[done.length-1]||d.stops.find(x=>x[0]==='hotel')||null}
 const km=prev&&kmBetween(prev,s);
 const go=g.go||(km!=null?`${prev[2]}에서 약 ${km<1?Math.round(km*1000)+'m':km.toFixed(1)+'km'} · ${km<1.3?'걸어서 '+Math.max(2,Math.round(km*17))+'분 안팎':'MTR·택시 권장'}`:'');
 const tm=s[1]&&/\d/.test(s[1])?s[1]:'';
 const badge=inList?`다음 갈 곳 · ${i+1} / ${d.stops.length}${s[1]?' · '+s[1]:''}`:`시간 되면${tm?' · '+tm:''}`;
 const ph=PHOTO[s[0]];const hotelNull=s[0]==='hotel'&&!TripState.get().hotel;
 const addr=[s[5],s[4]].filter(Boolean).join(' · ');
 const cam=VIEW[s[0]]&&!(g.apps||[]).some(a=>a[1]===HKO_CAM)?` <a href="${HKO_CAM}" target="_blank" rel="noopener">${LINK_ICON}날씨캠</a>`:'';
 const memo=!g.check&&(s[8]||VIEW[s[0]])?`<p class="memo"><span class="b">${esc(s[8])}</span>${viewTail(s[0])}${go?'':appLinks(g)}${cam}</p>`:'';
 return `<section class="card next" id="nextCard" data-key="${s[0]}" aria-label="다음 갈 곳">${ph?`<div class="ph"><img src="img/area/${ph}.jpg" alt="" loading="lazy" onerror="this.remove()"><span class="bdg">${esc(badge.replace('다음 갈 곳 · ',''))}</span></div>`:''}<div class="in"><span class="bdg">${esc(badge)}</span><h3>${esc(s[2])}${s[0]==='hotel'&&!hotelNull?` <span class="badge" style="vertical-align:4px">${hotelBadge()}</span>`:''}</h3>${s[3]?`<p class="zh">${esc(s[3])}</p>`:''}${addr?`<p class="ad">${esc(addr)}</p>`:''}${go?`<div class="go">${goHtml(go)}${appLinks(g)}</div>`:''}${g.check?`<details class="gfold" open><summary>확인할 것 ${g.check.length}${CHEV}</summary>${gchkList(L,s[0],g.check)}</details>`:''}${memo}${hotelNull?`<button type="button" class="primary" style="margin-top:10px" data-open-pick>숙소 고르기</button>`:''}</div>${actsRow(s,L,`<button type="button" class="act sub" data-guide-skip="${s[0]}">${SKIP_ICON}<span>건너뛰기</span></button><button type="button" class="act main" data-guide-done="${L}-${s[0]}"><i>${ICO.arrive}</i><span>도착</span></button>`)}</section>`}
function xpHtml(s,L){const k=s[0],id=L+'-'+k,g=GUIDE[k]||{},hotelNull=k==='hotel'&&!TripState.get().hotel;
 const zhLine=k==='hotel'?(hotelNull?'':`<b>${esc(s[4]||s[2])}</b><small>${esc(AREA_EN[TripState.get().hotel?.area]||'')} · 중문 주소 없음</small>`):`${s[3]?`<b>${esc(s[3])}</b>`:''}${s[5]||s[4]?`<small>${esc([s[5],s[4]].filter(Boolean).join(' · '))}</small>`:''}`;
 return `<div class="top"><div class="zh">${zhLine}</div><button type="button" class="ibtn fav" data-trip-fav="${k}" aria-pressed="${!!favs[k]}" aria-label="${esc(s[2])} 별">${ICO.star}</button><button type="button" class="ibtn done" data-trip-check="${id}" aria-pressed="${!!checks[id]}" aria-label="${esc(s[2])} 완료"><span class="chk">${ICO.check}</span></button></div>${g.go?`<div class="go">${goHtml(g.go)}${appLinks(g)}</div>`:''}${g.check?`<details class="gfold" open><summary>확인할 것 ${g.check.length}${CHEV}</summary>${gchkList(L,k,g.check)}</details>`:''}${s[8]||VIEW[k]?`<p class="memo">${esc(s[8])}${viewTail(k)}${g.go?'':appLinks(g)}</p>`:''}${hotelNull?`<button type="button" class="primary pick" data-open-pick>숙소 고르기</button>`:''}${actsRow(s,L)}`}
function stopRow(s,i,d,o){const L=d.legacy,k=s[0],id=L+'-'+k,done=!!checks[id],sk=((read('hk-skip',{})[L])||[]).includes(k);
 const [tm,tmx]=String(s[1]||'').split(/\s*·\s*/);const hasLL=Number.isFinite(s[6])&&Number.isFinite(s[7]);
 let sub;if(o.now)sub='다음 갈 곳';else if(k==='hotel')sub=TripState.get().hotel?[hotelBadge(),o.after?legText(o.prev,s):''].filter(Boolean).join(' · '):'숙소 미정';else if(o.after)sub=legText(o.prev,s)||s[4];else sub=[TAGNM[s[9]],s[4]].filter(Boolean).join(' · ');
 if(d.k==='25'&&k==='hotel'&&!o.now)sub=[sub,routes[TripState.get().hotel?.area]].filter(Boolean).join(' · ');
 sub=[tmx,sub,sk&&!done?'건너뜀':'',!hasLL?'지도 위치 없음':''].filter(Boolean).join(' · ');
 return `<div class="stopx${done?' done':''}${o.now?' now':''}${o.opt?' opt':''}" data-key="${k}" ${o.opt?`data-opt="${k}"`:`data-i="${i}"`}><button type="button" class="row" ${o.nx?'aria-controls="nextCard"':`aria-expanded="false" aria-controls="xp-${k}"`}><span class="no" aria-hidden="true">${o.opt?'+':i+1}</span><span class="t"><b>${esc(s[2])}${favs[k]?ICO.starSm:''}</b><small>${esc(sub)}</small></span><time>${esc(tm||'')}</time></button>${o.nx?'':`<div class="xp" id="xp-${k}" hidden>${xpHtml(s,L)}</div>`}</div>`}
function dayCard(d,nx){const L=d.legacy,inList=nx&&d.stops.includes(nx),ni=inList?d.stops.indexOf(nx):-1;let after=0;const done=[],open=[];
 d.stops.forEach((s,i)=>{const isDone=!!checks[L+'-'+s[0]];const now=i===ni;let aft=false;if(!isDone&&ni>-1&&i>ni&&after<3){aft=true;after++}else if(!isDone&&!inList&&nx&&after<3){aft=true;after++}
  (isDone?done:open).push(stopRow(s,i,d,{now,nx:nx===s,after:aft,prev:d.stops[i-1]}))});
 const t=todayChip()===d.k;
 return `<section class="card day" id="dayCard" aria-label="${t?'오늘':'하루'} 일정"><div class="dhead">${ICO.cal}<span>${t?'오늘 일정':'하루 일정'}</span><span class="r">${esc(d.title)}</span></div>${done.length?`<details class="dfold" id="doneFold"><summary>완료 ${done.length} ${CHEV}</summary>${done.join('')}</details>`:''}${open.join('')}${d.opt?`<details class="optf" id="optFold"><summary><span class="no" aria-hidden="true">+</span><b>시간 되면 · ${d.opt.length}곳</b><span class="muted">원래 후보</span>${CHEV}</summary>${d.opt.map(s=>stopRow(s,0,d,{opt:true,nx:nx===s})).join('')}</details>`:''}</section>`}
const daysTo=ymd=>Math.round((Date.parse(ymd+'T00:00:00+08:00')-Date.parse(hkDate()+'T00:00:00+08:00'))/864e5);
function countdown(iso){const ms=Date.parse(iso)-nowMs();if(ms<=0)return '';if(ms>=864e5)return `출발까지 ${daysTo(iso.slice(0,10))}일`;return `출발까지 ${Math.floor(ms/36e5)}시간 ${Math.floor(ms%36e5/6e4)}분`}
function flightCard(k){const f=FLIGHTS[k],iso=k==='24'?'2026-11-24T12:25:00+09:00':'2026-11-28T16:40:00+08:00';
 return `<section class="card flight" aria-label="항공편 ${esc(f[4])}"><div class="ft"><span>${f[0]}</span><span>${esc(f[4])}</span><span>${f[2]}</span></div><div class="fm"><b>${f[1]}</b><span class="fl">${ICO.plane}</span><b>${f[3]}</b></div><div class="fb"><span><b>${f[5]}</b> ${f[6]}</span><span>${f[9]}</span><span><b>${f[7]}</b> ${f[8]}</span></div><div class="fz"><button type="button" data-tools="docs">탑승권 · e티켓 ›</button><span class="cd" data-iso="${iso}">${countdown(iso)}</span></div></section>`}
setInterval(()=>document.querySelectorAll('.cd[data-iso]').forEach(el=>el.textContent=countdown(el.dataset.iso)),60000);

/* 시트 내용 — 순서: 다음 갈 곳 → 하루 일정 → 항공(24·28) → 알아둘 것. 24일 도착 전(출발 전 포함)엔 항공 카드가 맨 위 */
function renderTrip({fit=false,keep=true}={}){
 curD=buildDay();const d=curD,nx=nextOf(d),st=slist.scrollTop;
 renderDates();
 const flightFirst=d.k==='24'&&(mode()==='pre'||(todayChip()==='24'&&!checks['d1-hkia']&&hkMin()<930));
 const fl=(d.k==='24'||d.k==='28')?flightCard(d.k==='24'?'24':'return'):'';
 const notes_=d.steps?`<div class="sec"><h2>알아둘 것</h2></div>${d.steps}`:'';
 slist.innerHTML=(flightFirst?fl+nextCard(d,nx)+dayCard(d,nx):nextCard(d,nx)+dayCard(d,nx)+fl)+notes_;
 slist.setAttribute('aria-labelledby','date-'+day);
 if(keep)slist.scrollTop=st;
 fitHalf();drawPins(fit);applySel();
}

/* ── 목록 ↔ 지도 연동: 선택 상태는 selKey 하나 ── */
let selKey=null,selExpand=true;
const rowOf=k=>slist.querySelector(`.stopx[data-key="${CSS.escape(k)}"]`);
function applySel(){const nx=nextOf(curD);
 slist.querySelectorAll('.stopx').forEach(x=>{const ex=x.dataset.key===selKey&&selExpand,xp=x.querySelector('.xp');x.classList.toggle('sel',ex);if(!ex&&x.classList.contains('tight')){x.classList.remove('tight');const f=x.querySelector('.gfold');if(f)f.open=true}if(xp){x.querySelector('.row').setAttribute('aria-expanded',String(ex));xp.hidden=!ex}});
 $('nextCard')?.classList.toggle('ring',!!selKey&&nx?.[0]===selKey&&!selExpand);
 const r=selKey&&rowOf(selKey);if(r){const f=r.closest('details');if(f&&!f.open){f.open=true;if(f.id==='optFold'&&tmap)optLayer.addTo(tmap)}}
 refreshPins()}
/* 고른 항목을 목록에 맞춘다: 머리는 보이는 영역 위 1/3 자리, 단 펼친 칸 줄(.acts)까지 탭바 위 8px 안에 들어오게 올리되 목록 위 끝보다는 안 올림.
   그래도 넘치면 펼친 행에 .tight(확인할 것 한 줄로 접기, 반·접힘 단에서 메모·주소 한 줄) */
function scrollListTo(el,n){if(!el)return;const vis=wide()?slist.clientHeight:innerHeight-bodyTopFor(n)-22-dockH(),top=el.getBoundingClientRect().top,y=top-slist.getBoundingClientRect().top+slist.scrollTop;
 const a=[...el.querySelectorAll('.acts')].filter(x=>x.offsetParent).pop(),bh=()=>(a||el).getBoundingClientRect().bottom-top;let h=bh();
 if(!wide()&&el.classList.contains('stopx')&&h>vis-8){el.classList.add('tight');const f=el.querySelector('.gfold');if(f)f.open=false;h=bh()} // 반 단에서 넘치면 메모·주소를 줄임(전체 단에선 다 보임)
 slist.scrollTo({top:Math.max(0,y-Math.max(0,Math.min(vis/3,vis-h))),behavior:BEH()})}
function select(key,{from='row'}={}){
 if(key==null||(from==='row'&&key===selKey)){selKey=null;applySel();updatePad(curDetent());$('selLive').textContent='선택 해제';return}
 const s=curD.stops.find(x=>x[0]===key)||curD.opt?.find(x=>x[0]===key);if(!s)return;
 const nx=nextOf(curD),isNext=nx?.[0]===key;selKey=key;selExpand=!isNext; // 다음 갈 곳은 핀·행 모두 카드로(같은 장소 두 번 그리지 않음)
 const cur=curDetent(),target=cur==='wide'?'wide':'half';if(cur!=='wide'&&cur!=='half')setDetent('half');else updatePad(target);
 applySel();
 scrollListTo(selExpand?rowOf(key):$('nextCard'),target);
 if(Number.isFinite(s[6])&&Number.isFinite(s[7])){if(from==='row')flyToStop(s,target);else panToStop(s,target)}
 $('selLive').textContent=`${s[2]} 선택됨`}
function setNext(key){const L=curD.legacy;nextPin[L]=key;const all=read('hk-skip',{});if(all[L]){all[L]=all[L].filter(x=>x!==key);write('hk-skip',all)}navigator.vibrate?.(15);renderTrip();slist.scrollTo({top:Math.max(0,$('nextCard').offsetTop-8),behavior:BEH()});$('selLive').textContent=`${findStop(key)?.[2]||''} 다음 갈 곳으로 지정`}
slist.addEventListener('click',e=>{const r=e.target.closest('.row');if(r&&!lp.fired){select(r.parentElement.dataset.key,{from:'row'})}lp.fired=false});
slist.addEventListener('toggle',e=>{if(e.target.id==='optFold'&&tmap){if(e.target.open)optLayer.addTo(tmap);else optLayer.remove();spreadPins()}},true);
/* 행 길게 누르기(550ms, 10px 이동 취소) = 다음 지정 */
const lp={t:null,x:0,y:0,fired:false};
slist.addEventListener('pointerdown',e=>{const r=e.target.closest('.row');if(!r)return;lp.fired=false;lp.x=e.clientX;lp.y=e.clientY;clearTimeout(lp.t);lp.t=setTimeout(()=>{lp.t=null;lp.fired=true;setNext(r.parentElement.dataset.key)},550)});
slist.addEventListener('pointermove',e=>{if(lp.t&&Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>10){clearTimeout(lp.t);lp.t=null}});
['pointerup','pointercancel','scroll'].forEach(ev=>slist.addEventListener(ev,()=>{clearTimeout(lp.t);lp.t=null},{passive:true}));
slist.addEventListener('contextmenu',e=>{if(e.target.closest('.row'))e.preventDefault()});

/* ══ 준비·예약 탭 ══════════════════════════════════════ */
const PREP_ALL=PREP.flatMap(g=>g.items);
const openIds=new Set();
const cntTxt=k=>[TIP_AT[k]?`꿀${TIP_AT[k].length}`:'',IG_AT[k]?`인${IG_AT[k].length}`:''].filter(Boolean).join('·');
const SAME_AS_BUCKET=new Set(['지금','출발 전']);
function prepRow([id,nm,when,what,steps,warn],inBucket){const done=!!checks[id],open=openIds.has(id);
 return `<div class="prow${done?' done':''}" data-id="${id}"><button type="button" class="chkb" data-trip-check="${id}" aria-pressed="${done}" aria-label="${esc(nm)} 준비 완료"><span class="chk">${ICO.check}</span></button><button type="button" class="lrow" data-prep-open="${id}" aria-expanded="${open}" aria-controls="px-${id}"><span class="t"><b>${esc(nm)}</b>${inBucket&&SAME_AS_BUCKET.has(when)?'':`<small>${esc(when)}</small>`}</span><span class="r"><span class="cnt">${cntTxt(id)}</span><svg class="chev" style="transform:rotate(${open?-90:90}deg)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></span></button><div class="pxp" id="px-${id}" ${open?'':'hidden'}><p>${esc(what)}</p><ol>${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${warn?`<p>${esc(warn)}</p>`:''}<div class="acts"><button type="button" class="act" data-prep-open="${id}">${ACT_LIST}<span>등록 방법 접기</span></button>${TIP_AT[id]?`<button type="button" class="act" data-ig-title="${esc(nm)}" data-tip-list="${TIP_AT[id].join('|')}" aria-label="관련 꿀팁 ${TIP_AT[id].length}개">${TIP_ICON}<span>꿀팁 <b>${TIP_AT[id].length}</b></span></button>`:''}${IG_AT[id]?`<button type="button" class="act" data-ig-title="${esc(nm)}" data-ig-list="${IG_AT[id].join(',')}" aria-label="관련 인스타 ${IG_AT[id].length}개">${IG_ICON}<span>인스타 <b>${IG_AT[id].length}</b></span></button>`:''}</div></div></div>`}
function renderPrep(){const done=PREP_ALL.filter(i=>checks[i[0]]),left=PREP_ALL.filter(i=>!checks[i[0]]);
 $('prepCount').textContent=`${done.length}/${PREP_ALL.length} 완료`;
 const order=['지금','이번 주','출발 직전'];
 const html=left.length?order.map(b=>{const rows=left.filter(i=>BUCKET[i[2]]===b);return rows.length?`<p class="bucket">${b}</p>`+rows.map(r=>prepRow(r,true)).join(''):''}).join(''):`<p class="lrow" style="font-weight:600">준비 끝</p>`;
 const fold=$('prepDone')?.open;
 $('prepContent').innerHTML=html+(done.length?`<details class="dfold" id="prepDone"${fold?' open':''}><summary>완료 ${done.length} ${CHEV}</summary>${done.map(r=>prepRow(r)).join('')}</details>`:'');
 const m=mode(),dd=daysTo('2026-11-24'),h=TripState.get().hotel;
 $('prepDek').textContent=m==='pre'?`D-${dd} · 숙소 ${h?hotelBadge():'미정'}`:m==='trip'?`여행 ${1-dd}일째 · 숙소 ${h?.ko||'미정'}`:'다녀왔어요 · 11/24–28';
}

/* 예약 요약·숙소 카드·디즈니·계산기 — 원본 render() 를 나눈 것 */
function renderSummary(){const t=quoteTotals(),sel=stayById(S.stay);
 document.querySelectorAll('#pax button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.p===S.pax)));
 $('heroTotal').textContent=won(t.per);
 $('heroPerson').textContent=S.pax>1?`${S.pax}명 합계 ${won(t.total)} · 숙소 ${N}박`:`숙소 ${N}박 · 객실 1개`;
 if(!$('flightLine'))$('heroLines').innerHTML=`<details id="flightLine"><summary class="lrow ico">${kicoBox('#0a84ff','<path fill="#fff" stroke="none" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>')}<span class="t"><b>항공 · 구입 완료</b><small>UO619 12:25 · UO626 16:40 · 위탁 20kg</small></span><span class="r"><span id="amtAir"></span>${CHEV}</span></summary><div class="fbox"><p class="muted">${BOOKING.date} ${BOOKING.site} · 1인 ${BOOKING.perPerson.toLocaleString('ko-KR')} · 2명 ${BOOKING.paid.toLocaleString('ko-KR')}(할인 −${(-BOOKING.discount).toLocaleString('ko-KR')})</p><table><tr><td>1인 운임</td><td class="r">${won(BOOKING.fare)}</td></tr><tr><td>세금·유류할증료</td><td class="r">${won(BOOKING.tax)}</td></tr><tr><td>발권 수수료</td><td class="r">${won(BOOKING.fee)}</td></tr><tr><td>1인 합계</td><td class="r">${won(BOOKING.perPerson)}</td></tr><tr><td>2명</td><td class="r">${won(BOOKING.pair)}</td></tr><tr><td>할인</td><td class="r">−${won(-BOOKING.discount)}</td></tr><tr class="low"><td>최종 결제 (트립코인 + 네이버페이)</td><td class="r">${won(BOOKING.paid)}</td></tr></table><details id="fwDetails"><summary>지난 가격 그래프</summary><div class="fw" id="fwBody"><p class="muted">불러오는 중…</p></div></details></div></details><button type="button" class="lrow ico" data-goto="stayCard">${kicoBox('#bf5af2','<path d="M3 18V8M3 14h18v4M21 18v-4a3 3 0 0 0-3-3h-7v3"/>')}<span class="t"><b id="stayLineT"></b><small id="stayLineN"></small></span><span class="r"><span id="amtStay"></span>${CHEV}</span></button><button type="button" class="lrow ico" data-goto="calc">${kicoBox('#ff9f0a','<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>')}<span class="t"><b>디즈니·교통·식비 등</b><small>예산 계산기</small></span><span class="r"><span id="amtExtra"></span>${CHEV}</span></button>`;
 $('amtAir').textContent=man(t.air/S.pax);$('amtStay').textContent=man(t.stay/S.pax);$('amtExtra').textContent=man(t.extra/S.pax);
 $('stayLineT').textContent=`숙소 ${N}박 · ${TripState.get().hotel?hotelBadge():'미정'}`;$('stayLineN').textContent=sel?sel[0]:'아직 안 고름';
 $('calcSum').textContent=`예산 계산기 · ${man(t.extra/S.pax)}`;
}
function renderStayCard(){const s=stayById(S.stay),h=TripState.get().hotel;
 if(!h||!s){$('stayCard').innerHTML=`<p style="font-size:1.0625rem;font-weight:600">숙소 미정</p><button type="button" class="primary" style="margin-top:12px" data-open-pick>숙소 고르기</button>`;return}
 const a=AREAS.find(x=>x.k===s[1]);
 $('stayCard').innerHTML=`<button type="button" class="bodybtn" data-detail="${esc(s[0])}" aria-haspopup="dialog"><div class="sph"><img src="${s[10]}" alt="" loading="lazy" onerror="this.remove()"></div><div class="hd"><h3>${esc(s[0])}</h3><span class="badge">${hotelBadge()}</span></div><p class="m">${a.nm} · ${esc(s[3])}${s[4]?` · ${s[4]}`:''} · 1박 ${man(s[6])}</p><p class="m">${N}박 ${man(s[6]*N)} · 11/24 15:00 체크인 → 11/28</p></button><div class="acts"><button type="button" class="act" data-detail="${esc(s[0])}" data-sites>${LINK_ICON}<span>예약 링크</span></button><a class="act" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s[0]+' Hong Kong')}" target="_blank" rel="noopener">${ICO.map}<span>지도</span></a><button type="button" class="act" data-trip-taxi="hotel">${ACT_TAXI}<span>택시</span></button><button type="button" class="act" data-open-pick>${ACT_LIST}<span>다른 숙소 보기</span></button></div>`}
function renderDisneyRow(){const h=TripState.get().hotel,a=AREAS.find(x=>x.k===h?.area);
 const row=$('disneyRow');if(!row.querySelector('.kico svg'))row.querySelector('.kico').innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${KSVG.star}</svg>`;
 $('disneyRoute').textContent=a?`선택한 숙소 · ${a.nm} → 디즈니랜드 · ${routes[h.area]}`:'숙소를 고르면 가는 길이 나와요'}
function renderExtras(){quoteTotals();
 $('extras').innerHTML=EXTRAS.map(([k,n2,ds,u,per])=>{const mult=per==='day'?N+1:1;
  return `<label class="extra"><span class="nm">${n2}<small>${ds}</small></span><span class="v">${won(u*mult)}</span><input type="checkbox" class="sw" role="switch" aria-label="${n2}" data-ex="${k}" ${S.ex[k]?'checked':''}></label>${k==='food'&&S.ex.food?`<div class="meal-pick">${Object.entries(MEALS).map(([mk,[lab,opts]])=>`<div class="meal-row"><span>${lab}</span><div class="meal-seg">${opts.map(([v,t,hk])=>`<button type="button" data-meal="${mk}:${v}" aria-pressed="${S.meal[mk]===v}">${t}<small>${hk?'HK$'+hk:'—'}</small></button>`).join('')}</div></div>`).join('')}<div class="meal-row"><span>간식</span><div class="meal-seg"><button type="button" data-meal="snack:1" aria-pressed="${!!S.meal.snack}">밀크티·에그타르트·디저트<small>하루 HK$${SNACK}</small></button></div></div></div>`:''}`}).join('')}
/* 새 render(): 원본 render() 호출 자리들이 이걸 부른다 */
function render(fit){const f=document.activeElement,fk=f&&['p','type','ex','area','meal'].find(k=>f.dataset?.[k]!==undefined),fv=fk?f.dataset[fk]:null;
 renderExtras();renderSummary();renderStayCard();renderDisneyRow();if($('stayPick').open)renderStayPick(fit);syncRoute();save();
 if(fk)document.querySelector(`[data-${fk}="${CSS.escape(fv)}"]`)?.focus({preventScroll:true})}

/* 숙소 고르기 (원본 #staySection 의 지도·유형·동네·목록) */
function areaStats(k){const s=ST.filter(x=>x[1]===k);const h=s.filter(x=>x[2]==='hotel').map(x=>x[6]).sort((a,b)=>a-b);const all=s.map(x=>x[6]).sort((a,b)=>a-b);return {min:all[0],hmed:h.length?h[Math.floor(h.length/2)]:null,n:s.length}}
function renderArea(){const el=$('areaInfo');
 if(S.area==='all'){el.innerHTML=`<table class="atable">${AREAS.map(a=>{const st=areaStats(a.k),I=AINFO[a.k];return `<tr data-area="${a.k}" tabindex="0" role="button" aria-label="${a.nm} · ${esc(I.one)}"><td class="an"><b><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${a.c};margin-right:6px"></i>${a.nm}</b><small>${I.one}</small></td><td class="ap">${man(st.min)}~<br><span style="color:var(--sub);font-size:.75rem;font-weight:400">호텔 중간 ${man(st.hmed)}</span></td></tr>`}).join('')}</table><p class="muted" style="margin-top:6px">동네를 누르면 사진과 자세한 설명이 나와요. 금액은 1박.</p>`;return}
 const a=AREAS.find(x=>x.k===S.area),I=AINFO[S.area],st=areaStats(S.area);
 el.innerHTML=`<div class="ainfo"><div class="ph"><img src="${REPORT_PHOTOS[S.area][0]}" alt="" loading="lazy"><img src="${REPORT_PHOTOS[S.area][1]}" alt="" loading="lazy"></div><h3>${a.nm}</h3><div class="one">${I.one}</div><p>${I.mood}</p><div class="cols"><div><h4>좋은 점</h4><ul>${I.good.map(x=>`<li>${x}</li>`).join('')}</ul></div><div><h4>아쉬운 점</h4><ul>${I.bad.map(x=>`<li>${x}</li>`).join('')}</ul></div></div><h4>걸어서·가까이</h4><ul>${I.near.map(x=>`<li>${x}</li>`).join('')}</ul><div class="kv"><b>공항</b>${I.air}</div><div class="kv"><b>숙소</b>1박 ${man(st.min)}부터 · 호텔 중간값 ${man(st.hmed)} · 이 목록 ${st.n}곳</div><div class="kv"><b>추천</b>${I.who}</div><button type="button" class="report-open" data-report="${S.area}" aria-haspopup="dialog">${a.nm} 리포트 전체 보기 <span aria-hidden="true">›</span></button></div>`}
let pmap=null,player=null;
function initPickMap(){if(pmap)return;if(!window.L){$('pickMap').textContent='지도를 불러오지 못했어요 — 인터넷 연결 후 새로고침';return}
 pmap=L.map('pickMap',{scrollWheelZoom:false,zoomControl:false,attributionControl:false}).setView([22.297,114.172],13);L.tileLayer(TILE,{maxZoom:19}).addTo(pmap);player=L.layerGroup().addTo(pmap)}
const shown=()=>ST.filter(s=>(S.type==='all'||s[2]===S.type)&&(S.area==='all'||s[1]===S.area)).sort((a,b)=>a[6]-b[6]);
function drawMap(list){if(!pmap)return;player.clearLayers();
 list.forEach(s=>{const on=s[0]===S.stay;const ic=L.divIcon({className:'',html:`<span class="pin${on?' on':''}${s[2]==='airbnb'?' ab':''}">${on?esc(s[0].slice(0,14))+' ':''}${(s[6]/10000).toFixed(1)}</span>`,iconSize:null});
  L.marker([s[8],s[9]],{icon:ic,zIndexOffset:on?1000:0,keyboard:false}).addTo(player).bindTooltip(`${s[0]} · 1박 ${won(s[6])}`).on('click',()=>openStay(s[0],null))})}
function renderStayPick(fit){
 $('types').innerHTML=TYPES.map(t=>`<button type="button" data-type="${t.k}" aria-pressed="${t.k===S.type}">${t.nm} ${t.k==='all'?ST.length:ST.filter(s=>s[2]===t.k).length}</button>`).join('');
 $('areaChips').innerHTML=[['all','전체'],...AREAS.map(a=>[a.k,{tst:'침사추이',cen:'센트럴',cwb:'코즈웨이',np:'노스포인트',mk:'몽콕'}[a.k]])].map(([k,l])=>`<button type="button" class="chip" data-area="${k}" aria-pressed="${S.area===k}">${l}</button>`).join('');
 renderArea();const L2=shown();
 $('hotels').innerHTML=L2.map(s=>{const a=AREAS.find(x=>x.k===s[1]);return `<button type="button" class="hcard" aria-label="${esc(s[0])}${s[0]===S.stay?', 선택한 숙소':''}, 상세 보기" aria-haspopup="dialog" data-detail="${esc(s[0])}"><img src="${s[10]}" alt="" loading="lazy"><span class="bd"><span class="nm">${esc(s[0])}</span><span class="s">${a.nm} · ${s[2]==='hotel'?'호텔':'에어비앤비'}${s[4]?` · 평점 ${s[4]}`:''}</span><span class="pr">${won(s[6]*N/S.pax)}<span>${S.pax>1?'1인 · ':''}${N}박 · 1박 ${man(s[6])}</span></span></span>${svg(s[0]===S.stay?'M5 12l4 4L19 6':'m9 5 7 7-7 7',2,` class="row-icon${s[0]===S.stay?' check':''}"`)}</button>`}).join('');
 drawMap(L2);if(pmap&&fit&&L2.length)pmap.fitBounds(L2.map(s=>[s[8],s[9]]),{padding:[30,30],maxZoom:16});
 $('areaChips').querySelector('[aria-pressed=true]')?.scrollIntoView({block:'nearest',inline:'nearest'})}

/* 숙소 상세 (원본 openStay, r=RET·N=4) */
let detailId=null;
function siteLinks(s){const i='2026-11-24',o='2026-11-28';const P=s[13]||{},ID=s[14]||{};const mn=Math.min(...Object.values(P));
 const chips=SITES.filter(([k,,idk])=>P[k]||(idk&&ID[idk])).sort((a,b)=>(P[a[0]]||1e9)-(P[b[0]]||1e9)).map(([k,lab,idk,f])=>{const cls=`site${P[k]===mn?' low':''}`;const pr=`${lab}<b>${P[k]?man(P[k]):'—'}</b>`;
  return idk&&ID[idk]?`<a class="${cls}" href="${f(ID[idk],i,o)}" target="_blank" rel="noopener">${pr}</a>`:`<span class="${cls} nolink">${pr}</span>`}).join('');
 const g=`https://www.google.com/travel/search?q=${encodeURIComponent(s[12]+' hotel Nov 24 to Nov 28 2026')}&hl=ko&curr=KRW`;
 return chips+`<a class="site cmp" href="${g}" target="_blank" rel="noopener">구글에서 전체 비교 ${svg('m9 5 7 7-7 7',1.7,' class="row-icon"')}</a>`}
function openStay(id,trigger,toSites){const s=stayById(id);if(!s)return;detailId=id;const a=AREAS.find(a=>a.k===s[1]);
 const link=s[11]?`https://www.airbnb.co.kr/rooms/${s[11]}?check_in=2026-11-24&check_out=2026-11-28&adults=2`:null;
 $('detailBody').innerHTML=`<img class="detail-photo" src="${s[10]}" alt="${esc(s[0])} 숙소 사진"><h3 id="detailTitle">${esc(s[0])}</h3><p>${a.nm} · ${esc(s[3])}${s[4]?` · 평점 ${s[4]} (리뷰 ${s[5]})`:''}</p>${s[7]?`<p>${esc(s[7])}</p>`:''}<p>${s[15]?`객실 ${s[15][0]===s[15][1]?s[15][0]:s[15].join('~')}㎡ · 기본 방 약 ${(s[15][0]/3.3058).toFixed(1)}평`:'객실 면적 정보 없음'}</p><div class="detail-price">${won(s[6]*N/S.pax)}</div><p>${S.pax>1?`1인 · 객실 합계 ${won(s[6]*N)} · `:''}${N}박 · 1박 ${won(s[6])} · 11/24~11/28</p><button type="button" class="primary sheet-select" id="selectStay">${S.stay===id?'선택한 숙소':'이 숙소 선택'}</button><h4 id="sitesHead">사이트별 1박 요금</h4><div class="sites">${link?`<a class="site" href="${link}" target="_blank" rel="noopener">에어비앤비 · ${man(s[6])}</a>`:siteLinks(s)}</div><a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s[0]+' Hong Kong')}" target="_blank" rel="noopener">구글 지도에서 보기 ${svg('M6 18 18 6M6 6h12v12',1.7,' class="row-icon"')}</a><p class="muted">요금은 11/24~28 검색 기준이며 실제 예약 시 달라질 수 있어요. 점선 항목은 요금 정보만 제공해요. 객실 면적은 방 종류별 범위이며 최저가는 보통 가장 작은 방 기준이에요.</p>`;
 const dlg=$('stayDialog');dlg.classList.remove('expanded');$('sheetDetent').setAttribute('aria-expanded','false');openSheet(dlg,trigger);$('detailBody').scrollTop=0;
 if(toSites){dlg.classList.add('expanded');requestAnimationFrame(()=>$('sitesHead').scrollIntoView({block:'start'}))}}
function chooseStay(){S.stay=detailId;save();window.publishTripFromQuote();render();const s=stayById(detailId);pmap?.panTo([s[8],s[9]],{animate:!RM()});closeSheet($('stayDialog'))}

/* 동네 리포트 (원본 IIFE — S.area 를 바꾸던 한 줄은 뺐다) */
const reportMaps={};
function ensureReportMap(a){if(reportMaps[a]){reportMaps[a].invalidateSize();return}const el=$('map_'+a);if(!el)return;if(!window.L){el.textContent='지도를 불러오지 못했어요. 인터넷 연결 후 새로고침해 주세요.';return}
 const m=L.map(el,{scrollWheelZoom:false,dragging:!L.Browser.mobile,tap:false,zoomControl:false,attributionControl:false});L.tileLayer(TILE,{maxZoom:19}).addTo(m);new ResizeObserver(()=>m.invalidateSize()).observe(el);
 const b=[],blue=getComputedStyle(document.documentElement).getPropertyValue('--blue').trim();PINS[a].forEach(p=>{b.push([p[1],p[2]]);L.circleMarker([p[1],p[2]],{radius:6,color:'#fff',weight:2,fillColor:'#8e8e93',fillOpacity:1}).addTo(m).bindTooltip(p[0])});
 HP[a].forEach(h=>{b.push([h[1],h[2]]);L.circleMarker([h[1],h[2]],{radius:5,color:'#fff',weight:1.5,fillColor:blue,fillOpacity:1}).addTo(m).bindTooltip(h[0]+' · 1박 '+(h[3]/10000).toFixed(1)+'만')});
 m.fitBounds(b,{padding:[18,18]});reportMaps[a]=m}
const fitReportColumns=(()=>{const r=document.createRange();return ()=>document.querySelectorAll('.report-scope .card ul:not(.hl)').forEach(ul=>{const li=[...ul.children];ul.classList.remove('cols2');li.forEach(x=>x.classList.remove('full'));const half=ul.clientWidth/2-36;if(half<80||li.length<2)return;
 const short=li.map(x=>{if(x.querySelector('.tag'))return false;r.selectNodeContents(x);return r.getBoundingClientRect().width<=half});
 let pairs=0;for(let i=0;i<li.length;){if(short[i]&&short[i+1]){pairs++;i+=2}else{li[i].classList.add('full');i++}}
 if(pairs)ul.classList.add('cols2');else li.forEach(x=>x.classList.remove('full'))})})();
addEventListener('resize',fitReportColumns);document.addEventListener('toggle',fitReportColumns,true);
const report=(()=>{const dlg=$('reportDialog'),sc=$('reportScroll'),keys=['tst','mk','cen','cwb','np'];
 const secs=Object.fromEntries(keys.map(k=>[k,$(k)])),tabs=[...dlg.querySelectorAll('[role=tab]')];let current='tst';
 function anchor(){const top=sc.getBoundingClientRect().top+8;const ch=[...secs[current].children];for(let i=0;i<ch.length;i++){const b=ch[i].getBoundingClientRect();if(b.height&&b.bottom>top)return {i,f:Math.max(0,(top-b.top)/b.height)}}return null}
 function show(k,keep=true){const an=keep?anchor():null;const states=[...secs[current].querySelectorAll('details')].map(d=>d.open);keys.forEach(key=>secs[key].hidden=key!==k);current=k;
  tabs.forEach(t=>{const on=t.dataset.a===k;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1});
  if(keep)[...secs[k].querySelectorAll('details')].forEach((d,i)=>d.open=!!states[i]);
  fitReportColumns();ensureReportMap(k);
  if(an){const b=secs[k].children[an.i]?.getBoundingClientRect();if(b)sc.scrollTop+=b.top+an.f*b.height-(sc.getBoundingClientRect().top+8)}else sc.scrollTop=0}
 tabs.forEach(t=>t.onclick=()=>show(t.dataset.a));
 dlg.querySelector('.tabbar').addEventListener('keydown',e=>{let i=keys.indexOf(current);if(e.key==='ArrowRight')i=(i+1)%5;else if(e.key==='ArrowLeft')i=(i+4)%5;else if(e.key==='Home')i=0;else if(e.key==='End')i=4;else return;e.preventDefault();show(keys[i]);tabs[i].focus()});
 let touch;sc.addEventListener('touchstart',e=>{touch=e.target.closest('.map,.gal,a,button,summary')?null:[e.touches[0].clientX,e.touches[0].clientY]},{passive:true});sc.addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch[0],dy=e.changedTouches[0].clientY-touch[1];if(Math.abs(dx)>70&&Math.abs(dx)>2*Math.abs(dy)){const i=keys.indexOf(current)+(dx<0?1:-1);if(keys[i])show(keys[i])}touch=null},{passive:true});
 $('reportClose').onclick=()=>closeSheet(dlg);
 return {open(k,trigger){openSheet(dlg,trigger);show(k,false)},get current(){return current}}})();
/* 디즈니 시트: 선택 숙소 경로 강조(원본 syncRoute) */
const routeCard=[...document.querySelectorAll('#disney .card')].find(c=>c.querySelector('h4')?.textContent==='동네별 가는 길');
const routeRows=routeCard?[...routeCard.querySelectorAll('.compare-item')]:[];const routeLabel=document.createElement('p');routeLabel.className='route-label';routeCard?.insertBefore(routeLabel,routeCard.children[1]);
function syncRoute(){const s=stayById(S.stay),k=s?.[1]||S.area;const idx=['tst','mk','cen','cwb','np'].indexOf(k);routeRows.forEach((r,i)=>r.classList.toggle('chosen-route',i===idx));routeLabel.textContent=s?'선택한 숙소 · '+s[0]+' → 디즈니랜드':''}

/* 지난 가격 그래프 — 원본 #fwBody IIFE, 처음 펼칠 때만 불러온다 */
function loadFares(){const el=$('fwBody');if(!el||el.dataset.loaded)return;el.dataset.loaded=1;let G={},ALL=[],SEL=null;
 el.addEventListener('click',e=>{const t=e.target.closest('[data-fwd]');if(t){SEL=t.dataset.fwd;draw(ALL)}});
 function draw(all){ALL=all;if(!all.length){el.innerHTML='<p class="muted">아직 기록이 없어요.</p>';return}
  const dates=[...new Set(all.map(r=>r.date))].sort();const by=d=>all.filter(r=>(r.ret||28)===d).sort((a,b)=>a.date.localeCompare(b.date));
  const GP=d=>(G[d]&&G[d].pts)||[];const vals=[...all.map(r=>r.min),...GP(28).map(x=>x[1]),...GP(29).map(x=>x[1]),BUY],lo=Math.min(...vals)*0.97,hi=Math.max(...vals)*1.03,Wd=Math.max(280,(el.clientWidth||300)),Hd=170,
   T=dt=>Date.parse(dt)/864e5,t0=Math.min(T(dates[0]),...[28,29].filter(d=>GP(d).length).map(d=>T(GP(d)[0][0]))),span=T(DL)-t0||1,px=dt=>40+(T(dt)-t0)*(Wd-80)/span,py=v=>Hd-24-(v-lo)/(hi-lo||1)*(Hd-46);
  const sel=dates.includes(SEL)?SEL:dates[dates.length-1];
  const LT=dt=>{const w=Math.min(26,Math.max(1,(T(DEP)-T(dt))/7)),i=26-Math.ceil(w),j=Math.min(25,i+1),f=Math.ceil(w)-w;return LYW[Math.max(0,i)]*(1-f)+LYW[j]*f};
  const g28=GP(28),kk=g28.length?g28[g28.length-1][1]/LT(g28[g28.length-1][0]):0;
  const DD=[];for(let t=t0;t<=T(DL);t++)DD.push(new Date(t*864e5).toISOString().slice(0,10));
  const TR=kk?DD.map(dt=>[dt,LT(dt)*kk]):[];const ticks=[lo/0.97,(lo/0.97+hi/1.03)/2,hi/1.03];
  const svgc=`<svg class="fwchart" viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="날짜별 최저가 — 토요일·일요일 귀국" style="width:100%;height:auto;font-size:10px;fill:var(--sub)">
   ${ticks.map(t=>`<line x1="40" x2="${Wd-20}" y1="${py(t)}" y2="${py(t)}" stroke="var(--line)"/><text x="36" y="${py(t)+3}" text-anchor="end">${Math.round(t/1000)}천</text>`).join('')}
   ${SER.map(S_=>{const r=by(S_.d);if(!r.length)return'';return `<polyline points="${r.map(x=>px(x.date)+','+py(x.min)).join(' ')}" fill="none" stroke="${S_.c}" stroke-width="2" stroke-dasharray="${S_.d===29?'5 4':'none'}"/>`+r.map((x,i)=>`<circle cx="${px(x.date)}" cy="${py(x.min)}" r="${i===r.length-1?5:3}" fill="${S_.c}"/>`).join('')}).join('')}
   ${SER.map(S_=>GP(S_.d).length?`<polyline points="${GP(S_.d).map(x=>px(x[0])+','+py(x[1])).join(' ')}" fill="none" stroke="var(--sub)" stroke-width="1.2" stroke-dasharray="${S_.d===29?'3 3':'none'}"/>`:'').join('')}
   ${TR.length?`<polyline points="${TR.map(x=>px(x[0])+','+py(x[1])).join(' ')}" fill="none" stroke="var(--tert)" stroke-width="1.2" stroke-dasharray="2 3"/><text x="${px(DL)-4}" y="${py(TR[TR.length-1][1])-6}" text-anchor="end">작년 추세면 11/17 ${Math.round(TR[TR.length-1][1]/1000)}천</text>`:''}
   <line x1="40" x2="${Wd-40}" y1="${py(BUY)}" y2="${py(BUY)}" stroke="var(--green)" stroke-dasharray="4 3"/><text x="${Wd-40}" y="${py(BUY)+12}" text-anchor="end">구매선 ${Math.round(BUY/1000)}천</text>
   <line x1="${px(DL)}" x2="${px(DL)}" y1="10" y2="${Hd-20}" stroke="var(--line)"/><text x="${px(DL)}" y="${Hd-6}" text-anchor="end">11/17 마감</text>
   <line x1="${px(sel)}" x2="${px(sel)}" y1="10" y2="${Hd-20}" stroke="var(--label)" stroke-width=".8"/>
   ${(()=>{const k=[];[sel,dates[dates.length-1],dates[0]].forEach(dt=>{if(k.every(x=>Math.abs(px(x)-px(dt))>=34))k.push(dt)});return k.map(dt=>`<text x="${px(dt)}" y="${Hd-6}" text-anchor="middle" style="${dt===sel?'fill:var(--label);font-weight:600':''}">${dt.slice(5).replace('-','/')}</text>`).join('')})()}
   ${dates.map(dt=>{const w=Math.max(24,(Wd-80)/span);return `<rect class="hit" data-fwd="${dt}" x="${px(dt)-w/2}" y="0" width="${w}" height="${Hd}" fill="transparent"><title>${dt} 가격 보기</title></rect>`}).join('')}</svg>`;
  const latest=dates[dates.length-1];
  el.innerHTML=`<p class="muted">${sel} 조회${sel!==latest?' (지난 가격 · 그래프에서 다른 날짜 누르기)':''} · 가는 편 11/24 (화) 12:25 · 1인 왕복 · 세금 포함 · 수하물 제외</p>${svgc}<p class="muted">${SER.map(S_=>`<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="${S_.c}"/></svg> ${S_.lab}`).join(' · ')} · 회색 = 구글 전 항공사 최저가 · 점선 = 작년 추세</p><p class="muted">같은 날 수하물 없는 최저가는 1인 ₩286,468(울트라 라이트, 캐리어 불가). 그래프는 구입 전까지 모은 기록이에요.</p>`}
 Promise.all([fetch('fares.json?t='+Date.now()).then(r=>r.json()),fetch('ghist.json?t='+Date.now()).then(r=>r.json()).catch(()=>({}))]).then(([f,g])=>{G=g;draw(f)}).catch(()=>{el.innerHTML='<p class="muted">가격 기록을 불러오지 못했어요</p>'})}

/* ══ 시트 공통: showModal + pushState, 뒤로가기·완료·바깥·쓸어내림으로 닫힘 ══ */
const sheetStack=[],closeWaiters=new Map();let popClosing=false,ignorePop=0;
const lockBody=()=>{document.body.style.overflow=sheetStack.length?'hidden':''};
function openSheet(d,trigger){if(d.open)return;d._trigger=trigger||document.activeElement;d.showModal();const f=d.querySelector('.sh-head h2')||d;f.tabIndex=-1;f.focus({preventScroll:true});sheetStack.push(d);history.pushState({sheet:d.id},'');lockBody()}
function closeSheet(d){return new Promise(res=>{if(!d||!d.open){res();return}closeWaiters.set(d,res);history.back()})}
addEventListener('popstate',()=>{if(ignorePop){ignorePop--;return}const d=sheetStack.pop();if(d&&d.open){popClosing=true;d.close();popClosing=false}});
document.querySelectorAll('dialog').forEach(d=>{
 d.addEventListener('close',()=>{const i=sheetStack.indexOf(d);if(i>-1){sheetStack.splice(i,1);if(!popClosing){ignorePop++;history.back()}}lockBody();
  if(d.id==='tools')$('toolsBtn').setAttribute('aria-expanded','false');
  if(d.id==='ig'){d.querySelectorAll('video').forEach(v=>v.pause())}
  const t=d._trigger;if(t&&t.isConnected)t.focus({preventScroll:true});
  closeWaiters.get(d)?.();closeWaiters.delete(d)});
 if(d.id!=='show')d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientY<r.top||e.clientX<r.left||e.clientX>r.right)closeSheet(d)});
 const top=d.querySelector('.sh-top');if(top){let y0=null;top.addEventListener('pointerdown',e=>{if(e.target.closest('.done,.seg'))return;y0=e.clientY});
  top.addEventListener('pointerup',e=>{if(y0==null)return;const dy=e.clientY-y0;y0=null;
   if(d.classList.contains('h62')&&dy<-24){d.classList.add('expanded');syncDetentBtn(d)}
   else if(dy>40){if(d.classList.contains('expanded')){d.classList.remove('expanded');syncDetentBtn(d)}else closeSheet(d)}})}});
function syncDetentBtn(d){const b=d.querySelector('button.grabber');if(!b)return;const ex=d.classList.contains('expanded');b.setAttribute('aria-expanded',String(ex));b.setAttribute('aria-label',(d.id==='tools'?'도구 ':'숙소 상세 ')+(ex?'작게 보기':'크게 보기'))}
document.querySelectorAll('dialog.h62 button.grabber').forEach(b=>{let moved=false;b.addEventListener('pointerdown',()=>moved=false);b.addEventListener('pointermove',e=>{if(e.buttons)moved=true});b.addEventListener('click',()=>{if(moved)return;const d=b.closest('dialog');d.classList.toggle('expanded');syncDetentBtn(d)})});
/* 보여주기: 글자 밖에서 아래로 80px 넘게 쓸면 닫힘 (화면 탭으로는 안 닫힘) */
{let y0=null;const sh=$('show');sh.addEventListener('pointerdown',e=>{y0=e.target.closest('.big,.addr,button,a')?null:e.clientY});sh.addEventListener('pointerup',e=>{if(y0!=null&&e.clientY-y0>80)closeSheet(sh);y0=null})}

/* ══ 도구 서랍 ══════════════════════════════════════════ */
let toolSeg=read('hk-a-tools-seg-v1','taxi');if(!['taxi','talk','ref','docs'].includes(toolSeg))toolSeg='taxi';
const SEGS=['taxi','talk','ref','docs'];
function setToolsDetent(ex){$('tools').classList.toggle('expanded',ex);syncDetentBtn($('tools'))}
function setSeg(seg,store=true){toolSeg=seg;if(store)write('hk-a-tools-seg-v1',seg);
 $('toolSeg').querySelectorAll('[data-seg]').forEach(b=>{const on=b.dataset.seg===seg;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;b.setAttribute('aria-controls','tp-'+b.dataset.seg)});
 SEGS.forEach(s=>$('tp-'+s).hidden=s!==seg);
 if(seg==='taxi')renderTaxi();if(seg==='talk'){if(!$('talkContent').innerHTML)renderTalk();setToolsDetent(true)}if(seg==='ref'&&!$('tp-ref').innerHTML)renderRef()}
function openTools(seg,arg){const d=$('tools'),ctx=!!seg;seg=seg||toolSeg;setSeg(seg,!ctx||true);if(seg!=='talk')setToolsDetent(false);if(!d.open)openSheet(d,$('toolsBtn'));$('toolsBtn').setAttribute('aria-expanded','true');if(seg==='talk')talkTo(arg)}
$('toolsBtn').onclick=()=>openTools();
$('toolSeg').addEventListener('keydown',e=>{const i=SEGS.indexOf(toolSeg);const n=e.key==='ArrowRight'?(i+1)%4:e.key==='ArrowLeft'?(i+3)%4:null;if(n==null)return;e.preventDefault();setSeg(SEGS[n]);$('toolSeg').querySelector(`[data-seg=${SEGS[n]}]`).focus()});

const taxiRow=(s,label)=>{const k=s[0],h=k==='hotel'?TripState.get().hotel:null;const sub=k==='hotel'?(h?(h.en||h.ko):'숙소 미정 · 고르기'):(s[3]||s[4]);return `<button type="button" class="lrow ico" data-trip-taxi="${k}">${kIco(s)}<span class="t"><b>${esc(label||s[2])}</b><small>${esc(sub)}</small></span>${CHEV}</button>`};
function allStops(){const seen=new Set(),out=[];[...Object.values(DAYS).flatMap(d=>d.stops),...disney(),airport()].forEach(s=>{if(!seen.has(s[0])){seen.add(s[0]);out.push(s)}});return out}
function renderTaxi(){const t=todayChip(),k=t||'24',d=buildDay(k),mm=+k;
 $('tp-taxi').innerHTML=`<div class="card flush taxi">${taxiRow(hotelStop(),'숙소로')}${taxiRow(DAYS.d1.stops[0],'공항')}${taxiRow(disney().find(s=>s[0]==='disney'),'디즈니랜드')}${taxiRow(DAYS.d1.stops.find(s=>s[0]==='aos'),'침사추이 해변')}</div><p class="tcap">${t?`오늘 (11/${mm})`:'첫날 (11/24)'} · ${d.stops.length}곳</p><div class="card flush taxi">${d.stops.map(s=>taxiRow(s)).join('')}</div><details class="dcard taxi" id="taxiAll"><summary><span>모든 장소 · ${allStops().length}곳</span>${CHEV}</summary>${allStops().map(s=>taxiRow(s)).join('')}</details>`}

/* 회화 — 급할 때 먼저, 칩은 접혀 3줄까지 */
const TALK_ORDER=[...TALK.keys()].sort((a,b)=>(TALK[b][0]==='급할 때')-(TALK[a][0]==='급할 때'));
function renderTalk(){$('talkChips').innerHTML=`<a class="papago" href="papago://" data-papago>${LINK_ICON}파파고</a>`+TALK_ORDER.map(gi=>`<button type="button" data-jump="${gi}">${esc(TALK[gi][0])}</button>`).join('');
 $('talkContent').innerHTML=TALK_ORDER.map(gi=>{const [g,when,rows]=TALK[gi];return `<section class="tg" id="tg-${gi}"><h3>${esc(g)}${when?`<small>${esc(when)}</small>`:''}</h3><div class="card flush">${rows.map((r,ri)=>`<div class="trow"><button type="button" class="talk-main" data-t="${gi}-${ri}"><span class="talk-ko">${esc(r[0])}</span><span class="talk-zh">${esc(r[1])}</span>${r[2]?`<span class="talk-say">${esc(r[2])}</span>`:''}</button><button type="button" class="talk-play" data-speak="${gi}-${ri}" aria-label="${esc(r[0])} 듣기"><i>${ICO.play}</i></button></div>`).join('')}</div></section>`}).join('');
 talkSpy()}
function talkSpy(){const btns=[...$('talkChips').querySelectorAll('[data-jump]')];if(!('IntersectionObserver' in window))return;const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const gi=e.target.id.slice(3);btns.forEach(b=>b.setAttribute('aria-current',String(b.dataset.jump===gi)))}}),{root:$('tp-talk'),rootMargin:'-30% 0px -60% 0px'});document.querySelectorAll('#talkContent .tg').forEach(g=>io.observe(g))}
function talkTo(name){if(!name){const k=lastArrive&&Date.now()-lastArrive.t<18e5?lastArrive.key:nextOf(curD)?.[0];name=TALK_CTX[k]}
 const gi=TALK.findIndex(t=>t[0]===name);const sec=gi>-1&&$('tg-'+gi);
 $('tp-talk').style.setProperty('--chips-h',$('talkChips').offsetHeight+'px');
 requestAnimationFrame(()=>{if(sec)sec.querySelector('h3').scrollIntoView({block:'start',behavior:'instant'});else $('tp-talk').scrollTop=0})}
function speakTalk(r,btn){if(!('speechSynthesis' in window)){btn.disabled=true;return}speechSynthesis.cancel();const text=r[1].replace(/○○/g,'').replace(/\s*\/\s*/g,'，');const yue=/[㐀-鿿]/.test(text);const u=new SpeechSynthesisUtterance(text);u.lang=yue?'zh-HK':'en-US';const v=speechSynthesis.getVoices().find(v=>yue?/zh[-_]HK|yue/i.test(v.lang):/^en[-_](US|GB)/i.test(v.lang));if(v)u.voice=v;u.rate=yue?.85:.95;document.querySelectorAll('.talk-play.on').forEach(b=>b.classList.remove('on'));btn.classList.add('on');u.onend=u.onerror=()=>btn.classList.remove('on');speechSynthesis.speak(u)}

/* 자료 — 비상 연락 · 못 쓰는 앱 · 꿀팁 8묶음 · 인스타 모음 */
let igCat='전체',igArea='전체';
const igChips=(kind,cur,vals)=>`<div class="chips" role="group" aria-label="${kind==='cat'?'목적':'장소'}">${['전체',...vals].map(v=>`<button type="button" class="chip" data-ig-${kind}="${v}" aria-pressed="${v===cur}">${v}</button>`).join('')}</div>`;
function igList(){const rows=IG.filter(r=>(igCat==='전체'||r[4]===igCat)&&(igArea==='전체'||r[5]===igArea));return rows.length?rows.map(([n,u,path,t,c,a])=>`<button type="button" class="igrow" data-ig-list="${rows.map(r=>r[0]).join(',')}" data-ig-start="${rows.findIndex(r=>r[0]===n)}" data-ig-title="인스타 모음"><span class="t"><b>${esc(t)}</b><small>${c} · ${a} · @${esc(u)}</small></span><i>${path.startsWith('reel/')?ICO.play.replace('<svg','<svg fill="currentColor"'):CHEV}</i></button>`).join(''):'<p class="muted" style="padding:14px 16px">이 조합은 없어요</p>'}
function renderRef(){const cats=[...new Set(IG.map(r=>r[4]))],areas=[...new Set(IG.map(r=>r[5]))];
 $('tp-ref').innerHTML=`<p class="tcap">비상 연락</p><div class="card flush sos"><a href="tel:999">${kicoBox('#ff3b30','<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>')}<span>경찰·구급·소방 999</span><small>전화</small></a><a href="https://www.google.com/maps/search/?api=1&query=Consulate+General+of+the+Republic+of+Korea+Hong+Kong" target="_blank" rel="noopener">${kicoBox('#0a84ff',KSVG.pin)}<span>주홍콩 총영사관</span><small>지도</small></a></div>
 <p class="tcap">못 쓰는 앱</p><div class="card flush">${NOPE.map(([n,v])=>`<div class="nope"><b>${esc(n)}</b><p>${esc(v)}</p></div>`).join('')}</div>
 <p class="tcap">꿀팁 · ${TIPS.length}묶음</p>${TIPS.map(([g,rows])=>{const ig=IG_AT['tip:'+g];return `<details class="dcard tipd"><summary><span>${esc(g)} <small class="muted">${rows.length}</small></span>${ig?`<button type="button" class="igc" data-ig-title="${esc(g)}" data-ig-list="${ig.join(',')}" aria-label="관련 인스타 ${ig.length}개">${IG_ICON}${ig.length}</button>`:''}${CHEV}</summary>${rows.map(([n,v])=>`<div class="tip"><b>${esc(n)}</b><p>${esc(v)}</p></div>`).join('')}</details>`}).join('')}
 <p class="tcap">인스타 모음 · ${IG.length}개</p>${igChips('cat',igCat,cats)}${igChips('area',igArea,areas)}<div class="card flush" id="igList" style="margin-top:8px">${igList()}</div>`}

/* 보여주기 — 택시카드 / 회화 한 문장 (항상 밝음) */
function showBig(kind,payload){const el=$('showIn'),dlg=$('show');
 if(kind==='taxi'){const s=findStop(payload);if(!s)return;
  if(s[0]==='hotel'){const h=TripState.get().hotel;if(!h){openPick();return}
   el.innerHTML=`<p class="lead">師傅，唔該載我去：</p><div class="big" lang="en">${esc(h.en||h.ko)}</div><p class="addr">${esc(AREA_EN[h.area]||'')}</p><p class="warn">중문 없음 — 영문명과 동네를 보여 주세요</p><p class="en">${esc(h.ko)}</p><div class="show-btns"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((h.en||h.ko)+' Hong Kong')}" target="_blank" rel="noopener">${ICO.map}지도</a></div>`}
  else el.innerHTML=`<p class="lead">師傅，唔該載我去：</p><div class="big" lang="zh-HK">${esc(s[3]||s[4]||s[2])}</div>${s[5]?`<p class="addr" lang="zh-HK">${esc(s[5])}</p>`:''}<p class="en">${esc([s[4],s[2]].filter(Boolean).join(' · '))}</p>`;
  el.innerHTML+=`<button type="button" class="to-talk" data-to-talk>기사님께 — 택시 회화 ${(TALK.find(t=>t[0]==='택시')||[,,[]])[2].length} ›</button>`;dlg.setAttribute('aria-label','택시 기사에게 보여주기')}
 else{const [gi,ri]=payload.split('-');const r=TALK[gi][2][ri];
  el.innerHTML=`<p class="lead">${esc(r[0])}</p><div class="big">${esc(r[1])}</div>${r[2]?`<p class="say">${esc(r[2])}</p>`:''}${r[3]?`<p class="en">${esc(r[3])}</p>`:''}<div class="show-btns"><button type="button" class="talk-play" data-speak="${payload}" style="width:auto;margin:0;border-radius:12px">${ICO.play} 듣기</button><a href="https://papago.naver.com/?sk=ko&tk=zh-TW&st=${encodeURIComponent(r[0])}" target="_blank" rel="noopener">파파고에서 이어서</a></div>`;dlg.setAttribute('aria-label','크게 보기')}
 openSheet(dlg)}
async function toTaxiTalk(){await closeSheet($('show'));if($('tools').open){setSeg('talk');setToolsDetent(true);talkTo('택시')}else openTools('talk','택시')}

/* 꿀팁·인스타 시트 */
function openTips(list,title,trigger){const rows=list.split('|').map(k=>{const [g,n]=k.split(':');const r=(TIPS.find(t=>t[0]===g)||[,[]])[1].find(x=>x[0]===n);return r&&[g,...r]}).filter(Boolean);
 $('tips-t').textContent=`꿀팁 ${rows.length}${title?' · '+title:''}`;$('tips').querySelector('.sh-body').innerHTML=`<div class="card flush">${rows.map(([g,n,v])=>`<div class="tip"><b>${esc(n)}</b><small>${esc(g)}</small><p>${esc(v)}</p></div>`).join('')}</div>`;openSheet($('tips'),trigger)}
const igReel=rows=>`<div class="ig-reel">${rows.map(([n,u,path,t,c,a])=>`<figure class="ig-slide" data-path="${path}"><div class="ig-media"></div><figcaption><b>${esc(t)}</b><small>${c} · ${a} · @${esc(u)}</small><br><a href="https://www.instagram.com/${path}/" target="_blank" rel="noopener">인스타에서 열기</a></figcaption></figure>`).join('')}</div>`;
window.igVideo=async c=>'ig/'+c+'.mp4';
async function igLoad(f){if(f.dataset.on)return;f.dataset.on=1;const p=f.dataset.path,m=f.querySelector('.ig-media'),v=p.startsWith('reel/')&&window.igVideo?await igVideo(p.slice(5)):null;const ifr=`<iframe src="https://www.instagram.com/${p}/embed/captioned/" loading="lazy" title="인스타 게시물" allowtransparency="true"></iframe>`;m.innerHTML=v?`<video src="${v}" muted loop playsinline controls preload="metadata"></video>`:ifr;const vd=m.querySelector('video');if(vd)vd.addEventListener('error',()=>{m.innerHTML=ifr},{once:true})}
function igMount(start,dlg=$('ig')){const reel=dlg.querySelector('.ig-reel');if(!reel)return;const sl=[...reel.children];
 const io=new IntersectionObserver(es=>es.forEach(e=>{const f=e.target;if(e.isIntersecting){igLoad(f).then(()=>{const v=f.querySelector('video');if(v&&f.dataset.vis)v.play().catch(()=>{})});f.dataset.vis=1;const v=f.querySelector('video');v&&v.play().catch(()=>{})}else{delete f.dataset.vis;f.querySelector('video')?.pause()}}),{root:reel,threshold:.6});
 sl.forEach(f=>io.observe(f));if(start&&sl[start])reel.scrollLeft=sl[start].offsetLeft-reel.offsetLeft;
 dlg.addEventListener('close',()=>{io.disconnect();reel.querySelectorAll('video').forEach(v=>v.pause())},{once:true})}
function openIg(list,title,start,trigger){const want=list.split(',').map(Number),rows=want.map(n=>IG.find(r=>r[0]===n)).filter(Boolean);
 $('ig-t').textContent=`${title||'인스타'} · ${rows.length}개`;$('ig').querySelector('.sh-body').innerHTML=igReel(rows);openSheet($('ig'),trigger);igMount(+start||0)}
function openPick(trigger){openSheet($('stayPick'),trigger);initPickMap();renderStayPick(true);requestAnimationFrame(()=>{pmap?.invalidateSize();const L2=shown();if(pmap&&L2.length)pmap.fitBounds(L2.map(s=>[s[8],s[9]]),{padding:[30,30],maxZoom:16})})}

/* ══ 클릭 한 곳에서 ══════════════════════════════════════ */
document.addEventListener('click',e=>{const t=e.target;
 const pg=t.closest('[data-papago]');if(pg){const tm=setTimeout(()=>{if(document.visibilityState==='visible')location.href='https://papago.naver.com/'},1500);addEventListener('pagehide',()=>clearTimeout(tm),{once:true});return}
 if(t.closest('a'))return;
 const b=t.closest('button,[data-area],[role=button]');if(!b)return;const d=b.dataset;
 if(b.closest('summary')&&(d.igList||d.tipList))e.preventDefault();
 if(d.tripTaxi){showBig('taxi',d.tripTaxi);return}
 if(d.tipList){openTips(d.tipList,d.igTitle,b);return}
 if(d.igList){openIg(d.igList,d.igTitle,d.igStart,b);return}
 if(d.tripCheck){const id=d.tripCheck;setCheck(id,!checks[id]);if(id.startsWith('p-'))renderPrep();else renderTrip();return}
 if(d.tripFav){favs[d.tripFav]=!favs[d.tripFav];saveFavs();renderTrip();return}
 if(d.tripNote){const el=b.closest('.stopx,.next')?.querySelector('.note-w');if(!el)return;el.hidden=!el.hidden;b.setAttribute('aria-expanded',String(!el.hidden));if(!el.hidden)el.querySelector('textarea').focus({preventScroll:false});return}
 if(d.gchk){const [id,i]=[d.gchk.slice(0,d.gchk.lastIndexOf(':')),+d.gchk.slice(d.gchk.lastIndexOf(':')+1)];const on=new Set(gchk[id]||[]);on.has(i)?on.delete(i):on.add(i);gchk[id]=[...on].sort();write('hk-a-gchk-v1',gchk);document.querySelectorAll(`[data-gchk="${CSS.escape(d.gchk)}"]`).forEach(x=>x.setAttribute('aria-pressed',String(on.has(i))));return}
 if(d.guideDone){const key=d.guideDone.slice(d.guideDone.indexOf('-')+1);setCheck(d.guideDone,true);lastArrive={key,t:Date.now()};delete nextPin[curD.legacy];if(selKey===key)selKey=null;renderTrip();$('selLive').textContent=`${findStop(key)?.[2]||''} 도착`;return}
 if(d.guideSkip){const all=read('hk-skip',{}),L=curD.legacy;all[L]=[...new Set([...(all[L]||[]),d.guideSkip])];write('hk-skip',all);delete nextPin[L];renderTrip();return}
 if('openPick' in d){openPick(b);return}
 if(d.open){openSheet($(d.open),b);return}
 if(d.tools){openTools(d.tools);return}
 if(d.prepOpen){const id=d.prepOpen;openIds.has(id)?openIds.delete(id):openIds.add(id);renderPrep();document.querySelector(`.prow[data-id="${id}"] .lrow`)?.focus({preventScroll:true});return}
 if(d.goto){const el=$(d.goto);if(d.goto==='calc')el.open=true;el.scrollIntoView({block:'start',behavior:BEH()});return}
 if(d.p){S.pax=+d.p;render();return}
 if(d.type){S.type=d.type;render(true);return}
 if(d.area&&b.closest('#stayPick')){S.area=d.area;render(true);return}
 if(d.meal){const [k,v]=d.meal.split(':');S.meal[k]=k==='snack'?!S.meal.snack:v;render();return}
 if(d.detail){openStay(d.detail,b,'sites' in d);return}
 if(b.id==='selectStay'){chooseStay();return}
 if(d.report){report.open(d.report,b);return}
 if('closeReport' in d){const k=report.current;closeSheet($('reportDialog')).then(()=>{S.area=k;save();renderStayPick(true);$('areaChips').querySelector(`[data-area="${k}"]`)?.scrollIntoView({block:'nearest',inline:'center'});pmap?.invalidateSize()});return}
 if('done' in d||b.id==='sheetClose'){closeSheet(b.closest('dialog'));return}
 if('close' in d){closeSheet($('show'));return}
 if('toTalk' in d){toTaxiTalk();return}
 if(d.speak){const [gi,ri]=d.speak.split('-');speakTalk(TALK[gi][2][ri],b);return}
 if(b.classList.contains('talk-main')){showBig('talk',d.t);return}
 if(d.jump){$('tp-talk').style.setProperty('--chips-h',$('talkChips').offsetHeight+'px');$('tg-'+d.jump).querySelector('h3').scrollIntoView({block:'start',behavior:BEH()});return}
 if(d.igCat||d.igArea){if(d.igCat)igCat=d.igCat;else igArea=d.igArea;b.parentElement.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('igList').innerHTML=igList();return}
 if(d.seg){setSeg(d.seg);if(d.seg==='talk')talkTo();return}
});
document.addEventListener('change',e=>{if(e.target.dataset.ex){S.ex[e.target.dataset.ex]=e.target.checked;render()}});
document.addEventListener('input',e=>{const k=e.target.dataset.noteInput;if(!k)return;notes[k]=e.target.value;const ok=saveNotes();e.target.nextElementSibling.textContent=ok?'저장됨':'이 브라우저에서 저장할 수 없어요'});
document.addEventListener('keydown',e=>{if(e.target.matches?.('.atable tr[data-area]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click()}});
document.addEventListener('toggle',e=>{if(e.target.id==='fwDetails'&&e.target.open)loadFares()},true);

/* ══ 탭 ═══════════════════════════════════════════════ */
const TABS=[['prep','준비·예약',paths.prep],['trip','여행',paths.schedule],['me','나',paths.me]];
const TITLE={prep:'준비·예약',me:'나'};
$('tabs').innerHTML='';$('tabs').innerHTML=TABS.map(([k,l,p])=>`<button type="button" role="tab" id="tab-${k}" data-tab="${k}" aria-controls="${k}" aria-selected="false" tabindex="-1">${svg(p,1.7)}<span>${l}</span></button>`).join('');$('tabs').append($('toolsBtn'));
let active=null;
const sv0=read('hk-a-tab-v1',null),sameDay=sv0&&typeof sv0==='object'&&sv0.hkDate===hkDate();
let positions=(mode()!=='trip'||sameDay)?read('hk-a-scroll-v1',{}):{};
function chooseTab(k,{hash=true}={}){if(!TABS.some(t=>t[0]===k)||active===k)return;
 if(active&&active!=='trip'){positions[active]=scrollY;write('hk-a-scroll-v1',positions)}
 active=k;TABS.forEach(([key])=>{$(key).hidden=key!==k;const b=$('tab-'+key);b.setAttribute('aria-selected',String(key===k));b.tabIndex=key===k?0:-1});
 document.body.dataset.appTab=k;write('hk-a-tab-v1',{tab:k,hkDate:hkDate()});
 if(hash&&!/access_token|error_description/.test(location.hash))history.replaceState(history.state,'','#'+k);
 $('inlineBar').textContent=TITLE[k]||'';$('inlineBar').classList.remove('visible');
 if(k==='trip'){fitHalf();if(initTripMap()){tmap.invalidateSize();if(!lastPts.length)drawPins(true)}}
 if(k==='prep')renderPrep();
 requestAnimationFrame(()=>window.scrollTo({top:k==='trip'?0:positions[k]||0,behavior:'instant'}))}
$('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)chooseTab(b.dataset.tab)});
$('tabs').addEventListener('keydown',e=>{const i=TABS.findIndex(t=>t[0]===active);const n=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:null;if(n==null)return;e.preventDefault();chooseTab(TABS[n][0]);$('tab-'+TABS[n][0]).focus()});
const HASH={trip:'trip',schedule:'trip',prep:'prep',quote:'prep',me:'me',talk:'trip'};
addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(HASH[h])chooseTab(HASH[h],{hash:false});if(h==='talk')openTools('talk')});
addEventListener('pagehide',()=>{if(active&&active!=='trip'){positions[active]=scrollY;write('hk-a-scroll-v1',positions)}});
if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(en=>{if(en.target.closest('main').id===active)$('inlineBar').classList.toggle('visible',!en.isIntersecting&&en.boundingClientRect.top<0)}),{threshold:0});document.querySelectorAll('.page>h1').forEach(h=>io.observe(h))}

/* 다른 곳에서 바뀐 숙소·체크 */
window.applyMarks=(k,obj)=>{if(k==='hk-check'){checks=obj;mergeOld()}else if(k==='hk-fav')favs=obj;else if(k==='hk-note')notes=obj;else return;write(k,obj);if(document.activeElement?.dataset?.noteInput!==undefined)return;renderTrip();renderPrep()};
addEventListener('hk-trip-change',()=>{renderTrip({fit:true});render();renderPrep();if($('tools').open&&toolSeg==='taxi')renderTaxi()});
addEventListener('storage',e=>{if(e.key==='hk-trip-state-v1'){renderTrip({fit:true});render()}});

/* ══ 나 — Supabase (base2 내 정보 블록: 호출·키·흐름 그대로, 셀렉터만) ══ */
(()=>{
 if(!window.supabase){$('syncState').textContent='체크·별·메모 — 이 기기에만 저장 (로그인 기능을 불러오지 못했어요)';return}
 const sb=supabase.createClient('https://lamjaczwhytcecbjjqlp.supabase.co','sb_publishable__IfpRW3ny89IHeIsgxIH7A_JYOwDJ4Q');
 const F=ME_FIELDS;let uid=null,timer=null;
 const login=()=>sb.auth.signInWithOAuth({provider:'kakao',options:{redirectTo:location.origin+location.pathname}});
 $('meLogin').onclick=login;document.querySelectorAll('[data-login]').forEach(b=>b.onclick=login);
 $('meLogout').onclick=async()=>{member=false;if(chan){sb.removeChannel(chan);chan=null}await sb.auth.signOut();show(null)};
 async function show(user){
  uid=user?.id||null;$('meOut').hidden=!!uid;$('meIn').hidden=!uid;$('docsOut').hidden=!!uid;$('meFiles').hidden=!uid;
  $('meHint').textContent=uid?'나만 보여요':'항공·여권·숙소·서류';
  if(!uid){hotelBooked=false;$('syncState').textContent='체크·별·메모 — 이 기기에만 저장 · 로그인하면 연주님과 공유';return}
  const nick=user.user_metadata?.name||user.user_metadata?.full_name||user.user_metadata?.preferred_username||'';
  $('meWho').textContent=nick?`카카오 · ${nick}`:'카카오 로그인됨';
  const {data}=await sb.from('my_info').select('data').eq('app',APP).maybeSingle();
  const d=data?.data||{};F.forEach(k=>$('me_'+k).value=d[k]||'');
  if(!d.name&&nick)$('me_name').value=nick;
  if(hotelBooked!==!!(d.hotel||'').trim()){hotelBooked=!!(d.hotel||'').trim();renderTrip();render();renderPrep()}
  files();pullMarks(true);
 }
 const ok=v=>v!==false&&v!==''&&v!=null,readLS=k=>{try{return JSON.parse(localStorage.getItem(k))||{}}catch{return {}}};
 let member=false,sent={},timers={},chan=null;
 async function pullMarks(first){if(!uid)return;if(first){const {data:m}=await sb.from('trip_members').select('user_id').eq('user_id',uid).maybeSingle();member=!!m;$('syncState').textContent=member?'체크·별·메모 — 연주님과 공유 중 · 실시간':'체크·별·메모 — 이 기기에만 저장'}if(!member)return;
  const {data,error}=await sb.from('trip_marks').select('kind,key,value').eq('app',APP);if(error)return;
  const remote={};KINDS.forEach(k=>remote[k]={});(data||[]).forEach(r=>{if(remote[r.kind])remote[r.kind][r.key]=r.value});
  const migrate=first&&(()=>{try{return !localStorage.getItem('hk-marks-migrated')}catch{return false}})();for(const k of KINDS){if(migrate){const add=Object.entries(readLS(k)).filter(([key,v])=>!(key in remote[k])&&ok(v));if(add.length){await sb.from('trip_marks').upsert(add.map(([key,value])=>({app:APP,kind:k,key,value})));add.forEach(([key,v])=>remote[k][key]=v)}}
   sent[k]={...remote[k]};if(JSON.stringify(remote[k])!==JSON.stringify(readLS(k)))window.applyMarks?.(k,{...remote[k]})}
  if(migrate)try{localStorage.setItem('hk-marks-migrated','1')}catch{}
  if(first&&!chan)chan=sb.channel('marks').on('postgres_changes',{event:'*',schema:'public',table:'trip_marks'},p=>{const r=p.eventType==='DELETE'?p.old:p.new;if(!r||!KINDS.includes(r.kind)||(r.app&&r.app!==APP))return;const cur={...(sent[r.kind]||{})};if(p.eventType==='DELETE')delete cur[r.key];else cur[r.key]=r.value;sent[r.kind]=cur;const mine=readLS(r.kind);if(JSON.stringify(cur)!==JSON.stringify(Object.fromEntries(Object.entries(mine).filter(([,v])=>ok(v)))))window.applyMarks?.(r.kind,{...cur})}).subscribe()}
 window.markSync=(k,obj)=>{if(!member)return;clearTimeout(timers[k]);timers[k]=setTimeout(async()=>{const prev=sent[k]||{},up=[],del=[];for(const [key,v] of Object.entries(obj))if(ok(v)&&JSON.stringify(prev[key])!==JSON.stringify(v))up.push({app:APP,kind:k,key,value:v});for(const key of Object.keys(prev))if(!ok(obj[key]))del.push(key);sent[k]=Object.fromEntries(Object.entries(obj).filter(([,v])=>ok(v)));if(up.length)await sb.from('trip_marks').upsert(up);if(del.length)await sb.from('trip_marks').delete().eq('app',APP).eq('kind',k).in('key',del)},k==='hk-note'?700:0)};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')pullMarks(false)});
 async function saveMe(){
  const d={};F.forEach(k=>d[k]=$('me_'+k).value.trim());
  const {error}=await sb.from('my_info').upsert({user_id:uid,app:APP,data:d,updated_at:new Date().toISOString()});
  $('meSaved').textContent=error?'저장 실패 — '+error.message:'저장됨';
  if(!error&&hotelBooked!==!!d.hotel){hotelBooked=!!d.hotel;renderTrip();render();renderPrep()}
 }
 F.forEach(k=>$('me_'+k).addEventListener('input',()=>{$('meSaved').textContent='저장 중…';clearTimeout(timer);timer=setTimeout(saveMe,800)}));
 async function files(){
  const box=$('meFiles');box.textContent='';let filled=0;
  for(const [slot,label] of SLOTS){
   const dir=`${uid}/${APP}/${slot}`;const {data:list}=await sb.storage.from('docs').list(dir,{sortBy:{column:'created_at',order:'desc'}});
   const row=document.createElement('div');row.className='me-file';
   const b=document.createElement('b');b.textContent=label;row.append(b);
   const items=(list||[]).filter(f=>f.name!=='.emptyFolderPlaceholder');
   if(items.length){filled++;
    const sm=document.createElement('small');sm.textContent=items.length+'개';row.append(sm);
    const v=document.createElement('button');v.type='button';v.textContent='보기';
    v.onclick=async()=>{const w=window.open('','_blank');const {data:u}=await sb.storage.from('docs').createSignedUrl(`${dir}/${items[0].name}`,60);if(u&&w)w.location=u.signedUrl;else if(u)location.href=u.signedUrl};
    const del=document.createElement('button');del.type='button';del.className='del';del.textContent='삭제';
    del.onclick=async()=>{if(del.dataset.ok){await sb.storage.from('docs').remove(items.map(f=>`${dir}/${f.name}`));files()}else{del.dataset.ok=1;del.textContent='정말 삭제'}};
    row.append(v,del);
   }
   const up=document.createElement('label');up.className='up';up.textContent=items.length?'바꾸기':'올리기';
   const inp=document.createElement('input');inp.type='file';inp.accept='image/*,application/pdf';
   inp.onchange=async()=>{const f=inp.files[0];if(!f)return;up.textContent='올리는 중…';
    const ext=(f.name.split('.').pop()||'jpg').toLowerCase();
    const {error}=await sb.storage.from('docs').upload(`${dir}/${Date.now()}.${ext}`,f,{contentType:f.type});
    if(!error&&items.length)await sb.storage.from('docs').remove(items.map(x=>`${dir}/${x.name}`));
    if(error)up.textContent='실패 — 다시';else files()};
   up.append(inp);row.append(up);box.append(row);
  }
  $('meDocCount').textContent=`${filled}칸 올림 · 서랍 «서류»에서 보기`;
 }
 sb.auth.onAuthStateChange((e,s)=>{if((s?.user?.id||null)!==uid)show(s?.user||null);if(e==='SIGNED_IN'&&/access_token|code=/.test(location.href)){history.replaceState(null,'',location.pathname+location.search+'#me');dispatchEvent(new HashChangeEvent('hashchange'))}});
})();

/* ══ 시작 ═════════════════════════════════════════════ */
save();renderTrip();render();renderPrep();setSeg(toolSeg,false);
{const h0=location.hash.slice(1),authReturn=/access_token|code=/.test(location.href);let first=null;
 if(authReturn)first='me';else if(HASH[h0])first=HASH[h0];else if(sv0&&typeof sv0==='object'&&TABS.some(t=>t[0]===sv0.tab)&&(mode()!=='trip'||sameDay))first=sv0.tab;
 chooseTab(first||'trip',{hash:!authReturn});
 requestAnimationFrame(()=>{setDetent('half',true);if(initTripMap()){tmap.invalidateSize();drawPins(true)}});
 if(h0==='talk')openTools('talk')}
})();
