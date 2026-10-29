// 인증키 없이 화면을 확인하기 위한 "가상" 샘플 데이터를 data/trusts.json 으로 생성합니다.
// 실제 신탁사 수치가 아니며, 앱에는 샘플 배너가 표시됩니다.
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../data/trusts.json');
const quarters = ['202309', '202312', '202403', '202406', '202409', '202412',
  '202503', '202506', '202509', '202512', '202603', '202606'];

// 결정적 의사난수 (실행할 때마다 같은 결과)
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const companies = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((l, i) => ({
  code: `S${String(i + 1).padStart(3, '0')}`, name: `샘플신탁${l}`,
}));

const series = (base, growth, noise) => quarters.map((_, i) =>
  Math.round(base * (1 + growth * i) * (1 + (rnd() - 0.5) * noise)));

const money = { assets: {}, equity: {}, revenue: {}, profit: {}, debt: {}, liq: {} };
for (const c of companies) {
  const size = 0.6 + rnd() * 2.4;
  money.assets[c.code] = series(1_000_000 * size, 0.03, 0.04);
  money.equity[c.code] = series(600_000 * size, 0.025, 0.03);
  money.revenue[c.code] = series(90_000 * size, 0.02, 0.35);
  money.profit[c.code] = series(30_000 * size, 0.01, 0.8);
  money.debt[c.code] = series(400_000 * size, 0.035, 0.05);
  money.liq[c.code] = series(150_000 * size, 0.01, 0.2);
}
const ratio = (num, den, scale = 100) => Object.fromEntries(companies.map((c) => [c.code,
  quarters.map((_, i) => +((num[c.code][i] / den[c.code][i]) * scale).toFixed(2))]));

const metrics = [
  { id: 'SAMPLE:assets', name: '총자산', group: '재무현황(샘플)', unit: '백만원', series: money.assets },
  { id: 'SAMPLE:equity', name: '자기자본', group: '재무현황(샘플)', unit: '백만원', series: money.equity },
  { id: 'SAMPLE:revenue', name: '영업수익', group: '손익(샘플)', unit: '백만원', series: money.revenue },
  { id: 'SAMPLE:profit', name: '당기순이익', group: '손익(샘플)', unit: '백만원', series: money.profit },
  { id: 'SAMPLE:debtratio', name: '부채비율', group: '안정성(샘플)', unit: '%', series: ratio(money.debt, money.equity) },
  { id: 'SAMPLE:roe', name: '자기자본이익률(ROE)', group: '수익성(샘플)', unit: '%',
    series: ratio(Object.fromEntries(companies.map((c) => [c.code, money.profit[c.code].map((v) => v * 4)])), money.equity) },
  { id: 'SAMPLE:roa', name: '총자산이익률(ROA)', group: '수익성(샘플)', unit: '%',
    series: ratio(Object.fromEntries(companies.map((c) => [c.code, money.profit[c.code].map((v) => v * 4)])), money.assets) },
  { id: 'SAMPLE:liquid', name: '유동성 자산', group: '안정성(샘플)', unit: '백만원', series: money.liq },
];

const data = {
  meta: { source: 'sample', title: '샘플 데이터', updated: '2026-10-30', quarters, featured: metrics.map((m) => m.id) },
  companies,
  metrics,
};
await writeFile(OUT, `${JSON.stringify(data)}\n`);
console.log('샘플 데이터 생성:', OUT);
