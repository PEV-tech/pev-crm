import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

// Dynamic import to handle pdf-parse in Node.js environment
let pdfParse: any

try {
  // Try to use pdf-parse if available
  pdfParse = require('pdf-parse')
} catch {
  // Fallback: if pdf-parse is not installed, we'll try pdfjs-dist
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
 * Parse a number from various formats
 * "120000" → 120000
 * "376 kEUR" → 376000
 * "200k€" → 200000
 * "98k€" → 98000
 */
function parseNumber(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // Remove common currency symbols and separators
  let normalized = trimmed
    .replace(/€|EUR|\s+/g, '')
    .replace(/,/g, '.') // Handle European decimal comma

  // Handle 'k' or 'K' suffix (thousands)
  if (/k$/i.test(normalized)) {
    const num = parseFloat(normalized.replace(/k$/i, ''))
    return isNaN(num) ? null : Math.round(num * 1000)
  }

  const num = parseFloat(normalized)
  return isNaN(num) ? null : num
}

/**
 * Parse a date in various formats
 * "04/06/1978" → "1978-06-04"
 * "1978-06-04" → "1978-06-04"
 */
function parseDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // Try DD/MM/YYYY format (French standard)
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  // Try YYYY-MM-DD format
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return trimmed
  }

  return null
}

/**
 * Extract text between two delimiters
 */
function extractBetween(
  text: string,
  startPattern: string | RegExp,
  endPattern: string | RegExp
): string | null {
  const startRegex = typeof startPattern === 'string' ? new RegExp(startPattern, 'i') : startPattern
  const endRegex = typeof endPattern === 'string' ? new RegExp(endPattern, 'i') : endPattern

  const startMatch = text.search(startRegex)
  if (startMatch === -1) return null

  const startIdx = text.indexOf('\n', startMatch) + 1
  const endMatch = text.search(endRegex)
  if (endMatch === -1 || endMatch <= startIdx) return null

  return text.substring(startIdx, endMatch).trim()
}

/**
 * Parse a table from PDF text (lines separated by newlines)
 */
function parseTable(
  text: string,
  columnCount: number
): Array<Record<string, string | null>> {
  const lines = text.split('\n').filter(l => l.trim())
  const result: Array<Record<string, string | null>> = []

  for (const line of lines) {
    // Simple heuristic: split by multiple spaces or tabs
    const cells = line.split(/\s{2,}|\t/).filter(c => c.trim())
    if (cells.length >= columnCount) {
      result.push({
        col0: cells[0] || null,
        col1: cells[1] || null,
        col2: cells[2] || null,
        col3: cells[3] || null,
        col4: cells[4] || null,
        col5: cells[5] || null,
      })
    }
  }

  return result
}

/**
 * Extract two-column values (Monsieur and Madame side by side)
 */
function extractTwoColumnValue(
  text: string,
  label: string
): { titulaire: string | null; conjoint: string | null } {
  const regex = new RegExp(`${label}[:\\s]*([^\\n]*)`, 'i')
  const match = text.match(regex)

  if (!match || !match[1]) {
    return { titulaire: null, conjoint: null }
  }

  const valueLine = match[1].trim()
  // Try to split by finding two distinct values
  const parts = valueLine.split(/\s{2,}/).filter(p => p.trim())

  if (parts.length >= 2) {
    return { titulaire: parts[0].trim(), conjoint: parts[1].trim() }
  } else if (parts.length === 1) {
    return { titulaire: parts[0].trim(), conjoint: null }
  }

  return { titulaire: null, conjoint: null }
}

/**
 * Main KYC parser
 */
