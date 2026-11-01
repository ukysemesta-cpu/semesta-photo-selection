const cfg=window.SEMESTA_SUPABASE_CONFIG;
const sb=window.supabase.createClient(cfg.url,cfg.publishableKey);
const params=new URLSearchParams(location.search),token=params.get("token");
const $=id=>document.getElementById(id);
let gallery=null,photos=[],currentIndex=0,showingSelected=false;
if(!token){$("galleryNotice").textContent="Link galeri tidak lengkap. Silakan minta link terbaru dari admin.";throw new Error("Missing gallery token");}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function selectedCount(){return photos.filter(p=>p.selected).length;}
function render(){
 const visible=photos.filter(p=>!showingSelected||p.selected);
 $("photoCount").textContent=`${visible.length} foto ditampilkan`;
 $("photoGrid").innerHTML=visible.map(p=>`<article class="photo-card ${p.selected?"selected":""}" data-id="${p.id}">
   <img src="${escapeHtml(p.preview_url||"")}" alt="${escapeHtml(p.filename)}" loading="lazy" style="width:100%;height:100%;object-fit:cover">
   <span class="photo-name">${escapeHtml(p.filename)}</span>
   <button class="heart-btn ${p.selected?"selected":""}" data-select="${p.id}" aria-label="Pilih foto">${p.selected?"♥":"♡"}</button>
 </article>`).join("")||'<p class="muted">Belum ada foto dalam galeri ini. Silakan hubungi admin.</p>';
 const count=selectedCount(),limit=Number(gallery.selection_limit);
 $("selectedCount").textContent=count;
 $("selectionLimit").textContent=limit===0?" / tanpa batas":` / ${limit} foto`;
 $("progressBar").style.width=(limit===0?Math.min(count*5,100):Math.min(count/Math.max(limit,1)*100,100))+"%";
 $("submitSelection").disabled=gallery.selection_status==="submitted";
 if(gallery.selection_status==="submitted")$("submitSelection").textContent="Pilihan Sudah Dikirim";
}
function openPreview(id){
 currentIndex=photos.findIndex(p=>p.id===id);if(currentIndex<0)return;
 const p=photos[currentIndex];$("previewArt").src=p.preview_url||"";$("previewName").textContent=p.filename;
 $("previewSelect").textContent=p.selected?"♥ Foto Terpilih":"♡ Pilih Foto";
 $("previewModal").classList.add("open");
}
function closePreview(){$("previewModal").classList.remove("open");}
async function togglePhoto(id){
 if(gallery.selection_status==="submitted"){alert("Pilihan sudah dikirim. Hubungi admin jika perlu perubahan.");return;}
 if(gallery.selection_deadline && new Date().toISOString().slice(0,10)>gallery.selection_deadline){alert("Batas waktu pemilihan telah berakhir.");return;}
 const p=photos.find(x=>x.id===id);if(!p)return;
 if(!p.selected&&Number(gallery.selection_limit)>0&&selectedCount()>=Number(gallery.selection_limit)){alert(`Maksimal pilihan ${gallery.selection_limit} foto.`);return;}
 p.selected=!p.selected;render();
}
$("photoGrid").addEventListener("click",e=>{
 const b=e.target.closest("[data-select]");if(b){e.stopPropagation();togglePhoto(b.dataset.select);return;}
 const card=e.target.closest("[data-id]");if(card)openPreview(card.dataset.id);
});
$("allFilter").addEventListener("click",()=>{showingSelected=false;$("allFilter").classList.add("active");$("selectedFilter").classList.remove("active");render();});
$("selectedFilter").addEventListener("click",()=>{showingSelected=true;$("selectedFilter").classList.add("active");$("allFilter").classList.remove("active");render();});
$("closePreview").addEventListener("click",closePreview);
$("previewModal").addEventListener("click",e=>{if(e.target===$("previewModal"))closePreview();});
$("previewSelect").addEventListener("click",async()=>{const p=photos[currentIndex];if(!p)return;await togglePhoto(p.id);openPreview(p.id);});
$("prevPhoto").addEventListener("click",()=>{if(!photos.length)return;currentIndex=(currentIndex-1+photos.length)%photos.length;openPreview(photos[currentIndex].id);});
$("nextPhoto").addEventListener("click",()=>{if(!photos.length)return;currentIndex=(currentIndex+1)%photos.length;openPreview(photos[currentIndex].id);});
$("submitSelection").addEventListener("click",async()=>{
 const chosen=photos.filter(p=>p.selected);
 if(!chosen.length){alert("Pilih minimal satu foto terlebih dahulu.");return;}
 if(!confirm(`Kirim ${chosen.length} foto pilihan kepada admin Semesta? Setelah dikirim, pilihan terkunci dan perubahan harus melalui admin.`))return;
 $("submitSelection").disabled=true;
 const {data,error}=await sb.rpc("submit_photo_selection",{p_token:token,p_photo_ids:chosen.map(p=>p.id)});
 $("submitSelection").disabled=false;
 if(error){alert("Gagal mengirim pilihan: "+error.message);return;}
 if(!data?.ok){alert(data?.message||"Pilihan tidak dapat dikirim.");return;}
 gallery.selection_status="submitted";gallery.submitted_at=new Date().toISOString();
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
 const {data,error}=await sb.rpc("get_client_gallery",{p_token:token});
 if(error){$("galleryNotice").textContent="Tidak dapat memuat galeri: "+error.message;return;}
 if(!data?.ok){$("galleryNotice").textContent=data?.message||"Galeri tidak ditemukan.";return;}
 gallery=data.gallery;photos=(data.photos||[]).map(p=>({...p,selected:!!p.selected}));
 $("clientGalleryTitle").textContent=gallery.gallery_name;
 $("clientGreeting").textContent=`Halo ${gallery.client_name}, silakan pilih foto untuk editing. Batas pemilihan: ${gallery.selection_deadline||"—"}.`;
 $("galleryNotice").textContent=gallery.selection_status==="submitted"?"Pilihan Anda sudah dikirim. Terima kasih!":"Silakan pilih foto sesuai kuota yang tersedia.";
 render();
}
init();
