document.addEventListener('DOMContentLoaded', function () {
  console.log('Iniciando app...');

  // Verificar se db existe
  if (typeof window.db === 'undefined') {
    console.error('ERRO: db não definido! Firebase não carregou?');
    return;
  }

  // Criar os serviços
  window.palletService = new PalletService();
  window.agendamentoService = new AgendamentoService();

  // Configurar a interface
  configurarTabs();
  configurarBotoes();
  configurarGridPosicoes();

  // Mostrar dados
  renderizarPallets();
  renderizarAgendamentos();

  // Verificar internet
  window.addEventListener('online', () => {
    document.getElementById('offline-banner').classList.add('hidden');
  });

  window.addEventListener('offline', () => {
    document.getElementById('offline-banner').classList.remove('hidden');
  });

  function configurarTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + '-tab').classList.add('active');
      });
    });
  }

  function configurarBotoes() {
    // Criar pallet
    document.getElementById('create-pallet-btn').addEventListener('click', () => {
      document.getElementById('pallet-form').reset();
      document.getElementById('pallet-modal').classList.remove('hidden');
    });

    // Fechar modal
    document.getElementById('close-modal').addEventListener('click', () => {
      document.getElementById('pallet-modal').classList.add('hidden');
    });

    // Salvar pallet
    document.getElementById('pallet-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const dados = {
        notaFiscal: document.getElementById('nf').value,
        recebedor: document.getElementById('recebedor').value,
        hub: document.getElementById('hub').value,
        estado: document.getElementById('estado').value.toUpperCase(),
        cidade: document.getElementById('cidade').value,
        maxVolumes: parseInt(document.getElementById('maxVolumes').value),
        palletPosicao: document.getElementById('palletPosicao').value
      };

      if (!dados.palletPosicao) {
        alert('Selecione uma posição');
        return;
      }

      await window.palletService.create(dados);
      document.getElementById('pallet-modal').classList.add('hidden');
      renderizarPallets();
    });

    // Filtros
    document.getElementById('position-filter').addEventListener('change', renderizarPallets);
    document.getElementById('search-nf').addEventListener('input', renderizarPallets);
  }

  function configurarGridPosicoes() {
    const grid = document.getElementById('position-grid');
    const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

    let html = '';
    letras.forEach(letra => {
      for (let i = 1; i <= 5; i++) {
        html += `<button type="button" class="position-btn" data-pos="${letra}${i}">${letra}${i}</button>`;
      }
    });

    grid.innerHTML = html;

    grid.querySelectorAll('.position-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.position-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('palletPosicao').value = btn.dataset.pos;
      });
    });
  }

  function renderizarPallets() {
    const filtro = document.getElementById('position-filter').value;
    const busca = document.getElementById('search-nf').value;

    const pallets = window.palletService.listar(filtro, busca);
    const lista = document.getElementById('pallets-list');

    if (pallets.length === 0) {
      lista.innerHTML = '<div style="text-align: center; padding: 50px;">Nenhum pallet ativo</div>';
      return;
    }

    let html = '';
    pallets.forEach(p => {
      const progresso = (p.volumesAtuais / p.maxVolumes) * 100;
      const agendado = window.agendamentoService.verificar(p.recebedor, p.hub, p.estado);
      const completo = p.volumesAtuais >= p.maxVolumes;

      html += `
            <div class="pallet-card ${agendado ? 'agendado' : ''}">
                <div style="display: flex; justify-content: space-between;">
                    <span class="nf-tag">NF ${p.notaFiscal}</span>
                    ${agendado ? '<span class="agendado-badge">AGENDADO</span>' : ''}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
                    <div><small>Recebedor</small><br><strong>${p.recebedor}</strong></div>
                    <div><small>Hub/UF</small><br><strong>${p.hub} - ${p.estado}</strong></div>
                    <div><small>Cidade</small><br><strong>${p.cidade}</strong></div>
                    <div><small>Posição</small><br><strong>${p.palletPosicao}</strong></div>
                </div>

                <div>
                    <span class="volume-display">${p.volumesAtuais}</span>
                    <span>/ ${p.maxVolumes}</span>

                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progresso}%"></div>
                    </div>

                    ${completo ? '<div class="completo-alert">✅ PALLET COMPLETO</div>' : ''}
                </div>

                <div class="card-actions">
                    <button onclick="abrirModalVolumes('${p.id}')">Ajustar</button>
                    <button onclick="finalizarPallet('${p.id}')">Finalizar</button>
                </div>
            </div>
        `;
    });

    lista.innerHTML = html;
  }

  function renderizarAgendamentos() {
    const lista = document.getElementById('agendamentos-list');
    const agendamentos = window.agendamentoService.listar();

    if (agendamentos.length === 0) {
      lista.innerHTML = '<div style="text-align: center; padding: 20px;">Nenhum agendamento</div>';
      return;
    }

    let html = '';
    agendamentos.forEach(a => {
      html += `
            <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 8px; display: flex; justify-content: space-between;">
                <span>${a.recebedor} | ${a.hub} | ${a.estado}</span>
                <button onclick="deletarAgendamento('${a.id}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 5px;">🗑️</button>
            </div>
        `;
    });

    lista.innerHTML = html;
  }

  // Funções globais (chamadas pelos botões)
  window.abrirModalVolumes = function (id) {
    const p = window.palletService.pallets.get(id);
    if (!p) return;

    window.palletAtual = id;
    document.getElementById('volume-info').innerHTML = `
        <strong>NF ${p.notaFiscal}</strong><br>
        Posição: ${p.palletPosicao}<br>
        Atual: ${p.volumesAtuais} / ${p.maxVolumes}
    `;
    document.getElementById('manual-volume').value = p.volumesAtuais;
    document.getElementById('volume-modal').classList.remove('hidden');
  };

  window.finalizarPallet = function (id) {
    if (confirm('Finalizar este pallet?')) {
      window.palletService.finalizar(id);
      renderizarPallets();
    }
  };

  window.deletarAgendamento = function (id) {
    if (confirm('Remover agendamento?')) {
      window.agendamentoService.delete(id);
      renderizarAgendamentos();
    }
  };

  // Botões do modal de volumes
  document.querySelectorAll('.btn-volume').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const valor = parseInt(e.target.dataset.value);
      const atual = parseInt(document.getElementById('manual-volume').value) || 0;
      document.getElementById('manual-volume').value = Math.max(0, atual + valor);
    });
  });

  document.getElementById('save-volume').addEventListener('click', async () => {
    if (!window.palletAtual) return;

    const novos = parseInt(document.getElementById('manual-volume').value) || 0;
    await window.palletService.updateVolumes(window.palletAtual, novos);
    document.getElementById('volume-modal').classList.add('hidden');
    renderizarPallets();
  });

  document.getElementById('finalize-pallet').addEventListener('click', () => {
    if (window.palletAtual) {
      finalizarPallet(window.palletAtual);
      document.getElementById('volume-modal').classList.add('hidden');
    }
  });

  document.getElementById('close-volume-modal').addEventListener('click', () => {
    document.getElementById('volume-modal').classList.add('hidden');
  });

  // Configurar agendamentos
  document.getElementById('create-agendamento-btn').addEventListener('click', () => {
    document.getElementById('agendamento-form').classList.remove('hidden');
  });

  document.getElementById('cancel-agendamento').addEventListener('click', () => {
    document.getElementById('agendamento-form').classList.add('hidden');
  });

  document.getElementById('agendamento-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    await window.agendamentoService.create(
      document.getElementById('ag-recebedor').value,
      document.getElementById('ag-hub').value,
      document.getElementById('ag-estado').value.toUpperCase()
    );

    e.target.reset();
    document.getElementById('agendamento-form').classList.add('hidden');
    renderizarAgendamentos();
  });

  // Função para importar agendamentos
  window.importarAgendamentos = async function () {
    const dados = [
      { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "SOR", estado: "SP" },
      { recebedor: "IGESP SA CTO MED CIR INST GASTROENT", hub: "SAO", estado: "SP" },
      // ... (coloque aqui todos os dados da planilha)
    ];

    await window.agendamentoService.importarDaPlanilha(dados);
    alert('Agendamentos importados!');
    renderizarAgendamentos();
  };
});
