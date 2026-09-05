"""Fetch every matching bina.az listing via the paginated GraphQL list API,
then resolve exact per-listing coordinates via the item() detail field.

Why not the map API? bina.az gives every unit in a building the SAME coordinates,
so multi-unit buildings cluster forever on the map and their individual listings
can never be enumerated by zooming. The `items(filter, limit, offset)` list query
has no such limitation — it returns every matching listing. Coordinates come from
`item(id:).latitude/longitude`, and are cached in the DB so only NEW listings need
a coord lookup on subsequent runs.

The GraphQL queries are sent inline (no persisted-query hash), so they survive
bina.az frontend redeploys.
"""
import asyncio
import json
import math

from curl_cffi import AsyncSession
from curl_cffi.requests.exceptions import RequestException

import config

_HEADERS = {
    "accept": "*/*",
    "content-type": "application/json",
    "x-platform": "desktop",
    "referer": "https://bina.az/",
}

# Fields pulled per listing from the list query (ESItem type).
_LIST_FIELDS = (
    "id rooms area { value units } floor floors "
    "price { total currency } location { name fullName } "
    "path photosCount photos { f460x345 }"
)

_PAGE_LIMIT = 50  # bina caps the list page size around here


class _RetryableGraphQL(RuntimeError):
    pass


class _ForbiddenIP(RuntimeError):
    """Cloudflare 403 — the proxy's current exit IP is flagged. Not a real
    error; a fresh session rotates to a new IP."""


def _gql_literal(value) -> str:
    """Serialize a Python value as a GraphQL literal (object keys unquoted)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return json.dumps(value)  # quoted + escaped
    if isinstance(value, list):
        return "[" + ",".join(_gql_literal(v) for v in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(f"{k}:{_gql_literal(v)}" for k, v in value.items()) + "}"
    raise TypeError(f"unsupported literal: {value!r}")


_SEM: asyncio.Semaphore = None


def _proxies():
    return ({"http": config.PROXY_URL, "https": config.PROXY_URL}
            if config.PROXY_URL else None)


async def _post(query: str) -> dict:
    """POST an inline GraphQL query with retry/backoff; return data dict.

    A FRESH session (new connection) is opened per attempt. This is essential
    with rotating residential proxies: they rotate the exit IP per *connection*,
    so a single reused session pins one IP — and if that IP is Cloudflare-flagged
    (~403), every retry over the same connection would fail identically. Opening a
    new session per attempt means each retry lands on a fresh IP.

    A Cloudflare 403 means only that the proxy's current exit IP is flagged, so
    it gets its own large MAX_IP_ROTATIONS budget with near-zero backoff (a fresh
    session = a fresh IP, and that path isn't rate-limited). Genuine failures
    (HTTP 5xx, timeouts, malformed JSON, GraphQL errors) share the smaller
    MAX_RETRIES budget with real backoff, since those can mean server-side limits.
    """
    proxies = _proxies()
    last_exc = None
    rotations = 0  # 403s: bad exit IP, rotate to a fresh one
    errors = 0     # genuine errors: back off
    while rotations < config.MAX_IP_ROTATIONS and errors < config.MAX_RETRIES:
        try:
            async with _SEM:
                # impersonate=chrome spoofs TLS/JA3 so Cloudflare sees a real browser.
                async with AsyncSession(impersonate="chrome", proxies=proxies,
                                        timeout=30) as client:
                    resp = await client.post(
                        config.GRAPHQL_URL, headers=_HEADERS, json={"query": query})
                    if resp.status_code == 403:
                        # Flagged exit IP — leaving this `async with` closes the
                        # session, so the next iteration opens a new one (new IP).
                        raise _ForbiddenIP()
                    resp.raise_for_status()
                    payload = resp.json()
            if "errors" in payload:
                raise _RetryableGraphQL(json.dumps(payload["errors"])[:300])
            return payload["data"]
        except _ForbiddenIP as e:
            rotations += 1
            last_exc = e
            await asyncio.sleep(0.15)  # not rate-limiting; just dodge a bad IP
        except (RequestException, _RetryableGraphQL, ValueError) as e:
            errors += 1
            last_exc = e
            await asyncio.sleep(min(0.4 * errors, 3.0))
    raise last_exc


async def _fetch_page(offset: int) -> list:
    flt = _gql_literal(config.FILTER)
    q = (f"query {{ items(filter: {flt}, limit: {_PAGE_LIMIT}, offset: {offset}) "
         f"{{ {_LIST_FIELDS} }} }}")
    data = await _post(q)
    return data["items"]


async def _enumerate_items() -> list:
    """Page through the list query until exhausted; dedupe by id."""
    by_id = {}
    offset = 0
    while True:
        page = await _fetch_page(offset)
        for it in page:
            by_id[str(it["id"])] = it
        if len(page) < _PAGE_LIMIT:
            break
        offset += _PAGE_LIMIT
    return list(by_id.values())


async def _fetch_coords(item_id: str):
    q = f'{{ item(id:"{item_id}") {{ id latitude longitude }} }}'
    try:
        data = await _post(q)
        it = data.get("item")
        if it and it.get("latitude") is not None:
            return float(it["latitude"]), float(it["longitude"])
    except Exception as e:  # noqa: BLE001
        print(f"WARN: coords lookup failed for {item_id}: {e!r}")
    return None


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def _photo(raw: dict):
    photos = raw.get("photos") or []
    return photos[0].get("f460x345") if photos else None


async def fetch_all_listings(known_coords=None) -> list:
    """Enumerate all matching listings and attach coords + distance.

    `known_coords` maps item_id -> (lat, lng) from the DB, so we only hit the
    item() detail endpoint for listings we haven't geocoded before.
    """
    known_coords = known_coords or {}
    global _SEM
    _SEM = asyncio.Semaphore(config.MAX_CONCURRENCY)

    raw_items = await _enumerate_items()

    # Resolve coords: reuse cached, fetch only the new ones (concurrently).
    new_ids = [str(it["id"]) for it in raw_items if str(it["id"]) not in known_coords]
    fetched = await asyncio.gather(*(_fetch_coords(i) for i in new_ids))
    coords = dict(known_coords)
    for i, c in zip(new_ids, fetched):
        if c:
            coords[i] = c

    listings = []
    for it in raw_items:
        item_id = str(it["id"])
        c = coords.get(item_id)
        if not c:
            continue  # no coords -> can't rank; skip (logged above)
        lat, lng = c
        price = (it.get("price") or {}).get("total")
        loc = it.get("location") or {}
        area = it.get("area") or {}
        listings.append({
            "item_id": item_id,
            "price": price,
            "lat": lat,
            "lng": lng,
            "distance_km": round(haversine_km(lat, lng, config.TARGET_LAT, config.TARGET_LNG), 3),
            "url": "https://bina.az" + it.get("path", f"/items/{item_id}"),
            # extra fields for richer Telegram messages (not all persisted):
            "rooms": it.get("rooms"),
            "area": area.get("value"),
            "floor": it.get("floor"),
            "floors": it.get("floors"),
            "location_name": loc.get("fullName") or loc.get("name"),
            "photo": _photo(it),
        })
    listings.sort(key=lambda x: x["distance_km"])
    return listings


if __name__ == "__main__":
    rows = asyncio.run(fetch_all_listings())
    print(f"Found {len(rows)} listings")
    for r in rows[:config.TOP_N]:
        print(f"{r['distance_km']:>6} km  {r['price']} AZN  {r['rooms']}otaq  "
              f"{r['location_name']}  {r['url']}")
