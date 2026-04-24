/**
 * kyc-pdf.ts — Génération PDF du KYC signé (Personne Physique + Personne Morale).
 *
 * Approche pragmatique (pas de `parametres_cabinet` table pour l'instant) :
 *   · Les constantes cabinet (raison sociale, RCS, adresse, RT) vivent ici
 *     en const. Si Maxine veut un jour qu'elles soient éditables via l'UI,
 *     on migrera vers une table dédiée — la migration sera triviale.
 *   · Valeurs canoniques (2026-04-21, arbitrage Maxine) :
 *       RCS Paris 803 414 796
 *       Responsable de traitement : Maxine Laisné — maxine@private-equity-valley.com
 *     La version PM du template .docx (Margaux Laisné / via-ap.com / 837560556)
 *     est explicitement remplacée par ces valeurs.
 *
 * Utilisation typique :
 *   const pdfBytes = await generateKycPdfBytes({ client, signature })
 *   const bucket = admin.storage.from('kyc-documents')
 *   await bucket.upload(`clients/${client.id}/kyc-${Date.now()}.pdf`, pdfBytes, {
 *     contentType: 'application/pdf',
 *   })
 *
 * Design :
 *   · A4 portrait. Helvetica (police intégrée à pdf-lib, pas de fontkit requis).
 *   · Pagination automatique basée sur un curseur `y` + helpers section/text.
 *   · Dispatch PP vs PM sur `client.type_personne === 'morale'`.
 *   · Tableaux patrimoine/dettes/revenus restent "libres" en V1 (remplis à la
 *     main avant signature) — cohérent avec la note pragmatique dans
 *     project_kyc_templates.md. On affiche ce qu'on a en JSONB si présent.
 */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib'

// =====================================================
// Constantes cabinet (source de vérité PDF post-arbitrage Maxine)
// =====================================================
export const CABINET_INFO = {
  raisonSociale: 'Private Equity Valley',
  marque: 'Ethique & Patrimoine',
  formeJuridique: 'SAS',
  rcs: 'RCS Paris 803 414 796',
  siren: '803414796',
  adresse: '—', // à remplir si Maxine fournit l'adresse officielle
  email: 'maxine@private-equity-valley.com',
  responsableTraitement: 'Maxine Laisné',
} as const

// =====================================================
// Types publics
// =====================================================

/** Snapshot complet d'un client tel qu'il sort de la table `clients`. */
export type KycPdfClient = Record<string, unknown> & {
  id?: string
  type_personne?: 'physique' | 'morale' | string | null
  // PP
  titre?: string | null
  nom?: string | null
  prenom?: string | null
  nom_jeune_fille?: string | null
  date_naissance?: string | null
  lieu_naissance?: string | null
  nationalite?: string | null
  residence_fiscale?: string | null
  nif?: string | null
  adresse?: string | null
  ville?: string | null
  pays?: string | null
  proprietaire_locataire?: string | null
  montant_loyer?: number | null
  charges_residence_principale?: number | null
  telephone?: string | null
  email?: string | null
  situation_matrimoniale?: string | null
  regime_matrimonial?: string | null
  nombre_enfants?: number | null
  enfants_details?: string | null
  profession?: string | null
  statut_professionnel?: string | null
  employeur?: string | null
  date_debut_emploi?: string | null
  revenus_pro_net?: number | null
  revenus_fonciers?: number | null
  autres_revenus?: number | null
  total_revenus_annuel?: number | null
  impot_revenu_n?: number | null
  impot_revenu_n1?: number | null
  impot_revenu_n2?: number | null
  objectifs_client?: string | null
  patrimoine_immobilier?: unknown
  produits_financiers?: unknown
  patrimoine_divers?: unknown
  emprunts?: unknown
  // PM
  raison_sociale?: string | null
  forme_juridique?: string | null
  siren?: string | null
  siret?: string | null
  capital_social?: number | null
  date_creation?: string | null
}

