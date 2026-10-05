const RAW = { emps:[], left:[], hist:[], ver:"초기" }; // 더는 seed 파일을 쓰지 않음 — 실제 데이터는 전부 Supabase에 있음
let CORP = {"민컴":"민컴퍼니인터내셔널 주식회사","넥스트":"더넥스트제네레이션 주식회사","아마겟돈":"주식회사 아마겟돈 컴퍼니"};
const GRADES = ["S","A","B","C","D"];
const GMULT = {S:1.6,A:1.3,B:1.0,C:0.5,D:0};
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const LSKEY = "salarySim.v1";
const HIST = () => (typeof S!=="undefined" && S && S.hist) ? S.hist : RAW.hist;

/* ---------- 유틸 ---------- */
const $ = s => document.querySelector(s);
const won = n => (n==null||isNaN(n)) ? "-" : Math.round(n).toLocaleString("ko-KR");
const man = n => { if(n==null||isNaN(n)) return "-"; const a=Math.abs(n); const s=n<0?"−":"";
  if(a>=1e8){ return s+(a/1e8).toFixed(2).replace(/\.?0+$/,"")+"억"; } return s+Math.round(a/1e4).toLocaleString("ko-KR")+"만"; };
const sg = n => (n==null||isNaN(n)) ? "-" : (n<0?"−":"+")+Math.round(Math.abs(n)/1e4).toLocaleString("ko-KR");
const sgw = n => (n==null||isNaN(n)) ? "-" : (n<0?"−":"+")+Math.round(Math.abs(n)).toLocaleString("ko-KR");
const wm = n => (n==null||isNaN(n)) ? "-" : Math.round(n/1e4).toLocaleString("ko-KR");
const pct = (n,d=1) => (n==null||isNaN(n)||!isFinite(n)) ? "-" : (n).toFixed(d)+"%";
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const coTag = c => `<span class="co" style="--cc:var(--c-${esc(c)})">${esc(c)}</span>`;
const coRow = c => `data-co="${esc(c)}" style="--cc:var(--c-${esc(c)})"`;
const coOrder = c => { const i=Object.keys(CORP).indexOf(c); return i<0? 99 : i; };
const pd = s => { if(!s) return null; const m=String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m? new Date(+m[1],+m[2]-1,+m[3]) : null; };
const ymd = d => d? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` : "";
const addM = (d,m) => new Date(d.getFullYear(), d.getMonth()+m, d.getDate());
const monthsBetween = (a,b) => (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth()) - (b.getDate()<a.getDate()?1:0);
const tenure = h => { const d=pd(h); if(!d) return "-"; const m=monthsBetween(d,TODAY); return m<12? `${m}개월` : `${Math.floor(m/12)}년 ${m%12}개월`; };
const median = a => { if(!a.length) return NaN; const s=[...a].sort((x,y)=>x-y); const k=s.length>>1; return s.length%2? s[k] : (s[k-1]+s[k])/2; };
const sum = (a,f=x=>x) => a.reduce((s,x)=>s+f(x),0);
const uid = () => Math.random().toString(36).slice(2,9);

/* ---------- 기본 상태 ---------- */
function fromRaw(e){ const x={ id: uid(), co:e.co, name:e.name, dept:e.dept, pos:e.pos, type:e.type, hire:e.hire,
    ann:e.ann, meal:e.meal||200000, fund:e.fund||"", inc: !e.exec, grade:"B", rate:null, plan:"", memo: e.exec? "임원 (기본 제외)":"", exec:e.exec };
  x.plan=ymd(defaultPlan(x)); if(e.left) x.left=e.left; return x; }
function defaultState(){
  const emps = RAW.emps.map(fromRaw);
  const s = {
    v:1, dataVer:RAW.ver, emps, left:(RAW.left||[]).map(fromRaw),
    set:{ round:100000, mealExempt:200000, minHour:10700, minHours:209, cycle:12,
          np:4.75, npCap:6370000, npFloor:400000, hi:3.595, ltc:13.14, ei:1.15, ia:0.7, sevOn:true,
          crLow:90, crHigh:110, base:7, year: TODAY.getMonth()>=9 ? TODAY.getFullYear()+1 : TODAY.getFullYear(), corpBasis:"sal" },
    matrix:null, mids:{}, guide:{S:10,A:20,B:40,C:20,D:10}, budget:{"민컴":0,"넥스트":0,"아마겟돈":0}, rev:{unit:"year",sales:{},other:{},target:{}},
    bulk:{ scope:"all", corp:{}, person:{}, pCo:"all", mode:"rate", rate:5, fixed:2000000, mixRate:3, mixFixed:1000000,
           bands:[{upTo:30000000,rate:8},{upTo:40000000,rate:6},{upTo:50000000,rate:5},{upTo:null,rate:4}] }
  };
  s.matrix = genMatrix(s.set.base);
  s.mids = avgMids(emps);
  return s;
}
function genMatrix(base){
  const m={}; GRADES.forEach(g=>{ const b=base*GMULT[g]; m[g]=[+(b*1.25).toFixed(1), +b.toFixed(1), +(b*0.75).toFixed(1)]; }); return m;
}
function avgMids(emps){
  const g={}; emps.filter(e=>!e.exec).forEach(e=>{ (g[e.pos]=g[e.pos]||[]).push(e.ann); });
  const o={}; Object.keys(g).forEach(k=> o[k]=Math.round(sum(g[k])/g[k].length/1e6)*1e6); return o;
}
// 마지막 인상일(입사일이 같은 이력만) 또는 입사일 + 주기 → 다음달 1일
function defaultPlan(e, cycle=12){
  const pend = HIST().find(h=>h.pending && h.name===e.name && h.date);
  if(pend) return pd(pend.date);
  const hire = pd(e.hire);
  const own = HIST().filter(h=>!h.pending && h.name===e.name && h.date).map(h=>pd(h.date));
  let last = own.length ? new Date(Math.max(...own)) : hire;
  if(hire && last < hire) last = hire;
  if(!last) return null;
  let d = addM(last, cycle);
  if(d.getDate()!==1) d = new Date(d.getFullYear(), d.getMonth()+1, 1);
  if(e.exec) while(d < TODAY) d = addM(d, cycle); // 임원은 다음 도래일로
  return d;
}
function lastRaise(e){
  const own = HIST().filter(h=>!h.pending && h.name===e.name && h.date).sort((a,b)=>a.date<b.date?1:-1);
  return own[0]||null;
}

let S = window.__CLOUD_STATE || defaultState();
if(!S || S.v!==1) S = defaultState();
// 인사사항 데이터가 새로 들어오면 저장된 입력값(등급·인상률·예정일·메모)은 살리고 명단은 최신으로 맞춤
// 예전에는 여기서 seed.js(원본 시트)가 갱신될 때마다 명단을 다시 맞추고 등급·인상률 등 입력값만
// 살리는 병합을 했음. 이제 seed가 없고 Supabase가 유일한 원본이라 이 병합은 더 이상 쓰지 않음 —
// 남겨뒀다면 RAW.emps가 항상 비어 있어서 실행할 때마다 전체 명단이 지워짐(실제로 겪은 버그).
if(!S.left) S.left=[];
let __pendingEdit=true;
let __saveTimer=null, __saveFailed=false;
function persist(){
  try{ localStorage.setItem(LSKEY, JSON.stringify(S)); }catch(e){} // 네트워크 끊겼을 때를 위한 로컬 백업
  clearTimeout(__saveTimer);
  __saveTimer = setTimeout(async ()=>{
    try{
      const { error } = await window.__sb.from("app_state").upsert({ id:1, data:S, updated_at:new Date().toISOString() });
      if(error) throw error;
      if(__saveFailed){ __saveFailed=false; toast("클라우드에 다시 저장되었습니다"); }
    }catch(e){ console.error(e); if(!__saveFailed){ __saveFailed=true; toast("클라우드 저장 실패 — 인터넷 연결을 확인하세요"); } }
  }, 600);
}

/* ---------- 계산 ---------- */
function roundTo(x){ const u=S.set.round||1; return Math.round(x/u)*u; }
function crOf(e){ const m=S.mids[e.pos]; return m? e.ann/m*100 : 100; }
function crBand(cr){ return cr < S.set.crLow ? 0 : (cr > S.set.crHigh ? 2 : 1); }
function recRate(e){ const r=S.matrix[e.grade]; return r? r[crBand(crOf(e))] : 0; }
function finalRate(e){ return (e.rate===null||e.rate===""||isNaN(e.rate)) ? recRate(e) : +e.rate; }
function monthlyOf(ann){ return Math.floor(ann/12); }
// 회사 부담 연간 인건비(연봉 + 4대보험 사업주분 + 퇴직급여)
function costOf(ann, meal){
  const st=S.set, m=monthlyOf(ann), tax=Math.max(0, m - Math.min(meal, st.mealExempt));
  const np = Math.min(Math.max(tax, st.npFloor), st.npCap) * st.np/100;
  const hi = tax*st.hi/100, ltc = hi*st.ltc/100, ei = tax*st.ei/100, ia = tax*st.ia/100;
  const ins = (np+hi+ltc+ei+ia)*12;
  const sev = st.sevOn ? ann/12 : 0;
  return { ins, sev, total: ann+ins+sev };
}
function calc(e, rateOverride){
  const rate = rateOverride!=null ? rateOverride : finalRate(e);
  const newAnn = roundTo(e.ann*(1+rate/100));
  return calcNew(e, newAnn, rate);
}
function calcNew(e, newAnn, rate){
  const inc = newAnn - e.ann, eff = e.ann? inc/e.ann*100 : 0;
  const nm = monthlyOf(newAnn), base = nm - e.meal;
  const minM = S.set.minHour*S.set.minHours;
  const c0 = costOf(e.ann,e.meal), c1 = costOf(newAnn,e.meal);
  const plan = pd(e.plan); const Y=+S.set.year;
  let months = 0;
  if(plan){ if(plan.getFullYear()<Y) months=12; else if(plan.getFullYear()===Y) months = 12-plan.getMonth(); }
  const yearCost = (c1.total-c0.total)/12*months;
  return { rate, newAnn, inc, eff, nm, base, minOk: nm>=minM, minM, cost0:c0.total, cost1:c1.total, costInc:c1.total-c0.total, yearCost, months };
}
const inScope = e => !S.coFilter || e.co===S.coFilter;
const incl = () => S.emps.filter(e=>e.inc && inScope(e));
const allCorps = () => [...new Set([...Object.keys(CORP), ...S.emps.map(e=>e.co)])].sort((a,b)=>coOrder(a)-coOrder(b));
const corps = () => allCorps().filter(c=>!S.coFilter || c===S.coFilter);

/* ---------- 렌더: 공통 ---------- */
function renderAll(){ renderHeader(); renderDash(); renderReport(); renderPlan(); renderBulk(); renderCorp(); renderRule(); renderHist(); renderSet(); persist(); }
function renderHeader(){
  if(S.coFilter && !allCorps().includes(S.coFilter)) S.coFilter="";
  const all=allCorps();
  $("#coF").innerHTML = `<button data-cf="" class="${S.coFilter?"":"on"}">전체 법인 <i>${S.emps.filter(e=>e.inc).length}명</i></button>`+
    all.map(c=>`<button data-cf="${esc(c)}" style="--cc:var(--c-${esc(c)})" class="${S.coFilter===c?"on":""}">${esc(c)} <i>${S.emps.filter(e=>e.inc&&e.co===c).length}명</i></button>`).join("");
  document.body.classList.toggle("scoped", !!S.coFilter);
  document.body.style.setProperty("--cc", S.coFilter? `var(--c-${S.coFilter})` : "");
  $("#coScope").innerHTML = S.coFilter? `${esc(CORP[S.coFilter]||S.coFilter)} (${esc(S.coFilter)})만 보고 있습니다 — 모든 탭의 숫자가 이 법인 기준입니다 <button data-cf="">전체 법인 보기</button>` : "";
  const n=incl().length;
  $("#hsub").textContent = `재직 ${S.emps.length}명 (퇴사 처리 ${S.left.length}명 제외) · 협상 포함 ${n}명`;
}

/* ---------- 대시보드 ---------- */
function renderDash(){
  const L=incl(), R=L.map(e=>({e,r:calc(e)}));
  const a0=sum(L,e=>e.ann), a1=sum(R,x=>x.r.newAnn), c0=sum(R,x=>x.r.cost0), c1=sum(R,x=>x.r.cost1), yc=sum(R,x=>x.r.yearCost);
  const rates=R.map(x=>x.r.eff);
  $("#dashKpi").innerHTML = [
    ["협상 포함 인원", L.length+"명", `전체 등록 ${S.emps.length}명`],
    ["연봉 총액 (현재)", man(a0)+"원", wm(a0)+"만원"],
    ["연봉 총액 (협상 후)", man(a1)+"원", `+${wm(a1-a0)}만원`],
    ["평균 인상률", pct(a0? (a1-a0)/a0*100 : 0), `단순평균 ${pct(sum(rates)/(rates.length||1))} · 중앙값 ${pct(median(rates))}`],
    ["회사 부담 인건비 증가", man(c1-c0)+"원", `4대보험·퇴직급여 포함 연간`],
    [`${S.set.year}년 반영분`, man(yc)+"원", `적용월부터 ${S.set.year}년 말까지`]
  ].map(k=>`<div class="kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div><div class="s">${k[2]}</div></div>`).join("");

  const cs=corps(); const max=Math.max(1,...cs.map(c=>sum(R.filter(x=>x.e.co===c),x=>x.r.newAnn)));
  $("#dashBars").innerHTML = cs.map(c=>{ const rr=R.filter(x=>x.e.co===c); const x0=sum(rr,x=>x.e.ann), x1=sum(rr,x=>x.r.newAnn);
    return `<div class="cb"><div class="t"><span>${coTag(c)} <span class="muted">${rr.length}명</span></span><span>${man(x0)} → <b>${man(x1)}</b> <span class="up">(${pct(x0?(x1-x0)/x0*100:0)})</span></span></div>
    <div class="b"><i class="a" style="width:${x0/max*100}%"></i><i class="n" style="width:${x1/max*100}%"></i></div></div>`; }).join("");

  // 경고
  const al=[];
  R.filter(x=>!x.r.minOk && !x.e.exec).forEach(x=>al.push(["bad",`${x.e.name}(${x.e.co}) 협상 후 월 급여 ${won(x.r.nm)}원이 최저임금 월 환산액 ${won(x.r.minM)}원보다 낮습니다.`]));
  S.emps.filter(e=>{ if(e.exec) return false; const m=monthlyOf(e.ann); return m < S.set.minHour*S.set.minHours; }).forEach(e=>al.push(["warn",`${e.name}(${e.co}) 현재 월 급여 ${won(monthlyOf(e.ann))}원이 설정된 최저임금(${won(S.set.minHour)}원/시간) 기준에 못 미칩니다. 적용 시점 전에 조정이 필요합니다.`]));
  cs.forEach(c=>{ const b=S.budget[c]; if(!b) return; const used=corpUse(c); if(used>b) al.push(["bad",`${c} 인상 예산 ${man(b)}원을 ${man(used-b)}원 초과했습니다.`]); });
  R.filter(x=>x.e.rate!==null && x.e.rate!=="" && Math.abs(x.r.rate-recRate(x.e))>=3).forEach(x=>al.push(["warn",`${x.e.name}: 최종 ${pct(x.r.rate)} — 권장 ${pct(recRate(x.e))}와 ${Math.abs(x.r.rate-recRate(x.e)).toFixed(1)}%p 차이. 협상 근거 메모를 남겨 두세요.`]));
  const gd=gradeDist(L), top=(gd.S||0)+(gd.A||0), guideTop=S.guide.S+S.guide.A;
  if(L.length && top/L.length*100 > guideTop+10) al.push(["warn",`S·A 등급이 ${pct(top/L.length*100,0)}로 가이드(${guideTop}%)보다 많습니다.`]);
  ensureRev(); cs.forEach(c=>{ const sales=annSales(c), t=+S.rev.target[c]||0; if(!sales||!t) return; const r=laborCost(c,e=>calc(e).newAnn)/sales*100; if(r>t) al.push(["bad",`${c}: 협상 후 매출 대비 인건비율(${pct(r)})이 목표 ${t}%를 넘습니다.`]); });
  const overdue = L.filter(e=>{ const d=pd(e.plan); return d && d<TODAY && monthsBetween(d,TODAY)>=1; });
  overdue.forEach(e=>al.push(["warn",`${e.name}: 협상 예정일(${e.plan})이 지났습니다. 진행 여부를 확인하세요.`]));
  $("#dashAlerts").innerHTML = al.length? al.map(a=>`<div class="alert ${a[0]}">${esc(a[1])}</div>`).join("") : `<div class="alert ok">현재 입력값 기준으로 문제가 없습니다.</div>`;

  // 예정자
  const due = S.emps.filter(e=>e.inc && e.plan).map(e=>({e,d:pd(e.plan)})).sort((a,b)=>a.d-b.d);
  $("#dashDue").innerHTML = `<thead><tr><th class="l">예정일</th><th class="c">D-day</th><th class="l">법인</th><th class="l">성명</th><th class="l">부서·직위</th><th>근속</th><th class="l">최근 인상</th><th>현재 연봉</th><th class="c">등급</th><th>최종 인상률</th><th>협상 후 연봉</th></tr></thead><tbody>`+
    due.map(({e,d})=>{ const dd=Math.round((d-TODAY)/864e5); const r=calc(e); const lr=lastRaise(e);
      const tag = dd<0? `<span class="tag bad">${-dd}일 지남</span>` : dd<=60? `<span class="tag warn">D-${dd}</span>` : `<span class="tag">D-${dd}</span>`;
      return `<tr ${coRow(e.co)}><td class="l">${e.plan}</td><td class="c">${tag}</td><td class="l">${coTag(e.co)}</td><td class="l"><button class="namebtn" data-p="${e.id}">${esc(e.name)}</button></td><td class="l">${esc(e.dept)} · ${esc(e.pos)}</td><td>${tenure(e.hire)}</td><td class="l">${lr? `${lr.date} (${pct(lr.rate)})` : '<span class="muted">없음</span>'}</td><td>${wm(e.ann)}</td><td class="c">${e.grade}</td><td>${pct(r.rate)}</td><td><b>${wm(r.newAnn)}</b></td></tr>`; }).join("")+"</tbody>";
}
function gradeDist(L){ const g={}; L.forEach(e=>g[e.grade]=(g[e.grade]||0)+1); return g; }

