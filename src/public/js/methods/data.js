const pageSize = 12;

export function emptyPage() {
  return { items: [], hasMore: false, pending: false, error: false };
}

export const dataMethods = {
  async loadInitialData() {
    await this.loadCategories();
    const requests = [this.loadCatalog()];
    if (this.publicView) requests.push(this.loadGuestHighlights());
    if (this.isAdmin && this.adminView === 'featured') requests.push(this.loadFeaturedChoices());
    await Promise.all(requests);
  },
  async loadCategories() {
    try {
      const response = await fetch('/api/categories');
      if (!response.ok) throw new Error('Catégories indisponibles');
      this.categories = await response.json();
    } catch {
      this.showNotification('Impossible de charger les catégories.', 'error');
    }
  },
  guestHeaders() {
    return !this.isAdmin && this.guestToken ? { 'X-AyGift-Guest': this.guestToken } : {};
  },
  guestViewFromHash() {
    return this.guestViews.find(entry => entry.hash === location.hash)?.view || 'home';
  },
  syncGuestHash() {
    if (!this.isAdmin && !this.showWelcome) this.changeGuestView(this.guestViewFromHash());
  },
  changeGuestView(view) {
    if (this.guestView === view) return;
    this.resetRoulette();
    this.guestView = view;
    this.filtersOpen = false;
    if (!this.activeFilters) this.queueCatalog(0);
    this.clearFilters();
    window.scrollTo(0, 0);
  },
  async loadGuestHighlights() {
    const request = ++this.featuredRequest;
    const paths = {
      featuredItems: '/api/items/featured',
      recentItems: `/api/items?recent=true&limit=${this.settings.recentLimit}`
    };
    await Promise.all(Object.entries(paths).map(async ([field, url]) => {
      try {
        const response = await fetch(url, { headers: this.guestHeaders(), cache: 'no-store' });
        if (!response.ok) throw new Error('Sélection indisponible');
        const items = await response.json();
        if (request === this.featuredRequest) this[field] = items;
      } catch {
        if (request === this.featuredRequest) this[field] = [];
      }
    }));
  },
  resetCatalog() {
    clearTimeout(this.catalogTimer);
    this.catalogVersion++;
    this.pages = { articles: emptyPage(), wishlist: emptyPage(), owned: emptyPage() };
    for (const key of this.guestShelfKeys) this.pages[key] = emptyPage();
  },
  queueCatalog(delay = 220) {
    this.resetCatalog();
    if (this.publicView && this.guestView === 'roulette') {
      this.resetRoulette();
      this.rouletteLoading = true;
    }
    for (const key of this.catalogKeys()) this.pages[key].pending = true;
    this.catalogTimer = setTimeout(() => this.loadCatalog(), delay);
  },
  catalogKeys() {
    if (this.publicView) {
      if (['sizes', 'avoid', 'roulette'].includes(this.guestView)) return [];
      return this.homeShelves ? this.guestShelfKeys : [this.guestResultKey];
    }
    return ['articles', 'featured', 'owned'].includes(this.adminView) ? ['articles'] : [];
  },
  async loadCatalog() {
    this.resetCatalog();
    if (this.publicView && this.guestView === 'roulette') return this.loadRoulette();
    await Promise.all(this.catalogKeys().map(key => this.loadPage(key)));
  },
  catalogParams(categoryId = this.selectedCategory) {
    const params = new URLSearchParams();
    if (categoryId !== null) params.set('category_id', categoryId);
    if (this.searchQuery.trim()) params.set('search', this.searchQuery.trim());
    if (this.priceMin !== '') params.set('priceMin', this.priceMin);
    if (this.priceMax !== '') params.set('priceMax', this.priceMax);
    return params;
  },
  async loadPage(key) {
    const page = this.pages[key];
    if (page.pending) return;
    const version = this.catalogVersion;
    page.pending = true;
    page.error = false;
    const categoryId = key.startsWith('category-') ? key.slice('category-'.length) : this.selectedCategory;
    const params = this.catalogParams(categoryId);
    params.set('offset', page.items.length);
    params.set('limit', pageSize + 1);
    params.set('owned', String(key === 'owned' || (!this.publicView && this.adminView === 'owned')));
    try {
      const response = await fetch(`/api/items?${params}`, { headers: this.guestHeaders() });
      if (!response.ok) throw new Error('Catalogue indisponible');
      const items = await response.json();
      if (version !== this.catalogVersion) return;
      page.items.push(...items.slice(0, pageSize));
      page.hasMore = items.length > pageSize;
    } catch {
      if (version === this.catalogVersion) page.error = true;
    } finally {
      page.pending = false;
    }
  },
  jumpToCategory(id) { document.getElementById(`shelf-${id}`)?.scrollIntoView({ block: 'start' }); },
  clearFilters() {
    this.searchQuery = '';
    this.selectedCategory = null;
    this.priceMin = '';
    this.priceMax = '';
  },
  editCategory(category) {
    this.editingCategory = category;
    this.categoryForm = { name: category.name, description: category.description || '' };
    this.showCategoryForm = true;
  },
  addItemInCategory(category) {
    this.addNewItem();
    this.itemForm.category_id = category.id;
  },
  addNewItem() {
    this.closeItemForm();
    this.itemForm.category_id = this.selectedCategory ?? (this.categoryList.length === 1 ? this.categoryList[0].id : null);
    this.itemForm.owned = this.adminView === 'owned';
    this.showItemForm = true;
  },
  async deleteCategory(category) {
    if (!confirm(`Supprimer la catégorie « ${category.name} » et tous ses articles ?`)) return;
    try {
      const response = await fetch(`/api/categories/${category.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${this.token}` } });
      if (!response.ok) throw new Error('Suppression impossible');
      if (this.selectedCategory === category.id) this.selectedCategory = null;
      await this.loadInitialData();
      this.showNotification('Catégorie supprimée.');
    } catch {
      this.showNotification('Impossible de supprimer la catégorie.', 'error');
    }
  },
  async saveCategory() {
    const editing = this.editingCategory;
    try {
      const response = await fetch(editing ? `/api/categories/${editing.id}` : '/api/categories', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: JSON.stringify(this.categoryForm)
      });
      if (!response.ok) throw new Error('Enregistrement impossible');
      const category = await response.json();
      await this.loadCategories();
      if (this.showItemForm && !editing) this.itemForm.category_id = category.id;
      this.closeCategoryForm();
      this.showNotification(editing ? 'Catégorie modifiée.' : 'Catégorie ajoutée.');
    } catch {
      this.showNotification('Impossible d’enregistrer la catégorie.', 'error');
    }
  },
  closeCategoryForm() {
    this.showCategoryForm = false;
    this.editingCategory = null;
    this.categoryForm = { name: '', description: '' };
  }
};
