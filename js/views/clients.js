/* ============================================================================
   Vue : Clients
   ============================================================================ */

(function () {
  "use strict";

  async function render(el) {
    const t = App.t;
    const isAdmin = App.isAdmin();

    const clients = await App.q(App.sb.from("clients").select("*").order("full_name"));

    el.innerHTML =
      '<div class="page-head">' +
        "<h2>" + App.esc(t("clients.title")) + ' <span class="small muted">(' + App.num(clients.length) + ")</span></h2>" +
        '<button class="btn btn-primary" id="add-client">' + App.icon("plus", 16) + App.esc(t("clients.add")) + "</button>" +
      "</div>" +
      '<div class="toolbar">' +
        '<div class="search">' + App.icon("search", 16) + '<input id="cli-search" type="search" placeholder="' + App.esc(t("common.search")) + '"></div>' +
      "</div>" +
      '<div class="card"><div class="card-body tight" id="cli-list"></div></div>';

    const list = el.querySelector("#cli-list");
    const search = el.querySelector("#cli-search");

    function paint() {
      const q = search.value.trim().toLowerCase();
      const rows = clients.filter(function (c) {
        return !q || [c.full_name, c.phone, c.id_number, c.address].join(" ").toLowerCase().includes(q);
      });
      if (!rows.length) {
        list.innerHTML = App.emptyState("👥", t("clients.empty"), t("clients.emptyHint"));
        return;
      }
      list.innerHTML =
        '<div class="table-wrap"><table><thead><tr>' +
          "<th>" + App.esc(t("common.name")) + "</th>" +
          "<th>" + App.esc(t("common.phone")) + "</th>" +
          "<th>" + App.esc(t("clients.idNumber")) + "</th>" +
          "<th>" + App.esc(t("common.address")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.actions")) + "</th>" +
        "</tr></thead><tbody>" +
        rows.map(function (c) {
          return "<tr>" +
            '<td><div class="cell-main">' + App.esc(c.full_name) + "</div>" +
              (c.notes ? '<div class="cell-sub">' + App.esc(c.notes) + "</div>" : "") + "</td>" +
            '<td class="nowrap">' + App.esc(c.phone || "—") + "</td>" +
            '<td class="small">' + App.esc(c.id_number || "—") + "</td>" +
            '<td class="small">' + App.esc(c.address || "—") + "</td>" +
            '<td class="actions">' +
              '<button class="icon-btn" data-history="' + c.id + '" title="' + App.esc(t("common.history")) + '">' + App.icon("eye", 16) + "</button>" +
              '<button class="icon-btn" data-edit="' + c.id + '" title="' + App.esc(t("common.edit")) + '">' + App.icon("edit", 16) + "</button>" +
              (isAdmin ? '<button class="icon-btn danger" data-del="' + c.id + '" title="' + App.esc(t("common.delete")) + '">' + App.icon("trash", 16) + "</button>" : "") +
            "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";

      rows.forEach(function (c) {
        list.querySelector('[data-history="' + c.id + '"]').addEventListener("click", function () { openHistory(c); });
        list.querySelector('[data-edit="' + c.id + '"]').addEventListener("click", function () { openForm(c, function () { render(el); }); });
        const del = list.querySelector('[data-del="' + c.id + '"]');
        if (del) del.addEventListener("click", function () { remove(c); });
      });
    }

    async function remove(c) {
      const ok = await App.confirm({
        title: t("common.delete") + " — " + c.full_name,
        message: t("common.confirmDelete") + " " + t("common.cannotUndo")
      });
      if (!ok) return;
      try {
        await App.q(App.sb.from("clients").delete().eq("id", c.id));
        App.toast(t("common.deleted"), "success");
        render(el);
      } catch (err) {
        App.toast(t("clients.deleteBlocked"), "error");
      }
    }

    async function openHistory(c) {
      const m = App.openModal({ title: t("clients.historyOf") + " " + c.full_name, size: "wide", body: App.loadingBlock() });
      try {
        const [rentals, reservations] = await Promise.all([
          App.q(App.sb.from("rentals").select("*, apartments(name)").eq("client_id", c.id).order("start_date", { ascending: false })),
          App.q(App.sb.from("reservations").select("*, apartments(name)").eq("client_id", c.id).order("start_date", { ascending: false }))
        ]);
        const paid = await App.paidByRental(rentals.map(function (r) { return r.id; }));
        const total = rentals.reduce(function (s, r) { return s + (paid[r.id] || 0); }, 0);

        m.body.innerHTML =
          '<div class="pill-row" style="margin-bottom:14px">' +
            '<span class="chip">' + App.esc(t("common.phone") + " : " + (c.phone || "—")) + "</span>" +
            '<span class="chip">' + App.esc(t("clients.idNumber") + " : " + (c.id_number || "—")) + "</span>" +
            '<span class="chip">' + App.esc(t("clients.totalPaid") + " : " + App.money(total)) + "</span>" +
          "</div>" +
          '<div class="form-section" style="margin-bottom:8px">' + App.esc(t("clients.rentals")) + "</div>" +
          (rentals.length
            ? '<div class="table-wrap"><table><thead><tr><th>' + App.esc(t("rentals.apartment")) + "</th><th>" + App.esc(t("common.period")) +
              "</th><th>" + App.esc(t("rentals.totalAmount")) + "</th><th>" + App.esc(t("rentals.paid")) + "</th><th>" + App.esc(t("common.status")) + "</th></tr></thead><tbody>" +
              rentals.map(function (r) {
                return "<tr><td>" + App.esc(r.apartments ? r.apartments.name : "—") + "</td>" +
                  '<td class="small nowrap">' + App.date(r.start_date) + " → " + App.date(r.end_date) + "</td>" +
                  '<td class="num">' + App.esc(App.money(r.total_amount)) + "</td>" +
                  '<td class="num">' + App.esc(App.money(paid[r.id] || 0)) + "</td>" +
                  "<td>" + App.badge(r.status) + "</td></tr>";
              }).join("") + "</tbody></table></div>"
            : '<p class="small muted">' + App.esc(t("clients.noHistory")) + "</p>") +
          '<div class="form-section" style="margin:18px 0 8px">' + App.esc(t("clients.reservations")) + "</div>" +
          (reservations.length
            ? '<div class="table-wrap"><table><thead><tr><th>' + App.esc(t("rentals.apartment")) + "</th><th>" + App.esc(t("reservations.startDate")) +
              "</th><th>" + App.esc(t("common.status")) + "</th></tr></thead><tbody>" +
              reservations.map(function (r) {
                return "<tr><td>" + App.esc(r.apartments ? r.apartments.name : "—") + "</td>" +
                  '<td class="small nowrap">' + App.date(r.start_date) + " → " + App.date(r.end_date) + "</td>" +
                  "<td>" + App.badge(r.status) + "</td></tr>";
              }).join("") + "</tbody></table></div>"
            : '<p class="small muted">' + App.esc(t("clients.noHistory")) + "</p>");
      } catch (err) {
        m.body.innerHTML = '<div class="alert error">' + App.esc(App.errorMessage(err)) + "</div>";
      }
    }

    el.querySelector("#add-client").addEventListener("click", function () {
      openForm(null, function () { render(el); });
    });
    search.addEventListener("input", paint);
    paint();
  }

  function openForm(c, onSaved) {
    const t = App.t;
    const isEdit = !!c;
    const m = App.openModal({
      title: isEdit ? t("clients.edit") : t("clients.add"),
      body:
        '<form id="cli-form">' +
          '<div class="form-grid">' +
            '<div class="field span-2"><label>' + App.esc(t("common.name")) + " *</label>" +
              '<input name="full_name" required value="' + App.esc(isEdit ? c.full_name : "") + '" placeholder="Ahmed Benali"></div>' +
            '<div class="field"><label>' + App.esc(t("common.phone")) + "</label>" +
              '<input name="phone" type="tel" value="' + App.esc(isEdit ? (c.phone || "") : "") + '" placeholder="0550 00 00 00"></div>' +
            '<div class="field"><label>' + App.esc(t("clients.idNumber")) + "</label>" +
              '<input name="id_number" value="' + App.esc(isEdit ? (c.id_number || "") : "") + '"></div>' +
            '<div class="field span-2"><label>' + App.esc(t("common.address")) + "</label>" +
              '<input name="address" value="' + App.esc(isEdit ? (c.address || "") : "") + '"></div>' +
            '<div class="field span-2"><label>' + App.esc(t("common.notes")) + "</label>" +
              '<textarea name="notes" rows="2">' + App.esc(isEdit ? (c.notes || "") : "") + "</textarea></div>" +
          "</div>" +
          '<div class="form-error hidden" id="cli-err" style="margin-top:12px"></div>' +
        "</form>",
      footer:
        '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
        '<button type="submit" form="cli-form" class="btn btn-primary" id="cli-save">' + App.esc(t("common.save")) + "</button>"
    });

    const form = m.root.querySelector("#cli-form");
    const err = m.root.querySelector("#cli-err");

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      err.classList.add("hidden");
      const fd = new FormData(form);
      const payload = {
        full_name: String(fd.get("full_name") || "").trim(),
        phone: String(fd.get("phone") || "").trim() || null,
        id_number: String(fd.get("id_number") || "").trim() || null,
        address: String(fd.get("address") || "").trim() || null,
        notes: String(fd.get("notes") || "").trim() || null
      };
      if (!payload.full_name) {
        err.textContent = t("errors.missingFields");
        err.classList.remove("hidden");
        return;
      }
      const btn = m.root.querySelector("#cli-save");
      btn.disabled = true;
      try {
        if (isEdit) await App.q(App.sb.from("clients").update(payload).eq("id", c.id));
        else await App.q(App.sb.from("clients").insert(payload));
        m.close();
        App.toast(t("common.saved"), "success");
        if (onSaved) onSaved();
      } catch (e2) {
        err.textContent = App.errorMessage(e2);
        err.classList.remove("hidden");
      } finally {
        btn.disabled = false;
      }
    });
  }

  window.Views = window.Views || {};
  window.Views.clients = { render: render };
  App.clientForm = function (opts) {
    opts = opts || {};
    openForm(null, opts.onSaved);
  };
  App.openClientForm = openForm;
})();
