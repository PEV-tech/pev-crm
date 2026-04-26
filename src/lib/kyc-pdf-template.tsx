/**
 * kyc-pdf-template.tsx — Génération PDF KYC avec @react-pdf/renderer
 *
 * Structures de données synchronisées avec kyc-section.tsx (2026-04-25) :
 *   - ImmobilierRow : type_bien, type_bien_libre, designation, valeur_actuelle, detention, crd, charges
 *   - ProduitFinancierRow : type_produit, type_produit_libre, designation, valeur, date_ouverture, versements_reguliers, rendement
 *   - EmpruntRow : designation, etablissement, montant, date, duree, taux, crd, echeance, echeance_mensuelle
 *   - PatrimoineProRow : categorie, sous_categorie, designation, valeur, description (ajout 2026-04-24)
 *
 * Ajouts 2026-04-25 :
 *   - type_bien_libre / type_produit_libre : affiché quand type = 'Autre'
 *   - SectionSuccessionPP : union précédente, donations reçues, loi applicable, testament, donation entre époux
 *   - SectionCommentaires : commentaires_kyc JSONB par section
 */

import fs from 'fs'
import React from 'react'
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'

// ── Constantes cabinet ─────────────────────────────────────────────────────
export const CABINET = {
  raisonSociale: 'Private Equity Valley',
  marque: 'Ethique & Patrimoine',
  formeJuridique: 'SAS',
  capital: '62 500 euros',
  rcs: 'RCS Paris 803 414 796',
  siren: '803414796',
  codeNaf: '6622Z',
  tva: 'FR40803414796',
  orias: '24001817',
  cif: '18002418',
  carteT: 'CPI 7501 2018 000 036 694',
  adresse: '41 rue Saint Ferdinand 75017 Paris',
  email: 'maxine@private-equity-valley.com',
  telephone: '07 85 84 45 89',
  responsableTraitement: 'Maxine Laisné',
} as const

// Conseiller référent affiché dans le bloc réglementaire "Avec le concours de"
const CONSEILLER_REFERENT = {
  nom: 'Stéphane Molère',
  email: 'stephane@private-equity-valley.com',
} as const

// ── Palette PEV ────────────────────────────────────────────────────────────
const C = {
  violet: '#3B2C8A',
  rose: '#E9198A',
  white: '#FFFFFF',
  text: '#1A1A2E',
  muted: '#6B6B80',
  light: '#F5F4FC',
  border: '#D8D5F0',
  warnBg: '#FFF8E7',
  warnBorder: '#E9198A',
}

export type KycPdfClient = Record<string, unknown>

export interface KycPdfSignature {
  signerName: string
  signedAt: Date
  signerIp?: string | null
  completionRate: number
  missingFields: string[]
  isIncomplete: boolean
  consentIncomplete: boolean
  consentAccuracy: boolean
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    paddingTop: 0,
    paddingBottom: 50,
    paddingHorizontal: 0,
  },
  header: {
    backgroundColor: C.violet,
    paddingHorizontal: 36,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: { height: 52, width: 55, objectFit: 'contain' },
  headerBrand: { color: C.white, fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },
  headerSub: { color: '#C8C0F0', fontSize: 8.5, marginTop: 3, letterSpacing: 0.2 },
  headerRight: { color: '#C8C0F0', fontSize: 7.5, textAlign: 'right', lineHeight: 1.6 },
  titleBlock: {
    paddingHorizontal: 36,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.rose,
    marginBottom: 14,
  },
  titleDoc: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.violet, letterSpacing: 0.5, marginBottom: 3 },
  titleType: { fontSize: 9, color: C.rose, fontFamily: 'Helvetica-Oblique', marginBottom: 4 },
  titleName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.text },
  body: { paddingHorizontal: 36 },
  sectionHeader: { backgroundColor: C.violet, paddingHorizontal: 8, paddingVertical: 4, marginTop: 12, marginBottom: 6 },
  sectionHeaderText: { color: C.white, fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textTransform: 'uppercase' },
  subSectionHeader: { borderLeftWidth: 3, borderLeftColor: C.rose, paddingLeft: 6, marginTop: 8, marginBottom: 4 },
  subSectionText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.violet, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border, paddingVertical: 3, minHeight: 16 },
  label: { width: '40%', color: C.muted, fontSize: 8.5, fontFamily: 'Helvetica-Bold', paddingRight: 4 },
  value: { width: '60%', fontSize: 9, color: C.text },
  table: { marginTop: 4, marginBottom: 6, borderWidth: 0.5, borderColor: C.border },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: C.violet },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableRowAlt: { flexDirection: 'row', backgroundColor: C.light, borderBottomWidth: 0.5, borderBottomColor: C.border },
  tableHeaderCell: { color: C.white, fontSize: 7, fontFamily: 'Helvetica-Bold', padding: 3, flex: 1 },
  tableCell: { fontSize: 7.5, padding: 3, flex: 1, color: C.text },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  checkbox: { width: 10, height: 10, borderWidth: 0.8, borderColor: C.violet, marginRight: 6, marginTop: 1, backgroundColor: C.white },
  checkboxChecked: { width: 10, height: 10, borderWidth: 0.8, borderColor: C.violet, marginRight: 6, marginTop: 1, backgroundColor: C.violet },
  checkText: { fontSize: 8.5, flex: 1, color: C.text },
  warnBox: { backgroundColor: C.warnBg, borderWidth: 0.8, borderColor: C.warnBorder, padding: 8, marginVertical: 6, borderRadius: 2 },
  warnText: { fontSize: 8, color: '#8B4513' },
  footer: { position: 'absolute', bottom: 16, left: 36, right: 36, borderTopWidth: 0.4, borderTopColor: C.border, paddingTop: 4, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 6.5, color: C.muted },
  rgpdBox: { borderWidth: 0.5, borderColor: C.border, backgroundColor: C.light, padding: 8, marginTop: 10 },
  rgpdTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.violet, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  rgpdText: { fontSize: 7, color: C.muted, lineHeight: 1.5 },
  sigBlock: { marginTop: 12, borderWidth: 0.5, borderColor: C.border, padding: 10, borderRadius: 2 },
  sigTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.violet, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  regBlock: { marginTop: 10, flexDirection: 'row', gap: 10 },
  regCabinet: { flex: 1, borderWidth: 0.5, borderColor: C.border, padding: 8, borderRadius: 2 },
  regConseiller: { flex: 1, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.light, padding: 8, borderRadius: 2 },
  regTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.violet, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: C.border },
  regLine: { fontSize: 7, color: C.text, marginBottom: 2 },
  regLineMuted: { fontSize: 6.5, color: C.muted, marginBottom: 1.5 },
  regBullet: { fontSize: 6.5, color: C.muted, marginBottom: 1 },
})

