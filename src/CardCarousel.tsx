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
  'chaos-emperors-children':    '#9c27b0',
  'chaos-knights':              '#6a1a2a',
  'imperium-imperial-knights':  '#c8922a',
  'imperium-ultramarines':      '#0d47a1',
  'imperium-black-templars':    '#1a1a1a',
}

function getFactionColor(factionId: string) {
  return FACTION_COLORS[factionId] ?? '#333'
}

// ── Compact Weapon Table ────────────────────────────────────────────────────

function WeaponTable({ weapons, type }: { weapons: WeaponProfile[]; type: 'ranged' | 'melee' }) {
  if (weapons.length === 0) return null
  const isRanged = type === 'ranged'
  return (
    <div className="dc-weapon-block">
      <div className="dc-weapon-type-label">{isRanged ? '⦿ Ranged' : '⚔ Melee'}</div>
      <table className="dc-weapon-table">
        <thead>
          <tr>
            <th className="dc-wh dc-wh-name">Weapon</th>
            {isRanged && <th className="dc-wh">Rng</th>}
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

// ── Stat Block ─────────────────────────────────────────────────────────────

const STAT_ORDER = ['M', 'T', 'SV', 'W', 'LD', 'OC']

function StatBlock({ stats }: { stats: Record<string, string> }) {
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

// ── Main Component ──────────────────────────────────────────────────────────

export default function CardCarousel({ items }: Props) {
  const [index, setIndex] = useState(0)
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setIndex(0) }, [items.length])

  const navigate = (direction: 'prev' | 'next') => {
    if (isAnimating) return
    const newIndex = direction === 'prev'
      ? Math.max(0, index - 1)
      : Math.min(items.length - 1, index + 1)
    if (newIndex === index) return

    setSlideDir(direction === 'prev' ? 'right' : 'left')
    setIsAnimating(true)
    setTimeout(() => {
      setIndex(newIndex)
      setSlideDir(null)
      setIsAnimating(false)
    }, 250)
  }

  // Swipe / drag + edge tap
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let startX = 0
    let startY = 0
    let dist = 0
    let isTap = false

    const onDown = (e: TouchEvent | MouseEvent) => {
      startX = 'touches' in e ? e.touches[0].clientX : e.clientX
      startY = 'touches' in e ? e.touches[0].clientY : e.clientY
      dist = 0
      isTap = true
      window.addEventListener('touchmove', onMove as EventListener, { passive: true })
      window.addEventListener('mousemove', onMove as EventListener)
      window.addEventListener('touchend', onUp)
      window.addEventListener('mouseup', onUp)
    }

    const onMove = (e: TouchEvent | MouseEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY
      dist = x - startX
      const vertDist = Math.abs(y - startY)
      if (Math.abs(dist) > 8 || vertDist > 8) isTap = false
    }

    const onUp = (e: TouchEvent | MouseEvent) => {
      window.removeEventListener('touchmove', onMove as EventListener)
      window.removeEventListener('mousemove', onMove as EventListener)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('mouseup', onUp)

      if (isTap) {
        // Edge tap: left 20% = prev, right 20% = next
        const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : (e as MouseEvent).clientX
        const rect = el.getBoundingClientRect()
        const relX = clientX - rect.left
        const width = rect.width
        if (relX < width * 0.2) {
          navigate('prev')
        } else if (relX > width * 0.8) {
          navigate('next')
        }
        return
      }

      if (dist > 50) navigate('prev')
      else if (dist < -50) navigate('next')
    }

    el.addEventListener('touchstart', onDown as EventListener, { passive: true })
    el.addEventListener('mousedown', onDown as EventListener)
    return () => {
      el.removeEventListener('touchstart', onDown as EventListener)
      el.removeEventListener('mousedown', onDown as EventListener)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length, isAnimating])

  // Keyboard nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigate('prev')
      if (e.key === 'ArrowRight') navigate('next')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, items.length])

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
  const accentColor = getFactionColor(unit.subfactionId ?? unit.factionId)

  const slideClass = slideDir === 'left' ? 'dc-slide-left' : slideDir === 'right' ? 'dc-slide-right' : ''

  return (
    <div className="dc-root" ref={containerRef}>
      {/* Card */}
      <div className={`dc-card ${slideClass}`} ref={cardRef} key={`${unit.id}-${index}`}>

        {/* Faction color stripe */}
        <div className="dc-color-stripe" style={{ background: accentColor }} />

        {/* Header */}
        <div className="dc-header" style={{ background: `linear-gradient(135deg, ${accentColor}dd 0%, ${accentColor}88 100%)` }}>
          <div className="dc-header-left">
            <div className="dc-unit-name">{unit.name}</div>
            <div className="dc-faction-name">
              {unit.subfactionName ?? unit.factionName}
              {unit.detachment ? ` · ${unit.detachment.name}` : ''}
            </div>
          </div>
          {unit.points > 0 && (
            <div className="dc-points-badge">
              {unit.points * (unit.count ?? 1)}
              <span className="dc-pts-label">pts</span>
            </div>
          )}
        </div>

        {/* Stats */}
        {Object.keys(unit.stats).length > 0 && (
          <div className="dc-stats-section">
            <StatBlock stats={unit.stats} />
          </div>
        )}

        {/* Keywords */}
        {unit.keywords.length > 0 && (
          <div className="dc-keywords">
            {unit.keywords.slice(0, 8).map(k => (
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
            <div className="dc-abilities-list">
              {unit.abilities.map(a => (
                <div key={a.name} className="dc-ability">
                  <span className="dc-ability-name">{a.name}: </span>
                  <span className="dc-ability-desc">{a.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress indicator */}
      <div className="dc-progress-row">
        <span className="dc-counter">{index + 1} / {items.length}</span>
        <div className="dc-dots">
          {items.length <= 12 && items.map((_, i) => (
            <button
              key={i}
              className={`dc-dot ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`Go to card ${i + 1}`}
            />
          ))}
        </div>
        <span className="dc-swipe-hint">swipe or tap edges</span>
      </div>
    </div>
  )
}
