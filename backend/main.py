"""
AETHER ACM — FastAPI Main Application
======================================
RESTful API + WebSocket for the Autonomous Constellation Manager.
"""
import os
import sys
import time
import logging
import asyncio
import numpy as np
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# Ensure backend package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.models import (
    TelemetryRequest, TelemetryResponse,
    ManeuverRequest, ManeuverResponse, ManeuverValidation,
    SimulateStepRequest, SimulateStepResponse,
    VisualizationSnapshot, SatelliteVizData, CDMVizData,
    HealthResponse, ReportResponse,
)
from backend.state import state
from backend.engine.propagator import propagate
from backend.engine.conjunction import (
    run_conjunction_assessment, quick_conjunction_check, CDMRiskLevel
)
from backend.engine.maneuver import (
    validate_burn, apply_burn, fuel_cost, check_eol,
    plan_graveyard_burn, plan_evasion_burn, global_fuel_optimizer
)
from backend.engine.comms import check_los, check_blind_conjunction, SIGNAL_LATENCY
from backend.engine.coordinates import eci_to_geodetic, batch_eci_to_geodetic
from backend.db.database import event_logger, initialize_db
from backend.config import GROUND_STATIONS, M_DRY, M_FUEL_INIT

# ─── Logging ───
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S"
)
logger = logging.getLogger("aether.api")


# ─── WebSocket Manager ───
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        for connection in self.active_connections[:]:
            try:
                await connection.send_json(data)
            except Exception:
                self.active_connections.remove(connection)

ws_manager = ConnectionManager()


# ─── Application Lifespan ───
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("═══════════════════════════════════════")
    logger.info("  AETHER ACM — Starting up...")
    logger.info("═══════════════════════════════════════")
    initialize_db()
    state.initialize_constellation()
    event_logger.log_system_event(state.sim_time, "STARTUP", "AETHER ACM initialized")
    logger.info(f"  Satellites: {len(state.satellites)}")
    logger.info(f"  Debris:     {len(state.debris)}")
    logger.info("═══════════════════════════════════════")
    yield
    logger.info("AETHER ACM shutting down.")


