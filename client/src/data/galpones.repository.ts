export interface Galpon {
  id: string;
  nombre: string;
  ubicacion: string | null;
}

export interface Poza {
  id: string;
  galponId: string;
  codigo: string;
  tipo: string;
  capacidadMaxima: number;
}

export interface CreateGalponInput {
  nombre: string;
  ubicacion: string | null;
}

export interface CreatePozaInput {
  galponId: string;
  codigo: string;
  tipo: string;
  capacidadMaxima: number;
}

export interface GalponesRepository {
  listGalpones(): Promise<Galpon[]>;
  listPozasByGalpon(galponId: string): Promise<Poza[]>;
  createGalpon(input: CreateGalponInput): Promise<Galpon>;
  createPoza(input: CreatePozaInput): Promise<Poza>;
}
