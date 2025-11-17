import { authMethods } from './methods/auth.js';
import { dataMethods } from './methods/data.js';
import { itemMethods } from './methods/items.js';
import { uiMethods } from './methods/ui.js';
import { bulkMethods } from './methods/bulk.js';

const partials = ['welcome.html','main.html','modals.html','bulk.html','notifications.html'];

async function loadPartials() {
  const appEl = document.getElementById('app');
  for (const file of partials) {
    const res = await fetch(`composants/${file}`);
    const html = await res.text();
    appEl.insertAdjacentHTML('beforeend', html);
  }
}

await loadPartials();

const { createApp } = Vue;

const methods = { ...authMethods, ...dataMethods, ...itemMethods, ...uiMethods, ...bulkMethods };

createApp({
  data() {
    return {
      showWelcome: true,
      welcomeStep: 'choice',
      password: '',
      guestName: '',
      userName: '',
      owner: 'Owner',
      isAdmin: false,
      token: null,
      categories: [],
      items: [],
      wishlistItems: [],
      ownedItems: [],
      wishlistOffset: 10,
      ownedOffset: 10,
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
      itemForm: { name: '', description: '', image: '', category_id: null, price: '', link: '', owned: false },
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
      showActionDropdown: false,
      showBulkImport: false,
      bulkJson: '',
      bulkImportResult: null
      ,openCategoryMenuId: null
    };
  },
  watch: {
    searchQuery() { clearTimeout(this.debounceTimeout); this.debounceTimeout = setTimeout(() => { this.loadCarousels(); }, 500); },
    priceMin() { clearTimeout(this.debounceTimeout); this.debounceTimeout = setTimeout(() => { this.loadCarousels(); }, 500); },
    priceMax() { clearTimeout(this.debounceTimeout); this.debounceTimeout = setTimeout(() => { this.loadCarousels(); }, 500); },
    selectedCategory() { this.loadCarousels(); }
  },
  computed: {
    filteredItems() { return this.items; },
    currentWishlistItem() { return this.wishlistItems[0] || null; },
    currentOwnedItem() { return this.ownedItems[0] || null; }
  },
  methods,
  async mounted() {
    // Load config
    try {
      const configRes = await fetch('/api/config');
      const config = await configRes.json();
      this.owner = config.owner;
    } catch (e) {
      console.error('Failed to load config:', e);
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      this.token = token;
      this.isAdmin = true;
      this.userName = this.owner;
      this.showWelcome = false;
      this.loadInitialData().then(() => {
        this.$nextTick(() => {
          const carousels = document.querySelectorAll('.carousel-section .carousel');
          carousels.forEach(c => this.initDrag(c));
        });
      });
    }
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown-container')) { this.showActionDropdown = false; }
      if (!e.target.closest('.category-item')) { this.openCategoryMenuId = null; }
    });
  }
}).mount('#app');

document.getElementById('loading').style.display = 'none';
