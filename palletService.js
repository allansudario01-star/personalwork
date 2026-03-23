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
                console.log('Erro ao carregar pallets:', e);
            }
        }

        const finalizados = localStorage.getItem('palletsFinalizados');
        if (finalizados) {
            try {
                const lista = JSON.parse(finalizados);
                lista.forEach(p => this.finalizados.set(p.id, p));
            } catch (e) {
                console.log('Erro ao carregar finalizados:', e);
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
            console.log('Offline: salvo só no celular');
        }

        return novo;
    }

    async anexarPallet(idPalletPrincipal) {
        const palletPrincipal = this.pallets.get(idPalletPrincipal);
        if (!palletPrincipal || palletPrincipal.tipo !== 'VOLUMETRIA_ALTA') {
            console.error('Só é possível anexar a pallets de volumetria alta');
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
            console.log('Offline: anexo salvo localmente');
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
            console.log('Offline: update salvo localmente');
        }
    }

    async marcarAgendamento(id, marcado) {
        const pallet = this.pallets.get(id);
        if (!pallet || pallet.tipo !== 'VOLUMETRIA_ALTA') return;

        pallet.agendamentoMarcado = marcado;
        this.saveToStorage();

        try {
            await window.db.collection('pallets').doc(id).update({
                agendamentoMarcado: marcado
            });
        } catch (e) {
            console.log('Offline: marcação de agendamento salva localmente');
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
            console.log('Offline: finalizado localmente');
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
            console.log('Offline: excluído localmente');
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

    // CORRIGIDO: Retorna o total de pallets no grupo (principal + anexos)
    obterTotalPalletsGrupo(pallet) {
        if (pallet.tipo !== 'VOLUMETRIA_ALTA') return 1;

        // Se é um anexo, pega o principal e conta
        if (pallet.palletPrincipalId) {
            const principal = this.pallets.get(pallet.palletPrincipalId);
            if (principal) {
                return 1 + (principal.palletsVinculados?.length || 0);
            }
        }

        // Se é o principal, conta ele + seus anexos
        return 1 + (pallet.palletsVinculados?.length || 0);
    }

    // CORRIGIDO: Retorna o índice correto do pallet no grupo
    obterIndiceNoGrupo(pallet) {
        if (pallet.tipo !== 'VOLUMETRIA_ALTA') return 1;

        // Se NÃO tem palletPrincipalId, é o principal (índice 1)
        if (!pallet.palletPrincipalId) {
            return 1;
        }

        // É um anexo, precisa encontrar sua posição na lista de anexos do principal
        const principal = this.pallets.get(pallet.palletPrincipalId);
        if (principal && principal.palletsVinculados) {
            const index = principal.palletsVinculados.indexOf(pallet.id);
            // Índice 0 no array = 2º pallet no grupo
            if (index !== -1) {
                return index + 2;
            }
        }

        return 1;
    }

    gerarEtiquetaHTML(pallet, isAgendado, imagemBase64 = null) {
        const dataAtual = new Date();
        const dataSeparacao = dataAtual.toLocaleDateString('pt-BR');
        const horaAtual = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataEmBranco = '__/__/____';
        const horaEmBranco = '__:__';

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
        } else {
            tituloPallet = 'PALLET - DIVERSOS';
            ufCidadeDisplay = `${pallet.estado} - DIVERSOS`;
            volumesDisplay = `
                <div style="text-align: center; background: #e8f4f8; padding: 10px; border-radius: 8px; border: 1px solid #3498db;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">VOLUMES</div>
                    <div>
                        <span style="font-size: 24px; font-weight: bold;">DIVERSOS</span>
                    </div>
                </div>
            `;
        }

        const agendamentoChecked = pallet.tipo === 'VOLUMETRIA_ALTA' && pallet.agendamentoMarcado;

        const agendamentoSection = pallet.tipo === 'VOLUMETRIA_ALTA' ? `
            <div style="display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 15px; margin-bottom: 12px;">
                <div>
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">VINCULAR NF:</div>
                    <div style="border-bottom: 2px solid #333; height: 24px;"></div>
                </div>
                <div style="display: flex; gap: 25px; align-items: center;">
                    <div style="font-size: 14px;">
                        <span style="border: 2px solid #333; display: inline-block; width: 18px; height: 18px; margin-right: 8px; vertical-align: middle; ${agendamentoChecked ? 'background-color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact;' : ''}"></span>
                        <span style="vertical-align: middle; font-weight: bold;">AGENDAMENTO</span>
                    </div>
                    <div style="font-size: 14px;">
                        <span style="border: 2px solid #333; display: inline-block; width: 18px; height: 18px; margin-right: 8px; vertical-align: middle; ${!agendamentoChecked ? 'background-color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact;' : ''}"></span>
                        <span style="vertical-align: middle; font-weight: bold;">BOLSÃO</span>
                    </div>
                    <div style="font-size: 14px;">
                        <span style="border: 2px solid #333; display: inline-block; width: 18px; height: 18px; margin-right: 8px; vertical-align: middle;"></span>
                        <span style="vertical-align: middle; font-weight: bold;">AGUARDANDO DATA DE AGENDAMENTO</span>
                    </div>
                </div>
            </div>
        ` : '';

        return `
        <div style="
            font-family: Arial, sans-serif;
            width: 100%;
            max-width: 700px;
            margin: 0 auto;
            padding: 20px;
            border: 2px solid #333;
            border-radius: 10px;
            background: white;
            box-sizing: border-box;
            font-size: 14px;
            page-break-inside: avoid;
        ">
            <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 8px;">
                <h1 style="margin: 0; font-size: 32px;">${tituloPallet}</h1>
                <p style="color: #666; margin: 5px 0 0 0; font-size: 12px;">${dataSeparacao} ${horaAtual}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <div style="margin-bottom: 8px;">
                        <span style="font-size: 12px; color: #555;">UNIDADE:</span><br>
                        <span style="font-size: 18px; font-weight: bold;">${hubDisplay}</span>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: #555;">RECEBEDOR:</span><br>
                        <span style="font-size: 18px; font-weight: bold;">${recebedorDisplay}</span>
                    </div>
                </div>
                <div>
                    <div style="margin-bottom: 8px;">
                        <span style="font-size: 12px; color: #555;">NÚMERO FISCAL:</span><br>
                        <span style="font-size: 18px; font-weight: bold;">${notaFiscalDisplay}</span>
                    </div>
                    <div>
                        <span style="font-size: 12px; color: #555;">UF/CIDADE:</span><br>
                        <span style="font-size: 18px; font-weight: bold;">${ufCidadeDisplay}</span>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                ${volumesDisplay}
                ${palletsDisplay}
            </div>

            <div style="margin-bottom: 15px; border: 1px solid #333; padding: 10px; border-radius: 5px;">
                <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">SERVIÇO:</div>
                <div style="font-size: 12px;">
                    <div style="margin-bottom: 5px;">
                        <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; margin-right: 8px; vertical-align: middle;"></span>
                        <span style="vertical-align: middle;">Entrega direta para o recebedor</span>
                    </div>
                    <div style="margin-bottom: 5px;">
                        <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; margin-right: 8px; vertical-align: middle;"></span>
                        <span style="vertical-align: middle;">Envio para a unidade ou ponto de encontro</span>
                    </div>
                    <div>
                        <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; margin-right: 8px; vertical-align: middle;"></span>
                        <span style="vertical-align: middle;">Interhub / Entrega para o recebedor</span>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">TIPO VEÍCULO:</div>
                    <div style="border-bottom: 2px solid #333; height: 24px;"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <div style="font-size: 11px; font-weight: bold; color: #555;">DATA SEPARAÇÃO:</div>
                        <div style="font-size: 16px; font-weight: bold;">${dataSeparacao}</div>
                    </div>
                    <div>
                        <div style="font-size: 11px; font-weight: bold; color: #555;">DATA PREV. EMBARQUE:</div>
                        <div style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">${dataEmBranco}</div>
                    </div>
                </div>
            </div>

            ${agendamentoSection}

            <div style="margin-bottom: 15px; border-top: 2px solid #333; padding-top: 8px;">
                <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">VIAGEM</div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 8px;">
                    <div>
                        <span style="font-size: 11px; font-weight: bold;">Motorista previsto:</span><br>
                        <div style="border-bottom: 2px solid #333; height: 22px;"></div>
                    </div>
                    <div>
                        <span style="font-size: 11px; font-weight: bold;">Liberado por:</span><br>
                        <div style="border-bottom: 2px solid #333; height: 22px;"></div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <span style="font-size: 11px; font-weight: bold;">Data realizada entrega:</span><br>
                        <span style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">${dataEmBranco}</span>
                    </div>
                    <div>
                        <span style="font-size: 11px; font-weight: bold;">Hora:</span><br>
                        <span style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">${horaEmBranco}</span>
                    </div>
                </div>
            </div>

            <div>
                <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">OBSERVAÇÃO:</div>
                <div style="border: 1px solid #333; min-height: 45px; border-radius: 4px;"></div>
            </div>

            ${imagemBase64 ? `<div style="margin-top: 20px; text-align: center;">
                <img src="${imagemBase64}" style="max-width: 100%; max-height: 200px; object-fit: contain;" />
            </div>` : ''}
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
