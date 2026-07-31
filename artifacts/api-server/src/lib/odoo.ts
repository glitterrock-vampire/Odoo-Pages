import { logger } from "./logger";

const ODOO_URL = (process.env.ODOO_URL ?? "").replace(/\/$/, "");
const ODOO_DB = process.env.ODOO_DB ?? "";
const ODOO_USERNAME = process.env.ODOO_USERNAME ?? "";
const ODOO_API_KEY = process.env.ODOO_API_KEY ?? "";

export function isOdooConfigured(): boolean {
  return Boolean(ODOO_URL && ODOO_DB && ODOO_USERNAME && ODOO_API_KEY);
}

export function getOdooPublicUrl(): string {
  return (process.env.ODOO_PUBLIC_URL ?? ODOO_URL).replace(/\/$/, "");
}

interface OdooRpcError {
  message?: string;
  data?: { message?: string; debug?: string };
}

let cachedUid: number | null = null;
let authInFlight: Promise<number> | null = null;

async function rpc<T>(service: string, method: string, args: unknown[]): Promise<T> {
  const response = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
  });

  if (!response.ok) throw new Error(`Odoo HTTP ${response.status}`);

  const payload = await response.json() as { result?: T; error?: OdooRpcError };
  if (payload.error) {
    const message = payload.error.data?.message ?? payload.error.message ?? "Unknown Odoo error";
    logger.error({ service, method, message }, "Odoo RPC request failed");
    throw new Error(`Odoo error: ${message}`);
  }

  return payload.result as T;
}

async function authenticate(): Promise<number> {
  if (!isOdooConfigured()) {
    throw new Error("Odoo is not configured. Set ODOO_URL, ODOO_DB, ODOO_USERNAME, and ODOO_API_KEY.");
  }

  const uid = await rpc<number | false>("common", "authenticate", [
    ODOO_DB,
    ODOO_USERNAME,
    ODOO_API_KEY,
    {},
  ]);

  if (!uid) throw new Error("Odoo authentication failed. Check the database and credentials.");
  cachedUid = uid;
  logger.info({ uid, database: ODOO_DB }, "Odoo authenticated");
  return uid;
}

async function getUid(): Promise<number> {
  if (cachedUid !== null) return cachedUid;
  if (!authInFlight) {
    authInFlight = authenticate().finally(() => { authInFlight = null; });
  }
  return authInFlight;
}

async function callOdoo<T>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  const uid = await getUid();
  return rpc<T>("object", "execute_kw", [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    model,
    method,
    args,
    kwargs,
  ]);
}

type Many2One = [number, string] | false;

export interface OdooPartner {
  id: number;
  name: string;
  ref: string | false;
  email: string | false;
  phone: string | false;
  is_company: boolean;
  company_name: string | false;
  street: string | false;
  city: string | false;
  country_id: Many2One;
  create_date: string;
}

const PARTNER_FIELDS = [
  "id", "name", "ref", "email", "phone", "is_company", "company_name",
  "street", "city", "country_id", "create_date",
];

export function listOdooPartners(search = "", limit = 100): Promise<OdooPartner[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) domain.push(["name", "ilike", search]);
  return callOdoo("res.partner", "search_read", [domain], {
    fields: PARTNER_FIELDS,
    limit,
    order: "name asc",
  });
}

export async function getOdooPartner(id: number): Promise<OdooPartner | null> {
  const records = await callOdoo<OdooPartner[]>("res.partner", "search_read", [[
    ["id", "=", id],
  ]], { fields: PARTNER_FIELDS, limit: 1 });
  return records[0] ?? null;
}

export function createOdooPartner(data: {
  name: string;
  email?: string;
  phone?: string;
  is_company?: boolean;
  street?: string;
  city?: string;
}): Promise<number> {
  return callOdoo("res.partner", "create", [{
    name: data.name,
    email: data.email || false,
    phone: data.phone || false,
    is_company: data.is_company ?? false,
    street: data.street || false,
    city: data.city || false,
  }]);
}

export function updateOdooPartner(id: number, data: Record<string, unknown>): Promise<boolean> {
  return callOdoo("res.partner", "write", [[id], data]);
}

export interface OdooTeamMember {
  id: number;
  sanity_id: string | false;
  sanity_updated_at: string | false;
  name: string;
  member_type: string;
  role: string | false;
  years_active: string | false;
  term: string | false;
  featured: boolean;
  sequence: number;
  headshot_url: string | false;
}

export function listOdooTeamMembers(search = ""): Promise<OdooTeamMember[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) domain.push(["name", "ilike", search]);
  return callOdoo("cdt.team.member", "search_read", [domain], {
    fields: [
      "id", "sanity_id", "sanity_updated_at", "name", "member_type", "role",
      "years_active", "term", "featured", "sequence", "headshot_url",
    ],
    order: "member_type asc, sequence asc, name asc",
  });
}

export interface OdooRepertoireItem {
  id: number;
  sanity_id: string | false;
  sanity_updated_at: string | false;
  title: string;
  subtitle: string | false;
  slug: string;
  year: number;
  runtime: string | false;
  choreographer: string | false;
  genre: string | false;
  style_period: string | false;
  youtube_id: string | false;
  thumbnail_url: string | false;
  hero_image_url: string | false;
}

export function listOdooRepertoireItems(search = ""): Promise<OdooRepertoireItem[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) domain.push(["title", "ilike", search]);
  return callOdoo("cdt.repertoire.item", "search_read", [domain], {
    fields: [
      "id", "sanity_id", "sanity_updated_at", "title", "subtitle", "slug",
      "year", "runtime", "choreographer", "genre", "style_period", "youtube_id",
      "thumbnail_url", "hero_image_url",
    ],
    order: "year desc, title asc",
  });
}

