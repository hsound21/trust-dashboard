// 숫자·분기 라벨 포맷 유틸

const nf = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });

// 금액 단위(백만원/억원/원)는 억·조 단위로 줄여 보여 줍니다.
const TO_EOK = { '원': 1e-8, '천원': 1e-5, '백만원': 1e-2, '억원': 1 };

export function formatValue(value, unit) {
  if (value == null) return '-';
  if (unit in TO_EOK) {
    const eok = value * TO_EOK[unit];
    if (Math.abs(eok) >= 10000) return `${nf.format(eok / 10000)}조`;
    return `${nf.format(eok)}억`;
  }
  if (unit === '%') return `${nf.format(value)}%`;
  return `${nf.format(value)}${unit ? ` ${unit}` : ''}`;
}

// 비율 지표는 %p 차이, 금액·수량은 % 변화율
export function formatDelta(curr, prev, unit) {
  if (curr == null || prev == null) return null;
  const diff = curr - prev;
  if (unit === '%') return { sign: Math.sign(diff), text: `${diff >= 0 ? '+' : ''}${nf.format(diff)}%p` };
  if (prev === 0) return null;
  const pct = (diff / Math.abs(prev)) * 100;
  return { sign: Math.sign(diff), text: `${pct >= 0 ? '+' : ''}${nf.format(pct)}%` };
}

// '202409' → "24.3Q"
export function quarterLabel(yyyymm) {
  const year = yyyymm.slice(2, 4);
  const q = Math.ceil(Number(yyyymm.slice(4)) / 3);
  return `${year}.${q}Q`;
}
