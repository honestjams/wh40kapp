import React, { useEffect, useState } from 'react'
import ListBuilder, { Unit } from './ListBuilder'
import CardCarousel from './CardCarousel'
import SetupWizard, { GameConfig } from './SetupWizard'
import BattleTracker from './BattleTracker'

const ROSTER_KEY = 'wh40k-roster-v2'
const GAME_KEY   = 'wh40k-active-game'

type View = 'list' | 'setup' | 'battle' | 'cards'

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
      if (existing) {
        // Update count for existing unit
        return prev.map(u => u.id === unit.id ? { ...u, count: unit.count } : u)
      }
      return [...prev, unit]
    })
  }

  const handleRemove = (id: string) => {
    setRoster(prev => {
      const unit = prev.find(u => u.id === id)
      if (unit && unit.count > 1) {
        return prev.map(u => u.id === id ? { ...u, count: u.count - 1 } : u)
      }
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

  const handleNewGame = () => {
    setGameConfig(null)
    setActiveView('setup')
  }

  const totalPoints = roster.reduce((s, u) => s + u.points * (u.count ?? 1), 0)

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

        {activeView === 'cards' && (
          <CardCarousel items={roster} />
        )}
      </main>

      <nav className="nav-container">
        <div className="nav-menu">
          <button
            className={`nav-item ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
          >
            <span className="nav-icon">⚔</span>
            <span>Roster</span>
          </button>
          <button
            className={`nav-item ${activeView === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveView('cards')}
          >
            <span className="nav-icon">🃏</span>
            <span>Cards</span>
          </button>
          <button
            className={`nav-item ${activeView === 'setup' ? 'active' : ''}`}
            onClick={() => setActiveView('setup')}
          >
            <span className="nav-icon">⚙</span>
            <span>Setup</span>
          </button>
          <button
            className={`nav-item ${activeView === 'battle' ? 'active' : ''} ${gameConfig ? 'nav-item-live' : ''}`}
            onClick={() => setActiveView('battle')}
          >
            <span className="nav-icon">🎲</span>
            <span>Battle{gameConfig ? ' •' : ''}</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