export interface OdooMediaItem {
  id: number;
  sanity_id: string | false;
  sanity_updated_at: string | false;
  title: string;
  slug: string | false;
  video_type: string | false;
  duration: string | false;
  published_at: string | false;
  featured: boolean;
  tags: string | false;
  category: string | false;
  video_url: string | false;
  vimeo_url: string | false;
  youtube_url: string | false;
  thumbnail_url: string | false;
}

export function listOdooMediaItems(search = ""): Promise<OdooMediaItem[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) domain.push(["title", "ilike", search]);
  return callOdoo("cdt.media.item", "search_read", [domain], {
    fields: [
      "id", "sanity_id", "sanity_updated_at", "title", "slug", "video_type",
      "duration", "published_at", "featured", "tags", "category", "video_url",
      "vimeo_url", "youtube_url", "thumbnail_url",
    ],
    order: "published_at desc, title asc",
  });
}

export interface OdooWebsiteSetting {
  id: number;
  sanity_id: string | false;
  sanity_updated_at: string | false;
  title: string;
  description: string | false;
  light_logo_url: string | false;
  dark_logo_url: string | false;
  hero_image_url: string | false;
  home_hero_image_url: string | false;
  last_sync_at: string | false;
  last_sync_status: string | false;
  last_sync_message: string | false;
}

export function listOdooWebsiteSettings(): Promise<OdooWebsiteSetting[]> {
  return callOdoo("cdt.site.setting", "search_read", [[
    ["active", "=", true],
  ]], {
    fields: [
      "id", "sanity_id", "sanity_updated_at", "title", "description",
      "light_logo_url", "dark_logo_url", "hero_image_url", "home_hero_image_url",
      "last_sync_at", "last_sync_status", "last_sync_message",
    ],
    order: "id asc",
  });
}

export interface OdooPerformance {
  id: number;
  sanity_id: string | false;
  title: string;
  date: string;
  time: string | false;
  venue: string;
  description: string | false;
  status: string;
  participating_class_ids: number[];
  ticket_price: number;
  capacity: number;
  create_date: string;
}

const PERFORMANCE_FIELDS = [
  "id", "sanity_id", "title", "date", "time", "venue", "description", "status",
  "participating_class_ids", "ticket_price", "capacity", "create_date",
];

export function listOdooPerformances(search = "", upcoming = false): Promise<OdooPerformance[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) domain.push(["title", "ilike", search]);
  if (upcoming) domain.push(["status", "=", "upcoming"]);
  return callOdoo("cdt.performance", "search_read", [domain], {
    fields: PERFORMANCE_FIELDS,
    order: "date asc, time asc, id asc",
  });
}

export async function getOdooPerformance(id: number): Promise<OdooPerformance | null> {
  const records = await callOdoo<OdooPerformance[]>("cdt.performance", "search_read", [[
    ["id", "=", id],
  ]], { fields: PERFORMANCE_FIELDS, limit: 1 });
  return records[0] ?? null;
}

export async function createOdooPerformance(data: Record<string, unknown>): Promise<OdooPerformance> {
  const id = await callOdoo<number>("cdt.performance", "create", [data]);
  const record = await getOdooPerformance(id);
  if (!record) throw new Error("Performance was created in Odoo but could not be reloaded.");
  return record;
}

export async function updateOdooPerformance(
  id: number,
  data: Record<string, unknown>,
): Promise<OdooPerformance | null> {
  const exists = await getOdooPerformance(id);
  if (!exists) return null;
  await callOdoo<boolean>("cdt.performance", "write", [[id], data]);
  return getOdooPerformance(id);
}

export async function deleteOdooPerformance(id: number): Promise<boolean> {
  const exists = await getOdooPerformance(id);
  if (!exists) return false;
  return callOdoo<boolean>("cdt.performance", "unlink", [[id]]);
}

interface EngagementPerformance {
  id: number;
  title: string;
  date: string;
  venue: string;
  status: string;
  capacity: number;
  event_id: Many2One;
  registration_count: number;
  attendee_count: number;
  seats_available: number;
  ticket_tier_count: number;
  registered_value: number;
  currency_id: Many2One;
}

interface MailingListSummary {
  id: number;
  name: string;
  contact_count: number;
  contact_count_opt_out: number;
  mailing_count: number;
}

interface MailingSummary {
  id: number;
  subject: string;
  state: string;
  sent: number;
  total: number;
  contact_list_ids: number[];
  schedule_date: string | false;
}

interface MailingSubscriptionSummary {
  id: number;
  contact_id: Many2One;
}

interface AdmissionSummary {
  id: number;
  name: string;
  program_id: Many2One;
  academic_year_id: Many2One;
  application_start: string;
  application_end: string;
  capacity: number;
  application_fee: number;
  state: string;
  applicant_ids: number[];
}

interface ApplicantSummary {
  id: number;
  name: string;
  full_name: string;
  admission_id: Many2One;
  application_date: string;
  guardian_name: string | false;
  state: string;
}

interface MarketingSyncSummary {
  marketing_last_sync_at: string | false;
  marketing_last_sync_status: "success" | "skipped" | "failed" | false;
  marketing_audience_total: number;
  marketing_audience_active: number;
  marketing_audience_opt_out: number;
}

