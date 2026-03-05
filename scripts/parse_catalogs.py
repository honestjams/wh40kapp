#!/usr/bin/env python3
"""
Pre-processes BattleScribe XML catalog files into clean JSON for the WH40K companion app.
Outputs one JSON file per faction into public/bsData-json/.
"""

import json
import xml.etree.ElementTree as ET
from pathlib import Path

CAT_NS = 'http://www.battlescribe.net/schema/catalogueSchema'
NS = {'bs': CAT_NS}

# Tuple format:
#   (filename, faction_id, faction_name, det_source_file, det_name_filter, unit_types)
# unit_types defaults to ['unit']; set to ['unit','model'] for Knights factions whose
# datasheets are stored as selectionEntry[@type="model"] with Unit stat profiles.
# det_source_file: if detachments live in a different catalog, specify filename here.
# det_name_filter: optional list of detachment names to include (for sub-chapters).

CATALOG_MAP = [
    # Library-based factions
    ('Aeldari - Aeldari Library.cat',            'aeldari-craftworlds',          'Craftworlds (Aeldari)',  None,                              None,   ['unit']),
    ('Chaos - Chaos Daemons Library.cat',        'chaos-daemons',                'Chaos Daemons',          None,                              None,   ['unit']),
    ('Imperium - Astra Militarum - Library.cat', 'imperium-astra-militarum',     'Astra Militarum',        None,                              None,   ['unit']),
    # Knights — units stored as type="model" with Unit stat profiles in library catalogs
    ('Chaos - Chaos Knights Library.cat',        'chaos-knights',                'Chaos Knights',          None,                              None,   ['model']),
    ('Imperium - Imperial Knights - Library.cat','imperium-imperial-knights',    'Imperial Knights',       None,                              None,   ['unit', 'model']),
    # Main Chaos factions
    ('Chaos - Chaos Space Marines.cat',          'chaos-space-marines',          'Chaos Space Marines',    None,                              None,   ['unit']),
    ("Chaos - Emperor's Children.cat",           'chaos-emperors-children',      "Emperor's Children",     None,                              None,   ['unit']),
    ('Chaos - Death Guard.cat',                  'chaos-death-guard',            'Death Guard',            None,                              None,   ['unit']),
    ('Chaos - Thousand Sons.cat',                'chaos-thousand-sons',          'Thousand Sons',          None,                              None,   ['unit']),
    ('Chaos - World Eaters.cat',                 'chaos-world-eaters',           'World Eaters',           None,                              None,   ['unit']),
    # Genestealer Cults — detachments live in Library - Tyranids.cat
    ('Genestealer Cults.cat',                    'genestealer-cults',            'Genestealer Cults',
        'Library - Tyranids.cat',
        ['Host of Ascension', 'Xenocreed Congregation', 'Biosanctic Broodsurge',
         'Outlander Claw', 'Brood Brother Auxilia', 'Final Day'],
        ['unit']),
    # Imperium
    ('Imperium - Adepta Sororitas.cat',          'imperium-adepta-sororitas',    'Adepta Sororitas',       None,                              None,   ['unit']),
    ('Imperium - Adeptus Custodes.cat',          'imperium-adeptus-custodes',    'Adeptus Custodes',       None,                              None,   ['unit']),
    ('Imperium - Adeptus Mechanicus.cat',        'imperium-adeptus-mechanicus',  'Adeptus Mechanicus',     None,                              None,   ['unit']),
    # Space Marine sub-chapters — detachments pulled from parent SM catalog
    ('Imperium - Blood Angels.cat',   'imperium-blood-angels',  'Blood Angels',
        'Imperium - Space Marines.cat',
        ['The Angelic Host', 'Liberator Assault Group', 'Angelic Inheritors',
         'Wrathful Procession', 'Rage-Cursed Onslaught', 'Gladius Task Force'],
        ['unit']),
    ('Imperium - Dark Angels.cat',    'imperium-dark-angels',   'Dark Angels',
        'Imperium - Space Marines.cat',
        ['Unforgiven Task Force', 'Inner Circle Task Force', "Lion's Blade Task Force",
         'The Lost Brethren', 'Librarius Conclave', 'Company of Hunters',
         'Wrath of the Rock', 'Gladius Task Force'],
        ['unit']),
    ('Imperium - Grey Knights.cat',   'imperium-grey-knights',  'Grey Knights',            None, None, ['unit']),
    ('Imperium - Space Marines.cat',  'imperium-space-marines', 'Space Marines',           None, None, ['unit']),
    ('Imperium - Space Wolves.cat',   'imperium-space-wolves',  'Space Wolves',
        'Imperium - Space Marines.cat',
        ['Champions of Fenris', 'Saga of the Hunter', 'Saga of the Bold',
         'Saga of the Beastslayer', "Emperor's Shield", 'Saga of the Great Wolf',
         'Gladius Task Force'],
        ['unit']),
    ('Imperium - Ultramarines.cat',   'imperium-ultramarines',  'Ultramarines',
        'Imperium - Space Marines.cat',
        ['Blade of Ultramar', 'Vindication Task Force', 'Bastion Task Force',
         'Orbital Assault Force', 'Reclamation Force', 'Gladius Task Force'],
        ['unit']),
    ('Leagues of Votann.cat',         'leagues-of-votann',      'Leagues of Votann',       None, None, ['unit']),
    ('Necrons.cat',                   'necrons',                'Necrons',                 None, None, ['unit']),
    ('Orks.cat',                      'orks',                   'Orks',                    None, None, ['unit']),
    ("T'au Empire.cat",               'tau-empire',             "T'au Empire",             None, None, ['unit']),
    # Tyranids — detachments live in Library - Tyranids.cat
    ('Tyranids.cat',                  'tyranids',               'Tyranids',
        'Library - Tyranids.cat',
        ['Invasion Fleet', 'Assimilation Swarm', 'Crusher Stampede', 'Synaptic Nexus',
         'Unending Swarm', 'Vanguard Onslaught', 'Warrior Bioform Onslaught', 'Subterranean Assault'],
        ['unit']),
]


