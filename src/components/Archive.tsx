import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { ArchiveRestore, Search, Users, MapPin, UserCheck } from 'lucide-react';

type ArchiveTab = 'workers' | 'objects' | 'partners';

export default function Archive() {
  const { workers, objects, partners, shifts, unarchiveWorker, unarchiveObject, unarchivePartner, getInviterName, calcHours } = useStore();
  const [activeTab, setActiveTab] = useState<ArchiveTab>('workers');
  const [search, setSearch] = useState('');

  const archivedWorkers = useMemo(() => {
    return workers.filter(w => w.archived).filter(w =>
      w.full_name.toLowerCase().includes(search.toLowerCase()) ||
      w.phone.includes(search)
    );
  }, [workers, search]);

  const archivedObjects = useMemo(() => {
    return objects.filter(o => o.archived).filter(o =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.direction.toLowerCase().includes(search.toLowerCase())
    );
  }, [objects, search]);

  const archivedPartners = useMemo(() => {
    return partners.filter(p => p.archived).filter(p =>
      p.full_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [partners, search]);

  const counts = {
    workers: workers.filter(w => w.archived).length,
    objects: objects.filter(o => o.archived).length,
    partners: partners.filter(p => p.archived).length,
  };

  const getWorkerStats = (workerId: string) => {
    const ws = shifts.filter(s => s.worker_id === workerId);
    return { shifts: ws.length, hours: ws.reduce((sum, s) => sum + calcHours(s), 0) };
  };

  const getObjectStats = (objectId: string) => {
    const os = shifts.filter(s => s.object_id === objectId);
    const dates = os.map(s => s.date).sort();
    return { shifts: os.length, start: dates[0] || '', end: dates[dates.length - 1] || '' };
  };

  const getPartnerStats = (partnerId: string) => {
    const invitedWorkers = workers.filter(w => w.inviter_id === partnerId);
    const workerIds = invitedWorkers.map(w => w.id);
    const partnerShifts = shifts.filter(s => workerIds.includes(s.worker_id));
    return { invited: invitedWorkers.length, shifts: partnerShifts.length };
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📦 Архив</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('workers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            activeTab === 'workers' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Users size={18} />
          <span>Рабочие</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{counts.workers}</span>
        </button>
        <button
          onClick={() => setActiveTab('objects')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            activeTab === 'objects' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <MapPin size={18} />
          <span>Объекты</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{counts.objects}</span>
        </button>
        <button
          onClick={() => setActiveTab('partners')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            activeTab === 'partners' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <UserCheck size={18} />
          <span>Партнёры</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{counts.partners}</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск в архиве..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg"
        />
      </div>

      {/* Workers */}
      {activeTab === 'workers' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Телефон</th>
                <th className="px-4 py-3">Дата начала</th>
                <th className="px-4 py-3">Пригласил</th>
                <th className="px-4 py-3">Смен</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {archivedWorkers.map(w => {
                const stats = getWorkerStats(w.id);
                return (
                  <tr key={w.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{w.number}</td>
                    <td className="px-4 py-2 font-medium">{w.full_name}</td>
                    <td className="px-4 py-2">{w.phone || '—'}</td>
                    <td className="px-4 py-2">{w.start_date || '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${w.inviter_id === 'me' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {getInviterName(w.inviter_id)}
                      </span>
                    </td>
                    <td className="px-4 py-2">{stats.shifts}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => unarchiveWorker(w.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs"
                      >
                        <ArchiveRestore size={14} />
                        Восстановить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {archivedWorkers.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Нет архивных рабочих</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Objects */}
      {activeTab === 'objects' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Направление</th>
                <th className="px-4 py-3">Адрес</th>
                <th className="px-4 py-3">Смен</th>
                <th className="px-4 py-3">Период</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {archivedObjects.map(o => {
                const stats = getObjectStats(o.id);
                return (
                  <tr key={o.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{o.number}</td>
                    <td className="px-4 py-2 font-medium">{o.name}</td>
                    <td className="px-4 py-2">{o.direction}</td>
                    <td className="px-4 py-2 text-gray-500">{o.address}</td>
                    <td className="px-4 py-2">{stats.shifts}</td>
                    <td className="px-4 py-2 text-xs">{stats.start && stats.end ? `${stats.start} — ${stats.end}` : '—'}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => unarchiveObject(o.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs"
                      >
                        <ArchiveRestore size={14} />
                        Восстановить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {archivedObjects.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Нет архивных объектов</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Partners */}
      {activeTab === 'partners' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Приглашено</th>
                <th className="px-4 py-3">Смен</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {archivedPartners.map(p => {
                const stats = getPartnerStats(p.id);
                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{p.number}</td>
                    <td className="px-4 py-2 font-medium">{p.full_name}</td>
                    <td className="px-4 py-2">{stats.invited}</td>
                    <td className="px-4 py-2">{stats.shifts}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => unarchivePartner(p.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs"
                      >
                        <ArchiveRestore size={14} />
                        Восстановить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {archivedPartners.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Нет архивных партнёров</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
