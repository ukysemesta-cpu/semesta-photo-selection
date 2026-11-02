const cfg=window.SEMESTA_SUPABASE_CONFIG;
const sb=window.supabase.createClient(cfg.url,cfg.publishableKey);
const params=new URLSearchParams(location.search),token=params.get("token");
const $=id=>document.getElementById(id);
let gallery=null,photos=[],currentIndex=0,showingSelected=false,showingHighlight=false,searchTerm="",sortMode="original",swipeMode=false,draftSaveTimer=null,draftSaving=false,draftDirty=false,draftSaveQueue=Promise.resolve(),lastDraftIds="";
if(!token){$("galleryNotice").textContent="Link galeri tidak lengkap. Silakan minta link terbaru dari admin.";throw new Error("Missing gallery token");}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function currentDraftIds(){
 return photos.filter(p=>p.selected).map(p=>p.id).sort();
}
function setDraftStatus(message, isError=false){
 const el=$("draftSyncStatus");
 if(!el)return;
 el.textContent=message;
 el.classList.toggle("error",!!isError);
}
async function loadSelectionDraft(showMessage=false){
 if(!gallery || (gallery.selection_status==="submitted" && !gallery.revision_allowed))return;
 try{
  const {data,error}=await sb.rpc("get_photo_selection_draft",{p_token:token});
  if(error)throw error;
  const ids=Array.isArray(data?.photo_ids)?data.photo_ids:[];
  const idSet=new Set(ids);
  photos.forEach(p=>p.selected=idSet.has(p.id));
  lastDraftIds=currentDraftIds().join(",");
  draftDirty=false;
  render();
  if(showMessage)setDraftStatus("Pilihan sementara berhasil disinkronkan.");
 }catch(err){
  console.error("Load selection draft failed:",err);
  setDraftStatus("Sinkronisasi belum tersedia. Hubungi admin.",true);
 }
}
function queueDraftSave(){
 if(!gallery || (gallery.selection_status==="submitted" && !gallery.revision_allowed))return;
 draftDirty=true;
 setDraftStatus("Menyimpan pilihan...");
 clearTimeout(draftSaveTimer);
 draftSaveTimer=setTimeout(()=>saveSelectionDraft(),450);
}
async function saveSelectionDraft(){
 if(!gallery || (gallery.selection_status==="submitted" && !gallery.revision_allowed) || !draftDirty)return;
 const ids=currentDraftIds();
 const snapshot=ids.join(",");
 draftSaving=true;
 draftSaveQueue=draftSaveQueue.then(async()=>{
  const {data,error}=await sb.rpc("save_photo_selection_draft",{p_token:token,p_photo_ids:ids});
  if(error)throw error;
  if(!data?.ok)throw new Error(data?.message||"Pilihan sementara tidak dapat disimpan.");
  lastDraftIds=snapshot;
  if(currentDraftIds().join(",")===snapshot){
   draftDirty=false;
   setDraftStatus("Pilihan tersimpan · dapat dilanjutkan di perangkat lain.");
  }else{
   draftDirty=true;
   clearTimeout(draftSaveTimer);
   draftSaveTimer=setTimeout(()=>saveSelectionDraft(),250);
  }
 }).catch(err=>{
  console.error("Save selection draft failed:",err);
  setDraftStatus("Gagal menyimpan pilihan sementara. Periksa koneksi.",true);
 });
 try{await draftSaveQueue;}finally{draftSaving=false;}
}
async function refreshDraftFromServer(){
 if(!gallery || (gallery.selection_status==="submitted" && !gallery.revision_allowed) || draftDirty || draftSaving)return;
 try{
  const {data,error}=await sb.rpc("get_photo_selection_draft",{p_token:token});
  if(error)throw error;
  const ids=Array.isArray(data?.photo_ids)?data.photo_ids:[];
  const snapshot=[...ids].sort().join(",");
  if(snapshot!==lastDraftIds){
   const idSet=new Set(ids);
   photos.forEach(p=>p.selected=idSet.has(p.id));
   lastDraftIds=snapshot;
   render();
   if($("reviewModal")?.classList.contains("open"))renderReviewList();
   setDraftStatus("Pilihan diperbarui dari perangkat lain.");
  }
 }catch(err){console.warn("Draft refresh failed:",err);}
}
function selectedCount(){return photos.filter(p=>p.selected).length;}
function render(){
 let visible=photos.filter(p=>(!showingSelected||p.selected)&&(!showingHighlight||p.is_highlight));
 if(searchTerm){const term=searchTerm.toLocaleLowerCase("id");visible=visible.filter(p=>String(p.filename||"").toLocaleLowerCase("id").includes(term));}
 if(sortMode==="az")visible.sort((a,b)=>String(a.filename).localeCompare(String(b.filename),"id",{numeric:true,sensitivity:"base"}));
 else if(sortMode==="za")visible.sort((a,b)=>String(b.filename).localeCompare(String(a.filename),"id",{numeric:true,sensitivity:"base"}));
 else if(sortMode==="selected")visible.sort((a,b)=>Number(!!b.selected)-Number(!!a.selected)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
 $("photoCount").textContent=`${visible.length} dari ${photos.length} foto ditampilkan`;
 $("highlightFilter").hidden=!photos.some(p=>p.is_highlight);
 $("photoGrid").innerHTML=visible.map(p=>`<article class="photo-card ${p.selected?"selected":""}" data-id="${p.id}">
   <img src="${escapeHtml(p.preview_url||"")}" data-drive-id="${escapeHtml(p.drive_file_id||"")}" alt="${escapeHtml(p.filename)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="if(this.dataset.driveId && !this.dataset.fallback){this.dataset.fallback='1';this.src='https://drive.google.com/uc?export=view&id='+encodeURIComponent(this.dataset.driveId)}else{this.style.opacity='0.15'}">
   <span class="photo-name">${escapeHtml(p.filename)}</span>
   <button class="heart-btn ${p.selected?"selected":""}" data-select="${p.id}" aria-label="Pilih foto">${p.selected?"♥":"♡"}</button>
 </article>`).join("")||'<p class="muted">Belum ada foto dalam galeri ini. Silakan hubungi admin.</p>';
 const count=selectedCount(),limit=Number(gallery.selection_limit);
 $("selectedCount").textContent=count;
 $("reviewCount").textContent=count;
 $("selectionLimit").textContent=limit===0?" / tanpa batas":` / ${limit} foto`;
 $("progressBar").style.width=(limit===0?Math.min(count*5,100):Math.min(count/Math.max(limit,1)*100,100))+"%";
 const locked=gallery.selection_status==="submitted" && !gallery.revision_allowed;
 $("submitSelection").disabled=locked;
 $("submitSelection").textContent=locked?"Pilihan Sudah Dikirim":(gallery.selection_status==="submitted"&&gallery.revision_allowed?"Kirim Revisi Foto":"Kirim Pilihan Foto");
 if($("draftSyncStatus")){
   if(locked)$("draftSyncStatus").textContent="Pilihan final terkunci. Hubungi admin jika ingin revisi.";
   else if(gallery.selection_status==="submitted"&&gallery.revision_allowed)$("draftSyncStatus").textContent="Akses revisi dibuka oleh admin. Setelah dikirim, galeri akan terkunci kembali.";
 }
}
function openReview(){
 renderReviewList();
 const modal = $("reviewModal");
 modal.classList.add("open");
 modal.style.display = "flex";
 modal.style.visibility = "visible";
 modal.style.opacity = "1";
 modal.setAttribute("aria-hidden","false");
 document.body.classList.add("review-open");
}
function closeReview(){
 const modal = $("reviewModal");
 modal.classList.remove("open");
 modal.style.display = "none";
 modal.setAttribute("aria-hidden","true");
 document.body.classList.remove("review-open");
}
function renderReviewList(){
 const chosen=photos.filter(p=>p.selected).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
 $("reviewSubtitle").textContent=gallery?.selection_status==="submitted"&&!gallery?.revision_allowed
   ?"Pilihan sudah dikirim dan terkunci."
   :"Periksa kembali foto. Anda masih bisa membatalkan pilihan sebelum dikirim.";
 $("reviewFooterCount").textContent=`${chosen.length} foto dipilih`;
 $("reviewList").innerHTML=chosen.map((p,i)=>`
   <article class="review-photo" data-review-id="${p.id}">
     <img src="${escapeHtml(p.preview_url||"")}" alt="${escapeHtml(p.filename)}" loading="lazy"
       onerror="if(this.dataset.driveId && !this.dataset.fallback){this.dataset.fallback='1';this.src='https://drive.google.com/uc?export=view&id='+encodeURIComponent(this.dataset.driveId)}else{this.style.opacity='.2'}"
       data-drive-id="${escapeHtml(p.drive_file_id||"")}">
     <div class="review-photo-meta"><b>${i+1}. ${escapeHtml(p.filename)}</b><small>Foto pilihan Anda</small></div>
     ${gallery?.selection_status==="submitted"&&!gallery?.revision_allowed?"":`<button type="button" class="review-remove" data-remove-selection="${p.id}">Batalkan pilihan</button>`}
   </article>`).join("") || '<div class="review-empty"><b>Belum ada foto pilihan.</b><span>Kembali ke galeri untuk memilih foto favorit Anda.</span></div>';
}
function openPreview(id){
 currentIndex=photos.findIndex(p=>p.id===id);if(currentIndex<0)return;
 const p=photos[currentIndex];
 const previewImage=$("previewArt");
 previewImage.onerror=()=>{if(p.drive_file_id && !previewImage.dataset.fallback){previewImage.dataset.fallback="1";previewImage.src=`https://drive.google.com/uc?export=view&id=${encodeURIComponent(p.drive_file_id)}`;}};
 previewImage.dataset.fallback="";
 previewImage.src=p.preview_url||"";$("previewName").textContent=p.filename;
 $("previewSelect").textContent=p.selected?"♥ Foto Terpilih":"♡ Pilih Foto";
 $("previewSelect").disabled=gallery.selection_status==="submitted"&&!gallery.revision_allowed;
 $("previewSkip").textContent=swipeMode?"Lewati →":"Tutup foto";
 $("swipeHint").textContent=swipeMode?"Mode Swipe aktif · Geser kiri untuk melewati, kanan untuk memilih":"Gunakan tombol atau geser foto";
 $("previewModal").classList.add("open");
}
function startSwipeMode(){
 if(!photos.length)return;
 swipeMode=true;
 const candidates=photos.filter(p=>!p.selected);
 const first=candidates[0]||photos[0];
 openPreview(first.id);
}
function stopSwipeMode(){swipeMode=false;closePreview();}
function advanceSwipe(){
 const remaining=photos.filter(p=>!p.selected);
 if(!remaining.length){alert("Semua foto sudah dipilih. Anda dapat meninjau pilihan melalui tombol Lihat Pilihan.");stopSwipeMode();return;}
 const next=remaining.find(p=>photos.indexOf(p)>currentIndex)||remaining[0];
 openPreview(next.id);
}
function closePreview(){$("previewModal").classList.remove("open");swipeMode=false;}
async function togglePhoto(id){
 if(gallery.selection_status==="submitted" && !gallery.revision_allowed){alert("Pilihan sudah dikirim dan terkunci. Hubungi admin jika perlu revisi.");return;}
 if(gallery.selection_deadline && new Date().toISOString().slice(0,10)>gallery.selection_deadline){alert("Batas waktu pemilihan telah berakhir.");return;}
 const p=photos.find(x=>x.id===id);if(!p)return;
 if(!p.selected&&Number(gallery.selection_limit)>0&&selectedCount()>=Number(gallery.selection_limit)){alert(`Maksimal pilihan ${gallery.selection_limit} foto.`);return;}
 p.selected=!p.selected;render();
 if($("reviewModal").classList.contains("open"))renderReviewList();
 queueDraftSave();
}
$("photoGrid").addEventListener("click",e=>{
 const b=e.target.closest("[data-select]");if(b){e.stopPropagation();togglePhoto(b.dataset.select);return;}
 const card=e.target.closest("[data-id]");if(card)openPreview(card.dataset.id);
});
// Delegated capture handler: remains reliable if gallery controls are re-rendered.
document.addEventListener("click", function(event) {
 const trigger = event.target.closest("#openReview");
 if (trigger) {
   event.preventDefault();
   event.stopPropagation();
   openReview();
 }
}, true);
$("closeReview").addEventListener("click",closeReview);
$("reviewDone").addEventListener("click",closeReview);
$("reviewModal").addEventListener("click",e=>{if(e.target===$("reviewModal"))closeReview();});
$("reviewList").addEventListener("click",async e=>{
 const button=e.target.closest("[data-remove-selection]");
 if(!button)return;
 await togglePhoto(button.dataset.removeSelection);
});
document.addEventListener("keydown",e=>{if(e.key==="Escape" && $("reviewModal").classList.contains("open"))closeReview();});
$("allFilter").addEventListener("click",()=>{showingSelected=false;showingHighlight=false;$("allFilter").classList.add("active");$("selectedFilter").classList.remove("active");$("highlightFilter").classList.remove("active");render();});
$("selectedFilter").addEventListener("click",()=>{showingSelected=true;showingHighlight=false;$("selectedFilter").classList.add("active");$("allFilter").classList.remove("active");$("highlightFilter").classList.remove("active");render();});
$("highlightFilter").addEventListener("click",()=>{showingHighlight=true;showingSelected=false;$("highlightFilter").classList.add("active");$("allFilter").classList.remove("active");$("selectedFilter").classList.remove("active");render();});
$("photoSearch").addEventListener("input",e=>{searchTerm=e.target.value.trim();render();});
$("photoSort").addEventListener("change",e=>{sortMode=e.target.value;render();});
$("startSwipeMode").addEventListener("click",startSwipeMode);
$("previewSkip").addEventListener("click",()=>{if(swipeMode)advanceSwipe();else closePreview();});
let swipeStartX=0,swipeStartY=0;
$("previewArt").addEventListener("touchstart",e=>{const t=e.changedTouches[0];swipeStartX=t.clientX;swipeStartY=t.clientY;},{passive:true});
$("previewArt").addEventListener("touchend",async e=>{
 if(!swipeMode)return;
 const t=e.changedTouches[0],dx=t.clientX-swipeStartX,dy=t.clientY-swipeStartY;
 if(Math.abs(dx)<65||Math.abs(dx)<Math.abs(dy))return;
 const current=photos[currentIndex];
 if(dx>0){if(current&&!current.selected)togglePhoto(current.id);advanceSwipe();}
 else{advanceSwipe();}
},{passive:true});
$("closePreview").addEventListener("click",closePreview);
$("previewModal").addEventListener("click",e=>{if(e.target===$("previewModal"))closePreview();});
$("previewSelect").addEventListener("click",async()=>{const p=photos[currentIndex];if(!p)return;if(swipeMode){if(!p.selected)togglePhoto(p.id);advanceSwipe();}else{togglePhoto(p.id);openPreview(p.id);}});
$("prevPhoto").addEventListener("click",()=>{if(!photos.length)return;currentIndex=(currentIndex-1+photos.length)%photos.length;openPreview(photos[currentIndex].id);});
$("nextPhoto").addEventListener("click",()=>{if(!photos.length)return;currentIndex=(currentIndex+1)%photos.length;openPreview(photos[currentIndex].id);});
$("submitSelection").addEventListener("click",async()=>{
 const chosen=photos.filter(p=>p.selected);
 if(!chosen.length){alert("Pilih minimal satu foto terlebih dahulu.");return;}
 if(!confirm(`Kirim ${chosen.length} foto pilihan kepada admin Semesta? Setelah dikirim, pilihan terkunci dan perubahan harus melalui admin.`))return;
 clearTimeout(draftSaveTimer);
 if(draftDirty)await saveSelectionDraft();
 $("submitSelection").disabled=true;
 const {data,error}=await sb.rpc("submit_photo_selection",{p_token:token,p_photo_ids:chosen.map(p=>p.id)});
 $("submitSelection").disabled=false;
 if(error){alert("Gagal mengirim pilihan: "+error.message);return;}
 if(!data?.ok){alert(data?.message||"Pilihan tidak dapat dikirim.");return;}
 gallery.selection_status="submitted";gallery.submitted_at=new Date().toISOString();gallery.revision_allowed=false;
 draftDirty=false;clearTimeout(draftSaveTimer);
 setDraftStatus("Pilihan final sudah dikirim dan terkunci.");
 const admin=prompt("Pilih nomor WhatsApp admin:\n1. Admin 1 — 0858 0000 7878\n2. Admin 2 — 0823 2471 4989","1");
 if(admin==="1"||admin==="2"){
   const number=admin==="1"?"6285800007878":"6282324714989";
   const names=chosen.map((p,i)=>`${i+1}. ${p.filename}`).join("\n");
   const message=`Halo Admin Semesta.\nSaya sudah submit pilihan foto.\nNama: ${gallery.client_name}\nGaleri: ${gallery.gallery_name}\nTotal: ${chosen.length} foto\n\n${names}`;
   window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,"_blank");
 }
 alert("Pilihan foto berhasil disimpan secara online.");
 render();
});
async function init(){
 $("galleryNotice").textContent="Menghubungkan ke galeri...";
 let response;
 try {
   response = await fetch(`${cfg.url}/functions/v1/client-gallery`, {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
       "apikey": cfg.publishableKey,
       "Authorization": `Bearer ${cfg.publishableKey}`
     },
     body: JSON.stringify({ token })
   });
 } catch (err) {
   $("galleryNotice").textContent = "Koneksi ke galeri gagal. Periksa internet lalu muat ulang halaman.";
   console.error("Client gallery request failed:", err);
   return;
 }
 const data = await response.json().catch(() => null);
 if(!response.ok || !data?.ok){
   $("galleryNotice").textContent = data?.message || "Tidak dapat memuat galeri. Silakan hubungi admin.";
   console.error("Client gallery function error:", response.status, data);
   return;
 }
 gallery=data.gallery;photos=(data.photos||[]).map(p=>({...p,selected:!!p.selected}));
 if(gallery.selection_status!=="submitted" || gallery.revision_allowed){
  await loadSelectionDraft(false);
 }else{
  photos.forEach(p=>p.selected=!!p.selected);
 }
 $("clientGalleryTitle").textContent=gallery.gallery_name;
 $("clientGreeting").textContent=gallery.revision_allowed
  ?`Halo ${gallery.client_name}, akses revisi dibuka oleh admin. Silakan perbarui pilihan foto.`
  :`Halo ${gallery.client_name}, silakan pilih foto untuk editing. Batas pemilihan: ${gallery.selection_deadline||"—"}.`;
 $("galleryNotice").textContent=gallery.selection_status==="submitted"?"Pilihan Anda sudah dikirim. Terima kasih!":"Silakan pilih foto sesuai kuota yang tersedia.";
 render();
}
init();
window.setInterval(refreshDraftFromServer,12000);
