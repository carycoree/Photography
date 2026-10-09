import { createRemoteJWKSet, jwtVerify } from 'jose';
const jwks=new Map();
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export async function administrator(request,env){
 const allowed=(env.ADMIN_EMAILS||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
 if(!allowed.length)throw new HttpError(503,'管理員設定尚未完成。');
 let email='';
 if(env.AUTH_MODE==='sites'){
  if(!request.headers.get('oai-authenticated-user-id'))throw new HttpError(401,'請先登入管理員帳號。');
  email=(request.headers.get('oai-authenticated-user-email')||'').toLowerCase();
 }else{
  const issuer=(env.ACCESS_TEAM_DOMAIN||'').replace(/\/$/,'');
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!env.ACCESS_AUD)throw new HttpError(503,'請先完成 Cloudflare Access 登入設定。');
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token)throw new HttpError(401,'請透過 Cloudflare Access 登入管理後台。');
  try{
   if(!jwks.has(issuer))jwks.set(issuer,createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs')));
   const {payload}=await jwtVerify(token,jwks.get(issuer),{issuer,audience:env.ACCESS_AUD,algorithms:['RS256'],requiredClaims:['exp','iat','sub','email']});
   email=String(payload.email||'').toLowerCase();
  }catch{throw new HttpError(401,'登入已過期或無法驗證，請重新登入。');}
 }
 if(!allowed.includes(email))throw new HttpError(403,'此帳號沒有作品管理權限。');
 return {email};
}
export function validateWrite(request){
 const url=new URL(request.url);
 if(request.headers.get('Origin')!==url.origin||request.headers.get('X-Portfolio-Admin')!=='1'||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new HttpError(403,'無法驗證這次操作，請從管理後台重試。');
}
