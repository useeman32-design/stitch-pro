import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '@/theme';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const toneConfig: Record<ToastTone, { icon: typeof CheckCircle2; color: string }> = {
  success: { icon: CheckCircle2, color: colors.success },
  error: { icon: AlertCircle, color: colors.danger },
  info: { icon: Info, color: colors.indigo },
};

function ToastCard({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(12, { duration: 200 });
      setTimeout(onDismiss, 210);
    }, 3200);
    return () => clearTimeout(timer);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const { icon: Icon, color } = toneConfig[toast.tone];

  return (
    <Animated.View style={[styles.card, shadows.sheet as object, style]}>
      <Icon size={18} color={color} strokeWidth={2.4} />
      <Text style={[typography.bodySmall, styles.message]} numberOfLines={2}>
        {toast.message}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <X size={16} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.host, { bottom: insets.bottom + spacing.lg }]}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { show: () => {} };
  }
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.xs,
    zIndex: 999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: 420,
    width: '92%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: {
    flex: 1,
    color: colors.textPrimary,
  },
});
