import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { Save, Database, Bell, Settings as SettingsIcon, MailWarning } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { type AppPreferences, usePreferences } from "@/lib/preferences";

export default function Settings() {
  const { toast } = useToast();
  const { data: stats, isLoading: isCheckingIntegration } = useGetDashboardStats();
  const odooConfigured = stats?.odooConfigured ?? false;
  const { preferences, savePreferences } = usePreferences();
  const [draftPreferences, setDraftPreferences] = useState<AppPreferences>(preferences);

  useEffect(() => setDraftPreferences(preferences), [preferences]);

  const hasChanges = JSON.stringify(draftPreferences) !== JSON.stringify(preferences);

  const setPreference = <Key extends keyof AppPreferences,>(key: Key, value: AppPreferences[Key]) => {
    setDraftPreferences((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    savePreferences(draftPreferences);
    toast({
      title: "Preferences saved",
      description: draftPreferences.emailNotifications
        ? "Display and refresh preferences are active. Email delivery will begin after Odoo SMTP and a recipient are configured."
        : "Your display, refresh, and email preferences are active on this browser.",
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure application preferences and integrations.</p>
      </div>

      <div className="grid gap-8">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="border bg-primary/5 p-3">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display text-base font-semibold text-foreground">Odoo Community</CardTitle>
                <CardDescription className="text-base">Local contacts, accounting, donations, and task management.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="odoo-url" className="text-base font-semibold">Odoo Site URL</Label>
                <Input id="odoo-url" value={odooConfigured ? "Configured on the backend" : "Set ODOO_URL on the backend"} readOnly className="bg-muted font-mono text-muted-foreground border-transparent rounded-xl" />
                <p className="text-sm text-muted-foreground">The site URL is managed securely by the API server.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="odoo-auth" className="text-base font-semibold">API Authentication</Label>
                <Input id="odoo-auth" value={odooConfigured ? "Local API credentials configured" : "Credentials not configured"} readOnly className="bg-muted font-mono text-muted-foreground border-transparent rounded-xl" />
                <p className="text-sm text-muted-foreground">Credentials are never exposed to the browser.</p>
              </div>
            </div>
            
            <div className={odooConfigured ? "border border-emerald-200 bg-emerald-50 p-5 text-emerald-900" : "border border-amber-300/70 bg-amber-50 p-5 text-amber-950"}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${odooConfigured ? "bg-emerald-500" : "bg-amber-500"}`}></div>
                <p className="font-semibold">
                  {isCheckingIntegration ? "Checking integration" : odooConfigured ? "Odoo is configured" : "Odoo is not configured"}
                </p>
              </div>
              <p className="text-sm">
                {odooConfigured
                  ? "Contacts, sales invoices, donations, and tasks are read from Odoo when requested."
                  : "Add the Odoo URL, database, username, and API key to the backend environment to enable administrative records."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="border bg-muted p-3">
                <SettingsIcon className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <CardTitle className="font-display text-base font-semibold text-foreground">General Preferences</CardTitle>
                <CardDescription className="text-base">Customize how the app looks and behaves.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="email-notifications" className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground max-w-[80%]">Receive weekly digest reports via email outlining enrollment and finances.</p>
              </div>
              <Switch
                id="email-notifications"
                checked={draftPreferences.emailNotifications}
                onCheckedChange={(checked) => setPreference("emailNotifications", checked)}
                className="data-[state=checked]:bg-secondary"
              />
            </div>
            {draftPreferences.emailNotifications && (
              <div className="flex gap-3 border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950">
                <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p><span className="font-semibold">Delivery setup required.</span> Configure an outgoing mail server and digest recipient in Odoo before weekly emails can be sent.</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="automatic-odoo-refresh" className="text-lg font-semibold">Automatic Odoo Refresh</Label>
                <p className="text-sm text-muted-foreground max-w-[80%]">Refresh Odoo-backed records when each administrative page is opened.</p>
              </div>
              <Switch
                id="automatic-odoo-refresh"
                checked={draftPreferences.automaticOdooRefresh}
                onCheckedChange={(checked) => setPreference("automaticOdooRefresh", checked)}
                className="data-[state=checked]:bg-secondary"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="compact-view" className="text-lg font-semibold">Compact View</Label>
                <p className="text-sm text-muted-foreground max-w-[80%]">Reduce padding in tables to show more data at once.</p>
              </div>
              <Switch
                id="compact-view"
                checked={draftPreferences.compactView}
                onCheckedChange={(checked) => setPreference("compactView", checked)}
                className="data-[state=checked]:bg-secondary"
              />
            </div>
            
            <div className="pt-6 border-t flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Preferences are stored on this browser.</p>
              <Button size="lg" className="gap-2" onClick={handleSave} disabled={!hasChanges}>
                <Save className="w-5 h-5" /> Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
