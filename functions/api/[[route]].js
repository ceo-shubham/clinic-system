const SITE_PASS = '89238350030';
const GATE_TOKEN = 'd8dd0037297deb2b150d57376ff98623';

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

  try {
    // 1. Site Auth
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
      return json({ ok: true, server: 'CLINIC', version: '2.0', time: new Date().toISOString() });
    }

    // 4. Config
    if (method === 'GET' && path === '/api/config') {
      return json({ config: DEFAULT_CONFIG });
    }

    if (method === 'POST' && path === '/api/config') {
      try {
        const body = await request.json();
        const { config } = body || {};
        return json({ ok: true, config: config || DEFAULT_CONFIG });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 5. Catalog
    if (method === 'GET' && path === '/api/catalog') {
      return json({ services: [], referrals: [], medicines: [], updatedAt: new Date().toISOString() });
    }

    // 6. Patients GET
    if (method === 'GET' && path === '/api/patients') {
      return json({ patients: [], deletedUids: [] });
    }

    // 7. Save Patient POST
    if (method === 'POST' && path === '/api/save-patient') {
      try {
        const body = await request.json();
        const { patient } = body || {};
        return json({ ok: true, saved: patient });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // 8. Delete Patient POST
    if (method === 'POST' && path === '/api/delete-patient') {
      return json({ ok: true });
    }

    // 9. Save Activity POST
    if (method === 'POST' && path === '/api/save-activity') {
      return json({ ok: true });
    }

    // 10. Activity GET
    if (method === 'GET' && path === '/api/activity') {
      return json({ ok: true, logs: [] });
    }

    // 11. Doctor Login POST
    if (method === 'POST' && path === '/api/doctor/login') {
      try {
        const body = await request.json();
        const { pin } = body || {};
        const doctorPin = DEFAULT_CONFIG.settings.doctorPin || '5678';
        if (pin === doctorPin) {
          return json({ ok: true, token: 'doc_' + GATE_TOKEN, otpEnabled: false });
        }
        return json({ ok: false, error: 'Invalid credentials' }, 401);
      } catch {
        return json({ ok: false, error: 'Invalid sign-in request' }, 400);
      }
    }

    // Fallback for any other API route
    return json({ ok: true, message: 'Route handled' });
  } catch (err) {
    return json({ ok: false, error: err.message }, 500);
  }
}
