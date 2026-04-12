// src/components/AnnouncementPopup.jsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const PAGE_SIZE = 30;

export default function AnnouncementPopup({ onClose, authorName }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [pinning, setPinning] = useState(false);
  const inputRef = useRef(null);

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

  useEffect(() => { fetchItems(); }, []);

  const handlePin = async (item) => {
    if (pinning) return;
    setPinning(true);

    if (item.pinned) {
      // 핀 해제
      await supabase.from('announcements').update({ pinned: false }).eq('id', item.id);
    } else {
      // 기존 핀 전부 해제 → 이 글만 핀
      await supabase.from('announcements').update({ pinned: false }).eq('pinned', true);
      await supabase.from('announcements').update({ pinned: true }).eq('id', item.id);
    }

    setPinning(false);
    // 리스트 새로고침
    setHasMore(true);
    setOffset(0);
    fetchItems(0, false);
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);

    const { error } = await supabase
      .from('announcements')
      .insert({ message: trimmed, author: authorName });

    if (error) {
      console.error(error);
      setSending(false);
      return;
    }

    setMessage('');
    setSending(false);
    setHasMore(true);
    setOffset(0);
    fetchItems(0, false);
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
                      <span style={{ fontSize: '0.75rem', color: '#aaa' }}>
                        {formatTime(item.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#222', lineHeight: '1.45' }}>
                      {item.message}
                    </div>
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
