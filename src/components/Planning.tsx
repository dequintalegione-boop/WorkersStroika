import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { format, addDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus, Trash2, Check, X } from 'lucide-react';

export default function Planning() {
  const { planning, workers, objects, addPlanning, updatePlanning, deletePlanning, getWorker, getObject } = useStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', worker_id: '', object_id: '', note: '' });

  const today = new Date();
  const weekStart = addDays(startOfWeek(today, { locale: ru }), weekOffset * 7);
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  const resetForm = () => {
    setForm({ date: '', worker_id: '', object_id: '', note: '' });
    setShowForm(false);
  };

  const handleSave = () => {
    if (!form.date || !form.worker_id) return;
    addPlanning({ ...form, confirmed: false });
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить запись планирования?')) deletePlanning(id);
  };

  const handleConfirm = (id: string) => {
    const entry = planning.find((p) => p.id === id);
    if (entry) updatePlanning(id, { confirmed: !entry.confirmed });
  };

  const getPlanningForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return planning.filter((p) => p.date === dateStr);
  };

  // Group by worker for the week
  const weekPlanning = useMemo(() => {
    const dateRange = weekDays.map((d) => format(d, 'yyyy-MM-dd'));
    return planning.filter((p) => dateRange.includes(p.date));
  }, [planning, weekDays]);

  const workersWithPlanning = useMemo(() => {
    const workerIds = new Set(weekPlanning.map((p) => p.worker_id));
    return workers.filter((w) => workerIds.has(w.id));
  }, [workers, weekPlanning]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📋 Планирование занятости</h2>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          <Plus size={18} /> Забронировать
        </button>
      </div>

      {/* Week navigation */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setWeekOffset(weekOffset - 1)}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm">
            ← Пред. неделя
          </button>
          <div className="text-center">
            <h3 className="font-bold capitalize">
              {format(weekDays[0], 'dd MMM', { locale: ru })} — {format(weekDays[6], 'dd MMM yyyy', { locale: ru })}
            </h3>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-600 hover:underline">
                Текущая неделя
              </button>
            )}
          </div>
          <button onClick={() => setWeekOffset(weekOffset + 1)}
            className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 text-sm">
            След. неделя →
          </button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayPlanning = getPlanningForDay(day);
            const isToday = format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
            return (
              <div key={day.toISOString()} className={`border rounded-lg p-2 min-h-[120px] ${isToday ? 'bg-blue-50 border-blue-300' : ''}`}>
                <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {format(day, 'EEE, d MMM', { locale: ru })}
                </div>
                <div className="space-y-1">
                  {dayPlanning.map((p) => {
                    const w = getWorker(p.worker_id);
                    const o = p.object_id ? getObject(p.object_id) : null;
                    return (
                      <div key={p.id} className={`text-xs rounded p-1.5 ${p.confirmed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        <div className="font-medium truncate">{w?.full_name || '?'}</div>
                        {o && <div className="truncate opacity-75">{o.name}</div>}
                        {p.note && <div className="truncate opacity-60 italic">{p.note}</div>}
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => handleConfirm(p.id)} className="p-0.5 hover:bg-white/50 rounded" title={p.confirmed ? 'Отменить' : 'Подтвердить'}>
                            {p.confirmed ? <Check size={12} /> : <X size={12} />}
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-0.5 hover:bg-white/50 rounded text-red-600" title="Удалить">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {dayPlanning.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-2">—</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-700">📊 Сводка по рабочим на неделю</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600 border-b">
              <th className="px-4 py-2">Рабочий</th>
              {weekDays.map((d) => (
                <th key={d.toISOString()} className="px-2 py-2 text-center text-xs">
                  {format(d, 'EEE', { locale: ru })}
                </th>
              ))}
              <th className="px-4 py-2 text-center">Всего дней</th>
            </tr>
          </thead>
          <tbody>
            {workersWithPlanning.map((w) => {
              const workerPlanning = weekPlanning.filter((p) => p.worker_id === w.id);
              return (
                <tr key={w.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{w.full_name}</td>
                  {weekDays.map((d) => {
                    const dateStr = format(d, 'yyyy-MM-dd');
                    const has = workerPlanning.find((p) => p.date === dateStr);
                    return (
                      <td key={d.toISOString()} className="px-2 py-2 text-center">
                        {has ? (
                          <span className={`inline-block w-6 h-6 rounded-full ${has.confirmed ? 'bg-green-500' : 'bg-yellow-500'}`} title={has.confirmed ? 'Подтверждено' : 'Ожидает'} />
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-center font-bold">{workerPlanning.length}</td>
                </tr>
              );
            })}
            {workersWithPlanning.length === 0 && (
              <tr><td colSpan={9} className="text-center py-6 text-gray-400">Нет запланированных смен на эту неделю</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Забронировать рабочего</h3>
              <button onClick={resetForm}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Дата *</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" min={format(today, 'yyyy-MM-dd')} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Рабочий *</label>
                <select value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="">Выберите рабочего</option>
                  {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Объект</label>
                <select value={form.object_id} onChange={(e) => setForm({ ...form, object_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="">Не указан</option>
                  {objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Заметка</label>
                <input type="text" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Например: разгрузка с 8:00" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                Забронировать
              </button>
              <button onClick={resetForm} className="flex-1 border py-2 rounded-lg hover:bg-gray-50">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