export async function getOdooSchoolEngagementSnapshot() {
  const today = new Date().toISOString().slice(0, 10);
  const [performances, mailingLists, campaigns, marketingSettings, outgoingServers, admissions, applicants, guardians, portalUsers] = await Promise.all([
    callOdoo<EngagementPerformance[]>("cdt.performance", "search_read", [[
      ["event_id", "!=", false],
      ["active", "=", true],
    ]], {
      fields: [
        "id", "title", "date", "venue", "status", "capacity", "event_id",
        "registration_count", "attendee_count", "seats_available",
        "ticket_tier_count", "registered_value", "currency_id",
      ],
      order: "date asc, id asc",
      limit: 50,
    }),
    callOdoo<MailingListSummary[]>("mailing.list", "search_read", [[
      ["active", "=", true],
      ["name", "in", ["CDT Website Subscribers", "CDT Parents & Guardians", "Dance Foundations Families", "Performance Guests"]],
    ]], {
      fields: ["id", "name", "contact_count", "contact_count_opt_out", "mailing_count"],
      order: "name asc",
      limit: 100,
    }),
    callOdoo<MailingSummary[]>("mailing.mailing", "search_read", [[]], {
      fields: ["id", "subject", "state", "sent", "total", "contact_list_ids", "schedule_date"],
      order: "create_date desc, id desc",
      limit: 50,
    }),
    callOdoo<MarketingSyncSummary[]>("cdt.site.setting", "search_read", [[]], {
      fields: [
        "marketing_last_sync_at", "marketing_last_sync_status", "marketing_audience_total",
        "marketing_audience_active", "marketing_audience_opt_out",
      ],
      order: "id asc",
      limit: 1,
    }),
    searchOdooCount("ir.mail_server", [["active", "=", true]]),
    callOdoo<AdmissionSummary[]>("cdt.student.admission", "search_read", [[
      ["published", "=", true],
      ["state", "=", "open"],
      ["application_end", ">=", today],
    ]], {
      fields: [
        "id", "name", "program_id", "academic_year_id", "application_start",
        "application_end", "capacity", "application_fee", "state", "applicant_ids",
      ],
      order: "application_end asc, id asc",
      limit: 50,
    }),
    callOdoo<ApplicantSummary[]>("cdt.student.applicant", "search_read", [[]], {
      fields: ["id", "name", "full_name", "admission_id", "application_date", "guardian_name", "state"],
      order: "application_date desc, id desc",
      limit: 50,
    }),
    searchOdooCount("cdt.guardian", [["active", "=", true]]),
    searchOdooCount("res.users", [["share", "=", true], ["active", "=", true]]),
  ]);

  const total = <T>(records: T[], selector: (record: T) => number) => (
    records.reduce((sum, record) => sum + selector(record), 0)
  );
  const publicUrl = getOdooPublicUrl();
  const eventCurrency = performances.find((item) => Boolean(item.currency_id))?.currency_id;
  const marketingSync = marketingSettings[0];
  const activeSubscriptions = mailingLists.length
    ? await callOdoo<MailingSubscriptionSummary[]>("mailing.subscription", "search_read", [[
      ["list_id", "in", mailingLists.map((item) => item.id)],
      ["opt_out", "=", false],
    ]], { fields: ["id", "contact_id"], limit: 10000 })
    : [];
  const uniqueActiveRecipients = new Set(
    activeSubscriptions.flatMap((item) => item.contact_id ? [item.contact_id[0]] : []),
  ).size;
  const websiteAudience = mailingLists.find((item) => item.name === "CDT Website Subscribers");
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      upcomingEvents: performances.filter((item) => item.status === "upcoming").length,
      registrations: total(performances, (item) => item.registration_count),
      checkedIn: total(performances, (item) => item.attendee_count),
      registeredTicketValue: total(performances, (item) => item.registered_value),
      mailingRecipients: uniqueActiveRecipients,
      campaignDrafts: campaigns.filter((item) => item.state === "draft").length,
      openAdmissions: admissions.length,
      applications: applicants.length,
      guardianHouseholds: guardians,
      portalUsers,
      currency: eventCurrency ? eventCurrency[1] : "JMD",
    },
    events: performances.map((item) => ({
      id: item.id,
      eventId: item.event_id ? item.event_id[0] : null,
      title: item.title,
      date: item.date,
      venue: item.venue,
      status: item.status,
      capacity: item.capacity,
      ticketTiers: item.ticket_tier_count,
      registrations: item.registration_count,
      checkedIn: item.attendee_count,
      seatsAvailable: item.seats_available,
      registeredTicketValue: item.registered_value,
    })),
    mailingLists: mailingLists.map((item) => ({
      id: item.id,
      name: item.name,
      contacts: item.contact_count,
      activeContacts: item.contact_count - item.contact_count_opt_out,
      optOut: item.contact_count_opt_out,
      campaigns: item.mailing_count,
    })),
    campaigns: campaigns.map((item) => ({
      id: item.id,
      subject: item.subject,
      state: item.state,
      delivered: item.sent || 0,
      recipients: item.total || 0,
      scheduledDate: item.schedule_date || null,
    })),
    emailMarketing: {
      source: "Odoo Email Marketing",
      migrationSource: "Mailchimp compatibility sync",
      status: marketingSync?.marketing_last_sync_status || "skipped",
      lastSyncAt: marketingSync?.marketing_last_sync_at || null,
      audienceTotal: websiteAudience?.contact_count || marketingSync?.marketing_audience_total || 0,
      audienceActive: websiteAudience
        ? websiteAudience.contact_count - websiteAudience.contact_count_opt_out
        : marketingSync?.marketing_audience_active || 0,
      audienceOptOut: websiteAudience?.contact_count_opt_out || marketingSync?.marketing_audience_opt_out || 0,
      outgoingMailConfigured: outgoingServers > 0,
      sendingRole: "Communications Manager",
      draftingRole: "Communications User",
      adminUrl: publicUrl
        ? `${publicUrl}/odoo/email-marketing?db=${encodeURIComponent(ODOO_DB)}`
        : null,
    },
    admissions: admissions.map((item) => ({
      id: item.id,
      name: item.name,
      program: item.program_id ? item.program_id[1] : null,
      academicYear: item.academic_year_id ? item.academic_year_id[1] : null,
      applicationStart: item.application_start,
      applicationEnd: item.application_end,
      capacity: item.capacity,
      applicationFee: item.application_fee,
      applications: item.applicant_ids.length,
      state: item.state,
    })),
    applicants: applicants.map((item) => ({
      id: item.id,
      reference: item.name,
      name: item.full_name,
      round: item.admission_id ? item.admission_id[1] : null,
      applicationDate: item.application_date,
      guardianName: item.guardian_name || null,
      state: item.state,
    })),
    familyPortal: {
      guardians,
      portalUsers,
      portalPath: "/my/education",
      portalUrl: publicUrl ? `${publicUrl}/web/login?db=${encodeURIComponent(ODOO_DB)}&redirect=/my/education` : null,
      admissionsPath: "/apply",
      admissionsUrl: publicUrl ? `${publicUrl}/apply?db=${encodeURIComponent(ODOO_DB)}` : null,
      demoLogin: "parent.demo@cdt.test",
    },
  };
}

