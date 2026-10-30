import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { CalendarDays, Search, TrendingDown, TrendingUp, Wallet, Building2, ArrowDownLeft, AlertCircle } from 'lucide-react';

function money(value: number) {
  return new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 }).format(value);
}
function today() {
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function monthStart() {
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
}

export default function ObjectFinance() {
  const { objects, financeTransactions, payrollAccruals } = useStore();
  const [search,setSearch]=useState('');
  const [fromDate,setFromDate]=useState('');
  const [toDate,setToDate]=useState('');
  const [showArchived,setShowArchived]=useState(false);

  const rows=useMemo(()=>{
    return objects.filter(o=>showArchived||!o.archived).map(object=>{
      const operations=financeTransactions.filter(t=>t.object_id===object.id&&(!fromDate||t.date>=fromDate)&&(!toDate||t.date<=toDate));
      const paidIncome=operations.filter(t=>t.type==='income'&&t.status==='paid').reduce((s,t)=>s+t.amount,0);
      const dueIncome=operations.filter(t=>t.type==='income'&&t.status==='planned').reduce((s,t)=>s+t.amount,0);
      const paidExpense=operations.filter(t=>t.type==='expense'&&t.status==='paid'&&t.source_type!=='worker_payment').reduce((s,t)=>s+t.amount,0);
      const dueExpense=operations.filter(t=>t.type==='expense'&&t.status==='planned').reduce((s,t)=>s+t.amount,0);
      const wages=payrollAccruals.filter(a=>a.object_id===object.id&&(!fromDate||a.date>=fromDate)&&(!toDate||a.date<=toDate)).reduce((s,a)=>s+a.amount,0);
      const profit=paidIncome-paidExpense-wages;
      const margin=paidIncome>0?profit/paidIncome*100:0;
      return {object,paidIncome,dueIncome,paidExpense,dueExpense,wages,profit,margin};
    }).filter(row=>!search||[row.object.name,row.object.direction,row.object.address].join(' ').toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')))
      .sort((a,b)=>b.profit-a.profit);
  },[objects,financeTransactions,payrollAccruals,fromDate,toDate,search,showArchived]);

  const totalIncome=rows.reduce((s,r)=>s+r.paidIncome,0);
  const totalExpenses=rows.reduce((s,r)=>s+r.paidExpense,0);
  const totalWages=rows.reduce((s,r)=>s+r.wages,0);
  const totalProfit=rows.reduce((s,r)=>s+r.profit,0);
  const totalToReceive=rows.reduce((s,r)=>s+r.dueIncome,0);
  const totalToPay=rows.reduce((s,r)=>s+r.dueExpense,0);
  const maxAbs=Math.max(1,...rows.map(r=>Math.abs(r.profit)));

  return (
    <div className="page-wrap object-finance-page p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="page-heading flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div><p className="eyebrow text-xs uppercase tracking-[0.2em] text-violet-500 font-semibold">PROJECT PERFORMANCE</p><h2 className="text-2xl md:text-3xl font-bold text-gray-800 mt-1">Прибыль объектов</h2><p className="text-sm text-gray-500 mt-1">Доходы, расходы, зарплаты и результат каждого строительного объекта.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-500 flex items-center gap-2"><CalendarDays size={15}/>С <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="border rounded-lg px-2 py-1.5"/></label>
          <label className="text-xs text-gray-500 flex items-center gap-2">По <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="border rounded-lg px-2 py-1.5"/></label>
          <button onClick={()=>{setFromDate(monthStart());setToDate(today());}} className="px-3 py-2 rounded-lg border text-sm">Этот месяц</button>
          <button onClick={()=>{setFromDate('');setToDate('');}} className="px-3 py-2 rounded-lg border text-sm">Всё время</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="metric-card bg-white border rounded-2xl p-4"><div className="flex justify-between text-sm text-gray-500"><span>Доход объектов</span><ArrowDownLeft size={18} className="text-emerald-500"/></div><p className="text-xl font-bold text-gray-800 mt-3">{money(totalIncome)}</p></div>
        <div className="metric-card bg-white border rounded-2xl p-4"><div className="flex justify-between text-sm text-gray-500"><span>Прямые расходы</span><TrendingDown size={18} className="text-rose-500"/></div><p className="text-xl font-bold text-gray-800 mt-3">{money(totalExpenses)}</p></div>
        <div className="metric-card bg-white border rounded-2xl p-4"><div className="flex justify-between text-sm text-gray-500"><span>Начислено зарплат</span><Wallet size={18} className="text-violet-500"/></div><p className="text-xl font-bold text-gray-800 mt-3">{money(totalWages)}</p></div>
        <div className="metric-card bg-white border rounded-2xl p-4"><div className="flex justify-between text-sm text-gray-500"><span>Прибыль</span><TrendingUp size={18} className="text-emerald-500"/></div><p className={'text-xl font-bold mt-3 '+(totalProfit>=0?'text-emerald-600':'text-rose-600')}>{money(totalProfit)}</p></div>
        <div className="metric-card bg-white border rounded-2xl p-4"><div className="flex justify-between text-sm text-gray-500"><span>Ожидается</span><CircleAlert size={18} className="text-amber-500"/></div><p className="text-xl font-bold text-amber-600 mt-3">{money(totalToReceive+totalToPay)}</p><p className="text-xs text-gray-500 mt-1">Получить {money(totalToReceive)} · оплатить {money(totalToPay)}</p></div>
      </div>

      <section className="bg-white border rounded-2xl p-4 md:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div><h3 className="font-semibold text-gray-800">Результаты по объектам</h3><p className="text-xs text-gray-500 mt-1">Прибыль = оплаченный доход − прямые расходы − начисленная зарплата.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="border rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Найти объект"/></label>
            <label className="flex items-center gap-2 text-xs text-gray-500"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Архивные</label>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map(row=><article key={row.object.id} className="object-result-card border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><Building2 size={20}/></span><div><h4 className="font-semibold text-gray-800">{row.object.name}</h4><p className="text-xs text-gray-500">{row.object.direction||row.object.address||'Строительный объект'}{row.object.archived?' · Архив':''}</p></div></div><span className={'text-xs font-semibold rounded-full px-2 py-1 '+(row.profit>=0?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700')}>{row.margin.toFixed(1)}%</span></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Получено</p><p className="font-semibold text-emerald-600">{money(row.paidIncome)}</p></div>
              <div><p className="text-xs text-gray-500">Прямые расходы</p><p className="font-semibold text-rose-600">{money(row.paidExpense)}</p></div>
              <div><p className="text-xs text-gray-500">Зарплата</p><p className="font-semibold text-violet-600">{money(row.wages)}</p></div>
              <div><p className="text-xs text-gray-500">К получению</p><p className="font-semibold">{money(row.dueIncome)}</p></div>
              <div><p className="text-xs text-gray-500">К оплате</p><p className="font-semibold">{money(row.dueExpense)}</p></div>
              <div><p className="text-xs text-gray-500">Прибыль</p><p className={'font-bold '+(row.profit>=0?'text-emerald-600':'text-rose-600')}>{money(row.profit)}</p></div>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className={'h-full rounded-full '+(row.profit>=0?'bg-gradient-to-r from-violet-500 to-cyan-400':'bg-gradient-to-r from-rose-500 to-orange-400')} style={{width:Math.max(3,Math.abs(row.profit)/maxAbs*100)+'%'}}/></div>
          </article>)}
          {rows.length===0&&<p className="col-span-full text-center text-gray-400 py-10">Объекты не найдены</p>}
        </div>
      </section>

      <section className="rounded-2xl border bg-blue-50 p-4 text-sm text-blue-800">
        <b>Как считаем прибыль:</b> зарплата берётся из начислений по сменам, а не из кассовых выплат, чтобы не вычитать её дважды. Сначала сформируй начисления в разделе «Зарплаты». Доходы и расходы без привязки к объекту в карточки объектов не включаются.
      </section>
    </div>
  );
}
