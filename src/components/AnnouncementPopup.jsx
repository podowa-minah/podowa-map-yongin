// src/components/AnnouncementPopup.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 30;
const DELETE_PASSWORD = '1234';

export default function AnnouncementPopup({ onClose, authorName, prefetchedItems, onListChange, onDismiss, dismissedAt }) {
  const [items, setItems] = useState(prefetchedItems || []);
  const [loading, setLoading] = useState(!prefetchedItems);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [offset, setOffset] = useState(prefetchedItems ? PAGE_SIZE : 0);
  const [hasMore, setHasMore] = useState(!prefetchedItems || prefetchedItems.length >= PAGE_SIZE);
  const [pinning, setPinning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePass, setDeletePass] = useState('');
  const [deleteError, setDeleteError] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [justChecked, setJustChecked] = useState(null); // 방금 체크된 id (애니메이션용)
  const [dismissed, setDismissed] = useState(() => {
    if (!dismissedAt || !prefetchedItems || prefetchedItems.length === 0) return false;
    return !prefetchedItems.some(a => a.created_at > dismissedAt);
  });
  const inputRef = useRef(null);
  const deleteInputRef = useRef(null);

  const fetchItems = async (from = 0, append = false) => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) { console.error(error); return; }
    if (!data || data.length < PAGE_SIZE) setHasMore(false);
    setItems(prev => append ? [...prev, ...(data || [])] : (data || []));
    setOffset(from + PAGE_SIZE);
    setLoading(false);
  };

  useEffect(() => {
    if (prefetchedItems) {
      setItems(prefetchedItems);
      setLoading(false);
    } else {
      fetchItems();
    }
  }, []);

  const handlePin = async (item) => {
    if (pinning) return;
    setPinning(true);

    const newPinned = !item.pinned;

    // 체크하는 순간 → 애니메이션 트리거
    if (newPinned) {
      setJustChecked(item.id);
      setTimeout(() => setJustChecked(null), 600);
    }

    // 옵티미스틱: 로컬 즉시 반영 (여러 개 체크 가능)
    setItems(prev => prev.map(it =>
      it.id === item.id ? { ...it, pinned: newPinned } : it
    ));

    // DB 반영
    await supabase.from('announcements').update({ pinned: newPinned }).eq('id', item.id);

    setPinning(false);
    onListChange?.();
  };

  const handleDelete = async () => {
    if (deletePass !== DELETE_PASSWORD) {
      setDeleteError(true);
      return;
    }

    // 옵티미스틱
    setItems(prev => prev.filter(it => it.id !== deleteTarget.id));

    const { error: delErr } = await supabase.from('announcements').update({ deleted: true, pinned: false }).eq('id', deleteTarget.id);
    if (delErr) console.error('soft delete failed:', delErr);

    setDeleteTarget(null);
    setDeletePass('');
    setDeleteError(false);
    onListChange?.();
  };

  const handleDeleteKeyDown = (e) => {
    if (e.key === 'Enter') handleDelete();
    if (e.key === 'Escape') { setDeleteTarget(null); setDeletePass(''); setDeleteError(false); }
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);

    const { data, error } = await supabase
      .from('announcements')
      .insert({ message: trimmed, author: authorName })
      .select()
      .single();

    if (error) {
      console.error(error);
      setSending(false);
      return;
    }

    // 옵티미스틱
    if (data) setItems(prev => [data, ...prev]);

    setMessage('');
    setSending(false);
    onListChange?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (isoStr) => {
    const d = new Date(isoStr);
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const mon = kst.getUTCMonth() + 1;
    const day = kst.getUTCDate();
    const h = kst.getUTCHours();
    const m = String(kst.getUTCMinutes()).padStart(2, '0');
    return `${mon}/${day} ${h}:${m}`;
  };

  // 체크리스트 분할
  const activeItems = items.filter(it => !it.pinned);
  const completedItems = items.filter(it => it.pinned);
  const total = items.length;
  const doneCount = completedItems.length;
  const allDone = total > 0 && doneCount === total;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  // 카드 렌더 (active / completed 둘 다 사용)
  const renderItem = (item, isCompleted) => {
    const flashing = justChecked === item.id;
    return (
      <div key={item.id} style={{
        padding: '12px 12px',
        marginBottom: '8px',
        borderRadius: '10px',
        backgroundColor: isCompleted ? '#f5f9f5' : '#fff',
        border: isCompleted ? '1px solid #d6e8d6' : '1px solid #ebe7da',
        boxShadow: isCompleted ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        opacity: isCompleted ? 0.75 : 1,
        transform: flashing ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.25s ease, opacity 0.3s ease, background-color 0.3s ease',
      }}>
        {/* 체크박스 */}
        <div
          onClick={() => handlePin(item)}
          style={{
            marginTop: '1px',
            width: '22px',
            height: '22px',
            minWidth: '22px',
            borderRadius: '6px',
            border: isCompleted ? '2px solid #4caf50' : '2px solid #c7c1ad',
            backgroundColor: isCompleted ? '#4caf50' : '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            color: '#fff',
            fontWeight: 700,
            transition: 'all 0.2s ease',
            boxShadow: flashing ? '0 0 0 6px rgba(76, 175, 80, 0.2)' : 'none',
          }}
        >
          {isCompleted && '✓'}
        </div>

        {/* 내용 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{
              fontWeight: 500,
              fontSize: '0.85rem',
              color: isCompleted ? '#7a8a7a' : '#444',
            }}>
              {'🧑‍🌾'} {item.author}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                {formatTime(item.created_at)}
              </span>
              <button
                onClick={() => { setDeleteTarget(item); setDeletePass(''); setDeleteError(false); }}
                style={{
                  background: 'none', border: 'none',
                  fontSize: '0.75rem', color: '#ccc',
                  cursor: 'pointer', padding: '0 2px',
                }}
              >✕</button>
            </div>
          </div>
          <div style={{
            fontSize: '0.9rem',
            color: isCompleted ? '#7a8a7a' : '#222',
            lineHeight: '1.45',
            textDecoration: isCompleted ? 'line-through' : 'none',
            textDecorationColor: isCompleted ? '#a5c8a5' : 'transparent',
            textDecorationThickness: '1.5px',
          }}>
            {item.message}
          </div>

          {/* 삭제 비번 입력 */}
          {deleteTarget?.id === item.id && (
            <div style={{
              marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap',
            }}>
              <input
                ref={deleteInputRef}
                type="password"
                value={deletePass}
                onChange={e => { setDeletePass(e.target.value); setDeleteError(false); }}
                onKeyDown={handleDeleteKeyDown}
                placeholder="비밀번호"
                autoFocus
                style={{
                  width: '100px', padding: '4px 8px',
                  border: deleteError ? '1px solid #e53935' : '1px solid #ddd',
                  borderRadius: '4px', fontSize: '0.8rem', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleDelete}
                style={{
                  padding: '4px 10px', fontSize: '0.8rem',
                  backgroundColor: '#e53935', color: '#fff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                }}
              >삭제</button>
              <button
                onClick={() => { setDeleteTarget(null); setDeletePass(''); setDeleteError(false); }}
                style={{
                  padding: '4px 8px', fontSize: '0.8rem',
                  backgroundColor: '#eee', color: '#666',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                }}
              >취소</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: '500px',
        maxHeight: '75vh',
        backgroundColor: '#fff',
        borderRadius: '16px 16px 0 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: '8px',
          boxSizing: 'border-box',
        }}>
          <span style={{ fontWeight: 600, fontSize: '1rem', flexShrink: 0 }}>전달사항</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <button
              onClick={() => { setDismissed(prev => !prev); onDismiss?.(!dismissed); }}
              style={{
                background: dismissed ? '#f0fdf4' : 'none',
                border: dismissed ? '1px solid #86efac' : '1px solid #e2e8f0',
                borderRadius: '6px', padding: '4px 10px',
                fontSize: '0.75rem',
                color: '#718096',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                boxShadow: dismissed ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none',
                flexShrink: 0,
              }}
            >{dismissed ? <span>다 확인했어요 🙆‍♂️ <span style={{ color: '#10b981', fontWeight: 700 }}>✓</span></span> : '다 확인했어요 🙆‍♂️'}</button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: '1.2rem',
              cursor: 'pointer', color: '#888', padding: '4px',
              flexShrink: 0,
            }}>✕</button>
          </div>
        </div>

        {/* 진행 게이지 (아이템 있을 때만) */}
        {!loading && total > 0 && (
          <div style={{
            padding: '10px 16px 6px',
            backgroundColor: allDone ? '#f0fdf4' : '#fafaf6',
            borderBottom: '1px solid #f0ede0',
            boxSizing: 'border-box',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}>
              <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 500 }}>
                {allDone ? '🎉 모두 확인했어요!' : `📌 할 일 ${total - doneCount}개 남음`}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#4caf50', fontWeight: 600 }}>
                {doneCount} / {total}
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#e8e4d4',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: allDone ? '#10b981' : '#4caf50',
                transition: 'width 0.4s ease',
                borderRadius: '3px',
              }} />
            </div>
          </div>
        )}

        {/* 리스트 */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 14px',
          boxSizing: 'border-box',
        }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>불러오는 중...</p>
          ) : items.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>아직 전달사항이 없습니다</p>
          ) : (
            <>
              {/* 📌 할 일 (체크 안 된 것) */}
              {activeItems.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#8a7a4a',
                    marginBottom: '8px',
                    padding: '0 4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}>
                    <span>📌 할 일</span>
                    <span style={{ color: '#b8a87a', fontWeight: 500 }}>({activeItems.length})</span>
                  </div>
                  {activeItems.map(item => renderItem(item, false))}
                </div>
              )}

              {/* ✅ 완료 */}
              {completedItems.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div
                    onClick={() => setShowCompleted(prev => !prev)}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#4a7a4a',
                      marginBottom: '8px',
                      padding: '6px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      backgroundColor: '#f0f7f0',
                      userSelect: 'none',
                    }}
                  >
                    <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: showCompleted ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <span>✅ 완료</span>
                    <span style={{ color: '#7aa57a', fontWeight: 500 }}>({completedItems.length})</span>
                  </div>
                  {showCompleted && completedItems.map(item => renderItem(item, true))}
                </div>
              )}

              {/* 전부 완료 셀러브레이션 */}
              {allDone && (
                <div style={{
                  marginTop: '10px',
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: '#f0fdf4',
                  border: '1px dashed #86efac',
                  textAlign: 'center',
                  fontSize: '0.85rem',
                  color: '#15803d',
                  fontWeight: 500,
                }}>
                  🌿 농부님, 오늘 전달사항 다 확인했어요!
                </div>
              )}

              {hasMore && (
                <button
                  onClick={() => fetchItems(offset, true)}
                  style={{
                    width: '100%', padding: '10px', margin: '8px 0',
                    background: '#f5f5f5', border: '1px solid #ddd',
                    borderRadius: '8px', cursor: 'pointer',
                    fontSize: '0.85rem', color: '#666',
                    boxSizing: 'border-box',
                  }}
                >
                  이전 글 더보기
                </button>
              )}
            </>
          )}
        </div>

        {/* 입력 */}
        <div style={{
          padding: '10px 12px', borderTop: '1px solid #eee',
          display: 'flex', gap: '8px', alignItems: 'center',
          backgroundColor: '#fafafa',
          boxSizing: 'border-box',
          width: '100%',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="전달사항 입력..."
            maxLength={200}
            style={{
              flex: 1, minWidth: 0, padding: '10px 12px',
              border: '1px solid #ddd', borderRadius: '8px',
              fontSize: '0.9rem', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            style={{
              padding: '10px 14px',
              backgroundColor: message.trim() ? '#4caf50' : '#ccc',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '0.9rem', fontWeight: 500,
              cursor: message.trim() ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >
            {sending ? '...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
