import { useGetWebsiteSettings } from "@workspace/api-client-react";
import { ContentSourceBanner } from "@/components/content/ContentSourceBanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe2, Image as ImageIcon } from "lucide-react";

function plainText(value?: string | null) {
  return value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "No website description is stored.";
}

function syncTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-JM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Not yet synchronized";
}

const imageLabels = [
  ["Light logo", "lightLogoUrl"],
  ["Dark logo", "darkLogoUrl"],
  ["Hero image", "heroImageUrl"],
  ["Home hero", "homeHeroImageUrl"],
] as const;

export default function WebsiteSettings() {
  const { data: settings, isLoading, isError } = useGetWebsiteSettings();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Website content</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Website settings</h1>
        <p className="mt-1 text-muted-foreground">Brand assets, page imagery, and synchronization status mirrored into Odoo.</p>
      </div>

      <ContentSourceBanner />

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground animate-pulse">Loading website settings…</CardContent></Card>
      ) : isError || !settings ? (
        <Card><CardContent className="py-12 text-center text-destructive">Website settings could not be loaded from Odoo.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center bg-secondary/20 text-primary"><Globe2 aria-hidden="true" className="h-5 w-5" /></div>
                  <div>
                    <CardTitle>{settings.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Public website identity</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent><p className="max-w-3xl text-sm leading-6 text-muted-foreground">{plainText(settings.description)}</p></CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Synchronization</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={settings.lastSyncStatus === "success" ? "secondary" : "outline"}>{settings.lastSyncStatus === "success" ? "Synced" : "Needs attention"}</Badge>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Last successful mirror</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{syncTime(settings.lastSyncAt)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <section aria-labelledby="website-assets-heading">
            <h2 id="website-assets-heading" className="font-display text-lg font-semibold">Brand and hero assets</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {imageLabels.map(([label, field]) => {
                const url = settings[field];
                return (
                  <Card key={field} className="overflow-hidden">
                    <div className="flex aspect-[16/9] items-center justify-center bg-muted">
                      {url ? <img src={url} alt={`${label} preview`} loading="lazy" className="h-full w-full object-contain p-3" /> : <ImageIcon aria-hidden="true" className="h-7 w-7 text-muted-foreground" />}
                    </div>
                    <CardContent className="border-t py-3"><p className="text-sm font-semibold">{label}</p></CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
