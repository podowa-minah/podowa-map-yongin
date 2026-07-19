// src/FarmMap.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSignalLights } from "./SignalLightsContext";
import RenamePopup from "./RenamePopup";
import AiPriorityMarks from "./components/AiPriorityMarks";
import { useLabels } from "./LabelContext";
import { getFarmDiagnosis } from "./lib/diagnosis";

import treeSVG from "./assets/icons/tree.svg";
import bugSVG from "./assets/icons/bug.svg";
import clockSVG from "./assets/icons/clock.svg";
import { evaluateSignals } from "./utils/dailyStats";

function toKSTDate(d) {
  // 한국 시간(KST, UTC+9) 기준 날짜
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function getToday() {
  return toKSTDate(new Date());
}



function computeTriggers(records) {
  const today = getToday();
  const hasTodayRecord = records && records.some(r => r.date === today);

  // 오늘 기록 있으면 → 모든 아이콘 OFF
  if (hasTodayRecord) {
    return { treeLevel: 'off', bugLevel: 'off', clockLevel: 'off', anyOn: false, anyOverdue: false };
  }

  // 오늘 이전 기록만 넘겨서 판정
  const recsBefore = (records || []).filter(r => r.date < today);
  return evaluateSignals(recsBefore, today);
}

export default function FarmMap({ treeData = {}, onTreeClick, litTreeIds = new Set(), doneTreeIds = new Set(), fakeDoneTreeIds = new Set(), fakeDoneReasons = {}, watchTreeIds = new Set(), watchReasons = {}, aiTrees = {}, clusterTrimTreeIds = new Set(), thinningTreeIds = new Set(), onViewportChange, freshDataLoaded = false, pestMode = false, pestColorById = {} }) {
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

  // 라벨 + 서버 fresh fetch 둘 다 완료돼야 lit 표시 (캐시-즉시-treeData / 라벨-나중 race 깜빡임 방지)
  const labelsReady = Object.keys(labels || {}).length >= 5;
  const litReady = labelsReady && freshDataLoaded;

  // 유심히 볼 나무 이유 — FarmMap이 직접 계산(App 의존 X). 칩에 표시할 짧은 이유.
  //   App이 watchReasons를 넘기면 그걸 우선 쓰고, 없으면 여기서 계산한 걸 쓴다.
  const watchReasonsLocal = useMemo(() => {
    const diag = getFarmDiagnosis(treeData, labels, getToday());
    const m = {};
    for (const w of (diag.watchTrees || [])) m[w.id] = (w.reasons || []).join('·');
    return m;
  }, [treeData, labels]);

  const gridW = cols * cellW + (cols - 1) * gapX;
  const gridH = rows * (cellH + 10) + (rows - 1) * gapY;

  // transform 적용 (React state 안 씀 → 렉 없음)
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const applyTransform = useCallback(() => {
    if (!gridRef.current || !containerRef.current) return;
    const s = scaleRef.current;
    const p = posRef.current;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const scaledW = gridW * s;
    const scaledH = gridH * s;

    // 지도가 75% 이상 항상 보이게 제한
    const marginX = cw * 0.25;
    const marginY = ch * 0.25;
    p.x = Math.max(-scaledW + cw - marginX, Math.min(marginX, p.x));
    p.y = Math.max(-scaledH + ch - marginY, Math.min(marginY, p.y));
    posRef.current = p;

    gridRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${s})`;

    // 미니맵 뷰포트 박스용 콜백
    if (onViewportChangeRef.current) {
      onViewportChangeRef.current({ scale: s, posX: p.x, posY: p.y, containerW: cw, containerH: ch, gridW, gridH });
    }
  }, [gridW, gridH]);

  // 초기 스케일: 1~8열이 화면 너비에 맞게
  useEffect(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const padding = 2;
    const initScale = Math.max(0.8, Math.min((cw - padding * 2) / gridW, 3.5));
    scaleRef.current = initScale;
    // 가로 중앙 정렬, 세로는 격자 위 입구 띠(30px in grid coords)가 화면에 보이도록 시작
    const scaledW = gridW * initScale;
    const GATE_OFFSET = 30;            // GateMark 높이(26) + 위 여백(4) — 격자 위 공간
    posRef.current = {
      x: Math.max(0, (cw - scaledW) / 2),
      y: GATE_OFFSET * initScale + 4,  // 어떤 줌에서도 입구가 윗쪽 4px 부근에 보이게
    };
    applyTransform();
  }, [applyTransform, gridW]);

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
          position: "relative",        // 문(GateMark) absolute 자식 위치 기준
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
          const { treeLevel, bugLevel, clockLevel, anyOn, anyOverdue } = computeTriggers(records);
          const hasTodayInput = records.some(r => r.date === getToday());
          const isWatch = watchTreeIds.has(numericId);   // 오늘 유심히 볼 나무(이상치)
          // 칸 전체에 거는 호버 이유 (작은 점만이 아니라 나무 어디든 호버하면 뜨게)
          const tileTitle = fakeDoneTreeIds.has(numericId)
            ? (fakeDoneReasons[numericId] || '헛돌봄 — 필요한 작업을 빠뜨렸어요')
            : isWatch ? (watchReasons[numericId] || watchReasonsLocal[numericId] || '유심히 볼 나무')
            : undefined;

          if (isDisabled) {
            return (
              <div
                key={id}
                onClick={() => handleLabelClick(id)}
                style={{
                  width: cellW,
                  height: cellH + 10,
                  backgroundColor: "#ede4cf",   // 크림톤에 어울리는 베이지
                  opacity: 0.55,
                  borderRadius: 5,              // 살짝 둥글게
                  cursor: "pointer",
                }}
              />
            );
          }

          // 할일(색깔 있는 셀) = 진하게 띄움 / 완료(흰 셀) = 차분하게
          const isNamedCard = !!lbl.name;
          const hasTodo = signalOn && anyOn && litReady;   // 라벨+fresh fetch 둘 다 완료 후에만 lit (깜빡임 방지)
          const cardShadow = (hasTodo && anyOverdue)
            // 빨강 (긴급 할일) — 둥둥 떠 보이게
            ? "0 0 0 1.5px rgba(220, 80, 60, 0.7), 0 5px 12px rgba(220, 80, 60, 0.30), 0 2px 4px rgba(220, 80, 60, 0.20)"
            : hasTodo
              // 초록 (오늘 할일) — 또렷하게 띄움
              ? "0 0 0 1.5px #6fa97a, 0 5px 12px rgba(60, 130, 80, 0.28), 0 2px 4px rgba(60, 130, 80, 0.15)"
              : isNamedCard
                // 흰 카드 (완료/관리 중) — 차분, 평평
                ? "0 0 0 1px #d6c8a8, 0 1px 2px rgba(120, 90, 40, 0.08)"
                // 빈 칸 — 거의 평평
                : "0 0 0 1px #e0d4b5, 0 0px 1px rgba(120, 90, 40, 0.04)";

          // 송이크기정리/알솎이 "최종완료" 강조 테두리 — 알솎이(파랑) 우선, 송이크기정리(노랑).
          //   전밭이 알솎이까지 끝나면 App이 Set을 비워줘서 자동으로 사라짐.
          //   ⚠️ litReady(라벨+서버 fetch 완료) 전엔 안 그린다 — 캐시로 먼저 그렸다가 다시 그려서
          //      테두리가 번쩍이던 문제(minari: "일할 때마다 깜빡깜빡") 방지. 신호등(361줄)과 같은 게이트.
          const markRingColor = !litReady ? null
            : thinningTreeIds.has(numericId) ? '#2563eb'
            : clusterTrimTreeIds.has(numericId) ? '#eab308' : null;
          const finalShadow = markRingColor
            ? `0 0 0 2.5px ${markRingColor}, ${cardShadow}`
            : cardShadow;

          return (
            <div
              key={id}
              title={tileTitle}
              style={{
                width: cellW,
                height: cellH + 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                boxShadow: pestMode ? '0 0 0 1px #d6c8a8, 0 1px 2px rgba(120, 90, 40, 0.10)' : finalShadow,
                borderRadius: 5,
                backgroundColor: pestMode
                  ? (pestColorById[numericId] || '#efe9df')   // 병해충 모드: 분포색(없으면 흐림)
                  : (hasTodo ? (anyOverdue ? 'rgba(220, 80, 60, 0.25)' : '#c2d9c7') : '#fffefb'),
                overflow: "hidden",            // 둥근 모서리 안쪽까지 잘림
                position: "relative",
                // 흰 카드(완료)는 살짝 가라앉게, 색깔 카드는 살짝 위로
                transform: (!pestMode && hasTodo) ? 'translateY(-1px)' : 'none',
              }}
            >
              {/* 오늘 입력 표시 - 우측상단 점 (정돌봄=초록, 헛돌봄=오렌지, 착한돌봄=파랑) */}
              {!pestMode && hasTodayInput && (
                <span style={{
                  position: 'absolute',
                  top: 1,
                  right: 1,
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: fakeDoneTreeIds.has(numericId) ? '#f97316' : doneTreeIds.has(numericId) ? '#10b981' : '#667eea',
                  zIndex: 1,
                }} />
              )}
              {/* 유심히 볼 나무(이상치) - 좌측상단 주황 점 + 글로우. 브리핑 '유심히'와 동일 */}
              {!pestMode && isWatch && (
                <span
                  title={watchReasons[numericId] || '유심히 볼 나무'}
                  style={{
                    position: 'absolute',
                    top: 1,
                    left: 1,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#f97316',
                    border: '1.5px solid #fff',
                    boxShadow: '0 0 0 1px #c2410c, 0 0 4px rgba(249,115,22,0.95)',
                    zIndex: 2,
                  }}
                />
              )}
              {/* 아이콘 영역 (병해충 모드에선 흐리게 — 분포색이 주인공) */}
              <div
                onClick={() => handleCellClick(id)}
                style={{
                  display: "flex",
                  gap: iconGap,
                  justifyContent: "center",
                  alignItems: "center",
                  flex: 1,
                  opacity: pestMode ? 0.12 : 1,
                }}
              >
                <img
                  src={treeSVG}
                  width={iconSize}
                  height={iconSize}
                  style={{
                    opacity: signalOn && treeLevel !== 'off' ? 1 : 0.25,
                    ...(signalOn && treeLevel === 'emphasis' ? {
                      filter: "drop-shadow(0 0 2px #10b981) drop-shadow(0 0 4px #10b981)",
                      transform: "scale(1.3)",
                    } : {}),
                  }}
                  draggable={false}
                  alt=""
                />
                <img
                  src={bugSVG}
                  width={iconSize}
                  height={iconSize}
                  style={{
                    opacity: signalOn && bugLevel !== 'off' ? 1 : 0.25,
                    ...(signalOn && bugLevel === 'emphasis' ? {
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
                  style={{
                    opacity: signalOn && clockLevel !== 'off' ? 1 : 0.25,
                    ...(signalOn && clockLevel === 'emphasis' ? {
                      filter: "drop-shadow(0 0 2px #f59e0b) drop-shadow(0 0 4px #f59e0b)",
                      transform: "scale(1.3)",
                    } : {}),
                  }}
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

        {/* 유심히 볼 나무 이유 칩 — 호버 대신 맵에 상시 표시(모바일). 나무 위에 작은 칩. */}
        {[...watchTreeIds].map((nid) => {
          if (aiTrees[nid]) return null;   // AI 1순위면 보라가 대신 — 주황칩 숨겨 겹침 방지
          const reason = watchReasons[nid] || watchReasonsLocal[nid];
          if (!reason) return null;
          const [c, r] = String(nid).split('-').map(Number);
          if (!c || !r) return null;
          const x = (c - 1) * (cellW + gapX);
          const y = (r - 1) * (cellH + 10 + gapY);
          return (
            <div
              key={`watchchip-${nid}`}
              style={{
                position: 'absolute',
                left: x - 8,
                top: y - 12,
                width: cellW + 16,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 4,
              }}
            >
              <span style={{
                fontSize: 6.5,
                lineHeight: '8px',
                whiteSpace: 'nowrap',
                background: '#fff7ed',
                color: '#9a3412',
                border: '0.5px solid #fdba74',
                borderRadius: 4,
                padding: '1px 3px',
                fontWeight: 700,
              }}>{reason}</span>
            </div>
          );
        })}

        {/* ⚡ AI 1순위 나무 — 타일 전체 보라 + "AI 긴급" 배지 + 이유 말풍선 (하면 자동으로 빠짐) */}
        <AiPriorityMarks aiTrees={aiTrees} cellW={cellW} cellH={cellH} gapX={gapX} gapY={gapY} />

        {/* 입구 문 — 3-1, 4-1 자리 위 (남쪽 입구). 격자와 함께 줌됨 */}
        <GateMark cellW={cellW} cellH={cellH} gapX={gapX} />
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

// ── 입구 표지 (3-1, 4-1 자리 위, 격자 바깥) ────────────
// 격자 위쪽에 위치 — 3-1, 4-1 셀은 정상 사용 가능. 격자와 함께 줌됨.
// 좌·우 기둥 + 상단 간판("입구") + "남" 화살표 ↓
function GateMark({ cellW, cellH, gapX }) {
  const w = 2 * cellW + gapX;          // cols 3-4 합한 너비 = 94
  const h = 26;                         // 입구 띠 높이 (격자 위)
  const left = 2 * (cellW + gapX);      // col 3 시작 x = 100
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: -(h + 4),                  // 격자 위 4px 여백 두고
        width: w,
        height: h,
        pointerEvents: 'none',
        zIndex: 5,
      }}
      aria-label="남쪽 입구"
    >
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
        {/* 좌·우 기둥 (간판 받침) */}
        <rect x="3"     y="12" width="4" height="13" fill="#8b6f47" stroke="#5e3a1a" strokeWidth="0.5" />
        <rect x={w - 7} y="12" width="4" height="13" fill="#8b6f47" stroke="#5e3a1a" strokeWidth="0.5" />
        {/* 상단 간판 — 따뜻한 나무톤 그라데이션 느낌 */}
        <rect x="2" y="2" width={w - 4} height="11" rx="2.2"
              fill="#d4b285" stroke="#5e3a1a" strokeWidth="0.9" />
        {/* 간판 상단 음영 */}
        <rect x="3" y="3" width={w - 6} height="3" rx="1.5" fill="#b8915a" opacity="0.7" />
        {/* "입구" 텍스트 — 크고 굵게 */}
        <text x={w / 2} y="10.5" textAnchor="middle"
              fontSize="7.5" fontWeight="900" fill="#3a2410"
              fontFamily="system-ui, -apple-system, sans-serif"
              letterSpacing="0.5">
          ↓ 입구
        </text>
        {/* (남쪽 표시 임시 제거) */}
      </svg>
    </div>
  );
}

