import React, { useEffect, useRef, useState } from 'react'

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
  subfactionId?: string
  subfactionName?: string
  detachment?: Detachment
  stats: Record<string, string>
  keywords: string[]
  rangedWeapons: WeaponProfile[]
  meleeWeapons: WeaponProfile[]
  abilities: { name: string; desc: string }[]
  count: number
}

type SubfactionEntry = {
  id: string
  name: string
  file: string
  color?: string
  lore?: string
}

type FactionEntry = {
  id: string
  name: string
  file: string
  allegiance?: string
  hasSubfactions?: boolean
  subfactions?: SubfactionEntry[]
}

type RawUnit = Omit<Unit, 'id' | 'factionId' | 'factionName' | 'subfactionId' | 'subfactionName' | 'detachment' | 'count'>

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
  'chaos-emperors-children':    '#9c27b0',
  'chaos-knights':              '#6a1a2a',
  'imperium-imperial-knights':  '#c8922a',
  'imperium-ultramarines':      '#0d47a1',
  'imperium-black-templars':    '#1a1a1a',
}

const ALLEGIANCE_LABELS: Record<string, string> = {
  imperium: 'Imperium',
  chaos: 'Chaos',
  xenos: 'Xenos',
}

const ALLEGIANCE_COLORS: Record<string, string> = {
  imperium: '#c8922a',
  chaos:    '#b91c1c',
  xenos:    '#1a6b8a',
}

export function getFactionColor(id: string) {
  return FACTION_COLORS[id] ?? '#333'
}

// ── Steps ─────────────────────────────────────────────────────────────────────
type Step = 'faction' | 'subfaction' | 'detachment' | 'units'

