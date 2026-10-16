export interface Worker {
  id: string;
  number: number;
  full_name: string;
  age: number;
  phone: string;
  inviter_id: string; // 'me' или ID партнёра
  start_date: string;
  archived?: boolean;
}

export interface Partner {
  id: string;
  number: number;
  full_name: string;
}

export interface WorkObject {
  id: string;
  number: number;
  name: string;
  direction: string;
  address: string;
  archived?: boolean;
}

export interface Shift {
  id: string;
  number: number;
  date: string;
  worker_id: string;
  object_id: string;
  salary: number;
  time_start: string;
  time_end: string;
  hours_manual: number | null;
  my_share: number;
  partner_share_override: number | null;
  review: string;
  comment: string;
}

export interface PlanningEntry {
  id: string;
  date: string;
  worker_id: string;
  object_id: string;
  note: string;
  confirmed: boolean;
}

export type Page = 'dashboard' | 'workers' | 'partners' | 'objects' | 'shifts' | 'statistics' | 'import' | 'calendar' | 'planning';

export type SortDirection = 'asc' | 'desc' | null;

export type Theme = 'light' | 'dark';
