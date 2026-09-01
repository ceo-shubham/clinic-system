/**
 * DR. RAMGOPAL AGARWAL DIAGNOSTIC CLINIC
 * server.js — MongoDB + Backblaze B2 backend
 */
'use strict';

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { MongoClient, ServerApiVersion } = require('mongodb');

// ── Load .env (KEY=VALUE lines) so `node server.js` works without external env vars ──
// Used instead of the dotenv package to keep this project dependency-free.
(function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (e) {
    console.error('[env] Could not load .env:', e.message);
  }
})();

const PORT       = process.env.PORT || 3000;
const ROOT       = __dirname;
const MONGO_URI  = process.env.MONGO_URI;
const B2_KEY_ID  = process.env.B2_KEY_ID;
const B2_APP_KEY = process.env.B2_APP_KEY;
const B2_BUCKET  = process.env.B2_BUCKET_NAME;
const SITE_PASS  = process.env.SITE_PASSWORD || '89238350030';

// ── DNS ──────────────────────────────────────────────────────
// Many home/office networks (and some ISPs) refuse SRV queries, which breaks
// mongodb+srv:// connection strings. Pin reliable public resolvers for the
// MongoDB driver (c-ares based). Override via DNS_SERVERS env (comma-separated).
// This only affects dns.resolve* (the driver); fetch()/https still use the OS resolver.
const dns = require('dns');
try {
  const dnsServers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map(s => s.trim()).filter(Boolean);
  if (dnsServers.length) {
    dns.setServers(dnsServers);
    console.log('[dns] MongoDB resolvers:', dnsServers.join(', '));
  }
} catch (e) {
  console.error('[dns] Could not set resolvers (using system DNS):', e.message);
}

// ── MongoDB ──────────────────────────────────────────────────
let db = null;
const mongoClient = new MongoClient(MONGO_URI, { serverApi: ServerApiVersion.v1, serverSelectionTimeoutMS: 20000 });

// Default config seeded on first boot if MongoDB has no config
const DEFAULT_CONFIG = {
  _id: 'main',
  settings: {
    doctorPin: '5678',
    clinicName: 'Dr. RAMGOPAL AGARWAL DIAGNOSTIC CLINIC',
    currency: 'Rs.'
  },
  managers: [
    { id:'RA-M001', name:'Shahrukh Khan',  pin:'1111', active:true, perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
    { id:'RA-M002', name:'Santosh Kumar',  pin:'2222', active:true, perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
    { id:'RA-M003', name:'Ram Mahesh',     pin:'3333', active:true, perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
    { id:'RA-M004', name:'Rani',           pin:'4444', active:true, perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
    { id:'RA-M005', name:'Zhera Khan',     pin:'5555', active:true, perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
    { id:'RA-M006', name:'Kashish',        pin:'6666', active:true, perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} },
    { id:'RA-M007', name:'Bilal Khan',     pin:'7777', active:true, perms:{addPatient:true,markPaid:true,printBill:true,editPatient:false,deletePatient:false,exportCSV:false,viewHistory:false,dayEnd:false} }
  ],
  updatedAt: new Date().toISOString()
};

let connectPromise = null;
async function ensureDB() {
  if (db) return db;
  if (!connectPromise) {
    connectPromise = (async () => {
      await mongoClient.connect();
      db = mongoClient.db('clinic');
      const existing = await db.collection('config').findOne({_id:'main'});
      if (!existing) {
        await db.collection('config').insertOne(DEFAULT_CONFIG);
        console.log('[mongodb] Default config seeded — doctor PIN: 5678, managers: 7');
      } else if (existing.catalog && (Array.isArray(existing.catalog.categories) || Array.isArray(existing.catalog.referrals))) {
        if (Array.isArray(existing.catalog.categories)) runtimeCatalog.services = filterExtraServices(existing.catalog.categories);
        if (Array.isArray(existing.catalog.referrals)) runtimeCatalog.referrals = existing.catalog.referrals;
        if (Array.isArray(existing.catalog.medicines)) runtimeCatalog.medicines = existing.catalog.medicines;
        runtimeCatalog.updatedAt = existing.catalog.updatedAt || new Date().toISOString();
        catalogLoadedFromDb = true;
      }
      return db;
    })().catch(err => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

async function connectDB() {
  for (let attempt = 1; ; attempt++) {
    try {
      await ensureDB();
      console.log('[mongodb] Connected.');
      scheduleMidnightBackup();
      startLiveSummaryPush();
      pushFullSnapshotToB2(); // baseline full snapshot on boot
      return;
    } catch (err) {
      console.error(`[mongodb] Connection failed (attempt ${attempt}): ${err.message}. Retrying in 10s...`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

// ── MongoDB cleanup — keep only last 90 days in patients, 30 days in activity ──
// Runs after midnight backup completes so data is safe in B2 before deletion.
async function trimMongoDB() {
  try {
    // Build date keys for cutoff — patients older than 90 days
    const patientCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const oldPatients   = await col('patients').find({
      createdAt: { $lt: patientCutoff.toISOString() }
    }, { projection: { visitUid:1, date:1 } }).toArray();

    if (oldPatients.length) {
      const ids = oldPatients.map(p => p.visitUid).filter(Boolean);
      const result = await col('patients').deleteMany({ visitUid: { $in: ids } });
      console.log(`[mongodb-trim] Removed ${result.deletedCount} old patient records (>90 days) from MongoDB`);
    }

    // Activity logs older than 30 days
    const actCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const actResult = await col('activity').deleteMany({
      _ts: { $lt: actCutoff }
    });
    if (actResult.deletedCount > 0) {
      console.log(`[mongodb-trim] Removed ${actResult.deletedCount} old activity entries (>30 days)`);
    }

    // Telegram sentUids — trim entries older than 90 days to prevent doc growing forever
    const telegramDoc = await col('telegram').findOne({_id:'notifications'});
    if (telegramDoc && telegramDoc.sentUids) {
      const cutoffIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const cleaned = {};
      for (const [uid, ts] of Object.entries(telegramDoc.sentUids)) {
        if (ts > cutoffIso) cleaned[uid] = ts;
      }
      const before = Object.keys(telegramDoc.sentUids).length;
      const after  = Object.keys(cleaned).length;
      if (before !== after) {
        await col('telegram').replaceOne({_id:'notifications'}, {_id:'notifications', sentUids:cleaned}, {upsert:true});
        console.log(`[mongodb-trim] Telegram sentUids: ${before} → ${after}`);
      }
    }

    console.log('[mongodb-trim] ✅ MongoDB cleanup complete');
  } catch(e) {
    console.error('[mongodb-trim] ❌ Cleanup error:', e.message);
  }
}

function col(name) { return db.collection(name); }

// Collections:
//   patients    — all visit records (upsert by visitUid)
//   activity    — manager activity log entries
//   config      — single doc { _id:'main', settings, managers }
//   telegram    — { _id:'notifications', sentUids:{} }
//   handovers   — cash handover records { mgrId, mgrName, amount, dateKey, time, ts, note }

// ── Backblaze B2 ─────────────────────────────────────────────
// B2_BUCKET holds the bucket NAME (from .env). The upload API needs the
// bucket ID, so after auth we resolve name → ID once and cache it.
let b2Auth = null;
let b2BucketId = null;

async function b2Authorize() {
  const creds = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${creds}` }
  });
  b2Auth = await res.json();
  // Resolve bucket name → ID (required by b2_get_upload_url / b2_upload_file)
  if (b2Auth.apiUrl && B2_BUCKET) {
    try {
      const listRes = await fetch(`${b2Auth.apiUrl}/b2api/v2/b2_list_buckets`, {
        method: 'POST',
        headers: { Authorization: b2Auth.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: b2Auth.accountId })
      });
      const listData = await listRes.json();
      const bucket = (listData.buckets || []).find(b => b.bucketName === B2_BUCKET);
      b2BucketId = bucket ? bucket.bucketId : null;
      if (!b2BucketId) console.error('[b2] Bucket not found:', B2_BUCKET);
      else console.log('[b2] Bucket resolved:', B2_BUCKET, '→', b2BucketId);
    } catch (e) {
      console.error('[b2] Could not resolve bucket:', e.message);
      b2BucketId = null;
    }
  }
  return b2Auth;
}

// Returns true on success, false on failure — so callers can log honest results
// instead of claiming "pushed to B2" when nothing actually reached Backblaze.
// Retries up to 3 times with backoff — a transient B2/network blip must never
// permanently lose a backup (that data exists only in MongoDB until it reaches B2).
async function b2Upload(fileName, content, mimeType = 'text/csv') {
  if (!B2_KEY_ID || !B2_APP_KEY || !B2_BUCKET) {
    console.error('[b2] Not configured — skipping', fileName);
    return false;
  }
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (!b2Auth) await b2Authorize();
      if (!b2BucketId && b2Auth) await b2Authorize(); // ensure bucket ID is resolved
      if (!b2BucketId) { console.error('[b2] Cannot upload — bucket ID unknown for', B2_BUCKET); return false; }
      // Get upload URL
      const urlRes = await fetch(`${b2Auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: { Authorization: b2Auth.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: b2BucketId })
      });
      const urlData = await urlRes.json();
      if (!urlData.uploadUrl) {
        b2Auth = null; // token likely expired — re-auth next time
        console.error(`[b2] get_upload_url failed for ${fileName}:`, urlData.code || urlData.message || urlRes.status);
        if (attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, attempt * 2000)); continue; }
        return false;
      }
      const buf = Buffer.from(content, 'utf8');
      const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
      const upRes = await fetch(urlData.uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: urlData.authorizationToken,
          'X-Bz-File-Name': encodeURIComponent(fileName),
          'Content-Type': mimeType,
          'Content-Length': buf.length,
          'X-Bz-Content-Sha1': sha1
        },
        body: buf
      });
      if (!upRes.ok) {
        const errBody = await upRes.text().catch(() => '');
        b2Auth = null;
        console.error(`[b2] Upload FAILED (HTTP ${upRes.status}) for ${fileName}:`, errBody.slice(0, 200));
        if (attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, attempt * 2000)); continue; }
        return false;
      }
      console.log(`[b2] Uploaded: ${fileName}`);
      return true;
    } catch (e) {
      b2Auth = null; // force re-auth on next call
      console.error(`[b2] Upload failed (attempt ${attempt}/${MAX_ATTEMPTS}):`, e.message);
      if (attempt < MAX_ATTEMPTS) { await new Promise(r => setTimeout(r, attempt * 2000)); continue; }
      return false;
    }
  }
  return false;
}

// ── TOTP / Auth helpers ──────────────────────────────────────
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const byte of bytes) { value=(value<<8)|byte; bits+=8; while(bits>=5){out+=BASE32[(value>>>(bits-5))&31];bits-=5;} }
  return bits ? out+BASE32[(value<<(5-bits))&31] : out;
}
function base32Decode(value) {
  let bits=0,buffer=0,bytes=[];
  for(const char of String(value||'').toUpperCase().replace(/[\s=]/g,'')){ const n=BASE32.indexOf(char); if(n<0)return null; buffer=(buffer<<5)|n; bits+=5; if(bits>=8){bytes.push((buffer>>>(bits-8))&255);bits-=8;} }
  return Buffer.from(bytes);
}
function totpFor(secret,counter){ const key=base32Decode(secret); if(!key||!key.length)return''; const msg=Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter)); const hmac=crypto.createHmac('sha1',key).update(msg).digest(); const offset=hmac[hmac.length-1]&15; return String(((hmac.readUInt32BE(offset)&0x7fffffff)%1000000)).padStart(6,'0'); }
function validTotp(secret,code){ if(!/^\d{6}$/.test(String(code||'')))return false; const counter=Math.floor(Date.now()/30000); return[-1,0,1].some(offset=>{const expected=totpFor(secret,counter+offset);return expected&&crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(code)));});}
function sameSecret(a,b){ const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||'')); return x.length===y.length&&crypto.timingSafeEqual(x,y); }

