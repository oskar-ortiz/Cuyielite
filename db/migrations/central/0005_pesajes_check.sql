-- Migración incremental S5: contexto exclusivo para pesajes.
-- Precondición: 0001_lope_domain.sql aplicado (pesajes.parto_id y pesajes.evento_id).
-- Regla Lope: cada pesaje se vincula a parto, evento o ninguno; nunca a ambos.
-- Independiente de 0004_publicacion_dominio.sql.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pesajes' AND column_name = 'parto_id'
    ) THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta columna pesajes.parto_id (requiere 0001)';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'pesajes' AND column_name = 'evento_id'
    ) THEN
        RAISE EXCEPTION 'Precondicion incumplida: falta columna pesajes.evento_id (requiere 0001)';
    END IF;
END $$;

DO $$
DECLARE
    pesajes_invalidos BIGINT;
BEGIN
    SELECT count(*) INTO pesajes_invalidos
    FROM public.pesajes
    WHERE parto_id IS NOT NULL AND evento_id IS NOT NULL;

    IF pesajes_invalidos > 0 THEN
        RAISE EXCEPTION 'Precheck incumplido: % pesajes tienen ambos contextos informados',
            pesajes_invalidos;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.pesajes'::regclass
          AND conname = 'pesajes_contexto_exclusivo_chk'
    ) THEN
        ALTER TABLE public.pesajes
            ADD CONSTRAINT pesajes_contexto_exclusivo_chk
            CHECK (parto_id IS NULL OR evento_id IS NULL);
    END IF;
END $$;

COMMENT ON CONSTRAINT pesajes_contexto_exclusivo_chk ON public.pesajes IS
    'Un pesaje se vincula a lo sumo a un contexto: parto_id, evento_id o ninguno.';
