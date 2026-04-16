import { NextRequest, NextResponse } from 'next/server'

// Dynamic imports to handle dependencies in Node.js environment
let pdfParse: any
let mammoth: any

try {
  pdfParse = require('pdf-parse')
} catch {
  pdfParse = null
}

try {
  mammoth = require('mammoth')
} catch {
  mammoth = null
}

interface KYCData {
  titre: 'monsieur' | 'madame'
  nom?: string | null
  prenom?: string | null
  nom_jeune_fille?: string | null
  date_naissance?: string | null
  lieu_naissance?: string | null
  nationalite?: string | null
  residence_fiscale?: string | null
  nif?: string | null
  adresse?: string | null
  proprietaire_locataire?: string | null
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
  patrimoine_immobilier?: Array<{
    designation?: string | null
    date_acquisition?: string | null
    valeur_acquisition?: number | null
    valeur_actuelle?: number | null
    detention?: string | null
    crd?: number | null
    charges?: number | null
  }>
  produits_financiers?: Array<{
    designation?: string | null
    detenteur?: string | null
    valeur?: number | null
    date_ouverture?: string | null
    versements_reguliers?: number | null
    rendement?: number | null
  }>
  emprunts?: Array<{
    designation?: string | null
    etablissement?: string | null
    montant_emprunte?: number | null
    date_souscription?: string | null
    duree?: number | null
    taux?: number | null
    crd?: number | null
    echeance?: number | null
  }>
  impot_revenu_n?: number | null
  impot_revenu_n1?: number | null
  impot_revenu_n2?: number | null
  objectifs_client?: string | null
  kyc_date_signature?: string | null
}

interface ParsedKYC {
  titulaire: KYCData
  conjoint: KYCData
}

/**
 * Parse a number from various formats found in KYC PDFs
 * "120000" → 120000, "376 kEUR" → 376000, "200k€" → 200000
 * "600k€" → 600000, "28.5k€" → 28500, "0.7%" → 0.7
 */
function parseNumber(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return null

  // mammoth sometimes renders € as "C" at end of number strings (e.g. "125 000C")
  // Also strip annotations like "(99K fixe, 66K bonus)" keeping only the main number
  let normalized = trimmed
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parenthetical annotations
    .replace(/€/g, '')
    .replace(/EUR/gi, '')
    .replace(/(\d)\s*C(\/mois|\/an)?\s*$/i, '$1') // "125 000C" → "125 000", "2200C/mois" → "2200"
    .replace(/(\d)\s*K\s*C\s*$/i, '$1K') // "900KC" → "900K"
    .replace(/\s+/g, '')
    .replace(/%$/, '')
    .replace(/,/g, '.')

  if (/k$/i.test(normalized)) {
    const num = parseFloat(normalized.replace(/k$/i, ''))
    return isNaN(num) ? null : Math.round(num * 1000)
  }

  const num = parseFloat(normalized)
  return isNaN(num) ? null : num
}

/**
 * Parse a date: "04/06/1978" → "1978-06-04"
 */
function parseDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) {
    const [, day, month, year] = match
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  const isoMatch = value.match(/(\d{4})-(\d{2})-(\d{2})/)
  return isoMatch ? isoMatch[0] : null
}

/**
 * Get all non-empty lines from text
 */
function getLines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
}

/**
 * Find the line index containing a pattern
 */
function findLineIndex(lines: string[], pattern: RegExp, startFrom = 0): number {
  for (let i = startFrom; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i
  }
  return -1
}

/**
 * Get the next N non-empty values after a label line
 * The PDF format puts label on one line, then values on subsequent lines
 */
function getValuesAfterLabel(lines: string[], labelIdx: number, count = 2): string[] {
  const results: string[] = []
  // First check if value is on the SAME line as label
  const labelLine = lines[labelIdx]

  for (let i = labelIdx + 1; i < lines.length && results.length < count; i++) {
    const line = lines[i].trim()
    // Stop if we hit another known section header or label
    if (/^(Nom|Prénom|Date|Nationalité|Résidence|Numéro|Adresse|Propriétaire|Téléphone|SITUATION|VOS|FLUX|IMMOBILIER|PRODUITS|DIVERS|EMPRUNTS|FISCALITE|OBJECTIFS|AVERTISSEMENT)/i.test(line)) break
    if (line.length > 0 && line !== '-') {
      results.push(line)
    } else if (line === '-') {
      results.push('')
    }
  }
  return results
}

/**
 * Extract text between two section headers
 */
function extractSection(text: string, startPattern: RegExp, endPattern: RegExp): string {
  const startMatch = text.search(startPattern)
  if (startMatch === -1) return ''

  // Find end of the start line
  const afterStart = text.indexOf('\n', startMatch)
  if (afterStart === -1) return ''

  const endMatch = text.substring(afterStart).search(endPattern)
  if (endMatch === -1) {
    return text.substring(afterStart).trim()
  }
  return text.substring(afterStart, afterStart + endMatch).trim()
}

/**
 * Parse table rows: splits by 2+ spaces, returns arrays of cells
 * Skips header rows (containing "Désignation") and total rows
 */
function parseTableRows(sectionText: string, minCols: number): string[][] {
  const lines = getLines(sectionText)
  const rows: string[][] = []

  for (const line of lines) {
    // Skip headers, totals, and empty-looking lines
    if (/d[ée]signation|d[ée]tenteur|[ée]tablissement|montant emprunté|date.*souscription/i.test(line)) continue
    if (/^TOTAL/i.test(line)) continue
    if (/^MB$/i.test(line)) continue
    if (/^(Charges|Valeur|Date|Rendement|Durée|Taux|CRD|Montant)/i.test(line) && line.split(/\s{2,}/).length <= 2) continue

    const cells = line.split(/\s{2,}|\t/).map(c => c.trim()).filter(c => c.length > 0)
    if (cells.length >= minCols) {
      rows.push(cells)
    }
  }
  return rows
}


/**
 * Main KYC parser — designed for the "Ethique et Patrimoine" KYC format
 *
 * PDF text structure (from pdf-parse):
 * - ETAT CIVIL: Label on one line, Monsieur value on next, Madame on next
 *   BUT some fields (Profession, Statut, Depuis, Employeur) have label+values on SAME line
 * - "Date, lieu de naissance": "DD/MM/YYYY à Lieu (dept)" — combined field
 * - SITUATION MATRIMONIALE: checkbox "X Marié(e)" style on one line
 * - Tables: designation on one line, numeric values on next line (not same line!)
 *   Except EMPRUNTS which has all values on one line per row
 * - Produits financiers: name on one line, value on next, spans page breaks
 * - Fiscalité: single line "N (year): amount  N-1: amount  N-2: amount"
 *
 * IMPORTANT: pdf-parse extracts text with inconsistent spacing.
 * Single spaces may appear between column values that were in separate PDF columns.
 * We use context-aware parsing instead of relying on space-based splitting.
 */
