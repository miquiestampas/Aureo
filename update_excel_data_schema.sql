-- Añadir nuevas columnas a la tabla excel_data
ALTER TABLE excel_data ADD COLUMN customer_address TEXT;
ALTER TABLE excel_data ADD COLUMN customer_location TEXT;
ALTER TABLE excel_data ADD COLUMN item_weight TEXT;

-- Verificar los cambios
PRAGMA table_info(excel_data);