/* ---------- 개인별 협상표 ---------- */
function renderPlan(){
  const cs=corps(); const sel=$("#pCo"), cur=sel.value||"all";
  sel.innerHTML = `<option value="all">전체</option>`+cs.map(c=>`<option ${c===cur?"selected":""}>${c}</option>`).join("");
  const due=$("#pDue").value, only=$("#pOnlyInc").checked;
  let L=S.emps.filter(e=>inScope(e) && (cur==="all"||e.co===cur) && (!only||e.inc));
  if(due!=="all"){ const lim=addM(TODAY,+due); L=L.filter(e=>{const d=pd(e.plan); return d && d<=lim;}); }
  L.sort((a,b)=>coOrder(a.co)-coOrder(b.co) || ((a.plan||"9")<(b.plan||"9")?-1:(a.plan||"9")>(b.plan||"9")?1:0));
  const head=`<thead><tr><th class="c">포함</th><th class="l">법인</th><th class="l">성명 · 직위</th><th class="l">협상 예정일</th><th>현재 연봉</th><th class="c">평가</th><th title="직위 기준연봉 대비 현재 연봉">연봉 위치</th><th>최종 인상률 (%)</th><th>협상 후 연봉</th><th>월 급여 (원)</th><th class="c">최저임금</th><th>인건비 증가</th><th class="l">메모</th><th></th></tr></thead>`;
  const rows=L.map(e=>{ const r=calc(e), cr=crOf(e), b=crBand(cr); const ov=!(e.rate===null||e.rate==="");
    return `<tr class="${e.inc?"":"off"}" data-id="${e.id}" ${coRow(e.co)}>
      <td class="c"><input type="checkbox" data-f="inc" ${e.inc?"checked":""} style="width:17px;height:17px"></td>
      <td class="l">${coTag(e.co)}</td>
      <td class="l"><button class="namebtn" data-p="${e.id}">${esc(e.name)}</button>${e.type==="계약직"?' <span class="tag">계약</span>':""}${e.inc? ` <button class="btn sm pri rpbtn" data-rp="${e.id}" title="${planYm(e)} 귀속 보고 페이지">보고서</button>` : ""}<span class="sub">${esc(e.pos)} · 근속 ${tenure(e.hire)}</span></td>
      <td class="l"><input type="date" data-f="plan" value="${e.plan||""}"></td>
      <td><input type="number" class="w90" data-f="ann" value="${e.ann/1e4}" step="100"></td>
      <td class="c"><select data-f="grade" style="font-weight:700">${GRADES.map(g=>`<option ${g===e.grade?"selected":""}>${g}</option>`).join("")}</select></td>
      <td><span class="tag ${b===0?"acc":b===2?"warn":""}">${b===0?"낮음":b===2?"높음":"적정"} ${cr.toFixed(0)}%</span></td>
      <td><input type="number" class="w60 ${ov?"ovr":""}" data-f="rate" step="0.1" value="${ov?+(+e.rate).toFixed(2):""}" placeholder="${recRate(e)}"><span class="sub">권장 ${pct(recRate(e))}</span></td>
      <td><b style="font-size:15.5px">${wm(r.newAnn)}</b><span class="sub"><span class="up">+${wm(r.inc)}</span> · 실제 ${pct(r.eff)}</span></td>
      <td>${won(r.nm)}<span class="sub">기본급 ${won(r.base)}</span></td>
      <td class="c">${r.minOk?'<span class="tag good">충족</span>':'<span class="tag bad">미달</span>'}</td>
      <td>${wm(r.costInc)}</td>
      <td class="l"><input type="text" class="w140" data-f="memo" value="${esc(e.memo||"")}" placeholder="협상 근거"></td>
      <td><button class="btn sm" data-del="${e.id}" title="명단에서 삭제">삭제</button></td></tr>`; }); let rowsH="", lastCo=null; L.forEach((e,i)=>{ if(e.co!==lastCo){ lastCo=e.co; const G=L.filter(x=>x.co===e.co && x.inc), g0=sum(G,x=>x.ann), g1=sum(G,x=>calc(x).newAnn);
      rowsH+=`<tr class="grp" ${coRow(e.co)}><td colspan="14">${coTag(e.co)} ${esc(CORP[e.co]||e.co)} <span class="muted" style="font-weight:500">· ${L.filter(x=>x.co===e.co).length}명 (포함 ${G.length})</span><span class="gsum">연봉 ${wm(g0)} → <b>${wm(g1)}</b>만원 · ${sg(g1-g0)} (${pct(g0?(g1-g0)/g0*100:0)}) · 인건비 ${sg(sum(G,x=>calc(x).costInc))}</span></td></tr>`; }
      rowsH+=rows[i]; });

  const R=L.filter(e=>e.inc).map(e=>({e,r:calc(e)}));
  const a0=sum(R,x=>x.e.ann), a1=sum(R,x=>x.r.newAnn);
  const foot=`<tfoot><tr><td colspan="4" class="l">합계 (포함 ${R.length}명)</td><td>${wm(a0)}</td><td></td><td></td><td>${pct(a0?(a1-a0)/a0*100:0)}</td><td>${wm(a1)}<span class="sub"><span class="up">+${wm(a1-a0)}</span></span></td><td>${won(sum(R,x=>x.r.nm))}</td><td></td><td>${wm(sum(R,x=>x.r.costInc))}</td><td colspan="2"></td></tr></tfoot>`;
  $("#planTbl").innerHTML = head+"<tbody>"+rowsH+"</tbody>"+foot;
}
$("#planTbl").addEventListener("change", ev=>{
  const t=ev.target, tr=t.closest("tr[data-id]"); if(!tr) return; const e=S.emps.find(x=>x.id===tr.dataset.id); const f=t.dataset.f; if(!f) return;
  if(f==="inc") e.inc=t.checked;
  else if(f==="ann") e.ann=Math.round((+t.value||0)*1e4);
  else if(f==="rate") e.rate = t.value===""? null : +t.value;
  else e[f]=t.value;
  renderAll();
});
$("#planTbl").addEventListener("click", ev=>{
  const d=ev.target.dataset.del; if(!d) return; const i=S.emps.findIndex(x=>x.id===d); const removed=S.emps.splice(i,1)[0];
  renderAll(); toast(`${removed.name} 삭제됨`, ()=>{ S.emps.splice(i,0,removed); renderAll(); });
});
["#pCo","#pDue","#pOnlyInc"].forEach(s=>$(s).addEventListener("change",renderPlan));
$("#pReset").onclick=()=>{ const prev=S.emps.map(e=>e.rate); S.emps.forEach(e=>e.rate=null); renderAll(); toast("최종 인상률을 권장값으로 되돌렸습니다",()=>{ S.emps.forEach((e,i)=>e.rate=prev[i]); renderAll(); }); };
$("#pAdd").onclick=()=>{ const co=corps()[0]||"민컴"; const e={id:uid(),manual:true,co,name:"새 직원",dept:"",pos:"매니저",type:"정규직",hire:ymd(TODAY),ann:30000000,meal:200000,inc:true,grade:"B",rate:null,plan:ymd(addM(TODAY,12)),memo:""};
  S.emps.unshift(e); renderAll(); openPerson(e.id,true); };

/* ---------- 시뮬레이터 ---------- */
function ensureBulk(){
  const b=S.bulk; if(!b.scope) b.scope="all";
  if(!b.corp) b.corp={};
  corps().forEach(c=>{ if(!b.corp[c]) b.corp[c]={rate:5,fixed:0}; });
  if(!b.person) b.person={};
  if(!b.pCo) b.pCo="all";
}
function personSim(e){ // 개인별: 없으면 협상표 최종 인상률로 시작
  let p=S.bulk.person[e.id];
  if(!p){ p=S.bulk.person[e.id]={m:"rate",v:+finalRate(e).toFixed(2)}; }
  return p;
}
function simNew(e){
  const b=S.bulk;
  if(b.scope==="corp"){ const c=b.corp[e.co]||{rate:0,fixed:0}; return roundTo(e.ann*(1+(+c.rate||0)/100) + (+c.fixed||0)); }
  if(b.scope==="person"){ const p=personSim(e), v=+p.v||0;
    if(p.m==="amt") return roundTo(e.ann+v);
    if(p.m==="target") return v>0? v : e.ann;
    return roundTo(e.ann*(1+v/100)); }
  if(b.mode==="rate") return roundTo(e.ann*(1+b.rate/100));
  if(b.mode==="fixed") return roundTo(e.ann+ +b.fixed);
  if(b.mode==="mix") return roundTo(e.ann*(1+b.mixRate/100) + +b.mixFixed);
  return roundTo(e.ann*(1+bandOf(e.ann).rate/100));
}
function bulkRate(e){ return {newAnn: simNew(e)}; }
function bandOf(ann){ const bs=S.bulk.bands; for(const b of bs){ if(b.upTo==null || ann < b.upTo) return b; } return bs[bs.length-1]; }
function bandLabel(i){ const bs=S.bulk.bands, lo=i?bs[i-1].upTo:0, hi=bs[i].upTo; return hi==null? `${man(lo)} 이상` : (lo? `${man(lo)} ~ ${man(hi)} 미만` : `${man(hi)} 미만`); }
const SCOPE_NAME={all:"전체 일괄안",corp:"법인별안",person:"개인별안"};

