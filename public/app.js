(function () {
  const API = (window.__HATCHABLE__ && window.__HATCHABLE__.api) || "/api";
  const $ = (id) => document.getElementById(id);
  const LANGS = ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin"];
  const TOPICS = ["web", "cli", "machine-learning", "devops", "mobile", "docs", "games", "data", "security"];

  let mode = "user";
  let profile = null;
  let allIssues = [];
  let shortUrls = new Set();
  const picked = { langs: new Set(), topics: new Set() };

  // anonymous session id, kept in memory + localStorage when available
  let session = "";
  try { session = localStorage.getItem("cm_session") || ""; } catch (e) {}
  if (!session) {
    session = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    try { localStorage.setItem("cm_session", session); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
  async function api(path, opts) {
    const res = await fetch(API + path, opts);
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw Object.assign(new Error(data.message || "Request failed"), { data });
    return data;
  }
  function post(path, body) {
    return api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  // ----- chips / tabs -----
  function renderChips(el, list, set) {
    el.innerHTML = list.map((x) => '<button type="button" class="chip" data-v="' + esc(x) + '">' + esc(x) + "</button>").join("");
    el.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      const v = b.dataset.v;
      if (set.has(v)) { set.delete(v); b.classList.remove("on"); } else { set.add(v); b.classList.add("on"); }
    });
  }
  renderChips($("langChips"), LANGS, picked.langs);
  renderChips($("topicChips"), TOPICS, picked.topics);

  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      mode = t.dataset.mode;
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      $("userMode").classList.toggle("hidden", mode !== "user");
      $("manualMode").classList.toggle("hidden", mode !== "manual");
      $("formError").classList.add("hidden");
    })
  );

  // ----- main flow -----
  $("searchForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("formError");
    err.classList.add("hidden");
    let body;
    if (mode === "user") {
      const u = $("username").value.trim().replace(/^@/, "");
      if (!u) { err.textContent = "Enter a GitHub username."; err.classList.remove("hidden"); return; }
      body = { username: u };
    } else {
      if (!picked.langs.size && !picked.topics.size) { err.textContent = "Pick at least one language or interest."; err.classList.remove("hidden"); return; }
      body = { languages: [...picked.langs], interests: [...picked.topics] };
    }
    document.querySelectorAll("button[type=submit]").forEach((b) => (b.disabled = true));
    $("results").classList.remove("hidden");
    $("profileCard").innerHTML = "";
    $("issueList").innerHTML = "";
    $("filters").classList.add("hidden");
    $("loading").classList.remove("hidden");
    $("statusText").textContent = mode === "user" ? "Reading your GitHub profile\u2026" : "Building your skill profile\u2026";
    $("results").scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const p = await post("/profile", body);
      profile = p.profile;
      renderProfile(p);
      $("statusText").textContent = "Searching open issues and asking Gemma 4 to rank them\u2026";
      const m = await post("/match", { profile });
      allIssues = m.issues || [];
      renderMeta(m);
      buildLangFilter();
      $("loading").classList.add("hidden");
      $("filters").classList.remove("hidden");
      applyFilters();
    } catch (ex) {
      $("loading").classList.add("hidden");
      $("results").classList.add("hidden");
      err.textContent = ex.message || "Something went wrong. Please try again.";
      err.classList.remove("hidden");
    } finally {
      document.querySelectorAll("button[type=submit]").forEach((b) => (b.disabled = false));
    }
  });

  function renderProfile(p) {
    const pr = p.profile;
    const avatar = pr.avatar ? '<img src="' + esc(pr.avatar) + '" alt="">' : '<div class="avatar-fallback">\ud83e\uddd1\u200d\ud83d\udcbb</div>';
    const langs = (pr.languages || []).map((l) => '<span class="tag lang">' + esc(l.name) + "</span>").join("");
    const strengths = (pr.strengths || []).map((s) => '<span class="tag">' + esc(s) + "</span>").join("");
    const ai = p.ai ? '<span class="ai-badge">Gemma 4 profile</span>' : '<span class="ai-badge off">basic profile</span>';
    $("profileCard").innerHTML =
      avatar + '<div class="info"><h3>' + esc(pr.name) + (pr.username ? ' <span class="repo">@' + esc(pr.username) + "</span>" : "") + " " + ai + "</h3><p>" + esc(pr.summary) +
      '</p><div class="tags">' + langs + strengths + (pr.level ? '<span class="tag">' + esc(pr.level) + "</span>" : "") + "</div></div>";
  }

  function renderMeta(m) {
    const note = m.demo ? "GitHub was unavailable, showing demo issues." : m.ai ? "Ranked by " + esc(m.model || "Gemma 4") : "AI ranking is off, using a simple language and label match.";
    $("resultMeta").innerHTML = note;
  }

  function buildLangFilter() {
    const set = new Set();
    allIssues.forEach((i) => i.language && set.add(i.language));
    $("fLang").innerHTML = '<option value="">All</option>' + [...set].map((l) => "<option>" + esc(l) + "</option>").join("");
  }

  function applyFilters() {
    const lang = $("fLang").value, diff = $("fDiff").value, min = Number($("fScore").value);
    $("fScoreVal").textContent = min;
    const list = allIssues.filter((i) => (!lang || i.language === lang) && (!diff || i.difficulty === diff) && i.score >= min);
    renderIssues(list);
  }
  ["fLang", "fDiff", "fScore"].forEach((id) => $(id).addEventListener("input", applyFilters));

  function renderIssues(list) {
    if (!list.length) { $("issueList").innerHTML = '<div class="empty">No issues match those filters. Try loosening them.</div>'; return; }
    $("issueList").innerHTML = list.map((i, idx) => {
      const saved = shortUrls.has(i.url);
      const labels = (i.labels || []).slice(0, 4).map((l) => '<span class="tag">' + esc(l) + "</span>").join("");
      return '<article class="issue" style="animation-delay:' + Math.min(idx, 10) * 40 + 'ms">' +
        '<div class="issue-top"><div><span class="repo">' + esc(i.repo) + " #" + esc(i.number) + '</span><h4><a href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.title) + "</a></h4>" +
        '<div class="tags"><span class="chip-d d-' + esc(i.difficulty) + '">' + esc(i.difficulty) + "</span>" + labels + "</div></div>" +
        '<div class="score"><b>' + esc(i.score) + '</b><span class="repo">/100</span><div class="bar"><i style="width:' + esc(i.score) + '%"></i></div></div></div>' +
        '<p class="reason">' + esc(i.reason) + "</p>" +
        '<div class="actions"><button class="btn primary" data-plan="' + esc(i.url) + '">Get starter plan</button>' +
        '<button class="btn ghost" data-save="' + esc(i.url) + '">' + (saved ? "Saved \u2713" : "Save") + '</button>' +
        '<a class="btn ghost" href="' + esc(i.url) + '" target="_blank" rel="noopener" style="text-decoration:none">Open on GitHub</a></div></article>';
    }).join("");
  }

  $("issueList").addEventListener("click", (e) => {
    const planBtn = e.target.closest("[data-plan]");
    const saveBtn = e.target.closest("[data-save]");
    if (planBtn) openPlan(allIssues.find((i) => i.url === planBtn.dataset.plan));
    if (saveBtn) toggleSave(allIssues.find((i) => i.url === saveBtn.dataset.save), saveBtn);
  });

  // ----- starter plan drawer -----
  function openDrawer(el) { el.classList.remove("hidden"); el.setAttribute("aria-hidden", "false"); }
  function closeDrawer(el) { el.classList.add("hidden"); el.setAttribute("aria-hidden", "true"); }
  $("closeDrawer").addEventListener("click", () => closeDrawer($("drawer")));
  $("closeShort").addEventListener("click", () => closeDrawer($("shortModal")));
  ["drawer", "shortModal"].forEach((id) => $(id).addEventListener("click", (e) => { if (e.target === $(id)) closeDrawer($(id)); }));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer($("drawer")); closeDrawer($("shortModal")); } });

  async function openPlan(issue) {
    if (!issue) return;
    openDrawer($("drawer"));
    $("drawerBody").innerHTML = '<span class="repo">' + esc(issue.repo) + " #" + esc(issue.number) + "</span><h3>" + esc(issue.title) + '</h3><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      const r = await post("/plan", { profile, issue });
      const p = r.plan;
      const steps = p.steps.map((s) => "<li>" + esc(s) + "</li>").join("");
      const files = (p.filesToLookAt || []).map((f) => '<span class="code">' + esc(f) + "</span>").join(" ");
      const tips = (p.tips || []).map((t) => "<li>" + esc(t) + "</li>").join("");
      $("drawerBody").innerHTML =
        '<span class="repo">' + esc(issue.repo) + " #" + esc(issue.number) + "</span><h3>" + esc(issue.title) + "</h3>" +
        '<span class="ai-badge' + (r.ai ? "" : " off") + '">' + (r.ai ? "Plan by Gemma 4" : "Generic plan") + "</span>" +
        "<h3 style='margin-top:18px'>Your starter plan</h3><ol>" + steps + "</ol>" +
        (files ? "<h3>Where to look</h3><p>" + files + "</p>" : "") +
        (tips ? "<h3>Tips</h3><ul>" + tips + "</ul>" : "") +
        '<div class="actions"><button class="btn primary" id="copyPlan">Copy plan</button><a class="btn ghost" style="text-decoration:none" target="_blank" rel="noopener" href="' + esc(issue.url) + '">Open issue</a></div>';
      $("copyPlan").addEventListener("click", async () => {
        const text = "Plan for " + issue.repo + " #" + issue.number + " - " + issue.title + "\n\n" + p.steps.map((s, i) => i + 1 + ". " + s).join("\n");
        try { await navigator.clipboard.writeText(text); toast("Plan copied"); } catch (e) { toast("Copy failed, select the text manually"); }
      });
    } catch (ex) {
      $("drawerBody").innerHTML = "<p class='error'>" + esc(ex.message) + "</p>";
    }
  }

  // ----- shortlist -----
  async function loadShortlist() {
    try {
      const r = await api("/shortlist?session=" + encodeURIComponent(session));
      shortUrls = new Set((r.items || []).map((i) => i.url));
      $("shortCount").textContent = shortUrls.size;
      return r.items || [];
    } catch (e) { return []; }
  }
  async function toggleSave(issue, btn) {
    if (!issue) return;
    try {
      if (shortUrls.has(issue.url)) {
        await api("/shortlist?session=" + encodeURIComponent(session) + "&url=" + encodeURIComponent(issue.url), { method: "DELETE" });
        shortUrls.delete(issue.url);
        btn.textContent = "Save";
      } else {
        await post("/shortlist", { session, issue: { url: issue.url, title: issue.title, repo: issue.repo, score: issue.score, difficulty: issue.difficulty } });
        shortUrls.add(issue.url);
        btn.textContent = "Saved \u2713";
        toast("Saved to your shortlist");
      }
      $("shortCount").textContent = shortUrls.size;
    } catch (e) { toast("Could not update shortlist"); }
  }
  $("openShortlist").addEventListener("click", async () => {
    openDrawer($("shortModal"));
    $("shortBody").innerHTML = '<div class="skeleton"></div>';
    const items = await loadShortlist();
    $("shortBody").innerHTML = items.length
      ? items.map((i) => '<div class="short-item"><span class="repo">' + esc(i.repo) + '</span><a href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.title) + '</a>' +
          (i.score != null ? ' <span class="tag">' + esc(i.score) + "/100</span>" : "") + "</div>").join("")
      : '<div class="empty">Nothing saved yet. Hit Save on an issue you like.</div>';
  });

  loadShortlist();
})();