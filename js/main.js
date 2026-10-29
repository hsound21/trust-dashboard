import { formatValue, formatDelta, quarterLabel } from './format.js';
import { lineChart, barChart, sparkline } from './charts.js';
import { initTheme } from './theme.js';

const app = document.getElementById('app');
const state = { data: null, company: null, metric: null, quarter: null }; // quarter: 기준 분기 인덱스

const h = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
};

// 순위 차트용 짧은 이름: "(주)", "주식회사" 제거, "부동산신탁"/"자산신탁" 유지
const shortName = (name) => name.replace(/\(주\)|주식회사/g, '').trim();
const median =(arr) => {
  const v = arr.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

// 해시: #/<회사코드>/<지표id>/<기준분기 YYYYMM>
function readHash() {
  const [, code, metric, quarter] = location.hash.split('/').map((s) => (s ? decodeURIComponent(s) : null));
  return { code, metric, quarter };
}

function writeHash() {
  const quarter = state.data.meta.quarters[state.quarter];
  try {
    history.replaceState(null, '', `#/${[state.company, state.metric, quarter].map(encodeURIComponent).join('/')}`);
  } catch (e) { /* 샌드박스 iframe(Apps Script)에서는 막힐 수 있음 */ }
}

function kpiCard(metric, code, quarters) {
  const values = metric.series[code] ?? [];
  const idx = state.quarter;
  const delta = idx >= 4 ? formatDelta(values[idx], values[idx - 4], metric.unit) : null;
  const card = h('button', {
    class: 'kpi', type: 'button', 'aria-pressed': String(metric.id === state.metric),
    onclick: () => { state.metric = metric.id; writeHash(); render(); },
  },
  h('span', { class: 'kpi-name' }, metric.basis ? `${metric.name} · ${metric.basis}` : metric.name),
  h('span', { class: 'kpi-value' }, formatValue(values[idx], metric.unit)),
  h('span', { class: 'kpi-delta' },
    delta ? h('span', { class: delta.sign > 0 ? 'up' : delta.sign < 0 ? 'down' : '' }, delta.text) : '–',
    delta ? ' (전년 동기)' : ''));
  card.append(sparkline(values));
  card.setAttribute('aria-label', `${metric.name} ${values[idx] == null ? '자료 없음' : formatValue(values[idx], metric.unit)} (${quarterLabel(quarters[idx])})`);
  return card;
}

function render(refocusCode = null) {
  const { data, company, metric: metricId } = state;
  const { quarters, featured } = data.meta;
  const metric = data.metrics.find((m) => m.id === metricId);
  const co = data.companies.find((c) => c.code === company);
  const labels = quarters.map(quarterLabel);
  const fmt = (v) => formatValue(v, metric.unit);

  const root = h('div');
  if (data.meta.source === 'sample') {
    root.append(h('p', { class: 'banner' }, '⚠ 화면 확인용 가상 샘플 데이터입니다. 실제 신탁사 수치가 아닙니다. (README의 데이터 수집 방법을 따라 실제 데이터로 교체하세요)'));
  }

  // 최상단: 제목 + 기준 분기 선택 (최신 분기가 위로 오도록 내림차순)
  const quarterSelect = h('select', {
    class: 'select', id: 'quarter',
    onchange: (e) => { state.quarter = Number(e.target.value); writeHash(); render(); },
  }, ...quarters.map((q, i) => {
    const opt = h('option', { value: String(i) }, quarterLabel(q));
    if (i === state.quarter) opt.selected = true;
    return opt;
  }).reverse());
  root.append(h('div', { class: 'top-row' },
    h('h2', { class: 'section-title section-title-first' }, '요약'),
    h('div', { class: 'quarter-picker' }, h('label', { for: 'quarter' }, '기준 분기'), quarterSelect)));

  // 지표 탭 → 선택한 지표의 전체 신탁사 순위 (가장 최근 분기)
  const tabMetrics = featured.map((id) => data.metrics.find((m) => m.id === id)).filter(Boolean);
  root.append(metricTabs(tabMetrics, metricId));
  const rankView = rankCard(metric, data, company, labels);
  root.append(rankView.section);

  const kpiMetrics = featured.map((id) => data.metrics.find((m) => m.id === id)).filter(Boolean);
  root.append(h('h2', { class: 'section-title' }, `${co.name} 핵심 지표 (${labels[state.quarter]} 기준)`));
  root.append(h('div', { class: 'kpi-grid' }, ...kpiMetrics.map((m) => kpiCard(m, company, quarters))));

  // 추이: 선택 신탁사 vs 업계 중앙값
  const own = metric.series[company] ?? quarters.map(() => null);
  const peers = quarters.map((_, i) => median(Object.values(metric.series).map((s) => s[i])));
  const trendHost = h('div', { class: 'chart' });

  // 12분기 수치 표 (그래프와 같은 카드 안)
  const colClass = (i) => (i === state.quarter ? 'col-active' : '');
  const head = h('tr', {}, h('th', {}, '분기'), ...labels.map((l, i) => h('th', { class: colClass(i) }, l)));
  const row = (name, values) => h('tr', {}, h('td', {}, name),
    ...values.map((v, i) => h('td', { class: colClass(i) }, fmt(v))));

  root.append(h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, `${metric.name} 추이`),
      h('span', { class: 'card-note' }, `${co.name} · ${labels[0]} ~ ${labels.at(-1)} · 단위: ${metric.unit || '-'}`)),
    metric.note ? h('p', { class: 'card-note card-basis' }, `※ ${metric.note} (분기 단독 값 아님)`) : null,
    trendHost,
    h('div', { class: 'legend' },
      h('span', {}, h('i', { style: 'background:var(--series-1)' }), co.name),
      h('span', {}, h('i', { style: 'background:var(--series-2)' }), '신탁사 중앙값')),
    h('div', { class: 'table-wrap card-table' }, h('table', {},
      h('thead', {}, head), h('tbody', {}, row(co.name, own), row('신탁사 중앙값', peers))))));

  app.replaceChildren(root);
  lineChart(trendHost, { labels, fmt, series: [{ values: own, cls: 'line-main' }, { values: peers, cls: 'line-ref' }] });
  rankView.draw();
  if (refocusCode) root.querySelector(`[data-code="${CSS.escape(refocusCode)}"]`)?.focus({ preventScroll: true });
  // 선택된 탭이 가로 스크롤 영역 가운데 오도록 (페이지 세로 스크롤은 건드리지 않음)
  const bar = root.querySelector('.tabs');
  const active = bar.querySelector('[aria-selected="true"]');
  if (active) bar.scrollLeft = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
}

