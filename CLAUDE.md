# Podowa Map (포도와지도) — 작업 규칙

이 파일은 **Claude가 이 레포에서 작업할 때 매번 먼저 읽는 가이드**다.
사람도 읽기 쉽게 적었다.

---

## 0. 가장 중요한 것

**이 앱은 minari(농장주)가 매일 의존하는 운영 도구다.** 망가지면 농장 일이 멈춘다.

- 작동하는 코드를 절대 "더 좋게" 만들겠다고 갈아엎지 마라.
- 큰 변경 전에는 항상 minari에게 한 번 더 확인.
- 의심스러울 때는 **작은 변경 + 새 브랜치 + 직접 본인이 테스트**.

---

## 1. 코드 구조 (소영이가 만든 베이스 — 존중할 것)

```
src/
├── App.jsx              ── 메인 화면 (530줄). 가급적 손대지 말 것
├── main.jsx             ── 앱 진입점. 건드릴 일 없음
├── supabaseClient.js    ── Supabase 연결. 키 변경 외 수정 X
│
├── FarmMap.jsx          ── 나무 지도
├── GrassMap.jsx         ── 잔디 지도
├── TreeModal.jsx        ── ⚠️ 1051줄. 작은 수정만. 큰 변경은 친구와
├── GrassModal.jsx       ── ⚠️ 1327줄. 작은 수정만. 큰 변경은 친구와
├── RenamePopup.jsx      ── 라벨 이름 변경 팝업
│
├── *Context.jsx         ── 전역 상태 관리. 새 Context 만들기 전에 의논
│
├── components/          ── 작은 부품 (버튼, 카드, 작은 팝업)
├── hooks/               ── 재사용 React hook (use로 시작)
├── utils/               ── 순수 계산 함수 (DOM/React 안 씀)
└── assets/              ── 이미지, 아이콘

supabase/
└── schema.sql           ── DB 구조 정의. DB 변경 시 반드시 함께 업데이트
```

---

## 2. 새 기능 추가 규칙

### ✅ DO
- **새 기능 = 새 파일.** `src/components/NewFeature.jsx` 같은 패턴.
- 작은 화면 부품(버튼/카드/작은 팝업) → `src/components/`
- 여러 곳에서 쓰는 hook(`useXxx`) → `src/hooks/`
- 순수 계산(통계, 날짜 변환) → `src/utils/`
- 큰 화면 단위 → `src/` 루트 (단, 신중히)
- import 경로는 상대경로 (`../supabaseClient`)
- 함수형 컴포넌트 + hooks (친구 스타일)
- `export default function ComponentName(...)`

### ❌ DON'T
- **TreeModal, GrassModal, HistoryPopup에 새 기능 추가 금지.** 이미 너무 크다.
  - 새 기능이 필요하면 새 컴포넌트로 만들어서 거기서 import해 쓰기.
- 작동하는 코드 "정리/리팩토링" 금지 (minari가 명시적으로 요청한 경우 외).
- 새 라이브러리(npm install) 추가 전에 minari에게 물어보기.
- 옛 코드 삭제 전에 한 번 더 묻기 (예: deprecated `grass_labels`).

---

## 3. 스타일링

- **Tailwind CSS v4 우선** (대부분의 컴포넌트가 `className=` 사용).
- 별도 CSS 파일은 친구가 만든 것(`Login.css` 등)만 유지. 새 CSS 파일 만들지 말 것.
- 색상/사이즈는 Tailwind 클래스로 (커스텀 CSS 변수 새로 만들지 말 것).

### ⚠️ 글자 크기 절대 보존 (minari 명시 요구)
- 기존 `fontSize: '...'`, `text-sm/base/lg/xl`, 인라인 `font-size: ...` **그대로 유지**.
- 디자인 수정 시에도 글자 크기 관련 속성은 **건드리지 않는다**.
- 새 요소 추가 시 글자 크기는 부모로부터 상속받게 두고, 명시적 크기 지정 금지 (예외: 본인이 직접 "이 부분은 크게/작게" 요청한 경우).
- 색/여백/배경/모서리/그림자/hover 효과 등은 자유롭게 변경 가능.

---

## 4. Supabase / 데이터

### 테이블 (8개, schema.sql 참조)
- `trees` — 나무 일별 작업 기록
- `tree_labels` — 나무 이름표 (Realtime 구독)
- `grass_records` — 잔디 일별 기록
- `grass_types` — 잔디 종류
- `daily_summaries` — 일별 통계 (date가 text 타입인 알려진 quirk)
- `daily_notes` — 일별 메모
- `announcements` — 공지사항 (Realtime 구독)
- `grass_labels` — ⚠️ DEPRECATED. 코드에 fetch는 남아있지만 사용 X. 새 코드에서 참조하지 말 것.

