# Deploying CampusPulse

This project has two parts that deploy **separately**:

- `backend/` — Node/Express + SQLite API
- `frontend/` — static HTML/CSS/JS (no build step)

Below are two easy, free-tier-friendly paths. Render is recommended because it
supports a writable filesystem, which this SQLite backend needs.

---

## 1. Deploy the backend (Render)

1. Push this project to a GitHub repo (or use Render's "public Git repo" option
   if you don't want your own repo yet — see note at the bottom).
2. Go to https://render.com → **New +** → **Web Service**.
3. Connect your GitHub repo, and set:
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free is fine to start.
4. Click **Create Web Service**. Render will give you a URL like:
   `https://campusfeedback-backend.onrender.com`
5. Important — persistent storage: Render's free tier has an **ephemeral
   filesystem**, meaning `campus.db` will reset on every redeploy/restart.
   For a real deployment, add a **Render Disk** (Settings → Disks → Add Disk,
   mount at `/opt/render/project/src/backend`, 1GB is plenty) so the SQLite
   file persists. This is optional for a demo, required for production use.
6. Test it: visit `https://<your-backend>.onrender.com/api/issues` in a
   browser — you should get back JSON.

**Note on Node version:** this backend uses Node's built-in `node:sqlite`,
which needs **Node 22.5+** (ideally 22.13+). Render's default Node image is
usually recent enough, but if the build fails, add an environment variable
`NODE_VERSION=22` (or a `.node-version` / `engines` field — already present
in `package.json`) in Render's dashboard.

---

## 2. Point the frontend at your backend

Open `frontend/js/api.js` and set one line:

```js
const DEPLOYED_API_BASE = "https://campusfeedback-backend.onrender.com/api";
```

(use your actual Render URL from step 1). Save the file.

---

## 3. Deploy the frontend (Vercel or Netlify)

Both are drag-and-drop simple since this is static HTML — no build command
needed.

### Option A: Vercel
1. https://vercel.com → **Add New** → **Project** → import your repo (or
   drag-and-drop the `frontend` folder using https://vercel.com/new if not
   using git).
2. **Root Directory**: `frontend`
3. Framework preset: **Other** (no build step needed).
4. Deploy. You'll get a URL like `https://campus-feedback.vercel.app`.

### Option B: Netlify
1. https://app.netlify.com/drop
2. Drag the `frontend` folder straight onto the page. That's it — Netlify
   hosts it instantly and gives you a URL.

---

## 4. Update CORS (only if needed)

The backend already has `app.use(cors())` with no restrictions, so it accepts
requests from any frontend origin out of the box. No changes needed unless
you later want to lock it down to your specific frontend domain, e.g.:

```js
app.use(cors({ origin: "https://campus-feedback.vercel.app" }));
```

---

## 5. Login / test data

The backend seeds itself from `backend/data.json` on first boot (users +
sample issues). Check that file for existing demo accounts (student/admin
emails) to log in with once deployed.

---

## Don't have a GitHub repo yet?

Fastest path:
```bash
cd project
git init
git add .
git commit -m "CampusPulse"
gh repo create campuspulse --public --source=. --push
```
(requires the `gh` CLI, or just create a repo on github.com and follow its
"push an existing repo" instructions).

---

## Alternative: Railway instead of Render

Railway (https://railway.app) works almost identically to Render — connect
repo, set root directory to `backend`, it auto-detects Node and runs
`npm start`. Railway's default filesystem is also ephemeral per redeploy
unless you attach a Volume, same caveat as Render's Disk above.
