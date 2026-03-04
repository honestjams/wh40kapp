import React, { useEffect, useState } from 'react'
import ListBuilder, { Unit } from './ListBuilder'
import CardCarousel from './CardCarousel'
import SetupWizard, { GameConfig } from './SetupWizard'
import BattleTracker from './BattleTracker'

const ROSTER_KEY = 'wh40k-roster'
const GAME_KEY   = 'wh40k-active-game'

type View = 'list' | 'setup' | 'battle' | 'cards'

export default function App() {
  const [units, setUnits] = useState<Unit[]>(() => {
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
    // Resume battle view if a game was in progress
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
    try { localStorage.setItem(ROSTER_KEY, JSON.stringify(units)) } catch { /* ignore */ }
  }, [units])

  const handleUpdate = (u: Unit[] | Unit) => {
    if (Array.isArray(u)) setUnits(u)
    else setUnits(prev => [...prev, u])
  }

  const handleClear = () => {
    if (confirm('Clear all units from your roster?')) setUnits([])
  }

  const handleGameStart = (config: GameConfig) => {
    // Store config in localStorage (BattleTracker writes state alongside it)
    try { localStorage.setItem(GAME_KEY, JSON.stringify({ config })) } catch { /* ignore */ }
    setGameConfig(config)
    setActiveView('battle')
  }

  const handleNewGame = () => {
    setGameConfig(null)
    setActiveView('setup')
  }

  const totalPoints = units.reduce((sum, u) => sum + (u.points ?? 0), 0)

  return (
    <div className="app-container">
      <header>
        <h1>WH40K Companion</h1>
      </header>

      <main>
        {activeView === 'list' && (
          <section>
            <ListBuilder onUpdate={handleUpdate} />
            <div className="roster-count">
              {units.length} unit{units.length !== 1 ? 's' : ''}
              {totalPoints > 0 && <span> &mdash; {totalPoints}pts</span>}
              {units.length > 0 && (
                <button className="clear-btn" onClick={handleClear}>Clear</button>
              )}
            </div>
          </section>
        )}

        {activeView === 'setup' && (
          <section>
            <SetupWizard rosterUnits={units} onStart={handleGameStart} />
          </section>
        )}

        {activeView === 'battle' && gameConfig && (
          <section>
            <BattleTracker config={gameConfig} onNewGame={handleNewGame} />
          </section>
        )}

        {activeView === 'battle' && !gameConfig && (
          <section>
            <p className="hint">No active game — go to Setup to configure a battle first.</p>
            <button className="wizard-btn wizard-btn-primary" onClick={() => setActiveView('setup')}>
              Go to Setup
            </button>
          </section>
        )}

        {activeView === 'cards' && (
          <section>
            <CardCarousel items={units} />
          </section>
        )}
      </main>

      <nav className="nav-container">
        <div className="nav-menu">
          <button className={`nav-item ${activeView === 'list'   ? 'active' : ''}`} onClick={() => setActiveView('list')}>
            Roster
          </button>
          <button className={`nav-item ${activeView === 'setup'  ? 'active' : ''}`} onClick={() => setActiveView('setup')}>
            Setup
          </button>
          <button
            className={`nav-item ${activeView === 'battle' ? 'active' : ''} ${gameConfig ? 'nav-item-live' : ''}`}
            onClick={() => setActiveView('battle')}
          >
            Battle{gameConfig ? ' •' : ''}
          </button>
          <button className={`nav-item ${activeView === 'cards'  ? 'active' : ''}`} onClick={() => setActiveView('cards')}>
            Cards
          </button>
        </div>
      </nav>
    </div>
  )
}
