/* ============================================================================
   Vue : Réservations
   ============================================================================ */

(function () {
  "use strict";

  const t = App.t;

  async function render(el) {
    const isAdmin = App.isAdmin();
    let status = "";
    let search = "";

    const reservations = await App.q(
      App.sb.from("reservations")
        .select("*, clients(full_name, phone), apartments(name)")
        .order("start_date", { ascending: false })
    );

    el.innerHTML =
      '<div class="page-head">' +
        '<h2 style="flex:1">' + App.esc(t("reservations.title")) + "</h2>" +
        '<button class="btn btn-primary" id="add-res">' + App.icon("plus", 16) + App.esc(t("reservations.add")) + "</button>" +
      "</div>" +
      '<div class="toolbar">' +
        '<select id="res-status">' +
          App.option("", t("common.all"), true) +
          ["pending", "confirmed", "converted", "cancelled"].map(function (s) { return App.option(s, t("status." + s)); }).join("") +
        "</select>" +
        '<div class="search">' + App.icon("search", 16) + '<input id="res-search" type="search" placeholder="' + App.esc(t("common.search")) + '"></div>' +
      "</div>" +
      '<div class="card"><div class="card-body tight" id="res-list"></div></div>';

    const list = el.querySelector("#res-list");

    function paint() {
      const rows = reservations.filter(function (r) {
        if (status && r.status !== status) return false;
        if (!search) return true;
        return [r.clients && r.clients.full_name, r.apartments && r.apartments.name, r.clients && r.clients.phone]
          .join(" ").toLowerCase().includes(search);
      });

      if (!rows.length) {
        list.innerHTML = App.emptyState("📅", t("reservations.empty"), t("reservations.emptyHint"));
        return;
      }

      list.innerHTML =
        '<div class="table-wrap"><table><thead><tr>' +
          "<th>" + App.esc(t("common.date")) + "</th>" +
          "<th>" + App.esc(t("reservations.apartment")) + "</th>" +
          "<th>" + App.esc(t("reservations.client")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("reservations.deposit")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("rentals.totalAmount")) + "</th>" +
          "<th>" + App.esc(t("common.status")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.actions")) + "</th>" +
        "</tr></thead><tbody>" +
        rows.map(function (r) {
          const canConvert = r.status === "pending" || r.status === "confirmed";
          return "<tr>" +
            '<td class="small nowrap">' + App.date(r.start_date) +
              (r.end_date ? '<div class="cell-sub">' + App.date(r.end_date) + "</div>" : "") +
              '<div class="cell-sub">' + App.num(r.months || 0) + " " + App.esc(t(App.periodLabels(r.period_type).unitShort)) + "</div></td>" +
            '<td><div class="cell-main">' + App.esc(r.apartments ? r.apartments.name : "—") + "</div></td>" +
            '<td><div class="cell-main">' + App.esc(r.clients ? r.clients.full_name : "—") + "</div>" +
              '<div class="cell-sub">' + App.esc((r.clients && r.clients.phone) || "—") + "</div></td>" +
            '<td class="num" style="text-align:end">' + App.esc(App.money(r.deposit)) + "</td>" +
            '<td class="num" style="text-align:end">' + App.esc(App.money(r.total_amount)) + "</td>" +
            "<td>" + App.badge(r.status) + "</td>" +
            '<td class="actions">' +
              (canConvert ? '<button class="btn btn-primary btn-sm" data-convert="' + r.id + '" title="' + App.esc(t("reservations.convert")) + '">' + App.icon("key", 14) + "</button>" : "") +
              (r.status === "pending" ? '<button class="icon-btn" data-confirm="' + r.id + '" title="' + App.esc(t("reservations.confirm")) + '">' + App.icon("check", 16) + "</button>" : "") +
              (canConvert ? '<button class="icon-btn" data-cancel="' + r.id + '" title="' + App.esc(t("reservations.cancel")) + '">' + App.icon("x", 16) + "</button>" : "") +
              '<button class="icon-btn" data-edit="' + r.id + '" title="' + App.esc(t("common.edit")) + '">' + App.icon("edit", 16) + "</button>" +
              (isAdmin ? '<button class="icon-btn danger" data-del="' + r.id + '" title="' + App.esc(t("common.delete")) + '">' + App.icon("trash", 16) + "</button>" : "") +
            "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";

      rows.forEach(function (r) {
        const conv = list.querySelector('[data-convert="' + r.id + '"]');
        if (conv) conv.addEventListener("click", function () { convert(r); });
        const conf = list.querySelector('[data-confirm="' + r.id + '"]');
        if (conf) conf.addEventListener("click", function () { quickStatus(r, "confirmed"); });
        const canc = list.querySelector('[data-cancel="' + r.id + '"]');
        if (canc) canc.addEventListener("click", function () { quickStatus(r, "cancelled"); });
        list.querySelector('[data-edit="' + r.id + '"]').addEventListener("click", function () {
          openForm(r, function () { render(el); });
        });
        const del = list.querySelector('[data-del="' + r.id + '"]');
        if (del) del.addEventListener("click", function () { remove(r); });
      });
    }

    async function quickStatus(r, next) {
      if (next === "cancelled") {
        const ok = await App.confirm({ message: t("reservations.cancel") + " ?", confirmLabel: t("reservations.cancel"), danger: true });
        if (!ok) return;
      }
      try {
        await App.q(App.sb.from("reservations").update({ status: next }).eq("id", r.id));
        App.toast(t(next === "confirmed" ? "reservations.confirmed" : "reservations.cancelled"), "success");
        render(el);
      } catch (e) { App.toast(App.errorMessage(e), "error"); }
    }

    function convert(r) {
      App.rentalForm({
        preset: {
          apartment_id: r.apartment_id,
          client_id: r.client_id,
          period_type: r.period_type || "monthly",
          start_date: r.start_date,
          end_date: r.end_date,
          months: r.months || undefined,
          total_amount: Number(r.total_amount) || undefined,
          reservation_id: r.id,
          notes: r.notes,
          deposit: Number(r.deposit) || 0,
          reserved_on: r.reserved_on
        },
        onSaved: function () {
          App.toast(t("reservations.converted"), "success");
          render(el);
        }
      });
    }

    async function remove(r) {
      const ok = await App.confirm({ message: t("common.confirmDelete") + " " + t("common.cannotUndo") });
      if (!ok) return;
      try {
        await App.q(App.sb.from("reservations").delete().eq("id", r.id));
        App.toast(t("common.deleted"), "success");
        render(el);
      } catch (e) { App.toast(App.errorMessage(e), "error"); }
    }

    el.querySelector("#add-res").addEventListener("click", function () {
      openForm(null, function () { render(el); });
    });
    el.querySelector("#res-status").addEventListener("change", function (e) { status = e.target.value; paint(); });
    el.querySelector("#res-search").addEventListener("input", function (e) { search = e.target.value.trim().toLowerCase(); paint(); });

    paint();
  }

  async function openForm(r, onSaved) {
    const isEdit = !!r;
    const [apartments, clients] = await Promise.all([
      App.q(App.sb.from("apartments").select("*").order("name")),
      App.q(App.sb.from("clients").select("*").order("full_name"))
    ]);

    if (!apartments.length) { App.toast(t("apartments.emptyHint"), "error"); return; }
    if (!clients.length) {
      App.toast(t("clients.emptyHint"), "error");
      if (App.clientForm) App.clientForm({ onSaved: function () { openForm(r, onSaved); } });
      return;
    }

    const periodType = App.state.hasDailySchema && isEdit && r.period_type === "daily" ? "daily" : "monthly";
    const labels = App.periodLabels(periodType);
    const periodField = App.state.hasDailySchema
      ? '<div class="field"><label>' + App.esc(t("rentals.periodType")) + "</label>" +
          '<select name="period_type">' +
            App.option("monthly", t("rentals.periodMonthly"), periodType === "monthly") +
            App.option("daily", t("rentals.periodDaily"), periodType === "daily") +
          "</select></div>"
      : "";
    const start = isEdit ? r.start_date : App.today();
    const end = isEdit ? (r.end_date || "") : (periodType === "daily" ? App.addDays(start, 1) : App.addMonths(start, 1));

    const m = App.openModal({
      title: isEdit ? t("reservations.edit") : t("reservations.add"),
      size: "wide",
      body:
        '<form id="res-form"><div class="form-grid">' +
          periodField +
          '<div class="field"><label>' + App.esc(t("reservations.apartment")) + " *</label>" +
            '<select name="apartment_id" required><option value="">' + App.esc(t("common.select")) + "</option>" +
              apartments.map(function (a) {
                const price = App.money(a.rent_amount) + " / " + t("common.monthsShort") +
                  (a.daily_rate ? " · " + App.money(a.daily_rate) + " / " + t("common.perNight") : "");
                return App.option(a.id, a.name + " — " + price, isEdit && r.apartment_id === a.id);
              }).join("") +
            "</select></div>" +
          '<div class="field"><label>' + App.esc(t("reservations.client")) + " *</label>" +
            '<select name="client_id" required><option value="">' + App.esc(t("common.select")) + "</option>" +
              clients.map(function (c) { return App.option(c.id, c.full_name + (c.phone ? " — " + c.phone : ""), isEdit && r.client_id === c.id); }).join("") +
            "</select></div>" +
          '<div class="field"><label>' + App.esc(t("reservations.reservedOn")) + "</label>" +
            '<input name="reserved_on" type="date" value="' + App.esc(isEdit ? r.reserved_on : App.today()) + '"></div>' +
          '<div class="field"><label>' + App.esc(t("common.status")) + "</label>" +
            '<select name="status">' +
              (isEdit && r.status === "converted" ? App.option("converted", t("status.converted"), true) : "") +
              ["pending", "confirmed", "cancelled"].map(function (s) { return App.option(s, t("status." + s), isEdit ? r.status === s : s === "pending"); }).join("") +
            "</select></div>" +
          '<div class="field"><label>' + App.esc(t("reservations.startDate")) + " *</label>" +
            '<input name="start_date" type="date" required value="' + App.esc(start) + '"></div>' +
          '<div class="field"><label>' + App.esc(t("reservations.endDate")) + "</label>" +
            '<input name="end_date" type="date" value="' + App.esc(end) + '"></div>' +
          '<div class="field"><label id="res-qty-label">' + App.esc(t(labels.quantity)) + "</label>" +
            '<input name="months" id="res-qty" type="number" min="' + (periodType === "daily" ? 1 : 0.5) + '" step="' + (periodType === "daily" ? 1 : 0.5) + '" value="' + App.esc(isEdit ? (r.months || App.calcQuantity(periodType, start, end)) : App.calcQuantity(periodType, start, end)) + '"></div>' +
          '<div class="field"><label>' + App.esc(t("rentals.totalAmount")) + "</label>" +
            '<input name="total_amount" type="number" min="0" step="0.01" value="' + App.esc(isEdit ? r.total_amount : "") + '"></div>' +
          '<div class="field"><label>' + App.esc(t("reservations.deposit")) + "</label>" +
            '<input name="deposit" type="number" min="0" step="0.01" value="' + App.esc(isEdit ? r.deposit : 0) + '">' +
            '<span class="form-hint">' + App.esc(t("reservations.depositHint")) + "</span></div>" +
          '<div class="field"><label>' + App.esc(t("common.notes")) + "</label>" +
            '<input name="notes" value="' + App.esc(isEdit ? (r.notes || "") : "") + '"></div>' +
        "</div>" +
        '<div class="form-error hidden" id="res-err" style="margin-top:12px"></div></form>',
      footer:
        '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
        '<button type="submit" form="res-form" class="btn btn-primary" id="res-save">' + App.esc(t("common.save")) + "</button>"
    });

    const form = m.root.querySelector("#res-form");
    const err = m.root.querySelector("#res-err");
    const fPeriod = form.elements.period_type;
    const fApt = form.elements.apartment_id;
    const fStart = form.elements.start_date;
    const fEnd = form.elements.end_date;
    const fMonths = form.elements.months;
    const fTotal = form.elements.total_amount;

    function rateFor(a, pt) {
      if (!a) return 0;
      return Number(pt === "daily" ? (a.daily_rate || 0) : (a.rent_amount || 0));
    }

    function currentPeriod() {
      return App.state.hasDailySchema && fPeriod ? fPeriod.value : "monthly";
    }

    function applyPeriodLabels() {
      const pt = currentPeriod();
      const l = App.periodLabels(pt);
      form.querySelector("#res-qty-label").textContent = t(l.quantity);
      fMonths.min = pt === "daily" ? "1" : "0.5";
      fMonths.step = pt === "daily" ? "1" : "0.5";
    }

    function recompute(source) {
      if (source === "total") return;
      const pt = currentPeriod();
      const a = apartments.find(function (x) { return x.id === fApt.value; });
      if (fEnd.value && fStart.value) fMonths.value = App.calcQuantity(pt, fStart.value, fEnd.value);
      const qty = Number(fMonths.value || 0);
      if (a) fTotal.value = Math.round(qty * rateFor(a, pt) * 100) / 100;
    }

    if (fPeriod) fPeriod.addEventListener("change", function () { applyPeriodLabels(); recompute(); });
    fApt.addEventListener("change", function () { recompute(); });
    fStart.addEventListener("change", function () { recompute(); });
    fEnd.addEventListener("change", function () { recompute(); });
    fMonths.addEventListener("input", function () { recompute(); });
    if (!isEdit) recompute();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      err.classList.add("hidden");
      const payload = {
        apartment_id: fApt.value || null,
        client_id: form.elements.client_id.value || null,
        reserved_on: form.elements.reserved_on.value || App.today(),
        start_date: fStart.value || null,
        end_date: fEnd.value || null,
        months: Number(fMonths.value || 0) || null,
        total_amount: Number(fTotal.value || 0),
        deposit: Number(form.elements.deposit.value || 0),
        status: form.elements.status.value,
        notes: String(form.elements.notes.value || "").trim() || null
      };
      if (App.state.hasDailySchema) payload.period_type = currentPeriod();
      if (!payload.apartment_id || !payload.client_id || !payload.start_date) {
        err.textContent = t("errors.missingFields");
        err.classList.remove("hidden");
        return;
      }
      if (payload.period_type === "daily" && !payload.end_date) {
        err.textContent = t("errors.missingFields");
        err.classList.remove("hidden");
        return;
      }
      if (payload.end_date && payload.end_date < payload.start_date) {
        err.textContent = t("common.invalidDates");
        err.classList.remove("hidden");
        return;
      }
      const btn = m.root.querySelector("#res-save");
      btn.disabled = true;
      try {
        if (isEdit) await App.q(App.sb.from("reservations").update(payload).eq("id", r.id));
        else await App.q(App.sb.from("reservations").insert(payload));
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
  window.Views.reservations = { render: render };
  App.reservationForm = function (opts) {
    opts = opts || {};
    openForm(null, opts.onSaved);
  };
})();
