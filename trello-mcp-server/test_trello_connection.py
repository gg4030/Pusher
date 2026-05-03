"""Standalone Trello connectivity test.

Run this script *before* wiring the MCP server into Claude Desktop. It will:

    1. Verify your TRELLO_API_KEY and TRELLO_TOKEN load from .env.
    2. Call ``GET /members/me`` to confirm the token is valid.
    3. List your boards with their IDs, so you can copy a board ID into .env.
    4. If TRELLO_BOARD_ID is set, list that board's lists with their IDs.

This script intentionally writes to stdout (it is *not* an MCP server) so you
can see the output directly in your terminal.

Usage:
    python test_trello_connection.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

TRELLO_API_BASE = "https://api.trello.com/1"


def _auth() -> dict[str, str]:
    api_key = os.getenv("TRELLO_API_KEY", "").strip()
    token = os.getenv("TRELLO_TOKEN", "").strip()
    if not api_key or not token:
        print(
            "ERROR: TRELLO_API_KEY and TRELLO_TOKEN must be set in your .env file.\n"
            "Copy .env.example to .env and fill in your credentials.",
            file=sys.stderr,
        )
        sys.exit(1)
    return {"key": api_key, "token": token}


def main() -> int:
    params = _auth()
    print("Trello connectivity test")
    print("=" * 40)

    with httpx.Client(timeout=30.0) as client:
        try:
            me = client.get(
                f"{TRELLO_API_BASE}/members/me",
                params={**params, "fields": "username,fullName"},
            )
            me.raise_for_status()
        except httpx.HTTPStatusError as exc:
            print(
                f"FAILED: Trello returned {exc.response.status_code}: "
                f"{exc.response.text}",
                file=sys.stderr,
            )
            if exc.response.status_code == 401:
                print(
                    "Your API key/token is invalid or expired. Generate a new "
                    "token at https://trello.com/power-ups/admin.",
                    file=sys.stderr,
                )
            return 1
        except httpx.RequestError as exc:
            print(f"Network error: {exc}", file=sys.stderr)
            return 1

        user = me.json()
        print(f"Authenticated as: {user.get('fullName')} (@{user.get('username')})")
        print()

        boards = client.get(
            f"{TRELLO_API_BASE}/members/me/boards",
            params={**params, "fields": "name,url,closed", "filter": "open"},
        ).json()

        print(f"Boards ({len(boards)}):")
        for board in boards:
            print(f"  - {board['name']}")
            print(f"      id : {board['id']}")
            print(f"      url: {board.get('url', '')}")
        print()

        board_id = os.getenv("TRELLO_BOARD_ID", "").strip()
        if board_id:
            print(f"Lists on TRELLO_BOARD_ID={board_id}:")
            try:
                lists_resp = client.get(
                    f"{TRELLO_API_BASE}/boards/{board_id}/lists",
                    params={**params, "fields": "name,closed"},
                )
                lists_resp.raise_for_status()
                lists = lists_resp.json()
                for lst in lists:
                    print(f"  - {lst['name']}")
                    print(f"      id: {lst['id']}")
            except httpx.HTTPStatusError as exc:
                print(
                    f"  Could not fetch lists: {exc.response.status_code} "
                    f"{exc.response.text}",
                    file=sys.stderr,
                )
                return 1
        else:
            print(
                "TRELLO_BOARD_ID is not set in .env. "
                "Copy a board id from above into your .env to list its lists."
            )

    print()
    print("OK. Connectivity looks good.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
