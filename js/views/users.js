/* ============================================================================
   Vue : Utilisateurs (administrateur)
   ============================================================================ */

(function () {
  "use strict";

  const t = App.t;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function render(el) {
    if (!App.isAdmin()) {
      el.innerHTML = '<div class="alert error">' + App.esc(t("errors.notAllowed")) + "</div>";
      return;
    }

    const profiles = await App.q(
      App.sb.from("profiles").select("*").order("role").order("full_name")
    );

    el.innerHTML =
      '<div class="page-head">' +
        '<div style="flex:1"><h2>' + App.esc(t("users.title")) + "</h2>" +
          '<div class="sub">' + App.esc(t("users.inactiveHint")) + "</div></div>" +
        '<button class="btn btn-primary" id="add-user">' + App.icon("plus", 16) + App.esc(t("users.add")) + "</button>" +
      "</div>" +
      '<div class="card"><div class="card-body tight" id="users-list"></div></div>';

    paint();

    function paint() {
      const list = el.querySelector("#users-list");
      if (!profiles.length) {
        list.innerHTML = App.emptyState("👤", t("users.empty"));
        return;
      }
      list.innerHTML =
        '<div class="table-wrap"><table><thead><tr>' +
          "<th>" + App.esc(t("common.name")) + "</th>" +
          "<th>" + App.esc(t("users.email")) + "</th>" +
          "<th>" + App.esc(t("users.role")) + "</th>" +
          "<th>" + App.esc(t("common.status")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.actions")) + "</th>" +
        "</tr></thead><tbody>" +
        profiles.map(function (p) {
          const self = App.state.profile && p.id === App.state.profile.id;
          return "<tr>" +
            '<td><div class="cell-main">' + App.esc(p.full_name || "—") +
              (self ? ' <span class="badge blue" style="margin-inline-start:6px">' + App.esc(t("users.you")) + "</span>" : "") +
            "</div></td>" +
            '<td class="small">' + App.esc(p.email || "—") + "</td>" +
            "<td>" + App.esc(t("role." + p.role)) + "</td>" +
            "<td>" + (p.active
              ? '<span class="badge green">' + App.esc(t("users.active")) + "</span>"
              : '<span class="badge amber">' + App.esc(t("users.inactive")) + "</span>") + "</td>" +
            '<td class="actions">' +
              '<button class="icon-btn" data-edit="' + p.id + '" title="' + App.esc(t("common.edit")) + '">' + App.icon("edit", 16) + "</button>" +
              (self ? "" : (p.active
                ? '<button class="icon-btn danger" data-toggle="' + p.id + '" title="' + App.esc(t("users.deactivate")) + '">' + App.icon("x", 16) + "</button>"
                : '<button class="icon-btn" data-toggle="' + p.id + '" title="' + App.esc(t("users.activate")) + '">' + App.icon("check", 16) + "</button>")) +
            "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";

      profiles.forEach(function (p) {
        list.querySelector('[data-edit="' + p.id + '"]').addEventListener("click", function () { editUser(p); });
        const tg = list.querySelector('[data-toggle="' + p.id + '"]');
        if (tg) tg.addEventListener("click", function () { toggleUser(p); });
      });
    }

    function canRemoveAdmin(p) {
      if (!(p.role === "admin" && p.active)) return true;
      return profiles.filter(function (x) { return x.role === "admin" && x.active; }).length > 1;
    }

    async function toggleUser(p) {
      if (p.active && !canRemoveAdmin(p)) {
        App.toast(t("users.lastAdmin"), "error");
        return;
      }
      const ok = await App.confirm({
        title: p.active ? t("users.deactivate") : t("users.activate"),
        message: (p.full_name || p.email) + " — " + (p.active ? t("users.inactiveHint") : t("users.active")),
        confirmLabel: p.active ? t("users.deactivate") : t("users.activate"),
        danger: p.active
      });
      if (!ok) return;
      try {
        await App.q(App.sb.from("profiles").update({ active: !p.active }).eq("id", p.id));
        App.toast(t("common.saved"), "success");
        const fresh = await App.q(App.sb.from("profiles").select("*").order("role").order("full_name"));
        profiles.length = 0;
        Array.prototype.push.apply(profiles, fresh);
        paint();
        try { await App.loadProfiles(true); } catch (e) { /* ignore */ }
      } catch (e) {
        App.toast(App.errorMessage(e), "error");
      }
    }

    function editUser(p) {
      const self = App.state.profile && p.id === App.state.profile.id;
      const m = App.openModal({
        title: t("users.edit"),
        body:
          '<form id="usr-form"><div class="form-grid">' +
            '<div class="field span-2"><label>' + App.esc(t("common.name")) + "</label>" +
              '<input name="full_name" value="' + App.esc(p.full_name || "") + '"></div>' +
            '<div class="field"><label>' + App.esc(t("users.role")) + "</label>" +
              '<select name="role"' + (self ? " disabled" : "") + ">" +
                App.option("admin", t("role.admin"), p.role === "admin") +
                App.option("concierge", t("role.concierge"), p.role === "concierge") +
              "</select>" +
              (self ? '<span class="form-hint">' + App.esc(t("users.selfEdit")) + "</span>" : "") + "</div>" +
            '<div class="field"><label>' + App.esc(t("common.status")) + "</label>" +
              '<select name="active"' + (self ? " disabled" : "") + ">" +
                App.option("1", t("users.active"), p.active) +
                App.option("0", t("users.inactive"), !p.active) +
              "</select></div>" +
          "</div>" +
          '<div class="form-error hidden" id="usr-err" style="margin-top:12px"></div></form>',
        footer:
          '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
          '<button type="submit" form="usr-form" class="btn btn-primary" id="usr-save">' + App.esc(t("common.save")) + "</button>"
      });

      m.root.querySelector("#usr-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const err = m.root.querySelector("#usr-err");
        const newRole = self ? p.role : String(fd.get("role"));
        const newActive = self ? p.active : String(fd.get("active")) === "1";

        if (p.role === "admin" && p.active && (newRole !== "admin" || !newActive) && !canRemoveAdmin(p)) {
          err.textContent = t("users.lastAdmin");
          err.classList.remove("hidden");
          return;
        }

        const btn = m.root.querySelector("#usr-save");
        btn.disabled = true;
        try {
          await App.q(App.sb.from("profiles").update({
            full_name: String(fd.get("full_name") || "").trim(),
            role: newRole,
            active: newActive
          }).eq("id", p.id));
          m.close();
          App.toast(t("common.saved"), "success");
          if (self) {
            App.state.profile.full_name = String(fd.get("full_name") || "").trim();
            App.updateUserChip();
          }
          try { await App.loadProfiles(true); } catch (e2) { /* ignore */ }
          render(el);
        } catch (e2) {
          err.textContent = App.errorMessage(e2);
          err.classList.remove("hidden");
        } finally {
          btn.disabled = false;
        }
      });
    }

    el.querySelector("#add-user").addEventListener("click", function () { createUser(); });

    function createUser() {
      const m = App.openModal({
        title: t("users.add"),
        body:
          '<form id="newusr-form"><div class="form-grid">' +
            '<div class="field span-2"><label>' + App.esc(t("common.name")) + " *</label>" +
              '<input name="full_name" required></div>' +
            '<div class="field"><label>' + App.esc(t("users.email")) + " *</label>" +
              '<input name="email" type="email" required autocomplete="off"></div>' +
            '<div class="field"><label>' + App.esc(t("users.password")) + " *</label>" +
              '<input name="password" type="password" minlength="6" required autocomplete="new-password">' +
              '<span class="form-hint">' + App.esc(t("users.passwordHint")) + "</span></div>" +
            '<div class="field span-2"><label>' + App.esc(t("users.role")) + "</label>" +
              '<select name="role">' +
                App.option("concierge", t("role.concierge"), true) +
                App.option("admin", t("role.admin")) +
              "</select></div>" +
          "</div>" +
          '<div class="form-hint" style="margin-top:10px">' + App.esc(t("users.confirmEmailHint")) + "</div>" +
          '<div class="form-error hidden" id="newusr-err" style="margin-top:12px"></div></form>',
        footer:
          '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
          '<button type="submit" form="newusr-form" class="btn btn-primary" id="newusr-save">' + App.esc(t("users.create")) + "</button>"
      });

      m.root.querySelector("#newusr-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const err = m.root.querySelector("#newusr-err");
        const btn = m.root.querySelector("#newusr-save");
        const fullName = String(fd.get("full_name") || "").trim();
        const email = String(fd.get("email") || "").trim();
        const password = String(fd.get("password") || "");
        const role = String(fd.get("role") || "concierge");

        if (!fullName || !email || password.length < 6) {
          err.textContent = t("errors.missingFields") + " (" + t("users.passwordHint") + ")";
          err.classList.remove("hidden");
          return;
        }

        btn.disabled = true;
        try {
          const tmp = window.supabase.createClient(App.config.supabaseUrl, App.config.supabaseAnonKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
              storageKey: "tmp-invite-" + Date.now()
            }
          });

          const res = await tmp.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: fullName } }
          });
          if (res.error) throw res.error;
          if (res.data.user && res.data.user.identities && res.data.user.identities.length === 0) {
            throw new Error("User already registered");
          }
          const userId = res.data.user && res.data.user.id;
          if (!userId) throw new Error(t("errors.generic"));

          let profile = null;
          for (let i = 0; i < 8; i++) {
            profile = await App.q(App.sb.from("profiles").select("id").eq("id", userId).maybeSingle());
            if (profile) break;
            await sleep(400);
          }

          await App.q(App.sb.from("profiles").update({
            full_name: fullName,
            role: role,
            active: true
          }).eq("id", userId));

          try { await tmp.auth.signOut(); } catch (e2) { /* ignore */ }

          m.close();
          App.toast(t("users.created"), "success");
          try { await App.loadProfiles(true); } catch (e2) { /* ignore */ }
          render(el);
        } catch (e2) {
          if (/already registered|already been registered/i.test(e2.message || "")) {
            err.textContent = t("users.emailExists");
          } else {
            err.textContent = App.errorMessage(e2);
          }
          err.classList.remove("hidden");
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  window.Views = window.Views || {};
  window.Views.users = { render: render };
})();