/** Métadonnées de signature capturées au moment de la soumission. */
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

// =====================================================
// Helpers de mise en page
// =====================================================

const PAGE_WIDTH = 595.28 // A4 portrait
const PAGE_HEIGHT = 841.89
const MARGIN_X = 50
const MARGIN_TOP = 50
const MARGIN_BOTTOM = 60
const LINE_HEIGHT = 14
const SECTION_GAP = 14

const COLORS = {
  primary: rgb(0.14, 0.26, 0.44), // bleu marine Ethique Patrimoine
  accent: rgb(0.62, 0.51, 0.25), // or/bronze
  text: rgb(0.12, 0.12, 0.15),
  muted: rgb(0.42, 0.42, 0.48),
  rule: rgb(0.82, 0.82, 0.86),
  warnBg: rgb(0.98, 0.95, 0.87),
  warnBorder: rgb(0.72, 0.55, 0.12),
}

interface PageCtx {
  doc: PDFDocument
  page: PDFPage
  y: number
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
  pageNo: number
  totalPagesRef: { v: number } // rempli à la fin
}

function newCtx(
  doc: PDFDocument,
  regular: PDFFont,
  bold: PDFFont,
  italic: PDFFont,
  totalPagesRef: { v: number }
): PageCtx {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  return {
    doc,
    page,
    y: PAGE_HEIGHT - MARGIN_TOP,
    regular,
    bold,
    italic,
    pageNo: 1,
    totalPagesRef,
  }
}

function ensureRoom(ctx: PageCtx, needed: number) {
  if (ctx.y - needed < MARGIN_BOTTOM) {
    ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    ctx.pageNo += 1
    ctx.totalPagesRef.v = ctx.pageNo
    ctx.y = PAGE_HEIGHT - MARGIN_TOP
  }
}

function drawText(
  ctx: PageCtx,
  text: string,
  opts: {
    size?: number
    font?: PDFFont
    color?: ReturnType<typeof rgb>
    x?: number
    lineHeight?: number
  } = {}
) {
  const size = opts.size ?? 10
  const font = opts.font ?? ctx.regular
  const color = opts.color ?? COLORS.text
  const x = opts.x ?? MARGIN_X
  const lh = opts.lineHeight ?? LINE_HEIGHT
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2 - (x - MARGIN_X)
  const lines = wrapText(text, font, size, maxWidth)
  for (const line of lines) {
    ensureRoom(ctx, lh)
    ctx.page.drawText(line, {
      x,
      y: ctx.y - size,
      size,
      font,
      color,
    })
    ctx.y -= lh
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  // sanitize — pdf-lib StandardFonts (Helvetica) are WinAnsi-only; strip
  // characters they can't encode (emoji, ligatures exotiques…).
  const safe = sanitizeWinAnsi(text)
  if (!safe) return ['']
  const paragraphs = safe.split(/\r?\n/)
  const out: string[] = []
  for (const para of paragraphs) {
    if (!para) {
      out.push('')
      continue
    }
    const words = para.split(/\s+/)
    let current = ''
    for (const w of words) {
      const test = current ? `${current} ${w}` : w
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test
      } else {
        if (current) out.push(current)
        // Mot trop long seul — on force
        if (font.widthOfTextAtSize(w, size) > maxWidth) {
          let buf = ''
          for (const ch of w) {
            if (font.widthOfTextAtSize(buf + ch, size) <= maxWidth) {
              buf += ch
            } else {
              out.push(buf)
              buf = ch
            }
          }
          current = buf
        } else {
          current = w
        }
      }
    }
    if (current) out.push(current)
  }
  return out
}

/**
 * pdf-lib's StandardFonts use WinAnsi — doesn't cover tous les caractères
 * Unicode (emoji, guillemets typographiques étendus, etc.). On remplace les
 * caractères problématiques par un équivalent ASCII/Latin1 sûr.
 */
function sanitizeWinAnsi(s: string): string {
  return (s || '')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2022\u25CF]/g, '*')
    // Fallback : strip tout caractère hors Latin1
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?')
}

