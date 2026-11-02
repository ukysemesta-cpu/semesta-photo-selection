const $ = (id) => document.getElementById(id);
const cfg = window.SEMESTA_SUPABASE_CONFIG;
if (!window.supabase || !cfg?.url || !cfg?.publishableKey) {
  alert("Konfigurasi Supabase belum tersedia. Pastikan js/supabase-config.js dimuat dengan benar.");
  throw new Error("Supabase config missing");
}
const sb = window.supabase.createClient(cfg.url, cfg.publishableKey);

// Fail visibly if the admin HTML and JavaScript are from different releases.
const requiredAdminIds = ["galleryForm", "galleryTable", "loginForm", "authGate", "loginButton", "logoutButton", "cancelEdit", "mobileMenu", "sidebar", "detailsModal", "closeDetails", "detailsList", "detailsTitle", "detailsDescription", "signedInEmail"];
const missingAdminIds = requiredAdminIds.filter(id => !document.getElementById(id));
if (missingAdminIds.length) {
  console.error("Admin HTML/JS version mismatch. Missing elements:", missingAdminIds);
  alert("Dashboard belum sinkron dengan file HTML. Muat ulang atau perbarui index.html.");
  throw new Error("Admin HTML/JS mismatch: " + missingAdminIds.join(", "));
}
let galleries = [];
let selectedPhotoCounts = {};
let currentUser = null;
let notificationRefreshTimer = null;
let adminNotifications = [];
let showArchivedGalleries = false;
let gallerySearchTerm = "";
let galleryStatusFilter = "all";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function prettyDate(value) {
  if (!value) return "—";
  const parts = String(value).slice(0,10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "—";
  return new Date(parts[0],parts[1]-1,parts[2]).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
}
function addDays(dateValue, days) {
  const d = new Date(dateValue); d.setDate(d.getDate()+Number(days));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysFromCreated(g) {
  if (!g.selection_deadline || !g.created_at) return 14;
  const diff = Math.round((new Date(g.selection_deadline+"T00:00:00") - new Date(g.created_at))/86400000);
  return [7,14,21,30].includes(diff) ? diff : 14;
}
function mapGallery(row) {
  return {
    id: row.id, token: row.client_token, clientName: row.client_name, galleryName: row.gallery_name,
    driveUrl: row.drive_folder_url || "", limit: String(row.selection_limit ?? 20),
    deadline: row.selection_deadline, durationDays: daysFromCreated(row), createdAt: row.created_at,
    status: row.selection_status === "submitted" ? "submitted" : row.gallery_status,
    galleryStatus: row.gallery_status, selectionStatus: row.selection_status,
    editingStatus: row.editing_status || "Belum mulai", packageType: row.package_type || "file_only",
    submittedAt: row.submitted_at, revisionAllowed: row.revision_allowed === true, isArchived: row.is_archived === true, archivedAt: row.archived_at || null
  };
}
function clientGalleryUrl(g) {
  return new URL(`gallery.html?token=${encodeURIComponent(g.token)}`, window.location.href).href;
}
function clientProgressUrl(g) {
  return new URL(`progress.html?token=${encodeURIComponent(g.token)}`, window.location.href).href;
}
function clientGalleryInviteMessage(g) {
  const name = String(g.clientName || "Kak").trim() || "Kak";
  const link = clientGalleryUrl(g);
  return `Hallo Kak ${name},

Silahkan pilih file yang mau kami editkan ya. Klik tombol pilih ❤️ dan berhenti saat sudah tidak bisa diklik lagi. Setelah itu, jangan lupa pencet tombol kirim yang akan langsung menuju WhatsApp kami.

Link Galeri:
${link}`;
}
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); alert("Teks berhasil disalin:\n"+value); }
  catch { window.prompt("Salin teks berikut:", value); }
}
async function copyGalleryInvite(g) {
  const message = clientGalleryInviteMessage(g);
  try {
    await navigator.clipboard.writeText(message);
    alert("Pesan instruksi dan link galeri berhasil disalin. Silakan kirimkan kepada klien melalui WhatsApp.");
  } catch {
    window.prompt("Salin pesan WhatsApp berikut:", message);
  }
}
function isSubmitted(g){return g.selectionStatus==="submitted";}
function isPending(g){return g.galleryStatus==="active"&&!isSubmitted(g);}
function render() {
  const activeGalleries = galleries.filter(g => !g.isArchived);
  $("totalGalleries").textContent=activeGalleries.length;
  $("pendingGalleries").textContent=activeGalleries.filter(isPending).length;
  $("submittedGalleries").textContent=activeGalleries.filter(isSubmitted).length;
  $("activeGalleries").textContent=activeGalleries.filter(g=>g.galleryStatus==="active").length;
  $("revisionGalleries").textContent=activeGalleries.filter(g=>g.revisionAllowed).length;
  $("totalSelectedPhotos").textContent=activeGalleries.reduce((sum,g)=>sum+(selectedPhotoCounts[g.id]||0),0);
  const term = gallerySearchTerm.trim().toLocaleLowerCase("id");
  const rows = galleries.filter(g => g.isArchived === showArchivedGalleries)
    .filter(g => !term || `${g.clientName} ${g.galleryName}`.toLocaleLowerCase("id").includes(term))
    .filter(g => galleryStatusFilter==="all" ||
      (galleryStatusFilter==="pending" && isPending(g)) ||
      (galleryStatusFilter==="submitted" && isSubmitted(g)) ||
      (galleryStatusFilter==="draft" && g.galleryStatus==="draft") ||
      (galleryStatusFilter==="revision" && g.revisionAllowed));
  $("galleryViewLabel").textContent = showArchivedGalleries ? `Arsip · ${rows.length} galeri` : `Galeri aktif · ${rows.length} galeri`;
  $("toggleArchived").textContent = showArchivedGalleries ? "Kembali ke Galeri Aktif" : "Lihat Arsip";
  const body=$("galleryTable");
  if(!rows.length){body.innerHTML='<tr><td colspan="6" class="empty-cell">'+(showArchivedGalleries?'Belum ada galeri yang diarsipkan.':'Tidak ada galeri yang cocok.')+'</td></tr>';return;}
  body.innerHTML=rows.map(g=>{
    const statusText=isSubmitted(g)?"Sudah Submit":g.galleryStatus==="active"?"Menunggu Seleksi":"Draft";
    return `<tr>
      <td><b>${escapeHtml(g.clientName)}</b></td>
      <td>${escapeHtml(g.galleryName)}</td>
      <td>${g.limit==="0"?"Tanpa batas":`${escapeHtml(g.limit)} foto`}</td>
      <td>${prettyDate(g.deadline)} <small>(${g.durationDays} hari)</small></td>
      <td><span class="pill ${isSubmitted(g)||g.galleryStatus==="active"?"pill-green":"pill-gray"}">${statusText}</span><br>
        <select class="mini-progress-select" data-progress="${g.id}" aria-label="Status pengerjaan">
          <option value="Belum mulai" ${g.editingStatus==="Belum mulai"?"selected":""}>Belum mulai</option>
          <option value="Sedang editing" ${g.editingStatus==="Sedang editing"?"selected":""}>Sedang editing</option>
          <option value="Selesai" ${g.editingStatus==="Selesai"?"selected":""}>Selesai (Paket File Saja)</option>
          <option value="Selesai proses Cetak dan Album" ${g.editingStatus==="Selesai proses Cetak dan Album"?"selected":""}>Selesai proses Cetak dan Album</option>
        </select>
      </td>
      <td class="actions-cell"><div class="actions-wrap">
        <a class="text-link" href="${escapeHtml(clientGalleryUrl(g))}" target="_blank" rel="noopener">Preview</a>
        <button class="mini-action" data-copy="${g.id}">Salin Link</button>
        <button class="mini-action" data-photos="${g.id}">Kelola Foto</button>
        <button class="mini-action" data-edit="${g.id}">Edit</button>
        ${g.isArchived
          ? `<button class="mini-action danger" data-purge="${g.id}">Hapus Permanen</button>`
          : `<button class="mini-action archive-action" data-archive="${g.id}">Arsipkan</button>`}
        ${g.isArchived ? `<button class="mini-action" data-archive="${g.id}">Pulihkan</button>` : ""}
        <button class="mini-action local-download" data-local-download="${g.id}">Download JPG/RAW</button>
        <button class="mini-action local-copy" data-local-copy="${g.id}">Salin ORI → EDIT</button>
      </div></td>
    </tr>`;
  }).join("");
}
async function loadGalleries(){
  $("galleryTable").innerHTML='<tr><td colspan="6" class="empty-cell">Memuat galeri dari Supabase...</td></tr>';
  const {data,error}=await sb.from("galleries").select("*").order("created_at",{ascending:false});
  if(error){console.error(error);alert("Gagal memuat galeri: "+error.message);return;}
  galleries=(data||[]).map(mapGallery);
  const {data: selections, error: selectionError}=await sb.from("photo_selections").select("gallery_id");
  if(selectionError){
    console.warn("Tidak dapat memuat hitungan foto terpilih:",selectionError.message);
    selectedPhotoCounts={};
  }else{
    selectedPhotoCounts={};
    (selections||[]).forEach(row=>{selectedPhotoCounts[row.gallery_id]=(selectedPhotoCounts[row.gallery_id]||0)+1;});
  }
  render();
}
$("gallerySearch").addEventListener("input", e => { gallerySearchTerm=e.target.value; render(); });
$("galleryStatusFilter").addEventListener("change", e => { galleryStatusFilter=e.target.value; render(); });
$("toggleArchived").addEventListener("click", () => { showArchivedGalleries=!showArchivedGalleries; galleryStatusFilter="all"; $("galleryStatusFilter").value="all"; render(); });

