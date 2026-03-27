#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

// Configuration
const EXCEL_FILE =
  "/sessions/wonderful-zen-hypatia/mnt/.projects/019d297c-190d-7091-b8c7-3e10bda319c2/files/019d297f-5965-77c1-afcc-29ba7a82d885.xlsx";

const CONSULTANTS_SHEETS: Record<string, string> = {
  "Stéphane - Finalisée": "Stéphane",
  "Stéphane - En cours": "Stéphane",
  "POOL - Finalisée": "POOL",
  "POOL - En cours": "POOL",
  "Maxine - Finalisée": "Maxine",
  "Maxine - En cours": "Maxine",
  "Thélo - Finalisée": "Thélo",
  "Thélo - En cours": "Thélo",
  "Mathias - Finalisée": "Mathias",
  "Mathias - En cours": "Mathias",
  "Guillaume - Finalisée": "Guillaume",
  "Guillaume - En cours": "Guillaume",
  "James - Finalisée": "James",
  "James - En cours": "James",
  "Hugues - Finalisée": "Hugues",
  "Hugues - En cours": "Hugues",
  "Gilles - Finalisée": "Gilles",
  "Gilles - En cours": "Gilles",
  "Valentin - Finalisée": "Valentin",
  "Valentin - En cours": "Valentin",
  "Sylvain - Finalisée": "Sylvain",
};

interface DossierData {
  nom: string;
  prenom?: string;
  montant: number;
  produit?: string;
  compagnie?: string;
  financement: string;
  commentaire?: string;
  date?: string;
  pays: string;
  is_finalisee: boolean;
}

interface ImportStats {
  clients_created: number;
  dossiers_created: number;
  errors: string[];
}

class DeltaImporter {
  private supabase: any;
  private wb: any;
  private consultants: Map<string, string> = new Map();
  private produits: Map<string, string> = new Map();
  private compagnies: Map<string, string> = new Map();
  private clientsCache: Map<string, string> = new Map();
  private stats: ImportStats = {
    clients_created: 0,
    dossiers_created: 0,
    errors: [],
  };

