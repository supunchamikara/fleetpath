# FleetPath — Admin Dashboard

Next.js web console for the FleetPath tracker: journeys, per-driver totals and
the recorded route for any trip. Drivers are managed here outright; a journey
can have its fare corrected or the whole record deleted, but nothing the phone
*measured* is editable.

## Running it

```bash
cd web
cp .env.local.example .env.local     # already points at the project
npm install
npm run dev                          # http://localhost:3000
```

Sign in with **the same Supabase account the phones sync with** (see below).

## Important: the phones must use a shared fleet account

Row Level Security scopes every journey to the `auth.uid()` that uploaded it.
With **anonymous sign-in** each phone gets its own uid, so its journeys are
invisible to everyone else — including this dashboard, which would show an
empty table and no error.

So for the dashboard to see anything, the phones and the dashboard must share
one account:

1. Supabase → Authentication → **Users → Add user** (email + password)
2. Build the app with those credentials:
   ```bash
   flutter build apk \
     --dart-define=SUPABASE_EMAIL=fleet@example.com \
     --dart-define=SUPABASE_PASSWORD=…
   ```
3. Sign in to this dashboard with the same email and password.

Anonymous sign-in stays fine for a single phone with no dashboard.

## Run one server at a time

`npm run dev` and `npm run start` share the `.next` directory. Starting a dev
server while a production one is running (or the reverse) leaves `.next` in a
half-development state: the production server then 400s on its own CSS and
serves pages with no styling, and `NEXT_PUBLIC_*` values go missing from the
client bundle so sign-in fails with no visible error.

If the page renders unstyled or login silently does nothing:

```bash
pkill -f next-server; rm -rf .next; npm run dev
```

Also note: **never pipe `npm run build` into `head`** — `head` exits early and
SIGPIPEs the build mid-write, producing exactly the same broken output.

## Deploying to Vercel

This repository is the Next.js app on its own, so importing it into Vercel needs
no root-directory override — the framework, build command and output are all
detected.

**Set these two environment variables** in Project Settings → Environment
Variables, for Production, Preview and Development. Without them the deployed
app builds fine and then fails to reach Supabase at runtime:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |

Both are in [.env.local.example](.env.local.example). They are `NEXT_PUBLIC_`,
so they reach the browser by design — that is fine for a publishable key, and is
exactly why a `service_role` key must never be added here. RLS is the boundary.

Worth knowing:

- **Vercel servers run UTC.** Every date on the dashboard is pinned to
  `Asia/Colombo` in code (see above), so this makes no difference — but it is
  the reason that pinning is not optional.
- **Set the function region** to Mumbai (`bom1`) under Settings → Functions.
  Pages are server-rendered on each request, so the default US region adds a
  round trip from Sri Lanka to every page load.
- The Supabase project needs no CORS or redirect changes: auth here is
  email/password against the REST API, with the session in a cookie.

## Smoke test

```bash
FLEET_EMAIL=you@example.com FLEET_PASSWORD=… npm run smoke
```

Credentials come from the environment, never the source — these scripts drive a
real sign-in, and a password committed to a repository is a password to change.

Drives the actual login form via puppeteer-core (using the system Chrome, no
bundled download) and dumps the rendered dashboard, which catches broken
styling, missing env vars and RLS problems in one go.

`npm run smoke` and `node scripts/driver_crud.mjs` both need `FLEET_EMAIL` and
`FLEET_PASSWORD`; they exit with a message rather than running without them.

## Times are Sri Lankan, always

Every timestamp in the database is an instant. Turning one into a wall-clock
time or a calendar day needs a timezone, and these pages are **server
components** — so without pinning it, the answer came from whatever host
rendered them. A dashboard rendered from a machine in Sydney showed a Colombo
evening as the next morning, and pushed those journeys into the wrong day and
the wrong month for every takings total.

`TZ = 'Asia/Colombo'` in [lib/format.ts](lib/format.ts) is the single source of
truth. Everything that turns an instant into a date goes through it:

- `fmtTime` / `fmtDay` / `fmtClock` / `fmtDateTime` for display
- `dayKey` / `monthKey` → `YYYY-MM-DD` and `YYYY-MM`, used for every bucket and
  comparison. They sort correctly as plain strings, so a date comparison is a
  string comparison and no `Date` boundary arithmetic is involved.

The loan schedule is the exception, and deliberately so: a due date is a date on
a piece of paper, not a moment in time. It is built from calendar arithmetic and
carried as `YYYY-MM-DD` strings that no timezone can shift. Only the journeys it
is compared against are instants, converted on the way in.

