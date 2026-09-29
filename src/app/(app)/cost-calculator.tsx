import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calculator as CalcIcon, TrendingUp } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useResponsive } from '@/hooks/useResponsive';
import { formatNGN, formatNumber } from '@/utils/format';

function useNumberField(initial: number) {
  const [raw, setRaw] = useState(String(initial));
  const value = useMemo(() => {
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [raw]);
  return { raw, setRaw, value };
}

export default function CostCalculatorScreen() {
  const { isDesktop } = useResponsive();

  const stitches = useNumberField(12000);
  const quantity = useNumberField(25);
  const garmentCost = useNumberField(2500);
  const threadCostPer1000 = useNumberField(35);
  const backingCost = useNumberField(150);
  const machineRatePerHour = useNumberField(4000);
  const stitchesPerMinute = useNumberField(700);
  const digitizingFee = useNumberField(5000);
  const markupPercent = useNumberField(45);

  const result = useMemo(() => {
    const minutes = stitchesPerMinute.value > 0 ? stitches.value / stitchesPerMinute.value : 0;
    const machineCostPerPiece = (minutes / 60) * machineRatePerHour.value;
    const threadCostPerPiece = (stitches.value / 1000) * threadCostPer1000.value;
    const materialsPerPiece = garmentCost.value + backingCost.value;
    const costPerPiece = materialsPerPiece + machineCostPerPiece + threadCostPerPiece;
    const totalCost = costPerPiece * quantity.value + digitizingFee.value;
    const suggestedPricePerPiece = costPerPiece * (1 + markupPercent.value / 100);
    const suggestedRevenue = suggestedPricePerPiece * quantity.value;
    const totalRevenueWithDigitizing = suggestedRevenue;
    const profit = totalRevenueWithDigitizing - totalCost;
    return {
      minutes,
      machineCostPerPiece,
      threadCostPerPiece,
      materialsPerPiece,
      costPerPiece,
      totalCost,
      suggestedPricePerPiece,
      suggestedRevenue,
      profit,
    };
  }, [
    stitches.value,
    stitchesPerMinute.value,
    machineRatePerHour.value,
    threadCostPer1000.value,
    garmentCost.value,
    backingCost.value,
    quantity.value,
    digitizingFee.value,
    markupPercent.value,
  ]);

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>Cost Calculator</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Estimate your true per-piece and order cost in Naira — materials, thread, machine time and
        a suggested sell price.
      </Text>

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.formCol, isDesktop && styles.formColDesktop]}>
          <Card>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Design & Order</Text>
            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Input
                  label="Stitch count"
                  keyboardType="numeric"
                  value={stitches.raw}
                  onChangeText={stitches.setRaw}
                />
              </View>
              <View style={styles.field}>
                <Input
                  label="Quantity (pieces)"
                  keyboardType="numeric"
                  value={quantity.raw}
                  onChangeText={quantity.setRaw}
                />
              </View>
            </View>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Cost Inputs (NGN)</Text>
            <View style={styles.fieldGrid}>
              <View style={styles.field}>
                <Input
                  label="Garment / base cost"
                  keyboardType="numeric"
                  value={garmentCost.raw}
                  onChangeText={garmentCost.setRaw}
                />
              </View>
              <View style={styles.field}>
                <Input
                  label="Backing / stabilizer"
                  keyboardType="numeric"
                  value={backingCost.raw}
                  onChangeText={backingCost.setRaw}
                />
              </View>
              <View style={styles.field}>
                <Input
                  label="Thread cost / 1,000 stitches"
                  keyboardType="numeric"
                  value={threadCostPer1000.raw}
                  onChangeText={threadCostPer1000.setRaw}
                />
              </View>
              <View style={styles.field}>
                <Input
                  label="Machine rate / hour"
                  keyboardType="numeric"
                  value={machineRatePerHour.raw}
                  onChangeText={machineRatePerHour.setRaw}
                />
              </View>
              <View style={styles.field}>
                <Input
                  label="Machine speed (stitches/min)"
                  keyboardType="numeric"
                  value={stitchesPerMinute.raw}
                  onChangeText={stitchesPerMinute.setRaw}
                />
              </View>
              <View style={styles.field}>
                <Input
                  label="One-time digitizing fee"
                  keyboardType="numeric"
                  value={digitizingFee.raw}
                  onChangeText={digitizingFee.setRaw}
                />
              </View>
            </View>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Markup</Text>
            <Input
              label="Target markup (%)"
              keyboardType="numeric"
              value={markupPercent.raw}
              onChangeText={markupPercent.setRaw}
            />
          </Card>
        </View>

        <View style={[styles.resultCol, isDesktop && styles.resultColDesktop]}>
          <Card style={styles.summaryCard}>
            <View style={styles.cardTitleRow}>
              <CalcIcon size={16} color={colors.indigo} />
              <Text style={typography.h3}>Per-piece breakdown</Text>
            </View>
            <Row label="Materials (garment + backing)" value={formatNGN(result.materialsPerPiece)} />
            <Row label="Thread cost" value={formatNGN(result.threadCostPerPiece)} />
            <Row
              label={`Machine time (${result.minutes.toFixed(1)} min)`}
              value={formatNGN(result.machineCostPerPiece)}
            />
            <View style={styles.divider} />
            <Row label="Cost per piece" value={formatNGN(result.costPerPiece)} emphasis />
          </Card>

          <Card style={[styles.summaryCard, styles.totalsCard]}>
            <View style={styles.cardTitleRow}>
              <TrendingUp size={16} color={colors.success} />
              <Text style={typography.h3}>Order totals</Text>
            </View>
            <Row label={`Total cost (${formatNumber(quantity.value)} pcs + digitizing)`} value={formatNGN(result.totalCost)} />
            <Row label="Suggested price / piece" value={formatNGN(result.suggestedPricePerPiece)} />
            <Row label="Suggested order revenue" value={formatNGN(result.suggestedRevenue)} />
            <View style={styles.divider} />
            <Row
              label="Estimated profit"
              value={formatNGN(result.profit)}
              emphasis
              valueColor={result.profit >= 0 ? colors.success : colors.danger}
            />
          </Card>
        </View>
      </View>
    </ScreenContainer>
  );
}

function Row({
  label,
  value,
  emphasis,
  valueColor,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={[typography.bodySmall, styles.rowLabel]}>{label}</Text>
      <Text
        style={[
          emphasis ? typography.h3 : typography.bodyMedium,
          { color: valueColor ?? colors.textPrimary },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    maxWidth: 560,
  },
  layout: {
    gap: spacing.lg,
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formCol: {},
  formColDesktop: {
    flex: 1.3,
  },
  resultCol: {
    gap: spacing.md,
  },
  resultColDesktop: {
    flex: 1,
    position: 'sticky' as any,
    top: spacing.xl,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  field: {
    flexBasis: 220,
    flexGrow: 1,
  },
  summaryCard: {},
  totalsCard: {
    borderColor: colors.indigo,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  rowLabel: {
    color: colors.textSecondary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
});
