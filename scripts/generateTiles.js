const fs = require('fs');
const path = require('path');

const W = 64, H = 88, R = 6;
const BG = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fffff8"/><stop offset="100%" stop-color="#f0ead0"/></linearGradient></defs><rect width="${W}" height="${H}" rx="${R}" fill="url(#bg)" stroke="#b8b098" stroke-width="1.5"/>`;

function wrap(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${content}</svg>`;
}

const CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function wanTile(v) {
  return wrap(`${BG}<text x="${W/2}" y="36" text-anchor="middle" font-size="28" font-weight="900" fill="#b71c1c" font-family="SimHei,STHeiti,PingFang SC,Microsoft YaHei,sans-serif">${CN[v]}</text><text x="${W/2}" y="70" text-anchor="middle" font-size="22" font-weight="900" fill="#b71c1c" font-family="SimHei,STHeiti,PingFang SC,Microsoft YaHei,sans-serif">万</text>`);
}

const DOT_LAYOUTS = {
  1: [[32]],
  2: [[22],[42]],
  3: [[18],[32],[46]],
  4: [[22,42],[22,42]],
  5: [[22,42],[32],[22,42]],
  6: [[22,42],[22,42],[22,42]],
  7: [[18,32,46],[32],[18,32,46]],
  8: [[18,32,46],[18,32,46]],
  9: [[18,32,46],[18,32,46],[18,32,46]]
};
const DOT_Y_START = { 1: [44], 2: [28,60], 3: [20,44,68], 4: [28,60], 5: [22,44,66], 6: [20,44,68], 7: [20,44,68], 8: [20,52], 9: [20,44,68] };
const DOT_R = 6;

function tongDot(cx, cy) {
  return `<circle cx="${cx}" cy="${cy}" r="${DOT_R}" fill="#1565c0"/><circle cx="${cx-1.5}" cy="${cy-1.5}" r="${DOT_R*0.35}" fill="#42a5f5" opacity="0.6"/>`;
}

function tongTile(v) {
  const layout = DOT_LAYOUTS[v];
  const yRows = DOT_Y_START[v];
  let dots = '';
  for (let r = 0; r < layout.length; r++) {
    const xs = layout[r];
    const y = yRows[r];
    for (const x of xs) dots += tongDot(x, y);
  }
  return wrap(`${BG}${dots}<text x="${W/2}" y="${H-6}" text-anchor="middle" font-size="11" font-weight="700" fill="#0d47a1" font-family="SimHei,STHeiti,PingFang SC,Microsoft YaHei,sans-serif">筒</text>`);
}

function bambooStick(cx, cy, h) {
  return `<rect x="${cx-3}" y="${cy-h/2}" width="6" height="${h}" rx="2" fill="#2e7d32"/><rect x="${cx-2}" y="${cy-h/2}" width="2" height="${h}" rx="1" fill="#43a047" opacity="0.5"/>`;
}

const BAM_LAYOUTS = {
  1: [[32]],
  2: [[22, 42]],
  3: [[18, 32, 46]],
  4: [[22, 42], [22, 42]],
  5: [[22, 42], [32], [22, 42]],
  6: [[22, 42], [22, 42], [22, 42]],
  7: [[18, 32, 46], [32], [18, 32, 46]],
  8: [[18, 32, 46], [18, 32, 46]],
  9: [[18, 32, 46], [18, 32, 46], [18, 32, 46]]
};
const BAM_Y_START = { 1: [44], 2: [38, 50], 3: [32, 44, 56], 4: [28, 56], 5: [22, 44, 66], 6: [22, 44, 66], 7: [22, 44, 66], 8: [26, 54], 9: [22, 44, 66] };

function tiaoTile(v) {
  const layout = BAM_LAYOUTS[v];
  const yRows = BAM_Y_START[v];
  let sticks = '';
  for (let r = 0; r < layout.length; r++) {
    const xs = layout[r];
    const y = yRows[r];
    for (const x of xs) sticks += bambooStick(x, y, 12);
  }
  return wrap(`${BG}${sticks}<text x="${W/2}" y="${H-4}" text-anchor="middle" font-size="11" font-weight="700" fill="#1b5e20" font-family="SimHei,STHeiti,PingFang SC,Microsoft YaHei,sans-serif">条</text>`);
}

function fengTile(v) {
  const chars = ['', '東', '南', '西', '北'];
  return wrap(`${BG}<text x="${W/2}" y="56" text-anchor="middle" font-size="36" font-weight="900" fill="#311b92" font-family="SimHei,STHeiti,PingFang SC,Microsoft YaHei,sans-serif">${chars[v]}</text>`);
}

function jianTile(v) {
  if (v === 1) return wrap(`${BG}<rect x="8" y="8" width="${W-16}" height="${H-16}" rx="4" fill="none" stroke="#b71c1c" stroke-width="2" stroke-dasharray="4,2"/><text x="${W/2}" y="58" text-anchor="middle" font-size="40" font-weight="900" fill="#b71c1c" font-family="SimHei,STHeiti,PingFang SC,Microsoft YaHei,sans-serif">中</text>`);
  if (v === 2) return wrap(`${BG}<rect x="8" y="8" width="${W-16}" height="${H-16}" rx="4" fill="none" stroke="#1b5e20" stroke-width="2"/><text x="${W/2}" y="58" text-anchor="middle" font-size="36" font-weight="900" fill="#1b5e20" font-family="SimHei,STHeiti,PingFang SC,Microsoft YaHei,sans-serif">發</text>`);
  return wrap(`${BG}<rect x="10" y="10" width="${W-20}" height="${H-20}" rx="4" fill="none" stroke="#546e7a" stroke-width="2.5"/><rect x="16" y="16" width="${W-32}" height="${H-32}" rx="2" fill="none" stroke="#546e7a" stroke-width="1.5"/>`);
}

const outDir = path.join(__dirname, '..', 'public', 'tiles');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const all = {};
for (let v = 1; v <= 9; v++) { all[`w${v}`] = wanTile(v); all[`t${v}`] = tongTile(v); all[`b${v}`] = tiaoTile(v); }
for (let v = 1; v <= 4; v++) all[`f${v}`] = fengTile(v);
for (let v = 1; v <= 3; v++) all[`d${v}`] = jianTile(v);

for (const [k, svg] of Object.entries(all)) {
  fs.writeFileSync(path.join(outDir, `${k}.svg`), svg);
}

console.log(`Generated ${Object.keys(all).length} tile SVGs in ${outDir}`);
