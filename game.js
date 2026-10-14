(function () {
  'use strict';

  // Логические размеры поля; на экране всё масштабируется
  var W = 420, H = 700;
  var LEFT = 20, RIGHT = 400, FLOOR = 650, TOP = 125;
  var DROP_Y = 100, DANGER_Y = 150;
  var GRAVITY = 1700, SUBSTEPS = 8, ITER = 3;
  var DROP_COOLDOWN = 0.45, DANGER_TIME = 2.5;
  var BOUNCE = 0.5, BOUNCE_MIN_SPEED = 150;

  var TEXTS = {
    ru: {
      title: 'Слаймы: Слияние', play: 'Играть', score: 'Очки', best: 'Рекорд', next: 'Далее',
      hint: 'Бросай слаймов и соединяй одинаковых — они сливаются в больших! Не дай им переползти красную линию.',
      over: 'Игра окончена', restart: 'Заново', contAd: 'Продолжить', paused: 'Пауза', resume: 'Продолжить',
      newBest: 'Новый рекорд!', combo: 'Комбо', clean: 'Убрать мелких слаймов (реклама)', danger: 'Опасно!',
      noAd: 'Реклама пока недоступна, попробуй позже'
    },
    en: {
      title: 'Slime Merge', play: 'Play', score: 'Score', best: 'Best', next: 'Next',
      hint: 'Drop slimes and match the same ones — they merge into bigger slimes! Keep them below the red line.',
      over: 'Game Over', restart: 'Restart', contAd: 'Continue', paused: 'Paused', resume: 'Resume',
      newBest: 'New record!', combo: 'Combo', clean: 'Remove small slimes (ad)', danger: 'Danger!',
      noAd: 'Ad is not available yet, try again later'
    }
  };
  var tr = TEXTS.ru;

  var $ = function (id) { return document.getElementById(id); };
  var wrap = $('wrap'), canvas = $('c'), ctx = canvas.getContext('2d');
  var nctx = $('nextc').getContext('2d');

  var state = 'loading'; // menu | play | pause | over | ad
  var bodies = [], merges = [], particles = [], texts = [];
  var score = 0, best = 0, maxReached = 0, continued = false;
  var held = null, nextLvl = 0, cooldown = 0, aimX = W / 2;
  var combo = 0, comboTimer = 0, shake = 0, time = 0, dangerFlash = 0;
  var keys = { left: false, right: false };
  var uid = 0;

  // ---------- утилиты ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function rndLevel() {
    var w = [30, 26, 20, 14, 10], s = Math.random() * 100;
    for (var i = 0; i < w.length; i++) { s -= w[i]; if (s < 0) return i; }
    return 0;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function makeBody(x, y, lvl, grow) {
    var r = LEVELS[lvl].r;
    return {
      id: uid++, x: x, y: y, px: x, py: y, vx: 0, vy: 0, lvl: lvl,
      r: grow ? LEVELS[Math.max(0, lvl - 1)].r : r, tr: r, im: 1 / (r * r),
      ang: 0, age: 0, danger: 0, merging: false, dead: false,
      ivx: 0, ivy: 0, hitFloor: false, hitWall: false, sq: 0, sqv: 0,
      blinkT: 1 + Math.random() * 4, blink: 0
    };
  }

  // ---------- физика ----------
  function solve() {
    var n = bodies.length, i, j, a, b;
    for (i = 0; i < n; i++) {
      a = bodies[i];
      for (j = i + 1; j < n; j++) {
        b = bodies[j];
        var dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        var d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        if (a.lvl === b.lvl && !a.merging && !b.merging) {
          a.merging = b.merging = true;
          merges.push([a, b]);
          continue;
        }
        if (a.merging && b.merging && a.lvl === b.lvl) continue;
        var d = Math.sqrt(d2) || 0.01;
        var nx = dx / d, ny = dy / d, over = rr - d;
        var sum = a.im + b.im, wa = a.im / sum, wb = b.im / sum;
        a.x -= nx * over * wa; a.y -= ny * over * wa;
        b.x += nx * over * wb; b.y += ny * over * wb;
      }
    }
    for (i = 0; i < n; i++) {
      a = bodies[i];
      if (a.x - a.r < LEFT) { a.x = LEFT + a.r; a.hitWall = true; }
      else if (a.x + a.r > RIGHT) { a.x = RIGHT - a.r; a.hitWall = true; }
      if (a.y + a.r > FLOOR) { a.y = FLOOR - a.r; a.hitFloor = true; }
    }
  }

  function physics(dt) {
    var h = dt / SUBSTEPS, i, b;
    for (var s = 0; s < SUBSTEPS; s++) {
      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        b.px = b.x; b.py = b.y;
        b.vy += GRAVITY * h;
        b.ivx = b.vx; b.ivy = b.vy;
        b.hitFloor = b.hitWall = false;
        b.x += b.vx * h; b.y += b.vy * h;
      }
      for (var k = 0; k < ITER; k++) solve();
      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        var vx = (b.x - b.px) / h, vy = (b.y - b.py) / h;
        if (b.y + b.r >= FLOOR - 0.5) vx *= 0.96;
        // упругий отскок от пола и стенок (медленные касания гасятся, чтобы лежащие не дрожали)
        if (b.hitFloor && b.ivy > BOUNCE_MIN_SPEED) {
          vy = -b.ivy * BOUNCE;
          squish(b, Math.min(0.28, b.ivy / 3500));
        }
        else if (b.ivy - vy > 400) {
          squish(b, Math.min(0.2, (b.ivy - vy) / 5000)); // приземлился на другого слайма
        }
        if (b.hitWall && Math.abs(b.ivx) > BOUNCE_MIN_SPEED) {
          vx = -b.ivx * BOUNCE;
        }
        var sp = Math.sqrt(vx * vx + vy * vy);
        if (sp > 1400) { vx *= 1400 / sp; vy *= 1400 / sp; }
        b.vx = vx * 0.999; b.vy = vy * 0.999;
        b.ang += vx * h / b.r;
      }
      if (merges.length) processMerges();
    }
  }

  // Желейное сплющивание: sq > 0 — приплюснут, sq < 0 — вытянут; дальше качается на пружинке
  function squish(b, amount) {
    if (amount > b.sq) b.sq = amount;
  }

  function wobble(b, dt) {
    b.sqv += (-420 * b.sq - 9 * b.sqv) * dt;
    b.sq = clamp(b.sq + b.sqv * dt, -0.3, 0.3);
  }

  function processMerges() {
    var born = [];
    for (var i = 0; i < merges.length; i++) {
      var a = merges[i][0], b = merges[i][1];
      if (a.dead || b.dead) continue;
      a.dead = b.dead = true;
      var x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, lvl = a.lvl, pts;
      combo = comboTimer > 0 ? combo + 1 : 1;
      comboTimer = 0.9;
      var mult = Math.min(combo, 5);
      if (lvl === MAX_LEVEL) {
        pts = 200 * mult;
        burst(x, y, lvl, 70);
        shake = 14;
        Sound.merge(lvl + 2);
      } else {
        var nb = makeBody(x, y, lvl + 1, true);
        nb.vx = (a.vx + b.vx) / 2; nb.vy = (a.vy + b.vy) / 2;
        nb.ang = (a.ang + b.ang) / 2;
        nb.age = 1;
        nb.sq = -0.18; // новорождённый «выпрыгивает» вверх
        born.push(nb);
        pts = ((lvl + 2) * (lvl + 3) / 2) * mult;
        if (lvl + 1 > maxReached) maxReached = lvl + 1;
        burst(x, y, lvl + 1, 12 + lvl * 3);
        shake = Math.max(shake, lvl * 0.9);
        Sound.merge(lvl + 1);
      }
      addScore(pts);
      texts.push({ x: x, y: y, text: '+' + pts, life: 1 });
    }
    merges.length = 0;
    bodies = bodies.filter(function (o) { return !o.dead; }).concat(born);
  }

  // ---------- эффекты ----------
  function burst(x, y, lvl, n) {
    var c = LEVELS[Math.min(lvl, MAX_LEVEL)].c2;
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2, s = 80 + Math.random() * 260;
      particles.push({ x: x, y: y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s - 60,
        life: 0.5 + Math.random() * 0.4, r: 2 + Math.random() * 4, c: Math.random() < 0.3 ? '#fff' : c });
    }
  }

  function addScore(p) {
    score += p;
    $('score').textContent = score;
    if (score > best) { best = score; $('best').textContent = best; }
  }

  // ---------- игровой цикл ----------
  function spawnHeld() {
    held = { lvl: nextLvl };
    nextLvl = rndLevel();
    drawNext();
  }

  function drop() {
    if (state !== 'play' || !held) return;
    var r = LEVELS[held.lvl].r;
    var b = makeBody(clamp(aimX, LEFT + r, RIGHT - r), DROP_Y, held.lvl, false);
    bodies.push(b);
    held = null;
    cooldown = DROP_COOLDOWN;
    Sound.drop();
  }

  function update(dt) {
    time += dt;
    if (keys.left) aimX -= 320 * dt;
    if (keys.right) aimX += 320 * dt;
    aimX = clamp(aimX, LEFT, RIGHT);

    if (!held) { cooldown -= dt; if (cooldown <= 0) spawnHeld(); }
    physics(dt);

    var anyDanger = false;
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      b.age += dt;
      if (b.r < b.tr) b.r = Math.min(b.tr, b.r + b.tr * dt * 4);
      wobble(b, dt);
      b.blinkT -= dt;
      if (b.blinkT < 0) { b.blink = 0.12; b.blinkT = 2 + Math.random() * 5; }
      if (b.blink > 0) b.blink -= dt;
      if (b.age > 1 && b.y - b.r < DANGER_Y) {
        b.danger += dt;
        if (b.danger > 0.4) anyDanger = true;
        if (b.danger > DANGER_TIME) { gameOver(); return; }
      } else b.danger = 0;
    }
    dangerFlash = anyDanger ? dangerFlash + dt : 0;
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 0;
  }

  function updateFx(dt) {
    var i, p;
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (i = texts.length - 1; i >= 0; i--) {
      p = texts[i];
      p.y -= 40 * dt; p.life -= dt;
      if (p.life <= 0) texts.splice(i, 1);
    }
    shake *= Math.pow(0.02, dt);
  }

  // ---------- отрисовка ----------
  function render() {
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);

    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2b1b5a');
    g.addColorStop(1, '#6e3a9a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // фоновые пузыри
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var k = 0; k < 9; k++) {
      var bx = (k * 97 + 30) % W, by = H - ((time * (12 + k * 3) + k * 140) % (H + 80)) + 40;
      ctx.beginPath(); ctx.arc(bx, by, 8 + (k % 4) * 7, 0, Math.PI * 2); ctx.fill();
    }

    ctx.save();
    if (shake > 0.3) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // банка
    roundRect(ctx, LEFT - 6, TOP, RIGHT - LEFT + 12, FLOOR - TOP + 6, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();

    // красная линия
    var flash = dangerFlash > 0 ? 0.5 + 0.5 * Math.sin(time * 14) : 0;
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,70,90,' + (0.35 + flash * 0.65) + ')';
    ctx.beginPath(); ctx.moveTo(LEFT, DANGER_Y); ctx.lineTo(RIGHT, DANGER_Y); ctx.stroke();
    ctx.setLineDash([]);

    // слайм в руке и направляющая
    if (held && (state === 'play' || state === 'pause')) {
      var hr = LEVELS[held.lvl].r, hx = clamp(aimX, LEFT + hr, RIGHT - hr);
      ctx.setLineDash([4, 10]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.moveTo(hx, DROP_Y + hr); ctx.lineTo(hx, FLOOR); ctx.stroke();
      ctx.setLineDash([]);
      drawSlime(ctx, hx, DROP_Y, hr, held.lvl, 0, false);
    }

    // слаймы
    for (var i = 0; i < bodies.length; i++) {
      var b = bodies[i];
      if (Math.abs(b.sq) > 0.005) {
        // сплющиваем относительно нижней точки, чтобы слайм не отрывался от опоры
        ctx.save();
        ctx.translate(b.x, b.y + b.r);
        ctx.scale(1 + b.sq, 1 - b.sq);
        drawSlime(ctx, 0, -b.r, b.r, b.lvl, b.ang, b.blink > 0);
        ctx.restore();
      } else {
        drawSlime(ctx, b.x, b.y, b.r, b.lvl, b.ang, b.blink > 0);
      }
      if (b.danger > 0.4) {
        ctx.strokeStyle = 'rgba(255,60,80,' + (0.4 + 0.4 * Math.sin(time * 14)) + ')';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // частицы
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life * 1.6);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // всплывающие очки
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Trebuchet MS, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(42,22,64,0.8)';
    for (i = 0; i < texts.length; i++) {
      var t = texts[i];
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(42,22,64,0.8)';

    // комбо
    if (combo >= 2 && comboTimer > 0) {
      ctx.globalAlpha = Math.min(1, comboTimer * 2);
      ctx.font = 'bold 34px Trebuchet MS, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeText(tr.combo + ' x' + Math.min(combo, 5) + '!', W / 2, 260);
      ctx.fillStyle = '#ffe066';
      ctx.fillText(tr.combo + ' x' + Math.min(combo, 5) + '!', W / 2, 260);
      ctx.globalAlpha = 1;
    }
    if (dangerFlash > 0 && state === 'play') {
      ctx.font = 'bold 18px Trebuchet MS, sans-serif';
      ctx.fillStyle = 'rgba(255,90,110,' + (0.5 + flash * 0.5) + ')';
      ctx.fillText(tr.danger, W / 2, DANGER_Y - 8);
    }

    // цепочка эволюции внизу
    for (var l = 0; l <= MAX_LEVEL; l++) {
      var ex = 30 + l * 36, ey = 676;
      if (l <= maxReached) drawSlime(ctx, ex, ey, 13, l, 0, false);
      else {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(ex, ey, 13, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = 'bold 14px Trebuchet MS, sans-serif';
        ctx.fillText('?', ex, ey + 5);
      }
    }
  }

  function drawNext() {
    var c = nctx.canvas;
    nctx.clearRect(0, 0, c.width, c.height);
    drawSlime(nctx, c.width / 2, c.height / 2, 14 + nextLvl * 5.5, nextLvl, 0, false);
  }

  function drawLogo() {
    var lc = $('logo').getContext('2d');
    lc.clearRect(0, 0, 600, 280);
    var row = [[90, 180, 50, 2], [210, 160, 70, 5], [360, 150, 85, 7], [500, 185, 55, 3], [300, 235, 30, 0]];
    row.forEach(function (s) { drawSlime(lc, s[0], s[1], s[2], s[3], 0, false); });
  }

  var last = 0;
  function loop(now) {
    var dt = Math.min((now - last) / 1000 || 0, 1 / 30);
    last = now;
    if (state === 'play') update(dt);
    if (state !== 'pause' && state !== 'ad') updateFx(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ---------- состояния ----------
  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  function saveProgress() {
    Platform.save({ best: best, sound: Sound.on });
  }

  function startGame() {
    bodies = []; merges = []; particles = []; texts = [];
    score = 0; maxReached = 0; continued = false; combo = 0; comboTimer = 0; shake = 0;
    $('score').textContent = '0';
    nextLvl = rndLevel();
    spawnHeld();
    cooldown = 0;
    show('menu', false); show('over', false); show('pause', false);
    state = 'play';
    Sound.init();
    Platform.gameplay(true);
  }

  function gameOver() {
    state = 'over';
    Platform.gameplay(false);
    Sound.over();
    var isRecord = score >= best && score > 0;
    saveProgress();
    Platform.leaderboard(best);
    $('finalScore').textContent = score;
    show('newBest', isRecord);
    show('bContinue', !continued);
    show('over', true);
  }

  function setPause(on) {
    if (on && state === 'play') {
      state = 'pause';
      Platform.gameplay(false);
      show('pause', true);
    } else if (!on && state === 'pause') {
      state = 'play';
      show('pause', false);
      Platform.gameplay(true);
    }
  }

  function cleanSmall(maxLvl, alsoTop) {
    var removed = 0;
    bodies.forEach(function (b) {
      if (b.lvl <= maxLvl || (alsoTop && b.y - b.r < DANGER_Y + 40)) {
        b.dead = true; removed++;
        burst(b.x, b.y, b.lvl, 8);
      }
      b.danger = 0;
    });
    bodies = bodies.filter(function (b) { return !b.dead; });
    if (removed) { Sound.clean(); shake = 8; }
  }

  function withRewarded(onReward) {
    var prev = state;
    state = 'ad';
    Platform.gameplay(false);
    Platform.rewarded().then(function (ok) {
      state = prev;
      if (ok) onReward();
      else toast(tr.noAd + (Platform.debug && Platform.adError ? '\n' + Platform.adError : ''));
      if (state === 'play') Platform.gameplay(true);
    });
  }

  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.add('hidden'); }, Platform.debug ? 8000 : 2500);
  }

  // ---------- ввод ----------
  function toLocalX(clientX) {
    var rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) / rect.width * W;
  }
  var pressed = false;
  canvas.addEventListener('pointerdown', function (e) {
    Sound.init();
    pressed = true;
    aimX = toLocalX(e.clientX);
  });
  canvas.addEventListener('pointermove', function (e) { aimX = toLocalX(e.clientX); });
  window.addEventListener('pointerup', function () {
    if (pressed) { pressed = false; drop(); }
  });
  window.addEventListener('pointercancel', function () { pressed = false; });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    else if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'KeyS') { if (!e.repeat) drop(); }
    else if (e.code === 'Escape' || e.code === 'KeyP') setPause(state === 'play');
    else return;
    e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function onBtn(id, fn) {
    $(id).addEventListener('click', function (e) { e.stopPropagation(); Sound.init(); Sound.click(); fn(); });
  }
  onBtn('bPlay', startGame);
  onBtn('bPause', function () { setPause(state === 'play'); });
  onBtn('bResume', function () { setPause(false); });
  onBtn('bRestart2', function () { show('pause', false); startGame(); });
  onBtn('bSound', function () {
    Sound.setOn(!Sound.on);
    $('bSound').textContent = Sound.on ? '🔊' : '🔇';
    saveProgress();
  });
  onBtn('bClean', function () {
    if (state !== 'play') return;
    withRewarded(function () { cleanSmall(2, false); });
  });
  onBtn('bContinue', function () {
    if (state !== 'over' || continued) return;
    withRewarded(function () {
      continued = true;
      cleanSmall(3, true);
      show('over', false);
      state = 'play';
    });
  });
  onBtn('bRestart', function () {
    state = 'ad';
    Platform.fullscreen().then(startGame);
  });

  // пауза и тишина, когда вкладка скрыта или идёт реклама
  var inAd = false;
  Platform.onAdStart = function () { inAd = true; Sound.setMuted(true); };
  Platform.onAdEnd = function () { inAd = false; Sound.setMuted(document.hidden); };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { Sound.setMuted(true); setPause(true); }
    else if (!inAd) Sound.setMuted(false);
  });

  // ---------- размеры ----------
  function resize() {
    var scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    var cw = Math.floor(W * scale), ch = Math.floor(H * scale);
    wrap.style.width = cw + 'px';
    wrap.style.height = ch + 'px';
    wrap.style.setProperty('--s', scale);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // отладка только при локальном запуске
  if (location.hostname === 'localhost') {
    window.__game = {
      start: startGame, update: update, drop: drop,
      aim: function (x) { aimX = x; },
      list: function () { return bodies.map(function (b) { return { y: Math.round(b.y + b.r), sq: +b.sq.toFixed(2) }; }); },
      info: function () { return { state: state, bodies: bodies.length, score: score, maxReached: maxReached, held: !!held }; }
    };
  }

  // ---------- запуск ----------
  function applyTexts() {
    document.querySelectorAll('[data-i]').forEach(function (el) { el.textContent = tr[el.dataset.i]; });
    document.querySelectorAll('[data-t]').forEach(function (el) { el.title = tr[el.dataset.t]; });
    document.title = tr.title;
    document.documentElement.lang = tr === TEXTS.ru ? 'ru' : 'en';
  }

  Platform.init().then(function () {
    var ruLike = ['ru', 'be', 'kk', 'uk', 'uz'];
    tr = ruLike.indexOf(Platform.lang) >= 0 ? TEXTS.ru : TEXTS.en;
    applyTexts();
    return Platform.load();
  }).then(function (data) {
    best = data.best || 0;
    Sound.on = data.sound !== false;
    $('bSound').textContent = Sound.on ? '🔊' : '🔇';
    $('best').textContent = best;
    $('menuBest').textContent = best;
    nextLvl = 0;
    drawNext();
    drawLogo();
    state = 'menu';
    Platform.ready();
    requestAnimationFrame(loop);
  });
})();
