// Supabase 연결·로그인·데이터 로드. 이 파일이 끝나야 js/app.js를 붙여서 실행함.
// 아래 두 값을 Supabase 프로젝트 설정(Settings > API)의 실제 값으로 바꾸세요.
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";

window.__sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const BOOT_LSKEY = "salarySim.v1"; // js/app.js의 LSKEY와 같은 값(마이그레이션용). 이름을 다르게 둔 건 app.js를 나중에 같은 전역 스코프에 끼워넣기 때문 — 겹치면 SyntaxError로 app.js 전체가 죽음
const $g = id => document.getElementById(id);

function showLogin(msg){
  document.body.classList.remove("authed");
  $g("loginGate").classList.add("on");
  $g("loginErr").textContent = msg || "";
}

function hideLogin(){
  document.body.classList.add("authed");
  $g("loginGate").classList.remove("on");
}

async function loadAndLaunch(){
  hideLogin();
  let cloud = null;
  try{
    const { data, error } = await window.__sb.from("app_state").select("data").eq("id", 1).single();
    if(error && error.code !== "PGRST116") throw error; // PGRST116 = 행 없음(첫 실행)
    if(data) cloud = data.data;
  }catch(e){
    console.error(e);
    showLogin("클라우드 데이터를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침 해주세요.");
    await window.__sb.auth.signOut();
    return;
  }
  // 첫 실행이고 이 브라우저에 예전 로컬 데이터가 남아 있으면 그걸로 시작(한 번만, 다음부터는 클라우드가 기준)
  if(!cloud){
    try{ const local = localStorage.getItem(BOOT_LSKEY); if(local) cloud = JSON.parse(local); }catch(e){}
  }
  window.__CLOUD_STATE = cloud;
  const s = document.createElement("script");
  s.src = "js/app.js";
  document.body.appendChild(s);
}

$g("loginBtn").onclick = async () => {
  const email = $g("loginEmail").value.trim();
  const password = $g("loginPw").value;
  if(!email || !password){ $g("loginErr").textContent = "이메일과 비밀번호를 입력하세요."; return; }
  $g("loginBtn").disabled = true;
  const { error } = await window.__sb.auth.signInWithPassword({ email, password });
  $g("loginBtn").disabled = false;
  if(error){ $g("loginErr").textContent = "로그인 실패: " + error.message; return; }
  await loadAndLaunch();
};
$g("loginPw").addEventListener("keydown", ev=>{ if(ev.key==="Enter") $g("loginBtn").click(); });

(async function start(){
  const { data:{ session } } = await window.__sb.auth.getSession();
  if(session) await loadAndLaunch();
  else showLogin();
})();
