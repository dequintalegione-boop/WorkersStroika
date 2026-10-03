import { useMemo } from 'react';
import { useStore } from '../store';
import { X } from 'lucide-react';

interface DetailModalProps {
  type: 'worker' | 'partner' | 'object';
  id: string;
  onClose: () => void;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}ч ${m}м`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

export default function DetailModal({ type, id, onClose }: DetailModalProps) {
  const { workers, partners, objects, shifts, calcHours, calcPartnerShare, getWorker, getObject } = useStore();

  const data = useMemo(() => {
    if (type === 'worker') {
      const worker = workers.find((w) => w.id === id);
      if (!worker) return null;
      const workerShifts = shifts.filter((s) => s.worker_id === id);
      const totalHours = workerShifts.reduce((sum, s) => sum + calcHours(s), 0);
      const totalSalary = workerShifts.reduce((sum, s) => sum + s.salary, 0);
      const objectsWorked = new Set(workerShifts.filter((s) => s.object_id).map((s) => s.object_id));
      const avgSalary = workerShifts.length > 0 ? totalSalary / workerShifts.length : 0;
      const avgHourlyRate = totalHours > 0 ? totalSalary / (totalHours / 60) : 0;
      
      // Расчёт вклада: сколько принёс мне и партнёру
      const totalMyShare = workerShifts.reduce((sum, s) => sum + s.my_share, 0);
      const totalPartnerShare = workerShifts.reduce((sum, s) => sum + calcPartnerShare(s), 0);
      const myNetFromWorker = totalMyShare - totalPartnerShare;

      return {
        title: worker.full_name,
        subtitle: `Рабочий #${worker.number}`,
        info: [
          { label: 'Возраст', value: worker.age },
          { label: 'Телефон', value: worker.phone || '—' },
          { label: 'Пригласил', value: worker.inviter },
          { label: 'Дата начала', value: worker.start_date || '—' },
        ],
        stats: [
          { label: 'Всего смен', value: workerShifts.length, color: 'blue' },
          { label: 'Общее время', value: formatMinutes(totalHours), color: 'purple' },
          { label: 'Заработок (ЗП)', value: formatMoney(totalSalary), color: 'green' },
          { label: 'Средняя ЗП/смена', value: formatMoney(avgSalary), color: 'orange' },
          { label: 'Часовая ставка', value: formatMoney(avgHourlyRate), color: 'cyan' },
          { label: 'Объектов', value: objectsWorked.size, color: 'indigo' },
          { label: '💰 Принёс мне (чистыми)', value: formatMoney(myNetFromWorker), color: 'green' },
          ...(worker.inviter !== 'Я' ? [{ label: '🤝 Принёс партнёру', value: formatMoney(totalPartnerShare), color: 'orange' }] : []),
        ],
        shifts: workerShifts.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
      };
    }

    if (type === 'partner') {
      const partner = partners.find((p) => p.id === id);
      if (!partner) return null;
      const invitedWorkers = workers.filter((w) => w.inviter === partner.full_name);
      const workerIds = invitedWorkers.map((w) => w.id);
      const partnerShifts = shifts.filter((s) => workerIds.includes(s.worker_id));
      const totalHours = partnerShifts.reduce((sum, s) => sum + calcHours(s), 0);
      const totalEarnings = partnerShifts.reduce((sum, s) => sum + calcPartnerShare(s), 0);

      return {
        title: partner.full_name,
        subtitle: `Партнёр #${partner.number}`,
        info: [
          { label: 'Приглашено рабочих', value: invitedWorkers.length },
        ],
        stats: [
          { label: 'Смен отработано', value: partnerShifts.length, color: 'blue' },
          { label: 'Общее время', value: formatMinutes(totalHours), color: 'purple' },
          { label: 'Заработок', value: formatMoney(totalEarnings), color: 'green' },
        ],
        shifts: partnerShifts.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
      };
    }

    if (type === 'object') {
      const obj = objects.find((o) => o.id === id);
      if (!obj) return null;
      const objShifts = shifts.filter((s) => s.object_id === id);
      const totalHours = objShifts.reduce((sum, s) => sum + calcHours(s), 0);
      const totalSalary = objShifts.reduce((sum, s) => sum + s.salary, 0);
      const myEarned = objShifts.reduce((sum, s) => sum + s.my_share - calcPartnerShare(s), 0);
      const uniqueWorkers = new Set(objShifts.map((s) => s.worker_id));
      const uniqueDays = new Set(objShifts.map((s) => s.date));
      const dates = objShifts.map((s) => s.date).sort();

      return {
        title: obj.name,
        subtitle: `Объект #${obj.number}`,
        info: [
          { label: 'Адрес', value: obj.address || '—' },
          { label: 'Направление', value: obj.direction || '—' },
          { label: 'Период', value: dates.length > 0 ? `${dates[0]} — ${dates[dates.length - 1]}` : '—' },
        ],
        stats: [
          { label: 'Всего смен', value: objShifts.length, color: 'blue' },
          { label: 'Рабочих дней', value: uniqueDays.size, color: 'purple' },
          { label: 'Уникальных рабочих', value: uniqueWorkers.size, color: 'indigo' },
          { label: 'Общее время', value: formatMinutes(totalHours), color: 'cyan' },
          { label: 'ЗП рабочих', value: formatMoney(totalSalary), color: 'orange' },
          { label: 'Мой доход', value: formatMoney(myEarned), color: 'green' },
        ],
        shifts: objShifts.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
      };
    }

    return null;
  }, [type, id, workers, partners, objects, shifts, calcHours, calcPartnerShare]);

  if (!data) return null;

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{data.title}</h3>
            <p className="text-sm text-gray-500">{data.subtitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.info.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="font-medium text-sm">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data.stats.map((stat, i) => (
              <div key={i} className={`rounded-lg border p-3 ${colorMap[stat.color] || colorMap.blue}`}>
                <p className="text-xs opacity-70">{stat.label}</p>
                <p className="text-lg font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Recent shifts */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Последние смены ({data.shifts.length})</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-600">
                    <th className="px-3 py-2">Дата</th>
                    {type !== 'worker' && <th className="px-3 py-2">Рабочий</th>}
                    {type !== 'object' && <th className="px-3 py-2">Объект</th>}
                    <th className="px-3 py-2">Время</th>
                    <th className="px-3 py-2">ЗП</th>
                    <th className="px-3 py-2">Моя доля</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shifts.map((s) => {
                    const w = getWorker(s.worker_id);
                    const o = s.object_id ? getObject(s.object_id) : null;
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-1.5">{s.date}</td>
                        {type !== 'worker' && <td className="px-3 py-1.5">{w?.full_name || '?'}</td>}
                        {type !== 'object' && <td className="px-3 py-1.5">{o?.name || '—'}</td>}
                        <td className="px-3 py-1.5 text-xs">
                          {s.time_start && s.time_end ? `${s.time_start}–${s.time_end}` : '—'}
                        </td>
                        <td className="px-3 py-1.5">{formatMoney(s.salary)}</td>
                        <td className="px-3 py-1.5 text-blue-600">{formatMoney(s.my_share)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
