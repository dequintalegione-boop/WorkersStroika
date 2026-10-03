import { useState } from 'react';
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
import { Menu, X, Download } from 'lucide-react';
import { useInstallPrompt } from './hooks/useInstallPrompt';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isInstallable, isInstalled, install } = useInstallPrompt();

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
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={`fixed lg:static inset-y-0 left-0 z-50 transform transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <Sidebar currentPage={currentPage} onNavigate={(page) => { setCurrentPage(page); setSidebarOpen(false); }} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-lg font-semibold text-gray-700">
              {pageTitle[currentPage]}
            </h1>
          </div>
          <div className="flex items-center gap-3">
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
              БригадаУчёт v2.0
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
