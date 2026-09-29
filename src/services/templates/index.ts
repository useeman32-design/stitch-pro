/**
 * Templates service — mock implementation.
 * Used by the Templates library. Templates are read-only starting points;
 * "using" one clones it into the user's own Designs via designsService.
 */

import type { Design } from '../types';

export interface Template {
  id: string;
  name: string;
  category: Design['category'];
  description: string;
  thumbnail: number;
  stitches: number;
  colors: number;
  sizeMm: { width: number; height: number };
  format: Design['format'];
  popular?: boolean;
}

const mockTemplates: Template[] = [
  {
    id: 'tpl_lion',
    name: 'Heraldic Lion',
    category: 'logo',
    description: 'A bold detailed lion crest, great for club, school or brand logos on jackets and caps.',
    thumbnail: require('@/assets/embroidery/lion-patch.jpg'),
    stitches: 12482,
    colors: 5,
    sizeMm: { width: 80, height: 80 },
    format: 'DST',
    popular: true,
  },
  {
    id: 'tpl_monogram',
    name: 'Classic Monogram',
    category: 'monogram',
    description: 'An elegant single-letter monogram frame — swap the letter for any name or initial.',
    thumbnail: require('@/assets/embroidery/monogram-m.jpg'),
    stitches: 6210,
    colors: 2,
    sizeMm: { width: 70, height: 70 },
    format: 'PES',
    popular: true,
  },
  {
    id: 'tpl_company',
    name: 'Modern Company Mark',
    category: 'logo',
    description: 'A clean geometric emblem that reads well at small sizes on left-chest placements.',
    thumbnail: require('@/assets/embroidery/company-logo.jpg'),
    stitches: 8140,
    colors: 3,
    sizeMm: { width: 75, height: 75 },
    format: 'DST',
  },
  {
    id: 'tpl_floral',
    name: 'Botanical Bloom',
    category: 'other',
    description: 'A detailed floral spray, ideal for totes, denim jackets and statement back pieces.',
    thumbnail: require('@/assets/embroidery/floral-design.jpg'),
    stitches: 15870,
    colors: 6,
    sizeMm: { width: 100, height: 120 },
    format: 'EXP',
    popular: true,
  },
  {
    id: 'tpl_cap',
    name: 'Anchor Cap Badge',
    category: 'badge',
    description: 'A circular badge sized for a standard cap front panel.',
    thumbnail: require('@/assets/embroidery/cap-logo.jpg'),
    stitches: 5320,
    colors: 3,
    sizeMm: { width: 55, height: 55 },
    format: 'DST',
  },
  {
    id: 'tpl_crest',
    name: 'Star Crest Badge',
    category: 'badge',
    description: 'A shield-shaped badge with a laurel-and-star motif — popular for uniforms and varsity wear.',
    thumbnail: require('@/assets/embroidery/badge-crest.jpg'),
    stitches: 9640,
    colors: 2,
    sizeMm: { width: 70, height: 85 },
    format: 'JEF',
    popular: true,
  },
  {
    id: 'tpl_ornament',
    name: 'Ornamental Text Frame',
    category: 'text',
    description: 'A decorative flourish frame designed to surround a name or short phrase.',
    thumbnail: require('@/assets/embroidery/wordmark-text.jpg'),
    stitches: 11250,
    colors: 2,
    sizeMm: { width: 90, height: 90 },
    format: 'VP3',
  },
  {
    id: 'tpl_snowflake',
    name: 'Seasonal Snowflake',
    category: 'other',
    description: 'A symmetrical snowflake badge for holiday runs and winter merchandise.',
    thumbnail: require('@/assets/embroidery/seasonal-snowflake.jpg'),
    stitches: 7480,
    colors: 4,
    sizeMm: { width: 65, height: 65 },
    format: 'HUS',
  },
];

function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const templatesService = {
  async list(): Promise<Template[]> {
    return delay(mockTemplates);
  },
  async get(id: string): Promise<Template | undefined> {
    return delay(mockTemplates.find((t) => t.id === id));
  },
};
