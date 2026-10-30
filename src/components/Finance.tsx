import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { FinanceAccount, FinanceStatus, FinanceTransaction, FinanceTransactionInput, FinanceType } from '../types';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, Download, Edit3, Plus, Search, Trash2, Wallet, X } from 'lucide-react';

const accountOptions: { value: FinanceAccount; label: string }[] = [
  { value: 'cash', label: 'Наличные' },
  { value: 'bank', label: 'Банк' },
  { value: 'other', label: 'Другое' }
];
const incomeCategories = ['Оплата от заказчика', 'Дополнительные работы', 'Возврат средств', 'Прочий доход'];
const expenseCategories = ['Материалы', 'Транспорт', 'Инструменты', 'Аренда техники', 'Проживание', 'Зарплата рабочим', 'Авансы рабочим', 'Связь и интернет', 'Прочие расходы'];

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function money(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);
}
function accountLabel(value?: FinanceAccount) {
  return accountOptions.find(item => item.value === value)?.label || '—';
}
function typeLabel(type: FinanceType) {
  return type === 'income' ? 'Доход' : type === 'expense' ? 'Расход' : 'Перевод';
}
function emptyForm(): FinanceTransactionInput {
  return { type: 'income', date: today(), amount: 0, category: incomeCategories[0], object_id: '', counterparty: '', account: 'cash', status: 'paid', comment: '' };
}