function parseKYCText(pdfText: string): ParsedKYC {
  const titulaire: KYCData = { titre: 'monsieur' }
  const conjoint: KYCData = { titre: 'madame' }
  const lines = getLines(pdfText)

  // ═══ ETAT CIVIL ═══
  // The PDF uses a two-column layout (Monsieur / Madame).
  // pdf-parse extracts labels on their own line, then values on subsequent lines.
  // When the titulaire cell is empty, the conjoint value appears directly after the label.

  // Nom
  const nomIdx = findLineIndex(lines, /^Nom$/i)
  if (nomIdx >= 0) {
    const vals = getValuesAfterLabel(lines, nomIdx, 2)
    titulaire.nom = vals[0] || null
    conjoint.nom = vals[1] || null
  }

  // Nom de jeune fille — titulaire cell is usually empty
  // The raw text goes: "Nom de jeune fille" → (empty for Mr) → "Salaun" (for Mme)
  // Since getValuesAfterLabel skips empty lines, the first value IS the conjoint's
  const njfIdx = findLineIndex(lines, /nom de jeune fille/i)
  if (njfIdx >= 0) {
    const vals = getValuesAfterLabel(lines, njfIdx, 1)
    // NJF is almost always for the conjoint (maiden name)
    conjoint.nom_jeune_fille = vals[0] || null
    titulaire.nom_jeune_fille = null
  }

  // Prénom
  const prenomIdx = findLineIndex(lines, /^Pr[ée]nom$/i)
  if (prenomIdx >= 0) {
    const vals = getValuesAfterLabel(lines, prenomIdx, 2)
    titulaire.prenom = vals[0] || null
    conjoint.prenom = vals[1] || null
  }

  // Date, lieu de naissance — format: "DD/MM/YYYY à Lieu (dept)"
  const dateLieuIdx = findLineIndex(lines, /date.*lieu.*naissance|date.*naissance/i)
  if (dateLieuIdx >= 0) {
    const vals = getValuesAfterLabel(lines, dateLieuIdx, 2)
    for (let v = 0; v < vals.length; v++) {
      const person = v === 0 ? titulaire : conjoint
      const line = vals[v]
      const dateMatch = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
      if (dateMatch) {
        person.date_naissance = parseDate(dateMatch[1])
      }
      // Extract lieu: after "à" or after the date
      const lieuMatch = line.match(/(?:à|a)\s+(.+?)(?:\s*$)/) || line.match(/\d{4}\s+(.+)/)
      if (lieuMatch) {
        person.lieu_naissance = lieuMatch[1].trim()
      }
    }
  }

  // Fallback: find dates in text if label-based approach failed
  if (!titulaire.date_naissance) {
    const allDates = pdfText.match(/\d{1,2}\/\d{1,2}\/\d{4}/g)
    if (allDates && allDates.length >= 1) {
      titulaire.date_naissance = parseDate(allDates[0])
      if (allDates.length >= 2) conjoint.date_naissance = parseDate(allDates[1])
    }
  }

  // Nationalité — may have 1 value (shared) or 2 values
  const natIdx = findLineIndex(lines, /^Nationalit[ée]$/i)
  if (natIdx >= 0) {
    const vals = getValuesAfterLabel(lines, natIdx, 2)
    titulaire.nationalite = vals[0] || null
    conjoint.nationalite = vals[1] || vals[0] || null
  }

  // Résidence fiscale — may have 1 value (shared) or 2 values
  const rfIdx = findLineIndex(lines, /^R[ée]sidence fiscale$/i)
  if (rfIdx >= 0) {
    const vals = getValuesAfterLabel(lines, rfIdx, 2)
    titulaire.residence_fiscale = vals[0] || null
    conjoint.residence_fiscale = vals[1] || vals[0] || null
  }

  // NIF
  const nifIdx = findLineIndex(lines, /num[ée]ro d'identification|^NIF$/i)
  if (nifIdx >= 0) {
    const vals = getValuesAfterLabel(lines, nifIdx, 2)
    titulaire.nif = (vals[0] && vals[0] !== '-') ? vals[0] : null
    conjoint.nif = (vals[1] && vals[1] !== '-') ? vals[1] : null
  }

  // Adresse
  const addrIdx = findLineIndex(lines, /^Adresse$/i)
  if (addrIdx >= 0) {
    const addrParts: string[] = []
    for (let i = addrIdx + 1; i < lines.length && addrParts.length < 3; i++) {
      const l = lines[i]
      if (/^(Propriétaire|Locataire|Téléphone)/i.test(l)) break
      if (l.length > 0) addrParts.push(l)
    }
    titulaire.adresse = addrParts.join(', ') || null
  }

  // Propriétaire / Locataire — value often on same line as label
  const proprioIdx = findLineIndex(lines, /Propri[ée]taire.*Locataire|Locataire.*Propri[ée]taire/i)
  if (proprioIdx >= 0) {
    const val = lines[proprioIdx].toLowerCase()
    if (/propri[ée]taire\s*$/.test(val)) {
      titulaire.proprietaire_locataire = 'proprietaire'
    } else if (/locataire\s*$/.test(val)) {
      titulaire.proprietaire_locataire = 'locataire'
    } else {
      const nextLine = lines[proprioIdx + 1]?.toLowerCase() || ''
      if (nextLine.includes('propri')) titulaire.proprietaire_locataire = 'proprietaire'
      else if (nextLine.includes('locataire')) titulaire.proprietaire_locataire = 'locataire'
    }
  }

  // Téléphone
  const telIdx = findLineIndex(lines, /^T[ée]l[ée]phone$/i)
  if (telIdx >= 0) {
    const vals = getValuesAfterLabel(lines, telIdx, 2)
    titulaire.telephone = vals[0] || null
    conjoint.telephone = vals[1] || null
  }

  // Email
  const mailIdx = findLineIndex(lines, /^(Adresse\s+mail|Email|E-mail|Mail)$/i)
  if (mailIdx >= 0) {
    const vals = getValuesAfterLabel(lines, mailIdx, 2)
    titulaire.email = vals[0] || null
    conjoint.email = vals[1] || null
  }

  // ═══ SITUATION FAMILIALE ═══

  // Situation matrimoniale — checkbox format: "X Marié(e)"
  // The line contains all options: "Célibataire Concubinage Pacsé(e) X Marié(e) Veuf(ve) Divorcé(e)"
  const sitMatriLine = pdfText.match(/C[ée]libataire.*Concubinage.*Pacs[ée].*Mari[ée].*Veuf.*Divorc[ée]/i)
  if (sitMatriLine) {
    const line = sitMatriLine[0]
    if (/X\s*Mari[ée]\(?e?\)?/i.test(line)) {
      titulaire.situation_matrimoniale = 'marie'
    } else if (/X\s*C[ée]libataire/i.test(line)) {
      titulaire.situation_matrimoniale = 'celibataire'
    } else if (/X\s*Concubinage/i.test(line)) {
      titulaire.situation_matrimoniale = 'concubinage'
    } else if (/X\s*Pacs[ée]\(?e?\)?/i.test(line)) {
      titulaire.situation_matrimoniale = 'pacse'
    } else if (/X\s*Veuf/i.test(line)) {
      titulaire.situation_matrimoniale = 'veuf'
    } else if (/X\s*Divorc[ée]\(?e?\)?/i.test(line)) {
      titulaire.situation_matrimoniale = 'divorce'
    }
  }

  // Régime matrimonial — value on next line, often starts with "*"
  const regimeIdx = findLineIndex(lines, /R[ée]gime matrimonial/i)
  if (regimeIdx >= 0) {
    for (let i = regimeIdx + 1; i < Math.min(regimeIdx + 4, lines.length); i++) {
      const l = lines[i]
      if (/^(ENFANTS|Nombre|\d+\s*enfants?)/i.test(l)) break
      if (l.startsWith('*')) {
        titulaire.regime_matrimonial = l.replace(/^\*\s*/, '').trim()
        break
      } else if (l.length > 2 && !/^(MB|DOCUMENT|Paraphes)/i.test(l)) {
        titulaire.regime_matrimonial = l.replace(/^\*\s*/, '').trim()
        break
      }
    }
  }

  // Enfants
  const enfantsMatch = pdfText.match(/(\d+)\s*enfants?\s*:?\s*\n?([\s\S]*?)(?=\n\s*\n|\nMB|\nSITUATION|\nVOS)/i)
  if (enfantsMatch) {
    titulaire.nombre_enfants = parseInt(enfantsMatch[1], 10)
    const agesText = enfantsMatch[2].trim()
    const ages = agesText.match(/\d+\s*ans/g)
    if (ages) {
      titulaire.enfants_details = ages.join(', ')
    }
  }

  // ═══ SITUATION PROFESSIONNELLE ═══
  // Format: label + values on SAME line, e.g. "Profession Senior Director CMO"
  // Two-column values separated by spaces — but column boundary is unknown.
  // Strategy: for Statut/Depuis, values are short and repeated patterns.
  // For Profession/Employeur, we use Employeur to disambiguate.

  // First parse Statut (short values like "CDI CDI" or "TNS CDI")
  const statutIdx = findLineIndex(lines, /^Statut\s+/i)
  if (statutIdx >= 0) {
    const statutLine = lines[statutIdx].replace(/^Statut\s+/i, '').trim()
    // Split known status values: CDI, CDD, TNS, Fonctionnaire, Retraité, etc.
    const statusMatch = statutLine.match(/^(\S+(?:\s+\S+)?)\s+(\S+(?:\s+\S+)?)$/)
    if (statusMatch) {
      titulaire.statut_professionnel = statusMatch[1].trim()
      conjoint.statut_professionnel = statusMatch[2].trim()
    } else {
      titulaire.statut_professionnel = statutLine || null
    }
  }

  // Depuis — format "Avril 2008 Avril 2016" or "2008 2016"
  const depuisIdx = findLineIndex(lines, /^Depuis\s+/i)
  if (depuisIdx >= 0) {
    const depuisLine = lines[depuisIdx].replace(/^Depuis\s+/i, '').trim()
    // Split at the boundary between two date-like values (Month Year Month Year)
    const datesPairMatch = depuisLine.match(/^(.+?\d{4})\s+(.+?\d{4})$/)
    if (datesPairMatch) {
      titulaire.date_debut_emploi = datesPairMatch[1].trim()
      conjoint.date_debut_emploi = datesPairMatch[2].trim()
    } else {
      titulaire.date_debut_emploi = depuisLine || null
    }
  }

  // Employeur — e.g. "Employeur CIC CIB Centric Software"
  // When no double-space separator, store entire value as titulaire
  // (can't reliably determine where Mr's employer ends and Mme's begins)
  const emplIdx = findLineIndex(lines, /^Employeur\s+/i)
  if (emplIdx >= 0) {
    const emplLine = lines[emplIdx].replace(/^Employeur\s+/i, '').trim()
    const parts = emplLine.split(/\s{2,}/)
    if (parts.length >= 2) {
      titulaire.employeur = parts[0].trim()
      conjoint.employeur = parts.slice(1).join(' ').trim()
    } else {
      // Store whole value — user can manually fix the split in the CRM
      titulaire.employeur = emplLine || null
    }
  }

  // Profession — e.g. "Profession Senior Director CMO"
  const profIdx = findLineIndex(lines, /^Profession\s+/i)
  if (profIdx >= 0) {
    const profLine = lines[profIdx].replace(/^Profession\s+/i, '').trim()
    const parts = profLine.split(/\s{2,}/)
    if (parts.length >= 2) {
      titulaire.profession = parts[0].trim()
      conjoint.profession = parts.slice(1).join(' ').trim()
    } else {
      // Store whole value — user can manually fix the split
      titulaire.profession = profLine || null
    }
  }

  // ═══ FLUX (Revenus) ═══
  // Revenue section: multi-line label then values.
  // "120000 205000" — numbers separated by single space.
  // We need to find lines that contain only numbers after the revenue label.

  const revSection = extractSection(pdfText, /FLUX|VOS RESSOURCES/i, /VOS BIENS|IMMOBILIER/i)
  if (revSection) {
    const revLines = getLines(revSection)

    // Find the line with just numbers after "imposable)" or revenue label
    for (let i = 0; i < revLines.length; i++) {
      const line = revLines[i]
      // Look for a line that's just numbers (revenue values)
      if (/^\d{4,}/.test(line.trim()) && !/^(20[12]\d|19\d{2})$/.test(line.trim())) {
        // This is likely the revenue line: "120000 205000"
        const nums = line.trim().split(/\s+/).map(v => parseNumber(v)).filter(n => n !== null)
        if (nums.length >= 1 && !titulaire.revenus_pro_net) {
          titulaire.revenus_pro_net = nums[0]
          if (nums.length >= 2) conjoint.revenus_pro_net = nums[1]
        }
        break
      }
    }

    // Revenus fonciers
    const revFoncIdx = revLines.findIndex(l => /revenus?\s*fonciers?/i.test(l))
    if (revFoncIdx >= 0) {
      // Value might be on same line or next line
      const sameLine = revLines[revFoncIdx].replace(/revenus?\s*fonciers?\s*/i, '').trim()
      if (sameLine && sameLine.toLowerCase() !== 'n/a') {
        titulaire.revenus_fonciers = parseNumber(sameLine)
      } else if (revFoncIdx + 1 < revLines.length) {
        const nextVal = revLines[revFoncIdx + 1].trim()
        if (nextVal && nextVal.toLowerCase() !== 'n/a' && /\d/.test(nextVal)) {
          titulaire.revenus_fonciers = parseNumber(nextVal)
        }
      }
    }

    // Total revenus — "TOTAL REVENUS :   27000/ mois    325000/ an"
    const totalRevLine = revLines.find(l => /TOTAL\s*REVENUS/i.test(l))
    if (totalRevLine) {
      const annualMatch = totalRevLine.match(/([\d.,]+k?)\s*\/\s*an/i)
      if (annualMatch) {
        titulaire.total_revenus_annuel = parseNumber(annualMatch[1])
      } else {
        const nums = totalRevLine.match(/[\d.,]+k?(?:€|EUR)?/gi)
        if (nums) {
          const parsed = nums.map(n => parseNumber(n)).filter(n => n !== null && n > 10000)
          if (parsed.length > 0) titulaire.total_revenus_annuel = parsed[parsed.length - 1]
        }
      }
    }
  }

  // ═══ PATRIMOINE IMMOBILIER ═══
  // Format: designation on one line, then values on next line
  // e.g. "Résidence principale\n2021 915000 1200000 600155"
  const immoSection = extractSection(
    pdfText,
    /IMMOBILIER D[''\u2019]USAGE|PATRIMOINE IMMOBILIER/i,
    /PRODUITS FINANCIERS|BANCAIRES|ASSURANCE|DIVERS/i
  )
  if (immoSection) {
    const immoLines = getLines(immoSection)
    const patrimoine: KYCData['patrimoine_immobilier'] = []

    for (let i = 0; i < immoLines.length; i++) {
      const line = immoLines[i]
      // Skip headers, totals, page artifacts
      if (/d[ée]signation|^TOTAL|^MB$|^DOCUMENT|^Paraphes|^\d+$/i.test(line)) continue
      if (/^(Charges|Valeur|Date|CRD|associ)/i.test(line)) continue

      // A designation line contains text (not starting with a number/year pattern)
      // Followed by a values line that starts with a year or numbers
      if (!/^\d/.test(line) && line.length > 2) {
        // Look at next line for numeric values
        const nextLine = immoLines[i + 1]?.trim() || ''
        if (/^\d/.test(nextLine)) {
          const nums = nextLine.split(/\s+/)
          patrimoine.push({
            designation: line,
            date_acquisition: nums[0] || null,
            valeur_acquisition: parseNumber(nums[1]),
            valeur_actuelle: parseNumber(nums[2]),
            crd: parseNumber(nums[3]),
            charges: parseNumber(nums[4]),
          })
          i++ // Skip the values line
        }
      }
    }
    if (patrimoine.length > 0) titulaire.patrimoine_immobilier = patrimoine
  }

  // ═══ PRODUITS FINANCIERS ═══
  // Format: product name on one line, value on next line (or near it)
  // Spans page breaks (MB, page number, DOCUMENT CONFIDENTIEL, Paraphes)
  // e.g. "CAV Fr Cardif\n\n376 kEUR"
  const prodStart = pdfText.search(/PRODUITS FINANCIERS|BANCAIRES|ASSURANCE-VIE/i)
  const diversStart = pdfText.search(/\nDIVERS\s/i)
  if (prodStart >= 0) {
    const prodEnd = diversStart >= 0 ? diversStart : pdfText.search(/VOS DETTES|EMPRUNTS/i)
    const prodText = prodEnd >= 0
      ? pdfText.substring(prodStart, prodEnd)
      : pdfText.substring(prodStart, prodStart + 2000)

    // Clean out page break artifacts
    const cleanProd = prodText
      .replace(/MB\s*\n/g, '\n')
      .replace(/\d+\s*\nDOCUMENT STRICTEMENT CONFIDENTIEL\s*\n/gi, '\n')
      .replace(/Paraphes\s*:\s*\n/gi, '\n')

    const prodLines = getLines(cleanProd)
    const produits: KYCData['produits_financiers'] = []

    for (let i = 0; i < prodLines.length; i++) {
      const line = prodLines[i]
      // Skip headers
      if (/d[ée]signation|d[ée]tenteur|^TOTAL|^PRODUITS|^BANCAIRES|^ASSURANCE|^Valeur$|^Date$|^Versements|^r[ée]guliers|^Rendement|^d'ouverture$|^ouverture$|^r[ée]guli/i.test(line)) continue

      // A product name: text that doesn't look like a pure value
      if (!/^\d/.test(line) && !/^[\d.,]+\s*k?(?:€|EUR)/i.test(line) && line.length > 2) {
        // Look ahead for a value
        let value: number | null = null
        for (let j = i + 1; j < Math.min(i + 3, prodLines.length); j++) {
          const valLine = prodLines[j].trim()
          const parsed = parseNumber(valLine)
          if (parsed !== null && parsed > 0) {
            value = parsed
            break
          }
        }
        produits.push({
          designation: line,
          detenteur: null,
          valeur: value,
          date_ouverture: null,
          versements_reguliers: null,
          rendement: null,
        })
      }
    }
    if (produits.length > 0) titulaire.produits_financiers = produits
  }

  // ═══ EMPRUNTS ═══
  // Format: all values on one line, space-separated
  // "RP SG  760000  2021 20  0.7% 600k€ 3441"
  // Problem: inconsistent spacing. We parse by recognizing value patterns.
  const empSection = extractSection(
    pdfText,
    /EMPRUNTS ET CHARGES|EMPRUNTS/i,
    /VOTRE FISCALIT[EÉ]|FISCALIT[EÉ]|OBJECTIFS/i
  )
  if (empSection) {
    const empLines = getLines(empSection)
    const emprunts: KYCData['emprunts'] = []

    for (const line of empLines) {
      // Skip headers, totals
      if (/d[ée]signation|[ée]tablissement|montant|^TOTAL|^EMPRUNTS|souscription|Dur[ée]e|^Taux|^CRD|l'[ée]ch[ée]ance|pr[êe]teur/i.test(line)) continue
      if (/^MB$/i.test(line)) continue

      // Match emprunt lines: they contain a % sign (taux) and numbers
      if (/%/.test(line) || (/\d{4}/.test(line) && /\d{2,}/.test(line))) {
        // Parse the line by extracting known patterns
        // Pattern: designation  etablissement  montant  date  duree  taux%  CRD  echeance
        // Use regex to extract from the whole line
        const match = line.match(
          /^(.+?)\s{2,}(\d[\d\s]*?\d)\s+(\d{4})\s+(\d+)\s+([\d.,]+%?)\s+([\d.,]+k?€?)\s+(\d+)\s*$/
        )
        if (match) {
          const [, desigEtab, montant, annee, duree, taux, crd, echeance] = match
          // Split designation and établissement
          const desigParts = desigEtab.split(/\s{2,}/)
          emprunts.push({
            designation: desigParts[0]?.trim() || null,
            etablissement: desigParts[1]?.trim() || desigParts[0]?.trim() || null,
            montant_emprunte: parseNumber(montant.replace(/\s/g, '')),
            date_souscription: annee,
            duree: parseInt(duree, 10) || null,
            taux: parseFloat(taux.replace('%', '').replace(',', '.')) || null,
            crd: parseNumber(crd),
            echeance: parseNumber(echeance),
          })
        } else {
          // Fallback: split by any whitespace and try to assign columns
          const tokens = line.split(/\s+/).filter(t => t.length > 0)
          if (tokens.length >= 4) {
            // Find the year token (4 digits, 19xx or 20xx)
            const yearIdx = tokens.findIndex(t => /^(19|20)\d{2}$/.test(t))
            if (yearIdx >= 2) {
              const designation = tokens.slice(0, yearIdx - 2).join(' ')
              const etablissement = tokens[yearIdx - 2]
              const montant = tokens[yearIdx - 1]
              const annee = tokens[yearIdx]
              const duree = tokens[yearIdx + 1]
              const taux = tokens[yearIdx + 2]
              const crd = tokens[yearIdx + 3]
              const echeance = tokens[yearIdx + 4]
              emprunts.push({
                designation: designation || tokens[0] || null,
                etablissement: etablissement || null,
                montant_emprunte: parseNumber(montant),
                date_souscription: annee || null,
                duree: duree ? parseInt(duree, 10) || null : null,
                taux: taux ? parseFloat(taux.replace('%', '').replace(',', '.')) || null : null,
                crd: parseNumber(crd),
                echeance: parseNumber(echeance),
              })
            }
          }
        }
      }
    }
    if (emprunts.length > 0) titulaire.emprunts = emprunts
  }

  // ═══ FISCALITÉ ═══
  // Format: "Impôt sur revenu  :   N (2025) :  485k€  N- 1 :   52k€     N- 2 :67k€"
  const fiscLine = pdfText.match(/Imp[ôo]t sur (?:le )?revenu[^:]*:([^\n]+)/i)
  if (fiscLine) {
    const fiscText = fiscLine[1]
    const nMatch = fiscText.match(/N\s*\([^)]*\)\s*:?\s*([\d.,]+k?€?)/i)
    if (nMatch) titulaire.impot_revenu_n = parseNumber(nMatch[1])

    const n1Match = fiscText.match(/N\s*-\s*1\s*:?\s*([\d.,]+k?€?)/i)
    if (n1Match) titulaire.impot_revenu_n1 = parseNumber(n1Match[1])

    const n2Match = fiscText.match(/N\s*-\s*2\s*:?\s*([\d.,]+k?€?)/i)
    if (n2Match) titulaire.impot_revenu_n2 = parseNumber(n2Match[1])
  }

  // ═══ OBJECTIFS CLIENT ═══
  const objMatch = pdfText.match(/Objectifs?\s*principaux?\s*:?\s*([^\n]+)/i)
  if (objMatch) {
    titulaire.objectifs_client = objMatch[1].trim()
  } else {
    const objMatch2 = pdfText.match(/OBJECTIFS?\s*CLIENT[S]?\s*\n+([^\n]+)/i)
    if (objMatch2 && !objMatch2[1].match(/^MB$/)) {
      titulaire.objectifs_client = objMatch2[1].trim()
    }
  }

  // ═══ DATE SIGNATURE ═══
  const sigMatch = pdfText.match(/(?:Sign[ée]\s+[àa]|le)\s+.*?(\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (sigMatch) {
    titulaire.kyc_date_signature = parseDate(sigMatch[1])
  }

  return { titulaire, conjoint }
}

// ═══════════════════════════════════════════════════════════════════
// DOCX PARSER — Uses mammoth to extract HTML tables from Word documents
// This is MUCH more reliable than PDF text parsing because .docx files
// have structured XML with actual table cells.
// ═══════════════════════════════════════════════════════════════════

/**
 * Simple HTML table parser — extracts rows of cells from HTML tables.
 * Returns array of tables, each table is array of rows, each row is array of cell texts.
 */
function parseHTMLTables(html: string): string[][][] {
  const tables: string[][][] = []
  // Match each <table>...</table>
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi
  let tableMatch
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1]
    const rows: string[][] = []
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    let rowMatch
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1]
      const cells: string[] = []
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
      let cellMatch
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        // Strip HTML tags from cell content, normalize whitespace
        const text = cellMatch[1]
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim()
        cells.push(text)
      }
      if (cells.length > 0) rows.push(cells)
    }
    if (rows.length > 0) tables.push(rows)
  }
  return tables
}

