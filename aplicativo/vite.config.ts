import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
export default defineConfig({plugins:[react(),{name:'offline-assets',async closeBundle(){
 const files:string[]=[];
 const scan=async(dir:string)=>{for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())await scan(p);else files.push('/'+path.relative('dist',p).split(path.sep).join('/'));}};
 await scan('dist');const hash=createHash('sha256');for(const f of files)hash.update(await readFile('dist'+f));const version=hash.digest('hex').slice(0,16);
 await writeFile('dist/sw.js',`const CACHE='recanto-${version}';const FILES=${JSON.stringify(files)};self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('recanto-')&&k!==CACHE).map(k=>caches.delete(k))))));self.addEventListener('message',e=>{if(e.data==='ACTIVATE_REVIEWED_UPDATE')self.skipWaiting()});self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(FILES.includes(u.pathname))e.respondWith(caches.open(CACHE).then(c=>c.match(u.pathname)).then(r=>r||fetch(e.request)));else if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.open(CACHE).then(c=>c.match('/index.html'))));});`);
 }}],server:{port:5174,strictPort:true,host:'127.0.0.1'},build:{chunkSizeWarningLimit:1500},test:{include:['tests/**/*.test.ts']}});
