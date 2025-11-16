export const itemMethods = {
  showItemDetail(item) { this.selectedItem = item; },
  formatDate(dateString) { const date = new Date(dateString); return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }); },
  hasBooking(item) { return this.bookings.some(b => b.item_id === item.id); },
  getInterestCount(item) { return this.bookings.filter(b => b.item_id === item.id).length; },
  isUserInterested(item) { return this.bookings.some(b => b.item_id === item.id && b.user === this.userName); },
  async toggleInterest(item) {
    try {
      if (this.isUserInterested(item)) {
        const booking = this.bookings.find(b => b.item_id === item.id && b.user === this.userName);
        if (booking) {
          await fetch(`/api/bookings/${item.id}/${this.userName}/${encodeURIComponent(booking.date)}`, { method: 'DELETE' });
          this.bookings = this.bookings.filter(b => !(b.item_id === item.id && b.user === this.userName));
        }
      } else {
        await fetch('/api/bookings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: item.id, user: this.userName, date: new Date().toISOString() })
        });
        this.bookings.push({ item_id: item.id, user: this.userName, date: new Date().toISOString() });
      }
    } catch (error) { console.error('Error toggling interest:', error); }
  },
  editItem(item) {
    this.editingItem = item;
    this.itemForm = { name: item.name, description: item.description || '', image: item.image || '', category_id: item.category_id, price: item.price || '', link: item.link || '', owned: item.owned || false };
    this.showItemForm = true;
  },
  async renewInterest(item) {
    try {
      const response = await fetch(`/api/items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ last_interest_date: new Date().toISOString() }) });
      if (response.ok) { await this.loadCarousels(); this.showNotification('Intérêt renouvelé avec succès'); this.selectedItem = null; } else { this.showNotification('Erreur lors du renouvellement', 'error'); }
    } catch (error) { console.error('Error renewing interest:', error); this.showNotification('Erreur lors du renouvellement', 'error'); }
  },
  async markOwned(item) {
    try {
      const response = await fetch(`/api/items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owned: true }) });
      if (response.ok) { await this.loadCarousels(); this.showNotification('Marqué comme possédé'); this.selectedItem = null; } else { this.showNotification('Erreur lors de la mise à jour', 'error'); }
    } catch (error) { console.error('Error marking owned:', error); this.showNotification('Erreur lors de la mise à jour', 'error'); }
  },
  async saveItem(action = 'add') {
    try {
      const method = this.editingItem ? 'PUT' : 'POST';
      const url = this.editingItem ? `/api/items/${this.editingItem.id}` : '/api/items';
      const payload = { ...this.itemForm, last_interest_date: new Date().toISOString() };
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.ok) {
        await this.loadCarousels();
        this.showNotification(this.editingItem ? 'Article modifié avec succès' : 'Article ajouté avec succès');
        if (action === 'add' || this.editingItem) { this.closeItemForm(); }
        else if (action === 'create') { this.editingItem = null; this.itemForm = { name: '', description: '', image: '', category_id: null, price: '', link: '', owned: false }; }
        else if (action === 'clone') { this.editingItem = null; }
      } else { this.showNotification('Erreur lors de la sauvegarde', 'error'); }
    } catch (error) { console.error('Error saving item:', error); this.showNotification('Erreur lors de la sauvegarde', 'error'); }
  },
  selectItemAction(action) { this.lastItemAction = action; this.saveItem(action); },
  closeItemForm() {
    this.showItemForm = false; this.editingItem = null; this.showActionDropdown = false;
    this.itemForm = { name: '', description: '', image: '', category_id: null, price: '', link: '', owned: false };
  },
  async resetAllBookings() {
    if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les intérêts ?')) {
      try {
        const response = await fetch('/api/bookings', { method: 'DELETE' });
        if (response.ok) { await this.loadInitialData(); this.showNotification('Tous les intérêts ont été réinitialisés'); }
        else { this.showNotification('Erreur lors de la réinitialisation', 'error'); }
      } catch (error) { console.error('Error resetting bookings:', error); this.showNotification('Erreur lors de la réinitialisation', 'error'); }
    }
  }
  ,async deleteItem(item) {
    if (!confirm(`Supprimer l'article "${item.name}" ?`)) return;
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
      if (res.ok) {
        this.items = this.items.filter(i => i.id !== item.id);
        this.bookings = this.bookings.filter(b => b.item_id !== item.id);
        if (this.selectedItem && this.selectedItem.id === item.id) this.selectedItem = null;
        await this.loadCarousels();
        this.showNotification('Article supprimé');
      } else {
        this.showNotification('Erreur suppression article', 'error');
      }
    } catch (e) {
      console.error(e);
      this.showNotification('Erreur suppression article', 'error');
    }
  }
};
