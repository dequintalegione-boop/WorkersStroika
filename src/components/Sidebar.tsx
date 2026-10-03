import { Page } from '../types';
import { LayoutDashboard, Users, UserCheck, MapPin, Calendar, BarChart3, Database, CalendarDays, ClipboardList } from 'lucide-react';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const menuItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'dashboard', label: 'Дашборд', icon: <LayoutDashboard size={20} /> },
  { page: 'calendar', label: 'Календарь', icon: <CalendarDays size={20} /> },
  { page: 'planning', label: 'Планирование', icon: <ClipboardList size={20} /> },
  { page: 'workers', label: 'Рабочие', icon: <Users size={20} /> },
  { page: 'partners', label: 'Партнёры', icon: <UserCheck size={20} /> },
  { page: 'objects', label: 'Объекты', icon: <MapPin size={20} /> },
  { page: 'shifts', label: 'Смены', icon: <Calendar size={20} /> },
  { page: 'statistics', label: 'Статистика', icon: <BarChart3 size={20} /> },
  { page: 'import', label: 'Данные', icon: <Database size={20} /> },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col shadow-xl">
      <div className="p-5 border-b border-gray-700">
        <h1 className="text-xl font-bold text-blue-400">🏗️ БригадаУчёт</h1>
        <p className="text-xs text-gray-400 mt-1">Учёт рабочих бригад</p>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all text-left ${
              currentPage === item.page
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
        <p>Данные хранятся в браузере</p>
      </div>
    </aside>
  );
}
