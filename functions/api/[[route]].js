// Cloudflare Pages Functions - Full API Router with Complete Master Catalog & B2 Sync
const B2_KEY_ID = '73cca80a9138';
const B2_APP_KEY = '00510e864d367e571142ca5bb102e1279abddfd8a9';
const B2_BUCKET = 'drramgopalclinic-backups';

const SITE_PASS = '89238350030';
const GATE_TOKEN = 'd8dd0037297deb2b150d57376ff98623';

const MASTER_CATALOG = {
  "categories": [
    {
      "label": "Fever Related",
      "items": [
        [
          "CBC (Hb%, TLC, DLC, Platelets) 5 Part",
          200
        ],
        [
          "Malaria (Antigen, Antibody)",
          100
        ],
        [
          "Dengue (NS1Ag, IgG & IgM)",
          600
        ],
        [
          "Widal",
          50
        ],
        [
          "Typhidot",
          300
        ],
        [
          "Eosinophilia",
          100
        ],
        [
          "MX TEST",
          50
        ]
      ]
    },
    {
      "label": "Joint Pain Related",
      "items": [
        [
          "Vit D3",
          1000
        ],
        [
          "Uric Acid",
          100
        ],
        [
          "R.A. Factor Quantative",
          400
        ],
        [
          "HLAB-27",
          700
        ],
        [
          "S.Ca",
          100
        ]
      ]
    },
    {
      "label": "Diabetes Related",
      "items": [
        [
          "HBA1C",
          400
        ],
        [
          "FBS",
          50
        ],
        [
          "RBS",
          50
        ],
        [
          "PPBS",
          50
        ]
      ]
    },
    {
      "label": "Female Related",
      "items": [
        [
          "VDRL",
          100
        ],
        [
          "Torch IgG",
          950
        ],
        [
          "Torch IgM",
          950
        ],
        [
          "Serum Prolaction",
          300
        ],
        [
          "LH",
          300
        ],
        [
          "FSH",
          300
        ],
        [
          "Pragnency Profile",
          550
        ],
        [
          "Pragnency Test",
          50
        ]
      ]
    },
    {
      "label": "Infection Related",
      "items": [
        [
          "CRP",
          400
        ],
        [
          "AFB",
          300
        ],
        [
          "ESR",
          50
        ],
        [
          "T.B. Platinum",
          2500
        ],
        [
          "HIV (I, II)",
          400
        ],
        [
          "Manloux Test",
          50
        ]
      ]
    },
    {
      "label": "Male Related",
      "items": [
        [
          "PSA",
          1000
        ],
        [
          "Semen Test",
          350
        ]
      ]
    },
    {
      "label": "Heart Related",
      "items": [
        [
          "Cholestrol",
          100
        ],
        [
          "Lipid Profile",
          400
        ],
        [
          "ECG",
          400
        ],
        [
          "TropT",
          500
        ],
        [
          "TropI",
          500
        ]
      ]
    },
    {
      "label": "Kidney Related",
      "items": [
        [
          "KFT",
          750
        ],
        [
          "S.Cretanine",
          100
        ],
        [
          "Alpo4",
          100
        ],
        [
          "Urine - R/M",
          50
        ],
        [
          "Blood Urea",
          100
        ],
        [
          "GFR",
          350
        ],
        [
          "S.ELECTROLYTES",
          450
        ]
      ]
    },
    {
      "label": "Thyroid Related",
      "items": [
        [
          "T3, T4, TSH",
          350
        ],
        [
          "TSH",
          200
        ],
        [
          "FT3, FT4, FTSH",
          950
        ]
      ]
    },
    {
      "label": "Ultrasound",
      "items": [
        [
          "Abdomen",
          850
        ],
        [
          "Pregnancy",
          850
        ],
        [
          "Abdomen + Pregnancy",
          1400
        ],
        [
          "Scrotal (Testis)",
          1200
        ],
        [
          "Thyroid",
          1200
        ],
        [
          "Anti N.B. Scan",
          1200
        ],
        [
          "LEVEL 2",
          2000
        ]
      ]
    },
    {
      "label": "X-Ray",
      "items": [
        [
          "Chest",
          400
        ],
        [
          "Soulder",
          400
        ],
        [
          "Elbow",
          400
        ],
        [
          "Wrist",
          400
        ],
        [
          "Hand",
          400
        ],
        [
          "Hip",
          400
        ],
        [
          "Thigh",
          400
        ],
        [
          "Knee",
          400
        ],
        [
          "Ankle",
          400
        ],
        [
          "Lower Leg",
          400
        ],
        [
          "Foot",
          400
        ],
        [
          "P.N.S.",
          400
        ],
        [
          "Skull",
          800
        ],
        [
          "Cervical",
          800
        ],
        [
          "D.L. Spine",
          800
        ],
        [
          "L.S. Spine",
          400
        ],
        [
          "K.U.B. Abdomen",
          400
        ],
        [
          "Dental",
          200
        ],
        [
          "Chest PA",
          400
        ],
        [
          "Knee AP/LAT",
          400
        ],
        [
          "Ankle AP/LAT",
          400
        ],
        [
          "Lower Leg (TIBIA FIBULA)",
          400
        ],
        [
          "Foot AP/LAT",
          400
        ],
        [
          "Skull AP/LAT",
          800
        ],
        [
          "CervicalAP/LAT",
          800
        ],
        [
          "D.L. SpineAP/LAT",
          800
        ],
        [
          "L.S. Spine AP/LAT",
          800
        ],
        [
          "CEST AP",
          400
        ],
        [
          "KNEE STANDING  AP",
          500
        ],
        [
          "SKULL SINGLE VIEW",
          400
        ],
        [
          "SPINE  SINGLE VIEW",
          400
        ],
        [
          "Soulder AP",
          400
        ],
        [
          "Elbow AP/LAT",
          400
        ],
        [
          "Wrist AP/LAT",
          400
        ],
        [
          "Hand AP/LAT",
          400
        ],
        [
          "FACE AP",
          0
        ],
        [
          "NeFACE AP /LAT",
          0
        ]
      ]
    },
    {
      "label": "Other",
      "items": [
        [
          "S.Amytlase",
          500
        ],
        [
          "S.Lipase",
          500
        ],
        [
          "B.Group",
          50
        ],
        [
          "Complete Health Check Up",
          2400
        ],
        [
          "Mini Health Check Up",
          1700
        ],
        [
          "CST OT",
          550
        ],
        [
          "TROP T",
          600
        ],
        [
          "blood group",
          50
        ]
      ]
    },
    {
      "label": "LIVER Related",
      "items": [
        [
          "S-Bilirubin",
          100
        ],
        [
          "SGPT",
          100
        ],
        [
          "SGOT",
          100
        ],
        [
          "LFT",
          400
        ],
        [
          "HBsAg",
          100
        ],
        [
          "HCV",
          450
        ]
      ]
    },
    {
      "label": "Special Blood Tests",
      "items": [
        [
          "Ferritin Serum",
          450
        ],
        [
          "D-Dimer",
          800
        ]
      ]
    },
    {
      "label": "General Radiology",
      "items": [
        [
          "Chest PA View",
          350
        ],
        [
          "Spine AP/LAT",
          700
        ]
      ]
    },
    {
      "label": "New Category",
      "items": [
        [
          "New Test",
          0
        ]
      ]
    }
  ],
  "referrals": [
    "AKIF IQBAL",
    "ARSHAD ALI",
    "BILAL KHAN",
    "CHATURVEDI",
    "CHATURWEDI",
    "City Care Hospital",
    "City Hospital",
    "D.K. YADAV",
    "DEVENDRA SINGH",
    "DR. S.S. Bharadwaj",
    "DR.DILEEP AGARWAL /RADHA AGARWAL",
    "Dr. ARPIT . Rana (BAMS)",
    "Dr. Aash Mohammad (BAMS)",
    "Dr. Abhilasha Srivastav (BAMS)",
    "Dr. AbhilashaSrivastav (BAMS)",
    "Dr. Ashok Dwivedi",
    "Dr. Atif Iqbal (BEMS)",
    "Dr. Atif Iqbal (BUMS)",
    "Dr. D. K. Yadav (BAMS)",
    "Dr. J. V. S. Rana (BAMS)",
    "Dr. K. V. S. Rana (BAMS)",
    "Dr. M. R.Kushwah(BAMS)",
    "Dr. MAYANK RANA",
    "Dr. Pramod Yadav (MBBS)",
    "Dr. Pramod Yadav JASRANA",
    "Dr. Pramod Yadav SKB",
    "Dr. Pravin Kumar Agarwal",
    "Dr. Pravinkumaragarwal",
    "Dr. Priyanka Yadav (BHMS)",
    "Dr. Rakesh Yadav",
    "Dr. Ramesh Chandra",
    "Dr. S. K. Agarwal (MBBS)",
    "Dr. S. K. Sharma (MD)",
    "Dr. Sanjeev Mathur (MBBS)",
    "Dr. Shiv Kumar (BAMS)",
    "Dr. VikramBhadhur(BAMS)",
    "Dr. Vimla Sharma (MBBS, )",
    "Dr. Vimla Sharma (MBBS, MS)",
    "F. S. Hospital",
    "GULABSINGH",
    "Government Hospital (SKB)",
    "Government Hospital (SRD)",
    "IMRAN",
    "KAILASH SHARMA",
    "KRISHNA HOMEOPATHIC CLINIC",
    "LADO AASHA",
    "Life Care Hospital",
    "MAHENDRA  SINGH",
    "MAMTA AUNTY",
    "MATAR DAIRY WALE",
    "MAYA  AUNTY",
    "MAYA ASHA",
    "MEERA DEVI ASHA",
    "MEWARAM",
    "MITHLESH AASHA",
    "MR KUSHWAH",
    "N CHANDRA",
    "N.P SINGH",
    "NARAYAN HOSPITAL",
    "NARENDRA",
    "NARYAN POLY CLINIC",
    "NITEAH SHARMA",
    "PRABAN PRATAP",
    "PRADEEP",
    "PRAVEEN SINGH",
    "PUPPY ASHA",
    "PUSHPA ASHA",
    "Patient don't want to disclose DR.'s name",
    "Purvi Hospital (Jasrana)",
    "R.M. BAGHEL",
    "RAHUL",
    "RAM MOHAN",
    "RAVI",
    "S.S YADAV",
    "SANGEETA MATHUR",
    "SANGEETA VANSAL",
    "SANJAY",
    "SANJAY KUMAR",
    "SELF",
    "SELF.",
    "SELFX",
    "SHAILENDRA",
    "SHELENDRA",
    "SHELESH ASHA",
    "SHIV KUMAR",
    "SNEHLATA ASHA",
    "SONI YADAV",
    "SUNEEL KUMAR",
    "Self",
    "Self / Walk-in",
    "Shree Shyam Hospital",
    "VAISHNAVI CLINIC NASIRPUR",
    "VEEREN AGGARVAL",
    "VINEETA ASHA",
    "VivekPriyaHospital",
    "akif iqbal",
    "jitendra ghiror",
    "self",
    "vinod"
  ],
  "medicines": [
    [
      "ALBIFLAM -FAST",
      16.8
    ],
    [
      "ALVOCIN 500",
      10
    ],
    [
      "Amoxicillin 500mg",
      12
    ],
    [
      "BUAMIT (BUDACORT)RESPULE)",
      27
    ],
    [
      "CANNULA N.24",
      20
    ],
    [
      "CAP. BRONCOMED",
      9
    ],
    [
      "CAP. DR. DIABET",
      6.8
    ],
    [
      "CAP. ELKALYNE",
      8
    ],
    [
      "CAP. FILLREB - LSR",
      20
    ],
    [
      "CAP. LEUCO-EX",
      330
    ],
    [
      "CAP. LYFINE 9G",
      42
    ],
    [
      "CAP. MAXILYF",
      16
    ],
    [
      "CAP. PERFECT SHE",
      9
    ],
    [
      "CAP. PREFORD",
      15.6
    ],
    [
      "CAP. PROSTARITE",
      305
    ],
    [
      "CAP. REBOLTIN - OD",
      16.5
    ],
    [
      "CP.LYNOFOLL - Q 10",
      21
    ],
    [
      "D3 NANO SHOTS",
      65
    ],
    [
      "DISPOVAN",
      10
    ],
    [
      "FIXER",
      10
    ],
    [
      "INJ. ALBIFLAM - FAST",
      16
    ],
    [
      "INJ. ALVOCIN-500",
      115
    ],
    [
      "INJ. DROTAMED",
      26
    ],
    [
      "INJ. FALCIDAC -120",
      475
    ],
    [
      "INJ. GENODEC-50",
      185
    ],
    [
      "INJ. PDVAC 500",
      285
    ],
    [
      "INJ. PHEN- TZ 4.5",
      425
    ],
    [
      "INJ. PULMIKA- 500",
      90
    ],
    [
      "INJ. REBOLTIN- 1500",
      45
    ],
    [
      "INJ. REBOLTIN-PLUS",
      160
    ],
    [
      "INJ. SPASMOMED+PLUS",
      25
    ],
    [
      "INJ.ONDENCETRON",
      25
    ],
    [
      "INJ.PULCID",
      50
    ],
    [
      "L ARGININE PULS LP9 (PULS E)",
      60
    ],
    [
      "LEVOLIN (RESPULE)",
      8
    ],
    [
      "LYNOFOLL - Q 10",
      21
    ],
    [
      "New Medicine",
      0
    ],
    [
      "OIL ALONFLAM",
      95
    ],
    [
      "Pantoprazole 40mg",
      8
    ],
    [
      "Paracetamol 650mg",
      3
    ],
    [
      "PNTOFILL - LS",
      20
    ],
    [
      "PROTIWAR POWDER",
      499
    ],
    [
      "SACHET ARGIVON",
      40
    ],
    [
      "SOFT GEL OSTIRIDE CT",
      10
    ],
    [
      "SPRAY FLUTIREX AZ",
      425
    ],
    [
      "SUCRA RICH 0",
      271
    ],
    [
      "SYP. FILLRED - XT",
      160
    ],
    [
      "SYP. FYNKOF - LS",
      118
    ],
    [
      "SYP. HPTOFILL DS",
      140
    ],
    [
      "SYP. HPTOFILL PLUS",
      225
    ],
    [
      "SYP. LRITLAX PLUS (LAXIMUM)",
      165
    ],
    [
      "SYP. LYCOFILL (MULTIVITAMIN)",
      210
    ],
    [
      "SYP. NARI LATA",
      190
    ],
    [
      "SYP. PERA Q 240",
      90
    ],
    [
      "SYP. ZYM-ZEM PLUS",
      185
    ],
    [
      "SYP.BRONCOMED",
      110
    ],
    [
      "Syrup Cough Care",
      "Based on MRP"
    ],
    [
      "TAB . ACEFYN-SP",
      12.5
    ],
    [
      "TAB . CALCIRUSH",
      225
    ],
    [
      "TAB AEROCORT - B",
      15.5
    ],
    [
      "TAB. ACEVNO PLUS",
      5.5
    ],
    [
      "TAB. ACYPROVE 400 (ACICLOVER",
      15
    ],
    [
      "TAB. AKT3",
      22.15
    ],
    [
      "TAB. AKURIT 4",
      11
    ],
    [
      "TAB. ATREST 25",
      5
    ],
    [
      "TAB. BENADON",
      3
    ],
    [
      "TAB. CROCIN ADVANCE",
      1
    ],
    [
      "TAB. DEZAPHEN 6 (DEFLAZACORT)",
      13
    ],
    [
      "TAB. DIMETAS 1 MG",
      5
    ],
    [
      "TAB. DOXYNOL PLUS",
      7
    ],
    [
      "TAB. DROFILL - P",
      6.5
    ],
    [
      "TAB. DROFILL - SPAS",
      1720
    ],
    [
      "TAB. DROFILL M",
      6.5
    ],
    [
      "TAB. ENZOFINE D",
      20
    ],
    [
      "TAB. FAROMAP 200",
      130
    ],
    [
      "TAB. FEXOFINE- M PULSE",
      18
    ],
    [
      "TAB. FEXOWAR 180",
      24.5
    ],
    [
      "TAB. FILLROX -500",
      55
    ],
    [
      "TAB. FLOXFILL OZ",
      9
    ],
    [
      "TAB. HYDROVON 25",
      5.5
    ],
    [
      "TAB. LINZOPHEN 600",
      37
    ],
    [
      "TAB. MEBASTAR",
      135
    ],
    [
      "TAB. NEOCEF-O PLUS",
      23
    ],
    [
      "TAB. OVOFYN",
      450
    ],
    [
      "TAB. PODOWAL-100 DT",
      17
    ],
    [
      "TAB. PULZIME CS",
      10.5
    ],
    [
      "TAB. PZA",
      7
    ],
    [
      "TAB. RIFVON -200",
      20
    ],
    [
      "TAB. SEDOXIM - 200 (CEFPOBOXIME)",
      21
    ],
    [
      "TAB. SICLOFILL SP",
      12
    ],
    [
      "TAB. SPASMO PROXIVON",
      10
    ],
    [
      "TAB. STILCOX 90 (ETORICOXIB )",
      11
    ],
    [
      "TAB. SYFFO -200 LB",
      14.5
    ],
    [
      "TAB. THOROMOX LB 625",
      48
    ],
    [
      "TAB. TRYBOPHEN-AP",
      16
    ],
    [
      "TAB. UDIFILL 300",
      40
    ],
    [
      "TAB. VASOGRAIN",
      11
    ],
    [
      "TAB.AZIFIL.500",
      25
    ],
    [
      "TAB.CINADRON PLUS (STUGERON PLUS)",
      13
    ],
    [
      "TAB.CROMIDE FOTE(CLIDINUM)",
      3
    ],
    [
      "TAB.FILLRED -XT",
      14
    ],
    [
      "TAB.FLUGYL 150",
      13
    ],
    [
      "TAB.GLIMPEX M2",
      14
    ],
    [
      "TAB.MIRABRON 25 XL",
      29
    ],
    [
      "TAB.MUCORIST AB",
      27
    ],
    [
      "TAB.TELVAS-CT 40",
      10
    ],
    [
      "TAB.TEMSUJOHN -D",
      22
    ],
    [
      "TAB.THEOMOX LB 625",
      48
    ],
    [
      "TAB.VETIGO 16 MG",
      21
    ],
    [
      "TAB.VIDAMET -M",
      15
    ]
  ],
  "updatedAt": "2026-09-01T17:22:32.621Z"
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
      // Always enforce master catalog with all 110 medicines, 110 tests, and 99 referrals
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
