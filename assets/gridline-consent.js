/* ============================================================
   GRIDLINE — Cookie-/Einwilligungs-Banner
   ------------------------------------------------------------
   Google AdSense setzt Cookies und verarbeitet Nutzerdaten fuer
   Werbung. Nach DSGVO/TTDSG darf das erst nach einer aktiven
   Einwilligung passieren. Dieses Skript laedt AdSense deshalb
   NICHT automatisch, sondern erst:

     * "Alle akzeptieren"  -> AdSense mit personalisierter Werbung
     * "Nur notwendige"    -> AdSense nur mit NICHT-personalisierter
                              Werbung (requestNonPersonalizedAds)

   Technisch notwendige Speicherung (Login-Session, Spielstand im
   localStorage) laeuft ohne Einwilligung - dafuer gibt es die
   gesetzliche Ausnahme, sie ist fuer den Dienst erforderlich.

   Einbinden (statt des direkten AdSense-Tags):
     <script src="assets/gridline-consent.js" defer></script>
   ============================================================ */
(function (global) {
	'use strict';

	var STORAGE_KEY = 'gridline_consent_v1';
	var ADS_CLIENT = 'ca-pub-2540143321826138';
	var ADS_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS_CLIENT;

	function read() {
		try {
			var raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			var val = JSON.parse(raw);
			// Einwilligung laeuft nach 12 Monaten ab und wird neu abgefragt.
			if (!val || !val.ts || Date.now() - val.ts > 365 * 24 * 3600 * 1000) return null;
			return val;
		} catch (e) { return null; }
	}

	function write(level) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ level: level, ts: Date.now() }));
		} catch (e) {}
	}

	var adsLoaded = false;

	function injectAds(personalized) {
		global.adsbygoogle = global.adsbygoogle || [];
		if (!personalized) global.adsbygoogle.requestNonPersonalizedAds = 1;
		var s = document.createElement('script');
		s.async = true;
		s.src = ADS_SRC;
		s.crossOrigin = 'anonymous';
		document.head.appendChild(s);
	}

	/* AdSense ist schwer und zieht selbst wieder etliche Dateien nach. Es wird
	   deshalb erst gestartet, wenn die Seite fertig geladen ist und der Browser
	   Leerlauf hat - so konkurriert die Werbung nie mit dem eigentlichen Inhalt
	   um Bandbreite und Rechenzeit. */
	function loadAds(personalized) {
		if (adsLoaded) return;
		adsLoaded = true;

		var start = function () {
			var idle = global.requestIdleCallback || function (fn) { setTimeout(fn, 300); };
			idle(function () { injectAds(personalized); }, { timeout: 3000 });
		};

		if (document.readyState === 'complete') start();
		else global.addEventListener('load', start);
	}

	function apply(level) {
		if (level === 'all') loadAds(true);
		else if (level === 'essential') loadAds(false);
	}

	function ensureStylesheet() {
		if (document.querySelector('link[href*="gridline-site.css"]') ||
			document.getElementById('gc-fallback-style')) return;
		// Auf Spielseiten ohne das gemeinsame Stylesheet: Minimal-Styles nachliefern.
		var s = document.createElement('style');
		s.id = 'gc-fallback-style';
		s.textContent = [
			'.gc-banner{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);',
			'width:min(620px,calc(100vw - 28px));background:#0c1a27;border:1px solid #24405a;border-radius:14px;',
			'padding:20px 22px;z-index:100000;box-shadow:0 22px 50px #00000090;color:#e9f2fb;',
			'font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif}',
			'.gc-banner h3{margin:0 0 8px;font-size:16px}',
			'.gc-banner p{margin:0 0 14px;font-size:13px;line-height:1.65;color:#b9cddf}',
			'.gc-banner a{color:#58d7ff}',
			'.gc-actions{display:flex;flex-wrap:wrap;gap:9px}',
			'.gc-btn{flex:1 1 auto;min-width:140px;padding:11px 16px;border-radius:10px;border:1px solid #24405a;',
			'background:#15344d;color:#dceaf7;font:700 12.5px/1 inherit;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}',
			'.gc-btn.primary{background:#1f6d4f;border-color:#3ad18b;color:#eafff5}'
		].join('');
		document.head.appendChild(s);
	}

	function base() {
		// Rechtstexte liegen im Wurzelverzeichnis; Spiele auch. Relativer Pfad reicht.
		return '';
	}

	function showBanner() {
		ensureStylesheet();
		var el = document.createElement('div');
		el.className = 'gc-banner';
		el.setAttribute('role', 'dialog');
		el.setAttribute('aria-label', 'Cookie-Einstellungen');
		el.innerHTML = [
			'<h3>Cookies &amp; Werbung</h3>',
			'<p>Diese Seite finanziert sich über Google AdSense. Dafür werden Cookies gesetzt ',
			'und Daten an Google übermittelt. Technisch notwendige Speicherung (z.&nbsp;B. dein Login ',
			'und deine Spielstände) nutzen wir auch ohne Einwilligung. ',
			'Details in der <a href="' + base() + 'datenschutz.html">Datenschutzerklärung</a>.</p>',
			'<div class="gc-actions">',
			'  <button class="gc-btn" data-gc="essential">Nur notwendige</button>',
			'  <button class="gc-btn primary" data-gc="all">Alle akzeptieren</button>',
			'</div>'
		].join('');
		document.body.appendChild(el);

		el.addEventListener('click', function (ev) {
			var btn = ev.target.closest('[data-gc]');
			if (!btn) return;
			var level = btn.getAttribute('data-gc');
			write(level);
			el.remove();
			apply(level);
		});
	}

	function init() {
		var saved = read();
		if (saved) { apply(saved.level); return; }
		if (document.body) showBanner();
		else document.addEventListener('DOMContentLoaded', showBanner);
	}

	global.GridlineConsent = {
		/** Aktuelle Einwilligung: 'all' | 'essential' | null */
		get: function () { var v = read(); return v ? v.level : null; },
		/** Banner erneut anzeigen, z.B. aus dem Footer-Link "Cookie-Einstellungen". */
		reopen: function () {
			try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
			if (!document.querySelector('.gc-banner')) showBanner();
		}
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})(window);
