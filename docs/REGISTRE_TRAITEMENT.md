# PEV CRM — Registre des activités de traitement (RGPD art. 30)

**Version** : 1.0 — 2026-04-21
**Responsable** : Private Equity Valley (Maxine, manager)
**Base juridique globale** : Contrat (exécution du mandat de conseil patrimonial) + obligations légales (LCB-FT, devoir de conseil, archivage réglementaire).

Ce registre liste les traitements de données personnelles opérés par le CRM PEV. Il est exigible en cas de contrôle CNIL et doit être tenu à jour à chaque évolution fonctionnelle. Les finalités correspondent aux fonctionnalités déployées à la date de version ci-dessus.

---

## 1. Traitement — Gestion de la relation client (prospects et clients)

**Finalités** : prospection, onboarding, suivi de la relation, devoir de conseil patrimonial.
**Base légale** : exécution du contrat + intérêt légitime pour la prospection avant signature du mandat.
**Catégories de personnes** : prospects, clients physiques (PP), clients personnes morales (PM, via leur représentant légal), co-titulaires.
**Catégories de données** :
- identité : civilité, prénom, nom, date et lieu de naissance, nationalité, situation matrimoniale, régime matrimonial, enfants (nombre et détails) ;
- coordonnées : email, téléphones, adresses postales ;
- profession : employeur, profession, CSP, secteur ;
- fiscalité : IR N/N-1, IFI, résidence fiscale ;
- patrimoine : immobilier, financier, assurance-vie, endettement ;
- PM : dénomination, forme juridique, SIREN, RCS, capital social, associés, bénéficiaires effectifs.
**Données sensibles** : aucune (pas de santé, pas d'opinions politiques/syndicales, pas de biométrie).
**Source** : saisie par le consultant (interview client) ou par le client via le portail KYC public.
**Destinataires** : consultant titulaire du client, managers, back-office PEV. Pas de transfert à des tiers hors sous-traitants (§6).
**Durée de conservation** : 10 ans après fin de relation (obligation LCB-FT et archivage réglementaire conseil en investissement).
**Mesures de sécurité** : RLS Postgres par `consultant_id`, audit_logs, chiffrement TLS 1.2+ en transit, chiffrement at-rest Supabase (AES-256), HSTS + CSP restrictive (cf. `next.config.mjs`).

## 2. Traitement — KYC signé et pièces justificatives

**Finalités** : conformité LCB-FT (connaissance client), devoir de conseil (MIF 2), archivage des pièces signées.
**Base légale** : obligation légale (code monétaire et financier, art. L.561-5) + exécution contractuelle.
**Catégories de personnes** : clients signataires (PP et représentants PM).
**Catégories de données** :
- fiche KYC complète (cf. traitement §1) ;
- signature électronique (token à usage unique, IP + user-agent à la signature, horodatage) ;
- PDF signé horodaté ;
- pièces jointes : copie CNI/passeport, justificatif domicile, RIB, avis d'imposition, Kbis (PM).
**Source** : portail public `/kyc/[token]` signé par le client OU upload par le consultant.
**Destinataires** : consultant titulaire, managers, back-office. PDF signé stocké dans Supabase Storage avec URL signée (pas d'accès public direct).
**Durée de conservation** : 5 ans après signature pour les pièces d'identité (art. L.561-12 CMF), 10 ans pour le KYC complet et le PDF signé.
**Mesures de sécurité** : token KYC à usage unique généré côté serveur (`pgcrypto`), signature tracée dans `audit_logs`, PDF stocké dans bucket privé Supabase Storage, `/api/kyc/sign-public` protégé par validation du token côté serveur (service_role).

## 3. Traitement — Gestion des consultants PEV (utilisateurs internes)

**Finalités** : authentification au CRM, suivi de l'activité, attribution des clients, calcul des commissions.
**Base légale** : exécution du contrat de travail / mandat de consultant.
**Catégories de personnes** : consultants salariés et indépendants mandatés par PEV.
**Catégories de données** : prénom, nom, email professionnel, rôle (`consultant`/`manager`/`back_office`), date d'entrée, signature (pour templates email).
**Source** : création manuelle par Maxine via Supabase Auth.
**Destinataires** : équipe PEV uniquement.
**Durée de conservation** : 5 ans après départ du consultant (obligations comptables et commissions).
**Mesures de sécurité** : auth Supabase (JWT HS256), MFA disponible, sessions révocables via `auth.admin_sign_out`, mots de passe stockés hashés (Supabase bcrypt).

## 4. Traitement — Dossiers et encaissements

**Finalités** : suivi du cycle de vie d'un produit souscrit (dossier), suivi des encaissements et calcul des commissions.
**Base légale** : exécution du contrat + obligations comptables (art. L.123-22 code commerce).
**Catégories de personnes** : clients (via `client_id`), consultants (via `consultant_id`), apporteurs d'affaires.
**Catégories de données** : produit souscrit, montant investi, date de souscription, montant de l'encaissement, date d'encaissement, commission associée.
**Source** : saisie consultant / back-office.
**Destinataires** : consultant propriétaire, managers, back-office.
**Durée de conservation** : 10 ans (archivage comptable).
**Mesures de sécurité** : RLS Postgres sur `dossiers` (RLS sur `encaissements` à activer — cf. SECURITY_AUDIT §2 et `fix-rls-encaissements.sql`). Finding documenté, rotation prévue sprint V1.

## 5. Traitement — Logs d'activité (`audit_logs`)

**Finalités** : traçabilité des opérations sensibles (création/modification/suppression), détection d'anomalies, preuve en cas d'incident.
**Base légale** : intérêt légitime (sécurité de l'information) + obligations LCB-FT (traçabilité).
**Catégories de personnes** : consultants (acteur du log), clients (record touché).
**Catégories de données** : user_id, nom consultant, action (create/update/delete), table, record_id, details JSONB (diff), timestamp.
**Source** : triggers Postgres + logs applicatifs côté API routes.
**Destinataires** : managers et back-office uniquement (RLS).
**Durée de conservation** : 3 ans (durée usuelle pour logs de sécurité).
**Mesures de sécurité** : RLS `audit_logs_select` réservée `manager`/`back_office`, insertion ouverte (pour logging application-side).

## 6. Sous-traitants (art. 28 RGPD)

| Sous-traitant | Rôle | Localisation serveurs | Base de transfert hors UE |
|---|---|---|---|
| **Supabase (Supabase Inc.)** | Hébergement base de données (Postgres), authentification, Storage | UE (projet Frankfurt `eu-central-1` à vérifier/confirmer) | N/A si UE ; sinon Clauses Contractuelles Types (CCT) à verser au contrat |
| **Vercel (Vercel Inc.)** | Hébergement frontend Next.js, edge runtime | UE (région `fra1` Paris/Frankfurt à privilégier) | CCT incluses dans les DPA Vercel |
| **Google Workspace (Google LLC)** | SMTP sortant via `support@private-equity-valley.com` (Nodemailer) | UE pour la résidence boîte mail, US pour les serveurs SMTP | Data Processing Amendment Google Workspace signé |
| **GitHub (Microsoft)** | Hébergement du code source (sans données clients) | US | CCT incluses — PAS de données clients dans le repo |

⚠️ **À vérifier / formaliser** avant mise en prod réelle :
- Région Supabase du projet PEV CRM (onglet Project Settings → General).
- Région Vercel (Project Settings → Functions region).
- DPA Supabase et Vercel signés et archivés (`docs/dpa/`).
- DPA Google Workspace signé par PEV.

## 7. Droits des personnes concernées

Les clients et consultants peuvent exercer leurs droits RGPD (accès, rectification, effacement, limitation, portabilité, opposition) en contactant :

- **DPO ou référent RGPD PEV** : à nommer (obligation selon volumétrie / sensibilité ; audit à faire).
- **Point de contact** : `support@private-equity-valley.com`.
- **Délai de réponse** : 1 mois (art. 12 RGPD), extensible à 3 mois en cas de demande complexe.

Procédure technique (à scripter) :
- **Accès/portabilité** : export JSON des lignes `clients`/`dossiers`/`encaissements`/`audit_logs` concernant la personne (route admin à développer, scope V2).
- **Effacement** : cas par cas — impossible avant expiration des délais de conservation légaux (10 ans LCB-FT). Anonymisation possible après départ.
- **Rectification** : directement via l'UI consultant.

## 8. Notification de violation (art. 33-34 RGPD)

- **Délai CNIL** : 72 h à partir de la détection.
- **Procédure interne** : voir `docs/ROTATION.md` §8 (En cas de fuite suspectée).
- **Seuil de notification aux personnes** : si risque élevé pour les droits et libertés (ex. fuite de KYC avec PJ, accès non autorisé à l'`auth.users`).

## 9. Analyse d'impact (AIPD / DPIA)

Statut : **non réalisée** à ce jour.

Déclenchement obligatoire dès lors que le traitement combine (CNIL, liste des types d'opérations soumises à AIPD) :
- collecte à grande échelle de données financières,
- évaluation / scoring automatisé (commissions calculées ≠ scoring à portée juridique, a priori hors scope),
- profilage automatisé des clients.

À faire pour V1.5 ou V2 si dépassement de ~500 clients actifs ou introduction d'un module analytics/ML sur les clients.

## 10. Journal des mises à jour du registre

| Date | Modification | Auteur |
|---|---|---|
| 2026-04-21 | Création initiale (V1.0) couvrant traitements 1–5, sous-traitants actuels (Supabase, Vercel, Google Workspace, GitHub), droits, violation, AIPD status. | Maxine |

---

**Rappels opérationnels** :
- Tenir à jour à chaque nouvelle fonctionnalité touchant des données personnelles (nouveau champ, nouvelle table, nouveau sous-traitant, nouvelle intégration).
- Revue semestrielle minimum (prochaine revue : **2026-10**).
- Archiver les DPA signés dans `docs/dpa/` (à créer).
- Si un traitement implique des données sensibles (santé, biométrie), compléter ce registre **avant** la mise en production et déclencher une AIPD.
