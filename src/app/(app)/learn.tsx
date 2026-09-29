import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Search,
  BookOpen,
  Wand2,
  Cpu,
  Palette,
  Wrench,
  Clock,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';

type LearnCategory = 'Getting Started' | 'Digitizing' | 'Machines' | 'Thread & Stabilizer' | 'Troubleshooting';

interface Article {
  id: string;
  title: string;
  category: LearnCategory;
  readMinutes: number;
  summary: string;
  body: string[];
}

const categoryIcon: Record<LearnCategory, LucideIcon> = {
  'Getting Started': BookOpen,
  Digitizing: Wand2,
  Machines: Cpu,
  'Thread & Stabilizer': Palette,
  Troubleshooting: Wrench,
};

const articles: Article[] = [
  {
    id: 'art_1',
    title: 'Your first design in StitchPro',
    category: 'Getting Started',
    readMinutes: 4,
    summary: 'A quick tour of Auto Digitize, the Manual Editor, and where your files end up.',
    body: [
      'StitchPro gives you two ways to create a design: Auto Digitize turns an uploaded image into stitches automatically, while the Manual Editor lets you build a design from text and shapes by hand.',
      'Every design you create — whichever path you use — is saved to My Designs, where you can favorite it, preview a simulated stitch-out, and export it in your machine\'s native format.',
      'If you are new, start with Auto Digitize on a simple, high-contrast logo. Once you are comfortable with formats and hoop sizing, try the Manual Editor for text-only jobs like names and monograms.',
    ],
  },
  {
    id: 'art_2',
    title: 'Choosing the right stitch format',
    category: 'Digitizing',
    readMinutes: 5,
    summary: 'DST, PES, JEF, EXP, VP3, HUS — what they mean and which machines use them.',
    body: [
      'Embroidery machines each read their own native stitch file format. DST (Tajima) is the closest thing to a universal standard and is accepted by most commercial machines.',
      'PES is used by Brother and Babylock home machines, JEF by Janome, EXP by Melco/Bernina, VP3 by Pfaff/Husqvarna Viking, and HUS by older Husqvarna machines.',
      'When in doubt, check your machine\'s manual or the Machine Center entry you created for it — StitchPro remembers each machine\'s default export format.',
    ],
  },
  {
    id: 'art_3',
    title: 'Reading a stitch density warning',
    category: 'Digitizing',
    readMinutes: 3,
    summary: 'Why some designs warn about density, and how it affects fabric puckering.',
    body: [
      'Stitch density is the number of stitches packed into a given area. Too dense on light fabric can cause puckering, thread breaks, and needle heat damage.',
      'Auto Digitize flags designs that exceed safe density thresholds for the fabric type you selected. Consider simplifying fine detail or increasing the design size to reduce density.',
      'As a rule of thumb, satin columns wider than about 12mm should be split, and fills on stretch fabric benefit from a lighter density with proper stabilizer backing.',
    ],
  },
  {
    id: 'art_4',
    title: 'Setting up a new machine profile',
    category: 'Machines',
    readMinutes: 3,
    summary: 'What hoop sizes, needle count and default format actually control.',
    body: [
      'Adding a machine to the Machine Center lets Jobs and the Cost Calculator reference accurate hoop sizes and formats when you assign work.',
      'Hoop sizes should reflect the physical embroidery areas your machine supports — StitchPro will warn you if a design exceeds the largest hoop you have listed.',
      'Needle count matters for multi-color jobs: a 15-needle machine can hold more thread colors loaded at once before requiring a manual thread change mid-run.',
    ],
  },
  {
    id: 'art_5',
    title: 'Machine maintenance checklist',
    category: 'Machines',
    readMinutes: 4,
    summary: 'A simple weekly routine that prevents most thread breaks and skipped stitches.',
    body: [
      'Clean lint from the bobbin case and race daily on high-usage machines — trapped lint is the single most common cause of skipped stitches.',
      'Oil the rotary hook weekly per your manufacturer\'s schedule, and replace needles every 8 hours of active stitching or immediately after a thread snag.',
      'Keep a maintenance log per machine in its notes field in the Machine Center so the whole team can see when service is due.',
    ],
  },
  {
    id: 'art_6',
    title: 'Matching thread brands across a design',
    category: 'Thread & Stabilizer',
    readMinutes: 3,
    summary: 'Why mixing brands mid-design can cause visible sheen and tension differences.',
    body: [
       'Different thread brands vary slightly in thickness, sheen and tension behavior. Mixing brands within one design can create visible inconsistencies once stitched.',
      'The Thread Library lets you build a palette from one or two trusted brands per job, keeping tension settings predictable across the whole run.',
      'If you must substitute a color, match the closest hex value in the same brand family rather than jumping to a different manufacturer.',
    ],
  },
  {
    id: 'art_7',
    title: 'Picking the right stabilizer',
    category: 'Thread & Stabilizer',
    readMinutes: 4,
    summary: 'Cut-away vs. tear-away vs. wash-away, and when to use each.',
    body: [
      'Cut-away stabilizer stays permanently behind the stitching and is best for stretch knits like t-shirts and polos that see repeated washing.',
      'Tear-away stabilizer is removed after stitching and suits stable wovens like canvas totes or twill caps where the back will not be seen or stressed.',
      'Wash-away stabilizer dissolves in water and is ideal for free-standing lace or designs on delicate fabric where no backing should remain visible.',
    ],
  },
  {
    id: 'art_8',
    title: 'Fixing thread breaks mid-run',
    category: 'Troubleshooting',
    readMinutes: 5,
    summary: 'A step-by-step checklist before you call for a service technician.',
    body: [
      'Start with the cheapest fix: rethread the machine completely, including the tension discs, and check the needle is not bent, burred, or inserted backward.',
      'Next check bobbin tension — a bobbin that unspools too freely is a very common, easily-missed cause of frequent top-thread breaks.',
      'If breaks persist, inspect the design for excessively dense fills or very short stitch lengths, which stress the thread more than normal running stitches.',
    ],
  },
  {
    id: 'art_9',
    title: 'Costing a job correctly',
    category: 'Getting Started',
    readMinutes: 4,
    summary: 'How the Cost Calculator estimates machine time, thread and suggested pricing.',
    body: [
      'The Cost Calculator converts your stitch count into estimated machine minutes using your machine\'s stitches-per-minute speed, then applies your hourly machine rate.',
      'Thread cost is estimated per 1,000 stitches — a good starting default is ₦30–₦50 per 1,000 stitches depending on brand and color count.',
      'Always add your digitizing fee as a one-time cost per order, not per piece, since the design only needs to be created once regardless of quantity.',
    ],
  },
];

