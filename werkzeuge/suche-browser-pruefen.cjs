// Echte lokale Oberfläche, aber Such-POST im Browser ersetzt: keine Plattformanfrage.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),puppeteer=require('puppeteer-core');
(async()=>{
 const {erstelleServer}=await import('../dist/server.mjs');
 const ordner=await fs.mkdtemp(path.join(os.tmpdir(),'jobpilot-suchfenster-'));
 const tag=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const artikel=(id,title,company,status='pending')=>({id,title,company,status,addedAt:tag,source:'indeed',location:'Gießen',description:'Originalbeschreibung mit Python und SQL. '.repeat(8),score:60,externalRef:id,url:'https://de.indeed.com/viewjob?jk='+id,complete:true});
 const zustand={stellen:[artikel('a','Werkstudent Data','Beispiel Datenwerk'),artikel('b','Praktikum Software','Beispiel Softwerk'),artikel('c','Werkstudent Buchhaltung','Beispiel Finanzen'),artikel('d','Werkstudent Data','Bekannte Firma'),artikel('e','Werkstudent IT','Bekannte Firma','applied'),{...artikel('alt','Werkstudent IT','Altfund Systeme'),addedAt:'2020-01-01'},{...artikel('unbekannt','Werkstudent IT','Ohne Funddatum'),addedAt:undefined}],runde:0,seiten:{},berichte:[],modus:'live',auftrag:{city:'Gießen',radius:50,keywordList:['Werkstudent Data','Praktikum Software'],quellen:['indeed','linkedin'],breit:false}};
 const datei=path.join(ordner,'zustand.json');await fs.writeFile(datei,JSON.stringify(zustand));const vorher=await fs.readFile(datei,'utf8');
 const server=erstelleServer({datenordner:ordner,live:true,geokodierung:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const basis='http://127.0.0.1:'+server.address().port;
 const browserPfad=process.env.BROWSER_PFAD||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].find(p=>require('node:fs').existsSync(p));
 const browser=await puppeteer.launch({headless:true,executablePath:browserPfad});
 try{const page=await browser.newPage(),fehler=[],extern=[];let starts=0,auftrag;
  await page.evaluateOnNewDocument(()=>{const Echt=Date;window.testZeit=Echt.now();globalThis.Date=class extends Echt{constructor(...a){super(...(a.length?a:[window.testZeit]));}static now(){return window.testZeit;}};});
  page.on('pageerror',e=>fehler.push(e.message));await page.setRequestInterception(true);
  page.on('request',req=>{if(new URL(req.url()).origin!==basis){extern.push(req.url());return req.abort();}if(req.url().endsWith('/api/suche')&&req.method()==='POST'){starts++;auftrag=JSON.parse(req.postData());return req.respond({status:202,contentType:'application/json',body:JSON.stringify({gestartet:true,zustand:{...zustand,lauf:{zustand:'laeuft',beginn:new Date().toISOString(),abgeschlossen:0,durchlaeufe:5}}})});}req.continue();});
  await page.setViewport({width:1440,height:1050});await page.goto(basis,{waitUntil:'networkidle0'});assert.equal(new URL(page.url()).pathname,'/offres');await page.waitForSelector('.jobsuche-treffer');
  assert.equal(await page.$$eval('.jobsuche-treffer',e=>e.length),2,'Nur IT, keine neue Fiche für beworbene Firma');assert.equal(await page.$('script[src="./assets/demo.js"]'),null,'Kein Demo-Datenadapter am lokalen Suchfenster');
  assert.equal(await page.$('#suchdetails'),null,'Suchdetails seit 27. November entfernt');assert.equal(await page.$eval('[data-suchprofil]',e=>e.open),false);await page.click('[data-suchprofil]>summary');assert.equal(await page.$$eval('[data-chip]',e=>e.length),2,'Gespeicherte Suchbegriffe statt neuer Standardliste');await page.click('[data-suchprofil]>summary');
  await page.click('.jobsuche-leiste button[type=submit]');await page.waitForFunction(()=>document.querySelector('.jobsuche-meldung')?.textContent?.includes('Suche gestartet'));
  assert.equal(starts,1);assert.equal(auftrag.live,true);assert.equal(auftrag.indeedProvider,'auto');assert.equal(auftrag.keywordList.length,2);assert.equal(auftrag.radius,50);assert.deepEqual(auftrag.quellen,['indeed','linkedin']);
  await page.click('[aria-label="Vertragsart filtern"] button:last-child');assert.equal(await page.$$eval('.jobsuche-treffer',e=>e.length),1);
  for(const width of [375,320]){await page.setViewport({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Ohne Überlauf bei '+width);await page.click('.jobsuche-treffer button');assert(await page.$eval('.jobsuche-detail',e=>e.getBoundingClientRect().width>0));await page.click('.jobsuche-zurueck');}
  await page.evaluate(()=>window.testZeit+=86400000);await page.waitForFunction(()=>document.querySelectorAll('.jobsuche-treffer').length===0);assert.equal(await page.$('.jobsuche-detail'),null);await page.goto(basis+'/suivi',{waitUntil:'networkidle0'});await page.waitForSelector('.stellenzeile');assert((await page.$eval('main',e=>e.textContent)).includes('Altfund Systeme'),'Ältere Funde bleiben in Stellenübersicht');
  const nachher=JSON.parse(await fs.readFile(datei,'utf8'));assert.deepEqual(nachher.stellen,JSON.parse(vorher).stellen,'Keine echte Suche oder Änderung der Angebote');assert.equal(nachher.runde,0);assert.equal(nachher.auftrag.keywordList.length,2);assert.match(nachher.auftrag.bestaetigt,/^\d{4}-/,'Kriterien vor dem ausdrücklichen Start gespeichert');assert.deepEqual(fehler,[]);assert.deepEqual(extern,[]);
  console.log(JSON.stringify({bestanden:true,lokaleSuchseite:true,keinDemoAdapter:true,einSuchpost:true,filterUndHistorie:true,mobil375und320:true,keineEchteSuche:true}));
 }finally{await browser.close();await new Promise(r=>server.close(r));await fs.rm(ordner,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
