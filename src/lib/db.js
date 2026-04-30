// src/lib/db.js
// ============================================================
// COUCHE BASE DE DONNÉES — Offline-first avec sync Supabase
//
// Architecture :
//   localStorage  →  stockage offline (remplace SQLite pour le web)
//   Supabase      →  backend cloud, sync quand internet disponible
//
// Pour la version APK Capacitor, remplace localStorage
// par @capacitor-community/sqlite (voir commentaires en bas)
// ============================================================

import { supabase } from './supabaseClient';

// ── CLÉS DE STOCKAGE LOCAL ────────────────────────────────
const KEYS = {
  grilles:  'sci_grilles',
  missions: 'sci_missions',
  reponses: 'sci_reponses',
  rapports: 'sci_rapports',
  syncQueue:'sci_sync_queue',   // actions en attente de sync
};

// ── UTILITAIRES STOCKAGE LOCAL ────────────────────────────
function lsGet(key)         { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } }
function lsSet(key, data)   { localStorage.setItem(key, JSON.stringify(data)); }
function lsGetObj(key)      { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } }
function lsSetObj(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }

// ── DÉTECTION INTERNET ────────────────────────────────────
export function isOnline() {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

// ── FILE D'ATTENTE DE SYNCHRONISATION ────────────────────
// Chaque action offline est mise en queue : { table, action, data, timestamp }
function enqueue(table, action, data) {
  const q = lsGet(KEYS.syncQueue);
  q.push({ id: Date.now() + Math.random(), table, action, data, timestamp: new Date().toISOString() });
  lsSet(KEYS.syncQueue, q);
}

function dequeue(id) {
  const q = lsGet(KEYS.syncQueue);
  lsSet(KEYS.syncQueue, q.filter(item => item.id !== id));
}

export function getSyncQueue() {
  return lsGet(KEYS.syncQueue);
}

// ── SYNCHRONISATION AUTOMATIQUE ──────────────────────────
export async function syncToSupabase() {
  if (!isOnline()) return { success: false, reason: 'offline' };

  const queue = lsGet(KEYS.syncQueue);
  if (!queue.length) {
    // Pas d'items en queue, mais on peut quand même récupérer depuis le cloud
    await pullFromSupabase();
    return { success: true, synced: 0 };
  }

  let synced = 0;
  const errors = [];

  for (const item of queue) {
    try {
      let error = null;

      if (item.action === 'upsert') {
        // Nettoyer les données selon la table
        const cleaned = cleanForSupabase(item.table, item.data);
        ({ error } = await supabase.from(item.table).upsert(cleaned));
      } else if (item.action === 'delete') {
        ({ error } = await supabase.from(item.table).delete().eq('id', item.data.id));
      }

      if (error) {
        errors.push({ item, error: error.message });
      } else {
        dequeue(item.id);
        synced++;
      }
    } catch (err) {
      errors.push({ item, error: err.message });
    }
  }

  // Marquer les items locaux comme synchronisés
  if (synced > 0) {
    markLocalAsSynced();
  }

  return { success: errors.length === 0, synced, errors };
}

// Nettoyer les données avant envoi Supabase (noms de colonnes snake_case)
function cleanForSupabase(table, data) {
  if (table === 'missions') {
    return {
      id:          data.id?.toString(),
      nom:         data.nom,
      structure:   data.structure,
      localisation:data.localisation || null,
      date:        data.date,
      superviseur: data.superviseur,
      objectif:    data.objectif || null,
      type:        data.type || 'Contrôle interne',
      statut:      data.statut || 'en_cours',
      grille_id:   data.grilleId || data.grille_id || null,
      updated_at:  new Date().toISOString(),
    };
  }
  if (table === 'grilles') {
    return {
      id:          data.id?.toString(),
      titre:       data.titre,
      description: data.description || null,
      source:      data.source || 'manual',
      domaines:    data.domaines || [],
      updated_at:  new Date().toISOString(),
    };
  }
  if (table === 'reponses') {
    return {
      id:          data.id?.toString(),
      mission_id:  data.missionId?.toString() || data.mission_id,
      point_id:    data.pointId || data.point_id,
      valeur:      data.valeur || null,
      observation: data.observation || null,
      note:        data.note || null,
      updated_at:  new Date().toISOString(),
    };
  }
  if (table === 'rapports') {
    return {
      id:               data.id?.toString(),
      mission_id:       data.missionId?.toString() || data.mission_id,
      contenu_ia:       data.contenuIa || data.contenu_ia || null,
      taux:             data.taux || null,
      nb_conformes:     data.nbConformes || data.nb_conformes || 0,
      nb_nonconformes:  data.nbNonConformes || data.nb_nonconformes || 0,
    };
  }
  return data;
}

// Récupérer les données cloud vers le local
async function pullFromSupabase() {
  try {
    const [{ data: grilles }, { data: missions }, { data: reponses }] = await Promise.all([
      supabase.from('grilles').select('*').order('created_at', { ascending: false }),
      supabase.from('missions').select('*').order('created_at', { ascending: false }),
      supabase.from('reponses').select('*'),
    ]);

    if (grilles?.length)  mergeLocalData(KEYS.grilles,  grilles.map(g => ({ ...g, synced: 1 })));
    if (missions?.length) mergeLocalData(KEYS.missions, missions.map(m => ({ ...m, grilleId: m.grille_id, synced: 1 })));
    if (reponses?.length) {
      // Grouper les réponses par mission
      const grouped = {};
      reponses.forEach(r => {
        if (!grouped[r.mission_id]) grouped[r.mission_id] = {};
        grouped[r.mission_id][r.point_id] = { valeur: r.valeur, observation: r.observation, note: r.note };
      });
      const existing = lsGetObj(KEYS.reponses);
      lsSetObj(KEYS.reponses, { ...grouped, ...existing });
    }
  } catch (err) {
    console.warn('Pull depuis Supabase échoué:', err.message);
  }
}

// Fusionner données cloud avec données locales (local a priorité)
function mergeLocalData(key, cloudData) {
  const local = lsGet(key);
  const localIds = new Set(local.map(i => String(i.id)));
  const toAdd = cloudData.filter(c => !localIds.has(String(c.id)));
  if (toAdd.length) lsSet(key, [...local, ...toAdd]);
}

function markLocalAsSynced() {
  ['grilles','missions'].forEach(table => {
    const key = KEYS[table];
    const data = lsGet(key).map(item => ({ ...item, synced: 1 }));
    lsSet(key, data);
  });
}

// ── API GRILLES ───────────────────────────────────────────

export const GrillesDB = {

  getAll() {
    return lsGet(KEYS.grilles);
  },

  async save(grille) {
    // 1. Sauvegarder localement
    const all = lsGet(KEYS.grilles);
    const exists = all.findIndex(g => g.id === grille.id);
    const data = { ...grille, synced: 0, updatedAt: new Date().toISOString() };
    if (exists >= 0) all[exists] = data;
    else all.push(data);
    lsSet(KEYS.grilles, all);

    // 2. Envoyer à Supabase si online
    if (isOnline()) {
      const { error } = await supabase.from('grilles').upsert(cleanForSupabase('grilles', data));
      if (!error) {
        // Marquer comme synced
        const updated = lsGet(KEYS.grilles).map(g => g.id === grille.id ? { ...g, synced: 1 } : g);
        lsSet(KEYS.grilles, updated);
      } else {
        enqueue('grilles', 'upsert', data);
      }
    } else {
      enqueue('grilles', 'upsert', data);
    }

    return data;
  },

  async delete(id) {
    lsSet(KEYS.grilles, lsGet(KEYS.grilles).filter(g => g.id !== id));
    if (isOnline()) {
      await supabase.from('grilles').delete().eq('id', id);
    } else {
      enqueue('grilles', 'delete', { id });
    }
  },
};

// ── API MISSIONS ──────────────────────────────────────────

export const MissionsDB = {

  getAll() {
    return lsGet(KEYS.missions);
  },

  getById(id) {
    return lsGet(KEYS.missions).find(m => String(m.id) === String(id));
  },

  async save(mission) {
    const all = lsGet(KEYS.missions);
    const exists = all.findIndex(m => String(m.id) === String(mission.id));
    const data = { ...mission, synced: 0, updatedAt: new Date().toISOString() };
    if (exists >= 0) all[exists] = data;
    else all.push(data);
    lsSet(KEYS.missions, all);

    if (isOnline()) {
      const { error } = await supabase.from('missions').upsert(cleanForSupabase('missions', data));
      if (!error) {
        const updated = lsGet(KEYS.missions).map(m => String(m.id) === String(mission.id) ? { ...m, synced: 1 } : m);
        lsSet(KEYS.missions, updated);
      } else {
        enqueue('missions', 'upsert', data);
      }
    } else {
      enqueue('missions', 'upsert', data);
    }

    return data;
  },

  async updateStatut(id, statut) {
    const mission = this.getById(id);
    if (mission) await this.save({ ...mission, statut });
  },

  async delete(id) {
    lsSet(KEYS.missions, lsGet(KEYS.missions).filter(m => String(m.id) !== String(id)));
    if (isOnline()) {
      await supabase.from('missions').delete().eq('id', String(id));
    } else {
      enqueue('missions', 'delete', { id: String(id) });
    }
  },
};

// ── API RÉPONSES ──────────────────────────────────────────

export const ReponsesDB = {

  // Récupérer toutes les réponses d'une mission : { pointId: { valeur, observation } }
  getForMission(missionId) {
    const all = lsGetObj(KEYS.reponses);
    return all[String(missionId)] || {};
  },

  // Sauvegarder une réponse individuelle
  async saveOne(missionId, pointId, reponse) {
    const all = lsGetObj(KEYS.reponses);
    if (!all[String(missionId)]) all[String(missionId)] = {};
    all[String(missionId)][pointId] = { ...reponse, synced: 0 };
    lsSetObj(KEYS.reponses, all);

    // Sync en arrière-plan (non bloquant)
    if (isOnline()) {
      const id = `${missionId}_${pointId}`;
      supabase.from('reponses').upsert(cleanForSupabase('reponses', {
        id, missionId: String(missionId), pointId, ...reponse,
      })).then(({ error }) => {
        if (!error) {
          const updated = lsGetObj(KEYS.reponses);
          if (updated[String(missionId)]?.[pointId]) {
            updated[String(missionId)][pointId].synced = 1;
            lsSetObj(KEYS.reponses, updated);
          }
        } else {
          enqueue('reponses', 'upsert', { id, missionId: String(missionId), pointId, ...reponse });
        }
      });
    } else {
      enqueue('reponses', 'upsert', {
        id: `${missionId}_${pointId}`, missionId: String(missionId), pointId, ...reponse,
      });
    }
  },

  // Sauvegarder toutes les réponses d'une mission d'un coup
  async saveAll(missionId, reponses) {
    const all = lsGetObj(KEYS.reponses);
    all[String(missionId)] = reponses;
    lsSetObj(KEYS.reponses, all);

    if (isOnline()) {
      const rows = Object.entries(reponses).map(([pointId, r]) => cleanForSupabase('reponses', {
        id: `${missionId}_${pointId}`, missionId: String(missionId), pointId, ...r,
      }));
      if (rows.length) {
        const { error } = await supabase.from('reponses').upsert(rows);
        if (error) rows.forEach(r => enqueue('reponses', 'upsert', r));
      }
    } else {
      Object.entries(reponses).forEach(([pointId, r]) => {
        enqueue('reponses', 'upsert', {
          id: `${missionId}_${pointId}`, missionId: String(missionId), pointId, ...r,
        });
      });
    }
  },
};

// ── API RAPPORTS ──────────────────────────────────────────

export const RapportsDB = {

  getForMission(missionId) {
    const all = lsGet(KEYS.rapports);
    return all.find(r => String(r.missionId) === String(missionId)) || null;
  },

  async save(rapport) {
    const all = lsGet(KEYS.rapports);
    const exists = all.findIndex(r => String(r.missionId) === String(rapport.missionId));
    const data = { ...rapport, id: rapport.id || `rap_${Date.now()}`, synced: 0, createdAt: new Date().toISOString() };
    if (exists >= 0) all[exists] = data;
    else all.push(data);
    lsSet(KEYS.rapports, all);

    if (isOnline()) {
      const { error } = await supabase.from('rapports').upsert(cleanForSupabase('rapports', data));
      if (!error) {
        const updated = lsGet(KEYS.rapports).map(r => r.id === data.id ? { ...r, synced: 1 } : r);
        lsSet(KEYS.rapports, updated);
      } else {
        enqueue('rapports', 'upsert', data);
      }
    } else {
      enqueue('rapports', 'upsert', data);
    }

    return data;
  },
};

// ── INITIALISATION ────────────────────────────────────────
// À appeler au démarrage de l'app

export async function initDB(defaultGrilles = []) {
  // Charger les grilles par défaut si la DB locale est vide
  const existing = lsGet(KEYS.grilles);
  if (!existing.length && defaultGrilles.length) {
    lsSet(KEYS.grilles, defaultGrilles.map(g => ({ ...g, synced: 1 })));
  }

  // Tenter une sync initiale
  if (isOnline()) {
    await pullFromSupabase();
  }

  // Écouter les changements de connectivité
  window.addEventListener('online',  () => { syncToSupabase(); });
  window.addEventListener('offline', () => { console.log('📴 Mode hors-ligne activé'); });

  return { online: isOnline() };
}

// ── STATISTIQUES SYNC ────────────────────────────────────

export function getSyncStats() {
  const queue = getSyncQueue();
  const grilles  = lsGet(KEYS.grilles);
  const missions = lsGet(KEYS.missions);
  return {
    enAttente:       queue.length,
    grillesSynced:   grilles.filter(g => g.synced).length,
    grillesTotales:  grilles.length,
    missionsSynced:  missions.filter(m => m.synced).length,
    missionsTotales: missions.length,
    online:          isOnline(),
  };
}

// ══════════════════════════════════════════════════════════
// NOTES POUR LA VERSION APK CAPACITOR + SQLite
// ══════════════════════════════════════════════════════════
//
// 1. Installe le plugin :
//    npm install @capacitor-community/sqlite
//    npx cap sync
//
// 2. Dans initDB(), crée la base SQLite :
//    import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
//    const sqlite = new SQLiteConnection(CapacitorSQLite);
//    const db = await sqlite.createConnection('supervisionci', false, 'no-encryption', 1);
//    await db.open();
//    await db.execute(`CREATE TABLE IF NOT EXISTS missions (...)`);
//
// 3. Remplace localStorage par des appels SQLite :
//    await db.query('SELECT * FROM missions')
//    await db.run('INSERT OR REPLACE INTO missions VALUES (...)', [...values])
//
// Le reste de la logique de sync reste identique.
// ══════════════════════════════════════════════════════════
