const STORAGE_KEY = "semesta_photo_galleries_v2";
const LEGACY_KEY = "semesta_photo_galleries_v1";
const $ = (id) => document.getElementById(id);
let galleries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
if (!galleries) {
  galleries = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]").map(g => ({
    ...g, limit: String(g.limit ?? 20), durationDays: Number(g.durationDays || 14),
    createdAt: g.createdAt || new Date().toISOString()
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(galleries));
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(galleries)); render(); }
// Migrasi status lama: opsi "Revisi" dihapus dan dialihkan ke "Sedang editing".
galleries.forEach(g => { if (g.editingStatus === "Revisi") g.editingStatus = "Sedang editing"; });
localStorage.setItem(STORAGE_KEY, JSON.stringify(galleries));
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function addDays(dateValue, days) {
  const d = new Date(dateValue);
  d.setDate(d.getDate() + Number(days));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function deadlineFor(g) {
  if (g.deadline) return g.deadline;
  return addDays(g.createdAt || new Date().toISOString(), g.durationDays || 14);
}
function prettyDate(value) {
  if (!value) return "—";
  const parts = String(value).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "—";
  return new Date(parts[0], parts[1]-1, parts[2]).toLocaleDateString("id-ID", {day:"numeric", month:"long", year:"numeric"});
}
function clientGalleryUrl(id) {
  return new URL(`gallery.html?id=${encodeURIComponent(id)}`, window.location.href).href;
}
async function copyClientLink(id) {
  const url = clientGalleryUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    alert(`Link galeri berhasil disalin.\n\n${url}\n\nCatatan: link lokal hanya untuk pengujian. Setelah aplikasi online, bagikan link dari domain website Semesta.`);
  } catch (error) { window.prompt("Salin link galeri klien berikut:", url); }
}
function isSubmitted(g) { return g.status === "submitted"; }
function isPending(g) { return g.status === "active" && !isSubmitted(g); }
function render() {
  $("totalGalleries").textContent = galleries.length;
  $("pendingGalleries").textContent = galleries.filter(isPending).length;
  $("submittedGalleries").textContent = galleries.filter(isSubmitted).length;
  const body = $("galleryTable");
  if (!galleries.length) { body.innerHTML = '<tr><td colspan="6" class="empty-cell">Belum ada galeri. Buat galeri pertama Anda di bawah.</td></tr>'; return; }
  body.innerHTML = galleries.map(g => {
    const submitted = isSubmitted(g);
    const statusText = submitted ? "Sudah Submit" : (g.status === "active" ? "Menunggu Seleksi" : "Draft");
    return `<tr>
      <td><b>${escapeHtml(g.clientName)}</b></td><td>${escapeHtml(g.galleryName)}</td>
      <td>${g.limit === "0" ? "Tanpa batas" : `${escapeHtml(g.limit)} foto`}</td>
      <td>${prettyDate(deadlineFor(g))} <small>(${escapeHtml(g.durationDays || 14)} hari)</small></td>
      <td><span class="pill ${submitted || g.status === "active" ? "pill-green" : "pill-gray"}">${statusText}</span><br><select class="mini-progress-select" data-progress="${escapeHtml(g.id)}" aria-label="Status pengerjaan">
        <option ${((g.editingStatus||"Belum mulai")==="Belum mulai")?"selected":""}>Belum mulai</option>
        <option ${g.editingStatus==="Sedang editing" || g.editingStatus==="Revisi"?"selected":""}>Sedang editing</option>
        <option value="Selesai" ${g.editingStatus==="Selesai"?"selected":""}>Selesai (Paket File Saja)</option>
        <option value="Selesai proses Cetak dan Album" ${g.editingStatus==="Selesai proses Cetak dan Album"?"selected":""}>Selesai proses Cetak</option>
      </select></td>
      <td class="actions-cell"><div class="actions-wrap"><a class="text-link" href="${escapeHtml(clientGalleryUrl(g.id))}" target="_blank" rel="noopener">Preview</a><button class="mini-action" data-copylink="${escapeHtml(g.id)}">Salin Link</button><button class="mini-action" data-edit="${escapeHtml(g.id)}">Edit</button><button class="mini-action danger" data-delete="${escapeHtml(g.id)}">Hapus</button><button class="mini-action" data-export="${escapeHtml(g.id)}">Rekap</button><button class="mini-action local-download" data-local-download="${escapeHtml(g.id)}">Download JPG/RAW</button><button class="mini-action local-copy" data-local-copy="${escapeHtml(g.id)}">Salin ORI → EDIT</button></div></td>
    </tr>`;
  }).join("");
}
function resetForm() {
  $("galleryForm").reset(); $("editingId").value=""; $("formTitle").textContent="Buat Galeri Klien";
  $("saveGalleryBtn").textContent="Simpan Galeri"; $("cancelEdit").hidden=true;
  $("galleryForm").elements.durationDays.value="14";
}
$("galleryForm").addEventListener("submit", (event) => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const id = data.get("editingId");
  const record = {
    clientName:data.get("clientName").trim(), galleryName:data.get("galleryName").trim(),
    driveUrl:data.get("driveUrl").trim(), limit:String(data.get("selectionLimit")),
    durationDays:Number(data.get("durationDays")), status:data.get("galleryStatus")
  };
  if (record.limit === "" || Number(record.limit) < 0 || !Number.isInteger(Number(record.limit))) { alert("Kuota harus berupa angka bulat 0 atau lebih."); return; }
  if (![7,14,21,30].includes(record.durationDays)) { alert("Pilih batas waktu 7, 14, 21, atau 30 hari."); return; }
  if (id) {
    const index=galleries.findIndex(g=>g.id===id);
    if(index>=0) galleries[index]={...galleries[index],...record,createdAt:new Date().toISOString(),deadline:addDays(new Date(),record.durationDays)};
  } else {
    const createdAt=new Date().toISOString();
    galleries.unshift({id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),...record,createdAt,deadline:addDays(new Date(),record.durationDays)});
  }
  save(); resetForm(); alert(id ? "Perubahan galeri berhasil disimpan." : "Galeri berhasil dibuat di browser ini."); location.hash="#galleries";
});

