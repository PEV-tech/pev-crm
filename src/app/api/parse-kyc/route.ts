import { NextRequest, NextResponse } from 'next/server'

// Dynamic import to handle pdf-parse in Node.js environment
let pdfParse: any

try {
  pdfParse = require('pdf-parse')
} catch {
  pdfParse = null
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

  let normalized = trimmed
    .replace(/€|EUR/gi, '')
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

/**
 * POST handler for KYC PDF parsing
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

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Le fichier doit être un PDF' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let pdfText = ''

    if (pdfParse) {
      try {
        const data = await pdfParse(buffer)
        pdfText = data.text || ''
      } catch (parseErr) {
        console.error('pdf-parse error:', parseErr)
        return NextResponse.json(
          { error: 'Erreur lors du traitement du PDF' },
          { status: 500 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'Le module de traitement PDF n\'est pas disponible.' },
        { status: 500 }
      )
    }

    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Impossible d\'extraire le texte du PDF' },
        { status: 400 }
      )
    }

    const parsed = parseKYCText(pdfText)

    return NextResponse.json(parsed, { status: 200 })
  } catch (error) {
    console.error('KYC parse error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur lors du traitement du KYC' },
      { status: 500 }
    )
  }
}
