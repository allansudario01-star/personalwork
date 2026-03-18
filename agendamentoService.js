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
        lista.forEach(a => {
          if (!a.tipo) a.tipo = 'PADRÃO';

          a.displayString = `${a.uf}/${a.hub}/${a.recebedor}/${a.tipo}`;
          this.agendamentos.set(a.id, a);
        });
      } catch (e) {
        console.log('Erro ao carregar agendamentos:', e);
      }
    }
  }

  saveToStorage() {
    const lista = Array.from(this.agendamentos.values());
    localStorage.setItem('agendamentos', JSON.stringify(lista));
  }

  async create(uf, hub, recebedor, tipo = 'PADRÃO') {

    uf = uf.toUpperCase().trim();
    hub = hub.toUpperCase().trim();
    recebedor = recebedor.toUpperCase().trim();
    tipo = tipo.toUpperCase().trim();

    const id = `${uf}-${hub}-${recebedor}-${tipo}`.replace(/\s/g, '_');
    const novo = {
      id,
      uf,
      hub,
      recebedor,
      tipo,
      displayString: `${uf}/${hub}/${recebedor}/${tipo}`,
      criadoEm: new Date().toISOString()
    };

    this.agendamentos.set(id, novo);
    this.saveToStorage();

    try {
      await window.db.collection('agendamentos').doc(id).set(novo);
    } catch (e) {
      console.log('Offline: agendamento salvo localmente');
    }

    return novo;
  }

  async delete(id) {
    this.agendamentos.delete(id);
    this.saveToStorage();

    try {
      await window.db.collection('agendamentos').doc(id).delete();
    } catch (e) {
      console.log('Offline: agendamento removido localmente');
    }
  }

  limparTodos() {
    this.agendamentos.clear();
    this.saveToStorage();

    try {

    } catch (e) { }
  }

  listar() {
    return Array.from(this.agendamentos.values());
  }

  verificar(uf, hub, recebedor) {

    uf = uf.toUpperCase().trim();
    hub = hub.toUpperCase().trim();
    recebedor = recebedor.toUpperCase().trim();

    for (let agendamento of this.agendamentos.values()) {
      if (agendamento.uf === uf &&
        agendamento.hub === hub &&
        agendamento.recebedor === recebedor) {
        return true;
      }
    }
    return false;
  }

  async importarDoExcel(conteudoCSV) {
    const linhas = conteudoCSV.split('\n');
    const resultados = [];

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha || linha.startsWith('UF') || linha.startsWith('uf')) continue;

      const partes = linha.split(',').map(item => item.trim());
      let uf, hub, recebedor, tipo = 'PADRÃO';

      if (partes.length >= 3) {
        uf = partes[0];
        hub = partes[1];
        recebedor = partes[2];
        if (partes.length >= 4) tipo = partes[3];

        const agendamento = await this.create(uf, hub, recebedor, tipo);
        resultados.push(agendamento);
      }
    }

    return resultados;
  }

  async importarDaPlanilha(dados) {
    for (const item of dados) {
      await this.create(
        item.uf || item.UF,
        item.hub || item.HUB,
        item.recebedor || item.RECEBEDOR,
        item.tipo || item.TIPO || 'PADRÃO'
      );
    }
  }
}
