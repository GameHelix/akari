"""Neon Postgres state: track seen listings + price so we only notify on changes."""
import psycopg

import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS listings (
    item_id      TEXT PRIMARY KEY,
    price        INTEGER,
    lat          DOUBLE PRECISION,
    lng          DOUBLE PRECISION,
    distance_km  DOUBLE PRECISION,
    url          TEXT,
    first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
    notified_price INTEGER,
    notified_at  TIMESTAMPTZ
);
"""

# Migrations for DBs created before notified_at existed: add the column and
# backfill it for rows that were already notified (notified_price recorded).
MIGRATE = """
ALTER TABLE listings ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
UPDATE listings SET notified_at = now()
 WHERE notified_at IS NULL AND notified_price IS NOT NULL;
"""


def _conn():
    return psycopg.connect(config.DATABASE_URL, autocommit=True)


def init():
    with _conn() as c:
        c.execute(SCHEMA)
        c.execute(MIGRATE)


def get_known_coords() -> dict:
    """Return {item_id: (lat, lng)} for already-geocoded listings, so the scraper
    only hits the item() detail endpoint for new listings."""
    with _conn() as c:
        rows = c.execute(
            "SELECT item_id, lat, lng FROM listings "
            "WHERE lat IS NOT NULL AND lng IS NOT NULL"
        ).fetchall()
    return {r[0]: (r[1], r[2]) for r in rows}


def classify(listings: list[dict]) -> list[dict]:
    """Upsert all listings; return those still OWED a notification.

    A listing is a candidate if it has never been notified (notified_at IS NULL —
    covers brand-new rows AND rows suppressed by a previous TOP_N cap) or if its
    price dropped below the last notified price.

    "Notified" is tracked by notified_at (a timestamp), NOT by notified_price:
    a listing with no price (price=None) must still count as notified once sent,
    otherwise it would be re-sent as "new" on every run forever.

    This function ONLY upserts state. It does NOT mark notified — that happens in
    mark_notified(), after a Telegram message is actually delivered, so nothing is
    ever marked-but-unsent (and thus lost).
    """
    to_notify = []
    with _conn() as c:
        for it in listings:
            row = c.execute(
                "SELECT notified_at, notified_price FROM listings WHERE item_id = %s",
                (it["item_id"],),
            ).fetchone()

            notified_at = row[0] if row else None
            notified_price = row[1] if row else None
            never_notified = notified_at is None
            price_drop = (
                not never_notified
                and it["price"] is not None
                and notified_price is not None
                and it["price"] < notified_price
            )

            c.execute(
                """
                INSERT INTO listings (item_id, price, lat, lng, distance_km, url)
                VALUES (%(item_id)s, %(price)s, %(lat)s, %(lng)s, %(distance_km)s, %(url)s)
                ON CONFLICT (item_id) DO UPDATE SET
                    price = EXCLUDED.price,
                    lat = EXCLUDED.lat,
                    lng = EXCLUDED.lng,
                    distance_km = EXCLUDED.distance_km,
                    url = EXCLUDED.url,
                    last_seen = now()
                """,
                it,
            )

            if never_notified or price_drop:
                it["reason"] = "new" if never_notified else "price_drop"
                it["old_price"] = None if never_notified else notified_price
                to_notify.append(it)
    return to_notify


def mark_notified(items: list[dict]) -> None:
    """Record delivery for items confirmed sent to Telegram.

    Sets notified_at (the source of truth for "already notified") and notified_price (for
    future price-drop detection; may be NULL for priceless listings). Called
    per-item right after each successful send so a crash leaves at most one item
    ambiguous, and each UPDATE is its own atomic autocommit statement.
    """
    if not items:
        return
    with _conn() as c:
        for it in items:
            c.execute(
                "UPDATE listings SET notified_price = %s, notified_at = now() "
                "WHERE item_id = %s",
                (it["price"], it["item_id"]),
            )
