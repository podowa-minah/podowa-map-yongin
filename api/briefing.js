// api/briefing.js — 아침 브리핑 AI 글 생성 (Vercel 서버 함수)
//
// 왜 서버 함수인가:
//   Anthropic 키는 노출되면 요금 폭탄이라 절대 브라우저(클라이언트)에 두면 안 된다.
//   이 함수는 Vercel 서버에서만 돌고, 키는 process.env.ANTHROPIC_API_KEY 로만 읽는다.
//   브라우저 → 이 함수 호출 → 함수가 클로드 부르고 글만 돌려줌. 키는 안 나간다.
//
// 역할 분담 (CLAUDE.md 의도):
//   숫자(세력·균형·해충 점수) = 규칙엔진(lib/diagnosis)이 계산해서 여기로 넘겨줌.
//   글(경각심·체크·정보 종합) = 농부의 자유 메모를 클로드가 읽고 써준다.
//
// 응답: { alert: string, env: string, growth: string, pest: string }
//   alert = 히어로 한마디 / env·growth·pest = 환경·생육·병해충 범주 진단 (영농일지에 날짜별 기록)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST만 가능해요' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY 가 설정되지 않았어요 (Vercel 환경변수 확인)' });
    return;
  }

  try {
    const {
      date = '',
      stage = '',
      weather = '',
      diagnosis = {},          // { vigor, balance, pest } 1~5
      trend = null,            // { days, power:{dir,delta}, balance:{...}, bugs:{...} } 최근 추세
      varieties = [],          // [{ name, score }] 점수 낮은 품종들
      watchCount = 0,          // 유심히 볼 나무 수
      watchTrees = [],         // [{ id, name, reasons[] }] 유심히 볼 나무(좌표 포함)
      yesterdayNote = '',      // 어제 영농일지 한줄 (사람)
      farmerNotes = [],        // 농부가 쓴 나무 진단 메모들 (좌표 포함)
      recentHistory = [],      // 최근 7일 일지 요약(과거 흐름) — Tier1 기억
    } = req.body || {};

    // 추세 한 줄 (최근 N일 vs 직전 N일) — AI가 악화 중인 항목을 우선시하도록
    const arrow = (d) => (d > 0 ? '↗ 오름' : d < 0 ? '↘ 내림' : '→ 유지');
    const trendLine = trend
      ? `최근 ${trend.days || 7}일 추세 — 세력 ${arrow(trend.power?.dir)}, 균형 ${arrow(trend.balance?.dir)}, 해충 ${arrow(trend.bugs?.dir)} (해충은 ↘이 좋음)`
      : '';

    // 클로드에게 줄 "사실" 묶음 (숫자는 이미 계산된 것 + 사람이 쓴 메모)
    const watchLine = (watchTrees || [])
      .map((w) => `${w.id}${w.name ? ' ' + w.name : ''}(${(w.reasons || []).join('·')})`)
      .join(', ');
    const facts = [
      date && `날짜: ${date}`,
      stage && `생육시기: ${stage}`,
      weather && `날씨: ${weather}`,
      `밭 전체 — 세력 ${diagnosis.vigor ?? '?'}/5, 균형 ${diagnosis.balance ?? '?'}/5, 해충 ${diagnosis.pest ?? '?'}/5 (해충은 낮을수록 좋음)`,
      trendLine,
      watchLine ? `유심히 볼 나무(좌표): ${watchLine}` : `유심히 볼 나무: ${watchCount}그루`,
      varieties.length && `점수 낮은 품종: ${varieties.map((v) => `${v.name} ${v.score}`).join(', ')}`,
      yesterdayNote && `어제 일지(사람이 씀): "${yesterdayNote}"`,
      farmerNotes.length && `농부 진단 메모(좌표 포함, 사람이 씀): ${farmerNotes.map((n) => `"${n}"`).join(' / ')}`,
      recentHistory.length && `최근 며칠 흐름(과거→오늘):\n${recentHistory.join('\n')}`,
    ].filter(Boolean).join('\n');

    // AI가 좌표를 지어내지 못하게 — 허용 좌표 집합
    const validCoords = (watchTrees || []).map((w) => String(w.id)).filter(Boolean);

    const system = `너는 포도밭 "포도와" 농장의 아침 브리핑을 써주는 보조야.
세력·균형·해충 점수는 이미 규칙엔진이 계산했어. 너의 일은 농부가 직접 쓴 자유 메모(어제 일지, 나무 진단)를 읽고 종합해서, 농부가 아침에 밭을 둘러보기 전에 도움이 될 브리핑을 쓰는 거야.

중요 — 두 종류를 분리한다:
- env/growth/pest = **영농일지에 남는 "기록"**. 사실·상태만 서술형으로. "~해주세요/~하세요/~잡으세요" 같은 요청·지시·할 일은 절대 여기 쓰지 마라.
- alert/tasks = **"오늘 할 일(요청)"**. 행동·요청은 여기에만.

너는 세 가지를 만든다:
1. alert: 오늘 가장 신경 쓸 핵심 한마디(요청 OK, 1~2문장). 정말 없으면 "오늘은 특별히 급한 건 없어요" 식으로.
2. 오늘 상태를 아래 3개 범주로 기록한다(영농일지에 날짜별로 쌓임). **사실 서술만**(예: "5-9 함부르크에서 유충·개미 발견됨", "밭 세력 3.8로 안정적", "해충 0.3으로 양호"). 요청·지시 금지.
   - env (환경): 날씨·습도·관수·토양 상태.
   - growth (생육): 세력·균형·생육시기 상태.
   - pest (병해충): 해충 발생·방제 상태.
3. tasks: 오늘 꼭 해야 할 일을 우선순위로 최대 5개(시급/중요한 것부터). 각 항목:
   - 특정 나무 일이면: scope="tree", coord=그 나무 좌표, category="", action=한 줄 작업.
     coord는 반드시 위 "유심히 볼 나무(좌표)"나 메모에 나온 좌표 중에서만 써라. 절대 좌표를 지어내지 마라.
   - 밭 전체 일이면: scope="field", coord="", category=환경|생육|병해충 중 하나, action=한 줄 작업.
   - 관수·방제 주기 알림은 넣지 마라(앱이 버튼 불로 따로 표시함). 없으면 빈 배열([]).

규칙:
- 한국어로, 농부에게 말하듯 간결하고 따뜻하게. 각 범주·작업은 1~2문장.
- 해당 범주에 특별히 적을 게 없으면 그 범주는 빈 문자열("")로 둬. 억지로 채우지 마.
- **최근 며칠 흐름**이 있으면 이어서 판단해라(예: "어제 1-5 방제했는데 오늘도 보이면 재방제", "3일째 해충 오름세"). 단, 흐름도 데이터에 있는 것만.
- 데이터(숫자·추이·사람 메모·최근 흐름)에 없는 사실을 지어내지 마. 과장 금지.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        system,
        messages: [
          { role: 'user', content: `오늘 데이터:\n${facts}\n\n위를 보고 아침 브리핑을 써줘.` },
        ],
        output_config: {
          format: {
            type: 'json_schema',
            schema: {
              type: 'object',
              properties: {
                alert: { type: 'string' },
                env: { type: 'string' },     // 환경
                growth: { type: 'string' },  // 생육
                pest: { type: 'string' },    // 병해충
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      scope: { type: 'string' },     // "tree" | "field"
                      coord: { type: 'string' },     // 나무 좌표(tree) / "" (field)
                      category: { type: 'string' },  // 환경|생육|병해충 (field) / "" (tree)
                      action: { type: 'string' },    // 한 줄 작업
                    },
                    required: ['scope', 'coord', 'category', 'action'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['alert', 'env', 'growth', 'pest', 'tasks'],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({ error: 'AI 호출 실패', detail: detail.slice(0, 500) });
      return;
    }

    const data = await r.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    let parsed = null;
    try {
      parsed = JSON.parse(textBlock?.text || '');
    } catch {
      parsed = null;
    }

    if (!parsed || typeof parsed.alert !== 'string') {
      res.status(502).json({ error: 'AI 응답을 해석하지 못했어요', raw: (textBlock?.text || '').slice(0, 500) });
      return;
    }

    // 우선순위 할 일 — 나무 좌표는 허용 집합만 통과(지어낸 좌표 차단), 최대 5개
    const okCoords = new Set(validCoords);
    const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : [])
      .filter((t) => t && t.action && (t.scope === 'field' || (t.scope === 'tree' && okCoords.has(String(t.coord)))))
      .slice(0, 5)
      .map((t) => ({
        scope: t.scope === 'field' ? 'field' : 'tree',
        coord: String(t.coord || ''),
        category: t.category || '',
        action: t.action,
      }));

    // 토큰 사용량도 같이 (비용 확인용)
    res.status(200).json({
      alert: parsed.alert,
      env: parsed.env || '',        // 환경
      growth: parsed.growth || '',  // 생육
      pest: parsed.pest || '',      // 병해충
      tasks,                        // 우선순위 할 일(밭/나무)
      _usage: data.usage || null,
    });
  } catch (e) {
    res.status(500).json({ error: '서버 오류', detail: String(e).slice(0, 300) });
  }
}
