<<<<<<< HEAD
# Monday.com Business Intelligence Agent

An AI-powered Business Intelligence agent that connects dynamically to Monday.com to answer founder-level business queries across Work Orders and Deals boards.

## Features

- **Conversational Interface**: Chat with your Monday.com data in natural language (Streamlit UI).
- **Dynamic API Integration**: Fetches boards, schemas, and all items using Monday.com's GraphQL API with automatic cursor-based pagination and retry logic.
- **Resilient Data Import**: Handles messy Excel data — infers column types, normalizes dates/currency/NaNs, and maps correct headers.
- **Deterministic Analytics**: A `calculate_metrics` tool lets the AI group and sum data with Pandas rather than guessing, preventing hallucinations.
- **Leadership Updates**: One-click or natural-language command to generate a structured executive summary across all boards.

---

## Setup Instructions

### 1. Prerequisites

- Python 3.9+
- Monday.com account with a **Personal API Token** (see below)
- Google **Gemini API Key** ([Get one here](https://aistudio.google.com/app/apikey))

#### Getting your Monday.com API Token
Log in → click your profile picture (bottom-left) → **Administration → API** → copy your **Personal API Token**.

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd monday_business_agent

python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
MONDAY_API_TOKEN=your_monday_personal_access_token_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Import Data into Monday.com

Place `Deal funnel Data.xlsx` and `Work_Order_Tracker Data.xlsx` in the project root, then run:

```bash
python import_data.py
```

This will create two boards — **Deals (BI Agent)** and **Work Orders (BI Agent)** — and upload all rows automatically.

### 5. Run Locally

```bash
streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501) and start asking questions!

### 6. Run Tests

```bash
python -m pytest tests/ -v
```

---

## Deploying on Streamlit Community Cloud (Hosted Prototype)

1. Push this repository to **GitHub** (the `.gitignore` already excludes `.env` and `venv/`).
2. Go to [share.streamlit.io](https://share.streamlit.io) and sign in with GitHub.
3. Click **New app** → select your repository → set **Main file path** to `app.py`.
4. Open **Advanced settings → Secrets** and paste your credentials in TOML format:

```toml
MONDAY_API_TOKEN = "your_monday_personal_access_token_here"
GEMINI_API_KEY   = "your_gemini_api_key_here"
```

5. Click **Deploy** — your prototype will be live at a public URL within minutes!

> **Note:** Run `python import_data.py` locally first to ensure data is already imported into Monday.com before deploying. The app only *reads* from Monday.com at runtime.

---

## Architecture Overview

| File | Role |
|---|---|
| `app.py` | Streamlit chat UI — manages session state, chat history, and the "Leadership Update" sidebar button |
| `agent.py` | AI core — Gemini 2.5 Flash with 5 callable tools; handles tool-call loop automatically |
| `monday_api.py` | Monday.com GraphQL integration — retry logic (tenacity), cursor-based pagination, timeouts |
| `import_data.py` | One-time setup script — normalizes and uploads Excel data to Monday.com boards |
| `tests/test_api.py` | Unit tests for API wrappers and normalization logic |

### Agent Tools

| Tool | Purpose |
|---|---|
| `get_available_boards` | Lists all boards and IDs |
| `get_board_schema` | Returns human-readable column titles for a board |
| `fetch_board_data_sample` | Returns first 10 rows for exploration |
| `calculate_metrics` | **Deterministic** — groups and sums a column using Pandas |
| `get_leadership_update` | Fetches high-level KPIs from Deals + Work Orders in one call |

## Deliverables

- **Decision Log**: [`Decision_Log.md`](Decision_Log.md)
- **Source Code**: This repository (ZIP available)
=======
# Monday-Business-Agent
>>>>>>> 7ba2c72da022ddf92548485a4163455061f5d9e8
