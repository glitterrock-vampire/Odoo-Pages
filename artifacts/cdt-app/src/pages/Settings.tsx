import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSchoolSettingsQueryKey,
  useGetDashboardStats,
  useGetSchoolSettings,
  useUpdateSchoolSettings,
  type SchoolSettingsUpdate,
} from "@workspace/api-client-react";
import { Bell, Clock3, Database, LoaderCircle, MailWarning, Save, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { type AppPreferences, usePreferences } from "@/lib/preferences";

const emptyAutomation: SchoolSettingsUpdate = {
  attendanceNotificationsEnabled: false,
  automaticFeeRemindersEnabled: false,
  feeReminderDelayDays: 7,
  feeReminderRepeatDays: 7,
};

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stats, isLoading: isCheckingIntegration } = useGetDashboardStats();
  const { data: schoolSettings, isLoading: isLoadingSchoolSettings, isError: isSchoolSettingsError } = useGetSchoolSettings();
  const updateSchoolSettings = useUpdateSchoolSettings();
  const odooConfigured = stats?.odooConfigured ?? false;
  const { preferences, savePreferences } = usePreferences();
  const [draftPreferences, setDraftPreferences] = useState<AppPreferences>(preferences);
  const [automationDraft, setAutomationDraft] = useState<SchoolSettingsUpdate>(emptyAutomation);

  useEffect(() => setDraftPreferences(preferences), [preferences]);
  useEffect(() => {
    if (!schoolSettings) return;
    setAutomationDraft({
      attendanceNotificationsEnabled: schoolSettings.attendanceNotificationsEnabled,
      automaticFeeRemindersEnabled: schoolSettings.automaticFeeRemindersEnabled,
      feeReminderDelayDays: schoolSettings.feeReminderDelayDays,
      feeReminderRepeatDays: schoolSettings.feeReminderRepeatDays,
    });
  }, [schoolSettings]);

  const preferenceChanges = JSON.stringify(draftPreferences) !== JSON.stringify(preferences);
  const automationChanges = Boolean(schoolSettings) && (
    automationDraft.attendanceNotificationsEnabled !== schoolSettings?.attendanceNotificationsEnabled
    || automationDraft.automaticFeeRemindersEnabled !== schoolSettings?.automaticFeeRemindersEnabled
    || automationDraft.feeReminderDelayDays !== schoolSettings?.feeReminderDelayDays
    || automationDraft.feeReminderRepeatDays !== schoolSettings?.feeReminderRepeatDays
  );

  const setPreference = <Key extends keyof AppPreferences,>(key: Key, value: AppPreferences[Key]) => {
    setDraftPreferences((current) => ({ ...current, [key]: value }));
  };

  const setAutomation = <Key extends keyof SchoolSettingsUpdate,>(key: Key, value: SchoolSettingsUpdate[Key]) => {
    setAutomationDraft((current) => ({ ...current, [key]: value }));
  };

  const saveBrowserPreferences = () => {
    savePreferences(draftPreferences);
    toast({ title: "Display preferences saved", description: "Refresh and table-density preferences are active on this browser." });
  };

  const saveAutomationSettings = () => {
    updateSchoolSettings.mutate({ data: automationDraft }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSchoolSettingsQueryKey() });
        toast({ title: "Odoo notification settings saved", description: "The school automation schedule is now stored in Odoo." });
      },
      onError: () => {
        toast({
          title: "Notification settings were not saved",
          description: "Configure an active outgoing mail server in Odoo before enabling automatic notifications.",
          variant: "destructive",
        });
      },
    });
  };

  const mailReady = schoolSettings?.outgoingMailConfigured ?? false;

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">System administration</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage secure Odoo integrations, school notifications, and browser display preferences.</p>
      </div>

      <div className="grid gap-8">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="border bg-primary/5 p-3"><Database aria-hidden="true" className="h-6 w-6 text-primary" /></div>
              <div><CardTitle className="font-display text-base font-semibold">Odoo Community</CardTitle><CardDescription className="text-base">Contacts, accounting, donations, education, and tasks.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="odoo-url" className="text-base font-semibold">Odoo site URL</Label><Input id="odoo-url" value={odooConfigured ? "Configured on the backend" : "Set ODOO_URL on the backend"} readOnly className="rounded-xl border-transparent bg-muted font-mono text-muted-foreground" /><p className="text-sm text-muted-foreground">The API server manages this value securely.</p></div>
              <div className="space-y-2"><Label htmlFor="odoo-auth" className="text-base font-semibold">API authentication</Label><Input id="odoo-auth" value={odooConfigured ? "Local API credentials configured" : "Credentials not configured"} readOnly className="rounded-xl border-transparent bg-muted font-mono text-muted-foreground" /><p className="text-sm text-muted-foreground">Credentials are never exposed to the browser.</p></div>
            </div>
            <div className={odooConfigured ? "border border-emerald-200 bg-emerald-50 p-5 text-emerald-900" : "border border-amber-300/70 bg-amber-50 p-5 text-amber-950"}>
              <div className="mb-2 flex items-center gap-2"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${odooConfigured ? "bg-emerald-500" : "bg-amber-500"}`} /><p className="font-semibold">{isCheckingIntegration ? "Checking integration" : odooConfigured ? "Odoo is configured" : "Odoo is not configured"}</p></div>
              <p className="text-sm">{odooConfigured ? "Administrative pages are connected to the local Odoo database." : "Add the Odoo URL, database, username, and API key to the backend environment."}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="border bg-secondary/15 p-3"><Bell aria-hidden="true" className="h-6 w-6 text-primary" /></div>
              <div><CardTitle className="font-display text-base font-semibold">Family notifications</CardTitle><CardDescription className="text-base">Configure real Odoo attendance and overdue tuition automation.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-7">
            {isLoadingSchoolSettings ? (
              <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Loading Odoo notification settings…</div>
            ) : isSchoolSettingsError ? (
              <div className="border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950">Odoo notification settings could not be loaded. Confirm the Education module is installed and the API is online.</div>
            ) : (
              <>
                <div className={mailReady ? "flex gap-3 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" : "flex gap-3 border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950"}>
                  {mailReady ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : <MailWarning aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
                  <p><span className="font-semibold">{mailReady ? "Outgoing email is configured." : "Outgoing email setup required."}</span> {mailReady ? "Automatic messages can be queued by Odoo." : "Add an active outgoing mail server in Odoo before these switches can be enabled."}</p>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-1"><Label htmlFor="attendance-notifications" className="text-base font-semibold">Attendance notifications</Label><p className="max-w-2xl text-sm text-muted-foreground">Queue a guardian email when a student is recorded absent or late.</p></div>
                  <Switch id="attendance-notifications" checked={automationDraft.attendanceNotificationsEnabled ?? false} disabled={!mailReady} onCheckedChange={(checked) => setAutomation("attendanceNotificationsEnabled", checked)} />
                </div>
                <div className="flex items-center justify-between gap-6">
                  <div className="space-y-1"><Label htmlFor="fee-reminders" className="text-base font-semibold">Automatic tuition reminders</Label><p className="max-w-2xl text-sm text-muted-foreground">Queue overdue balance reminders through Odoo's daily scheduler.</p></div>
                  <Switch id="fee-reminders" checked={automationDraft.automaticFeeRemindersEnabled ?? false} disabled={!mailReady} onCheckedChange={(checked) => setAutomation("automaticFeeRemindersEnabled", checked)} />
                </div>
                <div className="grid gap-5 border-t pt-6 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="reminder-delay">First reminder after</Label><div className="relative"><Input id="reminder-delay" type="number" min={0} value={automationDraft.feeReminderDelayDays ?? 7} onChange={(event) => setAutomation("feeReminderDelayDays", Math.max(0, Number(event.target.value)))} className="min-h-11 pr-14" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">days</span></div></div>
                  <div className="space-y-2"><Label htmlFor="reminder-repeat">Repeat reminder every</Label><div className="relative"><Input id="reminder-repeat" type="number" min={1} value={automationDraft.feeReminderRepeatDays ?? 7} onChange={(event) => setAutomation("feeReminderRepeatDays", Math.max(1, Number(event.target.value)))} className="min-h-11 pr-14" /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">days</span></div></div>
                </div>
                <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="h-4 w-4" />Settings apply to {schoolSettings?.institutionName ?? "the active institution"}.</p><Button onClick={saveAutomationSettings} disabled={!automationChanges || updateSchoolSettings.isPending} className="min-h-11 gap-2">{updateSchoolSettings.isPending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}{updateSchoolSettings.isPending ? "Saving…" : "Save notification settings"}</Button></div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4"><div className="flex items-center gap-4"><div className="border bg-muted p-3"><SettingsIcon aria-hidden="true" className="h-6 w-6 text-secondary" /></div><div><CardTitle className="font-display text-base font-semibold">Browser preferences</CardTitle><CardDescription className="text-base">Control refresh behavior and table density on this device.</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-center justify-between gap-6"><div className="space-y-1"><Label htmlFor="automatic-odoo-refresh" className="text-base font-semibold">Automatic Odoo refresh</Label><p className="max-w-2xl text-sm text-muted-foreground">Refresh Odoo-backed records whenever an administrative page is opened.</p></div><Switch id="automatic-odoo-refresh" checked={draftPreferences.automaticOdooRefresh} onCheckedChange={(checked) => setPreference("automaticOdooRefresh", checked)} /></div>
            <div className="flex items-center justify-between gap-6"><div className="space-y-1"><Label htmlFor="compact-view" className="text-base font-semibold">Compact view</Label><p className="max-w-2xl text-sm text-muted-foreground">Reduce table padding to show more records at once.</p></div><Switch id="compact-view" checked={draftPreferences.compactView} onCheckedChange={(checked) => setPreference("compactView", checked)} /></div>
            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">These preferences remain on this browser.</p><Button onClick={saveBrowserPreferences} disabled={!preferenceChanges} className="min-h-11 gap-2"><Save aria-hidden="true" className="h-4 w-4" />Save browser preferences</Button></div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