// ── Formatters ─────────────────────────────────────────────────────────────
function fmtEuro(n: unknown): string {
  if (n === null || n === undefined || n === '') return '—'
  const num = Number(n)
  if (Number.isNaN(num)) return '—'
  try {
    // U+202F (espace fine insécable) et U+00A0 non supportés par Helvetica
    // dans react-pdf — rendu comme "/" — on remplace par espace normale.
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
      .format(num)
      .replace(/\u202f/g, '\u0020')
      .replace(/\u00a0/g, '\u0020')
  } catch { return `${num} €` }
}

function fmtDate(v: unknown): string {
  if (!v) return '—'
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function str(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

// ── Composants de base ─────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <View style={S.sectionHeader}><Text style={S.sectionHeaderText}>{title}</Text></View>
)

const SubSectionHeader = ({ title }: { title: string }) => (
  <View style={S.subSectionHeader}><Text style={S.subSectionText}>{title}</Text></View>
)

const LabelValue = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <View style={S.row}>
    <Text style={S.label}>{label}</Text>
    <Text style={S.value}>{value && value !== '' ? value : '—'}</Text>
  </View>
)

const Checkbox = ({ checked, label }: { checked: boolean; label: string }) => (
  <View style={S.checkRow}>
    <View style={checked ? S.checkboxChecked : S.checkbox}>
      {checked && <Text style={{ color: C.white, fontSize: 7, textAlign: 'center', lineHeight: 1 }}>✓</Text>}
    </View>
    <Text style={S.checkText}>{label}</Text>
  </View>
)

const Spacer = ({ size = 8 }: { size?: number }) => <View style={{ marginTop: size }} />

