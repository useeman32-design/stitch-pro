import React from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, sizes, spacing } from '@/theme';

interface ScreenContainerProps extends ScrollViewProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

export function ScreenContainer({ children, style, noPadding, ...rest }: ScreenContainerProps) {
  const { isMobile, isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        !noPadding && {
          paddingHorizontal: isDesktop ? spacing.xxl : spacing.lg,
          paddingTop: isMobile ? insets.top + spacing.md : spacing.xl,
          paddingBottom: isMobile ? spacing.xxxl + 40 : spacing.xxxl,
        },
      ]}
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      <View style={{ width: '100%', maxWidth: sizes.maxContentWidth, alignSelf: 'center' }}>
        {children}
      </View>
    </ScrollView>
  );
}
