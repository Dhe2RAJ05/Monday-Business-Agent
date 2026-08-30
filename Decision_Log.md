# Decision Log

## Architecture & Tech Stack

### 1. Choice of Interface: Streamlit
**Assumption**: The founder needs a quick, accessible, and intuitive way to interact with their data without setting up complex BI dashboards.
**Decision**: I chose Streamlit in Python to build the chat interface.
**Trade-offs**: Streamlit is incredibly fast to develop with, making it ideal for the 6-hour timeline constraint. The trade-off is that it is less customizable from a strict UX/UI perspective compared to a bespoke React (Next.js) frontend. However, it perfectly supports conversational AI interfaces out-of-the-box.

### 2. Monday.com Integration: Direct API over MCP
**Decision**: We initially considered using the Model Context Protocol (MCP) to standardize tool calling. However, given the requirement to build a standalone web application quickly, we pivoted to using direct GraphQL API integration for Monday.com.
**Trade-offs**: Direct API calls reduce the number of moving parts (no need to run a separate MCP server subprocess) and minimize latency. While MCP would have made the agent's toolset more portable across different platforms, the direct API approach was overwhelmingly safer and faster for this specific prototype.

### 3. AI Core: Google Gemini 2.5 Flash
**Decision**: I used `gemini-2.5-flash` via the `google-genai` SDK.
**Trade-offs**: Gemini 2.5 Flash is highly optimized for fast inference and excels at function/tool calling. It easily understands complex business queries and translates them into calls to our Python-based Monday.com tools. It might be slightly less exhaustive than a "Pro" model, but the speed for a conversational interface is superior.

## Data Resilience & Import

### 1. Dynamic Board Creation
**Assumption**: The provided CSV/Excel data is messy and may change in structure.
**Decision**: The `import_data.py` script was written to dynamically infer column types using Pandas (`numbers`, `date`, `text`) and map them directly to Monday.com columns, rather than hardcoding the schema.
**Trade-offs**: This approach handles unexpected columns gracefully but risks misclassifying a column if the first few rows have ambiguous data (e.g., text instead of numbers). 

### 2. Handling Missing/Null Values
**Decision**: In `agent.py`, when fetching data via the API, the tools flatten the JSON response into a tabular Markdown format. Missing column values are gracefully ignored. The AI agent's system prompt explicitly instructs it to acknowledge incomplete data and caveat its insights accordingly.

## Interpretation of "Leadership Updates"

**Interpretation**: Founders and executives often don't have time to ask 10 specific questions; they want a synthesized overview of all crucial metrics (revenue pipeline, operational execution) instantly.
**Decision**: I implemented a "Generate Leadership Update" button in the Streamlit sidebar. 
**Implementation**: Clicking this button programmatically triggers the agent to use a specialized tool (`get_leadership_update`) which fetches a bulk sample of data from both the "Deals" and "Work Orders" boards simultaneously. The LLM then synthesizes this raw data into a beautifully formatted Executive Summary in Markdown, highlighting key risks, revenue projections, and operational bottlenecks.

## What I'd Do Differently with More Time
- **Webhooks**: Implement Monday.com webhooks to keep a local database (like SQLite or Postgres) in sync with the boards, so the agent can query the database using SQL instead of hitting the Monday.com GraphQL API for every question (which is subject to rate limits).
- **Authentication**: Add OAuth2 login so any user can connect their own Monday.com account, rather than relying on a single hardcoded API token.
- **Advanced Visualizations**: Have the agent generate actual matplotlib/plotly charts in the Streamlit UI instead of just Markdown text.
