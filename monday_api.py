import os
import time
import requests
import json
from dotenv import load_dotenv
from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception
)

load_dotenv()

MONDAY_API_URL = "https://api.monday.com/v2"
_CACHE_TTL_SECONDS = 60  # cache responses for 60s within a session

# {cache_key: (timestamp, data)}
_cache: dict = {}


class MondayAPIError(Exception):
    """Non-retryable errors: GraphQL validation, auth (4xx), bad queries."""
    pass


class MondayTransientError(Exception):
    """Retryable errors: timeouts, connection failures, HTTP 429, 5xx."""
    pass


def _is_transient(exc) -> bool:
    return isinstance(exc, (MondayTransientError, requests.exceptions.Timeout,
                            requests.exceptions.ConnectionError))


def get_headers():
    token = os.environ.get("MONDAY_API_TOKEN")
    if not token:
        raise MondayAPIError("MONDAY_API_TOKEN is not set in environment variables.")
    return {
        "Authorization": token,
        "API-Version": "2023-10",
        "Content-Type": "application/json"
    }


def get_data_freshness() -> str:
    """Returns how long ago the last successful API response was cached."""
    if not _cache:
        return "No data fetched yet."
    latest = max(ts for ts, _ in _cache.values())
    age = int(time.time() - latest)
    return f"{age}s ago" if age < 60 else f"{age // 60}m {age % 60}s ago"


def invalidate_cache() -> None:
    """Force-clear the cache so the next call fetches fresh data from Monday.com."""
    _cache.clear()


def _cache_key(query: str, variables) -> str:
    return f"{hash(query)}:{hash(json.dumps(variables, sort_keys=True) if variables else '')}"


@retry(
    retry=retry_if_exception(_is_transient),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
def _execute_query_uncached(query, variables=None):
    """Low-level GraphQL executor with retry logic. Do not call directly — use execute_query()."""
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    try:
        response = requests.post(
            MONDAY_API_URL,
            json=payload,
            headers=get_headers(),
            timeout=30
        )
    except requests.exceptions.Timeout as exc:
        raise MondayTransientError("Request timed out") from exc
    except requests.exceptions.ConnectionError as exc:
        raise MondayTransientError("Connection error") from exc

    # Rate-limited or server error → transient, worth retrying
    if response.status_code == 429 or response.status_code >= 500:
        raise MondayTransientError(
            f"Transient HTTP {response.status_code}: {response.text[:200]}"
        )

    # Auth / client errors → non-retryable, raise immediately
    if response.status_code >= 400:
        raise MondayAPIError(
            f"HTTP {response.status_code}: {response.text[:200]}"
        )

    data = response.json()

    # GraphQL-level errors are non-retryable (bad query, permission denied, etc.)
    if "errors" in data:
        raise MondayAPIError(f"GraphQL errors: {json.dumps(data['errors'])}")

    return data["data"]


def execute_query(query, variables=None):
    """Execute a GraphQL query, serving from TTL cache when available."""
    key = _cache_key(query, variables)
    now = time.time()
    if key in _cache:
        ts, cached_data = _cache[key]
        if now - ts < _CACHE_TTL_SECONDS:
            return cached_data
    data = _execute_query_uncached(query, variables)
    _cache[key] = (now, data)
    return data


def get_boards():
    query = """
    query {
      boards(limit: 50) {
        id
        name
        description
      }
    }
    """
    data = execute_query(query)
    return data.get("boards", [])


def get_board_columns(board_id):
    query = """
    query($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns {
          id
          title
          type
        }
      }
    }
    """
    data = execute_query(query, {"boardId": [board_id]})
    boards = data.get("boards", [])
    if boards:
        return boards[0].get("columns", [])
    return []


def get_board_items(board_id, limit=None):
    """
    Fetch items from a board. If `limit` is set, returns only the first page
    (at most `limit` items). If `limit` is None, follows cursors until all
    items are retrieved.
    Reference: https://developer.monday.com/api-reference/reference/next-items-page
    """
    page_limit = limit if limit is not None else 100

    first_query = """
    query($boardId: [ID!], $limit: Int) {
      boards(ids: $boardId) {
        items_page(limit: $limit) {
          cursor
          items {
            id
            name
            column_values {
              id
              type
              text
              value
            }
          }
        }
      }
    }
    """
    data = execute_query(first_query, {"boardId": [board_id], "limit": page_limit})
    boards = data.get("boards", [])
    if not boards or "items_page" not in boards[0]:
        return []

    items_page = boards[0]["items_page"]
    all_items = list(items_page.get("items", []))
    cursor = items_page.get("cursor")

    # If a limit was explicitly requested, stop at the first page
    if limit is not None:
        return all_items

    next_query = """
    query($cursor: String!, $limit: Int) {
      next_items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values {
            id
            type
            text
            value
          }
        }
      }
    }
    """
    while cursor:
        next_data = execute_query(next_query, {"cursor": cursor, "limit": page_limit})
        next_page = next_data.get("next_items_page", {})
        batch = next_page.get("items", [])
        if not batch:
            break
        all_items.extend(batch)
        cursor = next_page.get("cursor")

    return all_items


def create_board(name, board_kind="public"):
    query = """
    mutation($name: String!, $board_kind: BoardKind!) {
      create_board(board_name: $name, board_kind: $board_kind) {
        id
        name
      }
    }
    """
    data = execute_query(query, {"name": name, "board_kind": board_kind})
    return data.get("create_board", {})


def create_column(board_id, title, column_type):
    query = """
    mutation($boardId: ID!, $title: String!, $columnType: ColumnType!) {
      create_column(board_id: $boardId, title: $title, column_type: $columnType) {
        id
        title
      }
    }
    """
    data = execute_query(query, {"boardId": board_id, "title": title, "columnType": column_type})
    return data.get("create_column", {})


def create_item(board_id, item_name, column_values=None):
    query = """
    mutation($boardId: ID!, $itemName: String!, $columnValues: JSON) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id
        name
      }
    }
    """
    variables = {"boardId": board_id, "itemName": item_name}
    if column_values:
        variables["columnValues"] = json.dumps(column_values)

    data = execute_query(query, variables)
    return data.get("create_item", {})
