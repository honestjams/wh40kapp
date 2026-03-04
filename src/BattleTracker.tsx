import React, { useEffect, useReducer, useState } from 'react'
import type { GameConfig } from './SetupWizard'

// ── Phase definitions ─────────────────────────────────────────────────────────

const PHASES = [
  {
    id: 'command' as const,
    label: 'Command',
    steps: [
      'Score Primary VP (objectives you control).',
      'Battle Shock tests for units below half strength — roll D6+OC, 10+ to pass.',
      'Gain 1 Command Point.',
      'Resolve any Command phase stratagems.',
    ],
  },
  {
    id: 'movement' as const,
    label: 'Movement',
    steps: [
      'Choose each unit: Normal Move (up to M"), Advance (+D6" but no Shooting/Charging), or Remain Stationary.',
      'Flying units ignore terrain and other models when moving.',
      'Disembark from Transports before the Transport moves.',
    ],
  },
  {
    id: 'shooting' as const,
    label: 'Shooting',
    steps: [
      'Select an eligible unit (not in Engagement Range, not Battleshocked).',
      'Declare targets — must be visible and within range.',
      'Roll to Hit: equal or beat Ballistic Skill (BS).',
      'Roll to Wound: compare Strength (S) vs Toughness (T).',
      'Defender rolls Armour Saves (or Invulnerable).',
    ],
  },
  {
    id: 'charge' as const,
    label: 'Charge',
    steps: [
      'Declare charge — target must be within 12".',
      'Roll 2D6; result must equal or exceed distance to nearest model.',
      'Defender may Overwatch (shoot at charger, hits on 6s unless specified).',
      'On success, move charger into Engagement Range (within 1") of target.',
    ],
  },
  {
    id: 'fight' as const,
    label: 'Fight',
    steps: [
      'Charging units fight first — pile in up to 3" towards nearest enemy.',
      'Alternate activations: active player picks a unit, then opponent.',
      'Roll to Hit: equal or beat Weapon Skill (WS).',
      'Roll to Wound: compare S vs T.',
      'Defender rolls Saves.',
    ],
  },
] as const

type Phase = typeof PHASES[number]['id']
const PHASE_COUNT = PHASES.length

// ── State ─────────────────────────────────────────────────────────────────────

type ObjControl = 'neutral' | 'p1' | 'p2'

type SecondaryScore = { id: string; name: string; vp: number }

type PlayerState = {
  cp: number
  primaryVP: number
  secondaries: SecondaryScore[]
}

type BattleState = {
  round: number
  activePlayer: 0 | 1
  phaseIndex: number
  playerStates: [PlayerState, PlayerState]
  objectives: ObjControl[]
  gameOver: boolean
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'NEXT_PHASE' }
  | { type: 'PREV_PHASE' }
  | { type: 'ADD_CP'; player: 0 | 1; delta: number }
  | { type: 'ADD_PRIMARY'; player: 0 | 1; delta: number }
  | { type: 'ADD_SECONDARY'; player: 0 | 1; secId: string; delta: number }
  | { type: 'TOGGLE_OBJECTIVE'; index: number }
  | { type: 'END_GAME' }

function advancePhase(s: BattleState): BattleState {
  if (s.phaseIndex < PHASE_COUNT - 1) return { ...s, phaseIndex: s.phaseIndex + 1 }
  if (s.activePlayer === 0) return { ...s, activePlayer: 1, phaseIndex: 0 }
  if (s.round >= 5) return { ...s, gameOver: true }
  return { ...s, round: s.round + 1, activePlayer: 0, phaseIndex: 0 }
}

function retreatPhase(s: BattleState): BattleState {
  if (s.phaseIndex > 0) return { ...s, phaseIndex: s.phaseIndex - 1 }
  if (s.activePlayer === 1) return { ...s, activePlayer: 0, phaseIndex: PHASE_COUNT - 1 }
  if (s.round > 1) return { ...s, round: s.round - 1, activePlayer: 1, phaseIndex: PHASE_COUNT - 1 }
  return s
}

