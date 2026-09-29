import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/theme';

interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  accessibilityLabel?: string;
  width?: number;
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
  width = 96,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const triggerRef = React.useRef<View>(null);
  const selected = options.find((o) => o.value === value);

  const openMenu = () => {
    const node = triggerRef.current as any;
    if (node && typeof node.measure === 'function') {
      node.measure((_x: number, _y: number, w: number, h: number, pageX: number, pageY: number) => {
        setAnchor({ x: pageX, y: pageY, w, h });
        setOpen(true);
      });
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        accessibilityLabel={accessibilityLabel}
        style={[styles.trigger, { width }]}
      >
        <Text style={[typography.bodySmall, { color: colors.textPrimary, flex: 1 }]}>{selected?.label ?? value}</Text>
        <ChevronDown size={15} color={colors.textTertiary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menu,
              shadows.card as object,
              { top: anchor.y + anchor.h + 6, left: anchor.x, width: Math.max(width, 120) },
            ]}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={[styles.item, active && styles.itemActive]}
                >
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: active ? colors.indigo : colors.textPrimary, flex: 1 },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active && <Check size={14} color={colors.indigo} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
  },
  menu: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xxs,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  itemActive: {
    backgroundColor: colors.indigoTint,
  },
});
