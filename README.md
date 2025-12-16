**What This Repo Is**
- A collection of n8n community nodes aimed at personal cloud providers. Today it ships an iCloud Photos node; more providers will follow.
- JavaScript builds live alongside TypeScript (no `dist/`). `package.json` publishes `index.js` and `nodes/**/*.js` directly.

**Current Node(s)**
- `iCloud Media` (`nodes/IcloudMedia/IcloudMedia.node.ts`): lists iCloud Photos assets with filters for media type and limit; supports supplying an authenticated iCloud browser cookie via credential.

**Cache iCloud results in a Data Store (avoid re-fetching everything)**
- Create a Data Store (e.g. `icloud_media_cache`) with primary key `id`.
- Refresh workflow (scheduled with Cron): iCloud Media node with `limit: 0` (all) and `includeRaw: false` -> Set node adding `syncedAt: {{$now}}` -> Data Store node set to Upsert, using `id` as the primary key. Optional cleanup: delete rows whose `syncedAt` is older than the current run to remove vanished items.
- Read workflow: before hitting iCloud, check staleness (e.g. static data or a single-row Data Store holding `lastSyncAt`). If stale, call the refresh workflow via Execute Workflow. Then use Data Store “Get All” to read cached rows. If not stale, just “Get All” directly.
- The iCloud node only fetches metadata (not file bytes), so the Data Store rows stay small even for large libraries.

**Dev Machine + n8n Setup**
- n8n is assumed on an external volume, example:`/Volumes/External/Dev/n8n`.
- Custom community nodes are loaded from `~/.n8n/custom/node_modules`. Keep that prefix lightweight with a minimal `package.json` (e.g., `{ "private": true }`).
- Build this repo so the JS artifacts exist: `npm install` then `npm run build`.

**Install/link the package into n8n’s custom directory**
- Install (creates a symlink): `npm install --prefix ~/.n8n/custom /Volumes/External/Dev/Git/n8n-nodes-personal-cloud-tools`
- Verify: `npm ls --prefix ~/.n8n/custom n8n-nodes-personal-cloud-tools` and `ls -l ~/.n8n/custom/node_modules | grep personal-cloud`
- Restart n8n; for load logs: `COMMUNITY_PACKAGES_LOGGING=true n8n start`

**Optional: link into the n8n repo checkout**
- Helpful when running commands inside `/Volumes/External/Dev/n8n` that expect the package:  
  `npm install --prefix /Volumes/External/Dev/n8n /Volumes/External/Dev/Git/n8n-nodes-personal-cloud-tools`
- Verify: `npm ls --prefix /Volumes/External/Dev/n8n n8n-nodes-personal-cloud-tools`

**One-off: capture the iCloud cookie for the credential**
- Install Playwright locally (not added to project deps): `npm install --no-save playwright`
- Download Playwright browser binaries: `npx playwright install`
- Run helper: `npm run get-icloud-cookie`
- A browser opens to iCloud; log in, then press Enter in the terminal when prompted.
- Copy the printed Cookie header value into the `iCloud Cookie Header` field (keep tokens like `X-APPLE-WEBAUTH-TOKEN`).
- Optional env vars: `ICLOUD_LOGIN_URL` (default `https://www.icloud.com/`), `ICLOUD_COOKIE_DOMAIN` (default `icloud.com`).

**If nodes don’t appear**
- Confirm the package is installed under `~/.n8n/custom/node_modules`.
- Restart n8n; check logs with `COMMUNITY_PACKAGES_LOGGING=true`.
- Search the node picker for “iCloud Media”.
