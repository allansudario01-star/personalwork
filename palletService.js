class PalletService {
  constructor(db) {
    this.db = db;
    this.collection = 'pallets';
    this.localPallets = new Map();
    this.listeners = [];
  }

  // Carregar dados do localStorage
  loadLocalData() {
    const saved = localStorage.getItem('pallets');
    if (saved) {
      try {
        const pallets = JSON.parse(saved);
        pallets.forEach(p => this.localPallets.set(p.id, p));
      } catch (e) {
        console.error('Erro ao carregar localStorage', e);
      }
    }
  }

  // Salvar no localStorage
  saveLocalData() {
    const pallets = Array.from(this.localPallets.values());
    localStorage.setItem('pallets', JSON.stringify(pallets));
  }

  // Criar pallet
  async createPallet(palletData) {
    const id = Date.now().toString();
    const newPallet = {
      id,
      ...palletData,
      volumesAtuais: 0,
      criadoEm: new Date().toISOString(),
      sincronizado: false
    };

    // Salvar local
    this.localPallets.set(id, newPallet);
    this.saveLocalData();

    // Tentar sincronizar com Firebase
    try {
      await this.db.collection(this.collection).doc(id).set(newPallet);
      newPallet.sincronizado = true;
      this.localPallets.set(id, newPallet);
      this.saveLocalData();
    } catch (e) {
      console.log('Offline: pallet salvo localmente');
    }

    this.notifyListeners();
    return newPallet;
  }

  // Atualizar volumes
  async updateVolumes(id, novosVolumes) {
    const pallet = this.localPallets.get(id);
    if (!pallet) return;

    pallet.volumesAtuais = Math.max(0, Math.min(novosVolumes, pallet.maxVolumes));
    this.localPallets.set(id, pallet);
    this.saveLocalData();

    try {
      await this.db.collection(this.collection).doc(id).update({
        volumesAtuais: pallet.volumesAtuais
      });
      pallet.sincronizado = true;
    } catch (e) {
      pallet.sincronizado = false;
      console.log('Offline: atualização salva localmente');
    }

    this.saveLocalData();
    this.notifyListeners();
  }

  // Finalizar pallet (remover da lista ativa)
  async finalizarPallet(id) {
    this.localPallets.delete(id);
    this.saveLocalData();

    try {
      await this.db.collection(this.collection).doc(id).delete();
    } catch (e) {
      console.log('Offline: exclusão pendente');
    }

    this.notifyListeners();
  }

  // Buscar todos os pallets ativos
  getPallets(filtroPosicao = '', searchNF = '') {
    let pallets = Array.from(this.localPallets.values());

    if (filtroPosicao) {
      pallets = pallets.filter(p => p.palletPosicao?.startsWith(filtroPosicao));
    }

    if (searchNF) {
      pallets = pallets.filter(p => p.notaFiscal?.includes(searchNF));
    }

    // Ordenar: incompletos primeiro por posição, depois completos
    const incompletos = pallets
      .filter(p => p.volumesAtuais < p.maxVolumes)
      .sort((a, b) => (a.palletPosicao || '').localeCompare(b.palletPosicao || ''));

    const completos = pallets
      .filter(p => p.volumesAtuais >= p.maxVolumes)
      .sort((a, b) => (a.palletPosicao || '').localeCompare(b.palletPosicao || ''));

    return [...incompletos, ...completos];
  }

  // Sincronizar com Firebase
  async syncWithFirebase() {
    if (!navigator.onLine) return;

    try {
      const snapshot = await this.db.collection(this.collection).get();
      snapshot.forEach(doc => {
        this.localPallets.set(doc.id, { ...doc.data(), sincronizado: true });
      });
      this.saveLocalData();
      this.notifyListeners();
    } catch (e) {
      console.error('Erro ao sincronizar', e);
    }
  }

  // Observer pattern
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(l => l(this.getPallets()));
  }
}
