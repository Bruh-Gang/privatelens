"""
Simple sliding window rate limiter.
Prevents abuse without needing Redis.
"""
import time
import asyncio
from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self._max = max_requests
        self._window = window_seconds
        self._requests: dict[str, deque] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def is_allowed(self, identifier: str) -> tuple[bool, int]:
        """Returns (allowed, retry_after_seconds)."""
        async with self._lock:
            now = time.time()
            q = self._requests[identifier]

            # Remove expired entries
            while q and now - q[0] > self._window:
                q.popleft()

            if len(q) >= self._max:
                retry_after = int(self._window - (now - q[0])) + 1
                return False, retry_after

            q.append(now)
            return True, 0


rate_limiter = SlidingWindowLimiter(max_requests=30, window_seconds=60)
