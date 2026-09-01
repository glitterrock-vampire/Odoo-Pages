import hmac
import os

from odoo import http
from odoo.http import request


class CdtNewsletterController(http.Controller):
    """A narrow server-to-server endpoint for the public CDT website."""

    @http.route(
        "/cdt/newsletter/subscribe",
        type="http",
        auth="public",
        methods=["POST"],
        csrf=False,
        sitemap=False,
    )
    def subscribe(self, **_kwargs):
        configured_token = (
            os.getenv("CDT_NEWSLETTER_SHARED_SECRET")
            or request.env["ir.config_parameter"].sudo().get_param(
                "cdt_content.newsletter_shared_secret"
            )
        )
        supplied_token = request.httprequest.headers.get("X-CDT-Newsletter-Token", "")
        if not configured_token:
            return request.make_json_response(
                {"success": False, "error": "Newsletter service is not configured."},
                status=503,
            )
        if not hmac.compare_digest(configured_token, supplied_token):
            return request.make_json_response(
                {"success": False, "error": "Newsletter request was not authorized."},
                status=401,
            )

        try:
            payload = request.get_json_data() or {}
        except ValueError:
            payload = {}
        email = str(payload.get("email") or "").strip()
        name = str(payload.get("name") or "").strip()[:120]
        if not email or len(email) > 254:
            return request.make_json_response(
                {"success": False, "error": "Enter a valid email address."},
                status=400,
            )

        try:
            request.env["mailing.contact"].sudo().cdt_subscribe_email(
                email=email,
                name=name or False,
                source="website",
            )
        except ValueError:
            return request.make_json_response(
                {"success": False, "error": "Enter a valid email address."},
                status=400,
            )

        # Do not disclose whether an address was already in the audience.
        return request.make_json_response(
            {
                "success": True,
                "message": "Thanks for subscribing. You can unsubscribe from any email.",
            }
        )
