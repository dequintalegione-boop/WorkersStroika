// Защита CSV-экспорта от Formula Injection в Excel, LibreOffice и Google Sheets.

const LEADING_JUNK = /^[\u0000-\u0020\u007f-\u00a0\u200b-\u200f\u2028\u2029\u202f\u205f\u2060\ufeff]*/;
const FORMULA_START = /^[=+\-@|%]/;

/**
 * Обезвреживает строковые значения, которые табличный процессор может принять за формулу.
 * Телефоны вроде "+7..." остаются текстом. Настоящие числовые значения обрабатываются отдельно.
 */
export function neutralizeFormula(text: string): string {
  if (text === '') return text;
  const stripped = text.replace(LEADING_JUNK, '');
  const first = text[0];
  if (first === '\t' || first === '\r' || first === '\n') return "'" + text;
  if (FORMULA_START.test(stripped)) return "'" + text;
  return text;
}

/** Ячейка CSV: числа остаются числами, строки обезвреживаются и берутся в кавычки. */
export function csvCell(value: unknown): string {
  const text = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : neutralizeFormula(String(value ?? ''));
  return '"' + text.replace(/"/g, '""') + '"';
}

export function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
