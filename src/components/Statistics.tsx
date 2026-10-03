import { useMemo } from 'react';
import { useStore } from '../store';

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}ч ${m}м`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

export default function Statistics() {
  const { workers, partners, shifts, calcHours, calcPartnerShare, getWorker } = useStore();

  // Worker stats
  const workerStats = useMemo(() => {
    return workers.map((w) => {
      const ws = shifts.filter((s) => s.worker_id === w.id);
      return {
        ...w,
        shifts_count: ws.length,
        total_hours: ws.reduce((sum, s) => sum + calcHours(s), 0),
        total_earned: ws.reduce((sum, s) => sum + s.salary, 0)
      };
    }).sort((a, b) => b.total_earned - a.total_earned);
  }, [workers, shifts, calcHours]);

  // Partner stats
  const partnerStats = useMemo(() => {
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
    }).sort((a, b) => b.earnings - a.earnings);
  }, [partners, workers, shifts, calcPartnerShare, calcHours]);

  // "Me" block
  const myStats = useMemo(() => {
    const totalWorkers = workers.length;
    const totalShifts = shifts.length;
    const totalHours = shifts.reduce((sum, s) => sum + calcHours(s), 0);
    const totalMyShare = shifts.reduce((sum, s) => sum + s.my_share, 0);
    const totalPartnerShare = shifts.reduce((sum, s) => sum + calcPartnerShare(s), 0);
    return {
      totalWorkers,
      totalShifts,
      totalHours,
      myEarned: totalMyShare - totalPartnerShare
    };
  }, [workers, shifts, calcHours, calcPartnerShare]);

  // Tops
  const topWorkersByEarn = useMemo(() => [...workerStats].sort((a, b) => b.total_earned - a.total_earned).slice(0, 3), [workerStats]);
  const topWorkersByHours = useMemo(() => [...workerStats].sort((a, b) => b.total_hours - a.total_hours).slice(0, 3), [workerStats]);
  const topWorkersByShifts = useMemo(() => [...workerStats].sort((a, b) => b.shifts_count - a.shifts_count).slice(0, 3), [workerStats]);
  const topPartnersByEarn = useMemo(() => [...partnerStats].sort((a, b) => b.earnings - a.earnings).slice(0, 3), [partnerStats]);
  const topPartnersByReferrals = useMemo(() => [...partnerStats].sort((a, b) => b.invited_count - a.invited_count).slice(0, 3), [partnerStats]);
  const topPartnersByShifts = useMemo(() => [...partnerStats].sort((a, b) => b.shifts_count - a.shifts_count).slice(0, 3), [partnerStats]);

  return (
    <div className="p-6 space-y-6 overflow-auto">
      <h2 className="text-2xl font-bold text-gray-800">📈 Статистика</h2>

      {/* "Me" block */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
        <h3 className="text-lg font-bold mb-3">👤 Блок «Я» (Владелец)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm opacity-80">Всего рабочих</p>
            <p className="text-2xl font-bold">{myStats.totalWorkers}</p>
          </div>
          <div>
            <p className="text-sm opacity-80">Всего смен</p>
            <p className="text-2xl font-bold">{myStats.totalShifts}</p>
          </div>
          <div>
            <p className="text-sm opacity-80">Общее время</p>
            <p className="text-2xl font-bold">{formatMinutes(myStats.totalHours)}</p>
          </div>
          <div>
            <p className="text-sm opacity-80">Заработано</p>
            <p className="text-2xl font-bold">{formatMoney(myStats.myEarned)}</p>
          </div>
        </div>
      </div>

      {/* Worker stats table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-700">👷 Статистика по рабочим</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Смен</th>
                <th className="px-4 py-3">Время</th>
                <th className="px-4 py-3">Заработок</th>
              </tr>
            </thead>
            <tbody>
              {workerStats.map((w, i) => (
                <tr key={w.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{w.full_name}</td>
                  <td className="px-4 py-2">{w.shifts_count}</td>
                  <td className="px-4 py-2">{formatMinutes(w.total_hours)}</td>
                  <td className="px-4 py-2 font-medium">{formatMoney(w.total_earned)}</td>
                </tr>
              ))}
              {workerStats.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">Нет данных</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner stats table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-700">🤝 Статистика по партнёрам</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="px-4 py-3">№</th>
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Приглашено</th>
                <th className="px-4 py-3">Смен</th>
                <th className="px-4 py-3">Время</th>
                <th className="px-4 py-3">Заработок</th>
              </tr>
            </thead>
            <tbody>
              {partnerStats.map((p, i) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{p.full_name}</td>
                  <td className="px-4 py-2">{p.invited_count}</td>
                  <td className="px-4 py-2">{p.shifts_count}</td>
                  <td className="px-4 py-2">{formatMinutes(p.total_hours)}</td>
                  <td className="px-4 py-2 font-medium text-green-600">{formatMoney(p.earnings)}</td>
                </tr>
              ))}
              {partnerStats.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-gray-400">Нет данных</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tops */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">🏆 Топ рабочих по доходу</h3>
          <div className="space-y-2">
            {topWorkersByEarn.map((w, i) => (
              <div key={w.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                  <span className="font-medium">{w.full_name}</span>
                </span>
                <span className="font-bold text-green-600">{formatMoney(w.total_earned)}</span>
              </div>
            ))}
            {topWorkersByEarn.length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">⏱ Топ рабочих по часам</h3>
          <div className="space-y-2">
            {topWorkersByHours.map((w, i) => (
              <div key={w.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                  <span className="font-medium">{w.full_name}</span>
                </span>
                <span className="font-bold text-purple-600">{formatMinutes(w.total_hours)}</span>
              </div>
            ))}
            {topWorkersByHours.length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">📅 Топ рабочих по сменам</h3>
          <div className="space-y-2">
            {topWorkersByShifts.map((w, i) => (
              <div key={w.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                  <span className="font-medium">{w.full_name}</span>
                </span>
                <span className="font-bold text-blue-600">{w.shifts_count} смен</span>
              </div>
            ))}
            {topWorkersByShifts.length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">💰 Топ партнёров по доходу</h3>
          <div className="space-y-2">
            {topPartnersByEarn.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                  <span className="font-medium">{p.full_name}</span>
                </span>
                <span className="font-bold text-green-600">{formatMoney(p.earnings)}</span>
              </div>
            ))}
            {topPartnersByEarn.length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">👥 Топ партнёров по рефералам</h3>
          <div className="space-y-2">
            {topPartnersByReferrals.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                  <span className="font-medium">{p.full_name}</span>
                </span>
                <span className="font-bold text-indigo-600">{p.invited_count} чел.</span>
              </div>
            ))}
            {topPartnersByReferrals.length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">📋 Топ партнёров по сменам</h3>
          <div className="space-y-2">
            {topPartnersByShifts.map((p, i) => (
              <div key={p.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{['🥇', '🥈', '🥉'][i]}</span>
                  <span className="font-medium">{p.full_name}</span>
                </span>
                <span className="font-bold text-orange-600">{p.shifts_count} смен</span>
              </div>
            ))}
            {topPartnersByShifts.length === 0 && <p className="text-gray-400 text-sm">Нет данных</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
