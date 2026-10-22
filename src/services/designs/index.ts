/**
 * Designs service — real local persistence on top of a hardcoded seed
 * library.
 *
 * Previously this module kept everything in a single in-memory array, so
 * anything a user did (digitize a new design, favorite one, delete one)
 * silently reverted on the next page refresh / app relaunch — there was no
 * persistence anywhere. It now persists real changes via AsyncStorage (see
 * ../storage/localStore.ts) while keeping the 5 built-in sample designs as
 * hardcoded `require()` source (bundler asset ids can't be serialized
 * safely — see mergeDesigns.ts's docstring for why seed vs. created designs
 * are tracked separately).
 *
 * Screens should only ever import from this module, never reach into seed
 * data or AsyncStorage directly.
 */

import { Image } from 'react-native';
import type { ActivityItem, Design } from '../types';
import { localStore } from '../storage/localStore';
import {
  addCreatedDesign,
  emptyPersistedState,
  mergeDesigns,
  removeDesignFromState,
  toggleFavoriteInState,
  type DesignsPersistedState,
} from './mergeDesigns';

export type { Design };

const STATE_KEY = 'designs.state.v1';
const ACTIVITY_KEY = 'designs.activity.v1';

const seedDesigns: Design[] = [
  {
    id: 'des_lion_logo',
    name: 'Lion Logo',
    date: 'Apr 28, 2026',
    format: 'DST',
    status: 'completed',
    favorite: true,
    category: 'logo',
    thumbnail: require('@/assets/embroidery/lion-patch.jpg'),
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
    thumbnail: require('@/assets/embroidery/monogram-m.jpg'),
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
    thumbnail: require('@/assets/embroidery/company-logo.jpg'),
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
    thumbnail: require('@/assets/embroidery/floral-design.jpg'),
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
    thumbnail: require('@/assets/embroidery/cap-logo.jpg'),
    stitches: 4210,
    colors: 3,
    sizeMm: { width: 50, height: 50 },
  },
];

const defaultActivity: ActivityItem[] = [
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

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

let nextDesignSeq = 1;

/**
 * `designsService.create()` gets called from several screens (Auto-
 * Digitize, Manual Editor, "use this Template") and at least one of them
 * (templates.tsx) passes a `require()`-bundled asset id straight through as
 * the thumbnail. A bundler asset id is only meaningful within the specific
 * JS bundle it was assigned in -- it is NOT safe to serialize into
 * AsyncStorage and reuse after a future rebuild/redeploy reassigns ids.
 * Resolve it to its actual concrete uri once, here, so everything that
 * actually gets persisted is already durable -- callers don't need to know
 * or care about this.
 */
function normalizeThumbnail(thumbnail: Design['thumbnail']): Design['thumbnail'] {
  if (typeof thumbnail === 'number') {
    const resolved = Image.resolveAssetSource(thumbnail);
    if (resolved?.uri) return { uri: resolved.uri };
  }
  return thumbnail;
}

async function loadState(): Promise<DesignsPersistedState> {
  return localStore.get<DesignsPersistedState>(STATE_KEY, emptyPersistedState());
}

async function saveState(state: DesignsPersistedState): Promise<void> {
  await localStore.set(STATE_KEY, state);
}

async function loadActivity(): Promise<ActivityItem[]> {
  return localStore.get<ActivityItem[]>(ACTIVITY_KEY, defaultActivity);
}

async function pushActivity(item: ActivityItem): Promise<void> {
  const activity = await loadActivity();
  await localStore.set(ACTIVITY_KEY, [item, ...activity]);
}

export const designsService = {
  async list(): Promise<Design[]> {
    const state = await loadState();
    return delay(mergeDesigns(seedDesigns, state));
  },

  /**
   * Adds a freshly digitized design and persists it for real — it survives
   * a page refresh / app relaunch from now on. Mirrors what a real "save
   * design" API call would do.
   */
  async create(input: {
    name: string;
    thumbnail: Design['thumbnail'];
    stitches: number;
    colors: number;
    sizeMm: { width: number; height: number };
    category?: Design['category'];
    format?: Design['format'];
  }): Promise<Design> {
    const design: Design = {
      id: `des_new_${Date.now()}_${nextDesignSeq++}`,
      name: input.name,
      date: 'Just now',
      format: input.format ?? 'DST',
      status: 'completed',
      favorite: false,
      category: input.category ?? 'other',
      thumbnail: normalizeThumbnail(input.thumbnail),
      stitches: input.stitches,
      colors: input.colors,
      sizeMm: input.sizeMm,
    };
    const state = await loadState();
    await saveState(addCreatedDesign(state, design));
    await pushActivity({
      id: `act_${design.id}`,
      type: 'create',
      message: 'Created new',
      target: `"${input.name}"`,
      timestamp: 'Just now',
    });
    return delay(design, 250);
  },

  async recent(limit = 5): Promise<Design[]> {
    const state = await loadState();
    return delay(mergeDesigns(seedDesigns, state).slice(0, limit));
  },

  async get(id: string): Promise<Design | undefined> {
    const state = await loadState();
    return delay(mergeDesigns(seedDesigns, state).find((d) => d.id === id));
  },

  async toggleFavorite(id: string): Promise<void> {
    const state = await loadState();
    const current = mergeDesigns(seedDesigns, state).find((d) => d.id === id);
    if (!current) return delay(undefined, 120);
    await saveState(toggleFavoriteInState(state, id, current.favorite));
    return delay(undefined, 120);
  },

  /** Removes a design for real. User-created designs are dropped entirely;
   * built-in sample designs are tombstoned (they're hardcoded source, not
   * real data to delete) so they stay hidden across reloads too. */
  async remove(id: string): Promise<void> {
    const state = await loadState();
    const current = mergeDesigns(seedDesigns, state).find((d) => d.id === id);
    await saveState(removeDesignFromState(state, id));
    if (current) {
      await pushActivity({
        id: `act_del_${id}_${Date.now()}`,
        type: 'edit',
        message: 'Deleted',
        target: `"${current.name}"`,
        timestamp: 'Just now',
      });
    }
    return delay(undefined, 150);
  },

  async recentActivity(): Promise<ActivityItem[]> {
    return delay(await loadActivity());
  },
};
