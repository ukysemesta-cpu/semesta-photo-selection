(() => {
"use strict";
const $ = id => document.getElementById(id);
const modeCollage=$("showCollageMode"),modeCarousel=$("showCarouselMode");
const panelModeCollage=$("collageModeButton"),panelModeCarousel=$("carouselModeButton");
const collageMain=document.querySelector(".collage-app"),carouselRoot=$("carouselMaker");
const collageActions=$("collageExportActions");
if(!modeCollage||!modeCarousel||!carouselRoot)return;
let photos=[],active=0,previewTimer=null,exporting=false;
const canvas=$("carouselCanvas"),ctx=canvas.getContext("2d");
const settings=()=>({
 transition:$("carouselTransition").value,
 duration:Number($("carouselDuration").value),
 transitionDuration:Number($("carouselTransitionDuration").value),
 fit:$("carouselFit").value,background:$("carouselBackground").value,
 width:Number($("carouselQuality").value),height:Number($("carouselQuality").value)*1.25
});
function setStatus(msg){$("carouselExportStatus").textContent=msg;}
function switchMode(mode){
 const carousel=mode==="carousel";
 collageMain.hidden=carousel;carouselRoot.hidden=!carousel;
 collageActions.hidden=carousel;
 modeCollage?.classList.toggle("active",!carousel);modeCarousel?.classList.toggle("active",carousel);
 panelModeCollage?.classList.toggle("active",!carousel);panelModeCarousel?.classList.toggle("active",carousel);
 if(carousel)drawSlide(active);
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
function fitImage(img,x,y,w,h,fit,alpha=1,scale=1,offsetX=0){
 const ratio=fit==="contain"?Math.min(w/img.width,h/img.height):Math.max(w/img.width,h/img.height);
 const dw=img.width*ratio*scale,dh=img.height*ratio*scale;
 ctx.save();ctx.globalAlpha=alpha;ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 ctx.drawImage(img,x+(w-dw)/2+offsetX,y+(h-dh)/2,dw,dh);ctx.restore();
}
function drawSlide(index){
 const s=settings(),w=canvas.width=s.width,h=canvas.height=s.height;
 ctx.fillStyle=s.background;ctx.fillRect(0,0,w,h);
 if(!photos.length){$("carouselSlideLabel").textContent="Slide 0 / 0";return;}
 active=Math.max(0,Math.min(index,photos.length-1));
 fitImage(photos[active].img,0,0,w,h,s.fit);
 $("carouselSlideLabel").textContent=`Slide ${active+1} / ${photos.length}`;
 renderList();
}
function renderList(){
 $("carouselPhotoCount").textContent=`${photos.length} foto`;
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
 const files=[...e.target.files].filter(f=>f.type.startsWith("image/"));
 try{for(const f of files)photos.push(await loadImage(f));active=0;drawSlide(active);setStatus(`${photos.length} foto siap. Atur urutan slide lalu ekspor.`);}
 catch(err){setStatus(err.message);}
 e.target.value="";
});
$("carouselPhotoList").addEventListener("click",e=>{
 const row=e.target.closest("[data-index]");if(!row)return;
 const i=Number(row.dataset.index),action=e.target.dataset.action;
 if(action==="up"&&i>0)[photos[i-1],photos[i]]=[photos[i],photos[i-1]];
 else if(action==="down"&&i<photos.length-1)[photos[i+1],photos[i]]=[photos[i],photos[i+1]];
 else if(action==="remove"){URL.revokeObjectURL(photos[i].url);photos.splice(i,1);}
 else active=i;
 active=Math.min(active,Math.max(0,photos.length-1));drawSlide(active);
});
$("carouselPrev").addEventListener("click",()=>drawSlide((active-1+photos.length)%Math.max(photos.length,1)));
$("carouselNext").addEventListener("click",()=>drawSlide((active+1)%Math.max(photos.length,1)));
["carouselFit","carouselBackground","carouselQuality"].forEach(id=>$(id).addEventListener("change",()=>drawSlide(active)));
$("carouselDuration").addEventListener("input",e=>$("carouselDurationValue").textContent=`${e.target.value} detik`);
$("carouselTransitionDuration").addEventListener("input",e=>$("carouselTransitionValue").textContent=`${Number(e.target.value).toFixed(1)} detik`);
function canvasBlob(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error("Gagal membuat gambar.")),"image/jpeg",.94));}
async function loadScript(url){return new Promise((resolve,reject)=>{
 const s=document.createElement("script");s.src=url;s.onload=resolve;s.onerror=()=>reject(new Error("Tidak dapat memuat library ekspor. Periksa koneksi internet."));document.head.appendChild(s);
});}
$("exportCarouselJpg").addEventListener("click",async()=>{
 if(!photos.length||exporting)return;exporting=true;renderList();
 try{
  setStatus("Menyiapkan file JPG...");
  if(!window.JSZip)await loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
  const zip=new JSZip(),s=settings(),temp=document.createElement("canvas");temp.width=s.width;temp.height=s.height;
  const tctx=temp.getContext("2d");
  for(let i=0;i<photos.length;i++){
   tctx.fillStyle=s.background;tctx.fillRect(0,0,temp.width,temp.height);
   const img=photos[i].img,ratio=s.fit==="contain"?Math.min(temp.width/img.width,temp.height/img.height):Math.max(temp.width/img.width,temp.height/img.height);
   const dw=img.width*ratio,dh=img.height*ratio;
   tctx.drawImage(img,(temp.width-dw)/2,(temp.height-dh)/2,dw,dh);
   const blob=await canvasBlob(temp);
   zip.file(`slide-${String(i+1).padStart(2,"0")}.jpg`,blob);
   $("carouselProgress").hidden=false;$("carouselProgress").value=Math.round((i+1)/photos.length*70);
   setStatus(`Membuat slide JPG ${i+1}/${photos.length}...`);
  }
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
 }else{
  fitImage(to.img,0,0,w,h,s.fit,1,1+Math.sin(elapsed*.7)*.045,Math.sin(elapsed*.6)*w*.018);
 }
}
function drawVideoFrame(time,s){
 const duration=s.duration,trans=s.transitionDuration,total=photos.length*duration;
 const index=Math.min(photos.length-1,Math.floor(time/duration)),local=time-index*duration;
 const next=(index+1)%photos.length;
 if(local>duration-trans&&photos.length>1){
  drawTransitionFrame(photos[index],photos[next],(local-(duration-trans))/trans,local,s.transition,s);
 }else{
  ctx.fillStyle=s.background;ctx.fillRect(0,0,canvas.width,canvas.height);
  const progress=local/duration;
  if(s.transition==="kenburns")fitImage(photos[index].img,0,0,canvas.width,canvas.height,s.fit,1,1+progress*.08,Math.sin(progress*Math.PI)*canvas.width*.012);
  else fitImage(photos[index].img,0,0,canvas.width,canvas.height,s.fit);
 }
 return total;
}
async function recordWebm(s){
 const fps=24,stream=canvas.captureStream(fps);
 const mime=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"].find(t=>MediaRecorder.isTypeSupported(t));
 if(!mime)throw new Error("Browser ini tidak mendukung perekaman video. Gunakan Chrome atau Edge terbaru.");
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:s.width>=1080?8000000:4500000});
 const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 const stopped=new Promise((resolve,reject)=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));recorder.onerror=()=>reject(new Error("Perekaman video gagal."));});
 recorder.start(250);
 const total=photos.length*s.duration,started=performance.now();
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
 const s=settings(),duration=photos.length*s.duration;
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