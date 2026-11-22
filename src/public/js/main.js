import { authMethods } from './methods/auth.js';
import { dataMethods, emptyPage } from './methods/data.js';
import { formatPrice, itemMethods } from './methods/items.js';
import { uiMethods } from './methods/ui.js';
import { bulkMethods } from './methods/bulk.js';
import { settingsMethods, orderedCategories } from './methods/settings.js';
import { defaultSettings, maxFeaturedLimit, maxFeaturedTitleLength, maxPreferenceRows } from './settings.js';
import { imageMethods } from './methods/images.js';
import { rouletteMethods } from './methods/roulette.js';

const partials = ['welcome', 'main', 'admin', 'modals', 'bulk', 'notifications', 'gift-shelf', 'item-card'];
const templates = await Promise.all(partials.map(async (name) => {
  const response = await fetch(`composants/${name}.html`);
  if (!response.ok) throw new Error(`Impossible de charger ${name}`);
  return response.text();
}));
const app = document.getElementById('app');
app.innerHTML = templates.slice(0, -2).join('');

Vue.createApp({
  data() {
    return {
      showWelcome: true,
      welcomeStep: 'choice',
      loginPending: false,
      loginError: '',
      otpFieldType: CSS.supports('-webkit-text-security', 'disc') ? 'text' : 'password',
      guestName: '',
      guestPending: false,
      guestError: '',
      userName: '',
      defaultOwner: 'Owner',
      isAdmin: false,
      token: null,
      adminView: 'articles',
      adminViews: { articles: 'Articles', owned: 'Déjà possédés', categories: 'Catégories', featured: 'Mise en avant', sizes: 'Mes tailles', avoid: 'Pas pour moi', welcome: 'Page de connexion', appearance: 'Apparence', preview: 'Aperçu invité' },
      guestView: 'home',
      guestToken: '',
      filtersOpen: false,
      settings: structuredClone(defaultSettings),
      draft: structuredClone(defaultSettings),
      savingSettings: false,
      adminSettingsReady: false,
      featuredLimitMax: maxFeaturedLimit,
      maxFeaturedTitleLength,
      preferenceLimit: maxPreferenceRows,
      featuredItems: [],
      recentItems: [],
      featuredRequest: 0,
      featuredChoices: {},
      categories: [],
      pages: { articles: emptyPage(), wishlist: emptyPage(), owned: emptyPage() },
      catalogVersion: 0,
      catalogTimer: null,
      selectedCategory: null,
      selectedItem: null,
      itemReservations: [],
      reservationLoading: false,
      reservationError: false,
      reservationRequest: 0,
      pendingInterests: {},
      searchQuery: '',
      priceMin: '',
      priceMax: '',
      rouletteItems: [],
      rouletteTiles: [],
      roulettePosition: 0,
      rouletteVersion: 0,
      rouletteAnimation: null,
      rouletteResult: null,
      rouletteLoading: false,
      rouletteError: false,
      rouletteSpinning: false,
      rouletteOpening: false,
      showCategoryForm: false,
      showItemForm: false,
      editingCategory: null,
      editingItem: null,
      categoryForm: { name: '', description: '' },
      itemForm: { name: '', description: '', image: '', category_id: null, price: '', link: '', owned: false },
      itemSaving: false,
      itemSaveError: '',
      itemSavedNotice: '',
      imageSource: null,
      imageLoading: false,
      imageError: '',
      imageDragging: false,
      imageZoom: 1,
      imageX: 50,
      imageY: 50,
      imageRotate: 0,
      imageRatio: 'original',
      imageRequest: 0,
      notifications: [],
      showBulkImport: false,
      bulkJson: '',
      bulkImportResult: null
    };
  },
  computed: {
    publicView() { return !this.isAdmin || this.adminView === 'preview'; },
    guestViews() {
      const links = [
        { view: 'home', hash: '#cadeaux', label: 'Idées cadeaux' },
        { view: 'owned', hash: '#possede', label: 'Déjà possédés' },
        { view: 'sizes', hash: '#mes-tailles', label: 'Mes tailles' }
      ];
      if (this.settings.avoidEnabled) links.push({ view: 'avoid', hash: '#pas-pour-moi', label: 'Pas pour moi' });
      if (this.settings.rouletteEnabled) links.push({ view: 'roulette', hash: '#roulette', label: 'Roulette' });
      return links;
    },
    owner() { return this.settings.welcome.ownerName || this.defaultOwner; },
    categoryList() { return orderedCategories(this.categories, this.settings.categoryOrder); },
    categoryNames() { return Object.fromEntries(this.categories.map(category => [category.id, category.name])); },
    draftCategories() { return orderedCategories(this.categories, this.draft.categoryOrder); },
    activeFilters() {
      return !!this.searchQuery.trim() || this.selectedCategory !== null || this.priceMin !== '' || this.priceMax !== '';
    },
    featuredTitle() { return this.settings.featuredTitle.replaceAll('#', this.featuredItems.length); },
    filterKey() { return JSON.stringify([this.searchQuery.trim(), this.selectedCategory, this.priceMin, this.priceMax]); },
    homeShelves() { return this.guestView === 'home' && !this.activeFilters; },
    guestShelfKeys() { return this.categoryList.map(category => `category-${category.id}`); },
    guestResultKey() { return this.guestView === 'owned' ? 'owned' : 'wishlist'; },
    settingsDirty() { return JSON.stringify(this.settings) !== JSON.stringify(this.draft); }
  },
  watch: {
    filterKey() { if (!this.showWelcome) this.queueCatalog(); }
  },
  methods: { ...authMethods, ...dataMethods, ...itemMethods, ...uiMethods, ...bulkMethods, ...settingsMethods, ...imageMethods, ...rouletteMethods },
  async mounted() {
    try {
      await this.loadSettings();
    } catch (error) {
      this.showNotification('Les réglages du site sont indisponibles.', 'error');
    }
    await this.restoreSession();
    window.addEventListener('hashchange', this.syncGuestHash);
    document.getElementById('loading').hidden = true;
  }
})
.component('gift-shelf', {
  props: {
    items: Array, categories: Object, preview: Boolean, pending: Object, layout: String, ranked: Boolean,
    carousel: Boolean, podium: Boolean, label: String, page: Object, rankOffset: { type: Number, default: 0 }
  },
  emits: ['details', 'interest', 'more'],
  data() {
    return { canScrollBack: false, canScrollForward: false, drag: null, dragging: false, suppressClick: false };
  },
  mounted() {
    this.resizeObserver = new ResizeObserver(this.updateScrollControls);
    this.resizeObserver.observe(this.$refs.track);
  },
  updated() { this.updateScrollControls(); },
  beforeUnmount() { this.resizeObserver?.disconnect(); },
  methods: {
    updateScrollControls() {
      const track = this.$refs.track;
      this.canScrollBack = this.carousel && track.scrollLeft > 1;
      this.canScrollForward = this.carousel && track.scrollLeft + track.clientWidth < track.scrollWidth - 1;
    },
    scroll(direction) {
      const track = this.$refs.track;
      track.scrollBy({ left: direction * track.clientWidth * .8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    },
    startDrag(event) {
      this.suppressClick = false;
      const track = event.currentTarget;
      if (!this.carousel || event.pointerType !== 'mouse' || event.button !== 0 ||
          track.scrollWidth <= track.clientWidth || event.target.closest('.interest-button, .shelf-page')) return;
      this.drag = { pointer: event.pointerId, x: event.clientX, scroll: track.scrollLeft };
    },
    moveDrag(event) {
      if (this.drag?.pointer !== event.pointerId) return;
      const movement = event.clientX - this.drag.x;
      if (!this.dragging && Math.abs(movement) < 6) return;
      const track = event.currentTarget;
      if (!this.dragging) {
        this.dragging = true;
        track.setPointerCapture(event.pointerId);
      }
      track.scrollLeft = this.drag.scroll - movement;
    },
    endDrag(event) {
      if (this.drag?.pointer !== event.pointerId) return;
      this.suppressClick = this.dragging;
      this.drag = null;
      this.dragging = false;
    },
    leaveTrack() {
      if (!this.dragging) this.drag = null;
    },
    preventNativeDrag(event) {
      if (this.carousel) event.preventDefault();
    },
    preventDragClick(event) {
      if (!this.suppressClick || event.detail === 0) return;
      this.suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  },
  template: templates.at(-2)
})
.component('product-photo', {
  props: { src: String, eager: Boolean },
  emits: ['unavailable'],
  data() { return { failedSource: null }; },
  computed: {
    placeholder() { return !this.src || this.src === this.failedSource; }
  },
  watch: {
    src() { this.failedSource = null; }
  },
  methods: {
    showPlaceholder() {
      if (this.placeholder) return;
      this.failedSource = this.src;
      this.$emit('unavailable');
    }
  },
  template: `<img :key="src" :src="placeholder ? '/images/item-placeholder.png' : src"
    class="product-photo" :class="{ 'photo-placeholder': placeholder }" alt="" decoding="async"
    :loading="eager ? 'eager' : 'lazy'" @error="showPlaceholder">`
})
.component('item-card', {
  props: ['item', 'category', 'preview', 'interested', 'count', 'pending', 'priority', 'podium'],
  emits: ['details', 'interest'],
  methods: { formatPrice },
  template: templates.at(-1)
})
.component('reservation-badge', {
  props: { count: Number, interested: Boolean },
  template: `<span v-if="interested || count > 0" class="reservation-badge">
    {{ interested ? 'Réservé par vous' : 'Déjà réservé' }}<span v-if="count > 1"> · {{ count }}</span>
  </span>`
})
.directive('modal', { mounted: dialog => dialog.showModal(), beforeUnmount: dialog => dialog.close() })
.mount(app);
