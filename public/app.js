const { createApp } = Vue;

createApp({
  data() {
    return {
      showWelcome: true,
      welcomeStep: 'choice',
      password: '',
      guestName: '',
      userName: '',
      isAdmin: false,
      token: null,
      categories: [],
      items: [],
      bookings: [],
      selectedCategory: null,
      selectedItem: null,
      searchQuery: '',
      priceMin: null,
      priceMax: null,
      loading: false,
      showCategoryForm: false,
      showItemForm: false,
      editingCategory: null,
      editingItem: null,
      categoryForm: { name: '', description: '' },
      itemForm: { 
        name: '', 
        description: '', 
        image: '',
        category_id: null, 
        price: '', 
        link: '', 
        owned: false 
      },
      showPriceFilter: false,
      itemsOffset: 0,
      itemsLimit: 20,
      loadingMore: false,
      hasMore: true,
      debounceTimeout: null,
      notifications: [],
      isDragging: false,
      dragStartX: 0,
      dragStartScroll: 0,
      currentDraggingCarousel: null,
      dragListenersAdded: false,
      dragStarted: false,
      lastItemAction: 'add',
      showActionDropdown: false
    };
  },
  watch: {
    searchQuery() {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        this.loadItems(true);
      }, 500);
    },
    priceMin() {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        this.loadItems(true);
      }, 500);
    },
    priceMax() {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        this.loadItems(true);
      }, 500);
    }
  },
  computed: {
    filteredItems() {
      return this.items;
    },
    wishlistItems() {
      return this.filteredItems
        .filter(item => !item.owned)
        .sort((a, b) => {
          const dateA = a.last_interest_date ? new Date(a.last_interest_date) : new Date(0);
          const dateB = b.last_interest_date ? new Date(b.last_interest_date) : new Date(0);
          return dateB - dateA;
        });
    },
    ownedItems() {
      return this.filteredItems
        .filter(item => item.owned)
        .sort((a, b) => {
          const dateA = a.last_interest_date ? new Date(a.last_interest_date) : new Date(0);
          const dateB = b.last_interest_date ? new Date(b.last_interest_date) : new Date(0);
          return dateB - dateA;
        });
    },
    currentWishlistItem() {
      return this.wishlistItems[0] || null;
    },
    currentOwnedItem() {
      return this.ownedItems[0] || null;
    }
  },
  methods: {
    selectGuest() {
      this.welcomeStep = 'guest';
    },
    selectNicolas() {
      this.welcomeStep = 'nicolas';
    },
    async login() {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: this.password })
        });
        const data = await response.json();
        if (data.success) {
          this.token = data.token;
          this.isAdmin = true;
          this.userName = 'Nicolas';
          localStorage.setItem('token', data.token);
          this.showWelcome = false;
          this.loadInitialData();
        }
      } catch (error) {
        console.error('Login error:', error);
      }
    },
    setGuestName() {
      if (this.guestName.trim()) {
        this.userName = this.guestName;
        this.showWelcome = false;
        this.loadInitialData().then(() => {
          this.$nextTick(() => {
            const carousels = document.querySelectorAll('.carousel-section .carousel');
            carousels.forEach(carousel => this.initDrag(carousel));
          });
        });
      }
    },
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
        if (newItems.length < this.itemsLimit) {
          this.hasMore = false;
        }
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
        // In admin mode, clicking opens add item form for that category
        this.itemForm = { 
          name: '', 
          description: '', 
          image: '',
          category_id: category.id, 
          price: '', 
          link: '', 
          owned: false 
        };
        this.editingItem = null;
        this.showItemForm = true;
      } else {
        // In guest mode, just filter by category
        this.selectCategory(category.id);
      }
    },
    addNewItem() {
      this.itemForm = { 
        name: '', 
        description: '', 
        image: '',
        category_id: null, 
        price: '', 
        link: '', 
        owned: false 
      };
      this.editingItem = null;
      this.showItemForm = true;
    },
    showItemDetail(item) {
      this.selectedItem = item;
    },
    formatDate(dateString) {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    },
    hasBooking(item) {
      return this.bookings.some(b => b.item_id === item.id);
    },
    getInterestCount(item) {
      return this.bookings.filter(b => b.item_id === item.id).length;
    },
    isUserInterested(item) {
      return this.bookings.some(b => b.item_id === item.id && b.user === this.userName);
    },
    async toggleInterest(item) {
      try {
        if (this.isUserInterested(item)) {
          const booking = this.bookings.find(b => b.item_id === item.id && b.user === this.userName);
          if (booking) {
            await fetch(`/api/bookings/${item.id}/${this.userName}/${encodeURIComponent(booking.date)}`, {
              method: 'DELETE'
            });
            this.bookings = this.bookings.filter(b => !(b.item_id === item.id && b.user === this.userName));
          }
        } else {
          await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              item_id: item.id, 
              user: this.userName,
              date: new Date().toISOString()
            })
          });
          this.bookings.push({ item_id: item.id, user: this.userName, date: new Date().toISOString() });
        }
      } catch (error) {
        console.error('Error toggling interest:', error);
      }
    },
    async saveCategory() {
      try {
        const method = this.editingCategory ? 'PUT' : 'POST';
        const url = this.editingCategory 
          ? `/api/categories/${this.editingCategory.id}` 
          : '/api/categories';
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.categoryForm)
        });
        
        if (response.ok) {
          await this.loadInitialData();
          this.showNotification(this.editingCategory ? 'Catégorie modifiée avec succès' : 'Catégorie ajoutée avec succès');
          this.closeCategoryForm();
        } else {
          this.showNotification('Erreur lors de la sauvegarde de la catégorie', 'error');
        }
      } catch (error) {
        console.error('Error saving category:', error);
        this.showNotification('Erreur lors de la sauvegarde de la catégorie', 'error');
      }
    },
    closeCategoryForm() {
      this.showCategoryForm = false;
      this.editingCategory = null;
      this.categoryForm = { name: '', description: '' };
    },
    editItem(item) {
      this.editingItem = item;
      this.itemForm = {
        name: item.name,
        description: item.description || '',
        image: item.image || '',
        category_id: item.category_id,
        price: item.price || '',
        link: item.link || '',
        owned: item.owned || false
      };
      this.showItemForm = true;
    },
    async renewInterest(item) {
      try {
        const response = await fetch(`/api/items/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ last_interest_date: new Date().toISOString() })
        });
        if (response.ok) {
          await this.loadItems(true);
          this.showNotification('Intérêt renouvelé avec succès');
          this.selectedItem = null;
        } else {
          this.showNotification('Erreur lors du renouvellement', 'error');
        }
      } catch (error) {
        console.error('Error renewing interest:', error);
        this.showNotification('Erreur lors du renouvellement', 'error');
      }
    },
    async saveItem(action = 'add') {
      try {
        const method = this.editingItem ? 'PUT' : 'POST';
        const url = this.editingItem 
          ? `/api/items/${this.editingItem.id}` 
          : '/api/items';
        
        const payload = {
          ...this.itemForm,
          last_interest_date: new Date().toISOString()
        };
        
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          await this.loadItems(true);
          this.showNotification(this.editingItem ? 'Article modifié avec succès' : 'Article ajouté avec succès');
          
          if (action === 'add' || this.editingItem) {
            this.closeItemForm();
          } else if (action === 'create') {
            this.editingItem = null;
            this.itemForm = { 
              name: '', 
              description: '', 
              image: '',
              category_id: null, 
              price: '', 
              link: '', 
              owned: false 
            };
          } else if (action === 'clone') {
            // Keep the form open with current data for cloning
            this.editingItem = null;
          }
        } else {
          this.showNotification('Erreur lors de la sauvegarde', 'error');
        }
      } catch (error) {
        console.error('Error saving item:', error);
        this.showNotification('Erreur lors de la sauvegarde', 'error');
      }
    },
    selectItemAction(action) {
      this.lastItemAction = action;
      this.saveItem(action);
    },
    closeItemForm() {
      this.showItemForm = false;
      this.editingItem = null;
      this.showActionDropdown = false;
      this.itemForm = { 
        name: '', 
        description: '', 
        image: '',
        category_id: null, 
        price: '', 
        link: '', 
        owned: false 
      };
    },
    async resetAllBookings() {
      if (confirm('Êtes-vous sûr de vouloir réinitialiser tous les intérêts ?')) {
        try {
          const response = await fetch('/api/bookings', { method: 'DELETE' });
          if (response.ok) {
            await this.loadInitialData();
            this.showNotification('Tous les intérêts ont été réinitialisés');
          } else {
            this.showNotification('Erreur lors de la réinitialisation', 'error');
          }
        } catch (error) {
          console.error('Error resetting bookings:', error);
          this.showNotification('Erreur lors de la réinitialisation', 'error');
        }
      }
    },
    logout() {
      localStorage.removeItem('token');
      this.token = null;
      this.isAdmin = false;
      this.userName = '';
      this.showWelcome = true;
      this.welcomeStep = 'choice';
      this.password = '';
      this.categories = [];
      this.items = [];
      this.bookings = [];
    },
    togglePriceFilter() {
      this.showPriceFilter = !this.showPriceFilter;
    },
    scrollWishlist(direction) {
      const carousel = document.querySelector('.carousel-section:nth-child(1) .carousel');
      if (carousel) {
        const firstItem = carousel.querySelector('.item-card');
        if (firstItem) {
          const itemWidth = firstItem.offsetWidth + 24; // width + gap
          const currentScroll = carousel.scrollLeft;
          const targetIndex = Math.round(currentScroll / itemWidth) + direction;
          const targetScroll = targetIndex * itemWidth;
          carousel.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
      }
    },
    scrollOwned(direction) {
      const carousel = document.querySelector('.carousel-section:nth-child(2) .carousel');
      if (carousel) {
        const firstItem = carousel.querySelector('.item-card');
        if (firstItem) {
          const itemWidth = firstItem.offsetWidth + 24; // width + gap
          const currentScroll = carousel.scrollLeft;
          const targetIndex = Math.round(currentScroll / itemWidth) + direction;
          const targetScroll = targetIndex * itemWidth;
          carousel.scrollTo({ left: targetScroll, behavior: 'smooth' });
        }
      }
    },
    initDrag(carousel) {
      carousel.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.currentDraggingCarousel = carousel;
        this.dragStartX = e.clientX;
        this.dragStartScroll = carousel.scrollLeft;
        this.dragStarted = false;
        carousel.style.scrollBehavior = 'auto';
        carousel.style.scrollSnapType = 'none';
        e.preventDefault();
      });

      // Add global listeners only once
      if (!this.dragListenersAdded) {
        document.addEventListener('mousemove', (e) => {
          if (this.isDragging && this.currentDraggingCarousel) {
            const delta = e.clientX - this.dragStartX;
            if (!this.dragStarted && Math.abs(delta) > 5) {
              this.dragStarted = true;
              this.currentDraggingCarousel.classList.add('dragging');
            }
            if (this.dragStarted) {
              this.currentDraggingCarousel.scrollLeft = this.dragStartScroll - delta;
            }
          }
        });

        document.addEventListener('mouseup', () => {
          if (this.isDragging && this.currentDraggingCarousel) {
            this.isDragging = false;
            this.currentDraggingCarousel.style.scrollBehavior = 'smooth';
            this.currentDraggingCarousel.style.scrollSnapType = 'x mandatory';
            if (this.dragStarted) {
              this.currentDraggingCarousel.classList.remove('dragging');
            }
            this.currentDraggingCarousel = null;
            this.dragStarted = false;
          }
        });

        this.dragListenersAdded = true;
      }
    },
    showNotification(message, type = 'success') {
      const id = Date.now();
      this.notifications.push({ id, message, type });
      setTimeout(() => {
        this.notifications = this.notifications.filter(n => n.id !== id);
      }, 3000);
    },
    toggleActionDropdown() {
      this.showActionDropdown = !this.showActionDropdown;
    },
    selectLastItemAction(action) {
      this.lastItemAction = action;
      this.showActionDropdown = false;
    }
  },
  mounted() {
    // Restore session if token exists
    const token = localStorage.getItem('token');
    if (token) {
      this.token = token;
      this.isAdmin = true;
      this.userName = 'Nicolas';
      this.showWelcome = false;
      this.loadInitialData().then(() => {
        this.$nextTick(() => {
          const carousels = document.querySelectorAll('.carousel-section .carousel');
          carousels.forEach(carousel => this.initDrag(carousel));
        });
      });
    }
    // Global click listener to close dropdown
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown-container')) {
        this.showActionDropdown = false;
      }
    });
  }
}).mount('#app');