const $ = (id) => document.getElementById(id);
const cfg = window.SEMESTA_SUPABASE_CONFIG;
if (!window.supabase || !cfg?.url || !cfg?.publishableKey) {
  alert("Konfigurasi Supabase belum tersedia. Pastikan js/supabase-config.js dimuat dengan benar.");
  throw new Error("Supabase config missing");
}
const sb = window.supabase.createClient(cfg.url, cfg.publishableKey);
let galleries = [];
let currentUser = null;

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
    submittedAt: row.submitted_at
  };
}
function clientGalleryUrl(g) {
  return new URL(`gallery.html?token=${encodeURIComponent(g.token)}`, window.location.href).href;
}
function clientProgressUrl(g) {
  return new URL(`progress.html?token=${encodeURIComponent(g.token)}`, window.location.href).href;
}
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); alert("Link berhasil disalin:\n"+value); }
  catch { window.prompt("Salin link berikut:", value); }
}
function isSubmitted(g){return g.selectionStatus==="submitted";}
function isPending(g){return g.galleryStatus==="active"&&!isSubmitted(g);}
function render() {
  $("totalGalleries").textContent=galleries.length;
  $("pendingGalleries").textContent=galleries.filter(isPending).length;
  $("submittedGalleries").textContent=galleries.filter(isSubmitted).length;
  const body=$("galleryTable");
  if(!galleries.length){body.innerHTML='<tr><td colspan="6" class="empty-cell">Belum ada galeri. Buat galeri pertama Anda di bawah.</td></tr>';return;}
  body.innerHTML=galleries.map(g=>{
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
        <button class="mini-action" data-progress-link="${g.id}">Link Progress</button>
        <button class="mini-action" data-edit="${g.id}">Edit</button>
        <button class="mini-action danger" data-delete="${g.id}">Hapus</button>
        <button class="mini-action" data-export="${g.id}">Rekap</button>
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
  galleries=(data||[]).map(mapGallery);render();
}
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
async function managePhotos(g){
  const {data,error}=await sb.from("photos").select("id,filename,preview_url,download_url,sort_order").eq("gallery_id",g.id).order("sort_order");
  if(error){alert("Gagal membaca foto: "+error.message);return;}
  const current=(data||[]).map(p=>`${p.filename}|${p.preview_url||""}|${p.download_url||""}`).join("\n");
  const instruction=`Galeri: ${g.galleryName}\nMasukkan satu foto per baris dengan format:\nNAMA_FILE|URL_PREVIEW|URL_DOWNLOAD\n\nContoh:\nDSCF1200.JPG|https://...jpg|https://...jpg\n\nKosongkan untuk membatalkan. Baris yang disimpan akan menggantikan daftar foto galeri ini. Gunakan URL gambar langsung yang bisa diakses browser.\n\nDaftar saat ini:\n${current}`;
  const input=prompt(instruction,current);
  if(input===null)return;
  const lines=input.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const rows=[];
  for(const [i,line] of lines.entries()){
    const parts=line.split("|").map(x=>x.trim());
    if(parts.length<2||!parts[0]||!/^https?:\/\//i.test(parts[1])){
      alert(`Format baris ${i+1} tidak valid. Gunakan NAMA_FILE|URL_PREVIEW|URL_DOWNLOAD dan URL preview harus berupa http/https.`);return;
    }
    rows.push({gallery_id:g.id,filename:parts[0],preview_url:parts[1],download_url:parts[2]&&/^https?:\/\//i.test(parts[2])?parts[2]:parts[1],sort_order:i});
  }
  const del=await sb.from("photos").delete().eq("gallery_id",g.id);
  if(del.error){alert("Gagal mengganti daftar foto: "+del.error.message);return;}
  if(rows.length){
    const ins=await sb.from("photos").insert(rows);
    if(ins.error){alert("Foto gagal disimpan: "+ins.error.message);return;}
  }
  alert(`${rows.length} foto tersimpan untuk galeri ${g.galleryName}.`);
}
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
  if(t.closest("[data-copy]")){const g=galleries.find(x=>x.id===t.closest("[data-copy]").dataset.copy);if(g)copyText(clientGalleryUrl(g));return;}
  if(t.closest("[data-progress-link]")){const g=galleries.find(x=>x.id===t.closest("[data-progress-link]").dataset.progressLink);if(g)copyText(clientProgressUrl(g));return;}
  if(t.closest("[data-photos]")){const g=galleries.find(x=>x.id===t.closest("[data-photos]").dataset.photos);if(g)managePhotos(g);return;}
  if(t.closest("[data-edit]")){const g=galleries.find(x=>x.id===t.closest("[data-edit]").dataset.edit);if(!g)return;
    const f=$("galleryForm");$("editingId").value=g.id;f.elements.clientName.value=g.clientName;f.elements.galleryName.value=g.galleryName;
    f.elements.driveUrl.value=g.driveUrl;f.elements.selectionLimit.value=g.limit;f.elements.durationDays.value=String(g.durationDays);
    f.elements.galleryStatus.value=g.galleryStatus;f.elements.packageType.value=g.packageType;
    $("formTitle").textContent="Edit Galeri Klien";$("saveGalleryBtn").textContent="Simpan Perubahan";$("cancelEdit").hidden=false;location.hash="#create";return;}
  if(t.closest("[data-delete]")){const g=galleries.find(x=>x.id===t.closest("[data-delete]").dataset.delete);if(!g)return;
    if(confirm(`Hapus galeri ${g.galleryName} milik ${g.clientName}?`)){
      const {error}=await sb.from("galleries").delete().eq("id",g.id);
      if(error)alert("Gagal menghapus: "+error.message);else{await loadGalleries();alert("Galeri dihapus dari database.");}
    }return;}
  if(t.closest("[data-export]")){const g=galleries.find(x=>x.id===t.closest("[data-export]").dataset.export);if(g)exportRecap(g);return;}
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
  const rows=galleries.filter(g=>filter==="all"||(filter==="pending"?isPending(g):isSubmitted(g)));
  $("detailsTitle").textContent=filter==="all"?"Semua Galeri":filter==="pending"?"Menunggu Seleksi":"Sudah Submit";
  $("detailsDescription").textContent=`${rows.length} galeri ditemukan.`;
  $("detailsList").innerHTML=rows.map(g=>`<div class="detail-item"><div class="detail-item-main"><b>${escapeHtml(g.clientName)} — ${escapeHtml(g.galleryName)}</b><small>${isSubmitted(g)?"Sudah submit":g.galleryStatus==="active"?"Menunggu seleksi":"Draft"}</small></div><div class="detail-item-actions"><a class="mini-action" href="${escapeHtml(clientGalleryUrl(g))}" target="_blank">Preview</a></div></div>`).join("")||'<div class="details-empty">Belum ada galeri.</div>';
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
  location.reload();
});

sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    $("authGate").classList.add("show");
  }
});

startApp();
