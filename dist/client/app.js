'use strict';
const gallery=document.getElementById('gallery');
const dialog=document.getElementById('lightbox');
const labels={landscape:'LANDSCAPE',architecture:'ARCHITECTURE',street:'STREET'};
const chineseLabels={landscape:'自然風景',architecture:'建築線條',street:'城市片刻'};
let photos=[],visiblePhotos=[],currentIndex=0,lastFocused=null,isDemo=true;
const byId=id=>document.getElementById(id);
function imageFailed(){byId('image-error').hidden=false;}
function renderGallery(filter='all'){
 visiblePhotos=filter==='all'?photos:photos.filter(p=>p.category===filter);
 gallery.replaceChildren();
 for(const photo of visiblePhotos){
  const button=document.createElement('button');button.type='button';button.className='photo';button.setAttribute('aria-label',`放大檢視：${photo.title}，${chineseLabels[photo.category]}${isDemo?'，示意照片':''}`);
  const frame=document.createElement('div');frame.className='photo-image';
  const img=document.createElement('img');img.src=photo.thumbnail;const thumbWidth=isDemo?800:Math.round(photo.width*Math.min(1,800/Math.max(photo.width,photo.height)));const largeWidth=isDemo?1400:Math.round(photo.width*Math.min(1,1800/Math.max(photo.width,photo.height)));img.srcset=`${photo.thumbnail} ${thumbWidth}w, ${photo.large} ${largeWidth}w`;img.sizes='(max-width: 600px) 86vw, 40vw';img.alt=`${photo.title} — ${photo.author||'Adrian Yeh'}${isDemo?' 攝影示意作品':''}`;img.loading='lazy';img.decoding='async';img.width=photo.width;img.height=photo.height;img.addEventListener('error',imageFailed);frame.append(img);
  const expand=document.createElement('span');expand.className='photo-hover';expand.setAttribute('aria-hidden','true');expand.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';frame.append(expand);button.append(frame);
  const caption=document.createElement('div');caption.className='photo-caption';
  for(const [cls,txt] of [['photo-number',String(photos.indexOf(photo)+1).padStart(2,'0')],['photo-title',photo.title],['photo-type',labels[photo.category]]]){const span=document.createElement('span');span.className=cls;span.textContent=txt;caption.append(span);}button.append(caption);
  button.addEventListener('click',()=>openPhoto(visiblePhotos.findIndex(p=>p.id===photo.id),button));gallery.append(button);
 }
 document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function displayPhoto(){
 const p=visiblePhotos[currentIndex];if(!p)return;
 byId('lightbox-image').src=p.src;byId('lightbox-image').alt=`${p.title} — ${p.author||'Adrian Yeh'}`;
 byId('lightbox-position').textContent=`${String(currentIndex+1).padStart(2,'0')} / ${String(visiblePhotos.length).padStart(2,'0')}`;
 byId('lightbox-title').textContent=p.title;byId('lightbox-category').textContent=[labels[p.category],p.location,p.takenAt].filter(Boolean).join(' · ');byId('lightbox-description').textContent=p.description||'';byId('lightbox-description').hidden=!p.description;
 const source=byId('lightbox-source');source.parentElement.firstChild.textContent=isDemo?'示意影像 · ':'PHOTOGRAPH BY ';source.textContent=isDemo?p.author+' / Unsplash':'Adrian Yeh';if(isDemo)source.href=p.source;else source.removeAttribute('href');
}
function openPhoto(index,trigger){currentIndex=index;lastFocused=trigger;displayPhoto();dialog.showModal();document.body.classList.add('modal-open');byId('close-lightbox').focus();}
function step(delta){currentIndex=(currentIndex+delta+visiblePhotos.length)%visiblePhotos.length;displayPhoto();}
function closePhoto(){dialog.close();}
byId('close-lightbox').addEventListener('click',closePhoto);
byId('previous').addEventListener('click',()=>step(-1));byId('next').addEventListener('click',()=>step(1));
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');if(document.fullscreenElement===dialog)document.exitFullscreen().catch(()=>{});lastFocused?.focus();});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});
let touchStart=null;byId('lightbox-image').addEventListener('touchstart',e=>{if(e.touches.length===1)touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};else touchStart=null;},{passive:true});
byId('lightbox-image').addEventListener('touchend',e=>{if(!touchStart||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);touchStart=null;},{passive:true});
byId('fullscreen').hidden=!document.fullscreenEnabled;byId('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await dialog.requestFullscreen();}catch{byId('fullscreen').hidden=true;}});
byId('lightbox-image').addEventListener('error',imageFailed);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>renderGallery(b.dataset.filter)));
document.querySelectorAll('[data-series]').forEach(b=>b.addEventListener('click',()=>{renderGallery(b.dataset.series);byId('works').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}));
document.querySelectorAll('img').forEach(img=>img.addEventListener('error',imageFailed));
byId('year').textContent=new Date().getFullYear();
async function initialize(){try{
 const response=await fetch('/api/portfolio');if(!response.ok)throw new Error('Portfolio unavailable');const data=await response.json();isDemo=data.demo;
 if(isDemo){const r=await fetch('/photos.json');if(!r.ok)throw new Error('Samples unavailable');photos=await r.json();}else photos=data.photos;
 if(!Array.isArray(photos))throw new Error('Invalid portfolio');
 document.body.classList.toggle('demo-portfolio',isDemo);byId('gallery-label').textContent=isDemo?'示意作品集':String(photos.length).padStart(2,'0')+' PHOTOGRAPHS';byId('sample-disclosure').hidden=!isDemo;
 const cover=photos.find(p=>p.id===data.coverId)||photos[0];
 if(cover){const image=byId('hero-image');if(!isDemo){image.src=cover.large;image.removeAttribute('srcset');image.alt=cover.title;byId('hero-credit').parentElement.firstChild.textContent='PHOTOGRAPH BY ';byId('hero-credit').textContent='Adrian Yeh';}else byId('hero-credit').textContent=cover.author+' / Unsplash';}
 else {byId('hero-image').hidden=true;byId('hero-credit').parentElement.hidden=true;}
 const counter=document.querySelector('[data-filter="all"] span');counter.textContent=String(photos.length).padStart(2,'0');
 for(const button of document.querySelectorAll('[data-series]')){const p=photos.find(p=>p.category===button.dataset.series);button.hidden=!p;if(p){const img=button.querySelector('img');img.src=p.large;img.alt=p.title;}}
 byId('series').hidden=photos.length===0;renderGallery();
 if(!photos.length)gallery.innerHTML='<p class="portfolio-empty">新的影像，正在路上。</p>';
 }catch{gallery.innerHTML='<p>作品暫時無法載入，請稍後重新整理頁面。</p>';byId('series').hidden=true;imageFailed();}}
initialize();
