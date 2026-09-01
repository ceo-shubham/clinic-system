# Dr. RAMGOPAL AGARWAL Diagnostic Clinic — Features

---

## 1. Access Control & Login

- Site-wide password gate — fullscreen overlay blocks the entire system until the correct password is entered. Stays unlocked for 30 days.
- Two roles: **Manager** and **Doctor**, each with a separate login flow.
- Manager login — name selected from a live autocomplete dropdown with fuzzy search and highlighted matches, then PIN entered.
- Inactive managers cannot log in.
- Doctor login — PIN only. If 2FA is enabled, a 6-digit authenticator code is also required after the PIN.
- Wrong PIN shows a shake animation.
- PIN visibility toggle (show/hide).

---

## 2. Manager Panel

### Patient Registration
- Register new patients with: Title (MR./MRS./MS./BABY/MASTER), Full name, Age with unit (years / months / years + months), Father's name, Husband's name, Gender, Mobile number, Address, Referred by, Service/Test, Sub-test details, Guidance checkbox, Medicine checkbox, Amount charged, Amount received, Payment method (Cash / Online / Cash + Online), Payment status, Notes.
- Amount charged auto-fills from the selected services — no manual calculation needed.
- Multiple services can be added per patient; total updates automatically.
- Medicine MRP entered manually when the Medicine checkbox is ticked.
- **Returning patient detection** — when a mobile number is entered, a badge appears if that number was registered before.
- Up to 2 payment installments per patient (e.g. partial at registration, balance paid later).
- Split payment — a patient can pay part in cash and part online; both tracked separately.

### Today's Patient List
- Table view with: Token number, Patient ID, Name, Referred by, Mobile, Service, Amount charged, Amount paid, Payment method, Status, Time, Actions.
- Search bar — filter by name, ID, mobile, or referral source.
- Status filter — All / Pending / Done / Cancelled.
- Date filter — view records for any specific date.
- Live stats cards — Today's Patients, Pending, Done.

### Patient Actions
- **View** — full patient detail in a modal.
- **Edit** — edit any field (subject to permissions granted by doctor).
- **Mark as Paid** — record full or partial payment with cash/online split.
- **Mark as Done** — mark visit as completed.
- **Cancel** — mark visit as cancelled.
- **Print Bill** — print a formatted bill slip for the patient.
- **Delete** — remove patient record (subject to permissions).

### Bulk Operations
- Select multiple patients via checkboxes (or Select All).
- Print bills for all selected patients in one print job.

### Patient History
- Search all historical records by name, Patient ID, mobile number, or date.
- Results grouped by mobile number — all visits by the same patient shown together with total charged, total paid, and outstanding balance.
- Expand any group to see individual visits.

### Daily Backups
- List of auto-saved daily snapshots.
- Download any past day's data as a CSV file.

### Day-End Workflow
- When previous day's data is found on login, a Day-End modal appears.
- Step 1: Download the previous day's CSV.
- Step 2: Close the day — archives all records and starts fresh for today.

### CSV Export
- Export today's patient list as a CSV file with one click from the navbar.

---

## 3. Doctor Panel

### Queue View
- Live queue of all patients registered today.
- Search and status filter (Pending / Done).
- Stats cards: Today Queue, Pending, Done, Next Patient token.

### Manager Control
- Add new managers with name and PIN.
- Edit manager name, PIN, active/inactive status.
- Store extended manager profile info: mobile, email, address, ID number, date of birth, emergency contact, salary, shift, joined date, notes.
- **Per-manager permission toggles** — enable or disable each permission individually:
  - Add Patient
  - Mark as Paid
  - Print Bill
  - Edit Patient
  - Delete Patient
  - Export CSV
  - View History
  - Day-End & Close Day
- Permission changes take effect on open manager sessions within ~15 seconds — no reload needed.
- Inactive managers shown with a dimmed badge.

### Manager Summary
- Per-date summary for each manager: patients added, payments marked, edits made, bills printed, deletions, total actions.
- Date picker to view any past date.
- Clear activity logs button.

