/* ============================================================
   GRIDLINE — Zentrales Account-System
   ------------------------------------------------------------
   Ein gemeinsamer Firebase-Account fuer alle Spiele der Seite.

   Firebase Auth persistiert pro Origin im localStorage. Da alle
   Spiele unter derselben Domain laufen und dieselbe Firebase-App
   (gridline-bf8c9) verwenden, ist ein Login auf der Startseite
   automatisch auch in jedem Spiel aktiv - und umgekehrt.

   Bestehende Accounts bleiben unveraendert: es werden exakt die
   gleichen Collections benutzt, die der GT3 Web Racer schon nutzt
   ('users' fuer das Profil, 'usernames' fuer die Namensreservierung).

   Einbinden:
     <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
     <script src="assets/gridline-account.js"></script>

   API:
     GridlineAccount.ready                -> Promise, erfuellt nach erstem Auth-State
     GridlineAccount.user                 -> Firebase-User oder null
     GridlineAccount.profile              -> { username, displayName, ... } oder null
     GridlineAccount.isLoggedIn()         -> boolean
     GridlineAccount.openLogin()          -> Login-Dialog oeffnen
     GridlineAccount.logout()             -> abmelden
     GridlineAccount.requireLogin(msg)    -> Promise<boolean>, oeffnet Dialog wenn noetig
     GridlineAccount.onChange(fn)         -> fn(user, profile) bei jeder Aenderung
     GridlineAccount.mountChip(el)        -> Account-Chip in ein Element rendern
   ============================================================ */
