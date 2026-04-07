"""
In-memory search history store.
Tracks last 100 unique company searches per session.
"""
from collections import deque
from datetime import datetime, timezone
from threading import Lock


class HistoryStore:
    def __init__(self, maxlen: int = 100):
        self._history: deque = deque(maxlen=maxlen)
        self._lock = Lock()

    def add(self, company: str, score: int, rating: str, color: str) -> None:
        entry = {
            "company_name": company,
            "private_score": score,
            "rating": rating,
            "color": color,
            "queried_at": datetime.now(timezone.utc).isoformat(),
        }
        with self._lock:
            # Remove previous entry for same company
            self._history = deque(
                (e for e in self._history if e["company_name"].lower() != company.lower()),
                maxlen=self._history.maxlen
            )
            self._history.appendleft(entry)

    def recent(self, limit: int = 10) -> list:
        with self._lock:
            return list(self._history)[:limit]

    def clear(self) -> None:
        with self._lock:
            self._history.clear()


history_store = HistoryStore()
