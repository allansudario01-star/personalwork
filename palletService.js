class PalletService {
  constructor() {
    this.pallets = new Map(); // Guarda os pallets na memória
    this.loadFromStorage();
  }

  // Carregar do celular
  loadFromStorage() {
    const saved = localStorage.getItem('pallets');
    if (saved) {
      try {
        const lista = JSON.parse(saved);
        lista.forEach(p => this.pallets.set(p.id, p));
      } catch (e) { }
    }
  }

  // Salvar no celular
  saveToStorage() {
    const lista = Array.from(this.pallets.values());
    localStorage.setItem('pallets', JSON.stringify(lista));
  }

  // Criar pallet novo
  async create(data) {
    const id = Date.now().toString();
    const novo = {
      id,
      ...data,
      volumesAtuais: 0,
      criadoEm: new Date().toISOString()
    };

    this.pallets.set(id, novo);
    this.saveToStorage();

    // Tentar salvar na nuvem
    try {
      await window.db.collection('pallets').doc(id).set(novo);
    } catch (e) {
      console.log('Offline: salvo só no celular');
    }

    return novo;
  }

  // Atualizar volumes
  async updateVolumes(id, novosVolumes) {
    const pallet = this.pallets.get(id);
    if (!pallet) return;

    pallet.volumesAtuais = Math.min(novosVolumes, pallet.maxVolumes);
    if (pallet.volumesAtuais < 0) pallet.volumesAtuais = 0;

    this.saveToStorage();

    try {
      await window.db.collection('pallets').doc(id).update({
        volumesAtuais: pallet.volumesAtuais
      });
    } catch (e) { }
  }

  // Finalizar (remover)
  async finalizar(id) {
    this.pallets.delete(id);
    this.saveToStorage();

    try {
      await window.db.collection('pallets').doc(id).delete();
    } catch (e) { }
  }

  // Listar todos
  listar(filtroPosicao = '', buscaNF = '') {
    let lista = Array.from(this.pallets.values());

    if (filtroPosicao) {
      lista = lista.filter(p => p.palletPosicao?.startsWith(filtroPosicao));
    }

    if (buscaNF) {
      lista = lista.filter(p => p.notaFiscal?.includes(buscaNF));
    }

    // Separar incompletos e completos
    const incompletos = lista.filter(p => p.volumesAtuais < p.maxVolumes);
    const completos = lista.filter(p => p.volumesAtuais >= p.maxVolumes);

    return [...incompletos, ...completos];
  }
}