function renderBulk(){
  ensureBulk();
  const b=S.bulk;
  document.querySelectorAll("#bScope button").forEach(x=>x.classList.toggle("on",x.dataset.s===b.scope));
  document.querySelectorAll("#bMode button").forEach(x=>x.classList.toggle("on",x.dataset.m===b.mode));
  $("#bMode").style.display = b.scope==="all"? "" : "none";
  $("#rvCard").style.display = b.scope==="all"? "" : "none";
  $("#bPeopleCard").style.display = b.scope==="person"? "none" : "";
  let h="";
  if(b.scope==="all"){
    if(b.mode==="rate") h=`<div class="row"><label>전원 인상률 <input type="range" min="0" max="20" step="0.5" id="biR" value="${b.rate}" style="width:220px"> <input type="number" class="w60" id="biRn" step="0.1" value="${b.rate}"> %</label></div>`;
    if(b.mode==="fixed") h=`<div class="row"><label>전원 인상액 <input type="number" class="w90" id="biF" step="10" value="${b.fixed/1e4}"> 만원 (연봉 기준)</label><span class="muted">저연봉자일수록 인상률이 높아져 격차가 줄어듭니다.</span></div>`;
    if(b.mode==="mix") h=`<div class="row"><label>정률 <input type="number" class="w60" id="biMR" step="0.1" value="${b.mixRate}"> %</label><label>+ 정액 <input type="number" class="w90" id="biMF" step="10" value="${b.mixFixed/1e4}"> 만원</label></div>`;
    if(b.mode==="band") h=`<p class="desc" style="margin:0 0 8px">현재 연봉이 속한 구간의 인상률을 적용합니다. 상한을 비우면 '이상' 구간입니다.</p><div class="tw" style="max-width:560px"><table><thead><tr><th class="l">구간</th><th>상한 (미만, 만원)</th><th>인상률(%)</th><th>인원</th><th></th></tr></thead><tbody>`+
        b.bands.map((x,i)=>`<tr><td class="l">${bandLabel(i)}</td><td><input type="number" class="w140" data-bu="${i}" step="500" value="${x.upTo==null?"":x.upTo/1e4}" placeholder="상한 없음"></td><td><input type="number" class="w60" data-br="${i}" step="0.1" value="${x.rate}"></td><td>${incl().filter(e=>bandOf(e.ann)===x).length}명</td><td>${b.bands.length>1?`<button class="btn sm" data-bx="${i}">삭제</button>`:""}</td></tr>`).join("")+
        `</tbody></table></div><div class="row" style="margin-top:8px"><button class="btn sm" id="bAddBand">구간 추가</button></div>`;
  }
  if(b.scope==="corp"){
    h=`<p class="desc" style="margin:0 0 8px">법인마다 정률(%)과 정액(만원)을 따로 넣습니다. 둘 다 넣으면 「연봉 × (1+인상률) + 인상액」입니다. 인상 예산은 「법인별 분석」 탭과 같은 값을 씁니다.</p>
    <div class="row" style="margin-bottom:8px"><label>모든 법인에 <input type="number" class="w60" id="bcAll" step="0.1" value="5"> %</label><button class="btn sm" id="bcAllBtn">한 번에 넣기</button><button class="btn sm" id="bcHist">법인별 최근 12개월 평균 인상률로 채우기</button><button class="btn sm" id="bcMerit">평가 기반안 인상률로 채우기</button></div>
    <div class="tw"><table id="bcTbl"></table></div>`;
  }
  if(b.scope==="person"){
    const cs=corps();
    h=`<p class="desc" style="margin:0 0 8px">한 사람씩 <b>인상률(%)</b>, <b>인상액(만원)</b>, <b>목표 연봉(만원)</b> 중 편한 방식으로 넣습니다. 처음에는 협상표의 최종 인상률로 채워져 있습니다.</p>
    <div class="row" style="margin-bottom:8px"><label>법인 <select id="bpCo"><option value="all">전체</option>${cs.map(c=>`<option ${c===b.pCo?"selected":""}>${c}</option>`).join("")}</select></label>
      <div class="spacer"></div>
      <button class="btn sm" id="bpFromPlan">협상표 값으로 다시 채우기</button><button class="btn sm" id="bpFromRec">권장 인상률로 채우기</button><button class="btn sm" id="bpZero">모두 0%</button></div>
    <div class="tw" style="max-height:62vh"><table id="bpTbl"></table></div>`;
  }
  $("#bInputs").innerHTML=h;
  if(b.scope==="corp") renderCorpSimTbl();
  if(b.scope==="person") renderPersonSimTbl();
  renderBulkResults();
}
function corpSimRow(c){
  const L=incl().filter(e=>e.co===c), x=S.bulk.corp[c];
  const a0=sum(L,e=>e.ann), a1=sum(L,e=>simNew(e)), cinc=sum(L,e=>{ const n=simNew(e); return costOf(n,e.meal).total-costOf(e.ann,e.meal).total; });
  const bud=S.budget[c]||0, use=a1-a0, p=bud? use/bud*100 : null;
  const effs=L.map(e=>e.ann?(simNew(e)-e.ann)/e.ann*100:0);
  return {L,x,a0,a1,cinc,bud,use,p,effs};
}
function renderCorpSimTbl(){
  const cs=corps();
  $("#bcTbl").innerHTML=`<thead><tr><th class="l">법인</th><th>인원</th><th>현재 연봉 총액</th><th>인상률(%)</th><th>+ 인상액 (만원)</th><th>인상 후 총액</th><th>증가액</th><th>실제 인상률</th><th>개인별 범위</th><th>인건비 증가</th><th>매출 대비 인건비율</th><th>인상 예산</th><th>소진</th><th></th></tr></thead><tbody>`+
    cs.map(c=>{ const r=corpSimRow(c);
      return `<tr data-c="${esc(c)}" ${coRow(c)}><td class="l">${coTag(c)}</td><td>${r.L.length}</td><td>${wm(r.a0)}</td>
      <td><input type="number" class="w60" data-cr step="0.1" value="${r.x.rate}"></td>
      <td><input type="number" class="w90" data-cf step="10" value="${r.x.fixed/1e4}"></td>
      <td data-o="a1"><b>${wm(r.a1)}</b></td><td data-o="inc" class="up">+${wm(r.a1-r.a0)}</td><td data-o="eff">${pct(r.a0?(r.a1-r.a0)/r.a0*100:0)}</td>
      <td data-o="rng">${r.effs.length? pct(Math.min(...r.effs))+" ~ "+pct(Math.max(...r.effs)) : "-"}</td><td data-o="cost">+${wm(r.cinc)}</td><td data-o="ratio">${ratioCell(c)}</td>
      <td><input type="number" class="w90" data-cb step="100" value="${r.bud? r.bud/1e4 : ""}" placeholder="미입력"></td>
      <td data-o="p" style="min-width:120px">${budCell(r)}</td>
      <td><button class="btn sm" data-fit ${r.bud?"":"disabled"} title="정액은 그대로 두고 예산에 맞는 인상률을 계산">예산에 맞추기</button></td></tr>`; }).join("")+
    `</tbody><tfoot><tr><td class="l">합계</td><td>${incl().length}</td><td>${wm(sum(incl(),e=>e.ann))}</td><td></td><td></td><td id="bcT1"></td><td id="bcT2"></td><td id="bcT3"></td><td></td><td id="bcT4"></td><td></td><td>${wm(sum(cs,c=>S.budget[c]||0))}</td><td></td><td></td></tr></tfoot>`;
  updateCorpSimTotals();
}
function ratioCell(c){ const sales=annSales(c); if(!sales) return '<span class="muted">매출 미입력</span>'; return pct(laborCost(c)/sales*100)+" → "+ratioTag(laborCost(c,simNew)/sales*100, +S.rev.target[c]||0); }
function budCell(r){ return r.p==null?'<span class="muted">-</span>':`<div class="bar ${r.p>100?"over":""}"><i style="width:${Math.min(100,r.p)}%"></i></div><span style="font-size:11.5px" class="${r.p>100?"up":"muted"}">${pct(r.p,0)} · 잔여 ${man(r.bud-r.use)}</span>`; }
function updateCorpSimRows(){
  document.querySelectorAll("#bcTbl tbody tr[data-c]").forEach(tr=>{ const r=corpSimRow(tr.dataset.c); const o=k=>tr.querySelector(`[data-o="${k}"]`);
    o("a1").innerHTML=`<b>${wm(r.a1)}</b>`; o("inc").textContent=`+${wm(r.a1-r.a0)}`; o("eff").textContent=pct(r.a0?(r.a1-r.a0)/r.a0*100:0);
    o("rng").textContent=r.effs.length? pct(Math.min(...r.effs))+" ~ "+pct(Math.max(...r.effs)) : "-"; o("cost").textContent=`+${wm(r.cinc)}`; o("ratio").innerHTML=ratioCell(tr.dataset.c); o("p").innerHTML=budCell(r);
    tr.querySelector("[data-fit]").disabled=!r.bud; });
  updateCorpSimTotals();
}
function updateCorpSimTotals(){
  const L=incl(), a0=sum(L,e=>e.ann), a1=sum(L,e=>simNew(e)), ci=sum(L,e=>costOf(simNew(e),e.meal).total-costOf(e.ann,e.meal).total);
  $("#bcT1").textContent=wm(a1); $("#bcT2").textContent="+"+wm(a1-a0); $("#bcT3").textContent=pct(a0?(a1-a0)/a0*100:0); $("#bcT4").textContent="+"+wm(ci);
}
function fitCorp(c){ // 정액 유지, 예산(연봉 증가) 이내 최대 인상률(0.1% 단위)
  const x=S.bulk.corp[c], bud=S.budget[c]||0, L=incl().filter(e=>e.co===c); if(!bud||!L.length) return;
  const use=r=>sum(L,e=>roundTo(e.ann*(1+r/100)+(+x.fixed||0))-e.ann);
  let lo=-50, hi=100; for(let k=0;k<60;k++){ const m=(lo+hi)/2; if(use(m)>bud) hi=m; else lo=m; }
  x.rate=Math.floor(lo*10)/10;
}
function personRow(e){
  const p=personSim(e), n=simNew(e), r=calcNew(e,n,e.ann?(n-e.ann)/e.ann*100:0), fr=finalRate(e);
  return {p,n,r,fr};
}
function renderPersonSimTbl(){
  const co=S.bulk.pCo; const L=incl().filter(e=>co==="all"||e.co===co).sort((a,b)=>(a.plan||"9")<(b.plan||"9")?-1:1);
  const ph={rate:"%",amt:"만원",target:"만원"};
  $("#bpTbl").innerHTML=`<thead><tr><th class="l">법인</th><th class="l">성명</th><th class="l">직위</th><th class="l">예정일</th><th>현재 연봉</th><th class="c">평가</th><th>권장</th><th>협상표 최종</th><th class="c">입력 방식</th><th>입력값</th><th>시뮬레이션 연봉</th><th>인상액</th><th>실제 인상률</th><th>월 급여</th><th class="c">최저임금</th><th>인건비 증가</th></tr></thead><tbody>`+
    L.map(e=>{ const x=personRow(e);
      return `<tr data-pid="${e.id}" ${coRow(e.co)}><td class="l">${coTag(e.co)}</td><td class="l"><button class="namebtn" data-p="${e.id}">${esc(e.name)}</button></td><td class="l">${esc(e.pos)}</td><td class="l">${e.plan||"-"}</td><td>${wm(e.ann)}</td><td class="c">${e.grade}</td><td class="muted">${pct(recRate(e))}</td><td class="muted">${pct(x.fr)}</td>
      <td class="c"><select data-pm><option value="rate" ${x.p.m==="rate"?"selected":""}>인상률</option><option value="amt" ${x.p.m==="amt"?"selected":""}>인상액</option><option value="target" ${x.p.m==="target"?"selected":""}>목표 연봉</option></select></td>
      <td><input type="number" class="${x.p.m==="rate"?"w60":"w120"}" data-pv step="${x.p.m==="rate"?0.1:(x.p.m==="amt"?10:100)}" value="${x.p.m==="rate"? x.p.v : x.p.v/1e4}"> <span class="muted">${ph[x.p.m]}</span></td>
      <td data-o="n"><b>${wm(x.n)}</b></td><td data-o="inc" class="${x.r.inc>=0?"up":"dn"}">${x.r.inc>=0?"+":""}${wm(x.r.inc)}</td><td data-o="eff">${pct(x.r.eff)}</td><td data-o="nm">${won(x.r.nm)}</td>
      <td class="c" data-o="min">${x.r.minOk?'<span class="tag good">충족</span>':'<span class="tag bad">미달</span>'}</td><td data-o="cost">${wm(x.r.costInc)}</td></tr>`; }).join("")+
    `</tbody><tfoot><tr><td colspan="4" class="l">합계 (${L.length}명)</td><td>${wm(sum(L,e=>e.ann))}</td><td colspan="5"></td><td id="bpT1"></td><td id="bpT2"></td><td id="bpT3"></td><td colspan="2"></td><td id="bpT4"></td></tr></tfoot>`;
  updatePersonTotals();
}
function updatePersonRow(tr){
  const e=S.emps.find(x=>x.id===tr.dataset.pid); const x=personRow(e); const o=k=>tr.querySelector(`[data-o="${k}"]`);
  o("n").innerHTML=`<b>${wm(x.n)}</b>`; o("inc").textContent=(x.r.inc>=0?"+":"")+wm(x.r.inc); o("inc").className=x.r.inc>=0?"up":"dn";
  o("eff").textContent=pct(x.r.eff); o("nm").textContent=won(x.r.nm); o("min").innerHTML=x.r.minOk?'<span class="tag good">충족</span>':'<span class="tag bad">미달</span>'; o("cost").textContent=wm(x.r.costInc);
  updatePersonTotals();
}
function updatePersonTotals(){
  const co=S.bulk.pCo; const L=incl().filter(e=>co==="all"||e.co===co); const a0=sum(L,e=>e.ann), a1=sum(L,e=>simNew(e));
  $("#bpT1").textContent=wm(a1); $("#bpT2").textContent="+"+wm(a1-a0); $("#bpT3").textContent=pct(a0?(a1-a0)/a0*100:0);
  $("#bpT4").textContent=wm(sum(L,e=>costOf(simNew(e),e.meal).total-costOf(e.ann,e.meal).total));
}
function renderBulkResults(){
  ensureBulk();
  const nm=SCOPE_NAME[S.bulk.scope];
  const L=incl(), R=L.map(e=>{ const n=simNew(e); return {e, r:calcNew(e,n,e.ann?(n-e.ann)/e.ann*100:0), m:calc(e)}; });
  const a0=sum(R,x=>x.e.ann), a1=sum(R,x=>x.r.newAnn), ci=sum(R,x=>x.r.costInc), m1=sum(R,x=>x.m.newAnn);
  const effs=R.map(x=>x.r.eff);
  $("#bKpi").innerHTML=[
    ["연봉 총액 (현재)", man(a0)+"원", wm(a0)+"만원"],
    [`${nm} 적용 후`, man(a1)+"원", `${a1-a0>=0?"+":""}${wm(a1-a0)}만원`],
    ["평균 인상률(가중)", pct(a0?(a1-a0)/a0*100:0), effs.length? `개인별 ${pct(Math.min(...effs))} ~ ${pct(Math.max(...effs))}` : ""],
    ["회사 부담 인건비 증가", man(ci)+"원", "4대보험·퇴직급여 포함 연간"],
    ["협상표(현재 최종)와 차이", (a1-m1>=0?"+":"")+man(a1-m1)+"원", `협상표 기준 증가 ${man(m1-a0)}원`]
  ].map(k=>`<div class="kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div><div class="s">${k[2]}</div></div>`).join("");
  const bs=S.bulk.bands;
  $("#bBand").innerHTML=`<thead><tr><th class="l">현재 연봉 구간</th><th>인원</th><th>현재 총액</th><th>인상 후</th><th>증가</th><th>평균 인상률</th></tr></thead><tbody>`+
    bs.map((x,i)=>{ const rr=R.filter(y=>bandOf(y.e.ann)===x); const p=sum(rr,y=>y.e.ann), q=sum(rr,y=>y.r.newAnn);
      return `<tr><td class="l">${bandLabel(i)}</td><td>${rr.length}</td><td>${wm(p)}</td><td>${wm(q)}</td><td class="up">+${wm(q-p)}</td><td>${pct(p?(q-p)/p*100:0)}</td></tr>`; }).join("")+`</tbody>`;
  const sR=c=>{ const sales=annSales(c); if(!sales) return null; return {cur:laborCost(c)/sales*100, sim:laborCost(c,simNew)/sales*100, plan:laborCost(c,e=>calc(e).newAnn)/sales*100, t:+S.rev.target[c]||0}; };
  const totS=sum(corps(),c=>annSales(c));
  $("#bCorp").innerHTML=`<thead><tr><th class="l">법인</th><th>인원</th><th>${nm} 증가</th><th>${nm} 인상률</th><th>협상표 증가</th><th>협상표 인상률</th><th title="매출 대비 인건비율 (현재 → ${nm})">인건비율 (현재 → ${nm})</th><th>협상표 기준 인건비율</th></tr></thead><tbody>`+
    corps().map(c=>{ const rr=R.filter(y=>y.e.co===c); const p=sum(rr,y=>y.e.ann), q=sum(rr,y=>y.r.newAnn), m=sum(rr,y=>y.m.newAnn); const x=sR(c);
      return `<tr ${coRow(c)}><td class="l">${coTag(c)}</td><td>${rr.length}</td><td>+${wm(q-p)}</td><td>${pct(p?(q-p)/p*100:0)}</td><td>+${wm(m-p)}</td><td>${pct(p?(m-p)/p*100:0)}</td><td>${x? pct(x.cur)+" → "+ratioTag(x.sim,x.t) : '<span class="muted">매출 미입력</span>'}</td><td>${x? ratioTag(x.plan,x.t) : "-"}</td></tr>`; }).join("")+
    `</tbody><tfoot><tr><td class="l">합계</td><td>${R.length}</td><td>+${wm(a1-a0)}</td><td>${pct(a0?(a1-a0)/a0*100:0)}</td><td>+${wm(m1-a0)}</td><td>${pct(a0?(m1-a0)/a0*100:0)}</td><td>${totS? pct(sum(corps(),c=>laborCost(c))/totS*100)+" → "+pct(sum(corps(),c=>laborCost(c,simNew))/totS*100) : "-"}</td><td>${totS? pct(sum(corps(),c=>laborCost(c,e=>calc(e).newAnn))/totS*100) : "-"}</td></tr></tfoot>`;
  $("#bPeople").innerHTML=`<thead><tr><th class="l">법인</th><th class="l">성명</th><th class="l">직위</th><th>현재 연봉</th><th>${nm} 연봉</th><th>인상률</th><th>협상표 연봉</th><th>차이</th><th class="c">최저임금</th></tr></thead><tbody>`+
    [...R].sort((x,y)=>y.e.ann-x.e.ann).map(x=>`<tr ${coRow(x.e.co)}><td class="l">${coTag(x.e.co)}</td><td class="l">${esc(x.e.name)}</td><td class="l">${esc(x.e.pos)}</td><td>${wm(x.e.ann)}</td><td><b>${wm(x.r.newAnn)}</b></td><td>${pct(x.r.eff)}</td><td>${wm(x.m.newAnn)}</td><td class="${x.r.newAnn>=x.m.newAnn?"up":"dn"}">${x.r.newAnn-x.m.newAnn>=0?"+":""}${wm(x.r.newAnn-x.m.newAnn)}</td><td class="c">${x.r.minOk?'<span class="tag good">충족</span>':'<span class="tag bad">미달</span>'}</td></tr>`).join("")+`</tbody>`;
  renderReverse();
}
function renderReverse(){
  const L=incl(), a0=sum(L,e=>e.ann), amt=(+$("#rvAmt").value||0)*1e4, basis=$("#rvBasis").value;
  let r;
  if(basis==="sal") r = a0? amt/a0*100 : 0;
  else { let lo=0, hi=100; for(let k=0;k<50;k++){ const mid=(lo+hi)/2; const c=sum(L,e=>costOf(e.ann*(1+mid/100),e.meal).total-costOf(e.ann,e.meal).total); if(c>amt) hi=mid; else lo=mid; } r=lo; }
  $("#rvOut").textContent = `→ 정률 일괄 최대 약 ${r.toFixed(2)}%`;
  $("#rvUse").dataset.r = Math.floor(r*10)/10;
}
$("#bScope").onclick=ev=>{ const s=ev.target.dataset.s; if(!s) return; S.bulk.scope=s; renderBulk(); persist(); };
$("#bMode").onclick=ev=>{ const m=ev.target.dataset.m; if(!m) return; S.bulk.mode=m; renderBulk(); persist(); };
$("#bInputs").addEventListener("input", ev=>{
  const t=ev.target, b=S.bulk;
  if(t.id==="biR"){ b.rate=+t.value; $("#biRn").value=t.value; }
  else if(t.id==="biRn"){ b.rate=+t.value; $("#biR").value=t.value; }
  else if(t.id==="biF") b.fixed=(+t.value||0)*1e4;
  else if(t.id==="biMR") b.mixRate=+t.value||0;
  else if(t.id==="biMF") b.mixFixed=(+t.value||0)*1e4;
  else if(t.dataset.cr!=null || t.dataset.cf!=null || t.dataset.cb!=null){
    const c=t.closest("tr").dataset.c;
    if(t.dataset.cr!=null) b.corp[c].rate=+t.value||0;
    else if(t.dataset.cf!=null) b.corp[c].fixed=(+t.value||0)*1e4;
    else S.budget[c]=(+t.value||0)*1e4;
    updateCorpSimRows();
  }
  else if(t.dataset.pv!=null){ const tr=t.closest("tr"); const ps=personSim(S.emps.find(x=>x.id===tr.dataset.pid)); ps.v = t.value===""? 0 : (ps.m==="rate"? +t.value : Math.round(+t.value*1e4)); updatePersonRow(tr); }
  else return;
  renderBulkResults(); persist();
});
$("#bInputs").addEventListener("change", ev=>{
  const t=ev.target, b=S.bulk;
  if(t.dataset.bu!=null){ b.bands[+t.dataset.bu].upTo = t.value===""? null : (+t.value)*1e4; b.bands.sort((x,y)=>(x.upTo??Infinity)-(y.upTo??Infinity)); }
  else if(t.dataset.br!=null) b.bands[+t.dataset.br].rate=+t.value||0;
  else if(t.dataset.pm!=null){ // 방식 변경 시 현재 결과를 유지하도록 값 환산
    const tr=t.closest("tr"), e=S.emps.find(x=>x.id===tr.dataset.pid), p=personSim(e), n=simNew(e);
    p.m=t.value; p.v = p.m==="rate"? +(e.ann?(n-e.ann)/e.ann*100:0).toFixed(2) : p.m==="amt"? n-e.ann : n;
  }
  else if(t.id==="bpCo") b.pCo=t.value;
  else if(t.dataset.cb!=null){ renderCorp(); renderDash(); persist(); return; }
  else return;
  renderBulk(); persist();
});
$("#bInputs").addEventListener("click", ev=>{
  const t=ev.target, b=S.bulk;
  if(t.dataset.bx!=null){ b.bands.splice(+t.dataset.bx,1); if(!b.bands.some(x=>x.upTo==null)) b.bands[b.bands.length-1].upTo=null; renderBulk(); persist(); }
  if(t.id==="bAddBand"){ const fin=b.bands.filter(x=>x.upTo!=null); const top=fin.length? fin[fin.length-1].upTo : 30000000; b.bands.splice(b.bands.length-1,0,{upTo:top+10000000,rate:b.bands[b.bands.length-1].rate}); renderBulk(); persist(); }
  if(t.id==="bcAllBtn"){ const v=+$("#bcAll").value||0; corps().forEach(c=>{ b.corp[c].rate=v; }); renderBulk(); persist(); }
  if(t.id==="bcHist"){ // 법인별 최근 12개월 평균(특수 건 제외), 이력 없으면 그대로
    corps().forEach(c=>{ const a=HIST().filter(h=>!h.pending && h.co===c && h.rate>=0 && h.rate<=40 && pd(h.date)>=addM(TODAY,-12) && pd(h.date)<=TODAY).map(h=>h.rate); if(a.length) b.corp[c].rate=+(sum(a)/a.length).toFixed(1); });
    renderBulk(); persist(); toast("이력이 없는 법인은 기존 값을 유지했습니다"); }
  if(t.id==="bcMerit"){ corps().forEach(c=>{ const L=incl().filter(e=>e.co===c), a0=sum(L,e=>e.ann), a1=sum(L,e=>calc(e).newAnn); b.corp[c].rate=a0? +((a1-a0)/a0*100).toFixed(1):0; b.corp[c].fixed=0; }); renderBulk(); persist(); }
  if(t.dataset.fit!=null){ fitCorp(t.closest("tr").dataset.c); renderBulk(); persist(); }
  if(t.id==="bpFromPlan"||t.id==="bpFromRec"||t.id==="bpZero"){
    const prev=JSON.stringify(b.person);
    incl().filter(e=>b.pCo==="all"||e.co===b.pCo).forEach(e=>{ b.person[e.id]={m:"rate",v: t.id==="bpZero"?0 : +(t.id==="bpFromRec"? recRate(e) : finalRate(e)).toFixed(2)}; });
    renderBulk(); persist(); toast("개인별 입력값을 다시 채웠습니다",()=>{ b.person=JSON.parse(prev); renderBulk(); persist(); });
  }
});
$("#bApply").onclick=()=>{
  const prev=S.emps.map(e=>e.rate), nm=SCOPE_NAME[S.bulk.scope];
  incl().forEach(e=>{ const n=simNew(e); e.rate = e.ann? +((n-e.ann)/e.ann*100).toFixed(4) : 0; });
  renderAll(); toast(`${nm}을 협상표 최종 인상률에 넣었습니다`,()=>{ S.emps.forEach((e,i)=>e.rate=prev[i]); renderAll(); });
};
["#rvAmt","#rvBasis"].forEach(s=>$(s).addEventListener("input",renderReverse));
$("#rvUse").onclick=()=>{ S.bulk.scope="all"; S.bulk.mode="rate"; S.bulk.rate=+$("#rvUse").dataset.r; renderBulk(); persist(); };

