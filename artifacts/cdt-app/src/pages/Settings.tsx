import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Database, Bell, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({ title: "Preferences saved", description: "Your settings have been updated successfully." });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
      <div>
        <h1 className="text-4xl font-extrabold text-primary font-display">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure application preferences and integrations.</p>
      </div>

      <div className="grid gap-8">
        <Card className="border-none shadow-xl rounded-2xl bg-card">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display text-2xl text-primary">Odoo Integration</CardTitle>
                <CardDescription className="text-base">Connection settings for Odoo ERP synchronization.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="odoo-url" className="text-base font-semibold">Odoo URL</Label>
                <Input id="odoo-url" value="https://odoo.cdtjamaica.org" readOnly className="bg-muted font-mono text-muted-foreground border-transparent rounded-xl" />
                <p className="text-sm text-muted-foreground">The base URL of your Odoo instance.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="odoo-db" className="text-base font-semibold">Database Name</Label>
                <Input id="odoo-db" value="cdt_prod_db" readOnly className="bg-muted font-mono text-muted-foreground border-transparent rounded-xl" />
              </div>
            </div>
            
            <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="font-bold text-emerald-900">Integration is Active</p>
              </div>
              <p className="text-sm">Contacts, Invoices, Donations, and Tasks are currently syncing every hour. Edit credentials via the backend server environment variables.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-2xl bg-card">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary/10 rounded-2xl">
                <SettingsIcon className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <CardTitle className="font-display text-2xl text-primary">General Preferences</CardTitle>
                <CardDescription className="text-base">Customize how the app looks and behaves.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  Email Notifications
                </Label>
                <p className="text-sm text-muted-foreground max-w-[80%]">Receive weekly digest reports via email outlining enrollment and finances.</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-secondary" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-lg font-semibold">Auto-Sync Odoo</Label>
                <p className="text-sm text-muted-foreground max-w-[80%]">Automatically fetch updates from Odoo without refreshing the page.</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-secondary" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-lg font-semibold">Compact View</Label>
                <p className="text-sm text-muted-foreground max-w-[80%]">Reduce padding in tables to show more data at once.</p>
              </div>
              <Switch className="data-[state=checked]:bg-secondary" />
            </div>
            
            <div className="pt-6 border-t flex justify-end">
              <Button className="gap-2 rounded-full font-bold shadow-md bg-primary hover:bg-primary/90 text-lg px-8 py-6" onClick={handleSave}>
                <Save className="w-5 h-5" /> Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
