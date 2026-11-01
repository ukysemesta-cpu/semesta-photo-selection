# Semesta Photo Selection — Supabase setup handoff

## Important status
This package is a repaired, non-empty archive of the project files you uploaded,
plus a Supabase browser-configuration template and setup notes.

**The existing V9 application pages still use localStorage. They are not yet
connected to Supabase.** Do not use this package as a live multi-client system
until the Supabase integration and security tests are completed.

## Supabase project
The database schema was previously created in the Supabase project, and the
five tables were confirmed with RLS enabled:
- admin_profiles
- galleries
- photos
- photo_selections
- editing_progress

The admin profile was also confirmed in `admin_profiles`.

## Browser configuration (for the next integration step)
1. Copy `js/supabase-config.example.js` to `js/supabase-config.js`.
2. Fill `url` with the Project URL from Supabase > Project Settings > API.
3. Fill `publishableKey` with the Publishable key (`sb_publishable_...`).
4. Never use a Secret key or `service_role` key in frontend JavaScript.
5. Do not assume this configuration alone connects the app; the page scripts
   still need to be migrated from localStorage to authenticated Supabase queries
   and secure client RPC calls.

## Current project pages
- `index.html` — admin dashboard prototype
- `gallery.html` — client gallery prototype
- `progress.html` — editing progress prototype
- `collage.html` — local collage editor
- `js/admin.js`, `js/gallery.js`, `js/progress.js` — current prototype logic

## Next integration work
The next development pass must:
1. Add Supabase JS v2 client loading.
2. Implement admin login/session handling using Supabase Auth.
3. Replace admin gallery CRUD localStorage with authenticated database queries.
4. Replace client gallery reads/submissions with token-based RPC calls.
5. Replace progress reads/updates with secure RPC/admin operations.
6. Verify RLS and RPC permissions using an anonymous client and an admin session.
7. Test that one client token cannot read or modify another gallery.

Until these steps are complete, use only test data.
