import type { AuditEntry } from '../types.js';

export class AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries = 10000;

  log(entry: AuditEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    // Also write to stderr for external collection
    console.error(JSON.stringify({ type: 'audit', ...entry }));
  }

  getEntries(limit = 100): AuditEntry[] {
    return this.entries.slice(-limit);
  }

  search(predicate: (entry: AuditEntry) => boolean): AuditEntry[] {
    return this.entries.filter(predicate);
  }
}