### Activity Log
- Full detailed log of every action performed by every manager.
- Filter by date and/or by manager.
- Summary strip showing total actions per manager for the selected date.
- Export the full activity log as a CSV.

### Collection Tab
- **Single Day view** — Total charged, collected, outstanding, cash collected, online collected for any date.
- **Cash handover strip** — shows cash collected vs. amount handed to the doctor vs. amount still held by managers.
- Patient-wise collection breakdown table.
- **Date Range view** — aggregate stats across any date range with Last 7 days / Last 30 days quick presets.
- Day-wise breakdown for the selected range.

### Records Tab
- **By Date** — select a date and see all patients with summary stats; download patient CSV or activity CSV for that date.
- **Patient Search** — search all-time records by name, Patient ID, mobile, or date.
- **Manager History** — view all records handled by a specific manager for a chosen date range; download as CSV.
- **By Service** — filter all records by a specific diagnostic service.

### Service Catalog Editor
- View and edit the full diagnostic service/test catalog, organized by category.
- Add or remove categories and individual tests with prices.
- Changes sync to all connected devices immediately.

### Referral Source Editor
- View and edit the list of referring doctors and hospitals.
- Add new sources, remove existing ones.
- Changes sync to all connected devices immediately.

### Settings
- Change clinic name.
- Change doctor PIN.
- Change currency symbol.
- Enable / disable two-factor authentication (Google Authenticator).
- Enable / disable Telegram notifications for new patient registrations.
- Send a test Telegram notification.
- Full data reset — clears all patient data across all devices.

---

## 4. Bill Printing

- A4 print layout — 2 bill slips per page (each half-A4 size). Each bill is capped at exactly half A4 — even with many medicines the slip never spills to a second page; the medicine list prints in a compact 2-column grid, and if a list is extreme the middle section clips first while the patient info, amounts and footer always stay visible.
- Patient details (name, age, father/husband, mobile, address, referred by) print larger than before for readability; medicine names show quantities (e.g. `Panadol ×15`).
- Each slip includes: clinic logo, clinic name, doctor name, patient token number, patient details (name, age, gender, father/husband name, mobile, address, referral source, service, sub-test details), amount charged, amount paid, cash/online payment breakdown, payment status (PAID / PARTIAL PAYMENT / UNPAID), visit date and time.
- Print-optimized styles — clean black-and-white output.
- Print a single patient or bulk-print multiple selected patients in one job.

---

## 5. Real-Time Multi-Device Sync

- Any change — add, edit, delete patient, permission change, settings change — is immediately reflected on all open devices/tabs.
- Conflict resolution — only the newer record overwrites an older one; stale copies never corrupt fresh data.
- Deleted patients are permanently blacklisted so no stale device copy can ever bring them back.
- Config and permissions sync across devices automatically; manager sees updated permissions without reloading.

---

## 6. Automatic Cloud Backups

- Every patient add or edit triggers an automatic backup within seconds.
- Midnight auto-backup runs every night — previous day's full data is backed up automatically.
- Previous 7 days are also re-synced nightly to catch any missed saves.
- Old records are cleaned up automatically after they are safely backed up.

---

## 7. Telegram Notifications

- Doctor receives a Telegram message for every new patient registered by a manager.
- Message includes: token number, patient name, service, and which manager registered them.
- Each patient triggers exactly one notification — no duplicates even if multiple devices sync simultaneously.
- Failed notifications are retried automatically.

---

## 8. Cash Handover Tracking

- Doctor can record cash collected from a specific manager for any date.
- Tracks: amount, manager name, date, time, optional note.
- Collection tab shows the full breakdown — cash collected, amount handed over to doctor, amount still held by managers.

---

## 9. Service & Test Catalog

- 14 categories of diagnostic services out of the box: Fever, Liver, Joint Pain, Diabetes, Female health, Infections, Male health, Heart, Kidney, Thyroid, Ultrasound, X-Ray, and more.
- 90+ individual tests with prices.
- Doctor can add, edit, or remove any test or category from the UI — changes persist and sync immediately.

