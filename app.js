// ===== CLINIC CORE — app.js =====

const STORAGE_KEY  = 'mxray_patients';
const DELETED_KEY  = 'mxray_deleted_patients';
const ARCHIVE_KEY  = 'mxray_archive';
const SETTINGS_KEY = 'mxray_settings';
const COUNTER_KEY  = 'mxray_uid_counter';
const LAST_DAY_KEY = 'mxray_last_day';
const MANAGERS_KEY = 'mxray_managers';

// ── DEFAULT MANAGERS ─────────────────────────────────────────
const DEFAULT_MANAGERS = [
  { id:'RA-M001', name:'Shahrukh Khan',  pin:'1111', active:true,
    perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
  { id:'RA-M002', name:'Santosh Kumar',  pin:'2222', active:true,
    perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
  { id:'RA-M003', name:'Ram Mahesh',     pin:'3333', active:true,
    perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
  { id:'RA-M004', name:'Rani',           pin:'4444', active:true,
    perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
  { id:'RA-M005', name:'Zhera Khan',     pin:'5555', active:true,
    perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
  { id:'RA-M006', name:'Kashish',        pin:'6666', active:true,
    perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
  { id:'RA-M007', name:'Bilal Khan',     pin:'7777', active:true,
    perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} }
];

const PERM_LABELS = {
  addPatient   :'Add Patient',
  markPaid     :'Mark as Paid',
  printBill    :'Print Bill',
  editPatient  :'Edit Patient',
  deletePatient:'Delete Patient',
  exportCSV    :'Export CSV',
  viewHistory  :'View History',
  dayEnd       :'Day-End & Close Day'
};

// ── SETTINGS ─────────────────────────────────────────────────
const DEFAULT_SETTINGS = { doctorPin:'5678', clinicName:'Dr. RAMGOPAL AGARWAL DIAGNOSTIC CLINIC', currency:'Rs.' };

function getSettings() {
  const s = localStorage.getItem(SETTINGS_KEY);
  return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : { ...DEFAULT_SETTINGS };
}
function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  persistSharedConfig();
}

// Payment text is derived from the stored amounts so a fully paid bill cannot
// show as unpaid because of an older or incorrectly saved status label.
function getPaymentStatus(patient) {
  const charged = Number(patient && patient.amountAsked) || 0;
  const paid = Number(patient && patient.amountPaid) || 0;
  if (charged > 0 && paid >= charged) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Unpaid';
}

// Split payment breakdown — a patient can pay part cash and part online.
// Returns { cash, online, total }. Falls back to the old single paymentMethod
// label for records saved before split payments existed.
function getPaymentBreakdown(patient) {
  const p = patient || {};
  const total = Number(p.amountPaid) || 0;
  const cash  = Number(p.amountPaidCash) || 0;
  const online= Number(p.amountPaidOnline) || 0;
  if (cash || online) return { cash, online, total: cash + online };
  const method = String(p.paymentMethod || '').toLowerCase();
  const onlineWords = ['online','upi','card','gpay','phonepe','paytm','bank','netbanking'];
  if (total > 0 && onlineWords.some(w => method.includes(w))) return { cash: 0, online: total, total };
  return { cash: total, online: 0, total };
}

// Label like "Cash + Online" / "Cash" / "Online" for the bill and views.
function paymentMethodLabel(patient) {
  const b = getPaymentBreakdown(patient);
  if (b.cash > 0 && b.online > 0) return 'Cash + Online';
  if (b.online > 0) return 'Online';
  if (b.cash > 0) return 'Cash';
  return (patient && patient.paymentMethod) || '';
}

// Human-readable payment detail, e.g. "Rs. 500 cash + Rs. 500 online".
function paymentDetailText(patient, currency) {
  const c = currency || 'Rs.';
  const b = getPaymentBreakdown(patient);
  if (!b.total) return '';
  if (b.cash > 0 && b.online > 0) return c + ' ' + b.cash.toLocaleString() + ' cash + ' + c + ' ' + b.online.toLocaleString() + ' online';
  if (b.online > 0) return c + ' ' + b.total.toLocaleString() + ' online';
  return c + ' ' + b.total.toLocaleString() + ' cash';
}

// ── Payment history (max 2 payments per patient) ──────────────
// A patient can pay in at most 2 installments (e.g. partial at entry, balance
// later). Each payment records { amount, cash, online, time }. The flat
// amountPaid / amountPaidCash / amountPaidOnline fields are kept in sync so
// every existing report/bill/CSV keeps working unchanged.
function getPayments(patient) {
  const p = patient || {};
  if (Array.isArray(p.payments) && p.payments.length) return p.payments;
  // Legacy record with only flat fields → synthesize one payment
  const b = getPaymentBreakdown(p);
  return b.total > 0 ? [{ amount: b.total, cash: b.cash, online: b.online }] : [];
}

// Append a payment (amount split cash/online) and return the new flat totals.
// Returns { payments, amountPaid, amountPaidCash, amountPaidOnline, canPay }.
function addPayment(patient, payment) {
  const amount = Math.max(0, Number(payment && payment.amount) || 0);
  let cash = Math.max(0, Number(payment && payment.cash) || 0);
  let online = Math.max(0, Number(payment && payment.online) || 0);
  if (amount > 0 && !cash && !online) { cash = amount; online = 0; } // default all-cash
  if (cash + online > amount) { // clamp split to the received amount
    const ratio = amount / (cash + online || 1);
    cash = Math.round(cash * ratio);
    online = Math.round(online * ratio);
    if (cash + online > amount) online = Math.max(0, amount - cash);
  }
  const payments = getPayments(patient);
  if (payments.length >= 2) { // already maxed — keep existing totals
    return { payments, amountPaid: Number(patient.amountPaid)||0, amountPaidCash: Number(patient.amountPaidCash)||0, amountPaidOnline: Number(patient.amountPaidOnline)||0, canPay: false };
  }
  const now = new Date();
  const entry = { amount, cash, online, time: now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}) };
  const list = [...payments, entry];
  return {
    payments: list,
    amountPaid: list.reduce((s,e)=>s+e.amount,0),
    amountPaidCash: list.reduce((s,e)=>s+(e.cash||0),0),
    amountPaidOnline: list.reduce((s,e)=>s+(e.online||0),0),
    canPay: true
  };
}

// Replace the whole payment history (used by the doctor's edit modal which
// shows the existing payment(s) and appends at most one more).
function replacePayments(patient, payments) {
  const list = (Array.isArray(payments) ? payments : []).slice(0, 2);
  return {
    payments: list,
    amountPaid: list.reduce((s,e)=>s+(Number(e.amount)||0),0),
    amountPaidCash: list.reduce((s,e)=>s+(Number(e.cash)||0),0),
    amountPaidOnline: list.reduce((s,e)=>s+(Number(e.online)||0),0)
  };
}

// ── MANAGERS ─────────────────────────────────────────────────
function getManagers() {
  const raw = localStorage.getItem(MANAGERS_KEY);
  if (!raw) { localStorage.setItem(MANAGERS_KEY, JSON.stringify(DEFAULT_MANAGERS)); return DEFAULT_MANAGERS; }
  let list;
  try { list = JSON.parse(raw); } catch (e) { list = DEFAULT_MANAGERS; }
  // Normalize perms: fill any key missing from a saved config with the entry-
  // workflow defaults (add/mark-paid/print), while explicit values — including
  // a doctor turning a permission OFF in the panel — are always respected.
  const defaults = (DEFAULT_MANAGERS[0] && DEFAULT_MANAGERS[0].perms) || {};
  return list.map(m => {
    const saved = m.perms || {};
    const perms = {};
    Object.keys(defaults).forEach(k => { perms[k] = saved[k] === undefined ? defaults[k] : saved[k]; });
    return Object.assign({}, m, { perms });
  });
}
function saveManagers(list) {
  localStorage.setItem(MANAGERS_KEY, JSON.stringify(list));
  persistSharedConfig();
}
function getManagerById(id) { return getManagers().find(m => m.id === id) || null; }

function hasPerm(perm) {
  const id = sessionStorage.getItem('mxray_manager_id');
  if (!id) return false;
  const m = getManagerById(id);
  return m ? (m.perms[perm] === true) : false;
}
function requirePerm(perm) {
  if (!hasPerm(perm)) { showToast('Access denied — no permission for this action.','error'); return false; }
  return true;
}

// ── UID ───────────────────────────────────────────────────────
// visitUid = unique key per visit (used for DB key & editing)
// uid = same as visitUid (no more RA-P0001 system)
// Manager ID format : RA-M001, RA-M002, …
const MGR_COUNTER_KEY = 'mxray_mgr_counter';

function generateVisitUid() {
  // Generate a short unique ID: date prefix + random
  const now = new Date();
  const d = String(now.getDate()).padStart(2,'0') + String(now.getMonth()+1).padStart(2,'0');
  const r = Math.random().toString(36).slice(2,7).toUpperCase();
  return d + '-' + r;
}

// Keep getRecordKey working — visitUid is the key
function getRecordKey(patient) { return patient && (patient.visitUid || patient.uid); }
function normalizeMobile(mobile) { return String(mobile || '').replace(/\D/g, ''); }

// Generate next manager ID (used when doctor adds a new manager)
function generateManagerId() {
  let c = parseInt(localStorage.getItem(MGR_COUNTER_KEY)||'7',10)+1;
  localStorage.setItem(MGR_COUNTER_KEY, c.toString());
  return 'RA-M'+String(c).padStart(3,'0');
}

// ── PATIENT HISTORY BY MOBILE ─────────────────────────────────
// Returns all archive records for a given mobile number, newest first
function getPatientsByMobile(mobile) {
  const m = normalizeMobile(mobile);
  if (!m) return [];
  return getArchive()
    .filter(p => normalizeMobile(p.mobile) === m)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Returns a summary object for a mobile number
function getMobileSummary(mobile) {
  const records = getPatientsByMobile(mobile);
  if (!records.length) return null;
  const latest  = records[0];
  const totalCharged = records.reduce((s,p) => s+(parseFloat(p.amountAsked)||0), 0);
  const totalPaid    = records.reduce((s,p) => s+(parseFloat(p.amountPaid)||0), 0);
  const totalDue     = Math.max(0, totalCharged - totalPaid);
  return { mobile, name:latest.name, records, count:records.length, totalCharged, totalPaid, totalDue, latest };
}

// ── DATE ─────────────────────────────────────────────────────
function getTodayDateKey() {
  const n = new Date();
  return String(n.getDate()).padStart(2,'0')+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+n.getFullYear();
}
function dateKeyFromInput(v) { const [y,m,d]=v.split('-'); return `${d}-${m}-${y}`; }
function dateInputFromKey(k) { const [d,m,y]=k.split('-'); return `${y}-${m}-${d}`; }
function formatDateKey(k) {
  const [d,m,y]=k.split('-');
  const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${parseInt(d)} ${mn[parseInt(m)-1]} ${y}`;
}

// ── PATIENTS ─────────────────────────────────────────────────
// Deleted-patient tombstones — keys removed from the whole system. Any local
// copy (including stale copies on other devices) is ignored once tombstoned.
function getDeletedUids() { try { const r=localStorage.getItem(DELETED_KEY); return r?JSON.parse(r):[]; } catch(e){ return []; } }
function saveDeletedUids(list) { localStorage.setItem(DELETED_KEY, JSON.stringify(list)); }
function addDeletedUid(uid) {
  const list = getDeletedUids();
  if (uid && !list.includes(uid)) { list.push(uid); saveDeletedUids(list); }
}
function mergeDeletedUids(remoteList) {
  if (!Array.isArray(remoteList) || !remoteList.length) return false;
  const local = getDeletedUids();
  let changed = false;
  remoteList.forEach(u => { if (u && !local.includes(u)) { local.push(u); changed = true; } });
  if (changed) saveDeletedUids(local);
  return changed;
}
function isDeletedPatient(key) { return key ? getDeletedUids().includes(key) : false; }

function getAllPatients() {
  const r = localStorage.getItem(STORAGE_KEY);
  if (!r) return [];
  const deleted = getDeletedUids();
  const delSet = new Set(deleted);
  let list;
  try { list = JSON.parse(r); } catch (e) { return []; }
  return delSet.size ? list.filter(p => !delSet.has(getRecordKey(p))) : list;
}
function saveAllPatients(patients) {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(patients));
  localStorage.setItem('mxray_sync',Date.now().toString());
  autoSaveDailyBackup(patients);
}
function getTodayPatients() { return getAllPatients().filter(p=>p.date===getTodayDateKey()); }
function getPatientsByDate(dk) { return getAllPatients().filter(p=>p.date===dk); }
function getNextPatientNumber(dk) { const l=getPatientsByDate(dk); return l.length?Math.max(...l.map(p=>p.patientNo||0))+1:1; }

async function addPatient(data) {
  const patients = getAllPatients();
  const dateKey  = getTodayDateKey();
  const now      = new Date();
  // patientNo = per-day sequential (deduplicated, no gaps)
  const todayPats    = patients.filter(p => p.date === dateKey);
  const patientNo    = todayPats.length + 1;
  // visitUid = unique key for this visit
  const visitUid     = generateVisitUid();
  // capture attending manager
  const mgrId        = sessionStorage.getItem('mxray_manager_id') || '';
  const mgrObj       = mgrId ? getManagerById(mgrId) : null;
  const attendedById   = mgrId || 'doctor';
  const attendedByName = mgrObj ? mgrObj.name : 'Doctor';
  const p = {
    uid: visitUid,        // uid = visitUid (no separate RA-P0001)
    visitUid,
    patientNo,
    name: data.name.trim(), age: data.age,
    gender: data.gender||'', fatherName: data.fatherName||'', husbandName: data.husbandName||'',
    referredBy: data.referredBy||'', mobile: data.mobile||'',
    address: data.address||'', xrayPart: data.xrayPart||'', medsPart: data.medsPart||'', xrayViews: data.xrayViews||'',
    // Guidance / Medicine tick flags — must be stored or the edit form can't
    // show which options were marked when the patient was registered.
    guidance: !!data.guidance, medicine: !!data.medicine,
    amountAsked: parseFloat(data.amountAsked)||0, amountPaid: parseFloat(data.amountPaid)||0,
    amountPaidCash: parseFloat(data.amountPaidCash)||0, amountPaidOnline: parseFloat(data.amountPaidOnline)||0,
    payments: Array.isArray(data.payments) ? data.payments.slice(0,2) : (parseFloat(data.amountPaid)>0 ? [{ amount: parseFloat(data.amountPaid)||0, cash: parseFloat(data.amountPaidCash)||0, online: parseFloat(data.amountPaidOnline)||0 }] : []),
    paymentStatus: data.paymentStatus||'Unpaid', paymentMethod: data.paymentMethod||'',
    status: 'Pending', notes: data.notes||'',
    attendedById, attendedByName,
    time: now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}),
    date: dateKey,
    dateFormatted: now.toLocaleDateString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric'}),
    createdAt: now.toISOString(), updatedAt: now.toISOString()
  };
  patients.push(p);
  saveAllPatients(patients);
  archiveUpsert(p);
  logActivity(ACT.ADD_PATIENT, { patientUid: p.visitUid, patientName: p.name, amount: p.amountAsked, detail: p.xrayPart });
  syncPatientToServer(p, true);
  return p;
}
function updatePatient(visitUid,updates) {
  const patients=getAllPatients(), idx=patients.findIndex(p=>getRecordKey(p)===visitUid);
  if(idx===-1) return null;
  const before = patients[idx];
  patients[idx]={...before,...updates,updatedAt:new Date().toISOString()};
  saveAllPatients(patients); archiveUpsert(patients[idx]);
  // log the specific update type, with a record of WHAT changed (test/referral/etc.)
  const p = patients[idx];
  const changed=[];
  if ((before.xrayPart||'')!==(p.xrayPart||''))   changed.push('Service: '+(before.xrayPart||'—')+' → '+(p.xrayPart||'—'));
  if ((before.medsPart||'')!==(p.medsPart||''))   changed.push('Medicine: '+(before.medsPart||'—')+' → '+(p.medsPart||'—'));
  if ((before.referredBy||'')!==(p.referredBy||'')) changed.push('Referral: '+(before.referredBy||'—')+' → '+(p.referredBy||'—'));
  if (Number(before.amountAsked||0)!==Number(p.amountAsked||0)) changed.push('Charged: '+(before.amountAsked||0)+' → '+(p.amountAsked||0));
  if (Number(before.amountPaid||0)!==Number(p.amountPaid||0)) changed.push('Paid: '+(before.amountPaid||0)+' → '+(p.amountPaid||0));
  if ((Number(before.amountPaidCash)||0)!==(Number(p.amountPaidCash)||0) || (Number(before.amountPaidOnline)||0)!==(Number(p.amountPaidOnline)||0))
    changed.push('Paid split: '+(Number(p.amountPaidCash)||0)+' cash + '+(Number(p.amountPaidOnline)||0)+' online');
  if ((before.status||'')!==(p.status||'')) changed.push('Status: '+(before.status||'—')+' → '+(p.status||'—'));
  const detail = changed.join('; ') || 'Patient details updated';
  if (updates.paymentStatus==='Paid' && updates.amountPaid)
    logActivity(ACT.MARK_PAID, { patientUid:p.uid, patientName:p.name, amount:updates.amountPaid, detail: detail.includes('Paid') ? detail : 'Paid '+paymentDetailText(p) });
  else if (updates.status==='Done')
    logActivity(ACT.MARK_DONE, { patientUid:p.uid, patientName:p.name, detail });
  else if (updates.status==='Cancelled')
    logActivity(ACT.MARK_CANCEL, { patientUid:p.uid, patientName:p.name, detail });
  else
    logActivity(ACT.EDIT_PATIENT, { patientUid:p.uid, patientName:p.name, detail });
  syncPatientToServer(patients[idx]);
  return patients[idx];
}
function deletePatient(visitUid) {
  const p = getAllPatients().find(x => getRecordKey(x) === visitUid);
  addDeletedUid(visitUid);
  if (p) logActivity(ACT.DELETE_PATIENT, { patientUid:p.uid, patientName:p.name });
  saveAllPatients(getAllPatients().filter(p=>getRecordKey(p)!==visitUid));
  // Also remove from server so no stale copy can resurrect it
  if (SERVER_URL) {
    fetch(SERVER_URL + '/api/delete-patient', {
      method  : 'POST',
      headers : { 'Content-Type':'application/json', 'X-Site-Pass':'89238350030', 'X-Gate-Token': getGateToken() },
      body    : JSON.stringify({ visitUid })
    }).catch(() => {});
  }
}

// Doctor-level delete — also removes from archive and server MongoDB
function doctorDeletePatient(visitUid) {
  const all = getAllPatientsDeduped();
  const p   = all.find(x => getRecordKey(x) === visitUid);
  // Tombstone this key so no device (this one or others) can ever resurrect it
  addDeletedUid(visitUid);
  // Remove from active patients
  saveAllPatients(getAllPatients().filter(x => getRecordKey(x) !== visitUid));
  // Remove from archive
  const archive = getArchive().filter(x => getRecordKey(x) !== visitUid);
  saveArchive(archive);
  // Log activity
  if (p) logActivity(ACT.DELETE_PATIENT, { patientUid:p.uid, patientName:p.name, detail:'Deleted by Doctor' });
  // Delete from MongoDB via server
  if (SERVER_URL) {
    fetch(SERVER_URL + '/api/delete-patient', {
      method  : 'POST',
      headers : { 'Content-Type':'application/json', 'X-Site-Pass':'89238350030', 'X-Gate-Token': getGateToken() },
      body    : JSON.stringify({ visitUid })
    }).catch(() => {});
  }
}

// ── ARCHIVE ──────────────────────────────────────────────────
function getArchive() {
  const r = localStorage.getItem(ARCHIVE_KEY);
  if (!r) return [];
  const deleted = getDeletedUids();
  const delSet = new Set(deleted);
  let list;
  try { list = JSON.parse(r); } catch (e) { return []; }
  return delSet.size ? list.filter(p => !delSet.has(getRecordKey(p))) : list;
}
function saveArchive(arr) { localStorage.setItem(ARCHIVE_KEY,JSON.stringify(arr)); }
function archiveUpsert(patient) {
  const a=getArchive(), idx=a.findIndex(p=>getRecordKey(p)===getRecordKey(patient));
  if(idx===-1) a.push(patient); else a[idx]=patient; saveArchive(a);
}
function searchArchive(query) {
  const q=(query||'').toLowerCase().trim(); if(!q) return [];
  return getArchive().filter(p=>
    p.name.toLowerCase().includes(q)||p.uid.toLowerCase().includes(q)||
    (p.mobile&&p.mobile.includes(q))||(p.referredBy&&p.referredBy.toLowerCase().includes(q))||
    (p.date&&p.date.includes(q))
  ).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}

// Search and group results by mobile number
// Returns: { grouped: [{mobile, name, count, records}], ungrouped: [patients without mobile] }
function searchArchiveGrouped(query) {
  const results = searchArchive(query);
  const byMobile = {};
  const noMobile = [];
  results.forEach(p => {
    const mob = (p.mobile||'').trim();
    if (mob) {
      if (!byMobile[mob]) byMobile[mob] = { mobile:mob, name:p.name, records:[] };
      byMobile[mob].records.push(p);
    } else {
      noMobile.push(p);
    }
  });
  const grouped = Object.values(byMobile).map(g => ({
    ...g,
    count        : g.records.length,
    totalCharged : g.records.reduce((s,p)=>s+(parseFloat(p.amountAsked)||0),0),
    totalPaid    : g.records.reduce((s,p)=>s+(parseFloat(p.amountPaid)||0),0),
    totalDue     : Math.max(0, g.records.reduce((s,p)=>s+(parseFloat(p.amountAsked)||0),0) - g.records.reduce((s,p)=>s+(parseFloat(p.amountPaid)||0),0))
  }));
  return { grouped, ungrouped: noMobile };
}

// ── MANAGER ACTIVITY LOG ─────────────────────────────────────
// Every action by a manager is permanently logged here.
// Key: mxray_activity_log  →  array of log entries, newest first
// Entry shape: { id, mgrId, mgrName, action, detail, patientUid, patientName, amount, dateKey, time, ts }

const ACTIVITY_LOG_KEY = 'mxray_activity_log';

const ACT = {
  ADD_PATIENT    : 'Added Patient',
  EDIT_PATIENT   : 'Edited Patient',
  DELETE_PATIENT : 'Deleted Patient',
  MARK_PAID      : 'Marked as Paid',
  MARK_DONE      : 'Marked as Done',
  MARK_CANCEL    : 'Cancelled Visit',
  PRINT_BILL     : 'Printed Bill',
  EXPORT_CSV     : 'Exported CSV',
  CLOSE_DAY      : 'Closed Day',
  LOGIN          : 'Logged In',
  LOGOUT         : 'Logged Out',
  CASH_HANDOVER  : 'Cash Handover Collected'
};

function getActivityLog() {
  const r = localStorage.getItem(ACTIVITY_LOG_KEY);
  return r ? JSON.parse(r) : [];
}
function saveActivityLog(log) { localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(log)); }
function clearActivityLog() { localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify([])); }

// ── CASH HANDOVER ─────────────────────────────────────────────
// Tracks when doctor collects cash from a manager.
// Shape: { id, mgrId, mgrName, amount, dateKey, time, ts, note }
const HANDOVER_KEY = 'mxray_handovers';

function getHandovers() {
  const r = localStorage.getItem(HANDOVER_KEY);
  return r ? JSON.parse(r) : [];
}
function saveHandovers(list) { localStorage.setItem(HANDOVER_KEY, JSON.stringify(list)); }

function recordHandover(mgrId, mgrName, amount, note, dateKey) {
  const now = new Date();
  const dk  = dateKey || getTodayDateKey();
  const entry = {
    id      : Date.now() + '-' + Math.random().toString(36).slice(2,7),
    mgrId, mgrName,
    amount  : parseFloat(amount) || 0,
    note    : note || '',
    dateKey : dk,
    time    : now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}),
    ts      : now.toISOString()
  };
  const list = getHandovers();
  list.unshift(entry);
  saveHandovers(list);
  // Log in activity so it appears in activity log
  // mgrId here is 'doctor' since doctor is doing it
  const savedMgrId = sessionStorage.getItem('mxray_manager_id');
  sessionStorage.setItem('mxray_manager_id', ''); // temporarily set to doctor
  logActivity(ACT.CASH_HANDOVER, { patientUid:'', patientName:'', amount: entry.amount,
    detail: `From ${mgrName}${note ? ' — '+note : ''}` });
  if (savedMgrId) sessionStorage.setItem('mxray_manager_id', savedMgrId);
  // Sync to server
  syncHandoverToServer(entry);
  return entry;
}

// Total cash handed over by a manager for a date
function getHandoverTotal(mgrId, dateKey) {
  return getHandovers()
    .filter(h => h.mgrId === mgrId && h.dateKey === dateKey)
    .reduce((s,h) => s + (parseFloat(h.amount)||0), 0);
}

// All-time total handed over by a manager
function getAllTimeHandoverTotal(mgrId) {
  return getHandovers()
    .filter(h => h.mgrId === mgrId)
    .reduce((s,h) => s + (parseFloat(h.amount)||0), 0);
}

function syncHandoverToServer(entry) {
  serverSync('/api/save-handover', { entry });
}

function logActivity(action, opts) {
  // opts: { patientUid, patientName, amount, detail }
  const mgrId   = sessionStorage.getItem('mxray_manager_id') || 'doctor';
  const mgrName = mgrId === 'doctor'
    ? 'Doctor'
    : (getManagerById(mgrId) || { name: 'Unknown' }).name;
  const now = new Date();
  const entry = {
    id          : Date.now() + '-' + Math.random().toString(36).slice(2,7),
    mgrId,
    mgrName,
    action,
    detail      : opts?.detail      || '',
    patientUid  : opts?.patientUid  || '',
    patientName : opts?.patientName || '',
    amount      : opts?.amount      || 0,
    dateKey     : getTodayDateKey(),
    time        : now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}),
    ts          : now.toISOString()
  };
  const log = getActivityLog();
  log.unshift(entry);                  // newest first
  // Keep max 10,000 entries to prevent localStorage overflow
  if (log.length > 10000) log.splice(10000);
  saveActivityLog(log);
  // broadcast so doctor page updates in real time
  localStorage.setItem('mxray_activity_sync', Date.now().toString());
  // mirror to file system
  syncActivityToServer(entry);
}

// Returns log entries for a specific manager
function getLogByManager(mgrId) {
  return getActivityLog().filter(e => e.mgrId === mgrId);
}

// Returns log entries for a specific date
function getLogByDate(dateKey) {
  return getActivityLog().filter(e => e.dateKey === dateKey);
}

// Returns per-manager daily summary for a date
function getDailySummary(dateKey) {
  const dk      = dateKey || getTodayDateKey();
  const entries = getLogByDate(dk);
  const mgrs    = getManagers();
  return mgrs.map(m => {
    const mLogs  = entries.filter(e => e.mgrId === m.id);
    const patients = getAllPatientsDeduped()
      .filter(p => p.date === dk);
    // patients this manager added
    const added  = mLogs.filter(e => e.action === ACT.ADD_PATIENT).length;
    const paid   = mLogs.filter(e => e.action === ACT.MARK_PAID).length;
    const edits  = mLogs.filter(e => e.action === ACT.EDIT_PATIENT).length;
    const prints = mLogs.filter(e => e.action === ACT.PRINT_BILL).length;
    const dels   = mLogs.filter(e => e.action === ACT.DELETE_PATIENT).length;
    return { manager: m, logs: mLogs, added, paid, edits, prints, dels, total: mLogs.length };
  });
}

// Auto-log login when manager logs in (called from index.html after auth)
function logManagerLogin() {
  logActivity(ACT.LOGIN, { detail: 'Session started' });
}

// ── SERVER SYNC ───────────────────────────────────────────────
// Auto-detects if running via http server (not file://)
// When served by server.js, all saves mirror to the file system automatically.
const SERVER_URL = (function() {
  if (typeof window === 'undefined') return null;
  if (window.location.protocol === 'file:') return null;
  const { protocol, hostname, port } = window.location;
  return `${protocol}//${hostname}${port ? ':'+port : ''}`;
})();

// Gate token from localStorage — sent with every request to bypass gate
function getGateToken() { return localStorage.getItem('clinic_gate') || ''; }

function serverSync(endpoint, data) {
  if (!SERVER_URL) return;
  fetch(SERVER_URL + endpoint, {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json', 'X-Site-Pass': '89238350030', 'X-Gate-Token': getGateToken() },
    body    : JSON.stringify(data)
  }).catch(() => {});
}

function persistSharedConfig(initialOnly=false) {
  if (!SERVER_URL) return Promise.resolve(null);
  return fetch(SERVER_URL + '/api/config', {
    method:'POST', headers:{'Content-Type':'application/json','X-Site-Pass':'89238350030'},
    body:JSON.stringify({ config:getLocalConfig(), initialOnly })
  }).then(r=>r.ok?r.json():null).then(result=>{
    if (result && result.config) applySharedConfig(result.config);
    return result && result.config;
  }).catch(()=>null);
}
function bootstrapSharedConfig() {
  if (!SERVER_URL) return Promise.resolve(null);
  // Retry a few times so a transient network error never leaves the page on
  // stale permissions/settings from local storage.
  const attempt = (tries) => fetch(SERVER_URL + '/api/config', {headers:{'X-Site-Pass':'89238350030'}})
    .then(r => r.ok ? r.json() : null)
    .then(result => {
      if (result && applySharedConfig(result.config)) return result.config;
      if (tries > 0) return new Promise(r => setTimeout(() => r(attempt(tries - 1)), 1200));
      return persistSharedConfig(true);
    })
    .catch(() => (tries > 0 ? new Promise(r => setTimeout(() => r(attempt(tries - 1)), 1200)) : null));
  return attempt(3);
}
function syncPatientsFromServer() {
  if (!SERVER_URL) return Promise.resolve(false);
  return fetch(SERVER_URL + '/api/patients?all=1', {headers:{'X-Site-Pass':'89238350030','X-Gate-Token':getGateToken()}}).then(r=>r.ok?r.json():null)
    .then(result=>{
      // Apply remote tombstones first so a just-deleted patient (on any device)
      // is filtered out of this merge.
      if (result && result.deletedUids) mergeDeletedUids(result.deletedUids);
      return mergeSharedPatients(result && result.patients);
    }).catch(()=>false);
}
// Keep every open panel in sync with the shared server records — a test or referral
// changed by the doctor shows up on the manager panel (and vice-versa) without a reload.
if (typeof window !== 'undefined' && SERVER_URL) setInterval(syncPatientsFromServer, 20000);
function lookupPatientIdByMobile(mobile) {
  const normalized = normalizeMobile(mobile);
  if (!normalized) return Promise.resolve('');
  const localId = findExistingPatientId(mobile);
  if (!SERVER_URL) return Promise.resolve(localId);
  return fetch(SERVER_URL + '/api/lookup-mobile?mobile=' + encodeURIComponent(normalized), {headers:{'X-Site-Pass':'89238350030'}})
    .then(r => r.ok ? r.json() : null)
    .then(result => { if (result && result.uid) return result.uid; return localId; })
    .catch(() => localId);
}


function syncPatientToServer(patient, registration) {
  if (!SERVER_URL) return;
  // Never re-upload a deleted patient from a stale local copy
  if (isDeletedPatient(getRecordKey(patient))) return;
  const payload = { patient, registration: registration === true };
  function attempt(tries) {
    fetch(SERVER_URL + '/api/save-patient', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json', 'X-Site-Pass': '89238350030', 'X-Gate-Token': getGateToken() },
      body    : JSON.stringify(payload)
    }).then(r => {
      if (!r.ok && tries > 0) setTimeout(() => attempt(tries - 1), 5000);
    }).catch(() => {
      if (tries > 0) setTimeout(() => attempt(tries - 1), 5000);
    });
  }
  attempt(5); // try up to 5 times
}

function mergeSharedPatients(remotePatients) {
  if (!Array.isArray(remotePatients)) return false;
  const today  = getTodayDateKey();
  const deleted = getDeletedUids();
  const delSet  = new Set(deleted);
  const merged = new Map();
  getAllPatients().forEach(p => merged.set(getRecordKey(p), p));
  remotePatients.forEach(remote => {
    const key   = getRecordKey(remote);
    if (delSet.has(key)) return; // tombstoned — never resurrect
    const local = merged.get(key);
    if (!local) {
      merged.set(key, remote);
    } else {
      const localTs  = new Date(local.updatedAt  || local.createdAt  || 0).getTime();
      const remoteTs = new Date(remote.updatedAt || remote.createdAt || 0).getTime();
      if (remoteTs > localTs) merged.set(key, remote);
    }
  });
  const next   = [...merged.values()];
  const before = JSON.stringify(getAllPatients());
  const after  = JSON.stringify(next);
  if (before !== after) {
    localStorage.setItem(STORAGE_KEY, after);
    autoSaveDailyBackup(next);
    window.dispatchEvent(new Event('mxray_remote_sync'));
  }
  // Sync non-today patients into archive (without duplicating today's active ones)
  remotePatients.forEach(p => {
    if (p.date !== today && !delSet.has(getRecordKey(p))) archiveUpsert(p);
  });
  return before !== after;
}

// Deduplicated combined list — visitUid is unique key, active patients take priority
function getAllPatientsDeduped() {
  const seen = new Map();
  // Active first (higher priority)
  getAllPatients().forEach(p => seen.set(getRecordKey(p), p));
  // Archive fills in gaps only
  getArchive().forEach(p => { if (!seen.has(getRecordKey(p))) seen.set(getRecordKey(p), p); });
  return [...seen.values()];
}

function syncActivityToServer(entry) {
  serverSync('/api/save-activity', { entry });
}

function buildServiceBreakdown(patients) {
  const map = {};
  patients.forEach(p => {
    const svc = p.xrayPart || 'Unknown';
    if (!map[svc]) map[svc] = { name:svc, count:0, charged:0, paid:0 };
    map[svc].count++;
    map[svc].charged += parseFloat(p.amountAsked)||0;
    map[svc].paid    += parseFloat(p.amountPaid)||0;
  });
  return Object.values(map).sort((a,b) => b.count - a.count);
}

function buildManagerSummaryForSync(dateKey) {
  const entries = getLogByDate(dateKey);
  return getManagers().map(m => {
    const mLogs = entries.filter(e => e.mgrId === m.id);
    return {
      name  : m.name,
      added : mLogs.filter(e => e.action === ACT.ADD_PATIENT).length,
      paid  : mLogs.filter(e => e.action === ACT.MARK_PAID).length,
      edits : mLogs.filter(e => e.action === ACT.EDIT_PATIENT).length,
      prints: mLogs.filter(e => e.action === ACT.PRINT_BILL).length,
      dels  : mLogs.filter(e => e.action === ACT.DELETE_PATIENT).length,
      total : mLogs.length
    };
  }).filter(m => m.total > 0);
}

// Full day sync — writes patients CSV, manager activity CSVs, daily report
function runDailySync(dateKey) {
  const dk       = dateKey || getTodayDateKey();
  const patients = getPatientsByDate(dk);
  if (!patients.length) return;
  const activity = getLogByDate(dk);
  const summary  = buildManagerSummaryForSync(dk);
  const services = buildServiceBreakdown(patients);
  serverSync('/api/save-day', {
    dateKey  : dk,
    dateFormatted: formatDateKey(dk),
    patients, activityLog: activity,
    managerSummary: summary, services
  });
}

// Auto full-sync: push ALL local data to server every 2 minutes
// Also syncs any previous days that haven't been closed yet
if (typeof window !== 'undefined' && SERVER_URL) {
  setInterval(() => {
    const today = getTodayDateKey();
    // Sync today
    runDailySync(today);
    // Sync any unclosed previous days too
    getPreviousDaysPending().forEach(dk => runDailySync(dk));
  }, 2 * 60 * 1000);
}

function autoSaveDailyBackup(allPatients) {
  const byDate={};
  allPatients.forEach(p=>{ if(!byDate[p.date]) byDate[p.date]=[]; byDate[p.date].push(p); });
  Object.entries(byDate).forEach(([dk,pts])=>{ localStorage.setItem('mxray_csv_backup_'+dk, buildCSV(pts)); });
}
function getBackupDates() {
  const dates=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i); if(k&&k.startsWith('mxray_csv_backup_')) dates.push(k.replace('mxray_csv_backup_',''));
  }
  return dates.sort().reverse();
}
function downloadBackupCSV(dateKey) {
  const csv=localStorage.getItem('mxray_csv_backup_'+dateKey);
  if(!csv){showToast('No backup for '+formatDateKey(dateKey),'warning');return;}
  _triggerDownload(csv,'CLINIC_'+dateKey+'.csv');
  showToast('Downloaded: CLINIC_'+dateKey+'.csv','success');
}

