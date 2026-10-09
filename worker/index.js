import { administrator, validateWrite, HttpError } from './auth.js';
import { database,bucket,listPhotos,coverId,photograph } from './db.js';
const categories=new Set(['landscape','architecture','street']);
const MAX_IMAGE=15*1024*1024;
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
const csp="default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; object-src 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com";
function json(data,status=200){return Response.json(data,{status,headers:{...security,'Cache-Control':'no-store'}});}
function redirect(location){return new Response(null,{status:303,headers:{...security,'Location':location,'Cache-Control':'no-store'}});}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function logoutURL(env){return env.AUTH_MODE==='sites'?'/signout-with-chatgpt?return_to=%2Flogin':'/cdn-cgi/access/logout';}
async function loginPage(request,env){
 let user=null,error=null;try{user=await administrator(request,env);}catch(e){if(!(e instanceof HttpError))throw e;error=e;}
 const sites=env.AUTH_MODE==='sites',unavailable=error?.status===503,denied=error?.status===403;
 const href=user?'/admin':sites?'/signin-with-chatgpt?return_to=%2Fadmin':'/admin?signin=1';
 const description=user?'已登入，可以繼續整理你的作品。':denied?'這個帳號沒有作品管理權限，請切換管理員帳號。':unavailable?'登入設定尚未完成，請完成管理員設定後再試。':sites?'使用你的 ChatGPT 帳號登入作品管理。':'使用管理員 Email 驗證身分，登入後即可整理作品。';
 const notice=new URL(request.url).searchParams.has('expired')&&!user&&!denied&&!unavailable?'<p class="login-notice" role="status">登入已失效，請重新登入。</p>':'';
 const action=unavailable?'':denied?`<a class="button primary login-button" href="${logoutURL(env)}" target="_top">登出並切換帳號</a>`:`<a class="button primary login-button" href="${href}" target="_top">${user?'進入作品管理':sites?'使用 ChatGPT 登入':'登入作品管理'}</a>`;
 return new Response(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#171717"><title>管理員登入 — Adrian Yeh</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/i18n.css"><script src="/i18n.js" defer></script></head><body class="login-body"><header class="studio-header"><a href="/" class="brand">ADRIAN YEH<span>PHOTOGRAPHY / STUDIO</span></a><div class="login-header-actions"><div class="language-switch" role="group" aria-label="選擇語言"><button type="button" data-language="zh" aria-pressed="true" lang="zh-Hant" aria-label="切換為中文">中</button><span aria-hidden="true">/</span><button type="button" data-language="en" aria-pressed="false" lang="en" aria-label="Switch to English">EN</button></div><a href="/" class="login-back">返回作品集</a></div></header><main class="login-layout"><section class="login-card" aria-labelledby="login-title"><p class="eyebrow">THE PHOTOGRAPHER'S STUDIO</p><p class="login-word">Studio.</p><h1 id="login-title">${user?'歡迎回到作品管理':'管理員登入'}</h1><p class="login-description">${description}</p>${notice}${user?`<p class="login-account">${escapeHTML(user.email)}</p>`:''}${action}${user?`<a class="login-secondary" href="${logoutURL(env)}" target="_top">登出</a>`:''}<p class="login-note">作品管理僅限授權的管理員使用。</p></section></main><footer class="studio-footer"><span>ADRIAN YEH / PHOTOGRAPHY</span><span>你的視角，由你編輯。</span></footer></body></html>`,{status:unavailable?503:denied?403:200,headers:{...security,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':csp}});
}
async function bodyJSON(r){if(!r.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'資料格式不正確。');const raw=await r.text();if(raw.length>100000)throw new HttpError(413,'資料太大。');try{return JSON.parse(raw);}catch{throw new HttpError(400,'資料格式不正確。');}}
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new HttpError(400,'請確認標題、分類與文字長度。');return value.trim();}
function details(b){
 const title=text(b.title,120,true),category=text(b.category,30,true);if(!categories.has(category))throw new HttpError(400,'請選擇有效的作品分類。');
 const description=text(b.description??'',2000),location=text(b.location??'',120),takenAt=text(b.takenAt??'',10);
 if(takenAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(takenAt)||Number.isNaN(Date.parse(takenAt))))throw new HttpError(400,'拍攝日期格式不正確。');
 if(typeof b.published!=='boolean')throw new HttpError(400,'請確認作品公開狀態。');
 return {title,titleEn:text(b.titleEn??'',120),descriptionEn:text(b.descriptionEn??'',2000),locationEn:text(b.locationEn??'',120),category,description,location,takenAt,published:b.published?1:0};
}
function signature(bytes){if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10)return 'image/png';if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';return null;}
async function validateImage(file,maxSize){if(!file||typeof file.arrayBuffer!=='function'||file.size<16||file.size>maxSize)throw new HttpError(400,'照片格式不正確或檔案超過大小限制。');const type=signature(new Uint8Array(await file.slice(0,16).arrayBuffer()));if(!type)throw new HttpError(415,'僅支援 JPG、PNG 與 WebP 圖片。');return type;}
async function upload(request,env){
 const length=Number(request.headers.get('Content-Length')||0);if(length>23*1024*1024)throw new HttpError(413,'這張照片超過上傳大小限制。');
 const data=await request.formData();
 const original=data.get('original'),thumb=data.get('thumbnail'),large=data.get('large');
 const types=await Promise.all([validateImage(original,MAX_IMAGE),validateImage(thumb,3*1024*1024),validateImage(large,3*1024*1024)]);
 const title=text(data.get('title'),120,true),category=text(data.get('category'),30,true);if(!categories.has(category))throw new HttpError(400,'請選擇作品分類。');
 const width=Number(data.get('width')),height=Number(data.get('height'));if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>50000||height>50000)throw new HttpError(400,'照片尺寸不正確。');
 const id=crypto.randomUUID(),keys=[`works/${id}/original`,`works/${id}/thumbnail`,`works/${id}/large`],files=[original,thumb,large],store=bucket(env),db=database(env);
 let inserted=false;
 try{
  const writes=await Promise.allSettled(files.map((file,i)=>store.put(keys[i],file.stream(),{httpMetadata:{contentType:types[i]},customMetadata:{photographId:id}})));
  if(writes.some(r=>r.status==='rejected'))throw new HttpError(503,'照片尚未儲存成功，請重試。');
  const now=new Date().toISOString();
  await db.prepare("INSERT INTO photographs (id,title,category,original_key,thumbnail_key,large_key,content_type,width,height,bytes,published,position,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,(SELECT COALESCE(MAX(position),-1)+1 FROM photographs),?,?)").bind(id,title,category,...keys,types[0],width,height,original.size,now,now).run();inserted=true;
  return json({photo:photograph(await db.prepare('SELECT * FROM photographs WHERE id = ?').bind(id).first(),true)},201);
 }catch(error){if(!inserted)await Promise.allSettled(keys.map(key=>store.delete(key)));throw error;}
}
async function updatePhoto(id,request,env){
 const b=await bodyJSON(request),p=details(b);if(!Number.isInteger(b.version)||b.version<1)throw new HttpError(400,'作品版本不正確，請重新整理。');
 const db=database(env),now=new Date().toISOString();
 const statements=[db.prepare('UPDATE photographs SET title=?,title_en=?,description_en=?,location_en=?,category=?,description=?,location=?,taken_at=?,published=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(p.title,p.titleEn,p.descriptionEn,p.locationEn,p.category,p.description,p.location,p.takenAt,p.published,now,id,b.version),db.prepare("DELETE FROM settings WHERE key='cover_id' AND value=? AND NOT EXISTS (SELECT 1 FROM photographs WHERE id=? AND published=1)").bind(id,id)];
 if(p.published)statements.push(db.prepare("INSERT INTO settings (key,value) SELECT 'portfolio_started','1' WHERE EXISTS (SELECT 1 FROM photographs WHERE id=? AND published=1) ON CONFLICT(key) DO NOTHING").bind(id));
 const result=await db.batch(statements);if(!result[0].meta.changes)throw new HttpError(409,'作品已在另一個視窗更新，請重新載入後再編輯。');
 return json({photo:photograph(await db.prepare('SELECT * FROM photographs WHERE id=?').bind(id).first(),true)});
}
async function deletePhoto(id,request,env){
 const b=await bodyJSON(request);if(!Number.isInteger(b.version))throw new HttpError(400,'作品版本不正確。');const db=database(env);
 const old=await db.prepare('SELECT * FROM photographs WHERE id=?').bind(id).first();if(!old)throw new HttpError(404,'作品不存在。');
 const result=await db.batch([db.prepare('DELETE FROM photographs WHERE id=? AND version=?').bind(id,b.version),db.prepare("DELETE FROM settings WHERE key='cover_id' AND value=? AND NOT EXISTS (SELECT 1 FROM photographs WHERE id=?)").bind(id,id)]);
 if(!result[0].meta.changes)throw new HttpError(409,'作品已更新，請重新載入後再刪除。');
 // Remove the record first: originals are immediately inaccessible even if R2 cleanup is temporarily unavailable.
 const results=await Promise.allSettled([old.original_key,old.thumbnail_key,old.large_key].map(key=>bucket(env).delete(key)));
 if(results.some(r=>r.status==='rejected'))console.error('Photograph object cleanup incomplete',id);
 return json({deleted:true});
}
async function reorder(request,env){
 const b=await bodyJSON(request);if(!Array.isArray(b.ids)||b.ids.some(id=>typeof id!=='string')||new Set(b.ids).size!==b.ids.length)throw new HttpError(400,'排序資料不正確。');
 const db=database(env),{results}=await db.prepare('SELECT id FROM photographs').all();if(results.length!==b.ids.length||results.some(p=>!b.ids.includes(p.id)))throw new HttpError(409,'作品清單已變更，請重新載入後再排序。');
 if(b.ids.length){const ids=JSON.stringify(b.ids);await db.prepare('UPDATE photographs SET position=(SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value=photographs.id) WHERE id IN (SELECT value FROM json_each(?))').bind(ids,ids).run();}
 return json({saved:true});
}
async function setCover(request,env){
 const b=await bodyJSON(request),db=database(env);
 if(b.id===null){await db.prepare("DELETE FROM settings WHERE key='cover_id'").run();return json({coverId:null});}
 if(typeof b.id!=='string')throw new HttpError(400,'請選擇有效的封面作品。');
 const result=await db.prepare("INSERT INTO settings (key,value) SELECT 'cover_id',id FROM photographs WHERE id=? AND published=1 ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(b.id).run();
 if(!result.meta.changes)throw new HttpError(400,'請先公開作品，再設定為首頁封面。');return json({coverId:b.id});
}
async function media(request,env,key,authorized=false){
 if(!/^works\/[0-9a-f-]{36}\/(original|thumbnail|large)$/.test(key))throw new HttpError(404,'照片不存在。');
 const id=key.split('/')[1],row=await database(env).prepare('SELECT published FROM photographs WHERE id=?').bind(id).first();if(!row)throw new HttpError(404,'照片不存在。');
 if(!row.published&&!authorized)await administrator(request,env);
 const object=await bucket(env).get(key);if(!object)throw new HttpError(404,'照片不存在。');
 const headers=new Headers(security);object.writeHttpMetadata(headers);headers.set('ETag',object.httpEtag);headers.set('Cache-Control','private, no-store');
 // Publication is checked on every request, including conditional requests, so drafts cannot remain public in a CDN cache.
 if(request.headers.get('If-None-Match')===object.httpEtag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:object.body,{headers});
}
async function asset(request,env,path){
 if(!env.ASSETS)throw new HttpError(503,'網站內容暫時無法使用。');
 const url=new URL(request.url);if(path)url.pathname=path;const response=await env.ASSETS.fetch(new Request(url,request));
 const headers=new Headers(response.headers);for(const [k,v]of Object.entries(security))headers.set(k,v);
 if(headers.get('Content-Type')?.includes('text/html')){headers.set('Content-Security-Policy',csp);headers.set('Cache-Control','no-store');}
 return new Response(response.body,{status:response.status,headers});
}
function authPage(error,env){return new Response(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>作品管理 — Adrian Yeh</title><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/i18n.css"><script src="/i18n.js" defer></script></head><body><main class="auth-page"><p class="eyebrow">ADRIAN YEH / STUDIO</p><div class="language-switch" role="group" aria-label="選擇語言"><button type="button" data-language="zh" aria-pressed="true" lang="zh-Hant" aria-label="切換為中文">中</button><span aria-hidden="true">/</span><button type="button" data-language="en" aria-pressed="false" lang="en" aria-label="Switch to English">EN</button></div><h1>作品管理</h1><p>${escapeHTML(error.message)}</p><a href="/login">返回登入頁</a><a href="/">返回作品集</a></main></body></html>`,{status:error.status,headers:{...security,'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':csp}});}
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 try{
  if((path==='/v2'||path==='/v2/'||path==='/v2.html')&&['GET','HEAD'].includes(request.method))return await asset(request,env,'/index.html');
  if((path==='/v1'||path==='/v1/')&&['GET','HEAD'].includes(request.method))return redirect('/');
  if(path==='/login'||path==='/login/'){
   if(!['GET','HEAD'].includes(request.method))return json({error:'不支援這個操作。'},405);
   return await loginPage(request,env);
  }
  if(path==='/admin'||path==='/admin/'||path==='/admin.html'){
   if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'不支援這個操作。'},405);
   try{await administrator(request,env);}catch(error){if(error instanceof HttpError){if(error.status===401){if(new URL(request.url).searchParams.get('signin')==='1'&&env.AUTH_MODE!=='sites')return authPage(new HttpError(503,'Cloudflare Access 尚未提供有效的登入驗證，請確認後台路徑的 Access 設定。'),env);return redirect('/login');}return await loginPage(request,env);}throw error;}
   return await asset(request,env,'/admin.html');
  }
  if(path.startsWith('/api/admin')){
   const user=await administrator(request,env);if(!['GET','HEAD'].includes(request.method))validateWrite(request);
   if(path.startsWith('/api/admin/media/')&&['GET','HEAD'].includes(request.method))return await media(request,env,decodeURIComponent(path.slice('/api/admin/media/'.length)),true);
   if(path==='/api/admin/session'&&request.method==='GET')return json({email:user.email,logoutUrl:logoutURL(env)});
   if(path==='/api/admin/photos'&&request.method==='GET'){const [photos,cover]=await Promise.all([listPhotos(env,true),coverId(env)]);return json({photos,coverId:cover});}
   if(path==='/api/admin/photos'&&request.method==='POST')return await upload(request,env);
   if(path==='/api/admin/reorder'&&request.method==='POST')return await reorder(request,env);
   if(path==='/api/admin/cover'&&request.method==='PUT')return await setCover(request,env);
   const match=path.match(/^\/api\/admin\/photos\/([0-9a-f-]{36})$/);
   if(match&&request.method==='PATCH')return await updatePhoto(match[1],request,env);
   if(match&&request.method==='DELETE')return await deletePhoto(match[1],request,env);
   throw new HttpError(404,'找不到這個操作。');
  }
  if(path==='/api/portfolio'&&request.method==='GET'){
   const [photos,cover,started]=await Promise.all([listPhotos(env),coverId(env),database(env).prepare("SELECT value FROM settings WHERE key='portfolio_started'").first()]);
   return json({photos,coverId:cover,demo:!started&&photos.length===0});
  }
  if(path.startsWith('/media/')&&(request.method==='GET'||request.method==='HEAD'))return await media(request,env,decodeURIComponent(path.slice(7)));
  if(path.startsWith('/api/')||path.startsWith('/media/'))throw new HttpError(404,'找不到這個網址。');
  return await asset(request,env,path==='/'?'/index.html':undefined);
 }catch(error){if(error instanceof HttpError)return json({error:error.message},error.status);console.error('Portfolio request failed',path,error?.message);return json({error:'服務暫時無法完成這次操作，請稍後重試。'},503);}
}};
