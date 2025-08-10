-- Fix database extensions in public schema
-- Move extensions to extensions schema for better security

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Grant usage on extensions schema
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Move vector extension to extensions schema
DROP EXTENSION IF EXISTS vector CASCADE;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Update search path to include extensions
ALTER DATABASE postgres SET search_path = "$user", public, extensions;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA extensions TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA extensions TO anon, authenticated;

-- Update any existing functions that might reference vector types
-- The vector functions should automatically work with the new schema