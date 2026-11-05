-- DATOS 100% SINTÉTICOS. Solo para pruebas de código; NO usar para entrenar ni para reportar métricas.
-- Seeds para base local SQLite (CuyiElite).
-- Registros ficticios para probar la estructura de la base local.

-- Galpones (4 unidades de producción)
INSERT INTO galpones (id, nombre, ubicacion, created_at, updated_at, synced_at, deleted_at) VALUES
('g1', 'Galpón Norte', 'Lote 1, sector norte', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('g2', 'Galpón Sur', 'Lote 2, junto a la bodega', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('g3', 'Galpón Occidente', 'Lote 3, ladera oeste', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('g4', 'Galpón Este', 'Lote 4, en adecuación', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL);

-- Pozas (7 pozas distribuidas en los 4 galpones)
INSERT INTO pozas (id, galpon_id, codigo, tipo, capacidad_maxima, created_at, updated_at, synced_at, deleted_at) VALUES
-- Galpón Norte: 3 pozas
('p1', 'g1', 'P-101', 'cria', 50, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('p2', 'g1', 'P-102', 'engorde', 30, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('p3', 'g1', 'P-103', 'reproducción', 80, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- Galpón Sur: 2 pozas
('p4', 'g2', 'P-201', 'cria', 20, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('p5', 'g2', 'P-202', 'engorde', 60, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- Galpón Occidente: 1 poza
('p6', 'g3', 'P-301', 'engorde', 45, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- Galpón Este: 1 poza (la más reciente, sin historial de cría masiva)
('p7', 'g4', 'P-401', 'cria', 15, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL);

-- Cuyes (15 ejemplares distribuidos en las 7 pozas)
INSERT INTO cuyes (id, poza_id, codigo_identificacion, sexo, fecha_nacimiento, categoria_ml, ultimo_peso_g, estado, created_at, updated_at, synced_at, deleted_at) VALUES
-- De la poza P-101 (cria, galpón Norte)
('c1', 'p1', 'C-001', 'H', '2025-03-15', 'ELITE', 850, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('c2', 'p1', 'C-002', 'M', '2025-04-10', 'NORMAL', 720, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- De la poza P-102 (engorde, galpón Norte)
('c3', 'p2', 'C-010', 'H', '2025-01-20', 'DESCARTE', 680, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('c4', 'p2', 'C-011', 'M', '2025-02-05', 'NORMAL', 550, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- De la poza P-103 (reproducción, galpón Norte)
('c5', 'p3', 'C-020', 'H', '2024-12-01', 'ELITE', 920, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- De la poza P-201 (cria, galpón Sur)
('c6', 'p4', 'C-030', 'M', '2025-05-12', 'NORMAL', 480, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- De la poza P-202 (engorde, galpón Sur)
('c7', 'p5', 'C-040', 'H', '2025-02-28', 'DESCARTE', 750, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- De la poza P-301 (engorde, galpón Occidente)
('c8', 'p6', 'C-050', 'M', '2025-06-18', 'NORMAL', 610, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- De la poza P-401 (cria, galpón Este - nuevo lote)
('c9', 'p7', 'C-060', 'H', '2025-07-03', 'ELITE', 890, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
-- Cuyes adicionales para tener variedad (6 más)
('c10', 'p1', 'C-070', 'M', '2025-03-25', 'NORMAL', 610, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('c11', 'p3', 'C-080', 'H', '2025-04-08', 'ELITE', 910, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('c12', 'p2', 'C-090', 'M', '2025-01-18', 'NORMAL', 530, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('c13', 'p4', 'C-100', 'H', '2025-05-22', 'DESCARTE', 670, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('c14', 'p5', 'C-110', 'M', '2025-02-14', 'NORMAL', 580, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('c15', 'p6', 'C-120', 'H', '2025-06-25', 'ELITE', 940, 'ACTIVO', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL);

-- Partos (4 partos registrados, 1 por cada poza activa)
INSERT INTO partos (id, madre_id, fecha_parto, tamano_camada_nacida, nacidos_vivos, nacidos_muertos, created_at, updated_at, synced_at, deleted_at) VALUES
('pa1', 'c1', '2026-05-10', 3, 3, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pa2', 'c5', '2026-06-20', 4, 4, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pa3', 'c9', '2026-07-05', 2, 2, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pa4', 'c10', '2026-07-15', 3, 3, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL);

-- Pesajes (10 registros de peso distribuidos)
INSERT INTO pesajes (id, cuy_id, fecha_pesaje, peso_gramos, created_at, updated_at, synced_at, deleted_at) VALUES
('pes1', 'c1', '2026-10-01', 850, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes2', 'c2', '2026-10-02', 720, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes3', 'c3', '2026-10-03', 680, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes4', 'c4', '2026-10-04', 550, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes5', 'c5', '2026-10-05', 920, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes6', 'c6', '2026-10-05', 480, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes7', 'c7', '2026-10-06', 750, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes8', 'c8', '2026-10-06', 610, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes9', 'c9', '2026-10-07', 890, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('pes10', 'c10', '2026-10-07', 610, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL);

-- Mortalidad (2 registros de deceso)
INSERT INTO mortalidad (id, cuy_id, fecha_deceso, causa_presunta, created_at, updated_at, synced_at, deleted_at) VALUES
('m1', 'c11', '2026-09-28', 'sospecha respiratoria', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL),
('m2', 'c13', '2026-10-01', 'sospecha digestiva', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', NULL, NULL);

-- Alertas (1 alerta por categoría DESCARTE)
INSERT INTO alertas (id, cuy_id, tipo_alerta, severidad, atendida, created_at, updated_at, synced_at, deleted_at) VALUES
('a1', 'c3', 'Superación de peso objetivo', 'ALTA', 0, '2026-10-10T10:00:00Z', '2026-10-10T10:00:00Z', NULL, NULL),
('a2', 'c7', 'Categoría DESCARTE detectada', 'ALTA', 0, '2026-10-11T14:30:00Z', '2026-10-11T14:30:00Z', NULL, NULL);