-- Part 16: Make patients.age optional (nullable)
-- PostgreSQL
ALTER TABLE patients ALTER COLUMN age DROP NOT NULL;
