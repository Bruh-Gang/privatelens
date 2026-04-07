import React, { useState, useRef, useCallback, useEffect } from 'react'
import './styles/App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

// ── Utility ────────────────────────────────────────────────────────────────────
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

// ── Score Gauge ────────────────────────────────────────────────────────────────
function ScoreGauge({ score, color, rating, animated }) {
  const R = 88, C = 2 * Math.PI * R
  const offset = C * (1 - score / 1000)
  return (
    <div className="gauge-wrap" style={{ opacity: animated ? 1 : 0.4 }}>
      <svg viewBox="0 0 200 200" width={200} height={200}>
        {/* Track */}
        <circle cx={100} cy={100} r={R} fill="none" stroke="var(--surface3)" strokeWidth={12}/>
        {/* Glow */}
        <circle cx={100} cy={100} r={R} fill="none" stroke={color} strokeWidth={12}
          strokeLinecap="round" strokeDasharray={C} strokeDashoffset={offset}
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)', filter:`drop-shadow(0 0 10px ${color}88)` }}
        />
        <text x={100} y={92}  textAnchor="middle" fill={color}          fontSize={40} fontWeight={700} fontFamily="Inter">{score}</text>
        <text x={100} y={112} textAnchor="middle" fill="var(--text3)"   fontSize={12} fontFamily="Inter">/ 1000</text>
        <text x={100} y={134} textAnchor="middle" fill={color}          fontSize={14} fontWeight={600} fontFamily="Inter">{rating}</text>
      </svg>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="signal-card skeleton-card">
      <div className="skeleton" style={{height:14, width:'55%', marginBottom:8}}/>
      <div className="skeleton" style={{height:10, width:'80%', marginBottom:10}}/>
      <div className="skeleton" style={{height:5, marginBottom:8, borderRadius:3}}/>
      <div className="skeleton" style={{height:10, width:'90%'}}/>
    </div>
  )
}

function SkeletonOverview() {
  return (
    <div className="score-overview skeleton-overview">
      <div className="skeleton" style={{width:200, height:200, borderRadius:'50%'}}/>
      <div style={{flex:1}}>
        <div className="skeleton" style={{height:28, width:'45%', marginBottom:12}}/>
        <div className="skeleton" style={{height:14, width:'90%', marginBottom:6}}/>
        <div className="skeleton" style={{height:14, width:'75%', marginBottom:20}}/>
        <div style={{display:'flex', gap:8}}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{height:60, flex:1, borderRadius:10}}/>)}
        </div>
      </div>
    </div>
  )
}

// ── Signal Card ────────────────────────────────────────────────────────────────
function SignalCard({ signal, idx }) {
  const pct = clamp(signal.raw_score)
  const barColor = pct >= 70 ? 'var(--green)' : pct >= 45 ? 'var(--teal)' : pct >= 28 ? 'var(--gold)' : 'var(--red)'
  return (
    <div className="signal-card fade-up" style={{ animationDelay:`${idx * 35}ms` }}>
      <div className="signal-top">
        <span className="sig-icon">{signal.icon}</span>
        <span className="sig-name">{signal.signal}</span>
        <span className={signal.is_simulated ? 'badge-sim' : 'badge-live'}>
          {signal.is_simulated ? 'SIM' : 'LIVE'}
        </span>
      </div>
      <div className="sig-display mono">{signal.display}</div>
      <div className="sig-bar-bg">
        <div className="sig-bar-fill" style={{
          width:`${pct}%`, background:barColor,
          boxShadow:`0 0 6px ${barColor}55`,
          transition:`width .9s cubic-bezier(.4,0,.2,1) ${idx*35}ms`
        }}/>
      </div>
      <div className="sig-insight">{signal.insight}</div>
      {signal.source_url && (
        <a href={signal.source_url} target="_blank" rel="noopener noreferrer" className="sig-link">
          Source ↗
        </a>
      )}
    </div>
  )
}

// ── Category Bar ───────────────────────────────────────────────────────────────
function CategoryBar({ label, score, count }) {
  const color = score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--teal)' : score >= 28 ? 'var(--gold)' : 'var(--red)'
  return (
    <div className="cat-bar">
      <div className="cat-label">
        <span>{label}</span>
        <span className="mono" style={{color}}>{score.toFixed(0)}/100</span>
      </div>
      <div className="cat-track">
        <div className="cat-fill" style={{width:`${score}%`, background:color, boxShadow:`0 0 8px ${color}44`}}/>
      </div>
      <div className="cat-count faint">{count} signal{count !== 1 ? 's' : ''}</div>
    </div>
  )
}

