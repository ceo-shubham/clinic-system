// Cloudflare Pages Functions - Full API Router with B2 Data Sync
const B2_KEY_ID = '73cca80a9138';
const B2_APP_KEY = '00510e864d367e571142ca5bb102e1279abddfd8a9';
const B2_BUCKET = 'drramgopalclinic-backups';
const B2_BUCKET_ID = '77137c8c1af8d06a99f10318';

const SITE_PASS = '89238350030';
const GATE_TOKEN = 'd8dd0037297deb2b150d57376ff98623';

// In-memory persistent cache across requests in the same isolate
let state = {
  loaded: false,
  loadPromise: null,
  patients: [],
  activity: [],
  handovers: [],
  deletedUids: [],
  config: {
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
    catalog: {
      categories: [],
      referrals: [],
      medicines: [
        ['Paracetamol 650mg', 3],
        ['Amoxicillin 500mg', 12],
        ['Pantoprazole 40mg', 8],
        ['Syrup Cough Care', 'Based on MRP']
      ]
    },
    updatedAt: new Date().toISOString()
  }
};

async function loadDataFromB2() {
  if (state.loaded) return state;
  if (state.loadPromise) return state.loadPromise;

  state.loadPromise = (async () => {
    try {
      const authHeader = 'Basic ' + btoa(B2_KEY_ID + ':' + B2_APP_KEY);
      const authRes = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        headers: { 'Authorization': authHeader }
      }).then(r => r.json());

      if (authRes.downloadUrl && authRes.authorizationToken) {
        const snapshot = await fetch(`${authRes.downloadUrl}/file/${B2_BUCKET}/full-snapshots/clinic-full-01-09-2026.json`, {
          headers: { 'Authorization': authRes.authorizationToken }
        }).then(r => r.json());

        if (snapshot) {
          if (Array.isArray(snapshot.patients)) state.patients = snapshot.patients;
          if (Array.isArray(snapshot.activity)) state.activity = snapshot.activity;
          if (Array.isArray(snapshot.handovers)) state.handovers = snapshot.handovers;
          if (snapshot.deleted && Array.isArray(snapshot.deleted.uids)) state.deletedUids = snapshot.deleted.uids;
          if (snapshot.config) {
            state.config = { ...state.config, ...snapshot.config };
            if (!state.config.catalog) {
              state.config.catalog = {
                categories: [],
                referrals: [],
                medicines: [
                  ['Paracetamol 650mg', 3],
                  ['Amoxicillin 500mg', 12],
                  ['Pantoprazole 40mg', 8],
                  ['Syrup Cough Care', 'Based on MRP']
                ]
              };
            }
          }
        }
      }
      state.loaded = true;
    } catch (err) {
      console.error('Failed to load from B2:', err);
    }
    return state;
  })();

  return state.loadPromise;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Site-Pass, Authorization, X-Gate-Token'
    }
  });
}

function corsOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Site-Pass, Authorization, X-Gate-Token'
    }
  });
}

