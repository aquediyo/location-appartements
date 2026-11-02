/* ============================================================================
   Vues : Locations & Paiements (formulaires partagés)
   ============================================================================ */

(function () {
  "use strict";

  const t = App.t;

  /* --------------------------- Liste des locations ------------------------ */
  async function render(el) {
    const isAdmin = App.isAdmin();
    let tab = "active";
    let search = "";

    const rentals = await App.q(
      App.sb.from("rentals").select("*, clients(full_name, phone), apartments(name)").order("start_date", { ascending: false })
    );
    const paid = await App.paidByRental(rentals.map(function (r) { return r.id; }));

    el.innerHTML =
      '<div class="page-head">' +
        '<h2 style="flex:1">' + App.esc(t("rentals.title")) + "</h2>" +
        '<button class="btn btn-primary" id="add-rental">' + App.icon("plus", 16) + App.esc(t("rentals.add")) + "</button>" +
      "</div>" +
      '<div class="toolbar">' +
        '<div class="seg" id="rental-tabs">' +
          '<button data-tab="active" class="active">' + App.esc(t("rentals.active")) + "</button>" +
          '<button data-tab="ended">' + App.esc(t("rentals.ended")) + "</button>" +
          '<button data-tab="all">' + App.esc(t("common.all")) + "</button>" +
        "</div>" +
        '<div class="search">' + App.icon("search", 16) + '<input id="rental-search" type="search" placeholder="' + App.esc(t("common.search")) + '"></div>' +
      "</div>" +
      '<div class="card"><div class="card-body tight" id="rental-list"></div></div>';

    const list = el.querySelector("#rental-list");
    const searchInput = el.querySelector("#rental-search");

    el.querySelectorAll("#rental-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        tab = b.getAttribute("data-tab");
        el.querySelectorAll("#rental-tabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
        paint();
      });
    });
    searchInput.addEventListener("input", function () { search = searchInput.value.trim().toLowerCase(); paint(); });

    function paint() {
      const rows = rentals.filter(function (r) {
        if (tab !== "all" && r.status !== tab) return false;
        if (!search) return true;
        return [r.clients && r.clients.full_name, r.apartments && r.apartments.name].join(" ").toLowerCase().includes(search);
      });

      if (!rows.length) {
        list.innerHTML = App.emptyState("🔑", t("rentals.empty"), t("rentals.emptyHint"));
        return;
      }

      list.innerHTML =
        '<div class="table-wrap"><table><thead><tr>' +
          "<th>" + App.esc(t("rentals.apartment")) + "</th>" +
          "<th>" + App.esc(t("rentals.client")) + "</th>" +
          "<th>" + App.esc(t("common.period")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("rentals.totalAmount")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("rentals.paid")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("rentals.remaining")) + "</th>" +
          "<th>" + App.esc(t("common.status")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.actions")) + "</th>" +
        "</tr></thead><tbody>" +
        rows.map(function (r) {
          const p = paid[r.id] || 0;
          const rest = Math.max(0, Number(r.total_amount) - p);
          return "<tr>" +
            '<td><div class="cell-main">' + App.esc(r.apartments ? r.apartments.name : "—") + "</div>" +
              '<div class="cell-sub">' + App.num(r.months) + " " + App.esc(t(App.periodLabels(r.period_type).unitShort)) + "</div></td>" +
            '<td><div class="cell-main">' + App.esc(r.clients ? r.clients.full_name : "—") + "</div>" +
              '<div class="cell-sub">' + App.esc((r.clients && r.clients.phone) || "—") + "</div></td>" +
            '<td class="small nowrap">' + App.date(r.start_date) + " → " + App.date(r.end_date) + "</td>" +
            '<td class="num" style="text-align:end">' + App.esc(App.money(r.total_amount)) + "</td>" +
            '<td class="num" style="text-align:end;color:var(--success)">' + App.esc(App.money(p)) + "</td>" +
            '<td class="num" style="text-align:end;font-weight:600;color:' + (rest > 0 ? "var(--danger)" : "var(--success)") + '">' + App.esc(App.money(rest)) + "</td>" +
            "<td>" + App.badge(r.status) + "</td>" +
            '<td class="actions"><button class="btn btn-ghost btn-sm" data-view="' + r.id + '">' + App.icon("eye", 14) + " " + App.esc(t("common.details")) + "</button></td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";

      rows.forEach(function (r) {
        list.querySelector('[data-view="' + r.id + '"]').addEventListener("click", function () { openDetail(r.id, function () { render(el); }); });
      });
    }

    el.querySelector("#add-rental").addEventListener("click", function () {
      App.rentalForm({ onSaved: function () { render(el); } });
    });

    paint();
    void isAdmin;
  }

  /* --------------------------- Formulaire location ------------------------ */
  App.rentalForm = async function (opts) {
    opts = opts || {};
    const editing = opts.rental || null;
    const preset = editing ? {
      apartment_id: editing.apartment_id,
      client_id: editing.client_id,
      period_type: editing.period_type || "monthly",
      start_date: editing.start_date,
      end_date: editing.end_date,
      months: editing.months,
      rent_amount: editing.rent_amount,
      total_amount: editing.total_amount,
      notes: editing.notes
    } : (opts.preset || {});

    const [apartments, clients, activeRentals] = await Promise.all([
      App.q(App.sb.from("apartments").select("*").order("name")),
      App.q(App.sb.from("clients").select("*").order("full_name")),
      App.q(App.sb.from("rentals").select("apartment_id").eq("status", "active"))
    ]);
    const occupied = {};
    activeRentals.forEach(function (r) { occupied[r.apartment_id] = true; });

    if (!apartments.length) {
      App.toast(t("apartments.emptyHint"), "error");
      return;
    }
    if (!clients.length) {
      App.toast(t("clients.emptyHint"), "error");
      if (App.clientForm) App.clientForm({ onSaved: function () { App.rentalForm(opts); } });
      return;
    }

    const periodType = App.state.hasDailySchema && preset.period_type === "daily" ? "daily" : "monthly";
    const labels = App.periodLabels(periodType);
    const periodField = App.state.hasDailySchema
      ? '<div class="field"><label>' + App.esc(t("rentals.periodType")) + "</label>" +
          '<select name="period_type">' +
            App.option("monthly", t("rentals.periodMonthly"), periodType === "monthly") +
            App.option("daily", t("rentals.periodDaily"), periodType === "daily") +
          "</select></div>"
      : "";
    const start = preset.start_date || App.today();
    const end = preset.end_date || (periodType === "daily" ? App.addDays(start, 1) : App.addMonths(start, 1));

    const m = App.openModal({
      title: editing ? t("rentals.edit") : t("rentals.add"),
      onClose: typeof opts.onClose === "function" ? opts.onClose : undefined,
      size: "wide",
      body:
        '<form id="rnt-form">' +
          '<div class="form-grid">' +
            periodField +
            '<div class="field"><label>' + App.esc(t("rentals.apartment")) + " *</label>" +
              '<select name="apartment_id" required>' +
                '<option value="">' + App.esc(t("common.select")) + "</option>" +
                apartments.map(function (a) {
                  const price = App.money(a.rent_amount) + " / " + t("common.monthsShort") +
                    (a.daily_rate ? " · " + App.money(a.daily_rate) + " / " + t("common.perNight") : "");
                  return App.option(a.id, a.name + " — " + price + (occupied[a.id] && a.id !== preset.apartment_id ? " (" + t("status.occupied") + ")" : ""), preset.apartment_id === a.id);
                }).join("") +
              "</select></div>" +
            '<div class="field"><label>' + App.esc(t("rentals.client")) + " *</label>" +
              '<select name="client_id" required>' +
                '<option value="">' + App.esc(t("common.select")) + "</option>" +
                clients.map(function (c) { return App.option(c.id, c.full_name + (c.phone ? " — " + c.phone : ""), preset.client_id === c.id); }).join("") +
              "</select></div>" +
            '<div class="field"><label>' + App.esc(t("rentals.startDate")) + " *</label>" +
              '<input name="start_date" type="date" required value="' + App.esc(start) + '"></div>' +
            '<div class="field"><label>' + App.esc(t("rentals.endDate")) + "</label>" +
              '<input name="end_date" type="date" value="' + App.esc(end) + '"></div>' +
            '<div class="field"><label id="rnt-qty-label">' + App.esc(t(labels.quantity)) + "</label>" +
              '<input name="months" id="rnt-qty" type="number" min="' + (periodType === "daily" ? 1 : 0.5) + '" step="' + (periodType === "daily" ? 1 : 0.5) + '" value="' + App.esc(preset.months || App.calcQuantity(periodType, start, end)) + '">' +
              '<span class="form-hint" id="rnt-qty-hint">' + App.esc(t(labels.quantityHint)) + "</span></div>" +
            '<div class="field"><label id="rnt-rent-label">' + App.esc(t(labels.rent)) + " *</label>" +
              '<input name="rent_amount" type="number" min="0" step="0.01" required value="' + App.esc(preset.rent_amount || "") + '"></div>' +
            '<div class="field"><label>' + App.esc(t("rentals.totalAmount")) + " *</label>" +
              '<input name="total_amount" type="number" min="0" step="0.01" required value="' + App.esc(preset.total_amount || "") + '"></div>' +
            '<div class="field"><label>' + App.esc(t("common.notes")) + "</label>" +
              '<input name="notes" value="' + App.esc(preset.notes || "") + '"></div>' +
          "</div>" +
          (editing ? "" : '<div class="form-hint" style="margin-top:10px">' + App.esc(t("rentals.statusActiveHint")) + "</div>") +
          '<div class="form-error hidden" id="rnt-err" style="margin-top:12px"></div>' +
        "</form>",
      footer:
        '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
        '<button type="submit" form="rnt-form" class="btn btn-primary" id="rnt-save">' + App.esc(t("common.save")) + "</button>"
    });

    const form = m.root.querySelector("#rnt-form");
    const err = m.root.querySelector("#rnt-err");
    const fPeriod = form.elements.period_type;
    const fApartment = form.elements.apartment_id;    const fStart = form.elements.start_date;
    const fEnd = form.elements.end_date;
    const fMonths = form.elements.months;
    const fRent = form.elements.rent_amount;
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
      form.querySelector("#rnt-qty-label").textContent = t(l.quantity);
      form.querySelector("#rnt-qty-hint").textContent = t(l.quantityHint);
      form.querySelector("#rnt-rent-label").textContent = t(l.rent) + " *";
      fMonths.min = pt === "daily" ? "1" : "0.5";
      fMonths.step = pt === "daily" ? "1" : "0.5";
    }

    function resyncQuantity() {
      if (fStart.value && fEnd.value) {
        fMonths.value = App.calcQuantity(currentPeriod(), fStart.value, fEnd.value);
      }
    }

    function syncRentFromApartment() {
      const a = apartments.find(function (x) { return x.id === fApartment.value; });
      if (a) fRent.value = rateFor(a, currentPeriod());
    }

    function recomputeTotal(source) {
      const qty = Number(fMonths.value || 0);
      const rent = Number(fRent.value || 0);
      if (source !== "total") fTotal.value = Math.round(qty * rent * 100) / 100;
    }

    if (fPeriod) {
      fPeriod.addEventListener("change", function () {
        applyPeriodLabels();
        resyncQuantity();
        syncRentFromApartment();
        recomputeTotal();
      });
    }
    fApartment.addEventListener("change", function () {
      syncRentFromApartment();
      recomputeTotal();
    });
    fStart.addEventListener("change", function () {
      if (fEnd.value) {
        resyncQuantity();
        recomputeTotal();
      }
    });
    fEnd.addEventListener("change", function () {
      if (fStart.value && fEnd.value) {
        resyncQuantity();
        recomputeTotal();
      }
    });
    fMonths.addEventListener("input", function () { recomputeTotal(); });
    fRent.addEventListener("input", function () { recomputeTotal(); });

    /* Valeurs initiales */
    if (preset.apartment_id && !preset.rent_amount) {
      const a = apartments.find(function (x) { return x.id === preset.apartment_id; });
      if (a) fRent.value = rateFor(a, currentPeriod());
    }
    if (preset.total_amount) fTotal.value = preset.total_amount;
    else recomputeTotal();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      err.classList.add("hidden");

      const payload = {
        apartment_id: fApartment.value || null,
        client_id: form.elements.client_id.value || null,
        start_date: fStart.value || null,
        end_date: fEnd.value || null,
        months: Number(fMonths.value || 1),
        rent_amount: Number(fRent.value || 0),
        total_amount: Number(fTotal.value || 0),
        notes: String(form.elements.notes.value || "").trim() || null,
        status: editing ? editing.status : "active"
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

      if (!editing && preset.reservation_id) payload.reservation_id = preset.reservation_id;

      const btn = m.root.querySelector("#rnt-save");
      btn.disabled = true;
      try {
        let created = null;
        if (editing) {
          await App.q(App.sb.from("rentals").update(payload).eq("id", editing.id));
          created = { id: editing.id };
        } else {
          created = await App.q(App.sb.from("rentals").insert(payload).select("id").single());
          if (preset.reservation_id) {
            await App.q(App.sb.from("reservations").update({ status: "converted" }).eq("id", preset.reservation_id));
          }
          if (preset.deposit && Number(preset.deposit) > 0) {
            await App.q(App.sb.from("payments").insert({
              rental_id: created.id,
              amount: Number(preset.deposit),
              paid_on: preset.reserved_on || App.today(),
              method: "cash",
              notes: t("reservations.deposit")
            }));
          }
        }
        m.close();
        App.toast(t("common.saved"), "success");
        if (opts.onSaved) opts.onSaved(created);
        else App.renderRoute();
      } catch (e2) {
        if (e2 && (e2.code === "23505" || /one_active_rental/i.test(e2.message || ""))) {
          err.textContent = t("errors.duplicateRental");
        } else {
          err.textContent = App.errorMessage(e2);
        }
        err.classList.remove("hidden");
      } finally {
        btn.disabled = false;
      }
    });
  };

  /* ------------------------------ Détail ---------------------------------- */
  async function openDetail(rentalId, onChanged) {
    const isAdmin = App.isAdmin();
    const rental = await App.q(
      App.sb.from("rentals").select("*, clients(*), apartments(*)").eq("id", rentalId).single()
    );
    const payments = await App.q(
      App.sb.from("payments").select("*").eq("rental_id", rentalId).order("paid_on").order("created_at")
    );
    const paid = payments.reduce(function (s, p) { return s + Number(p.amount); }, 0);
    const rest = Math.max(0, Number(rental.total_amount) - paid);
    const pct = Number(rental.total_amount) > 0 ? Math.min(100, Math.round((paid / Number(rental.total_amount)) * 100)) : 0;

    const m = App.openModal({
      title: t("rentals.detail"),
      size: "wide",
      body:
        '<div class="detail-grid">' +
          detail(t("rentals.apartment"), rental.apartments ? rental.apartments.name : "—") +
          detail(t("rentals.client"), (rental.clients ? rental.clients.full_name : "—") + (rental.clients && rental.clients.phone ? " · " + rental.clients.phone : "")) +
          detail(t("common.period"), App.date(rental.start_date) + " → " + App.date(rental.end_date)) +
          (App.state.hasDailySchema ? detail(t("rentals.periodType"), t(rental.period_type === "daily" ? "rentals.periodDaily" : "rentals.periodMonthly")) : "") +
          detail(t(App.periodLabels(rental.period_type).quantity), App.num(rental.months)) +
          detail(t(App.periodLabels(rental.period_type).rent), App.money(rental.rent_amount)) +
          '<div class="detail-item"><span class="label">' + App.esc(t("common.status")) + "</span><span>" + App.badge(rental.status) + "</span></div>" +
        "</div>" +

        '<div style="background:var(--surface-2);border-radius:12px;padding:14px 16px;margin:16px 0">' +
          '<div class="money-row"><span>' + App.esc(t("rentals.totalAmount")) + "</span><strong>" + App.esc(App.money(rental.total_amount)) + "</strong></div>" +
          '<div class="money-row"><span>' + App.esc(t("rentals.paid")) + "</span><strong style=\"color:var(--success)\">" + App.esc(App.money(paid)) + "</strong></div>" +
          '<div class="money-row total"><span>' + App.esc(t("rentals.remaining")) + "</span><strong style=\"color:" + (rest > 0 ? "var(--danger)" : "var(--success)") + "\">" + App.esc(App.money(rest)) + "</strong></div>" +
          '<div class="progress" style="margin-top:10px"><span style="width:' + pct + '%;background:' + (rest > 0 ? "var(--warning)" : "var(--success)") + '"></span></div>' +
          '<div class="small muted" style="margin-top:6px">' + App.esc(t("rentals.progress")) + " : " + pct + "%</div>" +
        "</div>" +

        (rental.notes ? '<p class="small muted" style="margin-bottom:12px">' + App.esc(rental.notes) + "</p>" : "") +

        '<div class="card-head" style="padding:0 0 10px;border:0"><h2 style="font-size:14.5px">' + App.esc(t("rentals.payments")) + "</h2>" +
          '<button class="btn btn-primary btn-sm" id="add-pay">' + App.icon("plus", 14) + " " + App.esc(t("rentals.addPayment")) + "</button></div>" +
        (payments.length
          ? '<div class="table-wrap"><table><thead><tr><th>' + App.esc(t("payments.paidOn")) + "</th><th>" + App.esc(t("common.amount")) +
            "</th><th>" + App.esc(t("common.method")) + "</th><th>" + App.esc(t("common.reference")) + "</th><th></th></tr></thead><tbody>" +
            payments.map(function (p) {
              return "<tr><td class=\"small nowrap\">" + App.date(p.paid_on) + "</td>" +
                '<td class="num" style="font-weight:600">' + App.esc(App.money(p.amount)) + "</td>" +
                "<td>" + App.esc(t("method." + p.method)) + "</td>" +
                '<td class="small">' + App.esc(p.reference || "—") + "</td>" +
                '<td class="actions">' +
                  '<button class="icon-btn" data-editpay="' + p.id + '" title="' + App.esc(t("common.edit")) + '">' + App.icon("edit", 15) + "</button>" +
                  '<button class="icon-btn" data-receipt="' + p.id + '" title="' + App.esc(t("payments.receipt")) + '">' + App.icon("print", 15) + "</button>" +
                  (isAdmin ? '<button class="icon-btn danger" data-delpay="' + p.id + '" title="' + App.esc(t("common.delete")) + '">' + App.icon("trash", 15) + "</button>" : "") +
                "</td></tr>";
            }).join("") + "</tbody></table></div>"
          : '<p class="small muted" style="padding:8px 0">' + App.esc(t("rentals.noPayments")) + "</p>") +
        '<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">' +
          (rental.status === "active"
            ? '<button class="btn btn-success-soft" id="checkout-btn">' + App.icon("checkCircle", 16) + " " + App.esc(t("rentals.checkout")) + "</button>"
            : "") +
          '<button class="btn btn-ghost" id="edit-rental">' + App.icon("edit", 16) + " " + App.esc(t("common.edit")) + "</button>" +
          (isAdmin ? '<button class="btn btn-danger-soft" id="del-rental">' + App.icon("trash", 16) + " " + App.esc(t("common.delete")) + "</button>" : "") +
        "</div>" +
        (rental.status !== "active" && rental.ended_at
          ? '<p class="small muted" style="margin-top:14px">' + App.esc(t("rentals.checkoutDate")) + " : " + App.date(rental.ended_at) + (rental.end_notes ? " · " + App.esc(rental.end_notes) : "") + "</p>"
          : "")
    });

    function detail(label, value) {
      return '<div class="detail-item"><span class="label">' + App.esc(label) + '</span><span class="value">' + App.esc(value) + "</span></div>";
    }

    m.root.querySelector("#add-pay").addEventListener("click", function () {
      App.paymentForm({
        rentalId: rental.id,
        onSaved: function () {
          openDetail(rentalId, onChanged);
          if (onChanged) onChanged();
        },
        onClose: function () {
          openDetail(rentalId, onChanged);
        }
      });
    });

    m.root.querySelectorAll("[data-receipt]").forEach(function (b) {
      b.addEventListener("click", function () { App.printReceipt(b.getAttribute("data-receipt")); });
    });

    m.root.querySelectorAll("[data-delpay]").forEach(function (b) {
      b.addEventListener("click", async function () {
        const ok = await App.confirm({
          message: t("common.confirmDelete") + " " + t("common.cannotUndo"),
          onClose: function () { openDetail(rentalId, onChanged); }
        });
        if (!ok) return;
        try {
          await App.q(App.sb.from("payments").delete().eq("id", b.getAttribute("data-delpay")));
          App.toast(t("common.deleted"), "success");
          openDetail(rentalId, onChanged);
          if (onChanged) onChanged();
        } catch (e) { App.toast(App.errorMessage(e), "error"); }
      });
    });

    m.root.querySelectorAll("[data-editpay]").forEach(function (b) {
      b.addEventListener("click", function () {
        const p = payments.find(function (x) { return x.id === b.getAttribute("data-editpay"); });
        if (p) editPayment(p);
      });
    });

    function editPayment(p) {
      const others = payments.filter(function (x) { return x.id !== p.id; })
        .reduce(function (s, x) { return s + Number(x.amount); }, 0);
      const maxAllowed = Math.max(0, Number(rental.total_amount) - others);

      const em = App.openModal({
        title: t("payments.edit"),
        onClose: function () {
          openDetail(rentalId, onChanged);
        },
        body:
          '<form id="editpay-form"><div class="form-grid">' +
            '<div class="field"><label>' + App.esc(t("common.amount")) + " *</label>" +
              '<input name="amount" type="number" min="0.01" step="0.01" required value="' + App.esc(p.amount) + '">' +
              '<span class="form-hint">' + App.esc(t("rentals.remaining") + " : " + App.money(maxAllowed)) + "</span></div>" +
            '<div class="field"><label>' + App.esc(t("payments.paidOn")) + "</label>" +
              '<input name="paid_on" type="date" value="' + App.esc(p.paid_on) + '"></div>' +
            '<div class="field"><label>' + App.esc(t("common.method")) + "</label>" +
              '<select name="method">' +
                ["cash", "transfer", "check", "other"].map(function (mth) { return App.option(mth, t("method." + mth), p.method === mth); }).join("") +
              "</select></div>" +
            '<div class="field"><label>' + App.esc(t("common.reference")) + "</label>" +
              '<input name="reference" value="' + App.esc(p.reference || "") + '"></div>' +
            '<div class="field span-2"><label>' + App.esc(t("common.notes")) + "</label>" +
              '<input name="notes" value="' + App.esc(p.notes || "") + '"></div>' +
          "</div>" +
          '<div class="form-error hidden" id="editpay-err" style="margin-top:12px"></div></form>',
        footer:
          '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
          '<button type="submit" form="editpay-form" class="btn btn-primary" id="editpay-save">' + App.esc(t("common.save")) + "</button>"
      });

      em.root.querySelector("#editpay-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const val = Number(fd.get("amount") || 0);
        const err = em.root.querySelector("#editpay-err");
        if (val <= 0) {
          err.textContent = t("common.invalidAmount");
          err.classList.remove("hidden");
          return;
        }
        if (val > maxAllowed + 0.009) {
          err.textContent = t("payments.exceedsRemaining", { amount: App.money(maxAllowed) });
          err.classList.remove("hidden");
          return;
        }
        const btn = em.root.querySelector("#editpay-save");
        btn.disabled = true;
        try {
          await App.q(App.sb.from("payments").update({
            amount: val,
            paid_on: fd.get("paid_on") || p.paid_on,
            method: fd.get("method"),
            reference: String(fd.get("reference") || "").trim() || null,
            notes: String(fd.get("notes") || "").trim() || null
          }).eq("id", p.id));
          em.close();
          App.toast(t("common.saved"), "success");
          openDetail(rentalId, onChanged);
          if (onChanged) onChanged();
        } catch (e2) {
          err.textContent = App.errorMessage(e2);
          err.classList.remove("hidden");
        } finally {
          btn.disabled = false;
        }
      });
    }

    const editRentalBtn = m.root.querySelector("#edit-rental");
    if (editRentalBtn) {
      editRentalBtn.addEventListener("click", function () {
        App.rentalForm({
          rental: rental,
          onSaved: function () {
            openDetail(rentalId, onChanged);
            if (onChanged) onChanged();
          },
          onClose: function () {
            openDetail(rentalId, onChanged);
          }
        });
      });
    }

    const co = m.root.querySelector("#checkout-btn");
    if (co) {
      co.addEventListener("click", function () {
        openCheckout(rental, rest, function () {
          openDetail(rentalId, onChanged);
          if (onChanged) onChanged();
        }, function () {
          openDetail(rentalId, onChanged);
        });
      });
    }

    const del = m.root.querySelector("#del-rental");
    if (del) {
      del.addEventListener("click", async function () {
        const ok = await App.confirm({ message: t("rentals.deleteWarn") });
        if (!ok) return;
        try {
          await App.q(App.sb.from("rentals").delete().eq("id", rentalId));
          m.close();
          App.toast(t("common.deleted"), "success");
          if (onChanged) onChanged();
          else App.renderRoute();
        } catch (e) { App.toast(App.errorMessage(e), "error"); }
      });
    }
  }

  /* ------------------------------- Sortie --------------------------------- */
  function openCheckout(rental, rest, onDone, onCancel) {
    const m = App.openModal({
      title: t("rentals.checkoutTitle"),
      onClose: typeof onCancel === "function" ? onCancel : undefined,
      body:
        '<p class="small muted" style="margin-bottom:14px">' +
          App.esc((rental.clients ? rental.clients.full_name : "") + " — " + (rental.apartments ? rental.apartments.name : "")) + "</p>" +
        (rest > 0.009 ? '<div class="alert warning" style="margin-bottom:14px">' + App.esc(t("rentals.checkoutWarn", { amount: App.money(rest) })) + "</div>" : "") +
        '<form id="co-form"><div class="form-grid">' +
          '<div class="field"><label>' + App.esc(t("rentals.checkoutDate")) + "</label>" +
            '<input name="ended_at" type="date" value="' + App.today() + '"></div>' +
          '<div class="field"><label>' + App.esc(t("rentals.checkoutNotes")) + "</label>" +
            '<input name="end_notes" placeholder="' + App.esc(t("common.optional")) + '"></div>' +
        "</div>" +
        '<div class="form-error hidden" id="co-err" style="margin-top:12px"></div></form>',
      footer:
        '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
        '<button type="submit" form="co-form" class="btn btn-primary" id="co-save">' + App.esc(t("rentals.checkout")) + "</button>"
    });

    m.root.querySelector("#co-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      const fd = new FormData(e.target);
      const btn = m.root.querySelector("#co-save");
      btn.disabled = true;
      try {
        await App.q(App.sb.from("rentals").update({
          status: "ended",
          ended_at: fd.get("ended_at") || App.today(),
          end_notes: String(fd.get("end_notes") || "").trim() || null
        }).eq("id", rental.id));
        m.close();
        App.toast(t("rentals.checkoutDone"), "success");
        if (onDone) onDone();
      } catch (e2) {
        const err = m.root.querySelector("#co-err");
        err.textContent = App.errorMessage(e2);
        err.classList.remove("hidden");
      } finally {
        btn.disabled = false;
      }
    });
  }

  /* ------------------------- Formulaire paiement -------------------------- */
  App.paymentForm = async function (opts) {
    opts = opts || {};
    const rentals = await App.q(
      App.sb.from("rentals").select("*, clients(full_name), apartments(name)").order("created_at", { ascending: false }).limit(300)
    );

    if (!rentals.length) {
      App.toast(t("rentals.emptyHint"), "error");
      return;
    }

    const paidMap = await App.paidByRental(rentals.map(function (r) { return r.id; }));
    const rows = rentals.map(function (r) {
      const paid = paidMap[r.id] || 0;
      return {
        rental: r,
        paid: paid,
        rest: Math.max(0, Number(r.total_amount) - paid)
      };
    });

    const selected = opts.rentalId || (rows.find(function (x) { return x.rest > 0.009 && x.rental.status === "active"; }) || rows[0]).rental.id;
    const selectedRow = rows.find(function (x) { return x.rental.id === selected; });

    const m = App.openModal({
      title: t("payments.add"),
      onClose: typeof opts.onClose === "function" ? opts.onClose : undefined,
      body:
        '<form id="pay-form"><div class="form-grid">' +
          '<div class="field span-2"><label>' + App.esc(t("payments.rental")) + " *</label>" +
            '<select name="rental_id" required>' +
              rows.map(function (x) {
                const r = x.rental;
                const label = (r.apartments ? r.apartments.name : "—") + " — " + (r.clients ? r.clients.full_name : "—") +
                  " · " + t("rentals.remaining") + " : " + App.money(x.rest) + (r.status === "ended" ? " · " + t("status.ended") : "");
                return App.option(r.id, label, r.id === selected);
              }).join("") +
            "</select></div>" +
          '<div class="field"><label>' + App.esc(t("common.amount")) + " *</label>" +
            '<input name="amount" type="number" min="0.01" step="0.01" required value="' + App.esc(selectedRow && selectedRow.rest > 0 ? selectedRow.rest : "") + '">' +
            '<span class="form-hint" id="pay-rest">' + (selectedRow ? App.esc(t("rentals.remaining") + " : " + App.money(selectedRow.rest)) : "") + "</span></div>" +
          '<div class="field"><label>' + App.esc(t("payments.paidOn")) + "</label>" +
            '<input name="paid_on" type="date" value="' + App.today() + '"></div>' +
          '<div class="field"><label>' + App.esc(t("common.method")) + "</label>" +
            '<select name="method">' +
              ["cash", "transfer", "check", "other"].map(function (x) { return App.option(x, t("method." + x), x === "cash"); }).join("") +
            "</select></div>" +
          '<div class="field"><label>' + App.esc(t("common.reference")) + "</label>" +
            '<input name="reference" placeholder="' + App.esc(t("common.optional")) + '"></div>' +
          '<div class="field span-2"><label>' + App.esc(t("common.notes")) + "</label>" +
            '<input name="notes" placeholder="' + App.esc(t("common.optional")) + '"></div>' +
        "</div>" +
        '<div class="form-error hidden" id="pay-err" style="margin-top:12px"></div></form>',
      footer:
        '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
        '<button type="submit" form="pay-form" class="btn btn-primary" id="pay-save">' + App.esc(t("common.save")) + "</button>"
    });

    const form = m.root.querySelector("#pay-form");
    const restHint = m.root.querySelector("#pay-rest");
    const err = m.root.querySelector("#pay-err");
    const sel = form.elements.rental_id;
    const amount = form.elements.amount;

    function onRentalChange() {
      const row = rows.find(function (x) { return x.rental.id === sel.value; });
      if (!row) return;
      restHint.textContent = t("rentals.remaining") + " : " + App.money(row.rest);
      if (row.rest > 0) amount.value = row.rest;
    }
    sel.addEventListener("change", onRentalChange);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      err.classList.add("hidden");
      const row = rows.find(function (x) { return x.rental.id === sel.value; });
      const val = Number(amount.value || 0);
      if (!row || val <= 0) {
        err.textContent = t("common.invalidAmount");
        err.classList.remove("hidden");
        return;
      }
      if (val > row.rest + 0.009) {
        err.textContent = t("payments.exceedsRemaining", { amount: App.money(row.rest) });
        err.classList.remove("hidden");
        return;
      }
      const btn = m.root.querySelector("#pay-save");
      btn.disabled = true;
      try {
        await App.q(App.sb.from("payments").insert({
          rental_id: sel.value,
          amount: val,
          paid_on: form.elements.paid_on.value || App.today(),
          method: form.elements.method.value,
          reference: String(form.elements.reference.value || "").trim() || null,
          notes: String(form.elements.notes.value || "").trim() || null
        }));
        m.close();
        App.toast(t("common.saved"), "success");
        if (opts.onSaved) opts.onSaved();
        else App.renderRoute();
      } catch (e2) {
        err.textContent = App.errorMessage(e2);
        err.classList.remove("hidden");
      } finally {
        btn.disabled = false;
      }
    });
  };

  /* ------------------------------- Reçu ----------------------------------- */
  App.printReceipt = async function (paymentId) {
    try {
      const p = await App.q(
        App.sb.from("payments").select("*, rentals(*, apartments(name, address, city), clients(full_name, phone))").eq("id", paymentId).single()
      );
      const r = p.rentals || {};
      const apt = r.apartments || {};
      const cli = r.clients || {};

      const allPayments = await App.q(App.sb.from("payments").select("amount,paid_on").eq("rental_id", r.id));
      const totalPaid = allPayments.reduce(function (s, x) { return s + Number(x.amount); }, 0);
      const rest = Math.max(0, Number(r.total_amount || 0) - totalPaid);

      const biz = App.brandName();
      const symbol = (App.state.settings && App.state.settings.currency_symbol) || "DA";
      const lang = App.state.lang;
      const dir = lang === "ar" ? "rtl" : "ltr";
      const money = function (v) { return App.num(v) + " " + symbol; };
      const dateStr = App.date(p.paid_on);
      const receiptNo = String(p.id).slice(0, 8).toUpperCase();

      const html =
        '<!DOCTYPE html><html lang="' + lang + '" dir="' + dir + '"><head><meta charset="utf-8"><title>' +
        App.esc(t("payments.receiptTitle")) + "</title><style>" +
        'body{font-family:' + (lang === "ar" ? "'Cairo'," : "") + 'Arial,sans-serif;color:#111;margin:0;padding:28px;background:#fff}' +
        '.sheet{max-width:680px;margin:0 auto;border:1px solid #ddd;border-radius:12px;padding:28px}' +
        '.head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:20px}' +
        '.brand{font-size:20px;font-weight:800;color:#1d4ed8}.muted{color:#666;font-size:12px}' +
        '.title{font-size:17px;font-weight:700;margin-bottom:14px}' +
        'table{width:100%;border-collapse:collapse;margin:14px 0}td{padding:8px 4px;border-bottom:1px solid #eee;font-size:13.5px}' +
        'td:last-child{text-align:end;font-weight:600}' +
        '.big{font-size:22px;color:#047857;font-weight:800}' +
        '.box{background:#f1f5ff;border-radius:10px;padding:14px;margin-top:14px}' +
        '.foot{display:flex;justify-content:space-between;margin-top:34px;font-size:12px;color:#555}' +
        '.sign{border-top:1px solid #999;padding-top:6px;width:180px;text-align:center;margin-top:40px}' +
        '@media print{body{padding:0}.sheet{border:0}}' +
        "</style></head><body><div class=\"sheet\">" +
        '<div class="head"><div><div class="brand">' + App.esc(biz) + '</div><div class="muted">' + App.esc(t("app.tagline")) + "</div></div>" +
        '<div style="text-align:end"><div class="title" style="margin:0">' + App.esc(t("payments.receiptTitle")) + "</div>" +
        '<div class="muted">' + App.esc(t("payments.receiptNo")) + " " + App.esc(receiptNo) + "</div>" +
        '<div class="muted">' + App.esc(dateStr) + "</div></div></div>" +

        '<table>' +
        "<tr><td>" + App.esc(t("payments.receivedFrom")) + "</td><td>" + App.esc(cli.full_name || "—") + "</td></tr>" +
        "<tr><td>" + App.esc(t("common.phone")) + "</td><td>" + App.esc(cli.phone || "—") + "</td></tr>" +
        "<tr><td>" + App.esc(t("payments.forApartment")) + "</td><td>" + App.esc([apt.name, apt.address, apt.city].filter(Boolean).join(" — ") || "—") + "</td></tr>" +
        "<tr><td>" + App.esc(t("payments.period")) + "</td><td>" + App.esc(App.date(r.start_date) + " → " + App.date(r.end_date)) + "</td></tr>" +
        "<tr><td>" + App.esc(t("rentals.periodType")) + "</td><td>" + App.esc(t(r.period_type === "daily" ? "rentals.periodDaily" : "rentals.periodMonthly")) + "</td></tr>" +
        "<tr><td>" + App.esc(t(App.periodLabels(r.period_type).quantity)) + "</td><td>" + App.esc(App.num(r.months) + " " + t(App.periodLabels(r.period_type).unitShort)) + "</td></tr>" +
        "<tr><td>" + App.esc(t("common.method")) + "</td><td>" + App.esc(t("method." + p.method)) + (p.reference ? " · " + App.esc(p.reference) : "") + "</td></tr>" +
        "</table>" +

        '<div class="box"><table style="margin:0"><tr><td style="border:0;font-size:15px">' + App.esc(t("payments.amountPaid")) + "</td>" +
        '<td style="border:0" class="big">' + App.esc(money(p.amount)) + "</td></tr></table></div>" +

        '<table style="margin-top:16px">' +
        "<tr><td>" + App.esc(t("rentals.totalAmount")) + "</td><td>" + App.esc(money(r.total_amount)) + "</td></tr>" +
        "<tr><td>" + App.esc(t("payments.totalPaid")) + "</td><td>" + App.esc(money(totalPaid)) + "</td></tr>" +
        "<tr><td>" + App.esc(t("payments.remainingAfter")) + "</td><td>" + App.esc(money(rest)) + "</td></tr>" +
        "</table>" +

        '<div class="foot"><div>' + App.esc(t("payments.thankYou")) + "</div>" +
        '<div class="sign">' + App.esc(t("payments.signature")) + "</div></div>" +
        "</div></body></html>";

      App.printHtml(html);
    } catch (err) {
      App.toast(App.errorMessage(err), "error");
    }
  };

  window.Views = window.Views || {};
  window.Views.rentals = { render: render };
})();