function resetForm(){
  $("galleryForm").reset();$("editingId").value="";$("formTitle").textContent="Buat Galeri Klien";
  $("saveGalleryBtn").textContent="Simpan Galeri";$("cancelEdit").hidden=true;
  $("galleryForm").elements.durationDays.value="14";$("galleryForm").elements.packageType.value="file_only";
}
$("galleryForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget),id=data.get("editingId");
  const clientName=String(data.get("clientName")).trim(),galleryName=String(data.get("galleryName")).trim();
  const driveUrl=String(data.get("driveUrl")||"").trim(),limit=Number(data.get("selectionLimit"));
  const durationDays=Number(data.get("durationDays")),galleryStatus=data.get("galleryStatus");
  const packageType=data.get("packageType")||"file_only";
  if(!Number.isInteger(limit)||limit<0){alert("Kuota harus berupa angka bulat 0 atau lebih.");return;}
  if(![7,14,21,30].includes(durationDays)){alert("Pilih batas waktu 7, 14, 21, atau 30 hari.");return;}
  const payload={
    client_name:clientName,gallery_name:galleryName,drive_folder_url:driveUrl||null,
    selection_limit:limit,selection_deadline:addDays(new Date(),durationDays),
    gallery_status:galleryStatus,package_type:packageType
  };
  $("saveGalleryBtn").disabled=true;
  try{
    let result;
    if(id) result=await sb.from("galleries").update(payload).eq("id",id).select().single();
    else result=await sb.from("galleries").insert(payload).select().single();
    if(result.error)throw result.error;
    await loadGalleries();resetForm();alert(id?"Perubahan galeri tersimpan di Supabase.":"Galeri berhasil dibuat di database online.");
    location.hash="#galleries";
  }catch(err){alert("Tidak dapat menyimpan galeri: "+err.message);}
  finally{$("saveGalleryBtn").disabled=false;}
});

