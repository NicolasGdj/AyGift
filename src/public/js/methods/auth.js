import { publicSiteSettings } from '../settings.js';

export const authMethods = {
  selectGuest() {
    this.guestError = '';
    this.welcomeStep = 'guest';
    this.$nextTick(() => document.getElementById('guest-name')?.focus());
  },
  selectOwner() {
    this.loginError = '';
    this.welcomeStep = 'owner';
    this.$nextTick(() => document.getElementById('one-time-code')?.focus());
  },
  async restoreSession() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const response = await fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        return;
      }
      if (!response.ok) throw new Error('Session indisponible');
      const { user } = await response.json();
      if (user?.role === 'admin') await this.enterAdmin(token);
    } catch {
      this.showNotification('Impossible de vérifier la session administrateur.', 'error');
    }
  },
  async enterAdmin(token) {
    this.token = token;
    this.isAdmin = true;
    this.adminView = 'articles';
    try {
      await this.loadSettings(token);
    } catch {
      this.showNotification('Impossible de charger les réglages administrateur.', 'error');
    }
    this.userName = this.owner;
    this.showWelcome = false;
    await this.loadInitialData();
  },
  async login(event) {
    if (this.loginPending) return;
    const password = new FormData(event.currentTarget).get('one-time-code');
    this.loginPending = true;
    this.loginError = '';
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.setItem('token', data.token);
        await this.enterAdmin(data.token);
      } else if (response.status === 429) {
        this.loginError = 'Trop de tentatives. Réessayez dans quelques minutes.';
      } else {
        this.loginError = response.status === 401 ? 'Code invalide ou expiré.' : 'Connexion indisponible.';
      }
    } catch {
      this.loginError = 'Connexion indisponible.';
    } finally {
      this.loginPending = false;
    }
  },
  async setGuestName() {
    if (this.guestPending || !this.guestName.trim()) return;
    this.guestPending = true;
    this.guestError = '';
    try {
      const response = await fetch('/api/bookings/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.guestName })
      });
      if (response.status === 400) {
        this.guestError = 'Saisissez un prénom ou un nom valide.';
        return;
      }
      if (!response.ok) throw new Error('Session indisponible');
      const { token, name } = await response.json();
      this.guestToken = token;
      this.userName = name;
      this.guestView = this.guestViewFromHash();
      this.showWelcome = false;
      await this.loadInitialData();
    } catch {
      this.guestError = 'Impossible d’ouvrir la liste de cadeaux pour le moment.';
    } finally {
      this.guestPending = false;
    }
  },
  logout() {
    localStorage.removeItem('token');
    this.token = null;
    this.isAdmin = false;
    this.userName = '';
    this.guestToken = '';
    this.adminSettingsReady = false;
    this.showWelcome = true;
    this.welcomeStep = 'choice';
    this.selectedItem = null;
    this.searchQuery = '';
    this.selectedCategory = null;
    this.priceMin = '';
    this.priceMax = '';
    this.notifications = [];
    this.featuredItems = [];
    this.recentItems = [];
    this.resetRoulette();
    this.closeItemForm();
    this.closeCategoryForm();
    this.closeBulkImport();
    this.applySettings(publicSiteSettings(this.settings));
    this.resetCatalog();
    this.featuredRequest++;
  }
};
