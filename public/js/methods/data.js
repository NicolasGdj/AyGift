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
    if (this.isAdmin) {
      this.itemForm = { name: '', description: '', image: '', category_id: category.id, price: '', link: '', owned: false };
      this.editingItem = null;
      this.showItemForm = true;
    } else {
      this.selectCategory(category.id);
    }
  },
  addNewItem() {
    this.itemForm = { name: '', description: '', image: '', category_id: null, price: '', link: '', owned: false };
    this.editingItem = null;
    this.showItemForm = true;
  }
};
