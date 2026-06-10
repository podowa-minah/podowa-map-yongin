// src/components/ManualMissionEditPanel.jsx
// 이달의 포도 미션 — 관리자 수정 패널 (보여주기 전용, CLAUDE.md §10 Layer 3)
// 저장 로직은 ManualMissionModal이 담당. 여기는 입력 UI만.
// 관리 범주(물/방제/재배/환경/토양)별로 묶어서 보여주고, ▲▼ 버튼으로 같은 범주 안 순서를 바꾼다.
// draft는 flat 배열 — 화면에선 cat으로 묶어 보여주고, 저장 시 그 순서가 곧 sort_order가 된다.
// 스타일은 부모(.pmm-wrap)의 <style> 블록을 그대로 사용.

import { CATS, ORDER } from '../lib/manual';

export default function ManualMissionEditPanel({
  month,
  draft,
  draftGuide,
  saving,
  onChangeGuide,
  onChangeRow,
  onDelRow,
  onMoveRow,
  onAddRow,
  onCancel,
  onSave,
}) {
  // flat draft에 원래 index를 붙여둔다 — 핸들러는 이 index로 동작
  const indexed = draft.map((it, i) => ({ ...it, _i: i }));

  return (
    <div>
      {/* 이번 달 안내 한마디 */}
      <div className="erow" style={{ borderTop: '4px solid #f0c95a', margin: '0 16px 8px' }}>
        <div className="ef">
          <div style={{ fontSize: 12, fontWeight: 800, color: '#8a6d2a' }}>💬 {month}월 안내 한마디</div>
          <input
            className="title"
            value={draftGuide}
            placeholder="예: 했어요 체크에 최선을 다해주세요!"
            onChange={(e) => onChangeGuide(e.target.value)}
          />
        </div>
      </div>

      {/* 관리 범주별 섹션 */}
      {ORDER.map((catKey) => {
        const cat = CATS[catKey];
        const rows = indexed.filter((it) => it.cat === catKey);
        return (
          <div className="ecat" key={catKey} style={{ '--c': cat.color }}>
            <div className="ecat-head">
              <span className="ecat-dot" />{cat.name}
              <span className="ecat-cnt">{rows.length}개</span>
            </div>

            {rows.map((it, pos) => (
              <div className="erow" key={it._key ?? it._i}>
                <div className="emove">
                  <button className="mv" disabled={pos === 0} onClick={() => onMoveRow(it._i, -1)} aria-label="위로">▲</button>
                  <button className="mv" disabled={pos === rows.length - 1} onClick={() => onMoveRow(it._i, 1)} aria-label="아래로">▼</button>
                </div>
                <div className="ef">
                  <input
                    className="title"
                    value={it.title}
                    placeholder="할 일"
                    onChange={(e) => onChangeRow(it._i, 'title', e.target.value)}
                  />
                  <input
                    className="det"
                    value={it.detail}
                    placeholder="자세한 가이드 (선택)"
                    onChange={(e) => onChangeRow(it._i, 'detail', e.target.value)}
                  />
                </div>
                <button className="del" onClick={() => onDelRow(it._i)}>삭제</button>
              </div>
            ))}

            <button className="ecat-add" onClick={() => onAddRow(catKey)}>+ {cat.name} 항목 추가</button>
          </div>
        );
      })}

      <div className="savebar">
        <button className="btn again" onClick={onCancel} disabled={saving}>취소</button>
        <button className="btn" onClick={onSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  );
}
