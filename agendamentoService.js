class AgendamentoService {
  constructor(db) {
    this.db = db;
    this.collection = 'agendamentos';
    this.localAgendamentos = new Map();
    this.listeners = [];
    this.loadLocalData();
    this.syncWithFirebase();
  }

  loadLocalData() {
    const saved = localStorage.getItem('agendamentos');
    if (saved) {
      try {
        const agendamentos = JSON.parse(saved);
        agendamentos.forEach(a => this.localAgendamentos.set(a.id, a));
      } catch (e) {
        console.error('Erro ao carregar agendamentos', e);
      }
    }
  }

  saveLocalData() {
    const agendamentos = Array.from(this.localAgendamentos.values());
    localStorage.setItem('agendamentos', JSON.stringify(agendamentos));
  }

  async createAgendamento(recebedor, hub, estado) {
    const id = `${recebedor}-${hub}-${estado}`.replace(/\s+/g, '_');
    const novoAgendamento = {
      id,
      recebedor,
      hub,
      estado,
      sincronizado: false
    };

    this.localAgendamentos.set(id, novoAgendamento);
    this.saveLocalData();

    try {
      await this.db.collection(this.collection).doc(id).set(novoAgendamento);
      novoAgendamento.sincronizado = true;
      this.localAgendamentos.set(id, novoAgendamento);
      this.saveLocalData();
    } catch (e) {
      console.log('Offline: agendamento salvo localmente');
    }

    this.notifyListeners();
    return novoAgendamento;
  }

  async deleteAgendamento(id) {
    this.localAgendamentos.delete(id);
    this.saveLocalData();

    try {
      await this.db.collection(this.collection).doc(id).delete();
    } catch (e) {
      console.log('Offline: exclusão pendente');
    }

    this.notifyListeners();
  }

  getAgendamentos() {
    return Array.from(this.localAgendamentos.values());
  }

  isAgendado(recebedor, hub, estado) {
    const id = `${recebedor}-${hub}-${estado}`.replace(/\s+/g, '_');
    return this.localAgendamentos.has(id);
  }

  async syncWithFirebase() {
    if (!navigator.onLine) return;

    try {
      const snapshot = await this.db.collection(this.collection).get();
      snapshot.forEach(doc => {
        this.localAgendamentos.set(doc.id, { ...doc.data(), sincronizado: true });
      });
      this.saveLocalData();
      this.notifyListeners();
    } catch (e) {
      console.error('Erro ao sincronizar agendamentos', e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(l => l(this.getAgendamentos()));
  }
}
