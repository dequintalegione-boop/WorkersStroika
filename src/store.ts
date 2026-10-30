import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Worker, Partner, WorkObject, Shift, PlanningEntry, Theme, PaymentType } from './types';

// Единая функция расчёта зарплаты за смену
export function calcShiftSalary(shift: Shift | Omit<Shift, 'id'>): number {
  if (shift.payment_type === 'volume') {
    if (shift.volume_quantity != null && shift.volume_rate != null &&
        isFinite(shift.volume_quantity) && isFinite(shift.volume_rate) &&
        shift.volume_quantity >= 0 && shift.volume_rate >= 0) {
      return Math.round(shift.volume_quantity * shift.volume_rate * 100) / 100;
    }
    return 0;
  }
  return shift.salary || 0;
}

// Валидация объёмной оплаты
export function validateVolumeShift(shift: Omit<Shift, 'id'> | Shift): { valid: boolean; error?: string } {
  if (shift.payment_type !== 'volume') return { valid: true };
  
  if (shift.volume_quantity == null || !isFinite(shift.volume_quantity)) {
    return { valid: false, error: 'Укажите корректный объём' };
  }
  if (shift.volume_quantity <= 0) {
    return { valid: false, error: 'Объём должен быть больше нуля' };
  }
  if (shift.volume_rate == null || !isFinite(shift.volume_rate)) {
    return { valid: false, error: 'Укажите корректную цену за единицу' };
  }
  if (shift.volume_rate < 0) {
    return { valid: false, error: 'Цена не может быть отрицательной' };
  }
  if (!shift.volume_unit || shift.volume_unit.trim() === '') {
    return { valid: false, error: 'Укажите единицу измерения' };
  }
  const total = shift.volume_quantity * shift.volume_rate;
  if (!isFinite(total)) {
    return { valid: false, error: 'Некорректная итоговая сумма' };
  }
  return { valid: true };
}

// Тип для обновления без ID
type UpdateData<T> = Partial<Omit<T, 'id'>>;

// Диагностика целостности данных
export interface IntegrityIssue {
  level: 'error' | 'warning' | 'critical';
  entity: string;
  id: string;
  number?: number;
  message: string;
}

export function checkIntegrity(state: { workers: Worker[]; partners: Partner[]; objects: WorkObject[]; shifts: Shift[]; planning: PlanningEntry[] }): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const workerIds = new Set(state.workers.map(w => w.id));
  const partnerIds = new Set(state.partners.map(p => p.id));
  const objectIds = new Set(state.objects.map(o => o.id));

  // Дублирующиеся ID
  if (new Set(state.workers.map(w => w.id)).size !== state.workers.length) {
    issues.push({ level: 'critical', entity: 'workers', id: '-', message: 'Дублирующиеся ID рабочих' });
  }
  if (new Set(state.partners.map(p => p.id)).size !== state.partners.length) {
    issues.push({ level: 'critical', entity: 'partners', id: '-', message: 'Дублирующиеся ID партнёров' });
  }
  if (new Set(state.objects.map(o => o.id)).size !== state.objects.length) {
    issues.push({ level: 'critical', entity: 'objects', id: '-', message: 'Дублирующиеся ID объектов' });
  }
  if (new Set(state.shifts.map(s => s.id)).size !== state.shifts.length) {
    issues.push({ level: 'critical', entity: 'shifts', id: '-', message: 'Дублирующиеся ID смен' });
  }

  // Смены без рабочего
  state.shifts.forEach(s => {
    if (!workerIds.has(s.worker_id)) {
      issues.push({ level: 'error', entity: 'shift', id: s.id, number: s.number, message: `Смена ссылается на несуществующего рабочего (${s.worker_id})` });
    }
    if (s.object_id && !objectIds.has(s.object_id)) {
      issues.push({ level: 'warning', entity: 'shift', id: s.id, number: s.number, message: `Смена ссылается на несуществующий объект (${s.object_id})` });
    }
    // Некорректная объёмная оплата
    if (s.payment_type === 'volume') {
      if (s.volume_quantity == null || s.volume_rate == null) {
        issues.push({ level: 'error', entity: 'shift', id: s.id, number: s.number, message: 'Объёмная смена без количества или цены' });
      }
      if (!s.volume_unit) {
        issues.push({ level: 'warning', entity: 'shift', id: s.id, number: s.number, message: 'Объёмная смена без единицы измерения' });
      }
    }
  });

  // Планирование без рабочего/объекта
  state.planning.forEach(p => {
    if (!workerIds.has(p.worker_id)) {
      issues.push({ level: 'error', entity: 'planning', id: p.id, message: `Запись планирования ссылается на несуществующего рабочего (${p.worker_id})` });
    }
    if (p.object_id && !objectIds.has(p.object_id)) {
      issues.push({ level: 'warning', entity: 'planning', id: p.id, message: `Запись планирования ссылается на несуществующий объект (${p.object_id})` });
    }
  });

  // Рабочие с несуществующим партнёром
  state.workers.forEach(w => {
    if (w.inviter_id && w.inviter_id !== 'me' && !partnerIds.has(w.inviter_id)) {
      issues.push({ level: 'warning', entity: 'worker', id: w.id, number: w.number, message: `Рабочий ссылается на несуществующего партнёра (${(w as any).legacy_inviter_name || w.inviter_id})` });
    }
  });

  return issues;
}