/* ---------- 법인별 ---------- */
function corpUse(c){
  const R=incl().filter(e=>e.co===c).map(e=>calc(e)); const bs=S.set.corpBasis;
  return bs==="sal"? sum(R,r=>r.inc) : bs==="cost"? sum(R,r=>r.costInc) : sum(R,r=>r.yearCost);
}
/* ---------- 월별 매출 · 인건비 ---------- */
function ensureRev(){ if(!S.rev) S.rev={unit:"year",sales:{},other:{},target:{}}; ["sales","other","target"].forEach(k=>{ if(!S.rev[k]) S.rev[k]={}; }); if(!S.rev.unit) S.rev.unit="year";
  if(!S.mon) S.mon={}; if(!S.monCfg) S.monCfg={year:TODAY.getFullYear(), close:mKey(new Date(TODAY.getFullYear(),TODAY.getMonth()-1,1)), basis:"full"}; }
const ymAdd = (ym,n) => { const [y,m]=ym.split("-").map(Number); const d=new Date(y,m-1+n,1); return mKey(d); };
const ymStart = ym => { const [y,m]=ym.split("-").map(Number); return new Date(y,m-1,1); };
const ymEnd = ym => { const [y,m]=ym.split("-").map(Number); return new Date(y,m,0); };
function monCell(c,ym){ ensureRev(); return (S.mon[c]||{})[ym]||{}; }
function setMon(c,ym,k,v){ ensureRev(); S.mon[c]=S.mon[c]||{}; S.mon[c][ym]=S.mon[c][ym]||{}; if(v==null||v==="") delete S.mon[c][ym][k]; else S.mon[c][ym][k]=v; }
function salesM(c,ym){ const v=monCell(c,ym).s; return v==null? null : v; }
const isClosed = ym => ym <= S.monCfg.close;
// 직원 1명의 그 달 인건비 (재직 일수 비례). ovr: {e,N} 또는 {e,N:null}(인상 없음)
function empMonthCost(x, ym, ovr){
  const ms=ymStart(ym), me=ymEnd(ym), days=me.getDate();
  const h=pd(x.hire), l=x.left? pd(x.left) : null;
  if(h && h>me) return 0; if(l && l<ms) return 0;
  const from = h && h>ms ? h : ms, to = l && l<me ? l : me;
  const frac = Math.max(0, (to-from)/864e5+1)/days;
  let ann=x.ann;
  if(ovr && ovr.e && ovr.e.id===x.id){ if(ovr.N!=null && x.plan && x.plan.slice(0,7)<=ym) ann=ovr.N; }
  else if(x.inc && x.plan && x.plan.slice(0,7)<=ym && !(ovr&&ovr.noRaise) && !(ovr&&ovr.upToYm && x.plan.slice(0,7)>ovr.upToYm)) ann=calc(x).newAnn;
  const m = S.monCfg.basis==="pay"? ann/12 : costOf(ann,x.meal).total/12;
  return m*frac;
}
function staffM(c,ym){ return [...S.emps,...S.left].filter(x=>x.co===c && empMonthCost(x,ym)>0).length; }
// 그 달 인건비: 마감월 이전은 입력한 실적, 이후는 재직자 계산 + 기타
function laborM(c, ym, ovr){
  const cell=monCell(c,ym);
  if(isClosed(ym) && cell.l!=null && !(ovr&&ovr.forceCalc)) return cell.l;
  return sum([...S.emps,...S.left].filter(x=>x.co===c), x=>empMonthCost(x,ym,ovr)) + (+cell.o||0);
}
// 시작월부터 12개월 중 매출이 입력된 달만 합산
function winStats(c, start, ovr){
  let s=0,l=0,n=0; for(let i=0;i<12;i++){ const ym=ymAdd(start,i), sv=salesM(c,ym); if(sv==null) continue; s+=sv; l+=laborM(c,ym,ovr); n++; }
  return n? {sales:s, labor:l, n, ratio:s? l/s*100 : null, sales12:s/n*12} : null;
}
function annSales(c){ ensureRev(); const w=winStats(c, mKey(TODAY)) || winStats(c, ymAdd(mKey(TODAY),-12)); if(w) return w.sales12; const v=+S.rev.sales[c]||0; return S.rev.unit==="month"? v*12 : v; }
function annOther(c){ ensureRev(); const v=+S.rev.other[c]||0; return S.rev.unit==="month"? v*12 : v; }
function laborCost(c, newAnnFn){
  return sum(S.emps.filter(e=>e.co===c), e=>{ const a = (newAnnFn && e.inc)? newAnnFn(e) : e.ann; return costOf(a,e.meal).total; }) + annOther(c);
}
function ratioTag(r,t){ if(r==null) return '<span class="muted">매출 미입력</span>'; const cls = t? (r>t?"bad":(r>t*0.9?"warn":"good")) : ""; return `<span class="tag ${cls}">${pct(r)}</span>`; }

function renderRatio(){
  ensureRev(); const cfg=S.monCfg;
  const ys=[TODAY.getFullYear()-1, TODAY.getFullYear(), TODAY.getFullYear()+1];
  $("#monYear").innerHTML=ys.map(y=>`<option ${y==cfg.year?"selected":""}>${y}</option>`).join("");
  const closes=[]; for(let i=-13;i<=1;i++) closes.push(ymAdd(mKey(TODAY),i));
  $("#monClose").innerHTML=closes.map(k=>`<option value="${k}" ${k===cfg.close?"selected":""}>${mLabel(k)}</option>`).join("");
  $("#monBasis").value=cfg.basis;
  const Y=cfg.year, months=Array.from({length:12},(_,i)=>`${Y}-${String(i+1).padStart(2,"0")}`);
  $("#monWrap").innerHTML = corps().map(c=>{
    const t=+S.rev.target[c]||0;
    const cells=months.map(ym=>{ const cl=isClosed(ym), sv=salesM(c,ym), lv=laborM(c,ym), base=laborM(c,ym,{noRaise:true,forceCalc:true}), cell=monCell(c,ym);
      return {ym,cl,sv,lv,base,cell,r: sv? lv/sv*100 : null, rb: sv? base/sv*100 : null, n:staffM(c,ym), lInput:cell.l}; });
    const agg=f=>{ const L=cells.filter(f).filter(x=>x.sv!=null); const s=sum(L,x=>x.sv), l=sum(L,x=>x.lv); return {s,l,r:s? l/s*100:null,n:L.length}; };
    const A=agg(x=>x.cl), F=agg(x=>!x.cl), T=agg(()=>true);
    const missingL=cells.filter(x=>x.cl && x.lInput==null && x.sv!=null).length;
    return `<div class="monblock" style="--cc:var(--c-${esc(c)})">
      <div class="coband" style="margin-top:6px"><span class="nm">${esc(c)}</span><span class="full">${esc(CORP[c]||"")}</span>
        <span class="st">실적(~${+cfg.close.slice(5)}월) <b>${A.r==null?"-":pct(A.r)}</b> · 예상 <b>${F.r==null?"-":pct(F.r)}</b> · ${Y}년 전체 <b>${T.r==null?"-":pct(T.r)}</b></span>
        <label style="color:inherit;font-weight:700">목표 <input type="number" class="w60" data-mt="${esc(c)}" value="${t||""}" placeholder="-"> %</label><button class="btn sm" data-mclr="${esc(c)}">${Y}년 입력값 지우기</button></div>
      <div class="tw"><table class="montbl"><thead><tr><th class="l">구분 (만원)</th>${cells.map(x=>`<th class="${x.cl?"mclosed":"mfore"}">${+x.ym.slice(5)}월<span class="sub">${x.cl?"실적":"예상"}</span></th>`).join("")}<th>합계</th></tr></thead><tbody>
        <tr><td class="l"><b>매출</b></td>${cells.map(x=>`<td class="${x.cl?"mclosed":"mfore"}"><input type="number" data-mc="${esc(c)}" data-ym="${x.ym}" data-k="s" value="${x.sv==null?"":x.sv/1e4}" placeholder="${x.cl?"실적":"예상"}"></td>`).join("")}<td><b>${T.s? wm(T.s):"-"}</b></td></tr>
        <tr><td class="l"><b>인건비</b><span class="sub">${cfg.close.slice(5)*1}월까지 실적 입력 · 이후 자동</span></td>${cells.map(x=>x.cl? `<td class="mclosed"><input type="number" data-mc="${esc(c)}" data-ym="${x.ym}" data-k="l" value="${x.lInput==null?"":x.lInput/1e4}" placeholder="${wm(x.lv)}" title="비워 두면 재직자 기준 계산값(${wm(x.lv)})을 씁니다"></td>` : `<td class="mfore"><b>${wm(x.lv)}</b></td>`).join("")}<td><b>${wm(sum(cells,x=>x.lv))}</b></td></tr>
        <tr><td class="l">기타 인건비<span class="sub">알바·프리랜서·외주 (예상월)</span></td>${cells.map(x=>x.cl? `<td class="mclosed muted">-</td>` : `<td class="mfore"><input type="number" data-mc="${esc(c)}" data-ym="${x.ym}" data-k="o" value="${x.cell.o==null?"":x.cell.o/1e4}" placeholder="0"></td>`).join("")}<td>${wm(sum(cells.filter(x=>!x.cl),x=>+x.cell.o||0))}</td></tr>
        <tr><td class="l">재직 인원<span class="sub">예상월 계산 대상 (임원 포함)</span></td>${cells.map(x=>`<td class="${x.cl?"mclosed muted":"mfore"}">${x.cl? "-" : x.n+"명"}</td>`).join("")}<td></td></tr>
        <tr class="mratio"><td class="l"><b>인건비율</b></td>${cells.map(x=>`<td class="${x.cl?"mclosed":"mfore"}">${x.r==null?'<span class="muted">-</span>':ratioTag(x.r,t)}</td>`).join("")}<td>${T.r==null?"-":ratioTag(T.r,t)}</td></tr>
        <tr><td class="l muted">협상 반영 전 인건비율</td>${cells.map(x=>`<td class="${x.cl?"mclosed":"mfore"} muted">${x.cl||x.rb==null? "" : pct(x.rb)}</td>`).join("")}<td></td></tr>
      </tbody></table></div>
      ${missingL? `<p class="note">⚠ 실적월 중 인건비를 입력하지 않은 ${missingL}개월은 재직자 기준 계산값으로 채웠습니다.</p>`:""}
    </div>`; }).join("");
}
$("#monYear").onchange=ev=>{ S.monCfg.year=+ev.target.value; renderAll(); };
$("#monClose").onchange=ev=>{ S.monCfg.close=ev.target.value; renderAll(); };
$("#monBasis").onchange=ev=>{ S.monCfg.basis=ev.target.value; renderAll(); };
$("#monWrap").addEventListener("change",ev=>{ const t=ev.target;
  if(t.dataset.mt!=null){ ensureRev(); S.rev.target[t.dataset.mt]=+t.value||0; renderAll(); return; }
  if(t.dataset.mc==null) return; setMon(t.dataset.mc,t.dataset.ym,t.dataset.k, t.value===""? null : Math.round(+t.value*1e4)); renderAll(); });
$("#monWrap").addEventListener("click",ev=>{ const c=ev.target.dataset.mclr; if(!c) return; const Y=S.monCfg.year; const prev=JSON.stringify(S.mon[c]||{}); Object.keys(S.mon[c]||{}).forEach(k=>{ if(k.startsWith(Y+"-")) delete S.mon[c][k]; }); renderAll(); toast(`${c} ${Y}년 월별 입력값을 지웠습니다`,()=>{ S.mon[c]=JSON.parse(prev); renderAll(); }); });
$("#monWrap").addEventListener("paste",ev=>{ // 엑셀에서 한 줄(여러 달) 붙여넣기
  const t=ev.target; if(t.dataset.mc==null) return; const txt=(ev.clipboardData||window.clipboardData).getData("text"); const vals=txt.trim().split(/[\t\n]+/); if(vals.length<2) return;
  ev.preventDefault(); vals.forEach((v,i)=>{ const ym=ymAdd(t.dataset.ym,i); if(ym.slice(0,4)!==t.dataset.ym.slice(0,4)) return; const n=+String(v).replace(/[^\d.-]/g,""); if(t.dataset.k==="l" && !isClosed(ym)) return; if(!isNaN(n) && String(v).trim()!=="") setMon(t.dataset.mc,ym,t.dataset.k,Math.round(n*1e4)); }); renderAll(); toast(`${vals.length}개월 값을 붙여넣었습니다`); });

function renderCorp(){
  renderRatio();
  const ys=$("#cYear"); const Y=+S.set.year; ys.innerHTML=[Y-1,Y,Y+1].filter((v,i,a)=>a.indexOf(v)===i).map(y=>`<option ${y===Y?"selected":""}>${y}</option>`).join("");
  $("#cBasis").value=S.set.corpBasis;
  const cs=corps(); const all=incl();
  const row=(label,L,isTotal,c)=>{ const R=L.map(e=>({e,r:calc(e)})); const a0=sum(R,x=>x.e.ann), a1=sum(R,x=>x.r.newAnn), c0=sum(R,x=>x.r.cost0), c1=sum(R,x=>x.r.cost1), yc=sum(R,x=>x.r.yearCost);
    const rs=R.map(x=>x.r.eff); const use = S.set.corpBasis==="sal"? a1-a0 : S.set.corpBasis==="cost"? c1-c0 : yc;
    const bud = isTotal? sum(cs,k=>S.budget[k]||0) : (S.budget[c]||0); const p= bud? use/bud*100 : null;
    return `<tr><td class="l">${isTotal?"<b>합계</b>":coTag(label)}</td><td>${L.length}</td><td>${wm(a0)}</td><td>${wm(a1)}</td><td class="up">+${wm(a1-a0)}</td><td><b>${pct(a0?(a1-a0)/a0*100:0)}</b></td><td>${pct(sum(rs)/(rs.length||1))}</td><td>${rs.length? pct(Math.min(...rs))+" ~ "+pct(Math.max(...rs)) : "-"}</td><td>${wm(c0)}</td><td>${wm(c1)}</td><td class="up">+${wm(c1-c0)}</td><td>${wm(yc)}</td>
      <td>${isTotal? wm(bud) : `<input type="number" class="w90" data-bud="${esc(c)}" step="100" value="${S.budget[c]? S.budget[c]/1e4 : ""}" placeholder="미입력">`}</td>
      <td style="min-width:130px">${p==null?'<span class="muted">-</span>':`<div class="bar ${p>100?"over":""}"><i style="width:${Math.min(100,p)}%"></i></div><span style="font-size:11.5px" class="${p>100?"up":"muted"}">${pct(p,0)} · 잔여 ${man(bud-use)}</span>`}</td></tr>`; };
  $("#corpTbl").innerHTML=`<thead><tr><th class="l">법인</th><th>인원</th><th>현재 연봉 총액</th><th>협상 후</th><th>증가액</th><th>가중평균 인상률</th><th>단순평균</th><th>최저~최고</th><th>현재 총 인건비</th><th>협상 후 총 인건비</th><th>인건비 증가</th><th>${S.set.year}년 반영분</th><th>인상 예산</th><th>소진</th></tr></thead><tbody>`+
    cs.map(c=>row(c,all.filter(e=>e.co===c),false,c)).join("")+`</tbody><tfoot>${row("합계",all,true)}</tfoot>`;
  // 등급 분포
  $("#corpGrade").innerHTML=`<thead><tr><th class="l">법인</th>${GRADES.map(g=>`<th class="c">${g}</th>`).join("")}<th>인원</th></tr></thead><tbody>`+
    cs.map(c=>{ const L=all.filter(e=>e.co===c), g=gradeDist(L); return `<tr ${coRow(c)}><td class="l">${coTag(c)}</td>${GRADES.map(k=>`<td class="c">${g[k]||0}</td>`).join("")}<td>${L.length}</td></tr>`; }).join("")+
    `</tbody><tfoot><tr><td class="l">가이드</td>${GRADES.map(k=>`<td class="c">${S.guide[k]}%</td>`).join("")}<td></td></tr></tfoot>`;
  // 이력 통계
  const H=HIST().filter(h=>!h.pending && h.rate>=0 && h.rate<=40);
  const years=[...new Set(H.map(h=>h.y))].sort(), hcs=[...new Set(H.map(h=>h.co))];
  $("#corpHist").innerHTML=`<thead><tr><th class="l">연도</th>${hcs.map(c=>`<th>${c} 평균 (건수)</th><th>${c} 중앙값</th>`).join("")}<th>전체 평균</th></tr></thead><tbody>`+
    years.map(y=>{ const all=H.filter(h=>h.y===y).map(h=>h.rate); return `<tr><td class="l">${y}</td>${hcs.map(c=>{ const a=H.filter(h=>h.y===y&&h.co===c).map(h=>h.rate); return `<td>${a.length? pct(sum(a)/a.length)+` <span class="muted">(${a.length})</span>` : "-"}</td><td>${a.length? pct(median(a)) : "-"}</td>`; }).join("")}<td><b>${pct(sum(all)/(all.length||1))}</b></td></tr>`; }).join("")+`</tbody>`;
}
$("#corpTbl").addEventListener("change",ev=>{ const c=ev.target.dataset.bud; if(c==null) return; S.budget[c]=(+ev.target.value||0)*1e4; renderAll(); });
$("#cYear").onchange=ev=>{ S.set.year=+ev.target.value; renderAll(); };
$("#cBasis").onchange=ev=>{ S.set.corpBasis=ev.target.value; renderAll(); };

