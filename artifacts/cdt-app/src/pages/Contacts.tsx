import { type FormEvent, useState } from "react";
import {
  type Contact,
  getGetContactQueryKey,
  getListContactsQueryKey,
  useListContacts,
  useUpdateContact,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Building2, Edit2, LoaderCircle, Plus, Search, ShieldCheck, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ContactForm = {
  name: string;
  type: "individual" | "company";
  email: string;
  phone: string;
  street: string;
  city: string;
};

const emptyForm: ContactForm = {
  name: "",
  type: "individual",
  email: "",
  phone: "",
  street: "",
  city: "",
};

function formForContact(contact: Contact): ContactForm {
  return {
    name: contact.name,
    type: contact.type,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    street: contact.street ?? "",
    city: contact.city ?? "",
  };
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "The contact could not be saved. Please try again.";
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const { data: contactsResponse, isLoading, isError } = useListContacts({ search: search || undefined });
  const contacts = Array.isArray(contactsResponse) ? contactsResponse : [];
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const updateContact = useUpdateContact();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAdd = () => {
    toast({ title: "Feature coming soon", description: "Add contact form is under construction." });
  };

  const openEditor = (contact: Contact) => {
    updateContact.reset();
    setFormError("");
    setForm(formForContact(contact));
    setEditingContact(contact);
  };

  const closeEditor = () => {
    if (updateContact.isPending) return;
    setEditingContact(null);
    setForm(emptyForm);
    setFormError("");
  };

  const updateField = <K extends keyof ContactForm>(field: K, value: ContactForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError("");
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingContact) return;

    const name = form.name.trim();
    if (!editingContact.managedBySanity && !name) {
      setFormError("Contact name is required.");
      return;
    }

    const contactDetails = {
      email: form.email.trim(),
      phone: form.phone.trim(),
      street: form.street.trim(),
      city: form.city.trim(),
    };
    const data = editingContact.managedBySanity
      ? contactDetails
      : { ...contactDetails, name, type: form.type };

    updateContact.mutate(
      { id: editingContact.id, data },
      {
        onSuccess: async (updated) => {
          queryClient.setQueryData(getGetContactQueryKey(updated.id), updated);
          await queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() });
          toast({
            title: "Contact updated",
            description: `${updated.name}'s Odoo contact record is up to date.`,
          });
          setEditingContact(null);
          setForm(emptyForm);
        },
        onError: (error) => {
          const message = readableError(error);
          setFormError(message);
          toast({ title: "Contact update failed", description: message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage people and organizations from Odoo.</p>
        </div>
        <Button className="gap-2" onClick={handleAdd}>
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search contacts..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-primary">Name</TableHead>
                <TableHead className="font-semibold text-primary">Type</TableHead>
                <TableHead className="font-semibold text-primary">Contact Info</TableHead>
                <TableHead className="font-semibold text-primary">Location</TableHead>
                <TableHead className="text-right font-semibold text-primary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium animate-pulse">Loading contacts...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-destructive font-medium">Odoo contacts could not be loaded. Check the integration settings.</TableCell></TableRow>
              ) : contacts.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No contacts found.</TableCell></TableRow>
              ) : (
                contacts.map(contact => (
                  <TableRow key={contact.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell>
                      <div className="font-bold text-primary flex items-center gap-2">
                        {contact.type === 'company' ? <Building2 className="w-4 h-4 text-secondary" /> : <User className="w-4 h-4 text-primary/60" />}
                        {contact.name}
                      </div>
                      {contact.company && contact.type === 'individual' && (
                        <div className="text-xs text-muted-foreground mt-0.5 ml-6">{contact.company}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize shadow-sm">
                        {contact.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{contact.email || <span className="text-muted-foreground italic">-</span>}</div>
                      <div className="text-xs text-muted-foreground">{contact.phone || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{contact.city || <span className="text-muted-foreground italic">-</span>}</div>
                      <div className="text-xs text-muted-foreground">{contact.country || ''}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        <Button aria-label={`Edit ${contact.name}`} variant="ghost" size="icon" className="h-11 w-11 text-primary hover:bg-secondary/60 sm:h-9 sm:w-9" onClick={() => openEditor(contact)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editingContact !== null} onOpenChange={(open) => { if (!open) closeEditor(); }}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSave} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Edit contact</DialogTitle>
              <DialogDescription>
                Update the contact details stored in Odoo.
              </DialogDescription>
            </DialogHeader>

            {editingContact?.managedBySanity && (
              <div className="flex gap-3 rounded-lg border border-secondary/50 bg-secondary/15 p-3 text-sm text-foreground" role="status">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Public profile managed by Sanity</p>
                  <p className="mt-0.5 leading-5 text-muted-foreground">
                    Name and contact type stay read-only until the production website moves to Odoo. ERP contact details can be edited safely here.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  disabled={Boolean(editingContact?.managedBySanity) || updateContact.isPending}
                  required={!editingContact?.managedBySanity}
                  autoComplete="name"
                  className="h-11 sm:h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-type">Contact type</Label>
                <Select
                  value={form.type}
                  onValueChange={(value: "individual" | "company") => updateField("type", value)}
                  disabled={Boolean(editingContact?.managedBySanity) || updateContact.isPending}
                >
                  <SelectTrigger id="contact-type" className="h-11 sm:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  disabled={updateContact.isPending}
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="h-11 sm:h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  disabled={updateContact.isPending}
                  autoComplete="tel"
                  className="h-11 sm:h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-city">City</Label>
                <Input
                  id="contact-city"
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  disabled={updateContact.isPending}
                  autoComplete="address-level2"
                  className="h-11 sm:h-9"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contact-street">Street address</Label>
                <Input
                  id="contact-street"
                  value={form.street}
                  onChange={(event) => updateField("street", event.target.value)}
                  disabled={updateContact.isPending}
                  autoComplete="street-address"
                  className="h-11 sm:h-9"
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeEditor} disabled={updateContact.isPending} className="min-h-11 sm:min-h-9">
                Cancel
              </Button>
              <Button type="submit" disabled={updateContact.isPending} className="min-h-11 gap-2 sm:min-h-9">
                {updateContact.isPending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {updateContact.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