function drawSectionTitle(ctx: PageCtx, title: string) {
  ensureRoom(ctx, LINE_HEIGHT + SECTION_GAP)
  ctx.y -= SECTION_GAP / 2
  drawText(ctx, title.toUpperCase(), {
    size: 11,
    font: ctx.bold,
    color: COLORS.primary,
  })
  // Barre de soulignement
  ensureRoom(ctx, 6)
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y + 4 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: ctx.y + 4 },
    thickness: 0.5,
    color: COLORS.accent,
  })
  ctx.y -= 4
}

function drawLabelValue(
  ctx: PageCtx,
  label: string,
  value: string | null | undefined,
  opts: { labelWidth?: number } = {}
) {
  const labelWidth = opts.labelWidth ?? 160
  const safeValue = value && String(value).trim() ? String(value) : '—'
  ensureRoom(ctx, LINE_HEIGHT)
  const yTop = ctx.y
  ctx.page.drawText(sanitizeWinAnsi(label), {
    x: MARGIN_X,
    y: yTop - 10,
    size: 9.5,
    font: ctx.bold,
    color: COLORS.muted,
  })
  // value aligné à droite du label, wrapping géré
  drawText(ctx, safeValue, {
    size: 10,
    x: MARGIN_X + labelWidth,
  })
  // L'appel drawText a déjà décalé ctx.y — rien à faire ici.
  // Mais si la valeur tient sur une ligne, ctx.y a été réduit de LINE_HEIGHT
  // avec le label dessiné sur la même ligne visuelle → OK.
  // Si valeur multi-ligne, ctx.y est plus bas. Le label reste visible car il
  // était aligné sur la première ligne.
  void yTop
}

function drawDivider(ctx: PageCtx) {
  ensureRoom(ctx, 8)
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y - 4 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: ctx.y - 4 },
    thickness: 0.4,
    color: COLORS.rule,
  })
  ctx.y -= 10
}

function drawWarningBox(ctx: PageCtx, lines: string[]) {
  const padding = 10
  const innerWidth = PAGE_WIDTH - MARGIN_X * 2 - padding * 2
  // Estime hauteur
  const wrapped = lines.flatMap((l) =>
    wrapText(l, ctx.regular, 9.5, innerWidth)
  )
  const boxHeight = wrapped.length * 12 + padding * 2
  ensureRoom(ctx, boxHeight + 6)
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: ctx.y - boxHeight,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: boxHeight,
    color: COLORS.warnBg,
    borderColor: COLORS.warnBorder,
    borderWidth: 0.6,
  })
  let cursor = ctx.y - padding
  for (const line of wrapped) {
    ctx.page.drawText(line, {
      x: MARGIN_X + padding,
      y: cursor - 9.5,
      size: 9.5,
      font: ctx.regular,
      color: COLORS.text,
    })
    cursor -= 12
  }
  ctx.y -= boxHeight + 6
}

function drawHeader(ctx: PageCtx) {
  // bloc cabinet
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 34,
    width: PAGE_WIDTH,
    height: 34,
    color: COLORS.primary,
  })
  ctx.page.drawText(sanitizeWinAnsi(CABINET_INFO.marque), {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 22,
    size: 14,
    font: ctx.bold,
    color: rgb(1, 1, 1),
  })
  ctx.page.drawText(
    sanitizeWinAnsi(`${CABINET_INFO.raisonSociale} — ${CABINET_INFO.rcs}`),
    {
      x: PAGE_WIDTH - MARGIN_X - 260,
      y: PAGE_HEIGHT - 22,
      size: 8.5,
      font: ctx.regular,
      color: rgb(1, 1, 1),
    }
  )
}

