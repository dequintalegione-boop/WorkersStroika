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
const approvedDevChain = new Set(['picomatch', 'fdir', 'tinyglobby', 'vite']);

function getViaNames(finding) {
  return (finding.via || []).map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
}

function isApprovedDevOnlyFinding(name, finding) {
  if (!approvedDevChain.has(name) || finding.severity !== 'high' || finding.isDirect !== false) return false;

  const nodes = Array.isArray(finding.nodes) ? finding.nodes : [];
  if (nodes.length === 0 || !nodes.every(node => lock.packages[node]?.dev === true)) return false;

  const picomatch = lock.packages['node_modules/picomatch'];
  const fdir = lock.packages['node_modules/fdir'];
  const tinyglobby = lock.packages['node_modules/tinyglobby'];
  const vite = lock.packages['node_modules/vite'];
  if (!picomatch?.dev || !fdir?.dev || !tinyglobby?.dev || !vite?.dev) return false;

  const picomatchParts = String(picomatch.version || '').split('.').map(Number);
  const atOrBelowAffectedMaximum =
    picomatchParts.length >= 3 &&
    (picomatchParts[0] < 4 || (picomatchParts[0] === 4 &&
      (picomatchParts[1] < 0 || (picomatchParts[1] === 0 && picomatchParts[2] <= 7))));
  if (!atOrBelowAffectedMaximum) return false;

  if (packageJson.dependencies?.[name]) return false;
  if (packageJson.dependencies?.vite || !packageJson.devDependencies?.vite) return false;

  const viaNames = getViaNames(finding);
  if (name === 'picomatch') {
    const via = JSON.stringify(finding.via || []);
    return via.toLowerCase().includes(knownAdvisory.toLowerCase());
  }
  if (name === 'fdir' || name === 'tinyglobby') {
    return viaNames.length > 0 && viaNames.every(item => item === 'picomatch');
  }
  if (name === 'vite') {
    const viteDeps = vite.dependencies || {};
    const hasExpectedChain =
      Boolean(viteDeps.fdir && viteDeps.tinyglobby) &&
      fdir.peerDependencies?.picomatch &&
      tinyglobby.dependencies?.picomatch;
    return hasExpectedChain &&
      viaNames.length > 0 &&
      viaNames.every(item => item === 'fdir' || item === 'tinyglobby');
  }
  return false;
}

const unexpected = vulnerabilities.filter(([name, finding]) => !isApprovedDevOnlyFinding(name, finding));
if (unexpected.length > 0) {
  console.error('Обнаружены уязвимости, не входящие в разрешённое временное исключение:');
  for (const [name, finding] of unexpected) {
    console.error('- ' + name + ': ' + finding.severity + ', ' + (finding.nodes || []).join(', ') +
      ', via=' + JSON.stringify(finding.via || []));
  }
  process.exit(1);
}

if (vulnerabilities.length === 0) {
  console.log('Полный аудит npm: уязвимостей не обнаружено.');
} else {
  console.warn('Полный аудит: обнаружена только цепочка GHSA-fc5q-39xc-vjpf (picomatch → fdir/tinyglobby → Vite) в dev-инструментах. Исправленная версия picomatch пока не опубликована.');
}
