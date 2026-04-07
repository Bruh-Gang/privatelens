"""
In-memory LRU cache with TTL expiration.
Avoids hammering external APIs on repeated searches.
"""
import time
import asyncio
from collections import OrderedDict
from typing import Any, Optional
from core.config import get_settings

settings = get_settings()


class TTLCache:
    """Thread-safe in-memory cache with TTL expiration and LRU eviction."""

    def __init__(self, maxsize: int = 500, ttl: int = 3600):
        self._cache: OrderedDict = OrderedDict()
        self._timestamps: dict = {}
        self._maxsize = maxsize
        self._ttl = ttl
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if key not in self._cache:
                return None
            if time.time() - self._timestamps[key] > self._ttl:
                del self._cache[key]
                del self._timestamps[key]
                return None
            # Move to end (LRU)
            self._cache.move_to_end(key)
            return self._cache[key]

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            else:
                if len(self._cache) >= self._maxsize:
                    # Evict oldest
                    oldest = next(iter(self._cache))
                    del self._cache[oldest]
                    del self._timestamps[oldest]
            self._cache[key] = value
            self._timestamps[key] = time.time()

    async def invalidate(self, key: str) -> None:
        async with self._lock:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)

    def stats(self) -> dict:
        return {
            "size": len(self._cache),
            "maxsize": self._maxsize,
            "ttl_seconds": self._ttl,
        }


# Global cache instance
score_cache = TTLCache(maxsize=500, ttl=settings.CACHE_TTL)