const AUTH_SECRET = crypto.createHash('sha256').update(SITE_PASS + '_DOCTOR_AUTH_KEY_2026').digest();

function createDoctorSession(extra = {}) {
  const payload = {
    role: 'doctor',
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
    ...extra
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyDoctorSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'doctor') return null;
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function doctorSession(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = verifyDoctorSessionToken(token);
  if (!session) return null;
  return { token, session };
}

function doctorAuthorized(req, res) {
  const auth = doctorSession(req);
  if (auth) return auth;
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Doctor sign-in required' }));
  return null;
}

// ── Site-access password gate ────────────────────────────────
// API calls from app.js send X-Site-Pass header
function sitePassValid(req) {
  const header = req.headers['x-site-pass'] || '';
  const query  = (req.query && req.query.sp) || '';
  return sameSecret(header || query, SITE_PASS);
}

// ── Site gate — localStorage + URL token approach ────────────
// Eliminates all cookie/Secure flag/SameSite issues.
// Flow: gate page → password → /api/site-auth returns token →
//       browser stores in localStorage → every page load checks localStorage →
//       if valid, all good; if not, gate page shown.
// The token is also passed as ?_t= query param on redirect so server can verify first load.

const GATE_TOKEN = crypto.createHash('sha256').update(SITE_PASS).digest('hex').slice(0, 32);

// Gate page HTML — uses localStorage for persistence
const GATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Dr. RAMGOPAL AGARWAL — Access</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:linear-gradient(135deg,#eff6ff,#f9fafb);font-family:'Segoe UI',Arial,sans-serif;}
  .box{background:#fff;border:1.5px solid #e5e7eb;border-radius:18px;padding:36px 32px;
       width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.08);}
  img{width:60px;display:block;margin:0 auto 10px;border-radius:10px;}
  h2{text-align:center;font-size:20px;font-weight:800;color:#1a56db;margin-bottom:4px;}
  p{text-align:center;font-size:12px;color:#6b7280;margin-bottom:24px;}
  input{width:100%;padding:11px 14px;border:1.5px solid #d1d5db;border-radius:10px;
        font-size:18px;letter-spacing:6px;text-align:center;outline:none;margin-bottom:14px;}
  input:focus{border-color:#1a56db;box-shadow:0 0 0 3px rgba(26,86,219,.1);}
  button{width:100%;padding:12px;background:#1a56db;color:#fff;border:none;
         border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;}
  button:hover{background:#1e40af;}
  .err{color:#dc2626;font-size:13px;text-align:center;margin-top:10px;display:none;}
  .spin{display:none;text-align:center;margin-top:10px;color:#6b7280;font-size:13px;}
</style>
</head>
<body>
<div class="box">
  <img src="/logo.png" onerror="this.style.display='none'" alt=""/>
  <h2>Dr. RAMGOPAL AGARWAL</h2>
  <p>Diagnostic Clinic — Management System</p>
  <input type="password" id="pw" placeholder="••••••••••" autocomplete="current-password" autofocus
         onkeydown="if(event.key==='Enter')submit()"/>
  <button type="button" onclick="submit()" id="btn">Enter →</button>
  <div class="err" id="err">Wrong password. Try again.</div>
  <div class="spin" id="spin">Opening…</div>
</div>
<script>
// Check localStorage first — if already authenticated, redirect
(function(){
  const saved = localStorage.getItem('clinic_gate');
  if(saved) {
    // Verify with server silently
    fetch('/api/site-auth-check?t=' + encodeURIComponent(saved))
      .then(r=>r.json()).then(d=>{ if(d.ok) window.location.replace(window.location.pathname||'/'); })
      .catch(()=>{});
  }
})();

async function submit(){
  const pw = document.getElementById('pw').value.trim();
  if(!pw) return;
  document.getElementById('btn').disabled = true;
  document.getElementById('spin').style.display = 'block';
  document.getElementById('err').style.display = 'none';
  try {
    const r = await fetch('/api/site-auth', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({password: pw})
    });
    const data = await r.json();
    if(r.ok && data.token) {
      localStorage.setItem('clinic_gate', data.token);
      document.getElementById('spin').textContent = 'Opening…';
      window.location.replace(window.location.pathname || '/');
    } else {
      document.getElementById('err').style.display = 'block';
      document.getElementById('pw').value = '';
      document.getElementById('pw').focus();
      document.getElementById('btn').disabled = false;
      document.getElementById('spin').style.display = 'none';
    }
  } catch(e) {
    document.getElementById('err').textContent = 'Network error. Try again.';
    document.getElementById('err').style.display = 'block';
    document.getElementById('btn').disabled = false;
    document.getElementById('spin').style.display = 'none';
  }
}
</script>
</body>
</html>`;

function handleSiteAuth(req, res) {
  jsonBody(req).then(body => {
    const pw = String(body && body.password || '');
    if (!sameSecret(pw, SITE_PASS)) {
      res.writeHead(401, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:false, error:'Wrong password'}));
      return;
    }
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true, token: GATE_TOKEN}));
  }).catch(() => { res.writeHead(400); res.end('Bad request'); });
}

// GET /api/site-auth-check?t=TOKEN — silent check from gate page auto-redirect
function handleSiteAuthCheck(req, res) {
  const t = req.query.t || '';
  res.writeHead(200, {'Content-Type':'application/json'});
  res.end(JSON.stringify({ok: t === GATE_TOKEN}));
}

// Gate check — HTML pages served freely, only API routes blocked without X-Site-Pass.
// The gate UI is handled client-side via gate script embedded in each HTML page.
function requireSiteAccess(req, res) {
  // API routes — require X-Site-Pass header
  if (req.pathname.startsWith('/api/')) {
    const openApi = ['/api/status', '/api/doctor/login', '/api/site-auth', '/api/site-auth-check'];
    if (!openApi.includes(req.pathname) && !sitePassValid(req)) {
      res.writeHead(401, {'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:false, error:'Site access denied'}));
      return false;
    }
  }
  return true; // all HTML/static files served freely
}

// ── JSON body helper ─────────────────────────────────────────
function jsonBody(req) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === 'string') {
    try { return Promise.resolve(JSON.parse(req.body)); } catch(e) { return Promise.reject(e); }
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ── CSV builders ─────────────────────────────────────────────
function buildPatientCSV(patients) {
  const headers=['Patient No','Patient ID','Name','Age','Gender','Father Name','Husband Name','Referred By','Mobile','Address','Service / Test','Medicine','Details','Amount Charged (Rs.)','Amount Paid (Rs.)','Amount Paid Cash (Rs.)','Amount Paid Online (Rs.)','Payment Status','Payment Method','Status','Notes','Time','Date','Attended By (Manager)','Manager ID'];
  const rows=patients.map(p=>[p.patientNo,p.uid,'"'+(p.name||'').replace(/"/g,'""')+'"',p.age,p.gender||'','"'+(p.fatherName||'').replace(/"/g,'""')+'"','"'+(p.husbandName||'').replace(/"/g,'""')+'"','"'+(p.referredBy||'').replace(/"/g,'""')+'"',p.mobile||'','"'+(p.address||'').replace(/"/g,'""')+'"','"'+(p.xrayPart||'').replace(/"/g,'""')+'"','"'+(p.medsPart||'').replace(/"/g,'""')+'"','"'+(p.xrayViews||'').replace(/"/g,'""')+'"',p.amountAsked||0,p.amountPaid||0,Number(p.amountPaidCash)||0,Number(p.amountPaidOnline)||0,p.paymentStatus||'',p.paymentMethod||'',p.status||'','"'+(p.notes||'').replace(/"/g,'""')+'"',p.time||'',p.date||'','"'+(p.attendedByName||'').replace(/"/g,'""')+'"',p.attendedById||'']);
  return[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
}
function buildActivityCSV(logs) {
  const headers=['Manager','Action','Patient Name','Patient ID','Amount','Detail','Time','Date'];
  const rows=logs.map(e=>['"'+(e.mgrName||'').replace(/"/g,'""')+'"','"'+(e.action||'').replace(/"/g,'""')+'"','"'+(e.patientName||'').replace(/"/g,'""')+'"',e.patientUid||'',e.amount||0,'"'+(e.detail||'').replace(/"/g,'""')+'"',e.time||'',e.dateKey||'']);
  return[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
}
function buildHandoversCSV(handovers) {
  const hHeaders=['Manager','Amount (Rs.)','Date','Time','Note'];
  const hRows=handovers.map(h=>['"'+(h.mgrName||'').replace(/"/g,'""')+'"',h.amount||0,h.dateKey||'',h.time||'','"'+(h.note||'').replace(/"/g,'""')+'"']);
  return[hHeaders.join(','),...hRows.map(r=>r.join(','))].join('\n');
}
function buildDailyReportCSV(report) {
  const lines=['DAILY REPORT — '+report.dateFormatted,'','SUMMARY','Date,'+report.dateKey,'Total Patients,'+report.totalPatients,'Completed,'+report.done,'Pending,'+report.pending,'Cancelled,'+report.cancelled,'Total Charged (Rs.),'+report.totalCharged,'Total Paid (Rs.),'+report.totalPaid,'Paid Cash (Rs.),'+(report.totalCashPaid||0),'Paid Online (Rs.),'+(report.totalOnlinePaid||0),'Total Due (Rs.),'+report.totalDue,'Total Handed Over (Rs.),'+(report.totalHandedOver||0),'Still Holding (Rs.),'+(report.stillHolding||0),'Fully Paid Patients,'+report.paidCount,'Partial Payment,'+report.partialCount,'Unpaid Patients,'+report.unpaidCount,'','MANAGER SUMMARY','Manager Name,Patients Added,Marked Paid,Edits,Bills Printed,Deletions,Total Actions'];
  (report.managerSummary||[]).forEach(ms=>lines.push(['"'+ms.name+'"',ms.added,ms.paid,ms.edits,ms.prints,ms.dels,ms.total].join(',')));
  lines.push('','SERVICE BREAKDOWN','Service,Count,Amount Charged (Rs.),Amount Paid (Rs.)');
  (report.services||[]).forEach(sv=>lines.push(['"'+sv.name+'"',sv.count,sv.charged,sv.paid].join(',')));
  return lines.join('\n');
}

function recordKey(p){ return p&&(p.visitUid||p.uid); }

// ── API: Config ───────────────────────────────────────────────
async function readConfig(){ try{ return await col('config').findOne({_id:'main'})||null; }catch(e){return null;} }
async function writeConfig(config){ await col('config').replaceOne({_id:'main'},{_id:'main',...config},{upsert:true}); }

async function handleGetConfig(req,res){
  const config=await readConfig();
  const pub=config?JSON.parse(JSON.stringify(config)):null;
  if(pub&&pub.settings){delete pub.settings.doctorTotpSecret;delete pub.settings.doctorTelegramBotToken;delete pub.settings.doctorTelegramChatId;}
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({config:pub}));
}
async function handleSaveConfig(req,res){
  try{
    const{config,initialOnly}=await jsonBody(req);
    if(!config||!config.settings||!Array.isArray(config.managers)){res.writeHead(400);res.end('Invalid configuration');return;}
    const existing=await readConfig();
    if(!initialOnly||!existing){
      const settings={...config.settings};
      if(existing&&existing.settings&&existing.settings.doctorTotpSecret)settings.doctorTotpSecret=existing.settings.doctorTotpSecret;
      if(existing&&existing.settings&&existing.settings.doctorTelegramBotToken){settings.doctorTelegramBotToken=existing.settings.doctorTelegramBotToken;settings.doctorTelegramChatId=existing.settings.doctorTelegramChatId;}
      await writeConfig({settings,managers:config.managers,updatedAt:new Date().toISOString()});
    }
    pushFullSnapshotToB2(); // settings/managers changed — keep B2 snapshot fresh
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true,config:await readConfig()}));
  }catch(e){console.error('[config save]',e.message);res.writeHead(500);res.end(e.message);}
}

async function handleGetPatients(req,res){
  // Support ?date=DD-MM-YYYY for specific date, or ?all=1 for all patients
  const dateParam = req.query.date || '';
  const allParam  = req.query.all  || '';
  let patients;
  if (allParam) {
    patients = await col('patients').find({}).toArray();
  } else {
    const today = new Date();
    const dd=String(today.getDate()).padStart(2,'0'), mm=String(today.getMonth()+1).padStart(2,'0'), yyyy=today.getFullYear();
    const dateKey = dateParam || `${dd}-${mm}-${yyyy}`;
    patients = await col('patients').find({date:dateKey}).toArray();
  }
  // Tombstones — deleted patient keys. These are filtered out of every
  // response and physically removed from the store, so a stale copy on any
  // other device can never resurrect a deleted patient.
  const del = await col('deleted').findOne({_id:'main'});
  const deletedUids = (del && Array.isArray(del.uids)) ? del.uids : [];
  const delSet = new Set(deletedUids);
  if (delSet.size) {
    const filtered = patients.filter(p => !delSet.has(recordKey(p)));
    if (filtered.length !== patients.length) {
      await col('patients').deleteMany({ $or: [...deletedUids.map(u => ({ visitUid: u })), ...deletedUids.map(u => ({ uid: u }))] });
      patients = filtered;
    }
  }
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({patients, deletedUids}));
}

async function handleSavePatient(req,res){
  try{
    const{patient,registration}=await jsonBody(req);
    if(!patient||!patient.date){res.writeHead(400);res.end('Missing patient');return;}
    const key=recordKey(patient);
    // Tombstone guard — a deleted patient must never be re-saved by a stale
    // copy on another device. Delete any stored record and report ok.
    const delDoc = await col('deleted').findOne({_id:'main'});
    if (delDoc && Array.isArray(delDoc.uids) && delDoc.uids.includes(key)) {
      await col('patients').deleteMany({ $or:[{visitUid:key},{uid:key}] });
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({ok:true,tombstoned:true}));
      return;
    }
    // Only overwrite if incoming record is newer than what's stored
    const existing = await col('patients').findOne({visitUid:key});
    if (existing) {
      const existingTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const incomingTs = new Date(patient.updatedAt  || patient.createdAt  || 0).getTime();
      if (incomingTs <= existingTs) {
        // Server already has a newer or equal record — don't overwrite
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true,skipped:true}));
        return;
      }
    }
    await col('patients').replaceOne({visitUid:key},{...patient,visitUid:key},{upsert:true});
    // Telegram notification — only for a fresh registration by a manager.
    // The sentUid is recorded ONLY AFTER the message actually goes out (see
    // notifyDoctorOfNewPatient), so a transient Telegram/network failure retries
    // on the next sync of this patient instead of being silently lost forever.
    const shouldNotify=registration===true&&patient.attendedById&&patient.attendedById!=='doctor'&&(patient.uid||patient.visitUid);
    if(shouldNotify){
      const telegramDoc=await col('telegram').findOne({_id:'notifications'})||{_id:'notifications',sentUids:{}};
      if(!telegramDoc.sentUids[patient.uid||patient.visitUid]){
        notifyDoctorOfNewPatient(patient); // async — never blocks the save
      }
    }
    // Immediately push to B2 after saving to MongoDB
    scheduleInstantBackup(patient.date);
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){console.error('[save-patient]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── Instant B2 backup — fires 10s after last save (debounced per dateKey) ──
// Every patient add/edit → patients CSV + monthly CSV → B2 within 10 seconds
const pendingBackups = new Map(); // dateKey → timeoutId
function scheduleInstantBackup(dateKey) {
  // Cancel previous pending timer for this date and restart — debounce
  if (pendingBackups.has(dateKey)) clearTimeout(pendingBackups.get(dateKey));
  const tid = setTimeout(async () => {
    pendingBackups.delete(dateKey);
    await pushDateToB2(dateKey);
  }, 10000); // 10s debounce — batches rapid saves
  pendingBackups.set(dateKey, tid);
}

// Core B2 push for a single date — patients CSV + monthly CSV + daily report
async function pushDateToB2(dateKey) {
  try {
    const patients = await col('patients').find({date:dateKey}).toArray();
    if (!patients.length) return;
    let failed = 0;

    // 1. Patients CSV
    if (!await b2Upload(`patient/${dateKey}/patients_${dateKey}.csv`, '\uFEFF'+buildPatientCSV(patients))) failed++;

    // 2. Monthly combined CSV
    const [d,m,y] = dateKey.split('-');
    const monthKey = `${y}-${m}`;
    const monthPatients = await col('patients').find({date:{$regex:`^\\d{2}-${m}-${y}$`}}).toArray();
    if (monthPatients.length && !await b2Upload(`monthly/patients_${monthKey}.csv`, '\uFEFF'+buildPatientCSV(monthPatients))) failed++;

    // 3. Live daily report
    failed += await pushDailyReportToB2(dateKey, patients);

    if (failed) console.error(`[instant-backup] ⚠️ ${dateKey} — ${patients.length} patients, but ${failed} B2 upload(s) FAILED`);
    else console.log(`[instant-backup] ✅ ${dateKey} — ${patients.length} patients pushed to B2`);
  } catch(e) {
    console.error(`[instant-backup] ❌ ${dateKey}:`, e.message);
  }
}

// Build and push daily report + activity CSVs for a date
// Returns the number of failed uploads.
async function pushDailyReportToB2(dateKey, patients) {
  let failed = 0;
  try {
    const activityLogs = await col('activity').find({dateKey}).toArray();
    const handovers    = await col('handovers').find({dateKey}).toArray();

    // Activity CSV per manager
    const byMgr = {};
    activityLogs.forEach(e => {
      const n = (e.mgrName||'unknown').replace(/[^a-zA-Z0-9 \-_.]/g,'_').trim()||'unknown';
      if (!byMgr[n]) byMgr[n] = [];
      byMgr[n].push(e);
    });
    for (const [mgrName, logs] of Object.entries(byMgr)) {
      if (!await b2Upload(`managers/${mgrName}/activity_${dateKey}.csv`, '\uFEFF'+buildActivityCSV(logs))) failed++;
    }

    // Handover CSV
    if (handovers.length) {
      if (!await b2Upload(`data/handovers/handovers_${dateKey}.csv`, '\uFEFF'+buildHandoversCSV(handovers))) failed++;
    }

    // Daily report — include handover summary
    const totalCharged = patients.reduce((s,p)=>s+(parseFloat(p.amountAsked)||0),0);
    const totalPaid    = patients.reduce((s,p)=>s+(parseFloat(p.amountPaid)||0),0);
    const totalHandedOver = handovers.reduce((s,h)=>s+(parseFloat(h.amount)||0),0);
    const actSummary   = {};
    activityLogs.forEach(e => {
      if (!actSummary[e.mgrName]) actSummary[e.mgrName] = {name:e.mgrName,added:0,paid:0,edits:0,prints:0,dels:0,total:0};
      const m = actSummary[e.mgrName]; m.total++;
      if (e.action==='Added Patient')   m.added++;
      if (e.action==='Marked as Paid')  m.paid++;
      if (e.action==='Edited Patient')  m.edits++;
      if (e.action==='Printed Bill')    m.prints++;
      if (e.action==='Deleted Patient') m.dels++;
    });
    const svcMap = {};
    patients.forEach(p => {
      const s = p.xrayPart||'Unknown';
      if (!svcMap[s]) svcMap[s]={name:s,count:0,charged:0,paid:0};
      svcMap[s].count++; svcMap[s].charged+=parseFloat(p.amountAsked)||0; svcMap[s].paid+=parseFloat(p.amountPaid)||0;
    });
    const [dd,mm,yyyy] = dateKey.split('-');
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const report = {
      dateKey, dateFormatted:`${parseInt(dd)} ${months[parseInt(mm)-1]} ${yyyy}`,
      totalPatients:patients.length,
      done:patients.filter(p=>p.status==='Done').length,
      pending:patients.filter(p=>p.status==='Pending').length,
      cancelled:patients.filter(p=>p.status==='Cancelled').length,
      totalCharged, totalPaid, totalDue:Math.max(0,totalCharged-totalPaid),
      totalHandedOver, stillHolding:Math.max(0,totalPaid-totalHandedOver),
      paidCount:patients.filter(p=>p.paymentStatus==='Paid').length,
      partialCount:patients.filter(p=>p.paymentStatus==='Partial').length,
      unpaidCount:patients.filter(p=>p.paymentStatus==='Unpaid').length,
      managerSummary:Object.values(actSummary).filter(m=>m.total>0),
      services:Object.values(svcMap).sort((a,b)=>b.count-a.count)
    };
    if (!await b2Upload(`data/daily/daily-report_${dateKey}.csv`, '\uFEFF'+buildDailyReportCSV(report))) failed++;
    return failed;
  } catch(e) {
    console.error(`[report-backup] ❌ ${dateKey}:`, e.message);
    return failed + 1;
  }
}

// ── Full snapshot → B2 ────────────────────────────────────────
// JSON dump of EVERYTHING (patients, activity, handovers, config/catalog,
// tombstones, telegram state). Pushed nightly after the midnight backups and
// whenever settings/catalog change. This is the "single source of truth" copy —
// if MongoDB were ever wiped or corrupted, this one file restores the whole system.
async function pushFullSnapshotToB2() {
  try {
    const [patients, activity, handovers, config, deleted, telegram] = await Promise.all([
      col('patients').find({}).toArray(),
      col('activity').find({}).toArray(),
      col('handovers').find({}).toArray(),
      readConfig(),
      col('deleted').findOne({_id:'main'}),
      col('telegram').findOne({_id:'notifications'})
    ]);
    const snapshot = {
      _exportedAt: new Date().toISOString(),
      counts: {
        patients: patients.length,
        activity: activity.length,
        handovers: handovers.length,
        deleted: deleted && Array.isArray(deleted.uids) ? deleted.uids.length : 0,
        telegram: telegram && telegram.sentUids ? Object.keys(telegram.sentUids).length : 0
      },
      patients, activity, handovers,
      config,
      deleted: deleted || { _id:'main', uids: [] },
      telegram: telegram || { _id:'notifications', sentUids: {} }
    };
    const name = `full-snapshots/clinic-full-${istDateKey(0)}.json`;
    const ok = await b2Upload(name, JSON.stringify(snapshot), 'application/json');
    console.log(ok
      ? `[snapshot] ✅ Full snapshot → B2 (${name}) — ${snapshot.counts.patients} patients, ${snapshot.counts.activity} activity, ${snapshot.counts.handovers} handovers`
      : `[snapshot] ❌ B2 upload failed for ${name}`);
    return ok;
  } catch (e) {
    console.error('[snapshot] ❌ Failed:', e.message);
    return false;
  }
}

// ── 1-minute live summary push ────────────────────────────────
// Every 60 seconds: push daily report + activity for today to B2
// Ensures manager/doctor summaries are always fresh in B2
function startLiveSummaryPush() {
  setInterval(async () => {
    const now = new Date();
    const dateKey = String(now.getDate()).padStart(2,'0')+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+now.getFullYear();
    try {
      const count = await col('patients').countDocuments({date:dateKey});
      if (count > 0) {
        const patients = await col('patients').find({date:dateKey}).toArray();
        const failed = await pushDailyReportToB2(dateKey, patients);
        if (failed) console.error(`[live-summary] ⚠️ ${dateKey} — ${failed} upload(s) FAILED`);
        else console.log(`[live-summary] ✅ ${dateKey} summary pushed (${count} patients)`);
      }
    } catch(e) {
      console.error('[live-summary] ❌', e.message);
    }
  }, 60 * 1000); // every 60 seconds
  console.log('[live-summary] Started — pushing to B2 every 60 seconds');
}

// ── Midnight auto-backup (server-side, no browser needed) ────
// Runs at 00:05 IST every night — backs up yesterday's patients,
// activity log, daily report, and monthly CSV to B2 automatically.
// Also re-syncs last 7 days to catch any missed saves.
function getDateKey(date) {
  const d = date || new Date();
  return String(d.getDate()).padStart(2,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+d.getFullYear();
}

// IST date key (offsetDays back) — snapshot filenames stay consistent with the
// clinic's local calendar day (the midnight backup runs at 00:05 IST).
function istDateKey(offsetDays = 0) {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - offsetDays);
  return String(ist.getUTCDate()).padStart(2,'0') + '-' +
         String(ist.getUTCMonth()+1).padStart(2,'0') + '-' +
         ist.getUTCFullYear();
}

async function runFullDayBackup(dateKey) {
  console.log(`[midnight-backup] Starting full backup for ${dateKey}`);
  let failed = 0;
  try {
    // 1. Patients CSV
    const patients = await col('patients').find({date:dateKey}).toArray();
    if (patients.length) {
      if (!await b2Upload(`patient/${dateKey}/patients_${dateKey}.csv`, '\uFEFF'+buildPatientCSV(patients))) failed++;
      else console.log(`[midnight-backup] Patients: ${patients.length} records → B2`);
    } else {
      console.log(`[midnight-backup] No patients for ${dateKey}, skipping patient CSV`);
    }

    // 2. Activity CSV per manager
    const activityLogs = await col('activity').find({dateKey}).toArray();
    if (activityLogs.length) {
      const byMgr = {};
      activityLogs.forEach(e => {
        const n = (e.mgrName||'unknown').replace(/[^a-zA-Z0-9 \-_.]/g,'_').trim()||'unknown';
        if (!byMgr[n]) byMgr[n] = [];
        byMgr[n].push(e);
      });
      for (const [mgrName, logs] of Object.entries(byMgr)) {
        if (!await b2Upload(`managers/${mgrName}/activity_${dateKey}.csv`, '\uFEFF'+buildActivityCSV(logs))) failed++;
      }
      if (failed === 0) console.log(`[midnight-backup] Activity: ${activityLogs.length} entries → B2`);
    }

    // 2.5 Handovers CSV — cash handover records for the day
    const handovers = await col('handovers').find({dateKey}).toArray();
    if (handovers.length) {
      if (!await b2Upload(`data/handovers/handovers_${dateKey}.csv`, '\uFEFF'+buildHandoversCSV(handovers))) failed++;
      else console.log(`[midnight-backup] Handovers: ${handovers.length} records → B2`);
    }

    // 3. Daily report CSV
    if (patients.length) {
      const totalCharged = patients.reduce((s,p)=>s+(parseFloat(p.amountAsked)||0),0);
      const totalPaid    = patients.reduce((s,p)=>s+(parseFloat(p.amountPaid)||0),0);
      const totalCashPaid   = patients.reduce((s,p)=>s+(Number(p.amountPaidCash)||0),0);
      const totalOnlinePaid = patients.reduce((s,p)=>s+(Number(p.amountPaidOnline)||0),0);
      const activitySummaryByMgr = {};
      const activityLogs2 = await col('activity').find({dateKey}).toArray();
      activityLogs2.forEach(e => {
        if (!activitySummaryByMgr[e.mgrName]) activitySummaryByMgr[e.mgrName] = {name:e.mgrName,added:0,paid:0,edits:0,prints:0,dels:0,total:0};
        const m = activitySummaryByMgr[e.mgrName];
        m.total++;
        if (e.action==='Added Patient')    m.added++;
        if (e.action==='Marked as Paid')   m.paid++;
        if (e.action==='Edited Patient')   m.edits++;
        if (e.action==='Printed Bill')     m.prints++;
        if (e.action==='Deleted Patient')  m.dels++;
      });
      const svcMap = {};
      patients.forEach(p => {
        const svc = p.xrayPart||'Unknown';
        if (!svcMap[svc]) svcMap[svc]={name:svc,count:0,charged:0,paid:0};
        svcMap[svc].count++;
        svcMap[svc].charged += parseFloat(p.amountAsked)||0;
        svcMap[svc].paid    += parseFloat(p.amountPaid)||0;
      });
      const [dd,mm,yyyy] = dateKey.split('-');
      const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const report = {
        dateKey,
        dateFormatted: `${parseInt(dd)} ${months[parseInt(mm)-1]} ${yyyy}`,
        totalPatients: patients.length,
        done:          patients.filter(p=>p.status==='Done').length,
        pending:       patients.filter(p=>p.status==='Pending').length,
        cancelled:     patients.filter(p=>p.status==='Cancelled').length,
        totalCharged, totalPaid, totalCashPaid, totalOnlinePaid,
        totalDue:      Math.max(0, totalCharged - totalPaid),
        totalHandedOver: handovers.reduce((s,h)=>s+(parseFloat(h.amount)||0),0),
        stillHolding:   Math.max(0, totalPaid - handovers.reduce((s,h)=>s+(parseFloat(h.amount)||0),0)),
        paidCount:     patients.filter(p=>p.paymentStatus==='Paid').length,
        partialCount:  patients.filter(p=>p.paymentStatus==='Partial').length,
        unpaidCount:   patients.filter(p=>p.paymentStatus==='Unpaid').length,
        managerSummary: Object.values(activitySummaryByMgr).filter(m=>m.total>0),
        services:       Object.values(svcMap).sort((a,b)=>b.count-a.count)
      };
      if (!await b2Upload(`data/daily/daily-report_${dateKey}.csv`, '\uFEFF'+buildDailyReportCSV(report))) failed++;
      else console.log(`[midnight-backup] Daily report → B2`);
    }

    // 4. Monthly combined CSV
    const [d2,m2,y2] = dateKey.split('-');
    const monthKey = `${y2}-${m2}`;
    const monthPatients = await col('patients').find({date:{$regex:`^\\d{2}-${m2}-${y2}$`}}).toArray();
    if (monthPatients.length) {
      if (!await b2Upload(`monthly/patients_${monthKey}.csv`, '\uFEFF'+buildPatientCSV(monthPatients))) failed++;
      else console.log(`[midnight-backup] Monthly CSV: ${monthPatients.length} records → B2`);
    }

    if (failed) console.error(`[midnight-backup] ⚠️ Completed with ${failed} FAILED upload(s) for ${dateKey}`);
    else console.log(`[midnight-backup] ✅ Complete for ${dateKey}`);
  } catch(e) {
    console.error(`[midnight-backup] ❌ Failed for ${dateKey}:`, e.message);
  }
}

// Schedule midnight backup — fires at 00:05 IST (18:35 UTC)// IST = UTC+5:30, so 00:05 IST = 18:35 UTC previous day
function scheduleMidnightBackup() {
  function msUntilNext1835UTC() {
    const now  = new Date();
    const next = new Date(now);
    next.setUTCHours(18, 35, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1); // already passed today → tomorrow
    return next.getTime() - now.getTime();
  }

  function runAndReschedule() {
    // Back up yesterday in IST (which just ended at midnight IST)
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000); // UTC+5:30
    const yesterday = new Date(istNow);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dk = String(yesterday.getUTCDate()).padStart(2,'0') + '-' +
               String(yesterday.getUTCMonth()+1).padStart(2,'0') + '-' +
               yesterday.getUTCFullYear();

    // Step 1: backup yesterday → B2
    runFullDayBackup(dk).then(() => {
      // Step 2: re-backup last 7 days staggered (catch any missed saves)
      for (let i = 2; i <= 7; i++) {
        const d = new Date(istNow);
        d.setUTCDate(d.getUTCDate() - i);
        const dKey = String(d.getUTCDate()).padStart(2,'0') + '-' +
                     String(d.getUTCMonth()+1).padStart(2,'0') + '-' +
                     d.getUTCFullYear();
        setTimeout(() => {
          // Back up any date that has patients OR activity (a day with only
          // handovers/activity was previously skipped forever — data lost)
          Promise.all([
            col('patients').countDocuments({date:dKey}),
            col('activity').countDocuments({dateKey:dKey})
          ]).then(([pc, ac]) => {
            if (pc + ac > 0) runFullDayBackup(dKey);
          }).catch(()=>{});
        }, i * 10000); // stagger 10s each to avoid B2 rate limits
      }
      // Step 3: after all B2 backups are done (~2 min), push a FULL snapshot of
      // every collection. MongoDB is trimmed ONLY if the snapshot succeeds —
      // otherwise MongoDB stays untouched so no data is ever lost.
      setTimeout(async () => {
        const snapshotOk = await pushFullSnapshotToB2();
        if (snapshotOk) {
          trimMongoDB();
        } else {
          console.error('[midnight-backup] ⚠️ Full snapshot FAILED — SKIPPING MongoDB trim to avoid data loss');
        }
      }, 2 * 60 * 1000);
    }).catch(e => console.error('[midnight-backup] runAndReschedule error:', e.message));

    // Schedule next midnight backup
    setTimeout(runAndReschedule, msUntilNext1835UTC());
    console.log(`[midnight-backup] Next backup scheduled in ${Math.round(msUntilNext1835UTC()/60000)} minutes`);
  }

  const delay = msUntilNext1835UTC();
  setTimeout(runAndReschedule, delay);
  console.log(`[midnight-backup] Scheduler started — first backup in ${Math.round(delay/60000)} minutes (at 00:05 IST)`);
}

// ── API: Activity ─────────────────────────────────────────────
async function handleSaveActivity(req,res){
  try{
    const{entry}=await jsonBody(req);
    if(!entry){res.writeHead(400);res.end('Missing entry');return;}
    await col('activity').insertOne({...entry,_ts:new Date()});
    // Push updated activity CSV + report to B2 immediately
    if (entry.dateKey) scheduleInstantBackup(entry.dateKey);
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){console.error('[save-activity]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── API: Get Activity ─────────────────────────────────────────
async function handleGetActivity(req,res){
  try{
    const dateParam = req.query.date || '';
    const mgrParam  = req.query.mgr  || '';
    const query = {};
    if (dateParam) query.dateKey = dateParam;
    if (mgrParam)  query.mgrId  = mgrParam;
    const entries = await col('activity').find(query).sort({ts:-1}).limit(500).toArray();
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({entries}));
  }catch(e){res.writeHead(500);res.end(e.message);}
}

// ── API: Clear Activity Logs (doctor only) ───────────────────
// Body: { date?: 'DD-MM-YYYY' } — clears that date's logs, or ALL logs if omitted.
async function handleClearActivity(req,res){
  const auth=doctorAuthorized(req,res);
  if(!auth)return;
  try{
    const{date,scope}=await jsonBody(req);
    const clearAll = scope==='all' || !date;
    const query = clearAll ? {} : { dateKey:String(date) };
    const result = await col('activity').deleteMany(query);
    const count = result.deletedCount||0;
    console.log(`[clear-activity] ${clearAll?'ALL logs':'logs for '+date}: removed ${count} entries by doctor`);
    // Record the clearing itself in the log (survives because it is inserted after the delete)
    await logSystemActivity(clearAll?'Cleared ALL Activity Logs':'Cleared Activity Log','Removed '+count+' log entries'+(clearAll?' (all dates)':' for '+date));
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true,deleted:count,clearAll}));
  }catch(e){console.error('[clear-activity]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── API: Save Manager Info to B2 ─────────────────────────────
async function handleSaveManagerInfo(req,res){
  try{
    const { managers } = await jsonBody(req);
    if (!Array.isArray(managers)) { res.writeHead(400); res.end('Invalid'); return; }
    // Build CSV
    const headers = ['Manager ID','Name','PIN','Status','Joined Date','Mobile','Email','Address','Aadhaar/ID','Date of Birth','Emergency Contact','Salary','Shift','Notes'];
    const rows = managers.map(m => {
      const info = m.info || {};
      return [
        m.id, '"'+(m.name||'').replace(/"/g,'""')+'"', m.pin,
        m.active?'Active':'Inactive',
        '"'+(m.joinedDate||'').replace(/"/g,'""')+'"',
        info.mobile||'', '"'+(info.email||'').replace(/"/g,'""')+'"',
        '"'+(info.address||'').replace(/"/g,'""')+'"',
        '"'+(info.aadhaar||'').replace(/"/g,'""')+'"',
        info.dob||'',
        '"'+(info.emergency||'').replace(/"/g,'""')+'"',
        '"'+(info.salary||'').replace(/"/g,'""')+'"',
        '"'+(info.shift||'').replace(/"/g,'""')+'"',
        '"'+(info.notes||'').replace(/"/g,'""')+'"'
      ];
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
    await b2Upload('data/manager_info_save.csv', csv);
    pushFullSnapshotToB2(); // manager info changed — refresh B2 snapshot
    console.log('[manager-info] Saved to B2: data/manager_info_save.csv');
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){console.error('[save-manager-info]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── API: Delete Patient (doctor only) ────────────────────────
async function handleDeletePatient(req,res){
  try{
    const{visitUid}=await jsonBody(req);
    if(!visitUid){res.writeHead(400);res.end('Missing visitUid');return;}
    const result = await col('patients').deleteOne({visitUid});
    if(result.deletedCount===0){
      // try by uid as fallback
      await col('patients').deleteOne({uid:visitUid});
    }
    // Record a tombstone so no stale copy on any device can resurrect this
    // patient via a later save/sync.
    await col('deleted').updateOne({_id:'main'},{$addToSet:{uids:visitUid}},{upsert:true});
    console.log(`[delete-patient] Deleted: ${visitUid}`);
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){console.error('[delete-patient]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── API: Save Catalog ─────────────────────────────────────────
async function handleSaveCatalog(req,res){
  try{
    const{categories}=await jsonBody(req);
    if(!Array.isArray(categories)){res.writeHead(400);res.end('Invalid');return;}
    const config=await readConfig();
    if(!config){res.writeHead(500);res.end('No config');return;}
    // Keep the saved referral list — saving tests must never erase referral edits
    const prevRefs=(config.catalog&&Array.isArray(config.catalog.referrals))?config.catalog.referrals:runtimeCatalog.referrals;
    const prevMeds=(config.catalog&&Array.isArray(config.catalog.medicines))?config.catalog.medicines:runtimeCatalog.medicines;
    config.catalog={categories:filterExtraServices(categories),referrals:prevRefs,medicines:prevMeds,updatedAt:new Date().toISOString()};
    await writeConfig(config);
    pushFullSnapshotToB2(); // catalog changed — refresh B2 snapshot
    // Update runtime catalog
    runtimeCatalog.services=categories;
    runtimeCatalog.updatedAt=new Date().toISOString();
    console.log('[catalog] Updated via doctor panel:', categories.reduce((n,c)=>n+c.items.length,0),'services');
    logSystemActivity('Updated Service Catalog', categories.reduce((n,c)=>n+c.items.length,0)+' tests across '+categories.length+' categories');
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){console.error('[save-catalog]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── API: Save Medicines (doctor panel — medicine catalog editor / CSV upload) ──
async function handleSaveMedicines(req,res){
  if(!doctorAuthorized(req,res))return;
  try{
    const{medicines}=await jsonBody(req);
    if(!Array.isArray(medicines)){res.writeHead(400);res.end('Invalid');return;}
    // Normalize: trim names, drop blanks, dedupe (case-insensitive), numeric or MRP prices
    const clean=[];
    for(const m of medicines){
      const rawName=Array.isArray(m)?m[0]:(m&&m.name);
      const name=String(rawName||'').replace(/\s+/g,' ').trim();
      if(!name)continue;
      if(clean.some(([n])=>n.toLowerCase()===name.toLowerCase()))continue;
      const rawPrice=Array.isArray(m)?m[1]:(m&&m.price!==undefined?m.price:0);
      const price=typeof rawPrice==='string'?(/mrp/i.test(rawPrice)?'Based on MRP':(Number(parseFloat(rawPrice))||0)):(Number(rawPrice)||0);
      clean.push([name,price]);
    }
    const config=await readConfig();
    if(!config){res.writeHead(500);res.end('No config');return;}
    config.catalog=config.catalog||{};
    config.catalog.medicines=clean;
    config.catalog.updatedAt=new Date().toISOString();
    await writeConfig(config);
    pushFullSnapshotToB2(); // medicine catalog changed — refresh B2 snapshot
    runtimeCatalog.medicines=clean;
    runtimeCatalog.updatedAt=new Date().toISOString();
    console.log('[medicines] Updated via doctor panel:', clean.length,'medicines');
    logSystemActivity('Updated Medicine Catalog', clean.length+' medicines');
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true,count:clean.length}));
  }catch(e){console.error('[save-medicines]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── API: Save Referrals (doctor panel — referral sources editor) ──
async function handleSaveReferrals(req,res){
  if(!doctorAuthorized(req,res))return;
  try{
    const{referrals}=await jsonBody(req);
    if(!Array.isArray(referrals)){res.writeHead(400);res.end('Invalid');return;}
    // Normalize: trim, drop blanks, dedupe (order preserved)
    const clean=[];
    for(const r of referrals){const name=String(r||'').replace(/\s+/g,' ').trim();if(name&&!clean.includes(name))clean.push(name);}
    const config=await readConfig();
    if(!config){res.writeHead(500);res.end('No config');return;}
    config.catalog=config.catalog||{};
    config.catalog.referrals=clean;
    config.catalog.updatedAt=new Date().toISOString();
    await writeConfig(config);
    pushFullSnapshotToB2(); // referral list changed — refresh B2 snapshot
    runtimeCatalog.referrals=clean;
    runtimeCatalog.updatedAt=new Date().toISOString();
    console.log('[referrals] Updated via doctor panel:', clean.length,'sources');
    logSystemActivity('Updated Referral List', clean.length+' referral sources');
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){console.error('[save-referrals]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── System activity log (doctor/server actions → activity collection) ──
// Records catalog/referral edits so there is an audit trail alongside manager logs.
async function logSystemActivity(action,detail){
  try{
    const now=new Date();
    const dk=String(now.getDate()).padStart(2,'0')+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+now.getFullYear();
    await col('activity').insertOne({
      id:Date.now()+'-'+Math.random().toString(36).slice(2,7),
      mgrId:'doctor', mgrName:'Doctor', action, detail:detail||'',
      patientUid:'', patientName:'', amount:0,
      dateKey:dk,
      time:now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}),
      ts:now.toISOString(), _ts:new Date()
    });
  }catch(e){console.error('[activity] System log failed:',e.message);}
}

// ── API: Save Handover ────────────────────────────────────────
async function handleSaveHandover(req,res){
  try{
    const{entry}=await jsonBody(req);
    if(!entry||!entry.mgrId){res.writeHead(400);res.end('Missing entry');return;}
    await col('handovers').insertOne({...entry,_ts:new Date()});
    // Push updated report to B2
    if(entry.dateKey) scheduleInstantBackup(entry.dateKey);
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){console.error('[save-handover]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── API: Get Handovers ────────────────────────────────────────
async function handleGetHandovers(req,res){
  try{
    const dateParam = req.query.date || '';
    const mgrParam  = req.query.mgr  || '';
    const query = {};
    if(dateParam) query.dateKey = dateParam;
    if(mgrParam)  query.mgrId  = mgrParam;
    const handovers = await col('handovers').find(query).sort({ts:-1}).toArray();
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({handovers}));
  }catch(e){res.writeHead(500);res.end(e.message);}
}

// ── API: Save Day (full snapshot) ────────────────────────────
async function handleSaveDay(req,res){
  try{
    const body=await jsonBody(req);
    const{dateKey,dateFormatted,patients,activityLog,managerSummary,services}=body;
    if(!dateKey){res.writeHead(400);res.end('Missing dateKey');return;}
    // Upsert all patients — only overwrite if incoming record is newer
    if(patients&&patients.length){
      const keys = patients.map(p => recordKey(p));
      const existing = await col('patients').find({visitUid:{$in:keys}}).toArray();
      const existingMap = new Map(existing.map(e => [e.visitUid, e]));
      const toUpsert = patients.filter(p => {
        const ex = existingMap.get(recordKey(p));
        if (!ex) return true;
        const exTs = new Date(ex.updatedAt || ex.createdAt || 0).getTime();
        const inTs = new Date(p.updatedAt  || p.createdAt  || 0).getTime();
        return inTs > exTs;
      });
      if (toUpsert.length) {
        const ops=toUpsert.map(p=>({replaceOne:{filter:{visitUid:recordKey(p)},replacement:{...p,visitUid:recordKey(p)},upsert:true}}));
        await col('patients').bulkWrite(ops);
      }
    }
    // Daily report to B2
    const totalCharged=(patients||[]).reduce((s,p)=>s+(parseFloat(p.amountAsked)||0),0);
    const totalPaid=(patients||[]).reduce((s,p)=>s+(parseFloat(p.amountPaid)||0),0);
    const totalCashPaid=(patients||[]).reduce((s,p)=>s+(Number(p.amountPaidCash)||0),0);
    const totalOnlinePaid=(patients||[]).reduce((s,p)=>s+(Number(p.amountPaidOnline)||0),0);
    const handoversDay=await col('handovers').find({dateKey}).toArray();
    const totalHandedOver=handoversDay.reduce((s,h)=>s+(parseFloat(h.amount)||0),0);
    const report={dateKey,dateFormatted:dateFormatted||dateKey,totalPatients:(patients||[]).length,done:(patients||[]).filter(p=>p.status==='Done').length,pending:(patients||[]).filter(p=>p.status==='Pending').length,cancelled:(patients||[]).filter(p=>p.status==='Cancelled').length,totalCharged,totalPaid,totalCashPaid,totalOnlinePaid,totalDue:Math.max(0,totalCharged-totalPaid),totalHandedOver,stillHolding:Math.max(0,totalPaid-totalHandedOver),paidCount:(patients||[]).filter(p=>p.paymentStatus==='Paid').length,partialCount:(patients||[]).filter(p=>p.paymentStatus==='Partial').length,unpaidCount:(patients||[]).filter(p=>p.paymentStatus==='Unpaid').length,managerSummary:managerSummary||[],services:services||[]};
    await b2Upload(`data/daily/daily-report_${dateKey}.csv`, buildDailyReportCSV(report));
    // Activity CSVs to B2
    const byMgr={};
    (activityLog||[]).forEach(e=>{const n=(e.mgrName||'unknown').replace(/[^a-zA-Z0-9 \-_.]/g,'_').trim()||'unknown';if(!byMgr[n])byMgr[n]=[];byMgr[n].push(e);});
    for(const[mgrName,logs] of Object.entries(byMgr)){
      await b2Upload(`managers/${mgrName}/activity_${dateKey}.csv`,'\uFEFF'+buildActivityCSV(logs));
    }
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){console.error('[save-day]',e.message);res.writeHead(500);res.end(e.message);}
}

// ── API: Save Daily Report ────────────────────────────────────
async function handleSaveDailyReport(req,res){
  try{
    const report=await jsonBody(req);
    if(!report.dateKey){res.writeHead(400);res.end('Missing dateKey');return;}
    await b2Upload(`data/daily/daily-report_${report.dateKey}.csv`,'\uFEFF'+buildDailyReportCSV(report));
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:true}));
  }catch(e){res.writeHead(500);res.end(e.message);}
}

// ── API: Lookup Mobile ────────────────────────────────────────
async function handleLookupMobile(req,res){
  const raw=String(req.query.mobile||'').replace(/\D/g,'');
  if(!raw||raw.length<6){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({uid:null}));return;}
  // Exact mobile match — strip non-digits from stored mobile too
  // Search both raw and with spaces/dashes stripped
  const matches=await col('patients').find({
    $or:[
      {mobile: raw},
      {mobile: {$regex: raw.replace(/(.{5})/,'$1-?\\s?')}} // handle formatted numbers
    ]
  }).sort({createdAt:1}).limit(1).toArray();
  // Double-check: normalize stored mobile and compare
  const found = matches.find(p => String(p.mobile||'').replace(/\D/g,'') === raw);
  if(!found){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({uid:null}));return;}
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({uid:found.uid,name:found.name}));
}

// ── API: Status ───────────────────────────────────────────────
function handleStatus(req,res){
  res.writeHead(200,{'Content-Type':'application/json'});
  res.end(JSON.stringify({ok:true,server:'CLINIC',version:'2.0',time:new Date().toISOString()}));
}

// ── Telegram ──────────────────────────────────────────────────
const TELEGRAM_TIMEOUT_MS = 15000;
function telegramRequest(token,method,payload={}){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const done=(fn,arg)=>{ if(!settled){settled=true;fn(arg);} };
    const body=Buffer.from(JSON.stringify(payload),'utf8');
    const request=https.request({hostname:'api.telegram.org',path:`/bot${token}/${method}`,method:'POST',headers:{'Content-Type':'application/json','Content-Length':body.length}},response=>{
      let data='';
      response.on('data',chunk=>data+=chunk);
      response.on('end',()=>{
        try{
          const json=JSON.parse(data);
          if(json.ok){done(resolve,json.result);return;}
          const err=new Error(json.description||'Telegram failed');
          err.retryAfter=json.parameters&&json.parameters.retry_after; // Telegram rate-limit hint
          done(reject,err);
        }catch(error){done(reject,error);}
      });
    });
    request.setTimeout(TELEGRAM_TIMEOUT_MS,()=>{ request.destroy(new Error('Telegram request timed out')); });
    request.on('error',e=>done(reject,e));
    request.end(body);
  });
}

// Send with retries + backoff — a transient failure (network blip, Telegram 429 rate
// limit, timeout) must NOT silently drop the notification.
function sendTelegramNotification(token,chatId,message,attempts=3){
  if(!token||!chatId)return Promise.resolve(false);
  const trySend=(left)=>{
    return telegramRequest(token,'sendMessage',{chat_id:chatId,text:message})
      .then(()=>{ console.log('[telegram] Sent OK → chat',chatId); return true; })
      .catch(async e=>{
        const backoffs=[3000,10000,30000]; // ~3s, 10s, 30s
        const delay=(e&&e.retryAfter)?(Number(e.retryAfter)*1000):(backoffs[attempts-left]||backoffs[backoffs.length-1]);
        console.error(`[telegram] Send failed (${e.message}). ${left>1?`Retrying in ${Math.round(delay/1000)}s…`:'Giving up.'}`);
        if(left<=1)return false;
        await new Promise(r=>setTimeout(r,delay));
        return trySend(left-1);
      });
  };
  return trySend(attempts);
}

// In-flight guard: never send the same patient alert twice, even if the patient is
// re-synced while the first attempt is still retrying.
const telegramPending=new Map(); // uid → timestamp
async function notifyDoctorOfNewPatient(patient){
  const uid=patient&&(patient.visitUid||patient.uid);
  if(!uid)return;
  // Claim synchronously BEFORE any await so two concurrent syncs of the same
  // patient can never both send the alert.
  if(telegramPending.has(uid))return;
  telegramPending.set(uid,Date.now());
  try{
    const config=await readConfig();
    const settings=config&&config.settings;
    if(!settings||!settings.doctorTelegramBotToken||!settings.doctorTelegramChatId){
      console.log('[telegram] Not configured — skipping alert for',uid);
      return;
    }
    const message=`New patient: Token #${patient.patientNo}\n${patient.name}\nService: ${patient.xrayPart||'Not specified'}\nAdded by: ${patient.attendedByName}`;
    const ok=await sendTelegramNotification(settings.doctorTelegramBotToken,settings.doctorTelegramChatId,message);
    if(!ok){
      // Leave sentUids unmarked so the next sync of this patient retries the alert.
      console.error(`[telegram] ❌ Alert NOT delivered for patient ${uid} — will retry on next sync.`);
      return;
    }
    try{
      const doc=await col('telegram').findOne({_id:'notifications'})||{_id:'notifications',sentUids:{}};
      doc.sentUids[uid]=new Date().toISOString();
      await col('telegram').replaceOne({_id:'notifications'},doc,{upsert:true});
    }catch(e){ console.error('[telegram] Could not record sentUid:',e.message); }
  } finally {
    telegramPending.delete(uid);
  }
}

// ── Doctor Auth API ───────────────────────────────────────────
async function handleDoctorLogin(req,res){ try{ const{pin,otp}=await jsonBody(req); const config=await readConfig(); const settings=config&&config.settings; if(!settings||!sameSecret(pin,settings.doctorPin)){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'Invalid credentials'}));return;} if(settings.doctorTotpSecret&&!validTotp(settings.doctorTotpSecret,otp)){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,requiresOtp:true,error:'Invalid authenticator code'}));return;} res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true,token:createDoctorSession(),otpEnabled:!!settings.doctorTotpSecret})); }catch(e){res.writeHead(400);res.end('Invalid sign-in request');} }
async function handleDoctorTotpStatus(req,res){ if(!doctorAuthorized(req,res))return; const config=await readConfig(); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true,enabled:!!(config&&config.settings&&config.settings.doctorTotpSecret)})); }
async function handleDoctorTotpSetup(req,res){ const auth=doctorAuthorized(req,res);if(!auth)return; const config=await readConfig(); if(config&&config.settings&&config.settings.doctorTotpSecret){res.writeHead(409);res.end('Authenticator is already enabled');return;} const secret=base32Encode(crypto.randomBytes(20)); auth.session.pendingTotpSecret=secret; const issuer='Ramgopal Agarwal Clinic'; const label=encodeURIComponent(issuer+':Doctor'); const uri=`otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`; res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true,secret,uri})); }
async function handleDoctorTotpConfirm(req,res){ const auth=doctorAuthorized(req,res);if(!auth)return; try{ const{otp}=await jsonBody(req); if(!auth.session.pendingTotpSecret||!validTotp(auth.session.pendingTotpSecret,otp)){res.writeHead(400);res.end(JSON.stringify({ok:false,error:'Invalid authenticator code'}));return;} const config=await readConfig(); config.settings.doctorTotpSecret=auth.session.pendingTotpSecret; config.updatedAt=new Date().toISOString(); await writeConfig(config); pushFullSnapshotToB2(); delete auth.session.pendingTotpSecret; res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true})); }catch(e){res.writeHead(400);res.end('Invalid confirmation request');} }
async function handleDoctorTotpDisable(req,res){ if(!doctorAuthorized(req,res))return; try{ const{pin,otp}=await jsonBody(req); const config=await readConfig(); const settings=config&&config.settings; if(!settings||!sameSecret(pin,settings.doctorPin)||!validTotp(settings.doctorTotpSecret,otp)){res.writeHead(401);res.end(JSON.stringify({ok:false,error:'PIN or authenticator code is incorrect'}));return;} delete settings.doctorTotpSecret; config.updatedAt=new Date().toISOString(); await writeConfig(config); pushFullSnapshotToB2(); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true})); }catch(e){res.writeHead(400);res.end('Invalid request');} }
async function handleDoctorTelegramStatus(req,res){ if(!doctorAuthorized(req,res))return; const config=await readConfig(); const settings=config&&config.settings; res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true,enabled:!!(settings&&settings.doctorTelegramBotToken&&settings.doctorTelegramChatId)})); }
async function handleDoctorTelegramSetup(req,res){ if(!doctorAuthorized(req,res))return; try{ const{botToken}=await jsonBody(req); if(!botToken||!/^\d+:[\w-]+$/.test(botToken)){res.writeHead(400);res.end(JSON.stringify({ok:false,error:'Invalid bot token'}));return;} const updates=await telegramRequest(botToken,'getUpdates'); const lastMessage=[...updates].reverse().map(u=>u.message).find(Boolean); if(!lastMessage||!lastMessage.chat){res.writeHead(400);res.end(JSON.stringify({ok:false,error:'Open your bot in Telegram and send /start, then try again.'}));return;} const config=await readConfig(); if(!config||!config.settings){res.writeHead(500);res.end('Clinic configuration is unavailable');return;} config.settings.doctorTelegramBotToken=botToken; config.settings.doctorTelegramChatId=String(lastMessage.chat.id); config.updatedAt=new Date().toISOString(); await writeConfig(config); pushFullSnapshotToB2(); await sendTelegramNotification(botToken,String(lastMessage.chat.id),'Clinic alerts are connected.'); res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true})); }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:error.message||'Could not connect Telegram bot'}));} }
async function handleDoctorTelegramTest(req,res){ if(!doctorAuthorized(req,res))return; const config=await readConfig(); const settings=config&&config.settings; if(!settings||!settings.doctorTelegramBotToken||!settings.doctorTelegramChatId){res.writeHead(400);res.end('Telegram alerts are not enabled');return;} const ok=await sendTelegramNotification(settings.doctorTelegramBotToken,settings.doctorTelegramChatId,'Clinic alert test: Telegram messages are active.'); if(!ok){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'Could not deliver the test message to Telegram.'}));return;} res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:true})); }

