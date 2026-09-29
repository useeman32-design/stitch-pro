import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { threadsService } from '@/services/threads';
import type { ThreadColor } from '@/services/types';

interface ThreadColorModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (hex: string) => void;
  mode: 'add' | 'replace';
  initialHex?: string;
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.substring(0, 2), 16), parseInt(clean.substring(2, 4), 16), parseInt(clean.substring(4, 6), 16)];
}

export function ThreadColorModal({ visible, onClose, onConfirm, mode, initialHex }: ThreadColorModalProps) {
  const [tab, setTab] = useState<'library' | 'custom'>('library');
  const [threads, setThreads] = useState<ThreadColor[]>([]);
  const [selectedHex, setSelectedHex] = useState(initialHex ?? '#5B4FE8');
  const [r, setR] = useState(91);
  const [g, setG] = useState(79);
  const [b, setB] = useState(232);
  const [hexText, setHexText] = useState(initialHex ?? '#5B4FE8');

  // Intentional reset-on-open: when the modal transitions to visible, sync its
  // local editing state (tab, hex text, RGB sliders) from the current prop value.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visible) {
      threadsService.list().then(setThreads);
      const start = initialHex ?? '#5B4FE8';
      setSelectedHex(start);
      setHexText(start);
      const rgb = parseHex(start);
      if (rgb) {
        setR(rgb[0]);
        setG(rgb[1]);
        setB(rgb[2]);
      }
      setTab('library');
    }
  }, [visible, initialHex]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const customHex = useMemo(() => toHex(r, g, b), [r, g, b]);

  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    if (channel === 'r') setR(value);
    if (channel === 'g') setG(value);
    if (channel === 'b') setB(value);
    const next = toHex(channel === 'r' ? value : r, channel === 'g' ? value : g, channel === 'b' ? value : b);
    setHexText(next);
  };

  const handleHexTextChange = (text: string) => {
    setHexText(text);
    const rgb = parseHex(text);
    if (rgb) {
      setR(rgb[0]);
      setG(rgb[1]);
      setB(rgb[2]);
    }
  };

  const confirm = () => {
    const hex = tab === 'library' ? selectedHex : customHex;
    onConfirm(hex);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={mode === 'add' ? 'Add Thread Color' : 'Replace Color'}>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { label: 'Thread Library', value: 'library' },
          { label: 'Custom Color / Hex', value: 'custom' },
        ]}
      />

      {tab === 'library' ? (
        <View style={styles.libraryGrid}>
          {threads.map((t) => (
            <ColorSwatch
              key={t.id}
              hex={t.hex}
              size={38}
              selected={selectedHex.toUpperCase() === t.hex.toUpperCase()}
              onPress={() => setSelectedHex(t.hex)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.customWrap}>
          <View style={[styles.previewSwatch, { backgroundColor: customHex }]} />
          <Input
            label="Hex Code"
            value={hexText}
            onChangeText={handleHexTextChange}
            autoCapitalize="characters"
            placeholder="#5B4FE8"
          />
          <RgbRow label="Red" value={r} onChange={(v) => handleRgbChange('r', v)} tint="#E5484D" />
          <RgbRow label="Green" value={g} onChange={(v) => handleRgbChange('g', v)} tint="#1FAE6A" />
          <RgbRow label="Blue" value={b} onChange={(v) => handleRgbChange('b', v)} tint="#3E7BFA" />
        </View>
      )}

      <Button
        label={mode === 'add' ? 'Add Color' : 'Use This Color'}
        fullWidth
        style={{ marginTop: spacing.lg }}
        onPress={confirm}
      />
    </BottomSheet>
  );
}

function RgbRow({ label, value, onChange, tint }: { label: string; value: number; onChange: (v: number) => void; tint: string }) {
  return (
    <View style={styles.rgbRow}>
      <View style={styles.rgbLabelRow}>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>{Math.round(value)}</Text>
      </View>
      <Slider value={value} min={0} max={255} step={1} onValueChange={onChange} fillColor={tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  libraryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  customWrap: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  previewSwatch: {
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'stretch',
  },
  rgbRow: {
    gap: spacing.xs,
  },
  rgbLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