/**
 * Extract text content between HTML tables (for sections like "Régime matrimonial" that
 * appear as plain text between tables, or the fiscalité/objectifs sections)
 */
function extractTextBetweenTables(html: string): string {
  return html
    .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '\n---TABLE---\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Find a table whose cells contain a matching label
 */
function findTable(tables: string[][][], pattern: RegExp): string[][] | null {
  for (const table of tables) {
    for (const row of table) {
      for (const cell of row) {
        if (pattern.test(cell)) return table
      }
    }
  }
  return null
}

/**
 * Find a table by its HEADER ROW column names.
 * This is more reliable than searching for section titles which may be
 * in paragraphs between tables rather than in the tables themselves.
 */
function findTableByHeaders(tables: string[][][], requiredPatterns: RegExp[]): string[][] | null {
  for (const table of tables) {
    // Check first 2 rows (header might be row 0 or row 1 if row 0 is a section title)
    for (let r = 0; r < Math.min(2, table.length); r++) {
      const row = table[r]
      const matchCount = requiredPatterns.filter(p => row.some(cell => p.test(cell))).length
      if (matchCount >= requiredPatterns.length) return table
    }
  }
  return null
}

/**
 * In a 3-column table (label, Mr, Mme), get cell value by label
 */
function getRowValue(table: string[][], labelPattern: RegExp, colIndex: number): string | null {
  for (const row of table) {
    if (row.length >= 2 && labelPattern.test(row[0])) {
      const val = row[colIndex]?.trim()
      return (val && val !== '-' && val.length > 0) ? val : null
    }
  }
  return null
}

/**
 * Parse KYC from DOCX HTML tables — the reliable approach.
 * The Ethique et Patrimoine KYC docx has these tables:
 * 1. État civil (3 cols: label, Monsieur, Madame)
 * 2. Situation matrimoniale (checkboxes as text)
 * 3. Enfants
 * 4. Situation professionnelle (3 cols: label, Mr, Mme)
 * 5. Flux / Revenus (3 cols: label, Mr, Mme)
 * 6. Immobilier d'usage (6-7 cols)
 * 7. Produits financiers (6 cols)
 * 8. Divers (5 cols)
 * 9. Emprunts et charges (7-8 cols)
 */
function parseKYCDocx(html: string): ParsedKYC {
  const tables = parseHTMLTables(html)
  const fullText = extractTextBetweenTables(html)

  const titulaire: KYCData = { titre: 'monsieur' }
  const conjoint: KYCData = { titre: 'madame' }

  // ═══ TABLE 1: ÉTAT CIVIL ═══
  // 3 columns: Label | Monsieur | Madame
  const etatCivil = findTable(tables, /^(Titre|Nom)$/i) || findTable(tables, /ETAT CIVIL|COORDONN/i)
  if (etatCivil) {
    // Parse titre from the "Titre" row
    // Values like "MONSIEUR / MADAME" mean the template wasn't filled — both could be monsieur
    // We detect the actual gender: "MONSIEUR" alone = monsieur, "MADAME" alone = madame
    // "MONSIEUR / MADAME" = ambiguous, default to 'monsieur' (can be corrected by user)
    const titreRow = etatCivil.find(r => /^Titre$/i.test(r[0]))
    if (titreRow) {
      const t1 = (titreRow[1] || '').toLowerCase()
      const t2 = (titreRow[2] || '').toLowerCase()
      // Titulaire
      if (t1.includes('monsieur') && !t1.includes('madame')) titulaire.titre = 'monsieur'
      else if (t1.includes('madame') && !t1.includes('monsieur')) titulaire.titre = 'madame'
      // else: ambiguous "monsieur / madame" → keep default 'monsieur'

      // Conjoint
      if (t2.includes('madame') && !t2.includes('monsieur')) conjoint.titre = 'madame'
      else if (t2.includes('monsieur') && !t2.includes('madame')) conjoint.titre = 'monsieur'
      else conjoint.titre = 'monsieur' // both ambiguous → default monsieur
    }

    titulaire.nom = getRowValue(etatCivil, /^Nom$/i, 1)
    conjoint.nom = getRowValue(etatCivil, /^Nom$/i, 2)

    // Nom de jeune fille
    const njf1 = getRowValue(etatCivil, /jeune fille/i, 1)
    const njf2 = getRowValue(etatCivil, /jeune fille/i, 2)
    titulaire.nom_jeune_fille = njf1
    conjoint.nom_jeune_fille = njf2

    titulaire.prenom = getRowValue(etatCivil, /^Pr[ée]nom$/i, 1)
    conjoint.prenom = getRowValue(etatCivil, /^Pr[ée]nom$/i, 2)

    // Date, lieu de naissance — may be combined "Lille, 17/09/1990" or "Saint Denis (La Reunion), 03/08/1991"
    const dateLieu1 = getRowValue(etatCivil, /naissance/i, 1)
    const dateLieu2 = getRowValue(etatCivil, /naissance/i, 2)
    for (const [val, person] of [[dateLieu1, titulaire], [dateLieu2, conjoint]] as [string | null, KYCData][]) {
      if (val) {
        const dateMatch = val.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)
        if (dateMatch) person.date_naissance = parseDate(dateMatch[1])
        // Extract lieu: everything except the date
        const lieu = val.replace(/\d{1,2}\/\d{1,2}\/\d{4}/, '').replace(/^[,\s]+|[,\s]+$/g, '').trim()
        if (lieu) person.lieu_naissance = lieu
      }
    }

    titulaire.nationalite = getRowValue(etatCivil, /nationalit/i, 1)
    conjoint.nationalite = getRowValue(etatCivil, /nationalit/i, 2)

    titulaire.residence_fiscale = getRowValue(etatCivil, /r[ée]sidence fiscale/i, 1)
    conjoint.residence_fiscale = getRowValue(etatCivil, /r[ée]sidence fiscale/i, 2)

    // NIF
    titulaire.nif = getRowValue(etatCivil, /num[ée]ro.*identification|^NIF/i, 1)
    conjoint.nif = getRowValue(etatCivil, /num[ée]ro.*identification|^NIF/i, 2)

    // Adresse — may span both columns
    const addr1 = getRowValue(etatCivil, /^Adresse$/i, 1)
    const addr2 = getRowValue(etatCivil, /^Adresse$/i, 2)
    titulaire.adresse = addr1 || addr2

    // Propriétaire / Locataire
    const proprio1 = getRowValue(etatCivil, /propri[ée]taire.*locataire/i, 1)
    if (proprio1) {
      titulaire.proprietaire_locataire = /propri[ée]taire/i.test(proprio1) ? 'proprietaire' : 'locataire'
    }

    titulaire.telephone = getRowValue(etatCivil, /t[ée]l[ée]phone/i, 1)
    conjoint.telephone = getRowValue(etatCivil, /t[ée]l[ée]phone/i, 2)

    titulaire.email = getRowValue(etatCivil, /mail|email/i, 1)
    conjoint.email = getRowValue(etatCivil, /mail|email/i, 2)
  }

  // ═══ TABLE 2: SITUATION MATRIMONIALE ═══
  const sitMatriTable = findTable(tables, /SITUATION MATRIMONIALE/i)
  if (sitMatriTable) {
    // Look for the row with checkboxes: "Célibataire Concubinage Pacsé(e) X Marié(e) ..."
    for (const row of sitMatriTable) {
      const cellText = row.join(' ')
      if (/X\s*Mari[ée]\(?e?\)?/i.test(cellText)) {
        titulaire.situation_matrimoniale = 'marie'
      } else if (/X\s*C[ée]libataire/i.test(cellText)) {
        titulaire.situation_matrimoniale = 'celibataire'
      } else if (/X\s*Concubinage/i.test(cellText)) {
        titulaire.situation_matrimoniale = 'concubinage'
      } else if (/X\s*Pacs[ée]\(?e?\)?/i.test(cellText)) {
        titulaire.situation_matrimoniale = 'pacse'
      } else if (/X\s*Veuf/i.test(cellText)) {
        titulaire.situation_matrimoniale = 'veuf'
      } else if (/X\s*Divorc[ée]\(?e?\)?/i.test(cellText)) {
        titulaire.situation_matrimoniale = 'divorce'
      }
    }
  }

  // Régime matrimonial — appears in text between tables
  // Format: "Régime matrimonial* CTE" followed by "ENFANTS" or other section
  // Must stop before any section header (ENFANTS, SITUATION, VOS, ---TABLE---)
  const regimeMatch = fullText.match(/R[ée]gime matrimonial\*?\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'',()]*?)(?:\s+ENFANTS|\s+SITUATION|\s+VOS|\s+---TABLE---|\s*$)/i)
  if (regimeMatch) {
    let regime = regimeMatch[1].trim()
    regime = regime.replace(/^[\*\s]+/, '').trim()
    if (regime.length > 1) titulaire.regime_matrimonial = regime
  }

  // ═══ TABLE 3: ENFANTS ═══
  const enfantsTable = findTable(tables, /ENFANTS|PERSONNES.*CHARGE/i)
  if (enfantsTable) {
    const childTexts: string[] = []
    for (const row of enfantsTable) {
      if (/ENFANTS|PERSONNES.*CHARGE/i.test(row[0])) continue
      const text = row.join(' ').trim()
      if (text) childTexts.push(text)
    }
    if (childTexts.length > 0) {
      // Count children from text
      const countMatch = childTexts.join(' ').match(/(\d+)\s*enfants?/i)
      if (countMatch) titulaire.nombre_enfants = parseInt(countMatch[1], 10)
      titulaire.enfants_details = childTexts.join(', ')
    }
  }

  // ═══ TABLE 4: SITUATION PROFESSIONNELLE ═══
  const profTable = findTable(tables, /SITUATION PROFESSIONNELLE/i) || findTable(tables, /^Profession$/i)
  if (profTable) {
    titulaire.profession = getRowValue(profTable, /^Profession$/i, 1)
    conjoint.profession = getRowValue(profTable, /^Profession$/i, 2)

    titulaire.statut_professionnel = getRowValue(profTable, /^Statut$/i, 1)
    conjoint.statut_professionnel = getRowValue(profTable, /^Statut$/i, 2)

    titulaire.date_debut_emploi = getRowValue(profTable, /^Depuis$/i, 1)
    conjoint.date_debut_emploi = getRowValue(profTable, /^Depuis$/i, 2)

    titulaire.employeur = getRowValue(profTable, /^Employeur$/i, 1)
    conjoint.employeur = getRowValue(profTable, /^Employeur$/i, 2)
  }

  // ═══ TABLE 5: FLUX / REVENUS ═══
  // In some formats, FLUX is part of the same table as SITUATION PROFESSIONNELLE
  const fluxTable = findTable(tables, /^FLUX$/i) || findTable(tables, /Revenus professionnels/i)
  if (fluxTable) {
    const revPro1 = getRowValue(fluxTable, /revenus?\s*professionnels?/i, 1)
    const revPro2 = getRowValue(fluxTable, /revenus?\s*professionnels?/i, 2)
    if (revPro1) titulaire.revenus_pro_net = parseNumber(revPro1)
    if (revPro2) conjoint.revenus_pro_net = parseNumber(revPro2)

    const revFonc1 = getRowValue(fluxTable, /revenus?\s*fonciers?/i, 1)
    const revFonc2 = getRowValue(fluxTable, /revenus?\s*fonciers?/i, 2)
    if (revFonc1) titulaire.revenus_fonciers = parseNumber(revFonc1)
    if (revFonc2) conjoint.revenus_fonciers = parseNumber(revFonc2)

    const autres1 = getRowValue(fluxTable, /autres?\s*revenus?/i, 1)
    if (autres1) titulaire.autres_revenus = parseNumber(autres1)

    // Total revenus — formats: "36 000 €/ mois" + "433 000 €/ an" or "433 000 C/ an"
    const totalRow = fluxTable.find(r => /TOTAL\s*REVENUS/i.test(r[0]))
    if (totalRow) {
      const totalText = totalRow.slice(1).join(' ')
      // Look for annual amount: "433 000 €/ an" or "433 000C/ an" or "325000/ an"
      const annualMatch = totalText.match(/([\d\s.,]+)\s*[€C]?\s*\/?\s*an/i)
      if (annualMatch) {
        titulaire.total_revenus_annuel = parseNumber(annualMatch[1].replace(/\s/g, ''))
      }
    }
  }

  // ═══ TABLE 6: IMMOBILIER D'USAGE ═══
  // Columns: Désignation | Date d'acquisition | Valeur d'acquisition | Valeur actuelle | (Détention) | CRD | Charges
  // Identified by having BOTH "Valeur d'acquisition" AND "Valeur actuelle" in the header
  const immoTable = findTableByHeaders(tables, [/valeur.*acqui/i, /valeur.*actuelle/i])
    || findTable(tables, /IMMOBILIER/i)
  if (immoTable) {
    const patrimoine: KYCData['patrimoine_immobilier'] = []
    // Find header row to determine column order
    const headerIdx = immoTable.findIndex(r => r.some(c => /d[ée]signation/i.test(c)))
    const headers = headerIdx >= 0 ? immoTable[headerIdx] : []

    // Find column indices
    const dateCol = headers.findIndex(h => /date/i.test(h))
    const valAcqCol = headers.findIndex(h => /valeur.*acqui/i.test(h))
    const valActCol = headers.findIndex(h => /valeur.*actuelle/i.test(h))
    const detentionCol = headers.findIndex(h => /d[ée]tention/i.test(h))
    const crdCol = headers.findIndex(h => /^CRD$/i.test(h))
    const chargesCol = headers.findIndex(h => /charges/i.test(h))

    for (let i = (headerIdx >= 0 ? headerIdx + 1 : 1); i < immoTable.length; i++) {
      const row = immoTable[i]
      const firstCell = row[0]?.trim() || ''
      if (/^TOTAL$/i.test(firstCell)) continue
      if (!firstCell) continue
      // Skip section titles that leaked into the table
      if (/PRODUITS FINANCIERS|BANCAIRES|ASSURANCE|DIVERS/i.test(firstCell)) continue

      patrimoine.push({
        designation: firstCell || null,
        date_acquisition: dateCol >= 0 ? row[dateCol]?.trim() || null : null,
        valeur_acquisition: valAcqCol >= 0 ? parseNumber(row[valAcqCol]) : null,
        valeur_actuelle: valActCol >= 0 ? parseNumber(row[valActCol]) : null,
        detention: detentionCol >= 0 ? row[detentionCol]?.trim() || null : null,
        crd: crdCol >= 0 ? parseNumber(row[crdCol]) : null,
        charges: chargesCol >= 0 ? parseNumber(row[chargesCol]) : null,
      })
    }
    if (patrimoine.length > 0) titulaire.patrimoine_immobilier = patrimoine
  }

  // ═══ TABLE 7: PRODUITS FINANCIERS ═══
  // Columns: Désignation | Détenteur | Valeur | Date d'ouverture | Versements réguliers | Rendement
  // Identified by having "Détenteur" AND "Rendement" in header.
  // NOTE: In some docx formats, the header row is in one table and data rows in the NEXT table.
  let prodTable = findTableByHeaders(tables, [/d[ée]tenteur/i, /rendement/i])
    || findTable(tables, /PRODUITS FINANCIERS/i)
  if (prodTable) {
    const produits: KYCData['produits_financiers'] = []
    let headerIdx = prodTable.findIndex(r => r.some(c => /d[ée]signation/i.test(c)))
    let headers = headerIdx >= 0 ? prodTable[headerIdx] : []
    let dataRows: string[][] = []

    if (headerIdx >= 0 && headerIdx === prodTable.length - 1) {
      // Header is the last (or only) row — data is in the NEXT table
      const prodTableIdx = tables.indexOf(prodTable)
      if (prodTableIdx >= 0 && prodTableIdx + 1 < tables.length) {
        dataRows = tables[prodTableIdx + 1]
      }
    } else {
      // Data rows are in the same table after the header
      dataRows = headerIdx >= 0 ? prodTable.slice(headerIdx + 1) : prodTable.slice(1)
    }

    // If we still don't have headers, assume standard column order
    if (headers.length === 0) {
      headers = ['Désignation', 'Détenteur', 'Valeur', 'Date d\'ouverture', 'Versements réguliers', 'Rendement']
    }

    const detCol = headers.findIndex(h => /d[ée]tenteur/i.test(h))
    const valCol = headers.findIndex(h => /valeur/i.test(h))
    const dateCol = headers.findIndex(h => /date/i.test(h))
    const versCol = headers.findIndex(h => /versements?/i.test(h))
    const rendCol = headers.findIndex(h => /rendement/i.test(h))

    for (const row of dataRows) {
      if (/^TOTAL$/i.test(row[0]?.trim())) continue
      if (!row[0]?.trim()) continue
      // Skip rows that are just a header from a split table
      if (row.some(c => /d[ée]signation/i.test(c))) continue

      produits.push({
        designation: row[0]?.trim() || null,
        detenteur: detCol >= 0 ? row[detCol]?.trim() || null : null,
        valeur: valCol >= 0 ? parseNumber(row[valCol]) : null,
        date_ouverture: dateCol >= 0 ? row[dateCol]?.trim() || null : null,
        versements_reguliers: versCol >= 0 ? parseNumber(row[versCol]) : null,
        rendement: rendCol >= 0 ? parseNumber(row[rendCol]) : null,
      })
    }
    if (produits.length > 0) titulaire.produits_financiers = produits
  }

  // ═══ TABLE 8: EMPRUNTS ET CHARGES ═══
  // Columns: Désignation | Date souscription | Durée | Taux | Montant emprunté | CRD | Montant échéance | (ADI)
  // Identified by having "Taux" AND "CRD" AND "Durée" in header
  const empTable = findTableByHeaders(tables, [/taux/i, /CRD/i])
    || findTable(tables, /EMPRUNTS/i)
  if (empTable) {
    const emprunts: KYCData['emprunts'] = []
    const headerIdx = empTable.findIndex(r => r.some(c => /d[ée]signation/i.test(c)))
    const headers = headerIdx >= 0 ? empTable[headerIdx] : []

    const dateCol = headers.findIndex(h => /date|souscription/i.test(h))
    const dureeCol = headers.findIndex(h => /dur[ée]e/i.test(h))
    const tauxCol = headers.findIndex(h => /taux/i.test(h))
    const montantCol = headers.findIndex(h => /montant.*emprunt/i.test(h))
    const crdCol = headers.findIndex(h => /^CRD$/i.test(h))
    const echeanceCol = headers.findIndex(h => /[ée]ch[ée]ance/i.test(h))

    for (let i = (headerIdx >= 0 ? headerIdx + 1 : 1); i < empTable.length; i++) {
      const row = empTable[i]
      if (/^TOTAL$/i.test(row[0]?.trim())) continue
      if (!row[0]?.trim()) continue

      emprunts.push({
        designation: row[0]?.trim() || null,
        etablissement: null, // Some KYC formats have this, some don't
        montant_emprunte: montantCol >= 0 ? parseNumber(row[montantCol]) : null,
        date_souscription: dateCol >= 0 ? row[dateCol]?.trim() || null : null,
        duree: dureeCol >= 0 ? (parseInt(row[dureeCol], 10) || null) : null,
        taux: tauxCol >= 0 ? parseFloat((row[tauxCol] || '').replace('%', '').replace(',', '.').trim()) || null : null,
        crd: crdCol >= 0 ? parseNumber(row[crdCol]) : null,
        echeance: echeanceCol >= 0 ? parseNumber(row[echeanceCol]) : null,
      })
    }
    if (emprunts.length > 0) titulaire.emprunts = emprunts
  }

  // ═══ FISCALITÉ ═══
  const fiscMatch = fullText.match(/Imp[ôo]t sur (?:le )?revenu\s*:?\s*(.*?)(?:OBJECTIFS|---TABLE---)/is)
  if (fiscMatch) {
    const fiscText = fiscMatch[1]
    const nMatch = fiscText.match(/N\s*(?:\([^)]*\))?\s*:?\s*;?\s*([\d\s.,]+k?€?)/i)
    if (nMatch) titulaire.impot_revenu_n = parseNumber(nMatch[1].replace(/\s/g, ''))

    const n1Match = fiscText.match(/N\s*-\s*1\s*:?\s*;?\s*([\d\s.,]+k?€?)/i)
    if (n1Match) titulaire.impot_revenu_n1 = parseNumber(n1Match[1].replace(/\s/g, ''))

    const n2Match = fiscText.match(/N\s*-?\s*2\s*:?\s*;?\s*([\d\s.,]+k?€?)/i)
    if (n2Match) titulaire.impot_revenu_n2 = parseNumber(n2Match[1].replace(/\s/g, ''))
  }

  // ═══ OBJECTIFS CLIENT ═══
  const objMatch = fullText.match(/Objectifs?\s*principaux?\s*:?\s*([^.]*(?:\.[^.]*){0,3})/i)
  if (objMatch) {
    let obj = objMatch[1].trim()
    // Clean up any remaining markers
    obj = obj.replace(/---TABLE---.*/, '').replace(/AVERTISSEMENT.*/, '').trim()
    if (obj.length > 3) titulaire.objectifs_client = obj
  }

  // ═══ DATE SIGNATURE ═══
  const sigMatch = fullText.match(/(?:Sign[ée]\s+[àa]|Fait\s+[àa]|le)\s+.*?(\d{1,2}\/\d{1,2}\/\d{4})/i)
  if (sigMatch) {
    titulaire.kyc_date_signature = parseDate(sigMatch[1])
  }

  return { titulaire, conjoint }
}


