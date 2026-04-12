// src/components/AnnouncementPopup.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 30;
const DELETE_PASSWORD = '1234';

export default function AnnouncementPopup({ onClose, authorName, onPinChange, prefetchedItems, onListChange }) {
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
  const inputRef = useRef(null);
  const deleteInputRef = useRef(null);

  const fetchItems = async (from = 0, append = false) => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
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

    // 옵티미스틱: 로컬 즉시 반영
    setItems(prev => prev.map(it => ({
      ...it,
      pinned: it.id === item.id ? newPinned : false,
    })));
    onPinChange?.(newPinned ? { ...item, pinned: true } : null);

    // DB 반영
    if (newPinned) {
      await supabase.from('announcements').update({ pinned: false }).eq('pinned', true);
      await supabase.from('announcements').update({ pinned: true }).eq('id', item.id);
    } else {
      await supabase.from('announcements').update({ pinned: false }).eq('id', item.id);
    }

    setPinning(false);
    onListChange?.();
  };

  const handleDelete = async () => {
    if (deletePass !== DELETE_PASSWORD) {
      setDeleteError(true);
      return;
    }

    const wasPinned = deleteTarget.pinned;

    // 옵티미스틱
    setItems(prev => prev.filter(it => it.id !== deleteTarget.id));
    if (wasPinned) onPinChange?.(null);

    await supabase.from('announcements').delete().eq('id', deleteTarget.id);

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
      }} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid #eee',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>전달사항</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '1.2rem',
            cursor: 'pointer', color: '#888', padding: '4px',
          }}>✕</button>
        </div>

        {/* 리스트 */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '10px 16px',
        }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>불러오는 중...</p>
          ) : items.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '20px 0' }}>아직 전달사항이 없습니다</p>
          ) : (
            <>
              {items.map((item) => (
                <div key={item.id} style={{
                  padding: '10px 0',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}>
                  {/* 체크박스 (왼쪽) */}
                  <div
                    onClick={() => handlePin(item)}
                    style={{
                      marginTop: '2px',
                      width: '20px',
                      height: '20px',
                      minWidth: '20px',
                      borderRadius: '4px',
                      border: item.pinned ? '2px solid #4caf50' : '2px solid #ccc',
                      backgroundColor: item.pinned ? '#4caf50' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      color: '#fff',
                    }}
                  >
                    {item.pinned && '✓'}
                  </div>

                  {/* 내용 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#444' }}>
                        {'\uD83E\uDDD1\u200D\uD83C\uDF3E'} {item.author}
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
                    <div style={{ fontSize: '0.9rem', color: '#222', lineHeight: '1.45' }}>
                      {item.message}
                    </div>

                    {/* 삭제 비번 입력 */}
                    {deleteTarget?.id === item.id && (
                      <div style={{
                        marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center',
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
              ))}
              {hasMore && (
                <button
                  onClick={() => fetchItems(offset, true)}
                  style={{
                    width: '100%', padding: '10px', margin: '8px 0',
                    background: '#f5f5f5', border: '1px solid #ddd',
                    borderRadius: '8px', cursor: 'pointer',
                    fontSize: '0.85rem', color: '#666',
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
              flex: 1, padding: '10px 12px',
              border: '1px solid #ddd', borderRadius: '8px',
              fontSize: '0.9rem', outline: 'none',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            style={{
              padding: '10px 16px',
              backgroundColor: message.trim() ? '#4caf50' : '#ccc',
              color: '#fff', border: 'none', borderRadius: '8px',
              fontSize: '0.9rem', fontWeight: 500,
              cursor: message.trim() ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            {sending ? '...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
