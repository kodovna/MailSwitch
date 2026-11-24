// SSE events use camelCase but DB records use snake_case
const ACCOUNT_KEYS = {
  totalMessages: 'total_messages',
  migratedMessages: 'migrated_messages',
  failedMessages: 'failed_messages',
  skippedMessages: 'skipped_messages',
  currentFolder: 'current_folder',
  errorMessage: 'error_message',
};

const FOLDER_KEYS = {
  totalMessages: 'total_messages',
  migratedMessages: 'migrated_messages',
  failedMessages: 'failed_messages',
  skippedMessages: 'skipped_messages',
  folderPath: 'folder_path',
};

function normalize(data, map) {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    result[map[key] || key] = value;
  }
  return result;
}

export const normalizeAccountData = (data) => normalize(data, ACCOUNT_KEYS);
export const normalizeFolderData = (data) => normalize(data, FOLDER_KEYS);