// ── XLSX/DOCX catalog parser (kept from original) ────────────
const SERVICE_PRICE_FILE = path.join(ROOT,'service_and_price.xlsx');
const REFERRAL_FILES = ['referal.docx','referral.docx'].map(n=>path.join(ROOT,n));
let runtimeCatalog={services:[],referrals:[],medicines:[],updatedAt:null};

// Guidance (old "Consultancy") and Medicine are no longer tests — they are tick
// options in patient entry. Drop them from any catalog (DB or file) that still has them.
function filterExtraServices(categories){
  return (categories||[]).map(c=>({...c,items:(c.items||[]).filter(([name])=>!/^(medicine|consultancy)$/i.test(String(name||'').trim()))})).filter(c=>c.items.length);
}
let catalogLoadedFromDb=false; // when true, doctor edits in DB win over bundled files

function zipEntries(file){const zlib=require('zlib');const data=fs.readFileSync(file);let eocd=-1;for(let i=data.length-22;i>=Math.max(0,data.length-0xffff-22);i--){if(data.readUInt32LE(i)===0x06054b50){eocd=i;break;}}if(eocd<0)throw new Error('Not a valid ZIP file');const count=data.readUInt16LE(eocd+10),offset=data.readUInt32LE(eocd+16),entries={};let pos=offset;for(let i=0;i<count;i++){if(data.readUInt32LE(pos)!==0x02014b50)throw new Error('Invalid ZIP directory');const method=data.readUInt16LE(pos+10),compressedSize=data.readUInt32LE(pos+20);const nameLength=data.readUInt16LE(pos+28),extraLength=data.readUInt16LE(pos+30),commentLength=data.readUInt16LE(pos+32);const localOffset=data.readUInt32LE(pos+42),name=data.subarray(pos+46,pos+46+nameLength).toString('utf8');const localNameLength=data.readUInt16LE(localOffset+26),localExtraLength=data.readUInt16LE(localOffset+28);const start=localOffset+30+localNameLength+localExtraLength;const compressed=data.subarray(start,start+compressedSize);entries[name]=method===0?compressed:method===8?zlib.inflateRawSync(compressed):null;pos+=46+nameLength+extraLength+commentLength;}return entries;}
function xmlText(v){return String(v||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).trim();}
function xlsxSharedStrings(entries){const xml=entries['xl/sharedStrings.xml']?entries['xl/sharedStrings.xml'].toString('utf8'):'';return[...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(m=>xmlText(m[1]));}
function cellColumn(ref){return(ref.match(/^[A-Z]+/)||[''])[0];}
function parseServiceWorkbook(file){const entries=zipEntries(file),strings=xlsxSharedStrings(entries),rows=[];const sheets=Object.keys(entries).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));for(const sheet of sheets){const xml=entries[sheet].toString('utf8');for(const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)){const values={};for(const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){const ref=(cell[1].match(/\br="([A-Z]+\d+)"/)||['',''])[1];const type=(cell[1].match(/\bt="([^"]+)"/) ||['',''])[1];const raw=xmlText((cell[2].match(/<v[^>]*>([\s\S]*?)<\/v>/)||cell[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)||['',''])[1]);if(ref)values[cellColumn(ref)]=type==='s'?(strings[Number(raw)]||''):raw;}if(Object.keys(values).length)rows.push(values);}}const categories=[];let current=null;const categoryFor=label=>{const clean=String(label||'').replace(/\s+/g,' ').trim();let cat=categories.find(c=>c.label.toLowerCase()===clean.toLowerCase());if(!cat){cat={label:clean,items:[]};categories.push(cat);}return cat;};const add=(cat,name,price)=>{const clean=String(name||'').replace(/\s+/g,' ').trim();if(!clean||cat.items.some(([e])=>e.toLowerCase()===clean.toLowerCase()))return;if(/^(medicine|consultancy)$/i.test(clean))return;cat.items.push([clean,price==='Based on MRP'?price:Number.isFinite(price)?price:0]);};for(const row of rows){const number=Number(row.A),name=String(row.B||'').replace(/\s+/g,' ').trim();const price=Number(row.C),hasNumber=row.A!==undefined&&Number.isFinite(number),hasPrice=row.C!==undefined&&Number.isFinite(price);if(hasNumber&&name){if(!current)current=categoryFor('Other');add(current,name,hasPrice?price:0);}else if(name&&hasPrice)add(categoryFor('Other'),name,price);else if(name&&/mrp/i.test(String(row.C||'')))add(categoryFor('Other'),name,'Based on MRP');else if(name)current=categoryFor(name);}return categories.filter(c=>c.items.length);}
function parseReferralDocument(file){const entries=zipEntries(file),xml=entries['word/document.xml']?entries['word/document.xml'].toString('utf8'):'';const seen=new Set(),referrals=[];for(const p of xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)){const text=[...p[1].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m=>xmlText(m[1])).join('').replace(/[\uf0b7•]/g,'').replace(/\s+/g,' ').trim();const key=text.toLowerCase();if(text&&key!=='referrals'&&!seen.has(key)){seen.add(key);referrals.push(text);}}return referrals;}
function syncReferenceFiles(onlyFillMissing){try{if(!onlyFillMissing||!runtimeCatalog.services.length){if(fs.existsSync(SERVICE_PRICE_FILE))runtimeCatalog.services=parseServiceWorkbook(SERVICE_PRICE_FILE);}if(!onlyFillMissing||!runtimeCatalog.referrals.length){const rf=REFERRAL_FILES.find(f=>fs.existsSync(f));if(rf)runtimeCatalog.referrals=parseReferralDocument(rf);}runtimeCatalog.updatedAt=new Date().toISOString();console.log(`[catalog] Synced ${runtimeCatalog.services.reduce((n,c)=>n+c.items.length,0)} services and ${runtimeCatalog.referrals.length} referrals.`);}catch(e){console.error('[catalog] Sync failed:',e.message);}}
function handleGetCatalog(req,res){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(runtimeCatalog));}

