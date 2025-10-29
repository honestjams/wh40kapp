import React, { useState } from 'react'
import ListBuilder, { Unit } from './ListBuilder'
import CardCarousel from './CardCarousel'

export default function App() {
  const [units, setUnits] = useState<Unit[]>([])
  const [activeView, setActiveView] = useState<'list' | 'cards'>('list')

  const handleUpdate = (u: Unit[] | Unit) => {
    if (Array.isArray(u)) setUnits(u)
    else setUnits(prev => [...prev, u])
  }

  return (
    <div className="app-container">
      <header>
        <h1>WH40K Companion</h1>
      </header>
      <main>
        {activeView === 'list' ? (
          <section className="builder">
            <ListBuilder onUpdate={handleUpdate} />
            <div className="roster-count">
              {units.length} unit{units.length !== 1 ? 's' : ''} in roster
            </div>
          </section>
        ) : (
          <section className="display">
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
