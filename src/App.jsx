// App.jsx — SupervisionCI v2.0
// ============================================================
// Application complète : React + Supabase + Groq IA + Offline
// ============================================================
// INSTALLATION :
//   npm install @supabase/supabase-js
//   npm install @capacitor/core @capacitor/android  (pour APK)
//   npx cap init SupervisionCI com.supervisionci.app
//   npx cap add android
//   npx cap sync
//
// FICHIER .env à créer à la racine :
//   VITE_SUPABASE_URL=https://gyjsmjenzlmffneuivg.supabase.co
//   VITE_SUPABASE_ANON_KEY=ta_nouvelle_clé_après_rotation
//   VITE_GROQ_API_KEY=gsk_ta_clé_groq
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// ── SUPABASE ──────────────────────────────────────────────
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ── GROQ ──────────────────────────────────────────────────
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

// ── GRILLE OFFICIELLE PAR DÉFAUT ──────────────────────────
const GRILLE_DEFAULT = {
  id: 'grille-ms-benin-officielle',
  titre: 'Grille CI – Ministère Santé Bénin (Officielle)',
  description: 'Grille semestrielle de suivi du mécanisme de contrôle interne',
  source: 'builtin',
  synced: 1,
  domaines: [
    { id:'d1', titre:'Organisation administrative, financière et comptable', points:[
      {id:'d1p1',controle:'Existence des textes réglementaires (acte de création, règlement intérieur, organigramme)',indicateur:'Oui / Non',risque:'Non-conformité réglementaire'},
      {id:'d1p2',controle:'Existence et fonctionnement des instances réglementaires (CODIR, EEZS, COSA, CZS)',indicateur:'Oui / Non',risque:'Dysfonctionnement institutionnel'},
      {id:'d1p3',controle:'Existence des outils recommandés (registres, manuel de procédures, cartographie des risques)',indicateur:'Oui / Non',risque:'Désorganisation'},
      {id:'d1p4',controle:'Existence et tenue régulière d\'un logiciel de gestion comptable',indicateur:'Oui / Non',risque:'Mauvaise traçabilité'},
      {id:'d1p5',controle:'Disponibilité des documents comptables obligatoires (livres journaux, grand livre, balance)',indicateur:'Oui / Non',risque:'Non-conformité comptable'},
    ]},
    { id:'d2', titre:'Gestion budgétaire', points:[
      {id:'d2p1',controle:'Existence de PTA et budget votés à bonne date (PV de vote et rapport d\'adoption)',indicateur:'Date de vote',risque:'Mauvaise planification'},
      {id:'d2p2',controle:'Disponibilité du rapport de suivi périodique du PTA et du budget (trimestriel)',indicateur:'Nombre de rapports',risque:'Dépassement budgétaire'},
      {id:'d2p3',controle:'Existence de lignes budgétaires en dépassement sans collectif budgétaire',indicateur:'Oui / Non',risque:'Irrégularités budgétaires'},
    ]},
    { id:'d3', titre:'Gestion de la trésorerie', points:[
      {id:'d3p1',controle:'Existence et tenue correcte d\'un livre de banque (sans ratures ni surcharges)',indicateur:'Oui / Non',risque:'Erreurs comptables'},
      {id:'d3p2',controle:'Existence de tous les relevés bancaires mensuels de la période',indicateur:'Nombre de relevés',risque:'Manque de traçabilité'},
      {id:'d3p3',controle:'Existence des états de rapprochement bancaires mensuels',indicateur:'Nombre/mois',risque:'Erreurs non détectées'},
      {id:'d3p4',controle:'Régularité et intégralité des versements de recettes à la banque',indicateur:'Fréquence',risque:'Détournement'},
      {id:'d3p5',controle:'Réalisation régulière de contrôles de caisse (PV de contrôle)',indicateur:'Nombre/mois',risque:'Vol, fraude'},
      {id:'d3p6',controle:'Mesures de sécurité de la caisse (coffre-fort, grillage, accès limité)',indicateur:'Oui / Non',risque:'Vol'},
      {id:'d3p7',controle:'Prélèvements à la source TVA, AIB reversés à bonne date',indicateur:'Oui / Non',risque:'Redressement fiscal'},
    ]},
    { id:'d4', titre:'Passation des marchés', points:[
      {id:'d4p1',controle:'Existence des organes de passation de marchés publics (textes en vigueur)',indicateur:'Oui / Non',risque:'Non-conformité'},
      {id:'d4p2',controle:'Plan de Passation des Marchés saisi et validé sur la plateforme dédiée',indicateur:'Oui / Non',risque:'Irrégularités'},
      {id:'d4p3',controle:'Inscription de tous les marchés au PTA et PPM',indicateur:'Oui / Non',risque:'Marchés non tracés'},
      {id:'d4p4',controle:'Enregistrement de tous les contrats et bons de commande au domaine',indicateur:'Oui / Non',risque:'Perte de documents'},
    ]},
  ],
};

// ══════════════════════════════════════════════════════════
// COUCHE DB — Offline-first (localStorage + Supabase)
// ══════════════════════════════════════════════════════════
const LS = {
  get:    key => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch { return []; } },
  set:    (key,v) => localStorage.setItem(key, JSON.stringify(v)),
  getObj: key => { try { return JSON.parse(localStorage.getItem(key)||'{}'); } catch { return {}; } },
  setObj: (key,v) => localStorage.setItem(key, JSON.stringify(v)),
};
const K = { grilles:'sci_g', missions:'sci_m', reponses:'sci_r', rapports:'sci_rap', queue:'sci_q' };

function enqueue(table, action, data) {
  const q = LS.get(K.queue);
  q.push({ id:`q_${Date.now()}_${Math.random().toString(36).slice(2)}`, table, action, data });
  LS.set(K.queue, q);
}

function cleanForDB(table, d) {
  if (table==='missions') return {
    id:String(d.id), nom:d.nom, structure:d.structure, localisation:d.localisation||null,
    date:d.date, superviseur:d.superviseur, objectif:d.objectif||null,
    type:d.type||'Contrôle interne', statut:d.statut||'en_cours',
    grille_id:d.grilleId||d.grille_id||null, updated_at:new Date().toISOString(),
  };
  if (table==='grilles') return {
    id:String(d.id), titre:d.titre, description:d.description||null,
    source:d.source||'manual', domaines:d.domaines||[], updated_at:new Date().toISOString(),
  };
  if (table==='reponses') return {
    id:String(d.id), mission_id:String(d.missionId||d.mission_id),
    point_id:d.pointId||d.point_id, valeur:d.valeur||null,
    observation:d.observation||null, note:d.note||null, updated_at:new Date().toISOString(),
  };
  if (table==='rapports') return {
    id:String(d.id), mission_id:String(d.missionId||d.mission_id),
    contenu_ia:d.contenuIa||null, taux:d.taux||null,
    nb_conformes:d.nbConformes||0, nb_nonconformes:d.nbNonConformes||0,
  };
  return d;
}

async function upsertSupabase(table, data) {
  if (!supabase) return false;
  const { error } = await supabase.from(table).upsert(cleanForDB(table, data));
  return !error;
}

