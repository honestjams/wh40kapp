import React, { useEffect, useRef, useState } from 'react'
import type { Unit, WeaponProfile } from './ListBuilder'

type Props = { items: Unit[] }

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

function getFactionColor(factionId: string) {
  return FACTION_COLORS[factionId] ?? '#333'
}

// ── Weapon table ─────────────────────────────────────────────────────────────

function WeaponTable({ weapons, type }: { weapons: WeaponProfile[]; type: 'ranged' | 'melee' }) {
  if (weapons.length === 0) return null
  const isRanged = type === 'ranged'
  return (
    <div className="dc-weapon-block">
      <div className="dc-weapon-type-label">{isRanged ? 'Ranged Weapons' : 'Melee Weapons'}</div>
      <table className="dc-weapon-table">
        <thead>
          <tr>
            <th className="dc-wh dc-wh-name">Weapon</th>
            {isRanged && <th className="dc-wh">Range</th>}
            <th className="dc-wh">A</th>
            <th className="dc-wh">{isRanged ? 'BS' : 'WS'}</th>
            <th className="dc-wh">S</th>
            <th className="dc-wh">AP</th>
            <th className="dc-wh">D</th>
          </tr>
        </thead>
        <tbody>
          {weapons.map((w, i) => (
            <tr key={i} className={i % 2 === 0 ? 'dc-wr-even' : 'dc-wr-odd'}>
              <td className="dc-wh-name">
                <span className="dc-weapon-name">{w.name}</span>
                {w.Keywords && w.Keywords !== '-' && (
                  <span className="dc-weapon-kw">[{w.Keywords}]</span>
                )}
              </td>
              {isRanged && <td className="dc-wc">{w.Range ?? '—'}</td>}
              <td className="dc-wc">{w.A ?? '—'}</td>
              <td className="dc-wc">{isRanged ? (w.BS ?? '—') : (w.WS ?? '—')}</td>
              <td className="dc-wc">{w.S ?? '—'}</td>
              <td className="dc-wc">{w.AP ?? '—'}</td>
              <td className="dc-wc">{w.D ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Stat block ────────────────────────────────────────────────────────────────

const STAT_ORDER = ['M', 'T', 'SV', 'W', 'LD', 'OC']

function StatBlock({ stats }: { stats: Record<string, string> }) {
  // Show in canonical 10th-ed order, then any extras
  const ordered = STAT_ORDER.filter(k => k in stats)
  const extras = Object.keys(stats).filter(k => !STAT_ORDER.includes(k))
  const all = [...ordered, ...extras]
  return (
    <div className="dc-stats-row">
      {all.map(k => (
        <div key={k} className="dc-stat">
          <div className="dc-stat-val">{stats[k]}</div>
          <div className="dc-stat-key">{k}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CardCarousel({ items }: Props) {
  const [index, setIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setIndex(0) }, [items.length])

  // Swipe / drag navigation
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let startX = 0
    let dist = 0

    const onDown = (e: TouchEvent | MouseEvent) => {
      startX = 'touches' in e ? e.touches[0].clientX : e.clientX
      dist = 0
      window.addEventListener('touchmove', onMove as EventListener)
      window.addEventListener('mousemove', onMove as EventListener)
      window.addEventListener('touchend', onUp)
      window.addEventListener('mouseup', onUp)
    }
    const onMove = (e: TouchEvent | MouseEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX
      dist = x - startX
    }
    const onUp = () => {
      if (dist > 50) setIndex(i => Math.max(0, i - 1))
      else if (dist < -50) setIndex(i => Math.min(items.length - 1, i + 1))
      window.removeEventListener('touchmove', onMove as EventListener)
      window.removeEventListener('mousemove', onMove as EventListener)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('mouseup', onUp)
    }
    el.addEventListener('touchstart', onDown as EventListener)
    el.addEventListener('mousedown', onDown as EventListener)
    return () => {
      el.removeEventListener('touchstart', onDown as EventListener)
      el.removeEventListener('mousedown', onDown as EventListener)
    }
  }, [items.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex(i => Math.min(items.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length])

  if (items.length === 0) {
    return (
      <div className="dc-empty">
        <div className="dc-empty-icon">⚔</div>
        <p>No units in roster.</p>
        <p className="dc-empty-sub">Add units in the Roster tab.</p>
      </div>
    )
  }

  const unit = items[index]
  const accentColor = getFactionColor(unit.factionId)

  return (
    <div className="dc-root" ref={containerRef}>
      {/* Navigation arrows */}
      <button
        className="dc-nav dc-nav-prev"
        onClick={() => setIndex(i => Math.max(0, i - 1))}
        disabled={index === 0}
        aria-label="Previous card"
      >
        ‹
      </button>
      <button
        className="dc-nav dc-nav-next"
        onClick={() => setIndex(i => Math.min(items.length - 1, i + 1))}
        disabled={index === items.length - 1}
        aria-label="Next card"
      >
        ›
      </button>

      {/* The card */}
      <div className="dc-card">
        {/* Header band */}
        <div className="dc-header" style={{ background: accentColor }}>
          <div className="dc-header-left">
            <div className="dc-unit-name">{unit.name}</div>
            <div className="dc-faction-name">{unit.factionName}</div>
          </div>
          {unit.points > 0 && (
            <div className="dc-points-badge">{unit.points * (unit.count ?? 1)}<span className="dc-pts-label">pts</span></div>
          )}
        </div>

        {/* Stat block */}
        {Object.keys(unit.stats).length > 0 && (
          <div className="dc-stats-section">
            <StatBlock stats={unit.stats} />
          </div>
        )}

        {/* Invuln / keywords pills */}
        {unit.keywords.length > 0 && (
          <div className="dc-keywords">
            {unit.keywords.slice(0, 6).map(k => (
              <span key={k} className="dc-kw-pill">{k}</span>
            ))}
          </div>
        )}

        {/* Weapons */}
        <div className="dc-weapons-section">
          <WeaponTable weapons={unit.rangedWeapons} type="ranged" />
          <WeaponTable weapons={unit.meleeWeapons} type="melee" />
        </div>

        {/* Abilities */}
        {unit.abilities.length > 0 && (
          <div className="dc-abilities-section">
            <div className="dc-section-label">Abilities</div>
            {unit.abilities.map(a => (
              <div key={a.name} className="dc-ability">
                <span className="dc-ability-name">{a.name}: </span>
                <span className="dc-ability-desc">{a.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dot indicator */}
      <div className="dc-dots">
        {items.map((_, i) => (
          <button
            key={i}
            className={`dc-dot ${i === index ? 'active' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`Go to card ${i + 1}`}
          />
        ))}
      </div>

      <div className="dc-counter">
        {index + 1} / {items.length}
      </div>
    </div>
  )
}