// ── Risk Flags ─────────────────────────────────────────────────────────────────
function RiskFlags({ flags }) {
  if (!flags?.length) return null
  return (
    <div className="risk-box">
      <div className="risk-title">⚠️ Risk Flags Detected</div>
      {flags.map((f, i) => <div key={i} className="risk-item">{f}</div>)}
    </div>
  )
}

// ── Compare Bar ────────────────────────────────────────────────────────────────
function ComparePanel({ onCompare, loading }) {
  const [input, setInput] = useState('')
  return (
    <div className="compare-panel">
      <div className="compare-label">Compare companies</div>
      <div className="compare-row">
        <input
          className="compare-input"
          placeholder="e.g. Cargill, Deloitte, Bechtel"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && input.trim() && onCompare(input)}
        />
        <button className="compare-btn" onClick={() => input.trim() && onCompare(input)} disabled={loading}>
          Compare
        </button>
      </div>
    </div>
  )
}

// ── History Sidebar ────────────────────────────────────────────────────────────
function HistorySidebar({ history, onSelect }) {
  if (!history?.length) return null
  return (
    <div className="history-sidebar fade-in">
      <div className="history-title">Recent Searches</div>
      {history.map((h, i) => (
        <button key={i} className="history-item" onClick={() => onSelect(h.company_name)}>
          <span className="history-name">{h.company_name}</span>
          <span className="history-score mono" style={{color: h.color}}>{h.private_score}</span>
        </button>
      ))}
    </div>
  )
}

