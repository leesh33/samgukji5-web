/* 16비트 풍 Web Audio 효과음 — 음소거 토글 지원 */
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('samguk5.muted') === '1'; } catch (e) { muted = false; }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.08, type = 'square', vol = 0.05, when = 0, slideTo = null) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + when;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur = 0.12, vol = 0.06, when = 0) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + when;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = vol;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1200;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(t0);
}

export const sfx = {
  click() { tone(880, 0.04, 'square', 0.035); },
  select() { tone(660, 0.05, 'square', 0.04); tone(990, 0.05, 'square', 0.03, 0.05); },
  ok() { tone(523, 0.07, 'square', 0.045); tone(784, 0.09, 'square', 0.045, 0.07); },
  fail() { tone(220, 0.12, 'sawtooth', 0.045, 0, 140); },
  march() { noise(0.18, 0.05); tone(140, 0.14, 'triangle', 0.05, 0.02, 90); },
  hit() { noise(0.1, 0.08); tone(180, 0.07, 'square', 0.05, 0, 90); },
  tactic() { tone(740, 0.1, 'triangle', 0.05, 0, 1400); tone(1100, 0.1, 'square', 0.03, 0.08); },
  duel() { tone(330, 0.1, 'square', 0.06); tone(440, 0.1, 'square', 0.06, 0.1); tone(590, 0.14, 'square', 0.06, 0.2); },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.05, i * 0.09)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.12)); },
  turn() { tone(440, 0.06, 'square', 0.04); tone(554, 0.06, 'square', 0.04, 0.06); tone(659, 0.1, 'square', 0.04, 0.12); },
  coin() { tone(1046, 0.05, 'square', 0.04); tone(1318, 0.08, 'square', 0.04, 0.05); },
  drum() { noise(0.22, 0.09); tone(90, 0.2, 'triangle', 0.07, 0, 60); },
  battle() { [0, 0.12, 0.24].forEach((w, i) => { noise(0.1, 0.07, w); tone(200 + i * 40, 0.1, 'square', 0.05, w, 120); }); },
  mute(v) {
    muted = v;
    try { localStorage.setItem('samguk5.muted', v ? '1' : '0'); } catch (e) { /* noop */ }
    if (!v) sfx.click();
  },
  isMuted: () => muted,
  unlock() { ac(); },
};
