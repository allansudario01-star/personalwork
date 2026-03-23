class AgendamentoService {
  constructor() {
    this.agendamentos = new Map();
    this.cacheSize = 100; // Limite máximo de registros em cache
    this.lastDoc = null;
    this.hasNextPage = true;
    this.isLoading = false;

    this.loadFromStorage();
    this.setupRealtimeListener();
  }

  // ========== CONFIGURAÇÃO INICIAL ==========

  setupRealtimeListener() {
    if (!window.db) return;

    // Usar onSnapshot apenas para documentos ativos recentes
    // com limit para reduzir reads
    window.db.collection('agendamentos')
      .orderBy('criadoEm', 'desc')
      .limit(50) // Limita a 50 documentos em tempo real
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();

          if (change.type === 'added' || change.type === 'modified') {
            this.processarAgendamento(data);
          }
          if (change.type === 'removed') {
            this.agendamentos.delete(change.doc.id);
          }
        });

        this.saveToStorage();
        if (window.renderizarAgendamentos) window.renderizarAgendamentos();
        if (window.renderizarPallets) window.renderizarPallets();
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

    // Usar ID gerado pelo Firebase se existir
    a.id = a.id || `${a.uf}-${a.hub}-${a.recebedor}-${a.tipo}`.replace(/\s/g, '_');
    a.displayString = `${a.uf}/${a.hub}/${a.recebedor}/${a.tipo}`;

    this.agendamentos.set(a.id, a);

    // Controlar tamanho do cache
    if (this.agendamentos.size > this.cacheSize) {
      this.limparCacheAntigo();
    }
  }

  limparCacheAntigo() {
    // Remove os registros mais antigos mantendo apenas os mais recentes
    const sorted = Array.from(this.agendamentos.values())
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

    const manter = sorted.slice(0, this.cacheSize);
    this.agendamentos.clear();
    manter.forEach(a => this.agendamentos.set(a.id, a));
  }

  // ========== PAGINAÇÃO ==========

  async carregarMais() {
    if (this.isLoading || !this.hasNextPage) return;

    this.isLoading = true;

    try {
      let query = window.db.collection('agendamentos')
        .orderBy('criadoEm', 'desc')
        .limit(30); // 30 documentos por página

      if (this.lastDoc) {
        query = query.startAfter(this.lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        this.hasNextPage = false;
        return;
      }

      this.lastDoc = snapshot.docs[snapshot.docs.length - 1];

      snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        this.processarAgendamento(data);
      });

      this.saveToStorage();

    } catch (error) {
      console.error('Erro ao carregar mais:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // ========== CRUD OPERATIONS ==========

  async create(uf, hub, recebedor, tipo = 'PADRÃO') {
    uf = uf.toUpperCase().trim();
    hub = hub.toUpperCase().trim();
    recebedor = recebedor.toUpperCase().trim();
    tipo = tipo.toUpperCase().trim();

    // Usar ID mais confiável baseado nos dados
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
      // Usar set com merge para evitar sobrescrever dados existentes
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

  // ========== IMPORTAÇÃO OTIMIZADA (BATCH WRITE) ==========

  async importarDoExcel(conteudoCSV) {
    const linhas = conteudoCSV.split('\n');
    const resultados = [];
    const batch = window.db.batch();
    let operacoes = 0;
    const MAX_BATCH_SIZE = 500; // Firestore batch limit

    // Primeiro, processar todas as linhas
    const novosAgendamentos = [];

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

        const id = `${uf.toUpperCase()}-${hub.toUpperCase()}-${recebedor.toUpperCase()}-${tipo.toUpperCase()}`.replace(/\s/g, '_');

        const agendamento = {
          id,
          uf: uf.toUpperCase(),
          hub: hub.toUpperCase(),
          recebedor: recebedor.toUpperCase(),
          tipo: tipo.toUpperCase(),
          displayString: `${uf.toUpperCase()}/${hub.toUpperCase()}/${recebedor.toUpperCase()}/${tipo.toUpperCase()}`,
          criadoEm: new Date().toISOString()
        };

        novosAgendamentos.push(agendamento);
      }
    }

    // Executar em batches para otimizar
    for (let i = 0; i < novosAgendamentos.length; i++) {
      const agendamento = novosAgendamentos[i];
      const docRef = window.db.collection('agendamentos').doc(agendamento.id);
      batch.set(docRef, agendamento, { merge: true });
      operacoes++;

      // Commit quando atingir o limite ou for o último
      if (operacoes === MAX_BATCH_SIZE || i === novosAgendamentos.length - 1) {
        await batch.commit();
        operacoes = 0;

        // Atualizar cache local
        for (let j = i - (operacoes === 0 ? MAX_BATCH_SIZE - 1 : 0); j <= i; j++) {
          if (novosAgendamentos[j]) {
            this.agendamentos.set(novosAgendamentos[j].id, novosAgendamentos[j]);
          }
        }
      }
    }

    this.saveToStorage();
    return novosAgendamentos;
  }

  // ========== DELEÇÃO OTIMIZADA (BATCH DELETE) ==========

  async limparTodos() {
    console.log('🔴 INICIANDO LIMPEZA OTIMIZADA...');

    if (!window.db) {
      console.error('Firestore não disponível');
      return;
    }

    try {
      // Usar paginação para deletar em batches
      let hasMore = true;
      let totalDeletados = 0;
      const BATCH_SIZE = 100;

      while (hasMore) {
        const snapshot = await window.db.collection('agendamentos')
          .limit(BATCH_SIZE)
          .get();

        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        const batch = window.db.batch();
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
          totalDeletados++;
        });

        await batch.commit();
        console.log(`✅ Deletados ${totalDeletados} documentos...`);
      }

      // Limpar cache local
      this.agendamentos.clear();
      this.saveToStorage();

      console.log(`✅ ${totalDeletados} agendamentos removidos com sucesso!`);
      alert(`✅ ${totalDeletados} agendamentos removidos com sucesso!\n\nFirebase e localStorage foram completamente limpos.`);

    } catch (error) {
      console.error('❌ Erro ao limpar Firebase: ', error);
      alert('Erro ao limpar Firebase: ' + error.message);
    }
  }

  async delete(id) {
    this.agendamentos.delete(id);
    this.saveToStorage();

    try {
      await window.db.collection('agendamentos').doc(id).delete();
      console.log('✅ Deletado do Firebase:', id);
    } catch (e) {
      console.log('Offline: agendamento removido localmente');
    }
  }

  // ========== CACHE E ARMAZENAMENTO ==========

  loadFromStorage() {
    const saved = localStorage.getItem('agendamentos');
    if (saved) {
      try {
        const lista = JSON.parse(saved);
        // Limitar ao carregar do cache
        const limitados = lista.slice(0, this.cacheSize);
        limitados.forEach(a => this.processarAgendamento(a));
        console.log(`📦 Carregado do localStorage: ${limitados.length} registros`);
      } catch (e) {
        console.log('Erro ao carregar agendamentos:', e);
      }
    }
  }

  saveToStorage() {
    // Armazenar apenas os registros mais recentes
    const sorted = Array.from(this.agendamentos.values())
      .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

    const toStore = sorted.slice(0, this.cacheSize);
    localStorage.setItem('agendamentos', JSON.stringify(toStore));
  }

  // ========== CONSULTAS ==========

  listar(busca = '') {
    let lista = Array.from(this.agendamentos.values());

    if (busca) {
      lista = lista.filter(a =>
        a.displayString.toLowerCase().includes(busca.toLowerCase())
      );
    }

    // Ordenar por data de criação
    lista.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

    return lista;
  }

  async verificarAgendamento(recebedor, hub, estado) {
    recebedor = (recebedor || '').toUpperCase().trim();
    hub = (hub || '').toUpperCase().trim();
    estado = (estado || '').toUpperCase().trim();

    // Primeiro verificar no cache
    for (let [id, agendamento] of this.agendamentos.entries()) {
      if (agendamento.recebedor === recebedor &&
        agendamento.hub === hub &&
        agendamento.uf === estado) {
        return true;
      }
    }

    // Se não encontrar no cache, buscar no Firestore
    try {
      const querySnapshot = await window.db.collection('agendamentos')
        .where('recebedor', '==', recebedor)
        .where('hub', '==', hub)
        .where('uf', '==', estado)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        this.processarAgendamento(doc.data());
        return true;
      }
    } catch (error) {
      console.error('Erro ao verificar agendamento:', error);
    }

    return false;
  }

  // ========== RESET TOTAL ==========

  async resetTotal() {
    console.log('⚠️⚠️⚠️ RESET TOTAL INICIADO ⚠️⚠️⚠️');

    // Limpar localStorage
    localStorage.clear();
    this.agendamentos.clear();

    if (window.db) {
      try {
        let deletados = 0;
        let hasMore = true;
        const BATCH_SIZE = 100;

        while (hasMore) {
          const snapshot = await window.db.collection('agendamentos')
            .limit(BATCH_SIZE)
            .get();

          if (snapshot.empty) {
            hasMore = false;
            break;
          }

          const batch = window.db.batch();
          snapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deletados++;
          });

          await batch.commit();
          console.log(`🗑️ Deletados ${deletados} documentos...`);
        }

        console.log(`✅ ${deletados} documentos deletados do Firebase!`);
        alert(`✅ RESET TOTAL COMPLETO!\n\n${deletados} agendamentos foram removidos do Firebase e localStorage.\n\nA página será recarregada em 3 segundos...`);

        setTimeout(() => {
          location.reload();
        }, 3000);

      } catch (error) {
        console.error('❌ Erro ao resetar Firebase: ', error);
        alert('Erro ao resetar Firebase: ' + error.message);
      }
    }
  }
}
