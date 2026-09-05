"""Send Telegram messages via the Bot API (using curl_cffi)."""
import html
import time

from curl_cffi import requests

import config

_API = "https://api.telegram.org/bot{token}/sendMessage"


def _format(it: dict) -> str:
    tag = "🆕 New" if it["reason"] == "new" else "💸 Price drop"
    lines = [f"<b>{tag}</b>"]
    if it["reason"] == "price_drop":
        lines.append(f"Price: <s>{it['old_price']}</s> → <b>{it['price']} AZN</b>")
    else:
        price = it["price"] if it["price"] is not None else "?"
        lines.append(f"Price: <b>{price} AZN</b>")

    # one-line summary of the unit, when available
    specs = []
    if it.get("rooms"):
        specs.append(f"{it['rooms']} otaq")
    if it.get("area"):
        specs.append(f"{it['area']:g} m²")
    if it.get("floor") and it.get("floors"):
        specs.append(f"mərtəbə {it['floor']}/{it['floors']}")
    if specs:
        lines.append(" · ".join(specs))
    if it.get("location_name"):
        lines.append(f"🏙 {html.escape(str(it['location_name']))}")

    lines.append(f"📍 {it['distance_km']} km from Crescent Mall")
    lines.append(f'<a href="{html.escape(it["url"])}">{html.escape(it["url"])}</a>')
    return "\n".join(lines)


def send(items: list, on_sent=None) -> list:
    """POST each item; return only the items actually delivered.

    A single failed message (e.g. a 400 on one malformed entry) no longer aborts
    the batch. `on_sent(item)` is invoked immediately after each successful
    delivery, so the caller can persist "notified" state per-item — a crash then
    leaves at most one item ambiguous, instead of re-sending the whole batch.
    """
    if not items:
        return []
    url = _API.format(token=config.TELEGRAM_TOKEN)
    sent = []
    for it in items:
        for _ in range(3):
            resp = requests.post(url, timeout=30, json={
                "chat_id": config.TELEGRAM_CHAT_ID,
                "text": _format(it),
                "parse_mode": "HTML",
                "disable_web_page_preview": False,
            })
            if resp.status_code == 429:  # rate limited -> honor retry_after
                retry_after = resp.json().get("parameters", {}).get("retry_after", 1)
                time.sleep(min(retry_after, 30))
                continue
            try:
                resp.raise_for_status()
                if on_sent is not None:
                    on_sent(it)  # mark delivered BEFORE moving on
                sent.append(it)
            except Exception as e:  # noqa: BLE001
                print(f"WARN: failed to send {it['item_id']}: {e}")
            break
        time.sleep(0.3)  # gentle per-chat pacing
    return sent


def send_text(text: str) -> None:
    """Plain alert (e.g. for scraper failures)."""
    url = _API.format(token=config.TELEGRAM_TOKEN)
    requests.post(url, timeout=30,
                  json={"chat_id": config.TELEGRAM_CHAT_ID, "text": text})
