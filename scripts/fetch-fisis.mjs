// FISIS Open API에서 부동산신탁사 주요 경영지표를 수집해 data/trusts.json 으로 저장합니다.
// 사용법: FISIS_API_KEY=발급키 node scripts/fetch-fisis.mjs
// 외부 의존성 없음 (Node 18+ 내장 fetch 사용).
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://fisis.fss.or.kr/openapi';
const SECTOR = 'M'; // 부동산신탁
const CATEGORIES = ['E', 'C']; // E: 부동산신탁 주요경영지표, C: 공통 주요경영지표(없으면 건너뜀)
const QUARTERS = 12;
const KEY = process.env.FISIS_API_KEY;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../data/trusts.json');

// 대표 지표(KPI 카드): FISIS 계정명이 정확히 일치하는 첫 번째 지표를 이 순서대로 고릅니다.
// (2026-10 수집 결과 기준. 총자산·부채비율은 이 권역 주요경영지표에 없음)
const FEATURED_NAMES = [
  '영업용순자본비율', '고정이하자산비율', '유동비율', '자기자본이익률',
  '자기자본', '영업수익', '당기순이익', '수지비율',
];

// 손익 계정은 분기 단독이 아니라 "최근 1년(직전 4분기) 합산" 값으로 판단됨 (2026-10 검증):
// ① 3월 값이 직전 12월과 비슷(누적이면 약 1/4), ② 14개사 영업수익 합이 분기말마다 1.6~1.8조(분기 단독이면 약 0.4조),
// ③ ROE가 당기순이익/평잔자기자본과 일치(연환산 ×4 없음). FISIS 응답에 명시된 정의는 없음.
const TTM_NAMES = ['영업수익', '영업비용', '당기순이익'];
const TTM_NOTE = '최근 1년(4분기) 합산 기준으로 추정';

// FISIS는 표 단위를 '원' 하나로만 내려주므로, 비율 계정은 이름으로 %를 판별합니다.
const isRatio = (name) => /비율|이익률/.test(name);

if (!KEY) {
  console.error('FISIS_API_KEY 환경변수가 없습니다.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(op, params, tries = 3) {
  const url = `${API}/${op}.json?${new URLSearchParams({ auth: KEY, lang: 'kr', ...params })}`;
  for (let i = 1; i <= tries; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { result } = await res.json();
      const code = String(result?.err_cd ?? '000');
      if (code === '000') return result;
      if (code === '021' || code === '101') return { list: [] }; // 조회 결과 없음 계열
      throw new Error(`FISIS ${code}: ${result?.err_msg}`);
    } catch (e) {
      if (i === tries) throw new Error(`${op} 실패 (${e.message})`);
      await sleep(1000 * i);
    }
  }
  return null;
}

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// 분기말(YYYYMM) 목록: 오늘 기준 최근 분기부터 과거로 (금감원 공시 지연을 고려해 넉넉히 요청)
function quarterEnds(count) {
  const out = [];
  let y = new Date().getFullYear();
  let q = 4;
  while (out.length < count) {
    out.push(`${y}${String(q * 3).padStart(2, '0')}`);
    q -= 1;
    if (q === 0) { q = 4; y -= 1; }
  }
  return out.reverse();
}

async function main() {
  const companies = asList((await call('companySearch', { partDiv: SECTOR })).list)
    .map((c) => ({ code: c.finance_cd, name: c.finance_nm }));
  console.log(`신탁사 ${companies.length}곳`);

  const stats = [];
  for (const smlDiv of CATEGORIES) {
    const r = await call('statisticsListSearch', { lrgDiv: SECTOR, smlDiv });
    stats.push(...asList(r.list).map((s) => ({ no: s.list_no, name: s.list_nm })));
  }
  console.log(`통계표 ${stats.length}개:`, stats.map((s) => s.name).join(', '));

  const window = quarterEnds(QUARTERS + 4); // 미공시 최근 분기 여유분
  const start = window[0];
  const end = window[window.length - 1];
  const metrics = new Map(); // id → { id, name, group, unit, byCompany: { code: { YYYYMM: value } } }
  const seenMonths = new Set();

  for (const stat of stats) {
    for (const co of companies) {
      const r = await call('statisticsInfoSearch', {
        financeCd: co.code, listNo: stat.no, term: 'Q', startBaseMm: start, endBaseMm: end,
      });
      const cols = asList(r.description).filter((c) => c.column_id);
      const valueCol = cols[0]?.column_id ?? 'a';
      const unit = String(r.unit ?? '').split(',')[0].trim();
      for (const row of asList(r.list)) {
        const value = Number(String(row[valueCol] ?? '').replace(/,/g, ''));
        if (!row[valueCol] || Number.isNaN(value)) continue;
        const id = `${stat.no}:${row.account_cd}`;
        if (!metrics.has(id)) {
          metrics.set(id, {
            id, name: row.account_nm, group: stat.name, unit: isRatio(row.account_nm) ? '%' : unit, byCompany: {},
          });
        }
        (metrics.get(id).byCompany[co.code] ??= {})[row.base_month] = value;
        seenMonths.add(row.base_month);
      }
      await sleep(150);
    }
  }

  const quarters = [...seenMonths].sort().slice(-QUARTERS);
  if (!quarters.length) throw new Error('수집된 데이터가 없습니다. 인증키/통계표 코드를 확인하세요.');

  const out = [...metrics.values()].map((m) => ({
    id: m.id, name: m.name, group: m.group, unit: m.unit,
    ...(TTM_NAMES.includes(m.name) ? { basis: '최근 1년', note: TTM_NOTE } : {}),
    series: Object.fromEntries(Object.entries(m.byCompany)
      .map(([code, byMonth]) => [code, quarters.map((q) => byMonth[q] ?? null)])),
  })).filter((m) => Object.values(m.series).some((s) => s.some((v) => v !== null)));

  const featured = FEATURED_NAMES
    .map((name) => out.find((m) => m.name === name))
    .filter(Boolean)
    .map((m) => m.id);

  const activeCodes = new Set(out.flatMap((m) => Object.keys(m.series)));
  const data = {
    meta: {
      source: 'fisis',
      title: '금융감독원 금융통계정보시스템(FISIS)',
      updated: new Date().toISOString().slice(0, 10),
      quarters,
      featured: [...new Set(featured)],
    },
    companies: companies.filter((c) => activeCodes.has(c.code)),
    metrics: out,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(data)}\n`);
  console.log(`저장 완료: 지표 ${out.length}개, 분기 ${quarters[0]}~${quarters.at(-1)} → ${OUT}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