function drawFooterAll(ctx: PageCtx) {
  const pages = ctx.doc.getPages()
  const total = pages.length
  pages.forEach((p, idx) => {
    const n = idx + 1
    p.drawLine({
      start: { x: MARGIN_X, y: 38 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: 38 },
      thickness: 0.3,
      color: COLORS.rule,
    })
    p.drawText(
      sanitizeWinAnsi(
        `${CABINET_INFO.raisonSociale} — ${CABINET_INFO.formeJuridique} — ${CABINET_INFO.rcs} — ${CABINET_INFO.email}`
      ),
      {
        x: MARGIN_X,
        y: 22,
        size: 7.5,
        font: ctx.regular,
        color: COLORS.muted,
      }
    )
    p.drawText(`Page ${n} / ${total}`, {
      x: PAGE_WIDTH - MARGIN_X - 60,
      y: 22,
      size: 7.5,
      font: ctx.regular,
      color: COLORS.muted,
    })
  })
}

// =====================================================
// Formatters
// =====================================================

function formatEuro(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n as number)) return '—'
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(n as number)
  } catch {
    return `${n} €`
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  // Supabase renvoie soit "YYYY-MM-DD" soit ISO full
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPersonneType(t: unknown): string {
  if (t === 'morale') return 'Personne morale'
  return 'Personne physique'
}

// =====================================================
// Renderers de section
// =====================================================

function renderTitle(ctx: PageCtx, client: KycPdfClient) {
  const typePers = formatPersonneType(client.type_personne)
  const titre =
    client.type_personne === 'morale'
      ? (client.raison_sociale as string | null) ||
        `${client.nom ?? ''}`.trim() ||
        '—'
      : `${(client.titre as string) ?? ''} ${
          (client.prenom as string) ?? ''
        } ${(client.nom as string) ?? ''}`.trim()

  ctx.y = PAGE_HEIGHT - 70
  drawText(ctx, 'DOSSIER DE CONNAISSANCE CLIENT (KYC)', {
    size: 16,
    font: ctx.bold,
    color: COLORS.primary,
  })
  drawText(ctx, typePers, {
    size: 10.5,
    font: ctx.italic,
    color: COLORS.accent,
  })
  ctx.y -= 4
  drawText(ctx, titre || '—', {
    size: 13,
    font: ctx.bold,
  })
  ctx.y -= 4
}

function renderEtatCivilPP(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'État civil')
  drawLabelValue(ctx, 'Titre', (c.titre as string) ?? null)
  drawLabelValue(ctx, 'Nom', (c.nom as string) ?? null)
  drawLabelValue(ctx, 'Nom de jeune fille', (c.nom_jeune_fille as string) ?? null)
  drawLabelValue(ctx, 'Prénom', (c.prenom as string) ?? null)
  drawLabelValue(
    ctx,
    'Date de naissance',
    formatDate(c.date_naissance as string | null)
  )
  drawLabelValue(ctx, 'Lieu de naissance', (c.lieu_naissance as string) ?? null)
  drawLabelValue(ctx, 'Nationalité', (c.nationalite as string) ?? null)
  drawLabelValue(
    ctx,
    'Résidence fiscale',
    (c.residence_fiscale as string) ?? null
  )
  drawLabelValue(ctx, 'NIF', (c.nif as string) ?? null)
  drawLabelValue(ctx, 'Adresse', (c.adresse as string) ?? null)
  drawLabelValue(ctx, 'Code postal', (c.code_postal as string) ?? null)
  drawLabelValue(ctx, 'Ville', (c.ville as string) ?? null)
  drawLabelValue(ctx, 'Pays', (c.pays as string) ?? null)
  drawLabelValue(
    ctx,
    'Statut logement',
    (c.proprietaire_locataire as string) ?? null
  )
  if (
    ((c.proprietaire_locataire as string) || '')
      .toLowerCase()
      .includes('locataire')
  ) {
    drawLabelValue(
      ctx,
      'Montant du loyer (mensuel)',
      formatEuro(c.montant_loyer as number | null)
    )
  }
  {
    const v = ((c.proprietaire_locataire as string) || '').toLowerCase()
    if (v.includes('propri') || v.includes('usufruitier')) {
      drawLabelValue(
        ctx,
        'Charges résidence principale (mensuel)',
        formatEuro(c.charges_residence_principale as number | null)
      )
    }
  }
  drawLabelValue(ctx, 'Téléphone', (c.telephone as string) ?? null)
  drawLabelValue(ctx, 'Email', (c.email as string) ?? null)
}

