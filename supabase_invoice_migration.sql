-- Run this in your Supabase SQL Editor to support the new Invoice System
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number text UNIQUE;
