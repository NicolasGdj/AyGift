import { defaultSettings, maxFeaturedIds, publicSiteSettings } from '../settings.js';

export function orderedCategories(categories, order) {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...categories].sort((a, b) =>
    (positions.get(a.id) ?? order.length) - (positions.get(b.id) ?? order.length) || a.id - b.id
  );
}

function move(values, index, step) {
  const result = [...values];
  const next = index + step;
  if (index >= 0 && next >= 0 && next < result.length) {
    [result[index], result[next]] = [result[next], result[index]];
  }
  return result;
}

function contrastingText(color) {
  const channels = color.slice(1).match(/../g).map(channel => parseInt(channel, 16) / 255);
  const [r, g, b] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

function themeStyles(colors) {
  return {
    '--accent': colors.accent,
    '--background': colors.background,
    '--surface': colors.surface,
    '--text': colors.text,
    '--on-accent': contrastingText(colors.accent),
    '--reservation': colors.reservation,
    '--on-reservation': contrastingText(colors.reservation)
  };
}

export const settingsMethods = {
  themeStyles,
  applySettings(settings) {
    this.settings = { ...defaultSettings, ...settings, colors: { ...defaultSettings.colors, ...settings.colors } };
    document.title = `AyGift - ${this.owner}`;
    this.draft = JSON.parse(JSON.stringify(this.settings));
    for (const [name, value] of Object.entries(themeStyles(this.settings.colors))) {
      document.documentElement.style.setProperty(name, value);
    }
  },
  async loadSettings(token) {
    const response = await fetch(token ? '/api/config/admin' : '/api/config', {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) throw new Error('Réglages indisponibles');
    const { owner, settings } = await response.json();
    this.defaultOwner = owner;
    this.applySettings(settings);
    if (token) this.adminSettingsReady = true;
  },
  async saveSettings() {
    if (this.savingSettings || !this.adminSettingsReady) return;
    this.savingSettings = true;
    const submitted = JSON.stringify(this.draft);
    try {
      const response = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
        body: submitted
      });
      if (!response.ok) throw new Error('Réglages invalides ou session expirée');
      const { settings } = await response.json();
      const newerDraft = JSON.stringify(this.draft) !== submitted ? this.draft : null;
      this.applySettings(this.isAdmin ? settings : publicSiteSettings(settings));
      if (newerDraft && this.isAdmin) this.draft = newerDraft;
      this.showNotification('Réglages enregistrés.');
      if (this.publicView) await this.loadGuestHighlights();
    } catch {
      this.showNotification('Impossible d’enregistrer les réglages. Vérifiez les valeurs et votre session.', 'error');
    } finally {
      this.savingSettings = false;
    }
  },
  resetColors() { this.draft.colors = { ...defaultSettings.colors }; },
  moveCategory(index, step) {
    this.draft.categoryOrder = move(this.draftCategories.map(category => category.id), index, step);
  },
  moveFeatured(index, step) {
    this.draft.featuredIds = move(this.draft.featuredIds, index, step);
  },
  toggleFeatured(item) {
    if (this.draft.featuredIds.includes(item.id)) {
      this.draft.featuredIds = this.draft.featuredIds.filter(id => id !== item.id);
    } else if (this.draft.featuredIds.length < maxFeaturedIds) {
      this.featuredChoices[item.id] = item;
      this.draft.featuredIds = [...this.draft.featuredIds, item.id];
    } else {
      this.showNotification(`Limite de ${maxFeaturedIds} articles sélectionnés.`, 'error');
    }
  },
  async loadFeaturedChoices() {
    const ids = [...this.draft.featuredIds];
    if (!ids.length) return;
    try {
      const params = new URLSearchParams({ ids: ids.join(','), limit: ids.length });
      const response = await fetch(`/api/items?${params}`);
      if (!response.ok) throw new Error('Sélection indisponible');
      const items = await response.json();
      for (const id of ids) delete this.featuredChoices[id];
      for (const item of items) this.featuredChoices[item.id] = item;
    } catch {
      this.showNotification('Impossible de charger les articles sélectionnés.', 'error');
    }
  },
  changeAdminView(view) {
    if (this.adminView === view) return;
    this.resetRoulette();
    this.adminView = view;
    this.guestView = 'home';
    this.filtersOpen = false;
    if (!this.activeFilters) this.queueCatalog(0);
    this.searchQuery = '';
    this.selectedCategory = null;
    this.priceMin = '';
    this.priceMax = '';
    if (view === 'preview') this.loadGuestHighlights();
    if (view === 'featured') this.loadFeaturedChoices();
  },
  addSize() {
    if (this.draft.sizes.length < this.preferenceLimit) this.draft.sizes.push({ label: '', value: '' });
  },
  addFavoriteColor() {
    if (this.draft.favoriteColors.length < this.preferenceLimit) {
      this.draft.favoriteColors.push({ label: '', hex: this.draft.colors.accent });
    }
  },
  addAvoidGroup() {
    if (this.draft.avoidGroups.length < this.preferenceLimit) {
      this.draft.avoidGroups.push({ title: '', description: '', examples: '' });
    }
  },
  moveAvoidGroup(index, step) {
    this.draft.avoidGroups = move(this.draft.avoidGroups, index, step);
  },
  avoidExamples(value) {
    return value.split(/\r?\n/).map(row => row.trim()).filter(Boolean);
  }
};
