import {build} from 'esbuild';
import {mkdir,rm,cp,writeFile,readFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});
await cp('public','dist/client',{recursive:true});

// Sites metadata is optional when deploying with the root wrangler.jsonc.
let hostingMetadata;
try {
  hostingMetadata = await readFile('.openai/hosting.json');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (hostingMetadata !== undefined) {
  await mkdir('dist/.openai',{recursive:true});
  await writeFile('dist/.openai/hosting.json',hostingMetadata);
  await cp('drizzle','dist/.openai/drizzle',{recursive:true});
}
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'none'});
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'adrian-yeh-photography',main:'./index.js',compatibility_date:'2026-05-15',assets:{directory:'../client',binding:'ASSETS',run_worker_first:true,html_handling:"none"},d1_databases:[{binding:'DB',database_name:'photography-db',database_id:'00000000-0000-4000-8000-000000000000'}],r2_buckets:[{binding:'BUCKET',bucket_name:'photography-images'}]},null,2));
console.log('Built Worker and public assets.');