/* ---------- 평가 기준 ---------- */
function renderRule(){
  $("#mBase").value=S.set.base; $("#crLow").value=S.set.crLow; $("#crHigh").value=S.set.crHigh;
  const L=incl(); const cnt=(g,b)=>L.filter(e=>e.grade===g && crBand(crOf(e))===b).length;
  $("#mTbl").innerHTML=`<thead><tr><th class="c">평가 등급</th><th class="c">낮음 (&lt;${S.set.crLow}%)</th><th class="c">적정 (${S.set.crLow}~${S.set.crHigh}%)</th><th class="c">높음 (&gt;${S.set.crHigh}%)</th></tr></thead><tbody>`+
    GRADES.map(g=>`<tr><td class="c"><b>${g}</b></td>${[0,1,2].map(b=>`<td><input type="number" step="0.1" data-mg="${g}" data-mb="${b}" value="${S.matrix[g][b]}"> % <span class="muted" style="font-size:11px">${cnt(g,b)}명</span></td>`).join("")}</tr>`).join("")+`</tbody>`;
  const H=HIST().filter(h=>!h.pending && h.rate>=0 && h.rate<=40 && pd(h.date)>=addM(TODAY,-12) && pd(h.date)<=TODAY).map(h=>h.rate);
  $("#refBox").innerHTML=`참고 · 최근 12개월 사내 인상률: 평균 ${pct(sum(H)/(H.length||1))}, 중앙값 ${pct(median(H))} (${H.length}건, 특수 건 제외) · 2027년 최저임금 시간당 10,700원(전년 대비 +3.7%), 월 환산 2,236,300원(209시간)`;
  // 기준연봉
  const pos=[...new Set([...Object.keys(S.mids), ...S.emps.filter(e=>!e.exec).map(e=>e.pos)])];
  $("#midTbl").innerHTML=`<thead><tr><th class="l">직위</th><th>인원</th><th>현재 평균</th><th>최저~최고</th><th>기준연봉 (만원)</th><th></th></tr></thead><tbody>`+
    pos.map(p=>{ const a=S.emps.filter(e=>!e.exec && e.pos===p).map(e=>e.ann); return `<tr><td class="l">${esc(p)}</td><td>${a.length}</td><td>${a.length?wm(sum(a)/a.length):"-"}</td><td>${a.length? man(Math.min(...a))+" ~ "+man(Math.max(...a)) : "-"}</td><td><input type="number" class="w90" data-mid="${esc(p)}" step="100" value="${S.mids[p]? S.mids[p]/1e4 : ""}"></td><td>${a.length? "" : `<button class="btn sm" data-mdel="${esc(p)}">삭제</button>`}</td></tr>`; }).join("")+`</tbody>`;
  const gd=gradeDist(L);
  $("#gGuide").innerHTML=`<thead><tr><th class="c">등급</th><th>가이드 비율</th><th>가이드 인원</th><th>현재 인원</th><th>현재 비율</th></tr></thead><tbody>`+
    GRADES.map(g=>{ const n=gd[g]||0, gp=n/(L.length||1)*100, gn=S.guide[g]/100*L.length; const off=Math.abs(n-gn)>=1.5;
      return `<tr><td class="c"><b>${g}</b></td><td><input type="number" class="w60" data-gg="${g}" value="${S.guide[g]}"> %</td><td>${gn.toFixed(1)}</td><td>${n}${off?' <span class="tag warn">차이</span>':""}</td><td>${pct(gp,0)}</td></tr>`; }).join("")+`</tbody>`;
}
$("#mTbl").addEventListener("change",ev=>{ const t=ev.target; if(!t.dataset.mg) return; S.matrix[t.dataset.mg][+t.dataset.mb]=+t.value||0; renderAll(); });
$("#mGen").onclick=()=>{ const prev=JSON.stringify(S.matrix); S.set.base=+$("#mBase").value||0; S.matrix=genMatrix(S.set.base); renderAll(); toast("매트릭스를 다시 만들었습니다",()=>{ S.matrix=JSON.parse(prev); renderAll(); }); };
$("#mBase").onchange=ev=>{ S.set.base=+ev.target.value||0; persist(); };
$("#crLow").onchange=ev=>{ S.set.crLow=+ev.target.value||0; renderAll(); };
$("#crHigh").onchange=ev=>{ S.set.crHigh=+ev.target.value||0; renderAll(); };
$("#midTbl").addEventListener("change",ev=>{ const p=ev.target.dataset.mid; if(p==null) return; S.mids[p]=(+ev.target.value||0)*1e4; renderAll(); });
$("#midTbl").addEventListener("click",ev=>{ const p=ev.target.dataset.mdel; if(p==null) return; delete S.mids[p]; renderAll(); });
$("#midAdd").onclick=()=>{ const n=$("#midNew").value.trim(); if(!n) return; S.mids[n]=Math.round((+$("#midNewV").value||0)*1e4); renderAll(); };
$("#midFill").onclick=()=>{ S.mids=avgMids(S.emps); renderAll(); };
$("#gGuide").addEventListener("change",ev=>{ const g=ev.target.dataset.gg; if(!g) return; S.guide[g]=+ev.target.value||0; renderAll(); });

/* ---------- 이력 ---------- */
/* ---------- 데이터 편집: 법인 / 인상 이력 / 직위 ---------- */
const PALETTE=["#2457d6","#16794c","#8b3fd1","#c2410c","#0e7490","#be185d","#4d7c0f","#a16207"];
function ensureEdit(){
  if(!S.corpInfo){ const def={"민컴":"#2457d6","넥스트":"#16794c","아마겟돈":"#8b3fd1"}; S.corpInfo=Object.keys(CORP).map(k=>({code:k, full:CORP[k], color:def[k]||PALETTE[3]})); }
  if(!S.hist){ S.hist=RAW.hist.map(h=>({...h, id:uid()})); S.histVer=RAW.ver; }
  S.hist.forEach(h=>{ if(!h.id) h.id=uid(); });
  applyCorps();
}
function applyCorps(){
  Object.keys(CORP).forEach(k=>delete CORP[k]); S.corpInfo.forEach(c=>CORP[c.code]=c.full);
  let st=$("#coColors"); if(!st){ st=document.createElement("style"); st.id="coColors"; document.head.appendChild(st); }
  st.textContent=":root{"+S.corpInfo.map(c=>`--c-${c.code}:${c.color};`).join("")+"}";
}
function renameCorp(o,n){
  [...S.emps,...S.left,...S.hist].forEach(x=>{ if(x.co===o) x.co=n; });
  [S.budget, S.rev.target, S.rev.sales, S.rev.other, S.mon, S.bulk.corp].forEach(m=>{ if(m && m[o]!==undefined){ m[n]=m[o]; delete m[o]; } });
  if(S.coFilter===o) S.coFilter=n;
}
function recalcHist(h){
  h.y = h.date? +h.date.slice(0,4) : h.y;
  h.pending = !h.after;
  h.amt = h.after? h.after-(h.before||0) : -(h.before||0);
  h.rate = h.after && h.before? +((h.after-h.before)/h.before*100).toFixed(1) : (h.after? 0 : -100);
}
function renderCorpInfo(){
  $("#corpInfoTbl").innerHTML=`<thead><tr><th class="l">약칭</th><th class="l">정식 법인명</th><th class="c">색상</th><th>재직</th><th>이력</th><th></th></tr></thead><tbody>`+
    S.corpInfo.map((c,i)=>{ const n=S.emps.filter(e=>e.co===c.code).length, h=S.hist.filter(x=>x.co===c.code).length;
      return `<tr ${coRow(c.code)} data-ci="${i}"><td class="l"><input type="text" class="w90" data-cf2="code" value="${esc(c.code)}"></td><td class="l"><input type="text" style="width:260px" data-cf2="full" value="${esc(c.full)}"></td><td class="c"><input type="color" data-cf2="color" value="${c.color}"></td><td>${n}명</td><td>${h}건</td><td>${n||h? '<span class="muted" style="font-size:12.5px">사용 중</span>' : `<button class="btn sm" data-cdel="${i}">삭제</button>`}</td></tr>`; }).join("")+`</tbody>`;
}
$("#corpInfoTbl").addEventListener("change",ev=>{ const t=ev.target, tr=t.closest("tr[data-ci]"); if(!tr) return; const c=S.corpInfo[+tr.dataset.ci], k=t.dataset.cf2;
  if(k==="code"){ const n=t.value.trim(); if(!n || S.corpInfo.some(x=>x!==c && x.code===n)){ toast("약칭이 비었거나 이미 있습니다"); renderAll(); return; } renameCorp(c.code,n); c.code=n; }
  else c[k]=t.value;
  applyCorps(); renderAll(); });
$("#corpInfoTbl").addEventListener("click",ev=>{ const i=ev.target.dataset.cdel; if(i==null) return; const c=S.corpInfo.splice(+i,1)[0]; applyCorps(); renderAll(); toast(`${c.code} 법인을 삭제했습니다`,()=>{ S.corpInfo.splice(+i,0,c); applyCorps(); renderAll(); }); });
$("#corpAdd").onclick=()=>{ let k=1, n="새법인"; while(S.corpInfo.some(x=>x.code===n)) n="새법인"+(++k); S.corpInfo.push({code:n, full:"(정식 법인명)", color:PALETTE[S.corpInfo.length%PALETTE.length]}); applyCorps(); renderAll(); };

// 인상 이력 편집
function renderHist(){
  const H=S.hist; const cs=[...new Set([...allCorps(),...H.map(h=>h.co)])], ys=[...new Set(H.map(h=>h.y))].sort();
  const cc=$("#hCo").value||"all", cy=$("#hY").value||"all", q=$("#hQ").value.trim();
  $("#hCo").innerHTML=`<option value="all">전체</option>`+cs.map(c=>`<option ${c===cc?"selected":""}>${c}</option>`).join("");
  $("#hY").innerHTML=`<option value="all">전체</option>`+ys.map(y=>`<option ${String(y)===cy?"selected":""}>${y}</option>`).join("");
  const L=H.filter(h=>(cc==="all"||h.co===cc)&&(cy==="all"||String(h.y)===cy)&&(!q||h.name.includes(q))).sort((a,b)=>(b._new?1:0)-(a._new?1:0) || ((a.date||"")<(b.date||"")?1:-1));
  const coOpts=c=>cs.map(x=>`<option ${x===c?"selected":""}>${x}</option>`).join("");
  $("#histTbl").innerHTML=`<thead><tr><th class="l">법인</th><th class="l">성명</th><th class="l">입사일</th><th class="l">변경일자</th><th>기존 연봉 (만원)</th><th>변경후 연봉 (만원)</th><th>인상액</th><th>인상률</th><th class="l">비고</th><th></th></tr></thead><tbody>`+
    L.map(h=>`<tr data-hid="${h.id}" ${coRow(h.co)} ${h._new?'class="newrow"':""}><td class="l"><select data-hf="co">${coOpts(h.co)}</select></td><td class="l"><input type="text" class="w90" data-hf="name" value="${esc(h.name)}"></td><td class="l"><input type="date" data-hf="hire" value="${h.hire||""}"></td><td class="l"><input type="date" data-hf="date" value="${h.date||""}"></td>
      <td><input type="number" class="w90" data-hf="before" step="100" value="${h.before? h.before/1e4 : ""}"></td><td><input type="number" class="w90" data-hf="after" step="100" value="${h.after? h.after/1e4 : ""}" placeholder="예정"></td>
      <td>${h.pending?'<span class="tag acc">예정</span>':sg(h.amt)}</td><td>${h.pending?"-":(h.rate<0||h.rate>40? `<span class="tag warn">${pct(h.rate)}</span>` : pct(h.rate))}</td>
      <td class="l"><input type="text" style="width:200px" data-hf="note" value="${esc(h.note||"")}"></td><td><button class="btn sm" data-hdel="${h.id}">삭제</button></td></tr>`).join("")+
    (L.length? "" : `<tr><td colspan="10" class="c muted">조건에 맞는 이력이 없습니다</td></tr>`)+`</tbody>`;
  $("#histCount").textContent=`${L.length}건 / 전체 ${H.length}건`;
}
["#hCo","#hY"].forEach(s=>$(s).addEventListener("change",renderHist)); $("#hQ").addEventListener("input",renderHist);
$("#histTbl").addEventListener("change",ev=>{ const t=ev.target, tr=t.closest("tr[data-hid]"); if(!tr||!t.dataset.hf) return; const h=S.hist.find(x=>x.id===tr.dataset.hid); const k=t.dataset.hf;
  if(k==="before"||k==="after") h[k]= t.value===""? 0 : Math.round(+t.value*1e4); else h[k]=t.value;
  recalcHist(h); S.histEdited=true; renderAll(); });
$("#histTbl").addEventListener("click",ev=>{ const id=ev.target.dataset.hdel; if(!id) return; const i=S.hist.findIndex(x=>x.id===id); const h=S.hist.splice(i,1)[0]; S.histEdited=true; renderAll(); toast(`${h.name} ${h.date} 이력을 삭제했습니다`,()=>{ S.hist.splice(i,0,h); renderAll(); }); });
$("#histAdd").onclick=()=>{ S.hist.forEach(x=>delete x._new); const h={id:uid(), co:allCorps()[0]||"", name:"", hire:"", date:ymd(TODAY), before:0, after:0, note:"", manual:true, _new:true}; recalcHist(h); S.hist.unshift(h); S.histEdited=true; $("#hQ").value=""; $("#hCo").value="all"; $("#hY").value="all"; renderAll(); $("#histTbl [data-hf=name]").focus(); };

/* ---------- 설정 ---------- */
const SETDEF=[
  ["round","연봉 반올림 단위","원",[["10000","1만원"],["100000","10만원"],["1000000","100만원"]]],
  ["mealExempt","식대 비과세 한도(월)","원"],["minHour","최저임금(시간급)","원"],["minHours","월 소정근로시간(유급주휴 포함)","시간"],
  ["cycle","연봉협상 주기","개월"],["np","국민연금 사업주","%"],["npCap","국민연금 기준소득월액 상한","원"],["npFloor","국민연금 기준소득월액 하한","원"],
  ["hi","건강보험 사업주","%"],["ltc","장기요양 (건강보험료 대비)","%"],["ei","고용보험 사업주 합계","%"],["ia","산재보험","%"],["sevOn","퇴직급여(연봉 1/12) 포함","",[["true","포함"],["false","제외"]]]
];
function renderLeft(){
  $("#leftTbl").innerHTML=`<thead><tr><th class="l">법인</th><th class="l">성명</th><th class="l">직위</th><th>퇴사일</th><th>마지막 연봉 (만원)</th><th></th></tr></thead><tbody>`+
    (S.left.length? S.left.map((e,i)=>`<tr ${coRow(e.co)}><td class="l">${coTag(e.co)}</td><td class="l">${esc(e.name)}</td><td class="l">${esc(e.pos)}</td><td><input type="date" data-leftd="${i}" value="${e.left||""}"></td><td>${wm(e.ann)}</td><td><button class="btn sm" data-restore="${i}">재직으로 되돌리기</button> <button class="btn sm" data-ldel="${i}">완전 삭제</button></td></tr>`).join("") : `<tr><td colspan="6" class="c muted">없음</td></tr>`)+`</tbody>`;
}
function renderSet(){
  renderLeft(); renderCorpInfo();
  $("#setTbl").innerHTML=`<tbody>`+SETDEF.map(([k,l,u,opts])=>`<tr><td class="l">${l}</td><td>${opts? `<select data-sk="${k}">${opts.map(o=>`<option value="${o[0]}" ${String(S.set[k])===o[0]?"selected":""}>${o[1]}</option>`).join("")}</select>` : `<input type="number" class="w120" data-sk="${k}" step="any" value="${S.set[k]}">`}</td><td class="l muted">${u}</td></tr>`).join("")+
    `<tr><td class="l">최저임금 월 환산액</td><td><b>${won(S.set.minHour*S.set.minHours)}</b></td><td class="l muted">원</td></tr></tbody>`;
}
$("#setTbl").addEventListener("change",ev=>{ const k=ev.target.dataset.sk; if(!k) return; const v=ev.target.value; S.set[k]= v==="true"?true: v==="false"?false: +v;
  if(k==="cycle"){ /* 주기 변경 시 예정일 재계산 여부 */ const prev=S.emps.map(e=>e.plan); S.emps.forEach(e=>{ const d=defaultPlan(e,S.set.cycle); if(d) e.plan=ymd(d); }); toast("협상 주기에 맞춰 예정일을 다시 계산했습니다",()=>{ S.emps.forEach((e,i)=>e.plan=prev[i]); renderAll(); }); }
  renderAll(); });
