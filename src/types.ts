export interface Worker {
  id: string;
  number: number;
  full_name: string;
  age: number;
  phone: string;
  inviter_id: string; // 'me' или ID партнёра
  start_date: string;
  archived?: boolean;
  archived_at?: string;
}

export interface Partner {
  id: string;
  number: number;
  full_name: string;
  archived?: boolean;
  archived_at?: string;
}

export type PaymentType = 'hourly' | 'volume';

export interface WorkObject {
  id: string;
  number: number;
  name: string;
  direction: string;
  address: string;
  archived?: boolean;
  archived_at?: string;
  payment_type?: PaymentType;
  volume_unit?: string;
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
  // Оплата за объём
  payment_type?: PaymentType;
  volume_quantity?: number;
  volume_unit?: string;
  volume_rate?: number;
}

export interface PlanningEntry {
  id: string;
  date: string;
  worker_id: string;
  object_id: string;
  note: string;
  confirmed: boolean;
}

export type Page = 'dashboard' | 'workers' | 'partners' | 'objects' | 'shifts' | 'statistics' | 'import' | 'calendar' | 'planning' | 'archive' | 'settings';

export type SortDirection = 'asc' | 'desc' | null;

export type Theme = 'light' | 'dark' | 'modern-dark';

export type ModuleKey = 'dashboard' | 'calendar' | 'planning' | 'workers' | 'partners' | 'objects' | 'shifts' | 'statistics' | 'archive' | 'import';

export type DashboardMode = 'active' | 'all';