---

## 10. Referral Tracking

- Every patient has a "Referred By" field with live autocomplete from the referral list.
- 28+ pre-loaded referral sources (doctors, hospitals, self-referral).
- Doctor can edit the referral list at any time from the panel.
- Referral data visible in patient records, history search, and CSV exports.

---

## 11. Patient Identity & History

- Every visit gets a unique Patient Visit ID.
- Sequential per-day token number (Token #1, #2, #3…) — resets each day.
- Mobile number lookup — system detects returning patients across all historical records.
- Patients grouped by mobile number in history search — shows all visits, total spent, outstanding balance.

---

## 12. Security

- Site-wide password gate before any page loads.
- Manager and doctor PINs stored and compared securely.
- Doctor sessions expire after 8 hours.
- All internal API calls are authenticated — unauthorized requests are blocked.
- Doctor-only actions (delete patient, clear logs, edit catalog, manage 2FA/Telegram) require an active doctor session.
- Permission system prevents managers from performing actions the doctor has not authorized.

---

## 13. Medicine Catalog

- Doctor can manage a full medicine catalog from the Catalog tab (💊 Medicine sub-tab) — separate from the diagnostic tests.
- Add medicines one by one with name and price.
- Edit any medicine name or price directly in the list.
- Remove any medicine from the catalog.
- **Bulk CSV upload** — doctor can upload a CSV file in `medicine,price` format to add or replace the entire medicine list in one go. A sample format hint is shown in the UI.
- Changes saved to the server sync immediately to all connected panels (manager and doctor) — no reload needed.
- Medicine catalog is completely separate from the service/test catalog.

### Medicine Selection in Patient Registration
- When the Medicine checkbox is ticked during patient registration, a new medicine picker appears.
- Manager or doctor can search and select one or more medicines from the catalog (live autocomplete with keyboard navigation).
- **Quantity per medicine** — catalog prices are per tablet/unit, so as soon as a medicine is chosen a quantity box appears. Enter the quantity (e.g. 15 tablets) and press Enter (or ✓ Add) — the medicine is then added with its total (price × qty). Then pick the next medicine, and so on.
- Typing a different name while the quantity box is open cancels the pending medicine; ✕ also cancels it.
- Each selected medicine shows its name, quantity and total price as a tag — remove any with one click.
- **Price auto-adds** — the total amount charged updates automatically (price × quantity) as medicines are added or removed, combined with any selected tests.
- In the manager form, pressing Enter on an empty medicine field moves to the next step (Sub-details), so the registration flow continues once all medicines are entered.
- Medicine quantities are stored with each medicine (e.g. `Panadol ×15`) and appear in bills, patient detail, history search, and CSV exports. Old records without a quantity are treated as quantity 1.

### Bill Breakdown for Medicine + Test
- Bill slip shows a separate line for each component:
  - If only tests are present → `Test: Rs. X`
  - If only medicines are present → `Medicine: Rs. X`
  - If both are present → `Test: Rs. X` and `Medicine: Rs. Y` shown on separate lines
- Final line always shows `Total Amount: Rs. Z` (sum of all components).
- Medicine names are listed on the bill under a "Medicine" row, just like tests are listed under "Service / Test".

### Medicine Data in Records & CSV
- Patient records store medicine names and prices separately from test names.
- CSV exports include a dedicated "Medicine" column alongside "Service / Test".
- Patient detail view and history search both show medicines given.

---

## 14. UI & UX

- Responsive design — works on both desktop and mobile screens.
- Live clock (time + date) in the navbar.
- Server connection status indicator.
- Toast notifications — non-blocking success / error / warning / info messages.
- Autocomplete dropdowns for manager name (login), service/test, and referral source — with keyboard navigation (Arrow keys, Enter, Escape).
- Enter-key navigation through the patient registration form.
- Permission-locked buttons are visually dimmed and non-interactive; they unlock instantly when the doctor grants permission.
- When returning to a tab, permissions and patient list refresh immediately.
