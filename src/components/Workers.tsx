import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { Worker, SortDirection } from '../types';
import { Plus, Pencil, Trash2, X, Search, Archive, ArchiveRestore } from 'lucide-react';
import DetailModal from './DetailModal';

export default function Workers() {
  const { workers, partners, addWorker, updateWorker, deleteWorker, archiveWorker, unarchiveWorker, shifts, calcHours, getInviterName } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('number');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [form, setForm] = useState<Omit<Worker, 'id'>>({
    number: workers.length + 1, full_name: '', age: 0, phone: '', inviter_id: 'me', start_date: ''
  });

  const resetForm = () => {
    setForm({ number: workers.length + 1, full_name: '', age: 0, phone: '', inviter_id: 'me', start_date: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (w: Worker) => {
    setForm({ number: w.number, full_name: w.full_name, age: w.age, phone: w.phone, inviter_id: w.inviter_id, start_date: w.start_date });
    setEditingId(w.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.full_name.trim()) return;
    if (editingId) {
      updateWorker(editingId, form);
    } else {
      addWorker(form);
    }
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (confirm('Удалить рабочего? Связанные смены останутся.')) {
      deleteWorker(id);
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

  const filtered = useMemo(() => {
    let result = workers.filter((w) => {
      if (showArchived) return w.archived === true;
      return !w.archived;
    }).filter((w) =>
      w.full_name.toLowerCase().includes(search.toLowerCase()) ||
      w.phone.includes(search)
    );

    if (sortField && sortDir) {
      result = [...result].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortField) {
          case 'number': aVal = a.number; bVal = b.number; break;
          case 'full_name': aVal = a.full_name; bVal = b.full_name; break;
          case 'age': aVal = a.age; bVal = b.age; break;
          case 'inviter': aVal = getInviterName(a.inviter_id); bVal = getInviterName(b.inviter_id); break;
          case 'start_date': aVal = a.start_date; bVal = b.start_date; break;
          case 'shifts': aVal = shifts.filter((s) => s.worker_id === a.id).length; bVal = shifts.filter((s) => s.worker_id === b.id).length; break;
          case 'earned': aVal = shifts.filter((s) => s.worker_id === a.id).reduce((sum, s) => sum + s.salary, 0); bVal = shifts.filter((s) => s.worker_id === b.id).reduce((sum, s) => sum + s.salary, 0); break;
          default: aVal = a.number; bVal = b.number;
        }
        if (typeof aVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }

    return result;
  }, [workers, search, sortField, sortDir, shifts, getInviterName]);

  const getWorkerStats = (workerId: string) => {
    const ws = shifts.filter((s) => s.worker_id === workerId);
    return {
      shifts: ws.length,
      hours: ws.reduce((sum, s) => sum + calcHours(s), 0),
      earned: ws.reduce((sum, s) => sum + s.salary, 0)
    };
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">👷 Рабочие</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
          <Plus size={18} /> Добавить
        </button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="Поиск по имени или телефону..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg" />
        </div>
        <button onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition ${showArchived ? 'bg-yellow-100 border-yellow-300 text-yellow-700' : 'bg-white hover:bg-gray-50'}`}>
          <Archive size={16} />
          <span className="text-sm">{showArchived ? 'Показать активных' : 'Архив'}</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{editingId ? 'Редактировать' : 'Новый рабочий'}</h3>
              <button onClick={resetForm}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600">ФИО *</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="Иванов Иван Иванович" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">№</label>
                  <input type="number" value={form.number || ''} onChange={(e) => setForm({ ...form, number: +e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" placeholder="Авто" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Возраст</label>
                  <input type="number" value={form.age || ''} onChange={(e) => setForm({ ...form, age: +e.target.value })}
                    className="w-full border rounded-lg px-3 py-2" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600">Телефон</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2" placeholder="+7..." />
              </div>
              <div>
                <label className="text-sm text-gray-600">Кто пригласил</label>
                <select value={form.inviter_id} onChange={(e) => setForm({ ...form, inviter_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2">
                  <option value="me">Я</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Дата начала</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
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

      {detailId && (
        <DetailModal type="worker" id={detailId} onClose={() => setDetailId(null)} />
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-600">
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('number')}>№ <SortIcon field="number" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('full_name')}>ФИО <SortIcon field="full_name" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('age')}>Возраст <SortIcon field="age" /></th>
              <th className="px-4 py-3">Телефон</th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('inviter')}>Пригласил <SortIcon field="inviter" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('start_date')}>Дата начала <SortIcon field="start_date" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('shifts')}>Смен <SortIcon field="shifts" /></th>
              <th className="px-4 py-3 cursor-pointer hover:text-blue-600" onClick={() => toggleSort('earned')}>Заработок <SortIcon field="earned" /></th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => {
              const stats = getWorkerStats(w.id);
              const inviterName = getInviterName(w.inviter_id);
              return (
                <tr key={w.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{w.number}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => setDetailId(w.id)} className="font-medium text-left hover:text-blue-600 hover:underline">
                      {w.full_name}
                    </button>
                  </td>
                  <td className="px-4 py-2">{w.age || '—'}</td>
                  <td className="px-4 py-2">{w.phone || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${w.inviter_id === 'me' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {inviterName}
                    </span>
                  </td>
                  <td className="px-4 py-2">{w.start_date || '—'}</td>
                  <td className="px-4 py-2">{stats.shifts}</td>
                  <td className="px-4 py-2 font-medium">{new Intl.NumberFormat('ru-RU').format(stats.earned)} ₽</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(w)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600"><Pencil size={16} /></button>
                      {w.archived ? (
                        <button onClick={() => unarchiveWorker(w.id)} className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Восстановить"><ArchiveRestore size={16} /></button>
                      ) : (
                        <button onClick={() => { if (confirm('Отправить в архив? Статистика сохранится, но рабочий не будет отображаться в списках выбора.')) archiveWorker(w.id); }} className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600" title="В архив"><Archive size={16} /></button>
                      )}
                      <button onClick={() => handleDelete(w.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Нет рабочих. Добавьте первого!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