async function findOrCreatePartner(name: string): Promise<number> {
  const ids = await callOdoo<number[]>("res.partner", "search", [[
    ["name", "=ilike", name],
  ]], { limit: 1 });
  return ids[0] ?? createOdooPartner({ name });
}

async function findOrCreateNamedRecord(model: string, name?: string): Promise<number | false> {
  if (!name) return false;
  const ids = await callOdoo<number[]>(model, "search", [[
    ["name", "=ilike", name],
  ]], { limit: 1 });
  return ids[0] ?? callOdoo<number>(model, "create", [{ name }]);
}

export interface OdooInvoice {
  id: number;
  name: string;
  partner_id: Many2One;
  amount_total: number;
  amount_residual: number;
  currency_id: Many2One;
  invoice_date: string | false;
  invoice_date_due: string | false;
  state: string;
  payment_state: string | false;
}

export function listOdooInvoices(search = "", state?: string, limit = 100): Promise<OdooInvoice[]> {
  const domain: unknown[] = [["move_type", "=", "out_invoice"]];
  if (search) domain.push(["partner_id.name", "ilike", search]);
  if (state) domain.push(["state", "=", state === "cancelled" ? "cancel" : state]);
  return callOdoo("account.move", "search_read", [domain], {
    fields: [
      "id", "name", "partner_id", "amount_total", "amount_residual",
      "currency_id", "invoice_date", "invoice_date_due", "state", "payment_state",
    ],
    limit,
    order: "invoice_date desc, id desc",
  });
}

export interface OdooStudentFee {
  id: number;
  name: string;
  student_id: Many2One;
  fee_schedule_id: Many2One;
  fee_structure_id: Many2One;
  due_date: string;
  amount: number;
  currency_id: Many2One;
  amount_paid: number;
  balance: number;
  invoice_id: Many2One;
  invoice_state: string | false;
  payment_state: string | false;
  state: string;
}

const STUDENT_FEE_FIELDS = [
  "id",
  "name",
  "student_id",
  "fee_schedule_id",
  "fee_structure_id",
  "due_date",
  "amount",
  "currency_id",
  "amount_paid",
  "balance",
  "invoice_id",
  "invoice_state",
  "payment_state",
  "state",
];

export function listOdooStudentFees(
  search = "",
  status?: string,
  limit = 500,
): Promise<OdooStudentFee[]> {
  const domain: unknown[] = [];
  if (search) {
    domain.push("|", ["name", "ilike", search], ["student_id.name", "ilike", search]);
  }
  if (status) domain.push(["state", "=", status]);
  return callOdoo("cdt.student.fee", "search_read", [domain], {
    fields: STUDENT_FEE_FIELDS,
    limit,
    order: "due_date desc, id desc",
  });
}

interface OdooEducationStudentRecord {
  id: number;
  name: string;
  legacy_id: string | false;
  first_name: string;
  last_name: string;
  partner_id: Many2One;
  email: string | false;
  phone: string | false;
  date_of_birth: string | false;
  status: string;
  current_program_id: Many2One;
  active: boolean;
  create_date: string;
}

interface OdooCourseEnrollmentRecord {
  id: number;
  student_id: Many2One;
  offering_id: Many2One;
  status: string;
}

interface OdooOfferingReference {
  id: number;
  course_id: Many2One;
}

export interface OdooEducationStudentSummary extends OdooEducationStudentRecord {
  contactId: number | null;
  programName: string | null;
  classIds: number[];
  classNames: string[];
  tuitionBilled: number;
  tuitionPaid: number;
  tuitionBalance: number;
  tuitionStatus: string | null;
  currency: string;
  sampleData: boolean;
}

