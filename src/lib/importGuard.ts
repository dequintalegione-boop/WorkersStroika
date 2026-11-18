// Предварительная проверка импортируемого JSON. Выполняется до любых изменений хранилища.

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024; // 20 МБ
export const MAX_RECORDS_PER_LIST = 100_000;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 12;
const LISTS = ['workers', 'partners', 'objects', 'shifts', 'planning', 'payrollAccruals', 'workerPayments', 'financeTransactions'] as const;

export function checkImportFileSize(size: number): string | null {
  if (!Number.isSafeInteger(size) || size < 0) return 'Не удалось определить корректный размер файла.';
  if (size > MAX_IMPORT_BYTES) return 'Файл слишком большой (' + (size / 1048576).toFixed(1) + ' МБ). Максимум — ' + (MAX_IMPORT_BYTES / 1048576) + ' МБ.';
  if (size === 0) return 'Файл пустой.';
  return null;
}

/** Ищет опасные ключи (Prototype Pollution) и чрезмерную глубину вложенности. */
export function findUnsafeStructure(value: unknown, depth = 0): string | null {
  if (depth > MAX_DEPTH) return 'Слишком глубокая вложенность данных.';
  if (Array.isArray(value)) {
    for (const item of value) {
      const problem = findUnsafeStructure(item, depth + 1);
      if (problem) return problem;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value as object)) {
      if (FORBIDDEN_KEYS.has(key)) return 'Файл содержит запрещённое поле «' + key + '».';
      const problem = findUnsafeStructure((value as Record<string, unknown>)[key], depth + 1);
      if (problem) return problem;
    }
  }
  return null;
}

/** Парсит JSON-текст и проверяет структуру до передачи в основное хранилище. */
export function parseImportJson(text: string): { ok: true; data: any } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Файл не является корректным JSON (повреждён или имеет другой формат).' };
  }
  const problem = validateImportShape(data);
  return problem ? { ok: false, error: problem } : { ok: true, data };
}

export function validateImportShape(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Ожидался JSON-объект с данными приложения.';
  const unsafe = findUnsafeStructure(data);
  if (unsafe) return unsafe;
  const record = data as Record<string, unknown>;
  for (const name of LISTS) {
    const list = record[name];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return 'Поле «' + name + '» должно быть списком.';
    if (list.length > MAX_RECORDS_PER_LIST) return 'Слишком много записей в «' + name + '» (максимум ' + MAX_RECORDS_PER_LIST + ').';
    if (list.some(item => !item || typeof item !== 'object' || Array.isArray(item))) return 'В списке «' + name + '» есть элементы неверного формата.';
  }
  return null;
}