// ── Compare Results ────────────────────────────────────────────────────────────
function CompareResults({ data, onClose }) {
  if (!data) return null
  const max = Math.max(...data.companies.map(c => c.private_score))
  return (
    <div className="compare-results fade-up">
      <div className="compare-header">
        <span>Comparison</span>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="compare-analysis">{data.analysis}</div>
      <div className="compare-grid">
        {data.companies.map((c, i) => (
          <div key={i} className={`compare-card ${c.private_score === max ? 'compare-winner' : ''}`}>
            {c.private_score === max && <div className="winner-badge">Winner</div>}
            <div className="compare-company">{c.company_name}</div>
            <div className="compare-score mono" style={{color: c.color}}>{c.private_score}</div>
            <div className="compare-rating" style={{color: c.color}}>{c.rating}</div>
            <div className="compare-bar-bg">
              <div className="compare-bar-fill" style={{width:`${c.private_score/10}%`, background:c.color}}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [compareData, setCompareData] = useState(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('signals') // signals | categories
  const inputRef = useRef(null)

  const fetchHistory = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/history?limit=8`)
      if (r.ok) { const d = await r.json(); setHistory(d.history || []) }
    } catch {}
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  const search = useCallback(async (name) => {
    const q = (name || query).trim()
    if (!q) return
    setQuery(q)
    setLoading(true)
    setResult(null)
    setError('')
    setCompareData(null)
    try {
      const r = await fetch(`${API}/api/score?company=${encodeURIComponent(q)}`)
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Scoring failed') }
      const d = await r.json()
      setResult(d)
      fetchHistory()
    } catch (e) {
      setError(e.message || 'Failed to connect to PrivateLens API.')
    } finally {
      setLoading(false)
    }
  }, [query, fetchHistory])

  const handleCompare = async (input) => {
    setCompareLoading(true)
    setCompareData(null)
    try {
      const encoded = encodeURIComponent(input.trim())
      const r = await fetch(`${API}/api/compare?companies=${encoded}`)
      if (!r.ok) { const e = await r.json(); throw new Error(e.detail) }
      setCompareData(await r.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setCompareLoading(false)
    }
  }

  const examples = ['Cargill', 'Koch Industries', 'Deloitte', 'Bechtel', 'Publix', 'Mars Inc']

  return (
    <div className="app-shell">
      {/* ── History sidebar ── */}
      <HistorySidebar history={history} onSelect={search} />

      {/* ── Main content ── */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="logo">
            <div className="logo-mark">PL</div>
            <div>
              <div className="logo-name">PrivateLens</div>
              <div className="logo-sub">Bloomberg for Private Companies</div>
            </div>
          </div>
          <div className="header-pills">
            <span className="pill pill-version">v2.0 · MVP</span>
            <span className="pill pill-live">
              <span className="live-dot"/>5 live signals
            </span>
          </div>
        </header>

        {/* Hero */}
        <section className="hero">
          <h1 className="hero-title">
            Financial intelligence for<br/>
            <span className="hero-accent">any private company</span>
          </h1>
          <p className="hero-sub">
            PrivateScore™ synthesizes 14 alternative data signals — job postings, court records,
            open banking flows, news sentiment, and more — into a single live financial health score
            for the 30M US companies Bloomberg ignores.
          </p>

          <form className="search-form" onSubmit={e => { e.preventDefault(); search() }}>
            <div className="search-box">
              <svg className="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx={8.5} cy={8.5} r={5.5}/><path d="M15 15l-3-3"/>
              </svg>
              <input
                ref={inputRef}
                className="search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Enter any US private company name…"
                disabled={loading}
                autoFocus
              />
              {query && (
                <button type="button" className="clear-btn" onClick={() => { setQuery(''); setResult(null); setError('') }}>✕</button>
              )}
              <button className="search-btn" type="submit" disabled={loading || !query.trim()}>
                {loading ? <span className="btn-spinner"/> : 'Get PrivateScore™'}
              </button>
            </div>
          </form>

          <div className="example-pills">
            {examples.map(ex => (
              <button key={ex} className="example-pill" onClick={() => search(ex)} disabled={loading}>{ex}</button>
            ))}
          </div>
        </section>

        {/* Compare */}
        <ComparePanel onCompare={handleCompare} loading={compareLoading} />
        {compareData && <CompareResults data={compareData} onClose={() => setCompareData(null)} />}

        {/* Error */}
        {error && <div className="error-box">⚠️ {error}</div>}

        {/* Loading skeleton */}
        {loading && (
          <div>
            <SkeletonOverview />
            <div className="signals-grid" style={{marginTop:24}}>
              {Array.from({length:6}).map((_,i) => <SkeletonCard key={i}/>)}
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="results fade-up">
            {/* Score overview */}
            <div className="score-overview">
              <ScoreGauge score={result.private_score} color={result.color} rating={result.rating} animated />
              <div className="score-details">
                <h2 className="company-name">{result.company_name}</h2>
                <p className="score-summary">{result.summary}</p>

                {/* Meta pills */}
                <div className="meta-row">
                  <span className="meta-pill live-pill">
                    <span className="live-dot"/>{result.meta.real_signals} live
                  </span>
                  <span className="meta-pill sim-pill">
                    <span className="sim-dot"/>{result.meta.simulated_signals} simulated
                  </span>
                  <span className="meta-pill conf-pill">
                    {(result.meta.confidence * 100).toFixed(0)}% confidence
                  </span>
                  <span className="meta-pill time-pill mono">{result.elapsed_seconds}s</span>
                  {result.meta.cached && <span className="meta-pill cache-pill">⚡ cached</span>}
                </div>

                <p className="disclaimer">{result.meta.disclaimer}</p>
              </div>
            </div>

            {/* Risk flags */}
            <RiskFlags flags={result.risk_flags} />

            {/* Tab selector */}
            <div className="tab-row">
              <button className={`tab-btn ${activeTab==='signals' ? 'active' : ''}`} onClick={() => setActiveTab('signals')}>
                Signal Breakdown ({result.breakdown?.length})
              </button>
              <button className={`tab-btn ${activeTab==='categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>
                Category Analysis
              </button>
            </div>

            {/* Signals tab */}
            {activeTab === 'signals' && (
              <>
                <div className="signals-legend">
                  <span className="badge-live">LIVE</span> = real data &nbsp;·&nbsp;
                  <span className="badge-sim">SIM</span> = simulated — unlocks with funding
                </div>
                <div className="signals-grid">
                  {result.breakdown?.map((s, i) => <SignalCard key={s.signal} signal={s} idx={i}/>)}
                </div>
              </>
            )}

            {/* Categories tab */}
            {activeTab === 'categories' && (
              <div className="cat-section fade-in">
                {Object.entries(result.category_summary || {}).map(([key, val]) => (
                  <CategoryBar key={key} label={val.label} score={val.score} count={val.signal_count}/>
                ))}
              </div>
            )}

            {/* Funding CTA */}
            <div className="funding-cta">
              <div className="cta-left">
                <div className="cta-title">🚀 Unlock Full Live Data</div>
                <p className="cta-body">
                  {result.meta.simulated_signals} signals are currently simulated. With $500K pre-seed funding,
                  PrivateLens will integrate live APIs for UCC filings, open banking flows, court records,
                  Glassdoor, SimilarWeb, and more — making every score 100% real-time.
                </p>
              </div>
              <a href="mailto:vijithvelamuri@gmail.com?subject=PrivateLens%20Access%20Request" className="cta-btn">
                Request Access →
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="footer">
          <span className="faint">PrivateLens © 2026 · Pre-Seed Stage · </span>
          <a href="https://github.com/Bruh-Gang/privatelens" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          <span className="faint"> · Built by Vijith Velamuri</span>
        </footer>
      </div>
    </div>
  )
}
