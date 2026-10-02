const V='nutriflow-v5';
self.addEventListener('install',e=>{e.waitUntil((async()=>{
  const scope=new URL(self.registration.scope),index=new URL('./index.html',scope),response=await fetch(index);
  if(!response.ok)throw new Error(`Não foi possível pré-carregar o app: ${response.status}`);
  const html=await response.clone().text(),resources=[scope.href,index.href,...Array.from(html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/gi),m=>new URL(m[1],index).href).filter(url=>new URL(url).origin===scope.origin&&new URL(url).pathname.startsWith(scope.pathname))];
  await(await caches.open(V)).addAll([...new Set(resources)]);
  await self.skipWaiting();
})())});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(
    fetch(e.request,{cache:'no-cache'}).then(n=>{
      if(n.ok){const c=n.clone();caches.open(V).then(x=>x.put(e.request,c))}
      return n;
    }).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match(new URL('./index.html',self.registration.scope))))
  );
});