import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, sizes, spacing, typography } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'navy';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const heightBySize: Record<ButtonSize, number> = {
  sm: sizes.buttonHeightSm,
  md: sizes.buttonHeight,
  lg: 56,
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const height = heightBySize[size];

  const textColor =
    variant === 'primary' || variant === 'danger' || variant === 'navy'
      ? colors.white
      : variant === 'outline' || variant === 'ghost'
        ? colors.indigo
        : colors.textPrimary;

  const content = (
    <View style={styles.contentRow}>
      {icon && iconPosition === 'left' ? <View style={styles.iconWrap}>{icon}</View> : null}
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={[typography.button, { color: textColor }, size === 'sm' && { fontSize: 14 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
      {icon && iconPosition === 'right' ? <View style={styles.iconWrap}>{icon}</View> : null}
    </View>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={({ pressed }) => [
          fullWidth && styles.fullWidth,
          { opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={gradients.indigo}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            { height, paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg },
          ]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const variantStyle: StyleProp<ViewStyle> =
    variant === 'secondary'
      ? { backgroundColor: colors.gray100 }
      : variant === 'outline'
        ? { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.indigo }
        : variant === 'danger'
          ? { backgroundColor: colors.danger }
          : variant === 'navy'
            ? { backgroundColor: colors.navy }
            : { backgroundColor: 'transparent' };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        { height, paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg },
        fullWidth && styles.fullWidth,
        { opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
});