const RAW_EXTENSIONS = new Set(["cr2","cr3","nef","arw","raf","dng","orf","rw2","pef","srw"]);
function getChosenNames(galleryId) {
  const names = JSON.parse(localStorage.getItem(`semesta_photo_selection_${galleryId}`) || "[]");
  if (!Array.isArray(names) || !names.length) {
    alert("Belum ada daftar foto pilihan pada browser ini. Pastikan klien sudah memilih foto di perangkat/browser yang sama, atau integrasikan database online terlebih dahulu.");
    return null;
  }
  return names;
}
function filenameBase(filename) {
  return String(filename).replace(/\.[^.]+$/, "").toLocaleLowerCase();
}
function fileExtension(filename) {
  const match = String(filename).match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}
async function choosePhotoFormat() {
  const answer = prompt("Pilih format yang akan diambil:\n1 = JPG/JPEG\n2 = RAW\n3 = JPG + RAW", "1");
  if (!["1","2","3"].includes(answer)) return null;
  return answer === "1" ? "jpg" : answer === "2" ? "raw" : "both";
}
async function downloadChosenFromComputer(g) {
  const chosen = getChosenNames(g.id); if (!chosen) return;
  const format = await choosePhotoFormat(); if (!format) return;
  if (!window.showDirectoryPicker) {
    alert("Browser ini belum mendukung akses folder. Gunakan Google Chrome atau Microsoft Edge versi terbaru melalui localhost atau HTTPS.");
    return;
  }
  try {
    const sourceDir = await window.showDirectoryPicker({mode:"read"});
    const wanted = new Set(chosen.map(filenameBase));
    let copied = 0, missing = [];
    for await (const entry of sourceDir.values()) {
      if (entry.kind !== "file") continue;
      const ext = fileExtension(entry.name);
      const isJpg = ext === "jpg" || ext === "jpeg";
      const isRaw = RAW_EXTENSIONS.has(ext);
      if (!wanted.has(filenameBase(entry.name))) continue;
      if (format === "jpg" && !isJpg) continue;
      if (format === "raw" && !isRaw) continue;
      if (format === "both" && !isJpg && !isRaw) continue;
      const file = await entry.getFile();
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url; a.download = entry.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      copied++;
    }
    if (!copied) {
      missing = chosen;
      alert("Tidak ditemukan file yang cocok di folder yang dipilih. Pastikan nama file di folder ORI sama dengan nama file pilihan klien dan formatnya sesuai.");
    } else {
      alert(`${copied} file pilihan sedang diunduh. Jika browser meminta izin beberapa download, pilih Izinkan.`);
    }
  } catch (err) {
    if (err.name !== "AbortError") alert("Tidak dapat membaca folder: " + err.message);
  }
}
async function copyChosenOriToEdit(g) {
  const chosen = getChosenNames(g.id); if (!chosen) return;
  if (!window.showDirectoryPicker) {
    alert("Fitur salin folder memerlukan Google Chrome atau Microsoft Edge terbaru melalui localhost atau HTTPS.");
    return;
  }
  const confirmed = confirm(
    `Pilih folder INDUK yang berisi folder ORI.\n\nSistem akan menyalin file JPG dan RAW yang nama dasarnya cocok dengan pilihan klien dari ORI ke folder EDIT. Jika EDIT belum ada, folder akan dibuat otomatis.`
  );
  if (!confirmed) return;
  try {
    const parent = await window.showDirectoryPicker({mode:"readwrite"});
    const ori = await parent.getDirectoryHandle("ORI", {create:false});
    const edit = await parent.getDirectoryHandle("EDIT", {create:true});
    const wanted = new Set(chosen.map(filenameBase));
    let copied = 0;
    const found = new Set();
    for await (const entry of ori.values()) {
      if (entry.kind !== "file") continue;
      const ext = fileExtension(entry.name);
      if (!["jpg","jpeg",...RAW_EXTENSIONS].includes(ext)) continue;
      const base = filenameBase(entry.name);
      if (!wanted.has(base)) continue;
      const sourceFile = await entry.getFile();
      const target = await edit.getFileHandle(entry.name, {create:true});
      const writable = await target.createWritable();
      await writable.write(sourceFile);
      await writable.close();
      copied++;
      found.add(base);
    }
    const missing = chosen.filter(name => !found.has(filenameBase(name)));
    let message = `${copied} file berhasil disalin dari ORI ke EDIT.`;
    if (missing.length) message += `\n\n${missing.length} nama pilihan tidak ditemukan:\n${missing.slice(0,12).join("\n")}${missing.length>12?"\n...":""}`;
    alert(message);
  } catch (err) {
    if (err.name === "AbortError") return;
    if (err.name === "NotFoundError") alert('Folder "ORI" tidak ditemukan di dalam folder induk yang dipilih. Pastikan susunan foldernya: Folder Induk / ORI.');
    else alert("Proses salin gagal: " + err.message);
  }
}

