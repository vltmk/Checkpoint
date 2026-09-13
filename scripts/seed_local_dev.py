#!/usr/bin/env python3
"""
seed_local_dev.py - Checkpoint Local Dev Seeding Tool
Generates a rich, realistic tutorial/guide dataset and seeds both:
1. The local Tauri SQLite database (%APPDATA%\\com.checkpoint.app\\checkpoint.db)
2. A standalone JSON restore file (checkpoint_tutorial_seed.json)
"""

import os
import sys
import json
import sqlite3
import shutil
import zlib
import struct
import base64
from datetime import datetime

# Path resolution
DB_DIR = os.path.expandvars(r'%APPDATA%\com.checkpoint.app')
DB_PATH = os.path.join(DB_DIR, 'checkpoint.db')
REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
JSON_OUT_PATH = os.path.join(REPO_DIR, 'checkpoint_tutorial_seed.json')

def create_png_proof(width, height, main_color, accent_color, pattern_mode=0):
    """Generates a clean, crisp, dark-mode stylized PNG screenshot proof."""
    r, g, b = main_color
    ar, ag, ab = accent_color
    
    raw_rows = []
    for y in range(height):
        row = bytearray([0])  # PNG Filter 0 (None)
        for x in range(width):
            # Outer border
            if x < 2 or x >= width - 2 or y < 2 or y >= height - 2:
                row.extend([40, 40, 45])
            # Top banner / header
            elif y < 28:
                row.extend([28, 28, 33])
            # Accent divider line below header
            elif y == 28 or y == 29:
                row.extend([ar, ag, ab])
            # Content area with subtle grid/status pattern
            elif pattern_mode == 0 and ((x // 24 + y // 24) % 2 == 0):
                row.extend([min(255, r + 6), min(255, g + 6), min(255, b + 6)])
            elif pattern_mode == 1 and (y % 16 < 2):
                row.extend([min(255, r + 10), min(255, g + 10), min(255, b + 10)])
            elif pattern_mode == 2 and (x % 32 < 2):
                row.extend([min(255, r + 8), min(255, g + 8), min(255, b + 8)])
            else:
                row.extend([r, g, b])
        raw_rows.append(bytes(row))
        
    raw_data = b''.join(raw_rows)
    compressed = zlib.compress(raw_data, level=9)
    
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
        
    png_bytes = b'\x89PNG\r\n\x1a\n'
    png_bytes += chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    png_bytes += chunk(b'IDAT', compressed)
    png_bytes += chunk(b'IEND', b'')
    
    return 'data:image/png;base64,' + base64.b64encode(png_bytes).decode('ascii')

def build_seed_data():
    proof_emerald = create_png_proof(420, 260, (18, 24, 20), (52, 211, 153), pattern_mode=0)
    proof_violet = create_png_proof(420, 260, (24, 18, 30), (167, 139, 250), pattern_mode=1)
    proof_gold = create_png_proof(420, 260, (28, 24, 16), (251, 191, 36), pattern_mode=0)
    proof_blue = create_png_proof(420, 260, (18, 22, 32), (96, 165, 250), pattern_mode=2)
    proof_crimson = create_png_proof(420, 260, (30, 18, 20), (244, 63, 94), pattern_mode=1)
    proof_amber = create_png_proof(420, 260, (28, 20, 16), (251, 146, 60), pattern_mode=0)

    entries = [
        {
            "id": "job_seed_01",
            "title": "Keystone Hero: Grim Batol +10 (Timed 2-Chest)",
            "game": "World of Warcraft",
            "source": "G2G",
            "teamMode": True,
            "teammates": ["Vaelin", "Khadgar", "Illidan"],
            "income": 2400000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-09-06T20:15",
            "hours": 0.75,
            "notes": "Buyer was Havoc DH, DPS was great. 2-chest timer at 26:14. Split 4 ways evenly.",
            "link": "https://discord.com/channels/109283746501928374/boost-orders",
            "proofs": [
                {
                    "id": "proof_seed_01",
                    "name": "grim_batol_timer_2chest.png",
                    "data": proof_emerald,
                    "size": len(proof_emerald),
                    "createdAt": "2026-09-06T20:45:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_02",
            "title": "Nerub-ar Palace Heroic Full Clear (7/8 + Ansurek)",
            "game": "World of Warcraft",
            "source": "Guild Run",
            "teamMode": True,
            "teammates": ["Sylvanas", "Thrall", "Anduin", "Jaina"],
            "income": 12500000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-09-05T23:30",
            "hours": 2.5,
            "notes": "Loot funnel run for 2 VIP buyers. Cut distributed via guild bank.",
            "link": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "proofs": [
                {
                    "id": "proof_seed_02",
                    "name": "queen_ansurek_hc_kill.png",
                    "data": proof_violet,
                    "size": len(proof_violet),
                    "createdAt": "2026-09-06T02:00:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_03",
            "title": "Ara-Kara, City of Echoes +11 In-Time",
            "game": "World of Warcraft",
            "source": "Discord Direct",
            "teamMode": False,
            "teammates": [],
            "income": 750000.0,
            "currency": "GOLD",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-09-05T16:20",
            "hours": 0.5,
            "notes": "Solo tank booster spot in carry group. Gold traded on Tarren Mill EU.",
            "link": "https://discord.gg/nodra-carries",
            "proofs": [
                {
                    "id": "proof_seed_03",
                    "name": "gold_trade_tarren_mill.png",
                    "data": proof_gold,
                    "size": len(proof_gold),
                    "createdAt": "2026-09-05T16:55:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_04",
            "title": "The Dawnbreaker +10 Key Upgrade",
            "game": "World of Warcraft",
            "source": "FunPay",
            "teamMode": True,
            "teammates": ["Vaelin"],
            "income": 1800000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Working",
            "dateTime": "2026-09-07T00:30",
            "hours": 0.5,
            "notes": "Currently in dungeon. 2nd boss down, on schedule.",
            "link": "https://funpay.com/orders/8920147",
            "proofs": []
        },
        {
            "id": "job_seed_05",
            "title": "Molten Core 10/10 GDKP Pot Share",
            "game": "World of Warcraft Classic",
            "source": "Discord Direct",
            "teamMode": False,
            "teammates": [],
            "income": 14200.0,
            "currency": "GOLD",
            "exchangeRate": 7000.0,
            "rateUnit": "1",
            "status": "Paid",
            "dateTime": "2026-09-04T22:00",
            "hours": 2.0,
            "notes": "Classic Anniversary Era. Binding dropped and went for 85k. Payout was 14,200g.",
            "link": "https://discord.com/channels/987654321098765432/classic-gdkp",
            "proofs": [
                {
                    "id": "proof_seed_05",
                    "name": "gdkp_payout_ledger.png",
                    "data": proof_gold,
                    "size": len(proof_gold),
                    "createdAt": "2026-09-05T00:15:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_06",
            "title": "Arena 2v2 Rating 0-1800 Push",
            "game": "World of Warcraft",
            "source": "Eldorado",
            "teamMode": False,
            "teammates": [],
            "income": 3200000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Pending",
            "dateTime": "2026-09-06T18:00",
            "hours": 3.0,
            "notes": "Piloted Holy Paladin. Completed 1805 rating. Waiting for client release on platform.",
            "link": "https://eldorado.gg/orders/ELD-90234",
            "proofs": [
                {
                    "id": "proof_seed_06",
                    "name": "arena_1805_rating.png",
                    "data": proof_blue,
                    "size": len(proof_blue),
                    "createdAt": "2026-09-06T21:10:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_07",
            "title": "Torghast / Delves Tier 8 Full Run x4",
            "game": "World of Warcraft",
            "source": "Personal Client",
            "teamMode": False,
            "teammates": [],
            "income": 1200000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-09-03T14:15",
            "hours": 1.0,
            "notes": "Fast delve clears with Brann level 40. Smooth run.",
            "link": "https://t.me/booster_direct",
            "proofs": []
        },
        {
            "id": "job_seed_08",
            "title": "Siege of Boralus +12 Depleted Key (Overtime)",
            "game": "World of Warcraft",
            "source": "G2G",
            "teamMode": True,
            "teammates": ["Vaelin", "Illidan"],
            "income": 1500000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Failed",
            "dateTime": "2026-09-02T19:45",
            "hours": 1.2,
            "notes": "Client DCed 3 times on last boss. Failed timer by 8 minutes. Refund requested.",
            "link": "https://g2g.com/order/G2G-88192",
            "proofs": []
        },
        {
            "id": "job_seed_09",
            "title": "Mythic Queen Ansurek Mount Only",
            "game": "World of Warcraft",
            "source": "Personal Client",
            "teamMode": True,
            "teammates": ["Khadgar", "Sylvanas"],
            "income": 8500000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "On Hold",
            "dateTime": "2026-09-01T21:00",
            "hours": 1.5,
            "notes": "Client rescheduled to Sunday raid lockout reset.",
            "link": "https://discord.com/channels/109283746501928374/vip-clients",
            "proofs": []
        },
        {
            "id": "job_seed_10",
            "title": "Blackwing Lair 8/8 Fast Clear",
            "game": "World of Warcraft Classic",
            "source": "Guild Run",
            "teamMode": False,
            "teammates": [],
            "income": 9800.0,
            "currency": "GOLD",
            "exchangeRate": 7000.0,
            "rateUnit": "1",
            "status": "Paid",
            "dateTime": "2026-08-30T21:30",
            "hours": 1.8,
            "notes": "Nefarian down in 1 pull. Elementium ore auctioned.",
            "link": "https://discord.gg/classic-raiders",
            "proofs": [
                {
                    "id": "proof_seed_10",
                    "name": "bwl_nefarian_down.png",
                    "data": proof_gold,
                    "size": len(proof_gold),
                    "createdAt": "2026-08-30T23:20:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_11",
            "title": "Torment IV Pit 100 Speedruns (x10)",
            "game": "Diablo IV",
            "source": "Discord Direct",
            "teamMode": False,
            "teammates": [],
            "income": 2800000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-08-28T17:00",
            "hours": 1.5,
            "notes": "Spiritborn speedfarm carry. Fast glyph leveling for client.",
            "link": "https://discord.com/channels/109283746501928374/d4-services",
            "proofs": [
                {
                    "id": "proof_seed_11",
                    "name": "pit100_speedrun.png",
                    "data": proof_crimson,
                    "size": len(proof_crimson),
                    "createdAt": "2026-08-28T18:35:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_12",
            "title": "Radiant Duo Queue Placement (5 Wins)",
            "game": "Valorant",
            "source": "G2G",
            "teamMode": True,
            "teammates": ["Anduin"],
            "income": 3500000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-08-26T15:30",
            "hours": 2.0,
            "notes": "5/5 MVP placements on EU servers.",
            "link": "https://g2g.com/order/VAL-44102",
            "proofs": [
                {
                    "id": "proof_seed_12",
                    "name": "radiant_5wins_mvp.png",
                    "data": proof_amber,
                    "size": len(proof_amber),
                    "createdAt": "2026-08-26T17:40:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_13",
            "title": "Mythic+ 8x M+10 Weekly Vault Pack",
            "game": "World of Warcraft",
            "source": "FunPay",
            "teamMode": True,
            "teammates": ["Vaelin", "Khadgar", "Illidan"],
            "income": 5200000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-08-24T18:00",
            "hours": 3.5,
            "notes": "Full vault unlock. Grim Batol, Stonevault, Mists, Necrotic Wake x2, Siege, Dawnbreaker, Ara-Kara.",
            "link": "https://funpay.com/orders/9102456",
            "proofs": [
                {
                    "id": "proof_seed_13",
                    "name": "weekly_vault_8keys.png",
                    "data": proof_emerald,
                    "size": len(proof_emerald),
                    "createdAt": "2026-08-24T21:45:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_14",
            "title": "Tier 17 Map Farming & Boss Carries (Maven/Uber Elder)",
            "game": "Path of Exile",
            "source": "Discord Direct",
            "teamMode": False,
            "teammates": [],
            "income": 1900000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-08-20T20:00",
            "hours": 1.2,
            "notes": "Settlers of Kalguur league. Uber fragments dropped.",
            "link": "https://t.me/poe_carries",
            "proofs": [
                {
                    "id": "proof_seed_14",
                    "name": "uber_elder_down.png",
                    "data": proof_violet,
                    "size": len(proof_violet),
                    "createdAt": "2026-08-20T21:20:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_15",
            "title": "Solo Shuffle 2400 Elite Title Coaching & Push",
            "game": "World of Warcraft",
            "source": "Personal Client",
            "teamMode": False,
            "teammates": [],
            "income": 6000000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-08-15T19:00",
            "hours": 4.0,
            "notes": "4 hours screen-share coaching and live play analysis. Client hit 2412 rating.",
            "link": "https://discord.com/channels/109283746501928374/coaching",
            "proofs": [
                {
                    "id": "proof_seed_15",
                    "name": "elite_solo_shuffle_2412.png",
                    "data": proof_blue,
                    "size": len(proof_blue),
                    "createdAt": "2026-08-15T23:15:00.000Z"
                }
            ]
        },
        {
            "id": "job_seed_16",
            "title": "Mists of Tirna Scithe +11 In-Time",
            "game": "World of Warcraft",
            "source": "Discord Direct",
            "teamMode": True,
            "teammates": ["Vaelin", "Khadgar"],
            "income": 1950000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-08-08T18:45",
            "hours": 0.6,
            "notes": "Clean maze shortcut. Mistcaller 1-phase.",
            "link": "https://discord.gg/nodra-carries",
            "proofs": []
        },
        {
            "id": "job_seed_17",
            "title": "The Stonevault +10 In-Time Push",
            "game": "World of Warcraft",
            "source": "G2G",
            "teamMode": True,
            "teammates": ["Khadgar", "Illidan"],
            "income": 1800000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-07-28T21:00",
            "hours": 0.7,
            "notes": "Master Machinists handled cleanly. Client got trinket drop.",
            "link": "https://g2g.com/order/G2G-81092",
            "proofs": []
        },
        {
            "id": "job_seed_18",
            "title": "City of Threads +12 Failed Timer",
            "game": "World of Warcraft",
            "source": "FunPay",
            "teamMode": True,
            "teammates": ["Vaelin"],
            "income": 1600000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Failed",
            "dateTime": "2026-07-15T22:30",
            "hours": 1.0,
            "notes": "Wipe on Fang and Eye. Disbanded after timer expired.",
            "link": "https://funpay.com/orders/8654210",
            "proofs": []
        },
        {
            "id": "job_seed_19",
            "title": "Naxxramas 15/15 GDKP Payout",
            "game": "World of Warcraft Classic",
            "source": "Guild Run",
            "teamMode": False,
            "teammates": [],
            "income": 22500.0,
            "currency": "GOLD",
            "exchangeRate": 7000.0,
            "rateUnit": "1",
            "status": "Paid",
            "dateTime": "2026-06-25T20:00",
            "hours": 3.0,
            "notes": "Kel'Thuzad down. Gressil and MoM auctioned. Big pot split.",
            "link": "https://discord.gg/classic-raiders",
            "proofs": []
        },
        {
            "id": "job_seed_20",
            "title": "Tormented Duriel 50x Boss Rotations",
            "game": "Diablo IV",
            "source": "Discord Direct",
            "teamMode": True,
            "teammates": ["Thrall"],
            "income": 4500000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-05-18T19:30",
            "hours": 2.5,
            "notes": "Uber unique farm service. Client got Harlequin Crest.",
            "link": "https://discord.com/channels/109283746501928374/d4-services",
            "proofs": []
        },
        {
            "id": "job_seed_21",
            "title": "Awakened Vault of the Incarnates Mythic Run",
            "game": "World of Warcraft",
            "source": "Guild Run",
            "teamMode": True,
            "teammates": ["Sylvanas", "Khadgar", "Jaina"],
            "income": 8000000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-04-12T20:00",
            "hours": 2.5,
            "notes": "Dragonflight S4 Awakened carry. Full clear.",
            "link": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
            "proofs": []
        },
        {
            "id": "job_seed_22",
            "title": "Arena Glad Boost 3v3 (2100-2400)",
            "game": "World of Warcraft",
            "source": "Personal Client",
            "teamMode": True,
            "teammates": ["Illidan"],
            "income": 9500000.0,
            "currency": "TOMAN",
            "exchangeRate": 3200.0,
            "rateUnit": "1k",
            "status": "Paid",
            "dateTime": "2026-03-22T21:00",
            "hours": 4.5,
            "notes": "RMP composition. High MMR lobby winstreak.",
            "link": "https://discord.com/channels/109283746501928374/pvp-elite",
            "proofs": []
        }
    ]

    categories = [
        {"id": "cat_wow_retail", "name": "World of Warcraft", "color": "#C68A4C", "icon": None, "isDefault": True},
        {"id": "cat_wow_classic", "name": "World of Warcraft Classic", "color": "#C68A4C", "icon": None, "isDefault": True}
    ]

    saved_teammates = ["Vaelin", "Khadgar", "Illidan", "Sylvanas", "Thrall", "Anduin", "Jaina"]
    saved_sources = ["G2G", "FunPay", "Discord Direct", "Guild Run", "Eldorado", "Personal Client", "Battle.net"]

    backup_payload = {
        "app": "CHECKPOINT",
        "version": "3.0.0",
        "exportDate": datetime.now().isoformat(),
        "currency": "TOMAN",
        "goldRateTOMAN": 3200,
        "categories": categories,
        "preferences": {
            "savedSources": saved_sources,
            "savedTeammates": saved_teammates,
            "categories": categories
        },
        "entriesCount": len(entries),
        "entries": entries
    }

    return backup_payload

def seed_sqlite(payload):
    if not os.path.exists(DB_PATH):
        os.makedirs(DB_DIR, exist_ok=True)
        print(f"Database directory initialized: {DB_DIR}")
    else:
        # Create timestamped safety backup
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        bak_path = f"{DB_PATH}.pre_seed_{ts}.bak"
        shutil.copy2(DB_PATH, bak_path)
        print(f"Safety backup created at: {bak_path}")

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Ensure tables exist
    c.execute("PRAGMA journal_mode = WAL;")
    c.execute("PRAGMA synchronous = NORMAL;")
    c.execute("PRAGMA foreign_keys = ON;")

    c.execute("""
      CREATE TABLE IF NOT EXISTS work_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        game TEXT NOT NULL,
        source TEXT DEFAULT 'Direct Client',
        teamMode INTEGER DEFAULT 0,
        teammates TEXT DEFAULT '[]',
        income REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'TOMAN',
        exchangeRate REAL DEFAULT 3200,
        rateUnit TEXT DEFAULT '1k',
        status TEXT NOT NULL DEFAULT 'Working',
        dateTime TEXT NOT NULL,
        hours REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        link TEXT DEFAULT '',
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    """)

    c.execute("""
      CREATE TABLE IF NOT EXISTS proof_attachments (
        id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        name TEXT NOT NULL,
        data_blob TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (entry_id) REFERENCES work_entries(id) ON DELETE CASCADE
      );
    """)

    c.execute("""
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    """)

    # Count existing entries before insert
    pre_count = c.execute("SELECT COUNT(*) FROM work_entries").fetchone()[0]
    print(f"Current entries before seeding: {pre_count}")

    now_sec = int(datetime.now().timestamp())
    entries = payload['entries']
    inserted_entries = 0
    inserted_proofs = 0

    for entry in entries:
        team_mode_int = 1 if entry.get('teamMode') else 0
        teammates_str = json.dumps(entry.get('teammates') or [])

        c.execute("""
            INSERT OR REPLACE INTO work_entries (
                id, title, game, source, teamMode, teammates, income, currency,
                exchangeRate, rateUnit, status, dateTime, hours, notes, link, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            entry['id'],
            entry['title'],
            entry['game'],
            entry.get('source', 'Direct Client'),
            team_mode_int,
            teammates_str,
            float(entry.get('income', 0)),
            entry.get('currency', 'TOMAN'),
            float(entry.get('exchangeRate', 3200)),
            entry.get('rateUnit', '1k'),
            entry.get('status', 'Paid'),
            entry.get('dateTime'),
            float(entry.get('hours', 0)),
            entry.get('notes', ''),
            entry.get('link', ''),
            now_sec
        ))
        inserted_entries += 1

        # Proof attachments
        proofs = entry.get('proofs') or []
        c.execute("DELETE FROM proof_attachments WHERE entry_id = ?", (entry['id'],))
        for p in proofs:
            c.execute("""
                INSERT INTO proof_attachments (id, entry_id, name, data_blob, size, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                p.get('id', f"proof_{now_sec}"),
                entry['id'],
                p.get('name', 'proof.png'),
                p.get('data', ''),
                int(p.get('size', 0)),
                p.get('createdAt', datetime.now().isoformat())
            ))
            inserted_proofs += 1

    # Update app settings
    c.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now'))",
              ('checkpoint_custom_categories_v1', json.dumps(payload['categories'])))
    c.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now'))",
              ('checkpoint_saved_teammates_v1', json.dumps(payload['preferences']['savedTeammates'])))
    c.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now'))",
              ('checkpoint_user_saved_sources_v2', json.dumps(payload['preferences']['savedSources'])))
    c.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now'))",
              ('checkpoint_gold_rate_toman', '3200'))
    c.execute("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, strftime('%s', 'now'))",
              ('checkpoint_currency', 'TOMAN'))

    conn.commit()
    c.execute("PRAGMA wal_checkpoint(FULL);")

    post_count = c.execute("SELECT COUNT(*) FROM work_entries").fetchone()[0]
    proof_count = c.execute("SELECT COUNT(*) FROM proof_attachments").fetchone()[0]
    conn.close()

    print(f"Seeded {inserted_entries} entries and {inserted_proofs} screenshot proofs.")
    print(f"Total work_entries in SQLite: {post_count}")
    print(f"Total proof_attachments in SQLite: {proof_count}")

def main():
    print("Generating Checkpoint tutorial seed dataset...")
    payload = build_seed_data()

    # 1. Write standalone JSON restore file
    with open(JSON_OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"Saved standalone restore file: {JSON_OUT_PATH}")

    # 2. Seed the local SQLite database
    seed_sqlite(payload)
    print("Seeding completed successfully!")

if __name__ == '__main__':
    main()