// ── MIME types ────────────────────────────────────────────────
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.csv':'text/csv; charset=utf-8','.json':'application/json; charset=utf-8'};

// ── Static file server ────────────────────────────────────────
function serveStatic(req,res){
  let filePath=path.join(ROOT,req.pathname==='/'?'index.html':req.pathname);
  if(!filePath.startsWith(ROOT)){res.writeHead(403);res.end('Forbidden');return;}
  if(!fs.existsSync(filePath)){res.writeHead(404);res.end('Not found');return;}
  if(fs.statSync(filePath).isDirectory())filePath=path.join(filePath,'index.html');
  const ext=path.extname(filePath).toLowerCase();
  const mime=MIME[ext]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'});
  fs.createReadStream(filePath).pipe(res);
}

// ── Main request handler ──────────────────────────────────────
async function requestHandler(req, res) {
  try {
    await ensureDB();
  } catch (e) {
    console.error('[db connect error]', e.message);
  }

  const urlStr = req.url || '/';
  const parsed = new URL(urlStr, `http://localhost:${PORT}`);
  req.pathname = parsed.pathname;
  req.query    = (req.query && typeof req.query === 'object' && Object.keys(req.query).length) ? req.query : Object.fromEntries(parsed.searchParams);

  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Site-Pass, Authorization, X-Gate-Token');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Site gate — cookie-based, shown once per browser session
  if (!requireSiteAccess(req, res)) return;

  // API routes additionally require X-Site-Pass header (sent by app.js on every fetch)
  const isApi = req.pathname.startsWith('/api/');
  const openApi = ['/api/status', '/api/doctor/login', '/api/site-auth', '/api/site-auth-check'];
  if (isApi && !openApi.includes(req.pathname) && !sitePassValid(req)) {
    res.writeHead(401, {'Content-Type':'application/json'});
    res.end(JSON.stringify({ok:false, error:'Site access denied'}));
    return;
  }

  if (req.method==='POST' && req.pathname==='/api/site-auth')             return handleSiteAuth(req,res);
  if (req.method==='GET'  && req.pathname==='/api/site-auth-check')       return handleSiteAuthCheck(req,res);

  if (req.method==='POST' && req.pathname==='/api/save-day')               return handleSaveDay(req,res);
  if (req.method==='POST' && req.pathname==='/api/save-patient')           return handleSavePatient(req,res);
  if (req.method==='GET'  && req.pathname==='/api/patients')               return handleGetPatients(req,res);
  if (req.method==='GET'  && req.pathname==='/api/catalog')                return handleGetCatalog(req,res);
  if (req.method==='POST' && req.pathname==='/api/save-activity')          return handleSaveActivity(req,res);
  if (req.method==='GET'  && req.pathname==='/api/activity')               return handleGetActivity(req,res);
  if (req.method==='POST' && req.pathname==='/api/activity/clear')         return handleClearActivity(req,res);
  if (req.method==='POST' && req.pathname==='/api/save-daily-report')      return handleSaveDailyReport(req,res);
  if (req.method==='POST' && req.pathname==='/api/save-handover')          return handleSaveHandover(req,res);
  if (req.method==='GET'  && req.pathname==='/api/handovers')              return handleGetHandovers(req,res);
  if (req.method==='POST' && req.pathname==='/api/save-manager-info')      return handleSaveManagerInfo(req,res);
  if (req.method==='POST' && req.pathname==='/api/delete-patient')         return handleDeletePatient(req,res);
  if (req.method==='POST' && req.pathname==='/api/save-catalog')           return handleSaveCatalog(req,res);
  if (req.method==='POST' && req.pathname==='/api/save-referrals')         return handleSaveReferrals(req,res);
  if (req.method==='POST' && req.pathname==='/api/save-medicines')         return handleSaveMedicines(req,res);
  if (req.method==='GET'  && req.pathname==='/api/config')                 return handleGetConfig(req,res);
  if (req.method==='POST' && req.pathname==='/api/config')                 return handleSaveConfig(req,res);
  if (req.method==='GET'  && req.pathname==='/api/lookup-mobile')          return handleLookupMobile(req,res);
  if (req.method==='POST' && req.pathname==='/api/doctor/login')           return handleDoctorLogin(req,res);
  if (req.method==='GET'  && req.pathname==='/api/doctor/totp')            return handleDoctorTotpStatus(req,res);
  if (req.method==='POST' && req.pathname==='/api/doctor/totp/setup')      return handleDoctorTotpSetup(req,res);
  if (req.method==='POST' && req.pathname==='/api/doctor/totp/confirm')    return handleDoctorTotpConfirm(req,res);
  if (req.method==='POST' && req.pathname==='/api/doctor/totp/disable')    return handleDoctorTotpDisable(req,res);
  if (req.method==='GET'  && req.pathname==='/api/doctor/telegram')        return handleDoctorTelegramStatus(req,res);
  if (req.method==='POST' && req.pathname==='/api/doctor/telegram/setup')  return handleDoctorTelegramSetup(req,res);
  if (req.method==='POST' && req.pathname==='/api/doctor/telegram/test')   return handleDoctorTelegramTest(req,res);
  if (req.method==='GET'  && req.pathname==='/api/status')                 return handleStatus(req,res);

  if (process.env.VERCEL) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  serveStatic(req, res);
}

const server = http.createServer(requestHandler);

const vercelHandler = async (req, res) => {
  return requestHandler(req, res);
};

// ── Boot ──────────────────────────────────────────────────────
if (!process.env.VERCEL) {
  connectDB().then(() => {
    // Fill anything not saved in the DB from the bundled xlsx/docx (keeps the existing
    // referral list working on databases that only have the test catalog saved).
    syncReferenceFiles(catalogLoadedFromDb);
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\n✅  Clinic server running on port ${PORT}`);
      console.log(`    MongoDB: connected`);
      console.log(`    Backblaze B2: ${B2_KEY_ID ? 'configured' : 'not configured'}`);
    });
  }).catch(err => {
    console.error('❌  Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

  server.on('error', e => {
    if (e.code==='EADDRINUSE') console.error(`\n❌  Port ${PORT} is already in use.\n`);
    else console.error('Server error:', e.message);
    process.exit(1);
  });
}

module.exports = { vercelHandler, requestHandler, server };
