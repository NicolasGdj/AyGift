export const dataMethods = {
  async loadInitialData(showLoading = true) {
    if (showLoading) this.loading = true;
    try {
      const catRes = await fetch('/api/categories');
      this.categories = await catRes.json();
      await this.loadCarousels();
      await this.loadItems(true);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (showLoading) this.loading = false;
    }
  },
  async loadCarousels() {
    try {
      const baseParams = new URLSearchParams({
        limit: 10,
        offset: 0
      });
      if (this.userName) baseParams.append('user', this.userName);
      if (this.selectedCategory) baseParams.append('category_id', this.selectedCategory);
      if (this.searchQuery.trim()) baseParams.append('search', this.searchQuery);
      if (this.priceMin) baseParams.append('priceMin', this.priceMin);
      if (this.priceMax) baseParams.append('priceMax', this.priceMax);

      const wishlistParams = new URLSearchParams(baseParams);
      wishlistParams.append('owned', 'false');
      const ownedParams = new URLSearchParams(baseParams);
      ownedParams.append('owned', 'true');

      const [wishlistRes, ownedRes] = await Promise.all([
        fetch(`/api/items?${wishlistParams}`),
        fetch(`/api/items?${ownedParams}`)
      ]);
      this.wishlistItems = (await wishlistRes.json()).sort((a,b) => { const da = a.last_interest_date ? new Date(a.last_interest_date) : new Date(0); const db = b.last_interest_date ? new Date(b.last_interest_date) : new Date(0); return db - da; });
      this.ownedItems = (await ownedRes.json()).sort((a,b) => { const da = a.last_interest_date ? new Date(a.last_interest_date) : new Date(0); const db = b.last_interest_date ? new Date(b.last_interest_date) : new Date(0); return db - da; });
      this.wishlistOffset = 10;
      this.ownedOffset = 10;
    } catch (error) {
      console.error('Error loading carousels:', error);
    }
  },
  async loadMoreWishlist() {
    try {
      const params = new URLSearchParams({
        offset: this.wishlistOffset,
        limit: 10,
        owned: false
      });
      if (this.userName) params.append('user', this.userName);
      if (this.selectedCategory) params.append('category_id', this.selectedCategory);
      if (this.searchQuery.trim()) params.append('search', this.searchQuery);
      if (this.priceMin) params.append('priceMin', this.priceMin);
      if (this.priceMax) params.append('priceMax', this.priceMax);
      const response = await fetch(`/api/items?${params}`);
      const newItems = await response.json();
      this.wishlistItems.push(...newItems.sort((a,b) => { const da = a.last_interest_date ? new Date(a.last_interest_date) : new Date(0); const db = b.last_interest_date ? new Date(b.last_interest_date) : new Date(0); return db - da; }));
      this.wishlistOffset += newItems.length;
    } catch (error) {
      console.error('Error loading more wishlist items:', error);
    }
  },
  async loadMoreOwned() {
    try {
      const params = new URLSearchParams({
        offset: this.ownedOffset,
        limit: 10,
        owned: true
      });
      if (this.userName) params.append('user', this.userName);
      if (this.selectedCategory) params.append('category_id', this.selectedCategory);
      if (this.searchQuery.trim()) params.append('search', this.searchQuery);
      if (this.priceMin) params.append('priceMin', this.priceMin);
      if (this.priceMax) params.append('priceMax', this.priceMax);
      const response = await fetch(`/api/items?${params}`);
      const newItems = await response.json();
      this.ownedItems.push(...newItems.sort((a,b) => { const da = a.last_interest_date ? new Date(a.last_interest_date) : new Date(0); const db = b.last_interest_date ? new Date(b.last_interest_date) : new Date(0); return db - da; }));
      this.ownedOffset += newItems.length;
    } catch (error) {
      console.error('Error loading more owned items:', error);
    }
  },
  async loadItems(reset = false) {
    if (reset) {
      this.itemsOffset = 0;
      this.items = [];
      this.hasMore = true;
    }
    if (!this.hasMore || this.loadingMore) return;
    this.loadingMore = true;
    try {
      const params = new URLSearchParams({
        offset: this.itemsOffset,
        limit: this.itemsLimit,
        ...(this.userName && { user: this.userName }),
        ...(this.selectedCategory && { category_id: this.selectedCategory }),
        ...(this.searchQuery.trim() && { search: this.searchQuery }),
        ...(this.priceMin && { priceMin: this.priceMin }),
        ...(this.priceMax && { priceMax: this.priceMax })
      });
      const response = await fetch(`/api/items?${params}`);
      const newItems = await response.json();
      this.items.push(...newItems);
      this.itemsOffset += newItems.length;
      if (newItems.length < this.itemsLimit) this.hasMore = false;
      this.$nextTick(() => {
        const carousels = document.querySelectorAll('.carousel-section .carousel');
        carousels.forEach(carousel => this.initDrag(carousel));
      });
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      this.loadingMore = false;
    }
  },
  selectCategory(categoryId) {
    this.selectedCategory = categoryId;
    this.searchQuery = '';
    this.priceMin = null;
    this.priceMax = null;
    this.loadCarousels();
  },
  handleCategoryClick(category) {
    this.selectCategory(category.id);
  },
  addItemInCategory(category) {
    this.itemForm = { name: '', description: '', image: '', category_id: category.id, price: '', link: '', owned: false };
    this.editingItem = null;
    this.showItemForm = true;
    this.openCategoryMenuId = null;
  },
  async deleteCategory(category) {
    if (!confirm(`Supprimer la catégorie "${category.name}" et tous ses articles ?`)) return;
    try {
      const res = await fetch(`/api/categories/${category.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${this.token}` } });
      if (res.ok) {
        this.categories = this.categories.filter(c => c.id !== category.id);
        this.items = this.items.filter(i => i.category_id !== category.id);
        if (this.selectedCategory === category.id) {
          this.selectedCategory = null;
        }
        this.showNotification('Catégorie supprimée');
        this.openCategoryMenuId = null;
      } else {
        this.showNotification('Erreur suppression catégorie', 'error');
      }
    } catch (e) {
      console.error(e);
      this.showNotification('Erreur suppression catégorie', 'error');
    }
  },
  addNewItem() {
    this.itemForm = { name: '', description: '', image: '', category_id: null, price: '', link: '', owned: false };
    this.editingItem = null;
    this.showItemForm = true;
  }
};
