// POST /api/plan  { profile, issue } -> starter plan
import { chatJSON, llmAvailable } from "lib/llm.js";

export const access = "public";
export const methods = ["POST"];

function fallbackPlan(issue) {
  return {
    steps: [
      "Fork " + issue.repo + " and clone it locally.",
      "Read CONTRIBUTING.md and the README to learn setup and style rules.",
      "Reproduce or understand the problem described in the issue.",
      "Comment on the issue to say you're working on it.",
      "Create a branch, make a small focused change, and run the tests.",
      "Open a pull request that references the issue (Fixes #" + issue.number + ").",
    ],
    filesToLookAt: ["README.md", "CONTRIBUTING.md"],
    tips: ["Keep the PR small and focused.", "Ask maintainers if anything is unclear."],
  };
}

export default async function (req, res) {
  const { profile, issue } = req.body || {};
  if (!issue || !issue.title || !issue.repo) {
    return res.status(400).json({ error: "bad_request", message: "Missing issue." });
  }
  let plan = null;
  let ai = false;
  if (await llmAvailable()) {
    try {
      const out = await chatJSON(
        "You are a friendly open-source mentor helping a developer make their first contribution to a specific GitHub issue. Be concrete and brief.",
        "Developer: " + JSON.stringify({ level: profile && profile.level, strengths: profile && profile.strengths, languages: profile && profile.languages }) +
          "\nIssue: " + JSON.stringify({ repo: issue.repo, number: issue.number, title: issue.title, labels: issue.labels, snippet: issue.snippet }) +
          '\nReturn JSON: {"steps": string[] (5-7 ordered actionable steps), "filesToLookAt": string[] (likely files or folders to inspect, max 5), "tips": string[] (2-3 short tips)}'
      );
      if (Array.isArray(out.steps) && out.steps.length) {
        plan = {
          steps: out.steps.map(String).slice(0, 8),
          filesToLookAt: (out.filesToLookAt || []).map(String).slice(0, 5),
          tips: (out.tips || []).map(String).slice(0, 3),
        };
        ai = true;
      }
    } catch (e) {}
  }
  if (!plan) plan = fallbackPlan(issue);
  res.json({ plan, ai });
}