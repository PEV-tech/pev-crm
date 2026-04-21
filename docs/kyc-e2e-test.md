# KYC — Test de bout en bout

> **Destinataire** : Maxine + consultants PEV pour recette
> **Dernière mise à jour** : 2026-04-21
> **Portée** : valide l'ensemble du workflow KYC, de la création du
> client jusqu'à la consultation du PDF signé et de la notification
> email consultant. Couvre les deux types de personnes (physique et
> morale) et les deux voies de signature (complète et incomplète avec
> consentement explicite).

## Pré-requis d'environnement

Avant de lancer la recette, vérifier :

1. `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   positionnées côté Vercel et en local (`.env.local`).
2. `SUPABASE_SERVICE_ROLE_KEY` positionnée **uniquement côté serveur**
   (Vercel environment). Sans cette clé, la signature fonctionne mais
   le PDF n'est pas généré — le log serveur contient un warning
   explicite (`SUPABASE_SERVICE_ROLE_KEY manquant — PDF non généré`).
3. `RESEND_API_KEY` positionnée côté serveur. Sans elle la notif
   email est skippée en douceur (`skipped: 'no-api-key'`). Aucune
   autre régression.
4. `RESEND_FROM` (optionnel) ; défaut
   `PEV KYC <kyc@private-equity-valley.com>`. Le domaine doit être
   vérifié dans Resend pour que le mail ne parte pas en spam.
5. La migration `scripts/add-kyc-pdf-storage.sql` doit être appliquée
   en prod (smoke test OK le 2026-04-21 :
   `{col_path:1, col_ts:1, bucket:1, policies:4}`).
6. Le bucket `kyc-documents` existe, est **privé** et a les 4 policies
   RLS attendues sur `storage.objects` (insert/update service_role,
   select authenticated, delete via `is_manager()`).

## Scénario 1 — Personne Physique, signature complète

### 1.1 Créer le client

- Se connecter au CRM en tant que consultant (ex.
  guillaume@private-equity-valley.com).
- Menu **Clients** → **Nouveau client**.
- Type de personne : **Physique**.
- Remplir a minima les champs obligatoires : civilité, prénom, nom,
  date + lieu de naissance, nationalité, adresse complète, email,
  téléphone. Affecter un consultant.
- Enregistrer. Le client apparaît dans la liste **Clients**.

**Attendu** : ligne visible, statut KYC = *Brouillon*.

### 1.2 Renseigner les données KYC

- Ouvrir la fiche du client.
- Dérouler **KYC — Carte d'identité client** et cliquer
  **Modifier** (icône crayon).
- Remplir **toutes** les sections : état civil, situation familiale,
  pro, revenus, patrimoine immobilier (au moins une ligne), produits
  financiers (au moins une ligne), emprunts (au moins un), fiscalité,
  objectifs.
- Enregistrer.

**Attendu** :
- Bandeau de complétude en haut de la section = **100 %**.
- Bouton **Envoyer le lien de signature** activé.

### 1.3 Envoyer le lien de signature

- Cliquer **Envoyer le lien** → choisir **Copier le lien** ou
  **Envoyer par email** (selon préférence ; l'email part sur
  l'adresse saisie dans la fiche).
- Récupérer l'URL `https://pev-crm.vercel.app/kyc/<token>`.

**Attendu** : le statut de la fiche passe à *Envoyé* ; un
`kyc_link_token` est visible côté BDD (champ `clients.kyc_link_token`,
expiration 30 jours).

### 1.4 Ouvrir le lien côté client

- Dans une fenêtre privée ou un autre navigateur (simulation
  client), ouvrir l'URL.
- Vérifier que la page affiche le nom du client, le taux de
  complétude (100 %), et les cases à cocher pour les consentements
  CNIL/RGPD.

**Attendu** :
- Pas d'authentification requise (le token fait foi).
- Bandeau *Complétude : 100 %* (vert).

### 1.5 Signer

- Saisir le nom complet (doit correspondre au nom légal).
- Cocher **le consentement d'exactitude** (obligatoire).
- Cliquer **Signer le KYC**.

**Attendu** :
- La page confirme la signature.
- Côté BDD : `clients.kyc_signed_at` est rempli, `kyc_signer_name`
  reflète le nom saisi, `kyc_signer_ip` contient l'IP publique
  (renseignée par Vercel via `x-forwarded-for`, pas `null`),
  `kyc_incomplete_signed = false`, `kyc_completion_rate = 100`.
- Un fichier `kyc-AAAA-MM-JJTHH-MM-ss.pdf` est présent dans
  `kyc-documents/clients/<client_id>/`.
- `clients.kyc_pdf_storage_path` pointe vers ce fichier et
  `kyc_pdf_generated_at` est récent.

### 1.6 Notification consultant

- Consulter la boîte email du consultant rattaché.

**Attendu** :
- Email reçu avec objet *[KYC] Signature complète — `{client}`*.
- Corps FR : résumé (signataire, date, 100 %), lien vers la fiche
  client, **PDF en pièce jointe** (`KYC-<client>.pdf`).
