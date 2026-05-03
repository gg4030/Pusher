# Trello MCP Server

A local **Model Context Protocol (MCP)** server that lets Claude Desktop talk
to the [Trello REST API](https://developer.atlassian.com/cloud/trello/rest/).
Once connected, you can ask Claude things like:

> "Create a Trello card titled 'Draft midterm essay' in my To Do list, due Friday."

and Claude will call this server's `create_trello_card` tool to create the
card on your real Trello board.

This project was built for an *AI in Business* class assignment. It is
designed to run **locally** over `stdio` (the transport Claude Desktop uses).

---

## Features / MCP tools

| Tool                  | What it does                                                     |
|-----------------------|------------------------------------------------------------------|
| `health_check`        | Verifies the server is up and credentials are configured.        |
| `list_trello_boards`  | Lists boards visible to the authenticated Trello user.           |
| `list_trello_lists`   | Lists the columns ("lists") on a Trello board.                   |
| `create_trello_card`  | Creates a card with `name`, optional `description`, `list_id`, `due`. |
| `get_trello_card`     | Fetches details for an existing card by ID.                      |

---

## 1. Prerequisites

- **Python 3.10+** (`python3 --version`)
- **Claude Desktop** installed
  ([download](https://claude.ai/download))
- A Trello account

---

## 2. Set up the project

### macOS / Linux

```bash
cd trello-mcp-server
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Windows (PowerShell)

```powershell
cd trello-mcp-server
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 3. Create your `.env` file

```bash
cp .env.example .env        # macOS / Linux
copy .env.example .env      # Windows
```

Open `.env` in a text editor and fill in your secrets. **Do not commit this
file.** It is already listed in `.gitignore`.

---

## 4. Get your Trello API key and token

1. Sign in to Trello in your browser.
2. Go to <https://trello.com/power-ups/admin> and click **New** to create a
   small Power-Up. Give it any name (e.g. "Personal MCP"). Pick any workspace
   you own.
3. Open the new Power-Up, click the **API key** tab. Copy the **API key**
   into `TRELLO_API_KEY` in your `.env` file.
4. On the same page, click the **Token** link next to the API key. Authorize
   it for your account, then copy the long token into `TRELLO_TOKEN` in
   `.env`.

> **Security:** these credentials grant access to your Trello account.
> Keep them only in your local `.env` file. Never paste them into Cursor,
> ChatGPT, GitHub, or your Claude Desktop config.

---

## 5. Find your board and list IDs

Run the connectivity test script. It prints all your boards and (if you've
already filled in `TRELLO_BOARD_ID`) the lists on that board:

```bash
python test_trello_connection.py
```

Sample output:

```
Authenticated as: Alex Student (@alexstudent)

Boards (2):
  - AI in Business
      id : 660abc12def3456789012345
      url: https://trello.com/b/AbCdEf12/ai-in-business
  - Personal
      id : 660aaa12def3456789012abc
```

Copy the desired board ID into `TRELLO_BOARD_ID` in `.env`, save, and run
the script again to see that board's lists. Copy a list's ID into
`TRELLO_LIST_ID` (this becomes the default list for `create_trello_card`).

---

## 6. Test the server manually (optional)

You can sanity-check that the MCP server starts without errors:

```bash
python server.py
```

It will sit waiting for MCP messages on stdin. Press `Ctrl+C` to quit. (You
won't see useful output here — Claude Desktop is the real client.)

---

## 7. Configure Claude Desktop

Claude Desktop reads its MCP servers from a JSON config file.

| OS       | Path                                                                                  |
|----------|---------------------------------------------------------------------------------------|
| macOS    | `~/Library/Application Support/Claude/claude_desktop_config.json`                     |
| Windows  | `%APPDATA%\Claude\claude_desktop_config.json` (e.g. `C:\Users\<you>\AppData\Roaming\Claude\claude_desktop_config.json`) |

If the file does not exist, create it. Use the snippet for your OS and
**replace the `/ABSOLUTE/PATH/TO/...` placeholders with the full path to
this project on your machine.**

### macOS snippet (also in `claude_desktop_config_snippet_mac.json`)

```json
{
  "mcpServers": {
    "trello": {
      "command": "/ABSOLUTE/PATH/TO/trello-mcp-server/.venv/bin/python",
      "args": [
        "/ABSOLUTE/PATH/TO/trello-mcp-server/server.py"
      ]
    }
  }
}
```

### Windows snippet (also in `claude_desktop_config_snippet_windows.json`)

```json
{
  "mcpServers": {
    "trello": {
      "command": "C:\\ABSOLUTE\\PATH\\TO\\trello-mcp-server\\.venv\\Scripts\\python.exe",
      "args": [
        "C:\\ABSOLUTE\\PATH\\TO\\trello-mcp-server\\server.py"
      ]
    }
  }
}
```

> **Notes**
> - Windows paths must use **double backslashes** in JSON.
> - The Claude config does **not** contain any Trello credentials — those
>   live only in your local `.env` file.
> - If you already have other MCP servers configured, add the `"trello"`
>   entry inside your existing `"mcpServers"` object instead of replacing
>   the whole file.

After saving the config, **fully quit and restart Claude Desktop**. On
macOS that means `Cmd+Q`, not just closing the window.

---

## 8. Test from Claude Desktop

In a new Claude Desktop chat, click the tools / hammer icon. You should see
**`trello`** listed with its 5 tools. Try prompts like:

- "Run the Trello health_check tool and show me the result."
- "List my Trello boards."
- "List the lists on board `<paste a board id>`."
- "Create a Trello card titled 'Read chapter 4' in my default list, with
  description 'AI in Business homework'."
- "Create a Trello card 'Submit project proposal' due 2026-05-15T17:00:00Z."

Claude will ask for permission before calling each tool the first time.
Approve it, and a card will appear on your real Trello board within seconds.

---

## Project layout

```
trello-mcp-server/
├── server.py                                  # The MCP server (FastMCP, stdio)
├── test_trello_connection.py                  # CLI script to verify creds + list IDs
├── requirements.txt
├── pyproject.toml
├── .env.example                               # Placeholder values (safe to commit)
├── .gitignore                                 # Excludes .env and .venv
├── README.md                                  # This file
├── TROUBLESHOOTING.md                         # Common issues and fixes
├── claude_desktop_config_snippet_mac.json
└── claude_desktop_config_snippet_windows.json
```

See `TROUBLESHOOTING.md` if anything goes wrong.

---

## Security checklist

- [x] No real API keys, tokens, or other secrets are committed.
- [x] `.env` and `.venv` are git-ignored.
- [x] Credentials are read at runtime from `.env` next to `server.py`.
- [x] Logging goes to **stderr** so it never corrupts MCP's stdout protocol.
- [x] The Claude Desktop config does not contain credentials.
