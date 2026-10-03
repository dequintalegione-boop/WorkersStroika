import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Worker, Partner, WorkObject, Shift, PlanningEntry } from './types';

interface AppState {
  workers: Worker[];
  partners: Partner[];
  objects: WorkObject[];
  shifts: Shift[];
  planning: PlanningEntry[];

  // Worker CRUD
  addWorker: (w: Omit<Worker, 'id'>) => void;
  updateWorker: (id: string, w: Partial<Worker>) => void;
  deleteWorker: (id: string) => void;

  // Partner CRUD
  addPartner: (p: Omit<Partner, 'id'>) => void;
  updatePartner: (id: string, p: Partial<Partner>) => void;
  deletePartner: (id: string) => void;

  // Object CRUD
  addObject: (o: Omit<WorkObject, 'id'>) => void;
  updateObject: (id: string, o: Partial<WorkObject>) => void;
  deleteObject: (id: string) => void;

  // Shift CRUD
  addShift: (s: Omit<Shift, 'id'>) => void;
  addShifts: (shifts: Omit<Shift, 'id'>[]) => void;
  updateShift: (id: string, s: Partial<Shift>) => void;
  deleteShift: (id: string) => void;

  // Planning CRUD
  addPlanning: (p: Omit<PlanningEntry, 'id'>) => void;
  updatePlanning: (id: string, p: Partial<PlanningEntry>) => void;
  deletePlanning: (id: string) => void;

  // Helpers
  getWorker: (id: string) => Worker | undefined;
  getObject: (id: string) => WorkObject | undefined;
  getInviterAuto: (workerId: string) => string;
  calcPartnerShare: (shift: Shift | Omit<Shift, 'id'>) => number;
  calcHours: (shift: Shift | Omit<Shift, 'id'>) => number;

  // Import/Export
  importData: (data: { workers: Worker[]; partners: Partner[]; objects: WorkObject[]; shifts: Shift[]; planning?: PlanningEntry[] }) => void;
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

      addWorker: (w) => set((state) => ({
        workers: [...state.workers, { ...w, id: uuidv4() }]
      })),
      updateWorker: (id, w) => set((state) => ({
        workers: state.workers.map((x) => x.id === id ? { ...x, ...w } : x)
      })),
      deleteWorker: (id) => set((state) => ({
        workers: state.workers.filter((x) => x.id !== id)
      })),

      addPartner: (p) => set((state) => ({
        partners: [...state.partners, { ...p, id: uuidv4() }]
      })),
      updatePartner: (id, p) => set((state) => ({
        partners: state.partners.map((x) => x.id === id ? { ...x, ...p } : x)
      })),
      deletePartner: (id) => set((state) => ({
        partners: state.partners.filter((x) => x.id !== id)
      })),

      addObject: (o) => set((state) => ({
        objects: [...state.objects, { ...o, id: uuidv4() }]
      })),
      updateObject: (id, o) => set((state) => ({
        objects: state.objects.map((x) => x.id === id ? { ...x, ...o } : x)
      })),
      deleteObject: (id) => set((state) => ({
        objects: state.objects.filter((x) => x.id !== id)
      })),

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

      getWorker: (id) => get().workers.find((w) => w.id === id),
      getObject: (id) => get().objects.find((o) => o.id === id),
      getInviterAuto: (workerId) => {
        const worker = get().workers.find((w) => w.id === workerId);
        return worker?.inviter || '';
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

      importData: (data) => set({
        workers: data.workers,
        partners: data.partners,
        objects: data.objects,
        shifts: data.shifts,
        planning: data.planning || []
      }),
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
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Миграция с версии 1 на 2: добавляем planning
          return {
            ...persistedState,
            planning: persistedState.planning || []
          };
        }
        return persistedState;
      }
    }
  )
);