async function setEditingStatus(g,status){
  const {error}=await sb.from("galleries").update({editing_status:status}).eq("id",g.id);
  if(error){alert("Gagal memperbarui status: "+error.message);return;}
  await sb.from("editing_progress").insert({gallery_id:g.id,status,created_by:currentUser.id});
  g.editingStatus=status;alert(`Status ${g.clientName} diperbarui menjadi ${status}.`);
}
let activePhotoGallery = null;

async function loadManagedPhotos(g) {
  const list = $("managedPhotoList");
  list.innerHTML = '<div class="details-empty">Memuat daftar foto...</div>';
  const { data, error } = await sb.from("photos")
    .select("id,filename,preview_url,sort_order,created_at,is_highlight")
    .eq("gallery_id", g.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    list.innerHTML = `<div class="details-empty">Gagal membaca foto: ${escapeHtml(error.message)}</div>`;
    return;
  }
  if (!data?.length) {
    list.innerHTML = '<div class="details-empty">Belum ada foto tersinkron. Pastikan link folder Google Drive sudah diisi, lalu klik Sinkronkan.</div>';
    return;
  }
  const highlighted = data.filter(p => p.is_highlight).length;
  list.innerHTML = `
    <div class="highlight-admin-summary">
      <b>★ ${highlighted} foto Highlight</b>
      <small>Pilih foto rekomendasi yang ingin ditampilkan pada filter Highlight di galeri klien.</small>
    </div>
    ${data.map((p, i) => `
    <div class="photo-item">
      <img src="${escapeHtml(p.preview_url || "")}" alt="${escapeHtml(p.filename)}" loading="lazy" style="width:76px;height:76px;object-fit:cover;border-radius:8px;background:#eef2f7" onerror="this.style.display='none'">
      <div class="photo-item-info"><b>${i + 1}. ${escapeHtml(p.filename)}</b><small>${p.is_highlight ? "★ Direkomendasikan untuk klien" : "Preview dari Google Drive"}</small></div>
      <button type="button" class="btn ${p.is_highlight ? "btn-primary" : "btn-secondary"} highlight-toggle" data-highlight-photo="${p.id}" data-highlight-state="${p.is_highlight ? "1" : "0"}" aria-pressed="${p.is_highlight ? "true" : "false"}">${p.is_highlight ? "★ Highlight" : "☆ Jadikan Highlight"}</button>
    </div>`).join("")}`;
}

