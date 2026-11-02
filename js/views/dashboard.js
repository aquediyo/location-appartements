/* ============================================================================
   Vue : Tableau de bord
   ============================================================================ */

(function () {
  "use strict";

  async function render(el) {
    const t = App.t;
    const today = App.today();
    const monthStart = today.slice(0, 8) + "01";

    const [apartments, activeRentals, monthPayments, reservations] = await Promise.all([
      App.q(App.sb.from("apartments").select("id,status")),
      App.q(App.sb.from("rentals").select("*, clients(full_name), apartments(name)").eq("status", "active").order("start_date", { ascending: false })),
      App.q(App.sb.from("payments").select("amount").gte("paid_on", monthStart).lte("paid_on", today)),
      App.q(App.sb.from("reservations").select("*, clients(full_name), apartments(name)").in("status", ["pending", "confirmed"]).gte("start_date", today).order("start_date").limit(5))
    ]);

    const paid = await App.paidByRental(activeRentals.map(function (r) { return r.id; }));
    let outstanding = 0;
    activeRentals.forEach(function (r) {
      outstanding += Math.max(0, Number(r.total_amount) - (paid[r.id] || 0));
    });

    const collected = monthPayments.reduce(function (s, p) { return s + Number(p.amount); }, 0);
    const available = apartments.filter(function (a) { return a.status === "available"; }).length;
    const occupied = apartments.filter(function (a) { return a.status === "occupied"; }).length;

    const upcomingAll = await App.q(
      App.sb.from("reservations").select("id")
        .in("status", ["pending", "confirmed"]).gte("start_date", today)
    );
    const upcomingCount = upcomingAll.length;

    const profileName = (App.state.profile && App.state.profile.full_name) || "";
    const firstName = profileName.split(/\s+/)[0] || "";

    el.innerHTML =
      '<div class="page-head">' +
        '<div style="flex:1">' +
          '<h2>' + App.esc(t("dashboard.hello") + (firstName ? ", " + firstName : "") + " 👋") + "</h2>" +
          '<div class="sub">' + App.esc(t("dashboard.overview")) + "</div>" +
        "</div>" +
        '<div class="actions-row">' +
          '<button class="btn btn-primary" id="qa-rental">' + App.icon("plus", 16) + App.esc(t("dashboard.newRental")) + "</button>" +
          '<button class="btn btn-ghost" id="qa-reservation">' + App.icon("reservations", 16) + App.esc(t("dashboard.newReservation")) + "</button>" +
        "</div>" +
      "</div>" +

      '<div class="stats">' +
        stat("apartments", t("dashboard.apartments"), apartments.length, t("dashboard.occupied") + " : " + occupied, "") +
        stat("home", t("dashboard.available"), available, available + " " + t("common.of").toLowerCase() + " " + apartments.length, "green") +
        stat("key", t("dashboard.activeRentals"), activeRentals.length, "", "violet") +
        stat("reservations", t("dashboard.upcomingRes"), upcomingCount, "", "amber") +
        stat("payments", t("dashboard.collectedMonth"), App.money(collected), "", "") +
        stat("alert", t("dashboard.outstanding"), App.money(outstanding), "", outstanding > 0 ? "red" : "green") +
      "</div>" +

      '<div class="dash-cols" id="dash-cols">' +
        '<div class="card">' +
          '<div class="card-head"><h2>' + App.esc(t("dashboard.activeRentalsList")) + "</h2>" +
            '<button class="btn btn-ghost btn-sm" id="go-rentals">' + App.esc(t("common.view")) + "</button></div>" +
          '<div class="card-body tight">' +
            (activeRentals.length ? activeRentalsTable(activeRentals, paid) : App.emptyState("🔑", t("dashboard.noActiveRentals"))) +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          '<div class="card-head"><h2>' + App.esc(t("dashboard.nextReservations")) + "</h2>" +
            '<button class="btn btn-ghost btn-sm" id="go-reservations">' + App.esc(t("common.view")) + "</button></div>" +
          '<div class="card-body tight">' +
            (reservations.length ? reservationsTable(reservations) : App.emptyState("📅", t("dashboard.noReservations"))) +
          "</div>" +
        "</div>" +
      "</div>";

    el.querySelector("#qa-rental").addEventListener("click", function () {
      if (App.rentalForm) App.rentalForm({ onSaved: render.bind(null, el) });
      else App.navigate("rentals");
    });
    el.querySelector("#qa-reservation").addEventListener("click", function () {
      if (App.reservationForm) App.reservationForm({ onSaved: render.bind(null, el) });
      else App.navigate("reservations");
    });
    el.querySelector("#go-rentals").addEventListener("click", function () { App.navigate("rentals"); });
    el.querySelector("#go-reservations").addEventListener("click", function () { App.navigate("reservations"); });

    function stat(icon, label, value, foot, color) {
      return '<div class="stat ' + (color || "") + '">' +
        '<div class="stat-label">' + App.icon(icon, 15) + "<span>" + App.esc(label) + "</span></div>" +
        '<div class="stat-value">' + (typeof value === "number" ? App.num(value) : App.esc(value)) + "</div>" +
        (foot ? '<div class="stat-foot">' + App.esc(foot) + "</div>" : "") +
      "</div>";
    }

    function activeRentalsTable(rows, paidMap) {
      return '<div class="table-wrap"><table><thead><tr>' +
        "<th>" + App.esc(t("rentals.apartment")) + "</th>" +
        "<th>" + App.esc(t("rentals.client")) + "</th>" +
        "<th>" + App.esc(t("common.date")) + "</th>" +
        '<th style="text-align:end">' + App.esc(t("dashboard.remaining")) + "</th>" +
        "</tr></thead><tbody>" +
        rows.map(function (r) {
          const rest = Math.max(0, Number(r.total_amount) - (paidMap[r.id] || 0));
          return "<tr>" +
            '<td><div class="cell-main">' + App.esc(r.apartments ? r.apartments.name : "—") + "</div></td>" +
            '<td><div class="cell-main">' + App.esc(r.clients ? r.clients.full_name : "—") + "</div></td>" +
            '<td class="small muted nowrap">' + App.date(r.start_date) + " → " + App.date(r.end_date) + "</td>" +
            '<td class="num" style="text-align:end;font-weight:600;color:' + (rest > 0 ? "var(--danger)" : "var(--success)") + '">' + App.esc(App.money(rest)) + "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";
    }

    function reservationsTable(rows) {
      return '<div class="table-wrap"><table><thead><tr>' +
        "<th>" + App.esc(t("common.date")) + "</th>" +
        "<th>" + App.esc(t("rentals.apartment")) + "</th>" +
        "<th>" + App.esc(t("reservations.client")) + "</th>" +
        "<th>" + App.esc(t("common.status")) + "</th>" +
        "</tr></thead><tbody>" +
        rows.map(function (r) {
          return "<tr>" +
            '<td class="nowrap small">' + App.date(r.start_date) + "</td>" +
            '<td><div class="cell-main">' + App.esc(r.apartments ? r.apartments.name : "—") + "</div></td>" +
            "<td>" + App.esc(r.clients ? r.clients.full_name : "—") + "</td>" +
            "<td>" + App.badge(r.status) + "</td>" +
          "</tr>";
        }).join("") +
        "</tbody></table></div>";
    }
  }

  window.Views = window.Views || {};
  window.Views.dashboard = { render: render };
})();