export default function Finance() {
  const { financeTransactions, financeOpeningBalances, setFinanceOpeningBalance, objects, addFinanceTransaction, updateFinanceTransaction, deleteFinanceTransaction } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FinanceTransactionInput>(emptyForm());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | FinanceType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | FinanceStatus>('all');
  const [accountFilter, setAccountFilter] = useState<'all' | FinanceAccount>('all');
  const [objectFilter, setObjectFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const paid = financeTransactions.filter(item => item.status === 'paid');
  const income = paid.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const expense = paid.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const net = income - expense;
  const plannedIncome = financeTransactions.filter(item => item.status === 'planned' && item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const plannedExpense = financeTransactions.filter(item => item.status === 'planned' && item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);

  const balances = useMemo(() => {
    const result: Record<FinanceAccount, number> = { ...financeOpeningBalances };
    financeTransactions.filter(item => item.status === 'paid').forEach(item => {
      if (item.type === 'income' && item.account) result[item.account] += item.amount;
      if (item.type === 'expense' && item.account) result[item.account] -= item.amount;
      if (item.type === 'transfer' && item.from_account && item.to_account) {
        result[item.from_account] -= item.amount;
        result[item.to_account] += item.amount;
      }
    });
    return result;
  }, [financeTransactions, financeOpeningBalances]);

  const categories = useMemo(() => [...new Set(financeTransactions.filter(item => typeFilter === 'all' || item.type === typeFilter).map(item => item.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ru')), [financeTransactions, typeFilter]);
  const visible = useMemo(() => {
    return [...financeTransactions].filter(item => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (accountFilter !== 'all' && item.account !== accountFilter && item.from_account !== accountFilter && item.to_account !== accountFilter) return false;
      if (objectFilter !== 'all' && item.object_id !== objectFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (dateFrom && item.date < dateFrom) return false;
      if (dateTo && item.date > dateTo) return false;
      if (search) {
        const objectName = objects.find(object => object.id === item.object_id)?.name || '';
        const haystack = [item.category, item.counterparty, item.comment, objectName].join(' ').toLocaleLowerCase('ru');
        if (!haystack.includes(search.toLocaleLowerCase('ru'))) return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [financeTransactions, typeFilter, statusFilter, accountFilter, objectFilter, categoryFilter, dateFrom, dateTo, search, objects]);

  const filteredIncome = visible.filter(item => item.type === 'income').reduce((sum, item) => sum + item.amount, 0);
  const filteredExpense = visible.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (item: FinanceTransaction) => {
    if (item.source_type === 'worker_payment') {
      alert('Эта операция связана с выплатой рабочего. Изменить её можно в разделе «Зарплаты».');
      return;
    }
    setEditingId(item.id);
    setForm({
      type: item.type, date: item.date, amount: item.amount, category: item.category,
      object_id: item.object_id || '', counterparty: item.counterparty || '', account: item.account || 'cash',
      from_account: item.from_account, to_account: item.to_account, status: item.status, comment: item.comment || ''
    });
    setShowForm(true);
  };
  const setType = (type: FinanceType) => setForm(current => ({
    ...current, type,
    category: type === 'income' ? incomeCategories[0] : type === 'expense' ? expenseCategories[0] : 'Перевод между счетами',
    from_account: type === 'transfer' ? 'cash' : undefined,
    to_account: type === 'transfer' ? 'bank' : undefined
  }));
  const save = () => {
    const transaction: FinanceTransactionInput = {
      ...form,
      amount: Number(form.amount),
      category: form.type === 'transfer' ? 'Перевод между счетами' : form.category,
      object_id: form.type === 'transfer' ? '' : form.object_id
    };
    const result = editingId ? updateFinanceTransaction(editingId, transaction) : addFinanceTransaction(transaction);
    if (!result.success) { alert(result.error || 'Не удалось сохранить операцию.'); return; }
    setShowForm(false); setEditingId(null);
  };
  const remove = (item: FinanceTransaction) => {
    if (!confirm('Удалить финансовую операцию?')) return;
    const result = deleteFinanceTransaction(item.id);
    if (!result.success) alert(result.error);
  };
  const exportCsv = () => {
    const cell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const rows: unknown[][] = [
      ['Дата', 'Тип', 'Категория', 'Сумма, RUB', 'Статус', 'Счёт', 'Со счёта', 'На счёт', 'Объект', 'Контрагент', 'Комментарий'],
      ...visible.map(item => [
        item.date, typeLabel(item.type), item.category, item.amount,
        item.status === 'paid' ? 'Оплачено' : 'Запланировано',
        item.account ? accountLabel(item.account) : '',
        item.from_account ? accountLabel(item.from_account) : '',
        item.to_account ? accountLabel(item.to_account) : '',
        objects.find(object => object.id === item.object_id)?.name || '',
        item.counterparty, item.comment
      ])
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = 'workers-stroika-finance-' + today() + '.csv'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div><p className="text-xs uppercase tracking-[0.2em] text-sky-500 font-semibold">Движение средств</p><h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">Финансовый журнал</h2><p className="text-sm text-gray-500 mt-1">Все доходы, расходы и перемещения денег в одном месте.</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-gray-700 hover:bg-gray-50"><Download size={17}/> CSV</button>
          <button onClick={openNew} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"><Plus size={17}/> Новая операция</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-2xl border bg-white p-4 md:p-5"><div className="flex items-center justify-between"><span className="text-sm text-gray-500">Получено</span><span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ArrowDownLeft size={19}/></span></div><p className="text-2xl font-bold text-gray-800 mt-3">{money(income)}</p><p className="text-xs text-gray-500 mt-1">Фактически оплаченные доходы</p></div>
        <div className="rounded-2xl border bg-white p-4 md:p-5"><div className="flex items-center justify-between"><span className="text-sm text-gray-500">Потрачено</span><span className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><ArrowUpRight size={19}/></span></div><p className="text-2xl font-bold text-gray-800 mt-3">{money(expense)}</p><p className="text-xs text-gray-500 mt-1">Включая зарплаты и авансы</p></div>
        <div className="rounded-2xl border bg-white p-4 md:p-5"><div className="flex items-center justify-between"><span className="text-sm text-gray-500">Разница</span><span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center"><Wallet size={19}/></span></div><p className={'text-2xl font-bold mt-3 ' + (net >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{money(net)}</p><p className="text-xs text-gray-500 mt-1">Доходы минус расходы</p></div>
        <div className="rounded-2xl border bg-white p-4 md:p-5"><div className="flex items-center justify-between"><span className="text-sm text-gray-500">Запланировано</span><span className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><CalendarDays size={19}/></span></div><p className="text-xl font-bold text-gray-800 mt-3">+{money(plannedIncome)} / −{money(plannedExpense)}</p><p className="text-xs text-gray-500 mt-1">Ожидаемые поступления / расходы</p></div>
      </div>

      <section className="bg-white rounded-2xl border p-4 md:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2"><div><h3 className="font-semibold text-gray-800">Остатки по счетам</h3><p className="text-xs text-gray-500 mt-1">Считаются по оплаченным операциям с начала ведения журнала.</p></div><Wallet className="text-sky-500" size={20}/></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {accountOptions.map(account => <div key={account.value} className="rounded-xl border bg-gray-50 p-4"><p className="text-sm text-gray-500">{account.label}</p><p className={'text-xl font-semibold mt-1 ' + (balances[account.value] < 0 ? 'text-rose-600' : 'text-gray-800')}>{money(balances[account.value])}</p></div>)}
        </div>
        <details className="rounded-xl border border-dashed p-3">
          <summary className="cursor-pointer text-sm font-medium text-sky-600">Задать начальные остатки</summary>
          <p className="text-xs text-gray-500 mt-2 mb-3">Внесите деньги, которые уже были в кассе и на счетах на дату начала ведения журнала. Это не считается новым доходом.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {accountOptions.map(account => <label key={account.value} className="text-xs text-gray-500">{account.label}, ₽<input type="number" step="0.01" value={financeOpeningBalances[account.value]} onChange={event => setFinanceOpeningBalance(account.value, Number(event.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>)}
          </div>
        </details>
      </section>

      <section className="bg-white rounded-2xl border p-4 md:p-5 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-3">
          <div><h3 className="font-semibold text-gray-800">Операции</h3><p className="text-xs text-gray-500 mt-1">Показано {visible.length} из {financeTransactions.length}; доходы в выборке {money(filteredIncome)}, расходы {money(filteredExpense)}.</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="relative flex-1 min-w-44"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={event=>setSearch(event.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" placeholder="Поиск операции"/></label>
            <select value={typeFilter} onChange={event=>setTypeFilter(event.target.value as 'all'|FinanceType)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="all">Все типы</option><option value="income">Доходы</option><option value="expense">Расходы</option><option value="transfer">Переводы</option></select>
            <select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as 'all'|FinanceStatus)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="all">Все статусы</option><option value="paid">Оплачено</option><option value="planned">Запланировано</option></select>
            <select value={accountFilter} onChange={event=>setAccountFilter(event.target.value as 'all'|FinanceAccount)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="all">Все счета</option>{accountOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select>
            <select value={categoryFilter} onChange={event=>setCategoryFilter(event.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="all">Все категории</option>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select>
            <select value={objectFilter} onChange={event=>setObjectFilter(event.target.value)} className="border rounded-lg px-3 py-2 text-sm bg-white"><option value="all">Все объекты</option>{objects.map(object=><option key={object.id} value={object.id}>{object.name}</option>)}</select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-gray-500 flex items-center gap-2">С <input type="date" value={dateFrom} onChange={event=>setDateFrom(event.target.value)} className="border rounded-lg px-2 py-1.5"/></label>
          <label className="text-xs text-gray-500 flex items-center gap-2">По <input type="date" value={dateTo} onChange={event=>setDateTo(event.target.value)} className="border rounded-lg px-2 py-1.5"/></label>
          <button onClick={()=>{setSearch('');setTypeFilter('all');setStatusFilter('all');setAccountFilter('all');setCategoryFilter('all');setObjectFilter('all');setDateFrom('');setDateTo('');}} className="text-sm text-sky-600 hover:underline">Сбросить фильтры</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[850px]">
            <thead className="bg-gray-50"><tr className="text-left text-gray-500"><th className="px-3 py-3">Дата</th><th className="px-3 py-3">Операция</th><th className="px-3 py-3">Объект / контрагент</th><th className="px-3 py-3">Счёт</th><th className="px-3 py-3">Статус</th><th className="px-3 py-3 text-right">Сумма</th><th className="px-3 py-3 text-right">Действия</th></tr></thead>
            <tbody>
              {visible.map(item=>{
                const objectName=objects.find(object=>object.id===item.object_id)?.name||'';
                const transferAccounts=item.type==='transfer'?accountLabel(item.from_account)+' → '+accountLabel(item.to_account):accountLabel(item.account);
                return <tr key={item.id} className="border-t">
                  <td className="px-3 py-3 whitespace-nowrap">{item.date}</td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2"><span className={'w-8 h-8 flex items-center justify-center rounded-lg '+(item.type==='income'?'bg-emerald-50 text-emerald-600':item.type==='expense'?'bg-rose-50 text-rose-600':'bg-sky-50 text-sky-600')}>{item.type==='income'?<ArrowDownLeft size={16}/>:item.type==='expense'?<ArrowUpRight size={16}/>:<ArrowLeftRight size={16}/>}</span><span><b className="block text-gray-800">{item.category||typeLabel(item.type)}</b><small className="text-gray-500">{typeLabel(item.type)}{item.comment?' · '+item.comment:''}</small></span></div></td>
                  <td className="px-3 py-3"><div>{objectName||item.counterparty||'—'}</div>{objectName&&item.counterparty&&<small className="text-gray-500">{item.counterparty}</small>}</td>
                  <td className="px-3 py-3">{transferAccounts}</td>
                  <td className="px-3 py-3"><span className={'inline-flex rounded-full px-2 py-1 text-xs '+(item.status==='paid'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>{item.status==='paid'?'Оплачено':'Запланировано'}</span></td>
                  <td className={'px-3 py-3 text-right font-semibold whitespace-nowrap '+(item.type==='income'?'text-emerald-600':item.type==='expense'?'text-rose-600':'text-sky-600')}>{item.type==='income'?'+':item.type==='expense'?'−':'↔ '}{money(item.amount)}</td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-1">{item.source_type==='worker_payment'?<span className="text-xs text-gray-400 px-2 py-1">Из зарплат</span>:<><button onClick={()=>openEdit(item)} className="p-2 rounded-lg text-sky-600 hover:bg-sky-50" aria-label="Изменить"><Edit3 size={15}/></button><button onClick={()=>remove(item)} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50" aria-label="Удалить"><Trash2 size={15}/></button></>}</div></td>
                </tr>;
              })}
              {visible.length===0&&<tr><td colSpan={7} className="py-12 text-center text-gray-400">По выбранным фильтрам операций нет</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {showForm&&(
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onMouseDown={event=>{if(event.target===event.currentTarget)setShowForm(false);}}>
          <div className="w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-2xl bg-white border shadow-2xl p-5 md:p-6 space-y-4">
            <div className="flex items-center justify-between"><div><h3 className="text-xl font-bold text-gray-800">{editingId?'Изменить операцию':'Новая операция'}</h3><p className="text-xs text-gray-500 mt-1">Запись пересчитает финансовые остатки автоматически.</p></div><button onClick={()=>setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Закрыть"><X size={20}/></button></div>
            <div className="grid grid-cols-3 gap-2">{(['income','expense','transfer'] as FinanceType[]).map(type=><button key={type} onClick={()=>setType(type)} className={'py-3 rounded-xl border text-sm font-semibold '+(form.type===type?'bg-blue-600 text-white border-blue-600':'bg-gray-50 text-gray-600')}>{type==='income'?'Доход':type==='expense'?'Расход':'Перевод'}</button>)}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-gray-600">Дата<input type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"/></label>
              <label className="text-sm text-gray-600">Сумма, ₽<input type="number" min="0.01" step="0.01" value={form.amount||''} onChange={event=>setForm({...form,amount:Number(event.target.value)})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="0.00"/></label>
            </div>
            {form.type!=='transfer'?<>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm text-gray-600">Категория<input list="finance-categories" value={form.category} onChange={event=>setForm({...form,category:event.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Например, Материалы"/><datalist id="finance-categories">{[...incomeCategories,...expenseCategories].map(category=><option key={category} value={category}/>)}</datalist></label>
                <label className="text-sm text-gray-600">Счёт<select value={form.account||'cash'} onChange={event=>setForm({...form,account:event.target.value as FinanceAccount})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">{accountOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              </div>
              <label className="block text-sm text-gray-600">Объект<select value={form.object_id} onChange={event=>setForm({...form,object_id:event.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"><option value="">Без привязки к объекту</option>{objects.map(object=><option key={object.id} value={object.id}>{object.name}</option>)}</select></label>
              <label className="block text-sm text-gray-600">Заказчик / контрагент<input value={form.counterparty} onChange={event=>setForm({...form,counterparty:event.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Название или ФИО"/></label>
            </>:<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-gray-600">Со счёта<select value={form.from_account||'cash'} onChange={event=>setForm({...form,from_account:event.target.value as FinanceAccount})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">{accountOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <label className="text-sm text-gray-600">На счёт<select value={form.to_account||'bank'} onChange={event=>setForm({...form,to_account:event.target.value as FinanceAccount})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white">{accountOptions.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              <p className="sm:col-span-2 text-xs text-gray-500">Перевод не считается доходом или расходом, а только перемещает деньги между счетами.</p>
            </div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm text-gray-600">Статус<select value={form.status} onChange={event=>setForm({...form,status:event.target.value as FinanceStatus})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"><option value="paid">Оплачено</option><option value="planned">Запланировано</option></select></label>
              <label className="text-sm text-gray-600">Комментарий<input value={form.comment} onChange={event=>setForm({...form,comment:event.target.value})} className="mt-1 w-full border rounded-lg px-3 py-2 bg-white" placeholder="Необязательно"/></label>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button onClick={()=>setShowForm(false)} className="px-4 py-2 rounded-lg border text-gray-600">Отмена</button><button onClick={save} disabled={!form.date||!form.amount||form.amount<=0||(form.type==='transfer'&&form.from_account===form.to_account)} className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">Сохранить</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
