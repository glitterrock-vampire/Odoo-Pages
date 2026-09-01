import json
import logging
from datetime import datetime, time, timedelta

from odoo import api, fields, models


_logger = logging.getLogger(__name__)


class CdtTeamMember(models.Model):
    _name = "cdt.team.member"
    _description = "CDT Team Member"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "member_type, sequence, name"

    sanity_id = fields.Char(required=True, copy=False, index=True)
    sanity_updated_at = fields.Datetime(readonly=True)
    member_type = fields.Selection(
        [
            ("dancer", "Dancer"),
            ("management", "Management"),
            ("board", "Board Member"),
        ],
        required=True,
        tracking=True,
    )
    partner_id = fields.Many2one(
        "res.partner", required=True, ondelete="restrict", tracking=True
    )
    name = fields.Char(related="partner_id.name", store=True)
    role = fields.Char(tracking=True)
    biography = fields.Html()
    years_active = fields.Char()
    term = fields.Char()
    featured = fields.Boolean(default=False)
    sequence = fields.Integer(default=10)
    headshot = fields.Image(max_width=1920, max_height=1920)
    headshot_url = fields.Char(readonly=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "team_member_sanity_id_unique",
            "unique(sanity_id)",
            "This Sanity team member has already been imported.",
        ),
    ]


class CdtPerformance(models.Model):
    _name = "cdt.performance"
    _description = "CDT Performance"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date desc, time, title"

    sanity_id = fields.Char(copy=False, index=True)
    sanity_updated_at = fields.Datetime(readonly=True)
    title = fields.Char(required=True, tracking=True)
    slug = fields.Char(index=True)
    company_name = fields.Char(default="CDT")
    date = fields.Date(required=True, tracking=True)
    time = fields.Char()
    venue = fields.Char(required=True, tracking=True)
    location = fields.Char()
    description = fields.Html()
    category = fields.Char()
    ticket_url = fields.Char()
    learn_more_url = fields.Char()
    status = fields.Selection(
        [
            ("upcoming", "Upcoming"),
            ("completed", "Completed"),
            ("cancelled", "Cancelled"),
        ],
        default="upcoming",
        required=True,
        tracking=True,
    )
    featured = fields.Boolean(default=False)
    image = fields.Image(max_width=1920, max_height=1920)
    image_url = fields.Char(readonly=True)
    image_alt = fields.Char()
    participating_class_ids = fields.Many2many(
        "cdt.course.offering", string="Participating Classes"
    )
    ticket_price = fields.Monetary(default=0)
    capacity = fields.Integer(default=0)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company
    )
    currency_id = fields.Many2one(related="company_id.currency_id", store=True)
    active = fields.Boolean(default=True)
    event_id = fields.Many2one(
        "event.event",
        string="Odoo Event",
        copy=False,
        ondelete="set null",
        tracking=True,
        help="Ticket tiers, attendee registration, invitations, and check-in are managed on this event.",
    )
    registration_count = fields.Integer(
        related="event_id.seats_reserved", string="Registered", readonly=True
    )
    attendee_count = fields.Integer(
        related="event_id.seats_used", string="Checked In", readonly=True
    )
    seats_available = fields.Integer(
        related="event_id.seats_available", string="Seats Available", readonly=True
    )
    ticket_tier_count = fields.Integer(
        compute="_compute_ticketing_metrics", string="Ticket Tiers"
    )
    registered_value = fields.Monetary(
        compute="_compute_ticketing_metrics",
        string="Registered Ticket Value",
        currency_field="currency_id",
    )

    @api.depends(
        "event_id",
        "event_id.event_ticket_ids.price",
        "event_id.registration_ids.state",
        "event_id.registration_ids.event_ticket_id",
    )
    def _compute_ticketing_metrics(self):
        for performance in self:
            tickets = performance.event_id.event_ticket_ids
            registrations = performance.event_id.registration_ids.filtered(
                lambda item: item.state in ("open", "done")
            )
            performance.ticket_tier_count = len(tickets)
            performance.registered_value = sum(
                registration.event_ticket_id.price
                for registration in registrations
                if registration.event_ticket_id
            )

    def _event_dates(self):
        self.ensure_one()
        start_time = time(hour=19)
        raw_time = (self.time or "").strip().upper().replace(".", "")
        for pattern in ("%I:%M %p", "%I %p", "%H:%M"):
            try:
                start_time = datetime.strptime(raw_time, pattern).time()
                break
            except ValueError:
                continue
        start = datetime.combine(self.date, start_time)
        return start, start + timedelta(hours=2, minutes=30)

    def action_sync_event(self):
        for performance in self:
            start, end = performance._event_dates()
            values = {
                "name": performance.title,
                "date_begin": start,
                "date_end": end,
                "date_tz": "America/Jamaica",
                "seats_limited": performance.capacity > 0,
                "seats_max": max(performance.capacity, 0),
            }
            if performance.description:
                values["description"] = performance.description
            if performance.event_id:
                performance.event_id.write(values)
            else:
                performance.event_id = self.env["event.event"].create(values)
        return {
            "type": "ir.actions.act_window",
            "res_model": "event.event",
            "res_id": self.ensure_one().event_id.id,
            "view_mode": "form",
        }

    _sql_constraints = [
        (
            "performance_sanity_id_unique",
            "unique(sanity_id)",
            "This Sanity performance has already been imported.",
        ),
    ]