const PageFooter = () => (
  <View style={S.footer} fixed>
    <Text style={S.footerText}>
      {CABINET.raisonSociale} — {CABINET.formeJuridique} — {CABINET.rcs} — {CABINET.adresse} — {CABINET.email}
    </Text>
    <Text style={S.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
  </View>
)

// ── Tableaux PP — structures synchronisées avec kyc-section.tsx ────────────
const EMPTY_ROWS = 2

// ImmobilierRow : type_bien, designation, valeur_actuelle, detention, crd, charges
const TableImmo = ({ rows }: { rows: Record<string, unknown>[] }) => {
  const data: Record<string, unknown>[] = rows.length > 0 ? rows : Array.from({ length: EMPTY_ROWS }, () => ({}))
  return (
    <View style={S.table}>
      <View style={S.tableHeaderRow}>
        {['Type de bien', 'Désignation', 'Valeur actuelle (€)', 'Détention', 'CRD (€)', 'Charges (€/mois)'].map(h => (
          <Text key={h} style={S.tableHeaderCell}>{h}</Text>
        ))}
      </View>
      {data.map((r, i) => (
        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={S.tableCell}>{r.type_bien === 'Autre' && r.type_bien_libre ? str(r.type_bien_libre) : str(r.type_bien)}</Text>
          <Text style={S.tableCell}>{str(r.designation)}</Text>
          <Text style={S.tableCell}>{fmtEuro(r.valeur_actuelle)}</Text>
          <Text style={S.tableCell}>{str(r.detention)}</Text>
          <Text style={S.tableCell}>{fmtEuro(r.crd)}</Text>
          <Text style={S.tableCell}>{fmtEuro(r.charges)}</Text>
        </View>
      ))}
    </View>
  )
}

// ProduitFinancierRow : type_produit, designation, valeur, date_ouverture, versements_reguliers, rendement
const TableProduitsFinanciers = ({ rows }: { rows: Record<string, unknown>[] }) => {
  const data: Record<string, unknown>[] = rows.length > 0 ? rows : Array.from({ length: EMPTY_ROWS }, () => ({}))
  return (
    <View style={S.table}>
      <View style={S.tableHeaderRow}>
        {['Type', 'Désignation', 'Valeur (€)', 'Date ouverture', 'Versements réguliers', 'Rendement (%)'].map(h => (
          <Text key={h} style={S.tableHeaderCell}>{h}</Text>
        ))}
      </View>
      {data.map((r, i) => (
        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={S.tableCell}>{r.type_produit === 'Autre' && r.type_produit_libre ? str(r.type_produit_libre) : str(r.type_produit)}</Text>
          <Text style={S.tableCell}>{str(r.designation)}</Text>
          <Text style={S.tableCell}>{fmtEuro(r.valeur)}</Text>
          <Text style={S.tableCell}>{fmtDate(r.date_ouverture)}</Text>
          <Text style={S.tableCell}>{str(r.versements_reguliers)}</Text>
          <Text style={S.tableCell}>{r.rendement !== undefined && r.rendement !== null ? `${r.rendement} %` : '—'}</Text>
        </View>
      ))}
    </View>
  )
}

// PatrimoineProRow : categorie, sous_categorie, designation, valeur, description (ajout 2026-04-24)
const TablePatrimoinePro = ({ rows }: { rows: Record<string, unknown>[] }) => {
  const data: Record<string, unknown>[] = rows.length > 0 ? rows : Array.from({ length: EMPTY_ROWS }, () => ({}))
  return (
    <View style={S.table}>
      <View style={S.tableHeaderRow}>
        {['Catégorie', 'Sous-catégorie', 'Désignation', 'Valeur (€)', 'Description'].map(h => (
          <Text key={h} style={S.tableHeaderCell}>{h}</Text>
        ))}
      </View>
      {data.map((r, i) => (
        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={S.tableCell}>{str(r.categorie)}</Text>
          <Text style={S.tableCell}>{str(r.sous_categorie)}</Text>
          <Text style={S.tableCell}>{str(r.designation)}</Text>
          <Text style={S.tableCell}>{fmtEuro(r.valeur)}</Text>
          <Text style={S.tableCell}>{str(r.description)}</Text>
        </View>
      ))}
    </View>
  )
}

// EmpruntRow : designation, etablissement, montant, date, duree, taux, crd, echeance, echeance_mensuelle
const TableEmprunts = ({ rows }: { rows: Record<string, unknown>[] }) => {
  const data: Record<string, unknown>[] = rows.length > 0 ? rows : Array.from({ length: EMPTY_ROWS }, () => ({}))
  return (
    <View style={S.table}>
      <View style={S.tableHeaderRow}>
        {['Désignation', 'Établissement', 'Montant initial (€)', 'CRD (€)', 'Taux (%)', 'Durée', 'Échéance', 'Mensualité (€)'].map(h => (
          <Text key={h} style={S.tableHeaderCell}>{h}</Text>
        ))}
      </View>
      {data.map((r, i) => (
        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={S.tableCell}>{str(r.designation)}</Text>
          <Text style={S.tableCell}>{str(r.etablissement)}</Text>
          <Text style={S.tableCell}>{fmtEuro(r.montant)}</Text>
          <Text style={S.tableCell}>{fmtEuro(r.crd)}</Text>
          <Text style={S.tableCell}>{r.taux !== undefined && r.taux !== null ? `${r.taux} %` : '—'}</Text>
          <Text style={S.tableCell}>{str(r.duree)}</Text>
          <Text style={S.tableCell}>{fmtDate(r.echeance)}</Text>
          <Text style={S.tableCell}>{fmtEuro(r.echeance_mensuelle)}</Text>
        </View>
      ))}
    </View>
  )
}

function computeTauxEndettement(c: KycPdfClient): string {
  const emprunts = Array.isArray(c.emprunts) ? (c.emprunts as Record<string, unknown>[]) : []
  const totalMensualites = emprunts.reduce((s, e) => s + (Number(e.echeance_mensuelle) || 0), 0)
  const loyer = Number(c.montant_loyer ?? 0)
  const revenus = Number(c.total_revenus_annuel ?? 0) / 12
  if (!revenus || revenus <= 0) return '—'
  const taux = ((totalMensualites + loyer) / revenus) * 100
  return `${taux.toFixed(1)} %`
}

// ── Tableaux PM ────────────────────────────────────────────────────────────
const TableSituationFinancierePM = ({ c }: { c: KycPdfClient }) => {
  const rows = [
    { label: "Chiffre d'affaires", n: fmtEuro(c.ca_n), n1: fmtEuro(c.ca_n1), n2: fmtEuro(c.ca_n2) },
    { label: 'Résultat net', n: fmtEuro(c.resultat_net_n), n1: fmtEuro(c.resultat_net_n1), n2: fmtEuro(c.resultat_net_n2) },
    { label: 'Total bilan', n: fmtEuro(c.total_bilan_n), n1: fmtEuro(c.total_bilan_n1), n2: fmtEuro(c.total_bilan_n2) },
    { label: 'Impôt sur les sociétés', n: fmtEuro(c.impot_revenu_n), n1: fmtEuro(c.impot_revenu_n1), n2: fmtEuro(c.impot_revenu_n2) },
  ]
  return (
    <View style={S.table}>
      <View style={S.tableHeaderRow}>
        {['Indicateur', 'N', 'N-1', 'N-2'].map(h => (
          <Text key={h} style={[S.tableHeaderCell, { flex: h === 'Indicateur' ? 2 : 1 }]}>{h}</Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={r.label} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={[S.tableCell, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{r.label}</Text>
          <Text style={S.tableCell}>{r.n}</Text>
          <Text style={S.tableCell}>{r.n1}</Text>
          <Text style={S.tableCell}>{r.n2}</Text>
        </View>
      ))}
    </View>
  )
}

const TableActionnaires = ({ rows }: { rows: Record<string, unknown>[] }) => {
  const data: Record<string, unknown>[] = rows.length > 0 ? rows : Array.from({ length: EMPTY_ROWS }, () => ({}))
  return (
    <View style={S.table}>
      <View style={S.tableHeaderRow}>
        {['Nom / Raison sociale', 'Type', '% Détenu', 'Nationalité', 'Résidence fiscale', 'PPE ?'].map(h => (
          <Text key={h} style={S.tableHeaderCell}>{h}</Text>
        ))}
      </View>
      {data.map((r, i) => (
        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={S.tableCell}>{str(r.nom)}</Text>
          <Text style={S.tableCell}>{str(r.type)}</Text>
          <Text style={S.tableCell}>{str(r.pourcentage)}</Text>
          <Text style={S.tableCell}>{str(r.nationalite)}</Text>
          <Text style={S.tableCell}>{str(r.residence_fiscale)}</Text>
          <Text style={S.tableCell}>{str(r.ppe)}</Text>
        </View>
      ))}
    </View>
  )
}

// ── Sections PP ────────────────────────────────────────────────────────────
const SectionEtatCivilPP = ({ c }: { c: KycPdfClient }) => (
  <View>
    <SectionHeader title="État civil" />
    <View style={S.body}>
      <LabelValue label="Titre" value={str(c.titre)} />
      <LabelValue label="Nom" value={str(c.nom)} />
      <LabelValue label="Nom de jeune fille" value={str(c.nom_jeune_fille)} />
      <LabelValue label="Prénom" value={str(c.prenom)} />
      <LabelValue label="Date de naissance" value={fmtDate(c.date_naissance)} />
      <LabelValue label="Lieu de naissance" value={str(c.lieu_naissance)} />
      <LabelValue label="Nationalité" value={str(c.nationalite)} />
      <LabelValue label="Résidence fiscale" value={str(c.residence_fiscale)} />
      <LabelValue label="NIF (numéro fiscal)" value={str(c.nif)} />
      <LabelValue label="Adresse" value={str(c.adresse)} />
      <LabelValue label="Code postal" value={str(c.code_postal)} />
      <LabelValue label="Ville" value={str(c.ville)} />
      <LabelValue label="Pays" value={str(c.pays)} />
      <LabelValue label="Statut logement" value={str(c.proprietaire_locataire)} />
      <LabelValue label="Loyer mensuel" value={fmtEuro(c.montant_loyer)} />
      <LabelValue label="Téléphone" value={str(c.telephone)} />
      <LabelValue label="Email" value={str(c.email)} />
    </View>
  </View>
)

type EnfantDetail = {
  nom?: string | null
  prenom?: string | null
  sexe?: string | null
  date_naissance?: string | null
  a_charge?: boolean | null
  issu_precedente_union?: boolean | null
  legacy_notes?: string | null
}

const EnfantRow = ({ enfant, index }: { enfant: EnfantDetail; index: number }) => {
  const nomComplet = [enfant.prenom, enfant.nom].filter(Boolean).join(' ') || '—'
  const sexeLabel = enfant.sexe === 'homme' ? 'Homme' : enfant.sexe === 'femme' ? 'Femme' : enfant.sexe || null
  const parts: string[] = [nomComplet]
  if (sexeLabel) parts.push(sexeLabel)
  if (enfant.date_naissance) parts.push(`né(e) le ${fmtDate(enfant.date_naissance)}`)
  parts.push(`à charge : ${enfant.a_charge ? 'Oui' : 'Non'}`)
  if (enfant.issu_precedente_union) parts.push('union précédente')
  if (enfant.legacy_notes) parts.push(enfant.legacy_notes)
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 2 }}>
      <Text style={{ fontSize: 8, color: C.muted, width: 70, flexShrink: 0 }}>Enfant {index + 1}</Text>
      <Text style={{ fontSize: 8, color: C.text, flex: 1 }}>{parts.join(' · ')}</Text>
    </View>
  )
}

