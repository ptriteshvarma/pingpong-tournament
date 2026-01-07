# Railway PostgreSQL Database Setup Guide

## Overview

This guide will help you migrate from JSON file storage to PostgreSQL database on Railway.

### Cost
- **FREE tier available**: $5 free credit per month
- 500MB storage (plenty for this tournament app)
- Shared CPU, 512MB RAM

### Benefits
- Better data integrity and concurrency
- No file system race conditions
- Automatic backups by Railway
- Easier querying and filtering
- More reliable for multiple users

---

## Step 1: Install PostgreSQL Dependency

Add the PostgreSQL client library to your project:

```bash
npm install pg
```

**Update package.json:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "pg": "^8.11.3"
  }
}
```

---

## Step 2: Create PostgreSQL Database in Railway

1. **Log in to Railway**: https://railway.app
   - Go to your project: https://railway.com/project/fe004ff8-c43b-4fef-a83e-2f8dc06d9f95

2. **Add PostgreSQL Database**:
   - Click **"+ New"** button
   - Select **"Database"**
   - Choose **"PostgreSQL"**
   - Railway will provision the database automatically

3. **Get Connection String**:
   - Click on the PostgreSQL service
   - Go to **"Variables"** tab
   - Copy the **`DATABASE_URL`** value (looks like: `postgresql://postgres:password@host:5432/railway`)

4. **Link Database to Your App**:
   - Click on your **web service** (pingpong-tournament)
   - Go to **"Variables"** tab
   - Railway automatically adds `DATABASE_URL` reference
   - You should see: `DATABASE_URL=${{Postgres.DATABASE_URL}}`
   - If not, click **"+ New Variable"** → **"Reference"** → Select `Postgres.DATABASE_URL`

---

## Step 3: Initialize Database Schema

The database needs tables before it can store data. You have two options:

### Option A: Run Schema Locally (Recommended for Testing)

1. **Set DATABASE_URL locally**:
```bash
# Windows (PowerShell)
$env:DATABASE_URL="postgresql://postgres:password@host:5432/railway"

# Mac/Linux
export DATABASE_URL="postgresql://postgres:password@host:5432/railway"
```

2. **Install psql client** (optional but helpful):
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql`
   - Or use Railway's built-in psql terminal

3. **Run schema creation**:
```bash
# Using psql
psql $DATABASE_URL < schema.sql

# Or using Railway CLI
railway run psql < schema.sql
```

### Option B: Run Schema via Railway Dashboard

1. Click on your **PostgreSQL service** in Railway
2. Click **"Query"** tab
3. Copy the entire contents of `schema.sql`
4. Paste into the query editor
5. Click **"Run Query"**

---

## Step 4: Migrate Existing Data (Optional)

If you have existing player data in JSON files, migrate it:

1. **Ensure you have data files**:
   - `data/players.json`
   - `data/availability.json`
   - `data/leaderboard.json`

2. **Run migration script**:
```bash
# Set DATABASE_URL (from Railway)
$env:DATABASE_URL="your_database_url_here"

# Run migration
node migrate-to-postgres.js
```

3. **Verify migration**:
   - Check Railway PostgreSQL dashboard → "Query" tab
   - Run: `SELECT * FROM players;`
   - You should see your migrated players

---

## Step 5: Update Your Application

**Update package.json start script:**

```json
{
  "scripts": {
    "start": "node server-postgres.js"
  }
}
```

**Or rename files** (simpler approach):
```bash
# Backup old server
mv server.js server-json.js

# Use PostgreSQL version
mv server-postgres.js server.js
```

---

## Step 6: Deploy to Railway

1. **Commit changes**:
```bash
git add .
git commit -m "Migrate to PostgreSQL database"
git push origin main
```

2. **Railway auto-deploys** when you push to GitHub
   - Watch deployment in Railway dashboard
   - Check logs for any errors

3. **Verify deployment**:
   - Visit your app: https://pingpong-tournament-production.up.railway.app/
   - Check admin login works
   - Add test players
   - Verify data persists after page reload

---

## Troubleshooting

### Connection Error: "Connection refused"
- **Fix**: Verify `DATABASE_URL` is set in Railway Variables
- Check: PostgreSQL service is running (should show green)

### Error: "relation does not exist"
- **Fix**: Schema not created. Run `schema.sql` (see Step 3)

### Migration fails: "Cannot read property"
- **Fix**: Ensure JSON files exist in `data/` folder
- Or skip migration if starting fresh

### Local testing without DATABASE_URL
- The app requires PostgreSQL - no fallback to JSON
- Use Railway's database URL even for local testing
- Or set up local PostgreSQL:
  ```bash
  # Install PostgreSQL locally
  # Then set:
  DATABASE_URL="postgresql://localhost:5432/pingpong"
  ```

---

## Monitoring Usage

**Check your Railway usage**:
1. Go to Railway dashboard
2. Click your **project**
3. See **"Usage"** section
4. Monitor:
   - **Execution time**: How long services run
   - **Storage**: Database size
   - **Credits**: $5/month free tier

**Typical usage for this app**:
- Database: <10MB (well under 500MB limit)
- Execution: Minimal (only runs when users access)
- **Cost**: Should stay within free tier

---

## Rolling Back to JSON (If Needed)

If you need to revert:

1. **Restore old server**:
```bash
mv server.js server-postgres.js
mv server-json.js server.js
```

2. **Update package.json**:
```json
{
  "scripts": {
    "start": "node server.js"
  }
}
```

3. **Remove pg dependency** (optional):
```bash
npm uninstall pg
```

4. **Commit and push**:
```bash
git add .
git commit -m "Revert to JSON file storage"
git push origin main
```

---

## Next Steps After Setup

Once PostgreSQL is working:

1. **Remove JSON data files** (no longer needed):
   - Keep `data/` folder for backups
   - Or delete if you don't need them

2. **Monitor performance**:
   - PostgreSQL should be faster than JSON files
   - Better handling of concurrent users

3. **Future improvements**:
   - Add database backups (Railway does this automatically)
   - Add indexes for faster queries (already in schema)
   - Consider upgrading Railway plan if you exceed free tier

---

## Summary

| Feature | JSON Files | PostgreSQL |
|---------|-----------|------------|
| **Cost** | Free | Free ($5/month credit) |
| **Concurrency** | Poor (file locks) | Excellent |
| **Reliability** | Medium | High |
| **Backups** | Manual | Automatic |
| **Querying** | Slow | Fast |
| **Scaling** | Limited | Easy |

**Recommendation**: Use PostgreSQL for production, especially if you have multiple users accessing the tournament system simultaneously.