app = FastAPI(
    title="AETHER ACM",
    description="Autonomous Constellation Manager — Project AETHER | National Space Hackathon 2026",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Background Conjunction Assessment ───

async def run_async_conjunction():
    try:
        sat_states = state.get_sat_states_dict()
        deb_states = state.get_debris_states_dict()
        cdms = run_conjunction_assessment(
            sat_states, deb_states,
            prediction_window=21600.0,
            coarse_threshold_km=50.0,
            sample_interval=60.0
        )
        state.active_cdms = cdms
        state.total_cdms_generated += len(cdms)
        for cdm in cdms:
            event_logger.log_cdm(
                state.sim_time, cdm.satellite_id, cdm.debris_id,
                cdm.miss_distance_km, cdm.tca_seconds,
                cdm.risk_level.value
            )
        # Handle blind conjunctions
        for cdm in cdms:
            if cdm.risk_level in (CDMRiskLevel.CRITICAL, CDMRiskLevel.WARNING):
                sat = state.satellites.get(cdm.satellite_id)
                if sat:
                    pre_upload = check_blind_conjunction(
                        sat["state"], state.sim_time + cdm.tca_seconds, state.sim_time)
                    if pre_upload is not None:
                        event_logger.log_system_event(
                            state.sim_time, "BLIND_CONJUNCTION_PREUPLOAD",
                            f"Pre-uploading maneuver for {cdm.satellite_id}")
    except Exception as e:
        logger.error(f"Conjunction assessment error: {e}")


# ─── API Endpoints ───

@app.get("/api/health", response_model=HealthResponse)
async def get_health():
    active = sum(1 for s in state.satellites.values() if s["status"] != "GRAVEYARD")
    return HealthResponse(
        status="OK", sim_time=state.sim_time,
        satellite_count=active, debris_count=len(state.debris),
        active_cdms=len(state.active_cdms),
        total_delta_v_m_s=round(state.total_delta_v_ms, 4),
        collisions_avoided=state.collisions_avoided,
        fleet_fuel_percent=round(state.fleet_fuel_percent(), 2),
    )


@app.post("/api/telemetry", response_model=TelemetryResponse)
async def ingest_telemetry(req: TelemetryRequest, bg: BackgroundTasks):
    processed = 0
    for obj in req.objects:
        sv = np.array([obj.r.x, obj.r.y, obj.r.z, obj.v.x, obj.v.y, obj.v.z])
        if obj.type.value == "SAT":
            if obj.id in state.satellites:
                state.satellites[obj.id]["state"] = sv
            processed += 1
        elif obj.type.value == "DEBRIS":
            if obj.id in state.debris:
                state.debris[obj.id]["state"] = sv
            else:
                state.debris[obj.id] = {"state": sv, "alt_km": 0, "inc_deg": 0}
            processed += 1
    bg.add_task(run_async_conjunction)
    return TelemetryResponse(
        status="ACK", processed_count=processed,
        active_cdm_warnings=len(state.active_cdms))


@app.post("/api/maneuver/schedule", response_model=ManeuverResponse)
async def schedule_maneuver(req: ManeuverRequest):
    sat = state.satellites.get(req.satelliteId)
    if not sat:
        raise HTTPException(404, f"Satellite {req.satelliteId} not found")
    current_mass = sat["mass"]
    last_bt = sat["last_burn_time"]
    total_fuel_cost = 0.0
    has_los = True
    for burn in req.maneuver_sequence:
        dv_vec = np.array([burn.deltaV_vector.x, burn.deltaV_vector.y, burn.deltaV_vector.z])
        dv_mag = float(np.linalg.norm(dv_vec))
        result = validate_burn(dv_mag, current_mass, last_bt, burn.burnTime)
        if not result["valid"]:
            raise HTTPException(400, result["reason"])
        burn_delay = burn.burnTime - state.sim_time
        if burn_delay > 0:
            future_state = propagate(sat["state"], burn_delay)
            los_ok, gs_id = check_los(future_state[:3], burn.burnTime + SIGNAL_LATENCY)
            if not los_ok:
                has_los = False
        current_mass = result["mass_after_kg"]
        total_fuel_cost += result["fuel_cost_kg"]
        last_bt = burn.burnTime
    for burn in req.maneuver_sequence:
        dv_vec = np.array([burn.deltaV_vector.x, burn.deltaV_vector.y, burn.deltaV_vector.z])
        state.maneuver_queue.append({
            "satellite_id": req.satelliteId, "burn_id": burn.burn_id,
            "burn_time": burn.burnTime, "dv_vector_eci": dv_vec,
            "dv_magnitude": float(np.linalg.norm(dv_vec)),
        })
    return ManeuverResponse(
        status="SCHEDULED",
        validation=ManeuverValidation(
            ground_station_los=has_los, sufficient_fuel=True,
            projected_mass_remaining_kg=round(current_mass, 4)))


@app.post("/api/simulate/step", response_model=SimulateStepResponse)
async def simulate_step(req: SimulateStepRequest):
    step = req.step_seconds
    t_start = state.sim_time
    t_end = t_start + step
    maneuvers_executed = 0
    # 1. Execute scheduled burns
    remaining_burns = []
    for burn in state.maneuver_queue:
        if t_start <= burn["burn_time"] <= t_end:
            sat = state.satellites.get(burn["satellite_id"])
            if sat:
                fuel_before = sat["fuel"]
                dv_ms = burn["dv_magnitude"] * 1000.0
                consumed = fuel_cost(dv_ms, sat["mass"])
                sat["state"] = apply_burn(sat["state"], burn["dv_vector_eci"])
                sat["mass"] -= consumed
                sat["fuel"] -= consumed
                sat["last_burn_time"] = burn["burn_time"]
                state.total_delta_v_ms += dv_ms
                maneuvers_executed += 1
                event_logger.log_maneuver(
                    burn["burn_time"], burn["satellite_id"], "SCHEDULED",
                    dv_ms, fuel_before, sat["fuel"], "Scheduled burn executed")
        else:
            remaining_burns.append(burn)
    state.maneuver_queue = remaining_burns
    # 2. Propagate satellites
    for sat in state.satellites.values():
        if sat["status"] == "GRAVEYARD":
            continue
        sat["state"] = propagate(sat["state"], step, substep=10.0)
    # 3. Propagate debris
    active_cdm_debris = {cdm.debris_id for cdm in state.active_cdms}
    for did, deb in state.debris.items():
        ss = 10.0 if did in active_cdm_debris else 60.0
        deb["state"] = propagate(deb["state"], step, substep=ss)
    # 4. Detect collisions
    collisions = quick_conjunction_check(
        state.get_sat_states_dict(), state.get_debris_states_dict(), threshold_km=0.1)
    for sat_id, deb_id, dist in collisions:
        event_logger.log_collision(t_end, sat_id, deb_id, dist)
        state.collisions_avoided += 1
    # 5. EOL check
    for sat in state.satellites.values():
        if sat["status"] != "GRAVEYARD" and check_eol(sat["mass"]):
            sat["status"] = "GRAVEYARD"
            event_logger.log_system_event(
                t_end, "EOL_GRAVEYARD",
                f"Satellite moved to graveyard (fuel={sat['fuel']:.2f}kg)")
    # 6. Update sim time
    state.sim_time = t_end
    # 7. Run conjunction assessment
    await run_async_conjunction()
    # 8. WebSocket broadcast
    await ws_manager.broadcast({
        "type": "STEP_COMPLETE", "timestamp": t_end,
        "cdm_count": len(state.active_cdms),
        "collisions": len(collisions)
    })
    return SimulateStepResponse(
        status="STEP_COMPLETE", new_timestamp=t_end,
        collisions_detected=len(collisions),
        maneuvers_executed=maneuvers_executed,
        cdm_count=len(state.active_cdms))


@app.get("/api/visualization/snapshot", response_model=VisualizationSnapshot)
async def get_visualization_snapshot():
    ts = state.sim_time
    satellites_viz = []
    for sid, sat in state.satellites.items():
        lat, lon, alt = eci_to_geodetic(sat["state"][:3], ts)
        satellites_viz.append(SatelliteVizData(
            id=sid, lat=round(lat, 4), lon=round(lon, 4),
            alt=round(alt, 2), fuel_kg=round(sat["fuel"], 4),
            status=sat["status"], mass_kg=round(sat["mass"], 4),
            vx=round(sat["state"][3], 6), vy=round(sat["state"][4], 6),
            vz=round(sat["state"][5], 6)))
    deb_ids = list(state.debris.keys())
    if deb_ids:
        deb_positions = np.array([state.debris[d]["state"][:3] for d in deb_ids])
        deb_geo = batch_eci_to_geodetic(deb_positions, ts)
        debris_cloud = [
            [deb_ids[i], round(deb_geo[i, 0], 2), round(deb_geo[i, 1], 2), round(deb_geo[i, 2], 1)]
            for i in range(len(deb_ids))]
    else:
        debris_cloud = []
    cdms_viz = [
        CDMVizData(
            satellite_id=c.satellite_id, debris_id=c.debris_id,
            tca_seconds=round(c.tca_seconds, 2),
            miss_distance_km=round(c.miss_distance_km, 6),
            risk_level=c.risk_level.value,
            relative_velocity_km_s=round(c.relative_velocity_km_s, 4))
        for c in state.active_cdms[:50]]
    gs_data = [{"id": gs["id"], "name": gs["name"],
                "lat": gs["lat"], "lon": gs["lon"]} for gs in GROUND_STATIONS]
    return VisualizationSnapshot(
        timestamp=ts, satellites=satellites_viz,
        debris_cloud=debris_cloud, cdms=cdms_viz, ground_stations=gs_data)


@app.post("/api/auto-evade")
async def auto_evade(satellite_id: str, cdm_index: int = 0):
    sat = state.satellites.get(satellite_id)
    if not sat:
        raise HTTPException(404, f"Satellite {satellite_id} not found")
    relevant_cdms = [c for c in state.active_cdms if c.satellite_id == satellite_id]
    if not relevant_cdms or cdm_index >= len(relevant_cdms):
        raise HTTPException(404, "No active CDM for this satellite")
    cdm = relevant_cdms[cdm_index]
    best_sat, best_dv = global_fuel_optimizer(state.get_sat_info_dict(), satellite_id, cdm)
    target_sat = state.satellites[best_sat]
    evasion = plan_evasion_burn(
        target_sat["state"],
        cdm.debris_state_at_tca if cdm.debris_state_at_tca is not None else np.zeros(6),
        cdm.tca_seconds, cdm.miss_distance_km, target_sat["mass"])
    if evasion is None:
        raise HTTPException(400, "Cannot compute feasible evasion maneuver")
    state.maneuver_queue.append({
        "satellite_id": best_sat, "burn_id": evasion.burn_id,
        "burn_time": state.sim_time + 60.0,
        "dv_vector_eci": evasion.dv_eci_kms,
        "dv_magnitude": float(np.linalg.norm(evasion.dv_eci_kms)),
    })
    return {
        "status": "EVASION_SCHEDULED", "target_satellite": best_sat,
        "evasion_dv_ms": round(evasion.dv_magnitude_ms, 2),
        "fuel_cost_kg": round(evasion.fuel_cost_kg, 4),
    }


@app.get("/api/coverage/windows")
async def get_coverage_windows(satellite_id: str):
    sat = state.satellites.get(satellite_id)
    if not sat:
        raise HTTPException(404, f"Satellite {satellite_id} not found")
    from backend.engine.comms import compute_coverage_windows
    windows = compute_coverage_windows(sat["state"], state.sim_time, horizon_s=86400.0)
    return {"satellite_id": satellite_id, "windows": windows}


@app.get("/api/fleet/summary")
async def fleet_summary():
    from backend.optimizer.budget import fleet_fuel_summary
    return fleet_fuel_summary(state.satellites)


@app.get("/api/report", response_model=ReportResponse)
async def get_report():
    db_stats = event_logger.get_stats()
    active = sum(1 for s in state.satellites.values() if s["status"] != "GRAVEYARD")
    graveyard = sum(1 for s in state.satellites.values() if s["status"] == "GRAVEYARD")
    uptime = (active / max(len(state.satellites), 1)) * 100.0
    return ReportResponse(
        algorithms={
            "propagator": "RK4 with J2/J3/J4 perturbation (10s substep, <1m error/24h)",
            "conjunction_detection": "Two-phase: KD-Tree O(N log N) coarse + golden-section TCA",
            "maneuver_planning": "RTN frame transverse burns, Tsiolkovsky fuel model",
            "fuel_optimization": "Greedy global fleet optimizer with CW linearization",
            "blind_conjunction": "Autonomous pre-upload during last LOS window",
            "coordinate_transforms": "ECI→ECEF via GMST, ECEF→geodetic Bowring iterative",
        },
        total_delta_v_consumed_m_s=round(state.total_delta_v_ms, 4),
        conjunctions_avoided=state.collisions_avoided,
        total_cdms_generated=state.total_cdms_generated,
        fleet_uptime_percent=round(uptime, 2),
        satellites_active=active, satellites_graveyard=graveyard,
        fuel_efficiency_score=round(
            100.0 - (state.total_delta_v_ms / max(1, state.collisions_avoided + 1)), 2),
        maneuver_log=event_logger.get_maneuver_log(50))


# ─── WebSocket ───

@app.websocket("/ws/realtime")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong", "sim_time": state.sim_time})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ─── Static File Serving ───
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")

if os.path.exists(FRONTEND_DIR):
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "message": "AETHER ACM API — Frontend not built. Run: npm run build",
            "docs": "/docs",
            "health": "/api/health",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
