# 연봉협상관리 — Claude Code 작업 안내

인사총무 담당자가 3개 법인(민컴·넥스트·아마겟돈, 약 25명)의 연봉협상을 준비하고 보고하는 단일 페이지 도구입니다.
빌드 도구·서버 없이 `index.html`을 브라우저로 바로 열어 씁니다. 외부 라이브러리 없음(순수 HTML/CSS/JS).

## 파일 구조
```
index.html        화면 마크업(탭·카드·표 틀) + 로그인 모달
css/style.css     스타일 (색 토큰은 :root, 다크모드 포함)
js/boot.js        Supabase 클라이언트·로그인·데이터 로드. 끝나면 js/app.js를 동적으로 붙임
js/app.js         모든 로직 (아래 섹션 순서)
supabase.sql      Supabase 테이블·RLS 정의 (최초 1회 SQL Editor에서 실행)
supabase/functions/create-admin/index.ts   관리자 추가용 Edge Function (Supabase에 별도 배포 필요)
```
`index.html`은 Supabase JS CDN → `js/boot.js`만 정적으로 불러옵니다. `boot.js`가 로그인·데이터 로드를 끝낸 뒤 `<script src="js/app.js">`를 `document.body`에 직접 추가해서 실행합니다 — `app.js`의 최상단 코드가 동기적으로 `window.__CLOUD_STATE`를 읽으므로, 반드시 이 순서(로그인 확인 → 데이터 fetch 완료 → app.js 삽입)를 지켜야 합니다. `file://`로도 열려야 하므로 fetch/모듈(import) 대신 일반 `<script>`를 씁니다. 더는 `data/seed.js`를 쓰지 않습니다(실명·연봉이 든 로컬 파일을 아예 없앰).

## 데이터 흐름
- **원본 저장소**: Supabase 테이블 `app_state` (id=1 고정 한 줄, `data` 컬럼에 `S` 객체 전체를 JSONB로 통째 저장). RLS는 로그인한 사용자만 통과, 비로그인 접근은 정책 자체가 없어 막힘
- **로그인**: 이메일+비밀번호(`signInWithPassword`). 가입은 Supabase 쪽에서 막아두고 Authentication > Users에서 관리자가 직접 계정을 만드는 전제
- **작업 상태**: 전역 `S` 객체(기존과 동일). `persist()`가 (1) `localStorage['salarySim.v1']`에 즉시 백업 저장, (2) 600ms 디바운스 후 `app_state` 행을 `upsert` — 이 두 단계를 모두 함
- 최초 로그인 시 `app_state`에 행이 없고 이 브라우저에 예전 localStorage 데이터가 남아 있으면, 그 값으로 한 번 부트스트랩해서 그대로 Supabase에 올림(마이그레이션). 그 다음부터는 Supabase가 기준
- `RAW`(`js/app.js` 1번째 줄)는 이제 빈 스키마 기본값(`{emps:[],left:[],hist:[],ver:"초기"}`)일 뿐, 실제 데이터가 아님 — `S.dataVer!==RAW.ver` 병합 블록은 사실상 더 이상 발동하지 않음(안전하게 죽은 코드로 남겨둠)
- 「시나리오 저장/불러오기」로 `S` 전체를 JSON 파일로 백업·복원 (기존과 동일, Supabase와 무관하게 동작)
- 「설정·데이터」 탭의 "전체 데이터 초기화"는 `defaultState()`(완전히 빈 상태)로 되돌리고 다음 저장 때 Supabase에도 반영됨 — 되돌릴 수 없는 동작
- 같은 탭의 "관리자 계정"에서 로그인한 사람이 새 관리자(이메일+비밀번호)를 추가할 수 있음. `supabase.functions.invoke("create-admin", ...)` → Edge Function이 `service_role` 키로 `auth.admin.createUser()` 호출. **주의**: Supabase 대시보드의 "Verify JWT" 토글은 anon key만 보내도 통과하는 느슨한 체크라서, 함수 코드 안에서 `getUser()`로 실제 로그인 여부를 한 번 더 확인함(`supabase/functions/create-admin/index.ts` 참고) — 이 체크를 빼면 공개 저장소의 anon key를 아는 아무나 관리자를 만들 수 있게 되는 실제 보안 구멍이었음(개발 중 발견·수정)

