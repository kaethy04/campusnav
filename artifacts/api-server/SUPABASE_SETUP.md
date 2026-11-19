# Supabase setup

## Configure the project

1. Create a Supabase project and open **SQL Editor**.
2. Run `supabase/schema.sql` from this folder. It creates the tables, enables row-level security, and creates a public `building-photos` bucket for app images and campus floor plans. For an existing project, the script also drops the retired user-account, session, saved-place, and recent-search tables, plus account details from feedback. This permanently deletes that data.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET=building-photos` in the API server's `.env`. Get the URL and service-role key from the Supabase project's API settings. The service-role key is server-only: do not put it in the admin/mobile app or commit it.
   If the admin site is hosted on a different origin from the API, set `CORS_ORIGINS` to a comma-separated list of exact trusted origins (for example, `https://admin.example.com`). Do not use wildcard origins. Same-origin deployments do not need this setting.
4. Keep the existing Firebase project credentials in the API `.env` temporarily for migration. Do not remove them until the migration succeeds.

## Migrate existing records and photos

Run this from the repository root after applying the SQL schema and adding the Supabase values:

```powershell
pnpm --filter @workspace/api-server migrate:firebase
```

The migration copies building records, the admin account, and Firebase Storage building photos. It is safe to re-run: records are upserted and migrated photos receive new Supabase URLs. Check the reported counts and confirm the buildings/photos in Supabase before removing old Firebase credentials.

## Run the API

Restart the API server after configuring Supabase:

```powershell
pnpm --filter @workspace/api-server run dev
```

The API provides admin, campus, app-update, and anonymous feedback routes to the admin and mobile apps. New building images upload to Supabase Storage. Once migration is verified, remove the `FIREBASE_*` values from the API `.env`; the Cloudinary variables are no longer used.

Saved places and recent searches stay on the user's device; app feedback is anonymous.