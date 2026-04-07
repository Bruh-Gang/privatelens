"""Score router — main PrivateScore™ endpoints."""
import time
import re
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Request
from core.cache import score_cache
from core.limiter import rate_limiter
from services.collectors import collect_all
from services.scorer import compute_score
from services.history import history_store

router = APIRouter(prefix="/api", tags=["Score"])


def _normalize(name: str) -> str:
    """Normalize company name for consistent cache keys."""
    return re.sub(r'\s+', ' ', name.strip().lower())


@router.get("/score")
async def get_score(
    request: Request,
    company: str = Query(..., min_length=2, max_length=120),
):
    """Get PrivateScore™ for any US private company."""
    ip = request.client.host if request.client else "unknown"
    allowed, retry_after = await rate_limiter.is_allowed(ip)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {retry_after}s.",
            headers={"Retry-After": str(retry_after)}
        )

    company_clean = company.strip()
    if len(company_clean) < 2:
        raise HTTPException(status_code=400, detail="Company name too short.")

    cache_key = _normalize(company_clean)
    start = time.perf_counter()

    # Cache hit
    cached = await score_cache.get(cache_key)
    if cached:
        cached["meta"]["cached"] = True
        cached["elapsed_seconds"] = round(time.perf_counter() - start, 3)
        return cached

    # Collect signals + score
    try:
        signals = await collect_all(company_clean)
        result = compute_score(signals)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scoring pipeline error: {str(e)}")

    elapsed = round(time.perf_counter() - start, 3)

    response = {
        "company_name": company_clean,
        "normalized_name": cache_key,
        "private_score": result["private_score"],
        "rating": result["rating"],
        "color": result["color"],
        "summary": result["summary"],
        "breakdown": result["breakdown"],
        "category_summary": result["category_summary"],
        "risk_flags": result["risk_flags"],
        "meta": {**result["meta"], "cached": False,
                 "computed_at": datetime.now(timezone.utc).isoformat()},
        "elapsed_seconds": elapsed,
    }

    await score_cache.set(cache_key, response)
    history_store.add(company_clean, result["private_score"], result["rating"], result["color"])

    return response


@router.get("/compare")
async def compare(
    request: Request,
    companies: str = Query(..., description="Comma-separated list of 2-4 company names"),
):
    """Compare PrivateScore™ across multiple companies."""
    names = [n.strip() for n in companies.split(",") if n.strip()]
    if len(names) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 company names.")
    if len(names) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 companies per comparison.")

    ip = request.client.host if request.client else "unknown"
    allowed, retry_after = await rate_limiter.is_allowed(ip)
    if not allowed:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded. Try again in {retry_after}s.")

    import asyncio
    results = await asyncio.gather(*[
        get_score(request, company=n) for n in names
    ], return_exceptions=True)

    valid = [r for r in results if isinstance(r, dict)]
    if not valid:
        raise HTTPException(status_code=500, detail="Failed to score any companies.")

    winner = max(valid, key=lambda x: x["private_score"])
    return {
        "companies": valid,
        "winner": winner["company_name"],
        "winner_score": winner["private_score"],
        "analysis": f"{winner['company_name']} leads with a PrivateScore™ of {winner['private_score']}/1000 ({winner['rating']}). "
                    f"Gap vs lowest: {winner['private_score'] - min(r['private_score'] for r in valid)} points.",
    }


@router.get("/history")
async def get_history(limit: int = Query(default=10, ge=1, le=50)):
    """Return recent search history."""
    return {"history": history_store.recent(limit)}


@router.get("/cache/stats")
async def cache_stats():
    """Cache statistics for monitoring."""
    return score_cache.stats()


@router.get("/signals")
async def list_signals():
    """List all 14 signal types with data source status."""
    return {
        "signals": [
            {"name": "Open Banking Payment Flows",    "status": "simulated", "weight": "13%", "unlocks_with": "Section 1033 API"},
            {"name": "B2B Payment Behavior",          "status": "simulated", "weight": "12%", "unlocks_with": "D&B Paydex API"},
            {"name": "Job Posting Velocity",          "status": "live",      "weight": "11%", "source": "Indeed"},
            {"name": "UCC Filings & Lien Activity",   "status": "simulated", "weight": "10%", "unlocks_with": "State UCC APIs"},
            {"name": "Court Records & Litigation",    "status": "simulated", "weight": "9%",  "unlocks_with": "PACER / CourtListener"},
            {"name": "News & Media Sentiment",        "status": "live",      "weight": "8%",  "source": "DuckDuckGo + HackerNews"},
            {"name": "Employee & Customer Reviews",   "status": "simulated", "weight": "7%",  "unlocks_with": "Glassdoor API"},
            {"name": "Insider & Employee Sentiment",  "status": "simulated", "weight": "6%",  "unlocks_with": "Glassdoor API"},
            {"name": "Web Traffic Trends",            "status": "simulated", "weight": "6%",  "unlocks_with": "SimilarWeb API"},
            {"name": "Brand Legitimacy",              "status": "live",      "weight": "5%",  "source": "Wikipedia API"},
            {"name": "SEC / Regulatory Filings",      "status": "live",      "weight": "5%",  "source": "SEC EDGAR"},
            {"name": "Social Media Activity",         "status": "simulated", "weight": "4%",  "unlocks_with": "Twitter/LinkedIn API"},
            {"name": "Supply Chain & Vendor Signals", "status": "simulated", "weight": "3%",  "unlocks_with": "RiskMethods API"},
            {"name": "Government Contract Awards",    "status": "live",      "weight": "1%",  "source": "USASpending.gov"},
        ]
    }
