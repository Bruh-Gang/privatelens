"""Pydantic models for PrivateLens API responses."""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SignalResult(BaseModel):
    signal: str
    icon: str
    display: str
    raw_score: float = Field(ge=0, le=100)
    weight: float
    weighted_contribution: float
    insight: str
    is_simulated: bool
    source_url: str
    category: str  # "financial", "operational", "legal", "sentiment", "digital"


class ScoreMeta(BaseModel):
    total_signals: int
    real_signals: int
    simulated_signals: int
    model_version: str
    confidence: float  # 0-1, based on % real signals
    disclaimer: str
    cached: bool = False
    computed_at: str


class ScoreResponse(BaseModel):
    company_name: str
    normalized_name: str
    private_score: int = Field(ge=0, le=1000)
    previous_score: Optional[int] = None
    score_delta: Optional[int] = None
    rating: str
    color: str
    summary: str
    breakdown: list[SignalResult]
    meta: ScoreMeta
    elapsed_seconds: float


class CompareResponse(BaseModel):
    companies: list[ScoreResponse]
    winner: str
    analysis: str


class HistoryEntry(BaseModel):
    company_name: str
    private_score: int
    rating: str
    color: str
    queried_at: str


class SearchSuggestion(BaseModel):
    name: str
    category: str
