document.addEventListener('DOMContentLoaded', function () {
  console.log('🚀 Iniciando Pallet System Mobile...');

  if (typeof window.db === 'undefined') {
    console.error('❌ ERRO: Firebase não carregado!');
    mostrarErroFirebase();
    return;
  }

  window.palletService = new PalletService();
  window.agendamentoService = new AgendamentoService();

  configurarInterface();
  configurarTabs();
  configurarBotoes();
  configurarGridPosicoes();
  configurarModals();

  renderizarPallets();
  renderizarAgendamentos();
  renderizarFinalizados();

  configurarMonitorConexao();

  function mostrarErroFirebase() {
    const main = document.querySelector('main');
    main.innerHTML = `
            <div style="
                background: #e74c3c;
                color: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                margin: 20px;
            ">
                <h2>❌ Erro de Conexão</h2>
                <p>Não foi possível conectar ao Firebase.</p>
                <p>Verifique sua internet e recarregue a página.</p>
                <button onclick="location.reload()" style="
                    background: white;
                    color: #e74c3c;
                    border: none;
                    padding: 15px 30px;
                    border-radius: 10px;
                    margin-top: 20px;
                    font-size: 16px;
                ">Recarregar</button>
            </div>
        `;
  }

  function configurarInterface() {

    const metaViewport = document.querySelector('meta[name=viewport]');
    metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes, viewport-fit=cover';

    document.querySelectorAll('input').forEach(input => {
      input.addEventListener('focus', () => {
        input.style.fontSize = '16px';
      });
    });
  }

  function configurarTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        e.target.classList.add('active');
        document.getElementById(tabName + '-tab').classList.add('active');

        if (tabName === 'finalizados') {
          renderizarFinalizados();
        }
      });
    });
  }

  function configurarBotoes() {

    document.getElementById('create-pallet-btn').addEventListener('click', () => {
      document.getElementById('pallet-form').reset();
      document.getElementById('pallet-modal').classList.remove('hidden');
    });

    document.getElementById('close-modal').addEventListener('click', () => {
      document.getElementById('pallet-modal').classList.add('hidden');
    });

    document.getElementById('pallet-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const posicao = document.getElementById('palletPosicao').value;
      if (!posicao) {
        alert('❌ Selecione uma posição');
        return;
      }

      const dados = {
        notaFiscal: document.getElementById('nf').value,
        recebedor: document.getElementById('recebedor').value.toUpperCase().trim(),
        hub: document.getElementById('hub').value.toUpperCase().trim(),
        estado: document.getElementById('estado').value.toUpperCase().trim(),
        cidade: document.getElementById('cidade').value.toUpperCase().trim(),
        maxVolumes: parseInt(document.getElementById('maxVolumes').value),
        palletPosicao: posicao
      };

      const pallet = await window.palletService.create(dados);

      document.getElementById('pallet-modal').classList.add('hidden');

      renderizarPallets();

      const isAgendado = window.agendamentoService.verificar(
        dados.recebedor,
        dados.hub,
        dados.estado
      );

      setTimeout(() => {
        window.palletService.imprimirEtiqueta(pallet, isAgendado);
      }, 100);
    });

    document.getElementById('position-filter').addEventListener('change', renderizarPallets);
    document.getElementById('search-nf').addEventListener('input', debounce(renderizarPallets, 300));

    document.getElementById('search-finalizados')?.addEventListener('input',
      debounce(renderizarFinalizados, 300)
    );

    document.getElementById('clear-history')?.addEventListener('click', () => {
      if (confirm('⚠️ Limpar todo o histórico de pallets finalizados?')) {
        window.palletService.limparHistorico();
        renderizarFinalizados();
      }
    });

    document.getElementById('create-agendamento-btn').addEventListener('click', () => {
      document.getElementById('agendamento-form').classList.remove('hidden');
    });

    document.getElementById('cancel-agendamento').addEventListener('click', () => {
      document.getElementById('agendamento-form').classList.add('hidden');
    });

    document.getElementById('agendamento-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      await window.agendamentoService.create(
        document.getElementById('ag-uf').value,
        document.getElementById('ag-hub').value,
        document.getElementById('ag-recebedor').value,
        document.getElementById('ag-tipo').value
      );

      e.target.reset();
      document.getElementById('agendamento-form').classList.add('hidden');
      renderizarAgendamentos();
    });

    document.getElementById('clear-agendamentos-btn').addEventListener('click', () => {
      if (confirm('⚠️ Limpar TODOS os agendamentos?')) {
        window.agendamentoService.limparTodos();
        renderizarAgendamentos();
      }
    });

    document.getElementById('import-excel-btn').addEventListener('click', importarExcel);
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

  function configurarModals() {

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
        document.getElementById('volume-modal').classList.add('hidden');
        document.getElementById('finalizar-modal').classList.remove('hidden');
      }
    });

    document.getElementById('close-volume-modal').addEventListener('click', () => {
      document.getElementById('volume-modal').classList.add('hidden');
    });

    ddocument.getElementById('confirm-finalizar-sim').addEventListener('click', async () => {
      if (window.palletAtual) {
        await window.palletService.finalizar(window.palletAtual, true);
        document.getElementById('finalizar-modal').classList.add('hidden');
        renderizarPallets();
        renderizarFinalizados();
      }
    });

    document.getElementById('confirm-finalizar-nao').addEventListener('click', async () => {
      if (window.palletAtual) {
        await window.palletService.finalizar(window.palletAtual, false);
        document.getElementById('finalizar-modal').classList.add('hidden');
        renderizarPallets();
        renderizarFinalizados();

        setTimeout(() => {
          alert('⚠️ ATENÇÃO: Este pallet foi marcado como NÃO BIPADO!\nLembre-se de bipar os volumes antes do carregamento.');
        }, 300);
      }
    });

    document.getElementById('confirm-finalizar-nao-precisa').addEventListener('click', async () => {
      if (window.palletAtual) {

        await window.palletService.finalizar(window.palletAtual, 'nao_precisa');
        document.getElementById('finalizar-modal').classList.add('hidden');
        renderizarPallets();
        renderizarFinalizados();
      }
    });

    document.getElementById('cancel-finalizar').addEventListener('click', () => {
      document.getElementById('finalizar-modal').classList.add('hidden');
    });
  }

  function configurarMonitorConexao() {
    window.addEventListener('online', () => {
      document.getElementById('offline-banner').classList.add('hidden');
    });

    window.addEventListener('offline', () => {
      document.getElementById('offline-banner').classList.remove('hidden');
    });
  }

  window.abrirModalVolumes = function (id) {
    const p = window.palletService.pallets.get(id);
    if (!p) return;

    window.palletAtual = id;
    document.getElementById('volume-info').innerHTML = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <strong style="font-size: 18px;">NF ${p.notaFiscal}</strong><br>
                <div style="margin-top: 10px;">
                    <span>Posição: <strong>${p.palletPosicao}</strong></span><br>
                    <span>Volumes: <strong>${p.volumesAtuais} / ${p.maxVolumes}</strong></span>
                </div>
            </div>
        `;
    document.getElementById('manual-volume').value = p.volumesAtuais;
    document.getElementById('volume-modal').classList.remove('hidden');
  };

  window.finalizarPallet = function (id) {
    const p = window.palletService.pallets.get(id);
    if (!p) return;

    window.palletAtual = id;
    document.getElementById('finalizar-modal').classList.remove('hidden');
  };

  window.deletarAgendamento = function (id) {
    if (confirm('🗑️ Remover este agendamento?')) {
      window.agendamentoService.delete(id);
      renderizarAgendamentos();
    }
  };

  window.reimprimirEtiqueta = function (id) {
    const pallet = window.palletService.finalizados.get(id);
    if (!pallet) return;

    const isAgendado = window.agendamentoService.verificar(
      pallet.recebedor,
      pallet.hub,
      pallet.estado
    );

    window.palletService.imprimirEtiqueta(pallet, isAgendado);
  };

  function renderizarPallets() {
    const filtro = document.getElementById('position-filter').value;
    const busca = document.getElementById('search-nf').value;

    const pallets = window.palletService.listar(filtro, busca);
    const lista = document.getElementById('pallets-list');

    console.log('📋 RENDERIZANDO PALLETS:', pallets.length);

    if (pallets.length === 0) {
      lista.innerHTML = '<div style="text-align: center; padding: 50px; color: #7f8c8d;">📦 Nenhum pallet ativo</div>';
      return;
    }

    let html = '';
    pallets.forEach(p => {
      const progresso = (p.volumesAtuais / p.maxVolumes) * 100;

      console.log('Verificando pallet:', {
        nf: p.notaFiscal,
        recebedor: p.recebedor,
        hub: p.hub,
        estado: p.estado,
        posicao: p.palletPosicao
      });

      const agendado = window.agendamentoService.verificar(
        p.recebedor,
        p.hub,
        p.estado
      );

      console.log('Resultado agendado:', agendado ? 'SIM' : 'NÃO');

      const completo = p.volumesAtuais >= p.maxVolumes;

      html += `
            <div class="pallet-card ${agendado ? 'agendado' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span class="nf-tag">NF ${p.notaFiscal}</span>
                    ${agendado ? '<span class="agendado-badge">📅 AGENDADO</span>' : '<span class="nao-agendado-badge">📦 NÃO AGENDADO</span>'}
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <small>Recebedor</small>
                        <strong>${p.recebedor}</strong>
                    </div>
                    <div class="info-item">
                        <small>Hub/UF</small>
                        <strong>${p.hub} - ${p.estado}</strong>
                    </div>
                    <div class="info-item">
                        <small>Cidade</small>
                        <strong>${p.cidade}</strong>
                    </div>
                    <div class="info-item">
                        <small>Posição</small>
                        <strong>${p.palletPosicao}</strong>
                    </div>
                </div>

                <div>
                    <span class="volume-display">${p.volumesAtuais}</span>
                    <span style="color: #7f8c8d;">/ ${p.maxVolumes}</span>

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
      lista.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">📋 Nenhum agendamento cadastrado</div>';
      return;
    }

    let html = '';
    agendamentos.forEach(a => {
      html += `
                <div class="agendamento-item">
                    <div class="agendamento-info">
                        ${a.displayString}
                        <small>${new Date(a.criadoEm).toLocaleDateString()}</small>
                    </div>
                    <button class="delete-agendamento" onclick="deletarAgendamento('${a.id}')">🗑️</button>
                </div>
            `;
    });

    lista.innerHTML = html;
  }

  function renderizarFinalizados() {
    const busca = document.getElementById('search-finalizados')?.value || '';
    const finalizados = window.palletService.listarFinalizados(busca);
    const lista = document.getElementById('finalizados-list');

    if (finalizados.length === 0) {
      lista.innerHTML = '<div style="text-align: center; padding: 50px; color: #7f8c8d;">📦 Nenhum pallet finalizado</div>';
      return;
    }

    let html = '';
    finalizados.forEach(p => {
      const dataFinalizacao = new Date(p.finalizadoEm).toLocaleDateString('pt-BR');

      // Determinar o badge de status de bipagem
      let badgeBipagem = '';
      if (p.statusBipagem === 'nao_precisa') {
        badgeBipagem = '<span class="finalizado-badge nao-precisa">⚪ NÃO PRECISA BIPAR</span>';
      } else if (p.bipado) {
        badgeBipagem = '<span class="finalizado-badge bipado">✅ BIPADO</span>';
      } else {
        badgeBipagem = '<span class="finalizado-badge nao-bipado">❌ PENDENTE</span>';
      }

      html += `
            <div class="finalizado-card">
                <div class="finalizado-header">
                    <span>NF ${p.notaFiscal}</span>
                    ${badgeBipagem}
                </div>

                <div class="finalizado-info">
                    <div><small>Recebedor</small><br>${p.recebedor}</div>
                    <div><small>Hub/UF</small><br>${p.hub} - ${p.estado}</div>
                    <div><small>Volumes</small><br>${p.volumesAtuais}/${p.maxVolumes}</div>
                    <div><small>Finalizado</small><br>${dataFinalizacao}</div>
                </div>

                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button onclick="reimprimirEtiqueta('${p.id}')" style="flex: 1; padding: 10px; background: #3498db; color: white; border: none; border-radius: 8px;">
                        🖨️ Reimprimir
                    </button>
                </div>
            </div>
        `;
    });

    lista.innerHTML = html;
  }

  async function importarExcel() {

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .txt, .xlsx';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const conteudo = event.target.result;
          const resultados = await window.agendamentoService.importarDoExcel(conteudo);

          alert(`✅ ${resultados.length} agendamentos importados com sucesso!`);
          renderizarAgendamentos();

        } catch (error) {
          alert('❌ Erro ao importar. Verifique o formato do arquivo.');
          console.error(error);
        }
      };

      reader.readAsText(file);
    };

    input.click();
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
});
