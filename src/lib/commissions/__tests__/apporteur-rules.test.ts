import { describe, expect, it } from 'vitest'
import {
  computeApporteurFee,
  periodsForEncoursOneshot,
} from '../apporteur-rules'
import type {
  Apporteur,
  ApporteurCompensationRule,
  Compagnie,
  TauxProduitCompagnie,
} from '@/types/database'

const yoann: Pick<Apporteur, 'id' | 'taux_commission'> = {
  id: 'yoann-uuid',
  taux_commission: null,
}

const ruleSCPI: ApporteurCompensationRule = {
  id: 'rule-1',
  apporteur_id: 'yoann-uuid',
  product_category: 'SCPI',
  rule_type: 'entry_pct_montant',
  rate_pct: 1,
  encours_months: null,
  active: true,
  created_at: '2026-04-27T00:00:00Z',
  updated_at: '2026-04-27T00:00:00Z',
  updated_by: null,
}

const rulePE: ApporteurCompensationRule = {
  ...ruleSCPI,
  id: 'rule-2',
  product_category: 'PE',
  rule_type: 'entry_pct_frais',
  rate_pct: 25,
}

const ruleCAV: ApporteurCompensationRule = {
  ...ruleSCPI,
  id: 'rule-3',
  product_category: 'CAV_CAPI',
  rule_type: 'encours_oneshot_months',
  rate_pct: null,
  encours_months: 6,
}

const tauxSCPI: Pick<TauxProduitCompagnie, 'frais_entree' | 'frais_encours'> = {
  frais_entree: 0.06, // 6 % (non utilisé pour entry_pct_montant)
  frais_encours: 0,
}

const tauxPE: Pick<TauxProduitCompagnie, 'frais_entree' | 'frais_encours'> = {
  frais_entree: 0.05, // 5 % d'entrée PE
  frais_encours: 0.007, // (non utilisé pour entry_pct_frais)
}

const tauxCAVMensuel: Pick<TauxProduitCompagnie, 'frais_entree' | 'frais_encours'> = {
  frais_entree: 0.01,
  frais_encours: 0.001, // 0.1 %/mois
}

const tauxLUXTrim: Pick<TauxProduitCompagnie, 'frais_entree' | 'frais_encours'> = {
  frais_entree: 0.01,
  frais_encours: 0.003, // 0.3 %/trimestre
}

const compagnieMensuel: Pick<Compagnie, 'encours_periodicite'> = {
  encours_periodicite: 'mensuel',
}

const compagnieTrim: Pick<Compagnie, 'encours_periodicite'> = {
  encours_periodicite: 'trimestriel',
}

describe('periodsForEncoursOneshot', () => {
  it('mensuel : N = encours_months', () => {
    expect(periodsForEncoursOneshot(6, 'mensuel')).toBe(6)
    expect(periodsForEncoursOneshot(12, 'mensuel')).toBe(12)
  })

  it('trimestriel : N = encours_months / 3 arrondi', () => {
    expect(periodsForEncoursOneshot(6, 'trimestriel')).toBe(2)
    expect(periodsForEncoursOneshot(12, 'trimestriel')).toBe(4)
    expect(periodsForEncoursOneshot(3, 'trimestriel')).toBe(1)
  })

  it('null/undefined → trimestriel par défaut', () => {
    expect(periodsForEncoursOneshot(6, null)).toBe(2)
    expect(periodsForEncoursOneshot(6, undefined)).toBe(2)
  })

  it('encours_months <= 0 → 0', () => {
    expect(periodsForEncoursOneshot(0, 'mensuel')).toBe(0)
    expect(periodsForEncoursOneshot(-1, 'mensuel')).toBe(0)
  })
})