function reducer(state: BattleState, action: Action): BattleState {
  switch (action.type) {
    case 'NEXT_PHASE': return advancePhase(state)
    case 'PREV_PHASE': return retreatPhase(state)

    case 'ADD_CP': {
      const ps = state.playerStates.slice() as [PlayerState, PlayerState]
      ps[action.player] = { ...ps[action.player], cp: Math.max(0, ps[action.player].cp + action.delta) }
      return { ...state, playerStates: ps }
    }
    case 'ADD_PRIMARY': {
      const ps = state.playerStates.slice() as [PlayerState, PlayerState]
      ps[action.player] = { ...ps[action.player], primaryVP: Math.max(0, ps[action.player].primaryVP + action.delta) }
      return { ...state, playerStates: ps }
    }
    case 'ADD_SECONDARY': {
      const ps = state.playerStates.slice() as [PlayerState, PlayerState]
      ps[action.player] = {
        ...ps[action.player],
        secondaries: ps[action.player].secondaries.map(s =>
          s.id === action.secId ? { ...s, vp: Math.max(0, s.vp + action.delta) } : s
        ),
      }
      return { ...state, playerStates: ps }
    }
    case 'TOGGLE_OBJECTIVE': {
      const objs = state.objectives.slice() as ObjControl[]
      objs[action.index] = objs[action.index] === 'neutral' ? 'p1' : objs[action.index] === 'p1' ? 'p2' : 'neutral'
      return { ...state, objectives: objs }
    }
    case 'END_GAME': return { ...state, gameOver: true }
    default: return state
  }
}

function initState(config: GameConfig): BattleState {
  const makePlayer = (idx: 0 | 1): PlayerState => ({
    cp: 0,
    primaryVP: 0,
    secondaries: config.players[idx].secondaries.map(s => ({ id: s.id, name: s.name, vp: 0 })),
  })
  return {
    round: 1,
    activePlayer: config.firstPlayer,
    phaseIndex: 0,
    playerStates: [makePlayer(0), makePlayer(1)],
    objectives: ['neutral', 'neutral', 'neutral', 'neutral', 'neutral'],
    gameOver: false,
  }
}

// ── Counter helper ────────────────────────────────────────────────────────────