export async function listOdooEducationStudents(
  search = "",
  status?: "active" | "inactive",
  limit = 200,
): Promise<OdooEducationStudentSummary[]> {
  const domain: unknown[] = [];
  if (search) domain.push(["full_name", "ilike", search]);
  if (status === "active") domain.push(["status", "=", "active"]);
  if (status === "inactive") domain.push(["status", "!=", "active"]);

  const students = await callOdoo<OdooEducationStudentRecord[]>("cdt.student", "search_read", [domain], {
    fields: [
      "id", "name", "legacy_id", "first_name", "last_name", "partner_id",
      "email", "phone", "date_of_birth", "status", "current_program_id",
      "active", "create_date",
    ],
    limit,
    order: "full_name asc, id asc",
  });
  if (students.length === 0) return [];

  const studentIds = students.map((student) => student.id);
  const [courseEnrollments, fees] = await Promise.all([
    callOdoo<OdooCourseEnrollmentRecord[]>("cdt.course.enrollment", "search_read", [[
      ["student_id", "in", studentIds],
      ["offering_id", "!=", false],
      ["status", "in", ["enrolled", "in_progress"]],
    ]], { fields: ["id", "student_id", "offering_id", "status"], limit: 2000 }),
    callOdoo<OdooStudentFee[]>("cdt.student.fee", "search_read", [[
      ["student_id", "in", studentIds],
      ["state", "!=", "cancelled"],
    ]], { fields: STUDENT_FEE_FIELDS, limit: 2000, order: "due_date desc, id desc" }),
  ]);

  const offeringIds = [...new Set(courseEnrollments.flatMap((enrollment) => enrollment.offering_id ? [enrollment.offering_id[0]] : []))];
  const offerings = offeringIds.length > 0
    ? await callOdoo<OdooOfferingReference[]>("cdt.course.offering", "search_read", [[
        ["id", "in", offeringIds],
      ]], { fields: ["id", "course_id"], limit: 2000 })
    : [];
  const offeringById = new Map(offerings.map((offering) => [offering.id, offering]));

  return students.map((student) => {
    const studentEnrollments = courseEnrollments
      .filter((enrollment) => enrollment.student_id && enrollment.student_id[0] === student.id);
    const studentFees = fees.filter((fee) => fee.student_id && fee.student_id[0] === student.id);
    const tuitionBilled = studentFees.reduce((sum, fee) => sum + fee.amount, 0);
    const tuitionPaid = studentFees.reduce((sum, fee) => sum + fee.amount_paid, 0);
    const tuitionBalance = studentFees.reduce((sum, fee) => sum + fee.balance, 0);
    const tuitionStatus = tuitionBilled === 0
      ? null
      : tuitionBalance <= 0
        ? "paid"
        : tuitionPaid > 0
          ? "partial"
          : studentFees.some((fee) => fee.invoice_state === "posted")
            ? "due"
            : "draft";
    return {
      ...student,
      contactId: student.partner_id ? student.partner_id[0] : null,
      programName: student.current_program_id ? student.current_program_id[1] : null,
      classIds: [...new Set(studentEnrollments.flatMap((enrollment) => enrollment.offering_id ? [enrollment.offering_id[0]] : []))],
      classNames: [...new Set(studentEnrollments.flatMap((enrollment) => {
        if (!enrollment.offering_id) return [];
        const offering = offeringById.get(enrollment.offering_id[0]);
        return offering?.course_id ? [offering.course_id[1]] : [enrollment.offering_id[1]];
      }))],
      tuitionBilled,
      tuitionPaid,
      tuitionBalance,
      tuitionStatus,
      currency: studentFees[0]?.currency_id ? studentFees[0].currency_id[1] : "JMD",
      sampleData: typeof student.legacy_id === "string" && student.legacy_id.startsWith("demo:education:v1:student:"),
    };
  });
}

interface OdooCourseOfferingRecord {
  id: number;
  name: string;
  legacy_id: string | false;
  course_id: Many2One;
  program_id: Many2One;
  academic_year_id: Many2One;
  academic_term_id: Many2One;
  instructor_ids: number[];
  capacity: number;
  delivery_mode: string;
  state: string;
  active: boolean;
  create_date: string;
}

interface OdooInstructorRecord {
  id: number;
  partner_id: Many2One;
}

interface OdooFeeStructureSummary {
  id: number;
  program_id: Many2One;
  academic_year_id: Many2One;
  academic_term_id: Many2One;
  total_amount: number;
  currency_id: Many2One;
}

interface OdooCourseScheduleSummary {
  id: number;
  offering_id: Many2One;
  start_datetime: string;
  end_datetime: string;
  room_id: Many2One;
  state: string;
}

export interface OdooEducationClassSummary extends OdooCourseOfferingRecord {
  className: string;
  programName: string | null;
  instructorNames: string[];
  scheduleLabel: string;
  locationLabel: string;
  enrolledCount: number;
  studentIds: number[];
  studentNames: string[];
  tuitionAmount: number | null;
  currency: string;
  sampleData: boolean;
}

