import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, LogOut, Trash2, Server, Wifi, WifiOff } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { useResponsive } from '@/hooks/useResponsive';
import { authService } from '@/services/auth';
import type { StitchFormat, User } from '@/services/types';
import {
  LOCAL_DEV_BACKEND_URL,
  clearBackendUrl,
  getConfiguredBackendUrl,
  isBackendReachable,
  setBackendUrl,
} from '@/services/digitizing/backendClient';

const formats: StitchFormat[] = ['DST', 'PES', 'JEF', 'EXP', 'VP3', 'HUS'];
const hoopSizes = ['100x100', '120x180', '130x180', '140x200', '300x200', '360x200'];

export default function SettingsScreen() {
  const { show } = useToast();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [format, setFormat] = useState<StitchFormat>('DST');
  const [hoop, setHoop] = useState(hoopSizes[0]);
  const [unit, setUnit] = useState<'mm' | 'in'>('mm');
  const [notifyJobs, setNotifyJobs] = useState(true);
  const [notifyDesigns, setNotifyDesigns] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // --- Backend Connection (see backendClient.ts) ------------------------
  // `savedBackendUrl` mirrors exactly what `getBackendUrl()` resolves to
  // for every real API call elsewhere in the app -- this screen never
  // keeps its own separate notion of "the backend" that could drift from
  // what's actually used. `connected` only ever flips to `true` after a
  // real `GET /api/health` request succeeds (`isBackendReachable`); it is
  // never assumed from the mere presence of a saved URL.
  // Lazy initializers read the already-persisted config synchronously (a
  // plain localStorage read, see backendClient.ts) so the screen never
  // needs an effect just to mirror state that's already known at mount --
  // only the *async* reachability re-check below needs one.
  const [backendUrlInput, setBackendUrlInput] = useState(() => getConfiguredBackendUrl() || LOCAL_DEV_BACKEND_URL);
  const [savedBackendUrl, setSavedBackendUrl] = useState(() => getConfiguredBackendUrl());
  // `null` means "not yet confirmed" (a saved URL exists but the live
  // re-check below hasn't resolved yet) -- never assumed `true` just
  // because a URL is saved; `false` when nothing is saved at all.
  const [connected, setConnected] = useState<boolean | null>(() => (getConfiguredBackendUrl() ? null : false));
  const [checkingConnection, setCheckingConnection] = useState(() => !!getConfiguredBackendUrl());
  const [testResult, setTestResult] = useState<'reachable' | 'unreachable' | null>(null);

  useEffect(() => {
    // Re-validate the already-saved backend on screen load so the
    // Connected/Disconnected badge always reflects live reality, not just
    // "a URL happens to be saved" -- a stopped Flask process must show
    // Disconnected, not a stale Connected from a previous session.
    const existing = getConfiguredBackendUrl();
    if (!existing) return;
    isBackendReachable(existing).then((ok) => {
      setConnected(ok);
      setCheckingConnection(false);
    });
  }, []);

  const handleTestConnection = async () => {
    const candidate = backendUrlInput.trim();
    if (!candidate) {
      show('Enter a backend URL to test.', 'error');
      return;
    }
    setCheckingConnection(true);
    setTestResult(null);
    const ok = await isBackendReachable(candidate);
    setCheckingConnection(false);
    setTestResult(ok ? 'reachable' : 'unreachable');
    show(
      ok ? 'Backend reachable — GET /api/health responded OK.' : "Couldn't reach that backend URL.",
      ok ? 'success' : 'error'
    );
  };

  const handleSaveAndConnect = async () => {
    const candidate = backendUrlInput.trim();
    if (!candidate) {
      show('Enter a backend URL first.', 'error');
      return;
    }
    setCheckingConnection(true);
    const ok = await isBackendReachable(candidate);
    setBackendUrl(candidate);
    setSavedBackendUrl(candidate);
    setConnected(ok);
    setCheckingConnection(false);
    setTestResult(null);
    show(
      ok
        ? 'Saved — the app will now use the real Python backend.'
        : 'Saved, but the backend is not reachable yet. The app will use the local JavaScript fallback until it is.',
      ok ? 'success' : 'info'
    );
  };

  const handleDisconnect = () => {
    clearBackendUrl();
    setSavedBackendUrl('');
    setConnected(false);
    setTestResult(null);
    show('Disconnected — the app will use the local JavaScript fallback only.', 'info');
  };

  useEffect(() => {
    authService.getCurrentUser().then((u) => {
      setUser(u);
      setName(u.name);
      setEmail(u.email);
    });
    authService.getPreferences().then((prefs) => {
      setFormat(prefs.defaultFormat);
      setHoop(prefs.defaultHoop);
      setUnit(prefs.unit);
      setNotifyJobs(prefs.notifyJobs);
      setNotifyDesigns(prefs.notifyDesigns);
      setNotifyWeekly(prefs.notifyWeekly);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const [updatedUser] = await Promise.all([
      authService.updateProfile({ name, email }),
      authService.updatePreferences({
        defaultFormat: format,
        defaultHoop: hoop,
        unit,
        notifyJobs,
        notifyDesigns,
        notifyWeekly,
      }),
    ]);
    setUser(updatedUser);
    setSaving(false);
    show('Settings saved.', 'success');
  };

  if (!user) {
    return (
      <ScreenContainer>
        <Text style={typography.pageTitle}>Settings</Text>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Skeleton height={110} borderRadius={radius.card} />
          <Skeleton height={220} borderRadius={radius.card} />
        </View>
      </ScreenContainer>
    );
  }

  const creditsPct = Math.round((user.creditsUsed / user.creditsTotal) * 100);

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>Settings</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Manage your account, defaults, notifications and subscription.
      </Text>

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.col, isDesktop && styles.colDesktop]}>
          <Card>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Profile</Text>
            <View style={styles.profileRow}>
              <Avatar name={user.name} size={56} />
              <View style={{ flex: 1 }}>
                <Badge label={user.plan} tone="indigo" />
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                  {user.creditsUsed} / {user.creditsTotal} credits used ({creditsPct}%)
                </Text>
              </View>
            </View>
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <Input label="Full name" value={name} onChangeText={setName} />
              <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
            </View>
            <Button
              label="Upgrade Plan"
              variant="outline"
              icon={<Sparkles size={16} color={colors.indigo} />}
              onPress={() => show('Studio Plan unlocks unlimited exports and 24/7 support.', 'info')}
              style={{ marginTop: spacing.md }}
              fullWidth
            />
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Defaults</Text>
            <Text style={[typography.bodySmall, styles.fieldLabel]}>Default stitch format</Text>
            <View style={styles.chipRow}>
              {formats.map((f) => (
                <Pressable key={f} onPress={() => setFormat(f)} style={[styles.chip, format === f && styles.chipActive]}>
                  <Text style={[typography.bodySmall, { color: format === f ? colors.white : colors.textSecondary }]}>
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[typography.bodySmall, styles.fieldLabel, { marginTop: spacing.md }]}>Default hoop size</Text>
            <View style={styles.chipRow}>
              {hoopSizes.map((h) => (
                <Pressable key={h} onPress={() => setHoop(h)} style={[styles.chip, hoop === h && styles.chipActive]}>
                  <Text style={[typography.bodySmall, { color: hoop === h ? colors.white : colors.textSecondary }]}>
                    {h}mm
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={[typography.bodySmall, styles.fieldLabel, { marginTop: spacing.md }]}>Measurement unit</Text>
            <SegmentedControl
              value={unit}
              onChange={(v) => setUnit(v as 'mm' | 'in')}
              options={[
                { label: 'Millimeters', value: 'mm' },
                { label: 'Inches', value: 'in' },
              ]}
            />
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.backendHeaderRow}>
              <Text style={typography.h3}>Backend Connection</Text>
              {checkingConnection ? (
                <View style={styles.statusPill}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>Checking…</Text>
                </View>
              ) : (
                <Badge
                  label={connected ? 'Connected' : 'Disconnected'}
                  tone={connected ? 'success' : 'neutral'}
                  dot
                />
              )}
            </View>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
              Point the app at a running StitchPro Python backend (
              <Text style={{ fontFamily: typography.bodyMedium.fontFamily }}>api/app.py</Text>) for real
              digitizing, stitch-plan generation and multi-format export. When disconnected, Auto Digitize
              still works using the built-in local JavaScript engine.
            </Text>
            <Input
              label="Backend URL"
              value={backendUrlInput}
              onChangeText={(v) => {
                setBackendUrlInput(v);
                setTestResult(null);
              }}
              placeholder={LOCAL_DEV_BACKEND_URL}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              leftIcon={<Server size={16} color={colors.textTertiary} />}
            />
            <View style={styles.backendStatusRow}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>
                Active URL: {savedBackendUrl || 'none (using local fallback)'}
              </Text>
              {testResult && (
                <View style={styles.testResultRow}>
                  {testResult === 'reachable' ? (
                    <Wifi size={13} color={colors.success} />
                  ) : (
                    <WifiOff size={13} color={colors.danger} />
                  )}
                  <Text
                    style={[
                      typography.caption,
                      { color: testResult === 'reachable' ? colors.success : colors.danger },
                    ]}
                  >
                    {testResult === 'reachable' ? 'Reachable' : 'Unreachable'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.backendButtonRow}>
              <Button
                label="Test Connection"
                variant="outline"
                size="sm"
                loading={checkingConnection}
                onPress={handleTestConnection}
                style={{ flex: 1 }}
              />
              <Button
                label="Save & Connect"
                variant="primary"
                size="sm"
                loading={checkingConnection}
                onPress={handleSaveAndConnect}
                style={{ flex: 1 }}
              />
            </View>
            {!!savedBackendUrl && (
              <Button
                label="Disconnect (use local fallback)"
                variant="ghost"
                size="sm"
                onPress={handleDisconnect}
                style={{ marginTop: spacing.xs }}
                fullWidth
              />
            )}
          </Card>
        </View>

        <View style={[styles.col, isDesktop && styles.colDesktop]}>
          <Card>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Notifications</Text>
            <ToggleRow
              label="Job status updates"
              description="Get notified when a production job changes stage."
              value={notifyJobs}
              onValueChange={setNotifyJobs}
            />
            <ToggleRow
              label="Design completion alerts"
              description="Get notified when Auto Digitize finishes a design."
              value={notifyDesigns}
              onValueChange={setNotifyDesigns}
            />
            <ToggleRow
              label="Weekly summary email"
              description="A weekly digest of designs, jobs and machine activity."
              value={notifyWeekly}
              onValueChange={setNotifyWeekly}
              last
            />
          </Card>

          <Button label="Save Changes" onPress={handleSave} loading={saving} fullWidth style={{ marginTop: spacing.md }} />

          <Card style={styles.dangerCard}>
            <Text style={[typography.h3, { color: colors.danger, marginBottom: spacing.md }]}>Danger Zone</Text>
            <Pressable style={styles.dangerRow} onPress={() => show('Signed out.', 'info')}>
              <LogOut size={16} color={colors.textSecondary} />
              <Text style={[typography.body, { color: colors.textSecondary }]}>Sign Out</Text>
            </Pressable>
            <Pressable style={styles.dangerRow} onPress={() => setConfirmDelete(true)}>
              <Trash2 size={16} color={colors.danger} />
              <Text style={[typography.body, { color: colors.danger }]}>Delete Account</Text>
            </Pressable>
          </Card>
        </View>
      </View>

      <BottomSheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete Account?">
        <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            This will permanently remove your designs, jobs and account data. This action cannot be undone.
          </Text>
          <Button
            label="Yes, Delete My Account"
            variant="danger"
            fullWidth
            onPress={() => {
              setConfirmDelete(false);
              show('Account deletion is disabled in this demo.', 'error');
            }}
          />
          <Button label="Cancel" variant="ghost" fullWidth onPress={() => setConfirmDelete(false)} />
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  last,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, !last && styles.toggleRowBorder]}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={typography.bodyMedium}>{label}</Text>
        <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} accessibilityLabel={label} />
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
  col: {
    gap: spacing.md,
  },
  colDesktop: {
    flex: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fieldLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  toggleRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  backendStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  testResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  backendButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dangerCard: {
    borderColor: colors.dangerTint,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
