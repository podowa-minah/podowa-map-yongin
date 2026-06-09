// src/components/ManualMissionEditPanel.jsx
// 이달의 포도 미션 — 관리자 수정 패널 (보여주기 전용, CLAUDE.md §10 Layer 3)
// 저장 로직은 ManualMissionModal이 담당. 여기는 입력 UI만.
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
  onAddRow,
  onCancel,
  onSave,
}) {
  return (
    <div>
      {/* 이번 달 안내 한마디 */}
      <div className="erow" style={{ borderTop: '4px solid #f0c95a' }}>
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

      {/* 항목들 */}
      {draft.map((it, i) => (
        <div className="erow" key={it._key ?? i}>
          <select value={it.cat} onChange={(e) => onChangeRow(i, 'cat', e.target.value)}>
            {ORDER.map((c) => (
              <option key={c} value={c}>{CATS[c].name}</option>
            ))}
          </select>
          <div className="ef">
            <input
              className="title"
              value={it.title}
              placeholder="할 일"
              onChange={(e) => onChangeRow(i, 'title', e.target.value)}
            />
            <input
              className="det"
              value={it.detail}
              placeholder="자세한 노하우 (선택)"
              onChange={(e) => onChangeRow(i, 'detail', e.target.value)}
            />
          </div>
          <button className="del" onClick={() => onDelRow(i)}>삭제</button>
        </div>
      ))}

      <button className="addbtn" onClick={onAddRow}>+ 항목 추가</button>

      <div className="savebar">
        <button className="btn again" onClick={onCancel} disabled={saving}>취소</button>
        <button className="btn" onClick={onSave} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  );
}
