-- Migration: Add password reset fields to users table
-- Created: 2024-01-27

-- Add password reset token fields to users table
ALTER TABLE users ADD COLUMN reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME;