// ── Faction Icon / Sigil (first letter styled) ───────────────────────────────
function FactionSigil({ name, color }: { name: string; color: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="faction-sigil" style={{ '--sigil-color': color } as React.CSSProperties}>
      {initials}
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ListBuilder({ roster, onAdd, onRemove, onClear }: Props) {
  const [factions, setFactions] = useState<FactionEntry[]>([])
  const [selectedFaction, setSelectedFaction] = useState<FactionEntry | null>(null)
  const [selectedSubfaction, setSelectedSubfaction] = useState<SubfactionEntry | null>(null)
  const [availableDetachments, setAvailableDetachments] = useState<Detachment[]>([])
  const [selectedDetachment, setSelectedDetachment] = useState<Detachment | null>(null)
  const [factionUnits, setFactionUnits] = useState<RawUnit[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<RawUnit | null>(null)
  const [step, setStep] = useState<Step>('faction')
  const [activeAllegiance, setActiveAllegiance] = useState<string>('all')
  const [animIn, setAnimIn] = useState(false)

  useEffect(() => {
    fetch('/bsData-json/manifest.json')
      .then(r => r.json())
      .then((data: FactionEntry[]) => {
        setFactions(data)
        setTimeout(() => setAnimIn(true), 50)
      })
      .catch(() => setFactions([]))
  }, [])

  // Load faction data
  const loadFactionData = async (factionFile: string, subfactionFile?: string) => {
    setLoading(true)
    setPreview(null)
    setSearch('')
    try {
      const primary = await fetch(factionFile).then(r => r.json()) as { units: RawUnit[]; detachments: Detachment[] }
      let units = primary.units ?? []
      let detachments = primary.detachments ?? []

      if (subfactionFile) {
        const sub = await fetch(subfactionFile).then(r => r.json()) as { units: RawUnit[]; detachments: Detachment[] }
        // Merge: subfaction units first, then add SM base units not already present by name
        const subUnitNames = new Set((sub.units ?? []).map(u => u.name))
        const baseOnly = units.filter(u => !subUnitNames.has(u.name))
        units = [...(sub.units ?? []), ...baseOnly]
        // Merge detachments: subfaction detachments preferred
        detachments = [...(sub.detachments ?? []), ...detachments]
      }

      setFactionUnits(units)
      setAvailableDetachments(detachments)
    } catch {
      setFactionUnits([])
      setAvailableDetachments([])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!selectedFaction) { setFactionUnits([]); setAvailableDetachments([]); return }
    if (selectedFaction.hasSubfactions && !selectedSubfaction) return
    loadFactionData(
      selectedFaction.file,
      selectedSubfaction?.file
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFaction, selectedSubfaction])

  const filtered = factionUnits.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalPoints = roster.reduce((s, u) => s + u.points * (u.count ?? 1), 0)

  const handleAdd = (raw: RawUnit) => {
    if (!selectedFaction) return
    const effectiveFactionId = selectedSubfaction?.id ?? selectedFaction.id
    const existing = roster.find(
      r => r.name === raw.name && r.factionId === selectedFaction.id
    )
    if (existing) {
      onAdd({ ...existing, count: existing.count + 1 })
    } else {
      onAdd({
        ...raw,
        id: `${effectiveFactionId}__${raw.name}__${Date.now()}`,
        factionId: selectedFaction.id,
        factionName: selectedFaction.name,
        subfactionId: selectedSubfaction?.id,
        subfactionName: selectedSubfaction?.name,
        detachment: selectedDetachment ?? undefined,
        count: 1,
      })
    }
  }

  const goToFaction = () => {
    setSelectedFaction(null)
    setSelectedSubfaction(null)
    setSelectedDetachment(null)
    setStep('faction')
  }
  const goToSubfaction = () => { setSelectedSubfaction(null); setSelectedDetachment(null); setStep('subfaction') }
  const goToDetachment = () => setStep('detachment')
  const goToUnits = () => setStep('units')

  const accentColor = selectedSubfaction
    ? (selectedSubfaction.color ?? getFactionColor(selectedSubfaction.id))
    : selectedFaction
      ? getFactionColor(selectedFaction.id)
      : '#333'

  const displayFactionName = selectedSubfaction
    ? `${selectedFaction?.name} – ${selectedSubfaction.name}`
    : selectedFaction?.name ?? ''

  // ── Roster panel ────────────────────────────────────────────────────────────
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
            <span className="lb-roster-faction">
              {u.subfactionName ?? u.factionName}
              {u.detachment ? ` · ${u.detachment.name}` : ''}
            </span>
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

  // ── Step 1: Faction selection ────────────────────────────────────────────────
  if (step === 'faction') {
    const allegiances = ['all', 'imperium', 'chaos', 'xenos']
    const visibleFactions = factions.filter(f =>
      activeAllegiance === 'all' || f.allegiance === activeAllegiance
    )

    return (
      <div className="lb-root">
        <div className="lb-faction-header">
          <h2 className="lb-title">Choose Your Faction</h2>
          {roster.length > 0 && (
            <span className="lb-pts">{totalPoints}pts · {roster.length} units</span>
          )}
        </div>

        {/* Allegiance filter tabs */}
        <div className="lb-allegiance-tabs">
          {allegiances.map(a => (
            <button
              key={a}
              className={`lb-allegiance-tab ${activeAllegiance === a ? 'active' : ''}`}
              style={activeAllegiance === a && a !== 'all'
                ? { '--tab-color': ALLEGIANCE_COLORS[a] } as React.CSSProperties
                : undefined
              }
              onClick={() => setActiveAllegiance(a)}
            >
              {a === 'all' ? 'All' : ALLEGIANCE_LABELS[a]}
            </button>
          ))}
        </div>

        {factions.length === 0 && <p className="lb-hint">Loading factions…</p>}

        <div className={`faction-grid ${animIn ? 'anim-in' : ''}`}>
          {visibleFactions.map((f, i) => (
            <button
              key={f.id}
              className="faction-card"
              style={{
                '--faction-color': getFactionColor(f.id),
                '--anim-delay': `${i * 40}ms`,
              } as React.CSSProperties}
              onClick={() => {
                setSelectedFaction(f)
                setSelectedSubfaction(null)
                setSelectedDetachment(null)
                if (f.hasSubfactions) {
                  setStep('subfaction')
                } else {
                  setStep('detachment')
                }
              }}
            >
              <FactionSigil name={f.name} color={getFactionColor(f.id)} />
              <div className="faction-card-body">
                <span className="faction-card-name">{f.name}</span>
                {f.hasSubfactions && (
                  <span className="faction-card-sub-hint">
                    {f.subfactions?.length} sub-factions ›
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        <RosterPanel />
      </div>
    )
  }

  // ── Step 2: Sub-faction selection ────────────────────────────────────────────
  if (step === 'subfaction' && selectedFaction?.hasSubfactions) {
    const subfactions = selectedFaction.subfactions ?? []
    return (
      <div className="lb-root">
        <div
          className="lb-faction-bar"
          style={{ '--faction-color': getFactionColor(selectedFaction.id) } as React.CSSProperties}
        >
          <button className="lb-back-btn" onClick={goToFaction}>← Factions</button>
          <span className="lb-faction-name">{selectedFaction.name}</span>
        </div>

        <div className="lb-subfaction-header">
          <div className="lb-step-label">Choose Chapter</div>
          <p className="lb-subfaction-hint">
            Sub-faction units are combined with core {selectedFaction.name} units
          </p>
        </div>

        <div className="lb-subfaction-grid">
          {subfactions.map((sf, i) => (
            <button
              key={sf.id}
              className="lb-subfaction-card"
              style={{
                '--sf-color': sf.color ?? getFactionColor(sf.id),
                '--anim-delay': `${i * 60}ms`,
              } as React.CSSProperties}
              onClick={() => {
                setSelectedSubfaction(sf)
                setStep('detachment')
              }}
            >
              <div className="lb-sf-sigil">
                {sf.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="lb-sf-info">
                <span className="lb-sf-name">{sf.name}</span>
                {sf.lore && <span className="lb-sf-lore">{sf.lore}</span>}
              </div>
            </button>
          ))}

          {/* Option to play base Space Marines without a sub-faction */}
          <button
            className="lb-subfaction-card lb-subfaction-card-base"
            style={{ '--sf-color': getFactionColor(selectedFaction.id) } as React.CSSProperties}
            onClick={() => {
              setSelectedSubfaction(null)
              setStep('detachment')
            }}
          >
            <div className="lb-sf-sigil">SM</div>
            <div className="lb-sf-info">
              <span className="lb-sf-name">Core Space Marines</span>
              <span className="lb-sf-lore">No sub-faction — full Codex Astartes roster</span>
            </div>
          </button>
        </div>

        <RosterPanel />
      </div>
    )
  }

  // ── Step 3: Detachment selection ──────────────────────────────────────────
  if (step === 'detachment') {
    return (
      <div className="lb-root">
        <div
          className="lb-faction-bar"
          style={{ '--faction-color': accentColor } as React.CSSProperties}
        >
          <button className="lb-back-btn" onClick={selectedFaction?.hasSubfactions ? goToSubfaction : goToFaction}>
            ← {selectedFaction?.hasSubfactions ? selectedFaction.name : 'Factions'}
          </button>
          <span className="lb-faction-name">{displayFactionName}</span>
        </div>

        {loading && <p className="lb-hint">Loading…</p>}

        {!loading && availableDetachments.length === 0 && (
          <div className="lb-detachment-empty">
            <p className="lb-hint">No detachment data found.</p>
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
              <button className="lb-skip-btn" onClick={goToUnits}>
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

  // ── Step 4: Unit list ─────────────────────────────────────────────────────
  return (
    <div className="lb-root">
      <div
        className="lb-faction-bar"
        style={{ '--faction-color': accentColor } as React.CSSProperties}
      >
        <button className="lb-back-btn" onClick={goToDetachment}>← Detachment</button>
        <div className="lb-faction-bar-info">
          <span className="lb-faction-name">{displayFactionName}</span>
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
