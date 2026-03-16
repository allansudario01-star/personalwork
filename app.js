// Inicialização
const palletService = new PalletService(db);
const agendamentoService = new AgendamentoService(db);

// Estado da aplicação
let currentFilter = '';
let currentSearch = '';
let currentPalletId = null;

// Elementos DOM
const palletsTab = document.getElementById('pallets-tab');
const agendamentosTab = document.getElementById('agendamentos-tab');
const palletsList = document.getElementById('pallets-list');
const agendamentosList = document.getElementById('agendamentos-list');
const positionFilter = document.getElementById('position-filter');
const searchNF = document.getElementById('search-nf');
const createPalletBtn = document.getElementById('create-pallet-btn');
const palletModal = document.getElementById('pallet-modal');
const volumeModal = document.getElementById('volume-modal');
const positionGrid = document.getElementById('position-grid');
const palletForm = document.getElementById('pallet-form');
const offlineBanner = document.getElementById('offline-banner');

// Gerar grid de posições
function generatePositionGrid() {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  let html = '';

  letters.forEach(letter => {
    for (let i = 1; i <= 5; i++) {
      const pos = `${letter}${i}`;
      html += `<button type="button" class="position-btn" data-position="${pos}">${pos}</button>`;
    }
  });

  positionGrid.innerHTML = html;

  // Adicionar eventos
  document.querySelectorAll('.position-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.position-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('palletPosicao').value = btn.dataset.position;
    });
  });
}

// Renderizar pallets
function renderPallets() {
  const pallets = palletService.getPallets(currentFilter, currentSearch);

  if (pallets.length === 0) {
    palletsList.innerHTML = '<div class="empty-state">Nenhum pallet ativo</div>';
    return;
  }

  let html = '';
  pallets.forEach(pallet => {
    const progress = (pallet.volumesAtuais / pallet.maxVolumes) * 100;
    const isAgendado = agendamentoService.isAgendado(pallet.recebedor, pallet.hub, pallet.estado);
    const isCompleto = pallet.volumesAtuais >= pallet.maxVolumes;

    html += `
            <div class="pallet-card ${isAgendado ? 'agendado' : ''} ${isCompleto ? 'completo' : ''}" data-id="${pallet.id}">
                <div class="pallet-header">
                    <span class="nf-tag">NF ${pallet.notaFiscal}</span>
                    ${isAgendado ? '<span class="agendado-badge">AGENDADO</span>' : ''}
                </div>

                <div class="pallet-info">
                    <div class="info-item">
                        <span class="info-label">Recebedor</span>
                        <span class="info-value">${pallet.recebedor}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Hub/UF</span>
                        <span class="info-value">${pallet.hub} - ${pallet.estado}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Cidade</span>
                        <span class="info-value">${pallet.cidade}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Posição</span>
                        <span class="info-value">${pallet.palletPosicao}</span>
                    </div>
                </div>

                <div class="volume-container">
                    <div class="volume-control">
                        <span class="volume-display">${pallet.volumesAtuais}</span>
                        <span class="volume-max">/ ${pallet.maxVolumes}</span>
                    </div>

                    <div class="progress-bar">
                        <div class="progress-fill ${isCompleto ? 'complete' : ''}" style="width: ${progress}%"></div>
                    </div>

                    ${isCompleto ? '<div class="completo-alert">✅ PALLET COMPLETO</div>' : ''}
                </div>

                <div class="card-actions">
                    <button class="btn-edit" onclick="editVolumes('${pallet.id}')">Ajustar Volumes</button>
                    <button class="btn-finalize" onclick="finalizePallet('${pallet.id}')">Finalizar</button>
                </div>
            </div>
        `;
  });

  palletsList.innerHTML = html;
}

// Renderizar agendamentos
function renderAgendamentos() {
  const agendamentos = agendamentoService.getAgendamentos();

  if (agendamentos.length === 0) {
    agendamentosList.innerHTML = '<div class="empty-state">Nenhum agendamento cadastrado</div>';
    return;
  }

  let html = '';
  agendamentos.forEach(ag => {
    html += `
            <div class="agendamento-item">
                <div class="agendamento-info">
                    ${ag.recebedor} | ${ag.hub} | ${ag.estado}
                </div>
                <button class="delete-agendamento" onclick="deleteAgendamento('${ag.id}')">🗑️</button>
            </div>
        `;
  });

  agendamentosList.innerHTML = html;
}

