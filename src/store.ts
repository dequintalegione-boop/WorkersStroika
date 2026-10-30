import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Worker, Partner, WorkObject, Shift, PlanningEntry, Theme, PaymentType } from './types';

// Helper: calc salary for a shift (supports volume-based)
export function calcShiftSalary(shift: Shift | Omit<Shift, 'id'>): number {
  if (shift.payment_type === 'volume' && shift.volume_quantity != null && shift.volume_rate != null) {
    return shift.volume_quantity * shift.volume_rate;
  }
  return shift.salary || 0;
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
  updateWorker: (id: string, w: Partial<Worker>) => void;
  deleteWorker: (id: string) => boolean; // returns false if blocked

  // Partner CRUD
  addPartner: (p: Omit<Partner, 'id'>) => void;
  updatePartner: (id: string, p: Partial<Partner>) => void;
  deletePartner: (id: string) => boolean;

  // Object CRUD
  addObject: (o: Omit<WorkObject, 'id'>) => void;
  updateObject: (id: string, o: Partial<WorkObject>) => void;
  deleteObject: (id: string) => boolean;

  // Shift CRUD
  addShift: (s: Omit<Shift, 'id'>) => void;
  addShifts: (shifts: Omit<Shift, 'id'>[]) => void;
  updateShift: (id: string, s: Partial<Shift>) => void;
  deleteShift: (id: string) => void;

  // Planning CRUD
  addPlanning: (p: Omit<PlanningEntry, 'id'>) => void;
  updatePlanning: (id: string, p: Partial<PlanningEntry>) => void;
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
  getPartnerWorkersCount: (partnerId: string) => number;
  getObjectShiftsCount: (objectId: string) => number;

  // Import/Export
  importData: (data: { workers: Worker[]; partners: Partner[]; objects: WorkObject[]; shifts: Shift[]; planning?: PlanningEntry[] }) => { success: boolean; error?: string };
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
        workers: state.workers.map((x) => x.id === id ? { ...x, ...w } : x)
      })),
      deleteWorker: (id) => {
        const state = get();
        const shiftCount = state.shifts.filter(s => s.worker_id === id).length;
        if (shiftCount > 0) {
          alert(`Нельзя удалить рабочего: есть ${shiftCount} смен. Используйте архивирование.`);
          return false;
        }
        set((s) => ({ workers: s.workers.filter(x => x.id !== id) }));
        return true;
      },

      addPartner: (p) => set((state) => ({
        partners: [...state.partners, { ...p, id: uuidv4() }]
      })),
      updatePartner: (id, p) => set((state) => ({
        partners: state.partners.map((x) => x.id === id ? { ...x, ...p } : x)
      })),
      deletePartner: (id) => {
        const state = get();
        const workersCount = state.workers.filter(w => w.inviter_id === id).length;
        if (workersCount > 0) {
          alert(`Нельзя удалить партнёра: ${workersCount} рабочих привязаны к нему. Используйте архивирование.`);
          return false;
        }
        set((s) => ({ partners: s.partners.filter(x => x.id !== id) }));
        return true;
      },

      addObject: (o) => set((state) => ({
        objects: [...state.objects, { ...o, id: uuidv4() }]
      })),
      updateObject: (id, o) => set((state) => ({
        objects: state.objects.map((x) => x.id === id ? { ...x, ...o } : x)
      })),
      deleteObject: (id) => {
        const state = get();
        const shiftCount = state.shifts.filter(s => s.object_id === id).length;
        if (shiftCount > 0) {
          alert(`Нельзя удалить объект: есть ${shiftCount} смен. Используйте архивирование.`);
          return false;
        }
        set((s) => ({ objects: s.objects.filter(x => x.id !== id) }));
        return true;
      },

      addShift: (s) => set((state) => ({
        shifts: [...state.shifts, { ...s, id: uuidv4() }]
      })),
      addShifts: (shiftsArr) => set((state) => ({
        shifts: [...state.shifts, ...shiftsArr.map((s) => ({ ...s, id: uuidv4() }))]
      })),
      updateShift: (id, s) => set((state) => ({
        shifts: state.shifts.map((x) => x.id === id ? { ...x, ...s } : x)
      })),
      deleteShift: (id) => set((state) => ({
        shifts: state.shifts.filter((x) => x.id !== id)
      })),

      addPlanning: (p) => set((state) => ({
        planning: [...state.planning, { ...p, id: uuidv4() }]
      })),
      updatePlanning: (id, p) => set((state) => ({
        planning: state.planning.map((x) => x.id === id ? { ...x, ...p } : x)
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
      getPartnerWorkersCount: (partnerId) => get().workers.filter(w => w.inviter_id === partnerId).length,
      getObjectShiftsCount: (objectId) => get().shifts.filter(s => s.object_id === objectId).length,

      importData: (data) => {
        try {
          // Validate structure
          if (!data.workers || !data.partners || !data.objects || !data.shifts) {
            return { success: false, error: 'Неверная структура файла' };
          }
          // Validate IDs uniqueness
          const workerIds = new Set(data.workers.map(w => w.id));
          if (workerIds.size !== data.workers.length) {
            return { success: false, error: 'Дублирующиеся ID рабочих' };
          }
          const partnerIds = new Set(data.partners.map(p => p.id));
          if (partnerIds.size !== data.partners.length) {
            return { success: false, error: 'Дублирующиеся ID партнёров' };
          }
          const objectIds = new Set(data.objects.map(o => o.id));
          if (objectIds.size !== data.objects.length) {
            return { success: false, error: 'Дублирующиеся ID объектов' };
          }
          
          set({
            workers: data.workers,
            partners: data.partners,
            objects: data.objects,
            shifts: data.shifts,
            planning: data.planning || []
          });
          return { success: true };
        } catch (e) {
          return { success: false, error: 'Ошибка импорта данных' };
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
      version: 5,
      migrate: (persistedState: any, version: number) => {
        // v1 → v2: add planning
        if (version < 2) {
          persistedState.planning = persistedState.planning || [];
        }
        // v2 → v3: add theme
        if (version < 3) {
          persistedState.theme = persistedState.theme || 'light';
        }
        // v3 → v4: inviter string → inviter_id
        if (version < 4) {
          if (persistedState.workers) {
            persistedState.workers = persistedState.workers.map((w: any) => {
              if (w.inviter && !w.inviter_id) {
                if (w.inviter === 'Я') {
                  return { ...w, inviter_id: 'me' };
                } else {
                  const partner = persistedState.partners?.find((p: any) => p.full_name === w.inviter);
                  return { ...w, inviter_id: partner?.id || 'me' };
                }
              }
              if (!w.inviter_id) return { ...w, inviter_id: 'me' };
              return w;
            });
          }
        }
        // v4 → v5: add payment_type, volume fields, archived for partners
        if (version < 5) {
          // Objects: add payment_type
          if (persistedState.objects) {
            persistedState.objects = persistedState.objects.map((o: any) => ({
              ...o,
              payment_type: o.payment_type || 'hourly',
              volume_unit: o.volume_unit || undefined
            }));
          }
          // Shifts: add payment_type
          if (persistedState.shifts) {
            persistedState.shifts = persistedState.shifts.map((s: any) => ({
              ...s,
              payment_type: s.payment_type || 'hourly'
            }));
          }
          // Partners: add archived field
          if (persistedState.partners) {
            persistedState.partners = persistedState.partners.map((p: any) => ({
              ...p,
              archived: p.archived || false
            }));
          }
        }
        return persistedState;
      }
    }
  )
);
