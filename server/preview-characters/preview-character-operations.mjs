import { getDb } from '../../db/client.mjs';
import {
  createPreviewCharacter as createPreviewCharacterInTransaction,
  setPreviewPublicationState as setPreviewPublicationStateInTransaction,
  updatePreviewCharacter as updatePreviewCharacterInTransaction,
} from './preview-character-domain.mjs';
import {
  getPreviewCharacter as getPreviewCharacterFromDatabase,
  listPreviewCharacters as listPreviewCharactersFromDatabase,
} from './preview-character-read-domain.mjs';

export async function listPreviewCharacters(query = {}) {
  return listPreviewCharactersFromDatabase(query);
}

export async function getPreviewCharacter(entityId) {
  return getPreviewCharacterFromDatabase(entityId);
}

export async function createPreviewCharacter(input) {
  return getDb().transaction((tx) => createPreviewCharacterInTransaction(tx, input));
}

export async function updatePreviewCharacter(input) {
  return getDb().transaction((tx) => updatePreviewCharacterInTransaction(tx, input));
}

export async function setPreviewPublicationState(input) {
  return getDb().transaction((tx) => setPreviewPublicationStateInTransaction(tx, input));
}
