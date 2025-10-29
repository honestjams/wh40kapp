import React, { useEffect, useRef, useState } from 'react';
import type { Unit } from './ListBuilder';

type Props = { items: Unit[] };
type UnitProfile = {
  name: string;
  points?: number;
  count?: number;
  army?: string;
  stats: Record<string, string>;
  abilities: Array<{ name: string; desc: string }>;
  weapons: Array<{ name: string; stats: Record<string, string> }>;
  categories: string[];
};

export default function CardCarousel({ items }: Props) {
  const [profiles, setProfiles] = useState<UnitProfile[]>([]);
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => { setIndex(0); }, [profiles.length]);

    useEffect(() => {
      const load = async () => {
        const out: UnitProfile[] = [];
        for (const it of items) {
          const base: UnitProfile = {
            name: it.name,
            points: it.points,
            count: it.count,
            army: it.army,
            stats: {},
            abilities: [],
            weapons: [],
            categories: [],
          };
          if (it.source) {
            try {
              const txt = await fetch(it.source as RequestInfo).then(r => r.text());
              const parser = new DOMParser();
              const doc = parser.parseFromString(txt, 'application/xml');
              const selectionEntries = Array.from(doc.getElementsByTagName('selectionEntry')) as Element[];
              const profilesNodes = Array.from(doc.getElementsByTagName('profile')) as Element[];
              for (const p of profilesNodes) {
                const pname = p.getAttribute('name') || '';
                const typeName = p.getAttribute('typeName') || '';
                if (pname === it.name && typeName === 'Unit') {
                  const chars = Array.from(p.getElementsByTagName('characteristic')) as Element[];
                  for (const c of chars) {
                    const key = c.getAttribute('name') || '';
                    const val = c.textContent || '';
                    base.stats[key] = val;
                  }
                  break;
                }
              }
              // Abilities
              const abilities: Array<{ name: string; desc: string }> = [];
              const unitEntry = selectionEntries.find((s: Element) => s.getAttribute('name') === it.name);
              if (unitEntry) {
                const profilesBlock = unitEntry.getElementsByTagName('profiles')[0];
                if (profilesBlock) {
                  const abilityProfiles = Array.from(profilesBlock.getElementsByTagName('profile')) as Element[];
                  const filteredAbilityProfiles = abilityProfiles.filter((p: Element) => p.getAttribute('typeName') === 'Abilities');
                  for (const p of filteredAbilityProfiles) {
                    const pname = p.getAttribute('name') || '';
                    const descNode = Array.from(p.getElementsByTagName('characteristic')).find((ch: Element) => ch.getAttribute('name') === 'Description');
                    const desc = descNode?.textContent || '';
                    abilities.push({ name: pname, desc });
                  }
                }
              }
              base.abilities = abilities;
              // Weapons
              const weapons: Array<{ name: string; stats: Record<string, string> }> = [];
              for (const p of profilesNodes) {
                const pname = p.getAttribute('name') || '';
                const typeName = p.getAttribute('typeName') || '';
                if (typeName === 'Ranged Weapons' || typeName === 'Melee Weapons') {
                  const stats: Record<string, string> = {};
                  const charNodes = Array.from(p.getElementsByTagName('characteristic')) as Element[];
                  for (const c of charNodes) {
                    const key = c.getAttribute('name') || '';
                    stats[key] = c.textContent || '';
                  }
                  weapons.push({ name: pname, stats });
                }
              }
              // Only show selected weapons/items
              base.weapons = weapons.filter(w => !it.weapons || it.weapons.includes(w.name));
              // Add items to profile for display
              base.categories = [...base.categories, ...(it.items || [])];
              // Categories
              const catEntries = Array.from(doc.getElementsByTagName('categoryEntry')) as Element[];
              base.categories = [...base.categories, ...catEntries.map((n: Element) => n.getAttribute('name') || '').filter(Boolean)];
              // Costs
              for (const s of selectionEntries) {
                const sname = s.getAttribute('name') || '';
                if (sname === it.name) {
                  const costsNode = s.getElementsByTagName('costs')[0];
                  if (costsNode) {
                    const cost = Array.from(costsNode.getElementsByTagName('cost')).find((c: Element) => c.getAttribute('name') === 'pts');
                    if (cost) base.points = Number(cost.getAttribute('value'));
                  }
                  break;
                }
              }
            } catch (err) {
              // ignore parse errors
            }
          }
          out.push(base);
        }
        setProfiles(out);
      };
      load();
    }, [items]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      let startX = 0;
      let dist = 0;
      const onDown = (e: TouchEvent | MouseEvent) => {
        startX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        dist = 0;
        window.addEventListener('touchmove', onMove as any);
        window.addEventListener('mousemove', onMove as any);
        window.addEventListener('touchend', onUp as any);
        window.addEventListener('mouseup', onUp as any);
      };
      const onMove = (e: TouchEvent | MouseEvent) => {
        const x = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        dist = x - startX;
      };
      const onUp = () => {
        if (dist > 50) setIndex(i => Math.max(0, i - 1));
        else if (dist < -50) setIndex(i => Math.min(profiles.length - 1, i + 1));
        window.removeEventListener('touchmove', onMove as any);
        window.removeEventListener('mousemove', onMove as any);
        window.removeEventListener('touchend', onUp as any);
        window.removeEventListener('mouseup', onUp as any);
      };
      el.addEventListener('touchstart', onDown as any);
      el.addEventListener('mousedown', onDown as any);
      return () => {
        el.removeEventListener('touchstart', onDown as any);
        el.removeEventListener('mousedown', onDown as any);
      };
    }, [profiles.length]);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
        if (e.key === 'ArrowRight') setIndex(i => Math.min(profiles.length - 1, i + 1));
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [profiles.length]);

    if (!items.length) {
      return (
        <div className="carousel">
          <div className="empty-state">
            <div>
              <p>No units in your roster yet.</p>
              <p>Switch to List Builder to add some units!</p>
            </div>
          </div>
        </div>
      );
    }

    if (!profiles.length) {
      return (
        <div className="carousel">
          <div className="loading-state">
            <div>
              <p>Loading unit data...</p>
            </div>
          </div>
        </div>
      );
    }

    const p = profiles[index];
    return (
      <div className="carousel" ref={containerRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="carousel-container" style={{ maxHeight: '90vh', overflowY: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className="unit-card" style={{ maxHeight: '80vh', overflowY: 'auto', width: '100%', boxSizing: 'border-box' }}>
            <div className="unit-header">
              <span className="unit-name">{p.name}</span>
              {p.points && <span className="unit-points">{p.points}pts</span>}
            </div>
            {p.army && (
              <div className="unit-section">
                <div className="section-title">Army</div>
                <div>{p.army}</div>
              </div>
            )}
            {Object.keys(p.stats || {}).length > 0 && (
              <div className="unit-section">
                <div className="section-title">Stats</div>
                <div className="stats-grid">
                  {Object.entries(p.stats || {}).map(([key, value]) => (
                    <div key={key} className="stat-item">
                      <div className="stat-value">{value}</div>
                      <div className="stat-label">{key}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {p.weapons.length > 0 && (
              <div className="unit-section">
                <div className="section-title">Weapons</div>
                <div className="weapon-list">
                  {p.weapons.map((w, widx) => (
                    <div key={widx} className="weapon-item">
                      <div className="weapon-name">{w.name}</div>
                      <div className="weapon-stats">
                        {Object.entries(w.stats).map(([key, value]) => (
                          <div key={key}>
                            <strong>{key}:</strong> {value}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {p.abilities.length > 0 && (
              <div className="unit-section">
                <div className="section-title">Abilities</div>
                <div className="abilities-list">
                  {p.abilities.map((a, aidx) => (
                    <div key={aidx} className="ability-item">
                      <div className="ability-name">{a.name}</div>
                      <div className="ability-desc">{a.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {p.categories.length > 0 && (
              <div className="unit-section">
                <div className="section-title">Categories</div>
                <div className="categories-list">
                  {p.categories.map((cat, cidx) => (
                    <span key={cidx} className="category-tag">{cat}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
