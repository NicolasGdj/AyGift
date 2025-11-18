const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` })
});

export const itemMethods = {
  showItemDetail(item) { this.selectedItem = item; },
  formatDate(dateString) { const date = new Date(dateString); return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }); },
  formatShortDate(dateString) { const date = new Date(dateString); return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); },
  hasBooking(item) { return item.bookings && item.bookings.length > 0; },
  getInterestCount(item) { return item.bookings ? item.bookings.length : 0; },
  isUserInterested(item) { return item.bookings && item.bookings.some(b => b.user === this.userName); },
  getInterestedList(item) {
    if (!item.bookings || item.bookings.length === 0) return '';
    return item.bookings.map(b => `${b.user} [le ${this.formatShortDate(b.date)}]`).join(', ');
  },
  async toggleInterest(item) {
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id, user: this.userName })
      });
      const result = await response.json();
      
      // Fonction pour mettre à jour un item
      const updateItemBookings = (itemToUpdate) => {
        if (itemToUpdate.id === item.id) {
          if (!itemToUpdate.bookings) itemToUpdate.bookings = [];
          
          if (result.action === 'added') {
            itemToUpdate.bookings.push(result.booking);
          } else if (result.action === 'removed') {
            itemToUpdate.bookings = itemToUpdate.bookings.filter(b => b.user !== this.userName);
          }
        }
      };
      
      // Mettre à jour dans tous les tableaux
      this.wishlistItems.forEach(updateItemBookings);
      this.ownedItems.forEach(updateItemBookings);
      this.items.forEach(updateItemBookings);
      
      // Mettre à jour selectedItem si c'est celui-ci
      if (this.selectedItem && this.selectedItem.id === item.id) {
        updateItemBookings(this.selectedItem);
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
      const response = await fetch(`/api/items/${item.id}`, { method: 'PUT', headers: getAuthHeaders(this.token), body: JSON.stringify({ last_interest_date: new Date().toISOString() }) });
      if (response.ok) { await this.loadCarousels(); this.showNotification('Intérêt renouvelé avec succès'); this.selectedItem = null; } else { this.showNotification('Erreur lors du renouvellement', 'error'); }
    } catch (error) { console.error('Error renewing interest:', error); this.showNotification('Erreur lors du renouvellement', 'error'); }
  },
  async markOwned(item) {
    try {
      const response = await fetch(`/api/items/${item.id}`, { method: 'PUT', headers: getAuthHeaders(this.token), body: JSON.stringify({ owned: true }) });
      if (response.ok) { await this.loadCarousels(); this.showNotification('Marqué comme possédé'); this.selectedItem = null; } else { this.showNotification('Erreur lors de la mise à jour', 'error'); }
    } catch (error) { console.error('Error marking owned:', error); this.showNotification('Erreur lors de la mise à jour', 'error'); }
  },
  async saveItem(action = 'add') {
    try {
      const method = this.editingItem ? 'PUT' : 'POST';
      const url = this.editingItem ? `/api/items/${this.editingItem.id}` : '/api/items';
      const payload = { ...this.itemForm, last_interest_date: new Date().toISOString() };
      const response = await fetch(url, { method, headers: getAuthHeaders(this.token), body: JSON.stringify(payload) });
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
        const response = await fetch('/api/bookings', { method: 'DELETE', headers: getAuthHeaders(this.token) });
        if (response.ok) { await this.loadInitialData(); this.showNotification('Tous les intérêts ont été réinitialisés'); }
        else { this.showNotification('Erreur lors de la réinitialisation', 'error'); }
      } catch (error) { console.error('Error resetting bookings:', error); this.showNotification('Erreur lors de la réinitialisation', 'error'); }
    }
  }
  ,async deleteItem(item) {
    if (!confirm(`Supprimer l'article "${item.name}" ?`)) return;
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE', headers: getAuthHeaders(this.token) });
      if (res.ok) {
        this.items = this.items.filter(i => i.id !== item.id);
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