// Editar volumes
window.editVolumes = (id) => {
  const pallet = palletService.localPallets.get(id);
  if (!pallet) return;

  currentPalletId = id;
  document.getElementById('volume-info').innerHTML = `
        <strong>NF ${pallet.notaFiscal}</strong><br>
        Posição: ${pallet.palletPosicao}<br>
        Volumes: ${pallet.volumesAtuais} / ${pallet.maxVolumes}
    `;
  document.getElementById('manual-volume').value = pallet.volumesAtuais;
  volumeModal.classList.remove('hidden');
};

// Finalizar pallet
window.finalizePallet = (id) => {
  if (confirm('Finalizar este pallet? Ele será removido da lista.')) {
    palletService.finalizarPallet(id);
    volumeModal.classList.add('hidden');
  }
};

// Deletar agendamento
window.deleteAgendamento = (id) => {
  if (confirm('Remover agendamento?')) {
    agendamentoService.deleteAgendamento(id);
  }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  generatePositionGrid();

  // Carregar dados iniciais
  palletService.loadLocalData();
  palletService.syncWithFirebase();

  // Inscrever para atualizações
  palletService.subscribe(() => renderPallets());
  agendamentoService.subscribe(() => renderAgendamentos());

  // Renderizar inicial
  renderPallets();
  renderAgendamentos();
});

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById(`${tab}-tab`).classList.add('active');
  });
});

// Filtros
positionFilter.addEventListener('change', (e) => {
  currentFilter = e.target.value;
  renderPallets();
});

searchNF.addEventListener('input', (e) => {
  currentSearch = e.target.value;
  renderPallets();
});

// Criar pallet
createPalletBtn.addEventListener('click', () => {
  palletForm.reset();
  document.querySelectorAll('.position-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('palletPosicao').value = '';
  palletModal.classList.remove('hidden');
});

// Fechar modal
document.getElementById('close-modal').addEventListener('click', () => {
  palletModal.classList.add('hidden');
});

// Submeter pallet
palletForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const palletData = {
    notaFiscal: document.getElementById('nf').value,
    recebedor: document.getElementById('recebedor').value,
    hub: document.getElementById('hub').value,
    estado: document.getElementById('estado').value.toUpperCase(),
    cidade: document.getElementById('cidade').value,
    maxVolumes: parseInt(document.getElementById('maxVolumes').value),
    palletPosicao: document.getElementById('palletPosicao').value
  };

  if (!palletData.palletPosicao) {
    alert('Selecione uma posição');
    return;
  }

  await palletService.createPallet(palletData);
  palletModal.classList.add('hidden');
});

// Agendamento form
document.getElementById('create-agendamento-btn').addEventListener('click', () => {
  document.getElementById('agendamento-form').classList.remove('hidden');
});

document.getElementById('cancel-agendamento').addEventListener('click', () => {
  document.getElementById('agendamento-form').classList.add('hidden');
});

document.getElementById('agendamento-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  await agendamentoService.createAgendamento(
    document.getElementById('ag-recebedor').value,
    document.getElementById('ag-hub').value,
    document.getElementById('ag-estado').value.toUpperCase()
  );

  e.target.reset();
  document.getElementById('agendamento-form').classList.add('hidden');
});

// Volume modal
document.querySelectorAll('.btn-volume').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const value = parseInt(e.target.dataset.value);
    const current = parseInt(document.getElementById('manual-volume').value) || 0;
    const newValue = Math.max(0, current + value);
    document.getElementById('manual-volume').value = newValue;
  });
});

document.getElementById('save-volume').addEventListener('click', async () => {
  if (!currentPalletId) return;

  const novosVolumes = parseInt(document.getElementById('manual-volume').value) || 0;
  await palletService.updateVolumes(currentPalletId, novosVolumes);
  volumeModal.classList.add('hidden');
});

document.getElementById('finalize-pallet').addEventListener('click', () => {
  if (currentPalletId) {
    finalizePallet(currentPalletId);
  }
});

