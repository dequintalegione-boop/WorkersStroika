import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Shift } from '../types';
import { Plus, Pencil, Trash2, X, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

export default function Shifts() {
  const {
    shifts, workers, objects, partners,
    addShift, updateShift, deleteShift,
    getObject, getWorker, calcHours, calcPartnerShare
  } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterWorker, setFilterWorker] = useState('');
  const [filterObject, setFilterObject] = useState('');
  const [overridePartner, setOverridePartner] = useState(false);

  const [form, setForm] = useState<Omit<Shift, 'id'>>({
    number: shifts.length + 1,
    date: format(new Date(), 'yyyy-MM-dd'),
    worker_id: '',
    object_id: '',
    salary: 0,
    time_start: '',
    time_end: '',
    hours_manual: null,
    my_share: 0,
    partner_share_override: null,
    review: '',
    comment: ''
  });

  const resetForm = () => {
    setForm({
      number: shifts.length + 1,
      date: format(new Date(), 'yyyy-MM-dd'),
      worker_id: '',
      object_id: '',
      salary: 0,
      time_start: '',
      time_end: '',
      hours_manual: null,
      my_share: 0,
      partner_share_override: null,
      review: '',
      comment: ''
    });
    setEditingId(null);
    setOverridePartner(false);
    setShowForm(false);
  };

  const handleEdit = (s: Shift) => {
    setForm({ ...s });
    setEditingId(s.id);
    setOverridePartner(s.partner_share_override !== null);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.worker_id || !form.date) return;
    const shiftData = {
      ...form,
      partner_share_override: overridePartner ? form.partner_share_override : null
    };
    if (editingId) {
      updateShift(editingId, shiftData);
    } else {
      addShift(shiftData);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить смену?')) deleteShift(id);
  };

  const filtered = useMemo(() => {
    return shifts.filter((s) => {
      if (filterDate && s.date !== filterDate) return false;
      if (filterWorker && s.worker_id !== filterWorker) return false;
      if (filterObject && s.object_id !== filterObject) return false;
      if (search) {
        const w = getWorker(s.worker_id);
        const o = s.object_id ? getObject(s.object_id) : null;
        const text = `${w?.full_name || ''} ${o?.name || ''} ${s.comment}`.toLowerCase();
        if (!text.includes(search.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
  }, [shifts, filterDate, filterWorker, filterObject, search, getWorker, getObject]);

  const selectedObj = form.object_id ? getObject(form.object_id) : null;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📅 Смены</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          <Plus size={18} /> Добавить смену
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm" />
          <select value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Все рабочие</option>
            {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
          <select value={filterObject} onChange={(e) => setFilterObject(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="">Все объекты</option>
            {objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {(filterDate || filterWorker || filterObject) && (
            <button onClick={() => { setFilterDate(''); setFilterWorker(''); setFilterObject(''); }}
              className="text-sm text-red-500 hover:text-red-700">Сбросить</button>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Редактировать смену' : 'Новая смена'}</h3>
              <button onClick={resetForm}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">№</label>
                  <input type="number" value={form.number} onChange={(e) => setForm({ ...form, number: +e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Дата *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
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
                  <option value="">Без объекта</option>
                  {objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {selectedObj && (
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {selectedObj.address} | {selectedObj.direction}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">Зарплата рабочего (₽)</label>
                <input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: +e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Начало</label>
                  <input type="time" value={form.time_start} onChange={(e) => setForm({ ...form, time_start: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Конец</label>
                  <input type="time" value={form.time_end} onChange={(e) => setForm({ ...form, time_end: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Часы (вручную)</label>
                  <input type="number" placeholder="авто" value={form.hours_manual ?? ''}
                    onChange={(e) => setForm({ ...form, hours_manual: e.target.value ? +e.target.value : null })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              {form.time_start && form.time_end && (
                <p className="text-xs text-gray-500">
                  ⏱ Авто-расчёт: {formatMinutes(calcHours(form as Shift))}
                </p>
              )}
              <div>
                <label className="text-sm text-gray-600">Моя доля (₽)</label>
                <input type="number" value={form.my_share} onChange={(e) => setForm({ ...form, my_share: +e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="border-t pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={overridePartner} onChange={(e) => {
                    setOverridePartner(e.target.checked);
                    if (!e.target.checked) setForm({ ...form, partner_share_override: null });
                  }} />
                  <span className="text-sm text-gray-600">Переопределить долю партнёра вручную</span>
                </label>
                {overridePartner && (
                  <input type="number" value={form.partner_share_override ?? 0}
                    onChange={(e) => setForm({ ...form, partner_share_override: +e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 mt-2" placeholder="Доля партнёра" />
                )}
                {!overridePartner && (
                  <p className="text-xs text-gray-500 mt-1">
                    Авто: {formatMoney(calcPartnerShare(form as Shift))}
                    {form.worker_id && getWorker(form.worker_id)?.inviter === 'Я' && ' (пригласил Я → 0)'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600">Отзыв</label>
                <input type="text" value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Отзыв о рабочем..." />
              </div>
              <div>
                <label className="text-sm text-gray-600">Комментарий</label>
                <input type="text" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Комментарий..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                {editingId ? 'Сохранить' : 'Добавить'}
              </button>
              <button onClick={resetForm} className="flex-1 border py-2 rounded-lg hover:bg-gray-50">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="px-3 py-3">№</th>
              <th className="px-3 py-3">Дата</th>
              <th className="px-3 py-3">Рабочий</th>
              <th className="px-3 py-3">Объект</th>
              <th className="px-3 py-3">Адрес</th>
              <th className="px-3 py-3">Направление</th>
              <th className="px-3 py-3">ЗП</th>
              <th className="px-3 py-3">Время</th>
              <th className="px-3 py-3">Часы</th>
              <th className="px-3 py-3">Моя доля</th>
              <th className="px-3 py-3">Партнёру</th>
              <th className="px-3 py-3">Пригласил</th>
              <th className="px-3 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const w = getWorker(s.worker_id);
              const o = s.object_id ? getObject(s.object_id) : null;
              const ps = calcPartnerShare(s);
              return (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{s.number}</td>
                  <td className="px-3 py-2">{s.date}</td>
                  <td className="px-3 py-2 font-medium">{w?.full_name || '?'}</td>
                  <td className="px-3 py-2">{o?.name || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{o?.address || ''}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{o?.direction || ''}</td>
                  <td className="px-3 py-2">{formatMoney(s.salary)}</td>
                  <td className="px-3 py-2 text-xs">{s.time_start && s.time_end ? `${s.time_start}-${s.time_end}` : '—'}</td>
                  <td className="px-3 py-2">{formatMinutes(calcHours(s))}</td>
                  <td className="px-3 py-2 font-medium text-blue-600">{formatMoney(s.my_share)}</td>
                  <td className="px-3 py-2 text-orange-600">{formatMoney(ps)}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded ${w?.inviter === 'Я' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {w?.inviter || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(s)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={16} /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={13} className="text-center py-8 text-gray-400">Нет смен</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">Показано: {filtered.length} из {shifts.length} смен</p>
    </div>
  );
}