### 데이터 관련 절대 규칙
- **Supabase 데이터를 직접 DELETE/UPDATE하는 코드 추가 전에 minari 확인.**
- soft-delete 패턴 존중: `trees.archived_at`, `announcements.deleted` — 진짜 DELETE 대신 이 컬럼 업데이트.
- 스키마 변경(테이블/컬럼 추가)이 필요하면:
  1. minari에게 먼저 알린다
  2. `supabase/schema.sql`에 추가/수정
  3. minari가 Supabase Dashboard에서 SQL 실행하도록 안내

### 보안
- `src/supabaseClient.js`의 URL/anon key는 공개돼도 안전 (RLS로 보호됨).
- **service_role key는 절대 코드에 넣지 말 것.**
- 앱 내 비번 `1234`(수정), `6687`(삭제)는 클라이언트 사이드 가벼운 게이트일 뿐. 진짜 보안 아님 — 진짜 권한은 Supabase RLS가 담당.

---

## 5. 깃 / 협업 워크플로

### ⚠️ 핵심 워크플로 (minari 명시 요구)

**Claude는 코드 편집만. add/commit/push는 minari가 OK한 후에만.**

```
1. minari가 "X 바꿔줘"
2. Claude가 코드 편집 (commit/push 안 함)
3. Vite dev 서버가 localhost:5173 자동 반영
4. minari가 로컬에서 확인
5. OK → "푸쉬해" → 그때 Claude가 add/commit/push
   NG → "이거 바꿔" → 2번부터 반복
```

**이유**: 매 iteration push하면 Vercel 무료 일일 한도(100/day) 빠르게 소진됨. 로컬에서 10번 다듬어도 push는 1번이면 됨.

**예외**: minari가 명시적으로 "푸쉬도 같이 해줘" 한 경우만 add/commit/push 자동.

### 그 외 규칙

- **main 브랜치에 직접 푸쉬 금지.** 항상 새 브랜치에서 작업.
- 브랜치 이름: `minari-기능명` 또는 `soyoung-기능명` (누가 작업했는지 명확히)
- 작업 시작 전: `git pull origin main` 먼저
- 작업 단위: 작게. **기능 하나 = PR 하나.** 여러 변경을 한 PR에 묶지 말 것.
- 커밋 메시지는 한국어 OK. 친구 스타일 따라하기:
  ```
  feat: 잔디 모달에 사진 미리보기 추가
  fix: 로그인 후 빈 화면 뜨는 버그
  ```

---

## 6. 배포

- **Vercel**로 배포 (GitHub Pages 아님).
- `vite.config.js`의 `base`는 `/`로 유지 (`/farmt/` 아님 — GH Pages용 옛 설정).
- `.github/workflows/deploy.yml` (GH Pages용)은 사용 X. 삭제 또는 비활성화 권장.
- main에 push되면 Vercel이 자동 빌드/배포.

---

## 7. Claude에게 — 작업 전 체크리스트

작업 시작 전 매번 자신에게 묻기:

1. **이게 새 기능인가, 기존 수정인가?**
   - 새 기능 → 새 파일로
   - 기존 수정 → 가능한 한 작게
2. **큰 파일(>500줄) 건드리는가?**
   - YES → minari에게 한 번 더 확인 요청
3. **DB 스키마가 바뀌는가?**
   - YES → `supabase/schema.sql` 업데이트 + minari에게 SQL 실행 안내
4. **작동하는 기능을 부술 위험이 있는가?**
   - YES → 브랜치 + 작은 단계 + 테스트
5. **이 변경이 옛 코드와 일관되는가?**
   - 네이밍/패턴/들여쓰기 등 친구 스타일 따라가기

---

## 8. 한 줄 요약

> **친구 코드 구조를 보존하면서, 새 기능은 새 파일에, 큰 파일은 안 건드리고, 모든 변경은 작은 브랜치 단위로.**

---

## 9. 미래 작업 메모 (minari 의도 보존)

### 월별 메뉴얼 — 대량 입력 페이지 (TODO)
현재(2026-05): `MonthlyManualLine` + `MonthlyManualEditModal`로 카테고리별 칸별 ✏️ 편집.

**미래**: 별도 "메뉴얼 관리" 페이지를 만들어서 12개월 × 3카테고리(관수/방제/환경)를 한 번에 채우는 UI 제공.
- 한 번에 시즌 시작 시 1년치 메뉴얼 미리 입력
- 위젯(`MonthlyManualLine`)은 그대로 그 데이터를 자동 표시
- DB 구조(`monthly_manuals` 테이블)는 이미 이 패턴 지원 — UI만 추가하면 됨

