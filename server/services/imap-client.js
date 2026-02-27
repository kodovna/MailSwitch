import { ImapFlow } from 'imapflow';
import tls from 'tls';
import net from 'net';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

function tlsOptions() {
  return config.allowSelfSignedCerts ? { rejectUnauthorized: false } : {};
}

export class ImapClient {
  static async testConnection({ host, port, security = 'ssl', timeoutMs = 10000 }) {
    return new Promise((resolve) => {
      const useTls = security === 'ssl';
      const connectFn = useTls ? tls.connect : net.connect;
      const options = useTls
        ? { host, port, ...tlsOptions() }
        : { host, port };

      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          resolve({ success: false, error: `Connection timed out after ${timeoutMs}ms` });
        }
      }, timeoutMs);

      const socket = connectFn(options, () => {
        logger.debug(`Test connection established to ${host}:${port}`);
      });

      let data = '';
      socket.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('* OK') || data.includes('* ok')) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            socket.destroy();
            resolve({ success: true });
          }
        }
      });

      socket.on('error', (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ success: false, error: err.message });
        }
      });

      socket.on('close', () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ success: false, error: 'Connection closed without IMAP greeting' });
        }
      });
    });
  }

  static async testAuth({ host, port, security = 'ssl', email, password, timeoutMs = 15000 }) {
    const client = new ImapFlow({
      host,
      port,
      secure: security === 'ssl',
      auth: { user: email, pass: password },
      logger: false,
      emitLogs: false,
      tls: tlsOptions(),
    });

    // Prevent unhandled 'error' events from crashing the process
    client.on('error', () => {});

    try {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Authentication timed out')), timeoutMs)
        ),
      ]);
      await client.logout();
      return { success: true };
    } catch (err) {
      try { await client.logout(); } catch { /* ignore */ }
      return { success: false, error: err.message };
    }
  }

  constructor({ host, port, security = 'ssl', email, password, label = '' }) {
    this.label = label || email;
    this.client = new ImapFlow({
      host,
      port,
      secure: security === 'ssl',
      auth: { user: email, pass: password },
      logger: false,
      emitLogs: false,
      tls: tlsOptions(),
    });

    // Prevent unhandled 'error' events from crashing the process
    this.client.on('error', (err) => {
      logger.debug(`IMAP error for ${this.label}: ${err.message}`);
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
      uidValidity: Number(mailbox.uidValidity),
      uidNext: Number(mailbox.uidNext),
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
        uid: Number(msg.uid),
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
    const status = await this.client.status(path, { messages: true, uidNext: true, uidValidity: true });
    return {
      ...status,
      uidValidity: status.uidValidity != null ? Number(status.uidValidity) : null,
      uidNext: status.uidNext != null ? Number(status.uidNext) : null,
    };
  }
}
