/**
 * Designs service — mock implementation.
 *
 * Swap the body of these functions for real network calls once a backend
 * is available. Screens should only ever import from this module, never
 * reach into mock data directly.
 */

import type { ActivityItem, Design } from '../types';

export type { Design };

const mockActivity: ActivityItem[] = [
  {
    id: 'act_1',
    type: 'download',
    message: 'Downloaded',
    target: '"Lion Logo"',
    timestamp: '2 hours ago',
  },
  {
    id: 'act_2',
    type: 'create',
    message: 'Created new',
    target: '"Company Logo"',
    timestamp: 'Yesterday',
  },
  {
    id: 'act_3',
    type: 'edit',
    message: 'Edited',
    target: '"Floral Design"',
    timestamp: '2 days ago',
  },
  {
    id: 'act_4',
    type: 'export',
    message: 'Project exported successfully',
    target: '',
    timestamp: '3 days ago',
  },
];

const mockDesigns: Design[] = [
  {
    id: 'des_lion_logo',
    name: 'Lion Logo',
    date: 'Apr 28, 2026',
    format: 'DST',
    status: 'completed',
    favorite: true,
    category: 'logo',
    thumbnail: require('@/assets/embroidery/lion-patch.png'),
    stitches: 12482,
    colors: 5,
    sizeMm: { width: 80, height: 80 },
  },
  {
    id: 'des_monogram_m',
    name: 'Monogram M',
    date: 'Apr 24, 2026',
    format: 'DST',
    status: 'completed',
    favorite: false,
    category: 'monogram',
    thumbnail: require('@/assets/embroidery/monogram-m.png'),
    stitches: 6210,
    colors: 2,
    sizeMm: { width: 60, height: 60 },
  },
  {
    id: 'des_company_logo',
    name: 'Company Logo',
    date: 'Apr 20, 2026',
    format: 'DST',
    status: 'completed',
    favorite: false,
    category: 'logo',
    thumbnail: require('@/assets/embroidery/company-logo.png'),
    stitches: 9840,
    colors: 4,
    sizeMm: { width: 90, height: 90 },
  },
  {
    id: 'des_floral',
    name: 'Floral Design',
    date: 'Apr 15, 2026',
    format: 'DST',
    status: 'draft',
    favorite: true,
    category: 'other',
    thumbnail: require('@/assets/embroidery/floral-design.png'),
    stitches: 15320,
    colors: 6,
    sizeMm: { width: 100, height: 100 },
  },
  {
    id: 'des_cap_logo',
    name: 'Cap Logo',
    date: 'Apr 10, 2026',
    format: 'DST',
    status: 'completed',
    favorite: false,
    category: 'badge',
    thumbnail: require('@/assets/embroidery/cap-logo.png'),
    stitches: 4210,
    colors: 3,
    sizeMm: { width: 50, height: 50 },
  },
];

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const designsService = {
  async list(): Promise<Design[]> {
    return delay(mockDesigns);
  },

  async recent(limit = 5): Promise<Design[]> {
    return delay(mockDesigns.slice(0, limit));
  },

  async get(id: string): Promise<Design | undefined> {
    return delay(mockDesigns.find((d) => d.id === id));
  },

  async toggleFavorite(id: string): Promise<void> {
    const design = mockDesigns.find((d) => d.id === id);
    if (design) design.favorite = !design.favorite;
    return delay(undefined, 120);
  },

  async recentActivity(): Promise<ActivityItem[]> {
    return delay(mockActivity);
  },
};