Never reach for `new Date(...).toLocaleString()` or `getMonth()` on a
database timestamp — that is the bug this section exists to prevent.

## How it is put together

```
web/
  middleware.ts            refreshes the session cookie, gates /dashboard
  utils/supabase/          browser, server and middleware clients (@supabase/ssr)
  app/login/               email + password sign-in
  app/dashboard/           overview, journeys, journey detail, drivers
  components/              blueprint box/stat tiles, street + grid route maps, nav
  lib/format.ts            distance/speed/duration, mirroring the app's rules
```

Pages are **server components**: they read the session from the cookie and
query Supabase server-side, so no data is fetched in the browser and the
publishable key is all the client ever sees. RLS remains the actual boundary —
the middleware redirect is only there to avoid rendering an empty shell.

`middleware.ts` calls `supabase.auth.getUser()`. That call is what refreshes
the token and writes the rotated cookie; creating the client alone does
nothing, and sessions would expire mid-use without it.

**The route map** ([components/TripMap.tsx](components/TripMap.tsx)) offers the
same two styles the phone does, and defaults to Streets:

- **Streets** ([components/StreetMap.tsx](components/StreetMap.tsx)) — the track
  on real OpenStreetMap tiles via Leaflet, fitted to the route's bounds.
- **Grid** ([components/RouteMap.tsx](components/RouteMap.tsx)) — plain SVG on
  the drafting grid, using the same equirectangular projection as the phone. No
  network, so it still draws when tiles are blocked or slow.

Leaflet reads `window` at import time, so `StreetMap` is only ever reached
through `next/dynamic` with `ssr: false` from a client component — importing it
into one of the server-rendered pages throws. Start and end are `CircleMarker`s,
not Leaflet's default pin, whose PNG URLs bundlers rewrite into nothing.

A journey with a single GPS fix has no line to draw. Both styles say so rather
than rendering an empty frame, which is indistinguishable from a broken map.

## Overview summaries

The landing page carries three cards — **this month**, **last month** and **all
time** — each headed by the takings, then journeys, distance, time on the road
and the average fare. This month also shows the change against last month.

Month boundaries are the viewer's local calendar, not UTC, so they line up with
the days the fleet actually works.

Two rules keep the money honest, both in
[components/SummaryCard.tsx](components/SummaryCard.tsx):

- A journey with no fare adds nothing to the takings, so the total is a floor —
  the card says how many are missing rather than folding them in as zero.
- The average divides by **priced** journeys only. Counting an unrecorded fare
  as zero would drag the average down and present it as fact. A period with no
  priced journey at all shows `—`, not `Rs 0.00`.

The all-time figures deliberately fetch every row rather than a recent slice: a
total taken from the last 500 journeys is not an all-time total, it just looks
like one. If the API ever caps the result set, the page says the totals are
incomplete instead of under-reporting silently.

## Editing journeys

**Journeys** is paginated server-side — **50 or 100 rows per page**, chosen from
the picker, with the position held in the URL (`?page=2&size=100`) so a view can
be linked or reloaded. Changing the size returns to page 1, since a page number
means something different at a different size. A page number past the end lands
on the last real page rather than an empty table.

### Filters

A **Filters** bar sits above the table with a min/max pair for **Amount**,
**Distance**, **Time**, **Avg speed** and **Max speed**, plus a **date** range.
Every bound lives in the URL, so a filtered view can be linked and reloaded, and
it is carried through paging and page-size changes — dropping it would widen the
result set under the reader. Applying returns to page 1, since the old page
number points at rows that are no longer there.

Dates are Sri Lankan calendar days and include both ends. Sri Lanka is a fixed
UTC+05:30 with no daylight saving, so the bounds are a literal offset.

Three of the five ranges push down to Postgres (`amount`, `distance_meters`,
`max_speed_mps`) along with the date range. **Time** and **Avg** cannot: elapsed
time is `end_time − start_time − paused_seconds` and average speed divides
distance by moving time, and neither exists as a column. They are applied in
[lib/tripFilters.ts](lib/tripFilters.ts) after the rows arrive — which is also
why the page slices rather than using `.range()`, since the total has to be the
count of what actually matched.

That is fine at fleet scale and honest about its limit: if the row cap is ever
hit the page says the filters and totals are incomplete rather than quietly
under-reporting. Adding the two as generated columns, or a view, would let all
of them push down.

The admin can do two things to a row:

- **Edit amount** — inline, saved on Enter. Only the fare is editable. Distance,
  timings and the GPS track are what the phone measured; a dashboard able to
  rewrite them would make the journey log worth nothing. The fare is the one
  field typed by a driver at the kerb, so it is the one worth correcting.
