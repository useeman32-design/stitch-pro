export interface HeroSlide {
  lines: [string, string];
  image: number;
}

/**
 * Rotating hero content for the Home dashboard promo card.
 * Keep headlines short (2 tight lines) — this is a compact promo card,
 * not a marketing splash.
 */
export const heroSlides: HeroSlide[] = [
  {
    lines: ['Turn Your Ideas', 'Into Embroidery'],
    image: require('@/assets/embroidery/hero-embroidery.jpg'),
  },
  {
    lines: ['Your Logo.', 'Stitched Perfectly.'],
    image: require('@/assets/embroidery/hero-polo.jpg'),
  },
  {
    lines: ['From Artwork', 'to Stitch.'],
    image: require('@/assets/embroidery/hero-jacket.jpg'),
  },
  {
    lines: ['Create. Digitize.', 'Embroider.'],
    image: require('@/assets/embroidery/hero-bag.jpg'),
  },
  {
    lines: ['Turn Your Ideas', 'Into Embroidery'],
    image: require('@/assets/embroidery/hero-machine.jpg'),
  },
  {
    lines: ['Your Logo.', 'Stitched Perfectly.'],
    image: require('@/assets/embroidery/lion-patch.jpg'),
  },
  {
    lines: ['From Artwork', 'to Stitch.'],
    image: require('@/assets/embroidery/hero-thread-closeup.jpg'),
  },
];