function parseKYCText(pdfText: string): ParsedKYC {
  const titulaire: KYCData = { titre: 'monsieur' }
  const conjoint: KYCData = { titre: 'madame' }

  // ETAT CIVIL ET COORDONNEES
  const noms = extractTwoColumnValue(pdfText, 'Nom')
  titulaire.nom = noms.titulaire
  conjoint.nom = noms.conjoint

  const prenoms = extractTwoColumnValue(pdfText, 'Prénom')
  titulaire.prenom = prenoms.titulaire
  conjoint.prenom = prenoms.conjoint

  const nomJFille = extractTwoColumnValue(pdfText, "Nom de jeune fille|Nom d'époux")
  titulaire.nom_jeune_fille = nomJFille.titulaire || null
  conjoint.nom_jeune_fille = nomJFille.conjoint || null

  // Parse dates - look for date pattern DD/MM/YYYY
  const dateMatch = pdfText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(?:à|Lieu|\(|\d+)/g)
  if (dateMatch && dateMatch.length >= 2) {
    titulaire.date_naissance = parseDate(dateMatch[0])
    conjoint.date_naissance = parseDate(dateMatch[1])
  } else {
    const dateVals = extractTwoColumnValue(pdfText, 'Date de naissance')
    titulaire.date_naissance = parseDate(dateVals.titulaire)
    conjoint.date_naissance = parseDate(dateVals.conjoint)
  }

  // Lieu de naissance
  const lieuMatch = pdfText.match(/(?:à|Lieu de naissance)[:\s]+([^\n]*)\s+([^\n]*)(?:\n|$)/i)
  if (lieuMatch) {
    titulaire.lieu_naissance = lieuMatch[1]?.trim() || null
    conjoint.lieu_naissance = lieuMatch[2]?.trim() || null
  }

  // Nationalité
  const nat = extractTwoColumnValue(pdfText, 'Nationalité')
  titulaire.nationalite = nat.titulaire
  conjoint.nationalite = nat.conjoint

  // Résidence fiscale
  const resFiscale = extractTwoColumnValue(pdfText, 'Résidence fiscale')
  titulaire.residence_fiscale = resFiscale.titulaire
  conjoint.residence_fiscale = resFiscale.conjoint

  // NIF
  const nif = extractTwoColumnValue(pdfText, 'NIF|N° d\'identité')
  titulaire.nif = nif.titulaire
  conjoint.nif = nif.conjoint

  // Adresse
  const addrMatch = pdfText.match(/(?:Adresse|ADRESSE)[:\s]*([^\n]+(?:\n[^\n]+)?)/i)
  if (addrMatch) {
    titulaire.adresse = addrMatch[1].trim()
  }

  // Propriétaire / Locataire
  const proprio = extractTwoColumnValue(pdfText, 'Propriétaire|Locataire')
  if (proprio.titulaire) {
    const val = proprio.titulaire.toLowerCase()
    titulaire.proprietaire_locataire = val.includes('proprio') ? 'proprietaire' : 'locataire'
  }

  // Téléphone
  const tel = extractTwoColumnValue(pdfText, 'Téléphone|Phone')
  titulaire.telephone = tel.titulaire
  conjoint.telephone = tel.conjoint

  // Email
  const email = extractTwoColumnValue(pdfText, 'Email|E-mail|Mail')
  titulaire.email = email.titulaire
  conjoint.email = email.conjoint

  // SITUATION FAMILIALE
  const sitFam = extractTwoColumnValue(pdfText, 'Situation matrimoniale|Situation familiale')
  if (sitFam.titulaire) {
    const val = sitFam.titulaire.toLowerCase()
    if (val.includes('marie') || val.includes('marié')) {
      titulaire.situation_matrimoniale = 'marie'
    } else if (val.includes('celibataire')) {
      titulaire.situation_matrimoniale = 'celibataire'
    } else if (val.includes('divorce')) {
      titulaire.situation_matrimoniale = 'divorce'
    } else if (val.includes('veuf')) {
      titulaire.situation_matrimoniale = 'veuf'
    }
  }

  // Régime matrimonial
  const regime = extractTwoColumnValue(pdfText, 'Régime matrimonial')
  titulaire.regime_matrimonial = regime.titulaire

  // Nombre d'enfants
  const nbEnfants = extractTwoColumnValue(pdfText, 'Nombre d\'enfants|Enfants')
  titulaire.nombre_enfants = nbEnfants.titulaire ? parseInt(nbEnfants.titulaire, 10) || null : null

  // Détails enfants
  const enfantDetails = extractTwoColumnValue(pdfText, 'Âges|Details enfants')
  titulaire.enfants_details = enfantDetails.titulaire

  // SITUATION PROFESSIONNELLE
  const prof = extractTwoColumnValue(pdfText, 'Profession')
  titulaire.profession = prof.titulaire
  conjoint.profession = prof.conjoint

  const statut = extractTwoColumnValue(pdfText, 'Statut professionnel|Statut')
  titulaire.statut_professionnel = statut.titulaire
  conjoint.statut_professionnel = statut.conjoint

  const empl = extractTwoColumnValue(pdfText, 'Employeur|Entreprise')
  titulaire.employeur = empl.titulaire
  conjoint.employeur = empl.conjoint

  const dateEmpl = extractTwoColumnValue(pdfText, 'Date de début|Début emploi')
  titulaire.date_debut_emploi = dateEmpl.titulaire
  conjoint.date_debut_emploi = dateEmpl.conjoint

  // FLUX (Revenus)
  const revProNet = extractTwoColumnValue(pdfText, 'Revenus professionnels nets?|Revenu net')
  titulaire.revenus_pro_net = parseNumber(revProNet.titulaire)
  conjoint.revenus_pro_net = parseNumber(revProNet.conjoint)

  const revFonc = extractTwoColumnValue(pdfText, 'Revenus fonciers')
  titulaire.revenus_fonciers = parseNumber(revFonc.titulaire)
  conjoint.revenus_fonciers = parseNumber(revFonc.conjoint)

  const autRev = extractTwoColumnValue(pdfText, 'Autres revenus')
  titulaire.autres_revenus = parseNumber(autRev.titulaire)
  conjoint.autres_revenus = parseNumber(autRev.conjoint)

  const totRev = extractTwoColumnValue(pdfText, 'Total revenus annuels|Revenus totaux')
  titulaire.total_revenus_annuel = parseNumber(totRev.titulaire)

  // IMMOBILIER D'USAGE
  const immobilierSection = extractBetween(
    pdfText,
    'IMMOBILIER D\'USAGE|IMMOBILIER',
    'PRODUITS FINANCIERS|DIVERS|EMPRUNTS'
  )
  if (immobilierSection) {
    const immobLines = immobilierSection.split('\n').filter(l => l.trim())
    const patrimoine: KYCData['patrimoine_immobilier'] = []

    for (const line of immobLines) {
      // Try to parse designation and values from line
      const cells = line.split(/\s{2,}/).filter(c => c.trim())
      if (cells.length >= 2) {
        patrimoine.push({
          designation: cells[0] || null,
          date_acquisition: cells[1] || null,
          valeur_acquisition: cells[2] ? parseNumber(cells[2]) : null,
          valeur_actuelle: cells[3] ? parseNumber(cells[3]) : null,
          crd: cells[4] ? parseNumber(cells[4]) : null,
          charges: cells[5] ? parseNumber(cells[5]) : null,
        })
      }
    }
    if (patrimoine.length > 0) {
      titulaire.patrimoine_immobilier = patrimoine
    }
  }

  // PRODUITS FINANCIERS / BANCAIRES / ASSURANCE-VIE
  const prodFinSection = extractBetween(
    pdfText,
    'PRODUITS FINANCIERS|BANCAIRES|ASSURANCE-VIE',
    'DIVERS|EMPRUNTS|FISCALITE|OBJECTIFS'
  )
  if (prodFinSection) {
    const prodLines = prodFinSection.split('\n').filter(l => l.trim())
    const produits: KYCData['produits_financiers'] = []

    for (const line of prodLines) {
      const cells = line.split(/\s{2,}/).filter(c => c.trim())
      if (cells.length >= 1) {
        produits.push({
          designation: cells[0] || null,
          detenteur: cells[1] || null,
          valeur: cells[2] ? parseNumber(cells[2]) : null,
          date_ouverture: cells[3] || null,
          versements_reguliers: cells[4] ? parseNumber(cells[4]) : null,
          rendement: cells[5] ? parseNumber(cells[5]) : null,
        })
      }
    }
    if (produits.length > 0) {
      titulaire.produits_financiers = produits
    }
  }

  // EMPRUNTS ET CHARGES
  const empruntsSection = extractBetween(
    pdfText,
    'EMPRUNTS|CRÉDITS|DETTES',
    'FISCALITE|OBJECTIFS|OBSERVATIONS|$'
  )
  if (empruntsSection) {
    const empLines = empruntsSection.split('\n').filter(l => l.trim())
    const emprunts: KYCData['emprunts'] = []

    for (const line of empLines) {
      const cells = line.split(/\s{2,}/).filter(c => c.trim())
      if (cells.length >= 1) {
        emprunts.push({
          designation: cells[0] || null,
          etablissement: cells[1] || null,
          montant_emprunte: cells[2] ? parseNumber(cells[2]) : null,
          date_souscription: cells[3] || null,
          duree: cells[4] ? parseInt(cells[4], 10) || null : null,
          taux: cells[5] ? parseFloat(cells[5]) || null : null,
          crd: cells[6] ? parseNumber(cells[6]) : null,
          echeance: cells[7] ? parseNumber(cells[7]) : null,
        })
      }
    }
    if (emprunts.length > 0) {
      titulaire.emprunts = emprunts
    }
  }

  // FISCALITE
  const fiscMatch = pdfText.match(/(?:Impôt sur le revenu|IR)\s+([^\n]*)\s+([^\n]*)/i)
  if (fiscMatch) {
    titulaire.impot_revenu_n = parseNumber(fiscMatch[1])
    titulaire.impot_revenu_n1 = parseNumber(fiscMatch[2])
  }

  const fisc2 = extractTwoColumnValue(pdfText, 'Impôt année N-2')
  titulaire.impot_revenu_n2 = parseNumber(fisc2.titulaire)

  // OBJECTIFS CLIENT
  const objMatch = pdfText.match(/(?:Objectifs|Objectif client|OBJECTIFS)[:\s]*([^\n]+(?:\n[^\n]+)?)/i)
  if (objMatch) {
    titulaire.objectifs_client = objMatch[1].trim()
  }

  // KYC Date Signature
  const sigMatch = pdfText.match(/(?:Date|Signature)[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i)
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

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let pdfText = ''

    if (pdfParse) {
      // Use pdf-parse if available
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
      // Fallback: try to use pdfjs-dist via Node.js
      try {
        // This would require additional setup; for now, return error
        return NextResponse.json(
          { error: 'Le module de traitement PDF n\'est pas disponible. Veuillez installer pdf-parse.' },
          { status: 500 }
        )
      } catch (err) {
        return NextResponse.json(
          { error: 'Impossible de traiter le PDF' },
          { status: 500 }
        )
      }
    }

    if (!pdfText || pdfText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Impossible d\'extraire le texte du PDF' },
        { status: 400 }
      )
    }

    // Parse the extracted text
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
