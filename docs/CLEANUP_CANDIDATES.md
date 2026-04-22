# Candidats au nettoyage — proposition, pas d'action

> Mode **conservatif** : ce document liste ce qui peut être supprimé / déplacé / consolidé, **avec justification pour chaque item**. Rien n'a été modifié automatiquement. À valider item par item avant d'agir.
>
> Date d'inventaire : 2026-04-22.

Les candidats sont classés par niveau de risque :

- 🟢 **Sans risque** — fichier généré, cache, duplication stricte, secret en clair dans un fichier gitignored.
- 🟡 **Risque faible** — doc obsolète, code one-shot déjà joué en prod, déclaration en doublon.
- 🟠 **Risque modéré** — nécessite un arbitrage métier / historique avant suppression.

---

## 🟢 Niveau 1 — Sans risque

### 1.1 `scripts/__pycache__/`

**Quoi :** cache Python (`import-delta-2026.cpython-310.pyc`) généré par l'exécution du script d'import one-shot.

**Pourquoi retirer :** cache local, déjà gitignored (2 occurrences dans `.gitignore`, d'ailleurs un doublon mineur à corriger aussi). Ne devrait jamais se retrouver sur disque dans un checkout propre.

**Action :**
```bash
rm -rf scripts/__pycache__/
```

**Risque :** aucun. Si le script Python est relancé un jour, le cache sera regénéré.

---

### 1.2 `tsconfig.tsbuildinfo` (177 KB)

**Quoi :** cache d'incremental build TypeScript.

**Pourquoi retirer :** gitignored (`*.tsbuildinfo`). Non commité. Suppression safe — regénéré au prochain `npm run build`.

**Action :**
```bash
rm tsconfig.tsbuildinfo
```

**Risque :** aucun.

---

### 1.3 Doublon dans `.gitignore`

**Quoi :** la ligne `__pycache__/` apparaît deux fois consécutives (~lignes 37–38).

**Pourquoi retirer :** cosmétique, aucun effet fonctionnel.

**Action :** enlever la seconde occurrence.

**Risque :** aucun.

---

### 1.4 `deploy-vercel.mjs` (racine)

**Quoi :** script de déploiement historique qui utilise l'API Vercel directement (avant la connexion Git officielle).

**Problèmes :**
1. **Contient des secrets en clair** (token Vercel + clé anon Supabase). Bien que gitignored, le fichier vit sur les disques locaux des devs et peut être copié par mégarde. **Point sécurité à traiter avant la passation au freelance.**
2. **N'est plus utilisé** : Vercel auto-build sur push `main` depuis plusieurs sprints. Aucun script npm ne l'appelle.
3. `SKIP_FILES` liste `README.md` et `COMPONENTS.md` → laisse penser que le script ignorait des fichiers spécifiques, preuve qu'il est non-standard et bricolé.

**Action recommandée :**
1. **Rotate immédiatement le token Vercel** listé dans le fichier (même s'il a probablement déjà expiré, par précaution).
2. `git rm -f deploy-vercel.mjs 2>/dev/null || rm deploy-vercel.mjs` (déjà non-tracké, suffit de supprimer le fichier local).
3. Documenter dans `docs/ROTATION.md` que le secret a été rotate.

**Risque :** aucun fonctionnellement. Sécurité : gain net.

---

### 1.5 `console.log` de debug laissé en place

**Quoi :** `src/components/clients/kyc-proposition-diff.tsx:566` contient :

```tsx
console.log('[kyc-apply] response', res.status, data, rawText)
```

**Pourquoi retirer :** logs en prod visibles dans la devtools console client, exposent potentiellement du contenu KYC sensible (payload `data` + `rawText`).

**Action :** supprimer la ligne.

**Risque :** aucun. La variable `rawText` était probablement utilisée pour diagnostiquer un bug ; si on a besoin de reproduire plus tard, on ajoute un log gated sur `process.env.NODE_ENV === 'development'`.

---

## 🟡 Niveau 2 — Risque faible (arbitrage rapide)

### 2.1 Triplet de docs redondantes sur le refactor commission (avril 2026)

**Quoi :**
- `TECHNICAL_SUMMARY.md` (7.8 KB)
- `IMPLEMENTATION_CHECKLIST.md` (4.1 KB)
- `CHANGES_SUMMARY.md` (4.1 KB)

Les trois décrivent **la même feature** (édition du `taux_gestion` + recalcul des commissions sur le détail dossier) avec 80 % de contenu dupliqué. Aucun des trois n'est à jour avec le code actuel.

**Pourquoi consolider :**
- Confusion pour un nouveau dev (lequel est la source de vérité ?).
- Le handbook (`docs/HANDBOOK.md` §6.2) couvre désormais le modèle de calcul. Le reste est du détail d'implémentation déjà en prod.

**Action recommandée :**
- Créer `docs/adr/2026-04-commission-taux.md` qui reprend l'essentiel des trois (décisions techniques, pourquoi, pièges).
- `git rm TECHNICAL_SUMMARY.md IMPLEMENTATION_CHECKLIST.md CHANGES_SUMMARY.md`.

**Risque :** faible. Le contenu n'est pas perdu (consolidé dans un ADR) et les décisions sont traçables dans `git log`.

---

### 2.2 `README.md` racine (boilerplate `create-next-app`)

**Quoi :** le README générique généré par `npx create-next-app`. 37 lignes, zéro information spécifique au projet.

**Action recommandée :** remplacer par un README projet minimal qui pointe vers `docs/HANDBOOK.md` :

```markdown
# PEV CRM

Outil interne de Private Equity Valley. CRM spécialisé gestion de patrimoine.

## Reprise développeur

Lire `docs/HANDBOOK.md` pour démarrer (setup, architecture, conventions, dette).

## Statut courant

Voir `STATUS.md` (avancement par chantier, mis à jour chaque sprint).

## Stack

Next.js 14 (App Router) · TypeScript · Supabase · Vercel · Tailwind · pdf-lib · nodemailer.
```

**Risque :** aucun.

---

### 2.3 Scripts d'import one-shot `import-delta-2026.*`

**Quoi :**
- `scripts/import-delta-2026.py` (≈ 20 KB)
- `scripts/import-delta-2026.ts` (alternative jamais utilisée en prod)
- `scripts/README.md`, `scripts/QUICKSTART.md`, `scripts/IMPLEMENTATION_NOTES.md` (3 docs sur ce même script)

Les trois docs référencent un chemin obsolète (`/sessions/wonderful-zen-hypatia/...`) → prouve qu'elles n'ont pas été mises à jour depuis la passation de session.

**Pourquoi archiver :** migration jouée en mars 2026 ; les 338 dossiers sont déjà en base. Relancer le script est impensable (doublons en cascade). Le garder accessible pour comprendre l'origine des données historiques, mais hors du chemin de travail courant.

**Action recommandée :**
```bash
mkdir -p scripts/archive/delta-2026-import/
git mv scripts/import-delta-2026.py scripts/archive/delta-2026-import/
git mv scripts/import-delta-2026.ts scripts/archive/delta-2026-import/
git mv scripts/README.md scripts/archive/delta-2026-import/
git mv scripts/QUICKSTART.md scripts/archive/delta-2026-import/
git mv scripts/IMPLEMENTATION_NOTES.md scripts/archive/delta-2026-import/
```

Puis créer un court `scripts/README.md` qui liste les migrations SQL par ordre d'application (aligné avec §5.5 du handbook).

**Risque :** faible. L'historique reste accessible dans `git log`.

---

### 2.4 Flags compilateur `ignoreBuildErrors` / `ignoreDuringBuilds`

**Quoi :** dans `next.config.mjs` :

```js
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```

**Problèmes :**
- Des erreurs TypeScript passent en prod. L'audit en a recensé 17 au moment du sprint sécurité (dont un flag regex `/.../s` rejeté par le target es2017 dans `parse-kyc/route.ts`).
- `ignoreDuringBuilds` pour ESLint masque les vrais lints (consoles, imports morts, règles React).

**Action recommandée :**
1. Ne **pas** retirer les flags immédiatement — la codebase ne passerait pas le build.
2. Créer un chantier dédié : lister les erreurs (`npx tsc --noEmit`), les catégoriser, corriger les bloquantes (la regex es2017 en tête), adapter le target, puis retirer les flags un par un.

**Risque :** modéré si on désactive d'un coup (le build cassera). Nul si on prépare le chantier proprement.

---

## 🟠 Niveau 3 — Risque modéré (nécessite arbitrage métier)

### 3.1 Scripts SQL archivables une fois leur effet validé

**Quoi :** une partie des 40+ scripts dans `scripts/` sont des correctifs ponctuels déjà appliqués en prod, qui n'ont plus d'utilité sauf comme archive :

- `scripts/dissociate-dumont-penard.sql` — fix data one-shot (couple clients mal rattaché).
- `scripts/fix-clients-drive-column-dedup.sql` — suppression de colonnes obsolètes.
- `scripts/fix-client-fk-cascades.sql` — ajout cascades FK.
- `scripts/inspect-*.sql` — scripts de diagnostic, pas des migrations.

**Pourquoi ne pas supprimer sans arbitrage :**
- Sans système de migration formalisé (cf. handbook §5.5), les devs s'appuient sur la liste ordonnée des scripts pour reconstituer un environnement. Un script "inutile" aujourd'hui peut servir de preuve historique d'un fix.
- Certains `fix-*.sql` ne sont pas idempotents. Les rejouer par erreur casserait la DB.

**Action recommandée :**
- Lors de l'introduction d'un système de migration (Supabase CLI / dbmate), créer une **baseline** (snapshot du schéma actuel).
- Déplacer les scripts historiques dans `scripts/archive/<date>/` avec un README indiquant leur rôle.
- Les `inspect-*.sql` peuvent partir en `scripts/diagnostics/` sans archivage.

**Risque :** modéré — toucher l'organisation des scripts peut semer la confusion pendant la transition. À faire en même temps que l'intro du système de migration (un seul changement).

---

### 3.2 Nombre de docs / duplication de documentation

**Au niveau docs racine + `docs/`** on a :

| Fichier | Rôle | Action suggérée |
|---|---|---|
| `README.md` | boilerplate | remplacer (2.2) |
| `STATUS.md` | avancement courant | **garder** |
| `COMPONENTS.md` | UI primitives | garder, linker depuis handbook |
| `TECHNICAL_SUMMARY.md` | refactor commission | consolider (2.1) |
| `IMPLEMENTATION_CHECKLIST.md` | refactor commission | consolider (2.1) |
| `CHANGES_SUMMARY.md` | refactor commission | consolider (2.1) |
| `docs/HANDBOOK.md` | reprise dev | **nouveau** |
| `docs/CLEANUP_CANDIDATES.md` | ce document | **nouveau** |
| `docs/PEV_CRM_Cahier_des_charges_v2.1.docx` | spec métier | garder |
| `docs/REGISTRE_TRAITEMENT.md` | RGPD | garder |
| `docs/ROTATION.md` | rotation secrets | garder |
| `docs/SECURITY_AUDIT.md` | audit | garder |
| `docs/kyc-e2e-test.md` | protocole test | garder |

**Cible après nettoyage** :

```
README.md (pointer vers handbook)
STATUS.md
COMPONENTS.md
docs/
├── HANDBOOK.md
├── CLEANUP_CANDIDATES.md (pourra être supprimé une fois joué)
├── PEV_CRM_Cahier_des_charges_v2.1.docx
├── REGISTRE_TRAITEMENT.md
├── ROTATION.md
├── SECURITY_AUDIT.md
├── kyc-e2e-test.md
└── adr/
    └── 2026-04-commission-taux.md (consolidation des 3 docs)
```

**Risque :** faible-modéré. Aucun fichier "vraiment important" n'est perdu ; tout est versionné dans Git.

---

## Actions rapides si tu veux dégrossir maintenant (safe)

À faire tel quel, sans attendre arbitrage métier :

```bash
# 1.1 + 1.2 — caches locaux
rm -rf scripts/__pycache__/
rm -f tsconfig.tsbuildinfo

# 1.3 — dedup .gitignore (vérifier à la main)
# Ouvrir .gitignore, retirer la seconde occurrence de __pycache__/

# 1.5 — log de debug
# Éditer src/components/clients/kyc-proposition-diff.tsx
# Supprimer ligne 566 : console.log('[kyc-apply] response', ...)
```

Avant de t'attaquer au 1.4 (`deploy-vercel.mjs`), **rotate d'abord le token Vercel** qui y figure (procédure dans `docs/ROTATION.md`).

---

## Récapitulatif par ordre d'impact

| Priorité | Item | Niveau | Effort | Gain |
|---|---|---|---|---|
| 1 | Rotate token Vercel + supprimer `deploy-vercel.mjs` | 🟢 | 15 min | Sécurité |
| 2 | Supprimer `console.log` KYC | 🟢 | 1 min | Sécurité / propreté logs |
| 3 | Consolider les 3 docs commission en 1 ADR | 🟡 | 30 min | Clarté docs |
| 4 | Remplacer README boilerplate | 🟡 | 5 min | Onboarding |
| 5 | Archiver `import-delta-2026.*` + 3 docs | 🟡 | 10 min | Clarté repo |
| 6 | Cleanup caches (pycache, tsbuildinfo, dedup gitignore) | 🟢 | 2 min | Propreté |
| 7 | Préparer chantier ignoreBuildErrors | 🟡 | ~1 jour dédié | Qualité code |
| 8 | Introduire système de migrations DB | 🟠 | ~2 jours | Onboarding dev |
| 9 | Réorganiser `scripts/` (archive + diagnostics) | 🟠 | ~3h | Clarté repo |

Total effort "safe cleanup" (items 1–6) : **moins d'une heure**. Gros gain de clarté avant la passation.