→ 작업 시 기존 한칸한칸 ✏️ 편집 기능은 유지 (소소한 수정 용도).

---

## 10. 데이터 아키텍처 원칙 (⭐ 가장 중요)

> **모든 응용 값은 `trees`에서 계산해서 뽑는다. 저장하지 않는다.**

이 원칙을 어기면 코드가 덕지덕지 되고, DB가 부정합 상태가 되고, minari가 매일 쓰는 도구가 깨진다.

### 3층 구조

```
┌─────────────────────────────────────────────┐
│ LAYER 1: DB (진실, 쓰기 전용)               │
│  ├─ trees           — 일별 raw 기록         │
│  ├─ tree_labels     — 이름/색/disabled      │
│  ├─ grass_records, announcements ...        │
└─────────────────────────────────────────────┘
                  ↓ fetch
┌─────────────────────────────────────────────┐
│ LAYER 2: 순수 계산 함수 (src/lib/, utils/)  │
│  ├─ getBloomDateFromHistory(history)        │
│  ├─ getCurrentStageFromBloom(bloom, today)  │
│  ├─ getBloomRatio(treeHistory)              │
│  └─ ... (모든 "응용된" 값들)                │
│                                              │
│ 규칙:                                        │
│  • DOM/React 안 씀, 순수 JS만                │
│  • 입력 동일하면 출력 동일 (side effect X)  │
│  • 테스트 쉽게                              │
└─────────────────────────────────────────────┘
                  ↓ 값만 받아서
┌─────────────────────────────────────────────┐
│ LAYER 3: UI 컴포넌트 (보여주기만)           │
│  ├─ <BloomBadge tree={...} />               │
│  ├─ <StageChip tree={...} />                │
│  └─ ... (얇은 표시 부품)                    │
│                                              │
│ 규칙:                                        │
│  • 계산 로직 인라인 금지 — lib 함수만 호출  │
│  • 작게 (한 컴포넌트 = 한 가지 표시)        │
└─────────────────────────────────────────────┘
```

### ✅ 새 기능 추가 표준 절차

예: "함부르크 만개율 뱃지" 같은 요청 들어오면:

1. `src/lib/<도메인>-metrics.js`에 순수 함수 추가
   ```js
   export function getBloomRatio(treeHistory) { ... return number; }
   ```
2. `src/components/<이름>Badge.jsx` 얇은 컴포넌트
   ```jsx
   const ratio = getBloomRatio(tree.history);
   return <span>{ratio}%</span>;
   ```
3. 원하는 곳(TreeModal, FarmMap 등)에서 import해서 사용

**→ DB 변경 0번. 새 테이블 0개. 기존 코드 1줄도 안 건드림.**

### ❌ 절대 금지

1. **DB에 계산값 컬럼 새로 만들지 마라**
   - 안티-예시: `trees`에 `bloom_ratio` 컬럼 추가 ❌
   - 이유: trees 바뀔 때마다 동기화 필요 → 부정합 위험
2. **컴포넌트 안에 비즈니스 계산 로직 박지 마라**
   - 안티-예시: TreeModal 안에 만개일 계산 코드 인라인 ❌
   - 이유: 1500줄 비대화 + 재사용 불가
3. **새 테이블 만들기 전에 자문**
   - "이거 trees + lib 함수로 가능한가?" → YES면 새 테이블 만들지 마라

### 📌 알려진 위반 (역사적, 그대로 둠)

- `daily_summaries` — trees에서 계산 가능한데 저장돼있음 (캐시 용도). 새로 비슷한 거 만들지 마라.

### 🎯 한 줄 요약

> **trees + lib + 작은 컴포넌트.** 그 외 다른 구조 만들기 전에 한 번 더 생각.

---

## 11. 효율 유지 자동 체크리스트 (스파게티 방지)

매 새 기능 시작 전 Claude가 **자동으로 통과해야 할 게이트**.

### 🚦 작업 시작 전 4가지 자문 (Claude 내부 체크)

```
[ ] 1. 새 컬럼/테이블 만들기 전 → "이거 trees(또는 기존 테이블)에서 계산 가능?" 자문
       → YES → 새 컬럼 X, src/lib/ 함수로 처리
       → NO → 새 컬럼/테이블 OK (단, minari에 알림 + schema.sql 동기화)

[ ] 2. 새 컴포넌트 vs 기존 수정 → "이게 기존 컴포넌트랑 다른 역할인가?"
       → YES → 새 파일 (src/components/X.jsx)
       → NO → 기존 파일 작은 수정

[ ] 3. 큰 파일(>500줄) 건드리려 함 → STOP, minari에 한 번 더 확인
       (TreeModal 1500+, GrassModal 1300+ — 절대 자동으로 X)

[ ] 4. 같은 코드 3번째 복붙하려 함 → STOP, src/utils/ 또는 src/lib/로 추출
       (createThumbnail 같은 거)
```

