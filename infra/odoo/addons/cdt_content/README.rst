CDT Company Content
===================

This module stores the public CDT Jamaica website content that previously lived
only in the Sanity sbvvl9vs/production dataset. It adds structured Odoo models
for team members, performances, repertoire, media, and website settings.

The importer in tools/import_sanity.py is idempotent. Every source document is
matched using its immutable Sanity ID; rerunning the importer updates the
existing Odoo record and never deletes records that disappeared from Sanity.

Email marketing audience
------------------------

The public website currently stores newsletter subscribers in Mailchimp rather
than Sanity. ``tools/import_mailchimp.py`` performs an idempotent migration into
the ``CDT Website Subscribers`` Odoo mailing list and preserves unsubscribed,
cleaned, and pending members as opted out. A source transition back to
``subscribed`` is treated as explicit re-consent; an unchanged Mailchimp record
never clears an Odoo opt-out.

Pass ``MAILCHIMP_API_KEY`` and ``MAILCHIMP_LIST_ID`` to the Odoo service, or
store them as the administrator-only system parameters
``cdt_content.mailchimp_api_key`` and ``cdt_content.mailchimp_list_id``, to
enable the hourly compatibility sync. Without both values, the scheduled job is
a safe no-op. The production website can write new consent directly to Odoo's
scoped ``/cdt/newsletter/subscribe`` endpoint using a matching
``CDT_NEWSLETTER_SHARED_SECRET`` server-side value.

Communications Users can manage audiences and drafts. Only Communications
Managers can schedule or send a bulk campaign. Odoo unsubscribe links and the
global email blacklist continue to apply to every campaign.

Run a rollback-only validation first::

  docker compose -f infra/odoo/compose.yaml exec -T -e SANITY_IMPORT_DRY_RUN=1 web \
    odoo shell -d cdt_jamaica --no-http --db_host db --db_port 5432 \
    --db_user odoo --db_password odoo_local_dev \
    < infra/odoo/addons/cdt_content/tools/import_sanity.py

Remove SANITY_IMPORT_DRY_RUN to commit the merge.
