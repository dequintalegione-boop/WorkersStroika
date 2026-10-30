import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Shift, SortDirection } from '../types';
import { Plus, Pencil, Trash2, X, Search, Filter, Users } from 'lucide-react';
import { format } from 'date-fns';
import DetailModal from './DetailModal';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

// Generate time options with 15-min step
const timeOptions: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m of [0, 15, 30, 45]) {
    timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}

export default function Shifts() {
  const {
    shifts, workers, objects, partners,
    addShift, addShifts, updateShift, deleteShift,
    getObject, getWorker, calcHours, calcPartnerShare, getShiftSalary
  } = useStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterWorker, setFilterWorker] = useState('');
  const [filterObject, setFilterObject] = useState('');
  const [overridePartner, setOverridePartner] = useState(false);

  // Multi-select mode
  const [multiMode, setMultiMode] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<string[]>([]);
  const [individualSalaries, setIndividualSalaries] = useState(false);
  const [workerSalaries, setWorkerSalaries] = useState<Record<string, number>>({});

  // Sorting
  const [sortField, setSortField] = useState<string>('date');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  // Detail modal
  const [detailWorker, setDetailWorker] = useState<string | null>(null);

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
    comment: '',
    payment_type: 'hourly',
    volume_quantity: undefined,
    volume_unit: '',
    volume_rate: undefined
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
      comment: '',
      payment_type: 'hourly',
      volume_quantity: undefined,
      volume_unit: '',
      volume_rate: undefined
    });
    setEditingId(null);
    setOverridePartner(false);
    setMultiMode(false);
    setSelectedWorkers([]);
    setIndividualSalaries(false);
    setWorkerSalaries({});
    setShowForm(false);
  };

  const handleEdit = (s: Shift) => {
    setForm({ ...s });
    setEditingId(s.id);
    setOverridePartner(s.partner_share_override !== null);
    setMultiMode(false);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.date) return;

    if (multiMode) {
      // Запрет массового создания объёмных смен
      if (form.payment_type === 'volume') {
        alert('Массовое создание объёмных смен запрещено. Каждый рабочий должен иметь индивидуальный объём.');
        return;
      }
      if (selectedWorkers.length === 0) return;
      const newShifts: Omit<Shift, 'id'>[] = selectedWorkers.map((wid, idx) => {
        const salary = individualSalaries ? (workerSalaries[wid] || 0) : form.salary;
        return {
          ...form,
          number: shifts.length + idx + 1,
          worker_id: wid,
          salary,
        };
      });
      const result = addShifts(newShifts);
      if (!result.success) {
        alert(result.error);
        return;
      }
    } else {
      if (!form.worker_id) return;
      const shiftData = {
        ...form,
        partner_share_override: overridePartner ? form.partner_share_override : null
      };
      if (editingId) {
        const result = updateShift(editingId, shiftData);
        if (!result.success) {
          alert(result.error);
          return;
        }
      } else {
        const result = addShift(shiftData);
        if (!result.success) {
          alert(result.error);
          return;
        }
      }
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить смену?')) deleteShift(id);
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let result = shifts.filter((s) => {
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
    });

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortField) {
          case 'date': aVal = a.date; bVal = b.date; break;
          case 'worker': aVal = getWorker(a.worker_id)?.full_name || ''; bVal = getWorker(b.worker_id)?.full_name || ''; break;
          case 'object': aVal = a.object_id ? getObject(a.object_id)?.name || '' : ''; bVal = b.object_id ? getObject(b.object_id)?.name || '' : ''; break;
          case 'salary': aVal = getShiftSalary(a); bVal = getShiftSalary(b); break;
          case 'hours': aVal = calcHours(a); bVal = calcHours(b); break;
          case 'my_share': aVal = a.my_share; bVal = b.my_share; break;
          default: aVal = a.date; bVal = b.date;
        }
        if (typeof aVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return result;
  }, [shifts, filterDate, filterWorker, filterObject, search, sortField, sortDir, getWorker, getObject, calcHours]);

  const selectedObj = form.object_id ? getObject(form.object_id) : null;

  const toggleWorker = (wid: string) => {
    setSelectedWorkers((prev) =>
      prev.includes(wid) ? prev.filter((x) => x !== wid) : [...prev, wid]
    );
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field || !sortDir) return <span className="text-gray-300 ml-1">⇅</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

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
        <div className="flex items-center gap-2 flex-wrap">
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
              {!editingId && (
                <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg ${form.payment_type === 'volume' ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-blue-50'}`}>
                  <input type="checkbox" checked={multiMode} disabled={form.payment_type === 'volume'} onChange={(e) => {
                    if (form.payment_type === 'volume') return;
                    setMultiMode(e.target.checked);
                    if (!e.target.checked) { setSelectedWorkers([]); setIndividualSalaries(false); }
                  }} />
                  <Users size={16} className={form.payment_type === 'volume' ? 'text-gray-400' : 'text-blue-600'} />
                  <span className={`text-sm font-medium ${form.payment_type === 'volume' ? 'text-gray-500' : 'text-blue-700'}`}>
                    Добавить сразу нескольких рабочих
                  </span>
                  {form.payment_type === 'volume' && (
                    <span className="text-xs text-orange-600 ml-auto">Недоступно для объёмной оплаты</span>
                  )}
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">№</label>
                  <input type="number" value={form.number || ''} onChange={(e) => setForm({ ...form, number: +e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" placeholder="Авто" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Дата *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>

              {/* Multi-select workers */}
              {multiMode ? (
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">Выберите рабочих *</label>
                  <div className="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                    {workers.filter(w => !w.archived).map((w) => (
                      <label key={w.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={selectedWorkers.includes(w.id)} onChange={() => toggleWorker(w.id)} />
                        <span className="text-sm">{w.full_name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedWorkers.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">Выбрано: {selectedWorkers.length} рабочих</p>
                  )}

                  {/* Individual salaries */}
                  <label className="flex items-center gap-2 cursor-pointer mt-3 p-2 bg-yellow-50 rounded-lg">
                    <input type="checkbox" checked={individualSalaries} onChange={(e) => setIndividualSalaries(e.target.checked)} />
                    <span className="text-sm text-yellow-700">У каждого рабочая своя зарплата</span>
                  </label>
                  {individualSalaries && (
                    <div className="mt-2 space-y-2 border rounded-lg p-2 max-h-40 overflow-y-auto">
                      {selectedWorkers.map((wid) => {
                        const w = getWorker(wid);
                        return (
                          <div key={wid} className="flex items-center gap-2">
                            <span className="text-sm flex-1 truncate">{w?.full_name}</span>
                            <input type="number" value={workerSalaries[wid] || ''} placeholder="ЗП"
                              onChange={(e) => setWorkerSalaries({ ...workerSalaries, [wid]: +e.target.value })}
                              className="w-24 border rounded px-2 py-1 text-sm" />
                            <span className="text-xs text-gray-500">₽</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-sm text-gray-600">Рабочий *</label>
                  <select value={form.worker_id} onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2">
                    <option value="">Выберите рабочего</option>
                    {workers.filter(w => !w.archived || w.id === (editingId ? shifts.find(s => s.id === editingId)?.worker_id : '')).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name}{w.archived ? ' (в архиве)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm text-gray-600">Объект</label>
                <select value={form.object_id} onChange={(e) => {
                  const objId = e.target.value;
                  const obj = objId ? objects.find(o => o.id === objId) : null;
                  const newPaymentType = obj?.payment_type || 'hourly';
                  
                  // Если переключаемся на объёмный объект — отключаем массовый режим
                  let newMultiMode = multiMode;
                  let newSelectedWorkers = selectedWorkers;
                  let newWorkerSalaries = workerSalaries;
                  let newIndividualSalaries = individualSalaries;
                  
                  if (newPaymentType === 'volume' && multiMode) {
                    newMultiMode = false;
                    newSelectedWorkers = [];
                    newWorkerSalaries = {};
                    newIndividualSalaries = false;
                    alert('Массовое создание смен недоступно для объектов с оплатой за объём. Каждый рабочий должен иметь индивидуальный объём.');
                  }
                  
                  setForm({ 
                    ...form, 
                    object_id: objId,
                    payment_type: newPaymentType,
                    volume_unit: obj?.volume_unit || '',
                    volume_quantity: undefined,
                    volume_rate: undefined,
                    salary: newPaymentType === 'volume' || form.payment_type === 'volume' ? 0 : form.salary
                  });
                  setMultiMode(newMultiMode);
                  setSelectedWorkers(newSelectedWorkers);
                  setWorkerSalaries(newWorkerSalaries);
                  setIndividualSalaries(newIndividualSalaries);
                }}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="">Без объекта</option>
                  {objects.filter(o => !o.archived || o.id === form.object_id).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}{o.archived ? ' (в архиве)' : ''}
                    </option>
                  ))}
                </select>
                {selectedObj && (
                  <p className="text-xs text-gray-500 mt-1">
                    📍 {selectedObj.address} | {selectedObj.direction}
                  </p>
                )}
              </div>

              {!individualSalaries && form.payment_type === 'hourly' && (
                <div>
                  <label className="text-sm text-gray-600">Зарплата (₽)</label>
                  <input type="number" value={form.salary || ''} onChange={(e) => setForm({ ...form, salary: +e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" placeholder="0" />
                </div>
              )}

              {!individualSalaries && form.payment_type === 'volume' && (
                <div className="border rounded-lg p-3 bg-blue-50 space-y-2">
                  <p className="text-sm font-medium text-blue-700">💰 Оплата за объём</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Объём</label>
                      <input type="number" step="0.01" value={form.volume_quantity ?? ''}
                        onChange={(e) => {
                          const qty = e.target.value ? +e.target.value : undefined;
                          const rate = form.volume_rate || 0;
                          setForm({ ...form, volume_quantity: qty, salary: qty != null ? qty * rate : 0 });
                        }}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Ед. изм.</label>
                      <input type="text" value={form.volume_unit || ''}
                        onChange={(e) => setForm({ ...form, volume_unit: e.target.value })}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="м³" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Цена за ед. (₽)</label>
                      <input type="number" step="0.01" value={form.volume_rate ?? ''}
                        onChange={(e) => {
                          const rate = e.target.value ? +e.target.value : undefined;
                          const qty = form.volume_quantity || 0;
                          setForm({ ...form, volume_rate: rate, salary: rate != null ? qty * rate : 0 });
                        }}
                        className="w-full border rounded-lg px-2 py-1.5 text-sm" placeholder="0" />
                    </div>
                  </div>
                  {(form.volume_quantity != null && form.volume_rate != null) && (
                    <p className="text-sm font-bold text-green-700">
                      Итого: {new Intl.NumberFormat('ru-RU').format(form.volume_quantity * form.volume_rate)} ₽
                      <span className="font-normal text-gray-500 ml-2">
                        ({form.volume_quantity} {form.volume_unit || 'ед.'} × {form.volume_rate} ₽)
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Начало</label>
                  <select value={form.time_start} onChange={(e) => setForm({ ...form, time_start: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2">
                    <option value="">—</option>
                    {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Конец</label>
                  <select value={form.time_end} onChange={(e) => setForm({ ...form, time_end: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2">
                    <option value="">—</option>
                    {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Часы (вручную, мин)</label>
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
                <input type="number" value={form.my_share || ''} onChange={(e) => setForm({ ...form, my_share: +e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="0" />
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
                  <input type="number" value={form.partner_share_override ?? ''} placeholder="Доля партнёра"
                    onChange={(e) => setForm({ ...form, partner_share_override: e.target.value ? +e.target.value : null })}
                    className="w-full border rounded-lg px-3 py-2 mt-2" />
                )}
                {!overridePartner && !multiMode && form.worker_id && (
                  <p className="text-xs text-gray-500 mt-1">
                    Авто: {formatMoney(calcPartnerShare(form as Shift))}
                    {getWorker(form.worker_id)?.inviter_id === 'me' && ' (пригласил Я → 0)'}
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
                {editingId ? 'Сохранить' : multiMode ? `Создать ${selectedWorkers.length} смен` : 'Добавить'}
              </button>
              <button onClick={resetForm} className="flex-1 border py-2 rounded-lg hover:bg-gray-50">Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailWorker && (
        <DetailModal type="worker" id={detailWorker} onClose={() => setDetailWorker(null)} />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="px-3 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('date')}>
                № / Дата <SortIcon field="date" />
              </th>
              <th className="px-3 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('worker')}>
                Рабочий <SortIcon field="worker" />
              </th>
              <th className="px-3 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('object')}>
                Объект <SortIcon field="object" />
              </th>
              <th className="px-3 py-3">Направление</th>
              <th className="px-3 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('salary')}>
                ЗП <SortIcon field="salary" />
              </th>
              <th className="px-3 py-3">Время</th>
              <th className="px-3 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('hours')}>
                Часы <SortIcon field="hours" />
              </th>
              <th className="px-3 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('my_share')}>
                Моя доля <SortIcon field="my_share" />
              </th>
              <th className="px-3 py-3">Партнёру</th>
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
                  <td className="px-3 py-2">
                    <div className="text-xs text-gray-400">#{s.number}</div>
                    <div>{s.date}</div>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => w && setDetailWorker(w.id)}
                      className="font-medium text-left hover:text-blue-600 hover:underline">
                      {w?.full_name || '?'}
                    </button>
                  </td>
                  <td className="px-3 py-2">{o?.name || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{o?.direction || ''}</td>
                  <td className="px-3 py-2">{formatMoney(getShiftSalary(s))}</td>
                  <td className="px-3 py-2 text-xs">{s.time_start && s.time_end ? `${s.time_start}–${s.time_end}` : '—'}</td>
                  <td className="px-3 py-2">{formatMinutes(calcHours(s))}</td>
                  <td className="px-3 py-2 font-medium text-blue-600">{formatMoney(s.my_share)}</td>
                  <td className="px-3 py-2 text-orange-600">{formatMoney(ps)}</td>
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
              <tr><td colSpan={10} className="text-center py-8 text-gray-400">Нет смен</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">Показано: {filtered.length} из {shifts.length} смен</p>
    </div>
  );
}
