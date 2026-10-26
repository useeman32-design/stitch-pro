/**
 * Shared domain types used across service layers.
 * Keeping these independent of any specific backend makes it trivial to
 * swap the mock implementations for real API clients later.
 */

import type { DstPoint } from '@/utils/dstWriter';

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
  /**
   * The real, physical stitch sequence + thread palette behind this design
   * -- the exact same data the Auto-Digitize wizard's "Finish & Download"
   * step exports from. Only present for designs actually produced by the
   * digitizing pipeline (not the 5 hardcoded sample/seed designs, which
   * were never real digitizer output and have no underlying stitch data to
   * re-export). Download/QC Check in My Designs operate on this -- without
   * it there is nothing real to download or inspect, and those actions
   * should say so rather than fake a result.
   */
  stitchData?: { points: DstPoint[]; threadColors: string[] };
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

export interface UserPreferences {
  defaultFormat: StitchFormat;
  defaultHoop: string;
  unit: 'mm' | 'in';
  notifyJobs: boolean;
  notifyDesigns: boolean;
  notifyWeekly: boolean;
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