  async connectSupabase(): Promise<boolean> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error(
        "ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
      );
      return false;
    }

    this.supabase = createClient(url, key);
    console.log(`Connected to Supabase: ${url}`);
    return true;
  }

  loadExcel(): boolean {
    if (!fs.existsSync(EXCEL_FILE)) {
      console.error(`ERROR: Excel file not found: ${EXCEL_FILE}`);
      return false;
    }

    const buffer = fs.readFileSync(EXCEL_FILE);
    this.wb = XLSX.read(buffer, { cellDates: true });
    console.log(`Loaded Excel file: ${EXCEL_FILE}`);
    console.log(`Available sheets: ${this.wb.SheetNames.length}`);
    return true;
  }

  async loadReferenceData(): Promise<boolean> {
    try {
      // Load consultants
      let result = await this.supabase
        .from("consultants")
        .select("id, nom, prenom");

      if (result.error) throw result.error;

      for (const row of result.data) {
        this.consultants.set(row.nom, row.id);
      }
      console.log(`Loaded ${this.consultants.size} consultants`);

      // Load produits
      result = await this.supabase.from("produits").select("id, nom");

      if (result.error) throw result.error;

      for (const row of result.data) {
        this.produits.set(row.nom, row.id);
      }
      console.log(`Loaded ${this.produits.size} produits`);

      // Load compagnies
      result = await this.supabase.from("compagnies").select("id, nom");

      if (result.error) throw result.error;

      for (const row of result.data) {
        this.compagnies.set(row.nom, row.id);
      }
      console.log(`Loaded ${this.compagnies.size} compagnies`);

      return true;
    } catch (e) {
      console.error(`ERROR loading reference data: ${e}`);
      return false;
    }
  }

  private parseMontant(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      try {
        return parseFloat(value.replace(",", "."));
      } catch {
        return 0;
      }
    }
    return 0;
  }

  private parseDate(value: any): string | null {
    if (!value) return null;

    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }

    if (typeof value === "string") {
      const dateFormats = [
        /(\d{4})-(\d{2})-(\d{2})/,
        /(\d{2})\/(\d{2})\/(\d{4})/,
      ];

      for (const format of dateFormats) {
        const match = value.match(format);
        if (match) return new Date(value).toISOString().split("T")[0];
      }
    }

    return null;
  }

  private normalizeCompagnie(compagnie: string): string | null {
    if (!compagnie) return null;

    compagnie = String(compagnie).trim();

    // Extract base compagnie name (before dash)
    if (compagnie.includes(" - ")) {
      compagnie = compagnie.split(" - ")[1].trim();
    }

    return compagnie || null;
  }

  async findOrCreateClient(
    nom: string,
    prenom: string,
    pays: string = "FRANCE"
  ): Promise<string | null> {
    if (!nom) return null;

    nom = String(nom).trim();
    prenom = String(prenom || "").trim();
    pays = String(pays || "FRANCE").trim();

    const cacheKey = `${nom}|${prenom}`;
    if (this.clientsCache.has(cacheKey)) {
      return this.clientsCache.get(cacheKey) || null;
    }

    try {
      // Try to find existing client
      let result = await this.supabase
        .from("clients")
        .select("id")
        .eq("nom", nom)
        .eq("prenom", prenom);

      if (result.error) throw result.error;

      if (result.data && result.data.length > 0) {
        const clientId = result.data[0].id;
        this.clientsCache.set(cacheKey, clientId);
        return clientId;
      }

      // Create new client
      result = await this.supabase.from("clients").insert([
        {
          nom,
          prenom,
          pays,
          statut_kyc: "non",
        },
      ]);

      if (result.error) throw result.error;

      if (result.data && result.data.length > 0) {
        const clientId = result.data[0].id;
        this.clientsCache.set(cacheKey, clientId);
        this.stats.clients_created++;
        return clientId;
      }

      return null;
    } catch (e) {
      const error = `Error creating client ${nom} ${prenom}: ${e}`;
      this.stats.errors.push(error);
      console.log(`  WARNING: ${error}`);
      return null;
    }
  }

  async findOrCreateProduit(nom: string): Promise<string | null> {
    if (!nom) return null;

    nom = String(nom).trim();

    if (this.produits.has(nom)) {
      return this.produits.get(nom) || null;
    }

    try {
      const result = await this.supabase.from("produits").insert([
        {
          nom,
          categorie: "autre",
        },
      ]);

      if (result.error) throw result.error;

      if (result.data && result.data.length > 0) {
        const produitId = result.data[0].id;
        this.produits.set(nom, produitId);
        return produitId;
      }

      return null;
    } catch (e) {
      console.log(`  WARNING: Error creating produit ${nom}: ${e}`);
      return null;
    }
  }

  async findOrCreateCompagnie(nom: string): Promise<string | null> {
    if (!nom) return null;

    nom = String(nom).trim();

    if (this.compagnies.has(nom)) {
      return this.compagnies.get(nom) || null;
    }

    try {
      const result = await this.supabase.from("compagnies").insert([
        {
          nom,
          taux_defaut: 0.0,
        },
      ]);

      if (result.error) throw result.error;

      if (result.data && result.data.length > 0) {
        const compagnieId = result.data[0].id;
        this.compagnies.set(nom, compagnieId);
        return compagnieId;
      }

      return null;
    } catch (e) {
      console.log(`  WARNING: Error creating compagnie ${nom}: ${e}`);
      return null;
    }
  }

  parseSheet(sheetName: string, isFinalisee: boolean): DossierData[] {
    const ws = this.wb.Sheets[sheetName];
    const dossiers: DossierData[] = [];

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (rows.length < 3) {
      console.log(`  WARNING: Not enough rows in ${sheetName}`);
      return dossiers;
    }

    // Headers are in row 2 (index 1)
    const headers = rows[1] as string[];
    const headerMap: Record<string, number> = {};

    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || "").trim().toUpperCase();
      if (header) {
        headerMap[header] = i;
      }
    }

    const colNom = headerMap["NOM"];
    const colPrenom = headerMap["PRENOM"];
    const colProduit = headerMap["PRODUIT"];
    const colCompagnie = headerMap["COMPAGNIE"];
    const colMontant = headerMap["MONTANT"];
    const colFinancement = headerMap["FINANCEMENT"];
    const colCommentaire = headerMap["COMMENTAIRE"];
    const colDate = headerMap["DATE"];
    const colPays = headerMap["PAYS"];

    if (colNom === undefined || colMontant === undefined) {
      console.log(`  WARNING: Missing required columns in ${sheetName}`);
      return dossiers;
    }

    // Parse data rows (starting from row 3, index 2)
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i] as any[];
      if (!row) continue;

      const nom = String(row[colNom] || "").trim();
      if (!nom) continue;

      const montant = this.parseMontant(row[colMontant]);
      if (montant === 0) continue;

      const dossier: DossierData = {
        nom,
        prenom: String(row[colPrenom] || "").trim(),
        montant,
        financement: String(row[colFinancement] || "cash").toLowerCase(),
        pays: String(row[colPays] || "FRANCE").toUpperCase(),
        is_finalisee: isFinalisee,
      };

      if (colProduit !== undefined) {
        const produit = row[colProduit];
        dossier.produit = produit ? String(produit).trim() : undefined;
      }

      if (colCompagnie !== undefined) {
        const compagnie = row[colCompagnie];
        dossier.compagnie = this.normalizeCompagnie(compagnie) || undefined;
      }

      if (colCommentaire !== undefined) {
        const commentaire = row[colCommentaire];
        dossier.commentaire = commentaire
          ? String(commentaire).trim()
          : undefined;
      }

      if (colDate !== undefined) {
        const date = this.parseDate(row[colDate]);
        dossier.date = date || undefined;
      }

      dossiers.push(dossier);
    }

    return dossiers;
  }

  async importDossier(
    sheetName: string,
    consultantName: string,
    dossier: DossierData
  ): Promise<boolean> {
    try {
      // Get consultant ID
      const consultantId = this.consultants.get(consultantName);
      if (!consultantId) {
        this.stats.errors.push(`Consultant not found: ${consultantName}`);
        return false;
      }

      // Find or create client
      const clientId = await this.findOrCreateClient(
        dossier.nom,
        dossier.prenom,
        dossier.pays
      );
      if (!clientId) {
        this.stats.errors.push(`Failed to create client: ${dossier.nom}`);
        return false;
      }

      // Find or create produit
      let produitId: string | null = null;
      if (dossier.produit) {
        produitId = await this.findOrCreateProduit(dossier.produit);
      }

      // Find or create compagnie
      let compagnieId: string | null = null;
      if (dossier.compagnie) {
        compagnieId = await this.findOrCreateCompagnie(dossier.compagnie);
      }

      // Normalize financement
      let financement = dossier.financement.toLowerCase();
      if (!["cash", "credit", "lombard", "remploi"].includes(financement)) {
        financement = "cash";
      }

      // Determine statut
      const statut = dossier.is_finalisee
        ? "client_finalise"
        : "client_en_cours";

      // Insert dossier
      const result = await this.supabase.from("dossiers").insert([
        {
          client_id: clientId,
          consultant_id: consultantId,
          produit_id: produitId,
          compagnie_id: compagnieId,
          montant: dossier.montant,
          financement,
          statut,
          commentaire: dossier.commentaire,
          date_operation: dossier.date || new Date().toISOString().split("T")[0],
        },
      ]);

      if (result.error) throw result.error;

      if (result.data && result.data.length > 0) {
        this.stats.dossiers_created++;
        return true;
      }

      return false;
    } catch (e) {
      const error = `Error importing dossier for ${dossier.nom}: ${e}`;
      this.stats.errors.push(error);
      console.log(`  WARNING: ${error}`);
      return false;
    }
  }

  async run(): Promise<boolean> {
    console.log("\n=== DELTA 2026 Excel to Supabase Import ===\n");

    // Connect to Supabase
    if (!(await this.connectSupabase())) {
      return false;
    }

    // Load Excel
    if (!this.loadExcel()) {
      return false;
    }

    // Load reference data
    if (!(await this.loadReferenceData())) {
      return false;
    }

    console.log("\n=== Processing Sheets ===\n");

    // Process each consultant sheet
    for (const [sheetName, consultantName] of Object.entries(
      CONSULTANTS_SHEETS
    )) {
      if (!this.wb.SheetNames.includes(sheetName)) {
        console.log(`SKIP: Sheet not found: ${sheetName}`);
        continue;
      }

      const isFinalisee = sheetName.includes("Finalisée");

      console.log(`Processing ${sheetName}...`);

      const dossiers = this.parseSheet(sheetName, isFinalisee);
      console.log(`  Found ${dossiers.length} dossiers`);

      for (const dossier of dossiers) {
        await this.importDossier(sheetName, consultantName, dossier);
      }
    }

    // Print summary
    this.printSummary();
    return true;
  }

  private printSummary(): void {
    console.log("\n=== Import Summary ===\n");
    console.log(`Clients created: ${this.stats.clients_created}`);
    console.log(`Dossiers created: ${this.stats.dossiers_created}`);
    console.log(`Errors: ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      console.log("\nErrors encountered:");
      for (let i = 0; i < Math.min(10, this.stats.errors.length); i++) {
        console.log(`  - ${this.stats.errors[i]}`);
      }
      if (this.stats.errors.length > 10) {
        console.log(
          `  ... and ${this.stats.errors.length - 10} more errors`
        );
      }
    }
  }
}

async function main() {
  const importer = new DeltaImporter();
  const success = await importer.run();
  process.exit(success ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
