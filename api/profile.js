// POST /api/profile  { username } or { languages: [...], interests: [...] }
import { fetchProfile } from "lib/github.js";
import { chatJSON, llmAvailable, llmSettings } from "lib/llm.js";

export const access = "public";
export const methods = ["POST"];

function fallbackSummary(p) {
  const langs = p.languages.map((l) => l.name).slice(0, 3).join(", ") || "a mix of technologies";
  return {
    summary: p.username
      ? p.name + " works mostly in " + langs + " with " + (p.publicRepos || 0) + " public repos."
      : "Interested in " + langs + ".",
    strengths: p.languages.map((l) => l.name).slice(0, 4),
    level: (p.publicRepos || 0) > 25 ? "intermediate" : "beginner",
  };
}

export default async function (req, res) {
  const body = req.body || {};
  const username = String(body.username || "").trim().replace(/^@/, "");
  let profile;

  if (username) {
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(username)) {
      return res.status(400).json({ error: "invalid_username", message: "That doesn't look like a valid GitHub username." });
    }
    try {
      profile = await fetchProfile(username);
    } catch (e) {
      if (e.code === "not_found") return res.status(404).json({ error: "not_found", message: "We couldn't find that GitHub user." });
      if (e.code === "rate_limited") return res.status(429).json({ error: "rate_limited", message: "GitHub rate limit reached. Try manual mode or add a GITHUB_TOKEN." });
      return res.status(502).json({ error: "github_error", message: "GitHub is not responding right now." });
    }
  } else {
    const langs = (Array.isArray(body.languages) ? body.languages : []).map(String).slice(0, 6);
    const interests = (Array.isArray(body.interests) ? body.interests : []).map(String).slice(0, 8);
    if (!langs.length && !interests.length) {
      return res.status(400).json({ error: "empty", message: "Enter a GitHub username or pick at least one language." });
    }
    profile = {
      username: null,
      name: "You",
      avatar: null,
      bio: "",
      publicRepos: 0,
      languages: langs.map((name, i) => ({ name, count: langs.length - i })),
      topics: interests,
      repos: [],
    };
  }

  let ai = false;
  let extra = fallbackSummary(profile);
  if (await llmAvailable()) {
    try {
      const out = await chatJSON(
        "You analyze a developer's public GitHub footprint and produce a short skill profile for matching open-source issues.",
        "Developer data:\n" + JSON.stringify({ name: profile.name, bio: profile.bio, publicRepos: profile.publicRepos, languages: profile.languages, topics: profile.topics, repos: profile.repos }) +
          '\nReturn JSON: {"summary": string (max 2 sentences), "strengths": string[] (max 5 short skills), "level": "beginner"|"intermediate"|"advanced"}'
      );
      if (out && out.summary) {
        extra = { summary: String(out.summary), strengths: (out.strengths || []).map(String).slice(0, 5), level: out.level || "intermediate" };
        ai = true;
      }
    } catch (e) {}
  }
  const s = await llmSettings();
  res.json({ profile: { ...profile, ...extra }, ai, model: ai ? s.model : null });
}