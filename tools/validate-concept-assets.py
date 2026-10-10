"""Reject opaque rectangles, missing alpha, dirty padding and stale metadata."""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
DIR=ROOT/'assets/ui/facebook-casual'
assets=json.loads((DIR/'manifest.json').read_text('utf-8'))
assert len(assets)==150, f'Expected 150 exports, got {len(assets)}'
for a in assets:
    path=DIR/a['file']
    with Image.open(path) as im:
        assert im.mode=='RGBA', f'{path.name}: missing RGBA'
        assert im.size==(a['width'],a['height']), f'{path.name}: wrong dimensions'
        p=np.array(im);alpha=p[:,:,3];pad=a['padding']
        assert alpha.max()==255, f'{path.name}: no opaque foreground'
        assert not alpha[:pad].any() and not alpha[-pad:].any() and not alpha[:,:pad].any() and not alpha[:,-pad:].any(), f'{path.name}: dirty transparent padding'
        assert not p[alpha==0,:3].any(), f'{path.name}: hidden matte RGB'
        assert (alpha==0).sum()==a['transparentPixels'], f'{path.name}: stale alpha metrics'
        interior=alpha[pad:-pad,pad:-pad]
        assert (interior==0).any(), f'{path.name}: opaque rectangular silhouette'
    assert hashlib.sha256(path.read_bytes()).hexdigest()==a['sha256'],f'{path.name}: stale checksum'
print('PASS: 150 standalone RGBA PNGs; zero-alpha padding; no hidden matte; nonrectangular silhouettes; dimensions and checksums match')
