/**
 * Shared domain types used across service layers.
 * Keeping these independent of any specific backend makes it trivial to
 * swap the mock implementations for real API clients later.
 */

export type StitchFormat = 'DST' | 'PES' | 'JEF' | 'EXP' | 'VP3' | 'HUS';

export type ProjectType = 'logo' | 'text' | 'monogram' | 'custom';

export type DesignStatus = 'completed' | 'draft' | 'processing';

export interface Design {
  id: string;
  name: string;
  date: string;
  format: StitchFormat;
  status: DesignStatus;
  favorite: boolean;
  category: 'logo' | 'text' | 'monogram' | 'badge' | 'other';
  thumbnail: { uri: string } | number;
  stitches: number;
  colors: number;
  sizeMm: { width: number; height: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  plan: 'Free Plan' | 'Pro Plan' | 'Studio Plan';
  avatarUri?: string;
  creditsUsed: number;
  creditsTotal: number;
}

export interface ActivityItem {
  id: string;
  type: 'download' | 'create' | 'edit' | 'export';
  message: string;
  target: string;
  timestamp: string;
}

export interface Machine {
  id: string;
  name: string;
  brand: string;
  model: string;
  status: 'active' | 'offline';
  defaultFormat: StitchFormat;
  hoopSizes: string[];
  needleCount?: number;
  notes?: string;
}

export interface ThreadColor {
  id: string;
  brand: string;
  code: string;
  name: string;
  hex: string;
}

export type JobStatus = 'Pending' | 'Digitized' | 'Stitching' | 'Completed';

export interface ProductionJob {
  id: string;
  customer: string;
  design: string;
  quantity: string;
  dueDate: string;
  machine: string;
  status: JobStatus;
}
