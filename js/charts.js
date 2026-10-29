// 의존성 없는 SVG 차트 (선·막대·스파크라인)
const NS = 'http://www.w3.org/2000/svg';

const el = (name, attrs = {}, text) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
};

const finite = (arr) => arr.filter((v) => v != null);

function pathOf(points) {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (p.y == null) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

// series: { values, cls } 배열. labels: x축 라벨. fmt: 값 포맷 함수
export function lineChart(host, { labels, series, fmt }) {
  const W = Math.max(host.clientWidth, 260); // 실제 폭으로 그려 글자 크기를 유지
  const H = 220;
  const m ={ top: 12, right: 12, bottom: 28, left: 56 };
  const all = series.flatMap((s) => finite(s.values));
  host.replaceChildren();
  if (!all.length) { host.textContent = '표시할 데이터가 없습니다.'; return; }

  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.1;
  lo -= pad; hi += pad;
  const x = (i) => m.left + (i * (W - m.left - m.right)) / Math.max(labels.length - 1, 1);
  const y = (v) => (v == null ? null : m.top + ((hi - v) / (hi - lo)) * (H - m.top - m.bottom));

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '분기별 추이 차트' });
  for (let t = 0; t <= 3; t += 1) {
    const v = lo + ((hi - lo) * t) / 3;
    const yy = y(v);
    svg.append(el('line', { class: 'grid', x1: m.left, x2: W - m.right, y1: yy, y2: yy }));
    svg.append(el('text', { x: m.left - 6, y: yy + 4, 'text-anchor': 'end' }, fmt(v)));
  }
  labels.forEach((l, i) => {
    if (labels.length > 8 && i % 2 === (labels.length - 1) % 2) return;
    svg.append(el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' }, l));
  });
  for (const s of series) {
    svg.append(el('path', { class: s.cls, d: pathOf(s.values.map((v, i) => ({ x: x(i), y: y(v) }))) }));
  }
  const main = series[0];
  const tip = el('g', { visibility: 'hidden', 'pointer-events': 'none' });
  const tipBg = el('rect', { class: 'tip-bg', rx: 6, height: 22 });
  const tipText = el('text', { class: 'tip-text', y: 15 });
  tip.append(tipBg, tipText);

  main.values.forEach((v, i) => {
    if (v == null) return;
    svg.append(el('circle', { class: 'dot', cx: x(i), cy: y(v), r: 3 }));
  });
  const step = (W - m.left - m.right) / Math.max(labels.length - 1, 1);
  labels.forEach((l, i) => {
    const hit = el('rect', { class: 'hit', x: x(i) - step / 2, y: 0, width: step, height: H });
    const show = () => {
      tipText.textContent = `${l}  ${main.values[i] == null ? '-' : fmt(main.values[i])}`;
      const w = tipText.getComputedTextLength() + 16;
      const tx = Math.min(Math.max(x(i) - w / 2, 0), W - w);
      tipBg.setAttribute('width', w);
      tipBg.setAttribute('x', tx);
      tipText.setAttribute('x', tx + 8);
      tip.setAttribute('transform', `translate(0,${m.top - 10})`);
      tip.setAttribute('visibility', 'visible');
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    svg.append(hit);
  });
  svg.addEventListener('pointerleave', () => tip.setAttribute('visibility', 'hidden'));
  svg.append(tip);
  host.append(svg);
}

// 가로 막대 순위. items: { name, value, active }
export function barChart(host, { items, fmt, onSelect }) {
  host.replaceChildren();
  const rows = items.filter((d) => d.value != null).sort((a, b) => b.value - a.value);
  if (!rows.length) { host.textContent = '표시할 데이터가 없습니다.'; return; }
  const W = Math.max(host.clientWidth, 260);
  const rowH = 30;
  const labelW = 96;
  const valueW = 64;
  const H = rows.length * rowH + 4;
  // 0을 기준선으로 두고 음수는 왼쪽으로 그립니다.
  const lo = Math.min(0, ...rows.map((d) => d.value));
  const hi = Math.max(0, ...rows.map((d) => d.value));
  const span = hi - lo || 1;
  const plotW = W - labelW - valueW * 2;
  const x0 = labelW + valueW + ((0 - lo) / span) * plotW;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '신탁사별 비교 막대 차트' });
  if (lo < 0) svg.append(el('line', { class: 'grid', x1: x0, x2: x0, y1: 0, y2: H }));
  rows.forEach((d, i) => {
    const yy = i * rowH + 2;
    const w = (Math.abs(d.value) / span) * plotW;
    const neg = d.value < 0;
    const cls = d.active ? ' active' : '';
    const row = el('g', { class: 'bar-row' });
    if (onSelect) {
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('data-code', d.code);
      row.setAttribute('aria-pressed', String(Boolean(d.active)));
      row.setAttribute('aria-label', `${d.name} ${fmt(d.value)} 선택`);
      row.addEventListener('click', () => onSelect(d.code));
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.code); }
      });
    }
    row.append(el('rect', { class: 'hit', x: 0, y: yy, width: W, height: rowH }));
    row.append(el('text', { class: `bar-label${cls}`, x: 0, y: yy + 18 }, d.name));
    row.append(el('rect', { class: `bar${cls}`, x: neg ? x0 - w : x0, y: yy + 4, width: Math.max(w, 1), height: rowH - 10, rx: 4 }));
    row.append(el('text', {
      class: `bar-label${cls}`, y: yy + 18, x: neg ? x0 - w - 6 : x0 + w + 6, 'text-anchor': neg ? 'end' : 'start',
    }, fmt(d.value)));
    svg.append(row);
  });
  host.append(svg);
}

// 카드용 미니 추이선
export function sparkline(values) {
  const W = 120;
  const H = 28;
  const vs = finite(values);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  if (vs.length < 2) return svg;
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => ({
    x: (i * W) / Math.max(values.length - 1, 1),
    y: v == null ? null : 3 + ((hi - v) / span) * (H - 6),
  }));
  const path = el('path', { d: pathOf(pts), fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  path.style.stroke = 'var(--series-1)';
  svg.append(path);
  return svg;
}
