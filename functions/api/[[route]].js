// Cloudflare Pages Functions - Full API Router with Complete Master Catalog & B2 Sync
const B2_KEY_ID = '73cca80a9138';
const B2_APP_KEY = '00510e864d367e571142ca5bb102e1279abddfd8a9';
const B2_BUCKET = 'drramgopalclinic-backups';

const SITE_PASS = '89238350030';
const GATE_TOKEN = 'd8dd0037297deb2b150d57376ff98623';

const MASTER_CATALOG = {
  categories: [
    {
      label: "Fever Related",
      items: [
        ["CBC (Hb%, TLC, DLC, Platelets) 5 Part", 200],
        ["Malaria (Antigen, Antibody)", 100],
        ["Dengue (NS1Ag, IgG & IgM)", 600],
        ["Widal", 50],
        ["Typhidot", 300],
        ["Urine - R/M", 50]
      ]
    },
    {
      label: "Pelia Related",
      items: [
        ["S-Bilirubin", 100],
        ["SGPT", 100],
        ["SGOT", 100],
        ["LFT", 450],
        ["HBsAg", 100],
        ["HCV", 150]
      ]
    },
    {
      label: "Joint Pain Related",
      items: [
        ["Vit D3", 1000],
        ["CRP", 400],
        ["Uric Acid", 100],
        ["R.A. Factor Quantative", 400],
        ["HLAB-27", 700],
        ["S. Calcium", 100]
      ]
    },
    {
      label: "Diabetes Related",
      items: [
        ["HBA1C", 400],
        ["FBS", 50],
        ["RBS", 50],
        ["PPBS", 50]
      ]
    },
    {
      label: "Female Related",
      items: [
        ["VDRL", 100],
        ["Torch IgG", 950],
        ["Torch IgM", 950],
        ["Serum Prolaction", 300],
        ["LH", 300],
        ["FSH", 300],
        ["Dual Marker", 1800],
        ["Quadruple Marker", 2500]
      ]
    },
    {
      label: "Infection Related",
      items: [
        ["AFB", 300],
        ["CRP", 400],
        ["ESR", 50],
        ["T.B. Platinum", 2500],
        ["HIV (I, II)", 400],
        ["Mantoux", 100]
      ]
    },
    {
      label: "Male Related",
      items: [
        ["PSA", 1000],
        ["Semen Test", 350]
      ]
    },
    {
      label: "Heart Related",
      items: [
        ["Cholestrol", 100],
        ["Lipid Profile", 400],
        ["ECG", 400],
        ["TropT", 500],
        ["TropI", 500]
      ]
    },
    {
      label: "Kidney Related",
      items: [
        ["KFT", 750],
        ["S.Cretanine", 100],
        ["Alpo4", 100],
        ["Urine - R/M", 50],
        ["Blood Urea", 100]
      ]
    },
    {
      label: "Thyroid Related",
      items: [
        ["T3, T4, TSH", 350],
        ["TSH", 200],
        ["FT3, FT4, FTSH", 950]
      ]
    },
    {
      label: "Other",
      items: [
        ["S.Amytlase", 500],
        ["S.Lipase", 500],
        ["B.Group", 50],
        ["Complete Health Check Up", 2500],
        ["Mini Health Check Up", 1700],
        ["Pragnency Profile", 850]
      ]
    },
    {
      label: "Ultrasound",
      items: [
        ["Abdomen", 850],
        ["Pregnancy", 850],
        ["Abdomen + Pregnancy", 1300],
        ["Scrotal (Testis)", 1000],
        ["Thyroid", 1200],
        ["Other (USG)", 1000]
      ]
    },
    {
      label: "X-Ray",
      items: [
        ["Chest", 400],
        ["Soulder", 400],
        ["Elbow", 400],
        ["Wrist", 400],
        ["Hand", 400],
        ["Cervical Spine", 400],
        ["Dorsal Spine", 400],
        ["Lumbar Spine", 400],
        ["L.S. Spine", 400],
        ["Pelvis", 400],
        ["Hip", 400],
        ["Thigh (Femur)", 400],
        ["Knee", 400],
        ["Lower Leg", 400],
        ["Ankle", 400],
        ["Foot", 400],
        ["Heel", 400],
        ["Abdomen (KUB)", 400]
      ]
    }
  ],
  referrals: [
    "Dr. D. K. Yadav (BAMS)",
    "Dr. M. R.Kushwah(BAMS)",
    "Dr. Vimla Sharma (MBBS, MS)",
    "Dr. S. K. Agarwal (MBBS)",
    "VivekPriyaHospital",
    "Dr. Priyanka Yadav (BHMS)",
    "Dr. AbhilashaSrivastav (BAMS)",
    "Dr. Atif Iqbal (BEMS)",
    "Dr. Aash Mohammad (BAMS)",
    "Dr. K. V. S. Rana (BAMS)",
    "Dr. Sanjeev Mathur (MBBS)",
    "Dr. Anuj Sharma (BAMS)",
    "Dr. B. K. Singh (BAMS)",
    "Dr. P. K. Gupta (MBBS)",
    "Dr. R. K. Yadav (BAMS)",
    "Dr. Sudhir Kumar (MBBS)",
    "Dr. N. P. Singh (BAMS)",
    "City Hospital",
    "Government Hospital (SKB)",
    "NARAYAN HOSPITAL",
    "NARYAN POLY CLINIC",
    "KRISHNA HOMEOPATHIC CLINIC",
    "VAISHNAVI CLINIC NASIRPUR",
    "MATAR DAIRY WALE",
    "MR KUSHWAH",
    "S.S YADAV",
    "MAHENDRA SINGH",
    "Self"
  ],
  medicines: [
    ["Paracetamol 650mg", 3],
    ["Amoxicillin 500mg", 12],
    ["Pantoprazole 40mg", 8],
    ["Syrup Cough Care", "Based on MRP"],
    ["SACHET ARGIVON", "Based on MRP"],
    ["SYP.BRONCOMED", "Based on MRP"],
    ["TAB. FLOXFILL OZ", "Based on MRP"],
    ["TAB. SICLOFILL SP", "Based on MRP"],
    ["TAB.MUCORIST AB", "Based on MRP"]
  ],
  updatedAt: new Date().toISOString()
};

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
      currency: 'Rs.',
      doctorTotpSecret: 'YFBBKHJXSUJXBDQQ4V6JQEMBYNMU6EPW',
      doctorTelegramBotToken: '8905952844:AAHEiRV4h1v91kgKkphXvy498EN2ypAjqF0',
      doctorTelegramChatId: '6982728370'
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
    catalog: MASTER_CATALOG,
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
          if (snapshot.config && snapshot.config.settings) {
            state.config.settings = { ...state.config.settings, ...snapshot.config.settings };
          }
          if (snapshot.config && Array.isArray(snapshot.config.managers) && snapshot.config.managers.length) {
            state.config.managers = snapshot.config.managers;
          }
        }
      }
      // Always enforce master catalog with all 13 categories (81 tests), 28 referrals and all medicines
      state.config.catalog = {
        categories: MASTER_CATALOG.categories,
        referrals: MASTER_CATALOG.referrals,
        medicines: MASTER_CATALOG.medicines,
        updatedAt: new Date().toISOString()
      };
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
  const { request } = context;
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return corsOptions();

  const url = new URL(request.url);
  const path = url.pathname;

  // Hydrate state
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
        patientsCount: state.patients.length,
        servicesCount: state.config.catalog.categories.reduce((s, c) => s + c.items.length, 0),
        medicinesCount: state.config.catalog.medicines.length,
        referralsCount: state.config.catalog.referrals.length,
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

    // 5. Catalog GET & POST (Services, Referrals, Medicines)
    if (method === 'GET' && path === '/api/catalog') {
      return json(state.config.catalog || MASTER_CATALOG);
    }

    if (method === 'POST' && path === '/api/save-medicines') {
      try {
        const body = await request.json();
        const { medicines } = body || {};
        if (Array.isArray(medicines)) {
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
