import { useRef } from 'react';
import { useStore } from '../store';
import { Download, Upload, FileJson } from 'lucide-react';

export default function ImportExport() {
  const { exportData, importData, workers, partners, objects, shifts } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brigade-tracker-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.workers && data.partners && data.objects && data.shifts) {
          if (confirm(`Импортировать данные? Рабочих: ${data.workers.length}, Партнёров: ${data.partners.length}, Объектов: ${data.objects.length}, Смен: ${data.shifts.length}. Текущие данные будут ЗАМЕНЕНЫ.`)) {
            importData(data);
            alert('Данные успешно импортированы!');
          }
        } else {
          alert('Неверный формат файла. Ожидался JSON с workers, partners, objects, shifts.');
        }
      } catch {
        alert('Ошибка чтения файла. Убедитесь, что это корректный JSON.');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  // CSV export for Google Sheets compatibility
  const handleExportCSV = () => {
    const csvContent = [
      '=== РАБОЧИЕ ===',
      '№,ФИО,Возраст,Телефон,Кто пригласил,Дата начала',
      ...workers.map((w) => `${w.number},"${w.full_name}",${w.age},"${w.phone}","${w.inviter}",${w.start_date}`),
      '',
      '=== ПАРТНЁРЫ ===',
      '№,ФИО',
      ...partners.map((p) => `${p.number},"${p.full_name}"`),
      '',
      '=== ОБЪЕКТЫ ===',
      '№,Название,Направление,Адрес',
      ...objects.map((o) => `${o.number},"${o.name}","${o.direction}","${o.address}"`),
      '',
      '=== СМЕНЫ ===',
      '№,Дата,Рабочий_ID,Объект_ID,Зарплата,Начало,Конец,Часы(мин),Моя доля,Доля партнёра,Отзыв,Комментарий',
      ...shifts.map((s) => `${s.number},${s.date},${s.worker_id},${s.object_id},${s.salary},${s.time_start},${s.time_end},${s.hours_manual || ''},${s.my_share},${s.partner_share_override ?? ''},"${s.review}","${s.comment}"`)
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brigade-tracker-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">💾 Экспорт / Импорт</h2>

      <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <FileJson size={20} /> Текущие данные
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{workers.length}</p>
            <p className="text-sm text-gray-600">Рабочих</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{partners.length}</p>
            <p className="text-sm text-gray-600">Партнёров</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-600">{objects.length}</p>
            <p className="text-sm text-gray-600">Объектов</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{shifts.length}</p>
            <p className="text-sm text-gray-600">Смен</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Download size={20} /> Экспорт
          </h3>
          <p className="text-sm text-gray-500">
            Сохраните данные в JSON (для восстановления) или CSV (для открытия в Google Sheets / Excel).
          </p>
          <div className="flex gap-3">
            <button onClick={handleExport}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              <Download size={16} /> JSON
            </button>
            <button onClick={handleExportCSV}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
              <Download size={16} /> CSV
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-700 flex items-center gap-2">
            <Upload size={20} /> Импорт
          </h3>
          <p className="text-sm text-gray-500">
            Загрузите ранее экспортированный JSON-файл. Все текущие данные будут заменены.
          </p>
          <label className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition cursor-pointer w-fit">
            <Upload size={16} /> Загрузить JSON
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Миграция из Google Sheets</h4>
        <p className="text-sm text-yellow-700">
          Для переноса данных из Google Sheets: экспортируйте каждый лист в CSV, затем загрузите данные через JSON-файл.
          Структура JSON должна содержать массивы: <code className="bg-yellow-100 px-1 rounded">workers</code>, <code className="bg-yellow-100 px-1 rounded">partners</code>, <code className="bg-yellow-100 px-1 rounded">objects</code>, <code className="bg-yellow-100 px-1 rounded">shifts</code>.
          Связи восстанавливаются по именам при первом импорте, далее система работает на ID.
        </p>
      </div>
    </div>
  );
}
