// src/utils/sounds.js
// 효과음:
//  - 꽥꽥(playQuack): mp3 파일 (assets/audio/quack.mp3, ~36KB)
//  - 정답(playSuccess) / 빵빠레(playCelebration): Web Audio API 합성

import quackMp3 from '../assets/audio/quack.mp3';

let _ctx = null;
function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!_ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _ctx = new AC();
  }
  return _ctx;
}

// 오리 mp3 — 한 번 만들어 재사용. 연타 가능하게 currentTime 리셋.
let _quackAudio = null;
function getQuackAudio() {
  if (typeof window === 'undefined') return null;
  if (!_quackAudio) {
    _quackAudio = new Audio(quackMp3);
    _quackAudio.volume = 1.0;
    _quackAudio.preload = 'auto';
  }
  return _quackAudio;
}

// 🎉 정답! "딩동댕~!" — 4단 상승 + 마지막 sparkle (게임쇼 정답 느낌)
// 약 0.65초, 밝고 신남
export function playSuccess() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const VOL = 0.5;

    // 4단 상승 벨톤 (C5 → E5 → G5 → C6)
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = now + i * 0.075;
      // 마지막 음은 길게 빛남
      const dur = i === notes.length - 1 ? 0.55 : 0.18;

      // 1) 메인 sine (벨톤)
      const sine = ctx.createOscillator();
      sine.type = 'sine'; sine.frequency.value = freq;

      // 2) 2nd 하모닉 triangle (밝은 빛)
      const tri = ctx.createOscillator();
      tri.type = 'triangle'; tri.frequency.value = freq * 2;
      const triG = ctx.createGain(); triG.gain.value = 0.28;

      // 3) 마지막 음만 살짝 비브라토 (반짝임)
      let lfo, lfoG;
      if (i === notes.length - 1) {
        lfo = ctx.createOscillator();
        lfo.frequency.value = 7;
        lfoG = ctx.createGain(); lfoG.gain.value = 5;
        lfo.connect(lfoG); lfoG.connect(sine.frequency);
      }

      // 4) 볼륨 envelope — 빠른 어택, 자연스러운 디케이
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOL, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      sine.connect(gain);
      tri.connect(triG); triG.connect(gain);
      gain.connect(ctx.destination);

      sine.start(t); tri.start(t);
      if (lfo) lfo.start(t);
      sine.stop(t + dur + 0.02); tri.stop(t + dur + 0.02);
      if (lfo) lfo.stop(t + dur + 0.02);
    });

    // 마지막에 살짝 더 높은 sparkle (E6 + G6) — 빛나는 마무리
    [1318.5, 1568].forEach((freq, i) => {
      const t = now + 0.32 + i * 0.04;
      const dur = 0.4;
      const sine = ctx.createOscillator();
      sine.type = 'sine'; sine.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOL * 0.5, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      sine.connect(gain); gain.connect(ctx.destination);
      sine.start(t); sine.stop(t + dur + 0.02);
    });
  } catch (err) {
    console.warn('[playSuccess] failed:', err);
  }
}

// 🎊 100% 완료 — 더 화려한 빵빠레! ta-da! → 아르페지오 → 큰 코드 → sparkle
// 약 1.3초, 진짜 축하 느낌
export function playCelebration() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const VOL = 0.5;

    // Phase 1: 첫 "ta!" 트라이어드 (브라스)
    [523.25, 659.25, 783.99].forEach((freq) => {
      const t = now;
      const dur = 0.14;
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth'; saw.frequency.value = freq;
      const sine = ctx.createOscillator();
      sine.type = 'sine'; sine.frequency.value = freq;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 4500; lpf.Q.value = 1.5;
      const sawG = ctx.createGain(); sawG.gain.value = 0.3;
      const sineG = ctx.createGain(); sineG.gain.value = 0.5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOL, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      saw.connect(sawG); sawG.connect(lpf);
      sine.connect(sineG); sineG.connect(lpf);
      lpf.connect(gain); gain.connect(ctx.destination);
      saw.start(t); sine.start(t);
      saw.stop(t + dur + 0.01); sine.stop(t + dur + 0.01);
    });

    // Phase 2: 상승 아르페지오 C-E-G-C-E-G (옥타브 더 위로)
    const arp = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568];
    arp.forEach((freq, i) => {
      const t = now + 0.18 + i * 0.075;
      const dur = 0.18;
      const sine = ctx.createOscillator();
      sine.type = 'sine'; sine.frequency.value = freq;
      const tri = ctx.createOscillator();
      tri.type = 'triangle'; tri.frequency.value = freq * 2;
      const triG = ctx.createGain(); triG.gain.value = 0.18;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOL * 0.7, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      sine.connect(gain); tri.connect(triG); triG.connect(gain);
      gain.connect(ctx.destination);
      sine.start(t); tri.start(t);
      sine.stop(t + dur + 0.01); tri.stop(t + dur + 0.01);
    });

    // Phase 3: 마지막 큰 메이저 코드 (긴 잔향)
    const finalChord = [523.25, 659.25, 783.99, 1046.5];   // C-E-G-C
    finalChord.forEach((freq, i) => {
      const t = now + 0.68;
      const dur = 0.55;
      const sine = ctx.createOscillator();
      sine.type = 'sine'; sine.frequency.value = freq;
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth'; saw.frequency.value = freq;
      const sawG = ctx.createGain(); sawG.gain.value = 0.15;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 3500; lpf.Q.value = 1;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOL * (0.85 - i * 0.08), t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      sine.connect(lpf); saw.connect(sawG); sawG.connect(lpf);
      lpf.connect(gain); gain.connect(ctx.destination);
      sine.start(t); saw.start(t);
      sine.stop(t + dur + 0.02); saw.stop(t + dur + 0.02);
    });

    // Phase 4: 마지막 sparkle 한 톤 (옥타브 더 위)
    [2093, 2637].forEach((freq, i) => {
      const t = now + 0.95 + i * 0.06;
      const dur = 0.45;
      const sine = ctx.createOscillator();
      sine.type = 'sine'; sine.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOL * 0.45, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      sine.connect(gain); gain.connect(ctx.destination);
      sine.start(t); sine.stop(t + dur + 0.02);
    });
  } catch (err) {
    console.warn('[playCelebration] failed:', err);
  }
}

// 🦆 꽥꽥 — 실제 오리 mp3 파일 재생 (assets/audio/quack.mp3)
// 연타 시 currentTime=0으로 재시작
export function playQuack() {
  try {
    const audio = getQuackAudio();
    if (!audio) return;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && p.catch) p.catch((e) => console.warn('quack play blocked:', e));
  } catch (err) {
    console.warn('[playQuack] failed:', err);
  }
}