/**
 * POST handler for KYC file parsing (PDF or DOCX)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = (file.name || '').toLowerCase()

    // Detect file type by extension, MIME type, OR magic bytes
    // Magic bytes: PDF starts with "%PDF" (25504446), DOCX/ZIP starts with "PK" (504B)
    const isPKZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B
    const isPdfMagic = buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46

    const isDocx = fileName.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      (isPKZip && !fileName.endsWith('.pdf'))
    const isPdf = fileName.endsWith('.pdf') || file.type === 'application/pdf' || isPdfMagic

    if (!isDocx && !isPdf) {
      return NextResponse.json(
        { error: 'Le fichier doit être un PDF ou un document Word (.docx)' },
        { status: 400 }
      )
    }

    let parsed: ParsedKYC

    if (isDocx && !isPdfMagic) {
      // ═══ DOCX PARSING (preferred — structured tables) ═══
      if (!mammoth) {
        return NextResponse.json(
          { error: 'Le module de traitement Word n\'est pas disponible.' },
          { status: 500 }
        )
      }

      try {
        const result = await mammoth.convertToHtml({ buffer })
        const html = result.value || ''

        if (!html || html.trim().length === 0) {
          return NextResponse.json(
            { error: 'Impossible d\'extraire le contenu du fichier Word' },
            { status: 400 }
          )
        }

        parsed = parseKYCDocx(html)
      } catch (docxErr) {
        console.error('mammoth error:', docxErr)
        return NextResponse.json(
          { error: 'Erreur lors du traitement du fichier Word' },
          { status: 500 }
        )
      }
    } else {
      // ═══ PDF PARSING (fallback — text extraction with heuristics) ═══
      if (!pdfParse) {
        return NextResponse.json(
          { error: 'Le module de traitement PDF n\'est pas disponible.' },
          { status: 500 }
        )
      }

      try {
        const data = await pdfParse(buffer)
        const pdfText = data.text || ''

        if (!pdfText || pdfText.trim().length === 0) {
          return NextResponse.json(
            { error: 'Impossible d\'extraire le texte du PDF' },
            { status: 400 }
          )
        }

        parsed = parseKYCText(pdfText)
      } catch (parseErr) {
        console.error('pdf-parse error:', parseErr)
        return NextResponse.json(
          { error: 'Erreur lors du traitement du PDF' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(parsed, { status: 200 })
  } catch (error) {
    console.error('KYC parse error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors du traitement du KYC' },
      { status: 500 }
    )
  }
}
