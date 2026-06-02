// src/utils/sounds.js
// 효과음 — Web Audio API 즉석 합성 (외부 파일 0KB)

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

// 🎉 정답! "ta-da!" — 메이저 코드 버스트 + 옥타브 스파클 (게임 정답 느낌)
// 약 0.4초, 밝고 신남
export function playSuccess() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const VOL = 0.4;

    // 1) "ta!" — C-E-G 메이저 트라이어드를 한 번에 짧게 (브라스/벨 톤)
    const chord1 = [523.25, 659.25, 783.99];  // C5, E5, G5
    chord1.forEach((freq) => {
      const t = now;
      const dur = 0.12;
      // 톱니 + 사인 — 풍부한 브라스 톤
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth'; saw.frequency.value = freq;
      const sine = ctx.createOscillator();
      sine.type = 'sine'; sine.frequency.value = freq;

      // 필터로 부드럽게
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass'; lpf.frequency.value = 4500; lpf.Q.value = 1.5;

      const sawG = ctx.createGain(); sawG.gain.value = 0.25;
      const sineG = ctx.createGain(); sineG.gain.value = 0.45;

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

    // 2) "da~!" — 한 옥타브 위 메이저 트라이어드, 살짝 늦게, 더 길게 (sparkle)
    const chord2 = [1046.5, 1318.5, 1568];     // C6, E6, G6
    chord2.forEach((freq, i) => {
      const t = now + 0.10;
      const dur = 0.32;

      const sine = ctx.createOscillator();
      sine.type = 'sine'; sine.frequency.value = freq;
      // 살짝 비브라토
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6;
      const lfoG = ctx.createGain(); lfoG.gain.value = 4;
      lfo.connect(lfoG); lfoG.connect(sine.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(VOL * (0.7 - i * 0.1), t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      sine.connect(gain); gain.connect(ctx.destination);
      sine.start(t); lfo.start(t);
      sine.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
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

// 🦆 꽥꽥 — 노이즈 어택 + 다중 oscillator + 빠른 AM/FM modulation으로 진짜 오리에 가깝게
// 볼륨 최대 (0.85, 거의 클립 직전)
export function playQuack() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const MASTER_VOLUME = 0.85;     // 최대 볼륨

    // "꽥꽥꽥" 세 번 (자연스러운 트리플)
    [0, 0.18, 0.36].forEach((delay, i) => {
      const t = now + delay;
      const dur = 0.16 + (i === 2 ? 0.06 : 0);   // 마지막 꽥은 살짝 김

      // 1) 노이즈 어택 — 오리 부리에서 나는 "직" 같은 충돌음
      const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.025), ctx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let n = 0; n < noiseData.length; n++) noiseData[n] = (Math.random() - 0.5) * 0.9;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1500;
      noiseFilter.Q.value = 1.5;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(MASTER_VOLUME * 0.4, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(ctx.destination);
      noise.start(t);

      // 2) 메인 sawtooth — 음역대 sweep
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(950, t);
      osc1.frequency.exponentialRampToValueAtTime(380, t + dur);

      // 3) 하모닉 추가 (square, 한 옥타브 위)
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1900, t);
      osc2.frequency.exponentialRampToValueAtTime(760, t + dur);

      // 4) FM 모듈레이션 — "꽉꽉" 같은 진동
      const fm = ctx.createOscillator();
      fm.frequency.value = 35;
      const fmGain = ctx.createGain();
      fmGain.gain.value = 100;
      fm.connect(fmGain); fmGain.connect(osc1.frequency); fmGain.connect(osc2.frequency);

      // 5) 로우패스 필터 — 부리 같은 톤
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(2200, t);
      lpf.frequency.exponentialRampToValueAtTime(900, t + dur);
      lpf.Q.value = 4;

      // 6) 볼륨 envelope — 빠른 어택, 부드러운 디케이
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(MASTER_VOLUME, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(MASTER_VOLUME * 0.4, t + dur * 0.5);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      // 7) 약간의 sub-mix
      const sub2Gain = ctx.createGain();
      sub2Gain.gain.value = 0.35;       // square는 살짝 작게

      osc1.connect(lpf);
      osc2.connect(sub2Gain); sub2Gain.connect(lpf);
      lpf.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t); osc2.start(t); fm.start(t);
      osc1.stop(t + dur + 0.02);
      osc2.stop(t + dur + 0.02);
      fm.stop(t + dur + 0.02);
    });
  } catch (err) {
    console.warn('[playQuack] failed:', err);
  }
}
