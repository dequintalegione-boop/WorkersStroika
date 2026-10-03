export interface Worker {
  id: string;
  number: number;
  full_name: string;
  age: number;
  phone: string;
  inviter: string; // "Я" or Partner full_name
  start_date: string; // ISO date
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
}

export interface Shift {
  id: string;
  number: number;
  date: string; // ISO date
  worker_id: string;
  object_id: string; // can be empty
  salary: number;
  time_start: string; // HH:MM
  time_end: string; // HH:MM
  hours_manual: number | null; // manual hours in minutes, null if auto
  my_share: number;
  partner_share_override: number | null; // null = auto calculate
  review: string;
  comment: string;
}

export type Page = 'dashboard' | 'workers' | 'partners' | 'objects' | 'shifts' | 'statistics' | 'import';
