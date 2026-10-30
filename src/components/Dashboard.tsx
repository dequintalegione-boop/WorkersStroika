import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { DashboardMode } from '../types';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format, startOfWeek, addWeeks, isWithinInterval, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}ч ${m}м`;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const { shifts, workers, objects, partners, financeTransactions, payrollAccruals, calcHours, calcPartnerShare, getWorker, getObject, getShiftSalary } = useStore();

  const today = format(new Date(), 'yyyy-MM-dd');
  const monthAgo = format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd');
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('active');
  const periodTransactions = financeTransactions.filter(item => item.date >= dateFrom && item.date <= dateTo);
  const paidTransactions = periodTransactions.filter(item => item.status === 'paid');
  const pendingExpenses = periodTransactions.filter(item => item.status === 'planned' && item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const receivedIncome = paidTransactions.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const paidExpenses = paidTransactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const totalPayroll = payrollAccruals.filter(item => item.date >= dateFrom && item.date <= dateTo).reduce((sum, item) => sum + item.amount, 0);

  const filteredShifts = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    return shifts.filter((s) => {
      const d = s.date;
      const inDateRange = d >= dateFrom && d <= dateTo;
      if (!inDateRange) return false;
      
      if (dashboardMode === 'active') {
        const worker = getWorker(s.worker_id);
        const obj = s.object_id ? getObject(s.object_id) : null;
        // Exclude shifts with missing worker
        if (!worker) return false;
        // Exclude archived workers
        if (worker.archived) return false;
        // Смена с указанным, но отсутствующим объектом не считается активной.
        if (s.object_id && !obj) return false;
        // Смены без объекта разрешены; архивные объекты исключаются.
        if (obj?.archived) return false;
      }
      return true;
    });
  }, [shifts, dateFrom, dateTo, dashboardMode, getWorker, getObject]);

  const kpi = useMemo(() => {
    const myNet = filteredShifts.reduce((sum, s) => sum + s.my_share - calcPartnerShare(s), 0);
    const totalShifts = filteredShifts.length;
    const totalHours = filteredShifts.reduce((sum, s) => sum + calcHours(s), 0);
    const totalSalary = filteredShifts.reduce((sum, s) => sum + getShiftSalary(s), 0);
    const totalPartner = filteredShifts.reduce((sum, s) => sum + calcPartnerShare(s), 0);
    const avgCheck = totalShifts > 0 ? totalSalary / totalShifts : 0;
    const activeWorkers = new Set(filteredShifts.map((s) => s.worker_id)).size;
    const activeObjects = new Set(filteredShifts.filter((s) => s.object_id).map((s) => s.object_id)).size;
    const avgHourlyRate = totalHours > 0 ? totalSalary / (totalHours / 60) : 0;
    const partnerShareRatio = filteredShifts.reduce((s, x) => s + x.my_share, 0) > 0
      ? totalPartner / filteredShifts.reduce((s, x) => s + x.my_share, 0) * 100 : 0;

    return { myNet, totalShifts, totalHours, totalSalary, totalPartner, avgCheck, activeWorkers, activeObjects, avgHourlyRate, partnerShareRatio };
  }, [filteredShifts, calcPartnerShare, calcHours]);

  // Weekly dynamics
  const weeklyData = useMemo(() => {
    const weeks: Record<string, { week: string; weekKey: string; earned: number }> = {};
    filteredShifts.forEach((s) => {
      const d = parseISO(s.date);
      const weekStart = startOfWeek(d, { locale: ru });
      const weekKey = format(weekStart, 'yyyy-MM-dd'); // ISO для сортировки
      const weekLabel = format(weekStart, 'dd.MM'); // Отображение
      if (!weeks[weekKey]) weeks[weekKey] = { week: weekLabel, weekKey, earned: 0 };
      weeks[weekKey].earned += s.my_share - calcPartnerShare(s);
    });
    return Object.values(weeks).sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  }, [filteredShifts, calcPartnerShare]);

  // Top objects
  const topObjects = useMemo(() => {
    const map: Record<string, { name: string; earned: number }> = {};
    filteredShifts.filter((s) => s.object_id).forEach((s) => {
      const obj = getObject(s.object_id);
      if (!obj) return;
      if (!map[obj.id]) map[obj.id] = { name: obj.name, earned: 0 };
      map[obj.id].earned += s.my_share - calcPartnerShare(s);
    });
    return Object.values(map).sort((a, b) => b.earned - a.earned).slice(0, 5);
  }, [filteredShifts, calcPartnerShare, getObject]);

  // Directions distribution
  const directionsData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredShifts.filter((s) => s.object_id).forEach((s) => {
      const obj = getObject(s.object_id);
      if (!obj) return;
      const dir = obj.direction || 'Без направления';
      map[dir] = (map[dir] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredShifts, getObject]);

  // Money structure
  const moneyStructure = useMemo(() => {
    const myNet = filteredShifts.reduce((s, x) => s + x.my_share - calcPartnerShare(x), 0);
    const partnerTotal = filteredShifts.reduce((s, x) => s + calcPartnerShare(x), 0);
    const salaryTotal = filteredShifts.reduce((s, x) => s + getShiftSalary(x), 0);
    return [
      { name: 'Моя доля', value: Math.max(0, myNet) },
      { name: 'Партнёрам', value: partnerTotal },
      { name: 'Рабочим', value: salaryTotal },
    ];
  }, [filteredShifts, calcPartnerShare]);

  // Top workers by period
  const topWorkers = useMemo(() => {
    const map: Record<string, { name: string; shifts: number; hours: number; salary: number }> = {};
    filteredShifts.forEach((s) => {
      const w = getWorker(s.worker_id);
      if (!w) return;
      if (!map[w.id]) map[w.id] = { name: w.full_name, shifts: 0, hours: 0, salary: 0 };
      map[w.id].shifts++;
      map[w.id].hours += calcHours(s);
      map[w.id].salary += getShiftSalary(s);
    });
    return Object.values(map).sort((a, b) => b.salary - a.salary).slice(0, 5);
  }, [filteredShifts, calcHours, getWorker]);

  // Active objects table
  const activeObjectsTable = useMemo(() => {
    const map: Record<string, { name: string; start: string; shifts: number; hours: number; myEarned: number }> = {};
    filteredShifts.filter((s) => s.object_id).forEach((s) => {
      const obj = getObject(s.object_id);
      if (!obj) return;
      if (!map[obj.id]) map[obj.id] = { name: obj.name, start: s.date, shifts: 0, hours: 0, myEarned: 0 };
      map[obj.id].shifts++;
      map[obj.id].hours += calcHours(s);
      map[obj.id].myEarned += s.my_share - calcPartnerShare(s);
      if (s.date < map[obj.id].start) map[obj.id].start = s.date;
    });
    return Object.values(map).sort((a, b) => b.shifts - a.shifts);
  }, [filteredShifts, calcHours, calcPartnerShare, getObject]);

  // Top partners
  const topPartners = useMemo(() => {
    const partnerWorkers = new Map<string, string[]>();
    workers.forEach((w) => {
      if (w.inviter_id && w.inviter_id !== 'me') {
        // В режиме "Активные" не включаем архивных рабочих
        if (dashboardMode === 'active' && w.archived) return;
        if (!partnerWorkers.has(w.inviter_id)) partnerWorkers.set(w.inviter_id, []);
        partnerWorkers.get(w.inviter_id)!.push(w.id);
      }
    });
    const result: { name: string; invited: number; shifts: number; partnerEarn: number }[] = [];
    partnerWorkers.forEach((workerIds, partnerId) => {
      const partner = partners.find(p => p.id === partnerId);
      if (!partner) return;
      const inPeriod = workerIds.filter((wid) => {
        const w = getWorker(wid);
        if (!w) return false;
        // В режиме "Активные" не включаем архивных рабочих
        if (dashboardMode === 'active' && w.archived) return false;
        return w.start_date >= dateFrom && w.start_date <= dateTo;
      });
      const shiftsInPeriod = filteredShifts.filter((s) => workerIds.includes(s.worker_id));
      result.push({
        name: partner.full_name + (partner.archived ? ' (архив)' : ''),
        invited: inPeriod.length,
        shifts: shiftsInPeriod.length,
        partnerEarn: shiftsInPeriod.reduce((sum, s) => sum + calcPartnerShare(s), 0)
      });
    });
    return result.sort((a, b) => b.invited - a.invited).slice(0, 3);
  }, [workers, partners, filteredShifts, calcPartnerShare, getWorker, dateFrom, dateTo, dashboardMode]);

  // Last 5 shifts
  const lastShifts = useMemo(() => {
    return [...filteredShifts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [filteredShifts]);

  return (
    <div className="page-wrap dashboard-page p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="dashboard-header flex items-center justify-between flex-wrap gap-3">
        <div><p className="eyebrow text-xs uppercase tracking-[0.2em] text-violet-500 font-semibold">РАБОЧАЯ ПАНЕЛЬ</p><h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">Обзор деятельности</h2><p className="text-sm text-gray-500 mt-1">Рабочие, объекты и финансовые результаты в одном месте.</p></div>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setDashboardMode('active')}
              className={`px-3 py-1.5 text-sm transition ${dashboardMode === 'active' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Активные
            </button>
            <button
              onClick={() => setDashboardMode('all')}
              className={`px-3 py-1.5 text-sm transition ${dashboardMode === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Все данные
            </button>
          </div>
          <label className="text-sm text-gray-600">Период:</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-kpis grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3">
        <KpiCard title="Заработано мной" value={formatMoney(kpi.myNet)} color="blue" />
        <KpiCard title="Всего смен" value={kpi.totalShifts.toString()} color="green" />
        <KpiCard title="Отработано часов" value={formatMinutes(kpi.totalHours)} color="purple" />
        <KpiCard title="Оборот рабочим" value={formatMoney(kpi.totalSalary)} color="orange" />
        <KpiCard title="Доли партнёрам" value={formatMoney(kpi.totalPartner)} color="red" />
        <KpiCard title="Средний чек" value={formatMoney(kpi.avgCheck)} color="cyan" />
        <KpiCard title="Активных рабочих" value={kpi.activeWorkers.toString()} color="indigo" />
        <KpiCard title="Объектов в работе" value={kpi.activeObjects.toString()} color="pink" />
        <KpiCard title="Начислено рабочим за период" value={formatMoney(totalPayroll)} color="purple" />
        <KpiCard title="К оплате за период" value={formatMoney(pendingExpenses)} color="orange" />
        <KpiCard title="Получено за период" value={formatMoney(receivedIncome)} color="green" />
        <KpiCard title="Расходы за период" value={formatMoney(paidExpenses)} color="red" />
      </div>

      {/* Health indicators */}
      <div className="dashboard-health bg-gray-50 rounded-xl p-4 border">
        <h3 className="font-semibold text-gray-700 mb-2">🩺 Индикаторы здоровья</h3>
        <div className="flex gap-8 text-sm">
          <span>Средняя часовая ставка: <b>{formatMoney(kpi.avgHourlyRate)}</b>/час</span>
          <span>Доля партнёрских выплат: <b>{kpi.partnerShareRatio.toFixed(1)}%</b></span>
          <span>Средний чек смены: <b>{formatMoney(kpi.avgCheck)}</b></span>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard-chart-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-panel bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">📈 Динамика заработка по неделям</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Line type="monotone" dataKey="earned" stroke="#3B82F6" strokeWidth={2} name="Заработок" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-panel bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">🏢 Топ-5 объектов по заработку</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topObjects}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Bar dataKey="earned" fill="#10B981" name="Заработок" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-panel bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">🧭 Смены по направлениям</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={directionsData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                {directionsData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-panel bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">💰 Структура денег</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={moneyStructure} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${formatMoney(value)}`}>
                {moneyStructure.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatMoney(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="dashboard-table-grid grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="dashboard-panel bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">🏆 Топ-5 рабочих за период</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2">Имя</th><th className="pb-2">Смены</th><th className="pb-2">Часы</th><th className="pb-2">Заработок</th>
            </tr></thead>
            <tbody>
              {topWorkers.map((w, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5">{w.name}</td>
                  <td>{w.shifts}</td>
                  <td>{formatMinutes(w.hours)}</td>
                  <td className="font-medium">{formatMoney(w.salary)}</td>
                </tr>
              ))}
              {topWorkers.length === 0 && <tr><td colSpan={4} className="text-gray-400 py-4 text-center">Нет данных</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="dashboard-panel bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">🏗️ Активные объекты</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2">Объект</th><th className="pb-2">Старт</th><th className="pb-2">Смены</th><th className="pb-2">Часы</th><th className="pb-2">Мой доход</th>
            </tr></thead>
            <tbody>
              {activeObjectsTable.map((o, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5">{o.name}</td>
                  <td>{o.start}</td>
                  <td>{o.shifts}</td>
                  <td>{formatMinutes(o.hours)}</td>
                  <td className="font-medium text-green-600">{formatMoney(o.myEarned)}</td>
                </tr>
              ))}
              {activeObjectsTable.length === 0 && <tr><td colSpan={5} className="text-gray-400 py-4 text-center">Нет данных</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="dashboard-panel bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">🤝 Топ-3 партнёров</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2">Имя</th><th className="pb-2">Приведено</th><th className="pb-2">Смен</th><th className="pb-2">Заработок</th>
            </tr></thead>
            <tbody>
              {topPartners.map((p, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-1.5">{p.name}</td>
                  <td>{p.invited}</td>
                  <td>{p.shifts}</td>
                  <td className="font-medium">{formatMoney(p.partnerEarn)}</td>
                </tr>
              ))}
              {topPartners.length === 0 && <tr><td colSpan={4} className="text-gray-400 py-4 text-center">Нет данных</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="dashboard-panel bg-white rounded-xl border p-4 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-3">📋 Последние 5 смен</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-gray-500">
              <th className="pb-2">Дата</th><th className="pb-2">Объект</th><th className="pb-2">Рабочий</th><th className="pb-2">Зарплата</th>
            </tr></thead>
            <tbody>
              {lastShifts.map((s) => {
                const w = getWorker(s.worker_id);
                const o = s.object_id ? getObject(s.object_id) : null;
                return (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-1.5">{s.date}</td>
                    <td>{o?.name || '—'}</td>
                    <td>{w?.full_name || '?'}</td>
                    <td className="font-medium">{formatMoney(getShiftSalary(s))}</td>
                  </tr>
                );
              })}
              {lastShifts.length === 0 && <tr><td colSpan={4} className="text-gray-400 py-4 text-center">Нет данных</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    pink: 'bg-pink-50 border-pink-200 text-pink-700',
  };
  return (
    <div className={`dashboard-kpi kpi-${color} rounded-xl border p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-xs font-medium opacity-70">{title}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
