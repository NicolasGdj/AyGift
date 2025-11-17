export const bulkMethods = {
  openBulkImport() { this.showBulkImport = true; this.bulkImportResult = null; this.bulkJson = ''; },
  closeBulkImport() { this.showBulkImport = false; },
  async submitBulkJson() {
    if (!this.bulkJson.trim()) return;
    let parsed;
    try { parsed = JSON.parse(this.bulkJson); } catch (e) { this.showNotification('JSON invalide', 'error'); return; }
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
      const response = await fetch('/api/items/bulk', { method: 'POST', headers, body: JSON.stringify(parsed) });
      const data = await response.json();
      if (response.ok || response.status === 207) {
        this.bulkImportResult = data;
        await this.loadCarousels();
        this.showNotification(`Créés: ${data.created.length} / Erreurs: ${data.errors.length}`);
      } else { this.showNotification(data.error || 'Erreur import', 'error'); }
    } catch (error) { this.showNotification('Erreur réseau import', 'error'); }
  },
  fillBulkExample() {
    this.bulkJson = `[
  {
    "name": "Nintendo Switch",
    "category_name": "Gaming",
    "description": "Console portable polyvalente",
    "price": 299.99,
    "link": "https://example.com/switch",
    "image": "https://example.com/switch.jpg",
    "owned": false
  }
]`;
  }
};
