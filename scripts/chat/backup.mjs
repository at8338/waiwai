import { DatabaseSync, backup } from 'node:sqlite';
import { chmod, open } from 'node:fs/promises';
import { resolve } from 'node:path';
const [source, destination] = process.argv.slice(2);
if (!source || !destination || resolve(source) === resolve(destination)) throw new Error('Usage: node scripts/chat/backup.mjs <source.sqlite> <new-backup.sqlite>');
const destinationFile = await open(destination, 'wx', 0o600); await destinationFile.close();
const db = new DatabaseSync(source, { readOnly: true });
try { await backup(db, destination); await chmod(destination, 0o600); }
finally { db.close(); }
console.log('SQLite backup completed.');
