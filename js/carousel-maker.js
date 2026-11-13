(() => {
"use strict";
const $ = id => document.getElementById(id);
const modeCollage=$("showCollageMode"),modeCarousel=$("showCarouselMode");
const panelModeCollage=$("collageModeButton"),panelModeCarousel=$("carouselModeButton");
const collageMain=document.querySelector(".collage-app"),carouselRoot=$("carouselMaker");
const collageActions=$("collageExportActions");
if(!modeCollage||!modeCarousel||!carouselRoot)return;
let photos=[],active=0,previewTimer=null,exporting=false,previewRaf=0;
const canvas=$("carouselCanvas"),ctx=canvas.getContext("2d");
const settings=()=>({
 transition:$("carouselTransition").value,
 layout:$("carouselLayout").value,
 storyType:$("storyType").value, storyLayout:$("storyLayout").value,
 storyHeadline:$("storyHeadline").value.trim(), storySubheadline:$("storySubheadline").value.trim(),
 storyCta:$("storyCta").value.trim(), storySlideCount:Number($("storySlideCount").value)||0,
 duration:Number($("carouselDuration").value),
 transitionDuration:Number($("carouselTransitionDuration").value),
 fit:$("carouselFit").value,background:$("carouselBackground").value,
 width:Number($("carouselQuality").value),height:Number($("carouselQuality").value)*1.25
});
function gridSettings(){return [0,1,2,3].map(i=>({transition:$(`g${i+1}Transition`).value,duration:Number($(`g${i+1}Duration`).value),transitionDuration:Number($(`g${i+1}TransitionDuration`).value),delay:Number($(`g${i+1}Delay`).value)}));}
function gridPhotoList(grid){return photos.filter((_,i)=>i%4===grid);}
function gridCycleDuration(g,grid){const n=gridPhotoList(grid).length;return n?n*(g.duration+g.transitionDuration)+g.delay:0;}
function gridAnimationTotal(){return Math.max(...gridSettings().map((g,i)=>gridCycleDuration(g,i)),0);}
function setStatus(msg){$("carouselExportStatus").textContent=msg;}
function stopPreview(){
 if(previewRaf)cancelAnimationFrame(previewRaf);
 previewRaf=0;
 const play=$("carouselPlayPreview");
 if(play)play.textContent="▶ Putar Animasi";
}
function switchMode(mode){
 const carousel=mode==="carousel";
 if(!carousel)stopPreview();
 collageMain.hidden=carousel;
 carouselRoot.hidden=!carousel;
 collageActions.hidden=carousel;
 modeCollage?.classList.toggle("active",!carousel);modeCarousel?.classList.toggle("active",carousel);
 panelModeCollage?.classList.toggle("active",!carousel);panelModeCarousel?.classList.toggle("active",carousel);
 if(carousel){
   drawSlide(active);
   window.scrollTo({top:0,behavior:"smooth"});
 }
}
modeCollage?.addEventListener("click",()=>switchMode("collage"));
modeCarousel?.addEventListener("click",()=>switchMode("carousel"));
panelModeCollage?.addEventListener("click",()=>switchMode("collage"));
panelModeCarousel?.addEventListener("click",()=>switchMode("carousel"));
function loadImage(file){return new Promise((resolve,reject)=>{
 const url=URL.createObjectURL(file),img=new Image();
 img.onload=()=>resolve({name:file.name,url,img});
 img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Gagal membaca "+file.name));};
 img.src=url;
});}
function fitImage(img,x,y,w,h,fit,alpha=1,scale=1,offsetX=0,offsetY=0){
 const ratio=fit==="contain"?Math.min(w/img.width,h/img.height):Math.max(w/img.width,h/img.height);
 const dw=img.width*ratio*scale,dh=img.height*ratio*scale;
 ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 ctx.drawImage(img,x+(w-dw)/2+offsetX,y+(h-dh)/2+offsetY,dw,dh);ctx.restore();
}
function feedCount(s=settings()){
 if(s.layout==="grid4")return Math.ceil(photos.length/4);
 return s.storySlideCount?Math.min(7,s.storySlideCount):photos.length;
}
function photoForSlide(index){return photos.length?photos[index%photos.length]:null;}
function storyCopy(index,total,s){
 const n=index+1, type=s.storyType;
 const defaults={
  portfolio:["Sebuah cerita, satu kenangan","Detail yang membuat momen ini istimewa","Setiap momen layak dikenang"],
  product:["Kenali lebih dekat","Detail dan keunggulan pilihanmu","Temukan pilihan yang tepat"],
  promo:["Ada kabar spesial untukmu","Nikmati penawaran pilihan","Jangan lewatkan kesempatan ini"],
  testimonial:["Cerita nyata dari pelanggan","Pengalaman yang mereka rasakan","Giliran ceritamu berikutnya"],
  tips:["Tahukah kamu?","Hal penting yang perlu diperhatikan","Simpan tips ini untuk nanti"],
  story:["Di balik sebuah momen","Proses, detail, dan cerita","Setiap proses punya cerita"],
  news:["Informasi terbaru","Berikut detail yang perlu kamu tahu","Pantau informasi selanjutnya"]
 };
 const set=defaults[type]||defaults.portfolio;
 if(n===1)return {title:s.storyHeadline||set[0],body:s.storySubheadline||set[1],tag:"SEMESTA · "+type.toUpperCase()};
 if(n===total)return {title:s.storyCta||set[2],body:"Hubungi tim Semesta untuk informasi lebih lanjut.",tag:"LET'S CONNECT"};
 return {title:set[1],body:s.storySubheadline||"Dirangkai dengan perhatian pada setiap detail.",tag:`${String(n).padStart(2,"0")} / ${String(total).padStart(2,"0")}`};
}
function drawStoryOverlay(index,total,s){
 if(s.layout==="grid4")return;
 const copy=storyCopy(index,total,s),w=canvas.width,h=canvas.height;
 const dark=s.storyLayout!=="clean";
 ctx.save();
 const grad=ctx.createLinearGradient(0,h*.48,0,h);
 grad.addColorStop(0,"rgba(0,0,0,0)");grad.addColorStop(1,dark?"rgba(0,0,0,.78)":"rgba(0,0,0,.58)");
 ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
 const pad=w*.075, bottom=h*.09;
 const accent=s.storyLayout==="bold"?"#e8d98d":"#ffffff";
 ctx.fillStyle=accent;ctx.font=`700 ${Math.round(w*.018)}px Arial`;ctx.letterSpacing="2px";
 ctx.fillText(copy.tag.toUpperCase(),pad,h-bottom-h*.20);
 ctx.fillStyle="#fff";ctx.font=`800 ${Math.round(w*(s.storyLayout==="bold"?.067:.057))}px Arial`;
 const titleLines=wrapCanvasText(ctx,copy.title,w-pad*2);
 let y=h-bottom-h*.14;
 titleLines.slice(0,3).forEach(line=>{ctx.fillText(line,pad,y);y+=w*.069;});
 ctx.font=`400 ${Math.round(w*.025)}px Arial`;ctx.fillStyle="rgba(255,255,255,.9)";
 const bodyLines=wrapCanvasText(ctx,copy.body,w-pad*2);
 y+=w*.012;bodyLines.slice(0,3).forEach(line=>{ctx.fillText(line,pad,y);y+=w*.035;});
 if(s.storyLayout==="bold"){ctx.fillStyle="#e8d98d";ctx.fillRect(pad,h-bottom,w*.13,Math.max(5,w*.006));}
 ctx.restore();
}
function wrapCanvasText(c,text,maxWidth){
 const words=String(text||"").split(/\s+/),lines=[];let line="";
 for(const word of words){const test=line?line+" "+word:word;if(c.measureText(test).width>maxWidth&&line){lines.push(line);line=word;}else line=test;}
 if(line)lines.push(line);return lines;
}
function drawPhotoCell(photo,x,y,w,h,fit,alpha=1,scale=1,offsetX=0,offsetY=0){
 if(!photo)return;
 fitImage(photo.img,x,y,w,h,fit,alpha,scale,offsetX,offsetY);
}
function drawFeed(index,animated=false,elapsed=0,s=settings()){
 const w=canvas.width=s.width,h=canvas.height=s.height;
 ctx.fillStyle=s.background;ctx.fillRect(0,0,w,h);
 if(!photos.length){$("carouselSlideLabel").textContent="Feed 0 / 0";return;}
 const count=feedCount(s);active=Math.max(0,Math.min(index,count-1));
 if(s.layout!=="grid4"){
   drawPhotoCell(photoForSlide(active),0,0,w,h,s.fit);
   drawStoryOverlay(active,count,s);
   $("carouselSlideLabel").textContent=`Slide ${active+1} / ${count}`;
 }else{
   const gap=Math.round(w*.012),pad=Math.round(w*.012),cw=(w-pad*2-gap)/2,ch=(h-pad*2-gap)/2;
   const positions=[[pad,pad],[pad+cw+gap,pad],[pad,pad+ch+gap],[pad+cw+gap,pad+ch+gap]];
   const gs=gridSettings(),start=active*4;
   for(let k=0;k<4;k++){
     const [x,y]=positions[k];
     if(animated){
       const list=gridPhotoList(k);
       if(list.length)drawIndependentGridCell(list,k,x,y,cw,ch,elapsed,gs[k],s.fit);
     }else{
       const photo=photos[start+k];
       if(photo)drawPhotoCell(photo,x,y,cw,ch,s.fit);
     }
   }
   $("carouselSlideLabel").textContent=animated?"Preview · Slideshow 4 grid independen":`Feed ${active+1} / ${count} · ${Math.min(4,photos.length-start)} foto`;
 }
}
function drawIndependentGridCell(list,grid,x,y,w,h,time,g,fit){
 const local=time-g.delay;
 if(local<0){drawPhotoCell(list[0],x,y,w,h,fit);return;}
 const cycle=g.duration+g.transitionDuration;
 const pos=local/cycle,index=Math.floor(pos)%list.length,phase=pos-Math.floor(pos);
 const current=list[index],next=list[(index+1)%list.length];
 const p=phase<g.duration/cycle?0:Math.min(1,(phase-g.duration/cycle)/(g.transitionDuration/cycle));
 ctx.save();
 if(p>0){
  if(g.transition==="fade"||g.transition==="blur"){
   drawPhotoCell(current,x,y,w,h,fit,1-p);
   if(g.transition==="blur")ctx.filter=`blur(${Math.round(10*(1-p))}px)`;
   drawPhotoCell(next,x,y,w,h,fit,p);
  }else if(g.transition==="slide"){
   drawPhotoCell(current,x,y,w,h,fit,1);
   ctx.beginPath();ctx.rect(x,y,w*p,h);ctx.clip();drawPhotoCell(next,x,y,w,h,fit,1);
  }else if(["drag-left","drag-right","drag-up","drag-down"].includes(g.transition)){
   const dx=g.transition==="drag-left"?-p*w:g.transition==="drag-right"?p*w:0;
   const dy=g.transition==="drag-up"?-p*h:g.transition==="drag-down"?p*h:0;
   const nx=g.transition==="drag-left"?(1-p)*w:g.transition==="drag-right"?-(1-p)*w:0;
   const ny=g.transition==="drag-up"?(1-p)*h:g.transition==="drag-down"?-(1-p)*h:0;
   drawPhotoCell(current,x,y,w,h,fit,1,1,dx,dy);
   drawPhotoCell(next,x,y,w,h,fit,1,1,nx,ny);
  }else if(g.transition==="zoom"){
   drawPhotoCell(current,x,y,w,h,fit,1,1+p*.16);drawPhotoCell(next,x,y,w,h,fit,p,.84+p*.16);
  }else if(g.transition==="kenburns"){
   drawPhotoCell(current,x,y,w,h,fit,1,1+phase*.08,Math.sin(phase*Math.PI)*w*.02);
  }else{
   drawPhotoCell(current,x,y,w,h,fit,1-p);ctx.filter=`blur(${Math.round(12*(1-p))}px)`;drawPhotoCell(next,x,y,w,h,fit,p);
  }
 }else{
  drawPhotoCell(current,x,y,w,h,fit,1,g.transition==="kenburns"?1+phase*.08:1,g.transition==="kenburns"?Math.sin(phase*Math.PI)*w*.02:0);
 }
 ctx.restore();
}
function drawSlide(index){drawFeed(index,false,0,settings());renderList();}
function renderList(){
 $("carouselPhotoCount").textContent=`${photos.length} foto · ${feedCount()} slide`;
 $("carouselPhotoList").innerHTML=photos.length?photos.map((p,i)=>`
 <div class="carousel-photo-row ${i===active?"active":""}" data-index="${i}">
  <img src="${p.url}" alt="">
  <b>${i+1}. ${escapeHtml(p.name)}</b>
  <button type="button" data-action="up" aria-label="Geser ke atas" ${i===0?"disabled":""}>↑</button>
  <button type="button" data-action="down" aria-label="Geser ke bawah" ${i===photos.length-1?"disabled":""}>↓</button>
  <button type="button" data-action="remove" aria-label="Hapus foto">×</button>
 </div>`).join(""):'<div class="tool-empty">Belum ada foto.</div>';
 $("exportCarouselJpg").disabled=!photos.length||exporting;
 $("exportCarouselMp4").disabled=!photos.length||exporting;
}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
$("carouselPhotoInput").addEventListener("change",async e=>{
 stopPreview();
 const files=[...e.target.files].filter(f=>f.type.startsWith("image/"));
 try{for(const f of files)photos.push(await loadImage(f));active=0;drawSlide(active);setStatus(`${photos.length} foto siap. Atur urutan slide lalu ekspor.`);}
 catch(err){setStatus(err.message);}
 e.target.value="";
});
$("carouselPhotoList").addEventListener("click",e=>{
 stopPreview();
 const row=e.target.closest("[data-index]");if(!row)return;
 const i=Number(row.dataset.index),action=e.target.dataset.action;
 if(action==="up"&&i>0)[photos[i-1],photos[i]]=[photos[i],photos[i-1]];
 else if(action==="down"&&i<photos.length-1)[photos[i+1],photos[i]]=[photos[i],photos[i+1]];
 else if(action==="remove"){URL.revokeObjectURL(photos[i].url);photos.splice(i,1);}
 else active=i;
 active=Math.min(active,Math.max(0,photos.length-1));drawSlide(active);
});
$("carouselPrev").addEventListener("click",()=>drawSlide((active-1+feedCount()+feedCount())%Math.max(feedCount(),1)));
$("carouselNext").addEventListener("click",()=>drawSlide((active+1)%Math.max(feedCount(),1)));
$("carouselPlayPreview").addEventListener("click",()=>{
 if(!photos.length||exporting){setStatus("Tambahkan foto terlebih dahulu untuk menjalankan preview.");return;}
 if(previewRaf){stopPreview();drawSlide(active);return;}
 const s=settings(),total=s.layout==="grid4"?gridAnimationTotal():feedCount(s)*s.duration,started=performance.now();
 const button=$("carouselPlayPreview");button.textContent="■ Hentikan Preview";
 button.setAttribute("aria-pressed","true");
 function tick(now){
   if(!previewRaf)return;
   const elapsed=(now-started)/1000;
   if(elapsed>=total){stopPreview();button.setAttribute("aria-pressed","false");drawSlide(0);return;}
   const feedIndex=Math.min(feedCount(s)-1,Math.floor(elapsed/s.duration));
   const local=elapsed-feedIndex*s.duration;
   if(s.layout==="grid4"){drawFeed(0,true,elapsed,s);$("carouselSlideLabel").textContent="Preview · Slideshow 4 grid independen";}
   else {drawVideoFrame(elapsed,s);$("carouselSlideLabel").textContent=`Preview · Slide ${feedIndex+1}/${feedCount(s)}`;}
   previewRaf=requestAnimationFrame(tick);
 }
 previewRaf=requestAnimationFrame(tick);
});
function syncGridSettingsVisibility(){$("gridAnimationSettings").hidden=$("carouselLayout").value!=="grid4";}
syncGridSettingsVisibility();
["carouselFit","carouselBackground","carouselQuality","carouselLayout"].forEach(id=>$(id).addEventListener("change",()=>{stopPreview();syncGridSettingsVisibility();drawSlide(Math.min(active,feedCount()-1));}));
[0,1,2,3].forEach(i=>{const n=i+1;
 $(`g${n}Duration`).addEventListener("input",e=>$(`g${n}DurationValue`).textContent=`${Number(e.target.value).toFixed(1)} detik`);
 $(`g${n}TransitionDuration`).addEventListener("input",e=>$(`g${n}TransitionDurationValue`).textContent=`${Number(e.target.value).toFixed(1)} detik`);
 $(`g${n}Delay`).addEventListener("input",e=>$(`g${n}DelayValue`).textContent=`${Number(e.target.value).toFixed(2)} detik`);
 [`g${n}Transition`,`g${n}Duration`,`g${n}TransitionDuration`,`g${n}Delay`].forEach(id=>$(id).addEventListener("change",()=>{stopPreview();drawSlide(active);}));
});
["storyType","storySlideCount","storyLayout","storyHeadline","storySubheadline","storyCta"].forEach(id=>{
 const el=$(id);el.addEventListener("input",()=>{stopPreview();drawSlide(Math.min(active,feedCount()-1));});
 el.addEventListener("change",()=>{stopPreview();active=Math.min(active,feedCount()-1);drawSlide(active);});
});
$("carouselDuration").addEventListener("input",e=>$("carouselDurationValue").textContent=`${e.target.value} detik`);
$("carouselTransitionDuration").addEventListener("input",e=>$("carouselTransitionValue").textContent=`${Number(e.target.value).toFixed(1)} detik`);
function canvasBlob(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("Gagal membuat gambar.")),"image/jpeg",.94));}
async function loadScript(url){return new Promise((resolve,reject)=>{
 const s=document.createElement("script");s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error("Tidak dapat memuat library ekspor. Periksa koneksi internet."));document.head.appendChild(s);
});}
$("exportCarouselJpg").addEventListener("click",async()=>{
 if(!photos.length||exporting)return;stopPreview();exporting=true;renderList();
 try{
  setStatus("Menyiapkan file JPG...");
  if(!window.JSZip)await loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
  const zip=new JSZip(),s=settings(),temp=document.createElement("canvas");temp.width=s.width;temp.height=s.height;
  const tctx=temp.getContext("2d");
  const originalCanvas=canvas,originalWidth=canvas.width,originalHeight=canvas.height;
  for(let i=0;i<feedCount(s);i++){
   drawFeed(i,false,0,s);
   tctx.clearRect(0,0,temp.width,temp.height);tctx.drawImage(originalCanvas,0,0,temp.width,temp.height);
   const blob=await canvasBlob(temp);
   zip.file(`feed-${String(i+1).padStart(2,"0")}.jpg`,blob);
   $("carouselProgress").hidden=false;$("carouselProgress").value=Math.round((i+1)/feedCount(s)*70);
   setStatus(`Membuat JPG feed ${i+1}/${feedCount(s)}...`);
  }
  canvas.width=originalWidth;canvas.height=originalHeight;
  const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"},m=>{$("carouselProgress").value=70+Math.round(m.percent*.3);});
  downloadBlob(blob,"semesta-carousel-jpg.zip");setStatus(`${photos.length} slide JPG berhasil dibuat dalam ZIP.`);
 }catch(err){setStatus("Ekspor JPG gagal: "+err.message);}
 finally{exporting=false;renderList();$("carouselProgress").hidden=true;}
});
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function drawTransitionFrame(from,to,progress,elapsed,transition,s){
 const w=canvas.width,h=canvas.height;ctx.fillStyle=s.background;ctx.fillRect(0,0,w,h);
 const p=Math.max(0,Math.min(1,progress));
 if(transition==="fade"||transition==="blur"){
  fitImage(from.img,0,0,w,h,s.fit,1-p);
  ctx.save();if(transition==="blur")ctx.filter=`blur(${Math.round(12*p)}px)`;fitImage(to.img,0,0,w,h,s.fit,p);ctx.restore();
 }else if(transition==="slide"){
  fitImage(from.img,-w*p,0,w,h,s.fit,1);fitImage(to.img,w*(1-p),0,w,h,s.fit,1);
 }else if(transition==="zoom"){
  fitImage(from.img,0,0,w,h,s.fit,1,1+p*.18);
  fitImage(to.img,0,0,w,h,s.fit,p,.82+p*.18);
 }else if(["drag-left","drag-right","drag-up","drag-down"].includes(transition)){
  const dx=transition==="drag-left"?-p*w:transition==="drag-right"?p*w:0;
  const dy=transition==="drag-up"?-p*h:transition==="drag-down"?p*h:0;
  const nx=transition==="drag-left"?(1-p)*w:transition==="drag-right"?-(1-p)*w:0;
  const ny=transition==="drag-up"?(1-p)*h:transition==="drag-down"?-(1-p)*h:0;
  fitImage(from.img,dx,dy,w,h,s.fit,1);
  fitImage(to.img,nx,ny,w,h,s.fit,1);
 }else{
  fitImage(to.img,0,0,w,h,s.fit,1,1+Math.sin(elapsed*.7)*.045,Math.sin(elapsed*.6)*w*.018);
 }
}
function drawVideoFrame(time,s){
 const count=feedCount(s),total=count*s.duration;
 if(s.layout==="grid4"){drawFeed(0,true,time,s);return gridAnimationTotal();}
 const index=Math.min(count-1,Math.floor(time/s.duration)),local=time-index*s.duration;
 const next=(index+1)%count,current=photoForSlide(index),nextPhoto=photoForSlide(next);
 if(local>s.duration-s.transitionDuration&&count>1){
  drawTransitionFrame(current,nextPhoto,(local-(s.duration-s.transitionDuration))/s.transitionDuration,local,s.transition,s);
 }else{
  ctx.fillStyle=s.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  const progress=local/s.duration;
  if(s.transition==="kenburns")fitImage(current.img,0,0,canvas.width,canvas.height,s.fit,1,1+progress*.08,Math.sin(progress*Math.PI)*canvas.width*.012);
  else fitImage(current.img,0,0,canvas.width,canvas.height,s.fit);
 }
 drawStoryOverlay(index,count,s);
 return total;
}
async function recordWebm(s){
 const fps=24,stream=canvas.captureStream(fps);
 const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));
 if(!window.MediaRecorder||!canvas.captureStream)throw new Error("Browser tidak mendukung perekaman canvas. Gunakan Chrome atau Edge desktop terbaru.");
 if(!mime)throw new Error("Browser ini tidak mendukung perekaman video. Gunakan Chrome atau Edge terbaru.");
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:s.width>=1080?8000000:4500000});
 const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 const stopped=new Promise((resolve,reject)=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));recorder.onerror=()=>reject(new Error("Perekaman video gagal."));});
 recorder.start(250);
 const total=s.layout==="grid4"?gridAnimationTotal():feedCount(s)*s.duration,started=performance.now();
 await new Promise(resolve=>{
  function frame(now){
   const t=Math.min(total,(now-started)/1000);drawVideoFrame(t,s);
   $("carouselProgress").value=Math.round(t/total*55);
   setStatus(`Merekam animasi ${t.toFixed(1)} / ${total.toFixed(1)} detik...`);
   if(t<total)requestAnimationFrame(frame);else setTimeout(resolve,350);
  }
  requestAnimationFrame(frame);
 });
 recorder.stop();stream.getTracks().forEach(t=>t.stop());
 return stopped;
}
$("exportCarouselMp4").addEventListener("click",async()=>{
 if(!photos.length||exporting)return;
 stopPreview();
 const s=settings(),duration=s.layout==="grid4"?gridAnimationTotal():feedCount(s)*s.duration;
 if(duration>20){setStatus(`Durasi total ${duration.toFixed(1)} detik. Maksimal 20 detik; kurangi durasi foto atau jumlah slide.`);return;}
 exporting=true;renderList();$("carouselProgress").hidden=false;$("carouselProgress").value=0;
 try{
  setStatus("Menyiapkan perekaman video...");
  const webm=await recordWebm(s);
  setStatus("Mengonversi video ke MP4. Proses pertama dapat mengunduh encoder sekitar 30 MB...");
  const {FFmpeg}=await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js");
  const {toBlobURL}=await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js");
  const ffmpeg=new FFmpeg();
  ffmpeg.on("progress",({progress})=>{$("carouselProgress").value=55+Math.round(progress*45);});
  const base="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,"text/javascript"),wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,"application/wasm")});
  await ffmpeg.writeFile("input.webm",new Uint8Array(await webm.arrayBuffer()));
  await ffmpeg.exec(["-i","input.webm","-an","-c:v","libx264","-preset","ultrafast","-pix_fmt","yuv420p","-movflags","+faststart","output.mp4"]);
  const data=await ffmpeg.readFile("output.mp4");
  downloadBlob(new Blob([data.buffer],{type:"video/mp4"}),"semesta-carousel-video.mp4");
  await ffmpeg.deleteFile("input.webm");await ffmpeg.deleteFile("output.mp4");await ffmpeg.terminate();
  setStatus("Video MP4 berhasil dibuat dan diunduh.");
 }catch(err){setStatus("Ekspor MP4 gagal: "+(err?.message||err)+". Pastikan browser Chrome/Edge terbaru dan koneksi internet stabil.");}
 finally{exporting=false;renderList();$("carouselProgress").hidden=true;drawSlide(active);}
});
drawSlide(0);
})();