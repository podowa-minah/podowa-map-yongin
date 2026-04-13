// src/components/MiniMap.jsx
import React, { useEffect, useRef } from 'react';
import { useLabels } from '../LabelContext';

const ROWS = 25;
const COLS = 8;
const CELL = 3;
const GAP = 1;

export default function MiniMap({ litTreeIds = new Set() }) {
  const { labels } = useLabels();
  const canvasRef = useRef(null);

  const mapW = COLS * (CELL + GAP) - GAP;
  const mapH = ROWS * (CELL + GAP) - GAP;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = mapW * dpr;
    canvas.height = mapH * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, mapW, mapH);

    for (let r = 1; r <= ROWS; r++) {
      for (let c = 1; c <= COLS; c++) {
        const labelId = `Tree-${c}-${r}`;
        const numericId = `${c}-${r}`;
        const lbl = labels[labelId] || {};

        const x = (c - 1) * (CELL + GAP);
        const y = (r - 1) * (CELL + GAP);

        if (lbl.disabled) continue;

        if (litTreeIds.has(numericId)) {
          ctx.fillStyle = '#fbbf24';
        } else {
          ctx.fillStyle = '#b0b0b0';
        }
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }, [labels, litTreeIds]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: mapW,
        height: mapH,
        imageRendering: 'pixelated',
      }}
    />
  );
}
