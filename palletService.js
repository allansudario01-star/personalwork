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

    // Formato de data em branco para preenchimento (__/__/____)
    const dataEmBranco = '__/__/____';
    const horaEmBranco = '__:__';

    return `
        <div style="
            font-family: Arial, sans-serif;
            width: 320px;
            padding: 15px;
            border: 2px solid #333;
            border-radius: 10px;
            background: white;
            margin: 10px auto;
            font-size: 12px;
        ">

            <div style="text-align: center; margin-bottom: 12px; border-bottom: 2px solid #333; padding-bottom: 8px;">
                <h2 style="margin: 0; color: #333; font-size: 20px;">PALLET</h2>
                <p style="color: #666; margin: 3px 0; font-size: 10px;">${dataSeparacao} ${horaAtual}</p>
            </div>

            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span><strong>Unidade (Hub):</strong> ${pallet.hub}</span>
                    <span><strong>NF:</strong> ${pallet.notaFiscal}</span>
                </div>

                <div style="margin-bottom: 5px;">
                    <strong>Recebedor:</strong> ${pallet.recebedor}
                </div>

                <div style="display: flex; justify-content: space-between;">
                    <span><strong>UF:</strong> ${pallet.estado}</span>
                    <span><strong>Cidade:</strong> ${pallet.cidade}</span>
                </div>
            </div>

            <div style="
                display: flex;
                justify-content: space-between;
                margin-bottom: 15px;
                padding: 8px;
                background: #f5f5f5;
                border-radius: 5px;
            ">
                <div style="text-align: center; flex: 1;">
                    <strong style="font-size: 14px;">VOLUMES</strong><br>
                    <span style="font-size: 18px; font-weight: bold;">_____ / ${pallet.maxVolumes}</span>
                </div>
                <div style="text-align: center; flex: 1;">
                    <strong style="font-size: 14px;">PALLETS</strong><br>
                    <span style="font-size: 18px; font-weight: bold;">_____ / ___</span>
                </div>
            </div>

            <div style="margin-bottom: 15px; border: 1px solid #ccc; padding: 8px; border-radius: 5px;">
                <strong style="display: block; margin-bottom: 8px;">SERVIÇO:</strong>

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

            <div style="margin-bottom: 15px;">
                <strong>TIPO DE VEÍCULO:</strong>
                <div style="border-bottom: 1px solid #333; margin-top: 5px; height: 20px;"></div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                <div style="flex: 1;">
                    <strong>DATA SEPARAÇÃO:</strong><br>
                    <span>${dataSeparacao}</span>
                </div>
                <div style="flex: 1;">
                    <strong>DATA PREV. EMBARQUE:</strong><br>
                    <span>${dataEmBranco}</span>
                </div>
            </div>

            <div style="margin-bottom: 15px; border-top: 2px solid #333; padding-top: 8px;">
                <strong style="font-size: 14px;">VIAGEM</strong>

                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                    <span><strong>Motorista previsto:</strong> _________________</span>
                    <span><strong>Liberado por:</strong> _________________</span>
                </div>

                <div style="display: flex; justify-content: space-between;">
                    <span><strong>Data realizada entrega:</strong> ${dataEmBranco}</span>
                    <span><strong>Hora:</strong> ${horaEmBranco}</span>
                </div>
            </div>

            <div style="margin-bottom: 15px;">
                <strong>VINCULAR NOTA FISCAL:</strong>
                <div style="border-bottom: 1px solid #333; margin-top: 5px; height: 20px;"></div>
            </div>

            <div style="margin-bottom: 15px;">
                <div style="display: flex; gap: 20px; margin-bottom: 10px;">
                    <div>
                        <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; margin-right: 8px; vertical-align: middle; ${isAgendado ? 'background: #333;' : ''}"></span>
                        <span style="vertical-align: middle;"><strong>AGENDAMENTO</strong></span>
                    </div>
                    <div>
                        <span style="border: 2px solid #333; display: inline-block; width: 16px; height: 16px; margin-right: 8px; vertical-align: middle; ${!isAgendado ? 'background: #333;' : ''}"></span>
                        <span style="vertical-align: middle;"><strong>BOLSÃO</strong></span>
                    </div>
                </div>
            </div>

            <div>
                <strong>OBSERVAÇÃO:</strong>
                <div style="border: 1px solid #333; margin-top: 5px; min-height: 40px; padding: 5px;"></div>
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
                        body {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            margin: 0;
                            padding: 20px;
                            background: #f0f0f0;
                        }
                        @media print {
                            body { background: white; }
                            button { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${html}
                    <button onclick="window.print()" style="
                        position: fixed;
                        bottom: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        padding: 15px 30px;
                        background: #3498db;
                        color: white;
                        border: none;
                        border-radius: 25px;
                        font-size: 16px;
                        cursor: pointer;
                    ">🖨️ Imprimir Etiqueta</button>
                </body>
            </html>
        `);
    janela.document.close();
  }
}
