import { useState, useEffect } from 'react';
import { Page } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Workers from './components/Workers';
import Partners from './components/Partners';
import Objects from './components/Objects';
import Shifts from './components/Shifts';
import Statistics from './components/Statistics';
import ImportExport from './components/ImportExport';
import Calendar from './components/Calendar';
import Planning from './components/Planning';
import Archive from './components/Archive';
import Settings from './components/Settings';
import Payroll from './components/Payroll';
import Finance from './components/Finance';
import ObjectFinance from './components/ObjectFinance';
import { Menu, X, Download, Sun, Moon } from 'lucide-react';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useStore } from './store';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isInstallable, isInstalled, install } = useInstallPrompt();
  const { theme, setTheme, appModules } = useStore();
  const isLocalVersion = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark' || theme === 'modern-dark');
    document.documentElement.classList.toggle('modern-dark', theme === 'modern-dark');
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'modern-dark' : theme === 'modern-dark' ? 'dark' : 'light');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'workers': return <Workers />;
      case 'partners': return <Partners />;
      case 'objects': return <Objects />;
      case 'shifts': return <Shifts />;
      case 'statistics': return <Statistics />;
      case 'import': return <ImportExport />;
      case 'calendar': return <Calendar />;
      case 'planning': return <Planning />;
      case 'archive': return <Archive />;
      case 'settings': return <Settings />;
      case 'payroll': return <Payroll />;
      case 'finance': return <Finance />;
      case 'object-finance': return <ObjectFinance />;
      default: return <Dashboard />;
    }
  };

  const pageTitle: Record<Page, string> = {
    dashboard: '📊 Дашборд',
    workers: '👷 Рабочие',
    partners: '🤝 Партнёры',
    objects: '🏗️ Объекты',
    shifts: '📅 Смены',
    statistics: '📈 Статистика',
    import: '💾 Данные',
    calendar: '📅 Календарь',
    planning: '📋 Планирование',
    archive: '📦 Архив',
    settings: '⚙️ Настройки',
    payroll: '💵 Зарплаты и выплаты',
    finance: '💼 Финансы',
    'object-finance': '📊 Прибыль объектов',
  };

  return (
    <div className={`app-shell flex h-screen bg-gray-100 ${theme === "modern-dark" ? "premium-layout" : ""}`}>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`app-sidebar-wrap fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <Sidebar currentPage={currentPage} enabledModules={appModules} onNavigate={(page) => { setCurrentPage(page); setSidebarOpen(false); }} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="app-topbar bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-lg font-semibold text-gray-700">
              {pageTitle[currentPage]}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              title={theme === 'light' ? 'Современная тёмная тема' : theme === 'modern-dark' ? 'Классическая тёмная тема' : 'Светлая тема'}
            >
              {theme === 'light' ? <Moon size={20} className="text-gray-600" /> : <Sun size={20} className="text-yellow-400" />}
            </button>
            {isInstallable && !isInstalled && (
              <button
                onClick={install}
                className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition text-sm font-medium"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Установить на ПК</span>
              </button>
            )}
            <div className="text-sm text-gray-400">
              {isLocalVersion ? 'ЛОКАЛЬНО · v2.1' : 'БригадаУчёт v2.1'}
            </div>
          </div>
        </header>

        <main className="app-main flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
