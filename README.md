# 부동산신탁사 재무지표 앱

금융감독원 금융통계정보시스템(FISIS) 데이터로 부동산신탁사의 **최근 12분기** 재무 지표를 보여주는 정적 웹앱(PWA)입니다.
프레임워크·빌드 도구 없이 HTML/CSS/JS만 사용합니다.

## 구조

```
trust-app/
├── index.html, manifest.webmanifest, sw.js   # 화면 / 홈화면 설치 설정 / 오프라인 캐시
├── css/, js/                                  # 스타일, 앱·SVG 차트 코드
├── data/trusts.json                           # 앱이 읽는 데이터 (지금은 가상 샘플)
├── icons/                                     # 홈화면 아이콘 (PNG + SVG)
├── scripts/
│   ├── fetch-fisis.mjs                        # FISIS API → data/trusts.json 수집
│   ├── make-sample.mjs                        # 샘플 데이터 생성
│   └── make-icons.mjs                         # 아이콘 생성
└── .github/workflows/deploy.yml               # 데이터 수집 + GitHub Pages 자동 배포
```

**데이터 흐름**: FISIS API 키는 비밀이어야 하므로 브라우저에서 직접 호출하지 않습니다.
GitHub Actions가 (키를 Secret으로 보관한 채) API를 호출해 `data/trusts.json`을 만들고, 앱은 이 JSON만 읽습니다.

## 로컬 실행

```bash
python -m http.server 8000
```

`http://localhost:8000` 접속. (`file://`로는 동작하지 않습니다.)

---

## 1단계. FISIS Open API 인증키 발급

1. <https://fisis.fss.or.kr> 접속 → 상단 **Open API** 메뉴 → 회원가입/로그인
2. **인증키 신청**에서 활용 목적을 적고 신청 → 발급된 키(문자열)를 복사해 둡니다.
3. 키는 **절대 코드나 저장소에 적지 마세요.** (아래 3단계에서 Secret으로만 등록)

내 PC에서 수집을 시험해 보려면 (Node.js 18+ 필요):

```bash
# macOS / Linux / Git Bash
FISIS_API_KEY=발급키 node scripts/fetch-fisis.mjs
```

```powershell
# Windows PowerShell
$env:FISIS_API_KEY="발급키"; node scripts/fetch-fisis.mjs
```

성공하면 `data/trusts.json`이 실제 데이터로 교체됩니다. 이 스크립트는 FISIS에서 부동산신탁 권역(`M`)의
주요경영지표 통계표를 **자동으로 탐색**해 모든 계정 항목을 수집합니다. 화면 상단 KPI 카드로 보일 지표는
`scripts/fetch-fisis.mjs`의 `FEATURED_NAMES`(영업용순자본비율, 고정이하자산비율, 유동비율, ROE 등)에서 바꿀 수 있습니다.

> 처음 실행하면 지표 이름·단위가 예상과 다를 수 있으니 결과를 한 번 확인하고 `FEATURED_NAMES`를 다듬어 주세요.

---

## 2단계. GitHub에 올리기 (처음이라면)

1. <https://github.com> 가입 → 우측 상단 **+ → New repository**
   - 이름 예: `trust-dashboard`, **Public** 선택 (무료 Pages는 Public 저장소 기준) → Create
2. 이 `trust-app` 폴더 **안의 내용**이 저장소 최상위가 되도록 올립니다.

```bash
cd trust-app
git init -b main
git add .
git commit -m "부동산신탁사 재무지표 앱 초기 버전"
git remote add origin https://github.com/<내아이디>/trust-dashboard.git
git push -u origin main
```

(`<내아이디>`는 본인 GitHub 아이디. 푸시할 때 로그인 창이 뜨면 로그인합니다.)

## 3단계. GitHub Pages 설정 + 키 등록

1. 저장소 → **Settings → Pages** → **Build and deployment → Source**를 **GitHub Actions**로 선택
2. 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `FISIS_API_KEY` / Secret: 1단계에서 받은 키 → Add secret
3. 저장소 → **Actions** 탭 → "데이터 갱신 및 GitHub Pages 배포" → **Run workflow**
4. 초록색 체크가 뜨면 `https://<내아이디>.github.io/trust-dashboard/` 에서 확인합니다.

