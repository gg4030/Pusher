# Cursor Chat Export — Trello MCP Server

**Course:** AI in Business
**Assignment:** Build a local Model Context Protocol (MCP) server that lets
Claude Desktop create Trello cards from a chat prompt.
**Tooling:** Cursor (Cloud Agent), Claude (Composer), Python 3.10+, official
MCP Python SDK with FastMCP, `httpx`, `python-dotenv`.
**Repository:** `trello-mcp-server/` (branch `cursor/trello-mcp-server-2d20`).

---

## 1. Prompts I used

Below are the prompts I sent to Cursor, summarized in the order I used them.

### Prompt 1 — Build the project

> "You are a senior Python engineer helping me complete an AI in Business
> class assignment. Create a complete local Model Context Protocol server
> project in a folder named `trello-mcp-server`."
>
> Goal: a Python MCP server that lets Claude Desktop connect to the Trello
> REST API and create Trello cards from a chat prompt.
>
> Requirements: Python; official MCP SDK with FastMCP; runs locally over
> stdio; `python-dotenv` for secrets; no hardcoded API keys; ship a
> `.env.example` with dummy placeholders; ignore `.env` and `.venv`; logs to
> stderr (not stdout, because MCP uses stdout for the protocol); use `httpx`
> for Trello calls; load `.env` from `Path(__file__).resolve().parent`.
>
> Files to create: `server.py`, `test_trello_connection.py`,
> `requirements.txt`, `pyproject.toml`, `.env.example`, `.gitignore`,
> `README.md`, `TROUBLESHOOTING.md`,
> `claude_desktop_config_snippet_mac.json`,
> `claude_desktop_config_snippet_windows.json`.
>
> MCP tools required: `health_check`, `list_trello_boards`,
> `list_trello_lists`, `create_trello_card`, `get_trello_card`.

### Prompt 2 — Audit and fix

> "Review the MCP server project for security, reliability, and assignment
> grading. Confirm: `.env` is not committed; `.env.example` uses dummy
> values; Claude Desktop JSON has no API keys or tokens; `server.py` loads
> `.env` from the project folder; logs go to stderr; all required tools are
> implemented; README and troubleshooting are clear. Make any fixes needed
> for a clean final submission."

### Prompt 3 — Export this transcript

> "Generate my Cursor Chat Export content for submission. Summarize the
> prompts I used, the design decisions, the security choices, and any
> debugging or fixes you made."

---

## 2. Cursor's response — design decisions

### Why FastMCP + stdio

The official MCP Python SDK ships a `FastMCP` helper that turns plain
Python functions into MCP tools using their type hints and docstrings.
That gave me five clean tool definitions in `server.py` with very little
boilerplate:

```python
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("trello-mcp-server")

@mcp.tool()
async def create_trello_card(name: str, description: str = "",
                             list_id: str | None = None,
                             due: str | None = None) -> dict:
    ...
```

Claude Desktop launches MCP servers over **stdio** (the server reads MCP
JSON-RPC messages on stdin and writes responses on stdout). I called
`mcp.run()` with no arguments, which uses stdio by default. No HTTP server,
no port, nothing for Claude to misconfigure.

### Why `Path(__file__).resolve().parent` for `.env`

Claude Desktop launches the server with whatever working directory it
likes. If I had used `load_dotenv()` (which looks in the current
directory), the server would silently start with no credentials. Anchoring
to the file's own folder makes the server portable:

```python
HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")
```

`test_trello_connection.py` uses the same pattern, so both scripts read
the same `.env`.

### Why logs go to stderr

MCP servers communicate with Claude Desktop by writing JSON-RPC messages
to **stdout**. A stray `print()` would corrupt the protocol stream and
disconnect the server. I configured `logging` to emit to **stderr** so
diagnostics are visible (in the Claude MCP log files) without breaking
the protocol:

```python
logging.basicConfig(level=os.getenv("TRELLO_MCP_LOG_LEVEL", "INFO"),
                    stream=sys.stderr,
                    format="%(asctime)s [%(levelname)s] trello-mcp: %(message)s")
```

A grep for `print(` in `server.py` returns zero hits.

### Why one async `_trello_request` helper

All four data tools call Trello in the same way (`httpx.AsyncClient`,
auth params, JSON response, friendly error mapping). Centralizing that
in `_trello_request()` means a 401/400/404/network error is translated to
a human-readable message exactly once, and every tool returns the same
`{"success": False, "error": "..."}` shape on failure.

### `create_trello_card` argument shape

Per the assignment, the tool accepts `name`, `description`, optional
`list_id`, and optional `due` (ISO-8601). When `list_id` is omitted it
falls back to `TRELLO_LIST_ID` from `.env`. The success response is
exactly:

```json
{
  "success": true,
  "card_id": "660c...",
  "name": "Read chapter 4",
  "url": "https://trello.com/c/abc/...",
  "list_id": "660b..."
}
```

---

## 3. Security choices

These were enforced from the very first commit.