interface AppState {
  workers: Worker[];
  partners: Partner[];
  objects: WorkObject[];
  shifts: Shift[];
  planning: PlanningEntry[];
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Worker CRUD
  addWorker: (w: Omit<Worker, 'id'>) => void;
  updateWorker: (id: string, w: UpdateData<Worker>) => void;
  deleteWorker: (id: string) => { success: boolean; error?: string };

  // Partner CRUD
  addPartner: (p: Omit<Partner, 'id'>) => void;
  updatePartner: (id: string, p: UpdateData<Partner>) => void;
  deletePartner: (id: string) => { success: boolean; error?: string };

  // Object CRUD
  addObject: (o: Omit<WorkObject, 'id'>) => void;
  updateObject: (id: string, o: UpdateData<WorkObject>) => void;
  deleteObject: (id: string) => { success: boolean; error?: string };

  // Shift CRUD
  addShift: (s: Omit<Shift, 'id'>) => { success: boolean; error?: string };
  addShifts: (shifts: Omit<Shift, 'id'>[]) => { success: boolean; error?: string };
  updateShift: (id: string, s: UpdateData<Shift>) => void;
  deleteShift: (id: string) => void;

  // Planning CRUD
  addPlanning: (p: Omit<PlanningEntry, 'id'>) => void;
  updatePlanning: (id: string, p: UpdateData<PlanningEntry>) => void;
  deletePlanning: (id: string) => void;

  // Archive
  archiveWorker: (id: string) => void;
  unarchiveWorker: (id: string) => void;
  archiveObject: (id: string) => void;
  unarchiveObject: (id: string) => void;
  archivePartner: (id: string) => void;
  unarchivePartner: (id: string) => void;

  // Helpers
  getWorker: (id: string) => Worker | undefined;
  getObject: (id: string) => WorkObject | undefined;
  getPartner: (id: string) => Partner | undefined;
  getInviterAuto: (workerId: string) => string;
  getInviterName: (inviterId: string) => string;
  calcPartnerShare: (shift: Shift | Omit<Shift, 'id'>) => number;
  calcHours: (shift: Shift | Omit<Shift, 'id'>) => number;
  getShiftSalary: (shift: Shift | Omit<Shift, 'id'>) => number;

  // Safety checks
  getWorkerShiftsCount: (workerId: string) => number;
  getWorkerPlanningCount: (workerId: string) => number;
  getPartnerWorkersCount: (partnerId: string) => number;
  getObjectShiftsCount: (objectId: string) => number;
  getObjectPlanningCount: (objectId: string) => number;

  // Integrity
  runIntegrityCheck: () => IntegrityIssue[];

