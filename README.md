# 🏠 bina.az Rental Notifier

A Telegram bot that watches [bina.az](https://bina.az) for new-building rentals matching
your saved search, ranks them by **distance to Crescent Mall, Baku** (Haversine), and
pushes the nearest new/cheaper listings to Telegram. Runs on GitHub Actions every 3 hours
— **no server to maintain**.

> Built to replace the tedious manual loop of filtering the map and eyeballing which
> listings are closest, over and over.

---

## ✨ What it does

- Enumerates **every** matching listing via bina.az's GraphQL list API (not the map — see
  [Why not the map?](#-why-not-the-map-api)).
- Geocodes each listing to **exact coordinates** and computes distance to Crescent Mall.
- Stores state in **Neon Postgres**, so you're notified only about **new listings** or
  **price drops** — never the same home twice.
- Sends rich Telegram messages (price, rooms, area, floor, metro, distance, link).
- Beats Cloudflare bot protection with **curl_cffi** (browser TLS fingerprint) + a
  **residential proxy**.

---

## 🏗 Architecture

```mermaid
flowchart TD
    CRON["⏰ GitHub Actions<br/>cron every 3h"] --> MAIN["main.py<br/>orchestrator"]
    MAIN -->|"1 . load cached coords"| DB[("🐘 Neon Postgres<br/>listings + notified_price")]
    MAIN -->|"2 . scrape"| SCRAPER["scraper.py"]

    subgraph BINA["bina.az GraphQL  (via residential proxy + curl_cffi)"]
      LIST["items(filter, limit, offset)<br/>paginated → ALL listings"]
      ITEM["item(id).latitude/longitude<br/>exact coords (new items only)"]
    end

    SCRAPER --> LIST
    SCRAPER --> ITEM
    SCRAPER -->|"listings + distance"| MAIN

    MAIN -->|"3 . classify (upsert + diff)"| DB
    MAIN -->|"4 . new / price-drop,<br/>nearest TOP_N"| NOTIFY["notify.py"]
    NOTIFY -->|"5 . send"| TG["📨 Telegram"]
    MAIN -->|"6 . mark only<br/>delivered ones"| DB
```

### Pipeline, step by step

```mermaid
sequenceDiagram
    autonumber
    participant M as main.py
    participant DB as Neon PG
    participant S as scraper.py
    participant B as bina.az
    participant T as Telegram

    M->>DB: get_known_coords()  (cached lat/lng)
    M->>S: fetch_all_listings(known_coords)
    S->>B: items(filter, limit:50, offset:0,50,…)  until empty
    B-->>S: ~480 listings (id, price, rooms, area, path…)
    S->>B: item(id).lat/lng  — only for NOT-yet-cached ids
    B-->>S: exact coordinates
    S-->>M: listings sorted by distance to Crescent Mall
    M->>DB: classify() → upsert all, return new + price-drops
    M->>M: sort by distance, take nearest TOP_N
    M->>T: send each (rich message)
    T-->>M: delivered / failed per message
    M->>DB: mark_notified(delivered only)
```

### Notification decision logic

```mermaid
flowchart TD
    A[listing seen this run] --> B{notified_price<br/>in DB?}
    B -->|NULL / never notified| C[🆕 candidate: NEW]
    B -->|has a value| D{current price &lt;<br/>notified_price?}
    D -->|yes| E[💸 candidate: PRICE DROP]
    D -->|no| F[skip - already seen]
    C --> G{within nearest<br/>TOP_N?}
    E --> G
    G -->|yes| H[send to Telegram]
    G -->|no| I[suppress - stays NULL,<br/>resurfaces next run]
    H --> J{delivered ok?}
    J -->|yes| K[mark_notified]
    J -->|no| L[leave eligible,<br/>retry next run]
```

The key invariant: **`notified_price` is written only after a message is actually
delivered.** So nothing is ever marked-but-unsent — listings suppressed by the `TOP_N`
cap or lost to a Telegram error automatically resurface on the next run.

---

## 🧰 Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **Python 3.12** | concise async + great libraries |
| HTTP | **curl_cffi** (`impersonate="chrome"`) | spoofs TLS/JA3 so Cloudflare sees a real browser |
| Concurrency | **asyncio** | parallel pagination + coord lookups |
| Data source | **bina.az GraphQL** (inline queries, no persisted hash) | survives frontend redeploys |
| State | **Neon Postgres** (serverless) | free, persists between ephemeral cron runs; caches coords |
| DB driver | **psycopg 3** | modern, simple |
| Delivery | **Telegram Bot API** | free, instant, mobile push |
| Scheduler | **GitHub Actions** cron | no server, free for this volume |
| Anti-block | **residential proxy** (DataImpulse) | GH Actions IPs are Cloudflare-blocked; residential AZ IP isn't |

---

## 📁 Files

| File | Responsibility |
|------|----------------|
| **`config.py`** | All settings: the search `FILTER` (mirrors your bina.az URL), Crescent Mall `TARGET_LAT/LNG`, `TOP_N`, concurrency, and secrets pulled from env. |
| **`scraper.py`** | The data layer. Paginates `items(filter, limit, offset)` to enumerate every listing, resolves exact coords via `item(id)` (only for new ids), computes Haversine distance, returns listings sorted nearest-first. Inline GraphQL (hash-free), retry/backoff, proxy + chrome impersonation. |
| **`db.py`** | Neon state. `init()` creates the schema; `get_known_coords()` returns cached coordinates; `classify()` upserts all listings and returns the new/price-drop candidates; `mark_notified()` records the notified price **only for delivered** items. |
| **`notify.py`** | Telegram delivery. Formats a rich HTML message per listing; sends each with 429/`retry_after` handling and gentle pacing; returns only the messages that actually went through. |
| **`main.py`** | Orchestrator. Validates env, loads cached coords, scrapes (under an internal timeout), classifies, caps to nearest `TOP_N`, sends, and marks only delivered. Alerts to Telegram on hard failure. |
| **`.github/workflows/cron.yml`** | Runs the bot every 3h (and on manual dispatch); installs deps; injects secrets. |
| **`.env.example`** | Template for local secrets. |

---

## 🗺 Why not the map API?

The obvious approach is bina.az's map endpoint (`MapMarkers`). It returns **clusters** when
zoomed out and individual pins when zoomed in — so you recursively subdivide until pins
appear. **But bina.az assigns every unit in a building the same coordinates.** A building
with 15 listings is one cluster of 15 that *never* splits no matter how far you zoom —
those 15 listings are unreachable via the map. In testing, the map approach **silently
dropped ~585 listings** (it found 357 of ~480).

The list API (`items(filter, limit, offset)`) has no such limit: it returns every listing,
and `item(id).latitude/longitude` gives exact per-listing coordinates. Hence the current
design.

---

## 🚀 Setup

### 1. Telegram
- Create a bot via [@BotFather](https://t.me/BotFather) → token.
- Message your bot, then read your chat id from
  `https://api.telegram.org/bot<TOKEN>/getUpdates`.

### 2. Neon
- Create a free project at [neon.tech](https://neon.tech), copy the connection string.
- The schema is created automatically on first run.

### 3. Residential proxy
GitHub Actions egress IPs are routinely Cloudflare-blocked. Use a **residential** proxy
(e.g. DataImpulse / Webshare / IPRoyal — *not* datacenter). Volume is tiny (a few MB/run).
Format: `http://USER:PASS@host:port`.

### 4. Secrets
**Local:** copy `.env.example` → `.env` and fill in.
**GitHub:** Settings → Secrets and variables → Actions → add
`DATABASE_URL`, `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `PROXY_URL`.

### 5. Run
```bash
pip install -r requirements.txt
set -a; source .env; set +a
python3 main.py        # full pipeline
python3 scraper.py     # just print nearest listings (no DB/Telegram)
```

---

## ⚙️ Tuning

Non-secret knobs are plain constants in **`config.py`** — edit them there:

| Constant | Default | Meaning |
|----------|---------|---------|
| `MAX_RADIUS_KM` | `1.0` | Only notify about listings within this many km of Crescent Mall |
| `TOP_N` | `10` | Max listings to notify per run (extras resurface next run, not lost) |
| `MAX_CONCURRENCY` | `8` | Parallel GraphQL requests (higher = faster, more block risk) |
| `MAX_RETRIES` | `8` | Per-request retries (covers rotating-proxy 403s) |

Only **secrets** come from the environment / GH Actions secrets:
`DATABASE_URL`, `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `PROXY_URL`.

## 🔧 Changing the search
Edit `FILTER` and `TARGET_LAT/LNG` in `config.py`. `FILTER` mirrors the query params of your
bina.az saved-search URL (`locationIds`, `roomIds`, price range, `hasRepair`, …).

## 📝 Notes
- First run geocodes all listings (~90s) and caches coords in Neon; later runs only geocode
  *new* listings, so they're much faster.
- On bina.az, `leased`/`isLeased` flags a *rental* listing (true for all rentals), **not** an
  already-taken one.
- All GraphQL is sent inline (no persisted-query hash), so bina.az frontend redeploys won't
  break it.
