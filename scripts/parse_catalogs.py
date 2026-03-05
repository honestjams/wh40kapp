#!/usr/bin/env python3
"""
Pre-processes BattleScribe XML catalog files into clean JSON for the WH40K companion app.
Outputs one JSON file per faction into public/bsData-json/.
"""

import json
import os
import xml.etree.ElementTree as ET
from pathlib import Path

CAT_NS = 'http://www.battlescribe.net/schema/catalogueSchema'
NS = {'bs': CAT_NS}

CATALOG_MAP = [
    # Some factions store units in a shared Library catalog
    ('Aeldari - Aeldari Library.cat',            'aeldari-craftworlds',        'Craftworlds (Aeldari)'),
    ('Chaos - Chaos Daemons Library.cat',        'chaos-daemons',              'Chaos Daemons'),
    ('Imperium - Astra Militarum - Library.cat', 'imperium-astra-militarum',   'Astra Militarum'),
    # Factions with units directly in their catalog
    ('Chaos - Chaos Space Marines.cat',          'chaos-space-marines',        'Chaos Space Marines'),
    ('Chaos - Death Guard.cat',                  'chaos-death-guard',          'Death Guard'),
    ('Chaos - Thousand Sons.cat',                'chaos-thousand-sons',        'Thousand Sons'),
    ('Chaos - World Eaters.cat',                 'chaos-world-eaters',         'World Eaters'),
    ('Genestealer Cults.cat',                    'genestealer-cults',          'Genestealer Cults'),
    ('Imperium - Adepta Sororitas.cat',          'imperium-adepta-sororitas',  'Adepta Sororitas'),
    ('Imperium - Adeptus Custodes.cat',          'imperium-adeptus-custodes',  'Adeptus Custodes'),
    ('Imperium - Adeptus Mechanicus.cat',        'imperium-adeptus-mechanicus','Adeptus Mechanicus'),
    ('Imperium - Blood Angels.cat',              'imperium-blood-angels',      'Blood Angels'),
    ('Imperium - Dark Angels.cat',               'imperium-dark-angels',       'Dark Angels'),
    ('Imperium - Grey Knights.cat',              'imperium-grey-knights',      'Grey Knights'),
    ('Imperium - Space Marines.cat',             'imperium-space-marines',     'Space Marines'),
    ('Imperium - Space Wolves.cat',              'imperium-space-wolves',      'Space Wolves'),
    ('Leagues of Votann.cat',                    'leagues-of-votann',          'Leagues of Votann'),
    ('Necrons.cat',                              'necrons',                    'Necrons'),
    ('Orks.cat',                                 'orks',                       'Orks'),
    ("T'au Empire.cat",                          'tau-empire',                 "T'au Empire"),
    ('Tyranids.cat',                             'tyranids',                   'Tyranids'),
]


def build_shared_map(root, ns):
    """Build a dict of id -> element for all sharedSelectionEntries."""
    shared = {}
    for e in root.findall('.//bs:sharedSelectionEntries/bs:selectionEntry', ns):
        eid = e.get('id')
        if eid:
            shared[eid] = e
    # Also sharedSelectionEntryGroups
    for e in root.findall('.//bs:sharedSelectionEntryGroups/bs:selectionEntryGroup', ns):
        eid = e.get('id')
        if eid:
            shared[eid] = e
    return shared


