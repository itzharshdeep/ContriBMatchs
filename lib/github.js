// lib/github.js - GitHub REST helpers with a Postgres-backed cache.
import { db, config } from "hatchable";

const API = "https://api.github.com";

async function headers() {
  const h = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ContribMatch-Hacktoberfest",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  try {
    const t = await config.get("GITHUB_TOKEN");
    if (t) h.Authorization = "Bearer " + t;
  } catch (e) {}
  return h;
}

export async function gh(path) {
  const res = await fetch(API + path, { headers: await headers() });
  if (res.status === 404) {
    const err = new Error("not_found");
    err.code = "not_found";
    throw err;
  }
  if (res.status === 403 || res.status === 429) {
    const err = new Error("rate_limited");
    err.code = "rate_limited";
    throw err;
  }
  if (!res.ok) throw new Error("GitHub HTTP " + res.status);
  return res.json();
}

async function cached(key, loader, ttlMinutes = 30) {
  try {
    const { rows } = await db.query(
      "SELECT payload FROM issue_cache WHERE query_key = $1 AND fetched_at > now() - ($2 || ' minutes')::interval",
      [key, String(ttlMinutes)]
    );
    if (rows.length) return rows[0].payload;
  } catch (e) {}
  const fresh = await loader();
  try {
    await db.query(
      "INSERT INTO issue_cache (query_key, payload, fetched_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (query_key) DO UPDATE SET payload = EXCLUDED.payload, fetched_at = now()",
      [key, JSON.stringify(fresh)]
    );
  } catch (e) {}
  return fresh;
}

export async function fetchProfile(username) {
  return cached("profile:" + username.toLowerCase(), async () => {
    const user = await gh("/users/" + encodeURIComponent(username));
    const repos = await gh("/users/" + encodeURIComponent(username) + "/repos?per_page=100&sort=pushed");
    const langCount = {};
    const topics = {};
    for (const r of repos) {
      if (r.fork) continue;
      if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1 + Math.min(r.stargazers_count || 0, 5) * 0.2;
      for (const t of r.topics || []) topics[t] = (topics[t] || 0) + 1;
    }
    const languages = Object.entries(langCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count: Math.round(count * 10) / 10 }));
    return {
      username: user.login,
      name: user.name || user.login,
      avatar: user.avatar_url,
      bio: user.bio || "",
      publicRepos: user.public_repos,
      followers: user.followers,
      languages,
      topics: Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 8).map((e) => e[0]),
      repos: repos.filter((r) => !r.fork).slice(0, 8).map((r) => ({ name: r.name, description: r.description || "", language: r.language })),
    };
  }, 60);
}

function mapIssue(it) {
  const repo = (it.repository_url || "").replace("https://api.github.com/repos/", "");
  return {
    id: it.id,
    repo,
    number: it.number,
    title: it.title,
    url: it.html_url,
    labels: (it.labels || []).map((l) => l.name).slice(0, 6),
    comments: it.comments || 0,
    updatedAt: it.updated_at,
    createdAt: it.created_at,
    snippet: (it.body || "").replace(/\s+/g, " ").slice(0, 280),
  };
}

export async function searchIssues(languages) {
  const langs = (languages && languages.length ? languages : [""]).slice(0, 3);
  const all = [];
  const seen = new Set();
  for (const lang of langs) {
    const langQ = lang ? ' language:"' + lang + '"' : "";
    const queries = [
      'is:issue is:open no:assignee label:hacktoberfest' + langQ,
      'is:issue is:open no:assignee label:"good first issue"' + langQ,
    ];
    for (const q of queries) {
      try {
        const data = await cached("search:" + q, async () => {
          const r = await gh("/search/issues?q=" + encodeURIComponent(q) + "&sort=updated&order=desc&per_page=12");
          return (r.items || []).map(mapIssue);
        });
        for (const it of data) {
          if (!seen.has(it.id)) {
            seen.add(it.id);
            it.language = lang || null;
            all.push(it);
          }
        }
      } catch (e) {
        if (e.code === "rate_limited" && all.length === 0) throw e;
      }
    }
  }
  return all.slice(0, 30);
}