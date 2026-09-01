# Deploy Odoo to Render with Layerbase PostgreSQL

This guide shows how to deploy Odoo to Render's free tier using Layerbase for PostgreSQL - both services require no credit card.

## Prerequisites

- GitHub account with `glitterrock-vampire/Odoo-Pages` repository
- Layerbase account (free, no credit card required)
- Render account (free tier, no credit card required)

## Architecture

- **Render**: Hosts the Odoo web service (free tier)
- **Layerbase**: Provides managed PostgreSQL database (free tier: 5GB storage, 2 databases, 20 connections)

## Step 1: Set up Layerbase PostgreSQL

1. Go to [Layerbase](https://layerbase.com/db/postgresql)
2. Sign up for a free account (no credit card required)
3. Create a new PostgreSQL database:
   - Click "Create Database"
   - Name it `cdt-odoo`
   - Note the connection details (host, port, database name, username, password)
4. Copy the connection string - you'll need it for Render

## Step 2: Configure Render Environment Variables

After deploying the blueprint to Render, configure these environment variables in the `cdt-odoo-web` service:

### Required Database Variables (from Layerbase)
- `HOST` - Layerbase database host (e.g., `your-db.layerbase.io`)
- `PORT` - Layerbase database port (typically `5432`)
- `USER` - Layerbase database username
- `PASSWORD` - Layerbase database password

### Optional Variables
- `MAILCHIMP_API_KEY` - Mailchimp API key (if using newsletter features)
- `MAILCHIMP_LIST_ID` - Mailchimp list ID (if using newsletter features)
- `CDT_NEWSLETTER_SHARED_SECRET` - Secret for newsletter API security

## Step 3: Deploy to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New Blueprint Instance"
3. Enter repository URL: `https://github.com/glitterrock-vampire/Odoo-Pages`
4. Configure:
   - **Blueprint Name**: `cdt-odoo-deployment`
   - **Branch**: `agent/odoo-school-platform`
   - **Blueprint Path**: `infra/odoo/render.yaml`
5. Click "Deploy Blueprint"
6. After deployment, go to the `cdt-odoo-web` service settings
7. Add the Layerbase connection details as environment variables
8. Redeploy the service

## Step 4: Initialize Odoo Database

Once the service is running:

1. Access your Odoo instance at the Render-provided URL
2. Click "Manage Databases"
3. Create a new database:
   - **Database Name**: `cdt_jamaica`
   - **Email**: `admin@example.com`
   - **Password**: Choose a strong password
   - **Language**: `English (US)`
   - **Country**: `Jamaica`
4. Click "Create" and wait for initialization

## Step 5: Install Custom Modules

After database creation:

1. Log in to Odoo with your admin credentials
2. Go to **Apps** menu
3. Click "Update Apps List"
4. Search for and install:
   - `CDT Donation` (cdt_donation)
   - `CDT Education` (cdt_education)
   - `CDT Company Content` (cdt_content)

## Step 6: Import Sanity Data (Optional)

To import existing CDT data from Sanity:

```bash
# From your local machine, run the import script
docker compose -f infra/odoo/compose.yaml exec -T web \
  odoo shell -d cdt_jamaica --no-http \
  --db_host <layerbase-host> \
  --db_port 5432 \
  --db_user <layerbase-user> \
  --db_password <layerbase-password> \
  < infra/odoo/addons/cdt_content/tools/import_sanity.py
```

## Free Tier Limitations

### Layerbase Free Tier
- 5GB storage
- 2 databases
- 20 concurrent connections
- Hibernates after 1 hour of inactivity (wakes on connect in 1-5 seconds)
- No credit card required

### Render Free Tier
- 512MB RAM
- 0.1 CPU
- Sleeps after 15 minutes of inactivity (wakes on request)
- No credit card required for web services

## Troubleshooting

### Database Connection Issues
- Verify Layerbase database is awake (connect via psql to wake it)
- Check Render environment variables match Layerbase connection details
- Ensure Layerbase allows connections from Render's IP ranges

### Odoo Initialization Fails
- Check Render service logs for database connection errors
- Verify database credentials are correct
- Ensure Layerbase database has sufficient storage

### Service Sleep Issues
- Render free tier services sleep after inactivity - first request may take 30-60 seconds
- Layerbase databases hibernate after 1 hour - first query may take 1-5 seconds
- Consider upgrading to paid plans for production use

## Migration to Production

When ready for production:

1. **Layerbase**: Upgrade to Solo ($5/month) or Pro ($15/month) for no hibernation
2. **Render**: Upgrade to Starter ($7/month) for always-on service
3. **Domain**: Add custom domain in Render service settings
4. **SSL**: Automatic SSL certificates provided by Render
5. **Backups**: Configure Layerbase automated backups

## Cost Summary

- **Development**: $0/month (both services on free tiers)
- **Production**: ~$12/month (Layerbase Solo $5 + Render Starter $7)