| # | Choice | How it's enforced |
| - | ------ | ----------------- |
| 1 | **No real secrets in the repo** | `.env.example` ships only `your_*_here` placeholders. A repo-wide scan for any 32+ character alphanumeric token returned **no matches**. |
| 2 | **`.env` is git-ignored** | `.gitignore` contains `.env` and `.env.*` with a `!.env.example` exception. `git ls-files` shows only `.env.example`. |
| 3 | **`.venv` is git-ignored** | `.venv/`, `venv/`, `env/`, `ENV/` are all ignored. |
| 4 | **No credentials in Claude Desktop config** | The mac and windows JSON snippets contain only `command` and `args` (file paths). No `env`, `apiKey`, `token`, or any other secret field. |
| 5 | **Secrets only live in local `.env`** | The README explicitly tells the student: do not paste your token into Cursor, ChatGPT, GitHub, or your Claude config. |
| 6 | **Auth never logged** | The `_trello_request` helper logs only the HTTP method and path at DEBUG. The `params` dict (which holds the API key + token) is never logged. |
| 7 | **Leaked-token recovery procedure** | `TROUBLESHOOTING.md` explains how to revoke a Trello token at `https://trello.com/<user>/account` and rotate the key if it ever escapes. |

---

## 4. Debugging and fixes

Two real issues came up while building and testing the project.

### Fix 1 — `python -m venv` blocked in the sandbox

When I tried to create a virtual environment to test the server, the
agent's sandbox was missing `ensurepip`:

```text
$ python3 -m venv .venv
The virtual environment was not created successfully because ensurepip
is not available. On Debian/Ubuntu systems, you need to install the
python3-venv package...
```

This was just a sandbox limitation — it has no effect on a normal
student install. To verify the project still works, I installed the
dependencies system-wide (with `--break-system-packages --ignore-installed`)
purely for testing. The `README.md` instructions for the student remain
the standard `python3 -m venv .venv` flow, which works on any machine
that has the `python3-venv` package.

### Fix 2 — Verifying that all 5 tools register

Importing `server.py` could silently succeed even if a `@mcp.tool()`
decorator was wrong. To prove the tool surface, I called the SDK's
introspection API:

```text
$ python -c "import asyncio, server; print([t.name for t in asyncio.run(server.mcp.list_tools())])"
['health_check', 'list_trello_boards', 'list_trello_lists',
 'create_trello_card', 'get_trello_card']
```

All five tools registered with the correct argument schemas (e.g.
`create_trello_card` correctly marks `name` as required and `list_id`,
`due` as optional with `null` default).

### Fix 3 — Connection script exit code

I ran `python test_trello_connection.py` with no `.env` to confirm it
fails *gracefully* instead of crashing with a traceback. It printed the
helpful message:

```text
ERROR: TRELLO_API_KEY and TRELLO_TOKEN must be set in your .env file.
Copy .env.example to .env and fill in your credentials.
```

…and exited with code `1`, as expected.

### Audit pass — no further fixes required

For the second prompt ("review for security, reliability, and grading"),
I walked the assignment checklist top to bottom (see `§3` above) and
found that every item already passed. No additional code changes were
made in the audit pass.

---

## 5. Final project layout

```text
trello-mcp-server/
├── server.py                                  # FastMCP server (stdio)
├── test_trello_connection.py                  # CLI to verify creds + list IDs
├── requirements.txt                           # mcp, httpx, python-dotenv
├── pyproject.toml
├── .env.example                               # placeholders only
├── .gitignore                                 # ignores .env, .venv, caches
├── README.md
├── TROUBLESHOOTING.md
├── claude_desktop_config_snippet_mac.json
└── claude_desktop_config_snippet_windows.json
```

### Tools exposed to Claude Desktop

| Tool | Purpose |
| ---- | ------- |
| `health_check` | Confirms the server is up and credentials are configured (without revealing them). |
| `list_trello_boards` | Lists boards visible to the authenticated user. |
| `list_trello_lists` | Lists columns on a board (uses `TRELLO_BOARD_ID` default). |
| `create_trello_card` | Creates a card. Args: `name`, `description?`, `list_id?`, `due?`. |
| `get_trello_card` | Fetches a card by ID. |

### Example interaction (after wiring into Claude Desktop)

> **Me:** "Create a Trello card titled *Read chapter 4* in my default list,
> description *AI in Business homework*, due 2026-05-15T17:00:00Z."
>
> **Claude:** *(calls `create_trello_card`)*
>
> ```json
> {
>   "success": true,
>   "card_id": "660c1f...",
>   "name": "Read chapter 4",
>   "url": "https://trello.com/c/AbCdEf12/...",
>   "list_id": "660b09..."
> }
> ```

---

## 6. What I learned

1. **MCP is just JSON-RPC over stdio.** The protocol itself is small —
   the SDK is what makes it ergonomic. FastMCP turns a typed Python
   function into a tool the LLM can call with no extra wiring.
2. **stdout is sacred.** Anything written to stdout by an MCP server
   that is not a JSON-RPC message will crash the connection. Logging to
   stderr is non-negotiable.
3. **Path handling matters for end-user reliability.** Loading `.env`
   relative to the script file (not the CWD) is the difference between
   "works on my machine" and "works wherever Claude Desktop launches it."
4. **Secrets management is a posture, not a checklist.** Keeping
   credentials out of the repo, out of the Claude config, out of chat
   logs, and out of any logging output is what made this submission
   safe to share publicly.
