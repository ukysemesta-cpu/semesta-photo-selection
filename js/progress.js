const params=new URLSearchParams(location.search),id=params.get("id");
const galleries=JSON.parse(localStorage.getItem("semesta_photo_galleries_v2")||"[]");
const g=galleries.find(x=>x.id===id);
const result=document.getElementById("progressResult");
const back=document.getElementById("backToGallery");
if(!g){result.innerHTML='<div class="progress-empty">Galeri tidak ditemukan pada browser ini. Pastikan link yang digunakan benar.</div>';}
else{
 back.href=`gallery.html?id=${encodeURIComponent(g.id)}`;
 document.getElementById("progressIntro").textContent=`Halo ${g.clientName}, berikut status pengerjaan untuk ${g.galleryName}.`;
 const stages=[
  ["Belum mulai","Menunggu antrean pengerjaan foto"],
  ["Sedang editing","Foto sedang dipilih dan diproses oleh tim editor"],
  ["Selesai","File foto hasil editing sudah selesai dan siap diserahkan"],
  ["Selesai proses Cetak dan Album","Foto sudah selesai dicetak dan album sudah selesai disiapkan"]
 ];
 const current=g.editingStatus||"Belum mulai";
 const idx=stages.findIndex(x=>x[0]===current);
 const safeIdx=idx<0?0:idx;
 const isFinal=current==="Selesai" || current==="Selesai proses Cetak dan Album";

 result.innerHTML=`<div class="progress-status-card"><span class="pill ${isFinal?"pill-green":"pill-gray"}">${current==="Selesai"?"Selesai (Paket File Saja)":current}</span><h2>${current==="Selesai"?"File foto Anda sudah selesai!":current==="Selesai proses Cetak dan Album"?"Cetak dan album Anda sudah selesai!":current==="Sedang editing"?"Foto Anda sedang kami kerjakan":"Status pengerjaan foto"}</h2><p>${stages[safeIdx][1]}</p><div class="progress-steps">${stages.map((x,i)=>`<div class="progress-step ${i<=safeIdx?"done":""}"><span>${i+1}</span><div><b>${x[0]==="Selesai"?"Selesai (Paket File Saja)":x[0]}</b><small>${x[1]}</small></div></div>`).join("")}</div></div>`;
}