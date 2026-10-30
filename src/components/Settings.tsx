import { useStore } from '../store';
import { ModuleKey, Theme } from '../types';
import { Check, Eye, EyeOff, Monitor, Palette, SlidersHorizontal } from 'lucide-react';

const moduleItems: { key: ModuleKey; title: string; description: string }[] = [
  { key:'dashboard', title:'Дашборд', description:'Сводная информация и основные показатели' },
  { key:'calendar', title:'Календарь', description:'Календарное представление смен' },
  { key:'planning', title:'Планирование', description:'Распределение рабочих по объектам' },
  { key:'workers', title:'Рабочие', description:'Карточки сотрудников и история' },
  { key:'partners', title:'Партнёры', description:'Учёт партнёров и привлечённых рабочих' },
  { key:'objects', title:'Объекты', description:'Список строительных объектов' },
  { key:'shifts', title:'Смены', description:'Рабочее время и начисление зарплаты' },
  { key:'statistics', title:'Статистика', description:'Отчёты и показатели по сменам' },
  { key:'archive', title:'Архив', description:'Архивные сотрудники, партнёры и объекты' },
  { key:'import', title:'Данные и резервные копии', description:'Импорт, экспорт и проверка целостности' },
  { key:'payroll', title:'Зарплаты и выплаты', description:'Начисления по сменам, авансы, выплаты и баланс сотрудников' }
];
const themes: { key:Theme; title:string; description:string; preview:string }[] = [
  { key:'light', title:'Светлая', description:'Существующее светлое оформление', preview:'bg-slate-100' },
  { key:'dark', title:'Классическая тёмная', description:'Существующая тёмная тема', preview:'bg-indigo-950' },
  { key:'modern-dark', title:'Современная тёмная', description:'Графитовый фон, мягкие контрасты и холодные акценты', preview:'bg-slate-950' }
];
export default function Settings() {
  const { theme,setTheme,appModules,setModuleEnabled } = useStore();
  return <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
    <div><h2 className="text-2xl font-bold text-gray-800">Настройки приложения</h2><p className="text-sm text-gray-500 mt-1">Настройте внешний вид и оставьте в меню только нужные разделы. Отключение раздела не удаляет данные.</p></div>
    <section className="bg-white rounded-xl border shadow-sm p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-2"><Palette className="text-blue-500" size={21}/><h3 className="text-lg font-semibold text-gray-800">Оформление</h3></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{themes.map(item=><button key={item.key} onClick={()=>setTheme(item.key)} className={`text-left rounded-xl border-2 p-3 transition ${theme===item.key?'border-blue-500 ring-2 ring-blue-100':'border-gray-200 hover:border-gray-400'}`}>
        <div className={`h-20 rounded-lg ${item.preview} p-3 flex gap-2`}><div className={`w-1/4 rounded ${item.key==='light'?'bg-slate-300':'bg-slate-800'}`}/><div className="flex-1 space-y-2"><div className={`h-3 rounded ${item.key==='light'?'bg-white':'bg-slate-700'}`}/><div className={`h-7 rounded ${item.key==='light'?'bg-white':'bg-slate-800'}`}/></div></div>
        <div className="flex items-center justify-between mt-3 gap-2"><span className="font-semibold text-gray-800">{item.title}</span>{theme===item.key&&<Check size={18} className="text-blue-600"/>}</div><p className="text-xs text-gray-500 mt-1">{item.description}</p>
      </button>)}</div>
    </section>
    <section className="bg-white rounded-xl border shadow-sm p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-2"><SlidersHorizontal className="text-blue-500" size={21}/><div><h3 className="text-lg font-semibold text-gray-800">Разделы приложения</h3><p className="text-sm text-gray-500">Скрывайте функции, которыми не пользуетесь. Их данные останутся в приложении.</p></div></div>
      <div className="divide-y">{moduleItems.map(item=>{const enabled=appModules[item.key];return <div key={item.key} className="py-3 flex items-center justify-between gap-4"><div className="min-w-0"><p className="font-medium text-gray-800">{item.title}</p><p className="text-sm text-gray-500">{item.description}</p></div><button type="button" role="switch" aria-checked={enabled} disabled={item.key === 'dashboard'} onClick={()=>setModuleEnabled(item.key,!enabled)} className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${enabled?'bg-blue-600 text-white':'bg-gray-100 text-gray-600'}`}>{enabled?<Eye size={16}/>:<EyeOff size={16} />}{enabled?'Включён':'Отключён'}</button></div>})}</div>
      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800"><Monitor size={17} className="inline mr-2"/>Главный экран нельзя отключить. Настройки сохраняются автоматически на этом устройстве и не влияют на резервные копии рабочих данных.</div>
    </section>
  </div>;
}
