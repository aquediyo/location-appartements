/* ============================================================================
   Vue : Caisse (administrateur)
   ============================================================================ */

(function () {
  "use strict";

  const t = App.t;

  function startOf(kind) {
    const today = App.today();
    if (kind === "today") return today;
    if (kind === "week") return App.addDays(today, -6);
    if (kind === "year") return today.slice(0, 4) + "-01-01";
    if (kind === "all") return "";
    return today.slice(0, 8) + "01";
  }

  async function render(el) {
    if (!App.isAdmin()) {
      el.innerHTML = '<div class="alert error">' + App.esc(t("errors.notAllowed")) + "</div>";
      return;
    }

    try { await App.loadProfiles(); } catch (e) { /* ignore */ }

    const activeRentals = await App.q(App.sb.from("rentals").select("id,total_amount").eq("status", "active"));
    const activePaid = await App.paidByRental(activeRentals.map(function (r) { return r.id; }));
    let outstanding = 0;
    activeRentals.forEach(function (r) {
      outstanding += Math.max(0, Number(r.total_amount) - (activePaid[r.id] || 0));
    });

    const state = { from: startOf("month"), to: App.today(), preset: "month", payments: [], expenses: [] };

    el.innerHTML =
      '<div class="page-head">' +
        '<div style="flex:1"><h2>' + App.esc(t("cash.title")) + '</h2><div class="sub">' + App.esc(t("cash.periodHint")) + "</div></div>" +
        '<button class="btn btn-ghost" id="cash-export">' + App.icon("download", 16) + App.esc(t("common.export")) + "</button>" +
        '<button class="btn btn-primary" id="add-expense">' + App.icon("plus", 16) + App.esc(t("cash.addExpense")) + "</button>" +
      "</div>" +

      '<div class="toolbar">' +
        '<div class="seg" id="cash-tabs">' +
          '<button data-preset="today">' + App.esc(t("common.today")) + "</button>" +
          '<button data-preset="week">' + App.esc(t("common.week")) + "</button>" +
          '<button data-preset="month" class="active">' + App.esc(t("common.month")) + "</button>" +
          '<button data-preset="year">' + App.esc(t("common.year")) + "</button>" +
          '<button data-preset="all">' + App.esc(t("common.all")) + "</button>" +
        "</div>" +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          '<input type="date" id="cash-from" value="' + state.from + '" style="width:auto">' +
          '<span class="muted">→</span>' +
          '<input type="date" id="cash-to" value="' + state.to + '" style="width:auto">' +
        "</div>" +
      "</div>" +

      '<div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' +
        '<div class="stat green"><div class="stat-label">' + App.icon("payments", 15) + "<span>" + App.esc(t("cash.income")) + "</span></div>" +
          '<div class="stat-value" id="cash-income">—</div></div>' +
        '<div class="stat amber"><div class="stat-label">' + App.icon("cash", 15) + "<span>" + App.esc(t("cash.expenses")) + "</span></div>" +
          '<div class="stat-value" id="cash-expense">—</div></div>' +
        '<div class="stat"><div class="stat-label">' + App.icon("checkCircle", 15) + "<span>" + App.esc(t("cash.balance")) + "</span></div>" +
          '<div class="stat-value" id="cash-balance">—</div></div>' +
        '<div class="stat red"><div class="stat-label">' + App.icon("alert", 15) + "<span>" + App.esc(t("cash.outstanding")) + "</span></div>" +
          '<div class="stat-value">' + App.esc(App.money(outstanding)) + '</div>' +
          '<div class="stat-foot">' + App.esc(t("cash.outstandingHint")) + "</div></div>" +
      "</div>" +

      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:16px" id="cash-breakdowns">' +
        breakdownCard("cash-by-method", t("cash.byMethod")) +
        breakdownCard("cash-by-apt", t("cash.byApartment")) +
        breakdownCard("cash-by-user", t("cash.byUser")) +
      "</div>" +

      '<div class="card"><div class="card-head"><h2>' + App.esc(t("cash.transactions")) + "</h2>" +
        '<span class="small muted" id="cash-count"></span></div>' +
        '<div class="card-body tight" id="cash-list"></div></div>';

    function breakdownCard(id, title) {
      return '<div class="card"><div class="card-head"><h2 style="font-size:14px">' + App.esc(title) + "</h2></div>" +
        '<div class="card-body"><div class="bars" id="' + id + '"></div></div></div>';
    }

    async function reload() {
      const list = el.querySelector("#cash-list");
      list.innerHTML = App.loadingBlock();

      let pq = App.sb.from("payments").select("*, rentals(apartments(name), clients(full_name))");
      if (state.from) pq = pq.gte("paid_on", state.from);
      if (state.to) pq = pq.lte("paid_on", state.to);

      let eq = App.sb.from("expenses").select("*");
      if (state.from) eq = eq.gte("spent_on", state.from);
      if (state.to) eq = eq.lte("spent_on", state.to);

      try {
        const res = await Promise.all([App.q(pq), App.q(eq)]);
        state.payments = res[0];
        state.expenses = res[1];
        paint();
      } catch (err) {
        list.innerHTML = '<div class="alert error" style="margin:14px">' + App.esc(App.errorMessage(err)) + "</div>";
      }
    }

    function paint() {
      const income = state.payments.reduce(function (s, p) { return s + Number(p.amount); }, 0);
      const spent = state.expenses.reduce(function (s, e) { return s + Number(e.amount); }, 0);
      const balance = income - spent;

      el.querySelector("#cash-income").textContent = App.money(income);
      el.querySelector("#cash-expense").textContent = App.money(spent);
      const balEl = el.querySelector("#cash-balance");
      balEl.textContent = App.money(balance);
      balEl.classList.toggle("neg", balance < 0);

      paintBars("#cash-by-method", groupPayments(function (p) { return t("method." + p.method); }));
      paintBars("#cash-by-apt", groupPayments(function (p) {
        return p.rentals && p.rentals.apartments ? p.rentals.apartments.name : "—";
      }));
      paintBars("#cash-by-user", groupPayments(function (p) { return App.profileName(p.created_by); }));

      const rows = [];
      state.payments.forEach(function (p) {
        const r = p.rentals || {};
        rows.push({
          kind: "payment",
          id: p.id,
          date: p.paid_on,
          created: p.created_at,
          label: (r.clients ? r.clients.full_name : "—") + (r.apartments ? " · " + r.apartments.name : ""),
          meta: t("method." + p.method) + (p.reference ? " · " + p.reference : ""),
          user: App.profileName(p.created_by),
          amount: Number(p.amount)
        });
      });
      state.expenses.forEach(function (x) {
        rows.push({
          kind: "expense",
          id: x.id,
          date: x.spent_on,
          created: x.created_at,
          label: x.label,
          meta: x.category || "—",
          user: App.profileName(x.created_by),
          amount: -Number(x.amount),
          expense: x
        });
      });
      rows.sort(function (a, b) {
        if (a.date === b.date) return String(b.created).localeCompare(String(a.created));
        return String(b.date).localeCompare(String(a.date));
      });

      el.querySelector("#cash-count").textContent = App.num(rows.length) + " " + t("common.count").toLowerCase();

      const list = el.querySelector("#cash-list");
      if (!rows.length) {
        list.innerHTML = App.emptyState("🧾", t("cash.empty"));
        return;
      }

      list.innerHTML =
        '<div class="table-wrap"><table><thead><tr>' +
          "<th>" + App.esc(t("common.date")) + "</th>" +
          "<th>" + App.esc(t("cash.type")) + "</th>" +
          "<th>" + App.esc(t("cash.label")) + " / " + App.esc(t("common.details")) + "</th>" +
          "<th>" + App.esc(t("common.user")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.amount")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.actions")) + "</th>" +
        "</tr></thead><tbody>" +
        rows.map(function (r) {
          const isPay = r.kind === "payment";
          return "<tr>" +
            '<td class="small nowrap">' + App.date(r.date) + "</td>" +
            '<td><span class="badge ' + (isPay ? "green" : "amber") + '">' + App.esc(t("cash." + r.kind)) + "</span></td>" +
            '<td><div class="cell-main">' + App.esc(r.label) + '</div><div class="cell-sub">' + App.esc(r.meta) + "</div></td>" +
            '<td class="small">' + App.esc(r.user) + "</td>" +
            '<td class="num" style="text-align:end;font-weight:700;color:' + (isPay ? "var(--success)" : "var(--danger)") + '">' +
              (isPay ? "+" : "−") + " " + App.esc(App.money(Math.abs(r.amount))) + "</td>" +
            '<td class="actions">' +
              (isPay
                ? '<button class="icon-btn" data-receipt="' + r.id + '" title="' + App.esc(t("payments.receipt")) + '">' + App.icon("print", 15) + "</button>"
                : '<button class="icon-btn" data-editexp="' + r.id + '" title="' + App.esc(t("common.edit")) + '">' + App.icon("edit", 15) + "</button>" +
                  '<button class="icon-btn danger" data-delexp="' + r.id + '" title="' + App.esc(t("common.delete")) + '">' + App.icon("trash", 15) + "</button>") +
            "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";

      rows.forEach(function (r) {
        const rec = list.querySelector('[data-receipt="' + r.id + '"]');
        if (rec) rec.addEventListener("click", function () { App.printReceipt(r.id); });
        const del = list.querySelector('[data-delexp="' + r.id + '"]');
        if (del) del.addEventListener("click", function () { removeExpense(r.expense); });
        const ed = list.querySelector('[data-editexp="' + r.id + '"]');
        if (ed) ed.addEventListener("click", function () { expenseForm(r.expense); });
      });

      function groupPayments(keyFn) {
        const map = {};
        state.payments.forEach(function (p) {
          const k = keyFn(p) || "—";
          map[k] = (map[k] || 0) + Number(p.amount);
        });
        return Object.keys(map).map(function (k) { return { label: k, value: map[k] }; })
          .filter(function (x) { return x.value > 0; })
          .sort(function (a, b) { return b.value - a.value; });
      }

      function paintBars(sel, groups) {
        const box = el.querySelector(sel);
        if (!groups.length) {
          box.innerHTML = '<p class="small muted">' + App.esc(t("cash.noData")) + "</p>";
          return;
        }
        const max = Math.max.apply(null, groups.map(function (g) { return g.value; })) || 1;
        box.innerHTML = groups.map(function (g) {
          const pct = Math.max(2, Math.round((g.value / max) * 100));
          return '<div class="bar-row"><span>' + App.esc(g.label) + "</span>" +
            '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
            '<span class="bar-value">' + App.esc(App.money(g.value)) + "</span></div>";
        }).join("");
      }
    }

    async function removeExpense(x) {
      const ok = await App.confirm({ message: t("common.confirmDelete") + " " + t("common.cannotUndo") });
      if (!ok) return;
      try {
        await App.q(App.sb.from("expenses").delete().eq("id", x.id));
        App.toast(t("common.deleted"), "success");
        reload();
      } catch (e) { App.toast(App.errorMessage(e), "error"); }
    }

    function expenseForm(x) {
      const isEdit = !!x;
      const m = App.openModal({
        title: isEdit ? t("cash.editExpense") : t("cash.addExpense"),
        body:
          '<form id="exp-form"><div class="form-grid">' +
            '<div class="field span-2"><label>' + App.esc(t("cash.label")) + " *</label>" +
              '<input name="label" required value="' + App.esc(isEdit ? x.label : "") + '" placeholder="' + App.esc(t("cash.label")) + '"></div>' +
            '<div class="field"><label>' + App.esc(t("common.amount")) + " *</label>" +
              '<input name="amount" type="number" min="0.01" step="0.01" required value="' + App.esc(isEdit ? x.amount : "") + '"></div>' +
            '<div class="field"><label>' + App.esc(t("common.date")) + "</label>" +
              '<input name="spent_on" type="date" value="' + App.esc(isEdit ? x.spent_on : App.today()) + '"></div>' +
            '<div class="field"><label>' + App.esc(t("cash.category")) + "</label>" +
              '<input name="category" value="' + App.esc(isEdit ? (x.category || "") : "") + '" placeholder="' + App.esc(t("common.optional")) + '"></div>' +
            '<div class="field"><label>' + App.esc(t("common.notes")) + "</label>" +
              '<input name="notes" value="' + App.esc(isEdit ? (x.notes || "") : "") + '"></div>' +
          "</div>" +
          '<div class="form-error hidden" id="exp-err" style="margin-top:12px"></div></form>',
        footer:
          '<button type="button" class="btn btn-ghost" data-modal-close>' + App.esc(t("common.cancel")) + "</button>" +
          '<button type="submit" form="exp-form" class="btn btn-primary" id="exp-save">' + App.esc(t("common.save")) + "</button>"
      });

      m.root.querySelector("#exp-form").addEventListener("submit", async function (e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const err = m.root.querySelector("#exp-err");
        const btn = m.root.querySelector("#exp-save");
        const payload = {
          label: String(fd.get("label") || "").trim(),
          amount: Number(fd.get("amount") || 0),
          spent_on: fd.get("spent_on") || App.today(),
          category: String(fd.get("category") || "").trim() || null,
          notes: String(fd.get("notes") || "").trim() || null
        };
        if (!payload.label || payload.amount <= 0) {
          err.textContent = t("errors.missingFields");
          err.classList.remove("hidden");
          return;
        }
        btn.disabled = true;
        try {
          if (isEdit) await App.q(App.sb.from("expenses").update(payload).eq("id", x.id));
          else await App.q(App.sb.from("expenses").insert(payload));
          m.close();
          App.toast(t("cash.expenseSaved"), "success");
          reload();
        } catch (e2) {
          err.textContent = App.errorMessage(e2);
          err.classList.remove("hidden");
        } finally {
          btn.disabled = false;
        }
      });
    }

    function exportCsv() {
      const rows = [["Date", "Type", "Libelle", "Details", "Utilisateur", "Montant"]];
      state.payments.forEach(function (p) {
        const r = p.rentals || {};
        rows.push([
          p.paid_on, "Paiement",
          (r.clients ? r.clients.full_name : "") + (r.apartments ? " - " + r.apartments.name : ""),
          t("method." + p.method) + (p.reference ? " - " + p.reference : ""),
          App.profileName(p.created_by),
          String(Number(p.amount))
        ]);
      });
      state.expenses.forEach(function (x) {
        rows.push([x.spent_on, "Depense", x.label, x.category || "", App.profileName(x.created_by), String(-Number(x.amount))]);
      });
      rows.sort(function (a, b) { return String(b[0]).localeCompare(String(a[0])); });

      const csv = rows.map(function (r) {
        return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(";");
      }).join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "caisse_" + (state.from || "debut") + "_" + (state.to || "fin") + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      App.toast(t("cash.exportDone"), "success");
    }

    el.querySelector("#add-expense").addEventListener("click", function () { expenseForm(null); });
    el.querySelector("#cash-export").addEventListener("click", exportCsv);

    el.querySelectorAll("#cash-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        state.preset = b.getAttribute("data-preset");
        state.from = startOf(state.preset);
        state.to = state.preset === "all" ? "" : App.today();
        el.querySelectorAll("#cash-tabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
        el.querySelector("#cash-from").value = state.from;
        el.querySelector("#cash-to").value = state.to;
        reload();
      });
    });

    function onCustom() {
      state.from = el.querySelector("#cash-from").value;
      state.to = el.querySelector("#cash-to").value;
      el.querySelectorAll("#cash-tabs button").forEach(function (x) { x.classList.remove("active"); });
      reload();
    }
    el.querySelector("#cash-from").addEventListener("change", onCustom);
    el.querySelector("#cash-to").addEventListener("change", onCustom);

    reload();
  }

  window.Views = window.Views || {};
  window.Views.cash = { render: render };
})();
