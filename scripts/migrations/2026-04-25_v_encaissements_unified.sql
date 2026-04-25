-- Migration: Vue v_encaissements_unified
-- Date: 2026-04-25
--
-- Objectifs :
--   1. Réécrire les labels du flux existant : "ALDERAN - Encours" → "Prénom NOM — Produit (encours)"
--   2. Faire remonter les lignes du module Encours V2 (lots validés) dans la page Encaissements
--   3. Mois calculé depuis date_reception du lot (cf. arbitrage Q2 du 2026-04-25)
--
-- Architecture :
--   - Source 1 : table `encaissements` (alimentée par fn_create_encaissement). Label réécrit.
--   - Source 2 : `encaissement_lines` JOIN `encaissement_line_allocations` JOIN `encaissement_batches`
--                Filtré sur batches en statut 'valide' ou 'comptabilise' (Q1 = B).
--   - UNION ALL → vue `v_encaissements_unified`
--
-- Le wrapper côté front (encaissements-client-wrapper.tsx) est modifié pour
-- lire cette vue au lieu de la table `encaissements`. Aucune modif du
-- trigger fn_create_encaissement, aucune modif de la table encaissements.

begin;

create or replace view public.v_encaissements_unified as

-- ─── Source 1 : flux existant (encaissements auto, depuis factures payées) ───
select
  e.id,
  e.dossier_id,
  e.client_nom,
  e.client_prenom,
  e.client_pays,
  e.consultant_id,
  e.consultant_nom,
  e.consultant_prenom,
  e.produit_nom,
  e.compagnie_nom,
  e.apporteur_id,
  e.apporteur_ext_nom,
  e.taux_apporteur_ext,
  e.annee,
  e.mois,
  e.date_encaissement,
  e.created_at,
  e.commission_brute,
  e.commission_nette,
  e.montant_dossier,
  e.part_cabinet,
  e.part_maxine,
  e.part_thelo,
  e.part_pool_plus,
  e.pool_total,
  e.rem_consultant,
  e.rem_apporteur_ext,
  -- Réécriture du label : "Prénom NOM — Produit" (ou compagnie si SCPI)
  -- + suffixe " (encours)" si le label original contient le mot encours
  case
    when coalesce(trim(coalesce(e.client_prenom, '') || ' ' || coalesce(e.client_nom, '')), '') = ''
      then coalesce(e.label, '(client ?)')
    else
      trim(coalesce(e.client_prenom, '') || ' ' || coalesce(e.client_nom, ''))
        || case
             when e.produit_nom is not null and upper(e.produit_nom) <> 'SCPI' then ' — ' || e.produit_nom
             when e.compagnie_nom is not null then ' — ' || e.compagnie_nom
             when e.produit_nom is not null then ' — ' || e.produit_nom
             else ''
           end
        || case
             when coalesce(e.label, '') ilike '%encours%' then ' (encours)'
             else ''
           end
  end as label,
  'auto'::text as source_type
from public.encaissements e

union all

-- ─── Source 2 : lignes V2 (lots validés ou comptabilisés) ───
select
  l.id,
  l.dossier_id,
  d.client_nom,
  d.client_prenom,
  d.client_pays,
  d.consultant_id,
  d.consultant_nom,
  d.consultant_prenom,
  d.produit_nom,
  d.compagnie_nom,
  a.apporteur_id,
  d.apporteur_ext_nom,
  a.taux_apporteur_ext_snapshot::numeric as taux_apporteur_ext,
  -- Mois et année calculés depuis date_reception du lot (Q2 = mois associé)
  extract(year from b.date_reception)::int as annee,
  case extract(month from b.date_reception)::int
    when 1 then 'JANVIER'
    when 2 then 'FEVRIER'
    when 3 then 'MARS'
    when 4 then 'AVRIL'
    when 5 then 'MAI'
    when 6 then 'JUIN'
    when 7 then 'JUILLET'
    when 8 then 'AOUT'
    when 9 then 'SEPTEMBRE'
    when 10 then 'OCTOBRE'
    when 11 then 'NOVEMBRE'
    when 12 then 'DECEMBRE'
  end as mois,
  b.date_reception::date as date_encaissement,
  l.created_at,
  a.commission_brute_snapshot::numeric as commission_brute,
  a.commission_nette_snapshot::numeric as commission_nette,
  d.montant::numeric as montant_dossier,
  -- Cabinet total = pré-déduction + post-rule
  (a.part_cabinet_montant + a.part_cabinet_prededuction_montant)::numeric as part_cabinet,
  a.part_maxine_montant::numeric as part_maxine,
  a.part_thelo_montant::numeric as part_thelo,
  a.part_pool_plus_montant::numeric as part_pool_plus,
  (a.part_pool_plus_montant + a.part_thelo_montant + a.part_maxine_montant)::numeric as pool_total,
  -- rem_consultant = part_consultant ou part_stephane (un seul est non nul selon la règle)
  (a.part_consultant_montant + a.part_stephane_montant)::numeric as rem_consultant,
  a.rem_apporteur_ext_montant::numeric as rem_apporteur_ext,
  -- Label propre + suffixe " (encours)" si type = encours
  case
    when coalesce(trim(coalesce(d.client_prenom, '') || ' ' || coalesce(d.client_nom, '')), '') = ''
      then '(client ?)'
    else
      trim(coalesce(d.client_prenom, '') || ' ' || coalesce(d.client_nom, ''))
        || case
             when d.produit_nom is not null and upper(d.produit_nom) <> 'SCPI' then ' — ' || d.produit_nom
             when d.compagnie_nom is not null then ' — ' || d.compagnie_nom
             when d.produit_nom is not null then ' — ' || d.produit_nom
             else ''
           end
        || case
             when l.type_commission = 'encours' then ' (encours)'
             else ''
           end
  end as label,
  'encours_v2'::text as source_type
from public.encaissement_lines l
join public.encaissement_batches b on b.id = l.batch_id
join public.encaissement_line_allocations a on a.encaissement_line_id = l.id
join public.v_dossiers_complets d on d.id = l.dossier_id
where b.statut in ('valide', 'comptabilise')
  and l.statut_rapprochement in ('rapproche_auto', 'rapproche_manuel');

alter view public.v_encaissements_unified set (security_invoker = true);

commit;
