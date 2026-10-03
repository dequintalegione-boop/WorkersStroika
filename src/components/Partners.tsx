import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Partner } from '../types';
import { Plus, Pencil, Trash2, X } from 'lucide-react';

export default function Partners() {
  const { partners, workers, shifts, addPartner, updatePartner, deletePartner, calcPartnerShare, calcHours } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
    const partner = partners.find((p) => p.id === id);
    if (confirm(`Удалить партнёра "${partner?.full_name}"? Рабочие, которых он привёл, останутся.`)) {
      deletePartner(id);
    }
  };

  const stats = useMemo(() => {
    return partners.map((p) => {
      const invitedWorkers = workers.filter((w) => w.inviter === p.full_name);
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
  }, [partners, workers, shifts, calcPartnerShare, calcHours]);

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
                <input type="number" value={form.number} onChange={(e) => setForm({ ...form, number: +e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" />
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

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3">№</th>
              <th className="px-4 py-3">ФИО</th>
              <th className="px-4 py-3">Приглашено</th>
              <th className="px-4 py-3">Смен отработано</th>
              <th className="px-4 py-3">Часы</th>
              <th className="px-4 py-3">Заработок</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{p.number}</td>
                <td className="px-4 py-2 font-medium">{p.full_name}</td>
                <td className="px-4 py-2">{p.invited_count}</td>
                <td className="px-4 py-2">{p.shifts_count}</td>
                <td className="px-4 py-2">{Math.floor(p.total_hours / 60)}ч {p.total_hours % 60}м</td>
                <td className="px-4 py-2 font-medium text-green-600">{new Intl.NumberFormat('ru-RU').format(p.earnings)} ₽</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(p)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={16} /></button>
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
