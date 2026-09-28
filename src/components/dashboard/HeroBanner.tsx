import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { gradients, colors, radius, spacing, typography } from '@/theme';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/hooks/useResponsive';

export function HeroBanner() {
  const router = useRouter();
  const { isMobile } = useResponsive();

  return (
    <LinearGradient
      colors={gradients.navyHero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, isMobile && styles.containerMobile]}
    >
      <View style={[styles.textCol, isMobile && styles.textColMobile]}>
        <Text style={[typography.h1, styles.title, isMobile && { fontSize: 24, lineHeight: 31 }]}>
          Turn Your Ideas Into{'\n'}Beautiful Embroidery
        </Text>
        <Text style={[typography.body, styles.subtitle]}>
          From logos to custom designs — create, digitize and download embroidery files in
          minutes.
        </Text>
        <View style={[styles.actions, isMobile && styles.actionsMobile]}>
          <Button
            label="+ New Design"
            onPress={() => router.push('/create')}
            fullWidth={isMobile}
          />
          <Button
            label="Learn how it works"
            variant="ghost"
            onPress={() => router.push('/learn')}
            style={!isMobile ? { backgroundColor: 'rgba(255,255,255,0.08)' } : undefined}
            fullWidth={isMobile}
          />
        </View>
      </View>
      {!isMobile && (
        <Image
          source={require('@/assets/embroidery/hero-embroidery.png')}
          style={styles.image}
          resizeMode="cover"
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    flexDirection: 'row',
    overflow: 'hidden',
    height: 300,
  },
  containerMobile: {
    height: undefined,
  },
  textCol: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
    gap: spacing.md,
    maxWidth: 460,
  },
  textColMobile: {
    padding: spacing.lg,
    maxWidth: '100%',
  },
  title: {
    color: colors.white,
  },
  subtitle: {
    color: colors.textOnNavySecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsMobile: {
    flexDirection: 'column',
  },
  image: {
    width: '42%',
    height: '100%',
  },
});
