const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const assetsDir=path.join(root,'assets/ui/facebook-casual');
const out=path.join(root,'docs/art/concepts/facebook-casual/assembled');
fs.mkdirSync(out,{recursive:true});
const assets=JSON.parse(fs.readFileSync(path.join(assetsDir,'manifest.json'),'utf8'));
const screens=[...new Set(assets.filter(a=>a.screen!=='panels').map(a=>a.screen))].sort();
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const data=(file,type)=>`data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const png=(name,file,x,y,w,h)=>`<g id="${esc(name)}" data-name="${esc(name)}"><image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" href="${data(path.join(assetsDir,file),'image/png')}"/></g>`;
const asset=(a,name=a.name)=>png(name,a.file,...a.origin,a.width,a.height);
const find=(screen,name)=>{const a=assets.find(a=>a.screen===screen&&a.name===name);if(!a)throw Error(screen+'/'+name);return a;};
const panel=(name,x,y,w,h)=>png('Panel-'+name,'panels/panel-'+name+'.png',x,y,w,h);
const rect=(name,x,y,w,h,r,fill,stroke='none',sw=1)=>`<g id="${name}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/></g>`;
const text=(name,label,x,y,size=30,color='#103775')=>`<g id="${name}"><text x="${x}" y="${y}" font-family="Trebuchet MS,Arial,sans-serif" font-weight="700" font-size="${size}" fill="${color}">${esc(label)}</text></g>`;
const use=(screen,name,x,y,w,h,id)=>png(id,find(screen,name).file,x,y,w,h);
const defs=`<defs><linearGradient id="ivory" x2="0" y2="1"><stop stop-color="#fffdf7"/><stop offset="1" stop-color="#f5eddd"/></linearGradient><linearGradient id="warning" x2="0" y2="1"><stop stop-color="#ffedb5"/><stop offset="1" stop-color="#fff3cf"/></linearGradient></defs>`;
const manifest=[];
for(const screen of screens){
 const entries=assets.filter(a=>a.screen===screen);
 const bg=path.join(assetsDir,'backgrounds',screen+'.jpg');
 if(!fs.existsSync(bg))throw Error('Missing clean background: '+bg);
 let body=`<g id="Background-clean"><image width="941" height="1672" preserveAspectRatio="none" href="${data(bg,'image/jpeg')}"/></g>`;
 const supplemental=[];
 const add=s=>{body+=s;supplemental.push(s.match(/id="([^"]+)"/)?.[1]);};
 if(screen==='04-levels') add(panel('levels',32,268,876,1230));
 if(screen==='05-settings'){
  add(panel('settings',96,299,749,1120));
  add(rect('Settings-inner-card',143,380,653,554,30,'url(#ivory)','#e1d9ca',1.5));
  for(let i=0;i<5;i++)add(rect('Settings-divider-'+i,158,468+i*91,625,2,1,'#ded6c7'));
  add(text('Volume-value','40%',730,615,28));
  add(rect('Reset-divider-left',158,1197,176,3,1,'#c4ccd2'));
  add(rect('Reset-divider-right',609,1197,176,3,1,'#c4ccd2'));
 }
 if(screen==='08-reset-confirmation'){
  body+='<g id="Underlying-settings">';
  add(panel('settings',40,315,861,1324));
  add(asset(find(screen,'Dimmed-settings-title')));
  add(rect('Settings-top-card',96,470,748,239,34,'url(#ivory)','#e1d9ca',1));
  add(rect('Settings-lower-card',96,735,748,848,34,'url(#ivory)','#e1d9ca',1));
  add(use('05-settings','Setting-1-icon',129,499,65,60,'Underlying-sound-icon'));
  add(text('Underlying-sound-label','Звуки',214,542,38));
  add(use('05-settings','Setting-1-control',696,497,126,75,'Underlying-sound-toggle'));
  add(`<g id="Underlying-music-icon"><path d="M147 640v35c-23-4-26 24-8 24 13 0 20-9 20-21v-31l24-7v26c-22-2-24 24-7 24 14 0 20-8 20-22v-45z" fill="#0c4f99"/></g>`);
  add(text('Underlying-music-label','Музыка',214,662,38));
  add(use('05-settings','Setting-1-control',696,617,126,75,'Underlying-music-toggle'));
  for(const [i,y,label,icon] of [[0,1290,'','Setting-5-icon'],[1,1400,'','Setting-0-icon'],[2,1505,'Сбросить прогресс','Setting-5-icon']]){
   if(i===2)add(`<g id="Underlying-reset-icon"><path d="M137 ${y+16}h43m-35-9h27m-29 10 4 38h26l4-38m-23 7v24m10-24v24" fill="none" stroke="#b52c36" stroke-width="6" stroke-linecap="round"/></g>`);
   else add(use('09-storage-recovery',icon,130,y,59,59,'Underlying-row-icon-'+i));
   if(label)add(text('Underlying-reset-label',label,218,y+42,36,'#b52c36'));
   add(`<g id="Underlying-chevron-${i}"><path d="M786 ${y+7}l14 15-14 15" stroke="#165a9e" stroke-width="7" fill="none" stroke-linecap="round"/></g>`);
  }
  body+='</g>';
  add(rect('Underlying-settings-dimmer',40,315,861,1324,73,'#051a35'));
  body=body.replace('id="Underlying-settings-dimmer"','id="Underlying-settings-dimmer" opacity="0.55"');
  add(panel('confirmation',125,680,692,604));
 }
 if(screen==='09-storage-recovery'){
  add(panel('storage',105,260,734,1242));
  add(rect('Storage-warning-card',142,400,660,224,35,'url(#warning)','#ecc875',2));
  for(const [i,y,h] of [[0,663,98],[1,780,96],[2,893,90],[3,1017,95],[4,1128,96],[5,1240,94]])add(rect('Storage-row-'+i,142,y,660,h,28,'url(#ivory)','#ded8cd',2));
  add(rect('Storage-divider-top',143,643,658,2,1,'#dcd5c9'));
  add(rect('Storage-divider-bottom',143,999,658,2,1,'#dcd5c9'));
 }
 if(screen==='10-service-states'){
  add(rect('Error-level-panel',521,330,382,378,36,'url(#ivory)','#e6dcc8',2));
  add(rect('Graphics-error-panel',36,1184,398,280,35,'url(#ivory)','#e6dcc8',2));
 }
 // Preserve original coordinates, original pixels and individual image nodes.
 // The recovered background plate contains no UI beneath these layers.
 for(const a of entries){if(screen==='08-reset-confirmation'&&a.name==='Dimmed-settings-title')continue;body+=asset(a);}
 const file=screen+'-assembled.svg';
 fs.writeFileSync(path.join(out,file),`<svg xmlns="http://www.w3.org/2000/svg" width="941" height="1672" viewBox="0 0 941 1672">${defs}${body}</svg>`);
 manifest.push({screen,file,width:941,height:1672,assets:entries.length,supplementalLayers:supplemental,background:'assets/ui/facebook-casual/backgrounds/'+screen+'.jpg',elements:entries.map(a=>({name:a.name,file:a.file,x:a.origin[0],y:a.origin[1],width:a.width,height:a.height,sha256:a.sha256}))});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
const cards=manifest.map(m=>`<article><h2>${m.screen}</h2><div class="pair"><figure><img src="../${m.screen}.png" alt="Исходный мокап ${m.screen}"><figcaption>Исходный мокап</figcaption></figure><figure><img src="${m.file}" alt="Собранный экран ${m.screen}"><figcaption>Собран из отдельных элементов</figcaption></figure></div><a href="${m.file}" download>Скачать SVG со слоями</a></article>`).join('\n');
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White Tower — собранные экраны</title><style>body{margin:0;padding:24px;background:#14243a;color:#edf4ff;font:16px/1.5 system-ui}h1{margin:0;font-size:28px}h2{font-size:20px}p{max-width:950px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,640px),1fr));gap:24px}article{padding:16px;border:1px solid #5b7492;border-radius:12px}figure{margin:0;min-width:0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}img{display:block;width:100%;height:auto;border-radius:8px}figcaption{font-size:13px;color:#b6c9df}a{color:#8bd9ff}</style><h1>White Tower · десять экранов из отдельных элементов</h1><p>Координаты и размеры PNG взяты из исходных мокапов. Кнопки, логотипы, подписи и панели остаются отдельными слоями в SVG/Figma. Чистые фоновые иллюстрации восстановлены; скрытые участки фона и панели отличаются от оригинала.</p><main>${cards}</main></html>`);
fs.writeFileSync(path.join(out,'overview.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White Tower — все собранные экраны</title><style>body{margin:0;padding:16px;background:#14243a;color:#edf4ff;font:14px/1.4 system-ui}h1{font-size:22px;margin:0 0 16px}main{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}figure{margin:0}img{width:100%;display:block;border-radius:6px}figcaption{font-size:12px;margin:4px 0 8px}</style><h1>WHITE TOWER · собранные экраны</h1><main>${manifest.map(m=>`<figure><figcaption>${m.screen}</figcaption><img src="${m.file}" alt="${m.screen}"></figure>`).join('')}</main></html>`);
console.log('Assembled '+manifest.length+' screens from '+manifest.reduce((n,m)=>n+m.assets,0)+' existing foreground assets');
