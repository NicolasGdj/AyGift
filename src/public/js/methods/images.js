const maxLocalBytes = 25 * 1024 * 1024;
const maxCroppedBytes = 2 * 1024 * 1024;

export const imageMethods = {
  resetImage() {
    this.imageRequest++;
    this.imageSource = null;
    this.imageLoading = false;
    this.imageError = '';
    this.imageDragging = false;
    this.imageZoom = 1;
    this.imageX = 50;
    this.imageY = 50;
    this.imageRotate = 0;
    this.imageRatio = 'original';
  },
  async pickImage(file) {
    if (!file) return;
    if (file.size > maxLocalBytes || (file.type && !file.type.startsWith('image/'))) {
      this.imageError = 'Choisissez une image de moins de 25 Mo.';
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      await this.loadImageSource(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  },
  async loadImageSource(url) {
    const request = ++this.imageRequest;
    this.imageError = '';
    this.imageLoading = true;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    try {
      await image.decode();
      if (request !== this.imageRequest) return;
      this.resetImage();
      this.imageSource = Vue.markRaw(image);
      await this.$nextTick();
      this.drawImageCrop();
    } catch {
      if (request === this.imageRequest) this.imageError = 'Cette image ne peut pas être recadrée. Essayez un fichier JPEG, PNG ou WebP depuis votre appareil.';
    } finally {
      if (request === this.imageRequest) this.imageLoading = false;
    }
  },
  dropImage(event) {
    this.imageDragging = false;
    this.pickImage(event.dataTransfer.files[0]);
  },
  removeItemImage() {
    this.resetImage();
    this.itemForm.image = '';
  },
  rotateImage() {
    this.imageRotate = (this.imageRotate + 90) % 360;
    this.drawImageCrop();
  },
  drawImageCrop(maxSide = 1200) {
    const image = this.imageSource;
    const canvas = this.$refs.imageCanvas;
    if (!image || !canvas) return;

    const turned = this.imageRotate % 180 !== 0;
    const width = turned ? image.naturalHeight : image.naturalWidth;
    const height = turned ? image.naturalWidth : image.naturalHeight;
    const ratio = { square: 1, landscape: 4 / 3, portrait: 3 / 4 }[this.imageRatio] || width / height;
    const cropWidth = Math.min(width, height * ratio) / this.imageZoom;
    const cropHeight = cropWidth / ratio;
    const scale = Math.min(1, maxSide / Math.max(cropWidth, cropHeight));

    canvas.width = Math.max(1, Math.round(cropWidth * scale));
    canvas.height = Math.max(1, Math.round(cropHeight * scale));
    const ctx = canvas.getContext('2d');
    ctx.scale(canvas.width / cropWidth, canvas.height / cropHeight);
    ctx.translate(
      width / 2 - (width - cropWidth) * this.imageX / 100,
      height / 2 - (height - cropHeight) * this.imageY / 100
    );
    ctx.rotate(this.imageRotate * Math.PI / 180);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  },
  croppedImageData() {
    if (!this.imageSource) return undefined;
    for (const maxSide of [1200, 960, 720, 600]) {
      this.drawImageCrop(maxSide);
      const encoded = this.$refs.imageCanvas.toDataURL('image/webp', .9).split(',')[1];
      if (encoded && encoded.length <= Math.floor(maxCroppedBytes / 3) * 4) return encoded;
    }
    throw new Error('L’image recadrée est trop volumineuse.');
  }
};
