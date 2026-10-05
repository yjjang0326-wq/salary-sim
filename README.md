# 연봉협상관리

코드(이 저장소)는 공개해도 되지만, 실제 직원 실명·연봉은 전부 **Supabase**에 저장되고 로그인해야만 보입니다.
`index.html` 자체에는 개인정보가 들어있지 않습니다.

## 처음 설정하기 (한 번만)

1. [supabase.com](https://supabase.com)에서 새 프로젝트 생성 (리전은 Seoul 권장)
2. 프로젝트의 **SQL Editor**에서 [supabase.sql](supabase.sql) 내용을 그대로 실행
3. **Authentication > Sign In / Providers > Email**에서 "Allow new users to sign up"을 끔 (가입은 막고, 관리자가 직접 계정을 만듦)
4. **Authentication > Users**에서 본인 계정을 이메일+비밀번호로 직접 추가(Create new user, Auto confirm user 체크). 이후 다른 관리자는 앱 안의 「설정·데이터 > 관리자 계정」에서 추가하면 됨(아래 참고)
5. **Settings > API**에서 `Project URL`과 Publishable key(새 키 체계의 anon key)를 복사
6. [js/boot.js](js/boot.js) 맨 위의 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 자리표시자를 실제 값으로 바꿈 (공개돼도 되는 키입니다 — RLS가 로그인 안 한 접근을 막아줍니다)
7. **Edge Functions**에서 [supabase/functions/create-admin/index.ts](supabase/functions/create-admin/index.ts) 내용으로 `create-admin` 함수를 만들어 배포 (관리자 추가 기능에 필요. service_role 키는 Supabase가 함수에 자동으로 넣어주므로 따로 설정할 값 없음)

이후로는 `index.html`을 열면 로그인 화면이 뜨고, 로그인하면 Supabase에 저장된 데이터가 불러와집니다.

## 관리자(로그인 가능한 사람) 추가

처음 1명 이후로는 Supabase 대시보드에 갈 필요 없이, 로그인한 상태에서 「설정·데이터」 탭 맨 위 **관리자 계정**에서 이메일·비밀번호를 정해 추가하면 됩니다. 추가한 뒤 그 비밀번호는 문자·메신저 등으로 본인에게 따로 알려주세요(이 화면이 비밀번호를 대신 전달해주지는 않습니다).

이 기능은 `create-admin` Edge Function이 처리합니다. 로그인하지 않은 사람은 이 함수를 호출해도 거부됩니다(함수 코드 안에서 실제 로그인 여부를 다시 확인함 — Supabase 대시보드의 "Verify JWT" 설정만으로는 anon key만으로도 통과되어 버려서, 그것만 믿으면 공개 저장소의 anon key로 아무나 관리자를 만들 수 있게 됨).

## 여는 방법

- **로컬**: `index.html`을 더블클릭해서 크롬이나 엣지로 엽니다. 설치할 것은 없습니다.
- **어디서나**: 이 폴더를 GitHub Pages 등으로 올려두면 로그인만 하고 어디서든 씁니다. 코드에는 개인정보가 없으니 공개 저장소에 올려도 됩니다.

## 데이터 입력

- 직원: 「개인별 협상표」에서 수정, 「직원 추가」로 추가, 이름을 누르면 상세 정보·퇴사 처리
- 인상 이력: 「인상 이력」 탭에서 수정·추가·삭제
- 월별 매출·인건비: 「법인별 분석」 탭 (엑셀 한 줄 붙여넣기 가능)
- 법인·계산 기준: 「설정·데이터」 탭

입력값은 바뀔 때마다 자동으로 Supabase에 저장됩니다(이 브라우저에도 오프라인 대비용으로 백업됩니다).

## 주의

- CSV 내보내기(「연봉협상원본 형식 CSV」)에는 직원 실명과 연봉이 들어 있습니다. 사내에서만 보관하세요.
- `supabase.sql`의 `app_state` 테이블 한 줄에 전체 데이터가 통째로 들어갑니다. Supabase 프로젝트 자체의 접근 권한(로그인 계정)을 잘 관리하세요.

코드 구조와 계산 규칙은 `CLAUDE.md`에 정리되어 있습니다.
