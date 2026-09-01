import { useState } from "react";
import { useListMediaItems } from "@workspace/api-client-react";
import { ContentSourceBanner } from "@/components/content/ContentSourceBanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Images, Search } from "lucide-react";

function mediaLink(item: { videoUrl?: string | null; vimeoUrl?: string | null; youtubeUrl?: string | null }) {
  return item.videoUrl || item.vimeoUrl || item.youtubeUrl || null;
}

export default function Media() {
  const [search, setSearch] = useState("");
  const { data: response, isLoading, isError } = useListMediaItems({ search: search || undefined });
  const items = Array.isArray(response) ? response : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Website content</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Media library</h1>
        <p className="mt-1 text-muted-foreground">Published website video and media records mirrored into Odoo.</p>
      </div>

      <ContentSourceBanner />

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted/10 p-4">
          <div className="relative max-w-md">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search media" placeholder="Search media…" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead>Media</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="text-right">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground animate-pulse">Loading media…</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-destructive">Media could not be loaded from Odoo.</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No media items found.</TableCell></TableRow>
              ) : items.map((item) => {
                const link = mediaLink(item);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden border bg-muted text-muted-foreground">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt="" width={64} height={48} loading="lazy" className="h-full w-full object-cover" />
                          ) : <Images aria-hidden="true" className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-semibold text-primary">{item.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.category || item.slug || "Website media"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{item.videoType || "Media"}</Badge></TableCell>
                    <TableCell>{item.duration || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><div className="flex flex-wrap gap-1">{item.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div></TableCell>
                    <TableCell className="text-right">
                      {link ? (
                        <a href={link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
                          Open <ExternalLink aria-hidden="true" className="h-4 w-4" />
                        </a>
                      ) : <span className="text-sm text-muted-foreground">No link</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