  // Import/Export
  importData: (data: any) => { success: boolean; error?: string; warnings?: string[] };
  exportData: () => string;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      workers: [],
      partners: [],
      objects: [],
      shifts: [],
      planning: [],
      theme: 'light' as Theme,
      setTheme: (theme) => set({ theme }),

      addWorker: (w) => set((state) => ({
        workers: [...state.workers, { ...w, id: uuidv4() }]
      })),
      updateWorker: (id, w) => set((state) => ({
        // Защита ID: не позволяем менять id
        workers: state.workers.map((x) => x.id === id ? { ...x, ...w, id: x.id } : x)
      })),
      deleteWorker: (id) => {
        const state = get();
        const shiftCount = state.shifts.filter(s => s.worker_id === id).length;
        const planningCount = state.planning.filter(p => p.worker_id === id).length;
        if (shiftCount > 0 || planningCount > 0) {
          return { success: false, error: `Нельзя удалить: ${shiftCount} смен, ${planningCount} записей планирования. Используйте архивирование.` };
        }
        set((s) => ({ workers: s.workers.filter(x => x.id !== id) }));
        return { success: true };
      },

      addPartner: (p) => set((state) => ({
        partners: [...state.partners, { ...p, id: uuidv4() }]
      })),
      updatePartner: (id, p) => set((state) => ({
        partners: state.partners.map((x) => x.id === id ? { ...x, ...p, id: x.id } : x)
      })),
      deletePartner: (id) => {
        const state = get();
        const workersCount = state.workers.filter(w => w.inviter_id === id).length;
        if (workersCount > 0) {
          return { success: false, error: `Нельзя удалить: ${workersCount} рабочих привязаны к этому партнёру. Используйте архивирование.` };
        }
        set((s) => ({ partners: s.partners.filter(x => x.id !== id) }));
        return { success: true };
      },

      addObject: (o) => set((state) => ({
        objects: [...state.objects, { ...o, id: uuidv4() }]
      })),
      updateObject: (id, o) => set((state) => ({
        objects: state.objects.map((x) => x.id === id ? { ...x, ...o, id: x.id } : x)
      })),
      deleteObject: (id) => {
        const state = get();
        const shiftCount = state.shifts.filter(s => s.object_id === id).length;
        const planningCount = state.planning.filter(p => p.object_id === id).length;
        if (shiftCount > 0 || planningCount > 0) {
          return { success: false, error: `Нельзя удалить: ${shiftCount} смен, ${planningCount} записей планирования. Используйте архивирование.` };
        }
        set((s) => ({ objects: s.objects.filter(x => x.id !== id) }));
        return { success: true };
      },

      addShift: (s) => {
        // Валидация объёмной оплаты
        if (s.payment_type === 'volume') {
          const validation = validateVolumeShift(s);
          if (!validation.valid) {
            return { success: false, error: validation.error };
          }
          // Синхронизируем salary с расчётным значением
          s = { ...s, salary: calcShiftSalary(s) };
        }
        set((state) => ({
          shifts: [...state.shifts, { ...s, id: uuidv4() }]
        }));
        return { success: true };
      },
      addShifts: (shiftsArr) => {
        // Запрет массового создания объёмных смен
        const hasVolume = shiftsArr.some(s => s.payment_type === 'volume');
        if (hasVolume) {
          return { success: false, error: 'Массовое создание объёмных смен запрещено. Каждый рабочий должен иметь индивидуальный объём.' };
        }
        set((state) => ({
          shifts: [...state.shifts, ...shiftsArr.map((s) => ({ ...s, id: uuidv4() }))]
        }));
        return { success: true };
      },
      updateShift: (id, s) => {
        // Если обновляется объёмная смена, пересчитываем salary
        const existing = get().shifts.find(sh => sh.id === id);
        if (existing && (s.payment_type === 'volume' || existing.payment_type === 'volume')) {
          const merged = { ...existing, ...s };
          if (merged.payment_type === 'volume') {
            merged.salary = calcShiftSalary(merged);
          }
          set((state) => ({
            shifts: state.shifts.map((x) => x.id === id ? { ...merged, id: x.id } : x)
          }));
        } else {
          set((state) => ({
            shifts: state.shifts.map((x) => x.id === id ? { ...x, ...s, id: x.id } : x)
          }));
        }
      },
      deleteShift: (id) => set((state) => ({
        shifts: state.shifts.filter((x) => x.id !== id)
      })),

