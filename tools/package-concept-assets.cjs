const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'assets/ui/facebook-casual');
const assets=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const boards=path.join(root,'docs/art/concepts/facebook-casual/alpha-boards');
fs.mkdirSync(boards,{recursive:true});
const groups=[...new Set(assets.map(a=>a.screen))];
const boardManifest=[];
for(const group of groups){
 const entries=assets.filter(a=>a.screen===group);
 // Every child is its OWN alpha PNG. No masked complete-screen texture.
 const widths=entries.map(a=>a.width),heights=entries.map(a=>a.height);
 const cellWidth=Math.max(280,...widths)+40;
 const cellHeight=Math.max(200,...heights)+40;
 const cols=group==='panels'?2:3;
 const width=cellWidth*cols,height=cellHeight*Math.ceil(entries.length/cols);
 const images=entries.map((a,i)=>{
  const x=(i%cols)*cellWidth+(cellWidth-a.width)/2;
  const y=Math.floor(i/cols)*cellHeight+(cellHeight-a.height)/2;
  const base64=fs.readFileSync(path.join(dir,a.file)).toString('base64');
  return `<g id="${a.name}" data-name="${a.name}"><image x="${x}" y="${y}" width="${a.width}" height="${a.height}" href="data:image/png;base64,${base64}"/></g>`;
 }).join('\n');
 const name=group+'-alpha-assets.svg';
 fs.writeFileSync(path.join(boards,name),`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${images}</svg>`);
 boardManifest.push({group,file:name,width,height,assets:entries.length});
}
fs.writeFileSync(path.join(boards,'manifest.json'),JSON.stringify(boardManifest,null,2)+'\n');
const cards=assets.map(a=>`<figure><a href="${a.file}" download><img src="${a.file}" alt="${a.screen} / ${a.name}" loading="lazy"></a><figcaption>${a.screen}<br><strong>${a.name}</strong><br>${a.width} × ${a.height} · PNG RGBA</figcaption></figure>`).join('\n');
fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White Tower — прозрачные ассеты</title>
<style>body{margin:0;background:#14243a;color:#eef4ff;font:16px/1.5 system-ui}header{padding:24px;position:sticky;top:0;background:#14243af5;z-index:1}h1{font-size:25px;margin:0}p{max-width:1000px;color:#c1d3e8;margin:8px 0}button{padding:8px 14px;cursor:pointer;margin:4px;border:1px solid #8ca4c1;border-radius:8px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;padding:24px}figure{margin:0;border:1px solid #5c708d;border-radius:10px;overflow:hidden}figure a{display:flex;height:220px;align-items:center;justify-content:center;background:repeating-conic-gradient(#cbd5e1 0% 25%,#f8fafc 0% 50%) 50%/24px 24px}img{display:block;max-width:94%;max-height:94%;object-fit:contain}figcaption{padding:12px;font-size:13px}body[data-bg=light] figure a{background:#f8fafc}body[data-bg=dark] figure a{background:#121722}body[data-bg=blue] figure a{background:#60c0fe}</style>
<header><h1>WHITE TOWER · ${assets.length} прозрачных PNG</h1><p>Элементы вырезаны по силуэту. Шахматка — фон просмотра, она не входит в файлы. Нажмите на элемент, чтобы скачать PNG. Панели без содержимого восстановлены отдельно; игровые поля — декоративные иллюстрации, а не набор 3D-плиток.</p><nav aria-label="Фон проверки"><button data-bg="checker">Шахматка</button><button data-bg="light">Светлый</button><button data-bg="dark">Тёмный</button><button data-bg="blue">Игровой голубой</button></nav></header><main>${cards}</main><script>document.querySelectorAll('button[data-bg]').forEach(b=>b.addEventListener('click',()=>document.body.dataset.bg=b.dataset.bg));</script></html>`);
console.log(assets.length+' PNG assets, '+groups.length+' Figma boards and alpha gallery prepared');