function renderSituationFamiliale(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'Situation familiale')
  drawLabelValue(
    ctx,
    'Situation matrimoniale',
    (c.situation_matrimoniale as string) ?? null
  )
  drawLabelValue(
    ctx,
    'Régime matrimonial',
    (c.regime_matrimonial as string) ?? null
  )
  drawLabelValue(
    ctx,
    "Nombre d'enfants/personnes à charge",
    c.nombre_enfants !== undefined && c.nombre_enfants !== null
      ? String(c.nombre_enfants)
      : null
  )
  if (c.enfants_details) {
    drawLabelValue(ctx, 'Détails enfants', (c.enfants_details as string) ?? null)
  }
}

function renderRessources(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'Situation professionnelle & ressources')
  drawLabelValue(ctx, 'Profession', (c.profession as string) ?? null)
  drawLabelValue(
    ctx,
    'Statut professionnel',
    (c.statut_professionnel as string) ?? null
  )
  drawLabelValue(ctx, 'Employeur', (c.employeur as string) ?? null)
  drawLabelValue(
    ctx,
    'Date début emploi',
    (c.date_debut_emploi as string) ?? null
  )
  drawDivider(ctx)
  drawLabelValue(
    ctx,
    'Revenus professionnels nets (annuels)',
    formatEuro(c.revenus_pro_net as number | null)
  )
  drawLabelValue(
    ctx,
    'Revenus fonciers (annuels)',
    formatEuro(c.revenus_fonciers as number | null)
  )
  drawLabelValue(
    ctx,
    'Autres revenus (annuels)',
    formatEuro(c.autres_revenus as number | null)
  )
  drawLabelValue(
    ctx,
    'TOTAL revenus annuels',
    formatEuro(c.total_revenus_annuel as number | null)
  )
}

function renderBiensEtDettesPP(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'Patrimoine')
  renderJsonBlock(ctx, 'Patrimoine immobilier', c.patrimoine_immobilier)
  renderJsonBlock(ctx, 'Produits financiers / bancaires / AV', c.produits_financiers)
  renderJsonBlock(
    ctx,
    'Patrimoine divers (meubles, art, or, véhicules...)',
    c.patrimoine_divers
  )
  drawSectionTitle(ctx, 'Dettes')
  renderJsonBlock(ctx, 'Emprunts en cours', c.emprunts)
}

function renderJsonBlock(ctx: PageCtx, label: string, raw: unknown) {
  drawText(ctx, label, {
    size: 10,
    font: ctx.bold,
    color: COLORS.muted,
  })
  const arr = Array.isArray(raw) ? raw : []
  if (!arr.length) {
    drawText(ctx, '— (à compléter lors du rendez-vous)', {
      size: 9.5,
      font: ctx.italic,
      color: COLORS.muted,
    })
    ctx.y -= 4
    return
  }
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const parts: string[] = []
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined || v === '') continue
      parts.push(`${k}: ${formatAny(v)}`)
    }
    if (parts.length) {
      drawText(ctx, `• ${parts.join(' — ')}`, { size: 9.5 })
    }
  }
  ctx.y -= 4
}

function formatAny(v: unknown): string {
  if (typeof v === 'number') {
    // Heuristique : si > 1000 on suppose que c'est un montant.
    if (v > 1000 || v < -1000) return formatEuro(v)
    return String(v)
  }
  if (v instanceof Date) return formatDate(v.toISOString())
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function renderFiscalite(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'Fiscalité')
  drawLabelValue(
    ctx,
    'Impôt sur le revenu (N)',
    formatEuro(c.impot_revenu_n as number | null)
  )
  drawLabelValue(
    ctx,
    'Impôt sur le revenu (N-1)',
    formatEuro(c.impot_revenu_n1 as number | null)
  )
  drawLabelValue(
    ctx,
    'Impôt sur le revenu (N-2)',
    formatEuro(c.impot_revenu_n2 as number | null)
  )
}

