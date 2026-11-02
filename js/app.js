/* ============================================================================
   Démarrage : session, connexion, inscription
   ============================================================================ */

(function () {
  "use strict";

  let signupMode = false;
  let booting = false;

  function byId(id) { return document.getElementById(id); }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  function setMessage(text, type) {
    const box = byId("auth-message");
    if (!text) {
      hide(box);
      box.textContent = "";
      return;
    }
    box.className = "alert " + (type || "info");
    box.textContent = text;
    show(box);
  }

  function showAuth() {
    hide(byId("boot"));
    hide(byId("app-screen"));
    show(byId("auth-screen"));
  }

  function showSetup() {
    show(byId("setup-notice"));
    hide(byId("auth-form"));
    hide(byId("auth-hint"));
    byId("auth-hint").style.display = "none";
    document.querySelectorAll(".tab").forEach(function (t) { t.disabled = true; });
  }

  async function getProfile(userId) {
    for (let i = 0; i < 5; i++) {
      const p = await App.q(
        App.sb.from("profiles").select("*").eq("id", userId).maybeSingle()
      );
      if (p) return p;
      await sleep(500);
    }
    return null;
  }

  async function boot(user) {
    if (booting) return;
    booting = true;
    try {
      const profile = await getProfile(user.id);
      if (!profile) {
        await App.sb.auth.signOut();
        showAuth();
        setMessage(App.t("auth.pending"), "warning");
        return;
      }
      if (!profile.active) {
        await App.sb.auth.signOut();
        showAuth();
        setMessage(App.t("auth.pending"), "warning");
        return;
      }

      App.state.profile = profile;
      await App.loadSettings();
      try { await App.loadProfiles(true); } catch (e) { /* non bloquant */ }

      hide(byId("boot"));
      hide(byId("auth-screen"));
      show(byId("app-screen"));

      byId("brand-name").textContent = App.brandName();
      document.title = App.brandName();
      App.applyTranslations();
      App.updateUserChip();
      App.renderNav();

      if (!location.hash || location.hash === "#/") location.hash = "#/dashboard";
      App.renderRoute();
    } catch (err) {
      console.error(err);
      showAuth();
      setMessage(App.errorMessage(err), "error");
    } finally {
      booting = false;
    }
  }

  function setMode(signup) {
    signupMode = signup;
    byId("tab-login").classList.toggle("active", !signup);
    byId("tab-signup").classList.toggle("active", signup);
    byId("field-name").style.display = signup ? "" : "none";
    byId("auth-submit").textContent = App.t(signup ? "auth.signupBtn" : "auth.loginBtn");
    byId("auth-submit").setAttribute("data-i18n", signup ? "auth.signupBtn" : "auth.loginBtn");
    byId("auth-password").setAttribute("autocomplete", signup ? "new-password" : "current-password");
    byId("auth-hint").textContent = App.t("auth.firstUserHint");
    setMessage("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!App.configured) return;

    const email = byId("auth-email").value.trim();
    const password = byId("auth-password").value;
    const fullName = byId("auth-name").value.trim();
    const btn = byId("auth-submit");

    if (!email || !password || (signupMode && !fullName)) {
      setMessage(App.t("errors.missingFields"), "error");
      return;
    }

    setMessage("");
    btn.disabled = true;
    const oldLabel = btn.textContent;
    btn.textContent = App.t("common.loading");

    try {
      if (signupMode) {
        const res = await App.sb.auth.signUp({
          email: email,
          password: password,
          options: { data: { full_name: fullName } }
        });
        if (res.error) throw res.error;

        if (!res.data.session) {
          showAuth();
          setMessage(App.t("auth.checkEmail"), "success");
        } else if (res.data.user) {
          const p = await getProfile(res.data.user.id);
          if (p && !p.active) {
            await App.sb.auth.signOut();
            showAuth();
            setMessage(App.t("auth.signupSuccess"), "info");
          } else {
            await boot(res.data.user);
          }
        }
      } else {
        const res = await App.sb.auth.signInWithPassword({ email: email, password: password });
        if (res.error) throw res.error;
        await boot(res.data.user);
      }
    } catch (err) {
      setMessage(App.errorMessage(err), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = App.t(signupMode ? "auth.signupBtn" : "auth.loginBtn");
      if (btn.textContent === oldLabel) { /* noop */ }
    }
  }

  async function logout() {
    try { await App.sb.auth.signOut(); } catch (e) { /* ignore */ }
    App.state.profile = null;
    App.state.settings = null;
    byId("auth-password").value = "";
    showAuth();
    setMessage(App.t("auth.loggedOut"), "info");
    history.replaceState(null, "", location.pathname);
  }

  async function init() {
    App.initShell();
    App.applyTranslations();
    byId("auth-brand-name").textContent = App.t("app.name");

    byId("auth-form").addEventListener("submit", onSubmit);
    byId("tab-login").addEventListener("click", function () { setMode(false); });
    byId("tab-signup").addEventListener("click", function () { setMode(true); });
    byId("logout-btn").addEventListener("click", logout);

    if (!App.configured || !App.sb) {
      showAuth();
      showSetup();
      return;
    }

    try {
      const res = await App.sb.auth.getSession();
      if (res.data && res.data.session) {
        await boot(res.data.session.user);
      } else {
        showAuth();
      }
    } catch (err) {
      console.error(err);
      showAuth();
      setMessage(App.errorMessage(err), "error");
    }

    App.sb.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_IN" && session && !App.state.profile && !booting) {
        setTimeout(function () { boot(session.user); }, 0);
      }
      if (event === "SIGNED_OUT" && App.state.profile) {
        App.state.profile = null;
        showAuth();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