function parsePaste(txt){
  const out=[]; txt.split(/\r?\n/).forEach(line=>{ if(!line.trim()) return; let c=line.split("\t"); if(c.length<6) c=line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    c=c.map(x=>x.replace(/^"|"$/g,"").trim()); if(c.length<6) return; const ann=+c[5].replace(/[^\d.]/g,""); if(!ann) return;
    const e={id:uid(),manual:true,co:c[0],name:c[1],dept:c[2],pos:c[3],type:"정규직",hire:ymd(pd(c[4])),ann:Math.round(ann/1e4)*1e4,meal:S.set.mealExempt,inc:true,grade:"B",rate:null,plan:"",memo:""};
    e.plan=ymd(defaultPlan(e,S.set.cycle)); out.push(e); });
  return out;
}
$("#pasteAdd").onclick=()=>{ const a=parsePaste($("#pasteBox").value); S.emps.push(...a); $("#pasteMsg").textContent=`${a.length}명 추가`; renderAll(); };
$("#pasteReplace").onclick=()=>{ const a=parsePaste($("#pasteBox").value); if(!a.length){ $("#pasteMsg").textContent="읽을 수 있는 행이 없습니다"; return; } const prev=S.emps; S.emps=a; $("#pasteMsg").textContent=`${a.length}명으로 교체`; renderAll(); toast("명단을 교체했습니다",()=>{ S.emps=prev; renderAll(); }); };
$("#resetAll").onclick=()=>{ const prev=JSON.stringify(S); try{localStorage.removeItem(LSKEY);}catch(e){} S=defaultState(); renderAll(); toast("처음 상태로 되돌렸습니다",()=>{ S=JSON.parse(prev); renderAll(); }); };

/* ---------- 개인 상세 / 통보서 ---------- */
function openPerson(id, edit){
  const e=S.emps.find(x=>x.id===id); if(!e) return; const r=calc(e);
  const H=HIST().filter(h=>h.name===e.name).sort((a,b)=>a.date<b.date?-1:1);
  $("#mTitle").textContent=`${e.name} · ${e.co} ${e.pos}`;
  $("#mPrint").style.display="";
  $("#mBody").innerHTML=`
    <div class="grid kpis" style="margin-bottom:14px">
      <div class="kpi"><div class="l">현재 연봉</div><div class="v">${man(e.ann)}</div><div class="s">${won(e.ann)}원</div></div>
      <div class="kpi"><div class="l">협상 후 연봉</div><div class="v">${man(r.newAnn)}</div><div class="s">+${won(r.inc)}원 (${pct(r.eff)})</div></div>
      <div class="kpi"><div class="l">월 급여 / 기본급</div><div class="v" style="font-size:16px">${won(r.nm)}</div><div class="s">기본급 ${won(r.base)} + 식대 ${won(e.meal)}</div></div>
      <div class="kpi"><div class="l">연봉 위치 · 권장</div><div class="v" style="font-size:16px">${crOf(e).toFixed(0)}% · ${pct(recRate(e))}</div><div class="s">${e.grade}등급 · 기준연봉 ${man(S.mids[e.pos]||0)}</div></div>
    </div>
    <div class="row" style="margin-bottom:12px">
      <label>법인 <select id="peCo">${[...new Set([...Object.keys(CORP),...corps()])].map(c=>`<option ${c===e.co?"selected":""}>${c}</option>`).join("")}</select></label>
      <label>성명 <input type="text" id="peName" class="w90" value="${esc(e.name)}"></label>
      <label>부서 <input type="text" id="peDept" class="w120" value="${esc(e.dept)}"></label>
      <label>직위 <input type="text" id="pePos" class="w90" value="${esc(e.pos)}"></label>
      <label>입사일 <input type="date" id="peHire" value="${e.hire}"></label>
      <label>식대 <input type="number" id="peMeal" class="w90" value="${e.meal}"></label>
      <label>연봉(만원) <input type="number" id="peAnn" class="w90" value="${e.ann/1e4}"></label>
      <label>고용형태 <select id="peType">${["정규직","계약직"].map(x=>`<option ${x===e.type?"selected":""}>${x}</option>`).join("")}</select></label>
      <label><input type="checkbox" id="peExec" ${e.exec?"checked":""}> 임원</label>
      <label>지원금 <input type="text" id="peFund" class="w140" value="${esc(fundOf(e))}"></label>
      <button class="btn sm pri" id="peSave">저장</button>
    </div>
    <div class="toolbar" style="margin-bottom:14px"><b>퇴사 처리</b><label>퇴사일 <input type="date" id="peLeft" value="${ymd(TODAY)}"></label><button class="btn sm" id="peLeftBtn">퇴사자로 옮기기</button><div class="spacer"></div><button class="btn sm" id="peDel" style="color:var(--bad)">명단에서 삭제</button><span class="muted" style="font-size:13px">옮기면 모든 합계·인건비·협상 대상에서 빠집니다. 설정·데이터 탭에서 되돌릴 수 있습니다.</span></div>
    <h2 style="font-size:14px;margin:8px 0">인상 이력</h2>
    <div class="tw"><table><thead><tr><th class="l">변경일자</th><th class="l">법인</th><th>기존</th><th>변경후</th><th>인상률</th><th class="l">비고</th></tr></thead><tbody>${H.length? H.map(h=>`<tr><td class="l">${h.date}</td><td class="l">${esc(h.co)}</td><td>${won(h.before)}</td><td>${h.pending?'<span class="tag acc">예정</span>':won(h.after)}</td><td>${h.pending?"-":pct(h.rate)}</td><td class="l" style="white-space:normal;font-size:12px">${esc(h.note)}</td></tr>`).join("") : `<tr><td colspan="6" class="c muted">연봉협상원본에 기록이 없습니다</td></tr>`}</tbody></table></div>
    <h2 style="font-size:14px;margin:16px 0 8px">연봉 조정 통보서 미리보기</h2>
    <div id="letterWrap">${letter(e,r)}</div>`;
  $("#modal").classList.add("on");
  $("#peSave").onclick=()=>{ e.ann=Math.round((+$("#peAnn").value||0)*1e4)||e.ann; e.type=$("#peType").value; e.exec=$("#peExec").checked; e.fund=$("#peFund").value; e.co=$("#peCo").value; e.name=$("#peName").value.trim()||e.name; e.dept=$("#peDept").value; e.pos=$("#pePos").value; e.hire=$("#peHire").value; e.meal=+$("#peMeal").value||0; renderAll(); openPerson(e.id); };
  $("#peLeftBtn").onclick=()=>{ const i=S.emps.indexOf(e); S.emps.splice(i,1); e.left=$("#peLeft").value||ymd(TODAY); S.left.push(e); $("#modal").classList.remove("on"); renderAll(); toast(`${e.name}을(를) 퇴사자로 옮겼습니다`,()=>{ S.left.splice(S.left.indexOf(e),1); delete e.left; S.emps.splice(i,0,e); renderAll(); }); };
  $("#peDel").onclick=()=>{ const i=S.emps.indexOf(e); S.emps.splice(i,1); $("#modal").classList.remove("on"); renderAll(); toast(`${e.name}을(를) 삭제했습니다`,()=>{ S.emps.splice(i,0,e); renderAll(); }); };
  $("#mReport").onclick=()=>goReport(e.id);
  if(edit) $("#peName").select();
}
function letter(e,r){
  const d=pd(e.plan); const nm=monthlyOf(e.ann);
  return `<div class="letter"><h4>연봉 조정 통보서</h4>
  <p>${esc(e.name)} 님의 연봉이 아래와 같이 조정되었음을 알려드립니다.</p>
  <table><tbody>
   <tr><th>소속</th><td>${esc(CORP[e.co]||e.co)}</td><th>부서 / 직위</th><td>${esc(e.dept)} / ${esc(e.pos)}</td></tr>
   <tr><th>성명</th><td>${esc(e.name)}</td><th>적용일</th><td>${d? `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 (${d.getMonth()+1}월 귀속분부터)` : "-"}</td></tr>
  </tbody></table>
  <table style="margin-top:14px"><thead><tr><th>구분</th><th>연봉</th><th>월 급여</th><th>기본급</th><th>식대(비과세)</th></tr></thead><tbody>
   <tr><td>조정 전</td><td>${won(e.ann)}원</td><td>${won(nm)}원</td><td>${won(nm-e.meal)}원</td><td>${won(e.meal)}원</td></tr>
   <tr><td><b>조정 후</b></td><td><b>${won(r.newAnn)}원</b></td><td><b>${won(r.nm)}원</b></td><td>${won(r.base)}원</td><td>${won(e.meal)}원</td></tr>
   <tr><td>증감</td><td colspan="4">+${won(r.inc)}원 (${pct(r.eff)})</td></tr>
  </tbody></table>
  <p style="font-size:12.5px;margin-top:14px">※ 연봉은 세전 금액이며 월 급여는 연봉을 12로 나눈 금액입니다. 기타 근로조건은 기존 근로계약에 따릅니다. 본 내용은 대외비로 취급하여 주시기 바랍니다.</p>
  <div class="sig">${ymd(TODAY).replace(/-/g,". ")}.<br>${esc(CORP[e.co]||e.co)}<br>대표이사 (인)</div></div>`;
}
document.addEventListener("click",ev=>{ const p=ev.target.dataset?.p; if(p) openPerson(p); });
$("#mClose").onclick=()=>$("#modal").classList.remove("on");
$("#modal").onclick=ev=>{ if(ev.target.id==="modal") $("#modal").classList.remove("on"); };
$("#mPrint").onclick=()=>{ $("#printArea").innerHTML=$("#letterWrap").innerHTML; document.body.classList.add("pl"); window.print(); setTimeout(()=>{ $("#printArea").innerHTML=""; document.body.classList.remove("pl"); },500); };

/* ---------- 내보내기 / 저장 ---------- */
function download(name, text, type){ const b=new Blob([text],{type}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},500); }
$("#bExport").onclick=()=>{
  const L=incl().filter(e=>e.plan).sort((a,b)=>a.plan<b.plan?-1:1);
  const q=v=>`"${String(v).replace(/"/g,'""')}"`;
  const lines=[["no.","소속","대상자명","입사일자","기존 월급","기존 연봉","변경일자","변경 급여 귀속월","변경후 월급","변경후 연봉","인상금액","인상률","평가등급","비고"].join(",")];
  L.forEach((e,i)=>{ const r=calc(e), d=pd(e.plan), h=pd(e.hire);
    lines.push([i+1,e.co,e.name, h? `${h.getFullYear()}. ${String(h.getMonth()+1).padStart(2,"0")}. ${String(h.getDate()).padStart(2,"0")}`:"", won(monthlyOf(e.ann)), won(e.ann), e.plan, d?`${d.getMonth()+1}월 귀속부터 반영`:"", won(r.nm), won(r.newAnn), won(r.inc), r.eff.toFixed(1), e.grade, e.memo||""].map(q).join(",")); });
  download(`연봉협상_시뮬레이션_${ymd(TODAY)}.csv`, "﻿"+lines.join("\r\n"), "text/csv;charset=utf-8");
};
$("#bSave").onclick=()=>download(`연봉협상_시나리오_${ymd(TODAY)}.json`, JSON.stringify(S,null,1), "application/json");
$("#bLogout").onclick=async ()=>{ clearTimeout(__saveTimer); await window.__sb.auth.signOut(); location.reload(); };
$("#fLoad").onchange=ev=>{ const f=ev.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ try{ const j=JSON.parse(rd.result); if(!j.emps||!j.set) throw 0; const prev=S; S=j; renderAll(); toast("시나리오를 불러왔습니다",()=>{S=prev;renderAll();}); }catch(e){ toast("시나리오 파일을 읽지 못했습니다"); } }; rd.readAsText(f); ev.target.value=""; };

/* ---------- 탭 / 토스트 ---------- */
function showTab(t){ document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("on",b.dataset.t===t || (t==="report" && b.dataset.t==="plan"))); document.querySelectorAll("section.tab").forEach(s=>s.classList.toggle("on",s.id==="t-"+t)); if(t!=="report") try{sessionStorage.setItem("salaryTab",t);}catch(e){} }
$("#nav").onclick=ev=>{ const t=ev.target.dataset.t; if(!t) return; showTab(t); window.scrollTo(0,0); };
let undoFn=null, tt=null;
function toast(msg, undo){ $("#toastMsg").textContent=msg; undoFn=undo||null; $("#toastUndo").style.display=undo?"":"none"; $("#toast").classList.add("on"); clearTimeout(tt); tt=setTimeout(()=>$("#toast").classList.remove("on"),6000); }
$("#toastUndo").onclick=()=>{ if(undoFn) undoFn(); undoFn=null; $("#toast").classList.remove("on"); };

/* ---------- 대표 보고 ---------- */
const DEC = ["", "승인", "조정", "보류"];
function histAvg12(){ const H=HIST().filter(h=>!h.pending && h.rate>=0 && h.rate<=40 && pd(h.date)>=addM(TODAY,-12) && pd(h.date)<=TODAY).map(h=>h.rate); return H.length? sum(H)/H.length : 0; }
const mKey = d => d? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` : "";
const mLabel = k => { const [y,m]=k.split("-"); return `${y}년 ${+m}월`; };
const fundOf = e => e.fund ?? (RAW.emps.find(x=>x.name===e.name && x.co===e.co)||{}).fund ?? "";
const dLabel = s => { const d=pd(s); if(!d) return "-"; return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.(${"일월화수목금토"[d.getDay()]})`; };
function ensureRp(){ if(!S.rp) S.rp={view:"month",month:"",meet:{},opinion:{}}; ["meet","opinion"].forEach(k=>{ if(!S.rp[k]) S.rp[k]={}; }); }
function monthsWithTargets(){ const m={}; incl().forEach(e=>{ const k=mKey(pd(e.plan)); if(k) (m[k]=m[k]||[]).push(e); }); return m; }
function defaultMonth(){ const ks=Object.keys(monthsWithTargets()).sort(); const now=mKey(TODAY); return ks.find(k=>k>=now) || ks[ks.length-1] || now; }
function nextMonday(){ const d=new Date(TODAY); d.setDate(d.getDate()+((8-d.getDay())%7||7)); return d; }

function renderReport(){
  ensureRev(); ensureRp();
  const v=S.rp.view;
  document.querySelectorAll("#rpView button").forEach(b=>b.classList.toggle("on",b.dataset.v===v));
  $("#rpMonthly").style.display = v==="month"? "" : "none";
  $("#rpAnnual").style.display = v==="year"? "" : "none";
  $("#rpMonthWrap").style.display = $("#rpMeetWrap").style.display = v==="month"? "" : "none";
  if(v==="month") renderMonthly(); else renderAnnual();
}

function corpBase(c, ym){ ensureRev(); const w= ym? winStats(c,ym) : null; return {sales: w? w.sales12 : annSales(c), t:+S.rev.target[c]||0, bud:S.budget[c]||0, w}; }
const planYm = e => (e.plan||ymd(TODAY)).slice(0,7);
// 법인 인건비(다른 협상 예정자는 현재 안대로 인상, 대상자는 N)
// 같은 법인에서 이 사람의 귀속월까지 협상하는 인원만 인상 반영 (이후 예정자는 현재 연봉)
const upTo = (x,e) => x.inc && x.plan && e.plan && x.plan.slice(0,7) <= e.plan.slice(0,7);
function corpCostWith(c, e, N){ return sum(S.emps.filter(x=>x.co===c), x=>{ const a = x.id===e.id? N : (upTo(x,e)? calc(x).newAnn : x.ann); return costOf(a,x.meal).total; }) + annOther(c); }
function personUse(e,N){ const x=calcNew(e,N,0); const b=S.set.corpBasis; return b==="sal"? x.inc : b==="cost"? x.costInc : x.yearCost; }
function maxAnn(e, ok){ // ok(N) 단조 감소 조건, 반올림 단위로 내림
  if(!ok(e.ann)) return {over:true};
  let lo=e.ann, hi=e.ann*3; if(ok(hi)) return {n:hi, open:true};
  for(let k=0;k<50;k++){ const m=(lo+hi)/2; if(ok(m)) lo=m; else hi=m; }
  const u=S.set.round||1; return {n:Math.floor(lo/u)*u};
}
function negoLimits(e){
  const c=e.co, B=corpBase(c,planYm(e)), gi=GRADES.indexOf(e.grade), band=crBand(crOf(e));
  const hiG=GRADES[Math.max(0,gi-1)];
  const out=[];
  out.push({key:"grade", name:`평가 상한 (${hiG}등급 인상률 ${pct(S.matrix[hiG][band])})`, n:calc(e,S.matrix[hiG][band]).newAnn});
  const W=winStats(c,planYm(e));
  if(W && B.t){ const m=maxAnn(e,N=>{ const w=winStats(c,planYm(e),{e,N,upToYm:planYm(e)}); return w.ratio<=B.t; }); out.push({key:"ratio", name:`${c} 인건비율 목표 ${B.t}% 이내 (적용월부터 ${W.n}개월)`, ...m}); }
  else out.push({key:"ratio", name:`${c} 인건비율 목표`, na: W? "목표 비율 미입력" : "예상 매출 미입력"});
  if(B.bud){ const others=sum(incl().filter(x=>x.co===c && x.id!==e.id && upTo(x,e)), x=>personUse(x,calc(x).newAnn)); const m=maxAnn(e,N=>personUse(e,N)<=B.bud-others); out.push({key:"bud", name:`${c} 인상 예산 잔여 (${wm(Math.max(0,B.bud-others))}만원, 이번 달까지 사용분 제외)`, ...m}); }
  else out.push({key:"bud", name:`${c} 인상 예산`, na:"예산 미입력"});
  const valid=out.filter(x=>x.n!=null || x.over);
  let bind=null; valid.forEach(x=>{ const v=x.over? e.ann : x.n; if(!bind || v<(bind.over?e.ann:bind.n)) bind=x; });
  return {list:out, bind, max: bind? (bind.over? e.ann : bind.n) : null};
}
const BIND_TXT={grade:"평가 등급 상한",ratio:"법인 인건비율 목표",bud:"법인 인상 예산"};

