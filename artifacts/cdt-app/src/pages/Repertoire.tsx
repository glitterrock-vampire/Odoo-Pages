import { useState } from "react";
import { useListRepertoireItems } from "@workspace/api-client-react";
import { ContentSourceBanner } from "@/components/content/ContentSourceBanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Search } from "lucide-react";

export default function Repertoire() {
  const [search, setSearch] = useState("");
  const { data: response, isLoading, isError } = useListRepertoireItems({ search: search || undefined });
  const items = Array.isArray(response) ? response : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Website content</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Repertoire</h1>
        <p className="mt-1 text-muted-foreground">Published works, credits, and performance details mirrored into Odoo.</p>
      </div>

      <ContentSourceBanner />

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted/10 p-4">
          <div className="relative max-w-md">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search repertoire" placeholder="Search repertoire…" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead>Work</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Choreographer</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead>Classification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground animate-pulse">Loading repertoire…</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-destructive">Repertoire could not be loaded from Odoo.</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No repertoire works found.</TableCell></TableRow>
              ) : items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden border bg-muted text-muted-foreground">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" width={64} height={48} loading="lazy" className="h-full w-full object-cover" />
                        ) : <BookOpen aria-hidden="true" className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-primary">{item.title}</p>
                        <p className="mt-0.5 max-w-md text-xs text-muted-foreground">{item.subtitle || item.slug}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{item.year || "—"}</TableCell>
                  <TableCell>{item.choreographer || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{item.runtime || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {item.genre && <Badge variant="outline">{item.genre}</Badge>}
                      {item.stylePeriod && <Badge variant="secondary">{item.stylePeriod}</Badge>}
                      {!item.genre && !item.stylePeriod && <span className="text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
