// GET /api/shortlist?session=ID | POST { session, issue } | DELETE ?session=ID&url=ISSUE_URL
import { db } from "hatchable";

export const access = "public";
export const methods = ["GET", "POST", "DELETE"];

function validSession(s) {
  return typeof s === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(s);
}

export default async function (req, res) {
  if (req.method === "GET") {
    const session = (req.query && req.query.session) || "";
    if (!validSession(session)) return res.json({ items: [] });
    const { rows } = await db.query(
      "SELECT issue_url AS url, issue_title AS title, repo, score, difficulty, created_at FROM shortlist WHERE session_id = $1 ORDER BY created_at DESC LIMIT 100",
      [session]
    );
    return res.json({ items: rows });
  }

  if (req.method === "POST") {
    const { session, issue } = req.body || {};
    if (!validSession(session) || !issue || !issue.url || !issue.title) {
      return res.status(400).json({ error: "bad_request" });
    }
    if (!/^https:\/\/github\.com\//.test(String(issue.url)) ) {
      return res.status(400).json({ error: "bad_url" });
    }
    await db.query(
      "INSERT INTO shortlist (session_id, issue_url, issue_title, repo, score, difficulty) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (session_id, issue_url) DO NOTHING",
      [session, String(issue.url).slice(0, 500), String(issue.title).slice(0, 300), String(issue.repo || "").slice(0, 200), Number.isFinite(issue.score) ? Math.round(issue.score) : null, issue.difficulty ? String(issue.difficulty).slice(0, 20) : null]
    );
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const session = (req.query && req.query.session) || "";
    const url = (req.query && req.query.url) || "";
    if (!validSession(session) || !url) return res.status(400).json({ error: "bad_request" });
    await db.query("DELETE FROM shortlist WHERE session_id = $1 AND issue_url = $2", [session, url]);
    return res.json({ ok: true });
  }

  res.status(405).json({ error: "method_not_allowed" });
}