function renderMonthly(){
  const map=monthsWithTargets(); const keys=Object.keys(map).sort();
  if(!S.rp.month || !map[S.rp.month]) S.rp.month = defaultMonth();
  const M=S.rp.month;
  $("#rpMonth").innerHTML = keys.map(k=>`<option value="${k}" ${k===M?"selected":""}>${mLabel(k)} 귀속 (${map[k].length}명)</option>`).join("");
  if(!S.rp.meet[M] && M===defaultMonth()) S.rp.meet[M]=ymd(nextMonday());
  $("#rpMeet").value = S.rp.meet[M]||"";
  const L=(map[M]||[]).sort((a,b)=>coOrder(a.co)-coOrder(b.co)||(a.name<b.name?-1:1));
  const R=L.map(e=>({e,r:calc(e),lim:negoLimits(e)}));
  const cs=[...new Set(L.map(e=>e.co))];
  $("#rpTitle").textContent = `${mLabel(M)} 귀속 연봉협상 보고`;
  $("#rpDate").textContent = `보고일 ${dLabel(ymd(TODAY))} · 협상 진행 ${S.rp.meet[M]? dLabel(S.rp.meet[M]) : "미정"} · 인사총무`;
  const inc=sum(R,x=>x.r.inc), ci=sum(R,x=>x.r.costInc), a0=sum(R,x=>x.e.ann);
  const y=M.slice(0,4);
  const ycost=R.reduce((s,x)=>{ const d=pd(x.e.plan); const m = d&&d.getFullYear()==y? 12-d.getMonth() : 0; return s+x.r.costInc/12*m; },0);
  const salesTot=sum(cs,c=>annSales(c));
  const maxTot=R.every(x=>x.lim.max!=null)? sum(R,x=>x.lim.max) : null;
  $("#rpMHead").innerHTML = `
    <div class="rp-ask"><b>${L.map(e=>e.name).join(", ")||"대상자 없음"}</b> ${L.length}명은 <b>${mLabel(M)} 귀속분부터</b> 연봉이 조정될 예정입니다.
      현재 평가 기준 제안대로 하면 연봉 합계 <b>${wm(a0)} → ${wm(a0+inc)}만원 (${sg(inc)}만원, ${pct(a0?inc/a0*100:0)})</b>, 회사 부담 인건비는 연 <b>${sg(ci)}만원</b> 늘어납니다.
      ${maxTot!=null? `협상 상한까지 올리면 연봉 합계는 최대 <b>${wm(maxTot)}만원</b>입니다.`:""}</div>
    <div class="grid kpis">
      <div class="kpi"><div class="l">대상</div><div class="v">${L.length}명</div><div class="s">${L.map(e=>`${e.name}(${e.co})`).join(" · ")}</div></div>
      <div class="kpi"><div class="l">제안 기준 연봉 증가</div><div class="v">${sg(inc)}<small>만원</small></div><div class="s">평균 ${pct(a0?inc/a0*100:0)}</div></div>
      <div class="kpi"><div class="l">회사 부담 인건비 증가 (연)</div><div class="v">${sg(ci)}<small>만원</small></div><div class="s">4대보험·퇴직급여 포함 · ${y}년 지출 ${sg(ycost)}만원</div></div>
      <div class="kpi"><div class="l">매출 대비 인건비 증가</div><div class="v">${salesTot? pct(ci/salesTot*100,2) : "<span class='muted' style='font-size:16px'>매출 미입력</span>"}</div><div class="s">${salesTot? `해당 법인 연 매출 ${wm(salesTot)}만원 기준` : "아래 표에 법인 매출을 넣어 주세요"}</div></div>
      <div class="kpi"><div class="l">최대 협상 가능 합계</div><div class="v">${maxTot!=null? wm(maxTot)+"<small>만원</small>" : "-"}</div><div class="s">${maxTot!=null? `현재 대비 ${sg(maxTot-a0)}만원 · 제안 대비 ${sg(maxTot-a0-inc)}만원`:""}</div></div>
    </div>
    <div class="pc-cap" style="margin-top:18px">법인별 이번 달 영향 <span class="muted" style="font-weight:400">· 매출은 법인별 분석 탭의 월별 표에서, 목표·예산은 여기서 고칠 수 있습니다 (만원)</span></div>
    <div class="tw"><table id="rpBase"><thead><tr><th class="l">법인</th><th>이번 달 대상</th><th>연봉 증가</th><th>인건비 증가 (연)</th><th>매출 대비</th><th>${mLabel(M).slice(6)}부터 12개월 매출</th><th>인건비</th><th>인건비율 (이번 협상 전 → 후)</th><th>인건비율 목표 (%)</th><th>인상 예산</th></tr></thead><tbody>`+
      cs.map(c=>{ const B=corpBase(c,M), lc=laborCost(c); const RR=R.filter(x=>x.e.co===c); const ci2=sum(RR,x=>x.r.costInc); const w0=winStats(c,M,{upToYm:ymAdd(M,-1)}), w1=winStats(c,M,{upToYm:M});
        return `<tr data-bc="${esc(c)}" ${coRow(c)}><td class="l">${coTag(c)}<span class="sub">${esc(CORP[c]||c)}</span></td>
        <td>${RR.length}명<span class="sub">${RR.map(x=>esc(x.e.name)).join(", ")}</span></td><td><b>${sg(sum(RR,x=>x.r.inc))}</b></td><td>${sg(ci2)}</td><td>${B.sales? pct(ci2/B.sales*100,3) : '<span class="muted">-</span>'}</td>
        <td>${w1? wm(w1.sales)+`<span class="sub">${w1.n}개월 입력</span>` : '<span class="muted">미입력</span>'}</td>
        <td>${w1? wm(w1.labor/w1.n)+"<span class=\"sub\">월평균</span>" : wm(lc/12)+"<span class=\"sub\">월평균</span>"}</td><td>${w1? pct(w0.ratio,2)+" → <b>"+pct(w1.ratio,2)+"</b>" : '<span class="muted">법인별 분석 탭에서 월 매출 입력</span>'}</td>
        <td><input type="number" class="w60" data-bt step="1" value="${B.t||""}" placeholder="-"></td>
        <td><input type="number" class="w90" data-bb step="100" value="${B.bud? B.bud/1e4 : ""}" placeholder="미입력"></td></tr>`; }).join("")+`</tbody></table></div>
    <div class="pc-cap" style="margin-top:18px">대상자 한눈에 보기 (만원)</div><div class="tw"><table><thead><tr><th class="l">법인</th><th class="l">성명 · 직위</th><th class="c">평가</th><th>현재 연봉</th><th>제안 연봉</th><th>인상률</th><th>인건비 증가 (연)</th><th>법인 매출 대비</th><th>최대 협상 가능</th><th>제안 대비 여유</th><th class="l">상한 기준</th></tr></thead><tbody>`+
    cs.map(c=>{ const RR=R.filter(x=>x.e.co===c); const p0=sum(RR,x=>x.e.ann), p1=sum(RR,x=>x.r.newAnn), pc=sum(RR,x=>x.r.costInc), s=annSales(c), mx=RR.every(x=>x.lim.max!=null)? sum(RR,x=>x.lim.max):null;
      return RR.map(({e,r,lim})=>{ return `<tr ${coRow(e.co)}><td class="l">${coTag(e.co)}</td><td class="l"><b>${esc(e.name)}</b><span class="sub">${esc(e.pos)}</span></td><td class="c"><b>${e.grade}</b></td><td>${wm(e.ann)}</td><td><b>${wm(r.newAnn)}</b></td><td><b>${pct(r.eff)}</b></td><td>${sg(r.costInc)}</td><td>${s? pct(r.costInc/s*100,3) : '<span class="muted">-</span>'}</td>
      <td><b style="color:var(--accent)">${lim.max!=null? wm(lim.max) : "-"}</b><span class="sub">${lim.max!=null? pct((lim.max-e.ann)/e.ann*100)+" 인상" : ""}</span></td><td>${lim.max!=null? sg(lim.max-r.newAnn) : "-"}</td><td class="l">${lim.bind? (lim.bind.over? '<span class="tag bad">'+BIND_TXT[lim.bind.key]+' 이미 초과</span>' : BIND_TXT[lim.bind.key]) : "-"}</td></tr>`; }).join("")+
      (cs.length>1? `<tr class="cosub" ${coRow(c)}><td class="l" colspan="3">${esc(c)} 소계 ${RR.length}명</td><td>${wm(p0)}</td><td>${wm(p1)}</td><td>${pct(p0?(p1-p0)/p0*100:0)}</td><td>${sg(pc)}</td><td>${s? pct(pc/s*100,3):"-"}</td><td>${mx!=null? wm(mx):"-"}</td><td>${mx!=null? sg(mx-p1):"-"}</td><td></td></tr>` : ""); }).join("")+
    `</tbody><tfoot><tr><td class="l" colspan="3">합계 ${L.length}명</td><td>${wm(a0)}</td><td>${wm(a0+inc)}</td><td>${pct(a0?inc/a0*100:0)}</td><td>${sg(ci)}</td><td>${salesTot? pct(ci/salesTot*100,3):"-"}</td><td>${maxTot!=null? wm(maxTot):"-"}</td><td>${maxTot!=null? sg(maxTot-a0-inc):"-"}</td><td></td></tr></tfoot></table></div>`;
  $("#rpCards").innerHTML = cs.map(c=>{ const RR=R.filter(x=>x.e.co===c); const B=corpBase(c,M); const pc=sum(RR,x=>x.r.costInc);
      return `<div class="coband" style="--cc:var(--c-${esc(c)})"><span class="nm">${esc(c)}</span><span class="full">${esc(CORP[c]||"")}</span>
        <span class="st">대상 <b>${RR.length}명</b> · 연봉 <b>${sg(sum(RR,x=>x.r.inc))}</b>만원 · 인건비 <b>${sg(pc)}</b>만원${B.sales? ` · 매출 대비 <b>${pct(pc/B.sales*100,3)}</b>`:""}</span></div>`+
        RR.map(({e,r,lim})=>personCard(e,r,lim)).join(""); }).join("") || `<div class="card"><p class="muted">이 달에 협상 예정인 대상자가 없습니다.</p></div>`;
  $("#rpOpinion").value = S.rp.opinion[M]||"";
}

function personCard(e, r, lim){
  const rec=recRate(e), cr=crOf(e), band=crBand(cr);
  const peers=S.emps.filter(x=>!x.exec && x.pos===e.pos && x.id!==e.id); const pa=peers.map(x=>x.ann);
  const cpeers=peers.filter(x=>x.co===e.co).map(x=>x.ann);
  const rankBelow=pa.filter(a=>a<r.newAnn).length;
  const H=HIST().filter(h=>h.name===e.name && !h.pending).sort((a,b)=>a.date<b.date?-1:1);
  const nm0=monthlyOf(e.ann);
  const B=corpBase(e.co,planYm(e));
  const W0=winStats(e.co,planYm(e),{e,N:e.ann,upToYm:planYm(e)}); const curRatio = W0? W0.ratio/100 : null;
  const flags=[];
  if(!r.minOk) flags.push('<span class="tag bad">협상 후 최저임금 미달</span>');
  if(e.rate!==null && e.rate!=="" && Math.abs(r.rate-rec)>=3) flags.push(`<span class="tag warn">권장 대비 ${r.rate>rec?"+":""}${(r.rate-rec).toFixed(1)}%p</span>`);
  if(band===0) flags.push('<span class="tag acc">직위 기준연봉보다 낮음</span>'); if(band===2) flags.push('<span class="tag">직위 기준연봉보다 높음</span>');
  if(!H.length) flags.push('<span class="tag">입사 후 첫 연봉협상</span>');
  const special=H.filter(h=>h.rate<0||h.rate>40);
  const fund=fundOf(e);
  // 등급별 시나리오
  const scen=GRADES.map(g=>({lab:`${g}등급`, g, rate:S.matrix[g][band]}));
  if(e.rate!==null && e.rate!=="") scen.unshift({lab:"현재 입력값", g:null, rate:+e.rate, cur:true});
  scen.push({lab:"사내 최근 평균", g:null, rate:+histAvg12().toFixed(1)});
  if(lim.max!=null) scen.push({lab:"최대 협상 가능", g:null, n:lim.max, max:true});
  const srow=s=>{ const x = s.n!=null? calcNew(e,s.n,0) : calc(e,s.rate); const isCur = s.cur || (s.g===e.grade && (e.rate===null||e.rate===""));
    const W1=winStats(e.co,planYm(e),{e,N:x.newAnn,upToYm:planYm(e)}); const ratioAfter = W1? W1.ratio : null;
    const needSales = curRatio? x.costInc/curRatio : null;
    const overT = B.t && ratioAfter!=null && ratioAfter>B.t;
    return `<tr class="${isCur?"rp-main":""} ${s.max?"rp-max":""}"><td class="l">${isCur?"<b>"+s.lab+" · 제안</b>":s.max?"<b>"+s.lab+"</b>":s.lab}</td><td><b>${pct(x.eff)}</b></td><td>${wm(x.newAnn)}</td><td>${sg(x.inc)}</td><td>${won(x.nm)}</td><td>${sg(x.costInc)}</td>
      <td>${B.sales? pct(x.costInc/B.sales*100,3) : "-"}</td><td>${ratioAfter==null? "-" : (overT? `<span class="tag bad">${pct(ratioAfter,2)}</span>` : pct(ratioAfter,2))}</td><td>${needSales==null? "-" : wm(needSales)}</td></tr>`; };
  return `<div class="card pcard" data-rid="${e.id}" style="--cc:var(--c-${esc(e.co)})">
   <div class="pc-head">
     <div class="pc-name">${coTag(e.co)} ${esc(e.name)} <span class="pc-pos">${esc(CORP[e.co]||e.co)} · ${esc(e.dept)} · ${esc(e.pos)} · ${esc(e.type||"")}</span></div>
     <div class="pc-meta">입사 ${dLabel(e.hire)} · 근속 ${tenure(e.hire)} · 평가 <b>${e.grade}등급</b> · 적용 ${dLabel(e.plan)} (${pd(e.plan).getMonth()+1}월 귀속)${fund?` · 지원금 ${esc(fund)}`:""}</div>
     <div style="margin-top:6px">${flags.join(" ")}</div>
   </div>
   <div class="pc-sum">
     <div><span>현재 연봉</span><b>${wm(e.ann)}</b><small>만원</small></div>
     <div class="arrow">→</div>
     <div><span>제안 (${e.grade}등급 ${pct(r.eff)})</span><b>${wm(r.newAnn)}</b><small>만원</small></div>
     <div class="pc-max"><span>최대 협상 가능</span><b>${lim.max!=null? wm(lim.max) : "-"}</b><small>만원${lim.max!=null? ` · ${pct((lim.max-e.ann)/e.ann*100)}`:""}</small></div>
     <div><span>법인 매출 대비 인건비 증가</span><b>${B.sales? pct(r.costInc/B.sales*100,3) : "-"}</b><small>${B.sales? `연 ${sg(r.costInc)}만원 / 매출 ${wm(B.sales)}만원` : "매출 미입력"}</small></div>
   </div>
   <div class="pc-box" style="margin-bottom:14px">
     <div class="pc-cap">등급별 인상 시 ${esc(e.co)} 법인 영향 (만원)</div>
     <div class="tw" style="border:0"><table class="pc-cmp"><thead><tr><th class="l">기준</th><th>인상률</th><th>연봉</th><th>인상액</th><th>월 급여(원)</th><th>인건비 증가 (연)</th><th>법인 매출 대비</th><th>적용 후 12개월 인건비율${B.t?` (목표 ${B.t}%)`:""}</th><th title="법인의 현재 인건비율을 유지하려면 늘어나야 하는 연 매출">인건비율 유지 필요 매출</th></tr></thead><tbody>
       ${scen.map(srow).join("")}
     </tbody></table></div>
     <p class="note">법인 인건비율은 적용월부터 12개월(월별 예상 매출을 넣은 달) 합계 기준이며, 같은 법인에서 이번 달까지 협상하는 인원의 인상분만 반영했습니다(이후 달 예정자는 현재 연봉 기준)${curRatio? ` (현재 ${pct(curRatio*100,2)})`:""}. 「인건비율 유지 필요 매출」은 이 인상분을 감당하면서 현재 인건비율을 지키려면 연 매출이 얼마나 더 늘어야 하는지입니다.</p>
   </div>
   <div class="pc-grid">
     <div class="pc-box">
       <div class="pc-cap">최대 협상 가능 금액</div>
       <table class="pc-kv"><tbody>
         ${lim.list.map(x=>`<tr ${lim.bind===x?'class="rp-main"':""}><td class="l">${x.name}</td><td>${x.na? `<span class="muted">${x.na}</span>` : x.over? '<span class="tag bad">이미 초과 · 인상 여력 없음</span>' : `<b>${wm(x.n)}만원</b> <span class="muted">(${pct((x.n-e.ann)/e.ann*100)})</span>${x.open?" 이상":""}`}</td></tr>`).join("")}
         <tr><td class="l"><b>최대 협상 가능</b></td><td><b style="font-size:18px;color:var(--accent)">${lim.max!=null? wm(lim.max)+"만원" : "-"}</b>${lim.bind? ` <span class="muted">← ${BIND_TXT[lim.bind.key]}</span>`:""}</td></tr>
         <tr><td class="l">참고 · 같은 직위 ${esc(e.co)} 최고</td><td>${cpeers.length? wm(Math.max(...cpeers))+"만원" : "-"}</td></tr>
       </tbody></table>
       <p class="note">세 기준 중 가장 낮은 금액이 상한입니다. 매출·목표 비율·예산은 위 「법인 기준값」에서 넣습니다.</p>
     </div>
     <div class="pc-box">
       <div class="pc-cap">조정 내용 (원)</div>
       <table class="pc-cmp"><thead><tr><th class="l"></th><th>현재</th><th>제안</th><th>증감</th></tr></thead><tbody>
         <tr><td class="l">연봉</td><td>${won(e.ann)}</td><td><b>${won(r.newAnn)}</b></td><td class="${r.inc<0?"dn":"up"}"><b>${sgw(r.inc)}</b></td></tr>
         <tr><td class="l">월 급여</td><td>${won(nm0)}</td><td><b>${won(r.nm)}</b></td><td>${sgw(r.nm-nm0)}</td></tr>
         <tr><td class="l">기본급</td><td>${won(nm0-e.meal)}</td><td>${won(r.base)}</td><td>${sgw(r.base-(nm0-e.meal))}</td></tr>
         <tr><td class="l">식대 (비과세)</td><td>${won(e.meal)}</td><td>${won(e.meal)}</td><td>-</td></tr>
         <tr><td class="l">회사 부담 인건비 (연)</td><td>${won(r.cost0)}</td><td>${won(r.cost1)}</td><td>${sgw(r.costInc)}</td></tr>
       </tbody></table>
     </div>
   </div>
   <div class="pc-grid">
     <div class="pc-box">
       <div class="pc-cap">판단 근거</div>
       <table class="pc-kv"><tbody>
         <tr><td class="l">직위(${esc(e.pos)}) 기준연봉</td><td>${wm(S.mids[e.pos]||0)}만원 <span class="muted">· 현재 ${cr.toFixed(0)}% → 제안 ${S.mids[e.pos]? (r.newAnn/S.mids[e.pos]*100).toFixed(0):"-"}%</span></td></tr>
         <tr><td class="l">같은 직위 전사 (${pa.length}명)</td><td>${pa.length? `평균 ${wm(sum(pa)/pa.length)} · 범위 ${wm(Math.min(...pa))}~${wm(Math.max(...pa))}만원`:"-"}</td></tr>
         <tr><td class="l">같은 직위 ${esc(e.co)} (${cpeers.length}명)</td><td>${cpeers.length? `평균 ${wm(sum(cpeers)/cpeers.length)}만원`:"-"}</td></tr>
         <tr><td class="l">제안 시 직위 내 위치</td><td>${pa.length+1}명 중 아래에서 ${rankBelow+1}번째</td></tr>
         <tr><td class="l">사내 최근 12개월 인상률</td><td>평균 ${pct(histAvg12())}</td></tr>
         <tr><td class="l">2027년 최저임금 월 환산</td><td>${won(S.set.minHour*S.set.minHours)}원</td></tr>
       </tbody></table>
     </div>
     <div class="pc-box">
       <div class="pc-cap">인상 이력 (만원)</div>
       <table class="pc-cmp"><thead><tr><th class="l">적용일</th><th>변경 전</th><th>변경 후</th><th>인상률</th></tr></thead><tbody>
       ${[{date:e.hire,_h:1},...H].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a._h?1:-1)).map(h=> h._h? `<tr><td class="l">${h.date} 입사</td><td colspan="3" class="muted" style="text-align:left">${H.some(x=>x.date>e.hire)? "현 근로계약 시작" : `${H.some(x=>x.date<e.hire)?"재입사 · ":""}입사 연봉 ${wm(e.ann)}만원 · 이후 변동 없음`}</td></tr>` : `<tr><td class="l">${h.date}</td><td>${wm(h.before)}</td><td>${wm(h.after)}</td><td>${(h.rate<0||h.rate>40)?'<span class="tag warn">구조 변경</span>':pct(h.rate)}</td></tr>`).join("")}
       </tbody></table>
       ${special.length? `<div class="pc-note">${special.map(h=>esc(h.note)).join("<br>")}</div>`:""}
     </div>
   </div>
   <div class="pc-dec"><span class="pc-cap" style="margin:0">협상 메모</span><input type="text" class="pc-cmt" data-cmt value="${esc(e.decNote||"")}" placeholder="협상 결과나 특이사항"></div>
  </div>`;
}

