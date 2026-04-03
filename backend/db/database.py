"""
AETHER ACM — SQLite Database & Event Logger
"""
import sqlite3
import os
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any

logger = logging.getLogger("aether.db")

DB_PATH = os.environ.get("DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "aether_events.db"))


def get_connection():
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS maneuver_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL, satellite_id TEXT NOT NULL,
            burn_type TEXT NOT NULL, dv_magnitude_ms REAL NOT NULL,
            fuel_before_kg REAL NOT NULL, fuel_after_kg REAL NOT NULL,
            reason TEXT
        );
        CREATE TABLE IF NOT EXISTS cdm_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cdm_id TEXT NOT NULL, timestamp TEXT NOT NULL,
            satellite_id TEXT NOT NULL, debris_id TEXT NOT NULL,
            miss_distance_km REAL NOT NULL, risk_level TEXT NOT NULL,
            tca_seconds REAL NOT NULL, action_taken TEXT DEFAULT 'NONE'
        );
        CREATE TABLE IF NOT EXISTS collision_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL, satellite_id TEXT NOT NULL,
            debris_id TEXT NOT NULL, miss_distance_km REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS system_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL, event_type TEXT NOT NULL,
            description TEXT
        );
    """)
    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")


class EventLogger:
    def log_maneuver(self, sim_time, satellite_id, burn_type, dv_ms,
                     fuel_before, fuel_after, reason=""):
        try:
            conn = get_connection()
            conn.execute("""
                INSERT INTO maneuver_events
                (timestamp, satellite_id, burn_type, dv_magnitude_ms,
                 fuel_before_kg, fuel_after_kg, reason)
                VALUES (?,?,?,?,?,?,?)
            """, (datetime.now(timezone.utc).isoformat(),
                  satellite_id, burn_type, dv_ms, fuel_before, fuel_after, reason))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to log maneuver: {e}")

    def log_cdm(self, sim_time, satellite_id, debris_id, miss_km, tca_s, risk):
        try:
            conn = get_connection()
            conn.execute("""
                INSERT INTO cdm_events
                (cdm_id, timestamp, satellite_id, debris_id,
                 miss_distance_km, risk_level, tca_seconds)
                VALUES (?,?,?,?,?,?,?)
            """, (f"CDM-{satellite_id}-{int(sim_time)}",
                  datetime.now(timezone.utc).isoformat(),
                  satellite_id, debris_id, miss_km, risk, tca_s))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to log CDM: {e}")

    def log_collision(self, sim_time, satellite_id, debris_id, miss_dist):
        try:
            conn = get_connection()
            conn.execute("""
                INSERT INTO collision_events
                (timestamp, satellite_id, debris_id, miss_distance_km)
                VALUES (?,?,?,?)
            """, (datetime.now(timezone.utc).isoformat(),
                  satellite_id, debris_id, miss_dist))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to log collision: {e}")

    def log_system_event(self, sim_time, event_type, description):
        try:
            conn = get_connection()
            conn.execute("""
                INSERT INTO system_events (timestamp, event_type, description)
                VALUES (?,?,?)
            """, (datetime.now(timezone.utc).isoformat(), event_type, description))
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Failed to log system event: {e}")

    def get_stats(self):
        try:
            conn = get_connection()
            maneuvers = conn.execute("SELECT COUNT(*) FROM maneuver_events").fetchone()[0]
            cdms = conn.execute("SELECT COUNT(*) FROM cdm_events").fetchone()[0]
            collisions = conn.execute("SELECT COUNT(*) FROM collision_events").fetchone()[0]
            conn.close()
            return {"maneuvers": maneuvers, "cdms": cdms, "collisions": collisions}
        except Exception:
            return {"maneuvers": 0, "cdms": 0, "collisions": 0}

    def get_maneuver_log(self, limit=50):
        try:
            conn = get_connection()
            rows = conn.execute(
                "SELECT * FROM maneuver_events ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception:
            return []


event_logger = EventLogger()