async function togglePhotoHighlight(photoId, currentlyHighlighted) {
  if (!activePhotoGallery) return;
  const buttons = [...$("managedPhotoList").querySelectorAll("[data-highlight-photo]")];
  buttons.forEach(button => button.disabled = true);
  try {
    const { data, error } = await sb.from("photos")
      .update({ is_highlight: !currentlyHighlighted })
      .eq("id", photoId)
      .eq("gallery_id", activePhotoGallery.id)
      .select("id,is_highlight")
      .single();
    if (error) throw error;
    if (!data) throw new Error("Perubahan tidak tersimpan. Periksa hak akses admin pada tabel photos.");
    $("photoUploadStatus").textContent = data.is_highlight
      ? "Foto berhasil ditandai sebagai Highlight."
      : "Tanda Highlight berhasil dihapus.";
    await loadManagedPhotos(activePhotoGallery);
  } catch (err) {
    console.error("Update photo highlight failed:", err);
    $("photoUploadStatus").textContent = "Gagal mengubah Highlight.";
    alert("Tidak dapat mengubah Highlight: " + (err.message || "Periksa izin akses tabel photos."));
  } finally {
    buttons.forEach(button => button.disabled = false);
  }
}


async function loadAdminSelectionDraft() {
  const list = $("adminDraftList");
  const meta = $("adminDraftMeta");
  const button = $("refreshAdminDraft");
  if (!activePhotoGallery) return;
  button.disabled = true;
  meta.textContent = "Memuat pilihan sementara klien...";
  list.innerHTML = '<div class="details-empty">Mengambil draft dari Supabase...</div>';
  try {
    const { data, error } = await sb.rpc("get_photo_selection_draft", {
      p_token: activePhotoGallery.token
    });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || "Draft tidak dapat dibaca.");
    const revisionStatus = $("adminRevisionStatus");
    if (activePhotoGallery.selectionStatus === "submitted" && !data.revision_allowed) {
      meta.textContent = "Galeri sudah dikirim. Lihat hasil final pada Rekap Pilihan.";
      list.innerHTML = '<div class="admin-draft-empty">Pilihan final sudah dikirim dan terkunci. Admin dapat membuka akses revisi jika diperlukan.</div>';
      if (revisionStatus) revisionStatus.textContent = "Akses revisi terkunci.";
      $("openClientRevision").disabled = false;
      return;
    }
    if (data.revision_allowed) {
      if (revisionStatus) revisionStatus.textContent = "Akses revisi sedang terbuka untuk klien.";
      $("openClientRevision").disabled = true;
    } else {
      if (revisionStatus) revisionStatus.textContent = "Klien dapat menyimpan draft sebelum submit.";
      $("openClientRevision").disabled = activePhotoGallery.selectionStatus !== "submitted";
    }
    const ids = Array.isArray(data.photo_ids) ? data.photo_ids : [];
    meta.textContent = `${ids.length} foto sementara · diperbarui dari Supabase`;
    if (!ids.length) {
      list.innerHTML = '<div class="admin-draft-empty">Klien belum menyimpan pilihan sementara.</div>';
      return;
    }
    const { data: photos, error: photoError } = await sb.from("photos")
      .select("id,filename,preview_url,sort_order")
      .eq("gallery_id", activePhotoGallery.id)
      .in("id", ids)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (photoError) throw photoError;
    list.innerHTML = (photos || []).map((photo, index) => `
      <article class="admin-draft-item">
        <img src="${escapeHtml(photo.preview_url || "")}" alt="${escapeHtml(photo.filename)}" loading="lazy" onerror="this.style.display='none'">
        <div><b>${index + 1}. ${escapeHtml(photo.filename)}</b><small>Draft pilihan klien · belum dikirim final</small></div>
      </article>`).join("") || '<div class="admin-draft-empty">Foto draft tidak ditemukan. Mungkin foto sudah tidak aktif.</div>';
  } catch (err) {
    console.error("Load admin selection draft failed:", err);
    meta.textContent = "Gagal memuat draft.";
    list.innerHTML = `<div class="admin-draft-empty">Tidak dapat membaca draft: ${escapeHtml(err.message || "Kesalahan tidak diketahui")}</div>`;
  } finally {
    button.disabled = false;
  }
}