export async function listOdooEducationClasses(
  search = "",
  limit = 200,
): Promise<OdooEducationClassSummary[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) {
    domain.push("|", ["course_id.name", "ilike", search], ["program_id.name", "ilike", search]);
  }
  const offerings = await callOdoo<OdooCourseOfferingRecord[]>("cdt.course.offering", "search_read", [domain], {
    fields: [
      "id", "name", "legacy_id", "course_id", "program_id", "academic_year_id",
      "academic_term_id", "instructor_ids", "capacity", "delivery_mode", "state",
      "active", "create_date",
    ],
    limit,
    order: "academic_year_id desc, academic_term_id desc, id desc",
  });
  if (offerings.length === 0) return [];

  const offeringIds = offerings.map((offering) => offering.id);
  const instructorIds = [...new Set(offerings.flatMap((offering) => offering.instructor_ids))];
  const [courseEnrollments, instructors, feeStructures, schedules] = await Promise.all([
    callOdoo<OdooCourseEnrollmentRecord[]>("cdt.course.enrollment", "search_read", [[
      ["offering_id", "in", offeringIds],
      ["status", "in", ["enrolled", "in_progress"]],
    ]], { fields: ["id", "student_id", "offering_id", "status"], limit: 2000 }),
    instructorIds.length > 0
      ? callOdoo<OdooInstructorRecord[]>("cdt.instructor", "search_read", [[
          ["id", "in", instructorIds],
        ]], { fields: ["id", "partner_id"], limit: 500 })
      : Promise.resolve([]),
    callOdoo<OdooFeeStructureSummary[]>("cdt.fee.structure", "search_read", [[
      ["active", "=", true],
    ]], {
      fields: ["id", "program_id", "academic_year_id", "academic_term_id", "total_amount", "currency_id"],
      limit: 500,
      order: "id desc",
    }),
    callOdoo<OdooCourseScheduleSummary[]>("cdt.course.schedule", "search_read", [[
      ["offering_id", "in", offeringIds],
      ["state", "=", "planned"],
    ]], {
      fields: ["id", "offering_id", "start_datetime", "end_datetime", "room_id", "state"],
      limit: 500,
      order: "start_datetime asc, id asc",
    }),
  ]);
  const instructorById = new Map(instructors.map((instructor) => [
    instructor.id,
    instructor.partner_id ? instructor.partner_id[1] : "Unknown instructor",
  ]));

  return offerings.map((offering) => {
    const offeringEnrollments = courseEnrollments.filter((enrollment) => enrollment.offering_id && enrollment.offering_id[0] === offering.id);
    const nextSchedule = schedules.find((schedule) => schedule.offering_id && schedule.offering_id[0] === offering.id);
    const structure = feeStructures.find((item) => (
      (!offering.program_id || (item.program_id && item.program_id[0] === offering.program_id[0]))
      && (!offering.academic_year_id || (item.academic_year_id && item.academic_year_id[0] === offering.academic_year_id[0]))
      && (!offering.academic_term_id || (item.academic_term_id && item.academic_term_id[0] === offering.academic_term_id[0]))
    ));
    const studentIds = [...new Set(offeringEnrollments.flatMap((enrollment) => enrollment.student_id ? [enrollment.student_id[0]] : []))];
    const studentNames = [...new Set(offeringEnrollments.flatMap((enrollment) => enrollment.student_id ? [enrollment.student_id[1]] : []))];
    return {
      ...offering,
      className: offering.course_id ? offering.course_id[1] : offering.name,
      programName: offering.program_id ? offering.program_id[1] : null,
      instructorNames: offering.instructor_ids.map((id) => instructorById.get(id)).filter((name): name is string => Boolean(name)),
      scheduleLabel: nextSchedule
        ? new Intl.DateTimeFormat("en-JM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(`${nextSchedule.start_datetime.replace(" ", "T")}Z`))
        : offering.academic_term_id
          ? `${offering.academic_term_id[1]} · ${offering.academic_year_id ? offering.academic_year_id[1] : ""}`.replace(/ · $/, "")
          : offering.academic_year_id ? offering.academic_year_id[1] : "Schedule in Odoo",
      locationLabel: nextSchedule?.room_id
        ? nextSchedule.room_id[1]
        : offering.delivery_mode === "online"
          ? "Online"
          : offering.delivery_mode === "hybrid"
            ? "Hybrid"
            : "In person",
      enrolledCount: studentIds.length,
      studentIds,
      studentNames,
      tuitionAmount: structure?.total_amount ?? null,
      currency: structure?.currency_id ? structure.currency_id[1] : "JMD",
      sampleData: typeof offering.legacy_id === "string" && offering.legacy_id.startsWith("demo:education:v1:offering:"),
    };
  });
}

export async function getOdooFinancialSummary() {
  const invoices = await listOdooInvoices("", undefined, 1000);
  const posted = invoices.filter((invoice) => invoice.state === "posted");
  const today = new Date().toISOString().split("T")[0];
  return {
    totalRevenue: posted.reduce((sum, invoice) => sum + invoice.amount_total, 0),
    totalOutstanding: posted.reduce((sum, invoice) => sum + invoice.amount_residual, 0),
    totalPaid: posted.reduce((sum, invoice) => sum + invoice.amount_total - invoice.amount_residual, 0),
    overdueCount: posted.filter((invoice) => invoice.amount_residual > 0 && invoice.invoice_date_due && invoice.invoice_date_due < today).length,
    draftCount: invoices.filter((invoice) => invoice.state === "draft").length,
    currency: posted[0]?.currency_id ? posted[0].currency_id[1] : "JMD",
  };
}

interface OdooAggregateRow {
  [field: string]: number | string | boolean | unknown[] | undefined;
}

interface OdooPaymentProviderSummary {
  id: number;
  name: string;
  code: string;
  state: string;
  is_published: boolean;
  journal_id: Many2One;
}

interface OdooCompanySummary {
  id: number;
  currency_id: Many2One;
}

interface OdooContentSyncSummary {
  id: number;
  last_sync_at: string | false;
  last_sync_status: string | false;
}

function aggregateNumber(row: OdooAggregateRow | undefined, field: string): number {
  const value = row?.[field];
  return typeof value === "number" ? value : 0;
}

