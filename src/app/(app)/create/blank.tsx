import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Type,
  Circle as CircleIcon,
  Square as SquareIcon,
  Triangle as TriangleIcon,
  Star as StarIcon,
  Heart as HeartIcon,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Plus,
  Minus,
  Layers,
  X,
} from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useResponsive } from '@/hooks/useResponsive';
import { designsService } from '@/services/designs';
import { HoopCanvas } from '@/components/editor/HoopCanvas';
import { CanvasElementView } from '@/components/editor/CanvasElementView';
import { ShapeSvg } from '@/components/editor/ShapeSvg';
import {
  CANVAS_SIZE,
  elementColors,
  type EditorElement,
  type ShapeKind,
} from '@/components/editor/types';

const shapeOptions: { kind: ShapeKind; label: string; icon: typeof CircleIcon }[] = [
  { kind: 'circle', label: 'Circle', icon: CircleIcon },
  { kind: 'square', label: 'Square', icon: SquareIcon },
  { kind: 'triangle', label: 'Triangle', icon: TriangleIcon },
  { kind: 'star', label: 'Star', icon: StarIcon },
  { kind: 'heart', label: 'Heart', icon: HeartIcon },
];

let nextId = 1;

export default function ManualEditorScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { show } = useToast();
  const [elements, setElements] = useState<EditorElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = elements.find((el) => el.id === selectedId) ?? null;

  const addElement = (partial: Omit<EditorElement, 'id' | 'x' | 'y' | 'rotation' | 'scale' | 'color'>) => {
    const count = elements.length;
    const id = `el_${nextId++}`;
    const newElement: EditorElement = {
      id,
      x: CANVAS_SIZE / 2 - 30 + (count % 4) * 14,
      y: CANVAS_SIZE / 2 - 30 + (count % 4) * 14,
      rotation: 0,
      scale: 1,
      color: elementColors[count % elementColors.length],
      ...partial,
    };
    setElements((prev) => [...prev, newElement]);
    setSelectedId(id);
  };

  const updateSelected = (patch: Partial<EditorElement>) => {
    if (!selectedId) return;
    setElements((prev) => prev.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) => prev.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const id = `el_${nextId++}`;
    const clone: EditorElement = { ...selected, id, x: selected.x + 16, y: selected.y + 16 };
    setElements((prev) => [...prev, clone]);
    setSelectedId(id);
  };

  const reorderSelected = (direction: 'front' | 'back') => {
    if (!selectedId) return;
    setElements((prev) => {
      const idx = prev.findIndex((el) => el.id === selectedId);
      if (idx < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      if (direction === 'front') next.push(item);
      else next.unshift(item);
      return next;
    });
  };

  const clearCanvas = () => {
    setElements([]);
    setSelectedId(null);
  };

  const handleSave = async () => {
    if (elements.length === 0) {
      show('Add at least one element before saving.', 'error');
      return;
    }
    setSaving(true);
    try {
      const stitches = Math.round(
        elements.reduce(
          (sum, el) => sum + (el.type === 'text' ? (el.text?.length || 4) * 210 : 780) * el.scale,
          0
        )
      );
      const colorsUsed = new Set(elements.map((el) => el.color)).size;
      await designsService.create({
        name: `Custom Design ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        thumbnail: require('@/assets/embroidery/manual-canvas.jpg'),
        stitches,
        colors: Math.max(1, colorsUsed),
        sizeMm: { width: 100, height: 100 },
        category: 'other',
      });
      show('Design saved to My Designs.', 'success');
      router.push('/designs');
    } catch {
      show("Couldn't save the design. Please try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={typography.pageTitle}>Manual Editor</Text>
          <Text style={[typography.body, styles.subtitle]}>
            Build a design entirely from scratch — add text and shapes, then drag them into
            place on the hoop.
          </Text>
        </View>
        <IconButton
          accessibilityLabel="Close editor"
          variant="filled"
          onPress={() => router.push('/create')}
        >
          <X size={18} color={colors.textSecondary} />
        </IconButton>
      </View>

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.mainCol, isDesktop && styles.mainColDesktop]}>
          <Text style={[typography.bodySmall, styles.sectionLabel]}>Add to canvas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbar}>
            <Pressable
              style={styles.toolButton}
              onPress={() => addElement({ type: 'text', text: 'Your Text' })}
            >
              <Type size={18} color={colors.indigo} />
              <Text style={styles.toolLabel}>Text</Text>
            </Pressable>
            {shapeOptions.map((opt) => (
              <Pressable
                key={opt.kind}
                style={styles.toolButton}
                onPress={() => addElement({ type: 'shape', shape: opt.kind })}
              >
                <opt.icon size={18} color={colors.indigo} />
                <Text style={styles.toolLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.canvasWrap}>
            <HoopCanvas onBackgroundPress={() => setSelectedId(null)}>
              {elements.map((el) => (
                <CanvasElementView
                  key={el.id}
                  element={el}
                  selected={el.id === selectedId}
                  onSelect={() => setSelectedId(el.id)}
                  onPositionChange={(pos) =>
                    setElements((prev) =>
                      prev.map((e) => (e.id === el.id ? { ...e, x: pos.x, y: pos.y } : e))
                    )
                  }
                />
              ))}
            </HoopCanvas>
            {elements.length === 0 && (
              <Text style={[typography.bodySmall, styles.canvasHint]}>
                Tap a button above to add your first element
              </Text>
            )}
          </View>

          <View style={styles.footerRow}>
            <Button label="Clear Canvas" variant="secondary" onPress={clearCanvas} />
            <Button
              label="Save Design"
              onPress={handleSave}
              loading={saving}
              disabled={elements.length === 0}
            />
          </View>
        </View>

        <View style={[styles.sideCol, isDesktop && styles.sideColDesktop]}>
          <Card>
            <View style={styles.cardTitleRow}>
              <Layers size={16} color={colors.textSecondary} />
              <Text style={typography.h3}>Layers</Text>
            </View>
            {elements.length === 0 ? (
              <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>
                No elements yet.
              </Text>
            ) : (
              <View style={{ gap: spacing.xs }}>
                {[...elements].reverse().map((el) => (
                  <Pressable
                    key={el.id}
                    onPress={() => setSelectedId(el.id)}
                    style={[styles.layerRow, el.id === selectedId && styles.layerRowActive]}
                  >
                    <View style={styles.layerIcon}>
                      {el.type === 'text' ? (
                        <Type size={14} color={el.color === '#FFFFFF' ? colors.gray400 : el.color} />
                      ) : (
                        <ShapeSvg kind={el.shape || 'circle'} size={16} color={el.color} />
                      )}
                    </View>
                    <Text style={[typography.bodySmall, { flex: 1 }]} numberOfLines={1}>
                      {el.type === 'text' ? el.text || 'Text' : `Shape · ${el.shape}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Properties</Text>
            {!selected ? (
              <EmptyState
                title="Nothing selected"
                description="Select an element on the canvas or in Layers to edit it."
              />
            ) : (
              <View style={{ gap: spacing.md }}>
                {selected.type === 'text' && (
                  <Input
                    label="Text content"
                    value={selected.text}
                    onChangeText={(t) => updateSelected({ text: t })}
                    placeholder="Your Text"
                  />
                )}

                <View>
                  <Text style={[typography.bodySmall, styles.propLabel]}>Color</Text>
                  <View style={styles.colorGrid}>
                    {elementColors.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => updateSelected({ color: c })}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: c },
                          selected.color === c && styles.colorSwatchActive,
                          c === '#FFFFFF' && styles.colorSwatchBorder,
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.stepperRow}>
                  <Text style={[typography.bodySmall, styles.propLabel]}>Size</Text>
                  <View style={styles.stepperControls}>
                    <IconButton
                      accessibilityLabel="Decrease size"
                      variant="filled"
                      size={32}
                      onPress={() => updateSelected({ scale: Math.max(0.5, selected.scale - 0.1) })}
                    >
                      <Minus size={14} color={colors.textSecondary} />
                    </IconButton>
                    <Text style={typography.bodySmall}>{Math.round(selected.scale * 100)}%</Text>
                    <IconButton
                      accessibilityLabel="Increase size"
                      variant="filled"
                      size={32}
                      onPress={() => updateSelected({ scale: Math.min(2, selected.scale + 0.1) })}
                    >
                      <Plus size={14} color={colors.textSecondary} />
                    </IconButton>
                  </View>
                </View>

                <View style={styles.stepperRow}>
                  <Text style={[typography.bodySmall, styles.propLabel]}>Rotation</Text>
                  <View style={styles.stepperControls}>
                    <IconButton
                      accessibilityLabel="Rotate"
                      variant="filled"
                      size={32}
                      onPress={() => updateSelected({ rotation: (selected.rotation + 15) % 360 })}
                    >
                      <RotateCw size={14} color={colors.textSecondary} />
                    </IconButton>
                    <Text style={typography.bodySmall}>{selected.rotation}°</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable style={styles.actionBtn} onPress={duplicateSelected}>
                    <Copy size={15} color={colors.textSecondary} />
                    <Text style={styles.actionLabel}>Duplicate</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => reorderSelected('front')}>
                    <ArrowUp size={15} color={colors.textSecondary} />
                    <Text style={styles.actionLabel}>Front</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => reorderSelected('back')}>
                    <ArrowDown size={15} color={colors.textSecondary} />
                    <Text style={styles.actionLabel}>Back</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={deleteSelected}>
                    <Trash2 size={15} color={colors.danger} />
                    <Text style={[styles.actionLabel, { color: colors.danger }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Card>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 520,
  },
  layout: {
    gap: spacing.lg,
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainCol: {},
  mainColDesktop: {
    flex: 1.2,
  },
  sideCol: {},
  sideColDesktop: {
    flex: 1,
  },
  sectionLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  toolbar: {
    marginBottom: spacing.lg,
  },
  toolButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: 72,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: typography.caption.fontFamily,
  },
  canvasWrap: {
    alignItems: 'center',
  },
  canvasHint: {
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  layerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  layerRowActive: {
    backgroundColor: colors.indigoTint,
  },
  layerIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 9,
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: colors.indigo,
  },
  colorSwatchBorder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: typography.bodySmall.fontFamily,
  },
});
