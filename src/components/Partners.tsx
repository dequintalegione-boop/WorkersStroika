import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Partner, SortDirection } from '../types';
import { Plus, Pencil, Trash2, X, Archive } from 'lucide-react';
import DetailModal from './DetailModal';

export default function Partners() {
  const { partners, workers, shifts, addPartner, updatePartner, deletePartner, archivePartner, calcPartnerShare, calcHours } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('number');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Partner, 'id'>>({ number: partners.length + 1, full_name: '' });

  const resetForm = () => {
    setForm({ number: partners.length + 1, full_name: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (p: Partner) => {
    setForm({ number: p.number, full_name: p.full_name });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.full_name.trim()) return;
    if (editingId) {
      updatePartner(editingId, form);
    } else {
      addPartner(form);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    const result = deletePartner(id);
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
    let result = partners.filter(p => !p.archived).map((p) => {
      const invitedWorkers = workers.filter((w) => w.inviter_id === p.id);
      const workerIds = invitedWorkers.map((w) => w.id);
      const partnerShifts = shifts.filter((s) => workerIds.includes(s.worker_id));
      return {
        ...p,
        invited_count: invitedWorkers.length,
        shifts_count: partnerShifts.length,
        total_hours: partnerShifts.reduce((sum, s) => sum + calcHours(s), 0),
        earnings: partnerShifts.reduce((sum, s) => sum + calcPartnerShare(s), 0)
      };
    });

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortField) {
          case 'number': aVal = a.number; bVal = b.number; break;
          case 'full_name': aVal = a.full_name; bVal = b.full_name; break;
          case 'invited_count': aVal = a.invited_count; bVal = b.invited_count; break;
          case 'shifts_count': aVal = a.shifts_count; bVal = b.shifts_count; break;
          case 'total_hours': aVal = a.total_hours; bVal = b.total_hours; break;
          case 'earnings': aVal = a.earnings; bVal = b.earnings; break;
          default: aVal = a.number; bVal = b.number;
        }
        if (typeof aVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return result;
  }, [partners, workers, shifts, calcPartnerShare, calcHours, sortField, sortDir]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">🤝 Партнёры</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          <Plus size={18} /> Добавить
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Редактировать' : 'Новый партнёр'}</h3>
              <button onClick={resetForm}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">ФИО *</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Петров Пётр Петрович" />
              </div>
              <div>
                <label className="text-sm text-gray-600">№</label>
                <input type="number" value={form.number || ''} onChange={(e) => setForm({ ...form, number: +e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Авто" />
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

      {detailId && (
        <DetailModal type="partner" id={detailId} onClose={() => setDetailId(null)} />
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('number')}>№ <SortIcon field="number" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('full_name')}>ФИО <SortIcon field="full_name" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('invited_count')}>Приглашено <SortIcon field="invited_count" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('shifts_count')}>Смен <SortIcon field="shifts_count" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('total_hours')}>Часы <SortIcon field="total_hours" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('earnings')}>Заработок <SortIcon field="earnings" /></th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{p.number}</td>
                <td className="px-4 py-2">
                  <button onClick={() => setDetailId(p.id)} className="font-medium text-left hover:text-blue-600 hover:underline">
                    {p.full_name}
                  </button>
                </td>
                <td className="px-4 py-2">{p.invited_count}</td>
                <td className="px-4 py-2">{p.shifts_count}</td>
                <td className="px-4 py-2">{Math.floor(p.total_hours / 60)}ч {p.total_hours % 60}м</td>
                <td className="px-4 py-2 font-medium text-green-600">{new Intl.NumberFormat('ru-RU').format(p.earnings)} ₽</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(p)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={16} /></button>
                    <button onClick={() => { if (confirm('Архивировать партнёра? Связи сохранятся, но партнёр не будет отображаться в активных списках.')) archivePartner(p.id); }} className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" title="В архив"><Archive size={16} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {stats.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Нет партнёров</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
