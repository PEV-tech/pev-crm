# DELTA 2026 Import Script

This directory contains scripts to migrate data from the DELTA 2026 Excel file into the PEV CRM Supabase database.

## Files

- `import-delta-2026.py` - Python import script (recommended/primary)
- `import-delta-2026.ts` - TypeScript import script (alternative)
- `README.md` - This file

## Prerequisites

### Python Version (Recommended)

You'll need Python 3.8+ with the following packages:

```bash
pip install openpyxl supabase-py python-dotenv
```

### TypeScript Version

You'll need Node.js 18+ with:

```bash
npm install xlsx @supabase/supabase-js dotenv
```

## Configuration

Both scripts require Supabase credentials via environment variables:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

Alternatively, create a `.env` file in this directory:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Running the Import

### Python (Recommended)

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the import
python3 import-delta-2026.py
```

Or with `.env` file:

```bash
# The script will read from .env automatically
python3 import-delta-2026.py
```

### TypeScript

```bash
# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Install dependencies
npm install

# Run the import
npx ts-node import-delta-2026.ts
```

## What It Does

The import script processes the DELTA 2026 Excel file and:

1. **Reads consultant sheets**: Processes both "Finalisée" (finalized) and "En cours" (in progress) sheets for all consultants:
   - Stéphane, POOL, Maxine, Thélo, Mathias, Guillaume, James, Hugues, Gilles, Valentin, Sylvain

2. **Parses dossier data**: Extracts from each sheet:
   - Client: NOM, PRENOM
   - Dossier: PRODUIT, COMPAGNIE, MONTANT, FINANCEMENT, COMMENTAIRE, DATE, PAYS
   - Status: "Finalisée" sheets → `client_finalise`, "En cours" sheets → `client_en_cours`

3. **Creates/updates data in Supabase**:
   - **Clients**: Creates clients (nom + prenom) if they don't exist
   - **Produits**: Creates product types if they don't exist
   - **Compagnies**: Creates companies if they don't exist (normalizes from "PRODUIT - COMPAGNIE" format)
   - **Dossiers**: Creates dossier records linked to clients, consultants, products, and companies

4. **Maps data correctly**:
   - Normalizes company names (extracts from "PRODUIT - COMPAGNIE" format)
   - Validates financement values (cash, credit, lombard, remploi)
   - Parses dates and amounts
   - Uses FRANCE as default country if not specified

5. **Outputs summary**: Reports number of:
   - Clients created
   - Dossiers imported
   - Errors encountered

## Data Mapping

### Column Headers (Row 2)

Expected headers in each consultant sheet:
- `NOM` - Client last name
- `PRENOM` - Client first name
- `PRODUIT` - Product name (SCPI, PE, CAV LUX, etc.)
- `COMPAGNIE` - Company name (often in "PRODUIT - COMPAGNIE" format)
- `MONTANT` - Investment amount
- `FINANCEMENT` - Financing type (Cash, Credit, Lombard, Remploi)
- `COMMENTAIRE` - Comments
- `DATE` - Operation date
- `PAYS` - Country (defaults to FRANCE)

### Sheet Naming Convention

- Consultant sheets must follow pattern: `{ConsultantName} - Finalisée` or `{ConsultantName} - En cours`
- Supported consultant names: Stéphane, Maxine, Thélo, Mathias, Guillaume, James, Hugues, Gilles, Valentin, Sylvain, POOL

### Financement Normalization

- Script accepts: Cash, Credit, Lombard, Remploi (case-insensitive)
- Invalid values default to "cash"

## Error Handling

The script continues processing even if individual dossiers fail. All errors are:
- Logged to console with WARNING prefix
- Collected in the final summary

Common errors:
- `Consultant not found` - Consultant name doesn't match database
- `Failed to create client` - Issue creating client record
- Missing required columns - Headers don't match expected format

## Database Schema

The script creates records in:

- **consultants** - Linked by name (e.g., "Stéphane")
- **clients** - Created from NOM, PRENOM, PAYS
- **produits** - Created from PRODUIT column
- **compagnies** - Created from normalized COMPAGNIE column
- **dossiers** - Main transaction record with:
  - `client_id` - Links to client
  - `consultant_id` - Links to consultant
  - `produit_id` - Links to product
  - `compagnie_id` - Links to company
  - `montant` - Investment amount
  - `financement` - Financing type
  - `statut` - client_finalise or client_en_cours
  - `commentaire` - Optional comment
  - `date_operation` - Operation date

## Example Output

```
=== DELTA 2026 Excel to Supabase Import ===

Connected to Supabase: https://your-project.supabase.co
Loaded Excel file: /path/to/excel/file.xlsx
Loaded 11 consultants
Loaded 10 produits
Loaded 13 compagnies

=== Processing Sheets ===

Processing Stéphane - Finalisée...
  Found 17 dossiers
Processing POOL - Finalisée...
  Found 45 dossiers
...

=== Import Summary ===

Clients created: 156
Dossiers created: 312
Errors: 2
```

## Troubleshooting

### "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"

Make sure environment variables are set:

```bash
export SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"
```

### "Excel file not found"

Ensure the Excel file path is correct in the script. Default path:
`/sessions/wonderful-zen-hypatia/mnt/.projects/019d297c-190d-7091-b8c7-3e10bda319c2/files/019d297f-5965-77c1-afcc-29ba7a82d885.xlsx`

### "Consultant not found"

The script looks up consultants by first name (nom column). Ensure consultants are created in the database with matching names before running import.

### "No headers found" in sheet

Check that row 2 contains the expected headers. The script looks for:
- NOM, PRENOM, PRODUIT, COMPAGNIE, MONTANT, FINANCEMENT, COMMENTAIRE, DATE, PAYS

## Notes

- **Idempotency**: The script is NOT fully idempotent. Running it multiple times will create duplicate dossiers. To re-run, clean the dossiers table first.
- **Client Matching**: Clients are matched by (nom, prenom) combination. Ensure names are consistent in the Excel file.
- **Dates**: Script handles common date formats (YYYY-MM-DD, DD/MM/YYYY). Invalid dates default to current date.
- **Amounts**: Zero or empty montants are skipped.
- **Default Values**: Missing country defaults to "FRANCE", missing financement defaults to "cash".

## Development

To modify the script:

1. Python: Edit `import-delta-2026.py`
2. TypeScript: Edit `import-delta-2026.ts`, then compile with `tsc`

Both scripts share the same logic and behavior. Use Python for simplicity; TypeScript for integration with the Node.js CRM app.