const SectionFamillePP = ({ c }: { c: KycPdfClient }) => {
  const enfants: EnfantDetail[] = Array.isArray(c.enfants_details)
    ? (c.enfants_details as EnfantDetail[])
    : []
  return (
    <View>
      <SectionHeader title="Situation familiale" />
      <View style={S.body}>
        <LabelValue label="Situation matrimoniale" value={str(c.situation_matrimoniale)} />
        <LabelValue label="Régime matrimonial" value={str(c.regime_matrimonial)} />
        <LabelValue label="Nb enfants / personnes à charge" value={c.nombre_enfants != null ? String(c.nombre_enfants) : '—'} />
        {enfants.length > 0 && (
          <View style={{ marginTop: 4 }}>
            <Text style={{ fontSize: 8, color: C.muted, marginBottom: 2 }}>Détail enfants</Text>
            {enfants.map((e, i) => (
              <EnfantRow key={i} enfant={e} index={i} />
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

const SectionProfessionnellePP = ({ c }: { c: KycPdfClient }) => (
  <View>
    <SectionHeader title="Situation professionnelle" />
    <View style={S.body}>
      <LabelValue label="Profession" value={str(c.profession)} />
      <LabelValue label="Statut professionnel" value={str(c.statut_professionnel)} />
      <LabelValue label="Employeur" value={str(c.employeur)} />
      <LabelValue label="Début d'emploi" value={fmtDate(c.date_debut_emploi)} />
    </View>
  </View>
)

const SectionRevenusPP = ({ c }: { c: KycPdfClient }) => (
  <View break>
    <SectionHeader title="Revenus annuels" />
    <View style={S.body}>
      <LabelValue label="Revenus prof. nets" value={fmtEuro(c.revenus_pro_net)} />
      <LabelValue label="Revenus fonciers" value={fmtEuro(c.revenus_fonciers)} />
      <LabelValue label="Autres revenus" value={fmtEuro(c.autres_revenus)} />
      <LabelValue label="TOTAL revenus annuels" value={fmtEuro(c.total_revenus_annuel)} />
    </View>
  </View>
)

const SectionPatrimoinePP = ({ c }: { c: KycPdfClient }) => {
  const immo = Array.isArray(c.patrimoine_immobilier) ? (c.patrimoine_immobilier as Record<string, unknown>[]) : []
  const fin = Array.isArray(c.produits_financiers) ? (c.produits_financiers as Record<string, unknown>[]) : []
  const pro = Array.isArray(c.patrimoine_professionnel) ? (c.patrimoine_professionnel as Record<string, unknown>[]) : []
  return (
    <View break>
      <SectionHeader title="Patrimoine" />
      <View style={S.body}>
        <SubSectionHeader title="Patrimoine immobilier" />
        <TableImmo rows={immo} />
        <SubSectionHeader title="Produits financiers / assurance vie / épargne" />
        <TableProduitsFinanciers rows={fin} />
        {(pro.length > 0) && (
          <>
            <SubSectionHeader title="Patrimoine professionnel" />
            <TablePatrimoinePro rows={pro} />
          </>
        )}
      </View>
    </View>
  )
}

const SectionEmprunts = ({ c }: { c: KycPdfClient }) => {
  const emprunts = Array.isArray(c.emprunts) ? (c.emprunts as Record<string, unknown>[]) : []
  return (
    <View>
      <SectionHeader title="Emprunts & Charges" />
      <View style={S.body}>
        <TableEmprunts rows={emprunts} />
        <Spacer size={4} />
        <View style={[S.row, { backgroundColor: C.light }]}>
          <Text style={[S.label, { color: C.violet, fontFamily: 'Helvetica-Bold' }]}>Taux d&apos;endettement estimé</Text>
          <Text style={[S.value, { fontFamily: 'Helvetica-Bold', color: C.violet }]}>{computeTauxEndettement(c)}</Text>
        </View>
        <Text style={{ fontSize: 7, color: C.muted, marginTop: 3 }}>
          Formule : total mensualités + loyer / revenus mensuels × 100
        </Text>
      </View>
    </View>
  )
}

const SectionFiscalitePP = ({ c }: { c: KycPdfClient }) => (
  <View>
    <SectionHeader title="Fiscalité — Impôt sur le revenu" />
    <View style={S.body}>
      <LabelValue label="Impôt année N" value={fmtEuro(c.impot_revenu_n)} />
      <LabelValue label="Impôt année N-1" value={fmtEuro(c.impot_revenu_n1)} />
      <LabelValue label="Impôt année N-2" value={fmtEuro(c.impot_revenu_n2)} />
    </View>
  </View>
)

// ── Section Succession PP (2026-04-25) ────────────────────────────────────
// N'apparaît que si au moins un champ est rempli.
type DonationPdfShape = {
  donateur?: string | null
  montant?: number | null
  date_donation?: string | null
  nature?: string | null
  commentaire?: string | null
}

const SectionSuccessionPP = ({ c }: { c: KycPdfClient }) => {
  const hasUnion = c.union_precedente === true
  const hasLoi = !!(c.loi_applicable_pays as string | null) || !!(c.loi_applicable_details as string | null)
  const hasTestament = c.a_testament === true
  const hasDonationEpoux = c.a_donation_entre_epoux === true
  const donations: DonationPdfShape[] = Array.isArray(c.donations_recues) ? (c.donations_recues as DonationPdfShape[]) : []
  if (!hasUnion && !hasLoi && !hasTestament && !hasDonationEpoux && donations.length === 0) return null
  return (
    <View>
      <SectionHeader title="Histoire familiale & succession" />
      <View style={S.body}>
        {hasUnion && <LabelValue label="Union précédente" value={(c.union_precedente_details as string) || 'Oui'} />}
        {hasLoi && <LabelValue label="Loi applicable au régime matrimonial" value={[c.loi_applicable_pays, c.loi_applicable_details].filter(Boolean).join(' — ') as string} />}
        {hasTestament && <LabelValue label="Testament" value={(c.testament_details as string) || 'Oui'} />}
        {hasDonationEpoux && <LabelValue label="Donation entre époux" value={(c.donation_entre_epoux_details as string) || 'Oui'} />}
        {donations.map((d, i) => {
          const parts: string[] = []
          if (d.donateur) parts.push(d.donateur)
          if (typeof d.montant === 'number') parts.push(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(d.montant))
          if (d.nature) parts.push(d.nature)
          if (d.date_donation) { try { parts.push(new Date(d.date_donation).toLocaleDateString('fr-FR')) } catch { parts.push(d.date_donation) } }
          return (
            <React.Fragment key={i}>
              <LabelValue label={`Donation reçue ${i + 1}`} value={parts.join(' · ') || '—'} />
              {d.commentaire ? <LabelValue label="  Note" value={d.commentaire} /> : null}
            </React.Fragment>
          )
        })}
      </View>
    </View>
  )
}

// ── Section Commentaires (2026-04-25) ─────────────────────────────────────
// N'apparaît que si au moins un commentaire non vide est présent.
const COMMENTAIRE_LABELS: Record<string, string> = {
  identite: 'Identité',
  coordonnees: 'Coordonnées',
  situation_fiscale: 'Situation fiscale',
  situation_familiale: 'Situation familiale',
  situation_professionnelle: 'Situation professionnelle',
  revenus: 'Revenus annuels',
  impots: 'Impôt sur le revenu',
  patrimoine_immobilier: 'Patrimoine immobilier',
  produits_financiers: 'Produits financiers',
  patrimoine_divers: 'Patrimoine divers',
  emprunts: 'Emprunts',
}

const SectionCommentaires = ({ c }: { c: KycPdfClient }) => {
  const v = c.commentaires_kyc
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const entries = Object.entries(v as Record<string, unknown>).filter(
    ([, val]) => typeof val === 'string' && (val as string).trim() !== ''
  )
  if (entries.length === 0) return null
  return (
    <View>
      <SectionHeader title="Commentaires complémentaires" />
      <View style={S.body}>
        {entries.map(([k, val]) => (
          <LabelValue key={k} label={COMMENTAIRE_LABELS[k] || k} value={(val as string).trim()} />
        ))}
      </View>
    </View>
  )
}

// ── Sections PM ────────────────────────────────────────────────────────────
const SectionGenerauxPM = ({ c }: { c: KycPdfClient }) => (
  <View>
    <SectionHeader title="Éléments généraux" />
    <View style={S.body}>
      <LabelValue label="Raison sociale" value={str(c.raison_sociale)} />
      <LabelValue label="Forme juridique" value={str(c.forme_juridique)} />
      <LabelValue label="Capital social" value={fmtEuro(c.capital_social)} />
      <LabelValue label="Date de création" value={fmtDate(c.date_creation)} />
      <LabelValue label="SIREN" value={str(c.siren)} />
      <LabelValue label="SIRET" value={str(c.siret)} />
      <LabelValue label="Adresse siège" value={`${str(c.adresse)} ${str(c.code_postal)} ${str(c.ville)} — ${str(c.pays)}`} />
      <LabelValue label="Téléphone" value={str(c.telephone)} />
      <LabelValue label="Email" value={str(c.email)} />
      <LabelValue label="Activité principale" value={str(c.activite_principale)} />
      <LabelValue label="Code NAF / APE" value={str(c.code_naf)} />
      <LabelValue label="Pays d'immatriculation" value={str(c.pays_immatriculation)} />
    </View>
  </View>
)

const SectionRepresentantsPM = ({ c }: { c: KycPdfClient }) => (
  <View>
    <SectionHeader title="Représentant légal & actionnaires" />
    <View style={S.body}>
      <LabelValue label="Représentant légal" value={str(c.representant_legal)} />
      <LabelValue label="Fonction" value={str(c.fonction_representant)} />
      <LabelValue label="Date de naissance" value={fmtDate(c.date_naissance_representant)} />
      <LabelValue label="Nationalité" value={str(c.nationalite_representant)} />
      <LabelValue label="PPE" value={str(c.ppe_representant)} />
      <Spacer size={6} />
      <SubSectionHeader title="Actionnaires / bénéficiaires effectifs" />
      <TableActionnaires rows={Array.isArray(c.actionnaires) ? (c.actionnaires as Record<string, unknown>[]) : []} />
    </View>
  </View>
)

const SectionFinancierePM = ({ c }: { c: KycPdfClient }) => (
  <View break>
    <SectionHeader title="Situation financière" />
    <View style={S.body}><TableSituationFinancierePM c={c} /></View>
  </View>
)

const SectionFiscalitePM = ({ c }: { c: KycPdfClient }) => (
  <View>
    <SectionHeader title="Fiscalité" />
    <View style={S.body}>
      <LabelValue label="Régime fiscal" value={str(c.regime_fiscal)} />
      <LabelValue label="TVA intracommunautaire" value={str(c.tva_intracommunautaire)} />
      <LabelValue label="Assujettissement ISF/IFI" value={str(c.assujettissement_isf)} />
    </View>
  </View>
)

const SectionPatrimoinePM = ({ c }: { c: KycPdfClient }) => {
  const immo = Array.isArray(c.patrimoine_immobilier) ? (c.patrimoine_immobilier as Record<string, unknown>[]) : []
  const fin = Array.isArray(c.produits_financiers) ? (c.produits_financiers as Record<string, unknown>[]) : []
  const pro = Array.isArray(c.patrimoine_professionnel) ? (c.patrimoine_professionnel as Record<string, unknown>[]) : []
  return (
    <View break>
      <SectionHeader title="Patrimoine de la société" />
      <View style={S.body}>
        <SubSectionHeader title="Patrimoine immobilier" />
        <TableImmo rows={immo} />
        <SubSectionHeader title="Actifs financiers" />
        <TableProduitsFinanciers rows={fin} />
        {pro.length > 0 && (
          <>
            <SubSectionHeader title="Patrimoine professionnel" />
            <TablePatrimoinePro rows={pro} />
          </>
        )}
      </View>
    </View>
  )
}

// ── Dernière page : Objectifs + RGPD + Réglementaire + Signature ──────────
// `break` force le début sur une nouvelle page.
// Le bloc Réglementaire+Signature est wrap={false} pour rester solidaire.
const DernierePage = ({
  c,
  sig,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  consultantName: _consultantName,
}: {
  c: KycPdfClient
  sig: KycPdfSignature
  consultantName: string | null
}) => (
  <View break>
    {/* Objectifs */}
    <SectionHeader title="Objectifs patrimoniaux" />
    <View style={S.body}>
      <Text style={{ fontSize: 9, color: C.text, lineHeight: 1.6, marginTop: 4 }}>
        {str(c.objectifs_client)}
      </Text>
    </View>

    {/* RGPD */}
    <View style={[S.body, { marginTop: 10 }]}>
      <View style={S.rgpdBox}>
        <Text style={S.rgpdTitle}>Avertissement RGPD / CNIL</Text>
        <Text style={S.rgpdText}>
          Les informations recueillies sont collectées et traitées par {CABINET.raisonSociale} ({CABINET.rcs}) sous la responsabilité de {CABINET.responsableTraitement}, en qualité de responsable de traitement. Elles sont nécessaires à l&apos;exécution du mandat de conseil patrimonial et au respect des obligations réglementaires (LCB-FT, DDA, CIF, ACPR). Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d&apos;un droit d&apos;accès, de rectification, d&apos;opposition, d&apos;effacement et de portabilité en écrivant à {CABINET.email}.
        </Text>
      </View>
    </View>

    {/* Réglementaire + Signature solidaires */}
    <View wrap={false}>
      {/* Bloc réglementaire */}
      <View style={[S.body, { marginTop: 10 }]}>
        <View style={S.regBlock}>
          <View style={S.regCabinet}>
            <Text style={S.regTitle}>{CABINET.marque} {CABINET.formeJuridique}</Text>
            <Text style={S.regLine}>Société au capital de {CABINET.capital}</Text>
            <Text style={S.regLine}>{CABINET.adresse}</Text>
            <Text style={S.regLine}>{CABINET.rcs}</Text>
            <Text style={S.regLineMuted}>Code NAF {CABINET.codeNaf}</Text>
            <Text style={S.regLineMuted}>N° TVA : {CABINET.tva}</Text>
            <Text style={S.regLineMuted}>N° ORIAS : {CABINET.orias}</Text>
            <Text style={S.regLineMuted}>N° CIF AMF : {CABINET.cif}</Text>
            <Text style={S.regLineMuted}>Carte T : {CABINET.carteT}</Text>
          </View>
          <View style={S.regConseiller}>
            <Text style={S.regTitle}>Avec le concours de</Text>
            <Text style={[S.regLine, { fontFamily: 'Helvetica-Bold' }]}>
              {CONSEILLER_REFERENT.nom}
            </Text>
            <Text style={S.regLineMuted}>{CABINET.raisonSociale} — {CABINET.adresse}</Text>
            <Text style={S.regLineMuted}>{CONSEILLER_REFERENT.email}</Text>
            <Spacer size={4} />
            <Text style={S.regBullet}>• Conseiller en Investissements Financiers (CIF)</Text>
            <Text style={S.regBullet}>  N° CIF AMF : {CABINET.cif}</Text>
            <Text style={S.regBullet}>• Courtier en assurance (COA)</Text>
            <Text style={S.regBullet}>• Courtier en opérations de banque (COBSP)</Text>
            <Text style={S.regBullet}>• Agent immobilier — Carte T {CABINET.carteT}</Text>
            <Text style={S.regBullet}>  N° ORIAS : {CABINET.orias}</Text>
          </View>
        </View>
      </View>

      {/* Signature */}
      <View style={[S.body, { marginTop: 10 }]}>
        <View style={S.sigBlock}>
          <Text style={S.sigTitle}>Certification & Signature du client</Text>
          {sig.isIncomplete && (
            <View style={S.warnBox}>
              <Text style={S.warnText}>
                ⚠ KYC signé avec un taux de complétude de {sig.completionRate}%.
                {sig.missingFields.length > 0 ? ` Champs manquants : ${sig.missingFields.join(', ')}.` : ''}
              </Text>
            </View>
          )}
          <View style={{ marginTop: 6 }}>
            <LabelValue label="Signé par" value={sig.signerName} />
            <LabelValue label="Date / heure" value={fmtDateTime(sig.signedAt)} />
            <LabelValue label="Adresse IP" value={sig.signerIp || 'non capturée'} />
            <LabelValue label="Taux de complétude" value={`${sig.completionRate} %`} />
          </View>
          <Spacer size={10} />
          <Checkbox
            checked={sig.consentAccuracy}
            label="Je certifie que les informations fournies sont exactes et complètes à ma connaissance."
          />
          {sig.isIncomplete && (
            <Checkbox
              checked={sig.consentIncomplete}
              label="Je confirme signer le présent dossier en connaissance de son caractère incomplet, et m'engage à le compléter dans les meilleurs délais."
            />
          )}
        </View>
      </View>
    </View>
  </View>
)

// ── Header commun ─────────────────────────────────────────────────────────
const KycHeader = ({ logoBase64 }: { logoBase64: string | null }) => (
  <View style={S.header} fixed>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {logoBase64 && <Image style={S.headerLogo} src={`data:image/png;base64,${logoBase64}`} />}
      <View>
        <Text style={S.headerBrand}>{CABINET.raisonSociale}</Text>
        <Text style={S.headerSub}>{CABINET.marque}</Text>
      </View>
    </View>
    <Text style={S.headerRight}>{CABINET.rcs}{'\n'}{CABINET.adresse}</Text>
  </View>
)

// ── Document PP ────────────────────────────────────────────────────────────
const KycDocumentPP = ({ client, signature, logoBase64, consultantName }: {
  client: KycPdfClient; signature: KycPdfSignature; logoBase64: string | null; consultantName: string | null
}) => {
  const nom = `${str(client.titre) !== '—' ? str(client.titre) + ' ' : ''}${str(client.prenom) !== '—' ? str(client.prenom) + ' ' : ''}${str(client.nom) !== '—' ? str(client.nom) : ''}`.trim() || '—'
  return (
    <Document title={`KYC — ${nom}`} author={CABINET.raisonSociale} creator={`${CABINET.raisonSociale} CRM`}>
      <Page size="A4" style={S.page}>
        <KycHeader logoBase64={logoBase64} />
        <View style={S.titleBlock}>
          <Text style={S.titleDoc}>DOSSIER DE CONNAISSANCE CLIENT (KYC)</Text>
          <Text style={S.titleType}>Personne Physique</Text>
          <Text style={S.titleName}>{nom}</Text>
        </View>
        {/* Page 1 : Identité */}
        <SectionEtatCivilPP c={client} />
        <SectionFamillePP c={client} />
        <SectionSuccessionPP c={client} />
        <SectionProfessionnellePP c={client} />
        {/* Page 2 : Patrimoine (variable) */}
        <SectionPatrimoinePP c={client} />
        {/* Page 3 : Revenus + Emprunts + Fiscalité */}
        <SectionRevenusPP c={client} />
        <SectionEmprunts c={client} />
        <SectionFiscalitePP c={client} />
        {/* Commentaires libres (si présents) */}
        <SectionCommentaires c={client} />
        {/* Dernière page : Objectifs + RGPD + Réglementaire + Signature */}
        <DernierePage c={client} sig={signature} consultantName={consultantName} />
        <PageFooter />
      </Page>
    </Document>
  )
}

// ── Document PM ────────────────────────────────────────────────────────────
const KycDocumentPM = ({ client, signature, logoBase64, consultantName }: {
  client: KycPdfClient; signature: KycPdfSignature; logoBase64: string | null; consultantName: string | null
}) => {
  const rs = str(client.raison_sociale)
  return (
    <Document title={`KYC — ${rs}`} author={CABINET.raisonSociale} creator={`${CABINET.raisonSociale} CRM`}>
      <Page size="A4" style={S.page}>
        <KycHeader logoBase64={logoBase64} />
        <View style={S.titleBlock}>
          <Text style={S.titleDoc}>DOSSIER DE CONNAISSANCE CLIENT (KYC)</Text>
          <Text style={S.titleType}>Personne Morale</Text>
          <Text style={S.titleName}>{rs}</Text>
        </View>
        {/* Page 1 : Identité */}
        <SectionGenerauxPM c={client} />
        <SectionRepresentantsPM c={client} />
        {/* Page 2 : Patrimoine (variable) */}
        <SectionPatrimoinePM c={client} />
        {/* Page 3 : Situation financière + Emprunts + Fiscalité */}
        <SectionFinancierePM c={client} />
        <SectionEmprunts c={client} />
        <SectionFiscalitePM c={client} />
        {/* Commentaires libres (si présents) */}
        <SectionCommentaires c={client} />
        {/* Dernière page : Objectifs + RGPD + Réglementaire + Signature */}
        <DernierePage c={client} sig={signature} consultantName={consultantName} />
        <PageFooter />
      </Page>
    </Document>
  )
}

// ── Export principal ───────────────────────────────────────────────────────
export async function generateKycPdfBytes(
  client: KycPdfClient,
  signature: KycPdfSignature,
  logoPath?: string,
  consultantName?: string | null,
): Promise<Uint8Array> {
  let logoBase64: string | null = null
  if (logoPath) {
    try {
      if (fs.existsSync(logoPath)) {
        const buf = fs.readFileSync(logoPath)
        if (buf.byteLength > 500) logoBase64 = buf.toString('base64')
      }
    } catch { /* dégradation gracieuse */ }
  }

  const isPM = client.type_personne === 'morale'
  const doc = isPM
    ? <KycDocumentPM client={client} signature={signature} logoBase64={logoBase64} consultantName={consultantName ?? null} />
    : <KycDocumentPP client={client} signature={signature} logoBase64={logoBase64} consultantName={consultantName ?? null} />

  const buffer = await renderToBuffer(doc)
  return new Uint8Array(buffer)
}
