/* ============================================================
   GRIDLINE — Anzeigenflaechen
   ------------------------------------------------------------
   Bisher wurde zwar das AdSense-Skript geladen, es gab aber auf der
   ganzen Seite kein einziges <ins class="adsbygoogle">-Element. Damit
   konnte nie eine Anzeige erscheinen.

   Dieses Modul fuellt jeden Container <div data-ad="name"> mit einer
   responsiven Anzeige.

   ------------------------------------------------------------
   EINRICHTUNG (einmalig, in deinem AdSense-Konto)

   Zwei Wege - einer genuegt:

   A) Automatische Anzeigen (am einfachsten)
      AdSense -> Anzeigen -> Nach Website -> grid-line.de -> Automatische
      Anzeigen einschalten. Google platziert dann selbst. Dafuer muss
      unten AUTO_ADS auf true stehen; Anzeigenblöcke sind nicht noetig.

   B) Feste Blöcke (mehr Kontrolle, empfohlen)
      AdSense -> Anzeigen -> Nach Anzeigenblock -> Display-Anzeige,
      "Responsiv" waehlen, Namen vergeben, erstellen. Google zeigt dann
      einen Code mit data-ad-slot="1234567890". Diese Nummer unten bei
      SLOTS eintragen. Für jeden Platz einen eigenen Block anlegen.

   Solange keine Nummer eingetragen ist, wird der Platz einfach
   uebersprungen - Besucher sehen keine leeren Kaesten.
   ------------------------------------------------------------

   WICHTIG: Anzeigen laden erst nach der Cookie-Einwilligung. Das steuert
   assets/gridline-consent.js, hier wird nur darauf gewartet.
   ============================================================ */
(function (global) {
	'use strict';

	var CLIENT = 'ca-pub-2540143321826138';

	/* Automatische Anzeigen von Google platzieren lassen.
	   Muss zusaetzlich im AdSense-Konto eingeschaltet sein. */
	var AUTO_ADS = true;

	/* Feste Anzeigenblöcke. Trage hier die data-ad-slot-Nummern aus deinem
	   AdSense-Konto ein. Leer lassen heisst: dieser Platz bleibt frei. */
	var SLOTS = {
		'startseite-unten': '',   // Startseite, unter der Spieleliste
		'spiel-seitlich':   '',   // Casino und Quiz, rechte Spalte
		'spiel-unten':      '',   // unter dem Spielbereich
		'rechtstext-unten': ''    // Impressum, Datenschutz, AGB, Jugendschutz
	};

	/* Mindesthoehe pro Platz, damit die Seite beim Einblenden nicht springt. */
	var MIN_HEIGHT = {
		'startseite-unten': 280,
		'spiel-seitlich':   250,
		'spiel-unten':      280,
		'rechtstext-unten': 250
	};

	var CSS = [
		'.gl-ad{margin:26px auto;text-align:center;max-width:100%;overflow:hidden}',
		'.gl-ad-lbl{font:600 9.5px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;',
		'letter-spacing:.16em;text-transform:uppercase;color:#6d7f91;opacity:.65;margin-bottom:6px}',
		'.gl-ad ins{display:block}',
		'.gl-ad-dev{border:1px dashed #3a5570;border-radius:10px;padding:26px 14px;color:#7d95ac;',
		'font:600 12px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;background:#0d1a26}',
		'.gl-ad-dev code{color:#ffd166;font-size:11px}'
	].join('');

	function injectCSS() {
		if (document.getElementById('gl-ad-style')) return;
		var s = document.createElement('style');
		s.id = 'gl-ad-style';
		s.textContent = CSS;
		(document.head || document.documentElement).appendChild(s);
	}

	var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';

	function fill(box) {
		if (box.dataset.glFilled) return;
		var name = box.getAttribute('data-ad') || '';
		var slot = SLOTS[name];

		if (!slot) {
			// Ohne Blocknummer nichts anzeigen. Beim lokalen Entwickeln aber
			// sichtbar machen, damit man die Plaetze im Layout sieht.
			if (isLocal) {
				box.dataset.glFilled = '1';
				box.className = 'gl-ad';
				box.innerHTML = '<div class="gl-ad-dev">Anzeigenplatz <code>' + name +
					'</code><br>Noch keine Blocknummer in assets/gridline-ads.js hinterlegt.</div>';
			}
			return;
		}

		box.dataset.glFilled = '1';
		box.className = 'gl-ad';
		var minH = MIN_HEIGHT[name] || 250;

		var lbl = document.createElement('div');
		lbl.className = 'gl-ad-lbl';
		lbl.textContent = 'Anzeige';

		var ins = document.createElement('ins');
		ins.className = 'adsbygoogle';
		ins.style.display = 'block';
		ins.style.minHeight = minH + 'px';
		ins.setAttribute('data-ad-client', CLIENT);
		ins.setAttribute('data-ad-slot', slot);
		ins.setAttribute('data-ad-format', 'auto');
		ins.setAttribute('data-full-width-responsive', 'true');

		box.appendChild(lbl);
		box.appendChild(ins);

		try {
			(global.adsbygoogle = global.adsbygoogle || []).push({});
		} catch (e) {
			console.warn('[GridlineAds] Anzeige konnte nicht angefordert werden:', e.message);
		}
	}

	function fillAll() {
		injectCSS();
		document.querySelectorAll('[data-ad]').forEach(fill);
	}

	function enableAutoAds() {
		if (!AUTO_ADS) return;
		try {
			(global.adsbygoogle = global.adsbygoogle || []).push({
				google_ad_client: CLIENT,
				enable_page_level_ads: true
			});
		} catch (e) {}
	}

	function start() {
		enableAutoAds();
		fillAll();
		// Spaeter eingefuegte Plaetze (z.B. beim Spielwechsel) mitnehmen.
		if (global.MutationObserver) {
			new MutationObserver(function () { fillAll(); })
				.observe(document.body, { childList: true, subtree: true });
		}
	}

	/* Erst nach der Einwilligung. Ohne Zustimmung wird gar nichts geladen. */
	function waitForConsent() {
		var level = global.GridlineConsent && global.GridlineConsent.get();
		if (level) { start(); return; }
		document.addEventListener('gridline-consent', function () { start(); }, { once: true });
	}

	global.GridlineAds = {
		/** Platz nachtraeglich fuellen, z.B. nach dem Aufbau eines Spiels. */
		refresh: fillAll,
		/** Sind Blocknummern hinterlegt? */
		configured: function () {
			return Object.keys(SLOTS).some(function (k) { return !!SLOTS[k]; });
		}
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', waitForConsent);
	} else {
		waitForConsent();
	}
})(window);
