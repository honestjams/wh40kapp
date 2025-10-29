import React, { useEffect, useRef, useState } from 'react'

export type Unit = {
  name: string
  points?: number
  count?: number
  army?: string
  source?: string
  weapons?: string[]
  items?: string[]
}

type Props = {
  onUpdate: (units: Unit[] | Unit) => void
}

type Catalog = { id: string; name: string; file: string }

export default function ListBuilder({ onUpdate }: Props) {
  const [availableWeapons, setAvailableWeapons] = useState<string[]>([]);
  const [legalModelCounts, setLegalModelCounts] = useState<number[]>([1]);
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [selectedCatalog, setSelectedCatalog] = useState<Catalog | null>(null)
  const [units, setUnits] = useState<string[]>([])
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [modelCount, setModelCount] = useState<number>(1);
  const [selectedWeapons, setSelectedWeapons] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    // load the catalogs manifest
    fetch('/bsData/catalogs.json')
      .then(r => r.json())
      .then((c: Catalog[]) => setCatalogs(c))
      .catch(() => setCatalogs([]))
  }, [])

  useEffect(() => {
    if (!selectedCatalog) return;
    fetch(selectedCatalog.file)
      .then(r => r.text())
      .then(txt => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(txt, 'application/xml');
          const entries = Array.from(doc.getElementsByTagName('selectionEntry'));
          const unitEntries = entries.filter(e => e.getAttribute('type') === 'unit');
          const names = unitEntries.map(e => e.getAttribute('name') || '').filter(Boolean);
          const uniq = Array.from(new Set(names)).sort();
          setUnits(uniq);

          // If a unit is selected, parse its legal model counts and weapons
          if (selectedUnit) {
            const unitEntry = unitEntries.find(e => e.getAttribute('name') === selectedUnit);
            // Legal model counts
            let counts: number[] = [1];
            if (unitEntry) {
              const constraints = Array.from(unitEntry.getElementsByTagName('constraints'));
              for (const c of constraints) {
                const min = Number(c.getAttribute('min') || '1');
                const max = Number(c.getAttribute('max') || '1');
                // If min/max are valid and not equal, add both
                if (min && max && min !== max) counts = [min, max];
                else if (min && max) counts = [min];
              }
            }
            setLegalModelCounts(counts);

            // Available weapons
            let weapons: string[] = [];
            if (unitEntry) {
              // Find profiles block for this unit
              const profilesBlock = unitEntry.getElementsByTagName('profiles')[0];
              if (profilesBlock) {
                const profileNodes = Array.from(profilesBlock.getElementsByTagName('profile'));
                for (const p of profileNodes) {
                  const typeName = p.getAttribute('typeName');
                  if (typeName === 'Ranged Weapons' || typeName === 'Melee Weapons') {
                    const weaponName = p.getAttribute('name');
                    if (weaponName) weapons.push(weaponName);
                  }
                }
              }
            }
            setAvailableWeapons(weapons);
          }
        } catch (err) {
          setUnits([]);
          setAvailableWeapons([]);
          setLegalModelCounts([1]);
        }
      })
      .catch(() => {
        setUnits([]);
        setAvailableWeapons([]);
        setLegalModelCounts([1]);
      });
  }, [selectedCatalog, selectedUnit]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const text = await f.text()
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const parsed = lines.map(line => {
      const parts = line.split(',').map(p => p.trim())
      return {
        name: parts[0] ?? 'Unknown',
        points: parts[1] ? Number(parts[1]) : undefined,
        count: parts[2] ? Number(parts[2]) : 1,
      } as Unit
    })
    onUpdate(parsed)
  }

  const handleAddFromCatalog = () => {
    if (!selectedUnit || !selectedCatalog) return;
    const unit: Unit = {
      name: selectedUnit,
      count: modelCount,
      army: selectedCatalog.name,
      source: selectedCatalog.file,
      weapons: selectedWeapons,
      items: selectedItems
    };
    onUpdate(unit);
  }

  const handleAddManual = () => {
    const name = prompt('Unit name') || 'Unnamed'
    const pts = Number(prompt('Points') || '0')
    onUpdate({ name, points: pts, count: 1 })
  }

  return (
    <div className="list-builder">
      <h2>List Builder</h2>

      <div className="list-controls">
        <select 
          value={selectedCatalog?.id ?? ''} 
          onChange={e => {
            const id = e.target.value;
            const c = catalogs.find(cc => cc.id === id) || null;
            setSelectedCatalog(c);
            setSelectedUnit(null);
          }}
        >
          <option value="">Select Army...</option>
          {catalogs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select 
          value={selectedUnit ?? ''} 
          onChange={e => setSelectedUnit(e.target.value)}
          disabled={!selectedCatalog}
        >
          <option value="">Select Unit...</option>
          {units.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {/* Composition controls shown after unit selection */}
        {selectedUnit && (
          <div className="composition-controls">
            <label>
              Model count:
              <select value={modelCount} onChange={e => setModelCount(Number(e.target.value))}>
                {legalModelCounts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Weapons:
              <select multiple value={selectedWeapons} onChange={e => {
                const opts = Array.from(e.target.selectedOptions).map(o => o.value);
                setSelectedWeapons(opts);
              }}>
                {availableWeapons.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>
            <label>
              Items:
              <input type="text" placeholder="Comma separated" value={selectedItems.join(', ')} onChange={e => setSelectedItems(e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
            </label>
          </div>
        )}
        <button 
          onClick={handleAddFromCatalog} 
          disabled={!selectedUnit}
        >
          Add Unit
        </button>
      </div>

      <div className="list-actions">
        <button onClick={handleAddManual}>Add Manual Entry</button>
        <div className="file-input-container">
          <input 
            ref={fileRef} 
            type="file" 
            accept=".csv,text/csv" 
            onChange={handleImport} 
            className="file-input"
          />
          <span className="file-input-label">Import CSV</span>
        </div>
      </div>

      <p className="hint">
        Select your army and units from the dropdown menus above, or import a CSV file with your army list.
      </p>
    </div>
  )
}
