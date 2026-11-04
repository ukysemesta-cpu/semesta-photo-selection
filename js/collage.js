const $ = id => document.getElementById(id);
const canvas=$("collageCanvas"), ctx=canvas.getContext("2d");
const state={format:"feed",background:"#ffffff",gap:12,gridCols:0,photos:[],slots:[],selected:-1,drag:null};
const history={undo:[],redo:[],limit:40,restoring:false};
function snapshot(){
 return {format:state.format,background:state.background,gap:state.gap,gridCols:state.gridCols,
  photos:state.photos.slice(),slots:state.slots.map(s=>({...s})),selected:state.selected};
}
function refreshHistoryButtons(){
 $("undoBtn").disabled=!history.undo.length;
 $("redoBtn").disabled=!history.redo.length;
}
function pushSnapshot(entry){
 if(history.restoring)return;
 history.undo.push(entry);
 if(history.undo.length>history.limit)history.undo.shift();
 history.redo.length=0;
 refreshHistoryButtons();
}
function saveHistory(){pushSnapshot(snapshot());}
function restoreSnapshot(s){
 history.restoring=true;
 state.format=s.format;state.background=s.background;state.gap=s.gap;state.gridCols=s.gridCols||0;
 state.photos=s.photos.slice();state.slots=s.slots.map(x=>({...x}));state.selected=s.selected;
 const f=formats[state.format];canvas.width=f.w;canvas.height=f.h;
 canvas.style.aspectRatio=`${f.w}/${f.h}`;
 $("formatSelect").value=state.format;
 $("gapRange").value=state.gap;$("gapValue").textContent=state.gap+" px";
 $("gridColumns").value=String(state.gridCols);
 $("customBackground").value=state.background;
 document.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("active",b.dataset.color===state.background));
 $("canvasDimensions").textContent=`${f.w} × ${f.h} px · ${f.label}`;
 history.restoring=false;draw();renderControls();refreshHistoryButtons();
}
function undo(){
 if(!history.undo.length)return;
 history.redo.push(snapshot());
 const previous=history.undo.pop();restoreSnapshot(previous);
}
function redo(){
 if(!history.redo.length)return;
 history.undo.push(snapshot());
 const next=history.redo.pop();restoreSnapshot(next);
}
$("undoBtn").addEventListener("click",undo);
$("redoBtn").addEventListener("click",redo);
window.addEventListener("keydown",e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?redo():undo();}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="y"){e.preventDefault();redo();}
});
const formats={feed:{w:1080,h:1350,label:"Instagram Feed"},story:{w:1080,h:1920,label:"Instagram Story"}};
const templates=[
 {id:"auto",name:"Otomatis sesuai jumlah foto",layout:(n,w,h,g)=>gridLayout(n,w,h,g)},
 {id:"hero",name:"1 foto utama + pendukung",layout:(n,w,h,g)=>heroLayout(n,w,h,g)},
 {id:"stack",name:"Kolase vertikal",layout:(n,w,h,g)=>stackLayout(n,w,h,g)},
 {id:"equal",name:"Grid seragam",layout:(n,w,h,g)=>gridLayout(n,w,h,g)}
];
function gridLayout(n,w,h,g){
 if(!n)return[];
 const autoCols=n===1?1:n===2?2:n<=4?2:n<=9?3:n<=16?4:5;
 const cols=Math.max(1,Math.min(n,state.gridCols||autoCols));
 const rows=Math.ceil(n/cols);
 const cellW=(w-g*(cols+1))/cols;
 const cellH=(h-g*(rows+1))/rows;
 return Array.from({length:n},(_,i)=>({
  x:g+(i%cols)*(cellW+g),
  y:g+Math.floor(i/cols)*(cellH+g),
  w:cellW,h:cellH,scale:1,ox:0,oy:0
 }));
}
function heroLayout(n,w,h,g){
 if(n<2)return gridLayout(n,w,h,g);
 const heroH=h*.58-g*1.5, smallH=(h-heroH-g*2)/2, count=n-1, cols=Math.min(3,count), cellW=(w-g*(cols+1))/cols;
 const arr=[{x:g,y:g,w:w-2*g,h:heroH,scale:1,ox:0,oy:0}];
 for(let i=0;i<count;i++)arr.push({x:g+(i%cols)*(cellW+g),y:g+heroH+g+(Math.floor(i/cols))* (smallH+g),w:cellW,h:smallH,scale:1,ox:0,oy:0});
 return arr;
}
function stackLayout(n,w,h,g){
 if(!n)return[];const cellH=(h-g*(n+1))/n;return Array.from({length:n},(_,i)=>({x:g,y:g+i*(cellH+g),w:w-2*g,h:cellH,scale:1,ox:0,oy:0}));
}
function activeTemplate(){return templates.find(t=>t.id===$("templateSelect").value)||templates[0]}
function resetSlots(){const f=formats[state.format];state.slots=activeTemplate().layout(state.photos.length,f.w,f.h,state.gap);state.selected=state.photos.length?Math.min(state.selected<0?0:state.selected,state.photos.length-1):-1;draw();renderControls()}
function coverParams(img,slot){
 const scale=Math.max(slot.w/img.width,slot.h/img.height)*(slot.scale||1),dw=img.width*scale,dh=img.height*scale;
 const cx=slot.x+slot.w/2+(slot.ox||0),cy=slot.y+slot.h/2+(slot.oy||0);
 return {sx:(img.width-(slot.w/scale))/2-(slot.ox||0)/scale,sy:(img.height-(slot.h/scale))/2-(slot.oy||0)/scale,sw:slot.w/scale,sh:slot.h/scale};
}
function draw(showSelection=true){
 const f=formats[state.format];ctx.clearRect(0,0,f.w,f.h);ctx.fillStyle=state.background;ctx.fillRect(0,0,f.w,f.h);
 state.photos.forEach((photo,i)=>{
  const slot=state.slots[i];if(!slot)return;
  ctx.save();ctx.beginPath();ctx.rect(slot.x,slot.y,slot.w,slot.h);ctx.clip();
  const img=photo.img;const scale=Math.max(slot.w/img.width,slot.h/img.height)*(slot.scale||1),dw=img.width*scale,dh=img.height*scale;
  const dx=slot.x+(slot.w-dw)/2+(slot.ox||0),dy=slot.y+(slot.h-dh)/2+(slot.oy||0);
  ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();
  if(showSelection && i===state.selected){ctx.save();ctx.strokeStyle="#e6d78d";ctx.lineWidth=8;ctx.strokeRect(slot.x+4,slot.y+4,slot.w-8,slot.h-8);ctx.restore();}
  if(showSelection){
   const r=Math.max(22,Math.min(34,slot.w*.11)),cx=slot.x+slot.w-r*.68,cy=slot.y+r*.68;
   ctx.save();ctx.beginPath();ctx.arc(cx,cy,r*.52,0,Math.PI*2);ctx.fillStyle="rgba(180,35,45,.94)";ctx.fill();
   ctx.strokeStyle="#fff";ctx.lineWidth=Math.max(2,r*.09);ctx.lineCap="round";
   ctx.beginPath();ctx.moveTo(cx-r*.18,cy-r*.18);ctx.lineTo(cx+r*.18,cy+r*.18);
   ctx.moveTo(cx+r*.18,cy-r*.18);ctx.lineTo(cx-r*.18,cy+r*.18);ctx.stroke();ctx.restore();
  }
 });
 $("canvasStatus").textContent=state.photos.length?`${state.photos.length} foto · ${state.selected>=0?"Foto "+(state.selected+1)+" dipilih":"Pilih foto pada preview"}`:"Tambahkan foto untuk mulai membuat kolase.";
}
function renderControls(){
 $("photoCounter").textContent=`${state.photos.length} foto`;
 $("photoList").innerHTML=state.photos.length?state.photos.map((p,i)=>`<button class="photo-list-item ${i===state.selected?"active":""}" data-photo="${i}"><span>${i+1}</span><b title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</b><small>×</small></button>`).join(""):'<div class="tool-empty">Belum ada foto. Tambahkan foto dari komputer.</div>';
 $("selectedPhoto").innerHTML='<option value="">Pilih foto</option>'+state.photos.map((p,i)=>`<option value="${i}" ${i===state.selected?"selected":""}>${i+1}. ${escapeHtml(p.name)}</option>`).join("");
 const slot=state.selected>=0?state.slots[state.selected]:null;
 if($("zoomRange")){
  $("zoomRange").disabled=!slot;
  $("resetPhotoPosition").disabled=!slot;
  $("zoomRange").value=slot?(slot.scale||1):1;
  $("zoomValue").textContent=`${Math.round((slot?.scale||1)*100)}%`;
 }
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("templateSelect").innerHTML=templates.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
$("photoInput").addEventListener("change",async e=>{
 const files=[...e.target.files].filter(f=>f.type.startsWith("image/"));
 if(files.length)saveHistory();
 for(const file of files){const url=URL.createObjectURL(file),img=new Image();img.src=url;await img.decode();state.photos.push({name:file.name,file,img,url});}
 e.target.value="";resetSlots();
});
function removePhotoAt(i){
 if(i<0||i>=state.photos.length)return;
 saveHistory();
 const removed=state.photos[i];
 if(removed?.url)URL.revokeObjectURL(removed.url);
 state.photos.splice(i,1);
 resetSlots();
}
$("photoList").addEventListener("click",e=>{
 const item=e.target.closest("[data-photo]");if(!item)return;const i=Number(item.dataset.photo);
 if(e.target.tagName==="SMALL"){removePhotoAt(i);return;}
 state.selected=i;draw();renderControls();
});
$("selectedPhoto").addEventListener("change",e=>{state.selected=Number(e.target.value);draw();renderControls()});
$("zoomRange").addEventListener("pointerdown",()=>saveHistory());
$("zoomRange").addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key))saveHistory()});
$("zoomRange").addEventListener("input",e=>{
 if(state.selected<0)return;
 const slot=state.slots[state.selected];if(!slot)return;
 slot.scale=Number(e.target.value);
 $("zoomValue").textContent=`${Math.round(slot.scale*100)}%`;
 draw();
});
$("resetPhotoPosition").addEventListener("click",()=>{saveHistory();
 if(state.selected<0)return;
 const slot=state.slots[state.selected];if(!slot)return;
 slot.scale=1;slot.ox=0;slot.oy=0;renderControls();draw();
});
$("formatSelect").addEventListener("change",e=>{saveHistory();state.format=e.target.value;const f=formats[state.format];canvas.width=f.w;canvas.height=f.h;canvas.style.aspectRatio=`${f.w}/${f.h}`;$("canvasDimensions").textContent=`${f.w} × ${f.h} px · ${f.label}`;resetSlots()});
$("templateSelect").addEventListener("change",()=>{saveHistory();resetSlots()});
$("gridColumns").addEventListener("change",e=>{
 saveHistory();
 state.gridCols=Number(e.target.value)||0;
 const isGrid=["auto","equal"].includes($("templateSelect").value);
 if(!isGrid)$("templateSelect").value="equal";
 resetSlots();
});
$("gapRange").addEventListener("pointerdown",()=>saveHistory());
$("gapRange").addEventListener("change",e=>{state.gap=Number(e.target.value);$("gapValue").textContent=state.gap+" px";resetSlots()});
document.querySelectorAll(".swatch").forEach(b=>b.addEventListener("click",()=>{saveHistory();state.background=b.dataset.color;document.querySelectorAll(".swatch").forEach(x=>x.classList.toggle("active",x===b));$("customBackground").value=state.background;draw()}));
$("customBackground").addEventListener("pointerdown",()=>saveHistory());
$("customBackground").addEventListener("input",e=>{state.background=e.target.value;document.querySelectorAll(".swatch").forEach(x=>x.classList.remove("active"));draw()});
function reorder(direction){if(state.selected<0)return;saveHistory();const j=state.selected+direction;if(j<0||j>=state.photos.length)return;[state.photos[state.selected],state.photos[j]]=[state.photos[j],state.photos[state.selected]];state.selected=j;resetSlots()}
$("moveUp").addEventListener("click",()=>reorder(-1));$("moveDown").addEventListener("click",()=>reorder(1));
$("removePhoto").addEventListener("click",()=>removePhotoAt(state.selected));
function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
function hitTest(p){for(let i=state.slots.length-1;i>=0;i--){const s=state.slots[i];if(p.x>=s.x&&p.x<=s.x+s.w&&p.y>=s.y&&p.y<=s.y+s.h)return i;}return -1}
canvas.addEventListener("pointerdown",e=>{
 const p=canvasPoint(e),i=hitTest(p);if(i<0)return;
 const slot=state.slots[i],r=Math.max(22,Math.min(34,slot.w*.11)),cx=slot.x+slot.w-r*.68,cy=slot.y+r*.68;
 if(Math.hypot(p.x-cx,p.y-cy)<r*.65){removePhotoAt(i);return;}
 state.selected=i;
 state.drag={
  i,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,
  ox:slot.ox||0,oy:slot.oy||0,
  before:snapshot(),moved:false,crossedFrame:false
 };
 canvas.setPointerCapture(e.pointerId);
 draw();renderControls();
});
canvas.addEventListener("pointermove",e=>{
 if(!state.drag)return;
 const p=canvasPoint(e),d=state.drag,s=state.slots[d.i],over=hitTest(p);
 if(Math.abs(p.x-d.startX)+Math.abs(p.y-d.startY)>8)d.moved=true;

 // Once pointer enters another cell, treat the gesture as a frame move,
 // not as crop adjustment. This keeps the source image framing unchanged.
 if(over>=0 && over!==d.i)d.crossedFrame=true;

 if(!d.crossedFrame && over===d.i){
  s.ox=d.ox+(p.x-d.startX);
  s.oy=d.oy+(p.y-d.startY);
 }
 d.lastX=p.x;d.lastY=p.y;
 draw();
});
function finishCanvasDrag(e){
 if(!state.drag)return;
 const d=state.drag,p=canvasPoint(e),target=hitTest(p);
 if(d.moved){
  pushSnapshot(d.before);
  if(target>=0 && target!==d.i){
   // Restore source crop first; swap the photos AND their crop/zoom data,
   // while leaving each grid frame's geometry exactly where it is.
   const sourceSlot=state.slots[d.i],targetSlot=state.slots[target];
   sourceSlot.ox=d.ox;sourceSlot.oy=d.oy;
   const cropA={scale:sourceSlot.scale||1,ox:sourceSlot.ox||0,oy:sourceSlot.oy||0};
   const cropB={scale:targetSlot.scale||1,ox:targetSlot.ox||0,oy:targetSlot.oy||0};
   [state.photos[d.i],state.photos[target]]=[state.photos[target],state.photos[d.i]];
   Object.assign(sourceSlot,cropB);
   Object.assign(targetSlot,cropA);
   state.selected=target;
   $("canvasStatus").textContent=`Foto dipindahkan ke frame ${target+1}. Susunan grid tetap.`;
  } else {
   // Drag within the same frame changes only the crop of that photo.
   state.selected=d.i;
  }
 }
 state.drag=null;draw();renderControls();
}
canvas.addEventListener("pointerup",finishCanvasDrag);
canvas.addEventListener("pointercancel",()=>{
 if(state.drag){
  const d=state.drag,s=state.slots[d.i];
  s.ox=d.ox;s.oy=d.oy;
  state.drag=null;draw();renderControls();
 }
});
function exportCanvas(type){
 if(!state.photos.length){alert("Tambahkan foto terlebih dahulu.");return;}
 draw(false);
 canvas.toBlob(blob=>{
  if(!blob){draw(true);alert("Export gagal.");return;}
  const a=document.createElement("a"),url=URL.createObjectURL(blob);
  a.href=url;a.download=`semesta-collage-${state.format}.${type==="image/jpeg"?"jpg":"png"}`;
  a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  draw(true);
 },type,type==="image/jpeg"?.94:undefined);
}
$("downloadJpg").addEventListener("click",()=>exportCanvas("image/jpeg"));$("downloadPng").addEventListener("click",()=>exportCanvas("image/png"));
const initial=formats.feed;canvas.width=initial.w;canvas.height=initial.h;canvas.style.aspectRatio=`${initial.w}/${initial.h}`;renderControls();draw();