function searchOdooCount(model: string, domain: unknown[]): Promise<number> {
  return callOdoo<number>(model, "search_count", [domain]);
}

function readOdooTotals(
  model: string,
  domain: unknown[],
  fields: string[],
): Promise<OdooAggregateRow[]> {
  return callOdoo<OdooAggregateRow[]>(model, "read_group", [domain, fields, []]);
}

export interface OdooDashboardSnapshot {
  activeStudents: number;
  activeClasses: number;
  upcomingPerformances: number;
  teamMembers: number;
  repertoireItems: number;
  totalPerformances: number;
  mediaItems: number;
  contentLastSyncAt: string | null;
  contentSyncStatus: string | null;
  totalDonations: number;
  openTasks: number;
  monthlyRevenue: number;
  pendingInvoices: number;
  newContactsThisMonth: number;
  feesBilled: number;
  feesCollected: number;
  feesOutstanding: number;
  unbilledFees: number;
  overdueFeesCount: number;
  currency: string;
  paymentProviderName: string | null;
  paymentProviderState: string | null;
  paymentJournalName: string | null;
}

export async function getOdooDashboardSnapshot(monthStart: string): Promise<OdooDashboardSnapshot> {
  const [
    activeStudents,
    activeClasses,
    upcomingPerformances,
    teamMembers,
    repertoireItems,
    totalPerformances,
    mediaItems,
    contentSyncRecords,
    openTasks,
    donationRows,
    revenueRows,
    pendingInvoices,
    newContactsThisMonth,
    feeRows,
    unbilledFeeRows,
    overdueFeesCount,
    providers,
    companies,
  ] = await Promise.all([
    searchOdooCount("cdt.student", [["active", "=", true], ["status", "=", "active"]]),
    searchOdooCount("cdt.course.offering", [
      ["active", "=", true],
      ["state", "in", ["open", "in_progress"]],
    ]),
    searchOdooCount("cdt.performance", [["active", "=", true], ["status", "=", "upcoming"]]),
    searchOdooCount("cdt.team.member", [["active", "=", true]]),
    searchOdooCount("cdt.repertoire.item", [["active", "=", true]]),
    searchOdooCount("cdt.performance", [["active", "=", true]]),
    searchOdooCount("cdt.media.item", [["active", "=", true]]),
    callOdoo<OdooContentSyncSummary[]>("cdt.site.setting", "search_read", [[]], {
      fields: ["id", "last_sync_at", "last_sync_status"],
      limit: 1,
      order: "id asc",
    }),
    searchOdooCount("project.task", [
      ["active", "=", true],
      ["stage_id.name", "not in", ["Done", "Cancelled"]],
    ]),
    readOdooTotals("donation.donation", [["state", "=", "paid"]], ["amount:sum"]),
    readOdooTotals("account.move", [
      ["move_type", "=", "out_invoice"],
      ["state", "=", "posted"],
      ["invoice_date", ">=", monthStart],
    ], ["amount_total:sum"]),
    searchOdooCount("account.move", [
      ["move_type", "=", "out_invoice"],
      ["state", "=", "posted"],
      ["amount_residual", ">", 0],
    ]),
    searchOdooCount("res.partner", [["active", "=", true], ["create_date", ">=", monthStart]]),
    readOdooTotals("cdt.student.fee", [["invoice_state", "=", "posted"]], [
      "amount:sum",
      "amount_paid:sum",
      "balance:sum",
    ]),
    readOdooTotals("cdt.student.fee", [
      ["invoice_id", "=", false],
      ["state", "!=", "cancelled"],
    ], ["amount:sum"]),
    searchOdooCount("cdt.student.fee", [
      ["invoice_state", "=", "posted"],
      ["balance", ">", 0],
      ["due_date", "<", new Date().toISOString().slice(0, 10)],
    ]),
    callOdoo<OdooPaymentProviderSummary[]>("payment.provider", "search_read", [[
      ["state", "in", ["enabled", "test"]],
      ["is_published", "=", true],
    ]], {
      fields: ["id", "name", "code", "state", "is_published", "journal_id"],
      order: "id asc",
    }),
    callOdoo<OdooCompanySummary[]>("res.company", "search_read", [[]], {
      fields: ["id", "currency_id"],
      limit: 1,
      order: "id asc",
    }),
  ]);

  const provider = providers.find((item) => item.state === "enabled")
    ?? providers.find((item) => item.state === "test")
    ?? null;
  const feeTotals = feeRows[0];
  const currency = companies[0]?.currency_id ? companies[0].currency_id[1] : "JMD";
  const contentSync = contentSyncRecords[0];

  return {
    activeStudents,
    activeClasses,
    upcomingPerformances,
    teamMembers,
    repertoireItems,
    totalPerformances,
    mediaItems,
    contentLastSyncAt: contentSync?.last_sync_at
      ? `${contentSync.last_sync_at.replace(" ", "T")}Z`
      : null,
    contentSyncStatus: contentSync?.last_sync_status || null,
    openTasks,
    totalDonations: aggregateNumber(donationRows[0], "amount"),
    monthlyRevenue: aggregateNumber(revenueRows[0], "amount_total"),
    pendingInvoices,
    newContactsThisMonth,
    feesBilled: aggregateNumber(feeTotals, "amount"),
    feesCollected: aggregateNumber(feeTotals, "amount_paid"),
    feesOutstanding: aggregateNumber(feeTotals, "balance"),
    unbilledFees: aggregateNumber(unbilledFeeRows[0], "amount"),
    overdueFeesCount,
    currency,
    paymentProviderName: provider?.name ?? null,
    paymentProviderState: provider?.state ?? null,
    paymentJournalName: provider?.journal_id ? provider.journal_id[1] : null,
  };
}

