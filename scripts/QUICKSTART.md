# Quick Start Guide

## 30-Second Setup

```bash
cd /sessions/wonderful-zen-hypatia/mnt/CRM/pev-crm/scripts

# Set your Supabase credentials
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-key-here"

# Run the import
python3 import-delta-2026.py
```

## What It Does

Imports 338 dossiers from DELTA 2026 Excel file into Supabase:
- 62 finalized dossiers (client_finalise)
- 276 in-progress dossiers (client_en_cours)
- From 11 consultants across 22 sheets
- Creates clients, products, and companies as needed

## Expected Output

```
=== DELTA 2026 Excel to Supabase Import ===

Connected to Supabase: https://...
Loaded Excel file: ...
Loaded 11 consultants
Loaded 10 produits
Loaded 13 compagnies

=== Processing Sheets ===

Processing Stéphane - Finalisée...
  Found 17 dossiers
[... more sheets ...]

=== Import Summary ===

Clients created: ~150-200
Dossiers created: 338
Errors: 0
```

## Prerequisites

### Python Version (Recommended)
```bash
pip install openpyxl supabase-py
python3 import-delta-2026.py
```

### TypeScript Version
```bash
npm install xlsx @supabase/supabase-js
npx ts-node import-delta-2026.ts
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing SUPABASE_URL" | Set environment variables: `export SUPABASE_URL="..."`  |
| "Excel file not found" | File path is hardcoded in script |
| "Consultant not found" | Verify consultants exist in database |
| "openpyxl not found" | Run: `pip install openpyxl supabase-py` |

## Full Documentation

- **README.md** - Complete guide with configuration options
- **IMPLEMENTATION_NOTES.md** - Architecture, schema mapping, performance notes

## Files

- `import-delta-2026.py` - Python import script (primary)
- `import-delta-2026.ts` - TypeScript import script (alternative)
- `README.md` - Full documentation
- `IMPLEMENTATION_NOTES.md` - Technical details
- `QUICKSTART.md` - This file

## Data Being Imported

| Consultant | Finalisée | En cours | Total |
|-----------|-----------|----------|-------|
| Stéphane  | 17        | 94       | 111   |
| POOL      | 19        | 14       | 33    |
| Maxine    | 7         | 20       | 27    |
| Thélo     | 1         | 11       | 12    |
| Mathias   | 4         | 17       | 21    |
| Guillaume | 2         | 39       | 41    |
| James     | 4         | 11       | 15    |
| Hugues    | 8         | 35       | 43    |
| Gilles    | 0         | 16       | 16    |
| Valentin  | 0         | 19       | 19    |
| Sylvain   | 0         | 0        | 0     |
| **TOTAL** | **62**    | **276**  | **338** |

## Important

- **Not idempotent**: Running twice creates duplicates. Backup data first.
- **Client matching**: By (nom, prenom) - ensure names are consistent
- **Consultant lookup**: By first name - must match database exactly
- **Expected runtime**: 2-3 minutes for 338 dossiers

Need help? See README.md or IMPLEMENTATION_NOTES.md