def build_shared_map(root, ns):
    shared = {}
    for e in root.findall('.//bs:sharedSelectionEntries/bs:selectionEntry', ns):
        eid = e.get('id')
        if eid:
            shared[eid] = e
    for e in root.findall('.//bs:sharedSelectionEntryGroups/bs:selectionEntryGroup', ns):
        eid = e.get('id')
        if eid:
            shared[eid] = e
    return shared


def extract_weapons_from_element(elem, ns, shared_map, depth=0):
    if depth > 4:
        return [], []
    ranged, melee = [], []

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

    for link in elem.findall('.//bs:entryLinks/bs:entryLink', ns):
        target_id = link.get('targetId')
        if target_id and target_id in shared_map:
            r2, m2 = extract_weapons_from_element(shared_map[target_id], ns, shared_map, depth + 1)
            ranged.extend(r2)
            melee.extend(m2)

    for child in elem.findall('bs:selectionEntries/bs:selectionEntry', ns):
        r2, m2 = extract_weapons_from_element(child, ns, shared_map, depth + 1)
        ranged.extend(r2)
        melee.extend(m2)
    for child in elem.findall('bs:selectionEntryGroups/bs:selectionEntryGroup', ns):
        r2, m2 = extract_weapons_from_element(child, ns, shared_map, depth + 1)
        ranged.extend(r2)
        melee.extend(m2)

    return ranged, melee


def deduplicate(items, key='name'):
    seen, out = set(), []
    for w in items:
        k = w.get(key, '')
        if k and k not in seen:
            seen.add(k)
            out.append(w)
    return out


def extract_detachments_from_root(root, ns, name_filter=None):
    """Extract detachment entries with abilities from a parsed catalog root.
    Handles both 'Detachment' (singular) and 'Detachments' (plural) group names,
    and both inline selectionEntryGroups and sharedSelectionEntryGroups.
    """
    detachments = []
    seen = set()

    for group_name in ('Detachment', 'Detachments'):
        for seg in root.findall(f'.//bs:selectionEntryGroup[@name="{group_name}"]', ns):
            for e in seg.findall('bs:selectionEntries/bs:selectionEntry', ns):
                name = e.get('name', '').strip()
                if not name or name in seen:
                    continue
                if name_filter and name not in name_filter:
                    continue
                seen.add(name)

                abilities = []
                for p in e.findall('.//bs:profile[@typeName="Abilities"]', ns):
                    aname = p.get('name', '')
                    desc = ''
                    for c in p.findall('.//bs:characteristic[@name="Description"]', ns):
                        desc = (c.text or '').strip()
                    if aname:
                        abilities.append({'name': aname, 'desc': desc})

                detachments.append({'name': name, 'abilities': abilities})

    return detachments


