-- Add REQUESTED status for bill payment approval flow
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
