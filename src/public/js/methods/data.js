export const dataMethods = {
  async loadInitialData(showLoading = true) {
    if (showLoading) this.loading = true;
    try {
      const [catRes, bookingsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/bookings')
      ]);
      this.categories = await catRes.json();
      this.bookings = await bookingsRes.json();
      await this.loadItems(true);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (showLoading) this.loading = false;
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
    this.loadItems(true);
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
      const res = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' });
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
