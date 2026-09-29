/**
 * Shared registry of sample artworks offered in the Auto Digitize wizard.
 * Centralized so every step (upload, analyzing, settings, preview, success)
 * shows the actual artwork the user picked instead of a hardcoded fallback.
 */
export interface SampleArtwork {
  name: string;
  source: number;
}

export const sampleArtworks: SampleArtwork[] = [
  { name: 'Lion Emblem', source: require('@/assets/embroidery/lion-patch.jpg') },
  { name: 'Company Logo', source: require('@/assets/embroidery/company-logo.jpg') },
  { name: 'Floral Design', source: require('@/assets/embroidery/floral-design.jpg') },
  { name: 'Monogram M', source: require('@/assets/embroidery/monogram-m.jpg') },
];
