import React, { useState } from 'react'
import type { Unit } from './ListBuilder'

// ── Types ────────────────────────────────────────────────────────────────────

export type SecondaryObjective = {
  id: string
  name: string
  desc: string
}

export type PlayerConfig = {
  name: string
  army: string
  detachment: string
  secondaries: SecondaryObjective[]
}

export type Mission = {
  id: string
  name: string
  primary: string
  deployment: string
}

export type GameConfig = {
  pointsLimit: number
  mission: Mission
  players: [PlayerConfig, PlayerConfig]
  firstPlayer: 0 | 1
}

// ── Static Data ───────────────────────────────────────────────────────────────

const POINTS_OPTIONS = [
  { label: 'Combat Patrol', points: 500,  desc: 'Small, fast games' },
  { label: 'Incursion',     points: 1000, desc: 'Standard starter' },
  { label: 'Strike Force',  points: 2000, desc: 'Standard competitive' },
  { label: 'Onslaught',     points: 3000, desc: 'Large epic battles' },
]

const MISSIONS: Mission[] = [
  {
    id: 'take-and-hold',
    name: 'Take and Hold',
    primary: 'Score 4VP if you control more objectives than your opponent at the end of your Command Phase.',
    deployment: 'Hammer & Anvil — deploy within 9" of your short table edge.',
  },
  {
    id: 'purge-the-foe',
    name: 'Purge the Foe',
    primary: 'Score 3VP per objective controlled. Score 1VP per enemy unit destroyed this turn.',
    deployment: 'Search & Destroy — deploy in diagonal corners, within 12" of a corner.',
  },
  {
    id: 'vital-ground',
    name: 'Vital Ground',
    primary: 'Score 5VP for the central objective. Score 2VP for each other objective you hold.',
    deployment: 'Dawn of War — deploy within 9" of your long table edge.',
  },
  {
    id: 'sweep-and-clear',
    name: 'Sweep and Clear',
    primary: 'Score 2VP per objective outside your deployment zone at end of Command Phase.',
    deployment: 'Crucible of Battle — deploy in opposing 9" × 24" corner rectangles.',
  },
  {
    id: 'scorched-earth',
    name: 'Scorched Earth',
    primary: 'Score 3VP per objective controlled. May destroy a marker in enemy territory for 5VP.',
    deployment: 'Sweeping Engagement — deploy within 6" of opposite short table edges.',
  },
  {
    id: 'tipping-point',
    name: 'Tipping Point',
    primary: 'Objectives score 3VP when resolved. Controlling more contested objectives wins the round.',
    deployment: 'Tipping Point — deploy in opposite diagonal corners (9" from each edge).',
  },
]

export const ALL_SECONDARIES: SecondaryObjective[] = [
  { id: 'bring-it-down',      name: 'Bring It Down',          desc: '2VP per Monster/Vehicle destroyed (4VP if Titanic). Max 15VP.' },
  { id: 'assassination',      name: 'Assassination',           desc: '3VP for destroying the enemy Warlord. 1VP per other Character. Max 8VP.' },
  { id: 'engage-all-fronts',  name: 'Engage on All Fronts',   desc: '3VP at end of your turn if you have units in 3+ table quarters. Max 15VP.' },
  { id: 'behind-enemy-lines', name: 'Behind Enemy Lines',     desc: '4VP at end of your turn if a unit is wholly in the enemy deployment zone. Max 15VP.' },
  { id: 'no-prisoners',       name: 'No Prisoners',           desc: '1VP per 10 wounds removed in your Shooting phase this turn. Max 15VP.' },
  { id: 'overwhelming-force', name: 'Overwhelming Force',     desc: '4VP if you control an objective in the enemy deployment zone at end of turn. Max 15VP.' },
  { id: 'storm-hostile',      name: 'Storm Hostile Objectives', desc: '2VP per objective outside your deployment zone you control at end of turn. Max 15VP.' },
  { id: 'raise-banners',      name: 'Raise the Banners High', desc: '1VP per objective you control at end of each battle round. Max 15VP.' },
  { id: 'stranglehold',       name: 'Stranglehold',           desc: '3VP if you control more objectives than your opponent at end of your turn. Max 15VP.' },
  { id: 'warlord-hunt',       name: 'Warlord Hunt',           desc: '5VP if your Warlord kills the enemy Warlord in the Fight phase. One-time score.' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-dots">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`step-dot ${i + 1 === current ? 'active' : i + 1 < current ? 'done' : ''}`} />
      ))}
    </div>
  )
}