async function syncQueue() {
  if (!supabase || !navigator.onLine) return;
  const q = LS.get(K.queue);
  const remaining = [];
  for (const item of q) {
    try {
      let ok = false;
      if (item.action==='upsert') ok = await upsertSupabase(item.table, item.data);
      else if (item.action==='delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', String(item.data.id));
        ok = !error;
      }
      if (!ok) remaining.push(item);
    } catch { remaining.push(item); }
  }
  LS.set(K.queue, remaining);
}

// ── GRILLES ───────────────────────────────────────────────
const GDB = {
  getAll: () => LS.get(K.grilles),
  async save(g) {
    const all = LS.get(K.grilles);
    const i = all.findIndex(x=>x.id===g.id);
    const d = {...g, synced:0, _ts:Date.now()};
    if (i>=0) all[i]=d; else all.push(d);
    LS.set(K.grilles, all);
    const ok = await upsertSupabase('grilles', d);
    if (!ok) enqueue('grilles','upsert',d);
    else { LS.set(K.grilles, LS.get(K.grilles).map(x=>x.id===g.id?{...x,synced:1}:x)); }
  },
  async delete(id) {
    LS.set(K.grilles, LS.get(K.grilles).filter(x=>x.id!==id));
    if (navigator.onLine && supabase) await supabase.from('grilles').delete().eq('id',id);
    else enqueue('grilles','delete',{id});
  },
};

// ── MISSIONS ──────────────────────────────────────────────
const MDB = {
  getAll: () => LS.get(K.missions),
  getById: id => LS.get(K.missions).find(m=>String(m.id)===String(id)),
  async save(m) {
    const all = LS.get(K.missions);
    const i = all.findIndex(x=>String(x.id)===String(m.id));
    const d = {...m, synced:0, _ts:Date.now()};
    if (i>=0) all[i]=d; else all.push(d);
    LS.set(K.missions, all);
    const ok = await upsertSupabase('missions', d);
    if (!ok) enqueue('missions','upsert',d);
    else { LS.set(K.missions, LS.get(K.missions).map(x=>String(x.id)===String(m.id)?{...x,synced:1}:x)); }
  },
  async delete(id) {
    LS.set(K.missions, LS.get(K.missions).filter(x=>String(x.id)!==String(id)));
    if (navigator.onLine && supabase) await supabase.from('missions').delete().eq('id',String(id));
    else enqueue('missions','delete',{id:String(id)});
  },
};

// ── RÉPONSES ──────────────────────────────────────────────
const RDB = {
  getForMission: id => LS.getObj(K.reponses)[String(id)] || {},
  async saveAll(missionId, reponses) {
    const all = LS.getObj(K.reponses);
    all[String(missionId)] = reponses;
    LS.setObj(K.reponses, all);
    if (supabase && navigator.onLine) {
      const rows = Object.entries(reponses).map(([pid,r])=>cleanForDB('reponses',{
        id:`${missionId}_${pid}`, missionId:String(missionId), pointId:pid, ...r,
      }));
      if (rows.length) {
        const {error} = await supabase.from('reponses').upsert(rows);
        if (error) rows.forEach(r=>enqueue('reponses','upsert',r));
      }
    } else {
      Object.entries(reponses).forEach(([pid,r])=>enqueue('reponses','upsert',{
        id:`${missionId}_${pid}`, missionId:String(missionId), pointId:pid, ...r,
      }));
    }
  },
};

// ── RAPPORTS ──────────────────────────────────────────────
const RapDB = {
  getForMission: id => LS.get(K.rapports).find(r=>String(r.missionId)===String(id))||null,
  async save(rap) {
    const all = LS.get(K.rapports);
    const i = all.findIndex(r=>String(r.missionId)===String(rap.missionId));
    const d = {...rap, id:rap.id||`rap_${Date.now()}`, synced:0};
    if (i>=0) all[i]=d; else all.push(d);
    LS.set(K.rapports, all);
    const ok = await upsertSupabase('rapports', d);
    if (!ok) enqueue('rapports','upsert',d);
  },
};

// ══════════════════════════════════════════════════════════
// SERVICE IA — Groq + Fallback local
// ══════════════════════════════════════════════════════════
function computeStats(reponses, domaines) {
  let total=0,oui=0,non=0,na=0;
  domaines?.forEach(d=>d.points.forEach(p=>{
    const r=reponses[p.id];
    if(r?.valeur==='oui'){total++;oui++;}
    else if(r?.valeur==='non'){total++;non++;}
    else if(r?.valeur==='na') na++;
  }));
  return {total,oui,non,na,taux:total>0?Math.round((oui/total)*100):null};
}

async function genererRapportIA(mission, grille, reponses) {
  const stats = computeStats(reponses, grille.domaines);
  const ncs = [];
  grille.domaines.forEach(d=>d.points.forEach(p=>{
    const r=reponses[p.id];
    if(r?.valeur==='non') ncs.push(`• [${d.titre}] ${p.controle} → ${p.risque}${r.observation?` | ${r.observation}`:''}`);
  }));

  const prompt = `Expert contrôle interne hospitalier Bénin.
Mission: "${mission.nom}" | Structure: "${mission.structure}" | Date: ${mission.date} | Superviseur: ${mission.superviseur}
Taux: ${stats.taux}% | Conformes: ${stats.oui}/${stats.total} | Non-conformités: ${stats.non}
Non-conformités:\n${ncs.join('\n')||'Aucune'}

Rédige en français un rapport officiel avec :
1. RÉSUMÉ EXÉCUTIF (2-3 phrases)
2. POINTS CRITIQUES (3-5 points urgents)
3. RECOMMANDATIONS PRIORITAIRES (6-8 actions IMMÉDIAT/COURT TERME/MOYEN TERME)
4. CONCLUSION (niveau : Insuffisant / En développement / Satisfaisant / Exemplaire)
Ton administratif professionnel, contexte béninois.`;

  // Essayer Groq
  if (GROQ_KEY && GROQ_KEY !== 'COLLE_TA_CLÉ_GROQ_ICI' && navigator.onLine) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${GROQ_KEY}`},
        body:JSON.stringify({model:'llama3-70b-8192',messages:[{role:'user',content:prompt}],max_tokens:1500,temperature:0.4}),
      });
      if (res.ok) {
        const data = await res.json();
        return {source:'groq', contenu:data.choices?.[0]?.message?.content||''};
      }
    } catch {}
  }

  // Fallback local
  const niveau = stats.taux>=80?'SATISFAISANT':stats.taux>=60?'EN DÉVELOPPEMENT':'INSUFFISANT';
  return {
    source:'local',
    contenu:`1. RÉSUMÉ EXÉCUTIF\nLa mission révèle un niveau de contrôle interne ${niveau.toLowerCase()} (${stats.taux??'—'}%). Sur ${stats.total} points évalués : ${stats.oui} conformes, ${stats.non} non-conformes.\n\n2. POINTS CRITIQUES\n${ncs.length?ncs.slice(0,5).join('\n'):'Aucune non-conformité critique.'}\n\n3. RECOMMANDATIONS PRIORITAIRES\nIMMÉDIAT : Corriger les ${stats.non} non-conformité(s) identifiée(s).\nCOURT TERME : Former le personnel sur les procédures de contrôle interne.\nMOYEN TERME : Mission de suivi dans 3 mois pour vérifier l'implémentation.\n\n4. CONCLUSION\nNiveau : ${niveau}. ${stats.taux>=80?'Le dispositif de contrôle interne est globalement satisfaisant.':stats.taux>=60?'Des améliorations significatives sont nécessaires.':'Une intervention urgente est requise pour corriger les défaillances identifiées.'}\n\n[Rapport généré localement — SupervisionCI v2.0]`,
  };
}