// 상단 지표 탭 (좌우 화살표 키로 이동)
function metricTabs(metrics, activeId) {
  const choose = (id, refocus) => {
    state.metric = id;
    writeHash();
    render();
    if (refocus) document.querySelector('[role="tab"][aria-selected="true"]')?.focus();
  };
  const tabs = metrics.map((m) => h('button', {
    class: 'tab', type: 'button', role: 'tab', id: `tab-${m.id}`,
    'aria-selected': String(m.id === activeId), tabindex: m.id === activeId ? '0' : '-1',
    onclick: () => choose(m.id, false),
    onkeydown: (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const i = metrics.findIndex((x) => x.id === m.id);
      choose(metrics[(i + step + metrics.length) % metrics.length].id, true);
    },
  }, m.name));
  // 선택 지표가 탭에 없으면(지표 선택 상자에서 고른 경우) 첫 탭만 키보드 진입점으로 둠
  if (!metrics.some((m) => m.id === activeId)) tabs[0]?.setAttribute('tabindex', '0');
  return h('div', { class: 'tabs', role: 'tablist', 'aria-label': '지표 선택' }, ...tabs);
}

// 신탁사별 순위 카드. section은 DOM, draw는 DOM이 붙은 뒤(폭 측정 가능) 차트를 그림
function rankCard(metric, data, company, labels) {
  const rankIdx = state.quarter;
  const host = h('div', { class: 'chart' });
  const section = h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, metric.name),
      h('span', { class: 'card-note' }, `${labels[rankIdx]} 기준 · 단위: ${metric.unit || '-'}`)),
    metric.note ? h('p', { class: 'card-note card-basis' }, `※ ${metric.note} (분기 단독 값 아님)`) : null,
    h('p', { class: 'card-note card-basis' }, '신탁사를 누르면 아래 지표가 해당 신탁사로 바뀝니다.'),
    host);
  const draw = () => barChart(host, {
    fmt: (v) => formatValue(v, metric.unit),
    onSelect: (code) => { state.company = code; writeHash(); render(code); },
    items: data.companies.map((c) => ({
      code: c.code, name: shortName(c.name), value: metric.series[c.code]?.[rankIdx] ?? null, active: c.code === company,
    })),
  });
  return { section, draw };
}

