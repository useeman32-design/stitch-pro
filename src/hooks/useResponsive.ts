import { useWindowDimensions } from 'react-native';
import { breakpoints } from '@/theme';

/**
 * Central responsive breakpoint hook.
 *
 * isDesktop  -> persistent sidebar + top header shell (tablet & desktop/web)
 * isMobile   -> bottom navigation + center CREATE button shell
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= breakpoints.tablet;
  const isDesktop = width >= breakpoints.desktop;
  const isMobile = !isTablet;
  // True once there's enough room for a persistent two-column layout
  // (main content + a side rail) without squeezing either.
  const isWideDesktop = width >= breakpoints.wide;

  return { width, height, isMobile, isTablet, isDesktop, isWideDesktop };
}