- **Delete** — removes the journey from the cloud after a confirm. The handset
  keeps its own copy and will not re-upload it, because it is already flagged
  synced.

Both read the affected rows back with `.select()` rather than trusting a 2xx.
Row level security does not reject a disallowed write with an error — it
matches no rows, so a blocked delete looks exactly like a successful one. If
nothing comes back, the UI says the policy is missing instead of showing a row
vanishing and then reappearing on refresh.

That delete policy is new: **re-run [supabase/schema.sql](../supabase/schema.sql)**
or deletes will silently do nothing.

Day subtotals cover the rows on the page, so a day split across a page boundary
is counted on each side. The full-history figures live on **Overview**.

One caveat on edits: **Settings → Re-upload all journeys** on a phone re-sends
its local copies, which would overwrite a fare corrected here.

## Loan schedule

**Loan** (`/dashboard/loan`) reproduces the vehicle repayment sheet: 60 monthly
instalments, one row per month, with an **Earnings** column filled in from the
journeys recorded in the calendar month each instalment falls due.

The figures live in [lib/loan.ts](lib/loan.ts) — start date, term, the ordinary
instalment and the months that differ. Edit that object; the table is generated
from it, so changing the term or a balloon payment needs no other change.

```ts
export const LOAN = {
  start: { year: 2026, month: 7, day: 15 },
  months: 60,
  instalment: 55071.75,
  overrides: { 36: 500000, 48: 500000, 60: 1002000 },
};
```

Keep the due day at 28 or lower: the generator carries the day through each
month, and a 31st would roll into the following month in February.

A month with no priced journey shows `—`, not `Rs 0.00` — the takings are
unknown, which is not a claim that nothing was earned. The current month's row
is tinted so it can be found among sixty near-identical ones.

The payment columns from the original sheet (paid date, amount paid, paid by)
are deliberately absent; this page tracks what is owed against what was earned,
not what has been settled.

### Analysis, below the table

[components/LoanAnalysis.tsx](components/LoanAnalysis.tsx) adds four sections:

- **Required daily earnings** — across the whole loan, across the remaining
  term, for this month, and what is still left to cover this month per day.
- **Current earning rate** — the last 30 days, lifetime, per journey and
  journeys per day.
- **Forecast** — projected takings for the rest of the term against what falls
  due, the daily surplus or shortfall, this month's projection, and the date the
  remaining balance would be covered at the current rate.
- **Analysis** — months that covered their instalment, best month, earned to
  date against fallen due to date.

Three things it deliberately refuses to do:

- **Divide by zero.** With no priced journey there is no rate, so the rate,
  forecast and analysis sections are replaced by a sentence saying so. The
  required-earnings figures still show: they are a property of the loan, not of
  the takings.
- **Read a sync gap as a collapse.** If nothing landed in the recent window the
  forecast falls back to the lifetime rate, because a phone that has not synced
  in a month is not a vehicle earning nothing.
- **Claim "remaining" means "outstanding".** Without payment tracking, remaining
  is *instalments not yet due*. Anything already settled early is not known here.

Projections assume today's rate holds for years, which it will not. The wording
says so rather than presenting a straight line as a prediction.

## Managing drivers

The Drivers page is full CRUD: add a driver with a 4-digit PIN, edit their
username, role or status, reset a PIN, or remove them. Phones pull the roster
on their next sync, so a driver created here can sign in on any handset once it
has synced.

Guard rails match the app's: usernames are unique per fleet
(case-insensitively), the last active admin cannot be demoted, deactivated or
removed, and a driver with recorded journeys must be deactivated rather than
deleted so their history stays attributed.

Editing leaves the PIN alone unless you type a new one.

### The security trade-off this required

Originally PIN hashes never left the phone. Managing drivers from the web makes
that impossible: a handset that has never met a driver still has to verify
their PIN offline, so the salted digest now lives in `app_users` and syncs down.

The raw PIN never travels — only `sha256("<salt>::<pin>")`, computed
identically in [lib/pin.ts](lib/pin.ts) and the app's `UserRepository` (there is
a test pinning the two to the same digest). But a 4-digit PIN is 10,000
combinations, so anyone who obtains those rows can recover a PIN offline. **RLS
is the real protection** — the policies scope every row to the fleet account.
Do not loosen them, and never put a `service_role` key in this app.

### Two-way sync

Both ends can edit, so merges are last-write-wins on `updated_at`. Two rules
stop data loss, both covered by tests in `test/user_auth_test.dart`:

- a newer local edit is never overwritten by an older cloud row
- a locally created account that has not uploaded yet is never deleted just
  because the cloud has not seen it
