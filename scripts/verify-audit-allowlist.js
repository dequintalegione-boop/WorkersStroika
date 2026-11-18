import fs from 'node:fs';

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('Укажи путь к JSON-отчёту npm audit.');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch {
  console.error('Не удалось прочитать JSON-отчёт npm audit.');
  process.exit(2);
}

if (report.error) {
  console.error('npm audit завершился ошибкой:', report.error.summary || report.error.code || 'неизвестная ошибка');
  process.exit(2);
}

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const vulnerabilities = Object.entries(report.vulnerabilities || []);
const knownAdvisory = 'GHSA-fc5q-39xc-vjpf';

function isApprovedPicomatchFinding(name, finding) {
  if (name !== 'picomatch' || finding.severity !== 'high' || finding.isDirect !== false) return false;
  const via = JSON.stringify(finding.via || []);
  if (!via.includes(knownAdvisory)) return false;

  const nodes = Array.isArray(finding.nodes) ? finding.nodes : [];
  if (nodes.length === 0 || !nodes.every(node => lock.packages[node]?.dev === true)) return false;

  const version = lock.packages['node_modules/picomatch']?.version || '';
  const parts = version.split('.').map(Number);
  const atOrBelowAffectedMaximum =
    parts.length >= 3 &&
    (parts[0] < 4 || (parts[0] === 4 && (parts[1] < 0 || (parts[1] === 0 && parts[2] <= 7))));
  if (!atOrBelowAffectedMaximum) return false;

  if (packageJson.dependencies?.picomatch || packageJson.dependencies?.vite) return false;
  if (!packageJson.devDependencies?.vite) return false;

  const toolingNodes = [
    'node_modules/picomatch',
    'node_modules/fdir',
    'node_modules/tinyglobby',
    'node_modules/vite'
  ];
  return toolingNodes.every(path => lock.packages[path]?.dev === true);
}

const unexpected = vulnerabilities.filter(([name, finding]) => !isApprovedPicomatchFinding(name, finding));
if (unexpected.length > 0) {
  console.error('Обнаружены уязвимости, не входящие в разрешённое временное исключение:');
  for (const [name, finding] of unexpected) {
    console.error('- ' + name + ': ' + finding.severity + ', ' + (finding.nodes || []).join(', '));
  }
  process.exit(1);
}

if (vulnerabilities.length === 0) {
  console.log('Полный аудит npm: уязвимостей не обнаружено.');
} else {
  console.warn('Полный аудит: оставлено только GHSA-fc5q-39xc-vjpf в picomatch, исключительно в dev-инструментах. Исправленная версия пока не опубликована.');
}
