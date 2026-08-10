# 🤖 AI-Powered Test Automation Pipeline

> **Proof of Concept** — An intelligent pipeline that bridges the gap between manual QA workflows and test automation. Built for teams that organize test cases in Google Sheets and want to eliminate the bottleneck of manually translating those scenarios into Playwright code.

---

## 🎯 The Problem

Many QA teams manage their test cases in spreadsheets — a familiar, accessible format. But translating those manual scenarios into automated tests is slow, repetitive, and requires developer-level skills. This project explores what happens when you put an AI agent in the middle of that process.

A QA engineer fills in the scenario, marks it as ready, and walks away. The pipeline takes over from there.

---

## 📌 What This Does

1. Monitors a Google Sheets spreadsheet for new test scenarios
2. Validates that the scenario is flagged as ready for automation
3. Builds a structured test plan from the spreadsheet columns
4. Sends the plan to a Claude AI Agent
5. The agent navigates a **real browser**, interacts with the UI, and observes the actual DOM
6. A `.spec.ts` file is written directly to the project — ready to run with Playwright

No LLM hallucinating selectors. No static code generation. The agent sees the real page.

---

## 🏗️ Architecture

```
Google Sheets (trigger)
        │
        ▼
  [Roteiro pronto?] ── No ──► (ignored)
        │ Yes
        ▼
[Build Playwright Generator Prompt]
        │  Structured markdown test plan
        ▼
   [Claude AI Agent]  ◄──── Claude Sonnet (Anthropic)
        │
        ├──► generator_setup_page   → sets up browser session
        ├──► browser_navigate       → navigates to target URL
        ├──► browser_snapshot       → reads DOM when selector is needed
        ├──► browser_click          → clicks elements
        ├──► browser_type           → fills fields
        ├──► browser_hover          → hovers elements
        ├──► browser_press_key      → keyboard interactions
        ├──► browser_wait_for       → waits for text/element
        ├──► browser_verify_*       → assertions
        ├──► generator_read_log     → reads execution log
        └──► generator_write_test   → writes .spec.ts to disk
```

All browser tools are exposed via a local **MCP Bridge Server** (`mcp-bridge.js`) running on port `3456`. The n8n agent communicates with it over HTTP, and the bridge controls a real Playwright browser instance on the host machine.

---

## 🧰 Stack

| Layer | Technology |
|---|---|
| Orchestration | [n8n](https://n8n.io/) (self-hosted via Docker) |
| AI Model | Claude Sonnet (Anthropic API) |
| Browser Automation | Playwright (via MCP Bridge) |
| Test Input | Google Sheets (OAuth2 trigger) |
| Protocol | Model Context Protocol (MCP) |
| Output | TypeScript `.spec.ts` files |

---

## 📋 Google Sheets Schema

The pipeline reads the following columns from the spreadsheet:

| Column | Description |
|---|---|
| `ID do roteiro` | Unique test case identifier |
| `Nome do cenário` | Test scenario name (becomes the describe/test title) |
| `URL da tela` | Target URL for the test |
| `URL de Login` | Login URL (if authentication is required) |
| `Dados de teste` | Test data (credentials, inputs, etc.) |
| `Passos manuais` | Step-by-step manual instructions |
| `Resultado esperado` | Expected outcome for each step |
| `Observações do QA` | Optional QA notes and context |
| `Roteiro pronto para automação` | Boolean flag — pipeline only triggers when `TRUE` |

---

## 🤖 AI Agent Behavior

The agent follows a strict prompt policy to keep executions predictable and token-efficient:

**Snapshot policy** — `browser_snapshot` is called only when a selector is needed. Never after a successful action. Never more than once per step. If a selector fails twice, the step is marked as `// FAILED` and execution continues.

**Selector priority** — the agent resolves selectors in this order:
1. `getByRole`
2. `getByLabel`
3. `getByText`
4. `getByPlaceholder`
5. `data-test` / `data-testid` CSS attributes
6. Generic CSS selector (last resort)

**Execution flow:**
1. `generator_setup_page` — initializes the browser session with the full test plan
2. Step-by-step execution using browser tools
3. `generator_read_log` — called once, at the end
4. `generator_write_test` — writes the complete `.spec.ts` file

---

## ⚙️ Setup

### Prerequisites

- n8n self-hosted (Docker recommended)
- Node.js 18+
- Playwright installed in the project
- Anthropic API key
- Google Cloud project with OAuth2 credentials and Sheets API enabled

### 1. Clone and configure the MCP Bridge

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
npm install
```

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

```env
# .env
MCP_BRIDGE_PORT=3456
PLAYWRIGHT_PROJECT_PATH=/path/to/your/playwright/project
```

Start the MCP Bridge:

```bash
node mcp-bridge.js
```

### 2. Import the workflow into n8n

In the n8n interface: **Workflows → Import from file** → select `workflow.json`.

### 3. Configure credentials in n8n

Go to **Credentials** and create:

- **Google Sheets OAuth2** — use your Google Cloud OAuth2 Client ID and Secret. Add this redirect URI in Google Cloud Console:
  ```
  http://localhost:5678/rest/oauth2-credential/callback
  ```
- **Anthropic API** — paste your Anthropic API key.

### 4. Configure the trigger node

Open the **Monitor QA Spreadsheet** node and set:
- `documentId` → your Google Sheet ID (`YOUR_GOOGLE_SHEET_ID`)
- `sheetName` → the sheet tab name

### 5. Activate the workflow

Toggle the workflow to **Active**. From this point, any row marked `TRUE` in the `Roteiro pronto para automação` column will trigger the pipeline.

---

## 📁 Project Structure

```
.
├── mcp-bridge.js              # MCP Bridge — exposes Playwright tools over HTTP
├── server.js                  # Supporting server utilities
├── workflow.json              # n8n workflow (import this)
├── .env.example               # Environment variable template
├── playwright.config.js       # Playwright configuration
├── package.json
└── tests/                     # Generated .spec.ts files land here
```

---

## 💡 Design Decisions

**Why MCP instead of direct Playwright calls from n8n?**
n8n runs inside Docker and has no direct access to a local browser. The MCP Bridge acts as a sidecar: it runs on the host machine alongside n8n, exposes each Playwright action as an HTTP endpoint, and the AI agent calls these tools dynamically based on what the test plan requires.

**Why Claude Sonnet specifically?**
The agent needs strong instruction-following to respect the snapshot policy and selector priority rules. Sonnet hits the right balance between reasoning quality and token cost for iterative browser interactions.

**Why Google Sheets as the input interface?**
QA teams already live in spreadsheets. This removes any friction between writing a test case and triggering automation — the tool meets the team where they are, without requiring them to learn a new tool.

---

## ⚠️ PoC Limitations

This is a proof of concept, not a production-ready tool. Known limitations:

- The MCP Bridge runs locally and requires manual startup — there is no process manager or auto-restart
- The pipeline polls Google Sheets every minute, which is not ideal for high-frequency workflows
- Generated tests may require manual review for complex UI interactions or dynamic selectors
- No retry logic at the pipeline level if the AI agent fails mid-execution

---

## 🔒 Security Notes

- This repository contains **no credentials**. All sensitive values (API keys, OAuth secrets, Sheet IDs) are configured via n8n's credential manager and environment variables.
- Never commit `.env` files. The `.gitignore` excludes them.

---

## 📄 License

MIT
