// src/FarmMap.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSignalLights } from "./SignalLightsContext";
import RenamePopup from "./RenamePopup";
import { useLabels } from "./LabelContext";

import treeSVG from "./assets/icons/tree.svg";
import bugSVG from "./assets/icons/bug.svg";
import clockSVG from "./assets/icons/clock.svg";

const daysSince = (isoDate) => {
  const todayKST = getToday();
  const [ty, tm, td] = todayKST.split('-').map(Number);
  const [y, m, d] = isoDate.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const target = new Date(y, m - 1, d);
  return (today - target) / (1000 * 60 * 60 * 24);
};

function toKSTDate(d) {
  // 한국 시간(KST, UTC+9) 기준 날짜
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function getToday() {
  return toKSTDate(new Date());
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toKSTDate(d);
}

function computeTriggers(records) {
  if (!records || records.length === 0) {
    return { treeOn: false, bugOn: false, bugEmphasis: false, clockOn: true };
  }

  // 최신 날짜 기록이 먼저 오도록 정렬
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  records = sorted;

  const today = getToday();

  // ★ 공통 규칙: 오늘 날짜로 저장된 기록이 있으면 → 모든 아이콘 OFF
  const todayRecord = records.find(r => r.date === today);
  if (todayRecord) {
    return { treeOn: false, bugOn: false, bugEmphasis: false, clockOn: false };
  }

  // --- 나무 아이콘: 어제 세력 1,5 또는 균형 1,2 ---
  const yesterday = getYesterday();
  const yesterdayRecord = records.find(r => r.date === yesterday);
  let treeOn = false;
  if (yesterdayRecord) {
    const p = String(yesterdayRecord.power);
    const b = String(yesterdayRecord.balance);
    if (["1", "5"].includes(p) || ["1", "2"].includes(b)) {
      treeOn = true;
    }
  }

  // --- 벌레 아이콘: 해충점수 기준 + 입력일 후 지연 활성화 ---
  let bugOn = false;
  let bugEmphasis = false;
  const bugRecord = records.find(r => r.bugs !== null && r.bugs !== undefined && r.bugs !== '');
  if (bugRecord) {
    const bugScore = Number(bugRecord.bugs);
    const days = daysSince(bugRecord.date);
    if (bugScore >= 4 && days >= 1) {
      bugOn = true;
      bugEmphasis = true;
    } else if (bugScore >= 2 && bugScore <= 3 && days >= 3) {
      bugOn = true;
    } else if (bugScore <= 1 && days >= 4) {
      bugOn = true;
    }
  }

  // --- 시계 아이콘: 5일간 세력/균형 입력 없으면 활성화 (판단불가도 입력으로 인정) ---
  const recentWithScore = records.find(r =>
    (r.power !== null && r.power !== undefined && r.power !== '') ||
    (r.balance !== null && r.balance !== undefined && r.balance !== '')
  );
  let clockOn = true;
  if (recentWithScore) {
    clockOn = daysSince(recentWithScore.date) >= 5;
  }

  return { treeOn, bugOn, bugEmphasis, clockOn };
}

export default function FarmMap({ treeData = {}, onTreeClick, litTreeIds = new Set(), doneTreeIds = new Set() }) {
  const rows = 25;
  const cols = 8;
  const cellW = 44;
  const cellH = 26;
  const gapX = 6;
  const gapY = 8;
  const iconSize = 12;
  const iconGap = 2;

  const containerRef = useRef(null);
  const gridRef = useRef(null);
  const scaleRef = useRef(1);
  const posRef = useRef({ x: 0, y: 0 });
  const lastDistRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const wasDragRef = useRef(false);

  const { signalOn } = useSignalLights();
  const { labels, upsert } = useLabels();
  const [editId, setEditId] = useState(null);

  const gridW = cols * cellW + (cols - 1) * gapX;
  const gridH = rows * (cellH + 10) + (rows - 1) * gapY;

  // transform 적용 (React state 안 씀 → 렉 없음)
  const applyTransform = useCallback(() => {
    if (!gridRef.current || !containerRef.current) return;
    const s = scaleRef.current;
    const p = posRef.current;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const scaledW = gridW * s;
    const scaledH = gridH * s;

    // 지도가 화면 밖으로 완전히 사라지지 않게 제한
    const margin = 50; // 최소 50px은 보이게
    p.x = Math.max(-scaledW + margin, Math.min(cw - margin, p.x));
    p.y = Math.max(-scaledH + margin, Math.min(ch - margin, p.y));
    posRef.current = p;

    gridRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${s})`;
  }, [gridW, gridH]);

  // 데스크탑 초기 스케일
  useEffect(() => {
    const isDesktop = window.innerWidth >= 1025;
    if (isDesktop) {
      const initScale = Math.min(window.innerWidth / 350, 3.5);
      scaleRef.current = initScale;
      posRef.current = { x: 20, y: 20 };
    }
    applyTransform();
  }, [applyTransform]);

  // 마우스 휠 줌
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const oldScale = scaleRef.current;
      const newScale = Math.max(0.5, Math.min(4, e.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1));
      const oldPos = posRef.current;
      const newPos = {
        x: pointer.x - ((pointer.x - oldPos.x) / oldScale) * newScale,
        y: pointer.y - ((pointer.y - oldPos.y) / oldScale) * newScale,
      };
      scaleRef.current = newScale;
      posRef.current = newPos;
      applyTransform();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [applyTransform]);

  // 터치: 드래그(1손가락) + 핀치줌(2손가락)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        // 핀치 시작
        isDraggingRef.current = false;
        lastDistRef.current = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
      } else if (e.touches.length === 1) {
        // 드래그 시작
        isDraggingRef.current = true;
        wasDragRef.current = false;
        dragStartRef.current = { ...posRef.current };
        pointerStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();

      if (e.touches.length === 2) {
        // 핀치줌
        isDraggingRef.current = false;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (lastDistRef.current === null) { lastDistRef.current = dist; return; }

        const ratio = dist / lastDistRef.current;
        lastDistRef.current = dist;

        const rect = el.getBoundingClientRect();
        const mid = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
        const oldScale = scaleRef.current;
        const newScale = Math.max(0.5, Math.min(4, oldScale * ratio));
        const oldPos = posRef.current;
        const newPos = {
          x: mid.x - ((mid.x - oldPos.x) / oldScale) * newScale,
          y: mid.y - ((mid.y - oldPos.y) / oldScale) * newScale,
        };

        scaleRef.current = newScale;
        posRef.current = newPos;
        applyTransform();
      } else if (e.touches.length === 1 && isDraggingRef.current) {
        // 1손가락 드래그
        const dx = e.touches[0].clientX - pointerStartRef.current.x;
        const dy = e.touches[0].clientY - pointerStartRef.current.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragRef.current = true;
        posRef.current = {
          x: dragStartRef.current.x + dx,
          y: dragStartRef.current.y + dy,
        };
        applyTransform();
      }
    };

    const onTouchEnd = () => {
      lastDistRef.current = null;
      isDraggingRef.current = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [applyTransform]);

  // 마우스 드래그 (데스크탑)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      wasDragRef.current = false;
      dragStartRef.current = { ...posRef.current };
      pointerStartRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - pointerStartRef.current.x;
      const dy = e.clientY - pointerStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragRef.current = true;
      posRef.current = {
        x: dragStartRef.current.x + dx,
        y: dragStartRef.current.y + dy,
      };
      applyTransform();
    };
    const onMouseUp = () => { isDraggingRef.current = false; };

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [applyTransform]);

  // 컨테이너 높이
  const [containerHeight, setContainerHeight] = useState(window.innerHeight);
  useEffect(() => {
    function calcHeight() {
      const header = document.querySelector(".app-header-bar");
      const headerH = header ? header.getBoundingClientRect().height : 50;
      setContainerHeight(window.innerHeight - headerH);
    }
    calcHeight();
    window.addEventListener("resize", calcHeight);
    return () => window.removeEventListener("resize", calcHeight);
  }, []);

  // 셀 클릭 핸들러 (드래그와 구분)
  const handleCellClick = useCallback((id) => {
    if (wasDragRef.current) return;
    onTreeClick(id);
  }, [onTreeClick]);

  const handleLabelClick = useCallback((id) => {
    if (wasDragRef.current) return;
    setEditId(id);
  }, []);

  // 아이콘 x 위치 계산
  const xCenter = (i) => {
    const stripW = 3 * iconSize + 2 * iconGap;
    return (cellW - stripW) / 2 + i * (iconSize + iconGap);
  };

  return (
    <div
      ref={containerRef}
      style={{
        overflow: "hidden",
        width: "100%",
        height: containerHeight,
        touchAction: "none",
        userSelect: "none",
        cursor: isDraggingRef.current ? "grabbing" : "grab",
        position: "relative",
      }}
    >
      <div
        ref={gridRef}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellH + 10}px)`,
          columnGap: gapX,
          rowGap: gapY,
          transformOrigin: "0 0",
          willChange: "transform",
          width: gridW,
        }}
      >
        {Array.from({ length: rows * cols }, (_, idx) => {
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          const id = `Tree-${c + 1}-${r + 1}`;
          const numericId = `${c + 1}-${r + 1}`;
          const lbl = labels[id] || {};
          const displayId = lbl.name ? `${numericId} ${lbl.name}` : numericId;
          const isDisabled = lbl.disabled === true;
          const records = treeData[numericId] || [];
          const { treeOn, bugOn, bugEmphasis, clockOn } = computeTriggers(records);
          const hasTodayInput = records.some(r => r.date === getToday());

          if (isDisabled) {
            return (
              <div
                key={id}
                onClick={() => handleLabelClick(id)}
                style={{
                  width: cellW,
                  height: cellH + 10,
                  backgroundColor: "#d3d3d3",
                  opacity: 0.5,
                  borderRadius: 2,
                  cursor: "pointer",
                }}
              />
            );
          }

          return (
            <div
              key={id}
              style={{
                width: cellW,
                height: cellH + 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                outline: "1.5px solid #000000",
                backgroundColor: litTreeIds.has(numericId) ? "#c2d9c7" : undefined,
                position: "relative",
              }}
            >
              {/* 오늘 입력 표시 - 우측상단 점 (불 켜져있었으면 보라, 아니면 초록) */}
              {hasTodayInput && (
                <span style={{
                  position: 'absolute',
                  top: 1,
                  right: 1,
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: doneTreeIds.has(numericId) ? '#667eea' : '#10b981',
                  zIndex: 1,
                }} />
              )}
              {/* 아이콘 영역 */}
              <div
                onClick={() => handleCellClick(id)}
                style={{
                  display: "flex",
                  gap: iconGap,
                  justifyContent: "center",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <img
                  src={treeSVG}
                  width={iconSize}
                  height={iconSize}
                  style={{ opacity: signalOn && treeOn ? 1 : 0.25 }}
                  draggable={false}
                  alt=""
                />
                <img
                  src={bugSVG}
                  width={iconSize}
                  height={iconSize}
                  style={{
                    opacity: signalOn && bugOn ? 1 : 0.25,
                    ...(signalOn && bugOn && bugEmphasis ? {
                      filter: "drop-shadow(0 0 2px red) drop-shadow(0 0 4px red)",
                      transform: "scale(1.3)",
                    } : {}),
                  }}
                  draggable={false}
                  alt=""
                />
                <img
                  src={clockSVG}
                  width={iconSize}
                  height={iconSize}
                  style={{ opacity: signalOn && clockOn ? 1 : 0.25 }}
                  draggable={false}
                  alt=""
                />
              </div>

              {/* 라벨 영역 */}
              <div
                onClick={() => handleLabelClick(id)}
                style={{
                  width: "100%",
                  height: 10,
                  backgroundColor: lbl.color || "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    fontSize: Math.max(4, Math.min(8, cellW / (displayId.length * 0.65))),
                    fontFamily: "sans-serif",
                    color: "#000000",
                    whiteSpace: "nowrap",
                    lineHeight: "10px",
                  }}
                >
                  {displayId}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {editId && (
        <RenamePopup
          id={editId}
          current={labels[editId]}
          onSave={(payload) => upsert(editId, payload)}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  );
}