$("galleryTable").addEventListener("click", event => {
  const edit=event.target.closest("[data-edit]"), del=event.target.closest("[data-delete]"), exp=event.target.closest("[data-export]"), copy=event.target.closest("[data-copylink]");
  const localDownload=event.target.closest("[data-local-download]"), localCopy=event.target.closest("[data-local-copy]");
  if(localDownload){const g=galleries.find(x=>x.id===localDownload.dataset.localDownload);if(g)downloadChosenFromComputer(g);return;}
  if(localCopy){const g=galleries.find(x=>x.id===localCopy.dataset.localCopy);if(g)copyChosenOriToEdit(g);return;}
  if(copy){copyClientLink(copy.dataset.copylink);return;}
  if(edit){
    const g=galleries.find(x=>x.id===edit.dataset.edit); if(!g)return;
    const f=$("galleryForm"); $("editingId").value=g.id; f.elements.clientName.value=g.clientName||"";
    f.elements.galleryName.value=g.galleryName||""; f.elements.driveUrl.value=g.driveUrl||"";
    f.elements.selectionLimit.value=g.limit??20; f.elements.durationDays.value=String(g.durationDays||14);
    f.elements.galleryStatus.value=g.status==="submitted"?"active":(g.status||"active");
    $("formTitle").textContent="Edit Galeri Klien"; $("saveGalleryBtn").textContent="Simpan Perubahan";
    $("cancelEdit").hidden=false; location.hash="#create";
  }
  if(del){
    const g=galleries.find(x=>x.id===del.dataset.delete); if(!g)return;
    if(confirm(`Hapus galeri “${g.galleryName}” milik ${g.clientName}? Tindakan ini tidak dapat dibatalkan.`)){
      galleries=galleries.filter(x=>x.id!==g.id); localStorage.removeItem(`semesta_photo_selection_${g.id}`); save();
    }
  }
  if(exp){
    const g=galleries.find(x=>x.id===exp.dataset.export); if(!g)return;
    const chosen=JSON.parse(localStorage.getItem(`semesta_photo_selection_${g.id}`)||"[]");
    const data={client:g.clientName,gallery:g.galleryName,driveFolder:g.driveUrl,deadline:deadlineFor(g),durationDays:g.durationDays||14,selectionLimit:g.limit,selectedPhotoFilenames:chosen,submitted:g.status==="submitted",notice:"Prototipe lokal: rekap tersimpan pada browser yang sama. Database online akan diintegrasikan pada tahap berikutnya."};
    downloadBlob(JSON.stringify(data,null,2),`${safeName(g.galleryName)}-rekap.json`,`application/json`);
  }
});
function safeName(s){return String(s||"galeri").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function downloadBlob(content,name,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$("cancelEdit").addEventListener("click",resetForm);
$("mobileMenu").addEventListener("click", () => $("sidebar").classList.toggle("show"));
document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", () => $("sidebar").classList.remove("show")));

function openDetails(filter) {
  const title = filter==="all" ? "Semua Galeri" : filter==="pending" ? "Menunggu Seleksi" : "Sudah Submit";
  const rows = galleries.filter(g => filter==="all" || (filter==="pending" ? isPending(g) : isSubmitted(g)));
  $("detailsTitle").textContent = title;
  $("detailsDescription").textContent = `${rows.length} galeri ditemukan. Klik Preview untuk membuka halaman galeri klien.`;
  $("detailsList").innerHTML = rows.length ? rows.map(g=>`
    <div class="detail-item">
      <div class="detail-item-main"><b>${escapeHtml(g.clientName)} — ${escapeHtml(g.galleryName)}</b>
      <small>${g.limit==="0"?"Tanpa batas":`${escapeHtml(g.limit)} foto`} · Tenggat ${prettyDate(deadlineFor(g))} · ${isSubmitted(g)?"Sudah submit":g.status==="active"?"Menunggu seleksi":"Draft"}</small></div>
      <div class="detail-item-actions"><a class="mini-action" href="${escapeHtml(clientGalleryUrl(g.id))}" target="_blank" rel="noopener">Preview</a><button class="mini-action" data-modal-edit="${escapeHtml(g.id)}">Edit</button></div>
    </div>`).join("") : '<div class="details-empty">Belum ada galeri pada kategori ini.</div>';
  $("detailsModal").classList.add("open"); $("detailsModal").setAttribute("aria-hidden","false");
}
document.querySelectorAll("[data-stat]").forEach(card=>card.addEventListener("click",()=>openDetails(card.dataset.stat)));
$("closeDetails").addEventListener("click",()=>{$("detailsModal").classList.remove("open");$("detailsModal").setAttribute("aria-hidden","true")});
$("detailsModal").addEventListener("click",e=>{if(e.target===$("detailsModal"))$("closeDetails").click()});
$("detailsList").addEventListener("click",e=>{
  const btn=e.target.closest("[data-modal-edit]"); if(!btn)return;
  $("closeDetails").click();
  const g=galleries.find(x=>x.id===btn.dataset.modalEdit); if(!g)return;
  const f=$("galleryForm"); $("editingId").value=g.id; f.elements.clientName.value=g.clientName||"";
  f.elements.galleryName.value=g.galleryName||""; f.elements.driveUrl.value=g.driveUrl||"";
  f.elements.selectionLimit.value=g.limit??20; f.elements.durationDays.value=String(g.durationDays||14);
  f.elements.galleryStatus.value=g.status==="submitted"?"active":(g.status||"active");
  $("formTitle").textContent="Edit Galeri Klien"; $("saveGalleryBtn").textContent="Simpan Perubahan";
  $("cancelEdit").hidden=false; location.hash="#create";
});
$("galleryTable").addEventListener("change", event => {
  const select=event.target.closest("[data-progress]"); if(!select)return;
  const g=galleries.find(x=>x.id===select.dataset.progress); if(!g)return;
  g.editingStatus=select.value; save();
  alert(`Status pengerjaan ${g.clientName} diperbarui menjadi: ${select.options[select.selectedIndex].text}`);
});
render();