def extract_weapons_from_element(elem, ns, shared_map, depth=0):
    """Recursively extract weapon profiles from an element and its linked shared entries."""
    if depth > 4:
        return [], []
    ranged = []
    melee = []

    # Direct profiles
    for p in elem.findall('bs:profiles/bs:profile', ns):
        type_name = p.get('typeName', '')
        wname = p.get('name', '')
        chars = {c.get('name'): (c.text or '').strip()
                 for c in p.findall('.//bs:characteristic', ns)}
        entry = {'name': wname, **chars}
        if type_name == 'Ranged Weapons':
            ranged.append(entry)
        elif type_name == 'Melee Weapons':
            melee.append(entry)

    # Follow entryLinks to sharedSelectionEntries
    for link in elem.findall('.//bs:entryLinks/bs:entryLink', ns):
        target_id = link.get('targetId')
        if target_id and target_id in shared_map:
            r2, m2 = extract_weapons_from_element(shared_map[target_id], ns, shared_map, depth + 1)
            ranged.extend(r2)
            melee.extend(m2)

    # Walk into selectionEntries and selectionEntryGroups
    for child in elem.findall('bs:selectionEntries/bs:selectionEntry', ns):
        r2, m2 = extract_weapons_from_element(child, ns, shared_map, depth + 1)
        ranged.extend(r2)
        melee.extend(m2)
    for child in elem.findall('bs:selectionEntryGroups/bs:selectionEntryGroup', ns):
        r2, m2 = extract_weapons_from_element(child, ns, shared_map, depth + 1)
        ranged.extend(r2)
        melee.extend(m2)

    return ranged, melee


def deduplicate_weapons(weapons):
    seen = set()
    out = []
    for w in weapons:
        key = w.get('name', '')
        if key and key not in seen:
            seen.add(key)
            out.append(w)
    return out


def parse_catalog(cat_path):
    try:
        tree = ET.parse(cat_path)
    except ET.ParseError as e:
        print(f'  XML parse error: {e}')
        return []

    root = tree.getroot()
    ns = NS
    shared_map = build_shared_map(root, ns)

    units = []
    entries = root.findall('.//bs:selectionEntry[@type="unit"]', ns)

    for e in entries:
        name = e.get('name', '').strip()
        if not name:
            continue

        # Points cost
        points = 0
        for cost in e.findall('.//bs:cost[@name="pts"]', ns):
            try:
                points = int(float(cost.get('value', '0')))
            except ValueError:
                pass

        # Unit stats — first profile of typeName="Unit"
        stats = {}
        for p in e.findall('.//bs:profile[@typeName="Unit"]', ns):
            chars = p.findall('.//bs:characteristic', ns)
            for c in chars:
                key = c.get('name', '')
                val = (c.text or '').strip()
                if key and key not in stats:
                    stats[key] = val
            if stats:
                break

        if not stats:
            continue  # skip entries with no unit stats (likely upgrades)

        # Abilities
        abilities = []
        for p in e.findall('.//bs:profile[@typeName="Abilities"]', ns):
            aname = p.get('name', '')
            desc = ''
            for c in p.findall('.//bs:characteristic[@name="Description"]', ns):
                desc = (c.text or '').strip()
            if aname:
                abilities.append({'name': aname, 'desc': desc})

        # Weapons — traverse the full subtree
        ranged, melee = extract_weapons_from_element(e, ns, shared_map)
        ranged = deduplicate_weapons(ranged)
        melee = deduplicate_weapons(melee)

        # Keywords from categoryLinks
        keywords = []
        for cl in e.findall('.//bs:categoryLinks/bs:categoryLink', ns):
            kw = cl.get('name', '')
            if kw:
                keywords.append(kw)

        units.append({
            'name': name,
            'points': points,
            'stats': stats,
            'keywords': keywords,
            'rangedWeapons': ranged,
            'meleeWeapons': melee,
            'abilities': abilities,
        })

    return units


def main():
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    bs_data_dir = repo_root / 'bsData'
    output_dir = repo_root / 'public' / 'bsData-json'
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = []

    for filename, faction_id, faction_name in CATALOG_MAP:
        cat_path = bs_data_dir / filename
        if not cat_path.exists():
            print(f'SKIP (not found): {filename}')
            continue

        print(f'Parsing {faction_name}...', end=' ', flush=True)
        units = parse_catalog(cat_path)

        if not units:
            print('0 units — skipped')
            continue

        out_path = output_dir / f'{faction_id}.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump({'id': faction_id, 'name': faction_name, 'units': units}, f, ensure_ascii=False)

        print(f'{len(units)} units -> {out_path.name}')
        manifest.append({'id': faction_id, 'name': faction_name, 'file': f'/bsData-json/{faction_id}.json'})

    manifest_path = output_dir / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f'\nManifest written: {manifest_path}')
    print(f'Done — {len(manifest)} factions')


if __name__ == '__main__':
    main()