class CdtRepertoireItem(models.Model):
    _name = "cdt.repertoire.item"
    _description = "CDT Repertoire Item"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "year desc, title"

    sanity_id = fields.Char(required=True, copy=False, index=True)
    sanity_updated_at = fields.Datetime(readonly=True)
    title = fields.Char(required=True, tracking=True)
    subtitle = fields.Char()
    slug = fields.Char(required=True, index=True)
    year = fields.Integer()
    runtime = fields.Char()
    choreographer = fields.Char()
    description = fields.Html()
    company_premiere = fields.Char()
    world_premiere = fields.Char()
    music = fields.Text()
    costume_design = fields.Char()
    lighting = fields.Char()
    premiered_by = fields.Char()
    genre = fields.Char()
    style_period = fields.Char()
    youtube_id = fields.Char()
    thumbnail = fields.Image(max_width=1920, max_height=1920)
    thumbnail_url = fields.Char(readonly=True)
    hero_image = fields.Image(max_width=1920, max_height=1920)
    hero_image_url = fields.Char(readonly=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "repertoire_sanity_id_unique",
            "unique(sanity_id)",
            "This Sanity repertoire item has already been imported.",
        ),
        ("repertoire_slug_unique", "unique(slug)", "The repertoire slug must be unique."),
    ]


class CdtSiteSetting(models.Model):
    _name = "cdt.site.setting"
    _description = "CDT Website Settings"
    _order = "title"

    sanity_id = fields.Char(required=True, copy=False, index=True)
    sanity_updated_at = fields.Datetime(readonly=True)
    title = fields.Char(required=True)
    description = fields.Html()
    light_logo = fields.Image(max_width=1920, max_height=1920)
    light_logo_url = fields.Char(readonly=True)
    dark_logo = fields.Image(max_width=1920, max_height=1920)
    dark_logo_url = fields.Char(readonly=True)
    hero_image = fields.Image(max_width=1920, max_height=1920)
    hero_image_url = fields.Char(readonly=True)
    home_hero_image = fields.Image(max_width=1920, max_height=1920)
    home_hero_image_url = fields.Char(readonly=True)
    last_sync_at = fields.Datetime(readonly=True)
    last_sync_status = fields.Selection(
        [("success", "Success"), ("failed", "Failed")], readonly=True
    )
    last_sync_message = fields.Text(readonly=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "site_setting_sanity_id_unique",
            "unique(sanity_id)",
            "This Sanity site setting has already been imported.",
        ),
    ]

    @api.model
    def action_sync_sanity(self):
        from ..tools.import_sanity import run_import

        try:
            result = run_import(self.env, dry_run=False, commit=False)
            message = json.dumps(result, sort_keys=True)
            settings = self.search([])
            settings.write(
                {
                    "last_sync_at": fields.Datetime.now(),
                    "last_sync_status": "success",
                    "last_sync_message": message,
                }
            )
            _logger.info("Sanity content sync completed: %s", message)
            return {
                "type": "ir.actions.client",
                "tag": "display_notification",
                "params": {
                    "title": "Sanity sync complete",
                    "message": (
                        f"{result['people']} people, {result['performances']} performances, "
                        f"{result['repertoire']} repertoire works, and {result['media']} media items synced."
                    ),
                    "type": "success",
                    "sticky": False,
                    "next": {"type": "ir.actions.client", "tag": "reload"},
                },
            }
        except Exception:
            _logger.exception("Sanity content sync failed")
            raise


class CdtMediaItem(models.Model):
    _name = "cdt.media.item"
    _description = "CDT Media Item"
    _order = "published_at desc, title"

    sanity_id = fields.Char(required=True, copy=False, index=True)
    sanity_updated_at = fields.Datetime(readonly=True)
    title = fields.Char(required=True)
    slug = fields.Char(index=True)
    description = fields.Html()
    video_type = fields.Char()
    duration = fields.Char()
    published_at = fields.Datetime()
    featured = fields.Boolean(default=False)
    tags = fields.Char()
    category = fields.Char()
    video_url = fields.Char()
    vimeo_url = fields.Char()
    youtube_url = fields.Char()
    thumbnail = fields.Image(max_width=1920, max_height=1920)
    thumbnail_url = fields.Char(readonly=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "media_item_sanity_id_unique",
            "unique(sanity_id)",
            "This Sanity media item has already been imported.",
        ),
    ]