function renderObjectifs(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'Objectifs du client')
  const txt = (c.objectifs_client as string) || '—'
  drawText(ctx, txt, { size: 10 })
}

// =====================================================
// Sections PM
// =====================================================

function renderElementsGenerauxPM(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'Éléments généraux')
  drawLabelValue(ctx, 'Raison sociale', (c.raison_sociale as string) ?? null)
  drawLabelValue(
    ctx,
    'Forme juridique',
    (c.forme_juridique as string) ?? null
  )
  drawLabelValue(
    ctx,
    'Capital social',
    formatEuro(c.capital_social as number | null)
  )
  drawLabelValue(
    ctx,
    'Date de création',
    formatDate(c.date_creation as string | null)
  )
  drawLabelValue(ctx, 'SIREN', (c.siren as string) ?? null)
  drawLabelValue(ctx, 'SIRET', (c.siret as string) ?? null)
  drawLabelValue(ctx, 'Adresse', (c.adresse as string) ?? null)
  drawLabelValue(ctx, 'Code postal', (c.code_postal as string) ?? null)
  drawLabelValue(ctx, 'Ville', (c.ville as string) ?? null)
  drawLabelValue(ctx, 'Pays', (c.pays as string) ?? null)
  drawLabelValue(ctx, 'Téléphone', (c.telephone as string) ?? null)
  drawLabelValue(ctx, 'Email', (c.email as string) ?? null)
}

function renderSituationFinanciere(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'Situation financière')
  drawText(ctx, 'Chiffre d\'affaires / résultats / bilan : à compléter lors du rendez-vous.', {
    size: 9.5,
    font: ctx.italic,
    color: COLORS.muted,
  })
  drawDivider(ctx)
  drawLabelValue(
    ctx,
    'Impôt sur les sociétés (N)',
    formatEuro(c.impot_revenu_n as number | null)
  )
  drawLabelValue(
    ctx,
    'Impôt sur les sociétés (N-1)',
    formatEuro(c.impot_revenu_n1 as number | null)
  )
  drawLabelValue(
    ctx,
    'Impôt sur les sociétés (N-2)',
    formatEuro(c.impot_revenu_n2 as number | null)
  )
}

function renderPatrimoinePM(ctx: PageCtx, c: KycPdfClient) {
  drawSectionTitle(ctx, 'Patrimoine de la société')
  renderJsonBlock(ctx, 'Patrimoine immobilier', c.patrimoine_immobilier)
  renderJsonBlock(ctx, 'Actifs financiers', c.produits_financiers)
}

// =====================================================
// Signature + avertissement CNIL
// =====================================================

const CNIL_NOTICE = [
  `Les informations recueillies dans le présent document sont collectées et traitées par ${CABINET_INFO.raisonSociale} (${CABINET_INFO.rcs}) en sa qualité de responsable de traitement, sous la responsabilité de ${CABINET_INFO.responsableTraitement}.`,
  `Elles sont nécessaires à l'exécution du mandat de conseil patrimonial et au respect des obligations réglementaires (LCB-FT, DDA, CIF, ACPR).`,
  `Conformément au RGPD et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de rectification, d'opposition, d'effacement et de portabilité en écrivant à ${CABINET_INFO.email}.`,
]

function renderCnilNotice(ctx: PageCtx) {
  drawSectionTitle(ctx, 'Avertissement CNIL / RGPD')
  for (const line of CNIL_NOTICE) {
    drawText(ctx, line, { size: 9, color: COLORS.muted })
    ctx.y -= 2
  }
}

