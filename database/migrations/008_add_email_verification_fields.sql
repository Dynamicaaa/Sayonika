-- Migration: Add email verification fields to users table
-- Created: 2025-01-28

-- Add email verification fields to users table
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN email_verification_expires DATETIME;
