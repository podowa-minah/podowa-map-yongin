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
