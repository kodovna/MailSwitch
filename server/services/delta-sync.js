import { folderQueries } from '../db/database.js';
import { logger } from '../utils/logger.js';

export function shouldFullSync(accountId, folderPath, currentUidValidity) {
  const state = folderQueries.get(accountId, folderPath);
  if (!state || !state.uid_validity) return true;
  if (state.uid_validity !== currentUidValidity) {
    logger.info(`UIDVALIDITY changed for ${folderPath}, full re-sync needed`, {
      accountId,
      old: state.uid_validity,
      new: currentUidValidity,
    });
    return true;
  }
  return false;
}

export function getLastUid(accountId, folderPath) {
  const state = folderQueries.get(accountId, folderPath);
  return state?.last_uid || 0;
}

export function buildFetchRange(lastUid) {
  if (!lastUid || lastUid === 0) return '1:*';
  return `${lastUid + 1}:*`;
}