function renderSignature(
  ctx: PageCtx,
  signature: KycPdfSignature,
  client: KycPdfClient
) {
  drawSectionTitle(ctx, 'Signature du client')

  if (signature.isIncomplete) {
    drawWarningBox(ctx, [
      `KYC signé avec un taux de complétude de ${signature.completionRate}%.`,
      `Le signataire a explicitement consenti à signer un dossier incomplet conformément aux deux cases cochées ci-dessous.`,
      `Le conseiller a recommandé de compléter les champs manquants avant toute opération patrimoniale.`,
    ])
  }

  drawLabelValue(ctx, 'Signé par', signature.signerName)
  drawLabelValue(ctx, 'Date / heure', formatDateTime(signature.signedAt))
  drawLabelValue(
    ctx,
    'Adresse IP',
    signature.signerIp || 'non capturée'
  )
  drawLabelValue(
    ctx,
    'Taux de complétude',
    `${signature.completionRate}%`
  )
  if (signature.missingFields.length) {
    drawLabelValue(
      ctx,
      'Champs manquants',
      signature.missingFields.join(', ')
    )
  }

  drawDivider(ctx)
  drawText(
    ctx,
    signature.consentAccuracy
      ? '[X] Je certifie que les informations fournies sont exactes.'
      : '[ ] Je certifie que les informations fournies sont exactes.',
    { size: 10 }
  )
  if (signature.isIncomplete) {
    drawText(
      ctx,
      signature.consentIncomplete
        ? '[X] Je confirme signer un KYC incomplet en connaissance de cause.'
        : '[ ] Je confirme signer un KYC incomplet en connaissance de cause.',
      { size: 10 }
    )
  }

  void client
}

// =====================================================
// Orchestrateur
// =====================================================

export async function generateKycPdfBytes(
  client: KycPdfClient,
  signature: KycPdfSignature
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`KYC — ${client.nom ?? client.raison_sociale ?? client.id ?? 'client'}`)
  doc.setAuthor(CABINET_INFO.raisonSociale)
  doc.setProducer(`${CABINET_INFO.raisonSociale} CRM`)
  doc.setCreator(`${CABINET_INFO.raisonSociale} CRM`)
  doc.setCreationDate(signature.signedAt)
  doc.setModificationDate(signature.signedAt)

  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)

  const totalPagesRef = { v: 1 }
  const ctx = newCtx(doc, regular, bold, italic, totalPagesRef)

  renderTitle(ctx, client)

  if (client.type_personne === 'morale') {
    renderElementsGenerauxPM(ctx, client)
    renderSituationFinanciere(ctx, client)
    renderPatrimoinePM(ctx, client)
  } else {
    renderEtatCivilPP(ctx, client)
    renderSituationFamiliale(ctx, client)
    renderRessources(ctx, client)
    renderBiensEtDettesPP(ctx, client)
    renderFiscalite(ctx, client)
  }

  renderObjectifs(ctx, client)
  renderCnilNotice(ctx)
  renderSignature(ctx, signature, client)

  // En-tête et pied sur toutes les pages (appliqué après génération pour
  // connaître le nombre total de pages).
  for (const p of doc.getPages()) {
    p.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 34,
      width: PAGE_WIDTH,
      height: 34,
      color: COLORS.primary,
    })
    p.drawText(sanitizeWinAnsi(CABINET_INFO.marque), {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 22,
      size: 14,
      font: bold,
      color: rgb(1, 1, 1),
    })
    p.drawText(
      sanitizeWinAnsi(
        `${CABINET_INFO.raisonSociale} — ${CABINET_INFO.rcs}`
      ),
      {
        x: PAGE_WIDTH - MARGIN_X - 260,
        y: PAGE_HEIGHT - 22,
        size: 8.5,
        font: regular,
        color: rgb(1, 1, 1),
      }
    )
  }
  drawFooterAll(ctx)

  // Silence the unused-helper lint for drawHeader (still exported intent).
  void drawHeader

  return await doc.save()
}