function renderAnnual(){
  const L=incl(), R=L.map(e=>({e,r:calc(e)}));
  const a0=sum(R,x=>x.e.ann), a1=sum(R,x=>x.r.newAnn), ci=sum(R,x=>x.r.costInc), yc=sum(R,x=>x.r.yearCost);
  const cs=corps(); const avg=a0?(a1-a0)/a0*100:0;
  $("#rpTitle").textContent = `연봉 조정 연간 현황`;
  $("#rpDate").textContent = `작성일 ${dLabel(ymd(TODAY))} · ${S.set.year}년 예산연도`;
  const totSales=sum(cs,c=>annSales(c));
  const ratio0= totSales? sum(cs,c=>laborCost(c))/totSales*100 : null, ratio1= totSales? sum(cs,c=>laborCost(c,e=>calc(e).newAnn))/totSales*100 : null;
  $("#rpHead").innerHTML = `
    <div class="rp-ask">향후 12개월 협상 대상 <b>${L.length}명</b> 전체를 현재 안대로 조정하면 연봉 총액 <b>${sg(a1-a0)}만원</b> (평균 <b>${pct(avg)}</b>), 회사 부담 인건비 연 <b>${sg(ci)}만원</b>입니다.</div>
    <div class="grid kpis">
      <div class="kpi"><div class="l">협상 대상</div><div class="v">${L.length}명</div><div class="s">${cs.map(c=>`${c} ${L.filter(e=>e.co===c).length}`).join(" · ")}</div></div>
      <div class="kpi"><div class="l">연봉 총액 증가</div><div class="v">${sg(a1-a0)}<small>만원</small></div><div class="s">${wm(a0)} → ${wm(a1)}만원</div></div>
      <div class="kpi"><div class="l">평균 인상률</div><div class="v">${pct(avg)}</div><div class="s">최근 12개월 사내 평균 ${pct(histAvg12())}</div></div>
      <div class="kpi"><div class="l">회사 부담 인건비 증가 (연)</div><div class="v">${sg(ci)}<small>만원</small></div><div class="s">4대보험·퇴직급여 포함</div></div>
      <div class="kpi"><div class="l">${S.set.year}년 실제 지출 증가</div><div class="v">${sg(yc)}<small>만원</small></div><div class="s">적용월부터 연말까지</div></div>
      <div class="kpi"><div class="l">매출 대비 인건비율</div><div class="v">${ratio1==null?"<span class='muted' style='font-size:16px'>매출 미입력</span>":pct(ratio1)}</div><div class="s">${ratio0==null?"법인별 분석 탭에서 매출 입력":`현재 ${pct(ratio0)} → +${(ratio1-ratio0).toFixed(2)}%p`}</div></div>
    </div>`;
  $("#rpCorp").innerHTML = `<thead><tr><th class="l">법인</th><th>대상</th><th>연봉 증가 (만원)</th><th>평균 인상률</th><th>인건비 증가 (만원, 연)</th><th>예산 대비</th><th>매출 대비 인건비율</th><th class="c">판단</th></tr></thead><tbody>`+
    cs.map(c=>{ const rr=R.filter(x=>x.e.co===c); const p=sum(rr,x=>x.e.ann), q=sum(rr,x=>x.r.newAnn), cc=sum(rr,x=>x.r.costInc);
      const bud=S.budget[c]||0, use=corpUse(c), bp=bud? use/bud*100 : null;
      const sales=annSales(c), t=+S.rev.target[c]||0, r0=sales? laborCost(c)/sales*100:null, r1=sales? laborCost(c,e=>calc(e).newAnn)/sales*100:null;
      let st=["good","적정"]; if(bp!=null && bp>100) st=["bad","예산 초과"]; if(t && r1!=null && r1>t) st=["bad","인건비율 초과"]; if(st[0]==="good" && bp==null && r1==null) st=["","기준 미입력"];
      return `<tr ${coRow(c)}><td class="l">${coTag(c)}</td><td>${rr.length}명</td><td><b>${sg(q-p)}</b></td><td>${pct(p?(q-p)/p*100:0)}</td><td>${sg(cc)}</td>
        <td>${bp==null?'<span class="muted">예산 미입력</span>':`<div class="bar ${bp>100?"over":""}" style="display:inline-block;width:80px;vertical-align:middle"><i style="width:${Math.min(100,bp)}%"></i></div> ${pct(bp,0)}`}</td>
        <td>${r1==null?'<span class="muted">매출 미입력</span>':`${pct(r0)} → ${ratioTag(r1,t)}${t?` <span class="muted">(목표 ${t}%)</span>`:""}`}</td>
        <td class="c"><span class="tag ${st[0]}">${st[1]}</span></td></tr>`; }).join("")+
    `</tbody><tfoot><tr><td class="l">합계</td><td>${L.length}명</td><td>${sg(a1-a0)}</td><td>${pct(avg)}</td><td>${sg(ci)}</td><td>${(()=>{ const bc=cs.filter(c=>S.budget[c]); return bc.length? pct(sum(bc,c=>corpUse(c))/sum(bc,c=>S.budget[c])*100,0) : "-"; })()}</td><td>${ratio1==null?"-":pct(ratio0)+" → "+pct(ratio1)}</td><td></td></tr></tfoot>`;
  const alts=[["현재 협상안 (평가 반영)", e=>calc(e).newAnn],[`시뮬레이터안 (${SCOPE_NAME[S.bulk.scope]})`, e=>simNew(e)],["최저임금 인상률 수준 (+3.7%)", e=>roundTo(e.ann*1.037)],[`사내 최근 평균 수준 (+${histAvg12().toFixed(1)}%)`, e=>roundTo(e.ann*(1+histAvg12()/100))]];
  $("#rpAlt").innerHTML=`<thead><tr><th class="l">안</th><th>연봉 증가 (만원)</th><th>평균 인상률</th><th>인건비 증가 (만원, 연)</th><th>매출 대비 인건비율</th><th>최저임금 미달</th></tr></thead><tbody>`+
    alts.map(([n,f],i)=>{ const q=sum(L,f), c=sum(L,e=>costOf(f(e),e.meal).total-costOf(e.ann,e.meal).total); const rr=totSales? sum(cs,k=>laborCost(k,f))/totSales*100 : null; const bad=L.filter(e=>monthlyOf(f(e))<S.set.minHour*S.set.minHours && !e.exec).length;
      return `<tr ${i===0?'class="rp-main"':""}><td class="l">${i===0?"<b>"+n+"</b>":n}</td><td>${sg(q-a0)}</td><td>${pct(a0?(q-a0)/a0*100:0)}</td><td>${sg(c)}</td><td>${rr==null?"-":pct(rr)}</td><td>${bad?`<span class="tag bad">${bad}명</span>`:'<span class="tag good">없음</span>'}</td></tr>`; }).join("")+`</tbody>`;
  const order=[...R].sort((x,y)=>(x.e.plan||"9")<(y.e.plan||"9")?-1:1);
  $("#rpPeople").innerHTML=`<thead><tr><th class="l">귀속월</th><th class="l">법인</th><th class="l">성명 · 직위</th><th class="c">평가</th><th>현재 (만원)</th><th>제안 (만원)</th><th>인상률</th></tr></thead><tbody>`+
    order.map(({e,r})=>{ const d=pd(e.plan); const k=mKey(d);
      return `<tr class="dec-${e.dec||"none"}"><td class="l"><button class="namebtn" data-gom="${k}">${d?`${d.getFullYear()}년 ${d.getMonth()+1}월`:"-"}</button></td><td class="l">${coTag(e.co)}</td><td class="l">${esc(e.name)}<span class="sub">${esc(e.pos)} · 근속 ${tenure(e.hire)}</span></td><td class="c"><b>${e.grade}</b></td><td>${wm(e.ann)}</td><td><b>${wm(r.newAnn)}</b><span class="sub up">${sg(r.inc)}</span></td><td><b>${pct(r.eff)}</b></td></tr>`; }).join("")+`</tbody>`;
  $("#rpAlerts").innerHTML=$("#dashAlerts").innerHTML;
}
$("#rpView").onclick=ev=>{ const v=ev.target.dataset.v; if(!v) return; ensureRp(); S.rp.view=v; renderReport(); persist(); };
$("#rpMonth").onchange=ev=>{ S.rp.month=ev.target.value; renderReport(); persist(); };
$("#rpMeet").onchange=ev=>{ S.rp.meet[S.rp.month]=ev.target.value; renderReport(); persist(); };
$("#rpOpinion").addEventListener("input",ev=>{ ensureRp(); S.rp.opinion[S.rp.month]=ev.target.value; persist(); });
$("#t-report").addEventListener("click",ev=>{
  const t=ev.target;
  if(t.dataset.gom){ ensureRp(); S.rp.view="month"; S.rp.month=t.dataset.gom; renderReport(); persist(); window.scrollTo(0,0); return; }
});
$("#t-report").addEventListener("change",ev=>{
  const t=ev.target, bc=t.closest("tr[data-bc]");
  if(bc){ ensureRev(); const c=bc.dataset.bc; if(t.dataset.bs!=null){ if(S.rev.unit==="month") S.rev.unit="year"; S.rev.sales[c]=(+t.value||0)*1e4; } else if(t.dataset.bt!=null) S.rev.target[c]=+t.value||0; else if(t.dataset.bb!=null) S.budget[c]=(+t.value||0)*1e4; renderAll(); return; }
  const card=t.closest("[data-rid]"); if(!card) return; const e=S.emps.find(x=>x.id===card.dataset.rid);
  if(t.dataset.adj!=null){ const n=Math.round((+t.value||0)*1e4); if(n>0 && e.ann){ e.rate=+((n-e.ann)/e.ann*100).toFixed(4); renderAll(); toast(`${e.name} 조정 연봉을 협상표에 반영했습니다`); } }
  if(t.dataset.cmt!=null){ e.decNote=t.value; persist(); }
});
$("#rpBack").onclick=()=>{ showTab("plan"); window.scrollTo(0,0); };
$("#pRep").onclick=()=>{ ensureRp(); S.rp.view="month"; S.rp.month=defaultMonth(); showTab("report"); renderAll(); window.scrollTo(0,0); };
$("#rpPrint").onclick=()=>{ document.body.classList.add("pr"); window.print(); setTimeout(()=>document.body.classList.remove("pr"),500); };

$("#leftTbl").addEventListener("change",ev=>{ const i=ev.target.dataset.leftd; if(i==null) return; S.left[+i].left=ev.target.value; renderAll(); });
$("#leftTbl").addEventListener("click",ev=>{ const d=ev.target.dataset.ldel; if(d!=null){ const e=S.left.splice(+d,1)[0]; renderAll(); toast(`${e.name}을(를) 완전히 삭제했습니다`,()=>{ S.left.splice(+d,0,e); renderAll(); }); return; } const i=ev.target.dataset.restore; if(i==null) return; const e=S.left.splice(+i,1)[0]; delete e.left; S.emps.push(e); renderAll(); toast(`${e.name}을(를) 재직 명단에 되돌렸습니다`); });
function goReport(id){
  const e=S.emps.find(x=>x.id===id); if(!e) return; ensureRp();
  if(S.coFilter && S.coFilter!==e.co) S.coFilter="";
  if(!e.inc){ toast(`${e.name}은(는) 협상 대상에서 제외되어 있어 보고 페이지가 없습니다`); return; }
  S.rp.view="month"; S.rp.month=planYm(e); $("#modal").classList.remove("on");
  showTab("report"); renderAll();
  requestAnimationFrame(()=>{ const card=document.querySelector(`#rpCards [data-rid="${id}"]`); if(!card) return;
    const top=card.getBoundingClientRect().top+window.scrollY-document.querySelector("header").offsetHeight-12; window.scrollTo({top,behavior:"smooth"});
    card.classList.remove("flash"); void card.offsetWidth; card.classList.add("flash"); });
}
document.addEventListener("click",ev=>{ const t=ev.target.closest("[data-rp]"); if(!t || ev.target.closest("input,select")) return; goReport(t.dataset.rp); });
document.addEventListener("click",ev=>{ const b=ev.target.closest("[data-cf]"); if(!b || !b.closest("#coF,#coScope")) return; S.coFilter=b.dataset.cf; renderAll(); });
ensureEdit();
renderAll();
try{ const t=sessionStorage.getItem("salaryTab"); if(t) document.querySelector(`#nav button[data-t="${t}"]`)?.click(); }catch(e){}
