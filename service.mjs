import { words, shard, hex, intersection } from './index-format.mjs';
import { renderLibrary, renderAsset, renderPacks, renderApiDocs } from './pages.mjs';
const API='/api/wiki/v1/', ORIGIN='https://shirtlab.lol';
const cache=new Map();let cacheBytes=0;const CACHE_LIMIT=12*1024*1024;
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
class AssetError extends Error { constructor(status,message){super(message);this.status=status;} }
export function isFreeAssetsPath(path){return path==='/wiki'||path.startsWith('/wiki/')||path.startsWith(API);}
async function bytes(binding, descriptor, maximum=15_000_000){
 const key=descriptor.path+':'+descriptor.sha256;const cached=cache.get(key);if(cached){cache.delete(key);cache.set(key,cached);return cached.bytes;}
 if(!descriptor.path.startsWith('/')||!Number.isInteger(descriptor.bytes)||descriptor.bytes<0||descriptor.bytes>maximum)throw new AssetError(503,'The asset snapshot could not be opened.');
 const response=await binding.fetch(new Request(ORIGIN+descriptor.path));if(!response.ok)throw new AssetError(503,'The asset snapshot is temporarily unavailable.');
 const buffer=new Uint8Array(await response.arrayBuffer());if(buffer.byteLength!==descriptor.bytes||await hash(buffer)!==descriptor.sha256)throw new AssetError(503,'The asset snapshot failed its integrity check.');
 while(cacheBytes+buffer.byteLength>CACHE_LIMIT&&cache.size){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).bytes.byteLength;cache.delete(oldest);}
 if(buffer.byteLength<=CACHE_LIMIT){cache.set(key,{bytes:buffer});cacheBytes+=buffer.byteLength;}return buffer;
}
async function jsonFile(binding,descriptor){return JSON.parse(new TextDecoder().decode(await bytes(binding,descriptor)));}
export async function readDataset(binding,config){return jsonFile(binding,{path:config.manifestPath,bytes:config.manifestBytes,sha256:config.manifestSha256});}
async function file(binding,dataset,name){const descriptor=dataset.files[name];if(!descriptor)throw new AssetError(503,'The asset index is incomplete.');return jsonFile(binding,descriptor);}
function integer(value,fallback,min,max){if(value===null||value===undefined)return fallback;if(!/^\d+$/.test(String(value))||Number(value)<min||Number(value)>max)throw new AssetError(400,`Choose a number between ${min} and ${max}.`);return Number(value);}
function checkVersion(params,dataset){if(params.get('version')&&params.get('version')!==dataset.version)throw new AssetError(409,'This library version has changed. Refresh the manifest before continuing.');}
const publicPack=p=>{const{prefix,name,count,author,license,licencePath,licenceSha256,source,vectorCount,rasterCount}=p;return{prefix,name,count,author,license,licenseUrl:ORIGIN+licencePath,licenseSha256:licenceSha256,source,vectorCount,rasterCount,url:ORIGIN+'/wiki/packs/'+prefix+'/'};};
export function publicAsset(row,dataset){const pack=dataset.packs.find(p=>p.prefix===row.pack);return{id:row.id,name:row.name,label:row.label,pack:publicPack(pack),format:row.format,editable:row.editable,categories:row.categories,aliases:row.aliases,license:row.terms?.license||pack.license,licenseUrl:ORIGIN+pack.licencePath,licenseSha256:pack.licenceSha256,...(row.terms?{terms:row.terms}:{}),...(row.source?{source:row.source}:{}),url:ORIGIN+'/wiki/'+row.pack+'/'+row.name+'/',shirtUrl:ORIGIN+'/?'+new URLSearchParams({workspace:'studio',iconPack:row.pack,iconSearch:row.name}),downloadUrl:ORIGIN+API+'assets/'+encodeURIComponent(row.id)+'/download',svgUrl:ORIGIN+API+'assets/'+encodeURIComponent(row.id)+'/download?format=svg',previewUrl:ORIGIN+(row.preview||API+'assets/'+encodeURIComponent(row.id)+'/preview.svg'),version:dataset.version};}
export async function findAsset(binding,dataset,id){
 if(typeof id!=='string'||id.length>240||!/^[a-z0-9-]+:[a-z0-9-]+$/.test(id))throw new AssetError(404,'Asset not found.');
 const entries=await file(binding,dataset,'lookup/'+hex(shard(id,dataset.lookupShards))+'.json'),entry=entries.find(item=>item[0]===id);if(!entry)throw new AssetError(404,'Asset not found.');
 const rows=await file(binding,dataset,'rows/'+hex(Math.floor(entry[1]/dataset.rowSize))+'.json'),row=rows[entry[1]%dataset.rowSize];if(row?.id!==id)throw new AssetError(503,'The asset index is incomplete.');return row;
}
export async function searchAssets(binding,dataset,params){
 checkVersion(params,dataset);const query=params.get('q')||'';if(query.length>dataset.search.maximumQueryLength)throw new AssetError(400,'Keep search within 160 characters.');
 const tokens=words(query).filter(t=>!dataset.search.stopWords.includes(t));if(tokens.length>8)throw new AssetError(400,'Search with up to eight words.');
 const prefix=params.get('pack')||'',pack=prefix?dataset.packs.find(p=>p.prefix===prefix):undefined;if(prefix&&!pack)throw new AssetError(400,'Unknown asset pack.');
 const format=params.get('format')||'',license=params.get('license')||'';if(format&&!dataset.formats.includes(format))throw new AssetError(400,'Choose SVG or PNG.');if(license&&!dataset.licenses.includes(license))throw new AssetError(400,'Unknown asset licence.');
 const limit=integer(params.get('limit'),48,1,60),offset=integer(params.get('offset'),0,0,dataset.count);let ids;
 for(const token of tokens){const index=await file(binding,dataset,'words/'+hex(shard(token,dataset.wordShards))+'.json'),posting=index[token]||[];ids=ids?intersection(ids,posting):posting;if(!ids.length)break;}
 if(format){const list=(await file(binding,dataset,'formats.json'))[format];ids=ids?intersection(ids,list):list;}
 if(license){const list=(await file(binding,dataset,'licenses.json'))[license];ids=ids?intersection(ids,list):list;}
 if(pack){if(ids)ids=ids.filter(id=>id>=pack.first&&id<pack.first+pack.count);else ids=Array.from({length:pack.count},(_,i)=>pack.first+i);}
 const total=ids?ids.length:dataset.count,selected=ids?ids.slice(offset,offset+limit):Array.from({length:Math.min(limit,Math.max(0,total-offset))},(_,i)=>i+offset),chunks=new Map();
 for(const ordinal of selected){const chunk=Math.floor(ordinal/dataset.rowSize);if(!chunks.has(chunk))chunks.set(chunk,await file(binding,dataset,'rows/'+hex(chunk)+'.json'));}
 const results=selected.map(ordinal=>publicAsset(chunks.get(Math.floor(ordinal/dataset.rowSize))[ordinal%dataset.rowSize],dataset));
 return{version:dataset.version,query,offset,limit,total,nextOffset:offset+results.length<total?offset+results.length:null,results};
}
async function artwork(binding,row){const bundle=await jsonFile(binding,row.bundle);const svg=bundle[row.name]??bundle.icons?.[row.name]??bundle.art?.[row.name];if(typeof svg!=='string'||!svg.startsWith('<svg'))throw new AssetError(503,'The artwork could not be opened.');return svg;}
function headers(contentType,extra={}){return{'Content-Type':contentType,'Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, OPTIONS','Access-Control-Expose-Headers':'ETag, Content-Disposition, X-Asset-SHA256','X-Content-Type-Options':'nosniff',...extra};}
function publicStatic(response){const h=new Headers(response.headers);h.set('Access-Control-Allow-Origin','*');h.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers:h});}
async function download(binding,row,format,preview=false){
 const svg=await artwork(binding,row);let body=svg,type='image/svg+xml; charset=utf-8',extension='svg';
 if(format==='png'||format==='source'&&row.format==='png'){
  if(row.format!=='png')throw new AssetError(400,'This asset has an SVG source. Download SVG to keep its scalable geometry.');
  const match=svg.match(/(?:href|xlink:href)="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);if(!match)throw new AssetError(503,'The original PNG could not be opened.');body=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));type='image/png';extension='png';
  if(row.source?.sha256&&await hash(body)!==row.source.sha256)throw new AssetError(503,'The PNG source failed its integrity check.');
 }
 const digest=await hash(typeof body==='string'?new TextEncoder().encode(body):body);
 return new Response(body,{headers:headers(type,{'Content-Disposition':(preview?'inline':'attachment')+'; filename="'+row.pack+'--'+row.name+'.'+extension+'"','Content-Security-Policy':"sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",ETag:'"'+digest+'"','X-Asset-SHA256':digest})});
}
export async function freeAssetsRoute(request,binding,config){
 const url=new URL(request.url),path=url.pathname;if(!isFreeAssetsPath(path))return null;
 const api=path.startsWith(API);if(request.method==='OPTIONS'&&api)return new Response(null,{status:204,headers:headers('application/json',{'Access-Control-Max-Age':'86400'})});
 if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Use GET, HEAD or OPTIONS.'}),{status:405,headers:headers('application/json',{Allow:'GET, HEAD, OPTIONS'})});
 try{
  if(path==='/wiki')return Response.redirect(ORIGIN+'/wiki/'+url.search,308);
  if(path.startsWith('/wiki/data/')||/^\/wiki\/sitemaps-(?:assets-\d+|packs)\.xml$/.test(path)||path==='/wiki/sitemap.xml'||/\.(?:mjs|css|json)$/.test(path)&&!api)return publicStatic(await binding.fetch(new Request(url,{method:request.method})));
  const dataset=await readDataset(binding,config);let response;
  if(api){
   const route=path.slice(API.length);let value;
   if(route==='manifest')value={schema:dataset.schema,version:dataset.version,count:dataset.count,packCount:dataset.packCount,formats:dataset.formats,licenses:dataset.licenses,search:dataset.search,dataset:ORIGIN+config.manifestPath,datasetSha256:config.manifestSha256,catalogueSha256:dataset.catalogueSha256,openapi:ORIGIN+API+'openapi.json',source:config.repository};
   else if(route==='packs')value={version:dataset.version,results:dataset.packs.map(publicPack)};
   else if(route==='assets')value=await searchAssets(binding,dataset,url.searchParams);
   else if(route==='openapi.json')return publicStatic(await binding.fetch(new Request(ORIGIN+'/wiki/openapi.json')));
   else if(route.startsWith('assets/')){const parts=route.slice(7).split('/');let id;try{id=decodeURIComponent(parts[0]);}catch{throw new AssetError(404,'Asset not found.');}const row=await findAsset(binding,dataset,id);checkVersion(url.searchParams,dataset);
    if(parts.length===1)value=publicAsset(row,dataset);else if(parts.length===2&&['download','preview.svg'].includes(parts[1])){const format=url.searchParams.get('format')||'source';if(!['source','svg','png'].includes(format))throw new AssetError(400,'Choose source, SVG or PNG.');response=await download(binding,row,parts[1]==='preview.svg'?'svg':format,parts[1]==='preview.svg');}else throw new AssetError(404,'API route not found.');
   }else throw new AssetError(404,'API route not found.');
   if(!response)response=new Response(JSON.stringify(value),{headers:headers('application/json; charset=utf-8',{'X-Robots-Tag':'noindex, follow'})});
  }else{
   let html,status=200;
   if(path==='/wiki/')html=renderLibrary(dataset,await searchAssets(binding,dataset,new URLSearchParams([...url.searchParams.entries(),['limit','48']])),config);
   else if(path==='/wiki/packs/')html=renderPacks(dataset,config);
   else if(path==='/wiki/api/')html=renderApiDocs(dataset,config);
   else {const packMatch=path.match(/^\/wiki\/packs\/([a-z0-9-]+)\/$/),assetMatch=path.match(/^\/wiki\/([a-z0-9-]+)\/([a-z0-9-]+)\/$/);
    if(packMatch){const pack=dataset.packs.find(p=>p.prefix===packMatch[1]);if(!pack)throw new AssetError(404,'Asset pack not found.');const page=integer(url.searchParams.get('page'),1,1,Math.ceil(pack.count/48));const results=await searchAssets(binding,dataset,new URLSearchParams({pack:pack.prefix,limit:'48',offset:String((page-1)*48)}));html=renderLibrary(dataset,results,config,pack,page);}
    else if(assetMatch){const row=await findAsset(binding,dataset,assetMatch[1]+':'+assetMatch[2]);html=renderAsset(publicAsset(row,dataset),dataset,config);}
    else throw new AssetError(404,'Page not found.');
   }
   response=new Response(html,{status,headers:headers('text/html; charset=utf-8',{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",...(url.search&&path!='/wiki/packs/'+(url.pathname.split('/')[3]||'')+'/'?{'X-Robots-Tag':'noindex, follow'}:{})})});
  }
  return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
 }catch(error){const status=error instanceof AssetError?error.status:503,message=error instanceof AssetError?error.message:'The library is temporarily unavailable. Please try again.';return new Response(api?JSON.stringify({error:message}):'<h1>'+message+'</h1><p><a href="/wiki/">Open the asset library</a></p>',{status,headers:headers(api?'application/json':'text/html; charset=utf-8',{'Cache-Control':'no-store','X-Robots-Tag':'noindex, follow'})});}
}