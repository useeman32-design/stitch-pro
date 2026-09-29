import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

export interface Step {
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentIndex: number; // 0-based
  compact?: boolean;
}

export function StepIndicator({ steps, currentIndex, compact = false }: StepIndicatorProps) {
  return (
    <View>
      <View style={styles.row}>
        {steps.map((step, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.label}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.circle,
                    isDone && styles.circleDone,
                    isActive && styles.circleActive,
                  ]}
                >
                  {isDone ? (
                    <Check size={14} color={colors.white} strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        typography.caption,
                        { color: isActive ? colors.white : colors.textTertiary },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  )}
                </View>
                {!compact && (
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: isActive ? colors.textPrimary : colors.textTertiary,
                        fontFamily: isActive
                          ? typography.bodyMedium.fontFamily
                          : typography.bodySmall.fontFamily,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {step.label}
                  </Text>
                )}
              </View>
              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    compact && styles.connectorCompact,
                    isDone && { backgroundColor: colors.indigo },
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
      {compact && (
        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          Step {currentIndex + 1} of {steps.length} — {steps[currentIndex].label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: colors.indigo,
  },
  circleActive: {
    backgroundColor: colors.indigo,
  },
  connector: {
    height: 2,
    width: 28,
    backgroundColor: colors.gray200,
    marginHorizontal: spacing.xs,
  },
  connectorCompact: {
    width: 14,
    marginHorizontal: 4,
  },
});
