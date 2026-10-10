"""Extract original concept pixels using foreground masks; never key a rectangle.

Requires Pillow, numpy and opencv-python-headless. Outputs straight-alpha RGBA.
"""
from pathlib import Path
import json
import hashlib
import argparse
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/art/concepts/facebook-casual'
OUT = ROOT / 'assets/ui/facebook-casual'
parser = argparse.ArgumentParser()
parser.add_argument('--screens', nargs='*')
args = parser.parse_args()

def smooth(a, lo, hi):
    t = np.clip((a-lo)/(hi-lo), 0, 1)
    return t*t*(3-2*t)

def ink_mask(rgb, name, screen):
    f = rgb.astype(np.float32)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    lum = f.mean(axis=2)
    # White lettering on the blue storage header.
    if screen == '09-storage-recovery' and name == 'Title':
        return smooth(f.min(axis=2), 140, 215)
    if name == 'Storage-icon':
        a=smooth(hsv[:,:,1], 80, 150) * smooth(f[:,:,0]-f[:,:,2], 50, 110)
        a[a<.15]=0
        return a
    if name=='Dimmed-settings-title': return 1-smooth(lum,35,75)
    if name.endswith('-icon'):
        return smooth(f[:,:,2]-f[:,:,0], 18, 65) * (1-smooth(lum, 200, 245))
    # Labels on ivory or sky: keep dark ink and its antialiasing only.
    bg=np.percentile(f.reshape(-1,3),90,axis=0)
    if name=='Loading-label': return 1-smooth(lum,80,135)
    samples=f.reshape(-1,3)[lum.ravel()<150]
    if len(samples)==0: samples=f.reshape(-1,3)[lum.ravel()<=np.percentile(lum,3)]
    fg=np.median(samples,axis=0)
    vector=bg-fg
    alpha=np.clip(np.sum((bg-f)*vector,axis=2)/max(1,np.sum(vector*vector)),0,1)
    alpha[alpha<.12]=0
    return alpha

