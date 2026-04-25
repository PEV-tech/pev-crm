-- Migration: Module Encours / Encaissements V2
-- Date: 2026-04-24

begin;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create table if not exists public.encaissement_batches (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('manuel','pdf','csv','auto_entree')),
  statut text not null default 'brouillon' check (statut in ('brouillon','valide','comptabilise','annule')),
  compagnie_id uuid null references public.compagnies(id) on delete set null,
  partenaire_label text null,
  annee int null check (annee is null or (annee between 2000 and 2100)),
  trimestre int null check (trimestre is null or (trimestre between 1 and 4)),
  periode_debut date null,
  periode_fin date null,
  date_reception date null,
  date_valeur date null,
  document_name text null,
  document_storage_path text null,
  document_hash text null check (document_hash is null or char_length(document_hash) <= 128),
  commentaire text null,
  created_by uuid null references public.consultants(id) on delete set null,
  validated_by uuid null references public.consultants(id) on delete set null,
  validated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_encaissement_batches_statut on public.encaissement_batches(statut);
create index if not exists idx_encaissement_batches_compagnie on public.encaissement_batches(compagnie_id);
create index if not exists idx_encaissement_batches_dates on public.encaissement_batches(date_reception, date_valeur);
create index if not exists idx_encaissement_batches_created_by on public.encaissement_batches(created_by);
create index if not exists idx_encaissement_batches_periode on public.encaissement_batches(annee, trimestre);
create unique index if not exists uq_encaissement_batches_document_hash on public.encaissement_batches(document_hash) where document_hash is not null;

create table if not exists public.encaissement_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.encaissement_batches(id) on delete cascade,
  type_commission text not null check (type_commission in ('entree','encours')),
  origine_ligne text not null default 'manuel' check (origine_ligne in ('manuel','import_pdf','import_csv','auto')),
  categorie text null,
  compagnie_id uuid null references public.compagnies(id) on delete set null,
  produit_id uuid null references public.produits(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  dossier_id uuid null references public.dossiers(id) on delete set null,
  label_source text null,
  periode_reference_debut date null,
  periode_reference_fin date null,
  montant_brut_percu numeric(15,2) not null default 0 check (montant_brut_percu >= 0),
  assiette_reference numeric(15,2) null check (assiette_reference is null or assiette_reference >= 0),
  taux_reference numeric(10,5) null check (taux_reference is null or taux_reference >= 0),
  devise text not null default 'EUR',
  statut_rapprochement text not null default 'non_rapproche' check (statut_rapprochement in ('non_rapproche','rapproche_auto','rapproche_manuel')),
  needs_review boolean not null default false,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encaissement_lines_rapproche_requires_dossier check (statut_rapprochement = 'non_rapproche' or dossier_id is not null)
);

create index if not exists idx_encaissement_lines_batch on public.encaissement_lines(batch_id);
create index if not exists idx_encaissement_lines_type on public.encaissement_lines(type_commission);
create index if not exists idx_encaissement_lines_client on public.encaissement_lines(client_id);
create index if not exists idx_encaissement_lines_dossier on public.encaissement_lines(dossier_id);
create index if not exists idx_encaissement_lines_compagnie_produit on public.encaissement_lines(compagnie_id, produit_id);
create index if not exists idx_encaissement_lines_rapprochement on public.encaissement_lines(statut_rapprochement);
create index if not exists idx_encaissement_lines_needs_review on public.encaissement_lines(needs_review) where needs_review = true;

