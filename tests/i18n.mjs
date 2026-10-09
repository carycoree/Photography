import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const script=await readFile('public/i18n.js','utf8');
function page(storage=new Map(),denyStorage=false){
 const texts=['全部作品 ','正在確認登入…','Adrian Yeh','123'].map(textContent=>({textContent,parentElement:{closest:()=>null}}));
 const title={textContent:'作品管理 — Adrian Yeh'};
 const attrs={'placeholder':'搜尋標題或地點'};
 const field={getAttribute:key=>attrs[key]??null,setAttribute:(key,value)=>attrs[key]=value};
 const buttons=['zh','en'].map(language=>({dataset:{language},attributes:{},setAttribute(key,value){this.attributes[key]=value;},addEventListener(){}}));
 const document={body:{texts},documentElement:{lang:'zh-Hant'},title:title.textContent,createTreeWalker(root){let index=0;return {nextNode:()=>root.texts[index++]??null};},querySelectorAll(selector){return selector==='[data-language]'?buttons:[field];},querySelector(){return {firstChild:title};},getElementById(){return null;}};
 const window={dispatchEvent(){}};
 const localStorage={getItem(key){if(denyStorage)throw new Error('blocked');return storage.get(key)??null;},setItem(key,value){if(denyStorage)throw new Error('blocked');storage.set(key,value);}};
 vm.runInNewContext(script,{window,document,localStorage,NodeFilter:{SHOW_TEXT:4},Event:class{}});
 return {api:window.PortfolioI18n,document,texts,title,attrs,buttons,storage};
}
const first=page();first.texts[1].textContent='owner@example.com';
first.api.setLanguage('en');
assert.equal(first.document.documentElement.lang,'en');
assert.equal(first.texts[0].textContent,'All photographs ');
assert.equal(first.texts[1].textContent,'owner@example.com'); // Live account text must survive a language change.
assert.equal(first.texts[2].textContent,'Adrian Yeh');
assert.equal(first.texts[3].textContent,'123');
assert.equal(first.title.textContent,'Photography Studio — Adrian Yeh');
assert.equal(first.attrs.placeholder,'Search title or location');
assert.equal(first.buttons[1].attributes['aria-pressed'],'true');
assert.equal(first.api.t('正在處理 {name}',{name:'photo.jpg'}),'Processing photo.jpg');
assert.equal(first.api.t('使用 ChatGPT 登入'),'Sign in with ChatGPT');
assert.equal(first.api.t('未填英文內容時，英文頁面會沿用原文。'),'English pages use the original text when an English version is not provided.');
const next=page(first.storage);assert.equal(next.document.documentElement.lang,'en'); // Preference survives navigation/reload.
first.api.setLanguage('zh');assert.equal(first.texts[0].textContent,'全部作品 ');assert.equal(first.attrs.placeholder,'搜尋標題或地點');
const blocked=page(new Map(),true);blocked.api.setLanguage('en');assert.equal(blocked.document.documentElement.lang,'en');
// Every server validation/auth message is localized in the management UI.
for(const filename of ['worker/index.js','worker/auth.js','worker/db.js']){
 const source=await readFile(filename,'utf8');
 for(const match of source.matchAll(/new HttpError\(\d+,'([^']+)'\)/g))assert(!/[\u4e00-\u9fff]/.test(next.api.t(match[1])),match[1]);
}
console.log('PASS: language switching, persistence, labels/placeholders, live-text preservation, blocked storage fallback and localized server errors.');
