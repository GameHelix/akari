"""Entry point: scrape -> classify against DB -> notify new/price-dropped listings."""
import asyncio
import sys
import traceback

import config
import db
import notify
import scraper


def main() -> int:
    for var in ("DATABASE_URL", "TELEGRAM_TOKEN", "TELEGRAM_CHAT_ID"):
        if not getattr(config, var):
            print(f"Missing required env var: {var}", file=sys.stderr)
            return 2

    db.init()
    known_coords = db.get_known_coords()  # reuse cached coords; only geocode new listings

    try:
        # Internal deadline shorter than the GH Actions job wall, so a hang
        # surfaces as a catchable TimeoutError (and a Telegram alert) rather
        # than an uncatchable SIGKILL.
        listings = asyncio.run(
            asyncio.wait_for(scraper.fetch_all_listings(known_coords), timeout=600)
        )
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        try:
            notify.send_text(f"⚠️ bina.az scraper failed: {e}")
        except Exception:  # noqa: BLE001
            pass
        return 1

    # Note: on bina.az "isLeased" flags a rental listing (true for all rentals),
    # NOT an already-taken one, so we keep them all.
    print(f"Scraped {len(listings)} listings.")

    # Upsert ALL listings (caches coords + tracks state), but only ever notify
    # about those within MAX_RADIUS_KM of Crescent Mall — far-away listings are
    # not useful and were the source of notification floods.
    candidates = db.classify(listings)
    candidates = [c for c in candidates if c["distance_km"] <= config.MAX_RADIUS_KM]

    # Nearest first, cap to TOP_N so a flood of new listings doesn't spam you.
    # Suppressed items keep notified_price NULL, so they resurface next run.
    candidates.sort(key=lambda x: x["distance_km"])
    suppressed = len(candidates) - config.TOP_N
    to_notify = candidates[: config.TOP_N]
    if suppressed > 0:
        print(f"{suppressed} additional within-radius match(es) suppressed by TOP_N cap.")

    # Mark each listing the instant it's delivered (not in a batch afterwards),
    # so a crash between sending and marking can re-send at most one listing.
    sent = notify.send(to_notify, on_sent=lambda it: db.mark_notified([it]))
    print(f"Notified {len(sent)}/{len(to_notify)} listing(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