function PlayerSetupForm({
  title,
  player,
  rosterArmies,
  onUpdate,
  onToggleSecondary,
}: {
  title: string
  player: Partial<PlayerConfig>
  rosterArmies: string[]
  onUpdate: (field: keyof PlayerConfig, value: string) => void
  onToggleSecondary: (sec: SecondaryObjective) => void
}) {
  const selectedSecs = player.secondaries ?? []
  const hasRosterArmies = rosterArmies.length > 0
  const showTextInput = !hasRosterArmies || player.army === '__custom__'

  return (
    <div className="wizard-step">
      <h3 className="step-title">{title}</h3>
      <div className="player-form">
        <div className="form-field">
          <label>Name</label>
          <input
            type="text"
            placeholder={title}
            value={player.name ?? ''}
            onChange={e => onUpdate('name', e.target.value)}
          />
        </div>

        <div className="form-field">
          <label>Army</label>
          {hasRosterArmies && (
            <select value={player.army ?? ''} onChange={e => onUpdate('army', e.target.value)}>
              <option value="">Select army...</option>
              {rosterArmies.map(a => <option key={a} value={a}>{a}</option>)}
              <option value="__custom__">Other (enter below)</option>
            </select>
          )}
          {showTextInput && (
            <input
              type="text"
              placeholder="e.g. Space Marines"
              value={player.army === '__custom__' ? '' : (player.army ?? '')}
              onChange={e => onUpdate('army', e.target.value)}
            />
          )}
        </div>

        <div className="form-field">
          <label>Detachment <span className="field-optional">(optional)</span></label>
          <input
            type="text"
            placeholder="e.g. Gladius Task Force"
            value={player.detachment ?? ''}
            onChange={e => onUpdate('detachment', e.target.value)}
          />
        </div>

        <div className="form-field">
          <label>
            Secondary Objectives{' '}
            <span className="field-note">{selectedSecs.length}/3</span>
          </label>
          <div className="secondary-grid">
            {ALL_SECONDARIES.map(sec => {
              const selected = selectedSecs.some(s => s.id === sec.id)
              const disabled = !selected && selectedSecs.length >= 3
              return (
                <button
                  key={sec.id}
                  className={`secondary-option ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                  onClick={() => onToggleSecondary(sec)}
                  disabled={disabled}
                >
                  <div className="secondary-name">{sec.name}</div>
                  <div className="secondary-desc">{sec.desc}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

type Props = {
  rosterUnits: Unit[]
  onStart: (config: GameConfig) => void
}

export default function SetupWizard({ rosterUnits, onStart }: Props) {
  const [step, setStep] = useState(1)
  const [pointsLimit, setPointsLimit] = useState(2000)
  const [mission, setMission] = useState<Mission>(MISSIONS[0])
  const [p1, setP1] = useState<Partial<PlayerConfig>>({ secondaries: [] })
  const [p2, setP2] = useState<Partial<PlayerConfig>>({ secondaries: [] })
  const [firstPlayer, setFirstPlayer] = useState<0 | 1 | null>(null)

  const rosterArmies = Array.from(new Set(rosterUnits.map(u => u.army).filter(Boolean))) as string[]

  const updatePlayer = (which: 1 | 2, field: keyof PlayerConfig, value: string) => {
    const setter = which === 1 ? setP1 : setP2
    setter(prev => ({ ...prev, [field]: value }))
  }

  const toggleSecondary = (which: 1 | 2, sec: SecondaryObjective) => {
    const setter = which === 1 ? setP1 : setP2
    setter(prev => {
      const current = prev.secondaries ?? []
      const isSelected = current.some(s => s.id === sec.id)
      if (isSelected) return { ...prev, secondaries: current.filter(s => s.id !== sec.id) }
      if (current.length >= 3) return prev
      return { ...prev, secondaries: [...current, sec] }
    })
  }

  const rollInitiative = () => setFirstPlayer(Math.random() < 0.5 ? 0 : 1)

  const canProceed = (): boolean => {
    if (step === 1) return true
    if (step === 2) return !!mission
    if (step === 3) return !!(p1.name && p1.army && (p1.secondaries?.length === 3))
    if (step === 4) return !!(p2.name && p2.army && (p2.secondaries?.length === 3))
    if (step === 5) return firstPlayer !== null
    return false
  }

  const handleStart = () => {
    if (!mission || firstPlayer === null) return
    onStart({
      pointsLimit,
      mission,
      players: [
        { name: p1.name!, army: p1.army!, detachment: p1.detachment ?? '', secondaries: p1.secondaries! },
        { name: p2.name!, army: p2.army!, detachment: p2.detachment ?? '', secondaries: p2.secondaries! },
      ],
      firstPlayer,
    })
  }

  const firstPlayerName = firstPlayer === 0 ? (p1.name || 'Player 1') : (p2.name || 'Player 2')

  return (
    <div className="setup-wizard">
      <StepDots current={step} total={5} />

      {step === 1 && (
        <div className="wizard-step">
          <h3 className="step-title">Game Size</h3>
          <p className="step-hint">Choose your points limit for this battle.</p>
          <div className="option-grid-2">
            {POINTS_OPTIONS.map(opt => (
              <button
                key={opt.points}
                className={`option-card ${pointsLimit === opt.points ? 'selected' : ''}`}
                onClick={() => setPointsLimit(opt.points)}
              >
                <div className="option-label">{opt.label}</div>
                <div className="option-value">{opt.points}pts</div>
                <div className="option-desc">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step">
          <h3 className="step-title">Mission</h3>
          <p className="step-hint">Select the mission you're playing.</p>
          <div className="mission-list">
            {MISSIONS.map(m => (
              <button
                key={m.id}
                className={`mission-option ${mission?.id === m.id ? 'selected' : ''}`}
                onClick={() => setMission(m)}
              >
                <div className="mission-name">{m.name}</div>
                <div className="mission-detail">{m.deployment}</div>
                <div className="mission-detail">{m.primary}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <PlayerSetupForm
          title="Player 1"
          player={p1}
          rosterArmies={rosterArmies}
          onUpdate={(f, v) => updatePlayer(1, f, v)}
          onToggleSecondary={s => toggleSecondary(1, s)}
        />
      )}

      {step === 4 && (
        <PlayerSetupForm
          title="Player 2"
          player={p2}
          rosterArmies={rosterArmies}
          onUpdate={(f, v) => updatePlayer(2, f, v)}
          onToggleSecondary={s => toggleSecondary(2, s)}
        />
      )}

      {step === 5 && (
        <div className="wizard-step">
          <h3 className="step-title">Roll for Initiative</h3>
          <p className="step-hint">Both players roll a D6 — highest goes first (re-roll ties).</p>
          <div className="initiative-section">
            <button className="roll-btn" onClick={rollInitiative}>Roll Dice</button>
            <div className="manual-pick-label">or choose manually:</div>
            <div className="manual-pick">
              <button
                className={`option-card ${firstPlayer === 0 ? 'selected' : ''}`}
                onClick={() => setFirstPlayer(0)}
              >
                {p1.name || 'Player 1'}
              </button>
              <button
                className={`option-card ${firstPlayer === 1 ? 'selected' : ''}`}
                onClick={() => setFirstPlayer(1)}
              >
                {p2.name || 'Player 2'}
              </button>
            </div>
            {firstPlayer !== null && (
              <div className="roll-result">
                <strong>{firstPlayerName}</strong> deploys first and takes Turn 1.
              </div>
            )}
          </div>

          {firstPlayer !== null && (
            <div className="game-summary">
              <h4 className="summary-heading">Game Summary</h4>
              <div className="summary-row"><span>Points</span><span>{pointsLimit}pts</span></div>
              <div className="summary-row"><span>Mission</span><span>{mission?.name}</span></div>
              <div className="summary-row"><span>{p1.name || 'Player 1'}</span><span>{p1.army}</span></div>
              <div className="summary-row"><span>{p2.name || 'Player 2'}</span><span>{p2.army}</span></div>
              <div className="summary-row"><span>First turn</span><span>{firstPlayerName}</span></div>
            </div>
          )}
        </div>
      )}

      <div className="wizard-nav">
        {step > 1 && (
          <button className="wizard-btn wizard-btn-secondary" onClick={() => setStep(s => s - 1)}>
            Back
          </button>
        )}
        <div style={{ flex: 1 }} />
        {step < 5 ? (
          <button className="wizard-btn wizard-btn-primary" onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
            Next
          </button>
        ) : (
          <button className="wizard-btn wizard-btn-primary" onClick={handleStart} disabled={!canProceed()}>
            Start Battle
          </button>
        )}
      </div>
    </div>
  )
}