      addPlanning: (p) => set((state) => ({
        planning: [...state.planning, { ...p, id: uuidv4() }]
      })),
      updatePlanning: (id, p) => set((state) => ({
        planning: state.planning.map((x) => x.id === id ? { ...x, ...p, id: x.id } : x)
      })),
      deletePlanning: (id) => set((state) => ({
        planning: state.planning.filter((x) => x.id !== id)
      })),

      archiveWorker: (id) => set((state) => ({
        workers: state.workers.map((w) => w.id === id ? { ...w, archived: true, archived_at: new Date().toISOString() } : w)
      })),
      unarchiveWorker: (id) => set((state) => ({
        workers: state.workers.map((w) => w.id === id ? { ...w, archived: false, archived_at: undefined } : w)
      })),
      archiveObject: (id) => set((state) => ({
        objects: state.objects.map((o) => o.id === id ? { ...o, archived: true, archived_at: new Date().toISOString() } : o)
      })),
      unarchiveObject: (id) => set((state) => ({
        objects: state.objects.map((o) => o.id === id ? { ...o, archived: false, archived_at: undefined } : o)
      })),
      archivePartner: (id) => set((state) => ({
        partners: state.partners.map((p) => p.id === id ? { ...p, archived: true, archived_at: new Date().toISOString() } : p)
      })),
      unarchivePartner: (id) => set((state) => ({
        partners: state.partners.map((p) => p.id === id ? { ...p, archived: false, archived_at: undefined } : p)
      })),

      getWorker: (id) => get().workers.find((w) => w.id === id),
      getObject: (id) => get().objects.find((o) => o.id === id),
      getPartner: (id) => get().partners.find((p) => p.id === id),
      getInviterName: (inviterId) => {
        if (inviterId === 'me') return 'Я';
        const partner = get().partners.find((p) => p.id === inviterId);
        return partner?.full_name || '';
      },
      getInviterAuto: (workerId) => {
        const worker = get().workers.find((w) => w.id === workerId);
        if (!worker) return '';
        return get().getInviterName(worker.inviter_id);
      },
      calcPartnerShare: (shift) => {
        if (shift.partner_share_override !== null && shift.partner_share_override !== undefined) return shift.partner_share_override;
        const inviter = get().getInviterAuto(shift.worker_id);
        if (!inviter || inviter === 'Я') return 0;
        return Math.max(0, shift.my_share * 0.1);
      },
      calcHours: (shift) => {
        if (shift.hours_manual !== null && shift.hours_manual !== undefined) return shift.hours_manual;
        if (shift.time_start && shift.time_end) {
          const [sh, sm] = shift.time_start.split(':').map(Number);
          const [eh, em] = shift.time_end.split(':').map(Number);
          let diff = (eh * 60 + em) - (sh * 60 + sm);
          if (diff < 0) diff += 24 * 60;
          return diff;
        }
        return 0;
      },
      getShiftSalary: (shift) => calcShiftSalary(shift),

      getWorkerShiftsCount: (workerId) => get().shifts.filter(s => s.worker_id === workerId).length,
      getWorkerPlanningCount: (workerId) => get().planning.filter(p => p.worker_id === workerId).length,
      getPartnerWorkersCount: (partnerId) => get().workers.filter(w => w.inviter_id === partnerId).length,
      getObjectShiftsCount: (objectId) => get().shifts.filter(s => s.object_id === objectId).length,
      getObjectPlanningCount: (objectId) => get().planning.filter(p => p.object_id === objectId).length,

      runIntegrityCheck: () => {
        const state = get();
        return checkIntegrity({
          workers: state.workers,
          partners: state.partners,
          objects: state.objects,
          shifts: state.shifts,
          planning: state.planning
        });
      },

