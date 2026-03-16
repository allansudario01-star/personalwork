class AgendamentoService {
  constructor() {
    this.agendamentos = new Map();
    this.loadFromStorage();
  }

  loadFromStorage() {
    const saved = localStorage.getItem('agendamentos');
    if (saved) {
      try {
        const lista = JSON.parse(saved);
        lista.forEach(a => this.agendamentos.set(a.id, a));
      } catch (e) { }
    }
  }

  saveToStorage() {
    const lista = Array.from(this.agendamentos.values());
    localStorage.setItem('agendamentos', JSON.stringify(lista));
  }

  async create(recebedor, hub, estado) {
    const id = `${recebedor}-${hub}-${estado}`.replace(/\s/g, '_');
    const novo = { id, recebedor, hub, estado };

    this.agendamentos.set(id, novo);
    this.saveToStorage();

    try {
      await window.db.collection('agendamentos').doc(id).set(novo);
    } catch (e) { }

    return novo;
  }

  async delete(id) {
    this.agendamentos.delete(id);
    this.saveToStorage();

    try {
      await window.db.collection('agendamentos').doc(id).delete();
    } catch (e) { }
  }

  listar() {
    return Array.from(this.agendamentos.values());
  }

  verificar(recebedor, hub, estado) {
    const id = `${recebedor}-${hub}-${estado}`.replace(/\s/g, '_');
    return this.agendamentos.has(id);
  }

  // Importar da planilha
  async importarDaPlanilha(dados) {
    for (const item of dados) {
      await this.create(item.recebedor, item.hub, item.estado);
    }
  }
}
