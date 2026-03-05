import React, { useEffect, useState } from 'react'
import ListBuilder, { Unit } from './ListBuilder'
import CardCarousel from './CardCarousel'
import SetupWizard, { GameConfig } from './SetupWizard'
import BattleTracker from './BattleTracker'
import StratagemView from './StratagemView'

const ROSTER_KEY = 'wh40k-roster-v2'
const GAME_KEY   = 'wh40k-active-game'

type View = 'list' | 'cards' | 'strats' | 'setup' | 'battle'

export default function App() {
  const [roster, setRoster] = useState<Unit[]>(() => {
    try {
      const saved = localStorage.getItem(ROSTER_KEY)
      return saved ? (JSON.parse(saved) as Unit[]) : []
    } catch { return [] }
  })

  const [gameConfig, setGameConfig] = useState<GameConfig | null>(() => {
    try {
      const raw = localStorage.getItem(GAME_KEY)
      return raw ? (JSON.parse(raw) as { config: GameConfig }).config : null
    } catch { return null }
  })

  const [activeView, setActiveView] = useState<View>(() => {
    try {
      const raw = localStorage.getItem(GAME_KEY)
      if (raw) {
        const g = JSON.parse(raw) as { config: GameConfig; state?: unknown }
        if (g.config && g.state) return 'battle'
      }
    } catch { /* ignore */ }
    return 'list'
  })

  useEffect(() => {
    try { localStorage.setItem(ROSTER_KEY, JSON.stringify(roster)) } catch { /* ignore */ }
  }, [roster])

  const handleAdd = (unit: Unit) => {
    setRoster(prev => {
      const existing = prev.find(u => u.id === unit.id)
      if (existing) return prev.map(u => u.id === unit.id ? { ...u, count: unit.count } : u)
      return [...prev, unit]
    })
  }

  const handleRemove = (id: string) => {
    setRoster(prev => {
      const unit = prev.find(u => u.id === id)
      if (unit && unit.count > 1) return prev.map(u => u.id === id ? { ...u, count: u.count - 1 } : u)
      return prev.filter(u => u.id !== id)
    })
  }

  const handleClear = () => {
    if (roster.length === 0 || confirm('Clear all units from your roster?')) setRoster([])
  }

  const handleGameStart = (config: GameConfig) => {
    try { localStorage.setItem(GAME_KEY, JSON.stringify({ config })) } catch { /* ignore */ }
    setGameConfig(config)
    setActiveView('battle')
  }

  const handleNewGame = () => { setGameConfig(null); setActiveView('setup') }

  const totalPoints = roster.reduce((s, u) => s + u.points * (u.count ?? 1), 0)

  const NAV_ITEMS: { id: View; icon: string; label: string }[] = [
    { id: 'list',   icon: '⚔',  label: 'Roster' },
    { id: 'cards',  icon: '🃏', label: 'Cards' },
    { id: 'strats', icon: '⚡', label: 'Strats' },
    { id: 'setup',  icon: '⚙',  label: 'Setup' },
    { id: 'battle', icon: '🎲', label: gameConfig ? 'Battle•' : 'Battle' },
  ]

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-header-inner">
          <span className="app-title">GRIMDARK COMPANION</span>
          {roster.length > 0 && activeView !== 'list' && (
            <span className="app-header-pts">{totalPoints}pts</span>
          )}
        </div>
      </header>

      <main>
        {activeView === 'list' && (
          <ListBuilder
            roster={roster}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onClear={handleClear}
          />
        )}

        {activeView === 'cards' && <CardCarousel items={roster} />}

        {activeView === 'strats' && <StratagemView roster={roster} />}

        {activeView === 'setup' && (
          <SetupWizard rosterUnits={roster} onStart={handleGameStart} />
        )}

        {activeView === 'battle' && gameConfig && (
          <BattleTracker config={gameConfig} onNewGame={handleNewGame} />
        )}

        {activeView === 'battle' && !gameConfig && (
          <div className="no-game-state">
            <p>No active game — set up a battle first.</p>
            <button className="wizard-btn wizard-btn-primary" onClick={() => setActiveView('setup')}>
              Go to Setup
            </button>
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="nav-container">
        <div className="nav-menu">
          {NAV_ITEMS.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`nav-item ${activeView === id ? 'active' : ''} ${id === 'battle' && gameConfig ? 'nav-item-live' : ''}`}
              onClick={() => setActiveView(id)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-inner">
          <span className="footer-text">Grimdark Companion — free fan tool</span>
          <a
            className="footer-paypal"
            href="https://paypal.me/PLACEHOLDER"
            target="_blank"
            rel="noopener noreferrer"
          >
            ☕ Support the Dev
          </a>
        </div>
        <p className="footer-disclaimer">
          Not affiliated with Games Workshop. Warhammer 40,000 © Games Workshop Ltd.
        </p>
      </footer>
    </div>
  )
}
