-- ============================================================
-- SCHEMA SUPABASE — SupervisionCI
-- À coller dans : Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- TABLE : grilles
CREATE TABLE IF NOT EXISTS grilles (
  id          TEXT PRIMARY KEY,
  titre       TEXT NOT NULL,
  description TEXT,
  source      TEXT DEFAULT 'manual',
  domaines    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : missions
CREATE TABLE IF NOT EXISTS missions (
  id           TEXT PRIMARY KEY,
  nom          TEXT NOT NULL,
  structure    TEXT NOT NULL,
  localisation TEXT,
  date         TEXT NOT NULL,
  superviseur  TEXT NOT NULL,
  objectif     TEXT,
  type         TEXT DEFAULT 'Contrôle interne',
  statut       TEXT DEFAULT 'en_cours',
  grille_id    TEXT REFERENCES grilles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE : reponses (remplissage terrain)
CREATE TABLE IF NOT EXISTS reponses (
  id          TEXT PRIMARY KEY,
  mission_id  TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  point_id    TEXT NOT NULL,
  valeur      TEXT,         -- 'oui' | 'non' | 'na'
  observation TEXT,
  note        INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mission_id, point_id)
);

-- TABLE : rapports générés
CREATE TABLE IF NOT EXISTS rapports (
  id          TEXT PRIMARY KEY,
  mission_id  TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  contenu_ia  TEXT,
  taux        INTEGER,
  nb_conformes   INTEGER,
  nb_nonconformes INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Activer Row Level Security (RLS) — sécurité basique
ALTER TABLE grilles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reponses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapports ENABLE ROW LEVEL SECURITY;

-- Politique : accès public pour l'instant (à sécuriser avec auth plus tard)
CREATE POLICY "Public access" ON grilles  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON missions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON reponses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access" ON rapports FOR ALL USING (true) WITH CHECK (true);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_missions_statut    ON missions(statut);
CREATE INDEX IF NOT EXISTS idx_reponses_mission   ON reponses(mission_id);
CREATE INDEX IF NOT EXISTS idx_rapports_mission   ON rapports(mission_id);
