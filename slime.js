// Уровни слаймов и их отрисовка. Общий файл для игры и для promo.html.
var LEVELS = [
  { r: 15,  c1: '#ffc2e2', c2: '#ec5fa4' },
  { r: 20,  c1: '#ffe39a', c2: '#f2a51f' },
  { r: 26,  c1: '#c4f7a0', c2: '#4cb82e' },
  { r: 33,  c1: '#a9efff', c2: '#2aa3dc' },
  { r: 41,  c1: '#d3c4ff', c2: '#7350e6' },
  { r: 50,  c1: '#ffb3a8', c2: '#e2452f' },
  { r: 60,  c1: '#ffd2a1', c2: '#e8721a' },
  { r: 71,  c1: '#a8ffe4', c2: '#19b98b' },
  { r: 83,  c1: '#ffc4f6', c2: '#c43dc0' },
  { r: 96,  c1: '#fff6c4', c2: '#e3b400' },
  { r: 110, c1: '#ffffff', c2: '#8fa6ff' }
];
var MAX_LEVEL = LEVELS.length - 1;

function drawSlime(ctx, x, y, r, lvl, ang, blink, alpha) {
  var L = LEVELS[lvl];
  var ink = '#2a1640';
  ctx.save();
  ctx.translate(x, y);
  if (alpha !== undefined) ctx.globalAlpha = alpha;

  // тело
  var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, L.c1);
  g.addColorStop(1, L.c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.strokeStyle = 'rgba(42,22,64,0.35)';
  ctx.stroke();

  // мордочка (крутится вместе со слаймом)
  ctx.save();
  ctx.rotate(ang || 0);
  var ex = r * 0.33, ey = -r * 0.08, er = r * 0.2;
  var s, i;
  if (blink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.lineCap = 'round';
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(s * ex - er * 0.8, ey);
      ctx.quadraticCurveTo(s * ex, ey + er * 0.6, s * ex + er * 0.8, ey);
      ctx.stroke();
    }
  } else {
    for (i = 0; i < 2; i++) {
      s = i ? 1 : -1;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s * ex, ey, er, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(s * ex + er * 0.12, ey + er * 0.2, er * 0.58, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s * ex + er * 0.32, ey - er * 0.02, er * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  // румянец
  ctx.fillStyle = 'rgba(255,80,140,0.35)';
  for (i = 0; i < 2; i++) {
    s = i ? 1 : -1;
    ctx.beginPath(); ctx.ellipse(s * r * 0.58, r * 0.2, r * 0.14, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  }
  // рот: три разных вида по уровню
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(1.2, r * 0.06);
  ctx.lineCap = 'round';
  var my = r * 0.28, m = lvl % 3;
  ctx.beginPath();
  if (m === 0) {
    ctx.arc(0, my - r * 0.1, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (m === 1) {
    ctx.ellipse(0, my, r * 0.08, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(-r * 0.16, my - r * 0.04);
    ctx.quadraticCurveTo(-r * 0.08, my + r * 0.08, 0, my - r * 0.02);
    ctx.quadraticCurveTo(r * 0.08, my + r * 0.08, r * 0.16, my - r * 0.04);
    ctx.stroke();
  }
  ctx.restore();

  // блик
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, -r * 0.5, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();

  // корона у короля слаймов
  if (lvl === MAX_LEVEL) {
    var cw = r * 0.7, ch = r * 0.38, cy = -r * 0.82;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = r * 0.04;
    ctx.beginPath();
    ctx.moveTo(-cw / 2, cy);
    ctx.lineTo(-cw / 2, cy - ch);
    ctx.lineTo(-cw / 4, cy - ch * 0.55);
    ctx.lineTo(0, cy - ch * 1.1);
    ctx.lineTo(cw / 4, cy - ch * 0.55);
    ctx.lineTo(cw / 2, cy - ch);
    ctx.lineTo(cw / 2, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
