import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
const args=process.argv.slice(2);
// Keep the normal Wrangler developer flow, while supporting supervised browser preview.
if(!args.includes('--strictPort')){
 const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev',...args],{stdio:'inherit'});
 child.on('exit',code=>process.exit(code??1));
}else{
 const {Miniflare}=await import('miniflare');
 const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
 const host=option('--host','0.0.0.0'),port=Number(option('--port','4173'));
 await mkdir('.sites-runtime/preview-state',{recursive:true});
 const mf=new Miniflare({host,port,modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-05-15',cf:false,d1Databases:['DB'],r2Buckets:['BUCKET'],d1Persist:'.sites-runtime/preview-state/d1',r2Persist:'.sites-runtime/preview-state/r2',bindings:{AUTH_MODE:'sites',ADMIN_EMAILS:'preview@example.test'},assets:{directory:'dist/client',binding:'ASSETS',routerConfig:{invoke_user_worker_ahead_of_assets:true,has_user_worker:true},assetConfig:{html_handling:'none'}}});
 const db=await mf.getD1Database('DB');
 const exists=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='photographs'").first();
 if(!exists)for(const sql of (await readFile('drizzle/0000_clear_bulldozer.sql','utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql.trim()).run();
 const columns=await db.prepare('PRAGMA table_info(photographs)').all();
 if(!columns.results.some(column=>column.name==='title_en'))for(const sql of (await readFile('drizzle/0001_gray_spectrum.sql','utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql.trim()).run();
 console.log('Worker preview ready:',String(await mf.ready));
 process.once('SIGTERM',async()=>{await mf.dispose();process.exit(0);});
 process.once('SIGINT',async()=>{await mf.dispose();process.exit(0);});
}