const REFRESH_MS = 30 * 60 * 1000; // 열어 둔 화면의 자동 확인 주기

// Google Apps Script 웹앱 안에서 실행 중인지 (gas/ 빌드 결과물에서만 true)
const IN_APPS_SCRIPT = typeof google !== 'undefined' && Boolean(google.script?.run);

async function loadData() {
  if (IN_APPS_SCRIPT) {
    // 서버 함수 getData()가 JSON 문자열을 돌려줌 (gas/Code.gs)
    const text = await new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).getData();
    });
    return JSON.parse(text);
  }
  const res = await fetch('data/trusts.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

// 갱신 시각(meta.updated)만 다르고 내용이 같으면 같은 데이터로 취급
const signature = (d) => JSON.stringify({ ...d, meta: { ...d.meta, updated: null } });

function setSourceNote(data) {
  document.getElementById('source-note').textContent =
    `출처: ${data.meta.title} · 최신 분기 ${quarterLabel(data.meta.quarters.at(-1))} · 갱신 ${data.meta.updated}`;
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(toast);
  setTimeout(() => toast.remove(), 6000);
}

// 열어 둔 화면에서 새 데이터가 배포됐는지 확인하고, 있으면 선택 상태를 유지한 채 다시 그림
async function refreshData() {
  let next;
  try { next = await loadData(); } catch (e) { return; } // 오프라인 등은 조용히 무시
  const prev = state.data;
  if (signature(next) === signature(prev)) return;

  const wasLatest = state.quarter === prev.meta.quarters.length - 1;
  const quarterCode = prev.meta.quarters[state.quarter];
  const latestChanged = next.meta.quarters.at(-1) !== prev.meta.quarters.at(-1);
  state.data = next;
  if (!next.companies.some((c) => c.code === state.company)) state.company = next.companies[0].code;
  if (!next.metrics.some((m) => m.id === state.metric)) state.metric = next.meta.featured[0] ?? next.metrics[0].id;
  const idx = next.meta.quarters.indexOf(quarterCode);
  state.quarter = wasLatest || idx < 0 ? next.meta.quarters.length - 1 : idx; // 최신 분기를 보던 중이면 새 최신으로
  writeHash();
  setSourceNote(next);
  render();
  showToast(latestChanged
    ? `새 분기(${quarterLabel(next.meta.quarters.at(-1))}) 데이터가 반영되었습니다.`
    : '데이터가 갱신되었습니다.');
}

async function init() {
  initTheme(document.getElementById('theme-toggle'));
  try {
    state.data = await loadData();
  } catch (e) {
    app.replaceChildren(h('p', { class: 'banner' }, '데이터를 불러오지 못했습니다. 네트워크를 확인해 주세요.'));
    return;
  }
  const { data } = state;
  const hash = readHash();
  state.company = data.companies.some((c) => c.code === hash.code) ? hash.code : data.companies[0].code;
  const quarterIdx = data.meta.quarters.indexOf(hash.quarter);
  state.quarter = quarterIdx >= 0 ? quarterIdx : data.meta.quarters.length - 1; // 기본: 최신 분기
  state.metric = data.metrics.some((m) => m.id === hash.metric) ? hash.metric : (data.meta.featured[0] ?? data.metrics[0].id);
  setSourceNote(data);
  render();

  // 다시 보이게 되거나(탭 전환·앱 복귀) 30분마다 새 데이터 확인
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshData(); });
  setInterval(() => { if (!document.hidden) refreshData(); }, REFRESH_MS);

  let lastWidth = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth !== lastWidth) { lastWidth = innerWidth; render(); }
  });
  if (!IN_APPS_SCRIPT && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
