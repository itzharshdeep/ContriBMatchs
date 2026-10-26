// POST /api/match  { profile }  -> ranked issues
import { searchIssues } from "lib/github.js";
import { chatJSON, llmAvailable, llmSettings } from "lib/llm.js";

export const access = "public";
export const methods = ["POST"];

const DEMO = [
  { id: 1, repo: "demo/awesome-docs", number: 12, title: "Fix typos in the getting-started guide", url: "https://github.com/topics/hacktoberfest", labels: ["good first issue", "documentation"], comments: 1, updatedAt: new Date().toISOString(), snippet: "Demo issue shown because GitHub is unavailable.", language: "Markdown" },
  { id: 2, repo: "demo/cli-tool", number: 48, title: "Add --version flag to the CLI", url: "https://github.com/topics/hacktoberfest", labels: ["good first issue", "hacktoberfest"], comments: 0, updatedAt: new Date().toISOString(), snippet: "Demo issue shown because GitHub is unavailable.", language: "JavaScript" },
  { id: 3, repo: "demo/web-app", number: 7, title: "Improve mobile layout of the settings page", url: "https://github.com/topics/hacktoberfest", labels: ["help wanted", "hacktoberfest"], comments: 3, updatedAt: new Date().toISOString(), snippet: "Demo issue shown because GitHub is unavailable.", language: "CSS" },
];

function heuristic(issues, profile) {
  const mine = (profile.languages || []).map((l) => l.name.toLowerCase());
  const topics = (profile.topics || []).map((t) => t.toLowerCase());
  return issues
    .map((it) => {
      let score = 40;
      if (it.language && mine.includes(it.language.toLowerCase())) score += 25;
      const text = (it.title + " " + it.repo + " " + it.snippet).toLowerCase();
      for (const t of topics) if (text.includes(t)) score += 6;
      if (it.labels.some((l) => /good first issue/i.test(l))) score += 10;
      if (it.labels.some((l) => /hacktoberfest/i.test(l))) score += 5;
      if (it.comments === 0) score += 5;
      score = Math.max(5, Math.min(97, score));
      return {
        ...it,
        score,
        difficulty: it.labels.some((l) => /good first issue|beginner|easy/i.test(l)) ? "easy" : "medium",
        reason: it.language ? "Matches your " + it.language + " experience and is labeled for newcomers." : "Labeled as beginner-friendly and still unassigned.",
      };
    })
    .sort((a, b) => b.score - a.score);
}

export default async function (req, res) {
  const profile = (req.body && req.body.profile) || null;
  if (!profile || !Array.isArray(profile.languages)) {
    return res.status(400).json({ error: "bad_request", message: "Missing profile." });
  }

  let issues = [];
  let demo = false;
  try {
    issues = await searchIssues(profile.languages.map((l) => l.name));
  } catch (e) {
    issues = [];
  }
  if (!issues.length) {
    issues = DEMO;
    demo = true;
  }

  let ranked = null;
  let ai = false;
  if (!demo && (await llmAvailable())) {
    try {
      const compact = issues.slice(0, 24).map((it) => ({ id: it.id, repo: it.repo, title: it.title, labels: it.labels, comments: it.comments, language: it.language, snippet: it.snippet }));
      const out = await chatJSON(
        "You are an expert open-source mentor. Score how well each GitHub issue fits this developer. Favor issues that are clearly scoped, welcoming, and match their languages and topics. Be honest: low scores for poor fits.",
        "Developer profile:\n" + JSON.stringify({ summary: profile.summary, level: profile.level, strengths: profile.strengths, languages: profile.languages, topics: profile.topics }) +
          "\n\nIssues:\n" + JSON.stringify(compact) +
          '\n\nReturn JSON: {"results": [{"id": number, "score": 0-100, "difficulty": "easy"|"medium"|"hard", "reason": "one sentence on why this fits the developer"}]} covering every issue id.',
        { maxTokens: 3500 }
      );
      const byId = new Map((out.results || []).map((r) => [Number(r.id), r]));
      ranked = issues
        .filter((it) => byId.has(it.id))
        .map((it) => {
          const r = byId.get(it.id);
          return {
            ...it,
            score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
            difficulty: ["easy", "medium", "hard"].includes(r.difficulty) ? r.difficulty : "medium",
            reason: String(r.reason || ""),
          };
        })
        .sort((a, b) => b.score - a.score);
      ai = ranked.length > 0;
    } catch (e) {
      ranked = null;
    }
  }
  if (!ranked) ranked = heuristic(issues, profile);

  const s = await llmSettings();
  res.json({ issues: ranked, ai, demo, model: ai ? s.model : null });
}