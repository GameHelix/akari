"""Central configuration. Tunables are plain constants here; only real secrets
(DB URL, Telegram token/chat, proxy login) come from environment variables, since
this file is committed to the repo."""
import os

# --- bina.az search filter (mirrors your saved search URL) -------------------
# city=Baku, category=apartments-for-rent (new buildings), 1-3 rooms, 450-700 AZN, has repair.
FILTER = {
    "cityId": "1",
    "categoryId": "2",
    "hasRepair": True,
    "locationIds": ["38", "36", "8", "269", "318", "37"],
    "roomIds": ["1", "2", "3"],
    "priceFrom": 450,
    "priceTo": 700,
    "leased": True,
}

# --- reference point: Crescent Mall, Baku (Neftchilar Ave 66/68) -----------
# Verified via Yandex Maps (org 112889465026). Re-check the pin before changing.
TARGET_LAT = 40.373799
TARGET_LNG = 49.858708

GRAPHQL_URL = "https://bina.az/graphql"

# --- tunables (edit here; not secret) ---------------------------------------
# Only notify about listings within this many km of TARGET (Crescent Mall).
# Keeps notifications to genuinely walkable homes; raise to widen the net.
MAX_RADIUS_KM = 2.0
TOP_N = 10            # max listings to notify per run
MAX_CONCURRENCY = 8   # parallel GraphQL requests
# Rotating residential proxies hand out a Cloudflare-flagged exit IP a sizable
# fraction of the time (measured ~30%, and bursts higher during CF flag waves).
# A 403 is not a real error — opening a fresh session rotates to a new IP, which
# isn't rate-limited, so we retry these many times with near-zero backoff. At a
# 30% flag rate, 40 rotations make a full abort (0.3**40) astronomically unlikely.
MAX_IP_ROTATIONS = 40
# Genuine failures (HTTP 5xx, timeouts, bad JSON, GraphQL errors) get a smaller
# budget with real backoff, since those can indicate server-side rate limiting.
MAX_RETRIES = 8

# --- secrets (from environment / GH Actions secrets) ------------------------
# GH Actions egress IPs are often Cloudflare-blocked, so PROXY_URL points to a
# residential proxy (http://user:pass@host:port) and carries a login -> secret.
PROXY_URL = os.environ.get("PROXY_URL", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
