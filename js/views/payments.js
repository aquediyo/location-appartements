/* ============================================================================
   Vue : Paiements
   ============================================================================ */

(function () {
  "use strict";

  const t = App.t;

  function periodStart(kind) {
    const today = App.today();
    if (kind === "today") return today;
    if (kind === "week") return App.addDays(today, -6);
    if (kind === "year") return today.slice(0, 4) + "-01-01";
    return today.slice(0, 8) + "01"; // month
  }

  async function render(el) {
    const isAdmin = App.isAdmin();
    const all = await App.q(
      App.sb.from("payments")
        .select("*, rentals(start_date, end_date, total_amount, apartments(name), clients(full_name))")
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(800)
    );
    try { await App.loadProfiles(); } catch (e) { /* ignore */ }

    let tab = "month";
    let search = "";
    let method = "";

    el.innerHTML =
      '<div class="page-head">' +
        '<h2 style="flex:1">' + App.esc(t("payments.title")) + "</h2>" +
        '<button class="btn btn-primary" id="add-pay">' + App.icon("plus", 16) + App.esc(t("payments.add")) + "</button>" +
      "</div>" +
      '<div class="stats" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">' +
        '<div class="stat green"><div class="stat-label">' + App.icon("payments", 15) + "<span>" + App.esc(t("payments.totalPaid")) + "</span></div>" +
          '<div class="stat-value" id="pay-total">—</div><div class="stat-foot" id="pay-count"></div></div>' +
      "</div>" +
      '<div class="toolbar">' +
        '<div class="seg" id="pay-tabs">' +
          '<button data-tab="today">' + App.esc(t("common.today")) + "</button>" +
          '<button data-tab="week">' + App.esc(t("common.week")) + "</button>" +
          '<button data-tab="month" class="active">' + App.esc(t("common.month")) + "</button>" +
          '<button data-tab="year">' + App.esc(t("common.year")) + "</button>" +
          '<button data-tab="all">' + App.esc(t("common.all")) + "</button>" +
        "</div>" +
        '<select id="pay-method"><option value="">' + App.esc(t("common.method")) + "</option>" +
          ["cash", "transfer", "check", "other"].map(function (x) { return App.option(x, t("method." + x)); }).join("") +
        "</select>" +
        '<div class="search">' + App.icon("search", 16) + '<input id="pay-search" type="search" placeholder="' + App.esc(t("common.search")) + '"></div>' +
      "</div>" +
      '<div class="card"><div class="card-body tight" id="pay-list"></div></div>';

    const list = el.querySelector("#pay-list");

    function rows() {
      const from = tab === "all" ? null : periodStart(tab);
      return all.filter(function (p) {
        if (from && p.paid_on < from) return false;
        if (method && p.method !== method) return false;
        if (search) {
          const r = p.rentals || {};
          const hay = [
            r.clients && r.clients.full_name,
            r.apartments && r.apartments.name,
            p.reference, p.notes
          ].join(" ").toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });
    }

    function paint() {
      const data = rows();
      const total = data.reduce(function (s, p) { return s + Number(p.amount); }, 0);
      el.querySelector("#pay-total").textContent = App.money(total);
      el.querySelector("#pay-count").textContent = App.num(data.length) + " " + t("common.count").toLowerCase();

      if (!data.length) {
        list.innerHTML = App.emptyState("💳", t("payments.empty"), t("payments.emptyHint"));
        return;
      }

      list.innerHTML =
        '<div class="table-wrap"><table><thead><tr>' +
          "<th>" + App.esc(t("common.date")) + "</th>" +
          "<th>" + App.esc(t("rentals.apartment")) + " / " + App.esc(t("rentals.client")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.amount")) + "</th>" +
          "<th>" + App.esc(t("common.method")) + "</th>" +
          "<th>" + App.esc(t("common.reference")) + "</th>" +
          "<th>" + App.esc(t("common.user")) + "</th>" +
          '<th style="text-align:end">' + App.esc(t("common.actions")) + "</th>" +
        "</tr></thead><tbody>" +
        data.map(function (p) {
          const r = p.rentals || {};
          return "<tr>" +
            '<td class="small nowrap">' + App.date(p.paid_on) + "</td>" +
            '<td><div class="cell-main">' + App.esc(r.clients ? r.clients.full_name : "—") + "</div>" +
              '<div class="cell-sub">' + App.esc(r.apartments ? r.apartments.name : "—") + "</div></td>" +
            '<td class="num" style="text-align:end;font-weight:700;color:var(--success)">' + App.esc(App.money(p.amount)) + "</td>" +
            "<td>" + App.esc(t("method." + p.method)) + "</td>" +
            '<td class="small">' + App.esc(p.reference || "—") + "</td>" +
            '<td class="small">' + App.esc(App.profileName(p.created_by)) + "</td>" +
            '<td class="actions">' +
              '<button class="icon-btn" data-receipt="' + p.id + '" title="' + App.esc(t("payments.receipt")) + '">' + App.icon("print", 15) + "</button>" +
              (isAdmin ? '<button class="icon-btn danger" data-del="' + p.id + '" title="' + App.esc(t("common.delete")) + '">' + App.icon("trash", 15) + "</button>" : "") +
            "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";

      data.forEach(function (p) {
        list.querySelector('[data-receipt="' + p.id + '"]').addEventListener("click", function () { App.printReceipt(p.id); });
        const del = list.querySelector('[data-del="' + p.id + '"]');
        if (del) {
          del.addEventListener("click", async function () {
            const ok = await App.confirm({ message: t("common.confirmDelete") + " " + t("common.cannotUndo") });
            if (!ok) return;
            try {
              await App.q(App.sb.from("payments").delete().eq("id", p.id));
              App.toast(t("common.deleted"), "success");
              render(el);
            } catch (e) { App.toast(App.errorMessage(e), "error"); }
          });
        }
      });
    }

    el.querySelectorAll("#pay-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        tab = b.getAttribute("data-tab");
        el.querySelectorAll("#pay-tabs button").forEach(function (x) { x.classList.toggle("active", x === b); });
        paint();
      });
    });
    el.querySelector("#pay-method").addEventListener("change", function (e) { method = e.target.value; paint(); });
    el.querySelector("#pay-search").addEventListener("input", function (e) { search = e.target.value.trim().toLowerCase(); paint(); });
    el.querySelector("#add-pay").addEventListener("click", function () {
      App.paymentForm({ onSaved: function () { render(el); } });
    });

    paint();
  }

  window.Views = window.Views || {};
  window.Views.payments = { render: render };
})();
