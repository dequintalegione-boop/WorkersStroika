import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { WorkObject, SortDirection } from '../types';
import { Plus, Pencil, Trash2, X, Archive } from 'lucide-react';
import DetailModal from './DetailModal';

export default function Objects() {
  const { objects, shifts, addObject, updateObject, deleteObject, archiveObject, calcHours, calcPartnerShare, getShiftSalary } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('number');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<WorkObject, 'id'>>({ number: objects.length + 1, name: '', direction: '', address: '', payment_type: 'hourly', volume_unit: '' });

  const resetForm = () => {
    setForm({ number: objects.length + 1, name: '', direction: '', address: '', payment_type: 'hourly', volume_unit: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (o: WorkObject) => {
    setForm({ number: o.number, name: o.name, direction: o.direction, address: o.address, payment_type: o.payment_type || 'hourly', volume_unit: o.volume_unit || '' });
    setEditingId(o.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      updateObject(editingId, form);
    } else {
      addObject(form);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    const result = deleteObject(id);
    if (!result.success) {
      alert(result.error);
    }
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : sortDir === 'desc' ? null : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field || !sortDir) return <span className="text-gray-300 ml-1">⇅</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const stats = useMemo(() => {
    let filteredObjects = objects.filter((o) => !o.archived);
    
    let result = filteredObjects.map((o) => {
      const objShifts = shifts.filter((s) => s.object_id === o.id);
      const workerIds = new Set(objShifts.map((s) => s.worker_id));
      const dates = objShifts.map((s) => s.date).sort();
      return {
        ...o,
        start: dates.length > 0 ? dates[0] : '',
        end: dates.length > 0 ? dates[dates.length - 1] : '',
        participants: workerIds.size,
        days_worked: new Set(dates).size,
        shifts_worked: objShifts.length,
        total_hours: objShifts.reduce((sum, s) => sum + calcHours(s), 0),
        workers_earned: objShifts.reduce((sum, s) => sum + getShiftSalary(s), 0),
        my_earned: objShifts.reduce((sum, s) => sum + s.my_share - calcPartnerShare(s), 0)
      };
    });

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortField) {
          case 'number': aVal = a.number; bVal = b.number; break;
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'direction': aVal = a.direction; bVal = b.direction; break;
          case 'shifts_worked': aVal = a.shifts_worked; bVal = b.shifts_worked; break;
          case 'total_hours': aVal = a.total_hours; bVal = b.total_hours; break;
          case 'workers_earned': aVal = a.workers_earned; bVal = b.workers_earned; break;
          case 'my_earned': aVal = a.my_earned; bVal = b.my_earned; break;
          default: aVal = a.number; bVal = b.number;
        }
        if (typeof aVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return result;
  }, [objects, shifts, calcHours, calcPartnerShare, sortField, sortDir]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">🏗️ Объекты</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          <Plus size={18} /> Добавить
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Редактировать' : 'Новый объект'}</h3>
              <button onClick={resetForm}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">Название *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Склад №5" />
              </div>
              <div>
                <label className="text-sm text-gray-600">№</label>
                <input type="number" value={form.number || ''} onChange={(e) => setForm({ ...form, number: +e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Авто" />
              </div>
              <div>
                <label className="text-sm text-gray-600">Направление</label>
                <input type="text" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Разгрузка щебня" />
              </div>
              <div>
                <label className="text-sm text-gray-600">Адрес</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="ул. Строителей, 15" />
              </div>
              <div>
                <label className="text-sm text-gray-600">Тип оплаты</label>
                <select value={form.payment_type || 'hourly'} onChange={(e) => setForm({ ...form, payment_type: e.target.value as 'hourly' | 'volume' })}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="hourly">За смену</option>
                  <option value="volume">За объём работ</option>
                </select>
              </div>
              {form.payment_type === 'volume' && (
                <div>
                  <label className="text-sm text-gray-600">Единица измерения</label>
                  <input type="text" value={form.volume_unit || ''} onChange={(e) => setForm({ ...form, volume_unit: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" placeholder="м³, м², тонна, рейс..." />
                </div>
              )}
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

      {detailId && (
        <DetailModal type="object" id={detailId} onClose={() => setDetailId(null)} />
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('number')}>№ <SortIcon field="number" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('name')}>Название <SortIcon field="name" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('direction')}>Направление <SortIcon field="direction" /></th>
              <th className="px-4 py-3">Адрес</th>
              <th className="px-4 py-3">Период</th>
              <th className="px-4 py-3">Участников</th>
              <th className="px-4 py-3">Дней</th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('shifts_worked')}>Смен <SortIcon field="shifts_worked" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('total_hours')}>Часы <SortIcon field="total_hours" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('workers_earned')}>ЗП рабочих <SortIcon field="workers_earned" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('my_earned')}>Мой доход <SortIcon field="my_earned" /></th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{o.number}</td>
                <td className="px-4 py-2">
                  <button onClick={() => setDetailId(o.id)} className="font-medium text-left hover:text-blue-600 hover:underline">
                    {o.name}
                  </button>
                </td>
                <td className="px-4 py-2">{o.direction}</td>
                <td className="px-4 py-2 text-gray-500">{o.address}</td>
                <td className="px-4 py-2 text-xs">{o.start && o.end ? `${o.start} — ${o.end}` : '—'}</td>
                <td className="px-4 py-2">{o.participants}</td>
                <td className="px-4 py-2">{o.days_worked}</td>
                <td className="px-4 py-2">{o.shifts_worked}</td>
                <td className="px-4 py-2">{Math.floor(o.total_hours / 60)}ч {o.total_hours % 60}м</td>
                <td className="px-4 py-2">{new Intl.NumberFormat('ru-RU').format(o.workers_earned)} ₽</td>
                <td className="px-4 py-2 font-medium text-green-600">{new Intl.NumberFormat('ru-RU').format(o.my_earned)} ₽</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(o)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={16} /></button>
                    <button onClick={() => { if (confirm('Завершить объект? Статистика сохранится, но объект не будет отображаться в списках выбора.')) archiveObject(o.id); }} className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" title="Завершить"><Archive size={16} /></button>
                    <button onClick={() => handleDelete(o.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {stats.length === 0 && (
              <tr><td colSpan={12} className="text-center py-8 text-gray-400">Нет объектов</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
