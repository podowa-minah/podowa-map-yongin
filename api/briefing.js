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
// 응답: { alert: string, checks: string[], info: string }

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
      varieties = [],          // [{ name, score }] 점수 낮은 품종들
      watchCount = 0,          // 유심히 볼 나무 수
      yesterdayNote = '',      // 어제 영농일지 한줄 (사람)
      farmerNotes = [],        // 농부가 쓴 나무 진단 메모들 (사람)
    } = req.body || {};

    // 클로드에게 줄 "사실" 묶음 (숫자는 이미 계산된 것 + 사람이 쓴 메모)
    const facts = [
      date && `날짜: ${date}`,
      stage && `생육시기: ${stage}`,
      weather && `날씨: ${weather}`,
      `밭 전체 — 세력 ${diagnosis.vigor ?? '?'}/5, 균형 ${diagnosis.balance ?? '?'}/5, 해충 ${diagnosis.pest ?? '?'}/5 (해충은 낮을수록 좋음)`,
      `유심히 볼 나무: ${watchCount}그루`,
      varieties.length && `점수 낮은 품종: ${varieties.map((v) => `${v.name} ${v.score}`).join(', ')}`,
      yesterdayNote && `어제 일지(사람이 씀): "${yesterdayNote}"`,
      farmerNotes.length && `농부 진단 메모(사람이 씀): ${farmerNotes.map((n) => `"${n}"`).join(' / ')}`,
    ].filter(Boolean).join('\n');

    const system = `너는 포도밭 "포도와" 농장의 아침 브리핑을 써주는 보조야.
세력·균형·해충 점수는 이미 규칙엔진이 계산했어. 너의 일은 농부가 직접 쓴 자유 메모(어제 일지, 나무 진단)를 읽고 종합해서, 농부가 아침에 밭을 둘러보기 전에 도움이 될 브리핑을 쓰는 거야.

규칙:
- 한국어로, 농부에게 말하듯 간결하고 따뜻하게. 군더더기 빼고.
- alert(경각심): 메모와 숫자에서 오늘 가장 신경 쓸 것 1~2문장. 정말 없으면 "오늘은 특별히 급한 건 없어요" 식으로.
- checks(오늘 체크): 오늘 둘러보며 확인할 구체적 항목 2~4개, 각 한 줄.
- info(정보): 생육시기·절기 관련 알아두면 좋은 한 줄.
- 데이터에 없는 사실을 지어내지 마. 과장 금지.`;

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
                checks: { type: 'array', items: { type: 'string' } },
                info: { type: 'string' },
              },
              required: ['alert', 'checks', 'info'],
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

    // 토큰 사용량도 같이 (비용 확인용)
    res.status(200).json({
      alert: parsed.alert,
      checks: Array.isArray(parsed.checks) ? parsed.checks : [],
      info: parsed.info || '',
      _usage: data.usage || null,
    });
  } catch (e) {
    res.status(500).json({ error: '서버 오류', detail: String(e).slice(0, 300) });
  }
}