      importData: (data) => {
        try {
          const warnings: string[] = [];
          
          // Проверка структуры
          if (!data || typeof data !== 'object') {
            return { success: false, error: 'Файл не является корректным JSON' };
          }
          if (!Array.isArray(data.workers) || !Array.isArray(data.partners) || !Array.isArray(data.objects) || !Array.isArray(data.shifts)) {
            return { success: false, error: 'Неверная структура файла. Ожидаются массивы: workers, partners, objects, shifts' };
          }

          // Нормализация: гарантируем ID
          const normalizeId = (item: any, entityType: string): any => {
            if (!item.id || typeof item.id !== 'string') {
              warnings.push(`Создан новый ID для ${entityType} (отсутствовал)`);
              return { ...item, id: uuidv4() };
            }
            return item;
          };

          const normalizedWorkers = data.workers.map((w: any) => normalizeId(w, 'worker'));
          const normalizedPartners = data.partners.map((p: any) => normalizeId(p, 'partner'));
          const normalizedObjects = data.objects.map((o: any) => normalizeId(o, 'object'));
          const normalizedShifts = data.shifts.map((s: any) => normalizeId(s, 'shift'));
          const normalizedPlanning = (data.planning || []).map((p: any) => normalizeId(p, 'planning'));

          // Проверка уникальности ID
          const checkUnique = (items: any[], name: string): string | null => {
            const ids = items.map(i => i.id).filter(Boolean);
            if (new Set(ids).size !== ids.length) {
              return `Дублирующиеся ID в ${name}`;
            }
            return null;
          };

          const dupError = checkUnique(normalizedWorkers, 'workers') || checkUnique(normalizedPartners, 'partners') || 
                           checkUnique(normalizedObjects, 'objects') || checkUnique(normalizedShifts, 'shifts');
          if (dupError) {
            return { success: false, error: dupError };
          }

          // Проверка связей
          const workerIds = new Set(normalizedWorkers.map((w: any) => w.id));
          const objectIds = new Set(normalizedObjects.map((o: any) => o.id));
          const partnerIds = new Set(normalizedPartners.map((p: any) => p.id));

          normalizedShifts.forEach((s: any) => {
            if (!s.worker_id || !workerIds.has(s.worker_id)) {
              warnings.push(`Смена #${s.number || '?'} ссылается на несуществующего рабочего`);
            }
            if (s.object_id && !objectIds.has(s.object_id)) {
              warnings.push(`Смена #${s.number || '?'} ссылается на несуществующий объект`);
            }
          });

          normalizedPlanning.forEach((p: any) => {
            if (!p.worker_id || !workerIds.has(p.worker_id)) {
              warnings.push(`Запись планирования ссылается на несуществующего рабочего`);
            }
            if (p.object_id && !objectIds.has(p.object_id)) {
              warnings.push(`Запись планирования ссылается на несуществующий объект`);
            }
          });

          // Миграция inviter для старых данных
          const migratedWorkers = normalizedWorkers.map((w: any) => {
            // Если есть legacy inviter (строка), но нет inviter_id
            if (w.inviter && !w.inviter_id) {
              if (w.inviter === 'Я') {
                return { ...w, inviter_id: 'me' };
              }
              // Ищем партнёра по имени
              const matches = normalizedPartners.filter((p: any) => p.full_name === w.inviter);
              if (matches.length === 1) {
                return { ...w, inviter_id: matches[0].id };
              } else if (matches.length > 1) {
                // Неоднозначность — не выбираем случайного
                warnings.push(`Рабочий "${w.full_name}": неоднозначное имя пригласившего "${w.inviter}" (${matches.length} совпадений)`);
                return { ...w, inviter_id: '', legacy_inviter_name: w.inviter };
              } else {
                // Партнёр не найден — не подставляем 'me'
                warnings.push(`Рабочий "${w.full_name}": партнёр "${w.inviter}" не найден`);
                return { ...w, inviter_id: '', legacy_inviter_name: w.inviter };
              }
            }
            // Если inviter_id ссылается на несуществующего партнёра
            if (w.inviter_id && w.inviter_id !== 'me' && !partnerIds.has(w.inviter_id)) {
              warnings.push(`Рабочий "${w.full_name}": inviter_id ссылается на несуществующего партнёра`);
              return { ...w, legacy_inviter_name: w.inviter_id };
            }
            return w;
          });

          // Атомарное обновление
          set({
            workers: migratedWorkers,
            partners: normalizedPartners,
            objects: normalizedObjects,
            shifts: normalizedShifts,
            planning: normalizedPlanning
          });

          return { success: true, warnings: warnings.length > 0 ? warnings : undefined };
        } catch (e) {
          return { success: false, error: 'Ошибка обработки файла: ' + (e instanceof Error ? e.message : 'неизвестная ошибка') };
        }
      },
      exportData: () => {
        const state = get();
        return JSON.stringify({
          workers: state.workers,
          partners: state.partners,
          objects: state.objects,
          shifts: state.shifts,
          planning: state.planning
        }, null, 2);
      }
    }),
    { 
      name: 'brigade-tracker-storage',
      version: 6,
      migrate: (persistedState: any, version: number) => {
        // v1 → v2: add planning
        if (version < 2) {
          persistedState.planning = persistedState.planning || [];
        }
        // v2 → v3: add theme
        if (version < 3) {
          persistedState.theme = persistedState.theme || 'light';
        }
        // v3 → v4: inviter string → inviter_id (исправленная версия)
        if (version < 4) {
          if (persistedState.workers) {
            persistedState.workers = persistedState.workers.map((w: any) => {
              if (w.inviter && !w.inviter_id) {
                if (w.inviter === 'Я') {
                  return { ...w, inviter_id: 'me' };
                } else {
                  const matches = (persistedState.partners || []).filter((p: any) => p.full_name === w.inviter);
                  if (matches.length === 1) {
                    return { ...w, inviter_id: matches[0].id };
                  } else if (matches.length > 1) {
                    // Неоднозначность — сохраняем legacy
                    return { ...w, inviter_id: '', legacy_inviter_name: w.inviter };
                  } else {
                    // Не найден — не подставляем 'me'
                    return { ...w, inviter_id: '', legacy_inviter_name: w.inviter };
                  }
                }
              }
              if (!w.inviter_id) return { ...w, inviter_id: 'me' };
              return w;
            });
          }
        }
        // v4 → v5: add payment_type, volume fields, archived for partners
        if (version < 5) {
          if (persistedState.objects) {
            persistedState.objects = persistedState.objects.map((o: any) => ({
              ...o,
              payment_type: o.payment_type || 'hourly',
              volume_unit: o.volume_unit || undefined
            }));
          }
          if (persistedState.shifts) {
            persistedState.shifts = persistedState.shifts.map((s: any) => ({
              ...s,
              payment_type: s.payment_type || 'hourly'
            }));
          }
          if (persistedState.partners) {
            persistedState.partners = persistedState.partners.map((p: any) => ({
              ...p,
              archived: p.archived || false
            }));
          }
        }
        // v5 → v6: исправление миграции inviter, которая ранее ставила 'me' при отсутствии партнёра
        if (version < 6) {
          if (persistedState.workers && persistedState.partners) {
            const partnerIds = new Set(persistedState.partners.map((p: any) => p.id));
            persistedState.workers = persistedState.workers.map((w: any) => {
              // Если inviter_id установлен в 'me', но есть legacy_inviter_name — пытаемся восстановить
              if (w.inviter_id === 'me' && w.legacy_inviter_name && w.legacy_inviter_name !== 'Я') {
                const matches = persistedState.partners.filter((p: any) => p.full_name === w.legacy_inviter_name);
                if (matches.length === 1) {
                  return { ...w, inviter_id: matches[0].id };
                }
                // Если не удалось восстановить — оставляем как есть с предупреждением
              }
              // Если inviter_id ссылается на несуществующего партнёра
              if (w.inviter_id && w.inviter_id !== 'me' && !partnerIds.has(w.inviter_id)) {
                return { ...w, legacy_inviter_name: w.legacy_inviter_name || w.inviter_id, inviter_id: '' };
              }
              return w;
            });
          }
        }
        return persistedState;
      }
    }
  )
);