export async function onRequest(context) {
  const { request, waitUntil } = context;
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return corsOptions();

  const url = new URL(request.url);
  const path = url.pathname;

  // Ensure state is hydrated
  await loadDataFromB2();

  try {
    // 1. Site Gate Authentication
    if (method === 'POST' && path === '/api/site-auth') {
      try {
        const body = await request.json();
        const pw = String(body && body.password || '').trim();
        if (pw === SITE_PASS) {
          return json({ ok: true, token: GATE_TOKEN });
        }
        return json({ ok: false, error: 'Wrong password' }, 401);
      } catch {
        return json({ ok: false, error: 'Bad request' }, 400);
      }
    }

    // 2. Site Auth Check
    if (method === 'GET' && path === '/api/site-auth-check') {
      const t = url.searchParams.get('t') || '';
      return json({ ok: t === GATE_TOKEN });
    }

    // 3. Status
    if (method === 'GET' && path === '/api/status') {
      return json({ 
        ok: true, 
        server: 'CLINIC', 
        version: '2.0', 
        patientsLoaded: state.patients.length,
        time: new Date().toISOString() 
      });
    }

    // 4. Config GET & POST
    if (method === 'GET' && path === '/api/config') {
      const pub = JSON.parse(JSON.stringify(state.config));
      if (pub && pub.settings) {
        delete pub.settings.doctorTotpSecret;
        delete pub.settings.doctorTelegramBotToken;
        delete pub.settings.doctorTelegramChatId;
      }
      return json({ config: pub });
    }

    if (method === 'POST' && path === '/api/config') {
      try {
        const body = await request.json();
        const { config, initialOnly } = body || {};
        if (config && config.settings && Array.isArray(config.managers)) {
          if (!initialOnly || !state.config) {
            state.config = {
              ...state.config,
              settings: { ...state.config.settings, ...config.settings },
              managers: config.managers,
              updatedAt: new Date().toISOString()
            };
          }
        }
        return json({ ok: true, config: state.config });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 5. Catalog GET & POST
    if (method === 'GET' && path === '/api/catalog') {
      const cat = (state.config && state.config.catalog) || {
        services: [],
        referrals: [],
        medicines: [
          ['Paracetamol 650mg', 3],
          ['Amoxicillin 500mg', 12],
          ['Pantoprazole 40mg', 8],
          ['Syrup Cough Care', 'Based on MRP']
        ]
      };
      return json(cat);
    }

    if (method === 'POST' && path === '/api/save-medicines') {
      try {
        const body = await request.json();
        const { medicines } = body || {};
        if (Array.isArray(medicines)) {
          if (!state.config.catalog) state.config.catalog = {};
          state.config.catalog.medicines = medicines;
          state.config.updatedAt = new Date().toISOString();
        }
        return json({ ok: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    if (method === 'POST' && path === '/api/save-catalog') {
      try {
        const body = await request.json();
        const { categories } = body || {};
        if (Array.isArray(categories)) {
          if (!state.config.catalog) state.config.catalog = {};
          state.config.catalog.categories = categories;
          state.config.updatedAt = new Date().toISOString();
        }
        return json({ ok: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    if (method === 'POST' && path === '/api/save-referrals') {
      try {
        const body = await request.json();
        const { referrals } = body || {};
        if (Array.isArray(referrals)) {
          if (!state.config.catalog) state.config.catalog = {};
          state.config.catalog.referrals = referrals;
          state.config.updatedAt = new Date().toISOString();
        }
        return json({ ok: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 6. Patients GET
    if (method === 'GET' && path === '/api/patients') {
      const dateParam = url.searchParams.get('date') || '';
      const allParam  = url.searchParams.get('all') || '';
      let filtered = state.patients;
      if (!allParam) {
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const dateKey = dateParam || `${dd}-${mm}-${yyyy}`;
        filtered = state.patients.filter(p => p.date === dateKey);
      }
      return json({ patients: filtered, deletedUids: state.deletedUids });
    }

    // 7. Save Patient POST
    if (method === 'POST' && path === '/api/save-patient') {
      try {
        const body = await request.json();
        const { patient } = body || {};
        if (!patient || !patient.date) return json({ error: 'Missing patient' }, 400);
        const key = patient.visitUid || patient.uid;
        const idx = state.patients.findIndex(p => (p.visitUid === key || p.uid === key));
        if (idx >= 0) {
          state.patients[idx] = { ...state.patients[idx], ...patient, updatedAt: new Date().toISOString() };
        } else {
          state.patients.push({ ...patient, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        }
        return json({ ok: true, saved: patient });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 8. Delete Patient POST
    if (method === 'POST' && path === '/api/delete-patient') {
      try {
        const body = await request.json();
        const { uid } = body || {};
        if (uid) {
          state.patients = state.patients.filter(p => p.visitUid !== uid && p.uid !== uid);
          if (!state.deletedUids.includes(uid)) state.deletedUids.push(uid);
        }
        return json({ ok: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 9. Save Activity POST
    if (method === 'POST' && path === '/api/save-activity') {
      try {
        const body = await request.json();
        const { entry } = body || {};
        if (entry) {
          state.activity.unshift({ ...entry, createdAt: new Date().toISOString() });
        }
        return json({ ok: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 10. Activity GET
    if (method === 'GET' && path === '/api/activity') {
      const dateKey = url.searchParams.get('date') || '';
      let logs = state.activity;
      if (dateKey) {
        logs = logs.filter(l => l.dateKey === dateKey);
      }
      return json({ ok: true, logs: logs.slice(0, 500) });
    }

    // 11. Handovers GET & POST
    if (method === 'GET' && path === '/api/handovers') {
      const dateKey = url.searchParams.get('date') || '';
      let h = state.handovers;
      if (dateKey) {
        h = h.filter(x => x.dateKey === dateKey);
      }
      return json({ ok: true, handovers: h });
    }

    if (method === 'POST' && path === '/api/save-handover') {
      try {
        const body = await request.json();
        const { entry } = body || {};
        if (entry) {
          state.handovers.unshift({ ...entry, createdAt: new Date().toISOString() });
        }
        return json({ ok: true });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 12. Lookup Mobile GET
    if (method === 'GET' && path === '/api/lookup-mobile') {
      const mobile = (url.searchParams.get('mobile') || '').replace(/\D/g, '').slice(-10);
      if (!mobile) return json({ uid: '', name: '' });
      const found = state.patients.find(p => String(p.mobile || '').replace(/\D/g, '').slice(-10) === mobile);
      if (found) {
        return json({ uid: found.uid || found.visitUid, name: found.name });
      }
      return json({ uid: '', name: '' });
    }

    // 13. Doctor Login POST
    if (method === 'POST' && path === '/api/doctor/login') {
      try {
        const body = await request.json();
        const { pin } = body || {};
        const doctorPin = (state.config && state.config.settings && state.config.settings.doctorPin) || '5678';
        if (pin === doctorPin) {
          return json({ ok: true, token: 'doc_' + GATE_TOKEN, otpEnabled: false });
        }
        return json({ ok: false, error: 'Invalid credentials' }, 401);
      } catch {
        return json({ ok: false, error: 'Invalid sign-in request' }, 400);
      }
    }

    // 14. Doctor TOTP & Telegram
    if (method === 'GET' && path === '/api/doctor/totp') {
      const enabled = !!(state.config && state.config.settings && state.config.settings.doctorTotpSecret);
      return json({ ok: true, enabled });
    }

    if (method === 'GET' && path === '/api/doctor/telegram') {
      const enabled = !!(state.config && state.config.settings && state.config.settings.doctorTelegramBotToken && state.config.settings.doctorTelegramChatId);
      return json({ ok: true, enabled });
    }

    return json({ ok: true, message: 'Endpoint processed' });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
