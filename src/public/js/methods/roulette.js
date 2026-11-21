function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function drawTiles(items, count, previous) {
  return Array.from({ length: count }, () => {
    let index = Math.floor(Math.random() * items.length);
    if (items.length > 1 && items[index].id === previous?.id) {
      index = (index + 1 + Math.floor(Math.random() * (items.length - 1))) % items.length;
    }
    previous = items[index];
    return previous;
  });
}

function offset(index) {
  return `translate3d(calc(-0.5 * var(--roulette-tile) - ${index} * (var(--roulette-tile) + var(--roulette-gap))), 0, 0)`;
}

function preparePhotos(track) {
  return Promise.race([
    Promise.all([...track.querySelectorAll('img')].map(image => image.decode().catch(() => {}))),
    new Promise(resolve => setTimeout(resolve, 280))
  ]);
}

export const rouletteMethods = {
  resetRoulette() {
    this.rouletteVersion++;
    this.rouletteAnimation?.cancel();
    this.rouletteAnimation = null;
    this.rouletteItems = [];
    this.rouletteTiles = [];
    this.roulettePosition = 0;
    this.rouletteResult = null;
    this.rouletteLoading = false;
    this.rouletteError = false;
    this.rouletteSpinning = false;
    this.rouletteOpening = false;
  },
  async loadRoulette() {
    this.resetRoulette();
    const version = this.rouletteVersion;
    this.rouletteLoading = true;
    try {
      const response = await fetch(`/api/items/roulette?${this.catalogParams()}`, { headers: this.guestHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error('Roulette indisponible');
      const items = await response.json();
      if (version !== this.rouletteVersion) return;
      this.rouletteItems = items;
      this.rouletteTiles = items.length > 1 ? drawTiles(items, 7) : items;
      this.roulettePosition = Math.floor(this.rouletteTiles.length / 2);
    } catch {
      if (version === this.rouletteVersion) this.rouletteError = true;
    } finally {
      if (version === this.rouletteVersion) this.rouletteLoading = false;
    }
  },
  async spinRoulette() {
    if (this.rouletteLoading || this.rouletteSpinning || this.rouletteOpening || !this.rouletteItems.length) return;
    const items = this.rouletteItems;
    const winner = pick(items);
    const version = this.rouletteVersion;
    this.rouletteResult = null;
    this.rouletteSpinning = true;
    const finish = (position) => {
      this.roulettePosition = position;
      this.rouletteResult = winner;
      this.rouletteSpinning = false;
    };

    const start = Math.max(0, this.roulettePosition - 3);
    const visibleTiles = this.rouletteTiles.slice(start, this.roulettePosition + 4);
    const center = this.roulettePosition - start;
    if (items.length === 1 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      visibleTiles[center] = winner;
      this.rouletteTiles = visibleTiles;
      finish(center);
      return;
    }

    const passingTiles = drawTiles(items, 32, visibleTiles.at(-1));
    const winningIndex = visibleTiles.length + passingTiles.length;
    this.rouletteTiles = [...visibleTiles, ...passingTiles, winner, ...drawTiles(items, 3, winner)];
    this.roulettePosition = center;
    await this.$nextTick();
    const track = this.$refs.rouletteTrack;
    if (!track || version !== this.rouletteVersion) return;
    await preparePhotos(track);
    if (version !== this.rouletteVersion) return;

    const animation = track.animate(
      [{ transform: offset(center) }, { transform: offset(winningIndex) }],
      { duration: 3800, easing: 'cubic-bezier(.12,.81,.20,1)', fill: 'both' }
    );
    this.rouletteAnimation = Vue.markRaw(animation);
    try {
      await animation.finished;
      if (version === this.rouletteVersion) {
        finish(winningIndex);
        await this.$nextTick();
      }
    } catch {
      // A change of filters or view cancels the current draw.
    } finally {
      animation.cancel();
      if (this.rouletteAnimation === animation) this.rouletteAnimation = null;
    }
  },
  async openRouletteResult() {
    if (!this.rouletteResult || this.rouletteOpening) return;
    const result = this.rouletteResult;
    const version = this.rouletteVersion;
    this.rouletteOpening = true;
    try {
      const response = await fetch(`/api/items/${result.id}`, { headers: this.guestHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error('Article indisponible');
      const item = await response.json();
      if (item.owned) throw new Error('Article indisponible');
      if (version === this.rouletteVersion && this.rouletteResult?.id === result.id) {
        Object.assign(result, { booking_count: item.booking_count, user_interested: item.user_interested });
        this.showItemDetail(item);
      }
    } catch {
      if (version === this.rouletteVersion && this.rouletteResult?.id === result.id) {
        this.showNotification('Cet article n’est plus disponible. La liste a été actualisée.', 'error');
        await this.loadRoulette();
      }
    } finally {
      if (version === this.rouletteVersion) this.rouletteOpening = false;
    }
  }
};
