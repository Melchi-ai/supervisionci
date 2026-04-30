// src/lib/aiService.js
// ============================================================
// SERVICE IA — Groq (Llama 3, gratuit) avec fallback local
// ============================================================
// Clé API Groq gratuite : https://console.groq.com
// Mets ta clé dans .env : VITE_GROQ_API_KEY=gsk_xxxxx
// ============================================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama3-70b-8192'; // Le plus capable, gratuit

// Ta clé Groq (depuis .env)
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || 'COLLE_TA_CLÉ_GROQ_ICI';

// ── GÉNÉRATEUR DE RAPPORT IA ─────────────────────────────

export async function genererRapportIA({ mission, grille, reponses, stats }) {
  // Construire la liste des non-conformités
  const nonConformites = [];
  grille.domaines.forEach(d => {
    d.points.forEach(p => {
      const r = reponses[p.id];
      if (r?.valeur === 'non') {
        nonConformites.push(`• [${d.titre}] ${p.controle} → Risque: ${p.risque}${r.observation ? ` | Observation: ${r.observation}` : ''}`);
      }
    });
  });

  const prompt = `Tu es un expert senior en contrôle interne de gestion dans les établissements de santé publics au Bénin.

MISSION DE SUPERVISION
━━━━━━━━━━━━━━━━━━━━━
Mission     : ${mission.nom}
Structure   : ${mission.structure} (${mission.localisation || 'Bénin'})
Date        : ${mission.date}
Superviseur : ${mission.superviseur}
Type        : ${mission.type}
Objectif    : ${mission.objectif || 'Évaluation du mécanisme de contrôle interne de gestion'}
Grille      : ${grille.titre}

RÉSULTATS QUANTITATIFS
━━━━━━━━━━━━━━━━━━━━━
Taux de conformité global : ${stats.taux !== null ? stats.taux + '%' : 'Non calculé'}
Points évalués   : ${stats.total}
Conformes        : ${stats.oui}
Non conformes    : ${stats.non}
Non applicables  : ${stats.na || 0}

NON-CONFORMITÉS IDENTIFIÉES (${nonConformites.length})
━━━━━━━━━━━━━━━━━━━━━
${nonConformites.length ? nonConformites.join('\n') : 'Aucune non-conformité majeure identifiée.'}

Rédige un rapport de mission officiel structuré en 4 sections :

1. RÉSUMÉ EXÉCUTIF
   (2-3 phrases synthétisant l'état global du contrôle interne)

2. POINTS CRITIQUES IDENTIFIÉS
   (Liste des 3 à 5 dysfonctionnements les plus urgents, avec niveau de risque)

3. RECOMMANDATIONS PRIORITAIRES
   (6 à 8 actions concrètes, classées par ordre d'urgence — IMMÉDIAT / COURT TERME / MOYEN TERME)

4. CONCLUSION ET APPRÉCIATION GLOBALE
   (Appréciation du niveau de maturité du contrôle interne : Insuffisant / En développement / Satisfaisant / Exemplaire)

Utilise un ton administratif professionnel, adapté aux structures sanitaires déconcentrées de la République du Bénin.
Sois précis, factuel et actionnable. Évite le jargon inutile.`;

  // Essayer Groq en premier
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.4,
      }),
    });

    if (!response.ok) throw new Error(`Groq HTTP ${response.status}`);
    const data = await response.json();
    return {
      success: true,
      source: 'groq',
      contenu: data.choices?.[0]?.message?.content || 'Réponse vide.',
    };
  } catch (groqError) {
    console.warn('Groq indisponible, fallback local:', groqError.message);
    // Fallback : rapport généré localement sans IA
    return { success: true, source: 'local', contenu: genererRapportLocal({ mission, stats, nonConformites }) };
  }
}

// ── RAPPORT LOCAL (sans internet / sans IA) ───────────────

function genererRapportLocal({ mission, stats, nonConformites }) {
  const niveau = stats.taux >= 80 ? 'SATISFAISANT' : stats.taux >= 60 ? 'EN DÉVELOPPEMENT' : 'INSUFFISANT';
  const date = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  return `1. RÉSUMÉ EXÉCUTIF

La mission de supervision conduite le ${mission.date} au sein de la structure "${mission.structure}" révèle un niveau de contrôle interne ${niveau.toLowerCase()} avec un taux de conformité global de ${stats.taux ?? '—'}%. Sur ${stats.total} points évalués, ${stats.oui} sont conformes et ${stats.non} présentent des défaillances nécessitant une attention immédiate.

2. POINTS CRITIQUES IDENTIFIÉS

${nonConformites.length > 0
  ? nonConformites.slice(0, 5).map((nc, i) => `${i + 1}. ${nc.replace('• ', '')}`).join('\n')
  : '✓ Aucune non-conformité critique identifiée lors de cette mission.'}

3. RECOMMANDATIONS PRIORITAIRES

IMMÉDIAT (0-30 jours) :
${stats.non > 0 ? `• Mettre en place un plan de correction pour les ${stats.non} non-conformité(s) identifiée(s)\n• Informer la hiérarchie des dysfonctionnements constatés` : '• Maintenir le niveau de conformité atteint'}

COURT TERME (1-3 mois) :
• Organiser une session de formation sur les procédures de contrôle interne
• Mettre à jour le manuel de procédures si nécessaire
• Renforcer les contrôles sur les domaines à risque identifiés

MOYEN TERME (3-6 mois) :
• Effectuer une mission de suivi pour vérifier la mise en œuvre des recommandations
• Réaliser une cartographie des risques mise à jour
• Renforcer le système de reporting périodique

4. CONCLUSION ET APPRÉCIATION GLOBALE

Niveau de maturité du contrôle interne : ${niveau}

${stats.taux >= 80
  ? 'Le système de contrôle interne de la structure présente un niveau satisfaisant. Les efforts de maintien et d\'amélioration continue doivent être soutenus.'
  : stats.taux >= 60
  ? 'Le système de contrôle interne est en cours de développement. Des efforts significatifs sont nécessaires pour atteindre un niveau de conformité optimal.'
  : 'Le système de contrôle interne présente des défaillances importantes. Une intervention urgente est requise pour prévenir les risques de fraude, d\'erreur et de non-conformité réglementaire.'}

[Rapport généré automatiquement le ${date} — SupervisionCI v2.0]`;
}
