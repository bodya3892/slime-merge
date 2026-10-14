// Звуки синтезируются на лету через WebAudio, файлов не нужно.
var Sound = {
  ctx: null,
  on: true,      // настройка игрока
  muted: false,  // система: реклама, свёрнутая вкладка

  init: function () {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    }
    this.apply();
  },

  apply: function () {
    if (!this.ctx) return;
    if (this.on && !this.muted) this.ctx.resume();
    else this.ctx.suspend();
  },

  setMuted: function (m) { this.muted = m; this.apply(); },
  setOn: function (v) { this.on = v; this.apply(); },

  tone: function (freq, dur, type, vol, slide) {
    if (!this.ctx || !this.on || this.muted) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },

  drop: function () { this.tone(260, 0.12, 'triangle', 0.15, 0.6); },
  merge: function (lvl) {
    var f = 280 * Math.pow(1.13, lvl);
    this.tone(f, 0.2, 'sine', 0.25, 1.8);
    this.tone(f * 1.5, 0.14, 'triangle', 0.08, 1.5);
  },
  click: function () { this.tone(600, 0.06, 'square', 0.06); },
  clean: function () { this.tone(900, 0.4, 'sawtooth', 0.08, 0.2); },
  over: function () {
    var self = this;
    [440, 370, 311, 220].forEach(function (f, i) {
      setTimeout(function () { self.tone(f, 0.25, 'triangle', 0.18); }, i * 160);
    });
  }
};
