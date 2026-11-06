import { Capacitor } from '@capacitor/core';

import { adaptWorkConnection, getWorkConnection } from './work.database.android';
import {
  listConflictCases,
  resolveConflictKeepCentral,
  resolveConflictRetry,
  type ConflictCase,
  type ConflictResolutionResult,
  type ConflictReview,
} from './work.sync.conflicts';
import { SyncLab } from './work.sync.transport';

export interface ConflictRepository {
  list(): Promise<ConflictCase[]>;
  keepCentral(review: ConflictReview): Promise<ConflictResolutionResult>;
  retry(review: ConflictReview, input: Record<string, unknown>): Promise<ConflictResolutionResult>;
}

const androidRepository: ConflictRepository = {
  async list() {
    return listConflictCases(adaptWorkConnection(await getWorkConnection()));
  },
  async keepCentral(review) {
    return resolveConflictKeepCentral(adaptWorkConnection(await getWorkConnection()), review);
  },
  async retry(review, input) {
    return resolveConflictRetry(adaptWorkConnection(await getWorkConnection()), review, input);
  },
};

const electronRepository: ConflictRepository = {
  async list() {
    return (await SyncLab.listConflicts()).cases;
  },
  async keepCentral(review) {
    return SyncLab.keepCentral({ review });
  },
  async retry(review, input) {
    return SyncLab.retryConflict({ review, input });
  },
};

export function getConflictRepository(): ConflictRepository {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return androidRepository;
  if (platform === 'electron') return electronRepository;
  throw new Error('La revisión de conflictos requiere Android o Windows instalado');
}