async function openClientRevision() {
  if (!activePhotoGallery) return;
  const button = $("openClientRevision");
  if (!confirm(`Buka akses revisi untuk ${activePhotoGallery.clientName}? Klien dapat mengubah pilihan satu kali. Setelah dikirim, galeri terkunci kembali.`)) return;
  button.disabled = true;
  try {
    const { data, error } = await sb.rpc("open_gallery_revision", { p_gallery_id: activePhotoGallery.id });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || "Akses revisi tidak dapat dibuka.");
    activePhotoGallery.selectionStatus = "submitted";
    $("adminRevisionStatus").textContent = "Akses revisi sudah dibuka. Menunggu klien mengirim revisi.";
    $("photoUploadStatus").textContent = "Akses revisi klien berhasil dibuka.";
    await loadAdminSelectionDraft();
    alert("Akses revisi berhasil dibuka. Klien dapat membuka tautan galeri yang sama.");
  } catch (err) {
    console.error("Open client revision failed:", err);
    alert("Gagal membuka revisi: " + (err.message || "Kesalahan tidak diketahui"));
  } finally {
    button.disabled = false;
  }
}

async function managePhotos(g) {
  activePhotoGallery = g;
  if (!$("photoManagerModal") || !$("managedPhotoList") || !$("syncDriveButton")) {
    alert("Komponen Kelola Foto belum tersedia pada halaman admin.");
    return;
  }
  $("photoManagerTitle").textContent = `Kelola Foto — ${g.galleryName}`;
  $("photoManagerDescription").textContent = `Klien: ${g.clientName}. Foto asli tetap berada di Google Drive.`;
  $("photoUploadStatus").textContent = "Membaca folder Google Drive...";
  $("syncDriveButton").disabled = false;
  $("photoManagerModal").classList.add("open");
  $("photoManagerModal").setAttribute("aria-hidden", "false");
  await syncDrivePhotos(g, true);
  await loadAdminSelectionDraft();
}

async function syncDrivePhotos(g, quiet = false) {
  const button = $("syncDriveButton");
  const status = $("photoUploadStatus");
  if (!g?.driveUrl) {
    status.textContent = "Link folder Google Drive belum diisi.";
    await loadManagedPhotos(g);
    if (!quiet) alert("Edit data galeri terlebih dahulu, lalu isi link folder Google Drive.");
    return;
  }
  button.disabled = true;
  status.textContent = "Menghubungkan ke Google Drive...";
  try {
    const { data, error } = await sb.functions.invoke("sync-drive-photos", { body: { gallery_id: g.id } });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || "Sinkronisasi gagal.");
    status.textContent = data.message;
    await loadManagedPhotos(g);
    if (!quiet) alert(`${data.message}\nTotal foto di folder: ${data.found}.`);
  } catch (err) {
    console.error("Google Drive sync error:", err);
    status.textContent = "Sinkronisasi gagal.";
    await loadManagedPhotos(g);
    alert("Gagal menyinkronkan Google Drive: " + (err.message || "Periksa konfigurasi Edge Function."));
  } finally {
    button.disabled = false;
  }
}

$("closePhotoManager")?.addEventListener("click", () => {
  $("photoManagerModal").classList.remove("open");
  $("photoManagerModal").setAttribute("aria-hidden", "true");
  activePhotoGallery = null;
});
$("photoManagerModal")?.addEventListener("click", e => {
  if (e.target === $("photoManagerModal")) $("closePhotoManager").click();
});
$("syncDriveButton")?.addEventListener("click", () => {
  if (activePhotoGallery) syncDrivePhotos(activePhotoGallery, false);
});
$("refreshAdminDraft")?.addEventListener("click", loadAdminSelectionDraft);
$("openClientRevision")?.addEventListener("click", openClientRevision);