### S 주요 키
| 키 | 내용 |
|---|---|
| `emps[]` | 재직자: co, name, dept, pos, type, hire, ann(연봉, 원), meal, exec, fund, inc(협상 포함), grade, rate(최종 인상률, null=권장값), plan(적용일), memo, decNote |
| `left[]` | 퇴사자 (left=퇴사일). 인건비 계산에서 제외, 퇴사일 이전 달은 일할 반영 |
| `hist[]` | 인상 이력: co, name, hire, date, before, after(0=예정), amt, rate, note |
| `corpInfo[]` | 법인: code(약칭), full(정식명), color |
| `set` | 계산 기준(반올림, 최저임금, 4대보험 요율, 매트릭스 기준 등) |
| `matrix` / `mids` / `guide` | 평가×연봉위치 인상률표 / 직위별 기준연봉 / 등급 분포 가이드 |
| `budget` / `rev.target` | 법인별 인상 예산 / 인건비율 목표(%) |
| `mon[co][yyyy-mm]` | 월별 {s:매출, l:인건비 실적, o:기타 인건비} (원) |
| `monCfg` | {year, close(실적 마감월), basis('full'=회사부담 포함 / 'pay'=급여만)} |
| `bulk` | 시뮬레이터(전체 일괄·법인별·개인별) 입력값 |
| `rp` | 월별 보고서 상태(선택 귀속월, 협상일, 메모) |
| `coFilter` | 상단 법인 전환 버튼 선택값 |

## app.js 섹션 (순서대로)
유틸 → 기본 상태(defaultState, defaultPlan) → 계산(calc, costOf) → 렌더 공통(renderAll) → 대시보드 → 개인별 협상표 → 시뮬레이터 → 법인별 → 월별 매출·인건비(laborM, winStats) → 평가 기준 → 데이터 편집(법인·이력) → 설정 → 개인 상세/통보서 → 내보내기/저장 → 탭/토스트 → 보고서(월별 보고, negoLimits)

## 핵심 계산 규칙
- 금액은 내부적으로 **원** 단위. 화면 표시·입력은 연간 금액 **만원**(`wm()`), 월 급여·기본급은 원(`won()`)
- 월 급여 = 연봉 ÷ 12 (원 미만 절사), 기본급 = 월 급여 − 식대
- 회사 부담 인건비 `costOf()` = 연봉 + 4대보험 사업주분 + 퇴직급여(연봉/12)
- 권장 인상률 = `matrix[등급][연봉위치]`, 연봉위치 = 연봉 ÷ 직위 기준연봉(`mids`)
- 월별 예상 인건비 `laborM()` = 그달 재직자 일할 합계 + 기타 인건비. 협상 예정자는 적용월부터 협상 후 연봉
- 최대 협상 가능 금액 `negoLimits()` = min(한 등급 위 인상률, 법인 인건비율 목표, 법인 인상 예산 잔여)
- 평균 인상률 참고값(`histAvg12`)은 퇴사자 이력 포함, 0% 미만·40% 초과 특수 건 제외

## 작업 원칙
- 화면 문구·주석은 한국어
- 렌더 함수는 상태 `S`에서 다시 그리는 방식. 값을 바꾼 뒤 `renderAll()` 호출 (내부에서 `persist()`)
- 삭제 동작은 `toast(메시지, 되돌리기함수)`로 되돌리기 제공
- 법인 색은 CSS 변수 `--c-<약칭>` (applyCorps가 주입), 표의 법인 줄은 `coRow(co)`, 배지는 `coTag(co)`
- 이 저장소는 공개해도 됨 — 실명·연봉은 Supabase에만 있고 코드에는 없음. `js/boot.js`의 Supabase anon 키는 공개돼도 안전한 키(RLS가 비로그인 접근을 막음)
- 직원 등록·수정은 `openPerson()` 상세 폼 하나로 통합(「개인별 협상표」에서 이름 클릭 또는 "직원 추가"). 법인·이름·부서·직위·입사일·**퇴사일**·연봉을 한 화면에서 입력하며, 퇴사일을 채우고 저장하면 `peSave` 핸들러가 바로 `S.left`로 옮김. 인상 이력이 없는 신규 등록자는 저장 시 `defaultPlan()`으로 예정일을 자동 계산(기존 직원은 예정일을 건드리지 않음)
