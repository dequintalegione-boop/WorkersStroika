import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, neutralizeFormula, toCsv } from '../src/lib/csv.ts';
import { parseImportJson, validateImportShape, checkImportFileSize, findUnsafeStructure } from '../src/lib/importGuard.ts';

test('формулы и значения со знаками обезвреживаются', () => {
  for (const evil of ['=1+1', '+SUM(A1)', '-2+3', '@SUM(1)', '=HYPERLINK("http://x","y")', '|calc', '%x',
    '  =1+1', '  -1+2', '\t=1+1', '\u00a0=1+1', '\u200b=1+1', '\ufeff@x', '\r=1', '\n=1']) {
    assert.ok(neutralizeFormula(evil).startsWith("'"), 'не защищено: ' + JSON.stringify(evil));
    assert.ok(csvCell(evil).startsWith("\"'"));
  }
});

test('обычные значения и числовые поля не портятся', () => {
  assert.equal(neutralizeFormula('Иванов Иван'), 'Иванов Иван');
  assert.equal(neutralizeFormula('ул. Ленина, 5'), 'ул. Ленина, 5');
  assert.equal(neutralizeFormula('-150'), "'-150");
  assert.equal(neutralizeFormula('+7'), "'+7");
  assert.equal(csvCell('+7'), "\"'+7\"");
  assert.equal(csvCell('-150'), "\"'-150\"");
  assert.equal(csvCell(-1500.5), '"-1500.5"');
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell(null), '""');
});

test('кавычки и переносы экранируются', () => {
  assert.equal(csvCell('он сказал "да"'), '"он сказал ""да"""');
  assert.equal(toCsv([['a', 'b'], [1, '=x']]), '"a","b"\r\n"1","\'=x"');
});

test('импорт отклоняет опасные ключи и неверную структуру', () => {
  assert.equal(parseImportJson('{broken').ok, false);
  assert.equal(parseImportJson('{"workers":[],"__proto__":{"x":1}}').ok, false);
  assert.equal(parseImportJson('{"workers":[{"constructor":{}}]}').ok, false);
  assert.equal(parseImportJson('[]').ok, false);
  assert.equal(parseImportJson('{"workers":"x"}').ok, false);
  assert.equal(parseImportJson('{"workers":[1]}').ok, false);
  assert.equal(parseImportJson('{"workers":[],"partners":[],"objects":[],"shifts":[]}').ok, true);
  assert.notEqual(validateImportShape(null), null);
  assert.notEqual(findUnsafeStructure({ nested: { prototype: {} } }), null);
  let deep: unknown = {};
  for (let i = 0; i < 15; i++) deep = { nested: deep };
  assert.notEqual(findUnsafeStructure(deep), null);
});

test('импорт проверяет размер файла', () => {
  assert.notEqual(checkImportFileSize(50 * 1024 * 1024), null);
  assert.notEqual(checkImportFileSize(0), null);
  assert.notEqual(checkImportFileSize(-1), null);
  assert.notEqual(checkImportFileSize(Number.NaN), null);
  assert.equal(checkImportFileSize(1000), null);
});
