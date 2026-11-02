/* ============================================================================
   Vue : Appartements
   ============================================================================ */

(function () {
  "use strict";

  const STATUSES = ["available", "occupied", "maintenance"];

  async function render(el) {
    const t = App.t;
    const isAdmin = App.isAdmin();

    const [apartments, activeRentals] = await Promise.all([
      App.q(App.sb.from("apartments").select("*").order("name")),
      App.q(App.sb.from("rentals").select("id,apartment_id,clients(full_name)").eq("status", "active"))
    ]);

    const tenantByApt = {};
    activeRentals.forEach(function (r) { tenantByApt[r.apartment_id] = r.clients ? r.clients.full_name : "—"; });

    el.innerHTML =
      '<div class="page-head">' +
        "<h2>" + App.esc(t("apartments.title")) + ' <span class="small muted">(' + App.num(apartments.length) + ")</span></h2>" +
        (isAdmin ? '<button class="btn btn-primary" id="add-apt">' + App.icon("plus", 16) + App.esc(t("apartments.add")) + "</button>" : "") +
      "</div>" +
      '<div class="toolbar">' +
        '<div class="search">' + App.icon("search", 16) + '<input id="apt-search" type="search" placeholder="' + App.esc(t("common.search")) + '"></div>' +
        '<select id="apt-status">' +
          App.option("", t("common.all"), true) +
          STATUSES.map(function (s) { return App.option(s, t("status." + s)); }).join("") +
        "</select>" +
      "</div>" +
      '<div class="card"><div class="card-body tight" id="apt-list"></div></div>';

    const list = el.querySelector("#apt-list");
    const search = el.querySelector("#apt-search");
    const statusSel = el.querySelector("#apt-status");

    function paint() {
      const q = search.value.trim().toLowerCase();
      const st = statusSel.value;
      const rows = apartments.filter(function (a) {
        const hay = [a.name, a.address, a.city].join(" ").toLowerCase();
        return (!q || hay.includes(q)) && (!st || a.status === st);
      });

      if (!rows.length) {
        list.innerHTML = App.emptyState("🏠", t("apartments.empty"), t("apartments.emptyHint"));
        return;
      }

      list.innerHTML =
        '<div class="table-wrap"><table><thead><tr>' +
          "<th>" + App.esc(t("apartments.name")) + "</th>" +
          "<th>" + App.esc(t("common.address")) + "</th>" +
          "<th>" + App.esc(t("apartments.rooms")) + "</th>" +
          "<th>" + App.esc(t("apartments.rent")) + "</th>" +
          "<th>" + App.esc(t("common.status")) + "</th>" +
          "<th>" + App.esc(t("apartments.currentTenant")) + "</th>" +
          (isAdmin ? '<th style="text-align:end">' + App.esc(t("common.actions")) + "</th>" : "") +
        "</tr></thead><tbody>" +
        rows.map(function (a) {
          return "<tr>" +
            '<td><div class="cell-main">' + App.esc(a.name) + "</div>" +
              (a.description ? '<div class="cell-sub">' + App.esc(a.description) + "</div>" : "") + "</td>" +
            '<td class="small">' + App.esc([a.address, a.city].filter(Boolean).join(", ") || "—") + "</td>" +
            '<td class="num">' + (a.rooms ? App.num(a.rooms) : "—") + "</td>" +
            '<td class="num nowrap">' + App.esc(App.money(a.rent_amount)) + (a.daily_rate ? '<div class="cell-sub">' + App.esc(App.money(a.daily_rate) + " / " + t("common.perNight")) + "</div>" : "") + "</td>" +
            "<td>" + App.badge(a.status) + "</td>" +
            '<td class="small">' + (a.status === "occupied" ? App.esc(tenantByApt[a.id] || "—") : '<span class="muted">' + App.esc(t("apartments.vacant")) + "</span>") + "</td>" +
            (isAdmin ? '<td class="actions">' +
              '<button class="icon-btn" data-edit="' + a.id + '" title="' + App.esc(t("common.edit")) + '">' + App.icon("edit", 16) + "</button>" +
              '<button class="icon-btn danger" data-del="' + a.id + '" title="' + App.esc(t("common.delete")) + '">' + App.icon("trash", 16) + "</button>" +
            "</td>" : "") +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";

      rows.forEach(function (a) {
        const ed = list.querySelector('[data-edit="' + a.id + '"]');
        const dl = list.querySelector('[data-del="' + a.id + '"]');
        if (ed) ed.addEventListener("click", function () { openForm(a); });
        if (dl) dl.addEventListener("click", function () { remove(a); });
      });
    }

    async function remove(a) {
      const ok = await App.confirm({
        title: t("common.delete") + " — " + a.name,
        message: t("common.confirmDelete") + " " + t("common.cannotUndo")
      });
      if (!ok) return;
      try {
        await App.q(App.sb.from("apartments").delete().eq("id", a.id));
        App.toast(t("common.deleted"), "success");
        render(el);
      } catch (err) {
        App.toast(t("apartments.deleteBlocked"), "error");
      }
    }

    function openForm(a) {
      const isEdit = !!a;
      const dailyField = App.state.hasDailySchema
        ? '<div class="field"><label>' + App.esc(t("apartments.dailyRate")) + "</label>" +
            '<input name="daily_rate" type="number" min="0" step="0.01" value="' + App.esc(isEdit && a.daily_rate ? a.daily_rate : "") + '"></div>'
        : "";
      const m = App.openModal({
        title: isEdit ? t("apartments.edit") : t("apartments.add"),
        body:
          '<form id="apt-form">' +
            '<div class="form-grid">' +
              '<div class="field span-2"><label>' + App.esc(t("apartments.name")) + " *</label>" +
                '<input name="name" required value="' + App.esc(isEdit ? a.name : "") + '" placeholder="Appartement A1"></div>' +
              '<div class="field"><label>' + App.esc(t("common.address")) + "</label>" +
                '<input name="address" value="' + App.esc(isEdit ? (a.address || "") : "") + '"></div>' +
              '<div class="field"><label>' + App.esc(t("common.city")) + "</label>" +
                '<input name="city" value="' + App.esc(isEdit ? (a.city || "") : "") + '"></div>' +
              '<div class="field"><label>' + App.esc(t("apartments.rooms")) + "</label>" +
                '<input name="rooms" type="number" min="0" step="1" value="' + App.esc(isEdit && a.rooms ? a.rooms : "") + '"></div>' +
              '<div class="field"><label>' + App.esc(t("apartments.rent")) + " *</label>" +
                '<input name="rent_amount" type="number" min="0" step="0.01" required value="' + App.esc(isEdit ? a.rent_amount : "") + '"></div>' +
              dailyField +
              '<div class="field"><label>' + App.esc(t("common.status")) + "</label>" +
                '<select name="status">' +
                  STATUSES.map(function (s) { return App.option(s, t("status." + s), isEdit ? a.status === s : s === "available"); }).join("") +
                "</select>" +
                '<span class="form-hint">' + App.esc(t("apartments.maintenanceHint")) + "</span></div>" +
              '<div class="field span-2"><label>' + App.esc(t("apartments.description")) + "</label>" +
                '<textarea name="description" rows="2">' + App.esc(isEdit ? (a.description || "") : "") + "</textarea></div>" +
            "</div>" +
            '<div class="form-error hidden" id="apt-err" style="margin-top:12px"></div>' +
          "</form>",
        footer:
          '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
          '<button type="submit" form="apt-form" class="btn btn-primary" id="apt-save">' + App.esc(t("common.save")) + "</button>"
      });

      const form = m.root.querySelector("#apt-form");
      const err = m.root.querySelector("#apt-err");
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        err.classList.add("hidden");
        const fd = new FormData(form);
        const payload = {
          name: String(fd.get("name") || "").trim(),
          address: String(fd.get("address") || "").trim() || null,
          city: String(fd.get("city") || "").trim() || null,
          rooms: fd.get("rooms") ? Number(fd.get("rooms")) : null,
          rent_amount: Number(fd.get("rent_amount") || 0),
          status: String(fd.get("status") || "available"),
          description: String(fd.get("description") || "").trim() || null
        };
        if (App.state.hasDailySchema) payload.daily_rate = Number(fd.get("daily_rate") || 0);
        if (!payload.name) {
          err.textContent = t("errors.missingFields");
          err.classList.remove("hidden");
          return;
        }
        const btn = m.root.querySelector("#apt-save");
        btn.disabled = true;
        try {
          if (isEdit) {
            await App.q(App.sb.from("apartments").update(payload).eq("id", a.id));
          } else {
            await App.q(App.sb.from("apartments").insert(payload));
          }
          m.close();
          App.toast(t("common.saved"), "success");
          render(el);
        } catch (e2) {
          err.textContent = App.errorMessage(e2);
          err.classList.remove("hidden");
        } finally {
          btn.disabled = false;
        }
      });
    }

    const addBtn = el.querySelector("#add-apt");
    if (addBtn) addBtn.addEventListener("click", function () { openForm(null); });
    search.addEventListener("input", paint);
    statusSel.addEventListener("change", paint);
    paint();
  }

  window.Views = window.Views || {};
  window.Views.apartments = { render: render };
})();
