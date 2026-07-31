import { useState } from "react";
import { useListTeamMembers } from "@workspace/api-client-react";
import { ContentSourceBanner } from "@/components/content/ContentSourceBanner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Star, UserRound } from "lucide-react";

const memberLabels = {
  dancer: "Dancer",
  management: "Management",
  board: "Board member",
} as const;

function sourceDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-JM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Not available";
}

export default function Team() {
  const [search, setSearch] = useState("");
  const { data: response, isLoading, isError } = useListTeamMembers({ search: search || undefined });
  const members = Array.isArray(response) ? response : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Website content</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Team</h1>
        <p className="mt-1 text-muted-foreground">Dancers, management, and board profiles published on the CDT website.</p>
      </div>

      <ContentSourceBanner />

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted/10 p-4">
          <div className="relative max-w-md">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search team members" placeholder="Search team members…" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead>Team member</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Source updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground animate-pulse">Loading team profiles…</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-destructive">Team profiles could not be loaded from Odoo.</TableCell></TableRow>
              ) : members.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No team profiles found.</TableCell></TableRow>
              ) : members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden border bg-muted text-muted-foreground">
                        {member.headshotUrl ? (
                          <img src={member.headshotUrl} alt={`${member.name} headshot`} width={44} height={44} loading="lazy" className="h-full w-full object-cover" />
                        ) : <UserRound aria-hidden="true" className="h-5 w-5" />}
                      </div>
                      <span className="font-semibold text-primary">{member.name}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{memberLabels[member.memberType]}</Badge></TableCell>
                  <TableCell className="text-sm">{member.role || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      {member.featured && <Star aria-hidden="true" className="h-3.5 w-3.5 fill-secondary text-secondary" />}
                      {member.featured ? "Featured" : "Standard"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sourceDate(member.sourceUpdatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
