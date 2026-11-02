/**
 * Datos sintéticos para el prototipo de consulta de galpones y pozas.
 * Espeja las columnas de negocio de db/ddl/central/002_nucleo.sql, sin las
 * columnas de sincronización. No representa datos reales del Centro Lope.
 */
export interface GalponDemo {
  id: string;
  nombre: string;
  ubicacion: string | null;
}

export interface PozaDemo {
  id: string;
  galponId: string;
  codigo: string;
  tipo: string;
}

export const galponesDemo: GalponDemo[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    nombre: 'Galpón Norte',
    ubicacion: 'Lote 1, sector norte',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    nombre: 'Galpón Sur',
    ubicacion: 'Lote 2, junto a la bodega',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    nombre: 'Galpón Occidente',
    ubicacion: 'Lote 3, ladera oeste',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    nombre: 'Galpón Este',
    ubicacion: 'Lote 4, en adecuación',
  },
];

export const pozasDemo: PozaDemo[] = [
  {
    id: '00000000-0000-4000-8000-100000000001',
    galponId: '00000000-0000-4000-8000-000000000001',
    codigo: 'P-101',
    tipo: 'cría',
  },
  {
    id: '00000000-0000-4000-8000-100000000002',
    galponId: '00000000-0000-4000-8000-000000000001',
    codigo: 'P-102',
    tipo: 'engorde',
  },
  {
    id: '00000000-0000-4000-8000-100000000003',
    galponId: '00000000-0000-4000-8000-000000000001',
    codigo: 'P-103',
    tipo: 'reproducción',
  },
  {
    id: '00000000-0000-4000-8000-100000000004',
    galponId: '00000000-0000-4000-8000-000000000002',
    codigo: 'P-201',
    tipo: 'cría',
  },
  {
    id: '00000000-0000-4000-8000-100000000005',
    galponId: '00000000-0000-4000-8000-000000000002',
    codigo: 'P-202',
    tipo: 'engorde',
  },
  {
    id: '00000000-0000-4000-8000-100000000006',
    galponId: '00000000-0000-4000-8000-000000000003',
    codigo: 'P-301',
    tipo: 'engorde',
  },
];
