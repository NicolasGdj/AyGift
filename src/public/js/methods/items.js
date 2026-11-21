const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`
});

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const reservationDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
export const formatPrice = (price) => currency.format(price);

export const itemMethods = {
  formatPrice,
  showItemDetail(item) {
    this.selectedItem = item;
    this.itemReservations = [];
    this.loadItemReservations(item);
  },
  closeItemDetail() {
    this.selectedItem = null;
    this.reservationRequest++;
    this.itemReservations = [];
    this.reservationLoading = false;
    this.reservationError = false;
  },
  formatDate(date) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(date)); },
  formatReservationDate(date) { return reservationDate.format(new Date(date)); },
  applyBookingStatus(item, status) {
    const rouletteItem = this.rouletteItems.find(candidate => candidate.id === item.id);
    const copies = [item, this.selectedItem, this.rouletteResult, rouletteItem, ...this.featuredItems, ...this.recentItems,
      ...Object.values(this.pages).flatMap(page => page.items)];
    for (const copy of copies) {
      if (copy?.id === item.id) Object.assign(copy, status);
    }
  },
  async loadItemReservations(item) {
    const request = ++this.reservationRequest;
    this.reservationError = false;
    if (this.isAdmin || item.owned) {
      this.reservationLoading = false;
      return;
    }
    this.reservationLoading = true;
    try {
      const response = await fetch(`/api/bookings/${item.id}`, { headers: this.guestHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error('Réservations indisponibles');
      const { reservations } = await response.json();
      if (request !== this.reservationRequest || this.selectedItem?.id !== item.id) return;
      this.itemReservations = reservations;
      this.applyBookingStatus(item, {
        booking_count: reservations.length,
        user_interested: reservations.some(reservation => reservation.own)
      });
    } catch {
      if (request === this.reservationRequest) this.reservationError = true;
    } finally {
      if (request === this.reservationRequest) this.reservationLoading = false;
    }
  },
  async toggleInterest(item) {
    if (this.isAdmin || item.owned || this.pendingInterests[item.id]) return;
    this.pendingInterests[item.id] = true;
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.guestHeaders() },
        body: JSON.stringify({ item_id: item.id, interested: !item.user_interested })
      });
      if (!response.ok) throw new Error('Réservation indisponible');
      const { booking_count, user_interested } = await response.json();
      this.applyBookingStatus(item, { booking_count, user_interested });
      if (this.selectedItem?.id === item.id) {
        this.itemReservations = [];
        await this.loadItemReservations(item);
      }
    } catch {
      this.showNotification('Impossible de modifier votre réservation.', 'error');
    } finally {
      delete this.pendingInterests[item.id];
    }
  },
  editItem(item, duplicate = false) {
    this.closeItemForm();
    this.editingItem = duplicate ? null : item;
    this.itemForm = {
      name: item.name,
      description: item.description || '',
      image: item.image || '',
      category_id: item.category_id,
      price: item.price ?? '',
      link: item.link || '',
      owned: Boolean(item.owned)
    };
    this.selectedItem = null;
    this.showItemForm = true;
  },
  async updateItem(item, body, message) {
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(this.token),
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error('Mise à jour impossible');
      this.selectedItem = null;
      this.showNotification(message);
      await this.loadInitialData();
    } catch {
      this.showNotification('Impossible de modifier l’article.', 'error');
    }
  },
  renewInterest(item) {
    return this.updateItem(item, { last_interest_date: new Date().toISOString() }, 'Envie renouvelée.');
  },
  toggleOwned(item) {
    return this.updateItem(item, { owned: !item.owned }, item.owned ? 'Rétabli dans les idées cadeaux.' : 'Déplacé dans les articles déjà possédés.');
  },
  async saveItem(event) {
    if (this.itemSaving || this.imageLoading) return;
    const continueAdding = event.submitter?.value === 'continue';
    this.itemSaving = true;
    this.itemSaveError = '';
    const editing = this.editingItem;
    const form = { ...this.itemForm };
    try {
      const payload = { ...form, price: form.price === '' ? null : form.price, imageData: this.croppedImageData() };
      const response = await fetch(editing ? `/api/items/${editing.id}` : '/api/items', {
        method: editing ? 'PUT' : 'POST',
        headers: getAuthHeaders(this.token),
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(response.status === 413 ? 'L’image est trop volumineuse.' : 'Impossible d’enregistrer cet article. Vérifiez le nom et la catégorie, puis réessayez.');
      }
    } catch (error) {
      this.itemSaveError = error.message || 'Impossible d’enregistrer cet article.';
      return;
    } finally {
      this.itemSaving = false;
    }
    this.showNotification(editing ? 'Article modifié.' : 'Article ajouté.');
    if (continueAdding && !editing) {
      this.resetItemForm(form.category_id, form.owned);
      this.itemSavedNotice = `« ${form.name} » ajouté. Vous pouvez saisir le suivant.`;
      await this.$nextTick();
      this.$refs.itemName?.focus();
    } else {
      this.closeItemForm();
    }
    await this.loadInitialData();
  },
  resetItemForm(categoryId = null, owned = false) {
    this.editingItem = null;
    this.itemSaveError = '';
    this.itemSavedNotice = '';
    this.resetImage();
    this.itemForm = { name: '', description: '', image: '', category_id: categoryId, price: '', link: '', owned };
    if (this.$refs.imagePicker) this.$refs.imagePicker.value = '';
  },
  closeItemForm() {
    if (this.itemSaving) return;
    this.showItemForm = false;
    this.resetItemForm();
  },
  async resetAllBookings(item) {
    const question = item ? `Effacer toutes les réservations pour « ${item.name} » ?` : 'Effacer toutes les réservations du site ?';
    if (!confirm(question)) return;
    try {
      const response = await fetch(item ? `/api/bookings/${item.id}` : '/api/bookings', {
        method: 'DELETE', headers: getAuthHeaders(this.token)
      });
      if (!response.ok) throw new Error('Suppression impossible');
      this.showNotification('Réservations effacées.');
    } catch {
      this.showNotification('Impossible d’effacer les réservations.', 'error');
    }
  },
  async deleteItem(item) {
    if (!confirm(`Supprimer l’article « ${item.name} » ?`)) return;
    try {
      const response = await fetch(`/api/items/${item.id}`, { method: 'DELETE', headers: getAuthHeaders(this.token) });
      if (!response.ok) throw new Error('Suppression impossible');
      this.selectedItem = null;
      await this.loadInitialData();
      this.showNotification('Article supprimé.');
    } catch {
      this.showNotification('Impossible de supprimer l’article.', 'error');
    }
  }
};
