class AgendamentoService {
  constructor() {
    this.agendamentos = new Map();
    this.carregando = false;

    this.loadFromStorage();
    this.carregarTodosDoFirestore(); // Carrega TUDO na inicialização
    this.setupRealtimeListener();
  }

  // ========== CARREGAR TODOS OS AGENDAMENTOS ==========

  async carregarTodosDoFirestore() {
    if (this.carregando) return;

    this.carregando = true;
    console.log('📥 Carregando TODOS os agendamentos...');

    try {
      const snapshot = await window.db.collection('agendamentos').get();

      console.log(`📦 Encontrados ${snapshot.size} agendamentos no Firebase`);

      snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        this.processarAgendamento(data);
      });

      this.saveToStorage();
      console.log(`✅ ${this.agendamentos.size} agendamentos carregados!`);

      // Atualizar interface
      if (window.renderizarAgendamentos) window.renderizarAgendamentos();
      if (window.atualizarStats) window.atualizarStats();

    } catch (error) {
      console.error('❌ Erro ao carregar agendamentos:', error);
    } finally {
      this.carregando = false;
    }
  }

  // ========== REALTIME APENAS PARA ATUALIZAÇÕES ==========

  setupRealtimeListener() {
    if (!window.db) return;

    // Escuta apenas mudanças (não carrega tudo de novo)
    window.db.collection('agendamentos')
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          data.id = change.doc.id;

          if (change.type === 'added') {
            console.log('➕ Novo agendamento adicionado:', data.displayString);
            this.processarAgendamento(data);
          }

          if (change.type === 'modified') {
            console.log('✏️ Agendamento modificado:', data.displayString);
            this.processarAgendamento(data);
          }

          if (change.type === 'removed') {
            console.log('🗑️ Agendamento removido:', change.doc.id);
            this.agendamentos.delete(change.doc.id);
          }
        });

        this.saveToStorage();
        if (window.renderizarAgendamentos) window.renderizarAgendamentos();
        if (window.atualizarStats) window.atualizarStats();
      }, (error) => {
        console.error('Erro no listener:', error);
      });
  }

  // ========== PROCESSAMENTO DE DADOS ==========

  processarAgendamento(a) {
    a.uf = (a.uf || '').toUpperCase().trim();
    a.hub = (a.hub || '').toUpperCase().trim();
    a.recebedor = (a.recebedor || '').toUpperCase().trim();
    a.tipo = (a.tipo || 'PADRÃO').toUpperCase().trim();

    a.id = a.id || `${a.uf}-${a.hub}-${a.recebedor}-${a.tipo}`.replace(/\s/g, '_');
    a.displayString = `${a.uf}/${a.hub}/${a.recebedor}/${a.tipo}`;

    this.agendamentos.set(a.id, a);
  }

  // ========== CRUD OPERATIONS ==========

  async create(uf, hub, recebedor, tipo = 'PADRÃO') {
    uf = uf.toUpperCase().trim();
    hub = hub.toUpperCase().trim();
    recebedor = recebedor.toUpperCase().trim();
    tipo = tipo.toUpperCase().trim();

    const baseId = `${uf}-${hub}-${recebedor}-${tipo}`.replace(/\s/g, '_');

    const novo = {
      uf,
      hub,
      recebedor,
      tipo,
      displayString: `${uf}/${hub}/${recebedor}/${tipo}`,
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
      console.error('Erro ao criar agendamento:', error);
      throw error;
    }
  }

  // ========== IMPORTAÇÃO OTIMIZADA ==========

  async importarDoExcel(conteudoCSV) {
    const linhas = conteudoCSV.split('\n');
    const batch = window.db.batch();
    let operacoes = 0;
    const MAX_BATCH_SIZE = 500;

    const novosAgendamentos = [];

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i].trim();
      if (!linha || linha.startsWith('UF') || linha.startsWith('uf')) continue;

      const partes = linha.split(',').map(item => item.trim());
      if (partes.length >= 3) {
        const uf = partes[0].toUpperCase();
        const hub = partes[1].toUpperCase();
        const recebedor = partes[2].toUpperCase();
        const tipo = partes.length >= 4 ? partes[3].toUpperCase() : 'PADRÃO';

        const id = `${uf}-${hub}-${recebedor}-${tipo}`.replace(/\s/g, '_');

        const agendamento = {
          id,
          uf,
          hub,
          recebedor,
          tipo,
          displayString: `${uf}/${hub}/${recebedor}/${tipo}`,
          criadoEm: new Date().toISOString()
        };

        novosAgendamentos.push(agendamento);
        const docRef = window.db.collection('agendamentos').doc(id);
        batch.set(docRef, agendamento, { merge: true });
        operacoes++;

        if (operacoes === MAX_BATCH_SIZE || i === linhas.length - 1) {
          await batch.commit();
          operacoes = 0;
        }
      }
    }

    // Atualizar cache
    novosAgendamentos.forEach(a => this.agendamentos.set(a.id, a));
    this.saveToStorage();

    return novosAgendamentos;
  }

  // ========== DELEÇÃO EM MASSA ==========

  async limparTodos() {
    console.log('🔴 LIMPANDO TODOS AGENDAMENTOS...');

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

      // Limpar cache
      this.agendamentos.clear();
      this.saveToStorage();

      console.log(`✅ ${snapshot.size} agendamentos removidos!`);
      alert(`✅ ${snapshot.size} agendamentos removidos com sucesso!`);

    } catch (error) {
      console.error('❌ Erro ao limpar:', error);
      alert('Erro ao limpar: ' + error.message);
    }
  }

  async delete(id) {
    this.agendamentos.delete(id);
    this.saveToStorage();

    try {
      await window.db.collection('agendamentos').doc(id).delete();
    } catch (e) {
      console.log('Offline: removido localmente');
    }
  }

  // ========== CACHE ==========

  loadFromStorage() {
    const saved = localStorage.getItem('agendamentos');
    if (saved) {
      try {
        const lista = JSON.parse(saved);
        lista.forEach(a => this.processarAgendamento(a));
        console.log(`📦 Carregado ${lista.length} do localStorage`);
      } catch (e) {
        console.log('Erro ao carregar:', e);
      }
    }
  }

  saveToStorage() {
    const lista = Array.from(this.agendamentos.values());
    localStorage.setItem('agendamentos', JSON.stringify(lista));
  }

  // ========== CONSULTAS ==========

  listar(busca = '') {
    let lista = Array.from(this.agendamentos.values());

    if (busca) {
      lista = lista.filter(a =>
        a.displayString.toLowerCase().includes(busca.toLowerCase())
      );
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

  // ========== RESET TOTAL ==========

  async resetTotal() {
    console.log('⚠️ RESET TOTAL...');

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
        console.error('Erro:', error);
        alert('Erro ao resetar: ' + error.message);
      }
    }
  }
}
