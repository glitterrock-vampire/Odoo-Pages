# Local Odoo Community

This stack runs Odoo 18 Community and PostgreSQL locally with persistent Docker
volumes. It is bound to `127.0.0.1:8069` and is not exposed to the network.

## Start everything

On macOS, start the Docker runtime first:

```sh
colima start
```

From the repository root, start Odoo and its database:

```sh
docker compose -f infra/odoo/compose.yaml up -d
```

Then start the application API and frontend in separate terminals:

```sh
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/cdt-app run dev
```

Open the CDT app at <http://localhost:5173> and Odoo at
<http://localhost:8069/web/login?db=cdt_jamaica>. The local development
database is `cdt_jamaica`; the initial administrator login is `admin` /
`admin`. Change that password before using this instance for real data.

The local company is configured as CDT Jamaica with JMD as its currency and
`America/Jamaica` as its timezone.

## CDT modules

The local stack includes two custom Odoo applications:

- `cdt_donation` supplies the `donation.donation` model used by the CDT API.
- `cdt_education` supplies school administration features comparable to the
  Frappe Education application: academic years and terms, students, guardians,
  instructors, admissions, programmes, courses, enrolment, student groups,
  timetables, attendance, leave, assessments, grades, fee structures,
  fee schedules, Odoo invoice generation, reports, and a student portal at
  `/my/education`.
- `cdt_content` stores the public company team, performances, repertoire,
  media, and website settings migrated from the Sanity production dataset.

Refresh the published Sanity content in Odoo with:

```sh
docker compose -f infra/odoo/compose.yaml exec -T web \
  odoo shell -d cdt_jamaica --no-http --db_host db --db_port 5432 \
  --db_user odoo --db_password odoo_local_dev \
  < infra/odoo/addons/cdt_content/tools/import_sanity.py
```

The importer matches immutable Sanity document IDs, so subsequent runs update
the imported records without creating duplicates or deleting Odoo records.

After changing an add-on, upgrade and test it with:

```sh
docker compose -f infra/odoo/compose.yaml stop web
docker compose -f infra/odoo/compose.yaml run --rm web odoo -d cdt_jamaica -u cdt_education --without-demo=all --test-enable --test-tags /cdt_education --stop-after-init
docker compose -f infra/odoo/compose.yaml up -d web
```

The initial pre-Education database backup is stored locally at
`infra/odoo/backups/cdt_jamaica-pre-education.dump`. The backups directory is
ignored by Git.

## Stop and resume

Stop the containers without deleting their data:

```sh
docker compose -f infra/odoo/compose.yaml stop
```

Run the `up -d` command again to resume. The named Docker volumes preserve the
Odoo database and uploaded files between restarts. Do not add `-v` to a
`docker compose down` command unless you intentionally want to erase the local
Odoo data.
