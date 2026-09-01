/**
 * Client-side site gate — gate.js
 * Checks localStorage for clinic_gate token.
 * If missing, shows a fullscreen password overlay.
 * Once entered correctly, saved for 30 days — no server re-check.
 */
(function () {
  const GATE_KEY    = 'clinic_gate';
  const GATE_EXPIRY = 'clinic_gate_expiry';
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

  // Already authenticated and not expired?
  var saved  = localStorage.getItem(GATE_KEY);
  var expiry = parseInt(localStorage.getItem(GATE_EXPIRY) || '0', 10);
  if (saved && expiry && Date.now() < expiry) {
    // Valid — let page load normally
    return;
  }

  // Expired or missing — clear and show gate
  localStorage.removeItem(GATE_KEY);
  localStorage.removeItem(GATE_EXPIRY);

  function showGate() {
    document.documentElement.style.overflow = 'hidden';

    var overlay = document.createElement('div');
    overlay.id  = 'clinic-gate-overlay';
    overlay.innerHTML = '<style>'
      + '#clinic-gate-overlay{position:fixed;inset:0;z-index:99999;background:linear-gradient(135deg,#eff6ff,#f9fafb);display:flex;align-items:center;justify-content:center;font-family:\'Segoe UI\',Arial,sans-serif;}'
      + '#clinic-gate-overlay .gbox{background:#fff;border:1.5px solid #e5e7eb;border-radius:18px;padding:36px 32px;width:100%;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.08);}'
      + '#clinic-gate-overlay img{width:60px;display:block;margin:0 auto 10px;border-radius:10px;}'
      + '#clinic-gate-overlay h2{text-align:center;font-size:20px;font-weight:800;color:#1a56db;margin-bottom:4px;}'
      + '#clinic-gate-overlay p{text-align:center;font-size:12px;color:#6b7280;margin-bottom:24px;}'
      + '#clinic-gate-overlay input{width:100%;padding:11px 14px;border:1.5px solid #d1d5db;border-radius:10px;font-size:18px;letter-spacing:6px;text-align:center;outline:none;margin-bottom:14px;box-sizing:border-box;}'
      + '#clinic-gate-overlay input:focus{border-color:#1a56db;box-shadow:0 0 0 3px rgba(26,86,219,.1);}'
      + '#clinic-gate-overlay button{width:100%;padding:12px;background:#1a56db;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;}'
      + '#clinic-gate-overlay button:hover{background:#1e40af;}'
      + '#clinic-gate-overlay button:disabled{opacity:.6;cursor:not-allowed;}'
      + '#clinic-gate-overlay .gerr{color:#dc2626;font-size:13px;text-align:center;margin-top:10px;display:none;}'
      + '#clinic-gate-overlay .gspin{text-align:center;margin-top:10px;color:#6b7280;font-size:13px;display:none;}'
      + '</style>'
      + '<div class="gbox">'
      + '<img src="/logo.png" onerror="this.style.display=\'none\'" alt=""/>'
      + '<h2>Dr. RAMGOPAL AGARWAL</h2>'
      + '<p>Diagnostic Clinic \u2014 Management System</p>'
      + '<input type="password" id="gate-pw" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" autocomplete="current-password"/>'
      + '<button id="gate-btn">Enter \u2192</button>'
      + '<div class="gerr" id="gate-err">Wrong password. Try again.</div>'
      + '<div class="gspin" id="gate-spin">Verifying\u2026</div>'
      + '</div>';

    document.body.appendChild(overlay);

    var inp = document.getElementById('gate-pw');
    var btn = document.getElementById('gate-btn');
    inp.focus();
    inp.addEventListener('keydown', function(e){ if(e.key==='Enter') doSubmit(); });
    btn.addEventListener('click', doSubmit);

    function doSubmit() {
      var pw = inp.value.trim();
      if (!pw) return;
      btn.disabled = true;
      document.getElementById('gate-spin').style.display = 'block';
      document.getElementById('gate-err').style.display  = 'none';

      fetch('/api/site-auth', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ password: pw })
      })
      .then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })
      .then(function(res) {
        if (res.ok && res.data.token) {
          // Save token + 30-day expiry to localStorage
          localStorage.setItem(GATE_KEY,    res.data.token);
          localStorage.setItem(GATE_EXPIRY, String(Date.now() + THIRTY_DAYS));
          // Remove overlay and restore page
          overlay.remove();
          document.documentElement.style.overflow = '';
        } else {
          document.getElementById('gate-err').style.display = 'block';
          inp.value = '';
          inp.focus();
          btn.disabled = false;
          document.getElementById('gate-spin').style.display = 'none';
        }
      })
      .catch(function() {
        document.getElementById('gate-err').textContent = 'Network error. Try again.';
        document.getElementById('gate-err').style.display = 'block';
        btn.disabled = false;
        document.getElementById('gate-spin').style.display = 'none';
      });
    }
  }

  // Show gate once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showGate);
  } else {
    showGate();
  }
})();
