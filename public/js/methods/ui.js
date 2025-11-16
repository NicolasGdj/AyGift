export const uiMethods = {
  togglePriceFilter() { this.showPriceFilter = !this.showPriceFilter; },
  scrollWishlist(direction) {
    const carousel = document.querySelector('.carousel-section:nth-child(1) .carousel');
    if (carousel) {
      const firstItem = carousel.querySelector('.item-card');
      if (firstItem) {
        const itemWidth = firstItem.offsetWidth + 24;
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
        const itemWidth = firstItem.offsetWidth + 24;
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
    setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 3000);
  },
  toggleActionDropdown() { this.showActionDropdown = !this.showActionDropdown; },
  selectLastItemAction(action) { this.lastItemAction = action; this.showActionDropdown = false; }
  ,toggleCategoryMenu(category, event) {
    if (this.openCategoryMenuId === category.id) {
      this.openCategoryMenuId = null;
    } else {
      this.openCategoryMenuId = category.id;
      // Position menu below the button
      this.$nextTick(() => {
        const menu = document.querySelector('.category-actions-menu');
        if (menu && event && event.target) {
          const btn = event.target.closest('.category-btn');
          if (btn) {
            const rect = btn.getBoundingClientRect();
            menu.style.top = `${rect.bottom + window.scrollY}px`;
            menu.style.left = `${rect.left + window.scrollX}px`;
          }
        }
      });
    }
  }
  ,closeCategoryMenus() { this.openCategoryMenuId = null; }
};
