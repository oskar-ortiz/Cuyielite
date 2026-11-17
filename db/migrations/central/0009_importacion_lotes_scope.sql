-- Migración 0009: ámbito del lote de importación.
-- Precondición: 0001-0008 aplicadas. No modifica migraciones previas.
--
-- Motivo: la tupla de idempotencia (huella_archivo, parser_version,
-- mapeo_version) es única de forma global, pero el contrato vigente exige que
-- un lote no pueda reutilizarse en otro ámbito. Sin scope_id no hay forma de
-- detectar esa reutilización, porque el resto de tablas de importación tampoco
-- lo tienen. La columna queda nullable porque los lotes anteriores a esta
-- migración no registraban ámbito; la capa de orquestación los rechaza y
-- exige revisión humana en lugar de atribuirlos a un ámbito por suposición.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='importacion_lotes') THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta tabla importacion_lotes';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='importacion_lotes' AND column_name='scope_id') THEN
        RAISE EXCEPTION 'Migracion 0009 ya aplicada';
    END IF;
END $$;

ALTER TABLE importacion_lotes ADD COLUMN scope_id UUID REFERENCES sync_scopes(id);

CREATE INDEX idx_importacion_lotes_scope ON importacion_lotes (scope_id);
