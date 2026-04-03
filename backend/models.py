"""
AETHER ACM — Pydantic Models
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from enum import Enum


class Vec3(BaseModel):
    x: float; y: float; z: float

class ObjectType(str, Enum):
    SAT = "SAT"; DEBRIS = "DEBRIS"

class TelemetryObject(BaseModel):
    id: str; type: ObjectType; r: Vec3; v: Vec3

class TelemetryRequest(BaseModel):
    timestamp: float; objects: List[TelemetryObject]

class TelemetryResponse(BaseModel):
    status: str = "ACK"; processed_count: int; active_cdm_warnings: int

class BurnSpec(BaseModel):
    burn_id: str; burnTime: float; deltaV_vector: Vec3
    @field_validator('deltaV_vector')
    @classmethod
    def validate_dv(cls, v):
        mag = (v.x**2 + v.y**2 + v.z**2) ** 0.5
        if mag > 0.016:
            raise ValueError(f"ΔV magnitude {mag*1000:.1f} m/s exceeds 15 m/s limit")
        return v

class ManeuverRequest(BaseModel):
    satelliteId: str; maneuver_sequence: List[BurnSpec]

class ManeuverValidation(BaseModel):
    ground_station_los: bool; sufficient_fuel: bool
    projected_mass_remaining_kg: float; cooldown_respected: bool = True

class ManeuverResponse(BaseModel):
    status: str = "SCHEDULED"; validation: ManeuverValidation

class SimulateStepRequest(BaseModel):
    step_seconds: float = Field(gt=0, le=86400, default=60.0)

class SimulateStepResponse(BaseModel):
    status: str = "STEP_COMPLETE"; new_timestamp: float
    collisions_detected: int; maneuvers_executed: int; cdm_count: int = 0

class SatelliteVizData(BaseModel):
    id: str; lat: float; lon: float; alt: float
    fuel_kg: float; status: str; mass_kg: float = 550.0
    vx: float = 0.0; vy: float = 0.0; vz: float = 0.0

class CDMVizData(BaseModel):
    satellite_id: str; debris_id: str; tca_seconds: float
    miss_distance_km: float; risk_level: str
    relative_velocity_km_s: float = 0.0

class VisualizationSnapshot(BaseModel):
    timestamp: float; satellites: List[SatelliteVizData]
    debris_cloud: List[List[Any]]; cdms: List[CDMVizData] = []
    ground_stations: List[Dict[str, Any]] = []

class HealthResponse(BaseModel):
    status: str = "OK"; sim_time: float; satellite_count: int
    debris_count: int; active_cdms: int
    total_delta_v_m_s: float = 0.0; collisions_avoided: int = 0
    fleet_fuel_percent: float = 100.0

class ReportResponse(BaseModel):
    algorithms: Dict[str, str]
    total_delta_v_consumed_m_s: float; conjunctions_avoided: int
    total_cdms_generated: int; fleet_uptime_percent: float
    satellites_active: int; satellites_graveyard: int
    fuel_efficiency_score: float; maneuver_log: List[Dict[str, Any]]
