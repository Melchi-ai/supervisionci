# ============================================================
# SUPERVISIONCI v2.0 — GUIDE COMPLET DE ZÉRO À APK
# ============================================================

## PRÉREQUIS — Installe ces logiciels sur ton PC

1. Node.js (version LTS) → https://nodejs.org
   - Vérifie l'installation : ouvre CMD → tape : node --version
   - Tu dois voir quelque chose comme : v20.x.x

2. Android Studio → https://developer.android.com/studio
   - Installe aussi le SDK Android (Android Studio le propose au démarrage)
   - Dans Android Studio : Tools → SDK Manager → Android 13 (API 33) ✓

3. Java JDK 17 → inclus avec Android Studio normalement
   - Vérifie : java --version dans CMD

---

## ÉTAPE 1 — PRÉPARER LE PROJET

Ouvre CMD (invite de commande) et tape :

```
cd C:\Users\TON_NOM\Desktop
mkdir supervisionci
cd supervisionci
```

Extrais le contenu de ce ZIP dans ce dossier supervisionci\

---

## ÉTAPE 2 — INSTALLER LES DÉPENDANCES

Dans CMD, depuis le dossier supervisionci\ :

```
npm install
```

Attends que tout s'installe (2-5 minutes selon ta connexion).

---

## ÉTAPE 3 — CONFIGURER TES CLÉS API

### 3a. Régénérer la clé Supabase (OBLIGATOIRE)
1. Va sur https://supabase.com → ton projet
2. Settings → API → clique "Regenerate" sur l'anon key
3. Copie la nouvelle clé

### 3b. Obtenir une clé Groq (IA gratuite)
1. Va sur https://console.groq.com
2. Crée un compte gratuit
3. API Keys → Create API Key
4. Copie la clé (commence par gsk_)

### 3c. Créer le fichier .env
Dans le dossier supervisionci\ :
- Copie le fichier .env.example
- Renomme la copie en .env (sans .example)
- Ouvre-le avec Notepad et remplis :

```
VITE_SUPABASE_URL=https://gyjsmjenzlmffneuivg.supabase.co
VITE_SUPABASE_ANON_KEY=ta_nouvelle_clé_supabase
VITE_GROQ_API_KEY=gsk_ta_clé_groq
```

---

## ÉTAPE 4 — CRÉER LES TABLES SUPABASE

1. Va sur https://supabase.com → ton projet
2. Clique sur "SQL Editor" dans le menu gauche
3. Clique "New query"
4. Ouvre le fichier supabase-schema.sql (avec Notepad)
5. Copie tout le contenu → colle dans l'éditeur SQL
6. Clique "Run" (bouton vert)
7. Tu dois voir "Success" ✅

---

## ÉTAPE 5 — TESTER L'APPLICATION WEB

Dans CMD :

```
npm run dev
```

Ouvre ton navigateur : http://localhost:5173
L'application doit s'ouvrir ✅

Pour arrêter : Ctrl+C dans CMD

---

## ÉTAPE 6 — INITIALISER CAPACITOR (une seule fois)

Dans CMD (depuis le dossier supervisionci\) :

```
npx cap init "SupervisionCI" "com.supervisionci.app" --web-dir=dist
npx cap add android
```

---

## ÉTAPE 7 — CONSTRUIRE L'APK ANDROID

```
npm run build
npx cap sync android
npx cap open android
```

Android Studio s'ouvre automatiquement.

Dans Android Studio :
1. Attends que Gradle finisse (barre en bas)
2. Menu : Build → Build Bundle(s) / APK(s) → Build APK(s)
3. Attends la compilation (5-10 minutes)
4. Clique "locate" dans la notification en bas à droite
5. Ton APK est dans : android\app\build\outputs\apk\debug\

---

## ÉTAPE 8 — INSTALLER SUR ANDROID

Méthode 1 — Cable USB :
```
npx cap run android
```

Méthode 2 — Copie manuelle :
- Copie le fichier app-debug.apk sur ton téléphone
- Sur le téléphone : Paramètres → Sécurité → Sources inconnues ✓
- Ouvre le fichier APK sur le téléphone → Installer

---

## RÉSUMÉ DES COMMANDES COURANTES

| Action | Commande |
|--------|----------|
| Lancer en web | npm run dev |
| Builder | npm run build |
| Synchroniser Android | npx cap sync android |
| Ouvrir Android Studio | npx cap open android |
| Tout en une commande | npm run android |

---

## FONCTIONNEMENT OFFLINE

✅ Sans internet : données sauvegardées sur l'appareil (localStorage)
✅ Avec internet : synchronisation automatique vers Supabase
✅ Indicateur visuel dans le header (🟢 En ligne / 🔴 Hors ligne)
✅ Badge "Local" / "Sync" sur chaque mission

---

## EN CAS DE PROBLÈME

Erreur "node not found"
→ Node.js n'est pas installé. Va sur nodejs.org

Erreur "npx cap not found"
→ Tape : npm install -g @capacitor/cli

Erreur Supabase "Invalid API key"
→ Vérifie ton fichier .env et régénère la clé

Erreur Android Studio "SDK not found"
→ Android Studio → Tools → SDK Manager → installe Android 13

---

Créé avec SupervisionCI v2.0
Contrôle Interne Hospitalier — République du Bénin
