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
