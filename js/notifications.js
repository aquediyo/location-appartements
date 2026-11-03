/* ============================================================================
   Notifications (activité du concierge -> administrateur)
   ============================================================================ */

(function () {
  "use strict";

  const t = App.t;
  const money = function (n) { return App.money(n); };

  function relativeTime(ts) {
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = Math.floor((now - d) / 1000);
      if (diff < 60) return diff + "s";
      if (diff < 3600) return Math.floor(diff / 60) + "m";
      if (diff < 86400) return Math.floor(diff / 3600) + "h";
      if (diff < 604800) return Math.floor(diff / 86400) + "j";
      return App.date(d.toISOString().slice(0, 10));
    } catch (e) {
      return "";
    }
  }

  function buildText(n) {
    const d = n.data || {};
    let base = App.t("notif." + camel(n.kind));
    base = base.replace("{actor}", d.actor || "—");

    let extra = "";
    if (n.entity === "rental") {
      const name = d.apartment || d.client;
      if (name) extra += " · " + App.t("notif.for", { name: name });
      if (d.total != null) extra += " · " + App.t("notif.amount", { amount: money(d.total) });
      if (d.ended_at) extra += " · " + App.t("notif.date", { date: App.date(d.ended_at) });
      else if (d.start_date) extra += " · " + App.t("notif.date", { date: App.date(d.start_date) });
    } else if (n.entity === "expense") {
      if (d.label) extra += " · " + App.t("notif.for", { name: d.label });
      if (d.amount != null) extra += " · " + App.t("notif.amount", { amount: money(d.amount) });
      if (d.spent_on) extra += " · " + App.t("notif.date", { date: App.date(d.spent_on) });
    }
    return base + extra;
  }

  function camel(s) {
    return String(s || "").replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  async function render() {
    const btn = document.getElementById("notif-btn");
    const badge = document.getElementById("notif-badge");
    const panel = document.getElementById("notif-panel");
    const wrap = document.getElementById("notif-wrap");
    if (!btn || !panel) return;

    if (!App.isAdmin()) {
      btn.classList.add("hidden");
      badge.classList.add("hidden");
      return;
    }

    btn.classList.remove("hidden");
    btn.innerHTML = App.notifBellIcon(18);
    btn.onclick = function (e) {
      e.stopPropagation();
      panel.classList.toggle("hidden");
      btn.setAttribute("aria-expanded", panel.classList.contains("hidden") ? "false" : "true");
      if (!panel.classList.contains("hidden")) load();
    };

    document.addEventListener("click", function (e) {
      if (wrap && !wrap.contains(e.target)) {
        panel.classList.add("hidden");
        btn.setAttribute("aria-expanded", "false");
      }
    });

    async function load() {
      try {
        const list = await App.q(
          App.sb.from("notifications")
            .select("*")
            .eq("recipient_id", App.state.profile.id)
            .order("created_at", { ascending: false })
            .limit(40)
        );
        paint(list);
      } catch (err) {
        panel.innerHTML = '<div class="notif-head"><strong>' + App.esc(t("notif.title")) + '</strong></div><div class="notif-empty">' + App.esc(App.errorMessage(err)) + '</div>';
      }
    }

    function paint(list) {
      const unread = list.filter(function (n) { return !n.is_read; }).length;
      badge.textContent = unread > 9 ? "9+" : String(unread);
      badge.classList.toggle("hidden", unread === 0);

      if (!list.length) {
        panel.innerHTML = '<div class="notif-head"><strong>' + App.esc(t("notif.title")) + '</strong></div><div class="notif-empty">' + App.esc(t("notif.empty")) + '</div>';
        return;
      }

      let html = '<div class="notif-head"><strong>' + App.esc(t("notif.title")) + '</strong>' +
        '<button class="btn btn-ghost btn-sm" id="notif-mark">' + App.esc(t("notif.markAll")) + '</button></div>' +
        '<div class="notif-list">';
      list.forEach(function (n) {
        html += '<button class="notif-item' + (n.is_read ? '' : ' unread') + '" data-id="' + n.id + '" data-link="' + App.esc(n.link || '#/') + '">' +
          '<div class="notif-dot"></div>' +
          '<div class="notif-body">' +
            '<div class="notif-text">' + App.esc(buildText(n)) + '</div>' +
            '<div class="notif-time">' + App.esc(relativeTime(n.created_at)) + '</div>' +
          '</div>' +
        '</button>';
      });
      html += '</div>';
      panel.innerHTML = html;

      panel.querySelector("#notif-mark").onclick = async function (e) {
        e.stopPropagation();
        try {
          await App.q(App.sb.from("notifications").update({ is_read: true }).eq("recipient_id", App.state.profile.id).eq("is_read", false));
          load();
        } catch (err) { App.toast(App.errorMessage(err), "error"); }
      };

      panel.querySelectorAll(".notif-item").forEach(function (el) {
        el.onclick = async function () {
          const id = el.getAttribute("data-id");
          const link = el.getAttribute("data-link") || "#/";
          try {
            if (!el.classList.contains("read")) {
              await App.sb.from("notifications").update({ is_read: true }).eq("id", id).eq("recipient_id", App.state.profile.id);
            }
          } catch (e) { /* non bloquant */ }
          panel.classList.add("hidden");
          btn.setAttribute("aria-expanded", "false");
          if (link && link !== "#/") {
            location.hash = link;
            setTimeout(function () { App.renderRoute(); }, 50);
          }
        };
      });
    }

    load();

    if (App.sb && App.sb.channel) {
      try {
        const ch = App.sb.channel("notif-" + App.state.profile.id)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "recipient_id=eq." + App.state.profile.id }, function () { load(); })
          .subscribe();
        window.__notifCh = ch;
      } catch (e) { /* temps reel non disponible */ }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();