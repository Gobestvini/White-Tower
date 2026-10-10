"""Trim and clean generated blank panel alpha without baking a matte color."""
from pathlib import Path
import json, hashlib
import numpy as np
import cv2
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/ui/facebook-casual'
manifest=json.loads((OUT/'manifest.json').read_text('utf-8'))
manifest=[a for a in manifest if a['screen']!='panels']
for name in ['panel-levels','panel-settings','panel-confirmation','panel-storage']:
    im=Image.open(ROOT/'artifacts/alpha-review'/(name+'-raw.png')).convert('RGBA')
    p=np.array(im)
    alpha=p[:,:,3]
    n,labels,stats,_=cv2.connectedComponentsWithStats(np.uint8(alpha>32),8)
    largest=1+np.argmax(stats[1:,cv2.CC_STAT_AREA])
    solid=np.uint8(labels==largest)
    # Remove isolated cyan specks and the contaminated outermost fringe.
    solid=cv2.erode(solid,np.ones((3,3),np.uint8))
    inside=cv2.distanceTransform(solid,cv2.DIST_L2,3)
    outside=cv2.distanceTransform(1-solid,cv2.DIST_L2,3)
    edge=np.clip((inside-outside+1)/2,0,1)
    p[:,:,3]=np.minimum(alpha,np.round(edge*255).astype(np.uint8))
    p[:,:,3][p[:,:,3]>=250]=255
    p[p[:,:,3]==0,:3]=0
    clipped=Image.fromarray(p)
    clipped=clipped.crop(clipped.getbbox())
    padded=Image.new('RGBA',(clipped.width+16,clipped.height+16));padded.paste(clipped,(8,8))
    dest=OUT/'panels'/(name+'.png');dest.parent.mkdir(exist_ok=True);padded.save(dest)
    a=np.array(padded)[:,:,3]
    manifest.append({'screen':'panels','name':name,'file':'panels/'+name+'.png','width':padded.width,'height':padded.height,'padding':8,'transparentPixels':int((a==0).sum()),'partialAlphaPixels':int(((a>0)&(a<255)).sum()),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'source':'built-in image_gen reconstruction of blank panel; not pixel-identical extraction','status':'needs-visual-review'})
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf-8')
print('4 clean, blank, transparent panel bases saved')
