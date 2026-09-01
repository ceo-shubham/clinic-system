# DR. RAMGOPAL AGARWAL DIAGNOSTIC CLINIC — SYSTEM CHANGELOG
# For AI context / handoff document
# Generated: August 2026

---

## SYSTEM OVERVIEW

A clinic management system for Dr. Ramgopal Agarwal Diagnostic Clinic.
- Manager panel: Patient registration, billing, history
- Doctor panel: Queue view, manager control, activity logs, settings
- Backend: Node.js (server.js) + MongoDB Atlas + Backblaze B2
- Frontend: Vanilla HTML/CSS/JS (no frameworks)
- Auth: Manager PIN login, Doctor PIN + optional TOTP, Site-wide password gate

---

## TECH STACK (CURRENT)

| Layer        | Technology              |
|--------------|-------------------------|
| Frontend     | HTML, CSS, JS (vanilla) |
| Backend      | Node.js (http module)   |
| Database     | MongoDB Atlas (free M0) |
| File Backup  | Backblaze B2 (10GB free)|
| Hosting      | Railway.app (free tier) |
| Auth         | PIN + TOTP (RFC 6238)   |

---

## KEY FILES

| File                  | Purpose                                      |
|-----------------------|----------------------------------------------|
| server.js             | Node.js backend — all API routes             |
| app.js                | Shared frontend logic (loaded by all pages)  |
| index.html            | Login page (manager + doctor)                |
| manager.html          | Manager panel — add patients, print bills    |
| doctor.html           | Doctor panel — queue, manager control, stats |
| reset.html            | First-time setup / data reset                |
| style.css             | Global styles                                |
| package.json          | Node dependencies (mongodb)                  |
| render.yaml           | Render.com deploy config (also works Railway)|
| .env                  | Credentials (NOT in git)                     |
| .gitignore            | Excludes .env, node_modules, data/, logs/    |
| service_and_price.xlsx| Service catalog (parsed by server.js)        |
| referal.docx          | Referral doctor list (parsed by server.js)   |
| logo.png              | Clinic logo                                  |

---

## ENVIRONMENT VARIABLES (.env)

```
MONGO_URI        = mongodb+srv://agarwaldrpravin_db_user:PASSWORD@clinic.0qngpos.mongodb.net/clinic?retryWrites=true&w=majority&appName=Clinic
B2_KEY_ID        = 73cca80a9138
B2_APP_KEY       = (secret — see .env file)
B2_BUCKET_NAME   = (bucket ID from Backblaze — see .env file)
SITE_PASSWORD    = 89238350030
PORT             = 3000 (auto-set by Railway/Render)
```

---

## MONGODB COLLECTIONS

| Collection | Purpose                                        |
|------------|------------------------------------------------|
| config     | Single doc {_id:'main', settings, managers}    |
| patients   | All patient visit records (upsert by visitUid) |
| activity   | Manager activity log entries                   |
| telegram   | Sent notification UIDs to prevent duplicates   |

---

## BACKBLAZE B2 FOLDER STRUCTURE

```
drramgopalclinic-backups/
  patient/DD-MM-YYYY/patients_DD-MM-YYYY.csv
  monthly/patients_YYYY-MM.csv
  data/daily/daily-report_DD-MM-YYYY.csv
  managers/ManagerName/activity_DD-MM-YYYY.csv
```

---

## API ENDPOINTS (server.js)

All API routes require header: `X-Site-Pass: 89238350030`

| Method | Route                          | Purpose                        |
|--------|--------------------------------|--------------------------------|
| POST   | /api/save-patient              | Upsert patient record          |
| GET    | /api/patients                  | Get today's patients           |
| POST   | /api/save-day                  | Full day snapshot to B2        |
| POST   | /api/save-activity             | Log manager activity entry     |
| POST   | /api/save-daily-report         | Save daily report to B2        |
| GET    | /api/catalog                   | Get service/referral catalog   |
| GET    | /api/config                    | Get clinic config (public)     |
| POST   | /api/config                    | Save clinic config             |
| GET    | /api/lookup-mobile             | Find patient ID by mobile no.  |
| POST   | /api/doctor/login              | Doctor PIN + TOTP login        |
| GET    | /api/doctor/totp               | TOTP status                    |
| POST   | /api/doctor/totp/setup         | Setup Google Authenticator     |
| POST   | /api/doctor/totp/confirm       | Confirm TOTP enrollment        |
| POST   | /api/doctor/totp/disable       | Disable TOTP                   |
| GET    | /api/doctor/telegram           | Telegram alert status          |
| POST   | /api/doctor/telegram/setup     | Connect Telegram bot           |
| POST   | /api/doctor/telegram/test      | Send test Telegram message     |
| GET    | /api/status                    | Server health check            |

---

## DEFAULT CREDENTIALS (after fresh deploy)

| Role    | Login         | Default Value |
|---------|---------------|---------------|
| Doctor  | PIN           | 5678          |
| Manager | Shahrukh Khan | 1111          |
| Manager | Santosh Kumar | 2222          |
| Manager | Ram Mahesh    | 3333          |
| Manager | Rani          | 4444          |
| Manager | Zhera Khan    | 5555          |
| Manager | Kashish       | 6666          |
| Manager | Bilal Khan    | 7777          |

---

## CHANGES LOG

### Session 1 — Initial Setup & Features
- Created full clinic management system (local Node.js)
- Manager login with PIN autocomplete
- Doctor login with PIN + optional Google Authenticator TOTP
- Patient registration, editing, deletion
- Bill printing (A4, 2 bills per page)
- Service catalog from service_and_price.xlsx
- Referral list from referal.docx
- Daily CSV backups (localStorage + server files)
- Manager activity log
- Doctor panel: queue, manager control, activity log, daily collection
- Telegram notifications for new patients
- Auto-sync between manager/doctor browser (4s polling)
- Day-end archive flow

