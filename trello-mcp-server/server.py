"""Trello MCP Server.

A local Model Context Protocol (MCP) server that exposes a small set of
Trello tools to Claude Desktop (or any other MCP client) over stdio.

Important constraints:
    * MCP communicates over stdout, so this module never prints to stdout.
      All diagnostic output goes to stderr via the ``logging`` module.
    * Secrets are loaded from a local ``.env`` file located next to this
      file. They are never hardcoded.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

logging.basicConfig(
    level=os.getenv("TRELLO_MCP_LOG_LEVEL", "INFO"),
    stream=sys.stderr,
    format="%(asctime)s [%(levelname)s] trello-mcp: %(message)s",
)
logger = logging.getLogger("trello-mcp")

TRELLO_API_BASE = "https://api.trello.com/1"
HTTP_TIMEOUT = 30.0


def _get_credentials() -> tuple[str, str]:
    """Return Trello (api_key, token) or raise a friendly error."""
    api_key = os.getenv("TRELLO_API_KEY", "").strip()
    token = os.getenv("TRELLO_TOKEN", "").strip()
    if not api_key or not token:
        raise RuntimeError(
            "Missing Trello credentials. Set TRELLO_API_KEY and TRELLO_TOKEN "
            "in your local .env file (see .env.example)."
        )
    return api_key, token


def _auth_params() -> dict[str, str]:
    api_key, token = _get_credentials()
    return {"key": api_key, "token": token}


def _format_http_error(exc: httpx.HTTPStatusError) -> str:
    status = exc.response.status_code
    body = exc.response.text.strip()
    if status == 401:
        return (
            "Trello returned 401 Unauthorized. Your TRELLO_API_KEY or "
            "TRELLO_TOKEN is missing, expired, or does not have access to "
            "this resource. Regenerate your token at "
            "https://trello.com/power-ups/admin and update your .env file."
        )
    if status == 400:
        return (
            f"Trello returned 400 Bad Request: {body}. "
            "Check that the list_id, board_id, and other arguments are valid."
        )
    if status == 404:
        return (
            f"Trello returned 404 Not Found: {body}. "
            "The board or list ID may be wrong, or the token may not have "
            "access to it."
        )
    return f"Trello API error {status}: {body}"


async def _trello_request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    data: dict[str, Any] | None = None,
) -> Any:
    """Make an authenticated request to the Trello REST API."""
    full_params: dict[str, Any] = dict(params or {})
    full_params.update(_auth_params())
    url = f"{TRELLO_API_BASE}{path}"
    logger.debug("Trello %s %s", method, path)
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        try:
            response = await client.request(
                method, url, params=full_params, data=data
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise RuntimeError(_format_http_error(exc)) from exc
        except httpx.RequestError as exc:
            raise RuntimeError(
                f"Network error calling Trello ({type(exc).__name__}): {exc}"
            ) from exc
        if not response.content:
            return None
        try:
            return response.json()
        except ValueError:
            return response.text


mcp = FastMCP("trello-mcp-server")


@mcp.tool()
async def health_check() -> dict[str, Any]:
    """Check that the server is running and Trello credentials are configured.

    Returns a dictionary describing whether the API key and token are set
    (without revealing them) and whether default board/list IDs are present.
    """
    api_key = os.getenv("TRELLO_API_KEY", "").strip()
    token = os.getenv("TRELLO_TOKEN", "").strip()
    board_id = os.getenv("TRELLO_BOARD_ID", "").strip()
    list_id = os.getenv("TRELLO_LIST_ID", "").strip()

    status: dict[str, Any] = {
        "success": True,
        "server": "trello-mcp-server",
        "credentials": {
            "TRELLO_API_KEY_set": bool(api_key),
            "TRELLO_TOKEN_set": bool(token),
            "TRELLO_BOARD_ID_set": bool(board_id),
            "TRELLO_LIST_ID_set": bool(list_id),
        },
    }

    if not api_key or not token:
        status["success"] = False
        status["error"] = (
            "Missing Trello credentials. Set TRELLO_API_KEY and TRELLO_TOKEN "
            "in your local .env file."
        )
        return status

    try:
        me = await _trello_request("GET", "/members/me", params={"fields": "username,fullName"})
        status["trello_user"] = {
            "username": me.get("username"),
            "fullName": me.get("fullName"),
        }
    except RuntimeError as exc:
        status["success"] = False
        status["error"] = str(exc)
    return status


@mcp.tool()
async def list_trello_boards() -> dict[str, Any]:
    """List all Trello boards visible to the authenticated user.

    Returns a list of boards with their ``id``, ``name``, and ``url``.
    """
    try:
        boards = await _trello_request(
            "GET",
            "/members/me/boards",
            params={"fields": "name,url,closed", "filter": "open"},
        )
    except RuntimeError as exc:
        return {"success": False, "error": str(exc)}

    return {
        "success": True,
        "count": len(boards) if isinstance(boards, list) else 0,
        "boards": [
            {"id": b.get("id"), "name": b.get("name"), "url": b.get("url")}
            for b in (boards or [])
        ],
    }


@mcp.tool()
async def list_trello_lists(board_id: str | None = None) -> dict[str, Any]:
    """List the lists (columns) on a Trello board.

    Args:
        board_id: Optional Trello board ID. If not provided, falls back to
            ``TRELLO_BOARD_ID`` from the .env file.
    """
    target_board = (board_id or os.getenv("TRELLO_BOARD_ID", "")).strip()
    if not target_board:
        return {
            "success": False,
            "error": (
                "No board_id provided and TRELLO_BOARD_ID is not set in .env. "
                "Pass board_id or configure a default in your .env file."
            ),
        }

    try:
        lists = await _trello_request(
            "GET",
            f"/boards/{target_board}/lists",
            params={"fields": "name,closed,idBoard"},
        )
    except RuntimeError as exc:
        return {"success": False, "error": str(exc)}

    return {
        "success": True,
        "board_id": target_board,
        "count": len(lists) if isinstance(lists, list) else 0,
        "lists": [
            {"id": l.get("id"), "name": l.get("name"), "closed": l.get("closed", False)}
            for l in (lists or [])
        ],
    }


@mcp.tool()
async def create_trello_card(
    name: str,
    description: str = "",
    list_id: str | None = None,
    due: str | None = None,
) -> dict[str, Any]:
    """Create a new Trello card.

    Args:
        name: Title of the card. Required.
        description: Optional card description (Markdown supported by Trello).
        list_id: Optional Trello list ID. If omitted, ``TRELLO_LIST_ID`` from
            the .env file is used.
        due: Optional ISO-8601 due date string, e.g. ``2026-05-15T17:00:00Z``.
    """
    if not name or not name.strip():
        return {
            "success": False,
            "error": "Card 'name' is required and cannot be empty.",
        }

    target_list = (list_id or os.getenv("TRELLO_LIST_ID", "")).strip()
    if not target_list:
        return {
            "success": False,
            "error": (
                "No list_id provided and TRELLO_LIST_ID is not set in .env. "
                "Pass list_id or configure a default in your .env file. "
                "You can find list IDs by running list_trello_lists."
            ),
        }

    payload: dict[str, Any] = {
        "idList": target_list,
        "name": name.strip(),
    }
    if description:
        payload["desc"] = description
    if due:
        payload["due"] = due

    try:
        card = await _trello_request("POST", "/cards", data=payload)
    except RuntimeError as exc:
        return {"success": False, "error": str(exc)}

    if not isinstance(card, dict):
        return {
            "success": False,
            "error": f"Unexpected response from Trello: {card!r}",
        }

    return {
        "success": True,
        "card_id": card.get("id"),
        "name": card.get("name"),
        "url": card.get("url") or card.get("shortUrl"),
        "list_id": card.get("idList", target_list),
    }


@mcp.tool()
async def get_trello_card(card_id: str) -> dict[str, Any]:
    """Fetch details for an existing Trello card by ID.

    Args:
        card_id: The Trello card ID or short link.
    """
    if not card_id or not card_id.strip():
        return {"success": False, "error": "card_id is required."}

    try:
        card = await _trello_request(
            "GET",
            f"/cards/{card_id.strip()}",
            params={"fields": "name,desc,url,idList,idBoard,due,closed"},
        )
    except RuntimeError as exc:
        return {"success": False, "error": str(exc)}

    if not isinstance(card, dict):
        return {"success": False, "error": f"Unexpected response: {card!r}"}

    return {
        "success": True,
        "card_id": card.get("id"),
        "name": card.get("name"),
        "description": card.get("desc"),
        "url": card.get("url"),
        "list_id": card.get("idList"),
        "board_id": card.get("idBoard"),
        "due": card.get("due"),
        "closed": card.get("closed", False),
    }


def main() -> None:
    """Entry point used by ``python server.py`` and the console script."""
    logger.info("Starting Trello MCP server (stdio transport).")
    mcp.run()


if __name__ == "__main__":
    main()