create table if not exists public.encaissement_line_allocations (
  id uuid primary key default gen_random_uuid(),
  encaissement_line_id uuid not null references public.encaissement_lines(id) on delete cascade,
  applied_rule_id int not null check (applied_rule_id between 1 and 99),
  applied_rule_name text null,
  applied_split_snapshot jsonb not null,
  split_pct numeric(5,4) not null default 1.0000 check (split_pct > 0 and split_pct <= 1),
  consultant_id uuid null references public.consultants(id) on delete set null,
  apporteur_id uuid null references public.apporteurs(id) on delete set null,
  taux_remuneration_snapshot numeric(10,5) null check (taux_remuneration_snapshot is null or taux_remuneration_snapshot >= 0),
  taux_apporteur_ext_snapshot numeric(10,5) null check (taux_apporteur_ext_snapshot is null or taux_apporteur_ext_snapshot >= 0),
  commission_brute_snapshot numeric(15,2) not null default 0 check (commission_brute_snapshot >= 0),
  rem_apporteur_interne_montant numeric(15,2) not null default 0 check (rem_apporteur_interne_montant >= 0),
  rem_apporteur_ext_montant numeric(15,2) not null default 0 check (rem_apporteur_ext_montant >= 0),
  taux_pev_gestion_snapshot numeric(10,5) null check (taux_pev_gestion_snapshot is null or (taux_pev_gestion_snapshot >= 0 and taux_pev_gestion_snapshot <= 1)),
  part_pev_gestion_montant numeric(15,2) not null default 0 check (part_pev_gestion_montant >= 0),
  taux_cabinet_prededuction_snapshot numeric(10,5) null check (taux_cabinet_prededuction_snapshot is null or (taux_cabinet_prededuction_snapshot >= 0 and taux_cabinet_prededuction_snapshot <= 1)),
  part_cabinet_prededuction_montant numeric(15,2) not null default 0 check (part_cabinet_prededuction_montant >= 0),
  commission_nette_snapshot numeric(15,2) not null default 0 check (commission_nette_snapshot >= 0),
  part_consultant_montant numeric(15,2) not null default 0 check (part_consultant_montant >= 0),
  part_pool_plus_montant numeric(15,2) not null default 0 check (part_pool_plus_montant >= 0),
  part_thelo_montant numeric(15,2) not null default 0 check (part_thelo_montant >= 0),
  part_maxine_montant numeric(15,2) not null default 0 check (part_maxine_montant >= 0),
  part_stephane_montant numeric(15,2) not null default 0 check (part_stephane_montant >= 0),
  part_cabinet_montant numeric(15,2) not null default 0 check (part_cabinet_montant >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_encaissement_allocations_line on public.encaissement_line_allocations(encaissement_line_id);
create index if not exists idx_encaissement_allocations_consultant on public.encaissement_line_allocations(consultant_id);
create index if not exists idx_encaissement_allocations_apporteur on public.encaissement_line_allocations(apporteur_id);
create index if not exists idx_encaissement_allocations_rule on public.encaissement_line_allocations(applied_rule_id);

create or replace function public.fn_check_allocations_split_pct_sum()
returns trigger language plpgsql as $$
declare v_sum numeric(10,6); v_line_id uuid;
begin
  v_line_id := coalesce(new.encaissement_line_id, old.encaissement_line_id);
  select coalesce(sum(split_pct), 0) into v_sum from public.encaissement_line_allocations where encaissement_line_id = v_line_id;
  if v_sum > 1.0001 then raise exception 'SUM(split_pct) = % > 1 pour la ligne %', v_sum, v_line_id; end if;
  return null;
end;
$$;

drop trigger if exists trg_allocations_split_pct_sum on public.encaissement_line_allocations;
create constraint trigger trg_allocations_split_pct_sum
  after insert or update or delete on public.encaissement_line_allocations
  deferrable initially deferred for each row
  execute function public.fn_check_allocations_split_pct_sum();

drop trigger if exists trg_encaissement_batches_updated_at on public.encaissement_batches;
create trigger trg_encaissement_batches_updated_at before update on public.encaissement_batches
  for each row execute function public.set_updated_at();

drop trigger if exists trg_encaissement_lines_updated_at on public.encaissement_lines;
create trigger trg_encaissement_lines_updated_at before update on public.encaissement_lines
  for each row execute function public.set_updated_at();

drop view if exists public.v_encaissement_batches_summary;
create view public.v_encaissement_batches_summary as
select b.id, b.source_type, b.statut, b.compagnie_id, c.nom as compagnie_nom,
  coalesce(b.partenaire_label, c.nom) as partenaire_label,
  b.annee, b.trimestre, b.periode_debut, b.periode_fin, b.date_reception, b.date_valeur,
  b.document_name, b.document_hash, b.commentaire,
  b.created_by, creator.prenom as created_by_prenom, creator.nom as created_by_nom,
  b.validated_by, validator.prenom as validated_by_prenom, validator.nom as validated_by_nom,
  b.validated_at, b.created_at, b.updated_at,
  (select count(*) from public.encaissement_lines l where l.batch_id = b.id)::int as nb_lignes,
  (select count(*) from public.encaissement_lines l where l.batch_id = b.id and l.statut_rapprochement = 'non_rapproche')::int as nb_lignes_non_rapprochees,
  (select count(*) from public.encaissement_lines l where l.batch_id = b.id and l.needs_review = true)::int as nb_lignes_a_verifier,
  (select coalesce(sum(l.montant_brut_percu), 0) from public.encaissement_lines l where l.batch_id = b.id)::numeric(15,2) as montant_total_brut
from public.encaissement_batches b
left join public.compagnies c on c.id = b.compagnie_id
left join public.consultants creator on creator.id = b.created_by
left join public.consultants validator on validator.id = b.validated_by;

alter view public.v_encaissement_batches_summary set (security_invoker = true);

create or replace function public.can_access_encaissement_batch(p_batch_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.encaissement_batches b where b.id = p_batch_id
    and (public.is_manager() or public.is_back_office() or b.created_by = public.get_current_consultant_id()));
$$;

create or replace function public.consultant_has_allocation_on_line(p_line_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.encaissement_line_allocations a
    where a.encaissement_line_id = p_line_id and a.consultant_id = public.get_current_consultant_id());
$$;

create or replace function public.can_access_encaissement_line(p_line_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.encaissement_lines l
    join public.encaissement_batches b on b.id = l.batch_id
    where l.id = p_line_id
      and (public.is_manager() or public.is_back_office()
           or b.created_by = public.get_current_consultant_id()
           or public.consultant_has_allocation_on_line(l.id)));
$$;

revoke all on function public.can_access_encaissement_batch(uuid) from public;
grant execute on function public.can_access_encaissement_batch(uuid) to authenticated;
revoke all on function public.consultant_has_allocation_on_line(uuid) from public;
grant execute on function public.consultant_has_allocation_on_line(uuid) to authenticated;
revoke all on function public.can_access_encaissement_line(uuid) from public;
grant execute on function public.can_access_encaissement_line(uuid) to authenticated;

alter table public.encaissement_batches enable row level security;
alter table public.encaissement_batches force row level security;
alter table public.encaissement_lines enable row level security;
alter table public.encaissement_lines force row level security;
alter table public.encaissement_line_allocations enable row level security;
alter table public.encaissement_line_allocations force row level security;

drop policy if exists encaissement_batches_select on public.encaissement_batches;
create policy encaissement_batches_select on public.encaissement_batches for select to authenticated using (
  public.is_manager() or public.is_back_office() or created_by = public.get_current_consultant_id()
  or exists (select 1 from public.encaissement_lines l
    join public.encaissement_line_allocations a on a.encaissement_line_id = l.id
    where l.batch_id = encaissement_batches.id and a.consultant_id = public.get_current_consultant_id()));

drop policy if exists encaissement_batches_insert on public.encaissement_batches;
create policy encaissement_batches_insert on public.encaissement_batches for insert to authenticated with check (
  public.is_manager() or public.is_back_office() or created_by = public.get_current_consultant_id());

drop policy if exists encaissement_batches_update on public.encaissement_batches;
create policy encaissement_batches_update on public.encaissement_batches for update to authenticated
using (public.is_manager() or public.is_back_office() or created_by = public.get_current_consultant_id())
with check (public.is_manager() or public.is_back_office() or created_by = public.get_current_consultant_id());

drop policy if exists encaissement_batches_delete on public.encaissement_batches;
create policy encaissement_batches_delete on public.encaissement_batches for delete to authenticated
using (public.is_manager() or public.is_back_office());

drop policy if exists encaissement_lines_select on public.encaissement_lines;
create policy encaissement_lines_select on public.encaissement_lines for select to authenticated using (
  public.can_access_encaissement_batch(batch_id) or public.consultant_has_allocation_on_line(id));

drop policy if exists encaissement_lines_insert on public.encaissement_lines;
create policy encaissement_lines_insert on public.encaissement_lines for insert to authenticated
with check (public.can_access_encaissement_batch(batch_id));

drop policy if exists encaissement_lines_update on public.encaissement_lines;
create policy encaissement_lines_update on public.encaissement_lines for update to authenticated
using (public.can_access_encaissement_batch(batch_id))
with check (public.can_access_encaissement_batch(batch_id));

drop policy if exists encaissement_lines_delete on public.encaissement_lines;
create policy encaissement_lines_delete on public.encaissement_lines for delete to authenticated
using (public.is_manager() or public.is_back_office());

drop policy if exists encaissement_allocations_select on public.encaissement_line_allocations;
create policy encaissement_allocations_select on public.encaissement_line_allocations for select to authenticated using (
  public.is_manager() or public.is_back_office()
  or consultant_id = public.get_current_consultant_id()
  or public.can_access_encaissement_line(encaissement_line_id));

drop policy if exists encaissement_allocations_insert on public.encaissement_line_allocations;
create policy encaissement_allocations_insert on public.encaissement_line_allocations for insert to authenticated
with check (public.is_manager() or public.is_back_office());

drop policy if exists encaissement_allocations_update on public.encaissement_line_allocations;
create policy encaissement_allocations_update on public.encaissement_line_allocations for update to authenticated
using (public.is_manager() or public.is_back_office())
with check (public.is_manager() or public.is_back_office());

drop policy if exists encaissement_allocations_delete on public.encaissement_line_allocations;
create policy encaissement_allocations_delete on public.encaissement_line_allocations for delete to authenticated
using (public.is_manager() or public.is_back_office());

commit;
