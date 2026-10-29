# Google Apps Script 웹앱으로 배포하기

같은 앱을 Google Apps Script(GAS) 웹앱으로도 배포합니다. 구글 계정 로그인으로 접근을 제한하고 싶거나(회사 도메인 한정 등), 구글 환경에서 운영하고 싶을 때 쓰세요.

## 구조

```
gas/
├── Code.gs          # 서버 코드: 페이지 제공(doGet) + 데이터 조회(getData)
├── index.html       # 앱 전체(CSS+JS 인라인) — scripts/build-gas.mjs 가 생성
└── appsscript.json  # 프로젝트 설정(시간대, 권한, 웹앱 접근 범위)
```

**데이터 흐름**: GitHub Actions가 매일 FISIS를 수집해 GitHub Pages에 `data/trusts.json`을 올림 → GAS 서버(`UrlFetchApp`)가 그 파일을 읽어 30분 캐시 → 화면에 전달.
그래서 **FISIS 인증키를 GAS에 넣을 필요가 없습니다.** 대신 GitHub Pages 배포가 살아 있어야 합니다.

## 일반 사이트와 다른 점 (GAS 제약)

| 항목 | GAS 웹앱 |
|------|----------|
| 홈화면 설치(PWA)·오프라인 | **불가** (서비스워커/manifest 미지원). "홈 화면에 추가"는 되지만 일반 북마크로 동작 |
| 홈화면 아이콘 | 앱 아이콘이 아닌 브라우저 기본 아이콘 (탭 파비콘만 적용) |
| 주소로 신탁사·지표 공유 | **불가** (앱이 iframe 안에서 실행되어 `#/…` 주소가 저장되지 않음) |
| 새 데이터 자동 반영 | 가능 (화면 복귀/30분마다 서버에 재조회, 서버 캐시 30분) |
| 접속 주소 | `https://script.google.com/macros/s/…/exec` (길고 고정 도메인 사용 불가) |

폰 홈화면 아이콘과 주소 공유가 중요하면 GitHub Pages 주소를 쓰고, GAS는 접근 제어가 필요할 때만 쓰는 것을 권합니다.

---

## 방법 A. 복사·붙여넣기 (설치 불필요, 처음이라면 이쪽)

1. <https://script.google.com> → **새 프로젝트**. 프로젝트 이름을 "부동산신탁사 재무 현황"으로 변경.
2. **Code.gs**: 기본 `Code.gs` 내용을 모두 지우고 이 폴더의 [Code.gs](Code.gs) 내용을 붙여넣기.
   - 맨 위 `SITE_URL`이 본인의 GitHub Pages 주소인지 확인 (기본값: `https://hsound21.github.io/trust-dashboard`).
3. **index.html**: 왼쪽 파일 목록 `+` → **HTML** → 이름을 정확히 `index` 로 입력(확장자 제외) → [index.html](index.html) 내용 전체 붙여넣기.
4. **appsscript.json**: 왼쪽 ⚙ **프로젝트 설정** → "`appsscript.json` 매니페스트 파일 표시" 체크 → 편집기로 돌아와 `appsscript.json`에 이 폴더의 [appsscript.json](appsscript.json) 내용을 붙여넣기.
   - 외부 URL을 읽는 권한(`script.external_request`)이 이 파일에 들어 있습니다.
5. 저장(💾) 후 편집기 상단에서 함수 `getData`를 선택해 **▶ 실행** → 권한 검토 팝업에서 본인 계정 선택 → **허용**.
   (처음 한 번 승인해야 웹앱이 외부 데이터를 읽을 수 있습니다. "확인되지 않은 앱" 경고가 뜨면 고급 → 이동을 눌러 진행)
6. **배포 → 새 배포 → 유형 선택(⚙) → 웹 앱**
   - 실행 계정: **나**
   - 액세스 권한: 아래에서 선택
     | 선택 | 의미 |
     |------|------|
     | 나만 | 본인만 접속 (기본값, 테스트용) |
     | 조직 내 모든 사용자 | 같은 Google Workspace 도메인 사용자만 |
     | 모든 사용자 | 구글 계정이 있으면 누구나 |
     | 익명 사용자 포함 모든 사용자 | 로그인 없이 누구나 (공개) |
   - **배포** → 나온 **웹 앱 URL**이 접속 주소입니다.

## 방법 B. clasp (명령줄, 반복 배포할 때 편함)

```bash
npm install -g @google/clasp
clasp login                                   # 브라우저에서 구글 로그인
```

1. <https://script.google.com/home/usersettings> 에서 **Google Apps Script API** 를 켭니다.
2. 아래처럼 프로젝트를 만들고 올립니다 (`trust-app/gas` 폴더에서).

```bash
cd gas
clasp create --type webapp --title "부동산신탁사 재무 현황"   # .clasp.json 생성 (커밋 금지)
clasp push --force
clasp deploy --description "v1"
```

3. 최초 1회는 방법 A의 5번처럼 편집기에서 `getData`를 실행해 권한을 승인해야 합니다.

## 앱을 고친 뒤 GAS에 반영하려면

`js/`·`css/`를 수정했다면 단일 파일을 다시 만들어야 합니다.

```bash
node scripts/build-gas.mjs     # gas/index.html 재생성
```

- 방법 A: 재생성된 `index.html` 내용을 편집기에 다시 붙여넣고 **배포 → 배포 관리 → ✎ → 버전: 새 버전 → 배포** (주소는 유지됨)
- 방법 B: `clasp push --force` 후 `clasp deploy --deploymentId <기존 ID>`

> 주의: 배포 때 "새 배포"를 만들면 **주소가 바뀝니다.** 주소를 유지하려면 기존 배포를 편집해 새 버전으로 올리세요.

## 문제 해결

- **"데이터를 불러오지 못했습니다"**: `SITE_URL`이 맞는지, 그 주소의 `/data/trusts.json`이 브라우저에서 열리는지 확인. 편집기에서 `getData`를 실행하면 오류 원인이 로그에 나옵니다.
- **권한 오류(`UrlFetchApp`)**: `appsscript.json`에 `oauthScopes`가 있는지 확인하고 `getData`를 다시 실행해 승인.
- **예전 데이터가 계속 보임**: 서버 캐시가 30분입니다. 편집기에서 `clearCache`를 실행하면 즉시 비워집니다.
- **화면이 비어 있음**: 배포를 **새 버전**으로 올렸는지 확인 (코드를 저장만 하고 배포를 갱신하지 않으면 옛 버전이 서빙됨).
