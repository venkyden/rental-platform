-- Migration: Add Listing Compliance Fields for French Rental Law
-- Features: CC/HC charges transparency, guarantor preferences
-- Date: 2026-02-18

-- Charges transparency (CC = charges comprises, HC = hors charges)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS charges_included BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS charges_description TEXT;

-- Guarantor preferences
ALTER TABLE properties ADD COLUMN IF NOT EXISTS guarantor_required BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS accepted_guarantor_types JSONB;

-- Set default for existing properties: HC (most common) and no guarantor required
UPDATE properties SET charges_included = FALSE WHERE charges_included IS NULL;
UPDATE properties SET guarantor_required = FALSE WHERE guarantor_required IS NULL;