document.getElementById('close-volume-modal').addEventListener('click', () => {
  volumeModal.classList.add('hidden');
});

// Detectar mudanças na conexão
window.addEventListener('online', () => {
  offlineBanner.classList.add('hidden');
  palletService.syncWithFirebase();
  agendamentoService.syncWithFirebase();
});

window.addEventListener('offline', () => {
  offlineBanner.classList.remove('hidden');
});

// Inicializar status offline
if (!navigator.onLine) {
  offlineBanner.classList.remove('hidden');
}

// Importar agendamentos da planilha
async function importarAgendamentosDoPDF() {
  // Dados extraídos do PDF fornecido
  const agendamentosData = [
    // Página 1
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "SOR", estado: "SP" },
    { recebedor: "IGESP SA CTO MED CIR INST GASTROENT", hub: "SAO", estado: "SP" },
    { recebedor: "ASSOCIACAO BENEFICENTE SIRIA", hub: "SAO", estado: "SP" },
    { recebedor: "PREVENT SENIOR ATENDIMENTO A SAUDE", hub: "SAO", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "SAO", estado: "SP" },
    { recebedor: "SOC BENE.ISRA.HOSP.ALBE.EINS.", hub: "SAO", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "FRA", estado: "SP" },
    { recebedor: "DROG SAO PAULO SA", hub: "OSA", estado: "SP" },
    { recebedor: "PREPRESS DIST DE MEDIC EIRELI", hub: "BAR", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "OSA", estado: "SP" },
    { recebedor: "SOCIEDADE BENE.ISRA.HOSP.ALBE.EINS.", hub: "OSA", estado: "SP" },
    { recebedor: "ALMOXARIFADO CENTRAL", hub: "FRU", estado: "MG" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "SAC", estado: "MG" },
    { recebedor: "ATIVA COML HOSPIT LTDA", hub: "CAT", estado: "MG" },
    { recebedor: "HDL LOGISTICA HOSPITALAR LTDA", hub: "UBE", estado: "MG" },
    { recebedor: "DIST MEDIC SANTA CRUZ LTDA", hub: "VAG", estado: "MG" },
    { recebedor: "SC DISTRIBUIACAO LTDA", hub: "VAG", estado: "MG" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "GUA", estado: "MG" },
    { recebedor: "COMERCIAL CIRURGICA RIOCLARENSE LTDA", hub: "ITA", estado: "RJ" },
    { recebedor: "COMERCIAL CIRURGICA RIOCLARENSE LT", hub: "LON", estado: "PR" },
    { recebedor: "CAF", hub: "LON", estado: "PR" },
    { recebedor: "CLASSMED PROD HOSPIT EIRELI EPP", hub: "ARA", estado: "PR" },
    { recebedor: "LONDRICIR COM MAT HOSPIT LTDA", hub: "LON", estado: "PR" },
    { recebedor: "ALMOXARIFADO", hub: "RIO", estado: "ES" },
    { recebedor: "ALMOXARIFADO CENTRAL", hub: "LIN", estado: "ES" },
    { recebedor: "ALMOXARIFADO", hub: "ERE", estado: "RS" },
    { recebedor: "COMERCIO DE MEDICAMENTOS BRAIR LT", hub: "PAS", estado: "RS" },
    { recebedor: "DIMASTER COM DE PROD HOSPIT LTDA", hub: "BAR", estado: "RS" },
    { recebedor: "PONTAMED FARMACEUTICA LTDA", hub: "PON", estado: "PR" },

    // Página 2
    { recebedor: "ALMOXARIFADO", hub: "POR", estado: "RS" },
    { recebedor: "COMERCIO DE MEDICAMENTOS BRAIR LT", hub: "GRA", estado: "RS" },
    { recebedor: "DIMED S/A - DIST. DE MEDI.", hub: "ELD", estado: "RS" },
    { recebedor: "DIMED S/A - DIST. DE MEDI.", hub: "POR", estado: "RS" },
    { recebedor: "DIMED SA DIST DE MEDIC", hub: "ELD", estado: "RS" },
    { recebedor: "PROFARMA DIST DE PROD FARM SA", hub: "CAN", estado: "RS" },
    { recebedor: "SC DISTRIBUICAO LTDA", hub: "GRA", estado: "RS" },
    { recebedor: "IRM DA SANTA CASA DE MIS DE PORTO", hub: "GRA", estado: "RS" },
    { recebedor: "IR M DA SANTA CASA DE MIS DE PORTO", hub: "POR", estado: "RS" },
    { recebedor: "ALMOXARIFADO", hub: "ALE", estado: "RS" },
    { recebedor: "BALLKE PROD HOSPIT LTDA", hub: "CON", estado: "SC" },
    { recebedor: "CENTRO INTEGRADO DE ARMAZENAMENT", hub: "PIN", estado: "SC" },
    { recebedor: "PROFARMA DIST DE PROD FARM SA", hub: "BRA", estado: "DF" },
    { recebedor: "AS COM MEDICAMENTOS ESPECIAIS LTDA", hub: "BRA", estado: "DF" },
    { recebedor: "CM HOSPITALAR S.A.", hub: "BRA", estado: "DF" },
    { recebedor: "VFB BRASIL LTDA", hub: "PAR", estado: "GO" },
    { recebedor: "SOGAMAX DIST PROD FARMAC LTDA", hub: "PIN", estado: "ES" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "JER", estado: "ES" },
    { recebedor: "DIAGNOSTICOS DA AMERICA S.A.", hub: "APA", estado: "GO" },
    { recebedor: "DIST MEDIC SANTA CRUZ LTDA", hub: "ANA", estado: "GO" },
    { recebedor: "DROG SAO PAULO SA", hub: "HID", estado: "GO" },
    { recebedor: "EMPREEND PAGUE MENOS SA", hub: "HID", estado: "GO" },
    { recebedor: "PROFARMA DIST DE PROD FARM SA", hub: "APA", estado: "GO" },
    { recebedor: "SC DISTRIBUICAO LTDA", hub: "ANA", estado: "GO" },
    { recebedor: "SOC BENE.ISRA.HOSP.ALBE.EINS.", hub: "GOI", estado: "GO" },
    { recebedor: "SOC BENE.ISRA.HOSPALBE.EINS.", hub: "APA", estado: "GO" },
    { recebedor: "ARMAZEM DOS MEDICAMENTOS LTDA", hub: "SEN", estado: "GO" },
    { recebedor: "AS COM MEDICAMENTOS ESPECIAIS LTDA", hub: "GOI", estado: "GO" },
    { recebedor: "GOYAZ SERVICE COM E LOG LTDA ME", hub: "GOI", estado: "GO" },
    { recebedor: "MED VITTA COM PROD HOSPITALARES LT", hub: "APA", estado: "GO" },

    // Página 3
    { recebedor: "R M HOSPIT LTDA", hub: "GOI", estado: "GO" },
    { recebedor: "SUPERMEDICA DIST HOSPIT EIRELI", hub: "GOI", estado: "GO" },
    { recebedor: "ALMOXARIFADO", hub: "RIO", estado: "ES" },
    { recebedor: "ALMOXARIFADO CENTRAL", hub: "LIN", estado: "ES" },
    { recebedor: "ALMOXARIFADO CENTRAL", hub: "VIA", estado: "ES" },
    { recebedor: "DIMED SA DIST DE MEDIC", hub: "SER", estado: "ES" },
    { recebedor: "DIST MEDIC SANTA CRUZ LTDA", hub: "SER", estado: "ES" },
    { recebedor: "GENESIO A MENDES", hub: "SER", estado: "ES" },
    { recebedor: "ONCO PROD DIST PROD HOSPIT E ONCO", hub: "SER", estado: "ES" },
    { recebedor: "ALMOXARIFADO DE MEDICAMENTOS DA S", hub: "VIL", estado: "ES" },
    { recebedor: "CRISTAL DIST DE MEDIC LTDA", hub: "SER", estado: "ES" },
    { recebedor: "GREEN MED DISTE IMPO.DE MEDI.E PROD", hub: "SER", estado: "ES" },
    { recebedor: "HOSPIDROGAS COM PROD HOSPIT LTDA", hub: "VIL", estado: "ES" },
    { recebedor: "HRX PRODUTOS HOSPITALARES LTDA", hub: "SER", estado: "ES" },
    { recebedor: "NOVA LINEA COM PROD FARMACEUTICOS", hub: "SER", estado: "ES" },
    { recebedor: "PACLIMED DIST DE PROD FARMAC LTDA", hub: "SER", estado: "ES" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "VIT", estado: "ES" },
    { recebedor: "HOSPITAL BENEFICIENCIA PORTUGUESA", hub: "GUA", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "FER", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA S AUDE", hub: "GUA", estado: "SP" },
    { recebedor: "SUPERMED COM E IMP DE PROD MED E HO", hub: "ARU", estado: "SP" },
    { recebedor: "ALMOXARIFADO", hub: "IPA", estado: "MG" },
    { recebedor: "ALMOXARIFADO CENTRAL", hub: "TEO", estado: "MG" },
    { recebedor: "ALMOXARIFADO CENTRAL", hub: "GOV", estado: "MG" },
    { recebedor: "GIRMAOS MATTAR & CIA LTDA", hub: "TEO", estado: "MG" },
    { recebedor: "DISK MED PADUA DIST MEDIC LTDA", hub: "STO", estado: "RJ" },
    { recebedor: "ATIVA MED CIR LTDA", hub: "JUI", estado: "MG" },
    { recebedor: "ANDORINHA COMERCIO E DISTRIBUICAO L", hub: "VAL", estado: "SP" },
    { recebedor: "IGESP SA CTO MED CIR INST GASTROENT", hub: "PRA", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "SAN", estado: "SP" },

    // Página 4
    { recebedor: "GUEDES & PAIXAO LTDA", hub: "MON", estado: "MG" },
    { recebedor: "ALMOXARIFADO CENTRAL", hub: "SAO", estado: "MG" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "CAR", estado: "MG" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "MON", estado: "MG" },
    { recebedor: "ALMOXARIFADO", hub: "TEO", estado: "SP" },
    { recebedor: "ATIVA COML HOSPIT LTDA", hub: "RIB", estado: "SP" },
    { recebedor: "FUND PIO XII HOSP DE CANCER DE BARR", hub: "BAR", estado: "SP" },
    { recebedor: "HDL LOGISTICA HOSPITALAR LTDA", hub: "CRA", estado: "SP" },
    { recebedor: "PROFARMA DIST DE PROD FARM SA", hub: "SAO", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "FRA", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA S A U D E", hub: "RIB", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "BAR", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA S A U D E", hub: "CAS", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "ARA", estado: "SP" },
    { recebedor: "PREVENT SENIOR ATENDIMENTO A SAUDE", hub: "RIO", estado: "RJ" },
    { recebedor: "DROGARIAS PACHECO SA", hub: "RIO", estado: "RJ" },
    { recebedor: "HB DISTRIBUIDORA DE PERFUMARIA LTDA", hub: "RIO", estado: "RJ" },
    { recebedor: "SC DISTRIBUI CAO LTDA", hub: "RIO", estado: "RJ" },
    { recebedor: "FUND OSVALDO CRUZ - FARMANGUINHOS", hub: "RIO", estado: "RJ" },
    { recebedor: "MEDKA DISTRIBUIDORA HOSPITALAR LTDA", hub: "RIO", estado: "RJ" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "RIO", estado: "RJ" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "ILH", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "TAU", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA S A U D E", hub: "S J", estado: "SP" },
    { recebedor: "FUTURA COM PROD MED HOSPIT LTDA", hub: "TAT", estado: "SP" },
    { recebedor: "ALMOXARIFADO CENTRAL", hub: "CAS", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "MIR", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA S A U D E", hub: "ARA", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "MAR", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "BAU", estado: "SP" },

    // Página 5
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "LIN", estado: "SP" },
    { recebedor: "COMERCIAL CIRURGICA RIOCLARENSE LTD", hub: "BET", estado: "MG" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "JOA", estado: "MG" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "MAR", estado: "MG" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "OURO", estado: "MG" },
    { recebedor: "HOSP MATER DEI SA", hub: "BET", estado: "MG" },
    { recebedor: "MULTIFARMA COM E REPRES LTDA", hub: "VES", estado: "MG" },
    { recebedor: "UNIMED BELO HORIZONTE COOP TRAB MED", hub: "BET", estado: "MG" },
    { recebedor: "ALMOXARIFADO", hub: "CON", estado: "MG" },
    { recebedor: "DIST MEDIC SANTA CRUZ LTDA", hub: "BEL", estado: "MG" },
    { recebedor: "DROG ARAUJO SA", hub: "CON", estado: "MG" },
    { recebedor: "DROGARIA ARAUJO S A", hub: "BEL", estado: "MG" },
    { recebedor: "DROGARIAS PACHECO SA", hub: "CON", estado: "MG" },
    { recebedor: "EMPREEND PAGUE MENOS SA", hub: "CON", estado: "MG" },
    { recebedor: "PROFARMA DIST DE PROD FARM SA", hub: "CON", estado: "MG" },
    { recebedor: "SC DISTRIBUIÇAO LTDA", hub: "BEL", estado: "MG" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "MAR", estado: "MG" },
    { recebedor: "FUTURA COM PROD MED HOSPIT LTDA", hub: "CON", estado: "MG" },
    { recebedor: "HOSP MATER DEI SA", hub: "BEL", estado: "MG" },
    { recebedor: "SES SUPER ASSISTENCIA FARMACEUTICA", hub: "CON", estado: "MG" },
    { recebedor: "TRES PHARMA DIST E SERVICOS LTDA", hub: "BEL", estado: "MG" },
    { recebedor: "3PH MEDICAMENTOS ESPECIAIS LTDA", hub: "BEL", estado: "MG" },
    { recebedor: "ASTRA FARMA COM MAT MED HOSPIT LTDA", hub: "POU", estado: "MG" },
    { recebedor: "STOCKFARMA LTDA EPP", hub: "POC", estado: "MG" },
    { recebedor: "COMERCIAL CIRURGICA RIOCLARENSE LTD", hub: "JAG", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA SAUDE", hub: "PIR", estado: "SP" },
    { recebedor: "SECRETARIA DE ESTADO DA S AUDE", hub: "CAM", estado: "SP" },
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "ITA", estado: "MG" },
    { recebedor: "DIAGNOSTICOS DA AMERICA S.A.", hub: "DUQ", estado: "RJ" },
    { recebedor: "DIST MEDIC SANTA CRUZ LTDA", hub: "DUQ", estado: "RJ" },

    // Página 7
    { recebedor: "ALMOXARIFADO DA SAUDE", hub: "CAM", estado: "SC" },
    { recebedor: "IR SANTA CRUZ COM PROD HOSPIT LTD", hub: "SAO", estado: "SC" },
    { recebedor: "CIA LATINO AMERICANA DE MEDIC", hub: "JOI", estado: "SC" },
    { recebedor: "LATINO AMERICANA DE MEDICAMENT", hub: "JOI", estado: "SC" },
    { recebedor: "CIAD CENTRO INTEGRADO", hub: "JOI", estado: "SC" },
    { recebedor: "SULMEDIC COM DE MEDIC LTDA", hub: "JOI", estado: "SC" },
    { recebedor: "COMERCIAL CIRURGICA RIOCLARENSE LT", hub: "LON", estado: "PR" },
    { recebedor: "CAF", hub: "LON", estado: "PR" },
    { recebedor: "CLASSMED PROD HOSPIT EIRELI EPP", hub: "ARA", estado: "PR" }
  ];

  // Remover duplicatas (mesmo recebedor, hub e estado)
  const uniqueAgendamentos = [];
  const seen = new Set();

  agendamentosData.forEach(ag => {
    const key = `${ag.recebedor}-${ag.hub}-${ag.estado}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAgendamentos.push(ag);
    }
  });

  // Importar para o Firebase
  for (const ag of uniqueAgendamentos) {
    await agendamentoService.createAgendamento(ag.recebedor, ag.hub, ag.estado);
  }

  alert(`${uniqueAgendamentos.length} agendamentos importados com sucesso!`);
}

// Botão de importação (adicionar na interface se necessário)
window.importarAgendamentos = importarAgendamentosDoPDF;

// Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