export interface OdooDonation {
  id: number;
  partner_id: Many2One;
  amount: number;
  currency_id: Many2One;
  donation_date: string | false;
  state: string;
  campaign_id: Many2One;
}

const DONATION_FIELDS = [
  "id", "partner_id", "amount", "currency_id", "donation_date", "state", "campaign_id",
];

export function listOdooDonations(search = "", status?: string, limit = 100): Promise<OdooDonation[]> {
  const domain: unknown[] = [];
  if (search) domain.push(["partner_id.name", "ilike", search]);
  if (status) domain.push(["state", "=", status]);
  return callOdoo("donation.donation", "search_read", [domain], {
    fields: DONATION_FIELDS,
    limit,
    order: "donation_date desc, id desc",
  });
}

export async function getOdooDonation(id: number): Promise<OdooDonation | null> {
  const records = await callOdoo<OdooDonation[]>("donation.donation", "search_read", [[
    ["id", "=", id],
  ]], { fields: DONATION_FIELDS, limit: 1 });
  return records[0] ?? null;
}

export async function createOdooDonation(data: {
  donorName: string;
  amount: number;
  donationDate: string;
  status?: string;
  campaign?: string;
}): Promise<OdooDonation> {
  const partnerId = await findOrCreatePartner(data.donorName);
  const campaignId = await findOrCreateNamedRecord("utm.campaign", data.campaign);
  const id = await callOdoo<number>("donation.donation", "create", [{
    partner_id: partnerId,
    amount: data.amount,
    donation_date: data.donationDate,
    state: data.status ?? "draft",
    ...(campaignId ? { campaign_id: campaignId } : {}),
  }]);
  const record = await getOdooDonation(id);
  if (!record) throw new Error("Donation was created in Odoo but could not be reloaded.");
  return record;
}

export interface OdooTask {
  id: number;
  name: string;
  description: string | false;
  stage_id: Many2One;
  user_ids: number[];
  date_deadline: string | false;
  priority: string;
  project_id: Many2One;
  create_date: string;
  assignee_name?: string | null;
}

const TASK_FIELDS = [
  "id", "name", "description", "stage_id", "user_ids", "date_deadline",
  "priority", "project_id", "create_date",
];

async function hydrateTaskAssignees(tasks: OdooTask[]): Promise<OdooTask[]> {
  const userIds = [...new Set(tasks.flatMap((task) => task.user_ids))];
  if (userIds.length === 0) return tasks;
  const users = await callOdoo<Array<{ id: number; name: string }>>("res.users", "read", [userIds], {
    fields: ["id", "name"],
  });
  const names = new Map(users.map((user) => [user.id, user.name]));
  return tasks.map((task) => ({
    ...task,
    assignee_name: task.user_ids[0] ? names.get(task.user_ids[0]) ?? null : null,
  }));
}

export async function listOdooTasks(search = "", limit = 100): Promise<OdooTask[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) domain.push(["name", "ilike", search]);
  const tasks = await callOdoo<OdooTask[]>("project.task", "search_read", [domain], {
    fields: TASK_FIELDS,
    limit,
    order: "create_date desc",
  });
  return hydrateTaskAssignees(tasks);
}

async function taskValues(data: {
  title?: string;
  description?: string;
  stage?: string;
  assigneeName?: string;
  deadline?: string;
  priority?: string;
  projectName?: string;
}): Promise<Record<string, unknown>> {
  const values: Record<string, unknown> = {};
  if (data.title !== undefined) values.name = data.title;
  if (data.description !== undefined) values.description = data.description;
  if (data.deadline !== undefined) values.date_deadline = data.deadline || false;
  if (data.priority !== undefined) values.priority = ({ low: "0", normal: "1", high: "2" } as Record<string, string>)[data.priority] ?? "1";

  const projectId = await findOrCreateNamedRecord("project.project", data.projectName);
  if (projectId) values.project_id = projectId;

  if (data.assigneeName) {
    const ids = await callOdoo<number[]>("res.users", "search", [[
      ["name", "=ilike", data.assigneeName],
    ]], { limit: 1 });
    if (ids[0]) values.user_ids = [[6, 0, [ids[0]]]];
  }

  if (data.stage) {
    const stageName = ({ todo: "New", in_progress: "In Progress", done: "Done", cancelled: "Cancelled" } as Record<string, string>)[data.stage] ?? "New";
    values.stage_id = await findOrCreateNamedRecord("project.task.type", stageName);
  }
  return values;
}

export async function createOdooTask(data: Parameters<typeof taskValues>[0]): Promise<OdooTask> {
  const id = await callOdoo<number>("project.task", "create", [await taskValues(data)]);
  const tasks = await callOdoo<OdooTask[]>("project.task", "read", [[id]], { fields: TASK_FIELDS });
  return (await hydrateTaskAssignees(tasks))[0];
}

export async function updateOdooTask(id: number, data: Parameters<typeof taskValues>[0]): Promise<OdooTask> {
  await callOdoo<boolean>("project.task", "write", [[id], await taskValues(data)]);
  const tasks = await callOdoo<OdooTask[]>("project.task", "read", [[id]], { fields: TASK_FIELDS });
  return (await hydrateTaskAssignees(tasks))[0];
}

export function deleteOdooTask(id: number): Promise<boolean> {
  return callOdoo("project.task", "unlink", [[id]]);
}
