import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Worker, Partner, WorkObject, Shift, PlanningEntry, PayrollAccrual, WorkerPayment, Theme, PaymentType, ModuleKey } from './types';

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

export function checkIntegrity(state: { workers: Worker[]; partners: Partner[]; objects: WorkObject[]; shifts: Shift[]; planning: PlanningEntry[]; payrollAccruals?: PayrollAccrual[]; workerPayments?: WorkerPayment[] }): IntegrityIssue[] {
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
  if (new Set(state.planning.map(p => p.id)).size !== state.planning.length) {
    issues.push({ level: 'critical', entity: 'planning', id: '-', message: 'Дублирующиеся ID планирования' });
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
      const validation = validateVolumeShift(s);
      if (!validation.valid) {
        issues.push({ level: 'error', entity: 'shift', id: s.id, number: s.number, message: validation.error || 'Некорректная объёмная оплата' });
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

  const payrollAccruals = state.payrollAccruals || [];
  const workerPayments = state.workerPayments || [];
  if (new Set(payrollAccruals.map(a => a.id)).size !== payrollAccruals.length) {
    issues.push({ level: 'critical', entity: 'payrollAccruals', id: '-', message: 'Дублирующиеся ID начислений зарплаты' });
  }
  if (new Set(payrollAccruals.map(a => a.shift_id)).size !== payrollAccruals.length) {
    issues.push({ level: 'critical', entity: 'payrollAccruals', id: '-', message: 'Для одной смены создано несколько начислений' });
  }
  if (new Set(workerPayments.map(p => p.id)).size !== workerPayments.length) {
    issues.push({ level: 'critical', entity: 'workerPayments', id: '-', message: 'Дублирующиеся ID выплат' });
  }
  payrollAccruals.forEach(a => {
    if (!workerIds.has(a.worker_id)) issues.push({ level: 'error', entity: 'payrollAccrual', id: a.id, message: 'Начисление связано с несуществующим рабочим' });
    if (!Number.isFinite(a.amount) || a.amount < 0) issues.push({ level: 'error', entity: 'payrollAccrual', id: a.id, message: 'Некорректная сумма начисления' });
  });
  workerPayments.forEach(p => {
    if (!workerIds.has(p.worker_id)) issues.push({ level: 'error', entity: 'workerPayment', id: p.id, message: 'Выплата связана с несуществующим рабочим' });
    if (!Number.isFinite(p.amount) || p.amount <= 0) issues.push({ level: 'error', entity: 'workerPayment', id: p.id, message: 'Некорректная сумма выплаты' });
  });

  // Рабочие с несуществующим партнёром
  state.workers.forEach(w => {
    const legacyName = (w as any).legacy_inviter_name || (w as any).inviter || '';
    if (!w.inviter_id && legacyName) {
      issues.push({ level: 'warning', entity: 'worker', id: w.id, number: w.number, message: `Не разрешена связь с партнёром: ${legacyName}` });
    } else if (w.inviter_id && w.inviter_id !== 'me' && !partnerIds.has(w.inviter_id)) {
      issues.push({ level: 'error', entity: 'worker', id: w.id, number: w.number, message: `Рабочий ссылается на несуществующего партнёра (${w.inviter_id})` });
    }
  });

  return issues;
}


const FINANCE_ACCOUNTS: FinanceAccount[] = ['cash', 'bank', 'other'];

function validateFinanceTransaction(transaction: FinanceTransactionInput, objects: WorkObject[]): string | null {
  if (!['income', 'expense', 'transfer'].includes(transaction.type)) return 'Выберите корректный тип операции.';
  if (!transaction.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(transaction.date) || Number.isNaN(Date.parse(transaction.date + 'T00:00:00'))) {
    return 'Укажите корректную дату.';
  }
  if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) return 'Сумма должна быть больше нуля.';
  if (!['paid', 'planned'].includes(transaction.status)) return 'Выберите корректный статус операции.';
  if (transaction.object_id && !objects.some(object => object.id === transaction.object_id)) return 'Выбранный объект не найден.';
  if (transaction.type === 'transfer') {
    if (!transaction.from_account || !transaction.to_account || !FINANCE_ACCOUNTS.includes(transaction.from_account) || !FINANCE_ACCOUNTS.includes(transaction.to_account)) {
      return 'Укажите счёт списания и счёт зачисления.';
    }
    if (transaction.from_account === transaction.to_account) return 'Счета перевода должны отличаться.';
  } else {
    if (!transaction.category?.trim()) return 'Укажите категорию операции.';
    if (!transaction.account || !FINANCE_ACCOUNTS.includes(transaction.account)) return 'Выберите счёт операции.';
  }
  return null;
}

function normalizeFinanceTransaction(transaction: FinanceTransactionInput): FinanceTransactionInput {
  if (transaction.type === 'transfer') {
    return {
      ...transaction,
      category: 'Перевод между счетами',
      object_id: '',
      counterparty: transaction.counterparty?.trim() || '',
      comment: transaction.comment?.trim() || '',
      account: undefined
    };
  }
  return {
    ...transaction,
    category: transaction.category.trim(),
    object_id: transaction.object_id || '',
    counterparty: transaction.counterparty?.trim() || '',
    comment: transaction.comment?.trim() || '',
    from_account: undefined,
    to_account: undefined
  };
}

const DEFAULT_MODULES: Record<ModuleKey, boolean> = {
  dashboard: true, calendar: true, planning: true, workers: true, partners: true,
  objects: true, shifts: true, statistics: true, archive: true, import: true, payroll: true
};

interface AppState {
  workers: Worker[];
  partners: Partner[];
  objects: WorkObject[];
  shifts: Shift[];
  planning: PlanningEntry[];
  payrollAccruals: PayrollAccrual[];
  workerPayments: WorkerPayment[];
  theme: Theme;
  setTheme: (theme: Theme) => void;
  appModules: Record<ModuleKey, boolean>;
  setModuleEnabled: (module: ModuleKey, enabled: boolean) => void;
  syncPayrollAccruals: (fromDate: string) => { created: number; updated: number; skipped: number };
  addWorkerPayment: (payment: Omit<WorkerPayment, 'id' | 'created_at'>) => { success: boolean; error?: string };
  deleteWorkerPayment: (id: string) => void;

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
  updateShift: (id: string, s: UpdateData<Shift>) => { success: boolean; error?: string };
  deleteShift: (id: string) => { success: boolean; error?: string };

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
      payrollAccruals: [],
      workerPayments: [],
      theme: 'light' as Theme,
      setTheme: (theme) => set({ theme }),
      appModules: { ...DEFAULT_MODULES },
      setModuleEnabled: (module, enabled) => set((state) => ({ appModules: { ...state.appModules, [module]: enabled } })),

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
        const accrualCount = state.payrollAccruals.filter(a => a.worker_id === id).length;
        const paymentCount = state.workerPayments.filter(p => p.worker_id === id).length;
        if (shiftCount > 0 || planningCount > 0 || accrualCount > 0 || paymentCount > 0) {
          return { success: false, error: `Нельзя удалить: ${shiftCount} смен, ${planningCount} записей планирования, ${accrualCount} начислений и ${paymentCount} выплат. Используйте архивирование.` };
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
        const existing = get().shifts.find(sh => sh.id === id);
        if (!existing) return { success: false, error: 'Смена не найдена. Обновите список и попробуйте ещё раз.' };

        const merged: Shift = { ...existing, ...s, id: existing.id };
        if (merged.payment_type === 'volume') {
          const validation = validateVolumeShift(merged);
          if (!validation.valid) return { success: false, error: validation.error || 'Некорректные данные объёмной оплаты' };
          merged.salary = calcShiftSalary(merged);
        }

        set(state => ({ shifts: state.shifts.map(x => x.id === id ? merged : x) }));
        return { success: true };
      },
      deleteShift: (id) => {
        if (get().payrollAccruals.some(a => a.shift_id === id)) {
          return { success: false, error: 'По этой смене уже создано начисление. Удаление запрещено, чтобы сохранить историю зарплаты. При необходимости отредактируйте смену и пересинхронизируйте начисления.' };
        }
        set((state) => ({ shifts: state.shifts.filter((x) => x.id !== id) }));
        return { success: true };
      },

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

      syncPayrollAccruals: (fromDate) => {
        const state = get();
        const existingByShift = new Map(state.payrollAccruals.map(a => [a.shift_id, a]));
        const next = [...state.payrollAccruals];
        const now = new Date().toISOString();
        let created = 0;
        let updated = 0;
        let skipped = 0;
        state.shifts.filter(s => !fromDate || s.date >= fromDate).forEach(shift => {
          const amount = calcShiftSalary(shift);
          if (!Number.isFinite(amount) || amount <= 0) { skipped += 1; return; }
          const current = existingByShift.get(shift.id);
          if (!current) {
            const accrual: PayrollAccrual = {
              id: uuidv4(), shift_id: shift.id, worker_id: shift.worker_id,
              object_id: shift.object_id || '', date: shift.date, amount,
              created_at: now, updated_at: now
            };
            next.push(accrual);
            created += 1;
            return;
          }
          if (current.amount !== amount || current.worker_id !== shift.worker_id || current.object_id !== (shift.object_id || '') || current.date !== shift.date) {
            const refreshed = { ...current, amount, worker_id: shift.worker_id, object_id: shift.object_id || '', date: shift.date, updated_at: now };
            const index = next.findIndex(a => a.id === current.id);
            if (index >= 0) next[index] = refreshed;
            updated += 1;
          }
        });
        set({ payrollAccruals: next });
        return { created, updated, skipped };
      },
      addWorkerPayment: (payment) => {
        const state = get();
        if (!state.workers.some(w => w.id === payment.worker_id)) return { success: false, error: 'Выбранный рабочий не найден.' };
        if (!payment.date) return { success: false, error: 'Укажите дату выплаты.' };
        if (!Number.isFinite(payment.amount) || payment.amount <= 0) return { success: false, error: 'Сумма должна быть больше нуля.' };
        if (!['salary', 'advance'].includes(payment.kind)) return { success: false, error: 'Неизвестный тип выплаты.' };
        if (!['cash', 'bank', 'other'].includes(payment.method)) return { success: false, error: 'Неизвестный способ выплаты.' };
        const item: WorkerPayment = { ...payment, amount: Math.round(payment.amount * 100) / 100, id: uuidv4(), created_at: new Date().toISOString() };
        set(current => ({ workerPayments: [...current.workerPayments, item] }));
        return { success: true };
      },
      deleteWorkerPayment: (id) => set(state => ({ workerPayments: state.workerPayments.filter(p => p.id !== id) })),

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
          planning: state.planning,
          payrollAccruals: state.payrollAccruals,
          workerPayments: state.workerPayments
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
          const normalizedPayrollAccruals = (data.payrollAccruals || []).map((a: any) => normalizeId(a, 'payrollAccrual'));
          const normalizedWorkerPayments = (data.workerPayments || []).map((p: any) => normalizeId(p, 'workerPayment'));
          if ((!Array.isArray(data.payrollAccruals) || !Array.isArray(data.workerPayments)) && (get().payrollAccruals.length || get().workerPayments.length)) {
            warnings.push('Файл резервной копии не содержит начислений или выплат. При импорте эти финансовые записи будут заменены пустыми списками.');
          }

          // Проверка уникальности ID
          const checkUnique = (items: any[], name: string): string | null => {
            const ids = items.map(i => i.id).filter(Boolean);
            if (new Set(ids).size !== ids.length) {
              return `Дублирующиеся ID в ${name}`;
            }
            return null;
          };

          const dupError = checkUnique(normalizedWorkers, 'workers') || checkUnique(normalizedPartners, 'partners') ||
                           checkUnique(normalizedObjects, 'objects') || checkUnique(normalizedShifts, 'shifts') ||
                           checkUnique(normalizedPlanning, 'planning') || checkUnique(normalizedPayrollAccruals, 'payrollAccruals') ||
                           checkUnique(normalizedWorkerPayments, 'workerPayments');
          if (dupError) {
            return { success: false, error: dupError };
          }

          // Проверка связей
          const workerIds = new Set(normalizedWorkers.map((w: any) => w.id));
          const objectIds = new Set(normalizedObjects.map((o: any) => o.id));
          const partnerIds = new Set(normalizedPartners.map((p: any) => p.id));

          const linkErrors: string[] = [];
          normalizedShifts.forEach((s: any) => {
            if (!s.worker_id || !workerIds.has(s.worker_id)) {
              linkErrors.push(`Смена #${s.number || '?'} ссылается на несуществующего рабочего`);
            }
            if (s.object_id && !objectIds.has(s.object_id)) {
              linkErrors.push(`Смена #${s.number || '?'} ссылается на несуществующий объект`);
            }
            if (s.payment_type === 'volume') {
              const validation = validateVolumeShift(s);
              if (!validation.valid) linkErrors.push(`Смена #${s.number || '?'}: ${validation.error}`);
              else s.salary = calcShiftSalary(s);
            }
          });

          const accrualShiftIds = normalizedPayrollAccruals.map((a: any) => a.shift_id);
          if (new Set(accrualShiftIds).size !== accrualShiftIds.length) linkErrors.push('В файле есть несколько начислений для одной смены');
          normalizedPayrollAccruals.forEach((a: any, i: number) => {
            if (!a.worker_id || !workerIds.has(a.worker_id) || typeof a.shift_id !== 'string' || typeof a.date !== 'string' || typeof a.amount !== 'number' || !Number.isFinite(a.amount) || a.amount < 0) {
              linkErrors.push(`Начисление №${i + 1}: некорректная сумма или связь с рабочим/сменой`);
            }
          });
          normalizedWorkerPayments.forEach((p: any, i: number) => {
            if (!p.worker_id || !workerIds.has(p.worker_id) || typeof p.date !== 'string' || typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount <= 0 || !['salary', 'advance'].includes(p.kind) || !['cash', 'bank', 'other'].includes(p.method)) {
              linkErrors.push(`Выплата №${i + 1}: некорректная сумма, тип или связь с рабочим`);
            }
          });
          normalizedPlanning.forEach((p: any) => {
            if (!p.worker_id || !workerIds.has(p.worker_id)) {
              linkErrors.push('Запись планирования ссылается на несуществующего рабочего');
            }
            if (p.object_id && !objectIds.has(p.object_id)) {
              linkErrors.push('Запись планирования ссылается на несуществующий объект');
            }
          });
          if (linkErrors.length) {
            return { success: false, error: linkErrors.slice(0, 20).join('\n') };
          }

          // Восстанавливаем старые связи по имени, в том числе если ошибочная миграция уже записала inviter_id="me".
          const normalizeName = (value: string) => value.trim().toLocaleLowerCase('ru-RU');
          const migratedWorkers = normalizedWorkers.map((w: any) => {
            const legacyName = (
              typeof w.legacy_inviter_name === 'string' && w.legacy_inviter_name.trim()
                ? w.legacy_inviter_name
                : typeof w.inviter === 'string' ? w.inviter : ''
            ).trim();
            let inviterId = typeof w.inviter_id === 'string' ? w.inviter_id.trim() : '';

            if ((!inviterId || inviterId === 'me') && legacyName && legacyName !== 'Я') {
              const matches = normalizedPartners.filter((p: any) =>
                typeof p.full_name === 'string' && normalizeName(p.full_name) === normalizeName(legacyName)
              );
              if (matches.length === 1) {
                inviterId = matches[0].id;
              } else {
                warnings.push(`Рабочий "${w.full_name}": связь с партнёром "${legacyName}" требует ручного разрешения`);
                return { ...w, inviter_id: '', legacy_inviter_name: legacyName };
              }
            } else if (!inviterId && legacyName === 'Я') {
              inviterId = 'me';
            } else if (!inviterId && !legacyName) {
              inviterId = 'me';
            }

            if (inviterId !== 'me' && !partnerIds.has(inviterId)) {
              const unresolvedName = legacyName || inviterId;
              warnings.push(`Рабочий "${w.full_name}": партнёр "${unresolvedName}" не найден`);
              return { ...w, inviter_id: '', legacy_inviter_name: unresolvedName };
            }

            return { ...w, inviter_id: inviterId, legacy_inviter_name: undefined };
          });

          // Совместимость с экспортами старых версий: добавляем безопасные значения только необязательным полям.
          const importedWorkers = migratedWorkers.map((w: any, i: number) => ({
            ...w, number: w.number ?? i + 1, age: w.age ?? 0, phone: w.phone ?? '', start_date: w.start_date ?? ''
          }));
          const importedPartners = normalizedPartners.map((p: any, i: number) => ({
            ...p, number: p.number ?? i + 1
          }));
          const importedObjects = normalizedObjects.map((o: any, i: number) => ({
            ...o, number: o.number ?? i + 1, direction: o.direction ?? '', address: o.address ?? '',
            payment_type: o.payment_type || 'hourly'
          }));
          const importedShifts = normalizedShifts.map((shift: any, i: number) => ({
            ...shift, number: shift.number ?? i + 1, object_id: shift.object_id ?? '',
            salary: shift.salary ?? 0, time_start: shift.time_start ?? '', time_end: shift.time_end ?? '',
            hours_manual: shift.hours_manual ?? null, my_share: shift.my_share ?? 0,
            partner_share_override: shift.partner_share_override ?? null,
            review: shift.review ?? '', comment: shift.comment ?? '', payment_type: shift.payment_type || 'hourly'
          }));
          const importedPlanning = normalizedPlanning.map((p: any) => ({
            ...p, object_id: p.object_id ?? '', note: p.note ?? '', confirmed: p.confirmed ?? false
          }));
          const importedPayrollAccruals = normalizedPayrollAccruals.map((a: any) => ({
            ...a, object_id: a.object_id ?? '', created_at: a.created_at || new Date().toISOString(), updated_at: a.updated_at || a.created_at || new Date().toISOString()
          }));
          const importedWorkerPayments = normalizedWorkerPayments.map((p: any) => ({
            ...p, comment: p.comment ?? '', created_at: p.created_at || new Date().toISOString()
          }));

          const fieldErrors: string[] = [];
          const isText = (value: any) => typeof value === 'string';
          const isFiniteNumber = (value: any) => typeof value === 'number' && Number.isFinite(value);

          importedWorkers.forEach((w: any, i: number) => {
            if (!isText(w.full_name) || !w.full_name.trim() || !isFiniteNumber(w.number) ||
                !isFiniteNumber(w.age) || !isText(w.phone) || !isText(w.start_date) || !isText(w.inviter_id)) {
              fieldErrors.push(`Рабочий №${i + 1}: некорректные обязательные поля`);
            }
          });
          importedPartners.forEach((p: any, i: number) => {
            if (!isText(p.full_name) || !p.full_name.trim() || !isFiniteNumber(p.number)) {
              fieldErrors.push(`Партнёр №${i + 1}: некорректные обязательные поля`);
            }
          });
          importedObjects.forEach((o: any, i: number) => {
            if (!isText(o.name) || !o.name.trim() || !isFiniteNumber(o.number) ||
                !isText(o.direction) || !isText(o.address) || !['hourly', 'volume'].includes(o.payment_type)) {
              fieldErrors.push(`Объект №${i + 1}: некорректные обязательные поля`);
            }
          });
          importedShifts.forEach((shift: any, i: number) => {
            if (!isText(shift.date) || !isText(shift.worker_id) || !isText(shift.object_id) ||
                !isFiniteNumber(shift.number) || !isFiniteNumber(shift.salary) || !isFiniteNumber(shift.my_share) ||
                !(shift.hours_manual === null || isFiniteNumber(shift.hours_manual)) ||
                !(shift.partner_share_override === null || isFiniteNumber(shift.partner_share_override)) ||
                !isText(shift.time_start) || !isText(shift.time_end) ||
                !isText(shift.review) || !isText(shift.comment) ||
                !['hourly', 'volume'].includes(shift.payment_type)) {
              fieldErrors.push(`Смена №${i + 1}: некорректные обязательные поля`);
            }
          });
          importedPlanning.forEach((p: any, i: number) => {
            if (!isText(p.date) || !isText(p.worker_id) || !isText(p.object_id) ||
                !isText(p.note) || typeof p.confirmed !== 'boolean') {
              fieldErrors.push(`Планирование №${i + 1}: некорректные обязательные поля`);
            }
          });
          if (fieldErrors.length) {
            return { success: false, error: fieldErrors.slice(0, 20).join('\\n') };
          }

          // Атомарное обновление: до этой строки состояние Store не менялось.
          set({
            workers: importedWorkers,
            partners: importedPartners,
            objects: importedObjects,
            shifts: importedShifts,
            planning: importedPlanning,
            payrollAccruals: importedPayrollAccruals,
            workerPayments: importedWorkerPayments
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
          planning: state.planning,
          payrollAccruals: state.payrollAccruals,
          workerPayments: state.workerPayments
        }, null, 2);
      }
    }),
    { 
      name: 'brigade-tracker-storage',
      version: 9,
      migrate: (persistedState: any, version: number) => {
        // v8 → v9: add payroll ledger while preserving existing workers, shifts and settings.
        if (version < 9) {
          persistedState.payrollAccruals = persistedState.payrollAccruals || [];
          persistedState.workerPayments = persistedState.workerPayments || [];
          persistedState.appModules = { ...DEFAULT_MODULES, ...(persistedState.appModules || {}) };
        }
        // v7 → v8: preferences for visible modules. Existing data is preserved.
        if (version < 8) persistedState.appModules = { ...DEFAULT_MODULES, ...(persistedState.appModules || {}) };
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
        // v5 → v6: убираем ссылки на отсутствующие ID партнёров, не подменяя их на "me".
        if (version < 6 && persistedState.workers && persistedState.partners) {
          const partnerIds = new Set(persistedState.partners.map((p: any) => p.id));
          persistedState.workers = persistedState.workers.map((w: any) => {
            if (w.inviter_id && w.inviter_id !== 'me' && !partnerIds.has(w.inviter_id)) {
              return { ...w, legacy_inviter_name: w.legacy_inviter_name || w.inviter_id, inviter_id: '' };
            }
            return w;
          });
        }
        // v6 → v7: восстанавливаем ошибочные "me", если старое поле inviter содержит имя партнёра.
        if (version < 7 && Array.isArray(persistedState.workers)) {
          const partners = Array.isArray(persistedState.partners) ? persistedState.partners : [];
          const normalizeName = (value: string) => value.trim().toLocaleLowerCase('ru-RU');
          persistedState.workers = persistedState.workers.map((w: any) => {
            const legacyName = (
              typeof w.legacy_inviter_name === 'string' && w.legacy_inviter_name.trim()
                ? w.legacy_inviter_name
                : typeof w.inviter === 'string' ? w.inviter : ''
            ).trim();
            const inviterId = typeof w.inviter_id === 'string' ? w.inviter_id : '';
            if ((!inviterId || inviterId === 'me') && legacyName && legacyName !== 'Я') {
              const matches = partners.filter((p: any) =>
                typeof p.full_name === 'string' && normalizeName(p.full_name) === normalizeName(legacyName)
              );
              if (matches.length === 1) return { ...w, inviter_id: matches[0].id, legacy_inviter_name: undefined };
              return { ...w, inviter_id: '', legacy_inviter_name: legacyName };
            }
            if (!inviterId && legacyName === 'Я') return { ...w, inviter_id: 'me', legacy_inviter_name: undefined };
            if (!inviterId && !legacyName) return { ...w, inviter_id: 'me' };
            return { ...w, inviter_id: inviterId };
          });
        }
        return persistedState;
      }
    }
  )
);
