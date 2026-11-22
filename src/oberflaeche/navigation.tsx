import React from 'react';

export const bereiche = [
 {href:'/offres',name:'Stellensuche',zeichen:'⌕'},
 {href:'/suivi',name:'Stellenübersicht',zeichen:'▦'},
 {href:'/suivi#antworten',name:'Antworten',zeichen:'✉'},
 {href:'/profile',name:'Mein Profil',zeichen:'◉'},
 {href:'/settings',name:'Einstellungen',zeichen:'⚙'},
];
export function JobPilotNavigation({aktiv}:{aktiv:string}) {
 return <aside className="seitenleiste"><a className="marke" href="/suivi"><span className="markenzeichen" aria-hidden="true">✦</span>JobPilot<span className="punkt">.</span></a><div className="raum">MEIN BEWERBUNGSRAUM</div>
 <nav aria-label="Hauptnavigation">{bereiche.map(b=><a key={b.href} href={b.href} aria-label={b.name} aria-current={aktiv===b.href?'page':undefined} className={aktiv===b.href?'aktiv':''}><span className="navigationssymbol" aria-hidden="true">{b.zeichen}</span>{b.name}</a>)}</nav>
 <div className="seitenfuss"><span className="onlinepunkt"/>Öffentliche Demo<p>Erfundene Bewerbungen.<br/>Die echte Oberfläche.</p></div></aside>;
}