const categories: LearnCategory[] = [
  'Getting Started',
  'Digitizing',
  'Machines',
  'Thread & Stabilizer',
  'Troubleshooting',
];

export default function LearnScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<LearnCategory | 'all'>('all');
  const [active, setActive] = useState<Article | null>(null);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (category !== 'all' && a.category !== category) return false;
      if (query && !a.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [query, category]);

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>Learn</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Guides and best practices for digitizing, machines, thread and troubleshooting.
      </Text>

      <View style={styles.toolsRow}>
        <Input
          placeholder="Search guides…"
          value={query}
          onChangeText={setQuery}
          leftIcon={<Search size={16} color={colors.textTertiary} />}
        />
      </View>

      <View style={styles.chipRow}>
        <Pressable
          onPress={() => setCategory('all')}
          style={[styles.chip, category === 'all' && styles.chipActive]}
        >
          <Text style={[typography.bodySmall, { color: category === 'all' ? colors.white : colors.textSecondary }]}>
            All Topics
          </Text>
        </Pressable>
        {categories.map((c) => (
          <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
            <Text style={[typography.bodySmall, { color: category === c ? colors.white : colors.textSecondary }]}>
              {c}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.grid}>
        {filtered.map((a) => {
          const Icon = categoryIcon[a.category];
          return (
            <Pressable key={a.id} onPress={() => setActive(a)} style={{ flexBasis: 280, flexGrow: 1 }}>
              <Card>
                <View style={styles.cardHeader}>
                  <View style={styles.iconWrap}>
                    <Icon size={18} color={colors.indigo} />
                  </View>
                  <Badge label={a.category} tone="indigo" />
                </View>
                <Text style={[typography.cardTitle, { marginTop: spacing.sm }]}>{a.title}</Text>
                <Text style={[typography.bodySmall, styles.summary]} numberOfLines={2}>
                  {a.summary}
                </Text>
                <View style={styles.readRow}>
                  <Clock size={12} color={colors.textTertiary} />
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>
                    {a.readMinutes} min read
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <BottomSheet visible={!!active} onClose={() => setActive(null)} title={active?.title}>
        {active && (
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <Badge label={active.category} tone="indigo" />
              <Badge label={`${active.readMinutes} min read`} tone="neutral" />
            </View>
            {active.body.map((p, i) => (
              <Text key={i} style={[typography.body, { color: colors.textSecondary }]}>
                {p}
              </Text>
            ))}
          </View>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    maxWidth: 560,
  },
  toolsRow: {
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  chipActive: {
    backgroundColor: colors.indigo,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.indigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  readRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
