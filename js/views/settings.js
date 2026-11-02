/* ============================================================================
   Vue : Paramètres (administrateur)
   ============================================================================ */

(function () {
  "use strict";

  const t = App.t;

  async function render(el) {
    if (!App.isAdmin()) {
      el.innerHTML = '<div class="alert error">' + App.esc(t("errors.notAllowed")) + "</div>";
      return;
    }
    const s = App.state.settings || {};

    el.innerHTML =
      '<div class="page-head"><h2>' + App.esc(t("settings.title")) + "</h2></div>" +
      '<div class="card" style="max-width:640px">' +
        '<div class="card-head"><h2>' + App.esc(t("settings.general")) + "</h2></div>" +
        '<div class="card-body">' +
          '<form id="set-form"><div class="form-grid">' +
            '<div class="field span-2"><label>' + App.esc(t("settings.businessName")) + "</label>" +
              '<input name="business_name" value="' + App.esc(s.business_name || "") + '">' +
              '<span class="form-hint">' + App.esc(t("settings.brandHint")) + "</span></div>" +
            '<div class="field"><label>' + App.esc(t("settings.currency")) + "</label>" +
              '<input name="currency" value="' + App.esc(s.currency || "DZD") + '" placeholder="DZD"></div>' +
            '<div class="field"><label>' + App.esc(t("settings.currencySymbol")) + "</label>" +
              '<input name="currency_symbol" value="' + App.esc(s.currency_symbol || "DA") + '" placeholder="DA"></div>' +
          "</div>" +
          '<div class="form-hint" style="margin-top:12px">' + App.esc(t("settings.langHint")) + "</div>" +
          '<div class="form-error hidden" id="set-err" style="margin-top:12px"></div>' +
          '<div style="margin-top:18px"><button type="submit" class="btn btn-primary" id="set-save">' + App.esc(t("common.save")) + "</button></div>" +
          "</form>" +
        "</div>" +
      "</div>" +
      '<div class="card" style="max-width:640px;margin-top:16px;border-color:#fecaca">' +
        '<div class="card-head"><h2 style="color:var(--danger)">' + App.esc(t("settings.danger")) + "</h2></div>" +
        '<div class="card-body">' +
          '<button class="btn btn-danger-soft" id="logout-btn2">' + App.icon("logout", 16) + App.esc(t("settings.logoutAll")) + "</button>" +
        "</div>" +
      "</div>";

    el.querySelector("#logout-btn2").addEventListener("click", function () {
      document.getElementById("logout-btn").click();
    });

    el.querySelector("#set-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const err = el.querySelector("#set-err");
      const btn = el.querySelector("#set-save");
      const payload = {
        business_name: String(fd.get("business_name") || "").trim() || App.t("app.name"),
        currency: String(fd.get("currency") || "").trim().toUpperCase() || "DZD",
        currency_symbol: String(fd.get("currency_symbol") || "").trim() || "DA"
      };

      btn.disabled = true;
      try {
        await App.q(App.sb.from("settings").update(payload).eq("id", 1));
        await App.loadSettings();
        App.applyTranslations();
        document.getElementById("brand-name").textContent = App.brandName();
        App.toast(t("settings.saved"), "success");
        App.renderRoute();
      } catch (e2) {
        err.textContent = App.errorMessage(e2);
        err.classList.remove("hidden");
      } finally {
        btn.disabled = false;
      }
    });
  }

  window.Views = window.Views || {};
  window.Views.settings = { render: render };
})();
