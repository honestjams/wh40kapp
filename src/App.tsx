import React, { useEffect, useState } from 'react'
import ListBuilder, { Unit } from './ListBuilder'
import CardCarousel from './CardCarousel'

const STORAGE_KEY = 'wh40k-roster'

export default function App() {
  const [units, setUnits] = useState<Unit[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? (JSON.parse(saved) as Unit[]) : []
    } catch {
      return []
    }
  })
  const [activeView, setActiveView] = useState<'list' | 'cards'>('list')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(units))
    } catch {
      // storage unavailable — silent fail
    }
  }, [units])

  const handleUpdate = (u: Unit[] | Unit) => {
    if (Array.isArray(u)) setUnits(u)
    else setUnits(prev => [...prev, u])
  }

  const handleClear = () => {
    if (confirm('Clear all units from your roster?')) setUnits([])
  }

  const totalPoints = units.reduce((sum, u) => sum + (u.points ?? 0), 0)

  return (
    <div className="app-container">
      <header>
        <h1>WH40K Companion</h1>
      </header>

      <main>
        {activeView === 'list' ? (
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
        ) : (
          <section>
            <CardCarousel items={units} />
          </section>
        )}
      </main>

      <nav className="nav-container">
        <div className="nav-menu">
          <button
            className={`nav-item ${activeView === 'list' ? 'active' : ''}`}
            onClick={() => setActiveView('list')}
          >
            List Builder
          </button>
          <button
            className={`nav-item ${activeView === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveView('cards')}
          >
            Game Cards
          </button>
        </div>
      </nav>
    </div>
  )
}
