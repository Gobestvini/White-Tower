// Preserve source pixels while splitting the composition into named image regions.
// This generates SVG containers; it does not redraw or alter the PNG originals.
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const layouts = {
  '01-gameplay': [
    ['Logo',310,0,325,145], ['Button-settings',20,55,170,145],
    ['Button-restart',765,55,165,145], ['Counter',285,150,375,115],
    ['Level-label',350,275,245,65], ['Board',0,350,941,1055],
    ['Button-undo',165,1435,600,205], ['Button-hint',765,1435,175,205],
  ],
  '02-tutorial': [
    ['Button-settings',35,35,165,165], ['Button-restart',740,35,170,165],
    ['HUD',250,15,445,215], ['Tutorial-card',150,375,640,235],
    ['Board-and-hand',135,635,685,525], ['Button-undo',255,1475,430,155],
  ],
  '03-hint': [
    ['Logo',40,30,275,160], ['Level-label',325,35,320,85],
    ['Counter',355,120,255,85], ['Button-restart',665,35,130,135],
    ['Button-settings',795,35,135,135], ['Board-with-highlight',30,270,880,910],
    ['Hint-card',200,1180,540,190], ['Button-undo',25,1435,410,180],
    ['Button-hint',685,1380,240,245],
  ],
  '04-levels': [
    ['Logo',235,25,395,235], ['Tower-decoration',630,40,200,235],
    ['Title-card',120,310,700,165], ['Button-prev',145,1350,150,120],
    ['Page-label',320,1350,305,120], ['Button-next',645,1350,150,120],
    ['Button-settings',180,1510,580,145],
    ...Array.from({length:30},(_,i)=>['Level-'+String(i+1).padStart(2,'0'),75+(i%5)*157,475+Math.floor(i/5)*145,155,145]),
  ],
  '05-settings': [
    ['Title',215,225,515,140],
    ...[380,470,560,650,740,830].flatMap((y,i)=>[
      ['Setting-'+i+'-icon',155,y,75,85],
      ['Setting-'+i+'-label',230,y,305,85],
      ['Setting-'+i+'-control',535,y,255,85],
    ]),
    ['Button-levels',140,950,330,120], ['Button-hint',475,950,330,120],
    ['Button-export',145,1070,325,90], ['Button-import',475,1070,325,90],
    ['Button-reset',345,1170,250,55], ['Button-resume',145,1230,655,145],
  ],
  '06-victory': [
    ['Logo',305,25,330,170], ['Level-label',350,195,245,65],
    ['Victory-ribbon',30,260,885,305], ['Tower-and-board',15,565,915,750],
    ['Button-next',110,1315,725,210], ['Button-undo',310,1530,325,110],
  ],
  '07-campaign-complete': [
    ['Logo',320,10,300,155], ['Campaign-ribbon',40,175,860,200],
    ['Tower-and-island',140,375,655,810], ['Completion-label',75,1185,795,145],
    ['Button-levels',135,1330,675,185], ['Button-undo',285,1520,375,120],
  ],
  '08-reset-confirmation': [
    ['Logo',95,40,300,250], ['Dimmed-settings-title',115,360,420,110],
    ['Dialog-icon',375,725,190,180], ['Dialog-title',205,930,545,70],
    ['Dialog-description',215,1010,520,95], ['Button-cancel',165,1105,325,155],
    ['Button-confirm-reset',490,1105,295,155],
  ],
  '09-storage-recovery': [
    ['Logo',25,25,300,210], ['Title',300,285,370,70], ['Button-close',735,275,85,85],
    ['Storage-icon',160,420,130,140], ['Storage-title',310,420,475,60],
    ['Storage-description',310,480,475,40], ['Button-retry',310,520,485,100],
    ...[660,780,900,1020,1140,1260].flatMap((y,i)=>[
      ['Setting-'+i+'-icon',165,y,85,i===5?80:110], ['Setting-'+i+'-label',255,y,285,i===5?80:110],
      ['Setting-'+i+'-control',540,y,250,i===5?80:110],
    ]),
    ['Button-resume',130,1340,685,145],
  ],
  '10-service-states': [
    ['Loading-logo',20,65,420,250], ['Loading-tower',10,315,445,315],
    ['Loading-progress',50,630,375,65], ['Loading-label',80,695,325,60],
    ['Error-icon',670,350,75,80], ['Error-title',575,435,280,75],
    ['Button-retry-level',545,525,335,90], ['Button-levels',545,615,335,80],
    ['Graphics-illustration',90,950,285,260], ['Graphics-title',65,1245,355,80],
    ['Graphics-description',70,1325,355,35], ['Button-retry-graphics',60,1360,365,95],
    ['Undo-tip',550,900,360,160], ['Stuck-board',480,1060,450,370],
    ['Button-undo',525,1430,365,100], ['Button-restart',525,1530,365,95],
  ],
};

function subtract(a,b) {
  const [x,y,w,h]=a, [bx,by,bw,bh]=b;
  const l=Math.max(x,bx), t=Math.max(y,by), r=Math.min(x+w,bx+bw), d=Math.min(y+h,by+bh);
  if(l>=r || t>=d) return [a];
  return [[x,y,w,t-y],[x,d,w,y+h-d],[x,t,l-x,d-t],[r,t,x+w-r,d-t]].filter(r=>r[2]>0 && r[3]>0);
}

const out=path.join(root,'figma-layers'); fs.mkdirSync(out,{recursive:true});
const manifest=[];
for(const [name,regions] of Object.entries(layouts)) {
  const png=fs.readFileSync(path.join(root,name+'.png'));
  const width=png.readUInt32BE(16), height=png.readUInt32BE(20);
  let background=[[0,0,width,height]];
  for(const [label,...bounds] of regions) {
    if(bounds[0]<0 || bounds[1]<0 || bounds[0]+bounds[2]>width || bounds[1]+bounds[3]>height) throw new Error(name+': invalid '+label);
    background=background.flatMap(r=>subtract(r,bounds));
  }
  const parts=[...background.map((r,i)=>['Background-'+String(i+1).padStart(3,'0'),...r]),...regions];
  const area=parts.reduce((a,[,x,y,w,h])=>a+w*h,0);
  if(area!==width*height) throw new Error(name+': overlapping regions');
  const clips=parts.map(([,x,y,w,h],i)=>`<clipPath id="clip${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`).join('');
  const groups=parts.map(([label],i)=>`<g id="${label}" data-name="${label}"><g clip-path="url(#clip${i})"><use href="#source" xlink:href="#source"/></g></g>`).join('\n');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><image id="source" width="${width}" height="${height}" href="data:image/png;base64,${png.toString('base64')}"/>${clips}</defs>${groups}</svg>`;
  fs.writeFileSync(path.join(out,name+'-layers.svg'),svg);
  manifest.push({name,width,height,parts:parts.map(([name,x,y,width,height])=>({name,x,y,width,height}))});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest.map(m=>({name:m.name,layers:m.parts.length,elements:m.parts.filter(p=>!p.name.startsWith('Background')).length})),null,2));
