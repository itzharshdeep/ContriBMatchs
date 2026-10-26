# 🧭 ContribMatch

**Your first open-source PR, planned by an AI agent powered by Gemma 4.**

ContribMatch helps beginners start contributing to open source. Enter a GitHub
username and the agent reads your skills, finds suitable `good first issue` and
`hacktoberfest` issues, reads the repo's contribution guide, and gives you a
ranked list of issues with a step-by-step plan and a draft PR description.

Built for **Hacktoberfest 2026** · Category: **Best Open-Source AI Project**

---

## The problem

Every October, thousands of beginners try open source and many give up within
an hour. They can't find an issue that matches their skills, don't understand
the codebase, and don't know what a good first PR looks like.

## What ContribMatch does

1. **Reads your skills** from your public GitHub repositories (languages and topics).
2. **Searches open issues** labeled `good first issue` / `hacktoberfest`.
3. **Reads the issue and the repo's CONTRIBUTING guide** for context.
4. **Ranks issues** by fit: match score, difficulty, activity and competition.
5. **Generates a starter plan**: why it fits you, files to inspect, step-by-step
   approach, skills you'll learn, and a draft PR description.

## How the agent works

Gemma 4 acts as the agent brain. Using native function calling, it decides
which tool to call next:

| Tool | Purpose |
|---|---|
| `get_user_skills(username)` | Top languages and topics from the user's public repos |
| `search_issues(language, labels, limit)` | Open good-first-issue / hacktoberfest issues |
| `read_issue(repo, number)` | Issue body and recent comments |
| `read_repo_file(repo, path)` | README or CONTRIBUTING (truncated for context) |
| `submit_plan(plans[])` | Final structured output |

The loop is capped (default 6 iterations), validates every JSON tool call,
retries once on malformed output, and only names files that tools actually
returned, so the plan is grounded rather than guessed.

## Why open-weight AI

- **Gemma 4 is essential.** Remove the model and the agent can't choose tools, rank issues or write plans.
- **Runs locally** through Ollama, with no paid API key required.
- **Swappable model sizes** (E4B for speed, 26B/31B for quality) through one setting.
- **OpenAI-compatible endpoint**, so Ollama, Google AI Studio, OpenRouter or Together work too.

> Note: Gemma is released under Google's Gemma license, which is open-weight
> rather than OSI open-source.

## Features

- Ranked issue cards with match percentage, difficulty and skills-you'll-learn chips
- Live agent trace showing each tool call as it happens
- Copy-ready draft PR description and Markdown export
- Settings page for GitHub token, model endpoint, model name and agent behavior
- Demo Mode with sample data, so the app works with zero API keys
- Error handling for rate limits, unreachable models, CORS and malformed output

## Quick start

```bash
git clone https://github.com/<your-username>/contribmatch.git
cd contribmatch
npm install

# Local model
ollama pull gemma4:e4b
OLLAMA_ORIGINS="*" ollama serve

npm run dev
```

Open the app, go to **Settings**, and enter:

| Setting | Value |
|---|---|
| Base URL | `http://localhost:11434/v1` |
| API key | `ollama` |
| Model | `gemma4:e4b` |
| GitHub token (optional) | raises the API limit from 60 to 5,000 requests/hour |

No setup yet? Toggle **Demo Mode**.

## Tech stack

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Gemma 4 via Ollama · GitHub REST API

## Privacy

Keys are stored only in your browser's localStorage. With a local model, your
GitHub data and prompts never leave your machine.

## Roadmap

- Browser extension that suggests issues while you browse GitHub
- Maintainer dashboard for triage and newcomer-friendly labeling
- Mentor matching for first-time contributors
- Agent-skill export (SKILL.md) so other open-source agents can reuse the tools

## Contributing

Issues and PRs are welcome. Look for the `good first issue` label.

## License

MIT for this project's code. Gemma model weights are governed by the Gemma license.

Built with ❤️ for Hacktoberfest 2026.
##########################################################################################################################################################
# ContribMatch

[![Deploy to Hatchable](https://hatchable.com/deploy-button.svg)](https://hatchable.com/deploy?repo=https://github.com/itzharshdeep/ContriBMatchs)

AI-powered GitHub issue matcher for Hacktoberfest, powered by open-weight Gemma 4

This folder is a complete Hatchable project. Everything the app needs is in these files: pages, API routes, database migrations, seed data, and the hatchable.toml manifest that declares the services and keys it uses.

## Run your own copy

1. Go to https://hatchable.com/deploy
2. Bring this folder as a .zip, or point the importer at a Git repository that contains it
3. Your copy gets its own database, its own URL, and connects to your own keys

## About Hatchable

Hatchable is where AI-built apps go live. Connect the AI you already use and it can build, deploy, and run apps like this one for you.

Built on Hatchable. https://hatchable.com
############################################################################################################################################################
