import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

export default function Calendar() {
  const { shifts, workers, objects, getWorker, getObject } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [filterWorker, setFilterWorker] = useState('');
  const [filterObject, setFilterObject] = useState('');

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ru });
  const calendarEnd = endOfWeek(monthEnd, { locale: ru });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (filterWorker && s.worker_id !== filterWorker) return false;
      if (filterObject && s.object_id !== filterObject) return false;
      return true;
    });
  }, [shifts, filterWorker, filterObject]);

  const getShiftsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return filteredShifts.filter((s) => s.date === dateStr);
  };

  const selectedDayShifts = selectedDay ? getShiftsForDay(selectedDay) : [];

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📅 Календарь смен</h2>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">
        <Filter size={18} className="text-gray-400" />
        <select value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Все рабочие</option>
          {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
        </select>
        <select value={filterObject} onChange={(e) => setFilterObject(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Все объекты</option>
          {objects.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {(filterWorker || filterObject) && (
          <button onClick={() => { setFilterWorker(''); setFilterObject(''); }}
            className="text-sm text-red-500 hover:text-red-700">Сбросить фильтры</button>
        )}
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-lg font-bold capitalize">
            {format(currentDate, 'LLLL yyyy', { locale: ru })}
          </h3>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Week days header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((d) => (
            <div key={d} className="text-center text-sm font-semibold text-gray-600 py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayShifts = getShiftsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDay && isSameDay(day, selectedDay);

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[90px] border rounded-lg p-1.5 cursor-pointer transition-all ${
                  !isCurrentMonth ? 'bg-gray-50 opacity-50' : 'bg-white hover:border-blue-400'
                } ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : ''} ${
                  isToday ? 'bg-blue-50' : ''
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                  {format(day, 'd')}
                </div>
                {dayShifts.length > 0 && (
                  <div className="space-y-0.5">
                    {dayShifts.slice(0, 2).map((s) => {
                      const obj = s.object_id ? getObject(s.object_id) : null;
                      return (
                        <div key={s.id} className="text-xs bg-blue-100 text-blue-700 rounded px-1 py-0.5 truncate">
                          {obj?.name || 'Без объекта'}
                        </div>
                      );
                    })}
                    {dayShifts.length > 2 && (
                      <div className="text-xs text-gray-500">+{dayShifts.length - 2} ещё</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day details */}
      {selectedDay && (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h3 className="font-bold text-gray-700 mb-3">
            Смены на {format(selectedDay, 'dd MMMM yyyy', { locale: ru })}
            {selectedDayShifts.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({selectedDayShifts.length} {selectedDayShifts.length === 1 ? 'смена' : 'смен'})
              </span>
            )}
          </h3>
          {selectedDayShifts.length === 0 ? (
            <p className="text-gray-400 text-sm">Нет смен в этот день</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-600">
                    <th className="px-3 py-2">Рабочий</th>
                    <th className="px-3 py-2">Объект</th>
                    <th className="px-3 py-2">Время</th>
                    <th className="px-3 py-2">Зарплата</th>
                    <th className="px-3 py-2">Моя доля</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayShifts.map((s) => {
                    const w = getWorker(s.worker_id);
                    const o = s.object_id ? getObject(s.object_id) : null;
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{w?.full_name || '?'}</td>
                        <td className="px-3 py-2">{o?.name || '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          {s.time_start && s.time_end ? `${s.time_start}–${s.time_end}` : '—'}
                        </td>
                        <td className="px-3 py-2">{s.salary} ₽</td>
                        <td className="px-3 py-2 text-blue-600">{s.my_share} ₽</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