이후에는 `main`에 푸시할 때, 그리고 **매일 06시(KST)** 마다 자동으로 데이터를 다시 수집해 배포합니다.
(Secret을 등록하지 않으면 저장소에 들어 있는 데이터(`data/trusts.json`)로 배포됩니다.)

### 새 데이터 반영 방식 ("실시간"에 대해)

FISIS 인증키는 비밀이라 방문자의 브라우저에서 FISIS를 직접 호출할 수 없습니다. 그래서 두 단계로 반영합니다.

1. **서버 쪽**: GitHub Actions가 매일 FISIS를 조회해 새 데이터가 있으면 함께 재배포합니다. 수집이 실패하면 배포가 중단되어 기존 사이트가 그대로 유지됩니다.
   금감원 통계는 분기 단위로 공시되므로 하루 단위 확인이면 사실상 공시 당일~다음 날 반영됩니다. 급하면 Actions 탭에서 **Run workflow**로 즉시 실행하세요.
2. **앱 쪽**: 이미 열어 둔 화면도 탭에 다시 돌아오거나 30분마다 새 데이터를 확인하고, 바뀌었으면 새로고침 없이 갱신한 뒤 "새 분기 데이터가 반영되었습니다" 알림을 띄웁니다. 최신 분기를 보던 중이면 새 최신 분기로 자동 이동합니다.

> ⚠ GitHub은 **60일 동안 저장소 활동이 없으면** 예약 실행(schedule)을 자동으로 멈춥니다(공개 저장소). 멈췄다면 Actions 탭에서 워크플로를 다시 활성화(Enable workflow)하세요.

## 4단계. 폰 홈화면에 설치

| 기기 | 방법 |
|------|------|
| iPhone (Safari) | 주소 접속 → 공유 버튼 → **홈 화면에 추가** |
| Android (Chrome) | 주소 접속 → 메뉴(⋮) → **홈 화면에 추가** / **앱 설치** |

아이콘은 `icons/`의 이미지가 사용됩니다. 디자인을 바꾸려면 `scripts/make-icons.mjs`를 수정한 뒤
`node scripts/make-icons.mjs`로 다시 생성하세요. 이름 "신탁지표"는 `manifest.webmanifest`에서 바꿉니다.

> 앱을 업데이트했는데 폰에서 옛 화면이 보이면 `sw.js`의 `VERSION` 값을 올려서 다시 배포하세요.

---

## 대안: Google Apps Script 웹앱

구글 계정으로 접근을 제한하고 싶다면 같은 앱을 Apps Script로도 배포할 수 있습니다. 홈화면 설치(PWA)와 주소 공유는 안 되는 제약이 있습니다. 자세한 방법은 [gas/README.md](gas/README.md)를 보세요.

## 대안: Cloudflare Pages

GitHub Pages로 충분하지만 Cloudflare Pages를 쓰려면:

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git** → 저장소 선택
2. Build command: 비워 두기 / Output directory: `/` (루트)
3. 데이터 수집은 GitHub Actions로 해야 하므로, 위 `deploy.yml`을 "수집 후 `data/trusts.json`을 저장소에 커밋"하는 방식으로 바꿔야 합니다.
   (Cloudflare는 커밋이 생기면 자동 배포) — 필요하면 이 변경을 요청해 주세요.

처음이라면 **GitHub Pages(위 흐름)를 권장**합니다. 설정이 한 곳에서 끝납니다.

## 주의

- `data/trusts.json`이 `source: "sample"`이면 화면에 노란 경고가 뜹니다. 실제 수집이 성공하면 사라집니다.
- FISIS API는 일일 호출 한도가 있습니다. 하루 1회 수집(호출 약 150회: 신탁사 17곳 × 통계표 9개)은 한도에 충분히 여유가 있다고 보지만, 한도 수치는 FISIS 안내에서 확인하세요.
- 수치의 출처는 금융감독원 FISIS이며, 투자 판단의 근거로 사용하지 마세요.

