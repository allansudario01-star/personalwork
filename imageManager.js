class ImageManager {
  constructor() {
    this.qrCodeImage = null;
    this.loadFromStorage();
  }

  loadFromStorage() {
    const saved = localStorage.getItem('qrCodeImage');
    if (saved) {
      try {
        this.qrCodeImage = saved;
        console.log('QR Code carregado do storage');
      } catch (e) {
        console.log('Erro ao carregar QR Code:', e);
      }
    }
  }

  saveToStorage() {
    if (this.qrCodeImage) {
      localStorage.setItem('qrCodeImage', this.qrCodeImage);
    } else {
      localStorage.removeItem('qrCodeImage');
    }
  }

  async importarImagem(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        this.qrCodeImage = event.target.result;
        this.saveToStorage();
        resolve(this.qrCodeImage);
      };

      reader.onerror = () => {
        reject('Erro ao ler o arquivo');
      };

      reader.readAsDataURL(file);
    });
  }

  getImagem() {
    return this.qrCodeImage;
  }

  limparImagem() {
    this.qrCodeImage = null;
    this.saveToStorage();
  }
}
