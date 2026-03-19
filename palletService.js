class PalletService {
  constructor() {
    this.pallets = new Map();
    this.finalizados = new Map();
    this.loadFromStorage();
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

  async create(data) {
    const id = Date.now().toString();
    const novo = {
      id,
      ...data,
      volumesAtuais: 0,
      criadoEm: new Date().toISOString(),
      ultimaAtualizacao: new Date().toISOString(),
      status: 'ativo',
      bipado: false
    };

    novo.recebedor = novo.recebedor.toUpperCase().trim();
    novo.hub = novo.hub.toUpperCase().trim();
    novo.estado = novo.estado.toUpperCase().trim();
    novo.cidade = novo.cidade.toUpperCase().trim();

    this.pallets.set(id, novo);
    this.saveToStorage();

    try {
      await window.db.collection('pallets').doc(id).set(novo);
    } catch (e) {
      console.log('Offline: salvo só no celular');
    }

    return novo;
  }

  async updateVolumes(id, novosVolumes) {
    const pallet = this.pallets.get(id);
    if (!pallet) return;

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

  async finalizar(id, bipado = false) {
    const pallet = this.pallets.get(id);
    if (!pallet) return;

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

  listar(filtroPosicao = '', buscaNF = '') {
    let lista = Array.from(this.pallets.values());

    if (filtroPosicao) {
      lista = lista.filter(p => p.palletPosicao?.startsWith(filtroPosicao));
    }

    if (buscaNF) {
      lista = lista.filter(p => p.notaFiscal?.includes(buscaNF));
    }

    return lista.sort((a, b) => {
      const aCompleto = a.volumesAtuais >= a.maxVolumes ? 1 : 0;
      const bCompleto = b.volumesAtuais >= b.maxVolumes ? 1 : 0;
      return aCompleto - bCompleto;
    });
  }

  listarFinalizados(busca = '') {
    let lista = Array.from(this.finalizados.values());

    if (busca) {
      const buscaUpper = busca.toUpperCase();
      lista = lista.filter(p =>
        p.notaFiscal?.includes(busca) ||
        p.recebedor?.includes(buscaUpper)
      );
    }

    return lista.sort((a, b) =>
      new Date(b.finalizadoEm) - new Date(a.finalizadoEm)
    );
  }

  limparHistorico() {
    this.finalizados.clear();
    this.saveFinalizadosToStorage();

    try {

    } catch (e) { }
  }

  gerarEtiquetaHTML(pallet, isAgendado) {
    const dataAtual = new Date();
    const dataSeparacao = dataAtual.toLocaleDateString('pt-BR');
    const horaAtual = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const dataEmBranco = '__/__/____';
    const horaEmBranco = '__:__';

    return `
        <div style="
            font-family: Arial, sans-serif;
            width: 100%;
            max-width: 700px;
            margin: 0 auto;
            padding: 15px;
            border: 2px solid #333;
            border-radius: 10px;
            background: white;
            box-sizing: border-box;
            font-size: 14px;
            page-break-inside: avoid;
        ">
            <!-- CABEÇALHO COMPACTO -->
            <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 5px;">
                <h1 style="margin: 0; font-size: 28px;">PALLET</h1>
                <p style="color: #666; margin: 2px 0; font-size: 12px;">${dataSeparacao} ${horaAtual}</p>
            </div>

            <!-- DADOS PRINCIPAIS EM 2 COLUNAS -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div>
                    <div><strong style="font-size: 12px;">UNIDADE:</strong> <span style="font-size: 16px; font-weight: bold;">${pallet.hub}</span></div>
                    <div><strong style="font-size: 12px;">RECEBEDOR:</strong> <span style="font-size: 16px; font-weight: bold;">${pallet.recebedor}</span></div>
                </div>
                <div>
                    <div><strong style="font-size: 12px;">NF:</strong> <span style="font-size: 16px; font-weight: bold;">${pallet.notaFiscal}</span></div>
                    <div><strong style="font-size: 12px;">UF/CIDADE:</strong> <span style="font-size: 16px; font-weight: bold;">${pallet.estado} - ${pallet.cidade}</span></div>
                </div>
            </div>

            <!-- VOLUMES E PALLETS - LADO A LADO -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                <div style="text-align: center; background: #e8f4f8; padding: 8px; border-radius: 8px;">
                    <div style="font-size: 12px; font-weight: bold;">VOLUMES</div>
                    <div><span style="font-size: 24px; font-weight: bold;">_____</span><span style="font-size: 20px;"> / ${pallet.maxVolumes}</span></div>
                </div>
                <div style="text-align: center; background: #f0f0f0; padding: 8px; border-radius: 8px;">
                    <div style="font-size: 12px; font-weight: bold;">PALLETS</div>
                    <div><span style="font-size: 24px; font-weight: bold;">_____</span><span style="font-size: 20px;"> / ___</span></div>
                </div>
            </div>

            <!-- SERVIÇO COMPACTO -->
            <div style="margin-bottom: 8px; border: 1px solid #333; padding: 8px; border-radius: 5px;">
                <div style="font-weight: bold; margin-bottom: 5px; font-size: 12px;">SERVIÇO:</div>
                <div style="font-size: 11px;">
                    <div><span style="border: 2px solid #333; display: inline-block; width: 14px; height: 14px; margin-right: 5px;"></span> Entrega direta para o recebedor</div>
                    <div><span style="border: 2px solid #333; display: inline-block; width: 14px; height: 14px; margin-right: 5px;"></span> Envio para a unidade ou ponto de encontro</div>
                    <div><span style="border: 2px solid #333; display: inline-block; width: 14px; height: 14px; margin-right: 5px;"></span> Interhub / Entrega para o recebedor</div>
                </div>
            </div>

            <!-- TIPO VEÍCULO E DATAS -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                <div>
                    <div style="font-weight: bold; font-size: 12px;">TIPO VEÍCULO:</div>
                    <div style="border-bottom: 2px solid #333; height: 18px;"></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                    <div>
                        <div style="font-size: 10px; font-weight: bold;">DATA SEP:</div>
                        <span style="font-size: 12px;">${dataSeparacao}</span>
                    </div>
                    <div>
                        <div style="font-size: 10px; font-weight: bold;">DATA PREV:</div>
                        <span style="font-size: 12px;">${dataEmBranco}</span>
                    </div>
                </div>
            </div>

            <!-- VIAGEM COMPACTA -->
            <div style="margin-bottom: 8px; border-top: 2px solid #333; padding-top: 5px;">
                <div style="font-weight: bold; font-size: 14px;">VIAGEM</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 5px 0;">
                    <div><span style="font-size: 10px;">Motorista:</span> <span style="border-bottom: 2px solid #333; display: inline-block; width: 100%;"></span></div>
                    <div><span style="font-size: 10px;">Liberado:</span> <span style="border-bottom: 2px solid #333; display: inline-block; width: 100%;"></span></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div><span style="font-size: 10px;">Data entrega:</span> <span style="font-size: 12px;">${dataEmBranco}</span></div>
                    <div><span style="font-size: 10px;">Hora:</span> <span style="font-size: 12px;">${horaEmBranco}</span></div>
                </div>
            </div>

            <!-- VINCULAR NF E CHECKBOXES -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                <div>
                    <div style="font-weight: bold; font-size: 12px;">VINCULAR NF:</div>
                    <div style="border-bottom: 2px solid #333; height: 18px;"></div>
                </div>
                <div style="display: flex; gap: 15px;">
                    <div style="font-size: 12px;">
                        <span style="border: 2px solid #333; display: inline-block; width: 14px; height: 14px; margin-right: 3px; ${isAgendado ? 'background: #333;' : ''}"></span> AGEND
                    </div>
                    <div style="font-size: 12px;">
                        <span style="border: 2px solid #333; display: inline-block; width: 14px; height: 14px; margin-right: 3px; ${!isAgendado ? 'background: #333;' : ''}"></span> BOLSÃO
                    </div>
                </div>
            </div>

            <!-- OBSERVAÇÃO -->
            <div>
                <div style="font-weight: bold; font-size: 12px;">OBS:</div>
                <div style="border: 1px solid #333; min-height: 35px; border-radius: 4px;"></div>
            </div>
        </div>
    `;
  }

  imprimirEtiqueta(pallet, isAgendado) {
    const html = this.gerarEtiquetaHTML(pallet, isAgendado);

    const janela = window.open('', '_blank');
    janela.document.write(`
        <html>
            <head>
                <title>Etiqueta Pallet - NF ${pallet.notaFiscal}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 0.5cm;
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
                        padding: 10px;
                    }
                    @media print {
                        body {
                            background: white;
                            padding: 0;
                            display: block;
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
                    bottom: 15px;
                    right: 15px;
                    padding: 10px 20px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    z-index: 1000;
                ">🖨️ IMPRIMIR</button>
            </body>
        </html>
    `);
    janela.document.close();
  }
}
