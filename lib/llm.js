// lib/llm.js - single place that talks to the open-weight model (Gemma 4).
// Works with any OpenAI-compatible /chat/completions endpoint.
import { config } from "hatchable";

async function cfg(key, fallback = "") {
  try {
    const v = await config.get(key);
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

export async function llmSettings() {
  return {
    key: await cfg("LLM_API_KEY"),
    base: (await cfg("LLM_API_BASE_URL", "https://openrouter.ai/api/v1")).replace(/\/+$/, ""),
    model: await cfg("LLM_MODEL", "google/gemma-4-31b-it"),
  };
}

export async function llmAvailable() {
  const s = await llmSettings();
  return !!s.key;
}

function extractJSON(text) {
  if (!text) throw new Error("Empty model response");
  let t = text.replace(/```json|```/g, "").trim();
  const start = t.search(/[\[{]/);
  const endObj = t.lastIndexOf("}");
  const endArr = t.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (start === -1 || end === -1) throw new Error("No JSON found in model response");
  return JSON.parse(t.slice(start, end + 1));
}

// Ask the model for strict JSON. Throws on any failure so callers can fall back.
export async function chatJSON(system, user, opts = {}) {
  const s = await llmSettings();
  if (!s.key) throw new Error("LLM not configured");
  const res = await fetch(s.base + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + s.key,
      "HTTP-Referer": "https://contribmatch.hatchable.site",
      "X-Title": "ContribMatch",
    },
    body: JSON.stringify({
      model: s.model,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2500,
      messages: [
        { role: "system", content: system + "\nRespond with valid JSON only. No markdown, no commentary." },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error("LLM HTTP " + res.status + ": " + body.slice(0, 200));
  }
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return extractJSON(text);
}