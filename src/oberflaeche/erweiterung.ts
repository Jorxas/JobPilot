/* Handshake mit der optionalen JobPilot-Erweiterung (Inhaltsskript auf dieser Seite). Reine Browserlogik, keine Servermodule. */
type Antwort={jobpilotErweiterung:true;art:string;nonce?:string;ok?:boolean;fehler?:string;firma?:string;version?:string|null;veraltet?:boolean};
function anfrage(art:string,daten:Record<string,unknown>,antwortArt:string,wartezeit:number):Promise<Antwort|null>{
 return new Promise(fertig=>{
  const nonce=(globalThis.crypto?.randomUUID?.()||String(Math.random())).slice(0,60);
  const zuhoerer=(e:MessageEvent)=>{const d=e.data as Antwort|null;if(e.source!==window||e.origin!==location.origin||!d||d.jobpilotErweiterung!==true||d.art!==antwortArt||d.nonce!==nonce)return;ende(d);};
  const zeit=setTimeout(()=>ende(null),wartezeit);
  function ende(wert:Antwort|null){clearTimeout(zeit);window.removeEventListener('message',zuhoerer);fertig(wert);}
  window.addEventListener('message',zuhoerer);
  window.postMessage({jobpilotErweiterung:true,art,nonce,...daten},location.origin);
 });
}
export async function erweiterungPruefen():Promise<{da:boolean;veraltet:boolean}>{const r=await anfrage('ping',{},'pong',700);return {da:!!r&&!r.veraltet,veraltet:!!r?.veraltet};}
export async function erweiterungStarten(id:string):Promise<{ok:boolean;fehler?:string;firma?:string}>{
 const r=await anfrage('start',{id},'gestartet',20000);
 return r?{ok:r.ok===true,fehler:r.fehler,firma:r.firma}:{ok:false,fehler:'Die Erweiterung hat nicht geantwortet. Bitte diese Seite neu laden.'};
}
