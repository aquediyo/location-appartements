/* ============================================================================
   Noyau de l'application : Supabase, i18n, routeur, helpers UI
   ============================================================================ */

(function () {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const configured =
    !!cfg.supabaseUrl &&
    !!cfg.supabaseAnonKey &&
    !cfg.supabaseUrl.includes("VOTRE-PROJET") &&
    !cfg.supabaseAnonKey.includes("VOTRE_CLE");

  let sb = null;
  if (configured && window.supabase) {
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  const storedLang = localStorage.getItem("app_lang");
  function detectTheme() {
    try {
      const saved = localStorage.getItem("app_theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (e) { /* stockage indisponible */ }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  const App = (window.App = {
    sb: sb,
    configured: configured,
    config: cfg,
    state: {
      lang: storedLang || cfg.defaultLang || "fr",
      theme: detectTheme(),
      profile: null,
      settings: null,
      paymentsCache: null,
      hasDailySchema: false
    },
    routes: [
      { id: "dashboard", icon: "dashboard" },
      { id: "apartments", icon: "apartments" },
      { id: "clients", icon: "clients" },
      { id: "reservations", icon: "reservations" },
      { id: "rentals", icon: "rentals" },
      { id: "payments", icon: "payments" },
      { id: "expenses", icon: "expenses" },
      { id: "cash", icon: "cash", admin: true },
      { id: "users", icon: "users", admin: true },
      { id: "settings", icon: "settings", admin: true }
    ]
  });

  /* ----------------------------- Icônes ---------------------------------- */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    apartments: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    reservations: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9.5h18"/>',
    rentals: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9"/><path d="m17 3 4 4"/><path d="m14 6 3 3"/>',
    payments: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>',
    expenses: '<path d="M6 2h9l3 3v17H6z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    cash: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5z"/><path d="M3 7.5V6a2 2 0 0 1 2-2h11"/><path d="M17 12h.01"/>',
    users: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M6 15v6h12v-6"/>',
    download: '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9"/><path d="m17 3 4 4"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'
  };

  App.icon = function (name, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  };

  /* ----------------------------- Traduction ------------------------------- */
  App.t = function (key, vars) {
    const lang = App.state.lang;
    let str = (window.I18N[lang] && window.I18N[lang][key]) || window.I18N.fr[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
      });
    }
    return str;
  };
  window.t = App.t;

  /* ----------------------------- Utilitaires ------------------------------ */
  App.esc = function (value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };
  window.esc = App.esc;

  App.q = async function (builder) {
    const res = await builder;
    if (res.error) throw res.error;
    return res.data;
  };

  App.isAdmin = function () {
    return !!(App.state.profile && App.state.profile.role === "admin");
  };

  /* Détecte si la base possède déjà les colonnes de la location à la nuitée.
     Permet à l'application de rester fonctionnelle avant la migration. */
  App.detectDailySchema = async function () {
    try {
      await App.q(App.sb.from("apartments").select("daily_rate").limit(1));
      App.state.hasDailySchema = true;
    } catch (err) {
      App.state.hasDailySchema = false;
    }
    return App.state.hasDailySchema;
  };

  App.today = function () {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  App.addDays = function (iso, days) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  App.addMonths = function (iso, n) {
    const d = new Date(iso + "T00:00:00");
    const day = d.getDate();
    d.setMonth(d.getMonth() + n);
    if (d.getDate() < day) d.setDate(0);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  App.daysBetween = function (start, end) {
    if (!start || !end) return 0;
    const a = new Date(start + "T00:00:00");
    const b = new Date(end + "T00:00:00");
    return Math.round((b - a) / 86400000);
  };

  App.calcMonths = function (start, end) {
    const days = App.daysBetween(start, end);
    if (days <= 0) return 1;
    return Math.max(0.5, Math.round((days / 30.44) * 2) / 2);
  };

  /* Nombre de nuits entre deux dates (minimum 1). */
  App.calcNights = function (start, end) {
    const days = App.daysBetween(start, end);
    return Math.max(1, days || 1);
  };

  /* Recalcule la quantité (mois ou nuits) selon le type de location. */
  App.calcQuantity = function (periodType, start, end) {
    return periodType === "daily" ? App.calcNights(start, end) : App.calcMonths(start, end);
  };

  /* Clés de traduction associées au type de location. */
  App.periodLabels = function (periodType) {
    const daily = periodType === "daily";
    return {
      quantity: daily ? "rentals.nights" : "rentals.months",
      quantityHint: daily ? "rentals.nightsHint" : "rentals.monthsHint",
      rent: daily ? "rentals.rentDaily" : "rentals.rentMonthly",
      unitShort: daily ? "common.nightsShort" : "common.monthsShort"
    };
  };

  App.num = function (n, decimals) {
    const locale = App.state.lang === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR";
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals === undefined ? 2 : decimals
    }).format(Number(n || 0));
  };

  App.money = function (n) {
    const symbol = (App.state.settings && App.state.settings.currency_symbol) || "DA";
    return App.num(n) + " " + symbol;
  };

  App.date = function (value) {
    if (!value) return "—";
    const d = new Date(String(value).length === 10 ? value + "T00:00:00" : value);
    if (isNaN(d.getTime())) return "—";
    const locale = App.state.lang === "ar" ? "ar-DZ-u-nu-latn" : "fr-FR";
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(d);
  };

  App.badge = function (status) {
    const colors = {
      available: "green", occupied: "blue", maintenance: "amber",
      pending: "amber", confirmed: "blue", cancelled: "red", converted: "violet",
      active: "green", ended: ""
    };
    return '<span class="badge ' + (colors[status] || "") + '">' + App.esc(App.t("status." + status)) + "</span>";
  };

  App.errorMessage = function (err) {
    if (!err) return App.t("errors.generic");
    const msg = String(err.message || err);
    const code = err.code;

    if (code === "23505" || /duplicate key|one_active_rental/i.test(msg)) {
      if (/one_active_rental|rentals_apartment/i.test(msg)) return App.t("errors.duplicateRental");
      return App.t("errors.generic");
    }
    if (code === "42501" || /row-level security|permission denied/i.test(msg)) return App.t("errors.notAllowed");
    if (/Invalid login credentials/i.test(msg)) return App.t("errors.invalidLogin");
    if (/Email not confirmed/i.test(msg)) return App.t("auth.emailNotConfirmed");
    if (/User already registered|already been registered/i.test(msg)) return App.t("auth.alreadyRegistered");
    if (/For security purposes|rate limit|too many/i.test(msg)) return App.t("errors.rateLimit");
    if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return App.t("errors.network");

    return msg || App.t("errors.generic");
  };

  /* ----------------------------- Toasts ---------------------------------- */
  App.toast = function (message, type) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast " + (type || "");
    el.textContent = message;
    root.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity .2s";
      setTimeout(function () { el.remove(); }, 200);
    }, 3200);
  };

  /* ----------------------------- Modales ---------------------------------- */
  let activeModalClose = null;

  App.openModal = function (opts) {
    if (activeModalClose) activeModalClose();
    const root = document.getElementById("modal-root");
    root.innerHTML =
      '<div class="modal-overlay">' +
        '<div class="modal ' + (opts.size || "") + '" role="dialog" aria-modal="true">' +
          '<div class="modal-head">' +
            "<h2>" + App.esc(opts.title || "") + "</h2>" +
            '<button class="icon-btn" data-modal-close aria-label="' + App.esc(App.t("common.close")) + '">' + App.icon("x", 18) + "</button>" +
          "</div>" +
          '<div class="modal-body">' + (opts.body || "") + "</div>" +
          (opts.footer ? '<div class="modal-foot">' + opts.footer + "</div>" : "") +
        "</div>" +
      "</div>";

    const overlay = root.querySelector(".modal-overlay");
    const card = root.querySelector(".modal");
    let closed = false;

    function close() {
      if (closed) return;
      closed = true;
      root.innerHTML = "";
      document.removeEventListener("keydown", onKey);
      if (activeModalClose === close) activeModalClose = null;
      if (typeof opts.onClose === "function") {
        setTimeout(function () {
          if (!document.getElementById("modal-root").firstChild) opts.onClose();
        }, 0);
      }
    }

    function onKey(e) {
      if (e.key === "Escape") close();
    }

    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay) close();
    });
    root.querySelectorAll("[data-modal-close]").forEach(function (b) {
      b.addEventListener("click", close);
    });
    document.addEventListener("keydown", onKey);

    setTimeout(function () {
      const field = card.querySelector("input:not([type=hidden]), select, textarea");
      if (field && window.innerWidth > 700) field.focus();
    }, 40);

    activeModalClose = close;
    return { root: card, body: card.querySelector(".modal-body"), close: close };
  };

  App.confirm = function (opts) {
    opts = typeof opts === "string" ? { message: opts } : (opts || {});
    return new Promise(function (resolve) {
      let done = false;
      const finish = function (value) {
        if (done) return;
        done = true;
        resolve(value);
      };
      const m = App.openModal({
        title: opts.title || App.t("common.confirmDelete"),
        onClose: function () {
          finish(false);
          if (typeof opts.onClose === "function") opts.onClose();
        },
        body: '<p>' + App.esc(opts.message || App.t("common.cannotUndo")) + "</p>" +
              (opts.detail ? '<p class="small muted" style="margin-top:8px">' + App.esc(opts.detail) + "</p>" : ""),
        footer:
          '<button class="btn btn-ghost" data-no>' + App.esc(App.t("common.cancel")) + "</button>" +
          '<button class="btn ' + (opts.danger === false ? "btn-primary" : "btn-danger") + '" data-yes>' +
            App.esc(opts.confirmLabel || App.t("common.delete")) +
          "</button>"
      });
      m.root.querySelector("[data-no]").addEventListener("click", function () { finish(false); m.close(); });
      m.root.querySelector("[data-yes]").addEventListener("click", function () { finish(true); m.close(); });
      m.root.querySelector("[data-modal-close]").addEventListener("click", function () { finish(false); });
      m.root.closest(".modal-overlay").addEventListener("mousedown", function (e) {
        if (e.target.classList.contains("modal-overlay")) finish(false);
      });
    });
  };

  App.printHtml = function (html) {
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) {
      App.toast(App.t("common.error") + " : pop-ups", "error");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 350);
  };

  /* --------------------------- Chargements -------------------------------- */
  App.loadSettings = async function () {
    if (!App.sb) return null;
    const data = await App.q(App.sb.from("settings").select("*").eq("id", 1).maybeSingle());
    App.state.settings = data || { business_name: App.t("app.name"), currency: "DZD", currency_symbol: "DA" };
    return App.state.settings;
  };

  let profilesCache = null;
  App.loadProfiles = async function (force) {
    if (profilesCache && !force) return profilesCache;
    const data = await App.q(App.sb.from("profiles").select("id,full_name,role,active,email"));
    profilesCache = {};
    data.forEach(function (p) { profilesCache[p.id] = p; });
    return profilesCache;
  };
  App.profileName = function (id) {
    if (!id) return "—";
    if (profilesCache && profilesCache[id]) return profilesCache[id].full_name || profilesCache[id].email || "—";
    if (App.state.profile && App.state.profile.id === id) return App.state.profile.full_name;
    return "—";
  };

  App.paidByRental = async function (rentalIds) {
    const map = {};
    if (!rentalIds || !rentalIds.length) return map;
    rentalIds.forEach(function (id) { map[id] = 0; });
    const pages = [];
    for (let i = 0; i < rentalIds.length; i += 100) pages.push(rentalIds.slice(i, i + 100));
    for (const chunk of pages) {
      const data = await App.q(App.sb.from("payments").select("rental_id,amount").in("rental_id", chunk));
      data.forEach(function (p) { map[p.rental_id] = (map[p.rental_id] || 0) + Number(p.amount); });
    }
    return map;
  };

  App.option = function (value, label, selected) {
    return '<option value="' + App.esc(value) + '"' + (selected ? " selected" : "") + ">" + App.esc(label) + "</option>";
  };

  App.emptyState = function (icon, title, hint) {
    return '<div class="empty"><div class="empty-icon">' + (icon || "📭") + "</div><strong>" + App.esc(title) + "</strong>" +
      (hint ? '<span class="small">' + App.esc(hint) + "</span>" : "") + "</div>";
  };

  App.loadingBlock = function () {
    return '<div class="empty"><div class="spinner"></div><span class="small">' + App.esc(App.t("common.loading")) + "</span></div>";
  };

  /* ------------------------------ Langue ---------------------------------- */
  App.applyTranslations = function () {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = App.t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", App.t(el.getAttribute("data-i18n-placeholder")));
    });
    document.title = (App.state.settings && App.state.settings.business_name) || App.t("app.name");
    document.querySelectorAll(".lang-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-lang") === App.state.lang);
    });
    App.updateThemeButtons();
  };

  App.setLang = function (lang) {
    App.state.lang = lang;
    localStorage.setItem("app_lang", lang);
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    App.applyTranslations();
    if (App.state.profile) {
      App.renderNav();
      App.updateUserChip();
      App.renderRoute();
    }
  };

  /* ------------------------------ Thème ----------------------------------- */
  App.updateThemeButtons = function () {
    const dark = App.state.theme === "dark";
    const label = App.t(dark ? "theme.light" : "theme.dark");
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.innerHTML = App.icon(dark ? "sun" : "moon", 18);
      btn.setAttribute("title", label);
      btn.setAttribute("aria-label", label);
      btn.setAttribute("aria-pressed", dark ? "true" : "false");
    });
  };

  App.applyTheme = function (theme, persist) {
    const next = theme === "dark" ? "dark" : "light";
    App.state.theme = next;
    document.documentElement.setAttribute("data-theme", next);
    if (persist) {
      try { localStorage.setItem("app_theme", next); } catch (e) { /* stockage indisponible */ }
    }
    const meta = document.getElementById("theme-color-meta");
    if (meta) meta.setAttribute("content", next === "dark" ? "#080e19" : "#f5f7fb");
    App.updateThemeButtons();
  };

  App.setTheme = function (theme) { App.applyTheme(theme, true); };

  App.toggleTheme = function () {
    App.applyTheme(App.state.theme === "dark" ? "light" : "dark", true);
  };

  /* ------------------------------ Routeur --------------------------------- */
  function currentRoute() {
    const hash = (location.hash || "").replace(/^#\/?/, "");
    return hash || "dashboard";
  }

  App.routeAllowed = function (id) {
    const r = App.routes.find(function (x) { return x.id === id; });
    if (!r) return false;
    if (r.admin && !App.isAdmin()) return false;
    return true;
  };

  App.navigate = function (id) {
    if (location.hash === "#/" + id) App.renderRoute();
    else location.hash = "#/" + id;
  };

  App.renderNav = function () {
    const nav = document.getElementById("nav");
    if (!nav) return;
    let html = "";
    App.routes.forEach(function (r, i) {
      if (r.admin && !App.isAdmin()) return;
      const prev = App.routes[i - 1];
      if (r.admin && prev && !prev.admin && App.isAdmin()) html += '<div class="nav-sep"></div>';
      html += '<button class="nav-item" data-route="' + r.id + '">' + App.icon(r.icon, 19) +
        "<span>" + App.esc(App.t("nav." + r.id)) + "</span></button>";
    });
    nav.innerHTML = html;
    nav.querySelectorAll("[data-route]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        App.navigate(btn.getAttribute("data-route"));
        document.getElementById("sidebar").classList.remove("open");
        document.getElementById("sidebar-backdrop").classList.remove("show");
      });
    });
    App.setActiveNav(currentRoute());
  };

  App.setActiveNav = function (id) {
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-route") === id);
    });
  };

  let renderToken = 0;
  App.renderRoute = async function () {
    if (!App.state.profile) return;
    let id = currentRoute();
    if (!App.routeAllowed(id)) {
      id = "dashboard";
      location.hash = "#/dashboard";
      return;
    }
    const view = window.Views && window.Views[id];
    const token = ++renderToken;
    App.setActiveNav(id);
    document.getElementById("page-title").textContent = App.t("nav." + id);
    const container = document.getElementById("view");
    container.innerHTML = App.loadingBlock();

    if (!view) {
      container.innerHTML = App.emptyState("🚧", App.t("common.error"), id);
      return;
    }

    /* Chaque vue travaille dans son propre conteneur : si l'utilisateur change
       de page pendant un chargement, l'ancienne vue écrit dans un noeud détaché
       et ne peut plus écraser la nouvelle page. */
    const mount = document.createElement("div");
    container.innerHTML = "";
    container.appendChild(mount);
    mount.innerHTML = App.loadingBlock();

    try {
      await view.render(mount);
      if (token !== renderToken) return;
    } catch (err) {
      console.error(err);
      if (token !== renderToken) return;
      container.innerHTML =
        '<div class="card"><div class="card-body">' +
          '<div class="alert error">' + App.esc(App.errorMessage(err)) + "</div>" +
          '<div style="margin-top:14px"><button class="btn btn-primary" id="retry-btn">' + App.esc(App.t("common.reset")) + "</button></div>" +
        "</div></div>";
      const b = document.getElementById("retry-btn");
      if (b) b.addEventListener("click", App.renderRoute);
    }
  };

  App.updateUserChip = function () {
    const p = App.state.profile;
    if (!p) return;
    const initials = (p.full_name || p.email || "?").trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
    document.getElementById("user-initials").textContent = initials || "?";
    document.getElementById("user-name").textContent = p.full_name || p.email || "—";
    document.getElementById("user-role").textContent = App.t("role." + p.role);
  };

  /* ------------------------------ Shell ----------------------------------- */
  App.initShell = function () {
    const menuBtn = document.getElementById("menu-btn");
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (menuBtn) {
      menuBtn.innerHTML = App.icon("menu", 20);
      menuBtn.addEventListener("click", function () {
        sidebar.classList.toggle("open");
        backdrop.classList.toggle("show");
      });
    }
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        sidebar.classList.remove("open");
        backdrop.classList.remove("show");
      });
    }
    const logout = document.getElementById("logout-btn");
    if (logout) logout.innerHTML = App.icon("logout", 18);

    document.querySelectorAll(".lang-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { App.setLang(btn.getAttribute("data-lang")); });
    });

    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () { App.toggleTheme(); });
    });
    App.applyTheme(App.state.theme);

    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onSystemTheme = function (e) {
        let saved = null;
        try { saved = localStorage.getItem("app_theme"); } catch (err) { saved = null; }
        if (saved !== "dark" && saved !== "light") {
          App.applyTheme(e.matches ? "dark" : "light");
        }
      };
      if (mq.addEventListener) mq.addEventListener("change", onSystemTheme);
      else if (mq.addListener) mq.addListener(onSystemTheme);
    }

    window.addEventListener("hashchange", function () {
      App.renderRoute();
    });
  };

  App.brandName = function () {
    return (App.state.settings && App.state.settings.business_name) || App.t("app.name");
  };

  /* Langue initiale */
  document.documentElement.lang = App.state.lang;
  document.documentElement.dir = App.state.lang === "ar" ? "rtl" : "ltr";
})();
