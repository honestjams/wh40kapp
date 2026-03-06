import React, { useEffect, useState } from 'react'
import type { Unit } from './ListBuilder'
import { getFactionColor } from './ListBuilder'

// ── Types ─────────────────────────────────────────────────────────────────────

type Stratagem = {
  name: string
  cp: number
  phase: string
  timing: string
  effect: string
  detachment?: string
}

type StratagemData = {
  core: Stratagem[]
  factions: Record<string, Stratagem[]>
}

type Props = { roster: Unit[] }

// ── Phase colour map ──────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  'Command':   '#b8860b',
  'Movement':  '#1a6b8a',
  'Shooting':  '#8b0000',
  'Fight':     '#6a1a1a',
  'Any':       '#4a5a6a',
  'Psychic':   '#6a1a7a',
  'Morale':    '#5a4a2a',
}

function phaseColor(phase: string) {
  for (const [key, color] of Object.entries(PHASE_COLORS)) {
    if (phase.includes(key)) return color
  }
  return '#333'
}

// ── Stratagem card ────────────────────────────────────────────────────────────

function StratCard({
  strat,
  used,
  onToggle,
  accentColor,
  isCore,
}: {
  strat: Stratagem
  used: boolean
  onToggle: () => void
  accentColor?: string
  isCore?: boolean
}) {
  return (
    <div className={`strat-card ${used ? 'strat-used' : ''}`}>
      <div
        className="strat-header"
        style={{ background: isCore ? '#2a2a2a' : accentColor ?? '#333' }}
      >
        <div className="strat-header-left">
          <span className="strat-name">{strat.name}</span>
          {strat.detachment && !isCore && (
            <span className="strat-detachment">{strat.detachment}</span>
          )}
          {isCore && <span className="strat-detachment">Core Stratagem</span>}
        </div>
        <div className="strat-cp-badge">
          {strat.cp}<span className="strat-cp-label">CP</span>
        </div>
      </div>

      <div className="strat-body">
        <div className="strat-meta">
          <span
            className="strat-phase"
            style={{ background: phaseColor(strat.phase) }}
          >
            {strat.phase}
          </span>
          <span className="strat-timing">{strat.timing}</span>
        </div>
        <p className="strat-effect">{strat.effect}</p>

        <button
          className={`strat-use-btn ${used ? 'strat-use-btn-used' : ''}`}
          onClick={onToggle}
        >
          {used ? '↩ Restore' : '✓ Mark Used'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StratagemView({ roster }: Props) {
  const [data, setData] = useState<StratagemData | null>(null)
  const [usedStrats, setUsedStrats] = useState<Set<string>>(new Set())
  const [cp, setCp] = useState(0)
  const [filter, setFilter] = useState<string>('all')  // 'all' | 'core' | factionId
  const [phaseFilter, setPhaseFilter] = useState<string>('All')

  useEffect(() => {
    fetch('/bsData-json/stratagems.json')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
  }, [])

  // Derive unique faction IDs present in roster
  const rosterFactions = Array.from(new Set(roster.map(u => u.factionId)))

  // Derive unique detachments present in roster
  const rosterDetachments = Array.from(
    new Set(roster.filter(u => u.detachment).map(u => u.detachment!.name))
  )

  // Map factionId -> set of selected detachment names (for stratagem filtering)
  const factionDetachments = roster.reduce<Record<string, Set<string>>>((acc, u) => {
    if (!acc[u.factionId]) acc[u.factionId] = new Set()
    if (u.detachment) acc[u.factionId].add(u.detachment.name)
    return acc
  }, {})

  const toggleUsed = (key: string) => {
    setUsedStrats(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const resetUsed = () => setUsedStrats(new Set())

  if (!data) {
    return (
      <div className="strat-root">
        <p className="lb-hint">Loading stratagems…</p>
      </div>
    )
  }

  // ── Collect stratagems to show ─────────────────────────────────────────────
  const coreStrats = data.core
  const factionStrats: Array<Stratagem & { factionId: string; factionName: string }> = []

  for (const fid of rosterFactions) {
    const fStrats = data.factions[fid] ?? []
    const fName = roster.find(u => u.factionId === fid)?.factionName ?? fid
    const activeDets = factionDetachments[fid] ?? new Set()
    for (const s of fStrats) {
      // Show if: "Any" detachment, no detachment selected, or matches an active detachment
      const detMatches =
        s.detachment === 'Any' ||
        !s.detachment ||
        activeDets.size === 0 ||
        activeDets.has(s.detachment)
      if (detMatches) {
        factionStrats.push({ ...s, factionId: fid, factionName: fName })
      }
    }
  }

  // Filter by selected tab
  const showCore = filter === 'all' || filter === 'core'
  const showFaction = (fid: string) => filter === 'all' || filter === fid

  // Phase filter
  const phases = ['All', 'Command', 'Movement', 'Shooting', 'Fight', 'Any']
  const matchesPhase = (s: Stratagem) =>
    phaseFilter === 'All' || s.phase.includes(phaseFilter)

  const visibleCore = coreStrats.filter(matchesPhase)
  const visibleFaction = factionStrats.filter(
    s => showFaction(s.factionId) && matchesPhase(s)
  )

  // Group faction strats by faction then by detachment
  const factionGroups: Record<string, typeof factionStrats> = {}
  for (const s of visibleFaction) {
    const key = s.factionId
    if (!factionGroups[key]) factionGroups[key] = []
    factionGroups[key].push(s)
  }

  return (
    <div className="strat-root">
      {/* CP tracker */}
      <div className="strat-cp-tracker">
        <div className="strat-cp-tracker-label">COMMAND POINTS</div>
        <div className="strat-cp-controls">
          <button className="strat-cp-btn" onClick={() => setCp(c => Math.max(0, c - 1))}>−</button>
          <span className="strat-cp-value">{cp}</span>
          <button className="strat-cp-btn" onClick={() => setCp(c => c + 1)}>+</button>
        </div>
        <div className="strat-cp-actions">
          <button className="strat-reset-btn" onClick={resetUsed} title="Reset used stratagems">
            ↩ Reset Used
          </button>
        </div>
      </div>

      {/* Detachment reminder */}
      {rosterDetachments.length > 0 && (
        <div className="strat-detachments">
          <span className="lb-section-label">Active Detachments:</span>
          {rosterDetachments.map(d => (
            <span key={d} className="strat-det-chip">{d}</span>
          ))}
        </div>
      )}

      {/* Faction filter tabs */}
      <div className="strat-filter-bar">
        <button
          className={`strat-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`strat-filter-btn ${filter === 'core' ? 'active' : ''}`}
          onClick={() => setFilter('core')}
        >
          Core
        </button>
        {rosterFactions.map(fid => {
          const fname = roster.find(u => u.factionId === fid)?.factionName ?? fid
          const color = getFactionColor(fid)
          return (
            <button
              key={fid}
              className={`strat-filter-btn ${filter === fid ? 'active' : ''}`}
              style={filter === fid ? { background: color, borderColor: color } : {}}
              onClick={() => setFilter(fid)}
            >
              {fname.split(' ').slice(-1)[0]}
            </button>
          )
        })}
      </div>

      {/* Phase filter */}
      <div className="strat-phase-bar">
        {phases.map(p => (
          <button
            key={p}
            className={`strat-phase-btn ${phaseFilter === p ? 'active' : ''}`}
            style={phaseFilter === p ? { background: phaseColor(p) } : {}}
            onClick={() => setPhaseFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Core stratagems */}
      {showCore && visibleCore.length > 0 && (
        <div className="strat-section">
          <div className="lb-section-label strat-section-label">Core Stratagems</div>
          {visibleCore.map(s => {
            const key = `core__${s.name}`
            return (
              <StratCard
                key={key}
                strat={s}
                used={usedStrats.has(key)}
                onToggle={() => toggleUsed(key)}
                isCore
              />
            )
          })}
        </div>
      )}

      {/* Faction stratagems */}
      {Object.entries(factionGroups).map(([fid, strats]) => {
        const fname = strats[0]?.factionName ?? fid
        const color = getFactionColor(fid)
        return (
          <div key={fid} className="strat-section">
            <div className="strat-faction-header" style={{ borderColor: color }}>
              <span className="lb-section-label">{fname}</span>
            </div>
            {strats.map(s => {
              const key = `${fid}__${s.name}`
              return (
                <StratCard
                  key={key}
                  strat={s}
                  used={usedStrats.has(key)}
                  onToggle={() => toggleUsed(key)}
                  accentColor={color}
                />
              )
            })}
          </div>
        )
      })}

      {/* Empty states */}
      {roster.length === 0 && filter !== 'core' && (
        <div className="strat-empty">
          <p>Add units to your roster to see faction stratagems.</p>
        </div>
      )}

      {roster.length > 0 && visibleFaction.length === 0 && filter !== 'core' && filter !== 'all' && (
        <div className="strat-empty">
          <p>No {phaseFilter !== 'All' ? phaseFilter + ' phase ' : ''}stratagems found for this faction.</p>
        </div>
      )}
    </div>
  )
}
