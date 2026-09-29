import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, sizes, spacing, typography } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  helperText,
  errorText,
  leftIcon,
  rightIcon,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = !!errorText;

  return (
    <View style={styles.container}>
      {label ? <Text style={[typography.bodySmall, styles.label]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          hasError && styles.fieldError,
        ]}
      >
        {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
        <TextInput
          placeholderTextColor={colors.textTertiary}
          style={[typography.body, styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
      </View>
      {hasError ? (
        <Text style={[typography.caption, { color: colors.danger }]}>{errorText}</Text>
      ) : helperText ? (
        <Text style={[typography.caption, { color: colors.textTertiary }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: sizes.inputHeight,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  fieldFocused: {
    borderColor: colors.indigo,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    height: '100%',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
