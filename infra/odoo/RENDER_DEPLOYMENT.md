# Deploying Odoo to Render Free Tier

This guide explains how to deploy your CDT Odoo setup to Render's free tier.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your Odoo code must be on GitHub
3. **Custom Addons**: Ensure your `addons/` directory contains your custom modules

## Important Limitations

Render's free tier has significant limitations:
- **Web services sleep after 15 minutes of inactivity** (cold starts take 30-60 seconds)
- **512MB RAM** (may be insufficient for Odoo with multiple users)
- **No persistent disk storage** (file uploads will be lost on redeploy)
- **Database: 1GB PostgreSQL** (limited storage)

**Recommendation**: Use this for development/testing only, not production.

## Deployment Steps

### 1. Prepare Your Repository

Ensure your repository structure includes:
```
infra/odoo/
├── render.yaml          # Render blueprint
├── Dockerfile.db        # PostgreSQL Dockerfile
├── Dockerfile.web       # Odoo Dockerfile
├── addons/              # Your custom Odoo modules
│   ├── cdt_content/
│   ├── cdt_donation/
│   └── cdt_education/
└── backups/             # Database backups (gitignored)
```

### 2. Create Render Blueprint

1. Go to [render.com](https://render.com) and log in
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` automatically
5. Review the configuration and click **"Apply Blueprint"**

### 3. Configure Environment Variables

After deployment, add these environment variables in Render dashboard:

**For cdt-odoo-web service:**
- `MAILCHIMP_API_KEY`: Your Mailchimp API key
- `MAILCHIMP_LIST_ID`: Your Mailchimp list ID  
- `CDT_NEWSLETTER_SHARED_SECRET`: Your newsletter secret

### 4. Initialize Odoo Database

1. Once deployed, access your Odoo instance at `https://cdt-odoo-web.onrender.com`
2. Create a new database (e.g., `cdt_jamaica`)
3. Set admin password
4. Install your custom modules:
   - Go to Apps → Update Apps List
   - Search for `cdt_content`, `cdt_donation`, `cdt_education`
   - Install each module

### 5. Import Sanity Data (Optional)

If you need to import Sanity content:

1. SSH into your web service (Render doesn't provide SSH access)
2. Alternative: Use Odoo's shell via web interface
3. Or create a custom Odoo module with an import button

## Alternative: Manual Deployment

If blueprint deployment fails, deploy services manually:

### PostgreSQL Database

1. **New +** → **PostgreSQL**
2. Name: `cdt-odoo-db`
3. Database: `postgres`
4. User: `odoo`
5. Plan: Free
6. Create

### Odoo Web Service

1. **New +** → **Web Service**
2. Name: `cdt-odoo-web`
3. Environment: Docker
4. Dockerfile path: `./infra/odoo/Dockerfile.web`
5. Plan: Free
6. Add environment variables:
   - `HOST`: Your PostgreSQL internal URL
   - `PORT`: 5432
   - `USER`: odoo
   - `PASSWORD`: Your PostgreSQL password
7. Deploy

## Troubleshooting

### Service Won't Start
- Check Render logs for errors
- Ensure database connection is working
- Verify environment variables are set correctly

### Database Connection Issues
- Use the internal database URL (`cdt-odoo-db.internal`)
- Check that both services are in the same region

### Slow Performance
- Free tier has limited resources
- Consider upgrading to paid tier for production
- Optimize Odoo configuration

### Data Loss
- Free tier doesn't have persistent disk storage
- Regularly export your database
- Use Render's database backups

## Better Free Alternatives

For a more robust free solution, consider:

1. **Oracle Cloud Free Tier**
   - Always free compute instances
   - Persistent storage
   - More manual setup but better for Odoo

2. **Fly.io Free Tier**
   - 3 free VMs
   - Persistent volumes
   - Better for stateful applications

## Migration to Production

When ready for production:
1. Upgrade to paid Render plan
2. Enable persistent disk storage
3. Set up proper backups
4. Configure SSL and custom domain
5. Monitor resource usage
