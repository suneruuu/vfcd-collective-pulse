# FFFF Live Pulse

FFFF Live Pulse combines repeated YES/NO responses into a shared seven-day graph.

- Main display: `/`, with left arrow for YES and right arrow for NO.
- Phone voting: `/vote/`, with the question “Does Vietnam need an annual Creative Festival?” and YES/NO buttons.
- Administrator question manager: `/prompts/`.

Every tap counts at the next one-second sample. Holding a direction adds another response each second. Cloud voting counts database-confirmed responses only and pauses during disconnection. Phone voters sign in with Google before the vote controls become available.

Production voting runs **September 21–27, 2026, 09:00–18:00, Asia/Ho_Chi_Minh**. Main displays share the question queue, rotate every five minutes from 09:05, and show the latest five questions from that day. Phone voting always uses its fixed question; all responses contribute to the campaign graph.

## Run locally

Use Node.js **22.12 or later**:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

The local server runs at `http://localhost:8000`. For development use `npm.cmd run dev`. Without Supabase settings, the existing installation and question manager use local storage and the local server. The phone page needs Supabase to accept online votes.

## Create the Supabase project

1. Create a **Free** project in [Supabase](https://supabase.com/dashboard), preferably in Singapore.
2. Open **SQL Editor** and run the three files in `supabase/migrations/` in filename order. They initialize the campaign, enable question deletion, and add the authenticated phone-voting entry point. Keep `pulse_private` out of the Data API's exposed schemas.
3. Keep **Allow new users to sign up** enabled under **Authentication → Settings** so new Google voters can be created. Under **Authentication → Users**, create your administrator with an email and password.
4. Copy that administrator's user UUID and run:

```sql
insert into pulse_private.admins(user_id) values ('YOUR_ADMIN_USER_UUID');
```

5. Configure Google OAuth:
   - In Google Auth Platform, create a **Web application** OAuth client. Add `https://suneruuu.github.io` and `http://localhost:8000` as authorized JavaScript origins.
   - Add the callback URL shown by **Supabase → Authentication → Providers → Google** as Google's authorized redirect URI. It has the form `https://YOUR_PROJECT.supabase.co/auth/v1/callback`.
   - Enable the Google provider in Supabase and enter the Google client ID and secret.
   - Under **Authentication → URL Configuration**, set the Site URL to `https://suneruuu.github.io/vfcd-collective-pulse/`. Add exact redirect URLs for `https://suneruuu.github.io/vfcd-collective-pulse/vote/` and `http://localhost:8000/vote/`.
6. Copy the project URL and **publishable key** from the project's connection/API settings. Never put the Google client secret, a Supabase secret/service-role key, or a database password in the frontend, GitHub variables, or source code.
7. Copy `.env.example` to `.env.local` and replace its project URL and publishable key. Rebuild or restart development after changing settings. Only the URL, publishable key, and public campaign/base-path settings are needed.

The migrations limit database access to the voting/reading functions and administrator-authorized queue operations. Phone visitors must have a Supabase session, but their user ID is not copied to or associated with vote records. The main display keeps its anonymous submission path. Repeated responses remain intentional; this is a participatory installation, not a one-vote-per-account poll. Historical browser-local responses are not automatically uploaded.

For a different campaign date, update `pulse_private.campaign.start_date` in Supabase and set `VITE_CAMPAIGN_START_DATE` to the same date. Use a fresh project for a fresh campaign so previous cloud votes remain archived. The test suite injects September 14 independently of production settings.

## Enable deletion on an existing Supabase project

Run only `supabase/migrations/202609190002_prompt_deletion.sql` in **SQL Editor**, then deploy the updated website. The upgrade replaces the administrator queue function without changing existing questions, administrator access, campaign settings, or collected votes. Do not rerun the initial migration on an existing project.

Trash removes a question from the queue and connected displays. Deleting the current or next question continues with the remaining questions. An empty queue pauses question rotation while preserving votes.

## Enable voter OAuth on an existing Supabase project

Run only `supabase/migrations/202609190003_voter_oauth.sql` in **SQL Editor**, configure Google and the redirect URLs as described above, then deploy the updated website. Apply the migration before deploying so `/vote/` never references a missing RPC. The upgrade preserves the campaign, questions, administrators, and collected votes.

## Publish with GitHub Pages

The existing repository is `suneruuu/vfcd-collective-pulse`; the application is in its `collective-pulse` subdirectory.

1. Add two **repository variables** under **Settings → Secrets and variables → Actions → Variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
   `VITE_CAMPAIGN_START_DATE` is optional and defaults to `2026-09-21`; keep it aligned with the database campaign.
2. Under **Settings → Pages**, choose **GitHub Actions** as the publishing source.
3. Push the reviewed implementation to `main`, or run **Collective Pulse Pages** manually. The workflow verifies the app and database rules, builds with the repository path, and deploys static output.

Expected addresses after successful deployment:

- Display: `https://suneruuu.github.io/vfcd-collective-pulse/`
- Phone voting: `https://suneruuu.github.io/vfcd-collective-pulse/vote/`
- Question manager: `https://suneruuu.github.io/vfcd-collective-pulse/prompts/`

All routes have static entry pages, so direct visits and refreshes work without a backend on GitHub. For local builds, `VITE_BASE_PATH` defaults to `/`.

## Verification and operation

```powershell
npm.cmd test
npm.cmd run test:database
npm.cmd run build
npm.cmd run test:static
```

Database integration checks create an isolated temporary PostgreSQL cluster and remove it afterwards. Install PostgreSQL or set `PULSE_POSTGRES_BIN` to its binary directory. The tests never connect to the production database.

Before the event, verify Supabase is active, log into `/prompts/`, and open a main display alongside `/vote/`. Sign into `/vote/` with Google, then confirm both vote sources update the same graph, holds repeat once per second, sign-out returns to the gate, and connection loss pauses responses. The app polls new votes every two seconds and catches up after reconnection.

To bring an inactive project back online, restore the existing project in the Supabase dashboard, then verify that `pulse_read` returns its campaign and saved votes. Restoring the project preserves its original campaign; it does not reopen a completed voting window. Keep the September 21–27 dates to view that seven-day archive, and do not rerun the initial migration or delete the vote tables.

Keep operational exports and logs outside `public/`: Vite copies files from that directory into the public build.

GitHub Pages is free for this public repository. Supabase's Free plan currently includes 500 MB of database storage and 5 GB of egress; inactive projects can pause after one week. Check [current allowances](https://supabase.com/pricing) and usage in the dashboard before and during the festival. Export the vote tables after the event if you need an archive; the free plan does not include automatic backups.

## Private access to local mode

```powershell
tailscale serve --bg http://127.0.0.1:8000
tailscale serve status
```

FIT/F fits the day's elapsed timeline, LIVE/L returns to scrolling live view, and the minus/plus controls zoom.