$("managedPhotoList")?.addEventListener("click", event => {
  const button = event.target.closest("[data-highlight-photo]");
  if (!button || !activePhotoGallery) return;
  togglePhotoHighlight(button.dataset.highlightPhoto, button.dataset.highlightState === "1");
});

async function getSelections(g){
  const {data,error}=await sb.from("photo_selections").select("photo_id,photos(filename)").eq("gallery_id",g.id);
  if(error){alert("Gagal mengambil rekap pilihan: "+error.message);return [];}
  return (data||[]).map(x=>x.photos?.filename||x.photo_id);
}
function safeName(s){return String(s||"galeri").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
function downloadBlob(content,name,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportRecap(g){
  const names=await getSelections(g);
  const out={client:g.clientName,gallery:g.galleryName,deadline:g.deadline,selectionLimit:g.limit,selectedPhotoFilenames:names,submitted:isSubmitted(g),notice:"Rekap dibaca langsung dari Supabase."};
  downloadBlob(JSON.stringify(out,null,2),`${safeName(g.galleryName)}-rekap.json`,"application/json");
}

// Local folder helpers retained; online selected filenames are read from Supabase.
const RAW_EXTENSIONS=new Set(["cr2","cr3","nef","arw","raf","dng","orf","rw2","pef","srw"]);
function filenameBase(filename){return String(filename).replace(/\.[^.]+$/,"").toLowerCase();}
function fileExtension(filename){return String(filename).match(/\.([^.]+)$/)?.[1].toLowerCase()||"";}
async function chosenNames(g){
  const names=await getSelections(g);return names;
}
async function choosePhotoFormat(){const v=prompt("Pilih format:\n1 = JPG/JPEG\n2 = RAW\n3 = JPG + RAW","1");return v==="1"?"jpg":v==="2"?"raw":v==="3"?"both":null;}
async function downloadChosenFromComputer(g){
  const chosen=await chosenNames(g);if(!chosen.length){alert("Belum ada pilihan foto yang tersimpan.");return;}
  const format=await choosePhotoFormat();if(!format)return;
  if(!window.showDirectoryPicker){alert("Gunakan Chrome/Edge terbaru melalui localhost atau HTTPS.");return;}
  try{
    const dir=await window.showDirectoryPicker({mode:"read"}),wanted=new Set(chosen.map(filenameBase));let count=0;
    for await(const entry of dir.values()){
      if(entry.kind!=="file")continue;const ext=fileExtension(entry.name),jpg=["jpg","jpeg"].includes(ext),raw=RAW_EXTENSIONS.has(ext);
      if(!wanted.has(filenameBase(entry.name))||(format==="jpg"&&!jpg)||(format==="raw"&&!raw)||(format==="both"&&!jpg&&!raw))continue;
      const file=await entry.getFile(),url=URL.createObjectURL(file),a=document.createElement("a");a.href=url;a.download=entry.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2500);count++;
    }
    alert(count?`${count} file sedang diunduh.`:"Tidak ada file yang cocok di folder pilihan.");
  }catch(e){if(e.name!=="AbortError")alert(e.message);}
}
async function copyChosenOriToEdit(g){
  const chosen=await chosenNames(g);if(!chosen.length){alert("Belum ada pilihan foto.");return;}
  if(!window.showDirectoryPicker){alert("Gunakan Chrome/Edge terbaru melalui localhost atau HTTPS.");return;}
  try{
    const parent=await window.showDirectoryPicker({mode:"readwrite"}),ori=await parent.getDirectoryHandle("ORI"),edit=await parent.getDirectoryHandle("EDIT",{create:true});
    const wanted=new Set(chosen.map(filenameBase));let count=0;
    for await(const entry of ori.values()){
      if(entry.kind!=="file"||!wanted.has(filenameBase(entry.name)))continue;
      const file=await entry.getFile(),target=await edit.getFileHandle(entry.name,{create:true}),w=await target.createWritable();await w.write(file);await w.close();count++;
    }
    alert(`${count} file berhasil disalin ke EDIT.`);
  }catch(e){if(e.name!=="AbortError")alert("Gagal menyalin: "+e.message);}
}

$("galleryTable").addEventListener("click",async event=>{
  const t=event.target;
  if(t.closest("[data-copy]")){const g=galleries.find(x=>x.id===t.closest("[data-copy]").dataset.copy);if(g)copyGalleryInvite(g);return;}
  if(t.closest("[data-photos]")){const g=galleries.find(x=>x.id===t.closest("[data-photos]").dataset.photos);if(g)managePhotos(g);return;}
  if(t.closest("[data-archive]")){
    const g=galleries.find(x=>x.id===t.closest("[data-archive]").dataset.archive);if(!g)return;
    const next=!g.isArchived;
    const verb=next?"mengarsipkan":"memulihkan";
    if(!confirm(`Yakin ${verb} galeri ${g.galleryName} milik ${g.clientName}? Data, foto, dan riwayat pilihan tidak dihapus.`))return;
    const {error}=await sb.from("galleries").update({
      is_archived: next,
      archived_at: next ? new Date().toISOString() : null
    }).eq("id",g.id);
    if(error){alert("Gagal mengubah arsip: "+error.message+"\\nPastikan SQL manajemen galeri sudah dijalankan.");return;}
    g.isArchived=next;render();alert(next?"Galeri berhasil diarsipkan.":"Galeri berhasil dipulihkan.");return;
  }
  if(t.closest("[data-edit]")){const g=galleries.find(x=>x.id===t.closest("[data-edit]").dataset.edit);if(!g)return;
    const f=$("galleryForm");$("editingId").value=g.id;f.elements.clientName.value=g.clientName;f.elements.galleryName.value=g.galleryName;
    f.elements.driveUrl.value=g.driveUrl;f.elements.selectionLimit.value=g.limit;f.elements.durationDays.value=String(g.durationDays);
    f.elements.galleryStatus.value=g.galleryStatus;f.elements.packageType.value=g.packageType;
    $("formTitle").textContent="Edit Galeri Klien";$("saveGalleryBtn").textContent="Simpan Perubahan";$("cancelEdit").hidden=false;location.hash="#create";return;}
  if(t.closest("[data-purge]")){
    const g=galleries.find(x=>x.id===t.closest("[data-purge]").dataset.purge);if(!g)return;
    if(!g.isArchived){
      alert("Arsipkan galeri terlebih dahulu sebelum menghapus permanen.");return;
    }
    const phrase = `HAPUS ${g.clientName}`;
    const typed = prompt(`PERINGATAN: Penghapusan permanen tidak dapat dibatalkan.\n\nPreview di Supabase Storage juga akan dibersihkan. Foto asli Google Drive tetap aman.\n\nGaleri: ${g.galleryName}\nKlien: ${g.clientName}\n\nFoto asli di Google Drive tidak dihapus. Data galeri, draft, pilihan, dan riwayat terkait akan dihapus dari database.\n\nKetik persis: ${phrase}`);
    if(typed !== phrase){ if(typed !== null) alert("Konfirmasi tidak cocok. Galeri tidak dihapus."); return; }
    const button=t.closest("[data-purge]");button.disabled=true;
    try{
      const {data,error}=await sb.functions.invoke("permanently-delete-gallery",{body:{gallery_id:g.id}});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.message || "Penghapusan tidak berhasil.");
      await loadGalleries();
      alert("Galeri, data database terkait, dan file preview Supabase Storage berhasil dibersihkan. Foto asli Google Drive tetap aman.");
    }catch(err){
      alert("Gagal menghapus permanen: "+(err.message||"Kesalahan tidak diketahui"));
      button.disabled=false;
    }
    return;
  }
  if(t.closest("[data-local-download]")){const g=galleries.find(x=>x.id===t.closest("[data-local-download]").dataset.localDownload);if(g)downloadChosenFromComputer(g);return;}
  if(t.closest("[data-local-copy]")){const g=galleries.find(x=>x.id===t.closest("[data-local-copy]").dataset.localCopy);if(g)copyChosenOriToEdit(g);return;}
});
$("galleryTable").addEventListener("change",async e=>{
  const select=e.target.closest("[data-progress]");if(!select)return;
  const g=galleries.find(x=>x.id===select.dataset.progress);if(g)await setEditingStatus(g,select.value);
});
$("cancelEdit").addEventListener("click",resetForm);
$("mobileMenu").addEventListener("click",()=>$("sidebar").classList.toggle("show"));
document.querySelectorAll(".nav-link").forEach(link=>link.addEventListener("click",()=>$("sidebar").classList.remove("show")));
function openDetails(filter){
  const rows=galleries.filter(g=>filter==="all"||(filter==="pending"?isPending(g):filter==="submitted"?isSubmitted(g):filter==="active"?g.galleryStatus==="active":filter==="revision"?g.revisionAllowed:filter==="selected"?(selectedPhotoCounts[g.id]||0)>0:false));
  $("detailsTitle").textContent=({all:"Semua Galeri",pending:"Menunggu Seleksi",submitted:"Sudah Submit",active:"Galeri Aktif",revision:"Akses Revisi Terbuka",selected:"Galeri dengan Foto Terpilih"})[filter]||"Galeri";
  $("detailsDescription").textContent=filter==="selected"?`${rows.length} galeri · ${rows.reduce((sum,g)=>sum+(selectedPhotoCounts[g.id]||0),0)} foto final dipilih.`:`${rows.length} galeri ditemukan.`;
  $("detailsList").innerHTML=rows.map(g=>`<div class="detail-item"><div class="detail-item-main"><b>${escapeHtml(g.clientName)} — ${escapeHtml(g.galleryName)}</b><small>${isSubmitted(g)?"Sudah submit":g.galleryStatus==="active"?"Menunggu seleksi":"Draft"} · ${(selectedPhotoCounts[g.id]||0)} foto dipilih${g.revisionAllowed?" · Akses revisi terbuka":""}</small></div><div class="detail-item-actions"><a class="mini-action" href="${escapeHtml(clientGalleryUrl(g))}" target="_blank">Preview</a></div></div>`).join("")||'<div class="details-empty">Belum ada galeri.</div>';
  $("detailsModal").classList.add("open");$("detailsModal").setAttribute("aria-hidden","false");
}
document.querySelectorAll("[data-stat]").forEach(card=>card.addEventListener("click",()=>openDetails(card.dataset.stat)));
$("closeDetails").addEventListener("click",()=>{$("detailsModal").classList.remove("open");$("detailsModal").setAttribute("aria-hidden","true")});
$("detailsModal").addEventListener("click",e=>{if(e.target===$("detailsModal"))$("closeDetails").click()});

