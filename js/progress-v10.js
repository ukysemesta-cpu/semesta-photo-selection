const cfg=window.SEMESTA_SUPABASE_CONFIG,sb=window.supabase.createClient(cfg.url,cfg.publishableKey);
const params=new URLSearchParams(location.search),token=params.get("token");
const result=document.getElementById("progressResult"),back=document.getElementById("backToGallery");
if(!token){result.textContent="Link progress tidak lengkap. Hubungi admin Semesta.";}
else{
 back.href=`gallery.html?token=${encodeURIComponent(token)}`;
 load();
}
async function load(){
 result.innerHTML='<p class="muted">Memuat progress...</p>';
 const {data,error}=await sb.rpc("get_client_progress",{p_token:token});
 if(error){result.textContent="Gagal memuat progress: "+error.message;return;}
 if(!data?.ok){result.textContent=data?.message||"Progress tidak ditemukan.";return;}
 document.getElementById("progressIntro").textContent=`Halo ${data.client_name}, berikut status pengerjaan ${data.gallery_name}.`;
 const stages=[
  ["Belum mulai","Menunggu antrean pengerjaan foto"],
  ["Sedang editing","Foto sedang diproses oleh tim editor"],
  ["Selesai","File foto hasil editing sudah selesai dan siap diserahkan"],
  ["Selesai proses Cetak dan Album","Foto sudah selesai dicetak dan album disiapkan"]
 ];
 const current=data.editing_status||"Belum mulai",idx=Math.max(0,stages.findIndex(x=>x[0]===current));
 const final=current==="Selesai"||current==="Selesai proses Cetak dan Album";
 result.innerHTML=`<div class="progress-status-card"><span class="pill ${final?"pill-green":"pill-gray"}">${current==="Selesai"?"Selesai (Paket File Saja)":current}</span><h2>${current==="Selesai"?"File foto Anda sudah selesai!":current==="Selesai proses Cetak dan Album"?"Cetak dan album Anda sudah selesai!":current==="Sedang editing"?"Foto Anda sedang kami kerjakan":"Status pengerjaan foto"}</h2><p>${stages[idx][1]}</p><div class="progress-steps">${stages.map((x,i)=>`<div class="progress-step ${i<=idx?"done":""}"><span>${i+1}</span><div><b>${x[0]==="Selesai"?"Selesai (Paket File Saja)":x[0]}</b><small>${x[1]}</small></div></div>`).join("")}</div></div>`;
}
