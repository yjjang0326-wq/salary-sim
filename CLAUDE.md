# 연봉협상 시뮬레이터 — Claude Code 작업 안내

인사총무 담당자가 3개 법인(민컴·넥스트·아마겟돈, 약 25명)의 연봉협상을 준비하고 보고하는 단일 페이지 도구입니다.
빌드 도구·서버 없이 `index.html`을 브라우저로 바로 열어 씁니다. 외부 라이브러리 없음(순수 HTML/CSS/JS).

## 파일 구조
```
index.html        화면 마크업(탭·카드·표 틀)
css/style.css     스타일 (색 토큰은 :root, 다크모드 포함)
js/app.js         모든 로직 (아래 섹션 순서)
data/seed.js      초기 데이터 window.SEED = { ver, emps, left, hist }
```
`index.html`이 `data/seed.js` → `js/app.js` 순서로 불러옵니다. `file://`로 열려야 하므로 fetch/모듈(import) 대신 일반 `<script>`를 씁니다.

## 데이터 흐름
- **초기값**: `data/seed.js` (`SEED.emps` 재직자, `SEED.left` 퇴사자, `SEED.hist` 인상 이력, `SEED.ver` 데이터 버전)
- **작업 상태**: 전역 `S` 객체. 모든 입력값은 `persist()`로 `localStorage['salarySim.v1']`에 저장
- `SEED.ver`가 바뀌면 저장된 등급·인상률·예정일·메모는 살리고 명단만 seed 기준으로 다시 맞춤 (`app.js`의 `S.dataVer!==RAW.ver` 블록)
- 이제 시트 연동 없이 **프로그램 안에서 직접 입력**하는 것이 기본. seed는 「처음 상태로 되돌리기」 기준값
- 「시나리오 저장/불러오기」로 `S` 전체를 JSON 파일로 백업·복원

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
- `data/seed.js`에는 실명·연봉이 들어 있으니 외부 공개 저장소에 올리지 말 것