function showLoginError(message) {
  $("loginError").textContent = message;
  $("authGate").classList.add("show");
  $("loginButton").disabled = false;
}

async function verifyAdminProfile() {
  const { data, error } = await sb.rpc("get_my_admin_profile");
  if (error) {
    console.error("Admin profile RPC error:", error);
    throw new Error(
      `Tidak dapat memeriksa profil admin (${error.code || "RPC"}): ${error.message}. ` +
      "Pastikan SUPABASE_V10_1_ADMIN_LOGIN_FIX.sql sudah dijalankan."
    );
  }
  if (!data || !["admin", "editor"].includes(data.role)) {
    return null;
  }
  return data;
}

async function acceptSession(session) {
  currentUser = session.user;
  $("loginError").textContent = "";
  try {
    const profile = await verifyAdminProfile();
    if (!profile) {
      await sb.auth.signOut();
      showLoginError("Akun berhasil login, tetapi profil admin tidak ditemukan atau role bukan admin/editor. Periksa tabel admin_profiles.");
      return false;
    }
    $("signedInEmail").textContent = profile.display_name || currentUser.email;
    $("authGate").classList.remove("show");
    await loadGalleries();
    return true;
  } catch (err) {
    console.error("Admin verification failed:", err);
    showLoginError(err.message || "Pemeriksaan admin gagal. Periksa koneksi Supabase.");
    return false;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  $("loginButton").disabled = true;
  $("loginError").textContent = "";
  const { data, error } = await sb.auth.signInWithPassword({
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value
  });
  if (error) {
    showLoginError(`Login gagal: ${error.message}`);
    return;
  }
  const accepted = await acceptSession(data.session);
  if (!accepted) $("loginButton").disabled = false;
}

async function startApp() {
  // Attach the handler before checking an existing session, so the form still
  // works if an old/stale session is rejected.
  $("loginForm").addEventListener("submit", handleLogin);
  $("authGate").classList.add("show");

  const { data, error } = await sb.auth.getSession();
  if (error) {
    showLoginError(`Gagal membaca sesi login: ${error.message}`);
    return;
  }
  if (data.session) {
    await acceptSession(data.session);
  }
}

$("logoutButton").addEventListener("click", async () => {
  const { error } = await sb.auth.signOut();
  if (error) {
    alert("Gagal logout: " + error.message);
    return;
  }
  if (notificationRefreshTimer) clearInterval(notificationRefreshTimer);
  notificationRefreshTimer = null;
  location.reload();
});

sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    if (notificationRefreshTimer) clearInterval(notificationRefreshTimer);
    notificationRefreshTimer = null;
    currentUser = null;
    adminNotifications = [];
    $("authGate").classList.add("show");
  }
});

startApp();
