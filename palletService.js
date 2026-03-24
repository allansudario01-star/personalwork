class PalletService {
    constructor() {
        this.pallets = new Map();
        this.finalizados = new Map();
        this.agendamentoService = null;
        this.loadFromStorage();
        this.setupRealtimeListener();
    }

    setAgendamentoService(service) {
        this.agendamentoService = service;
        this.atualizarStatusAgendamentoEmTodosPallets();
    }

    setupRealtimeListener() {
        if (window.db) {
            window.db.collection('agendamentos').onSnapshot(() => {
                if (window.renderizarPallets) {
                    this.atualizarStatusAgendamentoEmTodosPallets();
                    window.renderizarPallets();
                }
            });
        }
    }

    verificarAgendamento(pallet) {
        if (!this.agendamentoService || pallet.tipo !== 'VOLUMETRIA_ALTA') {
            return false;
        }

        const agendamentos = this.agendamentoService.listar();
        return agendamentos.some(a =>
            a.uf === pallet.estado &&
            a.hub === pallet.hub &&
            a.recebedor === pallet.recebedor
        );
    }

    atualizarStatusAgendamentoEmTodosPallets() {
        for (const [id, pallet] of this.pallets.entries()) {
            if (pallet.tipo === 'VOLUMETRIA_ALTA') {
                const isAgendado = this.verificarAgendamento(pallet);
                if (pallet.agendamentoMarcado !== isAgendado) {
                    pallet.agendamentoMarcado = isAgendado;
                    this.saveToStorage();
                }
            }
        }
    }

    loadFromStorage() {
        const saved = localStorage.getItem('pallets');
        if (saved) {
            try {
                const lista = JSON.parse(saved);
                lista.forEach(p => this.pallets.set(p.id, p));
            } catch (e) {
            }
        }

        const finalizados = localStorage.getItem('palletsFinalizados');
        if (finalizados) {
            try {
                const lista = JSON.parse(finalizados);
                lista.forEach(p => this.finalizados.set(p.id, p));
            } catch (e) {
            }
        }
    }

    saveToStorage() {
        const lista = Array.from(this.pallets.values());
        localStorage.setItem('pallets', JSON.stringify(lista));
    }

    saveFinalizadosToStorage() {
        const lista = Array.from(this.finalizados.values());
        localStorage.setItem('palletsFinalizados', JSON.stringify(lista));
    }

    async create(data, tipo) {
        const id = Date.now().toString();
        const basePallet = {
            id,
            tipo: tipo,
            criadoEm: new Date().toISOString(),
            ultimaAtualizacao: new Date().toISOString(),
            status: 'ativo',
            bipado: false,
            palletsVinculados: [],
            palletPrincipalId: null,
            agendamentoMarcado: false
        };

        let novo;
        if (tipo === 'VOLUMETRIA_ALTA') {
            novo = {
                ...basePallet,
                notaFiscal: data.notaFiscal.toUpperCase().trim(),
                recebedor: data.recebedor.toUpperCase().trim(),
                hub: data.hub.toUpperCase().trim(),
                estado: data.estado.toUpperCase().trim(),
                cidade: data.cidade.toUpperCase().trim(),
                maxVolumes: parseInt(data.maxVolumes),
                volumesAtuais: 0
            };
        } else {
            novo = {
                ...basePallet,
                notaFiscal: 'DIVERSOS',
                recebedor: 'DIVERSOS',
                hub: data.hub.toUpperCase().trim(),
                estado: data.estado.toUpperCase().trim(),
                cidade: 'DIVERSOS',
                maxVolumes: null,
                volumesAtuais: null
            };
        }

        if (tipo === 'VOLUMETRIA_ALTA') {
            novo.agendamentoMarcado = this.verificarAgendamento(novo);
        }

        this.pallets.set(id, novo);
        this.saveToStorage();

        try {
            await window.db.collection('pallets').doc(id).set(novo);
        } catch (e) {
        }

        return novo;
    }

    async anexarPallet(idPalletPrincipal) {
        const palletPrincipal = this.pallets.get(idPalletPrincipal);
        if (!palletPrincipal || palletPrincipal.tipo !== 'VOLUMETRIA_ALTA') {
            return null;
        }

        const novoId = Date.now().toString();
        const palletAnexado = {
            ...palletPrincipal,
            id: novoId,
            palletPrincipalId: idPalletPrincipal,
            criadoEm: new Date().toISOString(),
            ultimaAtualizacao: new Date().toISOString(),
            status: 'ativo',
            volumesAtuais: 0,
            palletsVinculados: [],
            agendamentoMarcado: palletPrincipal.agendamentoMarcado
        };

        this.pallets.set(novoId, palletAnexado);

        if (!palletPrincipal.palletsVinculados) {
            palletPrincipal.palletsVinculados = [];
        }
        palletPrincipal.palletsVinculados.push(novoId);
        this.pallets.set(idPalletPrincipal, palletPrincipal);

        this.saveToStorage();

        try {
            await window.db.collection('pallets').doc(novoId).set(palletAnexado);
            await window.db.collection('pallets').doc(idPalletPrincipal).update({
                palletsVinculados: palletPrincipal.palletsVinculados
            });
        } catch (e) {
        }

        return palletAnexado;
    }

    async updateVolumes(id, novosVolumes) {
        const pallet = this.pallets.get(id);
        if (!pallet || pallet.tipo !== 'VOLUMETRIA_ALTA') return;

        pallet.volumesAtuais = Math.min(novosVolumes, pallet.maxVolumes);
        if (pallet.volumesAtuais < 0) pallet.volumesAtuais = 0;

        pallet.ultimaAtualizacao = new Date().toISOString();

        this.saveToStorage();

        try {
            await window.db.collection('pallets').doc(id).update({
                volumesAtuais: pallet.volumesAtuais,
                ultimaAtualizacao: pallet.ultimaAtualizacao
            });
        } catch (e) {
        }
    }

    async finalizar(id, bipado = false) {
        const pallet = this.pallets.get(id);
        if (!pallet) return;

        if (pallet.palletPrincipalId) {
            const principal = this.pallets.get(pallet.palletPrincipalId);
            if (principal && principal.palletsVinculados) {
                const index = principal.palletsVinculados.indexOf(id);
                if (index > -1) principal.palletsVinculados.splice(index, 1);
                this.pallets.set(principal.id, principal);
                this.saveToStorage();
            }
        }

        if (pallet.tipo === 'VOLUMETRIA_ALTA' && pallet.palletsVinculados && pallet.palletsVinculados.length > 0) {
            for (const anexoId of pallet.palletsVinculados) {
                const anexo = this.pallets.get(anexoId);
                if (anexo && anexo.status === 'ativo') {
                    anexo.finalizadoEm = new Date().toISOString();
                    anexo.bipado = bipado;
                    anexo.status = 'finalizado';
                    this.finalizados.set(anexoId, anexo);
                    this.pallets.delete(anexoId);
                }
            }
        }

        pallet.finalizadoEm = new Date().toISOString();
        pallet.bipado = bipado;
        pallet.status = 'finalizado';

        this.finalizados.set(id, pallet);
        this.pallets.delete(id);

        this.saveToStorage();
        this.saveFinalizadosToStorage();

        try {
            await window.db.collection('pallets').doc(id).delete();
            await window.db.collection('palletsFinalizados').doc(id).set(pallet);
        } catch (e) {
        }
    }

    async excluir(id) {
        const pallet = this.pallets.get(id);
        if (!pallet) return;

        if (pallet.palletPrincipalId) {
            const principal = this.pallets.get(pallet.palletPrincipalId);
            if (principal && principal.palletsVinculados) {
                const index = principal.palletsVinculados.indexOf(id);
                if (index > -1) principal.palletsVinculados.splice(index, 1);
                this.pallets.set(principal.id, principal);
            }
        }

        this.pallets.delete(id);
        this.saveToStorage();

        try {
            await window.db.collection('pallets').doc(id).delete();
        } catch (e) {
        }
    }

    listar(buscaNF = '') {
        let lista = Array.from(this.pallets.values());

        if (buscaNF) {
            lista = lista.filter(p => p.notaFiscal?.includes(buscaNF.toUpperCase()));
        }

        return lista.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    }

    listarFinalizados(busca = '') {
        let lista = Array.from(this.finalizados.values());

        if (busca) {
            const buscaUpper = busca.toUpperCase();
            lista = lista.filter(p =>
                p.notaFiscal?.toUpperCase().includes(buscaUpper) ||
                p.recebedor?.toUpperCase().includes(buscaUpper) ||
                p.hub?.toUpperCase().includes(buscaUpper) ||
                p.estado?.toUpperCase().includes(buscaUpper)
            );
        }

        return lista.sort((a, b) =>
            new Date(b.finalizadoEm) - new Date(a.finalizadoEm)
        );
    }

    limparHistorico() {
        this.finalizados.clear();
        this.saveFinalizadosToStorage();
    }

    obterTotalPalletsGrupo(pallet) {
        if (pallet.tipo !== 'VOLUMETRIA_ALTA') return 1;

        if (pallet.palletPrincipalId) {
            const principal = this.pallets.get(pallet.palletPrincipalId);
            if (principal) {
                return 1 + (principal.palletsVinculados?.length || 0);
            }
        }

        return 1 + (pallet.palletsVinculados?.length || 0);
    }

    obterIndiceNoGrupo(pallet) {
        if (pallet.tipo !== 'VOLUMETRIA_ALTA') return 1;

        if (!pallet.palletPrincipalId) {
            return 1;
        }

        const principal = this.pallets.get(pallet.palletPrincipalId);
        if (principal && principal.palletsVinculados) {
            const index = principal.palletsVinculados.indexOf(pallet.id);
            if (index !== -1) {
                return index + 2;
            }
        }

        return 1;
    }
    // palletService.js - Método gerarEtiquetaHTML atualizado

    gerarEtiquetaHTML(pallet, isAgendado, imagemBase64 = null) {
        const dataAtual = new Date();
        const dataSeparacao = dataAtual.toLocaleDateString('pt-BR');
        const horaAtual = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataEmBranco = '__/__/____';
        const horaEmBranco = '__:__';

        // --- Variáveis para exibição condicional ---
        let tituloPallet = 'PALLET';
        let notaFiscalDisplay = pallet.notaFiscal;
        let recebedorDisplay = pallet.recebedor;
        let hubDisplay = pallet.hub;
        let ufCidadeDisplay = '';
        let volumesDisplay = '';
        let palletsDisplay = '';

        if (pallet.tipo === 'VOLUMETRIA_ALTA') {
            tituloPallet = 'PALLET - VOLUMETRIA ALTA';
            ufCidadeDisplay = `${pallet.estado} - ${pallet.cidade}`;
            volumesDisplay = `
                <div style="text-align: center; background: #e8f4f8; padding: 10px; border-radius: 8px; border: 1px solid #3498db;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">VOLUMES</div>
                    <div>
                        <span style="font-size: 32px; font-weight: bold;">${pallet.volumesAtuais}</span>
                        <span style="font-size: 24px;"> / ${pallet.maxVolumes}</span>
                    </div>
                </div>
            `;
            const totalPallets = this.obterTotalPalletsGrupo(pallet);
            const indiceAtual = this.obterIndiceNoGrupo(pallet);
            palletsDisplay = `
                <div style="text-align: center; background: #f0f0f0; padding: 10px; border-radius: 8px; border: 1px solid #7f8c8d;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">PALLETS</div>
                    <div>
                        <span style="font-size: 32px; font-weight: bold;">${indiceAtual}</span>
                        <span style="font-size: 24px;"> / ${totalPallets}</span>
                    </div>
                </div>
            `;
        } else { // DIVERSOS
            tituloPallet = 'PALLET - DIVERSOS';
            notaFiscalDisplay = 'DIVERSOS';
            recebedorDisplay = 'DIVERSOS';
            ufCidadeDisplay = `${pallet.estado} - DIVERSOS`;
            volumesDisplay = `
                <div style="text-align: center; background: #e8f4f8; padding: 10px; border-radius: 8px; border: 1px solid #3498db;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">VOLUMES</div>
                    <div>
                        <span style="font-size: 24px; font-weight: bold;">DIVERSOS</span>
                    </div>
                </div>
            `;
            palletsDisplay = `
                <div style="text-align: center; background: #f0f0f0; padding: 10px; border-radius: 8px; border: 1px solid #7f8c8d;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">PALLETS</div>
                    <div>
                        <span style="font-size: 24px; font-weight: bold;">1</span>
                    </div>
                </div>
            `;
        }

        // --- Lógica de marcação para SERVIÇOS ---
        // Para "Volumetria Alta" e agendado, marca o checkbox "AGENDAMENTO"
        // Para qualquer outro caso, todos os serviços ficam em branco
        const marcarAgendamento = (pallet.tipo === 'VOLUMETRIA_ALTA' && pallet.agendamentoMarcado);

        const agendamentoChecked = marcarAgendamento ? 'background-color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact;' : '';
        const entregaDiretaChecked = '';
        const envioUnidadeChecked = '';
        const interhubChecked = '';

        // --- Estrutura da Etiqueta com as 3 seções ---
        return `
        <div style="
            font-family: Arial, sans-serif;
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            border: 2px solid #333;
            border-radius: 10px;
            background: white;
            box-sizing: border-box;
            font-size: 14px;
            page-break-inside: avoid;
        ">
            <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                <h1 style="margin: 0; font-size: 28px;">${tituloPallet}</h1>
                <p style="color: #666; margin: 5px 0 0 0; font-size: 12px;">${dataSeparacao} ${horaAtual}</p>
            </div>

            <!-- SEÇÃO EXPEDIÇÃO -->
            <div style="margin-bottom: 25px;">
                <h2 style="background: #2c3e50; color: white; padding: 8px 12px; border-radius: 8px; font-size: 18px; margin-bottom: 15px;">EXPEDIÇÃO</h2>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <!-- Coluna de Informações -->
                    <div style="flex: 2; min-width: 200px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                            <div><span style="font-size: 12px; color: #555;">UNIDADE:</span><br><strong>${hubDisplay}</strong></div>
                            <div><span style="font-size: 12px; color: #555;">NÚMERO FISCAL:</span><br><strong>${notaFiscalDisplay}</strong></div>
                            <div><span style="font-size: 12px; color: #555;">RECEBEDOR:</span><br><strong>${recebedorDisplay}</strong></div>
                            <div><span style="font-size: 12px; color: #555;">UF/CIDADE:</span><br><strong>${ufCidadeDisplay}</strong></div>
                        </div>
                        <div style="display: flex; gap: 20px; margin-top: 20px;">
                            ${volumesDisplay}
                            ${palletsDisplay}
                        </div>
                        <div style="margin-top: 20px; display: flex; gap: 20px; flex-wrap: wrap;">
                            <div><span style="font-size: 12px; color: #555;">DATA SEPARAÇÃO:</span><br><strong>${dataSeparacao}</strong></div>
                            <div><span style="font-size: 12px; color: #555;">RESPONSÁVEL SEPARAÇÃO:</span><br><div style="border-bottom: 2px solid #333; width: 200px; height: 28px;"></div></div>
                        </div>
                    </div>
                    <!-- Coluna do QR Code (imagem anexada) -->
                    ${imagemBase64 ? `
                    <div style="flex: 1; min-width: 120px; text-align: center;">
                        <img src="${imagemBase64}" style="max-width: 100%; max-height: 150px; object-fit: contain; border: 1px solid #ccc;" />
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- SEÇÃO TRIAGEM -->
            <div style="margin-bottom: 25px;">
                <h2 style="background: #f39c12; color: white; padding: 8px 12px; border-radius: 8px; font-size: 18px; margin-bottom: 15px;">TRIAGEM</h2>
                <div style="margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; padding: 12px; background: #fafafa;">
                    <div style="font-weight: bold; margin-bottom: 12px; font-size: 14px;">SERVIÇO:</div>
                    <div style="font-size: 13px; display: flex; flex-wrap: wrap; gap: 20px;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: default;">
                            <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; ${entregaDiretaChecked}"></span>
                            Entrega direta para o recebedor
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: default;">
                            <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; ${envioUnidadeChecked}"></span>
                            Envio para a unidade ou ponto de encontro
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: default;">
                            <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; ${interhubChecked}"></span>
                            Interhub / Entrega para o recebedor
                        </label>
                        <label style="display: flex; align-items: center; gap: 8px; cursor: default;">
                            <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; ${agendamentoChecked}"></span>
                            AGENDAMENTO
                        </label>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
                    <div>
                        <span style="font-size: 12px; font-weight: bold;">DATA PREV. EMBARQUE:</span><br>
                        <span style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">${dataEmBranco}</span>
                    </div>
                    <div>
                        <span style="font-size: 12px; font-weight: bold;">LIBERADO POR:</span><br>
                        <div style="border-bottom: 2px solid #333; height: 28px;"></div>
                    </div>
                </div>
            </div>

            <!-- SEÇÃO ENTREGA -->
            <div style="margin-bottom: 25px;">
                <h2 style="background: #27ae60; color: white; padding: 8px 12px; border-radius: 8px; font-size: 18px; margin-bottom: 15px;">ENTREGA</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <span style="font-size: 12px; font-weight: bold;">MOTORISTA PREVISTO:</span><br>
                        <div style="border-bottom: 2px solid #333; height: 28px;"></div>
                    </div>
                    <div>
                        <span style="font-size: 12px; font-weight: bold;">LIBERADO POR:</span><br>
                        <div style="border-bottom: 2px solid #333; height: 28px;"></div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <span style="font-size: 12px; font-weight: bold;">DATA REALIZADA ENTREGA:</span><br>
                        <span style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">${dataEmBranco}</span>
                    </div>
                    <div>
                        <span style="font-size: 12px; font-weight: bold;">HORA:</span><br>
                        <span style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">${horaEmBranco}</span>
                    </div>
                </div>
            </div>

            <!-- OBSERVAÇÃO -->
            <div>
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">OBSERVAÇÃO:</div>
                <div style="border: 1px solid #333; min-height: 45px; border-radius: 4px;"></div>
            </div>
        </div>
    `;
    }

    imprimirEtiqueta(pallet, isAgendado, imagemBase64 = null) {
        const html = this.gerarEtiquetaHTML(pallet, isAgendado, imagemBase64);

        const janela = window.open('', '_blank');
        janela.document.write(`
        <html>
            <head>
                <title>Etiqueta Pallet - ${pallet.notaFiscal}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        background: #f0f0f0;
                        font-family: Arial, sans-serif;
                        padding: 20px;
                    }
                    @media print {
                        body {
                            background: white;
                            padding: 0;
                            display: flex;
                            align-items: flex-start;
                            min-height: auto;
                        }
                        button {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                ${html}
                <button onclick="window.print()" style="
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 12px 24px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    z-index: 1000;
                ">🖨️ IMPRIMIR</button>
            </body>
        </html>
    `);
        janela.document.close();
    }
}
