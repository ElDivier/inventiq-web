export function parseInventiqDate(value) {
  if (!value) return null;

  const text = String(value).trim();
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes('hoy')) return now;

  if (lower.includes('ayer')) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  const direct = new Date(text);

  if (!Number.isNaN(direct.getTime())) return direct;

  const match = text.match(/([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{2,4})/);

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const rawYear = Number(match[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const parsed = new Date(year, month, day);

    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

export function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function formatPeriodDate(date) {
  return date.toLocaleDateString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getPeriodRange(period, customStart, customEnd) {
  const now = new Date();
  let start = startOfDay(now);
  let end = endOfDay(now);

  if (period === 'week') {
    start = startOfDay(now);
    start.setDate(start.getDate() - 6);
  }

  if (period === '15days') {
    start = startOfDay(now);
    start.setDate(start.getDate() - 14);
  }

  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = endOfDay(now);
  }

  if (period === 'previousMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
  }

  if (period === 'custom') {
    start = customStart ? startOfDay(new Date(customStart)) : start;
    end = customEnd ? endOfDay(new Date(customEnd)) : end;
  }

  return { start, end };
}

export function isRecordInPeriod(record, range) {
  const date = parseInventiqDate(record.date);

  if (!date) return false;

  return date >= range.start && date <= range.end;
}