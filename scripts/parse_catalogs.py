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

# Maps faction_id -> (filename, display_name, optional_detachment_source_file, filter_detachment_names)
# If a sub-chapter's detachments live in the parent catalog, specify them explicitly.
CATALOG_MAP = [
    # Some factions store units in a shared Library catalog
    ('Aeldari - Aeldari Library.cat',            'aeldari-craftworlds',        'Craftworlds (Aeldari)', None, None),
    ('Chaos - Chaos Daemons Library.cat',        'chaos-daemons',              'Chaos Daemons',         None, None),
    ('Imperium - Astra Militarum - Library.cat', 'imperium-astra-militarum',   'Astra Militarum',       None, None),
    # Main factions
    ('Chaos - Chaos Space Marines.cat',          'chaos-space-marines',        'Chaos Space Marines',   None, None),
    ('Chaos - Death Guard.cat',                  'chaos-death-guard',          'Death Guard',           None, None),
    ('Chaos - Thousand Sons.cat',                'chaos-thousand-sons',        'Thousand Sons',         None, None),
    ('Chaos - World Eaters.cat',                 'chaos-world-eaters',         'World Eaters',          None, None),
    ('Genestealer Cults.cat',                    'genestealer-cults',          'Genestealer Cults',     None, None),
    ('Imperium - Adepta Sororitas.cat',          'imperium-adepta-sororitas',  'Adepta Sororitas',      None, None),
    ('Imperium - Adeptus Custodes.cat',          'imperium-adeptus-custodes',  'Adeptus Custodes',      None, None),
    ('Imperium - Adeptus Mechanicus.cat',        'imperium-adeptus-mechanicus','Adeptus Mechanicus',    None, None),
    # Space Marine sub-chapters pull detachments from the parent SM catalog
    ('Imperium - Blood Angels.cat',   'imperium-blood-angels',  'Blood Angels',
        'Imperium - Space Marines.cat',
        ['The Angelic Host', 'Liberator Assault Group', 'Angelic Inheritors', 'Wrathful Procession', 'Gladius Task Force']),
    ('Imperium - Dark Angels.cat',    'imperium-dark-angels',   'Dark Angels',
        'Imperium - Space Marines.cat',
        ['Unforgiven Task Force', 'Inner Circle Task Force', "Lion's Blade Task Force",
         'The Lost Brethren', 'Librarius Conclave', 'Company of Hunters', 'Gladius Task Force']),
    ('Imperium - Grey Knights.cat',   'imperium-grey-knights',  'Grey Knights',            None, None),
    ('Imperium - Space Marines.cat',  'imperium-space-marines', 'Space Marines',           None, None),
    ('Imperium - Space Wolves.cat',   'imperium-space-wolves',  'Space Wolves',
        'Imperium - Space Marines.cat',
        ['Champions of Fenris', 'Saga of the Hunter', 'Saga of the Bold',
         'Saga of the Beastslayer', "Emperor's Shield", 'Shadowmark Talon', 'Gladius Task Force']),
    ('Leagues of Votann.cat',         'leagues-of-votann',      'Leagues of Votann',       None, None),
    ('Necrons.cat',                   'necrons',                'Necrons',                 None, None),
    ('Orks.cat',                      'orks',                   'Orks',                    None, None),
    ("T'au Empire.cat",               'tau-empire',             "T'au Empire",             None, None),
    ('Tyranids.cat',                  'tyranids',               'Tyranids',                None, None),
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
    """Extract detachment entries with abilities from a parsed catalog root."""
    detachments = []
    seen = set()

    for seg in root.findall('.//bs:selectionEntryGroup[@name="Detachment"]', ns):
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


def parse_catalog(cat_path, det_source_path=None, det_name_filter=None):
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
    for e in root.findall('.//bs:selectionEntry[@type="unit"]', ns):
        name = e.get('name', '').strip()
        if not name:
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

    for filename, faction_id, faction_name, det_src_file, det_filter in CATALOG_MAP:
        cat_path = bs_data_dir / filename
        if not cat_path.exists():
            print(f'SKIP (not found): {filename}')
            continue

        det_src = (bs_data_dir / det_src_file) if det_src_file else None
        det_filt = set(det_filter) if det_filter else None

        print(f'Parsing {faction_name}...', end=' ', flush=True)
        units, detachments = parse_catalog(cat_path, det_src, det_filt)

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
