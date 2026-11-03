/* ============================================================================
   Vue : Dépenses (administrateur et concierge)
   Chacun voit ses propres dépenses ; l'administrateur voit et gère tout.
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

  function money(n) { return App.money(n); }

  async function render(el) {
    const me = App.state.profile;
    if (!me) {
      el.innerHTML = '<div class="alert error">' + App.esc(t("errors.notAllowed")) + "</div>";
      return;
    }
    const admin = App.isAdmin();

    let profiles = {};
    if (admin) {
      try { profiles = await App.loadProfiles(); } catch (e) { /* non bloquant */ }
    }

    const state = {
      from: startOf("month"),
      to: App.today(),
      preset: "month",
      userFilter: "",
      expenses: [],
      mineTotal: 0
    };

    el.innerHTML =
      '<div class="page-head">' +
        '<div style="flex:1"><h2>' + App.esc(t("expenses.title")) + "</h2>" +
          '<div class="sub">' + App.esc(t(admin ? "expenses.allHint" : "expenses.mineHint")) + "</div></div>" +
        '<button class="btn btn-ghost" id="exp-export">' + App.icon("download", 16) + App.esc(t("common.export")) + "</button>" +
        '<button class="btn btn-primary" id="exp-add">' + App.icon("plus", 16) + App.esc(t("expenses.new")) + "</button>" +
      "</div>" +

      '<div class="toolbar">' +
        '<div class="seg" id="exp-tabs">' +
          '<button data-preset="today">' + App.esc(t("common.today")) + "</button>" +
          '<button data-preset="week">' + App.esc(t("common.week")) + "</button>" +
          '<button data-preset="month" class="active">' + App.esc(t("common.month")) + "</button>" +
          '<button data-preset="year">' + App.esc(t("common.year")) + "</button>" +
          '<button data-preset="all">' + App.esc(t("common.all")) + "</button>" +
        "</div>" +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          (admin
            ? '<select id="exp-user" style="width:auto">' +
                App.option("", t("expenses.allUsers"), true) +
                Object.keys(profiles).map(function (id) { return profiles[id]; })
                  .sort(function (a, b) {
                    return String(a.full_name || a.email || "").localeCompare(String(b.full_name || b.email || ""));
                  })
                  .map(function (p) {
                    return App.option(p.id, (p.full_name || p.email || "—") + " (" + t("role." + p.role) + ")");
                  }).join("") +
              "</select>"
            : "") +
          '<input type="date" id="exp-from" value="' + state.from + '" style="width:auto">' +
          '<span class="muted">→</span>' +
          '<input type="date" id="exp-to" value="' + state.to + '" style="width:auto">' +
        "</div>" +
      "</div>" +

      '<div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">' +
        '<div class="stat amber"><div class="stat-label">' + App.icon("expenses", 15) + "<span>" +
          App.esc(t(admin ? "expenses.total" : "expenses.mine")) + "</span></div>" +
          '<div class="stat-value" id="exp-total">—</div></div>' +
        (admin
          ? '<div class="stat"><div class="stat-label">' + App.icon("clients", 15) + "<span>" +
              App.esc(t("expenses.mine")) + "</span></div>" +
              '<div class="stat-value" id="exp-mine">—</div></div>'
          : "") +
        '<div class="stat"><div class="stat-label">' + App.icon("checkCircle", 15) + "<span>" +
          App.esc(t("expenses.count")) + "</span></div>" +
          '<div class="stat-value" id="exp-count">—</div></div>' +
      "</div>" +

      '<div class="card"><div class="card-head"><h2>' + App.esc(t("expenses.title")) + "</h2>" +
        '<span class="small muted" id="exp-list-count"></span></div>' +
        '<div class="card-body tight" id="exp-list"></div></div>';

    async function reload() {
      const list = el.querySelector("#exp-list");
      list.innerHTML = App.loadingBlock();

      let q = App.sb.from("expenses").select("*");
      if (state.from) q = q.gte("spent_on", state.from);
      if (state.to) q = q.lte("spent_on", state.to);
      if (!admin) q = q.eq("created_by", me.id);
      else if (state.userFilter) q = q.eq("created_by", state.userFilter);
      q = q.order("spent_on", { ascending: false }).order("created_at", { ascending: false }).limit(1000);

      let mineQ = null;
      if (admin) {
        mineQ = App.sb.from("expenses").select("amount").eq("created_by", me.id);
        if (state.from) mineQ = mineQ.gte("spent_on", state.from);
        if (state.to) mineQ = mineQ.lte("spent_on", state.to);
      }

      try {
        const res = await Promise.all([App.q(q), mineQ ? App.q(mineQ) : Promise.resolve([])]);
        state.expenses = res[0];
        state.mineTotal = admin
          ? res[1].reduce(function (s, x) { return s + Number(x.amount); }, 0)
          : state.expenses.reduce(function (s, x) { return s + Number(x.amount); }, 0);
        paint();
      } catch (err) {
        list.innerHTML = '<div class="alert error" style="margin:14px">' + App.esc(App.errorMessage(err)) + "</div>";
      }
    }

    function paint() {
      const total = state.expenses.reduce(function (s, x) { return s + Number(x.amount); }, 0);

      el.querySelector("#exp-total").textContent = money(total);
      el.querySelector("#exp-count").textContent = App.num(state.expenses.length);
      const mineEl = el.querySelector("#exp-mine");
      if (mineEl) mineEl.textContent = money(state.mineTotal);

      el.querySelector("#exp-list-count").textContent = App.num(state.expenses.length);

      const list = el.querySelector("#exp-list");
      if (!state.expenses.length) {
        list.innerHTML = App.emptyState("🧾", t("expenses.empty"), t("expenses.emptyHint"));
        return;
      }

      list.innerHTML =
        '<div class="table-wrap"><table><thead><tr>' +
          "<th>" + App.esc(t("common.date")) + "</th>" +
          "<th>" + App.esc(t("cash.label")) + "</th>" +
          "<th>" + App.esc(t("expenses.paidBy")) + "</th>" +
          "<th>" + App.esc(t("common.notes")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.amount")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.actions")) + "</th>" +
        "</tr></thead><tbody>" +
        state.expenses.map(function (x) {
          const canManage = admin || x.created_by === me.id;
          return "<tr>" +
            '<td class="small nowrap">' + App.date(x.spent_on) + "</td>" +
            "<td><div class=\"cell-main\">" + App.esc(x.label) + "</div>" +
              '<div class="cell-sub">' + App.esc(x.category || "—") + "</div></td>" +
            '<td class="small nowrap">' + App.esc(App.profileName(x.created_by)) + "</td>" +
            '<td class="small">' + App.esc(x.notes || "—") + "</td>" +
            '<td class="num" style="text-align:end;font-weight:700;color:var(--danger)">− ' +
              App.esc(money(x.amount)) + "</td>" +
            '<td class="actions">' +
              (canManage
                ? '<button class="icon-btn" data-edit="' + x.id + '" title="' + App.esc(t("common.edit")) + '">' + App.icon("edit", 15) + "</button>" +
                  '<button class="icon-btn danger" data-del="' + x.id + '" title="' + App.esc(t("common.delete")) + '">' + App.icon("trash", 15) + "</button>"
                : "") +
            "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";

      state.expenses.forEach(function (x) {
        const ed = list.querySelector('[data-edit="' + x.id + '"]');
        if (ed) ed.addEventListener("click", function () { expenseForm(x); });
        const del = list.querySelector('[data-del="' + x.id + '"]');
        if (del) del.addEventListener("click", function () { remove(x); });
      });
    }

    async function remove(x) {
      const ok = await App.confirm({
        title: t("expenses.confirmDelete"),
        message: x.label,
        detail: App.money(x.amount) + " · " + App.date(x.spent_on) + " · " + App.profileName(x.created_by),
        confirmLabel: t("common.delete")
      });
      if (!ok) return;
      try {
        await App.q(App.sb.from("expenses").delete().eq("id", x.id));
        App.toast(t("expenses.deleted"), "success");
        reload();
      } catch (e) {
        App.toast(App.errorMessage(e), "error");
      }
    }

    function expenseForm(x) {
      const isEdit = !!x;
      const ownerId = isEdit ? x.created_by : me.id;
      const ownerName = App.profileName(ownerId) || me.full_name || me.email || "—";

      const m = App.openModal({
        title: isEdit ? t("expenses.edit") : t("expenses.new"),
        body:
          '<form id="exp-form">' +
            '<div class="alert info" style="margin-bottom:14px">' +
              App.esc(t("expenses.recordedAs", { name: ownerName })) + "</div>" +
            '<div class="form-grid">' +
              '<div class="field span-2"><label>' + App.esc(t("cash.label")) + " *</label>" +
                '<input name="label" required maxlength="160" value="' + App.esc(isEdit ? x.label : "") + '" placeholder="' + App.esc(t("cash.label")) + '"></div>' +
              '<div class="field"><label>' + App.esc(t("common.amount")) + " *</label>" +
                '<input name="amount" type="number" min="0.01" step="0.01" required value="' + App.esc(isEdit ? x.amount : "") + '"></div>' +
              '<div class="field"><label>' + App.esc(t("common.date")) + "</label>" +
                '<input name="spent_on" type="date" value="' + App.esc(isEdit ? x.spent_on : App.today()) + '"></div>' +
              '<div class="field"><label>' + App.esc(t("cash.category")) + "</label>" +
                '<input name="category" maxlength="80" value="' + App.esc(isEdit ? (x.category || "") : "") + '" placeholder="' + App.esc(t("common.optional")) + '"></div>' +
              '<div class="field"><label>' + App.esc(t("common.notes")) + "</label>" +
                '<input name="notes" maxlength="240" value="' + App.esc(isEdit ? (x.notes || "") : "") + '"></div>' +
            "</div>" +
            '<div class="form-error hidden" id="exp-err" style="margin-top:12px"></div>' +
          "</form>",
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
        err.classList.add("hidden");
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
      const rows = [[
        t("common.date"), t("cash.label"), t("cash.category"),
        t("expenses.paidBy"), t("common.notes"), t("common.amount")
      ]];
      state.expenses.forEach(function (x) {
        rows.push([
          x.spent_on, x.label, x.category || "",
          App.profileName(x.created_by), x.notes || "",
          String(Number(x.amount))
        ]);
      });
      const csv = rows.map(function (r) {
        return r.map(function (c) {
          return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"';
        }).join(";");
      }).join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "depenses_" + (state.from || "debut") + "_" + (state.to || "fin") + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      App.toast(t("expenses.exportDone"), "success");
    }

    el.querySelector("#exp-add").addEventListener("click", function () { expenseForm(null); });
    el.querySelector("#exp-export").addEventListener("click", exportCsv);

    el.querySelectorAll("#exp-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        state.preset = b.getAttribute("data-preset");
        state.from = startOf(state.preset);
        state.to = state.preset === "all" ? "" : App.today();
        el.querySelectorAll("#exp-tabs button").forEach(function (x) {
          x.classList.toggle("active", x === b);
        });
        el.querySelector("#exp-from").value = state.from;
        el.querySelector("#exp-to").value = state.to;
        reload();
      });
    });

    function onCustom() {
      state.from = el.querySelector("#exp-from").value;
      state.to = el.querySelector("#exp-to").value;
      el.querySelectorAll("#exp-tabs button").forEach(function (x) { x.classList.remove("active"); });
      reload();
    }
    el.querySelector("#exp-from").addEventListener("change", onCustom);
    el.querySelector("#exp-to").addEventListener("change", onCustom);

    const userSel = el.querySelector("#exp-user");
    if (userSel) {
      userSel.addEventListener("change", function () {
        state.userFilter = userSel.value;
        reload();
      });
    }

    reload();
  }

  window.Views = window.Views || {};
  window.Views.expenses = { render: render };
})();