### Session 2 — Local Server & Autostart
- Windows autostart via Task Scheduler (Install-Clinic-Autostart.ps1)
- START-CLINIC.bat — smart server start (reuses if running)
- START-NGROK.bat — uses authenticated ngrok (skips local unauthenticated copy)
- KILL-CLINIC.bat — stops server + ngrok
- Fixed: used system ngrok (WindowsApps) instead of local unauthenticated ngrok.exe
- Fixed: server.js syntax error (orphaned handleStatus body)

### Session 3 — Feature Additions
- **Title prefix**: MR./MRS./MS./BABY/MASTER dropdown before patient name
- **Age in months/years**: BABY/MASTER get month/year/years+months selector
- **Bill redesign**: Token → Patient ID in header box, font size increased
- **Print layout**: Half-A4 properly filled, bigger text, date+time merged
- **Sync button hidden**: Auto-save on every action, manual sync not needed
- **Mobile lookup**: Server-side API checks all JSON files for existing patient ID
- **Returning patient badge**: Shows "↩ Returning patient (RA-P0001)" on mobile blur

### Session 4 — Cloud Migration
- **Removed** all local-only files:
  - ngrok.exe, START-CLINIC.bat, START-NGROK.bat, KILL-CLINIC.bat
  - INSTALL-AUTOSTART.bat, CONFIGURE-NGROK.bat, Clinic-Autostart.vbs
  - Install-Clinic-Autostart.ps1, Install-Clinic-StartupFolder.ps1
  - Start-Clinic-Background.ps1, data/, patient/, managers/, logs/ folders
- **server.js rewrite**: File system → MongoDB Atlas + Backblaze B2
- **MongoDB**: All patient, config, activity, telegram data stored in Atlas
- **Backblaze B2**: CSV backups auto-uploaded (5s debounce per dateKey)
- **Site password gate**: Every API call requires X-Site-Pass: 89238350030
- **package.json**: Added mongodb dependency, removed ngrok script
- **.env**: MONGO_URI, B2_KEY_ID, B2_APP_KEY, B2_BUCKET_NAME, SITE_PASSWORD
- **.gitignore**: Excludes .env and local data folders
- **render.yaml**: Deploy config for Render/Railway
- **app.js**: All fetch calls updated with X-Site-Pass header
- **GitHub**: Pushed to https://github.com/dr-ramgopalagarwalclinic/clinic

### Session 5 — Manager Isolation & Doctor Panel
- **Manager sees own patients only**: filtered() now filters by attendedById
- **Stats per manager**: updateStats() shows only logged-in manager's counts
- **Father/Husband on bill**: whichever is filled shows on printed bill
- **Required label**: Father/Husband marked with * (one required)
- **Manager Summary tab**: New tab in doctor panel showing:
  - Per-manager patient count for selected date
  - All-time patient count
  - Collected/Charged amounts
  - List of all patient IDs with token numbers
- **Clear Logs button**: In Manager Summary tab, doctor can clear all activity logs
- **clearActivityLog()**: Added to app.js

### Session 6 — Boot Fix
- **Auto-seed on first boot**: connectDB() now inserts DEFAULT_CONFIG if MongoDB
  has no config document — fixes doctor login on fresh deployment
- Default doctor PIN: 5678
- All 7 default managers seeded automatically

### Session 7 — Backup Hardening (zero data loss)
- **Full snapshot to B2**: nightly JSON dump of EVERY collection (patients,
  activity, handovers, config/catalog, tombstones, telegram) to
  full-snapshots/clinic-full-YYYY-MM-DD.json + on boot + whenever
  settings/catalog/medicines/referrals/manager-info/TOTP/Telegram change
- **Handovers now backed up**: midnight backup writes
  data/handovers/handovers_DD-MM-YYYY.csv; daily reports now include
  Total Handed Over / Still Holding
- **Activity-only days backed up**: midnight 7-day re-backup now covers dates
  with activity/handovers even if they have no patients (previously skipped
  forever)
- **b2Upload retries**: 3 attempts with backoff — a transient B2/network
  failure no longer silently drops a backup
- **Safe MongoDB trim**: trimMongoDB now runs ONLY after the full snapshot is
  verified in B2 — if the snapshot fails, MongoDB is left untouched

---

## KNOWN ISSUES / TODO

1. **Railway deployment**: Koyeb shut down (joining Mistral). Use Railway.app
2. **app.js brace count**: CSS strings in template literals cause false brace
   diff when counting — actual syntax is correct for browsers
3. **First deploy**: After pushing, server auto-seeds config on first request
4. **Data reset**: Use reset.html page after deployment to clear any test data

---

## DEPLOYMENT STEPS (Railway.app)

1. railway.app → Login with GitHub
2. New Project → Deploy from GitHub → dr-ramgopalagarwalclinic/clinic
3. Add Environment Variables:
   - MONGO_URI, B2_KEY_ID, B2_APP_KEY, B2_BUCKET_NAME, SITE_PASSWORD
4. Settings → Start Command: node server.js
5. Custom domain: Add in Settings → Domains

---

## SECURITY NOTES

- .env is gitignored — never committed to GitHub
- Site password (89238350030) blocks all API access without it
- Doctor TOTP available via Google Authenticator
- Manager PINs are 4-digit, stored in MongoDB config
- Doctor session tokens expire after 8 hours
- Telegram bot token stored server-side only, never sent to browser
- MongoDB Network Access: 0.0.0.0/0 (all IPs allowed — needed for Railway)
