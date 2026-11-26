// Echte Erweiterung und lokaler Server; nur synthetische Profile, PDF und Formulare.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),puppeteer=require('puppeteer-core');
(async()=>{
 const {erstelleServer}=await import('../dist/server.mjs');
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'jobpilot-extension-')),ext=path.join(temp,'extension'),daten=path.join(temp,'daten');await fs.mkdir(daten);
 const app={id:'synth',source:'bundesagentur',externalRef:'synth',title:'Werkstudent IT',company:'Testbetrieb',status:'pending',url:'https://arbeitgeber.example.test/formular',score:0,description:'Synthetischer Test mit Python und SQL.'};
 const zustand={modus:'live',stellen:[app],runde:0,seiten:{},berichte:[]};await fs.writeFile(path.join(daten,'zustand.json'),JSON.stringify(zustand));
 const server=erstelleServer({datenordner:daten,live:true,geokodierung:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));const basis='http://127.0.0.1:'+server.address().port;
 await fs.cp('public/erweiterung',ext,{recursive:true});const manifest=JSON.parse(await fs.readFile(path.join(ext,'manifest.json'),'utf8'));manifest.content_scripts[0].matches=[basis+'/*'];await fs.writeFile(path.join(ext,'manifest.json'),JSON.stringify(manifest));
 const executablePath=process.env.BROWSER_PFAD||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium'].find(p=>require('node:fs').existsSync(p));
 const browser=await puppeteer.launch({executablePath,headless:true,pipe:true,enableExtensions:true,userDataDir:path.join(temp,'browser'),args:['--no-sandbox']});
 const form='<!doctype html><meta charset="utf-8"><title>Synthetisches Arbeitgeberformular</title><form onsubmit="event.preventDefault();window.abgaben++"><label>Vorname<input name="firstName"></label><label>Nachname<input name="lastName" value="Bestehend"></label><label>Lieblingseditor<input id="editor"></label><label><input type="checkbox" id="consent">Ich stimme der Datenschutzerklärung zu</label><label>Lebenslauf<input type="file" id="cv"></label><label>Anschreiben<input type="file" id="letter"></label><label>Leistungsübersicht<input type="file" id="transcript"></label><button>Absenden</button></form><script>window.abgaben=0</script>';
 const api=async(p,body)=>{const r=await fetch(basis+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert(r.ok,await r.clone().text());return r.json();};
 let worker;
 try{
  const extensionId=await browser.installExtension(ext);
  console.log('Erweiterung installiert; Profil und Dossier werden geprüft.');
  const jp=await browser.newPage(),errors=[];jp.on('pageerror',e=>errors.push(e.message));await jp.goto(basis+'/profile');await jp.waitForSelector('input[name=firstName]');
  await jp.type('input[name=firstName]','Testa');await jp.click('form button');await jp.waitForFunction(()=>document.querySelector('[role=status]')?.textContent.includes('Profil und Antworten gespeichert'));
  worker=await (await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().startsWith('chrome-extension://'))).worker();
  await jp.goto(basis+'/dossier/synth');await jp.waitForSelector('fieldset');
  const files=await jp.$$('input[type=file]');
  for(const [index,kind] of ['cv','letter'].entries()){await fs.writeFile(path.join(temp,kind+'.pdf'),'%PDF-1.4\nSynthetischer Test\n%%EOF');await files[index].uploadFile(path.join(temp,kind+'.pdf'));await jp.waitForFunction(name=>document.body.textContent.includes('Ansehen: '+name),{},kind+'.pdf');}
  await jp.click('fieldset>label:last-of-type input[type=checkbox]');await jp.click('fieldset>button:last-child');await jp.waitForFunction(()=>document.body.textContent.includes('Unterlagen gespeichert. Kein Versand.'));
  await fs.mkdir('.nachweise/formular',{recursive:true});await jp.setViewport({width:1440,height:1000});await jp.screenshot({path:'.nachweise/formular/dossier-desktop.png',fullPage:true});
  for(const width of [375,320]){await jp.setViewport({width,height:1000});assert(await jp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Dossier ohne Überlauf bei '+width);}
  await jp.screenshot({path:'.nachweise/formular/dossier-mobil.png',fullPage:true});await jp.setViewport({width:1440,height:1000});
  // Start über den echten Knopf, Handshake und Server; die erfundene HTTPS-Seite wird vollständig ersetzt.
  const targetPromise=browser.waitForTarget(t=>t.url()===app.url);
  await jp.$$eval('button',buttons=>{const b=buttons.find(b=>b.textContent==='Mit Assistent öffnen (neuer Tab)');b.dataset.testStart='true';});await jp.click('[data-test-start]');
  const page=await(await targetPromise).page();await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('https://arbeitgeber.example.test/')?r.respond({status:200,contentType:'text/html',body:form}):r.abort());await page.goto(app.url);await page.waitForSelector('[data-jobpilot-assistent]');
  const click=async id=>{const h=await page.evaluateHandle(id=>document.querySelector('[data-jobpilot-assistent]').shadowRoot.getElementById(id),id);await h.asElement().click();await h.dispose();};
  assert.equal(await page.$eval('[name=firstName]',e=>e.value),'','Kein Ausfüllen beim Öffnen');
  await click('blase');await page.waitForFunction(()=>!document.querySelector('[data-jobpilot-assistent]').shadowRoot.getElementById('fuellen').disabled);await click('fuellen');await page.waitForFunction(()=>document.querySelector('[name=firstName]').value==='Testa');await page.waitForFunction(()=>document.querySelector('#letter').files.length===1);
  assert.equal(await page.$eval('[name=lastName]',e=>e.value),'Bestehend');assert.equal(await page.$eval('#consent',e=>e.checked),false);assert.equal(await page.$eval('#transcript',e=>e.files.length),0);assert.equal(await page.evaluate(()=>window.abgaben),0);
  await page.waitForFunction(()=>document.querySelector('[data-jobpilot-assistent]').shadowRoot.querySelector('#fragen label'));
  const q=await page.evaluateHandle(()=>[...document.querySelector('[data-jobpilot-assistent]').shadowRoot.querySelectorAll('#fragen label')].find(e=>/lieblingseditor/i.test(e.textContent)));await(await q.evaluateHandle(e=>e.querySelector('input'))).asElement().type('Vim');await(await q.evaluateHandle(e=>e.querySelector('button'))).asElement().click();await page.waitForFunction(()=>document.querySelector('#editor').value==='Vim');
  const saved=await(await fetch(basis+'/api/profil')).json();assert.equal(saved.bank[0].answer,'Vim');
  console.log('JobPilot-Modus: Profil, PDF, Antwortbank und kein Absenden geprüft.');
  // Freie Seite mit JobPilot-Profil: derselbe Motor und dieselbe Bank, aber keine PDF ohne Bewerbung.
  const frei=await browser.newPage();await frei.setRequestInterception(true);frei.on('request',r=>r.respond({status:200,contentType:'text/html',body:form}));await frei.goto(app.url+'?frei');await frei.bringToFront();const tabs=await worker.evaluate(async()=>chrome.tabs.query({}));const freiTab=tabs.find(t=>t.url===app.url+'?frei');assert(freiTab);
  assert.equal((await worker.evaluate(id=>freiStarten({tabId:id},{}),freiTab.id)).ok,true);await frei.waitForFunction(()=>document.querySelector('[name=firstName]').value==='Testa');await frei.waitForFunction(()=>document.querySelector('#editor').value==='Vim');assert.equal(await frei.$eval('#cv',e=>e.files.length),0);assert.equal(await frei.evaluate(()=>window.abgaben),0);
  // Eigenständig ohne JobPilot-Tab und ohne Server: Popup-Profil, Antwortbank, PDF und Ausfüllen.
  console.log('Freier Tab geprüft; JobPilot wird für den eigenständigen Modus beendet.');
  await jp.close();server.closeAllConnections();await new Promise(r=>server.close(r));
  await worker.evaluate(()=>chrome.storage.local.set({profile:{firstName:'Autonom'},profileInitialized:true,bank:[],dossier:{}}));
  const popup=await browser.newPage();await popup.goto('chrome-extension://'+extensionId+'/popup.html');await popup.waitForFunction(()=>!document.querySelector('#autofill').disabled);
  // Popup in einem eigenen Testtab: nur die aktive Zieltab-Abfrage wird auf das synthetische Formular festgelegt.
  await popup.evaluate(id=>{chrome.tabs.query=async()=>[{id}];},freiTab.id);
  await frei.reload();
  await fs.writeFile(path.join(temp,'cv.pdf'),Buffer.from('%PDF-1.4\nSynthetischer Test\n%%EOF'));
  await popup.$eval('#docs-panel',e=>e.open=true);await(await popup.$('#doc-cv')).uploadFile(path.join(temp,'cv.pdf'));await popup.waitForFunction(()=>document.querySelector('#doc-list').textContent.includes('cv.pdf'));
  await popup.click('#autofill');
  await frei.waitForFunction(()=>document.querySelector('[name=firstName]').value==='Autonom',{timeout:10000,polling:100});
  await frei.waitForFunction(()=>document.querySelector('#cv').files.length===1,{polling:100});assert.equal(await frei.evaluate(()=>window.abgaben),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({bestanden:true,echteErweiterung:true,jobpilotProfil:true,gezieltePdf:true,antwortMerken:true,freierTabOhnePdf:true,ohneJobpilot:true,keineAbgabe:true}));
 }finally{await browser.close();server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+'jobpilot-extension-'));await fs.rm(temp,{recursive:true,force:true,maxRetries:5});}
})().catch(e=>{console.error(e);process.exitCode=1;});
