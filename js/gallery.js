const demoPhotos = Array.from({length:16}, (_,i)=>({id:i+1,name:`DSCF${String(1200+i*7).padStart(4,"0")}.JPG`,selected:false}));
const params = new URLSearchParams(location.search);
const galleryId = params.get("id");
const saved = JSON.parse(localStorage.getItem("semesta_photo_galleries_v2") || localStorage.getItem("semesta_photo_galleries_v1") || "[]");
const gallery = saved.find(g=>g.id===galleryId);
const limit = gallery ? Number(gallery.limit ?? 20) : 20;
const selectionKey = `semesta_photo_selection_${galleryId || "demo"}`;
const storedSelection = JSON.parse(localStorage.getItem(selectionKey) || "[]");
let photos = demoPhotos.map(p=>({...p, selected:storedSelection.includes(p.name)}));
let currentIndex = 0;
let showingSelected = false;
const $ = id => document.getElementById(id);

if(gallery){
  $("clientGalleryTitle").textContent = gallery.galleryName;
  $("clientGreeting").textContent = `Halo ${gallery.clientName}, silakan pilih foto yang ingin diproses untuk editing.`;
  $("selectionLimit").textContent = limit===0 ? " / tanpa batas" : ` / ${limit} foto`;
  if(gallery.deadline || gallery.createdAt){
    const computedDeadline = gallery.deadline || (() => { const d=new Date(gallery.createdAt); d.setDate(d.getDate()+Number(gallery.durationDays||14)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
    const parts=computedDeadline.split("-").map(Number);
    const formatted=new Date(parts[0],parts[1]-1,parts[2]).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
    $("clientGreeting").textContent += ` Batas pemilihan: ${formatted}.`;
  }
}
function localDateString(){
  const now=new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
}
function selectedCount(){return photos.filter(p=>p.selected).length}
function updateSummary(){
  const count=selectedCount();
  localStorage.setItem(selectionKey, JSON.stringify(photos.filter(p=>p.selected).map(p=>p.name)));
  $("selectedCount").textContent=count;
  $("progressBar").style.width=(limit===0?Math.min(count*5,100):Math.min(count/Math.max(limit,1)*100,100))+"%";
}
function render(){
  const visible=photos.filter(p=>!showingSelected||p.selected);
  $("photoCount").textContent=`${visible.length} foto ditampilkan`;
  $("photoGrid").innerHTML=visible.map(p=>`<article class="photo-card ${p.selected?"selected":""}" data-id="${p.id}">
    <div class="photo-art">SEMESTA</div><span class="photo-name">${p.name}</span>
    <button class="heart-btn ${p.selected?"selected":""}" data-select="${p.id}" aria-label="Pilih foto">${p.selected?"♥":"♡"}</button>
  </article>`).join("") || '<p class="muted">Belum ada foto yang dipilih.</p>';
  updateSummary();
}
function togglePhoto(id){
  if(gallery && (gallery.deadline || gallery.createdAt) && localDateString() > (gallery.deadline || (() => { const d=new Date(gallery.createdAt); d.setDate(d.getDate()+Number(gallery.durationDays||14)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })())){alert("Batas waktu pemilihan foto sudah berakhir. Silakan hubungi admin.");return}
  if(gallery?.status === "draft"){alert("Galeri ini belum diaktifkan oleh admin.");return}
  const photo=photos.find(p=>p.id===id);
  if(!photo)return;
  if(!photo.selected && limit!==0 && selectedCount()>=limit){alert(`Maksimal pilihan adalah ${limit} foto.`);return}
  photo.selected=!photo.selected;render();
}
$("photoGrid").addEventListener("click",e=>{
  const select=e.target.closest("[data-select]");
  if(select){e.stopPropagation();togglePhoto(Number(select.dataset.select));return}
  const card=e.target.closest("[data-id]");
  if(card)openPreview(Number(card.dataset.id));
});
$("allFilter").addEventListener("click",()=>{showingSelected=false;$("allFilter").classList.add("active");$("selectedFilter").classList.remove("active");render()});
$("selectedFilter").addEventListener("click",()=>{showingSelected=true;$("selectedFilter").classList.add("active");$("allFilter").classList.remove("active");render()});
function openPreview(id){
  currentIndex=photos.findIndex(p=>p.id===id);
  const p=photos[currentIndex];
  $("previewArt").textContent="SEMESTA";
  $("previewName").textContent=p.name;
  $("previewSelect").textContent=p.selected?"♥ Foto Terpilih":"♡ Pilih Foto";
  $("previewModal").classList.add("open");
}
function closePreview(){$("previewModal").classList.remove("open")}
$("closePreview").addEventListener("click",closePreview);
$("previewModal").addEventListener("click",e=>{if(e.target===$("previewModal"))closePreview()});
$("previewSelect").addEventListener("click",()=>{togglePhoto(photos[currentIndex].id);openPreview(photos[currentIndex].id)});
function movePreview(step){currentIndex=(currentIndex+step+photos.length)%photos.length;openPreview(photos[currentIndex].id)}
$("prevPhoto").addEventListener("click",()=>movePreview(-1));
$("nextPhoto").addEventListener("click",()=>movePreview(1));
$("submitSelection").addEventListener("click",()=>{
  const chosen=photos.filter(p=>p.selected);
  if(gallery && (gallery.deadline || gallery.createdAt) && localDateString() > (gallery.deadline || (() => { const d=new Date(gallery.createdAt); d.setDate(d.getDate()+Number(gallery.durationDays||14)); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })())){alert("Batas waktu pemilihan foto sudah berakhir.");return}
  if(!chosen.length){alert("Silakan pilih minimal satu foto terlebih dahulu.");return}
  const names=chosen.map((p,i)=>`${i+1}. ${p.name}`).join("\n");
  const admin=prompt("Pilih nomor WhatsApp admin:\n1. Admin 1 — 6285800007878\n2. Admin 2 — 6282324714989","1");
  if(admin!=="1"&&admin!=="2")return;
  const number=admin==="1"?"6285800007878":"6282324714989";
  const message=`Halo Admin Semesta.\n\nSaya sudah menyelesaikan pemilihan foto.\nNama: ${gallery?.clientName||"Klien"}\nGaleri: ${gallery?.galleryName||"Galeri Foto"}\nTotal foto dipilih: ${chosen.length}\n\nDaftar file:\n${names}\n\nMohon diproses untuk editing. Terima kasih.`;
  if (gallery) {
    const allGalleries = JSON.parse(localStorage.getItem("semesta_photo_galleries_v2") || "[]");
    const index = allGalleries.findIndex(g => g.id === gallery.id);
    if (index >= 0) { allGalleries[index].status = "submitted"; allGalleries[index].submittedAt = new Date().toISOString(); localStorage.setItem("semesta_photo_galleries_v2", JSON.stringify(allGalleries)); }
  }
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`,"_blank");
});
render();