### 📏 파일 크기 가이드라인

| 종류 | 권장 | 경고 | 강제 분리 |
|---|---|---|---|
| `src/components/` (UI 컴포넌트) | <300줄 | 500줄 | **700줄** |
| `src/lib/` (순수 함수) | <80줄 | 150줄 | 200줄 (도메인 분리) |
| `src/utils/` (유틸) | <50줄 | 100줄 | 150줄 |
| `src/App.jsx` (오케스트레이터) | 새 기능 추가 시 ~10줄만 (import + state + JSX) |

→ 경고선 도달 시 **Claude가 minari에 먼저 "분리 권장" 알림 보낼 것**.

### 🎨 명명 규칙 (소영이 패턴)

| 종류 | 패턴 | 예시 |
|---|---|---|
| 입력 모달 | `XxxInputModal.jsx` | `JournalInputModal`, `IrrigationInputModal` |
| 일반 모달 | `XxxModal.jsx` | `TreeModal`, `GrassModal` |
| 작은 팝업 | `XxxPopup.jsx` | `RenamePopup`, `AnnouncementPopup` |
| 헤더 아이콘 | `XxxIcons.jsx` 또는 `XxxIcon.jsx` | `TreatmentIcons` |
| 도메인 lib | `lib/<도메인>.js` | `weather.js`, `journal.js` |
| 계산 lib | `lib/<도메인>-metrics.js` | `bloom-metrics.js` (예시) |
| 작은 유틸 | `utils/<기능>.js` | `imageThumbnail.js`, `dailyStats.js` |
| Context | `XxxContext.jsx` | `LabelContext`, `SignalLightsContext` |
| Hook | `hooks/useXxx.js` | (앞으로 만들 거) |

### 🚫 빨간 깃발 (자동 STOP)

작업 중 다음 상황 발생 시 코드 멈추고 minari에 묻기:

1. **`npm install` 하려 함** → STOP, 무조건 minari 승인 필요
2. **TreeModal/GrassModal/HistoryPopup 편집하려 함** → STOP, 새 컴포넌트로 우회 가능한지 먼저 검토
3. **DB DELETE 쿼리 추가하려 함** → STOP, soft-delete 패턴(archived_at, deleted) 가능한지 확인
4. **새 Supabase 테이블 만들려 함** → STOP, 기존 테이블 ALTER로 가능한지 우선 검토
5. **service_role key 사용하려 함** → 절대 안 됨
6. **localStorage에 민감 정보 저장하려 함** → STOP, 다른 방식 검토

### ✅ 재사용 우선 (만들기 전 검색)

새 기능 만들 때 항상 **기존에 비슷한 거 있는지 먼저 검색**:

```bash
# 예: 영농일지 추가 전에 자동 점검
grep -r "daily_notes" src/   # 기존 사용 패턴 파악
grep -r "createThumbnail" src/  # 썸네일 함수 이미 있는지
ls src/lib/ src/utils/ src/components/  # 기존 파일 목록
```

기존 코드를 못 보고 새로 만들면 = 중복 = 스파게티의 시작.

### 📦 데이터 저장 우선순위

새 정보 저장할 때 이 순서로 시도:

```
1순위: 기존 테이블에 컬럼 추가 (ALTER ADD COLUMN)
       예: daily_notes에 image_urls, thumbnails, weather 추가
2순위: 기존 테이블의 jsonb 컬럼 안에 키 추가
       예: trees.season_data 안에 새 옵션
3순위: 새 테이블 (정말 raw data 새 차원일 때만)
       예: irrigations, pest_treatments
4순위: 절대 만들지 말 것: 계산 가능한 값을 위한 컬럼/테이블
       예: bloom_ratio 컬럼 ❌ (계산해서 표시)
```

### 🔍 코드 리뷰 셀프 체크 (커밋 전)

- [ ] 같은 함수 다른 파일에 있나? (중복 추출)
- [ ] 컴포넌트가 너무 큰가? (700줄 넘으면 분리)
- [ ] lib 함수 React/DOM 안 쓰나? (순수 유지)
- [ ] CLAUDE.md 섹션 10 원칙 지켰나? (DB → lib → 컴포넌트)
- [ ] 새 파일 이름이 컨벤션 따르나? (위 표 참조)
- [ ] minari 입장에서 디버깅 가능한가? (에러 메시지 user-friendly)

### 🎯 한 줄 요약

> **새 기능 = 새 파일 / 기존 활용 / 작게 / 순수 함수.** 의심나면 minari에 한 번 더 묻기.
