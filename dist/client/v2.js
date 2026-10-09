'use strict';
const gallery=document.getElementById('gallery'),dialog=document.getElementById('lightbox');
const i18n=window.PortfolioI18n,{t}=i18n;
const categoryNames={landscape:'自然風景',architecture:'建築線條',street:'城市片刻'};
const byId=id=>document.getElementById(id);
let photos=[],visiblePhotos=[],currentIndex=0,lastFocused=null,isDemo=true,coverId=null,featuredId=null,activeFilter='all',loadFailed=false;
function localized(photo,field){return i18n.language==='en'&&photo[field+'En']?photo[field+'En']:photo[field]||'';}
function imageFailed(){byId('image-error').hidden=false;}
function renderGallery(filter=activeFilter){
 activeFilter=filter;
 const shown=filter==='all'?photos:photos.filter(p=>p.category===filter);
 gallery.replaceChildren();
 if(!shown.length){const empty=document.createElement('p');empty.className='portfolio-empty';empty.textContent=t(photos.length?'此分類尚無公開作品。':'新的影像，正在路上。');gallery.append(empty);}
 for(const photo of shown){
  const title=localized(photo,'title'),category=t(categoryNames[photo.category]);
  const button=document.createElement('button');button.type='button';button.className='photo';button.dataset.photoId=photo.id;button.setAttribute('aria-label',t('放大檢視：{title}，{category}{sample}',{title,category,sample:isDemo?t('，示意照片'):''}));
  const frame=document.createElement('div');frame.className='photo-image';
  const img=document.createElement('img');img.src=photo.thumbnail;
  const thumbWidth=isDemo?800:Math.round(photo.width*Math.min(1,800/Math.max(photo.width,photo.height))),largeWidth=isDemo?1400:Math.round(photo.width*Math.min(1,1800/Math.max(photo.width,photo.height)));
  img.srcset=`${photo.thumbnail} ${thumbWidth}w, ${photo.large} ${largeWidth}w`;img.sizes='(max-width: 760px) 90vw, (max-width: 1100px) 46vw, 62vw';img.alt=`${title} — ${photo.author||'Adrian Yeh'}${isDemo?' · '+t('攝影示意作品'):''}`;img.loading='lazy';img.decoding='async';img.width=photo.width;img.height=photo.height;img.addEventListener('error',imageFailed);frame.append(img);button.append(frame);
  const caption=document.createElement('div');caption.className='photo-caption';
  for(const [cls,text] of [['photo-number',String(photos.indexOf(photo)+1).padStart(2,'0')],['photo-title',title],['photo-type',category]]){const span=document.createElement('span');span.className=cls;span.textContent=text;caption.append(span);}button.append(caption);
  button.addEventListener('click',()=>{visiblePhotos=shown;openPhoto(shown.findIndex(p=>p.id===photo.id),button);});gallery.append(button);
 }
 document.querySelectorAll('[data-filter]').forEach(b=>{const active=b.dataset.filter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
}
function renderFeatures(){
 byId('gallery-label').textContent=isDemo?t('示意作品集'):String(photos.length).padStart(2,'0')+' '+(i18n.language==='en'?'PHOTOGRAPHS':'張作品');
 const cover=photos.find(p=>p.id===coverId),featured=photos.find(p=>p.id===featuredId);
 if(cover){byId('hero-title').textContent=localized(cover,'title');byId('hero-image').alt=localized(cover,'title');}
 else byId('hero-title').textContent=t('新的影像，正在路上。');
 if(featured){byId('featured-title').textContent=localized(featured,'title');byId('featured-image').alt=localized(featured,'title');byId('featured-credit').textContent=isDemo?featured.author+' / Unsplash '+t('· 示意影像'):'Adrian Yeh';}
 for(const button of document.querySelectorAll('[data-series]')){const p=photos.find(p=>p.category===button.dataset.series);if(p)button.querySelector('img').alt=localized(p,'title');}
}
function displayPhoto(){
 const photo=visiblePhotos[currentIndex];if(!photo)return;
 const title=localized(photo,'title');byId('lightbox-image').src=photo.src;byId('lightbox-image').alt=`${title} — ${photo.author||'Adrian Yeh'}`;
 byId('lightbox-position').textContent=`${String(currentIndex+1).padStart(2,'0')} / ${String(visiblePhotos.length).padStart(2,'0')}`;
 byId('lightbox-title').textContent=title;byId('lightbox-category').textContent=[t(categoryNames[photo.category]),localized(photo,'location'),photo.takenAt].filter(Boolean).join(' · ');
 const description=localized(photo,'description');byId('lightbox-description').textContent=description;byId('lightbox-description').hidden=!description;
 const source=byId('lightbox-source');source.parentElement.firstChild.textContent=isDemo?t('示意影像 ·')+' ':'PHOTOGRAPH BY ';source.textContent=isDemo?photo.author+' / Unsplash':'Adrian Yeh';if(isDemo)source.href=photo.source;else source.removeAttribute('href');
 byId('previous').disabled=byId('next').disabled=visiblePhotos.length<2;
}
function openPhoto(index,trigger){if(index<0)return;currentIndex=index;lastFocused=trigger;displayPhoto();dialog.showModal();document.body.classList.add('modal-open');byId('close-lightbox').focus();}
function openFeatured(id,trigger){if(!photos.length)return;visiblePhotos=photos;openPhoto(photos.findIndex(p=>p.id===id),trigger);}
function step(delta){if(visiblePhotos.length<2)return;currentIndex=(currentIndex+delta+visiblePhotos.length)%visiblePhotos.length;displayPhoto();}
byId('hero-open').addEventListener('click',()=>openFeatured(coverId,byId('hero-open')));
byId('featured-open').addEventListener('click',()=>openFeatured(featuredId,byId('featured-open')));
byId('close-lightbox').addEventListener('click',()=>dialog.close());
byId('previous').addEventListener('click',()=>step(-1));byId('next').addEventListener('click',()=>step(1));
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');if(document.fullscreenElement===dialog)document.exitFullscreen().catch(()=>{});const id=lastFocused?.dataset.photoId;renderGallery();if(id)lastFocused=[...gallery.querySelectorAll('[data-photo-id]')].find(b=>b.dataset.photoId===id);lastFocused?.focus();});
dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});
let touchStart=null;byId('lightbox-image').addEventListener('touchstart',e=>{touchStart=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
byId('lightbox-image').addEventListener('touchend',e=>{if(!touchStart||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);touchStart=null;},{passive:true});
byId('fullscreen').hidden=!document.fullscreenEnabled;byId('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await dialog.requestFullscreen();}catch{byId('fullscreen').hidden=true;}});
byId('lightbox-image').addEventListener('error',imageFailed);
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{if(!loadFailed)renderGallery(b.dataset.filter);}));
document.querySelectorAll('[data-series]').forEach(b=>b.addEventListener('click',()=>{renderGallery(b.dataset.series);byId('works').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}));
document.querySelectorAll('img').forEach(img=>img.addEventListener('error',imageFailed));
byId('year').textContent=new Date().getFullYear();
const sectionLinks=[...document.querySelectorAll('.header nav a')];
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){const id=entry.target.id==='home'?'works':entry.target.id;sectionLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')==='#'+id));}},{rootMargin:'-10% 0px -55% 0px'});['home','works','series','about'].forEach(id=>observer.observe(byId(id)));}
function renderLoadError(){gallery.replaceChildren();const empty=document.createElement('div');empty.className='portfolio-empty';const text=document.createElement('p');text.textContent=t('作品暫時無法載入，請稍後再試。');const retry=document.createElement('button');retry.type='button';retry.textContent=t('重試');retry.addEventListener('click',initialize);empty.append(text,retry);gallery.append(empty);}
window.addEventListener('portfolio-languagechange',()=>{if(loadFailed){byId('hero-title').textContent=t('作品暫時無法載入，請稍後再試。');renderLoadError();return;}renderFeatures();renderGallery();if(dialog.open)displayPhoto();});
async function initialize(){try{
 const response=await fetch('/api/portfolio');if(!response.ok)throw new Error('Portfolio unavailable');const data=await response.json();isDemo=data.demo;
 if(isDemo){const response=await fetch('/photos.json');if(!response.ok)throw new Error('Samples unavailable');photos=(await response.json()).map(p=>({...p,src:'/'+p.src,thumbnail:'/'+p.thumbnail,large:'/'+p.large}));}else photos=data.photos;
 if(!Array.isArray(photos))throw new Error('Invalid portfolio');loadFailed=false;
 document.body.classList.toggle('demo-portfolio',isDemo);byId('sample-disclosure').hidden=!isDemo;byId('image-error').hidden=true;
 const cover=photos.find(p=>p.id===data.coverId)||photos[0];
 byId('hero-open').hidden=!cover;byId('hero-credit').parentElement.hidden=!cover;byId('hero-position').hidden=!cover;
 if(cover){coverId=cover.id;const image=byId('hero-image');image.src=cover.large;image.removeAttribute('srcset');byId('hero-credit').textContent=isDemo?cover.author+' / Unsplash':'Adrian Yeh';byId('hero-credit-note').hidden=!isDemo;byId('hero-position').textContent=String(photos.indexOf(cover)+1).padStart(2,'0')+' / '+String(photos.length).padStart(2,'0');}else coverId=null;
 const featured=(isDemo?photos.find(p=>p.id==='07'&&p.id!==coverId):null)||photos.find(p=>p.category==='street'&&p.id!==coverId)||photos.find(p=>p.id!==coverId);
 featuredId=featured?.id||null;byId('featured-preview').hidden=!featured;
 if(featured)byId('featured-image').src=featured.large;
 document.querySelector('[data-filter="all"] span').textContent=String(photos.length).padStart(2,'0');
 for(const button of document.querySelectorAll('[data-series]')){const photo=photos.find(p=>p.category===button.dataset.series);button.hidden=!photo;if(photo)button.querySelector('img').src=photo.large;}
 byId('series').hidden=!photos.length;renderFeatures();renderGallery();
 }catch{loadFailed=true;byId('hero-open').hidden=true;byId('hero-title').textContent=t('作品暫時無法載入，請稍後再試。');byId('hero-credit').parentElement.hidden=true;byId('hero-position').hidden=true;byId('featured-preview').hidden=true;byId('series').hidden=true;renderLoadError();}}
initialize();
