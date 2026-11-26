import React from 'react';
import {t} from './sprache';

export const bereiche = [
 {href:'/offres',name:()=>t('Stellensuche',"Recherche d'emploi"),zeichen:'⌕'},
 {href:'/suivi',name:()=>t('Stellenübersicht','Aperçu des offres'),zeichen:'▦'},
 {href:'/suivi#antworten',name:()=>t('Antworten','Réponses'),zeichen:'✉'},
 {href:'/profile',name:()=>t('Mein Profil','Mon profil'),zeichen:'◉'},
 {href:'/settings',name:()=>t('Einstellungen','Paramètres'),zeichen:'⚙'},
];
export function JobPilotNavigation({aktiv,lokaleSuche=false}:{aktiv:string;lokaleSuche?:boolean}) {
 return <aside className="seitenleiste"><a className="marke" href="/suivi"><span className="markenzeichen" aria-hidden="true">✦</span>JobPilot<span className="punkt">.</span></a><div className="raum">{t('MEIN BEWERBUNGSRAUM','MON ESPACE CANDIDATURES')}</div>
 <nav aria-label={t('Hauptnavigation','Navigation principale')}>{bereiche.map(b=><a key={b.href} href={lokaleSuche?(b.href==='/suivi'?'/index.html':b.href==='/suivi#antworten'?'/index.html#antworten':b.href==='/profile'?'/profile':b.href==='/settings'?'#suchdetails':b.href):b.href} onClick={lokaleSuche&&b.href==='/settings'?()=>{const d=document.getElementById('suchdetails');if(d instanceof HTMLDetailsElement)d.open=true;}:undefined} aria-label={b.name()} aria-current={aktiv===b.href?'page':undefined} className={aktiv===b.href?'aktiv':''}><span className="navigationssymbol" aria-hidden="true">{b.zeichen}</span>{b.name()}</a>)}</nav>
 <div className="seitenfuss"><span className="onlinepunkt"/>{lokaleSuche?'Lokale Stellensuche':t('Öffentliche Demo','Démo publique')}<p>{lokaleSuche?'Ergebnisse auf deinem PC.':t('Erfundene Bewerbungen.','Candidatures fictives.')}<br/>{lokaleSuche?'Übersicht und Antworten: Demo.':t('Die echte Oberfläche.',"L'interface réelle.")}</p></div></aside>;
}