def grab_mask(rgb, name):
    h,w=rgb.shape[:2]
    hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
    mask=np.full((h,w),cv2.GC_PR_BGD,np.uint8)
    # Start with a broad rounded candidate. GrabCut then follows pixel edges.
    shape=Image.new('L',(w,h));d=ImageDraw.Draw(shape)
    d.rounded_rectangle((4,4,w-5,h-5),radius=max(8,min(w,h)*.16),fill=255)
    candidate=np.array(shape)>0
    mask[candidate]=cv2.GC_PR_FGD
    border=max(2,round(min(w,h)*.025))
    mask[:border]=mask[-border:]=cv2.GC_BGD
    mask[:,:border]=mask[:,-border:]=cv2.GC_BGD
    # A large central foreground rectangle incorrectly includes sky / panel gaps.
    # Force only a tiny seed and let the graph follow the complete object edge.
    cv2.circle(mask,(w//2,h//2),max(2,int(min(w,h)*.025)),cv2.GC_FGD,-1)
    if 'Logo' in name or name == 'Loading-logo':
        mask[candidate]=cv2.GC_PR_FGD
        f=rgb.astype(np.int16)
        seed=(f[:,:,0]>170)&(f[:,:,1]>130)
        mask[seed & candidate]=cv2.GC_FGD
    bg=np.zeros((1,65),np.float64);fg=np.zeros((1,65),np.float64)
    cv2.grabCut(rgb,mask,None,bg,fg,5,cv2.GC_INIT_WITH_MASK)
    hard=np.uint8((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD))
    # Discard disconnected scenery/noise, retaining the principal object.
    n, labels, stats, centers=cv2.connectedComponentsWithStats(hard,8)
    if n>1:
        scores=[]
        for i in range(1,n):
            cx,cy=centers[i]
            distance=((cx-w/2)/w)**2+((cy-h/2)/h)**2
            scores.append((stats[i,cv2.CC_STAT_AREA]/(1+distance*5),i))
        principal=max(scores)[1]
        # Logos contain disconnected lettering accents; retain meaningful parts.
        hard=np.uint8(labels==principal)
    if name=='Victory-ribbon':
        hard=np.uint8((hsv[:,:,0]>15)&(hsv[:,:,0]<88)&(hsv[:,:,1]>55))
        hard=cv2.morphologyEx(hard,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
        n,labels,stats,_=cv2.connectedComponentsWithStats(hard,8)
        hard=np.uint8(labels==1+np.argmax(stats[1:,cv2.CC_STAT_AREA]))
        yy,xx=np.indices((h,w))
        hard[(yy+260)<265+.00055*((xx+30)-470)**2]=0
    if name=='Board-and-hand':
        f=rgb.astype(np.int16)
        hard[(f[:,:,2]-f[:,:,0]>90)&(hsv[:,:,1]>100)]=0
    # Preserve the entire interior, including lettering and light reflections.
    if not ('Board' in name or 'board' in name or 'Tower' in name or 'tower' in name or 'Logo' in name or 'logo' in name or 'hand' in name):
        flood=hard.copy();cv2.floodFill(flood,None,(0,0),1)
        hard=np.maximum(hard,1-flood)
    # One-pixel edge transition, not a blurred opaque background halo.
    inside=cv2.distanceTransform(hard,cv2.DIST_L2,3)
    outside=cv2.distanceTransform(1-hard,cv2.DIST_L2,3)
    return np.clip((inside-outside+.75)/2.4,0,1)

def is_ink(screen,name):
    if name.startswith('Setting-') and (name.endswith('-label') or name.endswith('-icon')):
        return True
    if name in ['Dialog-title','Dialog-description','Dimmed-settings-title','Storage-title','Storage-description','Storage-icon','Loading-label','Error-title','Graphics-title','Graphics-description','Button-reset']:
        return True
    return screen=='09-storage-recovery' and name=='Title'

def round_mask(w,h,radius):
    im=Image.new('L',(w*4,h*4));ImageDraw.Draw(im).rounded_rectangle((0,0,w*4-1,h*4-1),radius=radius*4,fill=255)
    return np.array(im.resize((w,h),Image.Resampling.LANCZOS))/255

OVERRIDES={
 ('01-gameplay','Button-settings'):(33,68,129,126,32),
 ('01-gameplay','Button-restart'):(783,68,131,128,34),
 ('01-gameplay','Counter'):(296,159,351,86,43),
 ('01-gameplay','Level-label'):(370,253,200,50,25),
 ('01-gameplay','Button-undo'):(180,1443,560,176,85),
 ('01-gameplay','Button-hint'):(747,1445,166,173,40),
 ('04-levels','Page-label'):(330,1370,279,82,40),
 ('05-settings','Setting-0-control'):(540,393,240,64,22),
 ('05-settings','Setting-1-control'):(672,486,108,55,27),
 ('05-settings','Setting-3-control'):(672,668,108,57,28),
 ('05-settings','Setting-4-control'):(672,758,108,57,28),
 ('05-settings','Setting-5-control'):(540,844,240,65,22),
 ('09-storage-recovery','Button-close'):(739,283,76,76,38),
 ('10-service-states','Loading-progress'):(60,635,344,47,23),
 ('08-reset-confirmation','Button-cancel'):(175,1106,308,124,55),
 ('08-reset-confirmation','Button-confirm-reset'):(500,1106,270,124,50),
}

RECTS={
 ('06-victory','Tower-and-board'):(15,490,915,825),
 ('08-reset-confirmation','Dialog-title'):(210,900,550,70),
 ('08-reset-confirmation','Dialog-description'):(230,980,500,95),
 ('09-storage-recovery','Logo'):(25,25,275,155),
 ('09-storage-recovery','Storage-title'):(310,420,475,50),
 ('09-storage-recovery','Storage-description'):(310,470,475,45),
 ('10-service-states','Loading-logo'):(65,85,345,215),
 ('10-service-states','Graphics-title'):(100,1210,300,85),
 ('10-service-states','Graphics-description'):(70,1300,355,40),
 ('10-service-states','Button-retry-graphics'):(50,1345,365,100),
 ('10-service-states','Button-restart'):(525,1518,365,100),
 ('10-service-states','Stuck-board'):(480,1025,450,405),
}
for i,(y,w) in enumerate([(400,100),(490,100),(580,185),(670,270),(760,295),(850,180)]):
    RECTS[('05-settings',f'Setting-{i}-label')]=(235,y,w,45)
for i,(y,w) in enumerate([(690,130),(800,130),(910,180),(1035,240),(1145,180),(1255,180)]):
    RECTS[('09-storage-recovery',f'Setting-{i}-label')]=(265,y,w,50)

manifest=[]
if (OUT/'manifest.json').exists():
    previous=json.loads((OUT/'manifest.json').read_text('utf-8'))
    # Reconstructed panel bases are independent source assets; retain them on
    # a full extraction, and retain all untouched screens on a partial one.
    manifest=[a for a in previous if a['screen']=='panels' or (args.screens and a['screen'] not in args.screens)]
for screen in json.loads((SOURCE/'source-regions.json').read_text('utf-8')):
    sid=screen['name']
    if args.screens and sid not in args.screens: continue
    source=Image.open(SOURCE/(sid+'.png')).convert('RGB')
    for part in screen['parts']:
        name=part['name']
        if name.startswith('Background'): continue
        x,y,w,h=[part[k] for k in ['x','y','width','height']]
        # Correct the slider boundaries rather than cutting its left half off.
        if sid=='05-settings' and name=='Setting-2-control': x,w=430,360
        if sid=='05-settings' and name=='Setting-2-label': w=200
        if sid=='09-storage-recovery' and name=='Setting-2-control': x,w=465,325
        if sid=='09-storage-recovery' and name=='Setting-2-label': w=210
        if (sid,name) in RECTS: x,y,w,h=RECTS[(sid,name)]
        override=OVERRIDES.get((sid,name))
        if override: x,y,w,h,radius=override
        if override and sid=='01-gameplay' and name!='Button-hint':
            x-=5;y-=5;w+=10;h+=10
        crop=np.array(source.crop((x,y,x+w,y+h)))
        alpha=round_mask(w,h,radius) if override and (sid!='01-gameplay' or name=='Button-hint') else ink_mask(crop,name,sid) if is_ink(sid,name) else grab_mask(crop,name)
        if sid=='10-service-states' and name=='Loading-logo':
            # A white cloud touches the first letter in the reference. Restrict
            # the alpha to the actual blue-outlined logo contour, not the cloud.
            contour=[(17,43),(25,28),(85,19),(145,10),(205,10),(275,17),(327,27),(334,47),(327,100),(337,118),(334,191),(322,207),(259,203),(195,198),(127,201),(63,208),(35,199),(14,162),(14,121),(29,111),(14,75)]
            cm=Image.new('L',(w*4,h*4));ImageDraw.Draw(cm).polygon([(a*4,b*4) for a,b in contour],fill=255)
            alpha*=np.array(cm.resize((w,h),Image.Resampling.LANCZOS))/255
        if sid=='05-settings' and name=='Setting-2-control':
            mask=Image.new('L',(w*4,h*4));md=ImageDraw.Draw(mask)
            md.rounded_rectangle((11*4,34*4,280*4,56*4),radius=11*4,fill=255)
            md.ellipse((94*4,20*4,142*4,68*4),fill=255)
            alpha=np.array(mask.resize((w,h),Image.Resampling.LANCZOS))/255
        if is_ink(sid,name):
            background=np.percentile(crop.reshape(-1,3),90,axis=0)
            nonzero=alpha>0
            cleaned=(crop.astype(float)-background*(1-alpha[:,:,None]))/np.maximum(.001,alpha[:,:,None])
            crop[nonzero]=np.clip(cleaned[nonzero],0,255).astype(np.uint8)
        rgba=np.dstack([crop,np.round(alpha*255).astype(np.uint8)])
        # Transparent pixels carry zero RGB; opaque source pixels are unchanged.
        rgba[rgba[:,:,3]==0,:3]=0
        image=Image.fromarray(rgba)
        bounds=image.getbbox()
        if bounds is None: raise ValueError(f'Empty asset: {sid}/{name}')
        image=image.crop(bounds)
        # Transparent safety padding prevents texture sampling neighboring pixels.
        final=Image.new('RGBA',(image.width+8,image.height+8))
        final.paste(image,(4,4))
        destination=OUT/sid/(name.lower()+'.png')
        destination.parent.mkdir(parents=True,exist_ok=True)
        final.save(destination)
        a=np.array(final)[:,:,3]
        manifest.append({'screen':sid,'name':name,'file':str(destination.relative_to(OUT)).replace('\\','/'),'width':final.width,'height':final.height,'sourceRect':[x,y,w,h],'trim':[bounds[0],bounds[1]],'padding':4,'origin':[x+bounds[0]-4,y+bounds[1]-4],'transparentPixels':int((a==0).sum()),'partialAlphaPixels':int(((a>0)&(a<255)).sum()),'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'status':'needs-visual-review'})
    print(sid+': extracted')
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf-8')

# Proof sheets deliberately composite on several backgrounds, not just checker.
proof=ROOT/'artifacts/alpha-review';proof.mkdir(parents=True,exist_ok=True)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14)
for sid in sorted(set(m['screen'] for m in manifest)):
    entries=[m for m in manifest if m['screen']==sid]
    tilew,tileh=250,230
    sheet=Image.new('RGB',(tilew*4,tileh*((len(entries)+3)//4)), '#64748b')
    draw=ImageDraw.Draw(sheet)
    for i,m in enumerate(entries):
        tx,ty=(i%4)*tilew,(i//4)*tileh
        draw.rectangle((tx,ty,tx+tilew//2,ty+tileh-30),fill='#f8fafc')
        draw.rectangle((tx+tilew//2,ty,tx+tilew,ty+tileh-30),fill='#161b25')
        im=Image.open(OUT/m['file'])
        im.thumbnail((230,185))
        sheet.paste(im,(tx+(tilew-im.width)//2,ty+(tileh-30-im.height)//2),im)
        draw.text((tx+5,ty+tileh-25),m['name'][:30],font=font,fill='white')
    sheet.save(proof/(sid+'.jpg'),quality=93)
print(f'{len(manifest)} RGBA assets; proofs: artifacts/alpha-review/')
