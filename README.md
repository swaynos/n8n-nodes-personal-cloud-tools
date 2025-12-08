**Local Setup Notes (n8n + external drive)**
- n8n app checkout lives on the external volume: `/Volumes/X9 Pro/Dev/n8n`.
- Custom community nodes are loaded from `~/.n8n/custom/node_modules` (not from this repo directly). That keeps node packages off the main system disk and lets you link to local repos.
- Built JS lives alongside TS in the repo (no `dist/`). `package.json` publishes `index.js` and `nodes/**/*.js` directly.

**Integration Points to Recreate This Setup**
- Ensure `~/.n8n/custom` has a `package.json` (minimal, can be `{ "private": true }`). This lets npm track installs; otherwise they show as “extraneous.”
- Install each local package into that prefix so n8n can load it:
  - `npm install --prefix ~/.n8n/custom /Volumes/X9\ Pro/Dev/Git/n8n-nodes-personal-cloud-tools`
  - (Optional) `npm install --prefix ~/.n8n/custom /Volumes/X9\ Pro/Dev/Git/n8n-nodes-imap-tools`
  These commands create symlinks in `~/.n8n/custom/node_modules` pointing at the repos on the external drive.
- Verify the links:
  - `npm ls --prefix ~/.n8n/custom n8n-nodes-personal-cloud-tools`
  - `ls -l ~/.n8n/custom/node_modules | grep personal-cloud`
- Restart n8n. For explicit load logs, start with `COMMUNITY_PACKAGES_LOGGING=true n8n start`.

**Optional: Links in the n8n app checkout**
- The n8n checkout at `/Volumes/X9 Pro/Dev/n8n` also has these packages linked in `node_modules`:
  - `npm ls --prefix /Volumes/X9\\ Pro/Dev/n8n n8n-nodes-personal-cloud-tools`
  - `npm ls --prefix /Volumes/X9\\ Pro/Dev/n8n n8n-nodes-imap-tools`
- These links are not required for runtime (n8n loads from `~/.n8n/custom`), but they’re handy if you run commands inside the n8n repo that expect the packages to be present. To recreate:
  - `npm install --prefix /Volumes/X9\\ Pro/Dev/n8n /Volumes/X9\\ Pro/Dev/Git/n8n-nodes-personal-cloud-tools`
  - `npm install --prefix /Volumes/X9\\ Pro/Dev/n8n /Volumes/X9\\ Pro/Dev/Git/n8n-nodes-imap-tools`

**What Needs to Exist Before Installing**
- Run `npm install` in the repo, then `npm run build` so `index.js` and `nodes/Foobar/Foobar.node.js` exist (they’re ignored by git but required at runtime).
- `package.json` contains:
  - `n8n.nodes` → `nodes/Foobar/Foobar.node.js`
  - `files` → includes `index.js`, `nodes/**/*.js`, `nodes/**/*.json`, `icons`, `README.md`, `package.json`

**Naming/ID Expectations**
- Node id in `nodes/Foobar/Foobar.node.json` is `n8n-nodes-personal-cloud-tools.foobar` and must match the `description.name` in `Foobar.node.ts`.
- Keep the `main` entry as `index.js`; no `dist/` is used.

**If Nodes Don’t Appear**
- Confirm installs in `~/.n8n/custom/node_modules`.
- Restart n8n; check logs with `COMMUNITY_PACKAGES_LOGGING=true`.
- Search the node picker for “Foobar” (or your renamed node).

**Renaming Foobar to Your Real Node**
1) Rename the folder and files under `nodes/` (e.g., `Foobar` → `MyNode`) and update imports in `index.ts`.
2) Update class name and `description.name`/`displayName` in the `.node.ts`.
3) Update `nodes/<NewName>/<NewName>.node.json` → `node` id (e.g., `n8n-nodes-personal-cloud-tools.mynode`) and point `package.json` `n8n.nodes` to the new JS file.
4) Run `npm run build`, reinstall into `~/.n8n/custom` with `--prefix` as above, restart n8n, and verify in the picker.

**Quick Commands Recap**
- Build: `npm run build`
- Install into n8n custom dir: `npm install --prefix ~/.n8n/custom /Volumes/X9\ Pro/Dev/Git/n8n-nodes-personal-cloud-tools`
- Verify load: `npm ls --prefix ~/.n8n/custom n8n-nodes-personal-cloud-tools`
- Start with load logging: `COMMUNITY_PACKAGES_LOGGING=true n8n start`
