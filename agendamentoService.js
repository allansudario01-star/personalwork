class AgendamentoService {
  constructor() {
    this.agendamentos = new Map();
    this.carregando = false;

    this.loadFromStorage();
    this.carregarTodosDoFirestore();
    this.setupRealtimeListener();
  }

  async carregarTodosDoFirestore() {
    if (this.carregando) return;

    this.carregando = true;

    try {
      const snapshot = await window.db.collection('agendamentos').get();

      snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        this.processarAgendamento(data);
      });

      this.saveToStorage();

      if (window.renderizarAgendamentos) window.renderizarAgendamentos();
      if (window.atualizarStats) window.atualizarStats();

    } catch (error) {
    } finally {
      this.carregando = false;
    }
  }

  setupRealtimeListener() {
    if (!window.db) return;

    window.db.collection('agendamentos')
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          data.id = change.doc.id;

          if (change.type === 'added') {
            this.processarAgendamento(data);
          }

          if (change.type === 'modified') {
            this.processarAgendamento(data);
          }

          if (change.type === 'removed') {
            this.agendamentos.delete(change.doc.id);
          }
        });

        this.saveToStorage();
        if (window.renderizarAgendamentos) window.renderizarAgendamentos();
        if (window.atualizarStats) window.atualizarStats();
      }, (error) => {
      });
  }

  processarAgendamento(a) {
    if (a.destinatario) {
      a.displayString = a.destinatario;
      a.recebedor = a.destinatario;
      return a;
    }

    a.uf = (a.uf || '').toUpperCase().trim();
    a.hub = (a.hub || '').toUpperCase().trim();
    a.recebedor = (a.recebedor || '').toUpperCase().trim();
    a.tipo = (a.tipo || '').toUpperCase().trim();
    a.subrota = a.subrota || '';
    a.id = a.id || `${a.uf}-${a.hub}-${a.recebedor}${a.tipo ? '-' + a.tipo : ''}`.replace(/\s/g, '_');
    a.displayString = `${a.uf}/${a.hub}/${a.recebedor}${a.tipo ? '/' + a.tipo : ''}`;

    return a;
  }

  async create(uf, hub, recebedor, tipo = '', subrota = '') {
    uf = uf.toUpperCase().trim();
    hub = hub.toUpperCase().trim();
    recebedor = recebedor.toUpperCase().trim();
    tipo = tipo ? tipo.toUpperCase().trim() : '';
    subrota = subrota ? subrota.trim() : '';

    let baseId = `${uf}-${hub}-${recebedor}`;
    if (tipo) {
      baseId += `-${tipo}`;
    }
    baseId = baseId.replace(/\s/g, '_');

    const novo = {
      uf,
      hub,
      recebedor,
      tipo: tipo || '',
      subrota: subrota,
      displayString: `${uf}/${hub}/${recebedor}${tipo ? '/' + tipo : ''}`,
      criadoEm: new Date().toISOString()
    };

    try {
      await window.db.collection('agendamentos')
        .doc(baseId)
        .set(novo, { merge: true });

      novo.id = baseId;
      this.agendamentos.set(baseId, novo);
      this.saveToStorage();

      return novo;
    } catch (error) {
      throw error;
    }
  }

  async importarDoExcel(conteudoCSV) {
    const linhas = conteudoCSV.split('\n');
    const batch = window.db.batch();
    let operacoes = 0;
    const MAX_BATCH_SIZE = 500;
    const novosAgendamentos = [];

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha) continue;

      if (i === 0 && (linha.toLowerCase().includes('destinatario') || linha.toLowerCase().includes('cnpj'))) {
        continue;
      }

      const ultimaVirgula = linha.lastIndexOf(',');
      if (ultimaVirgula === -1) continue;

      const destinatario = linha.substring(0, ultimaVirgula).trim();
      let cnpj = linha.substring(ultimaVirgula + 1).trim();
      cnpj = cnpj.replace(/[^\d]/g, '');

      if (!destinatario) continue;

      const id = cnpj || Date.now().toString();

      const agendamento = {
        id: id,
        destinatario: destinatario,
        cnpj: cnpj,
        criadoEm: new Date().toISOString()
      };

      novosAgendamentos.push(agendamento);
      const docRef = window.db.collection('agendamentos').doc(id);
      batch.set(docRef, agendamento, { merge: true });
      operacoes++;

      if (operacoes === MAX_BATCH_SIZE) {
        await batch.commit();
        operacoes = 0;
      }
    }

    if (operacoes > 0) {
      await batch.commit();
    }

    novosAgendamentos.forEach(a => this.agendamentos.set(a.id, a));
    this.saveToStorage();

    return novosAgendamentos;
  }

  extrairUfDoDestinatario(destinatario) {
    const ufMap = {
      'SAO PAULO': 'SP',
      'RIO DE JANEIRO': 'RJ',
      'MINAS GERAIS': 'MG',
      'BAHIA': 'BA',
      'PARANA': 'PR',
      'RIO GRANDE DO SUL': 'RS',
      'SANTA CATARINA': 'SC',
    };

    for (const [nome, uf] of Object.entries(ufMap)) {
      if (destinatario.includes(nome)) {
        return uf;
      }
    }

    const ufMatch = destinatario.match(/\b(SP|RJ|MG|RS|SC|PR|BA|DF|GO|ES|PE|CE|RN|PB|MA|PA|AM|AC|RO|RR|TO|MT|MS|AL|SE|PI|AP)\b/);
    return ufMatch ? ufMatch[1] : '';
  }

  extrairHubDoDestinatario(destinatario) {
    const primeiraPalavra = destinatario.split(/\s+/)[0];
    return primeiraPalavra.substring(0, 4).replace(/[^\w]/g, '');
  }

  async limparTodos() {
    if (!window.db) return;

    try {
      const snapshot = await window.db.collection('agendamentos').get();

      if (snapshot.empty) {
        alert('Firebase já está vazio!');
        return;
      }

      const batch = window.db.batch();
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      this.agendamentos.clear();
      this.saveToStorage();

      alert(`✅ ${snapshot.size} agendamentos removidos com sucesso!`);

    } catch (error) {
      alert('Erro ao limpar: ' + error.message);
    }
  }

  async delete(id) {
    this.agendamentos.delete(id);
    this.saveToStorage();

    try {
      await window.db.collection('agendamentos').doc(id).delete();
    } catch (e) {
    }
  }

  loadFromStorage() {
    const saved = localStorage.getItem('agendamentos');
    if (saved) {
      try {
        const lista = JSON.parse(saved);
        lista.forEach(a => this.processarAgendamento(a));
      } catch (e) {
      }
    }
  }

  saveToStorage() {
    const lista = Array.from(this.agendamentos.values());
    localStorage.setItem('agendamentos', JSON.stringify(lista));
  }

  listar(busca = '') {
    let lista = Array.from(this.agendamentos.values());

    if (busca) {
      lista = lista.filter(a => {
        const textoBusca = (a.destinatario || a.displayString || '').toLowerCase();
        return textoBusca.includes(busca.toLowerCase());
      });
    }

    lista.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    return lista;
  }

  async verificarAgendamento(recebedor, hub, estado) {
    recebedor = (recebedor || '').toUpperCase().trim();
    hub = (hub || '').toUpperCase().trim();
    estado = (estado || '').toUpperCase().trim();

    for (let [id, agendamento] of this.agendamentos.entries()) {
      if (agendamento.recebedor === recebedor &&
        agendamento.hub === hub &&
        agendamento.uf === estado) {
        return true;
      }
    }
    return false;
  }

  async resetTotal() {
    localStorage.clear();
    this.agendamentos.clear();

    if (window.db) {
      try {
        const snapshot = await window.db.collection('agendamentos').get();

        if (snapshot.empty) {
          alert('Firebase já vazio!');
          return;
        }

        const batch = window.db.batch();
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();

        alert(`✅ ${snapshot.size} agendamentos removidos!\nPágina recarregando...`);
        setTimeout(() => location.reload(), 2000);

      } catch (error) {
        alert('Erro ao resetar: ' + error.message);
      }
    }
  }
}