describe('computeApporteurFee — règles V2', () => {
  it('SCPI 300k → 3 000 € (1 % du montant)', () => {
    const result = computeApporteurFee({
      apporteur: yoann,
      rules: [ruleSCPI],
      dossier: { montant: 300_000, produit_categorie: 'SCPI' },
      taux: tauxSCPI,
      compagnie: null,
    })
    expect(result.entry).toBe(3000)
    expect(result.encoursOneshot).toBe(0)
    expect(result.total).toBe(3000)
    expect(result.appliedRule).toMatchObject({
      source: 'rule_v2',
      ruleType: 'entry_pct_montant',
      ratePct: 1,
    })
  })

  it('PE 100k frais entrée 5 % → 1 250 € (25 % des frais d\'entrée)', () => {
    const result = computeApporteurFee({
      apporteur: yoann,
      rules: [rulePE],
      dossier: { montant: 100_000, produit_categorie: 'PE' },
      taux: tauxPE,
      compagnie: null,
    })
    // 100_000 × 0.05 × 0.25 = 1 250
    expect(result.entry).toBe(1250)
    expect(result.encoursOneshot).toBe(0)
    expect(result.total).toBe(1250)
    expect(result.appliedRule).toMatchObject({
      source: 'rule_v2',
      ruleType: 'entry_pct_frais',
      ratePct: 25,
    })
  })

  it('CAV mensuel 200k frais 0.1 %/mois × 6 mois → 1 200 €', () => {
    const result = computeApporteurFee({
      apporteur: yoann,
      rules: [ruleCAV],
      dossier: { montant: 200_000, produit_categorie: 'CAV LUX' },
      taux: tauxCAVMensuel,
      compagnie: compagnieMensuel,
    })
    // 200_000 × 0.001 × 6 = 1 200
    expect(result.entry).toBe(0)
    expect(result.encoursOneshot).toBe(1200)
    expect(result.total).toBe(1200)
    expect(result.appliedRule).toMatchObject({
      source: 'rule_v2',
      ruleType: 'encours_oneshot_months',
      encoursMonths: 6,
      periodicite: 'mensuel',
    })
  })

  it('LUX trimestriel 500k frais 0.3 %/trim × 2 trim → 3 000 €', () => {
    const result = computeApporteurFee({
      apporteur: yoann,
      rules: [ruleCAV],
      dossier: { montant: 500_000, produit_categorie: 'CAPI LUX' },
      taux: tauxLUXTrim,
      compagnie: compagnieTrim,
    })
    // 500_000 × 0.003 × 2 = 3 000
    expect(result.entry).toBe(0)
    expect(result.encoursOneshot).toBe(3000)
    expect(result.total).toBe(3000)
    expect(result.appliedRule).toMatchObject({
      source: 'rule_v2',
      ruleType: 'encours_oneshot_months',
      periodicite: 'trimestriel',
    })
  })

  it('catégorie LUX brute (sans CAV/CAPI) → fallback CAV_CAPI via normaliseur', () => {
    // "CAV LUX" et "CAPI LUX" sont normalisés vers CAV_CAPI
    const result = computeApporteurFee({
      apporteur: yoann,
      rules: [ruleCAV],
      dossier: { montant: 100_000, produit_categorie: 'CAV LUX' },
      taux: tauxCAVMensuel,
      compagnie: compagnieMensuel,
    })
    expect(result.appliedRule).toMatchObject({
      source: 'rule_v2',
      productCategory: 'CAV_CAPI',
    })
  })

  it('catégorie inconnue → fallback V1 si taux_commission, sinon 0', () => {
    const result = computeApporteurFee({
      apporteur: { ...yoann, taux_commission: 0.02 }, // 2 %
      rules: [ruleSCPI, rulePE, ruleCAV],
      dossier: { montant: 100_000, produit_categorie: 'AUTRE' },
      taux: null,
      compagnie: null,
    })
    // Pas de match catégorie → fallback V1 = 100_000 × 0.02 = 2 000
    expect(result.entry).toBe(2000)
    expect(result.total).toBe(2000)
    expect(result.appliedRule).toMatchObject({
      source: 'fallback_v1',
      tauxCommission: 0.02,
    })
  })
})

describe('computeApporteurFee — fallback V1 (sans règles V2)', () => {
  it('apporteur V1 sans règles, taux 5 % sur 200k → 10 000 €', () => {
    const result = computeApporteurFee({
      apporteur: { id: 'old-app', taux_commission: 0.05 },
      rules: [],
      dossier: { montant: 200_000, produit_categorie: 'SCPI' },
      taux: tauxSCPI,
      compagnie: null,
    })
    expect(result.entry).toBe(10_000)
    expect(result.total).toBe(10_000)
    expect(result.appliedRule).toMatchObject({
      source: 'fallback_v1',
      tauxCommission: 0.05,
    })
  })

  it('apporteur sans règles ET sans taux V1 → 0 + no_match', () => {
    const result = computeApporteurFee({
      apporteur: { id: 'orphan', taux_commission: null },
      rules: [],
      dossier: { montant: 100_000, produit_categorie: 'SCPI' },
      taux: tauxSCPI,
      compagnie: null,
    })
    expect(result.total).toBe(0)
    expect(result.appliedRule).toMatchObject({ source: 'no_match' })
  })
})

describe('computeApporteurFee — cas dégénérés', () => {
  it('pas d\'apporteur → 0 + no_apporteur', () => {
    const result = computeApporteurFee({
      apporteur: null,
      rules: [],
      dossier: { montant: 100_000, produit_categorie: 'SCPI' },
      taux: tauxSCPI,
      compagnie: null,
    })
    expect(result.total).toBe(0)
    expect(result.appliedRule).toMatchObject({ source: 'no_apporteur' })
  })

  it('montant nul → 0 + no_match', () => {
    const result = computeApporteurFee({
      apporteur: yoann,
      rules: [ruleSCPI],
      dossier: { montant: 0, produit_categorie: 'SCPI' },
      taux: tauxSCPI,
      compagnie: null,
    })
    expect(result.total).toBe(0)
    expect(result.appliedRule).toMatchObject({ source: 'no_match' })
  })

  it('règle inactive → ignorée, fallback V1', () => {
    const result = computeApporteurFee({
      apporteur: { ...yoann, taux_commission: 0.01 },
      rules: [{ ...ruleSCPI, active: false }],
      dossier: { montant: 100_000, produit_categorie: 'SCPI' },
      taux: tauxSCPI,
      compagnie: null,
    })
    expect(result.entry).toBe(1000)
    expect(result.appliedRule).toMatchObject({ source: 'fallback_v1' })
  })

  it('règle d\'un autre apporteur → ignorée', () => {
    const result = computeApporteurFee({
      apporteur: yoann,
      rules: [{ ...ruleSCPI, apporteur_id: 'someone-else' }],
      dossier: { montant: 100_000, produit_categorie: 'SCPI' },
      taux: tauxSCPI,
      compagnie: null,
    })
    expect(result.total).toBe(0)
    expect(result.appliedRule).toMatchObject({ source: 'no_match' })
  })

  it('encours one-shot avec compagnie périodicité null → trimestriel par défaut', () => {
    const result = computeApporteurFee({
      apporteur: yoann,
      rules: [ruleCAV],
      dossier: { montant: 200_000, produit_categorie: 'CAV LUX' },
      taux: { frais_entree: 0, frais_encours: 0.003 },
      compagnie: null, // pas de périodicité
    })
    // 200_000 × 0.003 × 2 (default trim) = 1 200
    expect(result.encoursOneshot).toBe(1200)
    expect(result.appliedRule).toMatchObject({
      periodicite: 'trimestriel',
    })
  })
})
