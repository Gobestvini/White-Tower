"""Check that screen assemblies preserve the source PNGs and their placement."""
import base64
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/art/concepts/facebook-casual/assembled'
ASSETS = ROOT / 'assets/ui/facebook-casual'
NS = '{http://www.w3.org/2000/svg}'
source = json.loads((ASSETS / 'manifest.json').read_text(encoding='utf-8'))
screens = json.loads((OUT / 'manifest.json').read_text(encoding='utf-8'))
backgrounds = json.loads((ASSETS / 'backgrounds/manifest.json').read_text(encoding='utf-8'))
assert len(screens) == len(backgrounds) == 10
total = 0
for screen in screens:
    svg = ET.parse(OUT / screen['file']).getroot()
    assert svg.attrib['viewBox'] == '0 0 941 1672'
    groups = [g for g in svg.iter(NS + 'g')]
    ids = [g.attrib['id'] for g in groups]
    assert len(ids) == len(set(ids)), screen['screen']
    by_id = {g.attrib['id']: g for g in groups}
    expected = [a for a in source if a['screen'] == screen['screen']]
    assert len(expected) == screen['assets'] == len(screen['elements'])
    for asset in expected:
        image = by_id[asset['name']].find(NS + 'image')
        assert image is not None, asset['name']
        assert [int(image.attrib[k]) for k in ('x', 'y')] == asset['origin']
        assert [int(image.attrib[k]) for k in ('width', 'height')] == [asset['width'], asset['height']]
        raw = base64.b64decode(image.attrib['href'].split(',', 1)[1])
        assert raw == (ASSETS / asset['file']).read_bytes(), asset['file']
        assert hashlib.sha256(raw).hexdigest() == asset['sha256']
        total += 1
    bg = by_id['Background-clean'].find(NS + 'image')
    raw = base64.b64decode(bg.attrib['href'].split(',', 1)[1])
    expected_bg = next(b for b in backgrounds if b['screen'] == screen['screen'])
    assert raw == (ROOT / screen['background']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == expected_bg['sha256']
    assert raw != (OUT.parent / (screen['screen'] + '.png')).read_bytes()
assert total == 146
print('PASS: 10 layered screens, 146 unchanged PNGs at source coordinates, 10 separate clean backgrounds')