function Counter({
  label,
  value,
  onDec,
  onInc,
  title,
}: {
  label: string
  value: number
  onDec: () => void
  onInc: () => void
  title?: string
}) {
  return (
    <div className="counter-row" title={title}>
      <span className="counter-label">{label}</span>
      <button className="counter-btn" onClick={onDec}>−</button>
      <span className="counter-value">{value}</span>
      <button className="counter-btn" onClick={onInc}>+</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'wh40k-active-game'

type Props = {
  config: GameConfig
  onNewGame: () => void
}

export default function BattleTracker({ config, onNewGame }: Props) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { state?: BattleState }
        if (saved.state) return saved.state
      }
    } catch { /* ignore */ }
    return initState(config)
  })

  const [showGuide, setShowGuide] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const existing = raw ? JSON.parse(raw) : { config }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, state }))
    } catch { /* ignore */ }
  }, [state])

  const phase = PHASES[state.phaseIndex]
  const activePC = config.players[state.activePlayer]

  const totalVP = (ps: PlayerState) =>
    ps.primaryVP + ps.secondaries.reduce((sum, s) => sum + s.vp, 0)

  const objCount = (side: 'p1' | 'p2') => state.objectives.filter(o => o === side).length

  const isAtStart =
    state.round === 1 &&
    state.activePlayer === config.firstPlayer &&
    state.phaseIndex === 0

  const nextLabel = (() => {
    if (state.phaseIndex < PHASE_COUNT - 1) return 'Next Phase'
    if (state.activePlayer === 0) return 'End Turn'
    return state.round >= 5 ? 'End Game' : 'Next Round'
  })()

  // ── Game over screen ───────────────────────────────────────────────────────
  if (state.gameOver) {
    const [t0, t1] = [totalVP(state.playerStates[0]), totalVP(state.playerStates[1])]
    const winner = t0 > t1 ? config.players[0].name : t1 > t0 ? config.players[1].name : null
    return (
      <div className="battle-tracker">
        <div className="game-over">
          <h2>Battle Complete</h2>
          <div className="final-scores">
            {([0, 1] as const).map(i => (
              <div key={i} className="final-score-row">
                <span>{config.players[i].name}</span>
                <span className="score-value">{[t0, t1][i]} VP</span>
              </div>
            ))}
          </div>
          <div className="winner-display">{winner ? `${winner} wins!` : 'Draw!'}</div>
          <button
            className="new-game-btn"
            onClick={() => {
              try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
              onNewGame()
            }}
          >
            New Game
          </button>
        </div>
      </div>
    )
  }

  // ── Main tracker ──────────────────────────────────────────────────────────
  return (
    <div className="battle-tracker">
      {/* Header */}
      <div className="tracker-header">
        <div className="round-phase">
          <span className="round-label">Round {state.round} / 5</span>
          <span className="turn-label">{activePC.name}'s Turn</span>
        </div>
        <button className="end-game-link" onClick={() => dispatch({ type: 'END_GAME' })}>
          End Game
        </button>
      </div>

      {/* Phase stepper */}
      <div className="phase-bar">
        {PHASES.map((p, i) => (
          <div
            key={p.id}
            className={`phase-tab ${i === state.phaseIndex ? 'active' : i < state.phaseIndex ? 'done' : ''}`}
          >
            {p.label}
          </div>
        ))}
      </div>

      {/* Phase guide */}
      <div className="phase-guide">
        <button className="phase-guide-header" onClick={() => setShowGuide(g => !g)}>
          <span>{phase.label} Phase</span>
          <span className="guide-toggle">{showGuide ? '▲' : '▼'}</span>
        </button>
        {showGuide && (
          <ol className="phase-steps">
            {phase.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        )}
      </div>

      {/* Objectives */}
      <div className="objectives-section">
        <div className="section-label">Objectives — tap to cycle control</div>
        <div className="objectives-row">
          {state.objectives.map((ctrl, i) => (
            <button
              key={i}
              className={`obj-circle ${ctrl}`}
              onClick={() => dispatch({ type: 'TOGGLE_OBJECTIVE', index: i })}
              title={`Objective ${i + 1}: ${ctrl === 'neutral' ? 'Neutral' : ctrl === 'p1' ? config.players[0].name : config.players[1].name}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="obj-legend">
          <span className="obj-legend-item p1-text">{config.players[0].name}: {objCount('p1')}</span>
          <span className="obj-legend-item">&nbsp;|&nbsp;</span>
          <span className="obj-legend-item p2-text">{config.players[1].name}: {objCount('p2')}</span>
        </div>
      </div>

      {/* Player panels */}
      <div className="player-panels">
        {([0, 1] as const).map(pi => {
          const pc = config.players[pi]
          const ps = state.playerStates[pi]
          return (
            <div key={pi} className={`player-panel ${pi === 0 ? 'p1' : 'p2'} ${state.activePlayer === pi ? 'active-turn' : ''}`}>
              <div className="panel-header">
                <div className="panel-name">{pc.name}</div>
                <div className="panel-army">{pc.army}</div>
                {pc.detachment && <div className="panel-detachment">{pc.detachment}</div>}
                <div className="panel-total">{totalVP(ps)} VP</div>
              </div>

              <Counter
                label="CP"
                value={ps.cp}
                onDec={() => dispatch({ type: 'ADD_CP', player: pi, delta: -1 })}
                onInc={() => dispatch({ type: 'ADD_CP', player: pi, delta: 1 })}
              />
              <Counter
                label="Primary VP"
                value={ps.primaryVP}
                onDec={() => dispatch({ type: 'ADD_PRIMARY', player: pi, delta: -1 })}
                onInc={() => dispatch({ type: 'ADD_PRIMARY', player: pi, delta: 1 })}
              />

              {ps.secondaries.length > 0 && (
                <div className="secondary-scores">
                  {ps.secondaries.map(sec => (
                    <Counter
                      key={sec.id}
                      label={sec.name}
                      value={sec.vp}
                      onDec={() => dispatch({ type: 'ADD_SECONDARY', player: pi, secId: sec.id, delta: -1 })}
                      onInc={() => dispatch({ type: 'ADD_SECONDARY', player: pi, secId: sec.id, delta: 1 })}
                      title={pc.secondaries.find(s => s.id === sec.id)?.desc}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="tracker-footer">
        <button
          className="tracker-nav-btn tracker-nav-secondary"
          onClick={() => dispatch({ type: 'PREV_PHASE' })}
          disabled={isAtStart}
        >
          Back
        </button>
        <button
          className="tracker-nav-btn tracker-nav-primary"
          onClick={() => dispatch({ type: 'NEXT_PHASE' })}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}