// ── DAY-END ───────────────────────────────────────────────────
function getPreviousDaysPending() {
  const today=getTodayDateKey(), patients=getAllPatients();
  return [...new Set(patients.map(p=>p.date))].filter(d=>d!==today);
}
function checkDayEnd() { return getPreviousDaysPending(); }
function closeDayAndArchive(dateKey) {
  const patients=getAllPatients(), dayPats=patients.filter(p=>p.date===dateKey);
  dayPats.forEach(p=>archiveUpsert(p));
  saveAllPatients(patients.filter(p=>p.date!==dateKey));
  localStorage.setItem(LAST_DAY_KEY,dateKey);
  logActivity(ACT.CLOSE_DAY, { detail: 'Day closed: ' + formatDateKey(dateKey) });
  // write full day snapshot to file system before clearing
  runDailySync(dateKey);
  return dayPats;
}

// ── CSV ───────────────────────────────────────────────────────
function buildCSV(patients) {
  const s=getSettings();
  const headers=[
    'Patient No','Patient ID','Name','Age','Gender','Referred By','Mobile','Address',
    'Service / Test','Medicine','Details',
    'Amount Charged ('+s.currency+')','Amount Paid ('+s.currency+')','Amount Paid Cash ('+s.currency+')','Amount Paid Online ('+s.currency+')',
    'Payment Status','Status','Notes','Time','Date',
    'Attended By (Manager)','Manager ID'
  ];
  const rows=patients.map(p=>[
    p.patientNo, p.uid,
    '"'+p.name+'"', p.age, p.gender||'',
    '"'+(p.referredBy||'')+'"', p.mobile||'',
    '"'+(p.address||'')+'"',
    '"'+(p.xrayPart||'')+'"',
    '"'+(p.medsPart||'')+'"',
    '"'+(p.xrayViews||'')+'"',
    p.amountAsked||0, p.amountPaid||0,
    Number(p.amountPaidCash)||0, Number(p.amountPaidOnline)||0,
    p.paymentStatus||'', p.status||'',
    '"'+(p.notes||'')+'"',
    p.time||'', p.date||'',
    '"'+(p.attendedByName||'')+'"',
    p.attendedById||''
  ]);
  return [headers.join(','),...rows.map(r=>r.join(','))].join('\n');
}
function _triggerDownload(content, filename) {
  const blob=new Blob([content],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function downloadCSV(dateKey,patients) { _triggerDownload(buildCSV(patients),'CLINIC_'+dateKey+'.csv'); }
function exportTodayCSV() {
  const dk=getTodayDateKey(), list=getTodayPatients();
  if(!list.length){showToast('No records for today.','warning');return;}
  downloadCSV(dk,list); showToast('CSV downloaded: CLINIC_'+dk+'.csv','success');
}

// ── PRINT ─────────────────────────────────────────────────────
function printBill(uid) { if(typeof doPrint==='function'){doPrint([uid]);return;} showToast('Print not available here.','warning'); }

// ── TOAST ─────────────────────────────────────────────────────
function showToast(msg,type='info') {
  let c=document.querySelector('.toast-container');
  if(!c){c=document.createElement('div');c.className='toast-container';document.body.appendChild(c);}
  const icons={success:'✔',error:'✕',warning:'!',info:'i'};
  const t=document.createElement('div'); t.className='toast '+type;
  t.innerHTML=`<span class="t-icon">${icons[type]||'i'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(24px)';setTimeout(()=>t.remove(),300);},3500);
}

// ── CLOCK ─────────────────────────────────────────────────────
function startClock(id) {
  function tick(){const el=document.getElementById(id);if(!el)return;const n=new Date();el.textContent=n.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})+'   '+n.toLocaleDateString('en-US',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}
  tick();setInterval(tick,1000);
}

// ── SYNC ──────────────────────────────────────────────────────
function initSync(cb) {
  window.addEventListener('storage',e=>{if(e.key==='mxray_sync'&&cb)cb();});
  window.addEventListener('mxray_remote_sync',()=>{if(cb)cb();});
}

// ── AUTH ──────────────────────────────────────────────────────
function checkAuth(role) {
  if(role==='doctor'){const a=sessionStorage.getItem('mxray_doctor_auth');if(!a)window.location.href='index.html';}
  else if(role==='manager'){const id=sessionStorage.getItem('mxray_manager_id');if(!id)window.location.href='index.html';}
}
function logout(){sessionStorage.clear();window.location.href='index.html';}
function getCurrentManagerName(){const id=sessionStorage.getItem('mxray_manager_id');if(!id)return'Manager';const m=getManagerById(id);return m?m.name:'Manager';}

// ── SERVICES ──────────────────────────────────────────────────
// Service catalogue and prices copied from service_and_price.xlsx.
let SERVICE_CATEGORIES=[
  {label:'Fever Related',items:[['CBC (Hb%, TLC, DLC, Platelets) 5 Part',200],['Malaria (Antigen, Antibody)',10],['Dengue (NS1Ag, IgG & IgM)',600],['Widal',50],['Typhidot',300],['Eosinophilia',100]]},
  {label:'Pelia Related',items:[['S-Bilirubin',100],['SGPT',100],['SGOT',100],['LFT',450],['HBsAg',100],['HCV',450]]},
  {label:'Joint Pain Related',items:[['Vit D3',1000],['CRP',400],['Uric Acid',100],['R.A. Factor Quantative',400],['HLAB-27',700],['S.Ca',100]]},
  {label:'Diabetes Related',items:[['HBA1C',400],['FBS',50],['RBS',50],['PPBS',50]]},
  {label:'Female Related',items:[['VDRL',100],['Torch IgG',950],['Torch IgM',950],['Serum Prolaction',300],['LH',300],['FSH',300],['Pragnency Profile',550],['Pragnency Test',50]]},
  {label:'Infection Related',items:[['AFB',300],['CRP',400],['ESR',50],['T.B. Platinum',2500],['HIV (I, II)',400],['Manloux Test',50]]},
  {label:'Male Related',items:[['PSA',1000],['Semen Test',350]]},
  {label:'Heart Related',items:[['Cholestrol',100],['Lipid Profile',400],['ECG',400],['TropT',500],['TropI',500]]},
  {label:'Kidney Related',items:[['KFT',750],['S.Cretanine',100],['Alpo4',100],['Urine - R/M',50],['Blood Urea',100]]},
  {label:'Thyroid Related',items:[['T3, T4, TSH',350],['TSH',200],['FT3, FT4, FTSH',950]]},
  {label:'Other',items:[['S.Amytlase',500],['S.Lipase',500],['B.Group',50],['Complete Health Check Up',2500],['Mini Health Check Up',1700],['CST OT',550]]},
  {label:'Ultrasound',items:[['Abdomen',850],['Pregnancy',850],['Abdomen + Pregnancy',1300],['Scrotal (Testis)',1000],['Thyroid',1200],['Anti N.B. Scan',1200]]},
  {label:'X-Ray',items:[['Chest',400],['Soulder',400],['Elbow',400],['Wrist',400],['Hand',400],['Hip',400],['Thigh',400],['Knee',400],['Ankle',400],['Lower Leg',400],['Foot',400],['P.N.S.',400],['Skull',800],['Cervical',800],['D.L. Spine',800],['L.S. Spine',400],['K.U.B. Abdomen',400],['Dental',200]]}
];
let ALL_SERVICES=SERVICE_CATEGORIES.flatMap(c=>c.items.map(([name])=>name));
let SERVICE_PRICES=Object.fromEntries(SERVICE_CATEGORIES.flatMap(c=>c.items));
function applyServiceCatalog(categories) {
  if (!Array.isArray(categories) || !categories.length) return;
  const valid = categories.every(c => c && typeof c.label === 'string' && Array.isArray(c.items));
  if (!valid) return;
  SERVICE_CATEGORIES = categories;
  ALL_SERVICES = SERVICE_CATEGORIES.flatMap(c => c.items.map(([name]) => name));
  SERVICE_PRICES = Object.fromEntries(SERVICE_CATEGORIES.flatMap(c => c.items));
}
function getCatalogServiceName(value){
  const text=(value||'').trim();
  if (Object.prototype.hasOwnProperty.call(SERVICE_PRICES,text)) return text;
  const match=text.match(/^[^:]+:\s*(.+)$/);
  return match && Object.prototype.hasOwnProperty.call(SERVICE_PRICES,match[1]) ? match[1] : text;
}

function getLocalConfig() { return { settings:getSettings(), managers:getManagers() }; }
function applySharedConfig(config) {
  if (!config || !config.settings || !Array.isArray(config.managers)) return false;
  // A doctor-initiated data reset must also clear old browser copies; otherwise
  // a manager's stale local storage could put cleared patients back on server.
  const resetAt = config.settings.dataResetAt || '';
  if (resetAt && localStorage.getItem('mxray_data_reset_at') !== resetAt) {
    [STORAGE_KEY, ARCHIVE_KEY, COUNTER_KEY, LAST_DAY_KEY].forEach(key => localStorage.removeItem(key));
    Object.keys(localStorage).filter(key => key.startsWith('mxray_activity_') || key.startsWith('mxray_csv_backup_')).forEach(key => localStorage.removeItem(key));
    localStorage.setItem('mxray_data_reset_at', resetAt);
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(config.settings));
  localStorage.setItem(MANAGERS_KEY, JSON.stringify(config.managers));
  localStorage.setItem('mxray_config_sync', Date.now().toString());
  return true;
}
const sharedConfigReady = bootstrapSharedConfig();
const sharedPatientsReady = syncPatientsFromServer();

// On page load — push ALL local patients to server (catches anything missed due to offline/gate issues)
if (typeof window !== 'undefined' && SERVER_URL) {
  sharedConfigReady.then(() => {
    const localPatients = getAllPatients();
    if (localPatients.length) {
      console.log('[startup-sync] Pushing', localPatients.length, 'local patients to server...');
      localPatients.forEach(p => syncPatientToServer(p, false));
    }
  }).catch(() => {});
}

if (typeof window !== 'undefined' && SERVER_URL) setInterval(syncPatientsFromServer, 4000);
// Live config sync — when the doctor changes a manager's permissions (or
// settings), an open manager panel picks it up within ~15s without a reload:
// re-apply permission UI guards and re-render rows that depend on perms.
if (typeof window !== 'undefined' && SERVER_URL) setInterval(() => {
  fetch(SERVER_URL + '/api/config', { headers: { 'X-Site-Pass': '89238350030' } })
    .then(r => r.ok ? r.json() : null)
    .then(result => {
      if (!result || !applySharedConfig(result.config)) return;
      if (typeof applyPermUI === 'function') applyPermUI();
      window.dispatchEvent(new Event('mxray_remote_sync'));
    }).catch(() => {});
}, 15000);
function getServicePrice(name){ return Number(SERVICE_PRICES[getCatalogServiceName(name)]) || 0; }
function getServicePriceLabel(name){ const price=SERVICE_PRICES[getCatalogServiceName(name)]; return typeof price==='string' ? price : 'Rs. '+(Number(price)||0); }
function getServiceCategory(name){ const group=SERVICE_CATEGORIES.find(c=>c.items.some(([item])=>item===name)); return group ? group.label : ''; }
function getServiceLabel(name){ const category=getServiceCategory(name); return category ? `${category}: ${name}` : name; }
function getServiceDisplay(services){ return (services||'').split(' + ').map(getServiceLabel).join(' • '); }
function serviceOptions(sel=''){ return ALL_SERVICES.map(item=>`<option value="${getServiceLabel(item)}"${sel===item?' selected':''}></option>`).join(''); }
function xrayOptions(sel=''){return serviceOptions(sel);}

// ── MEDICINES ────────────────────────────────────────────────
// Medicine catalogue — flat list of [name, price]. Starts EMPTY: the doctor
// adds his own medicines from the doctor panel (💊 Medicine sub-tab of
// Catalog) — manually or via bulk CSV upload (medicine,price). The list is
// synced to every panel like tests, so patient entry / bills pick up the
// doctor's medicines automatically.
let MEDICINES=[];
let MEDICINE_PRICES=Object.fromEntries(MEDICINES);
function applyMedicineCatalog(list){
  if (!Array.isArray(list)) return;
  const valid = list.every(m => Array.isArray(m) && typeof String(m[0]||'').trim() === 'string');
  if (!valid || !list.length) return;
  MEDICINES = list.map(m => [String(m[0]).trim(), m[1]]).filter(([n]) => n);
  MEDICINE_PRICES = Object.fromEntries(MEDICINES);
}
function getMedicinePrice(name){ return Number(MEDICINE_PRICES[String(name||'').trim()]) || 0; }
function getMedicinePriceLabel(name){ const price=MEDICINE_PRICES[String(name||'').trim()]; return typeof price==='string' ? price : 'Rs. '+(Number(price)||0); }
// Medicine quantities — the catalog price is per tablet / per unit. A medsPart
// string stores each medicine as "Name" or "Name ×Qty", joined by " + ".
// e.g. "Panadol ×15 + Calpol ×10". Old records without qty parse as qty 1.
function parseMedEntry(entry){
  const s = String(entry||'').trim();
  if (!s) return null;
  const m = s.match(/^(.*?)\s*×\s*(\d+)$/);
  if (m && m[1].trim()) return { name:m[1].trim(), qty:Math.max(1, parseInt(m[2],10)||1) };
  return { name:s, qty:1 };
}
function parseMeds(part){ return (part||'').split(' + ').map(parseMedEntry).filter(Boolean); }
function medsToPart(meds){ return meds.map(m => (m && m.qty > 1) ? m.name + ' ×' + m.qty : (m ? m.name : '')).filter(Boolean).join(' + '); }
function getMedQty(m){ return Math.max(1, parseInt((m&&m.qty),10)||1); }
function getMedsDisplay(part){ return parseMeds(part).map(m => m.qty>1 ? m.name+' ×'+m.qty : m.name).join(' • '); }
// Catalog-computed totals for the bill breakdown: Test and Medicine shown
// separately, then the total.
function getTestsTotal(part){ return (part||'').split(' + ').filter(Boolean).reduce((s,n)=>s+getServicePrice(n),0); }
function getMedsTotal(part){ return parseMeds(part).reduce((s,m)=>s+getMedicinePrice(m.name)*m.qty,0); }
// Legacy-safe tick flags — older records (registered before the guidance/medicine
// flags were stored) only carry the medicine names in medsPart or an old
// "Consultancy" service in xrayPart, so the tick state is inferred from them.
function hasGuidance(p){ return !!(p && (p.guidance || /consultancy|guidance/i.test(String(p.xrayPart||'')))); }
function hasMedicine(p){ return !!(p && (p.medicine || (p.medsPart && String(p.medsPart).trim()))); }
function medicineOptions(){ return MEDICINES.map(([name])=>`<option value="${String(name).replace(/"/g,'&quot;')}"></option>`).join(''); }

// ── REFERRALS ─────────────────────────────────────────────────
let REFERRALS=[
  'Self','Dr. Pravin Kumar Agarwal','Patient don\'t want to disclose DR.\'s name',
  'Dr. D. K. Yadav (BAMS)','Dr. M. R. Kushwah (BAMS)','Dr. Vimla Sharma (MBBS, MS)',
  'Dr. S. K. Agarwal (MBBS)','Vivek Priya Hospital','Dr. Priyanka Yadav (BHMS)',
  'Dr. Abhilasha Srivastav (BAMS)','Dr. Atif Iqbal (BEMS)','Dr. Aash Mohammad (BAMS)',
  'Dr. K. V. S. Rana (BAMS)','Dr. J. V. S. Rana (BAMS)','Dr. Pramod Yadav (MBBS)',
  'Government Hospital (SRD)','Dr. Sanjeev Mathur (MBBS)','Dr. Vikram Bhadhur (BAMS)',
  'City Hospital','Dr. Rakesh Yadav','Dr. Ramesh Chandra','Shree Shyam Hospital',
  'DR. S.S. Bharadwaj','Dr. Ashok Dwivedi','Life Care Hospital','F. S. Hospital',
  'Purvi Hospital (Jasrana)','Dr. Shiv Kumar (BAMS)','Self / Walk-in'
];
function referralOptions(sel=''){
  return REFERRALS.map(r=>`<option value="${r}"${sel===r?' selected':''}></option>`).join('');
}
function refreshCatalogInputs() {
  const serviceInput = document.getElementById('service-options');
  const doctorServiceInput = document.getElementById('doctor-service-options');
  const referralInput = document.getElementById('ref-options');
  const medicineInput = document.getElementById('medicine-options');
  const doctorMedicineInput = document.getElementById('doctor-medicine-options');
  if (serviceInput) serviceInput.innerHTML = serviceOptions();
  if (doctorServiceInput) doctorServiceInput.innerHTML = serviceOptions();
  if (referralInput) referralInput.innerHTML = referralOptions();
  if (medicineInput) medicineInput.innerHTML = medicineOptions();
  if (doctorMedicineInput) doctorMedicineInput.innerHTML = medicineOptions();
}
function loadReferenceCatalog() {
  if (!SERVER_URL) return Promise.resolve(null);
  // While the doctor has the Catalog / Referral editor open, the background
  // sync must NOT replace the in-memory arrays — otherwise unsaved edits get
  // clobbered and the Save button reads the stale server list. The doctor
  // page sets window.__pauseCatalogSync while its editor tab is active.
  if (window.__pauseCatalogSync) return Promise.resolve(null);
  return fetch(SERVER_URL + '/api/catalog', { cache:'no-store', headers:{'X-Site-Pass':'89238350030'} }).then(r => r.ok ? r.json() : null).then(catalog => {
    if (!catalog) return null;
    // The editor tab may have opened while this request was in flight — never
    // apply a stale server catalog over unsaved doctor edits.
    if (window.__pauseCatalogSync) return null;
    applyServiceCatalog(catalog.services);
    if (Array.isArray(catalog.referrals) && catalog.referrals.length) REFERRALS = catalog.referrals;
    if (Array.isArray(catalog.medicines) && catalog.medicines.length) applyMedicineCatalog(catalog.medicines);
    refreshCatalogInputs();
    window.dispatchEvent(new CustomEvent('mxray_catalog_sync', { detail:catalog }));
    return catalog;
  }).catch(() => null);
}
const referenceCatalogReady = loadReferenceCatalog();
if (typeof window !== 'undefined' && SERVER_URL) setInterval(loadReferenceCatalog, 3000);

// ── AUTOCOMPLETE HELPER ───────────────────────────────────────
// Attaches a dropdown autocomplete to a text input. An option is committed ONLY
// when the user presses Enter or clicks/taps it — just pausing or moving the
// cursor never auto-selects, and the list stays open until a choice, Escape,
// or focus leaving the field. The dropdown never closes just because the mouse
// cursor is moved away.
// items  = string[] OR a function returning the current string[] (kept live so
//          the dropdown always reflects the latest server catalog/referrals)
// onSelect(value) = fired when the user commits an option
// onEnter(value)  = fired when Enter is pressed with NO option highlighted
function attachAutocomplete(inputEl, items, onSelect, onEnter) {
  let box = null;
  let activeIndex = -1;
  let highlightedEl = null; // the ONE tinted item — only one can be highlighted at a time
  function getItems(){ return typeof items === 'function' ? items() : items; }
  function removeBox(){ if(box){ box.remove(); box=null; } highlightedEl=null; activeIndex=-1; }
  function clearHighlight(){ if(highlightedEl){ highlightedEl.style.background=''; highlightedEl=null; } activeIndex=-1; }
  function setActive(i){
    // Untint the previous item first so the highlight never accumulates
    if(highlightedEl) highlightedEl.style.background='';
    activeIndex=i;
    highlightedEl=box?box.querySelector('[data-idx="'+i+'"]'):null;
    if(highlightedEl){ highlightedEl.style.background='#eff6ff'; try{ highlightedEl.scrollIntoView({block:'nearest'}); }catch(e){} }
  }
  inputEl.setAttribute('autocomplete','off');
  inputEl.addEventListener('input',function(){
    removeBox();
    const q=this.value.toLowerCase().trim();
    const matches=q?getItems().filter(i=>i.toLowerCase().includes(q)).slice(0,10):[];
    if(!matches.length) return;
    box=document.createElement('div');
    box.className='ac-box';
    box.style.cssText=`position:absolute;z-index:9999;background:#fff;border:1.5px solid #1a56db;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.12);min-width:${inputEl.offsetWidth}px;max-height:220px;overflow-y:auto;`;
    const rect=inputEl.getBoundingClientRect();
    box.style.left=rect.left+'px'; box.style.top=(rect.bottom+window.scrollY+2)+'px';
    box.style.width=rect.width+'px';
    matches.forEach((m,mi)=>{
      const d=document.createElement('div');
      d.style.cssText='padding:9px 13px;cursor:pointer;font-size:13px;font-weight:500;border-bottom:1px solid #f3f4f6;';
      d.dataset.idx=mi;
      // highlight match
      const idx=m.toLowerCase().indexOf(q), pre=m.slice(0,idx), mid=m.slice(idx,idx+q.length), post=m.slice(idx+q.length);
      d.innerHTML=`${pre}<strong style="color:#1a56db">${mid}</strong>${post}`;
      d.addEventListener('mousedown',e=>{e.preventDefault();inputEl.value=m;if(onSelect)onSelect(m);removeBox();});
      d.addEventListener('mouseover',()=>{ clearHighlight(); setActive(mi); });
      d.addEventListener('mouseout',()=>{ if(activeIndex===mi) clearHighlight(); });
      box.appendChild(d);
    });
    document.body.appendChild(box);
  });
  inputEl.addEventListener('blur',()=>setTimeout(removeBox,150));
  inputEl.addEventListener('keydown',function(e){
    if(!box){
      if(e.key==='Enter'&&onEnter){ e.preventDefault(); onEnter(this.value); }
      return;
    }
    const count=box.querySelectorAll('div').length;
    if(e.key==='ArrowDown'){ e.preventDefault(); if(count){ if(activeIndex<count-1) setActive(activeIndex+1); else setActive(0); } }
    else if(e.key==='ArrowUp'){ e.preventDefault(); if(count){ if(activeIndex>0) setActive(activeIndex-1); else setActive(count-1); } }
    else if(e.key==='Enter'&&activeIndex>=0){ e.preventDefault(); const el=box.querySelector('[data-idx="'+activeIndex+'"]'); const val=el?el.textContent:''; this.value=val; if(onSelect)onSelect(val); removeBox(); }
    else if(e.key==='Escape'){ e.preventDefault(); removeBox(); }
    else if(e.key==='Enter'){ e.preventDefault(); if(onEnter)onEnter(this.value); removeBox(); }
  });
}

