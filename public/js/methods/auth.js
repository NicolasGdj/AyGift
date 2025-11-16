export const authMethods = {
  selectGuest() { this.welcomeStep = 'guest'; },
  selectNicolas() { this.welcomeStep = 'nicolas'; },
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
  }
};
