document.addEventListener('DOMContentLoaded', function () {

  if (typeof window.db === 'undefined') {
    mostrarErroFirebase();
    return;
  }

  window.palletService = new PalletService();
  window.agendamentoService = new AgendamentoService();

  window.palletService.setAgendamentoService(window.agendamentoService);

  configurarInterface();
  configurarTabs();
  configurarBotoes();
  configurarTema();

  renderizarPallets();
  renderizarDestinatarios();
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
    if (metaViewport) {
      metaViewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes, viewport-fit=cover';
    }
    document.querySelectorAll('input').forEach(input => {
      input.addEventListener('focus', () => {
        input.style.fontSize = '16px';
      });
    });
  }

  function configurarTema() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
      themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
      });
    }
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
        if (tabName === 'destinatarios') {
          renderizarDestinatarios();
        }
      });
    });
  }

  function resetFormularioPallet() {
    const nf = document.getElementById('nf');
    const recebedor = document.getElementById('recebedor');
    const embarcador = document.getElementById('embarcador');
    const estado = document.getElementById('estado');
    const cidade = document.getElementById('cidade');
    const regiao = document.getElementById('regiao');
    const subregiao = document.getElementById('subregiao');
    const maxVolumes = document.getElementById('maxVolumes');
    const diversosRegiao = document.getElementById('diversos-regiao');
    const diversosSubregiao = document.getElementById('diversos-subregiao');
    const diversosEstado = document.getElementById('diversos-estado');
    const diversosEmbarcador = document.getElementById('diversos-embarcador');
    const palletTipo = document.getElementById('pallet-tipo');

    if (nf) nf.value = '';
    if (recebedor) recebedor.value = '';
    if (embarcador) embarcador.value = '';
    if (estado) estado.value = '';
    if (cidade) cidade.value = '';
    if (regiao) regiao.value = '';
    if (subregiao) subregiao.value = '';
    if (maxVolumes) maxVolumes.value = '';
    if (diversosRegiao) diversosRegiao.value = '';
    if (diversosSubregiao) diversosSubregiao.value = '';
    if (diversosEstado) diversosEstado.value = '';
    if (diversosEmbarcador) diversosEmbarcador.value = 'DIVERSOS';
    if (palletTipo) palletTipo.value = 'VOLUMETRIA_ALTA';

    toggleCamposPorTipo();
  }

  function toggleCamposPorTipo() {
    const tipo = document.getElementById('pallet-tipo');
    if (!tipo) return;

    const volumetriaCampos = document.getElementById('volumetria-campos');
    const diversosCampos = document.getElementById('diversos-campos');

    if (tipo.value === 'VOLUMETRIA_ALTA') {
      if (volumetriaCampos) volumetriaCampos.style.display = 'block';
      if (diversosCampos) diversosCampos.style.display = 'none';
    } else {
      if (volumetriaCampos) volumetriaCampos.style.display = 'none';
      if (diversosCampos) diversosCampos.style.display = 'block';
    }
  }

  function atualizarDatalistDestinatarios() {
    const destinatarios = window.agendamentoService.listar();
    const datalist = document.getElementById('destinatarios-list-datalist');
    if (datalist) {
      datalist.innerHTML = '';
      destinatarios.forEach(d => {
        const option = document.createElement('option');
        option.value = d.destinatario;
        datalist.appendChild(option);
      });
    }
  }

  function configurarBotoes() {
    const createBtn = document.getElementById('create-pallet-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        resetFormularioPallet();
        atualizarDatalistDestinatarios();
        const modal = document.getElementById('pallet-modal');
        if (modal) modal.classList.remove('hidden');
      });
    }

    const palletTipo = document.getElementById('pallet-tipo');
    if (palletTipo) {
      palletTipo.addEventListener('change', toggleCamposPorTipo);
    }

    const closeModal = document.getElementById('close-modal');
    if (closeModal) {
      closeModal.addEventListener('click', () => {
        const modal = document.getElementById('pallet-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const palletForm = document.getElementById('pallet-form');
    if (palletForm) {
      palletForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const tipoSelect = document.getElementById('pallet-tipo');
        const tipo = tipoSelect ? tipoSelect.value : 'VOLUMETRIA_ALTA';
        let dados;

        if (tipo === 'VOLUMETRIA_ALTA') {
          const nf = document.getElementById('nf');
          const recebedor = document.getElementById('recebedor');
          const embarcador = document.getElementById('embarcador');
          const regiao = document.getElementById('regiao');
          const subregiao = document.getElementById('subregiao');
          const estado = document.getElementById('estado');
          const cidade = document.getElementById('cidade');
          const maxVolumes = document.getElementById('maxVolumes');

          dados = {
            notaFiscal: nf ? nf.value : '',
            recebedor: recebedor ? recebedor.value : '',
            embarcador: embarcador ? embarcador.value : '',
            regiao: regiao ? regiao.value : '',
            subregiao: subregiao ? subregiao.value : '',
            estado: estado ? estado.value : '',
            cidade: cidade ? cidade.value : '',
            maxVolumes: maxVolumes ? maxVolumes.value : ''
          };
        } else {
          const diversosRegiao = document.getElementById('diversos-regiao');
          const diversosSubregiao = document.getElementById('diversos-subregiao');
          const diversosEstado = document.getElementById('diversos-estado');

          dados = {
            regiao: diversosRegiao ? diversosRegiao.value : '',
            subregiao: diversosSubregiao ? diversosSubregiao.value : '',
            estado: diversosEstado ? diversosEstado.value : '',
            embarcador: 'DIVERSOS',
            notaFiscal: 'DIVERSOS',
            recebedor: 'DIVERSOS',
            cidade: 'DIVERSOS',
            maxVolumes: null
          };
        }

        await window.palletService.create(dados, tipo);
        const modal = document.getElementById('pallet-modal');
        if (modal) modal.classList.add('hidden');
        renderizarPallets();
      });
    }

    const closeAjustar = document.getElementById('close-ajustar-modal');
    if (closeAjustar) {
      closeAjustar.addEventListener('click', () => {
        const modal = document.getElementById('ajustar-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const searchNf = document.getElementById('search-nf');
    if (searchNf) {
      searchNf.addEventListener('input', debounce(renderizarPallets, 300));
    }

    const searchDestinatarios = document.getElementById('search-destinatarios');
    if (searchDestinatarios) {
      searchDestinatarios.addEventListener('input', debounce(renderizarDestinatarios, 300));
    }

    const searchFinalizados = document.getElementById('search-finalizados');
    if (searchFinalizados) {
      searchFinalizados.addEventListener('input', debounce(renderizarFinalizados, 300));
    }

    const clearHistory = document.getElementById('clear-history');
    if (clearHistory) {
      clearHistory.addEventListener('click', () => {
        if (confirm('⚠️ Limpar todo o histórico de pallets finalizados?')) {
          window.palletService.limparHistorico();
          renderizarFinalizados();
        }
      });
    }

    const saveVolume = document.getElementById('save-volume');
    if (saveVolume) {
      saveVolume.addEventListener('click', async () => {
        if (!window.palletAtual) return;
        const manualVolume = document.getElementById('manual-volume');
        const novosVolumes = parseInt(manualVolume ? manualVolume.value : 0) || 0;
        await window.palletService.updateVolumes(window.palletAtual, novosVolumes);
        const modal = document.getElementById('ajustar-modal');
        if (modal) modal.classList.add('hidden');
        renderizarPallets();
      });
    }

    const finalizeFromAjustar = document.getElementById('finalize-from-ajustar');
    if (finalizeFromAjustar) {
      finalizeFromAjustar.addEventListener('click', async () => {
        const pallet = window.palletService.pallets.get(window.palletAtual);
        if (!pallet) return;
        const ajustarModal = document.getElementById('ajustar-modal');
        if (ajustarModal) ajustarModal.classList.add('hidden');
        const finalizarModal = document.getElementById('finalizar-modal');
        if (finalizarModal) finalizarModal.classList.remove('hidden');
      });
    }

    const deleteFromAjustar = document.getElementById('delete-from-ajustar');
    if (deleteFromAjustar) {
      deleteFromAjustar.addEventListener('click', async () => {
        if (confirm('⚠️ Tem certeza que deseja excluir este pallet?')) {
          await window.palletService.excluir(window.palletAtual);
          const modal = document.getElementById('ajustar-modal');
          if (modal) modal.classList.add('hidden');
          renderizarPallets();
        }
      });
    }

    const confirmFinalizarSim = document.getElementById('confirm-finalizar-sim');
    if (confirmFinalizarSim) {
      confirmFinalizarSim.addEventListener('click', async () => {
        await finalizarPalletComConfirmacao(window.palletAtual, true);
      });
    }

    const confirmFinalizarNao = document.getElementById('confirm-finalizar-nao');
    if (confirmFinalizarNao) {
      confirmFinalizarNao.addEventListener('click', async () => {
        await finalizarPalletComConfirmacao(window.palletAtual, false);
      });
    }

    const cancelFinalizar = document.getElementById('cancel-finalizar');
    if (cancelFinalizar) {
      cancelFinalizar.addEventListener('click', () => {
        const modal = document.getElementById('finalizar-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const confirmarImprimir = document.getElementById('confirmar-imprimir-codigo');
    if (confirmarImprimir) {
      confirmarImprimir.addEventListener('click', async () => {
        const codigoListaInput = document.getElementById('codigo-lista-input');
        const codigoLista = codigoListaInput ? codigoListaInput.value.trim() : '';
        const pallet = window.palletService.pallets.get(window.palletAImprimir) || window.palletService.finalizados.get(window.palletAImprimir);
        if (pallet) {
          window.palletService.imprimirEtiqueta(pallet, codigoLista || null);
        }
        const modal = document.getElementById('codigo-lista-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const imprimirSemCodigo = document.getElementById('imprimir-sem-codigo');
    if (imprimirSemCodigo) {
      imprimirSemCodigo.addEventListener('click', () => {
        const pallet = window.palletService.pallets.get(window.palletAImprimir) || window.palletService.finalizados.get(window.palletAImprimir);
        if (pallet) {
          window.palletService.imprimirEtiqueta(pallet, null);
        }
        const modal = document.getElementById('codigo-lista-modal');
        if (modal) modal.classList.add('hidden');
      });
    }

    const cancelarCodigo = document.getElementById('cancelar-codigo-modal');
    if (cancelarCodigo) {
      cancelarCodigo.addEventListener('click', () => {
        const modal = document.getElementById('codigo-lista-modal');
        if (modal) modal.classList.add('hidden');
      });
    }
  }

  async function finalizarPalletComConfirmacao(id, bipado) {
    await window.palletService.finalizar(id, bipado);
    const modal = document.getElementById('finalizar-modal');
    if (modal) modal.classList.add('hidden');
    renderizarPallets();
    renderizarFinalizados();
  }

  function configurarMonitorConexao() {
    window.addEventListener('online', () => {
      const banner = document.getElementById('offline-banner');
      if (banner) banner.classList.add('hidden');
    });
    window.addEventListener('offline', () => {
      const banner = document.getElementById('offline-banner');
      if (banner) banner.classList.remove('hidden');
    });
  }

  window.abrirModalAjustar = function (id) {
    const p = window.palletService.pallets.get(id);
    if (!p) return;
    window.palletAtual = id;
    const modalTitle = document.getElementById('ajustar-modal-title');
    const infoDiv = document.getElementById('ajustar-info');
    const volumeControls = document.getElementById('volume-controls-container');
    const saveButton = document.getElementById('save-volume');

    if (modalTitle) modalTitle.innerText = `Ajustar Pallet - ${p.notaFiscal || 'DIVERSOS'}`;

    let volumesDisplay = '';
    if (p.tipo === 'DIVERSOS') {
      volumesDisplay = '______________';
    } else if (p.volumesDiversos) {
      volumesDisplay = p.volumesTexto || '______________';
    } else {
      volumesDisplay = `${p.volumesAtuais || 0} / ${p.maxVolumes || '?'}`;
    }

    const subrotaDisplay = window.palletService.getSubrotaDisplay(p);

    if (infoDiv) {
      infoDiv.innerHTML = `
        <div>
          <strong>Número Fiscal:</strong> ${p.notaFiscal || 'DIVERSOS'}<br>
          <strong>Destinatário:</strong> ${p.recebedor || 'DIVERSOS'}<br>
          <strong>Embarcador:</strong> ${p.embarcador || 'DIVERSOS'}<br>
          <strong>UF:</strong> ${p.estado}<br>
          <strong>Cidade:</strong> ${p.cidade || 'DIVERSOS'}<br>
          <strong>Região:</strong> ${p.regiao || 'N/A'}<br>
          <strong>Sub-região:</strong> ${subrotaDisplay}<br>
          <strong>Volumes:</strong> ${volumesDisplay}
        </div>
      `;
    }

    if (volumeControls) {
      if (p.tipo === 'VOLUMETRIA_ALTA' && !p.volumesDiversos) {
        volumeControls.innerHTML = `
          <button class="btn-volume" data-value="-10">-10</button>
          <button class="btn-volume" data-value="-5">-5</button>
          <button class="btn-volume" data-value="-1">-1</button>
          <input type="number" id="manual-volume" min="0" value="${p.volumesAtuais || 0}" placeholder="0">
          <button class="btn-volume" data-value="1">+1</button>
          <button class="btn-volume" data-value="5">+5</button>
          <button class="btn-volume" data-value="10">+10</button>
        `;
        if (saveButton) saveButton.style.display = 'block';

        volumeControls.querySelectorAll('.btn-volume').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const valor = parseInt(e.target.dataset.value);
            const manualVolume = document.getElementById('manual-volume');
            const atual = parseInt(manualVolume ? manualVolume.value : 0) || 0;
            if (manualVolume) manualVolume.value = Math.max(0, atual + valor);
          });
        });
      } else {
        volumeControls.innerHTML = `<div style="text-align: center; color: var(--text-secondary);">📦 Volumetria Diversa - sem controle de volumes</div>`;
        if (saveButton) saveButton.style.display = 'none';
      }
    }

    const modal = document.getElementById('ajustar-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.finalizarPallet = function (id) {
    window.palletAtual = id;
    const modal = document.getElementById('finalizar-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.anexarPallet = async function (id) {
    const palletPrincipal = window.palletService.pallets.get(id);
    if (!palletPrincipal || palletPrincipal.tipo !== 'VOLUMETRIA_ALTA') {
      alert('Só é possível anexar a pallets de volumetria alta.');
      return;
    }
    const novoPallet = await window.palletService.anexarPallet(id);
    if (novoPallet) {
      alert(`Pallet anexado criado com sucesso!`);
      renderizarPallets();
    } else {
      alert('Erro ao criar pallet anexado.');
    }
  };

  window.imprimirPallet = function (id) {
    const pallet = window.palletService.pallets.get(id);
    if (!pallet) return;
    window.palletAImprimir = id;
    const modal = document.getElementById('codigo-lista-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.excluirPallet = async function (id) {
    if (confirm('⚠️ Tem certeza que deseja excluir este pallet?')) {
      await window.palletService.excluir(id);
      renderizarPallets();
    }
  };

  window.reimprimirEtiqueta = function (id) {
    const pallet = window.palletService.finalizados.get(id);
    if (!pallet) return;
    window.palletAImprimir = id;
    const modal = document.getElementById('codigo-lista-modal');
    if (modal) modal.classList.remove('hidden');
  };

  function renderizarPallets() {
    const buscaInput = document.getElementById('search-nf');
    const busca = buscaInput ? buscaInput.value : '';
    const pallets = window.palletService.listar(busca);
    const lista = document.getElementById('pallets-list');

    if (!lista) return;

    if (pallets.length === 0) {
      lista.innerHTML = '<div style="text-align: center; padding: 50px; color: var(--text-secondary);">📦 Nenhum pallet ativo</div>';
      return;
    }

    let html = '';
    const palletsPrincipais = pallets.filter(p => !p.palletPrincipalId);

    for (const p of palletsPrincipais) {
      const anexos = pallets.filter(a => a.palletPrincipalId === p.id);
      const isDiversos = p.tipo === 'DIVERSOS';

      let volumesDisplay = '';
      if (isDiversos) {
        volumesDisplay = '______________';
      } else if (p.volumesDiversos) {
        volumesDisplay = p.volumesTexto || '______________';
      } else {
        volumesDisplay = `${p.volumesAtuais || 0} / ${p.maxVolumes || '?'}`;
      }

      const subrotaDisplay = window.palletService.getSubrotaDisplay(p);

      html += `
        <div class="pallet-card" style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="nf-tag">${isDiversos ? 'DIVERSOS' : `NF ${p.notaFiscal}`}</span>
          </div>

          <div class="info-grid">
            <div class="info-item"><small>Destinatário</small><strong>${p.recebedor || 'DIVERSOS'}</strong></div>
            <div class="info-item"><small>Embarcador</small><strong>${p.embarcador || 'DIVERSOS'}</strong></div>
            <div class="info-item"><small>UF</small><strong>${p.estado || ''}</strong></div>
            <div class="info-item"><small>Cidade</small><strong>${p.cidade || 'N/A'}</strong></div>
            <div class="info-item"><small>Região</small><strong>${p.regiao || 'N/A'}</strong></div>
            <div class="info-item"><small>Sub-região</small><strong>${subrotaDisplay || 'N/A'}</strong></div>
            <div class="info-item"><small>Volumes</small><strong>${volumesDisplay}</strong></div>
          </div>

          ${!isDiversos && !p.volumesDiversos && p.volumesAtuais >= p.maxVolumes ? '<div class="completo-alert">✅ PALLET COMPLETO</div>' : ''}

          <div class="card-actions">
            <button onclick="abrirModalAjustar('${p.id}')">Ajustar</button>
            <button onclick="finalizarPallet('${p.id}')">Finalizar</button>
            ${!isDiversos ? `<button onclick="anexarPallet('${p.id}')">Anexar Pallet</button>` : ''}
            <button onclick="imprimirPallet('${p.id}')">Imprimir</button>
            <button onclick="excluirPallet('${p.id}')">Excluir</button>
          </div>
        </div>
      `;

      if (anexos.length > 0) {
        html += `<div style="margin-top: 15px; padding-top: 10px; border-top: 2px dashed var(--border);">`;
        html += `<div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px;">📎 Pallets anexados (${1 + anexos.length} pallets no total):</div>`;

        for (const anexo of anexos) {
          const volumesAnexo = `${anexo.volumesAtuais} / ${anexo.maxVolumes}`;
          const subrotaAnexo = window.palletService.getSubrotaDisplay(anexo);
          html += `
            <div class="pallet-card anexado" style="margin-bottom: 10px; background: var(--bg-primary); border-left: 4px solid var(--warning);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span class="nf-tag" style="font-size: 16px;">Anexado - NF ${anexo.notaFiscal}</span>
              </div>
              <div class="info-grid" style="grid-template-columns: 1fr 1fr; gap: 8px;">
                <div class="info-item"><small>Destinatário</small><strong>${anexo.recebedor}</strong></div>
                <div class="info-item"><small>Embarcador</small><strong>${anexo.embarcador || 'DIVERSOS'}</strong></div>
                <div class="info-item"><small>Sub-região</small><strong>${subrotaAnexo}</strong></div>
                <div class="info-item"><small>Volumes</small><strong>${volumesAnexo}</strong></div>
              </div>
              <div class="card-actions" style="margin-top: 10px;">
                <button onclick="abrirModalAjustar('${anexo.id}')" style="padding: 8px; font-size: 12px;">Ajustar</button>
                <button onclick="finalizarPallet('${anexo.id}')" style="padding: 8px; font-size: 12px;">Finalizar</button>
                <button onclick="imprimirPallet('${anexo.id}')" style="padding: 8px; font-size: 12px;">Imprimir</button>
                <button onclick="excluirPallet('${anexo.id}')" style="padding: 8px; font-size: 12px;">Excluir</button>
              </div>
            </div>
          `;
        }
        html += `</div>`;
      }
    }

    lista.innerHTML = html;
  }

  function renderizarDestinatarios() {
    const buscaInput = document.getElementById('search-destinatarios');
    const busca = buscaInput ? buscaInput.value.toLowerCase() : '';
    let destinatarios = window.agendamentoService.listar();

    if (busca) {
      destinatarios = destinatarios.filter(d => (d.destinatario || '').toLowerCase().includes(busca));
    }

    const lista = document.getElementById('destinatarios-list');

    if (!lista) return;

    if (destinatarios.length === 0) {
      lista.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">📋 Nenhum destinatário encontrado</div>';
      return;
    }

    let html = '';
    destinatarios.forEach(d => {
      html += `
        <div class="destinatario-item">
          <div class="destinatario-info">
            <strong>${d.destinatario}</strong>
            ${d.cnpj ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">CNPJ: ${d.cnpj}</div>` : ''}
            <small>${new Date(d.criadoEm).toLocaleDateString()}</small>
          </div>
        </div>
      `;
    });
    lista.innerHTML = html;
  }

  function renderizarFinalizados() {
    const buscaInput = document.getElementById('search-finalizados');
    const busca = buscaInput ? buscaInput.value : '';
    const finalizados = window.palletService.listarFinalizados(busca);
    const lista = document.getElementById('finalizados-list');

    if (!lista) return;

    if (finalizados.length === 0) {
      lista.innerHTML = '<div style="text-align: center; padding: 50px; color: var(--text-secondary);">📦 Nenhum pallet finalizado</div>';
      return;
    }

    let html = '';
    finalizados.forEach(p => {
      const dataFinalizacao = new Date(p.finalizadoEm).toLocaleDateString('pt-BR');
      const isDiversos = p.tipo === 'DIVERSOS';
      let volumesDisplay = '';

      if (isDiversos) {
        volumesDisplay = '______________';
      } else if (p.volumesDiversos) {
        volumesDisplay = p.volumesTexto || '______________';
      } else {
        volumesDisplay = `${p.volumesAtuais}/${p.maxVolumes}`;
      }

      const subrotaDisplay = window.palletService.getSubrotaDisplay(p);

      html += `
        <div class="finalizado-card">
          <div class="finalizado-header">
            <span>${isDiversos ? 'DIVERSOS' : `NF ${p.notaFiscal}`}</span>
            <span class="finalizado-badge ${p.bipado ? 'bipado' : 'nao-bipado'}">
              ${p.bipado ? '✅ BIPADO' : '⚠️ NÃO BIPADO'}
            </span>
          </div>

          <div class="finalizado-info">
            <div><small>Destinatário</small><br>${p.recebedor || 'DIVERSOS'}</div>
            <div><small>Embarcador</small><br>${p.embarcador || 'DIVERSOS'}</div>
            <div><small>UF</small><br>${p.estado}</div>
            <div><small>Cidade</small><br>${p.cidade || 'N/A'}</div>
            <div><small>Região</small><br>${p.regiao || 'N/A'}</div>
            <div><small>Sub-região</small><br>${subrotaDisplay}</div>
            <div><small>Volumes</small><br>${volumesDisplay}</div>
            <div><small>Finalizado</small><br>${dataFinalizacao}</div>
          </div>

          <div style="margin-top: 15px;">
            <button onclick="reimprimirEtiqueta('${p.id}')" style="width: 100%; padding: 10px; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer;">
              🖨️ Reimprimir
            </button>
          </div>
        </div>
      `;
    });
    lista.innerHTML = html;
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
