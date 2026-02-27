import { ImapFlow } from 'imapflow';
import { logger } from '../utils/logger.js';

export class ImapClient {
  constructor({ host, port, email, password, label = '' }) {
    this.label = label || email;
    // Port 993 = implicit TLS, port 143 = STARTTLS upgrade
    const secure = port !== 143;
    this.client = new ImapFlow({
      host,
      port,
      secure,
      auth: { user: email, pass: password },
      logger: false,
      emitLogs: false,
    });
  }

  async connect() {
    await this.client.connect();
    logger.debug(`IMAP connected: ${this.label}`);
  }

  async disconnect() {
    try {
      await this.client.logout();
    } catch {
      // ignore logout errors
    }
  }

  async listFolders() {
    const tree = await this.client.listTree();
    const folders = [];

    function walk(node) {
      if (node.path && !node.flags?.has('\\Noselect')) {
        folders.push({
          path: node.path,
          name: node.name,
          delimiter: node.delimiter,
          specialUse: node.specialUse || null,
        });
      }
      if (node.folders) {
        for (const child of node.folders) walk(child);
      }
    }

    walk(tree);
    return folders;
  }

  async createFolder(path) {
    try {
      await this.client.mailboxCreate(path);
      logger.debug(`Created folder: ${path} on ${this.label}`);
    } catch (err) {
      // Folder might already exist (ALREADYEXISTS)
      if (!err.message?.includes('ALREADYEXISTS') && !err.message?.includes('already exists')) {
        throw err;
      }
    }
  }

  async openFolder(path) {
    const mailbox = await this.client.mailboxOpen(path);
    return {
      path: mailbox.path,
      uidValidity: mailbox.uidValidity,
      uidNext: mailbox.uidNext,
      exists: mailbox.exists,
    };
  }

  async fetchMessages(range, options = {}) {
    const messages = [];
    for await (const msg of this.client.fetch(range, {
      uid: true,
      flags: true,
      internalDate: true,
      source: true,
      ...options,
    })) {
      messages.push({
        uid: msg.uid,
        flags: msg.flags ? [...msg.flags] : [],
        internalDate: msg.internalDate,
        source: msg.source,
      });
    }
    return messages;
  }

  async appendMessage(folder, message, flags, internalDate) {
    return this.client.append(folder, message, flags, internalDate);
  }

  async getStatus(path) {
    return this.client.status(path, { messages: true, uidNext: true, uidValidity: true });
  }
}