def parse_catalog(cat_path, det_source_path=None, det_name_filter=None, unit_types=None):
    if unit_types is None:
        unit_types = ['unit']

    try:
        tree = ET.parse(cat_path)
    except ET.ParseError as e:
        print(f'  XML parse error: {e}')
        return [], []

    root = tree.getroot()
    ns = NS
    shared_map = build_shared_map(root, ns)

    # ── Units ────────────────────────────────────────────────────────────────
    units = []
    seen_names = set()
    for unit_type in unit_types:
        for e in root.findall(f'.//bs:selectionEntry[@type="{unit_type}"]', ns):
            name = e.get('name', '').strip()
            if not name or name in seen_names:
                continue

            points = 0
            for cost in e.findall('.//bs:cost[@name="pts"]', ns):
                try:
                    points = int(float(cost.get('value', '0')))
                except ValueError:
                    pass

            stats = {}
            for p in e.findall('.//bs:profile[@typeName="Unit"]', ns):
                for c in p.findall('.//bs:characteristic', ns):
                    key = c.get('name', '')
                    val = (c.text or '').strip()
                    if key and key not in stats:
                        stats[key] = val
                if stats:
                    break

            if not stats:
                continue

            seen_names.add(name)

            abilities = []
            for p in e.findall('.//bs:profile[@typeName="Abilities"]', ns):
                aname = p.get('name', '')
                desc = ''
                for c in p.findall('.//bs:characteristic[@name="Description"]', ns):
                    desc = (c.text or '').strip()
                if aname:
                    abilities.append({'name': aname, 'desc': desc})

            ranged, melee = extract_weapons_from_element(e, ns, shared_map)

            keywords = [cl.get('name', '') for cl in e.findall('.//bs:categoryLinks/bs:categoryLink', ns)
                        if cl.get('name', '')]

            units.append({
                'name': name,
                'points': points,
                'stats': stats,
                'keywords': keywords,
                'rangedWeapons': deduplicate(ranged),
                'meleeWeapons': deduplicate(melee),
                'abilities': abilities,
            })

    # ── Detachments ──────────────────────────────────────────────────────────
    if det_source_path and det_source_path.exists():
        try:
            det_tree = ET.parse(det_source_path)
            det_root = det_tree.getroot()
        except ET.ParseError:
            det_root = root
    else:
        det_root = root

    detachments = extract_detachments_from_root(det_root, ns, det_name_filter)

    return units, detachments


def main():
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    bs_data_dir = repo_root / 'bsData'
    output_dir = repo_root / 'public' / 'bsData-json'
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = []

    for filename, faction_id, faction_name, det_src_file, det_filter, unit_types in CATALOG_MAP:
        cat_path = bs_data_dir / filename
        if not cat_path.exists():
            print(f'SKIP (not found): {filename}')
            continue

        det_src = (bs_data_dir / det_src_file) if det_src_file else None
        det_filt = set(det_filter) if det_filter else None

        print(f'Parsing {faction_name}...', end=' ', flush=True)
        units, detachments = parse_catalog(cat_path, det_src, det_filt, unit_types)

        if not units:
            print('0 units — skipped')
            continue

        out_path = output_dir / f'{faction_id}.json'
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump({
                'id': faction_id,
                'name': faction_name,
                'units': units,
                'detachments': detachments,
            }, f, ensure_ascii=False)

        print(f'{len(units)} units, {len(detachments)} detachments -> {out_path.name}')
        manifest.append({'id': faction_id, 'name': faction_name, 'file': f'/bsData-json/{faction_id}.json'})

    manifest_path = output_dir / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    print(f'\nManifest: {manifest_path}  ({len(manifest)} factions)')


if __name__ == '__main__':
    main()
