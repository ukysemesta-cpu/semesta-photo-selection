# SEMESTA PHOTO SELECTION V10 — Supabase connected frontend

## Supabase setup
The project uses:
- Project URL: configured in `js/supabase-config.js`
- Publishable key: configured in `js/supabase-config.js`
- Supabase JS v2 from jsDelivr CDN

Only a publishable key is included. Never put Secret/service_role keys in frontend files.

## Run locally
1. Extract this ZIP.
2. Open `semesta-photo-selection` in VS Code.
3. Run `index.html` with Live Server.
4. Sign in using the Supabase Auth admin email/password already created.
5. The signed-in user must have a row in `public.admin_profiles` with role `admin` or `editor`.

## Admin features connected to Supabase
- Login / logout using Supabase Auth.
- Load, create, update, delete galleries in `public.galleries`.
- Update editing status and append `editing_progress` history.
- Create client links using the private `client_token`.
- Manage gallery photo list through `Kelola Foto`.

### Add photos
In the gallery row click `Kelola Foto`, then paste one photo per line:
`FILENAME|PREVIEW_IMAGE_URL|DOWNLOAD_URL`

Use public/direct image URLs. The current version does not yet read Google Drive folders automatically. Google Drive API integration requires a server-side OAuth/service integration and is a later task.

## Client features
- Client gallery opens with `gallery.html?token=...`.
- Gallery data is loaded via `get_client_gallery` RPC.
- Client submits selections via `submit_photo_selection` RPC.
- Progress is loaded via `get_client_progress` RPC.
- Clients do not need to sign in.

## Existing features
- Collage Studio remains local in the browser.
- Local folder actions (Download JPG/RAW and ORI → EDIT) read the online selected photo filenames.
- These local folder actions require Chrome/Edge and localhost or HTTPS.

## Important operational notes
- Test first with a dummy gallery and sample image URLs.
- Ensure the Supabase SQL schema and RPC functions have been run successfully.
- Client gallery links are token-based and must be shared from the deployed website, not localhost.
- Static hosting is still required for public client access.
- Supabase database stores metadata and photo URLs, not the actual image files.


## V10.1 admin login fix
Before testing this build:
1. Open Supabase SQL Editor.
2. Run `SUPABASE_V10_1_ADMIN_LOGIN_FIX.sql`.
3. Confirm it reports Success.
4. Reload the admin page and sign in again.

The login now calls the `get_my_admin_profile()` security-definer RPC for the
current authenticated user rather than querying `admin_profiles` directly.
This avoids depending on a direct table SELECT policy for profile lookup and
shows actionable Supabase error messages if the RPC is unavailable.