(function (global) {
	'use strict';

	var FB_CONFIG = {
		apiKey: 'AIzaSyDDDE9UVtMn40kGTm4R3-1uSoPQKoOPofk',
		authDomain: 'gridline-bf8c9.firebaseapp.com',
		projectId: 'gridline-bf8c9',
		storageBucket: 'gridline-bf8c9.firebasestorage.app',
		messagingSenderId: '907704359886',
		appId: '1:907704359886:web:5f123aa225fa78293f699f'
	};

	if (typeof firebase === 'undefined') {
		console.error('[GridlineAccount] Firebase SDK fehlt - Account-System inaktiv.');
		global.GridlineAccount = {
			ready: Promise.resolve(null),
			user: null,
			profile: null,
			isLoggedIn: function () { return false; },
			openLogin: function () {},
			logout: function () {},
			requireLogin: function () { return Promise.resolve(false); },
			onChange: function () {},
			mountChip: function () {}
		};
		return;
	}

	// Bereits initialisierte App wiederverwenden (Spiele initialisieren teils selbst).
	var app = firebase.apps && firebase.apps.length
		? firebase.app()
		: firebase.initializeApp(FB_CONFIG);
	var auth = firebase.auth();
	var db = firebase.firestore();

	var USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

	var state = {
		user: null,
		profile: null,
		resolved: false
	};
	var listeners = [];
	var readyResolve;
	var ready = new Promise(function (res) { readyResolve = res; });

	/* ---------------------------------------------------------
	   Styles
	   --------------------------------------------------------- */
	var CSS = [
		'.ga-chip{display:inline-flex;align-items:center;gap:8px;border:1px solid #2a2a30;',
		'background:transparent;color:inherit;border-radius:6px;padding:5px 12px 5px 5px;',
		'font:600 13px/1 inherit;cursor:pointer;transition:.15s}',
		'.ga-chip:hover{background:#1c1c20;border-color:#3a3a41}',
		'.ga-chip-av{width:24px;height:24px;border-radius:4px;display:grid;place-items:center;',
		'background:#2a2a30;color:#eceae6;font-weight:700;font-size:11px;flex:none}',
		'.ga-chip-name{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
		'.ga-menu{position:absolute;right:0;top:calc(100% + 8px);min-width:210px;background:#141417;',
		'border:1px solid #2a2a30;border-radius:6px;padding:6px;z-index:1200;display:none}',
		'.ga-menu.open{display:block}',
		'.ga-menu-head{padding:10px 12px 8px;border-bottom:1px solid #1e1e22;margin-bottom:6px}',
		'.ga-menu-name{font-weight:700;font-size:14px;color:#eceae6;word-break:break-all}',
		'.ga-menu-mail{font-size:11px;color:#8d8880;word-break:break-all;margin-top:2px}',
		'.ga-menu-item{display:block;width:100%;text-align:left;background:none;border:0;color:#c6c2bc;',
		'padding:9px 12px;border-radius:4px;font:600 13px/1.2 inherit;cursor:pointer;text-decoration:none}',
		'.ga-menu-item:hover{background:#1c1c20;color:#fff}',
		'.ga-menu-item.danger{color:#ff6b5a}',
		'.ga-menu-item.danger:hover{background:#2a1512}',
		'.ga-wrap{position:relative;display:inline-block}',
		'.ga-overlay{position:fixed;inset:0;background:#070708e6;',
		'display:none;place-items:center;z-index:2000;padding:18px;overflow-y:auto}',
		'.ga-overlay.open{display:grid}',
		'.ga-modal{width:min(400px,100%);background:#141417;border:1px solid #2a2a30;border-radius:6px;',
		'padding:26px;color:#eceae6;',
		'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}',
		'.ga-modal h2{margin:0 0 6px;font-size:20px;letter-spacing:-.015em;font-weight:700}',
		'.ga-modal .ga-sub{margin:0 0 20px;font-size:13px;color:#8d8880;line-height:1.6}',
		'.ga-field{width:100%;padding:11px 13px;margin-bottom:10px;border-radius:6px;border:1px solid #2a2a30;',
		'background:#0c0c0e;color:#eceae6;font-size:14px;font-family:inherit}',
		'.ga-field:focus{outline:none;border-color:#5a5a64}',
		'.ga-btn{width:100%;padding:12px;border-radius:6px;border:1px solid #eceae6;background:#eceae6;',
		'color:#0c0c0e;font:600 13.5px/1 inherit;cursor:pointer;',
		'margin-bottom:9px;font-family:inherit}',
		'.ga-btn:hover:not(:disabled){background:#fff;border-color:#fff}',
		'.ga-btn:disabled{opacity:.5;cursor:not-allowed}',
		'.ga-btn.ghost{background:transparent;border-color:#2a2a30;color:#eceae6}',
		'.ga-btn.ghost:hover:not(:disabled){background:#1c1c20;border-color:#3a3a41}',
		'.ga-btn.google{background:transparent;border-color:#2a2a30;color:#eceae6;display:flex;align-items:center;',
		'justify-content:center;gap:9px;font-size:14px}',
		'.ga-btn.google:hover:not(:disabled){background:#1c1c20;border-color:#3a3a41}',
		'.ga-link{background:none;border:0;color:#8d8880;font:600 12.5px/1.4 inherit;cursor:pointer;',
		'padding:6px 0;text-decoration:underline;font-family:inherit}',
		'.ga-sep{display:flex;align-items:center;gap:10px;margin:16px 0;color:#6d6862;font-size:10.5px;',
		'letter-spacing:.14em;text-transform:uppercase}',
		'.ga-sep::before,.ga-sep::after{content:"";flex:1;height:1px;background:#1e1e22}',
		'.ga-err{color:#ff6b5a;font-size:12.5px;min-height:17px;margin-bottom:8px;line-height:1.4}',
		'.ga-ok{color:#6fbf8b}',
		'.ga-legal{margin-top:16px;font-size:11px;color:#6d6862;line-height:1.7;text-align:center}',
		'.ga-legal a{color:#8d8880}'
	].join('');

	function injectCSS() {
		if (document.getElementById('ga-style')) return;
		var s = document.createElement('style');
		s.id = 'ga-style';
		s.textContent = CSS;
		(document.head || document.documentElement).appendChild(s);
	}

	/* ---------------------------------------------------------
	   Modal
	   --------------------------------------------------------- */
	var els = null;

	function buildModal() {
		if (els) return els;
		injectCSS();

		var ov = document.createElement('div');
		ov.className = 'ga-overlay';
		ov.innerHTML = [
			'<div class="ga-modal" role="dialog" aria-modal="true">',
			'  <div data-view="auth">',
			'    <h2 data-el="title">Anmelden</h2>',
			'    <p class="ga-sub" data-el="sub">Ein Account für alle Spiele auf Gridline.</p>',
			'    <button class="ga-btn google" data-el="google">',
			'      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.9 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7.2-10.2 7.2-17.4z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>',
			'      <span>Mit Google fortfahren</span>',
			'    </button>',
			'    <div class="ga-sep">oder</div>',
			'    <input class="ga-field" type="email" data-el="email" placeholder="E-Mail" autocomplete="email">',
			'    <input class="ga-field" type="password" data-el="pw" placeholder="Passwort" autocomplete="current-password">',
			'    <div class="ga-err" data-el="err"></div>',
			'    <button class="ga-btn" data-el="submit">Anmelden</button>',
			'    <button class="ga-btn ghost" data-el="close">Abbrechen</button>',
			'    <div style="text-align:center">',
			'      <button class="ga-link" data-el="toggle">Noch kein Konto? Registrieren</button><br>',
			'      <button class="ga-link" data-el="reset">Passwort vergessen?</button>',
			'    </div>',
			'    <p class="ga-legal">Mit dem Fortfahren akzeptierst du die',
			'      <a href="agb.html" target="_blank">AGB</a> und die',
			'      <a href="datenschutz.html" target="_blank">Datenschutzerklärung</a>.<br>',
			'      Ein Konto kannst du ab 16 Jahren anlegen; das Casino-Spiel ist erst ab 18.</p>',
			'  </div>',
			'  <div data-view="username" style="display:none">',
			'    <h2>Spielername wählen</h2>',
			'    <p class="ga-sub">Unter diesem Namen erscheinst du in Bestenlisten und im Multiplayer. 3–20 Zeichen, nur Buchstaben, Zahlen und _.</p>',
			'    <input class="ga-field" data-el="uname" placeholder="z.B. SpeedRacer_99" maxlength="20" autocomplete="off">',
			'    <div class="ga-err" data-el="unameErr"></div>',
			'    <button class="ga-btn" data-el="unameSave" disabled>Speichern</button>',
			'  </div>',
			'</div>'
		].join('');
		document.body.appendChild(ov);

		var q = function (n) { return ov.querySelector('[data-el="' + n + '"]'); };
		els = {
			overlay: ov,
			viewAuth: ov.querySelector('[data-view="auth"]'),
			viewName: ov.querySelector('[data-view="username"]'),
			title: q('title'), sub: q('sub'), google: q('google'),
			email: q('email'), pw: q('pw'), err: q('err'),
			submit: q('submit'), close: q('close'), toggle: q('toggle'), reset: q('reset'),
			uname: q('uname'), unameErr: q('unameErr'), unameSave: q('unameSave')
		};

		var mode = 'login';
		function applyMode() {
			els.title.textContent = mode === 'login' ? 'Anmelden' : 'Konto erstellen';
			els.submit.textContent = mode === 'login' ? 'Anmelden' : 'Konto erstellen';
			els.toggle.textContent = mode === 'login'
				? 'Noch kein Konto? Registrieren'
				: 'Bereits registriert? Anmelden';
			els.pw.setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
			els.err.textContent = '';
			els.err.classList.remove('ga-ok');
		}

		function fail(e) {
			els.err.classList.remove('ga-ok');
			els.err.textContent = translateError(e);
			els.submit.disabled = false;
			els.google.disabled = false;
		}

		els.toggle.onclick = function () { mode = mode === 'login' ? 'register' : 'login'; applyMode(); };
		els.close.onclick = closeModal;
		ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && ov.classList.contains('open')) closeModal();
		});

		els.google.onclick = function () {
			els.err.textContent = '';
			els.google.disabled = true;
			var provider = new firebase.auth.GoogleAuthProvider();
			auth.signInWithPopup(provider)
				.then(function () { els.google.disabled = false; })
				.catch(fail);
		};

		els.submit.onclick = function () {
			var email = els.email.value.trim();
			var pw = els.pw.value;
			els.err.textContent = '';
			els.err.classList.remove('ga-ok');
			if (!email || !pw) { els.err.textContent = 'Bitte E-Mail und Passwort eingeben.'; return; }
			if (mode === 'register' && pw.length < 6) {
				els.err.textContent = 'Das Passwort muss mindestens 6 Zeichen haben.';
				return;
			}
			els.submit.disabled = true;
			var p = mode === 'login'
				? auth.signInWithEmailAndPassword(email, pw)
				: auth.createUserWithEmailAndPassword(email, pw);
			p.then(function () { els.submit.disabled = false; }).catch(fail);
		};

		els.pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') els.submit.click(); });
		els.email.addEventListener('keydown', function (e) { if (e.key === 'Enter') els.pw.focus(); });

		els.reset.onclick = function () {
			var email = els.email.value.trim();
			if (!email) { els.err.classList.remove('ga-ok'); els.err.textContent = 'Bitte zuerst deine E-Mail eintragen.'; return; }
			auth.sendPasswordResetEmail(email).then(function () {
				els.err.classList.add('ga-ok');
				els.err.textContent = 'E-Mail zum Zurücksetzen wurde verschickt.';
			}).catch(fail);
		};

		els.uname.addEventListener('input', function () {
			var v = els.uname.value.trim();
			if (!v) { els.unameSave.disabled = true; els.unameErr.textContent = ''; return; }
			if (!USERNAME_RE.test(v)) {
				els.unameSave.disabled = true;
				els.unameErr.textContent = v.length < 3
					? 'Mindestens 3 Zeichen.'
					: 'Nur Buchstaben, Zahlen und _ erlaubt (max. 20).';
			} else {
				els.unameSave.disabled = false;
				els.unameErr.textContent = '';
			}
		});
		els.uname.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' && !els.unameSave.disabled) els.unameSave.click();
		});
		els.unameSave.onclick = function () { saveUsername(els.uname.value.trim()); };

		els._applyMode = applyMode;
		applyMode();
		return els;
	}

	function translateError(e) {
		var code = (e && e.code) || '';
		var map = {
			'auth/invalid-email': 'Diese E-Mail-Adresse ist ungültig.',
			'auth/user-not-found': 'Kein Konto mit dieser E-Mail gefunden.',
			'auth/wrong-password': 'Falsches Passwort.',
			'auth/invalid-credential': 'E-Mail oder Passwort stimmt nicht.',
			'auth/email-already-in-use': 'Für diese E-Mail gibt es bereits ein Konto. Melde dich stattdessen an.',
			'auth/weak-password': 'Das Passwort muss mindestens 6 Zeichen haben.',
			'auth/too-many-requests': 'Zu viele Versuche. Bitte warte einen Moment.',
			'auth/popup-closed-by-user': 'Anmeldefenster wurde geschlossen.',
			'auth/popup-blocked': 'Dein Browser hat das Anmeldefenster blockiert. Bitte Popups erlauben.',
			'auth/network-request-failed': 'Keine Verbindung. Prüfe dein Internet.',
			'auth/operation-not-allowed': 'Diese Anmeldeart ist derzeit deaktiviert.'
		};
		return map[code] || (e && e.message) || 'Unbekannter Fehler.';
	}

	function openModal(view, subText) {
		var e = buildModal();
		e.viewAuth.style.display = view === 'username' ? 'none' : '';
		e.viewName.style.display = view === 'username' ? '' : 'none';
		if (subText && view !== 'username') e.sub.textContent = subText;
		e.overlay.classList.add('open');
		setTimeout(function () {
			(view === 'username' ? e.uname : e.email).focus();
		}, 60);
	}

	function closeModal() {
		if (!els) return;
		// Username-Schritt darf nicht uebersprungen werden - sonst haette der
		// Account keinen Namen fuer Bestenlisten/Multiplayer.
		if (els.viewName.style.display !== 'none') return;
		els.overlay.classList.remove('open');
		els.err.textContent = '';
		els.pw.value = '';
	}

	function saveUsername(val) {
		if (!state.user || !USERNAME_RE.test(val)) return;
		var e = els;
		e.unameSave.disabled = true;
		e.unameSave.textContent = 'Speichert...';
		var key = val.toLowerCase();

		db.collection('usernames').doc(key).get().then(function (snap) {
			if (snap.exists && snap.data().uid !== state.user.uid) {
				throw { code: 'taken' };
			}
			var batch = db.batch();
			batch.set(db.collection('usernames').doc(key), { uid: state.user.uid });
			batch.set(db.collection('users').doc(state.user.uid), {
				username: val,
				displayName: val,
				email: state.user.email || '',
				updatedAt: firebase.firestore.FieldValue.serverTimestamp()
			}, { merge: true });
			return batch.commit();
		}).then(function () {
			return state.user.updateProfile({ displayName: val }).catch(function () {});
		}).then(function () {
			state.profile = Object.assign({}, state.profile, { username: val, displayName: val });
			e.unameSave.textContent = 'Speichern';
			e.viewName.style.display = 'none';
			e.overlay.classList.remove('open');
			notify();
		}).catch(function (err) {
			e.unameErr.textContent = err && err.code === 'taken'
				? 'Dieser Name ist leider schon vergeben.'
				: translateError(err);
			e.unameSave.disabled = false;
			e.unameSave.textContent = 'Speichern';
		});
	}

	/* ---------------------------------------------------------
	   Account-Chip
	   --------------------------------------------------------- */
	var mounts = [];

	function mountChip(target) {
		var el = typeof target === 'string' ? document.querySelector(target) : target;
		if (!el) return;
		injectCSS();
		if (mounts.indexOf(el) === -1) mounts.push(el);
		renderChip(el);
	}

	function displayName() {
		if (!state.user) return '';
		return (state.profile && state.profile.username)
			|| state.user.displayName
			|| (state.user.email ? state.user.email.split('@')[0] : '')
			|| 'Spieler';
	}

	function renderChip(el) {
		el.innerHTML = '';
		if (!state.user) {
			var b = document.createElement('button');
			b.className = 'ga-chip';
			b.innerHTML = '<span class="ga-chip-av">?</span><span class="ga-chip-name">Anmelden</span>';
			b.onclick = function () { openModal('auth'); };
			el.appendChild(b);
			return;
		}

		var name = displayName();
		var wrap = document.createElement('div');
		wrap.className = 'ga-wrap';

		var chip = document.createElement('button');
		chip.className = 'ga-chip';
		chip.innerHTML = '<span class="ga-chip-av"></span><span class="ga-chip-name"></span>';
		chip.querySelector('.ga-chip-av').textContent = name.charAt(0).toUpperCase();
		chip.querySelector('.ga-chip-name').textContent = name;

		var menu = document.createElement('div');
		menu.className = 'ga-menu';
		var head = document.createElement('div');
		head.className = 'ga-menu-head';
		var nm = document.createElement('div');
		nm.className = 'ga-menu-name';
		nm.textContent = name;
		var ml = document.createElement('div');
		ml.className = 'ga-menu-mail';
		ml.textContent = state.user.email || 'Über Google angemeldet';
		head.appendChild(nm); head.appendChild(ml);
		menu.appendChild(head);

		var rename = document.createElement('button');
		rename.className = 'ga-menu-item';
		rename.textContent = 'Spielernamen ändern';
		rename.onclick = function () {
			menu.classList.remove('open');
			buildModal();
			els.uname.value = state.profile && state.profile.username ? state.profile.username : '';
			els.uname.dispatchEvent(new Event('input'));
			els.unameErr.textContent = '';
			openModal('username');
		};
		menu.appendChild(rename);

		var out = document.createElement('button');
		out.className = 'ga-menu-item danger';
		out.textContent = 'Abmelden';
		out.onclick = function () { menu.classList.remove('open'); auth.signOut(); };
		menu.appendChild(out);

		chip.onclick = function (ev) {
			ev.stopPropagation();
			var wasOpen = menu.classList.contains('open');
			document.querySelectorAll('.ga-menu.open').forEach(function (m) { m.classList.remove('open'); });
			if (!wasOpen) menu.classList.add('open');
		};
		document.addEventListener('click', function () { menu.classList.remove('open'); });

		wrap.appendChild(chip);
		wrap.appendChild(menu);
		el.appendChild(wrap);
	}

	function renderAllChips() {
		mounts.forEach(function (el) {
			if (document.body.contains(el)) renderChip(el);
		});
	}

	/* ---------------------------------------------------------
	   Auth-State
	   --------------------------------------------------------- */
	function notify() {
		renderAllChips();
		document.body && document.body.setAttribute('data-ga-auth', state.user ? 'in' : 'out');
		listeners.forEach(function (fn) {
			try { fn(state.user, state.profile); } catch (e) { console.error('[GridlineAccount]', e); }
		});
		document.dispatchEvent(new CustomEvent('gridline-auth', {
			detail: { user: state.user, profile: state.profile }
		}));
	}

	auth.onAuthStateChanged(function (user) {
		state.user = user || null;
		API.user = state.user;

		if (!user) {
			state.profile = null;
			API.profile = null;
			if (!state.resolved) { state.resolved = true; readyResolve(null); }
			notify();
			return;
		}

		// Sofort mit Fallback melden, damit die UI nicht auf Firestore wartet.
		state.profile = null;
		notify();

		db.collection('users').doc(user.uid).get().then(function (snap) {
			var data = snap.exists ? snap.data() : null;
			state.profile = data;
			API.profile = data;

			if (!data || !data.username) {
				// Neuer Account (oder Altbestand ohne Namen) -> Name abfragen.
				buildModal();
				var suggestion = (user.displayName || (user.email || '').split('@')[0] || '')
					.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
				els.uname.value = suggestion;
				els.uname.dispatchEvent(new Event('input'));
				openModal('username');
			} else if (els) {
				closeModalForce();
			}
			notify();
		}).catch(function (err) {
			console.warn('[GridlineAccount] Profil konnte nicht geladen werden:', err.message);
			if (els) closeModalForce();
			notify();
		}).then(function () {
			if (!state.resolved) { state.resolved = true; readyResolve(state.user); }
		});
	});

	function closeModalForce() {
		if (!els) return;
		els.viewName.style.display = 'none';
		els.overlay.classList.remove('open');
		els.pw.value = '';
		els.err.textContent = '';
	}

	/* ---------------------------------------------------------
	   Public API
	   --------------------------------------------------------- */
	var API = {
		ready: ready,
		user: null,
		profile: null,

		isLoggedIn: function () { return !!state.user; },

		name: displayName,

		openLogin: function (subText) {
			if (state.user) return;
			openModal('auth', subText);
		},

		logout: function () { return auth.signOut(); },

		requireLogin: function (subText) {
			return ready.then(function () {
				if (state.user) return true;
				openModal('auth', subText || 'Für diese Funktion brauchst du einen Gridline-Account.');
				return new Promise(function (resolve) {
					var off = API.onChange(function (u) {
						if (u) { off(); resolve(true); }
					});
					// Wenn der Dialog geschlossen wird ohne Login -> false
					var iv = setInterval(function () {
						if (!els || !els.overlay.classList.contains('open')) {
							clearInterval(iv);
							if (!state.user) { off(); resolve(false); }
						}
					}, 300);
				});
			});
		},

		onChange: function (fn) {
			listeners.push(fn);
			if (state.resolved) { try { fn(state.user, state.profile); } catch (e) {} }
			return function () {
				var i = listeners.indexOf(fn);
				if (i > -1) listeners.splice(i, 1);
			};
		},

		mountChip: mountChip,

		auth: auth,
		db: db
	};

	global.GridlineAccount = API;

	// Chips automatisch an alle [data-gridline-account] Container haengen.
	function autoMount() {
		document.querySelectorAll('[data-gridline-account]').forEach(mountChip);
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', autoMount);
	} else {
		autoMount();
	}
})(window);
