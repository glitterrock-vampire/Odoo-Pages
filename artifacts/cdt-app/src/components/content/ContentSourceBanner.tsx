import { Badge } from "@/components/ui/badge";
import { Database, LockKeyhole } from "lucide-react";

export function ContentSourceBanner() {
  return (
    <section aria-label="Website content source" className="flex flex-col gap-3 border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-secondary/20 text-primary">
          <Database aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-foreground">Sanity primary</p>
            <Badge variant="outline">Odoo mirror</Badge>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            This is a read-only view of published website content synchronized into Odoo. Continue editing public content in Sanity until the production website cutover is complete.
          </p>
        </div>
      </div>
      <div className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
        <LockKeyhole aria-hidden="true" className="h-4 w-4" />
        Read only
      </div>
    </section>
  );
}
