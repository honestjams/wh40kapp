import React, { useEffect, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export type WeaponProfile = {
  name: string
  Range?: string
  A?: string
  BS?: string
  WS?: string
  S?: string
  AP?: string
  D?: string
  Keywords?: string
}

export type Detachment = {
  name: string
  abilities: { name: string; desc: string }[]
}

export type Unit = {
  id: string
  name: string
  points: number
  factionId: string
  factionName: string
  detachment?: Detachment
  stats: Record<string, string>
  keywords: string[]
  rangedWeapons: WeaponProfile[]
  meleeWeapons: WeaponProfile[]
  abilities: { name: string; desc: string }[]
  count: number
}

type FactionEntry = { id: string; name: string; file: string }
type RawUnit = Omit<Unit, 'id' | 'factionId' | 'factionName' | 'detachment' | 'count'>

type Props = {
  roster: Unit[]
  onAdd: (unit: Unit) => void
  onRemove: (id: string) => void
  onClear: () => void
}

// ── Faction colour map ────────────────────────────────────────────────────────

const FACTION_COLORS: Record<string, string> = {
  'aeldari-craftworlds':        '#1a6b8a',
  'chaos-daemons':              '#7b1fa2',
  'imperium-astra-militarum':   '#6d5a2c',
  'chaos-space-marines':        '#8b0000',
  'chaos-death-guard':          '#4a6741',
  'chaos-thousand-sons':        '#1b4a8a',
  'chaos-world-eaters':         '#b71c1c',
  'genestealer-cults':          '#6a1a6a',
  'imperium-adepta-sororitas':  '#8b1a3a',
  'imperium-adeptus-custodes':  '#b8860b',
  'imperium-adeptus-mechanicus':'#8b0000',
  'imperium-blood-angels':      '#8b0000',
  'imperium-dark-angels':       '#1a4a1a',
  'imperium-grey-knights':      '#4a5a6a',
  'imperium-space-marines':     '#1a3a6a',
  'imperium-space-wolves':      '#3a5a7a',
  'leagues-of-votann':          '#5a4a2a',
  'necrons':                    '#1a6a3a',
  'orks':                       '#4a6a1a',
  'tau-empire':                 '#1a5a6a',
  'tyranids':                   '#6a1a7a',
}

export function getFactionColor(id: string) {
  return FACTION_COLORS[id] ?? '#333'
}

// ── Steps ─────────────────────────────────────────────────────────────────────
type Step = 'faction' | 'detachment' | 'units'

// ── Component ────────────────────────────────────────────────────────────────

export default function ListBuilder({ roster, onAdd, onRemove, onClear }: Props) {
  const [factions, setFactions] = useState<FactionEntry[]>([])
  const [selectedFaction, setSelectedFaction] = useState<FactionEntry | null>(null)
  const [availableDetachments, setAvailableDetachments] = useState<Detachment[]>([])
  const [selectedDetachment, setSelectedDetachment] = useState<Detachment | null>(null)
  const [factionUnits, setFactionUnits] = useState<RawUnit[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<RawUnit | null>(null)
  const [step, setStep] = useState<Step>('faction')

  useEffect(() => {
    fetch('/bsData-json/manifest.json')
      .then(r => r.json())
      .then(setFactions)
      .catch(() => setFactions([]))
  }, [])

  // Load faction data when faction is selected
  useEffect(() => {
    if (!selectedFaction) { setFactionUnits([]); setAvailableDetachments([]); return }
    setLoading(true)
    setPreview(null)
    setSearch('')
    fetch(selectedFaction.file)
      .then(r => r.json())
      .then((data: { units: RawUnit[]; detachments: Detachment[] }) => {
        setFactionUnits(data.units ?? [])
        setAvailableDetachments(data.detachments ?? [])
        setLoading(false)
      })
      .catch(() => { setFactionUnits([]); setAvailableDetachments([]); setLoading(false) })
  }, [selectedFaction])

  const filtered = factionUnits.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalPoints = roster.reduce((s, u) => s + u.points * (u.count ?? 1), 0)

  const handleAdd = (raw: RawUnit) => {
    if (!selectedFaction) return
    const existing = roster.find(
      r => r.name === raw.name && r.factionId === selectedFaction.id
    )
    if (existing) {
      onAdd({ ...existing, count: existing.count + 1 })
    } else {
      onAdd({
        ...raw,
        id: `${selectedFaction.id}__${raw.name}__${Date.now()}`,
        factionId: selectedFaction.id,
        factionName: selectedFaction.name,
        detachment: selectedDetachment ?? undefined,
        count: 1,
      })
    }
  }

  const goToFaction = () => { setSelectedFaction(null); setSelectedDetachment(null); setStep('faction') }
  const goToDetachment = () => setStep('detachment')
  const goToUnits = () => setStep('units')

  const accentColor = selectedFaction ? getFactionColor(selectedFaction.id) : '#333'

  // ── Roster panel (shared across steps) ───────────────────────────────────
  const RosterPanel = () => roster.length === 0 ? null : (
    <div className="lb-roster-list">
      <div className="lb-roster-header">
        <span className="lb-section-label">Roster — {totalPoints}pts</span>
        <button className="lb-clear-btn" onClick={onClear}>Clear</button>
      </div>
      {roster.map(u => (
        <div key={u.id} className="lb-roster-row">
          <div className="lb-roster-info">
            <span className="lb-roster-name">{u.name}</span>
            <span className="lb-roster-faction">{u.factionName}{u.detachment ? ` · ${u.detachment.name}` : ''}</span>
          </div>
          <div className="lb-roster-right">
            {u.count > 1 && <span className="lb-roster-count">×{u.count}</span>}
            <span className="lb-roster-pts">{u.points * u.count}pts</span>
            <button className="lb-remove-btn" onClick={() => onRemove(u.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  )

  // ── Step 1: Faction selection ─────────────────────────────────────────────
  if (step === 'faction') {
    return (
      <div className="lb-root">
        <div className="lb-header">
          <h2 className="lb-title">Select Faction</h2>
          {roster.length > 0 && (
            <span className="lb-pts">{totalPoints}pts · {roster.length} units</span>
          )}
        </div>
        {factions.length === 0 && <p className="lb-hint">Loading factions…</p>}
        <div className="faction-grid">
          {factions.map(f => (
            <button
              key={f.id}
              className="faction-card"
              style={{ '--faction-color': getFactionColor(f.id) } as React.CSSProperties}
              onClick={() => {
                setSelectedFaction(f)
                setSelectedDetachment(null)
                setStep('detachment')
              }}
            >
              <span className="faction-card-name">{f.name}</span>
            </button>
          ))}
        </div>
        <RosterPanel />
      </div>
    )
  }

  // ── Step 2: Detachment selection ──────────────────────────────────────────
  if (step === 'detachment') {
    return (
      <div className="lb-root">
        <div
          className="lb-faction-bar"
          style={{ '--faction-color': accentColor } as React.CSSProperties}
        >
          <button className="lb-back-btn" onClick={goToFaction}>← Factions</button>
          <span className="lb-faction-name">{selectedFaction?.name}</span>
        </div>

        {loading && <p className="lb-hint">Loading…</p>}

        {!loading && availableDetachments.length === 0 && (
          <div className="lb-detachment-empty">
            <p className="lb-hint">No detachment data found in catalog.</p>
            <button className="lb-skip-btn" onClick={goToUnits}>Browse Units without Detachment →</button>
          </div>
        )}

        {!loading && availableDetachments.length > 0 && (
          <>
            <div className="lb-step-label">Choose Detachment</div>
            <div className="lb-detachment-list">
              {availableDetachments.map(d => (
                <button
                  key={d.name}
                  className={`lb-detachment-card ${selectedDetachment?.name === d.name ? 'selected' : ''}`}
                  style={{ '--faction-color': accentColor } as React.CSSProperties}
                  onClick={() => setSelectedDetachment(d)}
                >
                  <div className="lb-det-name">{d.name}</div>
                  {d.abilities.slice(0, 1).map(a => (
                    <div key={a.name} className="lb-det-rule">
                      <span className="lb-det-rule-name">{a.name}: </span>
                      <span className="lb-det-rule-desc">{a.desc.slice(0, 120)}{a.desc.length > 120 ? '…' : ''}</span>
                    </div>
                  ))}
                </button>
              ))}
            </div>
            <div className="lb-det-nav">
              <button
                className="lb-skip-btn"
                onClick={goToUnits}
              >
                Skip (no detachment)
              </button>
              <button
                className="lb-confirm-btn"
                style={{ background: accentColor }}
                disabled={!selectedDetachment}
                onClick={goToUnits}
              >
                Confirm: {selectedDetachment?.name ?? 'Select one'} →
              </button>
            </div>
          </>
        )}

        <RosterPanel />
      </div>
    )
  }

  // ── Step 3: Unit list ─────────────────────────────────────────────────────
  return (
    <div className="lb-root">
      <div
        className="lb-faction-bar"
        style={{ '--faction-color': accentColor } as React.CSSProperties}
      >
        <button className="lb-back-btn" onClick={goToDetachment}>← Detachment</button>
        <div className="lb-faction-bar-info">
          <span className="lb-faction-name">{selectedFaction?.name}</span>
          {selectedDetachment && (
            <span className="lb-detachment-chip">{selectedDetachment.name}</span>
          )}
        </div>
      </div>

      <div className="lb-search-row">
        <input
          className="lb-search"
          type="text"
          placeholder="Search units…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading && <p className="lb-hint">Loading units…</p>}

      {!loading && (
        <div className="lb-unit-list">
          {filtered.length === 0 && <p className="lb-hint">No units found.</p>}
          {filtered.map(u => {
            const inRoster = roster.find(r => r.name === u.name && r.factionId === selectedFaction?.id)
            return (
              <div
                key={u.name}
                className={`lb-unit-row ${preview?.name === u.name ? 'selected' : ''}`}
                onClick={() => setPreview(preview?.name === u.name ? null : u)}
              >
                <div className="lb-unit-info">
                  <span className="lb-unit-name">{u.name}</span>
                  {u.stats && (
                    <span className="lb-unit-stats-mini">
                      {u.stats['M'] && `M${u.stats['M']} `}
                      {u.stats['T'] && `T${u.stats['T']} `}
                      {u.stats['SV'] && `Sv${u.stats['SV']}`}
                    </span>
                  )}
                </div>
                <div className="lb-unit-right">
                  {inRoster && <span className="lb-in-roster">×{inRoster.count}</span>}
                  <span className="lb-unit-pts">{u.points > 0 ? `${u.points}pts` : '—'}</span>
                  <button
                    className="lb-add-btn"
                    onClick={e => { e.stopPropagation(); handleAdd(u) }}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <div className="lb-preview">
          <div className="lb-preview-header">
            <span className="lb-preview-name">{preview.name}</span>
            {preview.points > 0 && <span className="lb-preview-pts">{preview.points}pts</span>}
          </div>
          {Object.keys(preview.stats).length > 0 && (
            <div className="lb-preview-stats">
              {Object.entries(preview.stats).map(([k, v]) => (
                <div key={k} className="lb-stat-box">
                  <div className="lb-stat-val">{v}</div>
                  <div className="lb-stat-key">{k}</div>
                </div>
              ))}
            </div>
          )}
          {preview.abilities.length > 0 && (
            <div className="lb-preview-abilities">
              {preview.abilities.slice(0, 2).map(a => (
                <div key={a.name} className="lb-preview-ability">
                  <strong>{a.name}</strong>
                  <p>{a.desc}</p>
                </div>
              ))}
            </div>
          )}
          <button
            className="lb-add-full-btn"
            style={{ background: accentColor, color: '#fff' }}
            onClick={() => handleAdd(preview)}
          >
            Add to Roster
          </button>
        </div>
      )}

      <RosterPanel />
    </div>
  )
}
