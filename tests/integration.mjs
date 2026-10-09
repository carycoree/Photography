import {Miniflare} from 'miniflare';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
const origin='https://portfolio.test';
const email='owner@example.com';
const base={modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-05-15',d1Databases:['DB'],r2Buckets:['BUCKET'],assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true},assetConfig:{html_handling:'none'}}};
const mf=new Miniflare({...base,bindings:{AUTH_MODE:'sites',ADMIN_EMAILS:email},cf:false});
const headers={'oai-authenticated-user-id':'test-owner','oai-authenticated-user-email':email};
async function request(path,options={},signed=true){const r=new Request(origin+path,{...options,headers:{...(signed?headers:{}),...(options.body?{'Origin':origin,'X-Portfolio-Admin':'1'}:{}),...options.headers}});return mf.dispatchFetch(r.url,{redirect:'manual',method:r.method,headers:r.headers,body:options.body?await r.arrayBuffer():undefined});}
async function json(path,method,body,signed=true,extra={}){return request(path,{method,headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)},signed);}
async function expectStatus(response,status){assert.equal(response.status,status,await response.clone().text());return response;}
async function upload(title='First photograph'){
 const form=new FormData();const bytes=await readFile('public/assets/01-800.webp');for(const name of['original','thumbnail','large'])form.append(name,new Blob([bytes],{type:'image/webp'}),name+'.webp');form.append('title',title);form.append('category','landscape');form.append('width','800');form.append('height','533');
 const response=await expectStatus(await request('/api/admin/photos',{method:'POST',body:form}),201);return (await response.json()).photo;
}
try{
 const db=await mf.getD1Database('DB');for(const file of ['0000_clear_bulldozer.sql','0001_gray_spectrum.sql'])for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql.trim()).run();
 for(const path of ['/admin','/admin/','/admin.html']){const response=await expectStatus(await request(path,{},false),303);assert.equal(response.headers.get('Location'),'/login');assert.equal(response.headers.get('Cache-Control'),'no-store');}
 const login=await expectStatus(await request('/login',{},false),200);const loginHTML=await login.text();assert(loginHTML.includes('/signin-with-chatgpt?return_to=%2Fadmin'));assert(!loginHTML.includes('id="studio-content"'));assert(loginHTML.includes('管理員登入'));
 const resumed=await expectStatus(await request('/login'),200);assert((await resumed.text()).includes('進入作品管理'));
 const denied=await expectStatus(await request('/login',{headers:{'oai-authenticated-user-email':'other@example.com'}}),403);assert((await denied.text()).includes('登出並切換帳號'));
 const expiredPage=await request('/login?expired=1',{},false);assert((await expiredPage.text()).includes('登入已失效'));
 const sessionData=await (await request('/api/admin/session')).json();assert.equal(sessionData.logoutUrl,'/signout-with-chatgpt?return_to=%2Flogin');
 await expectStatus(await request('/login',{method:'POST'},false),405);await expectStatus(await request('/api/admin/photos',{},false),401);
 await expectStatus(await request('/api/admin/photos',{headers:{'oai-authenticated-user-email':'other@example.com'}}),403);
 await expectStatus(await json('/api/admin/cover','PUT',{id:null},true,{'Origin':'https://attacker.test'}),403);
 await expectStatus(await json('/api/admin/cover','PUT',{id:null},true,{'X-Portfolio-Admin':''}),403);
 assert.equal((await (await request('/api/portfolio',{},false)).json()).demo,true);
 const admin=await expectStatus(await request('/admin'),200);assert((await admin.text()).includes('作品管理'));
 const home=await expectStatus(await request('/',{},false),200);const homeHTML=await home.text();assert(homeHTML.includes('收藏 <em>片刻。'));assert(!/第一版|第二版|· II/.test(homeHTML));assert(homeHTML.includes('data-language="en"'));assert(homeHTML.includes('src="/i18n.js"'));assert(loginHTML.includes('data-language="en"'));
 for(const path of ['/v2','/v2/','/v2.html']){const v2=await expectStatus(await request(path,{},false),200);const html=await v2.text();assert(html.includes('收藏 <em>片刻。'));assert(html.includes('href="/login"'));assert(html.includes('src="/v2.js"'));}
 await expectStatus(await request('/i18n.js',{},false),200);await expectStatus(await request('/i18n.css',{},false),200);await expectStatus(await request('/v2.css',{},false),200);await expectStatus(await request('/v2.js',{},false),200);
 let first=await upload();assert.equal(first.published,false);
 let portfolio=await (await request('/api/portfolio',{},false)).json();assert.equal(portfolio.photos.length,0);
 await expectStatus(await request(first.src,{},false),401);await expectStatus(await request(first.src),200);
 await expectStatus(await json('/api/admin/cover','PUT',{id:first.id}),400);
 const payload={title:'公開作品',category:'landscape',description:'A story',titleEn:'Published photograph',descriptionEn:'An English story',locationEn:'Kaohsiung City',location:'Kaohsiung',takenAt:'2026-10-03',published:true,version:first.version};
 first=(await (await expectStatus(await json('/api/admin/photos/'+first.id,'PATCH',payload),200)).json()).photo;
 portfolio=await (await request('/api/portfolio',{},false)).json();assert.equal(portfolio.demo,false);assert.equal(portfolio.photos.length,1);assert.equal(portfolio.photos[0].description,'A story');assert.equal(portfolio.photos[0].titleEn,'Published photograph');assert.equal(portfolio.photos[0].descriptionEn,'An English story');assert.equal(portfolio.photos[0].locationEn,'Kaohsiung City');
 const publicSource=portfolio.photos[0].src;const original=await expectStatus(await request(publicSource,{},false),200);assert.equal(original.headers.get('Content-Type'),'image/webp');assert.equal(original.headers.get('Cache-Control'),'private, no-store');assert.equal(original.headers.get('X-Content-Type-Options'),'nosniff');
 await expectStatus(await json('/api/admin/photos/'+first.id,'PATCH',payload),409);
 await expectStatus(await json('/api/admin/cover','PUT',{id:first.id}),200);assert.equal((await (await request('/api/portfolio',{},false)).json()).coverId,first.id);
 const second=await upload('Second photograph');
 await expectStatus(await json('/api/admin/reorder','POST',{ids:[second.id,first.id]}),200);assert.equal((await (await request('/api/admin/photos')).json()).photos[0].id,second.id);
 await expectStatus(await json('/api/admin/reorder','POST',{ids:[first.id]}),409);
 first=(await (await expectStatus(await json('/api/admin/photos/'+first.id,'PATCH',{...payload,published:false,version:first.version}),200)).json()).photo;
 portfolio=await (await request('/api/portfolio',{},false)).json();assert.equal(portfolio.coverId,null);assert.equal(portfolio.photos.length,0);assert.equal(portfolio.demo,false);
 await expectStatus(await request(publicSource,{headers:{'If-None-Match':original.headers.get('ETag')}},false),401);
 await expectStatus(await json('/api/admin/photos/'+first.id,'DELETE',{version:first.version-1}),409);
 await expectStatus(await json('/api/admin/photos/'+first.id,'DELETE',{version:first.version}),200);await expectStatus(await request(first.src),404);
 assert.equal(await (await mf.getR2Bucket('BUCKET')).get('works/'+first.id+'/original'),null);
 const bad=new FormData();for(const k of['original','thumbnail','large'])bad.append(k,new Blob(['<svg onload="alert(1)">fake</svg>'],{type:'image/jpeg'}),'fake.jpg');bad.append('title','Fake');bad.append('category','landscape');bad.append('width','1');bad.append('height','1');await expectStatus(await request('/api/admin/photos',{method:'POST',body:bad}),415);
 await expectStatus(await json('/api/admin/photos/'+second.id,'DELETE',{version:second.version}),200);
 console.log('PASS: auth, CSRF, upload, R2 originals, durable D1 metadata, drafts, publishing, cover, reorder, stale edits, hide/cache revocation, delete and file validation.');
}finally{await mf.dispose();}
const {publicKey,privateKey}=await generateKeyPair('RS256');const key=await exportJWK(publicKey);key.kid='test-key';key.alg='RS256';const issuer='https://test-team.cloudflareaccess.com';
const authMF=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-05-15',cf:false,bindings:{AUTH_MODE:'cloudflare',ADMIN_EMAILS:email,ACCESS_TEAM_DOMAIN:issuer,ACCESS_AUD:'portfolio-admin'},outboundService:async request=>{assert.equal(request.url,issuer+'/cdn-cgi/access/certs');return Response.json({keys:[key]});}});
async function token(overrides={}){const now=Math.floor(Date.now()/1000);return new SignJWT({email,...overrides}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer(issuer).setSubject('owner-id').setAudience('portfolio-admin').setIssuedAt(now).setExpirationTime(now+3600).sign(privateKey);}
try{
 async function session(jwt,extra={}){return authMF.dispatchFetch(origin+'/api/admin/session',{headers:{...(jwt?{'Cf-Access-Jwt-Assertion':jwt}:{}),...extra}});}
 const login=await authMF.dispatchFetch(origin+'/login');assert.equal(login.status,200);assert((await login.text()).includes('/admin?signin=1'));
 const absent=await authMF.dispatchFetch(origin+'/admin',{redirect:'manual'});assert.equal(absent.status,303);assert.equal(absent.headers.get('Location'),'/login');
 const unconfigured=await authMF.dispatchFetch(origin+'/admin?signin=1');assert.equal(unconfigured.status,503);
 await expectStatus(await session(null,headers),401); // Sites headers do not authenticate an independent Cloudflare deployment.
 const authenticatedSession=await expectStatus(await session(await token()),200);assert.equal((await authenticatedSession.json()).logoutUrl,'/cdn-cgi/access/logout');
 await expectStatus(await session(await token({email:'stranger@example.com'})),403);
 const badAudience=await new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer(issuer).setSubject('owner-id').setAudience('wrong-app').setIssuedAt().setExpirationTime('1h').sign(privateKey);await expectStatus(await session(badAudience),401);
 const expired=await new SignJWT({email}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuer(issuer).setSubject('owner-id').setAudience('portfolio-admin').setIssuedAt(1).setExpirationTime(2).sign(privateKey);await expectStatus(await session(expired),401);
 await expectStatus(await session('forged.jwt.token'),401);
 console.log('PASS: verified Cloudflare Access signature, issuer/audience, expiry, administrator allowlist and rejection of spoofed Sites identity headers.');
}finally{await authMF.dispose();}
