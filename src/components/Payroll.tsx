import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { WorkerPaymentKind, WorkerPaymentMethod } from '../types';
import { Calendar, DollarSign, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';

function todayDate() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
}
function money(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);
}

export default function Payroll() {
  const {
    workers, shifts, objects, payrollAccruals, workerPayments,
    syncPayrollAccruals, addWorkerPayment, deleteWorkerPayment
  } = useStore();

  const [fromDate, setFromDate] = useState('');
  const [workerFilter, setWorkerFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [form, setForm] = useState({
    worker_id: '',
    date: todayDate(),
    amount: '',
    kind: 'salary' as WorkerPaymentKind,
    method: 'cash' as WorkerPaymentMethod,
    comment: ''
  });

  const workerName = (id: string) => workers.find(worker => worker.id === id)?.full_name || 'Рабочий не найден';
  const objectName = (id: string) => objects.find(object => object.id === id)?.name || '—';
  const activeWorkers = useMemo(
    () => [...workers].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru')),
    [workers]
  );

  const accruedTotal = payrollAccruals.reduce((sum, item) => sum + item.amount, 0);
  const paidTotal = workerPayments.reduce((sum, item) => sum + item.amount, 0);
  const balanceTotal = accruedTotal - paidTotal;

  const workerBalances = useMemo(() => {
    return activeWorkers.map(worker => {
      const accrued = payrollAccruals.filter(item => item.worker_id === worker.id).reduce((sum, item) => sum + item.amount, 0);
      const paid = workerPayments.filter(item => item.worker_id === worker.id).reduce((sum, item) => sum + item.amount, 0);
      return { worker, accrued, paid, balance: accrued - paid };
    }).filter(item => {
      if (workerFilter && item.worker.id !== workerFilter) return false;
      if (search && !item.worker.full_name.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))) return false;
      return true;
    });
  }, [activeWorkers, payrollAccruals, workerPayments, workerFilter, search]);

  const accrualByShift = useMemo(() => new Map(payrollAccruals.map(item => [item.shift_id, item])), [payrollAccruals]);
  const pendingShifts = shifts.filter(shift =>
    shift.date >= fromDate && !accrualByShift.has(shift.id) && Number.isFinite(shift.salary) && shift.salary > 0
  ).length;

  const visibleAccruals = useMemo(() => {
    return [...payrollAccruals]
      .filter(item => !workerFilter || item.worker_id === workerFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [payrollAccruals, workerFilter]);

  const visiblePayments = useMemo(() => {
    return [...workerPayments]
      .filter(item => !workerFilter || item.worker_id === workerFilter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [workerPayments, workerFilter]);

  const totalDue = workerBalances.reduce((sum, item) => sum + Math.max(0, item.balance), 0);
  const totalAdvance = activeWorkers.reduce((sum, worker) => {
    const accrued = payrollAccruals.filter(item => item.worker_id === worker.id).reduce((v, item) => v + item.amount, 0);
    const paid = workerPayments.filter(item => item.worker_id === worker.id).reduce((v, item) => v + item.amount, 0);
    return sum + Math.max(0, paid - accrued);
  }, 0);

  const handleSync = () => {
    if (!fromDate) {
      alert('Укажите дату, начиная с которой учитывать смены.');
      return;
    }
    const accepted = confirm(
      'Синхронизировать смены по сменам начиная с ' + fromDate + '?\n\n' +
      'Новые начисления будут добавлены один раз. Суммы ранее созданных начислений обновятся по текущим данным смен. История выплат останется без изменений.\n\n' +
      'Смены до выбранной даты не затрагиваются.'
    );
    if (!accepted) return;
    const result = syncPayrollAccruals(fromDate);
    alert('Готово. Новых начислений: ' + result.created + '. Обновлено: ' + result.updated + '. Пропущено смен без положительной суммы: ' + result.skipped + '.');
  };

  const openPaymentForm = (workerId = '') => {
    setForm({
      worker_id: workerId || activeWorkers.find(worker => !worker.archived)?.id || activeWorkers[0]?.id || '',
      date: todayDate(),
      amount: '',
      kind: 'salary',
      method: 'cash',
      comment: ''
    });
    setShowPaymentForm(true);
  };

  const savePayment = () => {
    const amount = Number(form.amount);
    const result = addWorkerPayment({
      worker_id: form.worker_id,
      date: form.date,
      amount,
      kind: form.kind,
      method: form.method,
      comment: form.comment.trim()
    });
    if (!result.success) {
      alert(result.error || 'Не удалось сохранить выплату.');
      return;
    }
    setShowPaymentForm(false);
  };

  const handleDeletePayment = (id: string) => {
    if (confirm('Удалить запись о выплате? Баланс рабочего будет пересчитан.')) deleteWorkerPayment(id);
  };

  const methodLabel = (method: WorkerPaymentMethod) => method === 'cash' ? 'Наличные' : method === 'bank' ? 'Перевод' : 'Другое';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Зарплаты и выплаты</h2>
          <p className="text-sm text-gray-500 mt-1">Начисления по сменам, выданные деньги, авансы и остаток по каждому рабочему.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openPaymentForm()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            <Plus size={17} /> Записать выплату
          </button>
          <button onClick={handleSync} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700">
            <RefreshCw size={17} /> Сформировать начисления
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <div className="font-semibold mb-1">Важно при первом запуске</div>
        Начисления теперь автоматически создаются из каждой смены и сразу попадают в финансовый журнал как сумма к выплате. Выплаты и авансы автоматически уменьшают остаток по самым ранним начислениям. Старые смены также включаются при первом обновлении — проверьте исторические выплаты, внесённые вне приложения.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <p className="text-sm text-gray-500">Всего начислено</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{money(accruedTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <p className="text-sm text-gray-500">Всего выплачено и выдано авансом</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{money(paidTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <p className="text-sm text-gray-500">Осталось выплатить</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{money(totalDue)}</p>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <p className="text-sm text-gray-500">Авансы сверх начислений</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{money(totalAdvance)}</p>
        </div>
      </div>

      <section className="bg-white rounded-xl border shadow-sm p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">Баланс рабочих</h3>
            <p className="text-sm text-gray-500">Положительный остаток — сколько ещё нужно выплатить. Отрицательный — сумма аванса сверх начисленного.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              Обновить начисления с даты
              <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} className="border rounded-lg px-3 py-2 bg-white" />
            </label>
            <label className="text-sm text-gray-600 flex flex-col gap-1">
              Рабочий
              <select value={workerFilter} onChange={event => setWorkerFilter(event.target.value)} className="border rounded-lg px-3 py-2 bg-white min-w-48">
                <option value="">Все рабочие</option>
                {activeWorkers.map(worker => <option key={worker.id} value={worker.id}>{worker.full_name}{worker.archived ? ' (архив)' : ''}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-3">Рабочий</th>
                <th className="px-3 py-3 text-right">Начислено</th>
                <th className="px-3 py-3 text-right">Выплачено</th>
                <th className="px-3 py-3 text-right">Остаток</th>
                <th className="px-3 py-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody>
              {workerBalances.map(item => (
                <tr key={item.worker.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-3 font-medium text-gray-800">{item.worker.full_name}{item.worker.archived ? <span className="ml-2 text-xs text-gray-400">Архив</span> : null}</td>
                  <td className="px-3 py-3 text-right">{money(item.accrued)}</td>
                  <td className="px-3 py-3 text-right">{money(item.paid)}</td>
                  <td className={'px-3 py-3 text-right font-semibold ' + (item.balance > 0 ? 'text-orange-600' : item.balance < 0 ? 'text-emerald-600' : 'text-gray-500')}>
                    {item.balance < 0 ? 'Аванс ' : ''}{money(Math.abs(item.balance))}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => openPaymentForm(item.worker.id)} className="text-blue-600 hover:underline">Выплатить</button>
                  </td>
                </tr>
              ))}
              {workerBalances.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Рабочие не найдены</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="text-sm text-gray-500">Смен без начисления с выбранной даты: <b className="text-gray-800">{pendingShifts}</b></div>
      </section>

      <section className="bg-white rounded-xl border shadow-sm p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="font-semibold text-gray-800">История начислений</h3><p className="text-sm text-gray-500">Одна смена — одно начисление. Повторная синхронизация не создаёт дубликаты.</p></div>
          <span className="text-sm text-gray-500">{visibleAccruals.length} записей</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr className="text-left text-gray-600">
              <th className="px-3 py-3">Дата</th><th className="px-3 py-3">Смена</th><th className="px-3 py-3">Рабочий</th><th className="px-3 py-3">Объект</th><th className="px-3 py-3 text-right">Начислено</th>
            </tr></thead>
            <tbody>
              {visibleAccruals.map(item => {
                const shift = shifts.find(value => value.id === item.shift_id);
                return <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">{item.date}</td>
                  <td className="px-3 py-2">{shift ? '#' + shift.number : 'Смена удалена'}</td>
                  <td className="px-3 py-2">{workerName(item.worker_id)}</td>
                  <td className="px-3 py-2">{objectName(item.object_id)}</td>
                  <td className="px-3 py-2 text-right font-medium">{money(item.amount)}</td>
                </tr>;
              })}
              {visibleAccruals.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Начислений пока нет. Сформируйте их по сменам.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-xl border shadow-sm p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="font-semibold text-gray-800">История выплат</h3><p className="text-sm text-gray-500">Фактические выплаты и авансы сохраняются отдельными операциями.</p></div>
          <span className="text-sm text-gray-500">{visiblePayments.length} записей</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr className="text-left text-gray-600">
              <th className="px-3 py-3">Дата</th><th className="px-3 py-3">Рабочий</th><th className="px-3 py-3">Тип</th><th className="px-3 py-3">Способ</th><th className="px-3 py-3">Комментарий</th><th className="px-3 py-3 text-right">Сумма</th><th className="px-3 py-3"></th>
            </tr></thead>
            <tbody>
              {visiblePayments.map(item => <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.date}</td>
                <td className="px-3 py-2">{workerName(item.worker_id)}</td>
                <td className="px-3 py-2">{item.kind === 'advance' ? 'Аванс' : 'Выплата'}</td>
                <td className="px-3 py-2">{methodLabel(item.method)}</td>
                <td className="px-3 py-2 text-gray-500">{item.comment || '—'}</td>
                <td className="px-3 py-2 text-right font-medium">{money(item.amount)}</td>
                <td className="px-3 py-2 text-right"><button aria-label="Удалить выплату" onClick={() => handleDeletePayment(item.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 size={16} /></button></td>
              </tr>)}
              {visiblePayments.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Выплат пока нет</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {showPaymentForm && (
        <div className="fixed inset-0 z-[60] bg-black/50 p-3 sm:p-6 flex items-center justify-center" onMouseDown={event => { if (event.target === event.currentTarget) setShowPaymentForm(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Новая выплата</h3>
              <button onClick={() => setShowPaymentForm(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Закрыть"><X size={20} /></button>
            </div>
            <label className="block text-sm text-gray-600">Рабочий
              <select value={form.worker_id} onChange={event => setForm({ ...form, worker_id: event.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" required>
                <option value="">Выберите рабочего</option>
                {activeWorkers.map(worker => <option key={worker.id} value={worker.id}>{worker.full_name}{worker.archived ? ' (архив)' : ''}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm text-gray-600">Дата
                <input type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" />
              </label>
              <label className="block text-sm text-gray-600">Сумма, ₽
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Например, 5000" />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm text-gray-600">Тип операции
                <select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as WorkerPaymentKind })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">
                  <option value="salary">Выплата зарплаты</option><option value="advance">Аванс</option>
                </select>
              </label>
              <label className="block text-sm text-gray-600">Способ
                <select value={form.method} onChange={event => setForm({ ...form, method: event.target.value as WorkerPaymentMethod })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">
                  <option value="cash">Наличные</option><option value="bank">Перевод</option><option value="other">Другое</option>
                </select>
              </label>
            </div>
            <label className="block text-sm text-gray-600">Комментарий
              <input type="text" value={form.comment} onChange={event => setForm({ ...form, comment: event.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Например, часть зарплаты за неделю" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowPaymentForm(false)} className="px-4 py-2 rounded-lg border text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={savePayment} disabled={!form.worker_id || !form.date || !form.amount} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Сохранить выплату</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