// ══════════════════════════════════════════════════════════
// COMPOSANTS UI
// ══════════════════════════════════════════════════════════
const S = {
  page:  {minHeight:'100vh',background:'#050d1a',color:'#e2e8f0',fontFamily:"'DM Sans','Segoe UI',sans-serif"},
  card:  {background:'#0c1a2e',border:'1px solid #1a2d48',borderRadius:14},
  input: {width:'100%',background:'#071120',border:'1px solid #1a2d48',borderRadius:10,padding:'10px 14px',color:'#e2e8f0',fontSize:14,fontFamily:'inherit',boxSizing:'border-box',outline:'none'},
  hdr:   {background:'linear-gradient(135deg,#071120,#0c1a2e)',borderBottom:'1px solid #1a2d48',padding:'14px 20px',position:'sticky',top:0,zIndex:50},
};

function getColor(t){if(t===null)return'#64748b';if(t>=80)return'#10b981';if(t>=60)return'#f59e0b';return'#ef4444';}
function getLabel(t){if(t===null)return'Non évalué';if(t>=80)return'Satisfaisant';if(t>=60)return'À améliorer';return'Critique';}

const uid = ()=>Math.random().toString(36).slice(2,9);

const Icon = ({n,s=18,c='currentColor'})=>{
  const d={
    plus:<path d="M12 5v14M5 12h14" stroke={c} strokeWidth="2" strokeLinecap="round"/>,
    x:<path d="M18 6L6 18M6 6l12 12" stroke={c} strokeWidth="2" strokeLinecap="round"/>,
    back:<polyline points="15 18 9 12 15 6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    check:<path d="M20 6L9 17l-5-5" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>,
    dl:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={c} strokeWidth="2" strokeLinecap="round"/><polyline points="7 10 12 15 17 10" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="15" x2="12" y2="3" stroke={c} strokeWidth="2" strokeLinecap="round"/></>,
    ul:<><polyline points="16 16 12 12 8 16" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="12" x2="12" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round"/></>,
    clip:<><rect x="9" y="2" width="6" height="4" rx="1" stroke={c} strokeWidth="1.8" fill="none"/><path d="M8 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2h-2" stroke={c} strokeWidth="1.8" fill="none"/></>,
    lib:<><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke={c} strokeWidth="2" fill="none"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke={c} strokeWidth="2" fill="none"/></>,
    spark:<path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z" stroke={c} strokeWidth="1.8" fill="none"/>,
    trash:<><polyline points="3 6 5 6 21 6" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M19 6l-1 14H6L5 6" stroke={c} strokeWidth="2" fill="none"/><path d="M10 11v6M14 11v6" stroke={c} strokeWidth="2" strokeLinecap="round"/></>,
    eye:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke={c} strokeWidth="2" fill="none"/><circle cx="12" cy="12" r="3" stroke={c} strokeWidth="2" fill="none"/></>,
    edit:<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={c} strokeWidth="2" fill="none"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={c} strokeWidth="2" fill="none"/></>,
    wifi:<><path d="M5 12.55a11 11 0 0114.08 0" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M1.42 9a16 16 0 0121.16 0" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M8.53 16.11a6 6 0 016.95 0" stroke={c} strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="20" r="1" fill={c}/></>,
    nwifi:<><line x1="1" y1="1" x2="23" y2="23" stroke={c} strokeWidth="2" strokeLinecap="round"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0" stroke={c} strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="20" r="1" fill={c}/></>,
    sync:<><path d="M23 4v6h-6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M1 20v-6h6" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    magic:<><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19.2 13.2M17.8 6.2L19.2 4.8M12.2 11.8L10.8 13.2M12.2 6.2L10.8 4.8M15 9a3 3 0 110 6 3 3 0 010-6z" stroke={c} strokeWidth="1.8" strokeLinecap="round" fill="none"/><path d="M2 22l10-10" stroke={c} strokeWidth="2" strokeLinecap="round"/></>,
    folder:<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" stroke={c} strokeWidth="2" fill="none"/>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" style={{display:'inline-block',flexShrink:0}}>{d[n]}</svg>;
};

function Btn({children,onClick,disabled,v='primary',sm,full}){
  const st={
    primary:{bg:'linear-gradient(135deg,#0ea5e9,#6366f1)',col:'#fff',br:'none'},
    ghost:  {bg:'#0c1a2e',col:'#94a3b8',br:'1px solid #1a2d48'},
    danger: {bg:'#ef444411',col:'#ef4444',br:'1px solid #ef444440'},
    green:  {bg:'linear-gradient(135deg,#10b981,#0ea5e9)',col:'#fff',br:'none'},
    orange: {bg:'linear-gradient(135deg,#f59e0b,#ef4444)',col:'#fff',br:'none'},
  }[v];
  return <button onClick={onClick} disabled={disabled} style={{
    background:disabled?'#0c1a2e':st.bg,color:disabled?'#2d4a65':st.col,
    border:disabled?'1px solid #1a2d48':st.br,borderRadius:10,
    padding:sm?'7px 14px':'11px 20px',fontWeight:700,fontSize:sm?12:14,
    cursor:disabled?'not-allowed':'pointer',display:'inline-flex',alignItems:'center',
    gap:6,fontFamily:'inherit',width:full?'100%':'auto',justifyContent:full?'center':'flex-start',
  }}>{children}</button>;
}

const Badge=({taux})=>{const c=getColor(taux);return<span style={{background:c+'22',color:c,border:`1px solid ${c}44`,borderRadius:99,padding:'2px 10px',fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>{taux!==null?`${taux}%`:'—'} · {getLabel(taux)}</span>;};
const Bar=({taux,h=5})=><div style={{background:'#0f2035',borderRadius:99,height:h,overflow:'hidden'}}><div style={{width:`${taux||0}%`,height:'100%',background:`linear-gradient(90deg,${getColor(taux)}88,${getColor(taux)})`,borderRadius:99,transition:'width .4s ease'}}/></div>;

// ── INDICATEUR CONNEXION ──────────────────────────────────
function ConnexionBadge({online, queueLen, onSync, syncing}){
  return (
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      {queueLen>0&&(
        <button onClick={onSync} disabled={!online||syncing} style={{background:'#f59e0b22',border:'1px solid #f59e0b44',borderRadius:8,padding:'4px 8px',cursor:online?'pointer':'default',color:'#f59e0b',fontSize:11,fontWeight:700,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4}}>
          {syncing?<div style={{width:10,height:10,border:'2px solid #f59e0b44',borderTop:'2px solid #f59e0b',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>:<Icon n="sync" s={11} c="#f59e0b"/>}
          {queueLen} en attente
        </button>
      )}
      <div style={{background:online?'#10b98122':'#ef444422',border:`1px solid ${online?'#10b98144':'#ef444444'}`,borderRadius:8,padding:'4px 10px',fontSize:11,fontWeight:700,color:online?'#10b981':'#ef4444',display:'flex',alignItems:'center',gap:4}}>
        <Icon n={online?'wifi':'nwifi'} s={11} c={online?'#10b981':'#ef4444'}/>
        {online?'En ligne':'Hors ligne'}
      </div>
    </div>
  );
}

// ── IMPORT AUTOMATIQUE GRILLES ────────────────────────────
function ImporteurGrille({onImported, onClose}){
  const [step,setStep]=useState('choose');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [imported,setImported]=useState(null);
  const [titre,setTitre]=useState('');
  const xlsxRef=useRef();
  const wordRef=useRef();

  function parseExcelRows(rows){
    const domaines=[];let cur=null;
    for(const row of rows){
      const cells=row.map(c=>String(c||'').trim());
      if(!cells.some(c=>c.length>1)) continue;
      const first=cells[0];
      if(!first&&cells[1]?.length>4&&!/^(oui|non)/i.test(cells[1])){
        if(cur) cur.points.push({id:uid(),controle:cells[1],indicateur:cells[4]||cells[3]||'',risque:cells[5]||cells[4]||''});
        continue;
      }
      const isDomain=/^\d+[.\-)]/.test(first)||(first.length>8&&first===first.toUpperCase()&&!first.includes('OUI')&&!first.includes('NON')&&cells.length<=2);
      if(isDomain){cur={id:uid(),titre:first.replace(/^\d+[.\-)\s]+/,''),points:[]};domaines.push(cur);continue;}
      if(cur&&first){
        const ctrl=cells[1]||first;
        const indic=cells[4]||cells[3]||cells[2]||'';
        const risque=cells[5]||cells[4]||'';
        if(ctrl.length>4&&!/^(oui|non|\-|domaine|point)/i.test(ctrl))
          cur.points.push({id:uid(),controle:ctrl,indicateur:indic,risque});
      }
    }
    return domaines.filter(d=>d.points.length>0);
  }

  function parseWordXML(str){
    const matches=str.match(/<w:t[^>]*>([^<]+)<\/w:t>/g)||[];
    const text=matches.map(m=>m.replace(/<[^>]+>/g,'')).join(' ');
    const lines=text.split(/\s{3,}|(?<=[.!?])\s+(?=[A-Z])/).map(l=>l.trim()).filter(l=>l.length>5);
    const domaines=[];let cur=null;
    const domPatterns=[/^(Organisation|Gestion|Passation|Audit|Information|Ressources).+/i,/^\*{0,2}[A-ZÀÂÉÈ].{8,}\*{0,2}$/];
    const skipPatterns=[/^(01 BP|Tél|Adresse|Site|GRILLE DE|PRÉSENT|OBJECTIF|ÉVALUATION|SUGGESTION|NOM ET|DÉPARTEMENT|STRUCTURE S)/i,/^\d+$/];
    for(const line of lines){
      if(skipPatterns.some(p=>p.test(line))) continue;
      if(domPatterns.some(p=>p.test(line))&&line.length<100){
        cur={id:uid(),titre:line.replace(/^\*+|\*+$/g,'').trim(),points:[]};domaines.push(cur);continue;
      }
      if(cur&&line.length>15&&line.length<300&&!skipPatterns.some(p=>p.test(line))){
        const ctrl=line.replace(/^[-•*]\s*/,'').trim();
        if(ctrl.length>10) cur.points.push({id:uid(),controle:ctrl,indicateur:'Oui / Non',risque:'À préciser'});
      }
    }
    return domaines.filter(d=>d.points.length>0);
  }

  async function handleExcel(e){
    const file=e.target.files[0];if(!file)return;
    setLoading(true);setError('');
    try{
      const XLSX=await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array'});
      let domaines=[];
      for(const sn of wb.SheetNames){
        const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:''});
        const parsed=parseExcelRows(rows);
        if(parsed.length>domaines.length) domaines=parsed;
      }
      if(!domaines.length) throw new Error('Aucune structure détectée.');
      setImported({domaines});setTitre(file.name.replace(/\.[^.]+$/,'').replace(/_/g,' '));setStep('preview');
    }catch(err){setError('❌ '+err.message);}
    setLoading(false);e.target.value='';
  }

  async function handleWord(e){
    const file=e.target.files[0];if(!file)return;
    setLoading(true);setError('');
    try{
      const buf=await file.arrayBuffer();
      const str=new TextDecoder('utf-8',{fatal:false}).decode(new Uint8Array(buf));
      const domaines=parseWordXML(str);
      if(!domaines.length) throw new Error('Structure non détectée. Essayez de convertir en Excel.');
      setImported({domaines});setTitre(file.name.replace(/\.[^.]+$/,'').replace(/_/g,' ').slice(0,60));setStep('preview');
    }catch(err){setError('❌ '+err.message);}
    setLoading(false);e.target.value='';
  }

  async function confirm(){
    if(!titre.trim())return;
    const g={id:uid(),titre:titre.trim(),description:'Importé automatiquement',source:'import',domaines:imported.domaines};
    await GDB.save(g);
    onImported(g);
  }

  const totalPts=imported?.domaines.reduce((a,d)=>a+d.points.length,0)||0;

  return(
    <div style={{position:'fixed',inset:0,background:'#000d',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{...S.card,width:'100%',maxWidth:580,maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #1a2d48',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{fontWeight:800,fontSize:15,color:'#38bdf8'}}><Icon n="magic" s={14} c="#38bdf8"/> Import automatique</div><div style={{fontSize:11,color:'#64748b'}}>Détection intelligente Excel · Word</div></div>
          <button onClick={onClose} style={{background:'#0f2035',border:'none',borderRadius:8,padding:'6px 9px',cursor:'pointer',color:'#64748b'}}><Icon n="x" s={14}/></button>
        </div>
        <div style={{overflowY:'auto',padding:20,flex:1}}>
          {step==='choose'&&(
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                {[{icon:'📊',label:'Excel',sub:'.xlsx / .xls',color:'#10b981',ref:xlsxRef,handler:handleExcel,accept:'.xlsx,.xls'},
                  {icon:'📝',label:'Word',sub:'.docx',color:'#818cf8',ref:wordRef,handler:handleWord,accept:'.docx'}].map(f=>(
                  <div key={f.label} onClick={()=>f.ref.current.click()} style={{...S.card,padding:20,textAlign:'center',cursor:'pointer',border:'2px dashed #1e4060',transition:'all .2s'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=f.color;e.currentTarget.style.background=f.color+'0d'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='#1e4060';e.currentTarget.style.background=S.card.background}}>
                    <div style={{fontSize:32,marginBottom:8}}>{f.icon}</div>
                    <div style={{fontWeight:800,fontSize:14,color:f.color}}>{f.label}</div>
                    <div style={{fontSize:11,color:'#64748b',marginTop:2}}>{f.sub}</div>
                    <input ref={f.ref} type="file" accept={f.accept} onChange={f.handler} style={{display:'none'}}/>
                  </div>
                ))}
              </div>
              <div style={{background:'#071120',border:'1px solid #0ea5e922',borderRadius:10,padding:14,fontSize:12,color:'#64748b',lineHeight:1.8}}>
                <strong style={{color:'#38bdf8'}}>Formats reconnus automatiquement :</strong><br/>
                Excel : colonnes DOMAINE / POINT DE CONTRÔLE / OUI / NON / INDICATEURS / RISQUES<br/>
                Word : titres de domaines en gras + tableau à 2 colonnes (Constats / Réponse)
              </div>
              {loading&&<div style={{textAlign:'center',padding:20,color:'#38bdf8',marginTop:12}}><div style={{width:22,height:22,border:'3px solid #1a2d48',borderTop:'3px solid #38bdf8',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 8px'}}/>Analyse en cours…</div>}
              {error&&<div style={{background:'#ef444411',border:'1px solid #ef444433',borderRadius:10,padding:12,marginTop:12,color:'#ef4444',fontSize:13}}>{error}</div>}
            </>
          )}
          {step==='preview'&&imported&&(
            <>
              <div style={{background:'#071a0e',border:'1px solid #10b98133',borderRadius:12,padding:14,marginBottom:16,display:'flex',gap:12,alignItems:'center'}}>
                <div style={{fontSize:24}}>✅</div>
                <div><div style={{fontWeight:800,color:'#10b981'}}>Import réussi !</div><div style={{fontSize:12,color:'#64748b'}}>{imported.domaines.length} domaines · {totalPts} points détectés</div></div>
              </div>
              <div style={{marginBottom:16}}>
                <label style={{display:'block',fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:5}}>Nom de la grille *</label>
                <input value={titre} onChange={e=>setTitre(e.target.value)} placeholder="Ex : Grille CI Hôpital 2026" style={S.input}/>
              </div>
              {imported.domaines.map((d,i)=>(
                <div key={d.id} style={{...S.card,padding:'10px 14px',marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:24,height:24,background:'#0ea5e922',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,fontWeight:900,color:'#38bdf8'}}>{i+1}</div>
                  <div><div style={{fontWeight:700,fontSize:12}}>{d.titre}</div><div style={{fontSize:11,color:'#475569'}}>{d.points.length} point(s)</div></div>
                </div>
              ))}
            </>
          )}
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid #1a2d48',display:'flex',justifyContent:'flex-end',gap:8}}>
          {step==='choose'?<Btn onClick={onClose} v="ghost">Annuler</Btn>:<>
            <Btn onClick={()=>{setStep('choose');setImported(null);setError('');}} v="ghost">← Réimporter</Btn>
            <Btn onClick={confirm} disabled={!titre.trim()}><Icon n="check" s={13}/> Utiliser cette grille</Btn>
          </>}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── RAPPORT MODAL ─────────────────────────────────────────
function RapportModal({mission,grille,reponses,onClose}){
  const stats=computeStats(reponses,grille.domaines);
  const [genStep,setGenStep]=useState('idle');
  const [rapport,setRapport]=useState(null);

  const ncs=[];
  grille.domaines.forEach(d=>d.points.forEach(p=>{
    const r=reponses[p.id];
    if(r?.valeur==='non') ncs.push({domaine:d.titre,controle:p.controle,risque:p.risque,observation:r.observation||''});
  }));

  async function generer(){
    setGenStep('loading');
    const result=await genererRapportIA(mission,grille,reponses);
    await RapDB.save({missionId:mission.id,contenuIa:result.contenu,taux:stats.taux,nbConformes:stats.oui,nbNonConformes:stats.non});
    setRapport(result);
    setGenStep('done');
  }

  function exportHTML(){
    const ncRows=ncs.map(nc=>`<tr><td>${nc.domaine}</td><td>${nc.controle}</td><td style="color:#dc2626">${nc.risque}</td><td>${nc.observation||'—'}</td></tr>`).join('');
    const domRows=grille.domaines.map(d=>{
      let o=0,t=0;d.points.forEach(p=>{const r=reponses[p.id];if(r?.valeur==='oui'){o++;t++;}else if(r?.valeur==='non')t++;});
      const tx=t>0?Math.round((o/t)*100):null;
      const c=tx>=80?'#16a34a':tx>=60?'#d97706':'#dc2626';
      return`<tr><td>${d.titre}</td><td style="text-align:center">${o}</td><td style="text-align:center">${t-o}</td><td style="color:${c};font-weight:700;text-align:center">${tx!==null?tx+'%':'—'}</td></tr>`;
    }).join('');
    const html=`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport – ${mission.nom}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#1e293b}h1{color:#1e3a5f;border-bottom:3px solid #0ea5e9;padding-bottom:10px}h2{color:#1e3a5f;margin-top:28px}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#1e3a5f;color:white;padding:10px;text-align:left;font-size:13px}td{padding:9px;border-bottom:1px solid #e2e8f0;font-size:13px}tr:nth-child(even){background:#f8fafc}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center}.sv{font-size:28px;font-weight:800;color:#1e3a5f}.sl{font-size:12px;color:#64748b;margin-top:4px}pre{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:13px;line-height:1.7}footer{margin-top:40px;padding-top:16px;border-top:2px solid #e2e8f0;color:#94a3b8;font-size:12px;text-align:center}</style></head><body>
<h1>📋 RAPPORT DE SUPERVISION – CONTRÔLE INTERNE</h1>
<table><tr><td><strong>Mission :</strong> ${mission.nom}</td><td><strong>Structure :</strong> ${mission.structure}</td></tr><tr><td><strong>Date :</strong> ${mission.date}</td><td><strong>Superviseur :</strong> ${mission.superviseur}</td></tr><tr><td><strong>Type :</strong> ${mission.type}</td><td><strong>Grille :</strong> ${grille.titre}</td></tr></table>
<h2>📊 Résultats globaux</h2>
<div class="stats"><div class="stat"><div class="sv" style="color:${getColor(stats.taux)}">${stats.taux!==null?stats.taux+'%':'—'}</div><div class="sl">Conformité</div></div><div class="stat"><div class="sv" style="color:#16a34a">${stats.oui}</div><div class="sl">Conformes</div></div><div class="stat"><div class="sv" style="color:#dc2626">${stats.non}</div><div class="sl">Non conf.</div></div><div class="stat"><div class="sv">${stats.total}</div><div class="sl">Évalués</div></div></div>
<h2>📋 Par domaine</h2><table><tr><th>Domaine</th><th style="text-align:center">Conformes</th><th style="text-align:center">Non conf.</th><th style="text-align:center">Taux</th></tr>${domRows}</table>
${ncs.length?`<h2>⚠️ Non-conformités (${ncs.length})</h2><table><tr><th>Domaine</th><th>Point de contrôle</th><th>Risque</th><th>Observation</th></tr>${ncRows}</table>`:''}
${rapport?`<h2>🤖 Analyse IA (${rapport.source==='groq'?'Groq Llama3':'Rapport local'})</h2><pre>${rapport.contenu}</pre>`:''}
<footer>Généré le ${new Date().toLocaleString('fr-FR')} · SupervisionCI v2.0</footer></body></html>`;
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));a.download=`Rapport_${mission.nom.replace(/\s+/g,'_')}_${mission.date}.html`;a.click();
  }

  return(
    <div style={{position:'fixed',inset:0,background:'#000d',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{...S.card,width:'100%',maxWidth:660,maxHeight:'90vh',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'16px 20px',borderBottom:'1px solid #1a2d48',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{fontWeight:800,fontSize:15,color:'#38bdf8'}}>📄 Rapport de Mission</div><div style={{fontSize:11,color:'#64748b'}}>{mission.nom}</div></div>
          <button onClick={onClose} style={{background:'#0f2035',border:'none',borderRadius:8,padding:'6px 9px',cursor:'pointer',color:'#64748b'}}><Icon n="x" s={14}/></button>
        </div>
        <div style={{overflowY:'auto',padding:20,flex:1}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:18}}>
            {[{l:'Conformité',v:stats.taux!==null?`${stats.taux}%`:'—',c:getColor(stats.taux)},{l:'Conformes',v:stats.oui,c:'#10b981'},{l:'Non conf.',v:stats.non,c:'#ef4444'},{l:'Évalués',v:stats.total,c:'#38bdf8'}].map(s=>(
              <div key={s.l} style={{background:'#071120',borderRadius:12,padding:12,textAlign:'center',border:'1px solid #1a2d48'}}>
                <div style={{fontSize:20,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:'#64748b',marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{marginBottom:18}}>
            {grille.domaines.map(d=>{
              let o=0,t=0;d.points.forEach(p=>{const r=reponses[p.id];if(r?.valeur==='oui'){o++;t++;}else if(r?.valeur==='non')t++;});
              const tx=t>0?Math.round((o/t)*100):null;
              return<div key={d.id} style={{marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}><span style={{color:'#94a3b8',fontSize:12,flex:1,marginRight:8}}>{d.titre}</span><Badge taux={tx}/></div><Bar taux={tx} h={4}/></div>;
            })}
          </div>
          {ncs.length>0&&(
            <div style={{background:'#1a0f0f',border:'1px solid #ef444433',borderRadius:12,padding:14,marginBottom:16}}>
              <div style={{fontWeight:700,color:'#ef4444',marginBottom:8,fontSize:13}}>⚠️ {ncs.length} non-conformité(s)</div>
              {ncs.map((nc,i)=><div key={i} style={{padding:'6px 0',borderBottom:'1px solid #ef444422',fontSize:12}}><span style={{color:'#fca5a5'}}>{nc.controle}</span><span style={{color:'#ef444488',fontSize:11}}> · {nc.domaine}</span>{nc.observation&&<div style={{color:'#ef444499',fontSize:11,marginTop:2}}>→ {nc.observation}</div>}</div>)}
            </div>
          )}
          {genStep==='idle'&&<button onClick={generer} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:'linear-gradient(135deg,#0ea5e9,#6366f1)',color:'#fff',fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:14,fontFamily:'inherit'}}><Icon n="spark" s={15}/> Générer l'analyse IA</button>}
          {genStep==='loading'&&<div style={{textAlign:'center',padding:20,color:'#38bdf8'}}><div style={{width:24,height:24,border:'3px solid #1a2d48',borderTop:'3px solid #38bdf8',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 10px'}}/>Génération en cours…</div>}
          {genStep==='done'&&rapport&&<div style={{background:'#071828',border:'1px solid #0ea5e933',borderRadius:12,padding:16}}>
            <div style={{color:'#38bdf8',fontWeight:700,marginBottom:8,fontSize:12}}>
              <Icon n="spark" s={12} c="#38bdf8"/> Analyse IA · {rapport.source==='groq'?'🟢 Groq Llama3':'🟡 Mode local'}
            </div>
            <div style={{color:'#cbd5e1',fontSize:13,whiteSpace:'pre-wrap',lineHeight:1.8}}>{rapport.contenu}</div>
          </div>}
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid #1a2d48',display:'flex',gap:8}}>
          <Btn onClick={exportHTML} v="ghost" sm><Icon n="dl" s={13}/> Export HTML</Btn>
        </div>
      </div>
    </div>
  );
}

// ── REMPLISSAGE GRILLE ────────────────────────────────────
function GrilleFill({mission,grille,onBack}){
  const [reponses,setReponses]=useState(()=>RDB.getForMission(mission.id));
  const [idx,setIdx]=useState(0);
  const [showRapport,setShowRapport]=useState(false);
  const [saving,setSaving]=useState(false);

  const totalPts=grille.domaines.reduce((a,d)=>a+d.points.length,0);
  const answered=Object.values(reponses).filter(r=>r?.valeur).length;
  const stats=computeStats(reponses,grille.domaines);
  const dom=grille.domaines[idx]||grille.domaines[0];
  const pct=Math.round((answered/totalPts)*100);

  const setR=(id,v)=>{
    const nr={...reponses,[id]:{...(reponses[id]||{}),valeur:v}};
    setReponses(nr);
    setSaving(true);
    RDB.saveAll(mission.id,nr).finally(()=>setSaving(false));
  };
  const setObs=(id,o)=>{
    const nr={...reponses,[id]:{...(reponses[id]||{}),observation:o}};
    setReponses(nr);
    RDB.saveAll(mission.id,nr);
  };

  return(
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={S.hdr}>
        <div style={{maxWidth:880,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
            <button onClick={onBack} style={{background:'#0f2035',border:'none',borderRadius:8,padding:'7px 10px',cursor:'pointer',color:'#94a3b8'}}><Icon n="back" s={16} c="#94a3b8"/></button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:800,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{mission.nom}</div>
              <div style={{fontSize:11,color:'#64748b'}}>{mission.structure} · {grille.titre}</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
              {saving&&<div style={{width:14,height:14,border:'2px solid #1a2d48',borderTop:'2px solid #38bdf8',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>}
              {stats.taux!==null&&<Badge taux={stats.taux}/>}
            </div>
          </div>
          <Bar taux={pct} h={3}/>
          <div style={{fontSize:10,color:'#1a4060',marginTop:3}}>{answered}/{totalPts} réponses · {pct}%</div>
        </div>
      </div>

      <div style={{maxWidth:880,margin:'0 auto',padding:'16px'}}>
        {/* Tabs domaines */}
        <div style={{display:'flex',gap:4,overflowX:'auto',marginBottom:16,paddingBottom:4}}>
          {grille.domaines.map((d,i)=>{
            let o=0,t=0;d.points.forEach(p=>{const r=reponses[p.id];if(r?.valeur==='oui'){o++;t++;}else if(r?.valeur==='non')t++;});
            const tx=t>0?Math.round((o/t)*100):null;const active=i===idx;
            return<button key={d.id} onClick={()=>setIdx(i)} style={{flexShrink:0,padding:'6px 12px',borderRadius:8,border:active?'none':'1px solid #1a2d48',background:active?'linear-gradient(135deg,#0ea5e9,#6366f1)':'#0c1a2e',color:active?'#fff':'#64748b',fontFamily:'inherit',cursor:'pointer',fontSize:11,fontWeight:active?700:500,display:'flex',alignItems:'center',gap:4}}>
              <span>{i+1}.</span><span style={{maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.titre.split(' ').slice(0,3).join(' ')}</span>
              {tx!==null&&<span style={{color:active?'#ffffffcc':getColor(tx),fontSize:10}}>{tx}%</span>}
            </button>;
          })}
        </div>

        <div style={{fontWeight:800,fontSize:16,marginBottom:14,color:'#f1f5f9'}}>{dom.titre}</div>

        {dom.points.map(p=>{
          const r=reponses[p.id]||{};const isNC=r.valeur==='non';
          return<div key={p.id} style={{...S.card,border:isNC?'1px solid #ef444444':'1px solid #1a2d48',padding:14,marginBottom:10}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:6,lineHeight:1.5}}>{p.controle}</div>
            {(p.indicateur||p.risque)&&<div style={{fontSize:11,color:'#475569',marginBottom:10,display:'flex',gap:12,flexWrap:'wrap'}}>{p.indicateur&&<span>📊 {p.indicateur}</span>}{p.risque&&<span>⚠️ {p.risque}</span>}</div>}
            <div style={{display:'flex',gap:6}}>
              {[['oui','✓ OUI','#10b981'],['non','✗ NON','#ef4444'],['na','— N/A','#64748b']].map(([v,l,c])=>(
                <button key={v} onClick={()=>setR(p.id,v)} style={{flex:1,padding:'9px 4px',borderRadius:8,border:r.valeur===v?`2px solid ${c}`:'2px solid #1a2d48',background:r.valeur===v?c+'22':'#071120',color:r.valeur===v?c:'#475569',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>{l}</button>
              ))}
            </div>
            {isNC&&<textarea placeholder="⚠️ Observation terrain obligatoire…" value={r.observation||''} onChange={e=>setObs(p.id,e.target.value)} rows={2} style={{...S.input,marginTop:8,border:'1px solid #ef444444',color:'#fca5a5',fontSize:12,resize:'vertical'}}/>}
            {r.valeur==='oui'&&<input placeholder="Commentaire (optionnel)…" value={r.observation||''} onChange={e=>setObs(p.id,e.target.value)} style={{...S.input,marginTop:8,fontSize:12,color:'#64748b'}}/>}
          </div>;
        })}

        <div style={{display:'flex',justifyContent:'space-between',marginTop:16,gap:8}}>
          <Btn onClick={()=>setIdx(Math.max(0,idx-1))} disabled={idx===0} v="ghost"><Icon n="back" s={14}/> Précédent</Btn>
          <div style={{display:'flex',gap:8}}>
            {answered>0&&<Btn onClick={()=>setShowRapport(true)} v="ghost" sm><Icon n="clip" s={13}/> Rapport</Btn>}
            {idx<grille.domaines.length-1
              ?<Btn onClick={()=>setIdx(idx+1)}>Suivant →</Btn>
              :<Btn onClick={()=>setShowRapport(true)} v="green"><Icon n="spark" s={14}/> Générer le rapport</Btn>}
          </div>
        </div>
      </div>

      {showRapport&&<RapportModal mission={mission} grille={grille} reponses={reponses} onClose={()=>setShowRapport(false)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── CRÉER MISSION ─────────────────────────────────────────
function CreerMission({grilles,onCreate,onBack}){
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({nom:'',structure:'',localisation:'',date:new Date().toISOString().split('T')[0],superviseur:'HOUNGBADJI E. Melchisédèk',objectif:'',type:'Contrôle interne'});
  const [grilleId,setGrilleId]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const types=['Contrôle interne','Audit financier','Supervision budgétaire','Inspection générale','Évaluation des risques','Suivi semestriel'];
  const valid1=form.nom&&form.structure&&form.superviseur;
  const grilleChoisie=grilles.find(g=>g.id===grilleId);

  return(
    <div style={{...S.page,display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'30px 16px'}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <div style={{width:'100%',maxWidth:540}}>
        <button onClick={step===1?onBack:()=>setStep(1)} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',marginBottom:20,display:'flex',alignItems:'center',gap:6,fontSize:13,fontFamily:'inherit'}}><Icon n="back" s={13} c="#64748b"/> Retour</button>
        <div style={{display:'flex',gap:6,marginBottom:28}}>
          {[['1','Informations'],['2','Grille de contrôle']].map(([n,l],i)=>(
            <div key={n} style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:28,borderRadius:99,background:step>i+1?'#10b981':step===i+1?'linear-gradient(135deg,#0ea5e9,#6366f1)':'#0c1a2e',border:step<=i+1?'1px solid #1a2d48':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:'#fff',flexShrink:0}}>{step>i+1?'✓':n}</div>
              <span style={{fontSize:12,color:step===i+1?'#e2e8f0':'#475569',fontWeight:step===i+1?700:400}}>{l}</span>
              {i===0&&<div style={{flex:1,height:1,background:'#1a2d48'}}/>}
            </div>
          ))}
        </div>

        {step===1&&<>
          <div style={{fontSize:24,fontWeight:900,marginBottom:4}}>Nouvelle mission</div>
          <div style={{color:'#64748b',marginBottom:24,fontSize:13}}>Renseignez les informations de votre mission</div>
          {[{k:'nom',l:'Nom de la mission',p:'Ex : Supervision CI Hôpital National',req:true},{k:'structure',l:'Structure visitée',p:'Ex : CHD Ouémé-Plateau',req:true},{k:'localisation',l:'Localisation',p:'Ex : Porto-Novo, Bénin'},{k:'superviseur',l:'Superviseur(e)',p:'Nom & prénom',req:true}].map(f=>(
            <div key={f.k} style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:5}}>{f.l}{f.req?' *':''}</label>
              <input value={form[f.k]} onChange={e=>set(f.k,e.target.value)} placeholder={f.p} style={S.input}/>
            </div>
          ))}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:5}}>Date</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={S.input}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:5}}>Type</label><select value={form.type} onChange={e=>set('type',e.target.value)} style={S.input}>{types.map(t=><option key={t}>{t}</option>)}</select></div>
          </div>
          <div style={{marginBottom:24}}><label style={{display:'block',fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:5}}>Objectif</label><textarea rows={2} value={form.objectif} onChange={e=>set('objectif',e.target.value)} placeholder="Objectif principal…" style={{...S.input,resize:'vertical'}}/></div>
          <Btn onClick={()=>valid1&&setStep(2)} disabled={!valid1} full>Étape suivante →</Btn>
        </>}

        {step===2&&<>
          <div style={{fontSize:24,fontWeight:900,marginBottom:4}}>Choisir la grille</div>
          <div style={{color:'#64748b',marginBottom:20,fontSize:13}}>Sélectionnez la grille pour cette mission</div>
          {grilles.map(g=>(
            <div key={g.id} onClick={()=>setGrilleId(g.id)} style={{...S.card,padding:14,marginBottom:8,cursor:'pointer',border:grilleId===g.id?'2px solid #0ea5e9':'2px solid #1a2d48',background:grilleId===g.id?'#0ea5e90d':'#0c1a2e',transition:'all .2s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,background:'#6366f122',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="lib" s={17} c="#818cf8"/></div>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{g.titre}</div><div style={{fontSize:11,color:'#64748b'}}>{g.domaines.length} domaines · {g.domaines.reduce((a,d)=>a+d.points.length,0)} points</div></div>
                {grilleId===g.id&&<Icon n="check" s={18} c="#0ea5e9"/>}
              </div>
            </div>
          ))}
          <div style={{marginTop:16}}><Btn onClick={()=>grilleChoisie&&onCreate({...form,id:Date.now(),statut:'en_cours'},grilleChoisie)} disabled={!grilleId} full><Icon n="clip" s={14}/> Lancer la mission</Btn></div>
        </>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// APP ROOT — DASHBOARD
// ══════════════════════════════════════════════════════════
export default function App(){
  const [page,setPage]=useState('dashboard');
  const [grilles,setGrilles]=useState(()=>{
    const saved=LS.get(K.grilles);
    return saved.length?saved:[GRILLE_DEFAULT];
  });
  const [missions,setMissions]=useState(()=>LS.get(K.missions));
  const [ctx,setCtx]=useState({});
  const [showImport,setShowImport]=useState(false);
  const [online,setOnline]=useState(navigator.onLine);
  const [syncing,setSyncing]=useState(false);
  const [queueLen,setQueueLen]=useState(()=>LS.get(K.queue).length);

  // Sync état connexion
  useEffect(()=>{
    const onOn=()=>{ setOnline(true); doSync(); };
    const onOff=()=>setOnline(false);
    window.addEventListener('online',onOn);
    window.addEventListener('offline',onOff);
    return()=>{ window.removeEventListener('online',onOn); window.removeEventListener('offline',onOff); };
  },[]);

  // Sync initiale
  useEffect(()=>{ if(navigator.onLine) doSync(); },[]);

  async function doSync(){
    setSyncing(true);
    await syncQueue();
    setQueueLen(LS.get(K.queue).length);
    setSyncing(false);
  }

  const getGrille=id=>grilles.find(g=>g.id===id)||grilles[0];

  function refreshGrilles(){ setGrilles(LS.get(K.grilles).length?LS.get(K.grilles):[GRILLE_DEFAULT]); }
  function refreshMissions(){ setMissions(LS.get(K.missions)); }

  async function saveGrille(g){
    await GDB.save(g);refreshGrilles();setPage('dashboard');
  }
  async function delGrille(id){
    await GDB.delete(id);refreshGrilles();
  }
  async function createMission(m,g){
    await MDB.save(m);refreshMissions();setCtx({am:m,ag:g});setPage('fill');
  }
  function openMission(m){ setCtx({am:m,ag:getGrille(m.grilleId)});setPage('fill'); }
  function handleImported(g){ refreshGrilles();setShowImport(false); }

  if(page==='fill'&&ctx.am) return <GrilleFill mission={ctx.am} grille={ctx.ag} onBack={()=>{refreshMissions();setPage('dashboard');}}/>;
  if(page==='create') return <CreerMission grilles={grilles} onCreate={createMission} onBack={()=>setPage('dashboard')}/>;

  const enCours=missions.filter(m=>m.statut==='en_cours');
  const terminees=missions.filter(m=>m.statut==='terminee');

  return(
    <div style={S.page}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#050d1a,#0c1a2e)',borderBottom:'1px solid #1a2d48',padding:'18px 20px'}}>
        <div style={{maxWidth:960,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
            <div>
              <div style={{fontSize:24,fontWeight:900,background:'linear-gradient(90deg,#38bdf8,#818cf8,#10b981)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',letterSpacing:-0.5}}>SupervisionCI</div>
              <div style={{color:'#475569',fontSize:11,marginTop:1}}>Contrôle Interne Hospitalier · Bénin · v2.0</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <ConnexionBadge online={online} queueLen={queueLen} onSync={doSync} syncing={syncing}/>
              <Btn onClick={()=>setShowImport(true)} v="ghost" sm><Icon n="ul" s={13}/> Importer</Btn>
              <Btn onClick={()=>setPage('create')} sm><Icon n="plus" s={13}/> Mission</Btn>
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:960,margin:'0 auto',padding:'22px 18px'}}>
        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:24}}>
          {[{l:'Missions',v:missions.length,c:'#818cf8',n:'folder'},{l:'En cours',v:enCours.length,c:'#f59e0b',n:'eye'},{l:'Terminées',v:terminees.length,c:'#10b981',n:'check'},{l:'Grilles',v:grilles.length,c:'#38bdf8',n:'lib'}].map(s=>(
            <div key={s.l} style={{...S.card,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:36,height:36,background:s.c+'22',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={s.n} s={17} c={s.c}/></div>
              <div><div style={{fontSize:22,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontSize:11,color:'#475569',marginTop:2}}>{s.l}</div></div>
            </div>
          ))}
        </div>

        {/* Actions rapides */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:10,marginBottom:28}}>
          {[
            {icon:'clip',title:'Nouvelle mission',sub:'Avec grille au choix',c:'#38bdf8',bg:'#0ea5e9',action:()=>setPage('create')},
            {icon:'ul',title:'Importer une grille',sub:'Excel ou Word auto-détecté',c:'#10b981',bg:'#10b981',action:()=>setShowImport(true)},
            {icon:'edit',title:'Créer une grille',sub:'Manuellement',c:'#818cf8',bg:'#6366f1',action:()=>{setCtx({grilleEdit:null});setPage('builder');}},
          ].map(a=>(
            <button key={a.title} onClick={a.action} style={{...S.card,padding:16,cursor:'pointer',border:`1px solid ${a.bg}22`,background:`${a.bg}08`,textAlign:'left',fontFamily:'inherit',transition:'all .2s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=a.bg+'55';e.currentTarget.style.background=a.bg+'12'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=a.bg+'22';e.currentTarget.style.background=a.bg+'08'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,background:a.bg+'22',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={a.icon} s={16} c={a.c}/></div>
                <div><div style={{fontWeight:800,fontSize:13,color:a.c}}>{a.title}</div><div style={{fontSize:11,color:'#64748b'}}>{a.sub}</div></div>
              </div>
            </button>
          ))}
        </div>

        {/* Banner Supabase status */}
        {!supabase&&(
          <div style={{background:'#1a1000',border:'1px solid #f59e0b44',borderRadius:12,padding:14,marginBottom:20,display:'flex',gap:10,alignItems:'center'}}>
            <div style={{fontSize:20}}>⚠️</div>
            <div><div style={{fontWeight:700,color:'#f59e0b',fontSize:13}}>Supabase non configuré</div><div style={{fontSize:12,color:'#64748b'}}>Crée un fichier <code style={{color:'#38bdf8'}}>.env</code> avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY — les données sont sauvegardées localement en attendant.</div></div>
          </div>
        )}

        {/* Missions */}
        {[{title:'🟡 Missions en cours',list:enCours},{title:'✅ Missions terminées',list:terminees}].map(sec=>(
          <div key={sec.title} style={{marginBottom:24}}>
            <div style={{fontWeight:800,fontSize:14,marginBottom:10,color:'#94a3b8'}}>{sec.title}</div>
            {sec.list.length===0&&<div style={{...S.card,padding:20,textAlign:'center',color:'#475569',fontSize:13}}>Aucune mission pour l'instant</div>}
            {sec.list.map(m=>(
              <div key={m.id} onClick={()=>openMission(m)} style={{...S.card,padding:'14px 16px',marginBottom:7,display:'flex',alignItems:'center',gap:12,cursor:'pointer',transition:'border .2s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor='#0ea5e944'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='#1a2d48'}>
                <div style={{width:40,height:40,background:'#0ea5e911',borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="clip" s={18} c="#38bdf8"/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.nom}</div>
                  <div style={{fontSize:11,color:'#64748b'}}>{m.structure} · {m.date} · {m.superviseur}</div>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                    <span style={{fontSize:10,color:'#475569'}}>Grille : {getGrille(m.grilleId)?.titre}</span>
                    {m.synced?<span style={{fontSize:9,color:'#10b981',background:'#10b98122',padding:'1px 6px',borderRadius:99}}>✓ Sync</span>:<span style={{fontSize:9,color:'#f59e0b',background:'#f59e0b22',padding:'1px 6px',borderRadius:99}}>○ Local</span>}
                  </div>
                </div>
                <div style={{background:'#1a2d48',borderRadius:8,padding:'6px 10px',flexShrink:0,color:'#38bdf8',fontSize:11,fontWeight:700}}>Ouvrir →</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {showImport&&<ImporteurGrille onImported={handleImported} onClose={()=>setShowImport(false)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`}</style>
    </div>
  );
}
