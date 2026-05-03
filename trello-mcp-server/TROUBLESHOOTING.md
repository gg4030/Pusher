# Troubleshooting

If something is not working, walk through this list top to bottom. Most
problems are caused by (1) credentials, (2) wrong absolute paths in the
Claude Desktop config, or (3) Claude Desktop not being fully restarted.

---

## 1. `test_trello_connection.py` fails

### `ERROR: TRELLO_API_KEY and TRELLO_TOKEN must be set in your .env file.`

- Make sure you copied `.env.example` to `.env` (note the leading dot).
- The `.env` file must live **next to `server.py`**, inside `trello-mcp-server/`.
- There must be no quotes around the values:
  ```
  TRELLO_API_KEY=abc123...
  TRELLO_TOKEN=ATTAxxxxxxxxx
  ```
- Re-activate your virtualenv after editing `.env` (some shells cache env vars).

### `Trello returned 401`

- Your API key or token is wrong, expired, or was revoked.
- Generate a fresh token from <https://trello.com/power-ups/admin>
  (open your Power-Up → API key tab → click **Token**).
- Make sure you authorized the token for the right Trello account.

### `Trello returned 404` when listing lists

- `TRELLO_BOARD_ID` in `.env` is wrong, or the token does not have access to
  that board. Re-run the script with `TRELLO_BOARD_ID` blank to list all
  boards you can see.

### Network errors / timeouts

- Confirm you can reach `https://api.trello.com/1/members/me` in a browser.
- Corporate VPNs / proxies sometimes block Trello. Try a different network.

---

## 2. The `trello` server does not appear in Claude Desktop

- **Fully quit and reopen** Claude Desktop. On macOS use `Cmd+Q` (closing
  the window is not enough). On Windows, exit from the system tray.
- Check the config file path is correct:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- The JSON must be valid. A trailing comma or stray quote will silently
  disable all MCP servers. Paste your config into <https://jsonlint.com> to
  verify.
- The `command` and `args` paths must be **absolute**. On Windows, use
  double backslashes (`C:\\Users\\...`). Tildes (`~`) and `$HOME` are not
  expanded.
- Confirm the Python in `command` is the one inside `.venv` (so it has
  `mcp`, `httpx`, `python-dotenv` installed). You can test from a terminal:
  ```bash
  /ABSOLUTE/PATH/TO/trello-mcp-server/.venv/bin/python -c "import mcp, httpx, dotenv; print('ok')"
  ```

### Reading Claude Desktop's MCP logs

If the server still doesn't show up, check Claude's MCP log files:

- macOS: `~/Library/Logs/Claude/mcp*.log`
- Windows: `%APPDATA%\Claude\logs\mcp*.log`

You should see a line about `trello` starting. If you see a Python
traceback, fix that error and restart Claude Desktop.

---

## 3. Tool calls fail inside Claude Desktop

### `Missing Trello credentials...`

The server started, but it cannot find `.env`. This usually means Claude
Desktop launched `server.py` with a different working directory.

This project handles that by loading `.env` from the directory containing
`server.py` (via `Path(__file__).resolve().parent`). Verify that:

- `.env` is in the same folder as `server.py`.
- The file is literally named `.env` (not `.env.txt`). On Windows,
  enable "Show file extensions" in Explorer to confirm.

### `Trello returned 400 Bad Request`

- The `list_id` you passed (or the `TRELLO_LIST_ID` default) is invalid or
  belongs to a board your token cannot access.
- Use the `list_trello_boards` and `list_trello_lists` tools (or
  `test_trello_connection.py`) to find a valid list ID.

### `Trello returned 401 Unauthorized`

- Your token has been revoked or has expired. Regenerate it and update
  `.env`. Restart Claude Desktop afterwards so the server picks up the new
  value.

### Card is created but in the wrong list

- The default in `.env` (`TRELLO_LIST_ID`) is set to a different list than
  you expected. Either update `.env` or pass `list_id=` explicitly when
  asking Claude to create the card.

---

## 4. "I think my secrets leaked"

If you ever accidentally commit `.env` or paste your token into a chat
window, **revoke it immediately**:

1. Go to <https://trello.com/<your-username>/account>.
2. Scroll to **API Tokens** and click **Revoke** next to your token.
3. Generate a new token and update your local `.env`.
4. Remove the leaked file from git history (`git filter-repo` or
   `git rm --cached .env` followed by a force-push if it was already
   pushed).

---

## 5. Still stuck?

Run the server directly and watch stderr:

```bash
cd trello-mcp-server
source .venv/bin/activate          # or .\.venv\Scripts\Activate.ps1 on Windows
python server.py
```

It will block waiting for MCP messages, but any startup errors (missing
modules, bad `.env`) will be printed to your terminal. Press `Ctrl+C` to
exit.