- Pas d'erreur dans les logs Vercel (pas de `[kyc-email] …`).

### 1.7 Côté fiche CRM

- Rafraîchir la fiche client côté consultant.

**Attendu** :
- La section KYC affiche le bandeau vert *Signé le …* avec le nom
  du signataire.
- Un lien **Télécharger le PDF signé** est présent et télécharge
  bien le PDF (redirect 302 vers une signed URL valable 5 min,
  servie par `/api/kyc/pdf/[clientId]`).
- Le PDF ouvert contient :
  - En-tête PEV (Private Equity Valley / Ethique & Patrimoine,
    RCS Paris 803 414 796, Maxine Laisné responsable).
  - Bloc Personne Physique complet (état civil, famille, revenus,
    patrimoine, fiscalité, objectifs).
  - Bloc signature en fin avec nom saisi, date, IP.
  - **Aucun bandeau rouge** d'incomplétude.

## Scénario 2 — Personne Physique, signature INCOMPLÈTE

Même chemin que le Scénario 1, mais à l'étape 1.2 on laisse
**volontairement** au moins un champ vide (ex. patrimoine
immobilier vide).

**Différences attendues** :

- À l'étape 1.4, le portail public affiche *Complétude : X %* en
  orange et liste les champs manquants.
- Une case à cocher **supplémentaire** apparaît : *Je consens à
  signer un dossier incomplet et assume la responsabilité des
  informations manquantes*. Elle doit être cochée sinon le bouton
  **Signer le KYC** reste désactivé.
- Après signature :
  - `clients.kyc_incomplete_signed = true`.
  - `kyc_consent_incomplete = true`.
  - `kyc_missing_fields` contient le tableau des clés (ex.
    `["patrimoine_immobilier"]`).
  - Le PDF comporte un **bandeau rouge** en haut signalant
    l'incomplétude + la liste des champs manquants + le
    consentement explicite.
  - L'email consultant a pour objet *[KYC] Signature INCOMPLÈTE
    (X%) — `{client}`* et détaille les champs manquants.

## Scénario 3 — Personne Morale

Même flux, mais à la création on choisit type = **Morale** et on
remplit : raison sociale, forme juridique, SIREN/SIRET, capital
social, date de création, représentant légal (à rattacher à un
Personne Physique).

**Attendu** :
- Le PDF généré utilise la mise en page PM (éléments généraux /
  situation financière / patrimoine) sans la section état civil
  individuelle.
- L'email consultant nomme la raison sociale plutôt que le nom
  individuel.

## Scénario 4 — Dégradations gracieuses

Tests à ne relancer que ponctuellement (hors recette standard) —
ils valident que le système ne bloque pas en cas de panne
auxiliaire.

### 4.1 Clé service_role absente

- Supprimer temporairement `SUPABASE_SERVICE_ROLE_KEY` de
  l'environnement.
- Rejouer les étapes 1.1 à 1.5.

**Attendu** :
- La signature réussit (RPC OK).
- Pas de PDF, pas d'email.
- Log serveur : `[kyc/sign-public] SUPABASE_SERVICE_ROLE_KEY
  manquant — PDF non généré`.
- La fiche CRM affiche *Signé* mais le lien de téléchargement PDF
  est absent.

### 4.2 Clé Resend absente

- Remettre `SUPABASE_SERVICE_ROLE_KEY`. Supprimer `RESEND_API_KEY`.
- Rejouer le flow.

**Attendu** :
- La signature et le PDF sont OK.
- Email non envoyé, log serveur :
  `[kyc/sign-public] email not sent: no-api-key`.

### 4.3 Consultant sans email

- Détacher le client de tout consultant (`consultant_id = null`).

**Attendu** :
- Log serveur : `[kyc/sign-public] email not sent: no-consultant`.
- Pas d'erreur remontée à l'utilisateur ; la signature est valide.

## Points d'audit ACPR / DDA

À vérifier côté BDD après chaque signature en production :

- `kyc_signer_ip` non null → traçabilité de l'origine.
- `kyc_signed_at` (horodatage serveur, pas client).
- `kyc_missing_fields` et `kyc_completion_rate` pour les
  signatures incomplètes.
- `kyc_pdf_storage_path` pour l'horodatage de la preuve PDF.
- `kyc_incomplete_signed`, `kyc_consent_incomplete`,
  `kyc_consent_accuracy` → faisceau de preuve du consentement
  explicite.

Le PDF stocké est **immuable** (upsert: true mais le nom contient
l'horodatage — chaque signature crée un nouveau fichier si on
resigne un KYC modifié).

## Ouvertures / pistes d'amélioration

- Ajouter un audit log immuable (table `kyc_audit_log`) pour
  tracer toutes les tentatives de signature, pas juste la dernière
  réussie.
- Générer une version signée électroniquement au sens eIDAS
  (PAdES) plutôt qu'un PDF statique — nécessite une intégration
  tierce (DocuSign / Yousign).
- Webhook Resend pour capturer les bounces et prévenir Maxine si
  l'email consultant n'a pas été délivré.
- Rotation automatique des tokens de lien public expirés avec
  notification client.
