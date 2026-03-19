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
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
            padding: 30px;
            border: 2px solid #333;
            border-radius: 15px;
            background: white;
            box-sizing: border-box;
            font-size: 16px;
        ">

            <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #333; padding-bottom: 15px;">
                <h1 style="margin: 0; color: #333; font-size: 42px; font-weight: bold;">PALLET</h1>
                <p style="color: #666; margin: 10px 0 0 0; font-size: 18px;">${dataSeparacao} ${horaAtual}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px; background: #f8f9fa; padding: 20px; border-radius: 10px;">
                <div>
                    <div style="margin-bottom: 20px;">
                        <span style="font-size: 18px; color: #555;">UNIDADE (HUB):</span><br>
                        <span style="font-size: 28px; font-weight: bold;">${pallet.hub}</span>
                    </div>
                    <div>
                        <span style="font-size: 18px; color: #555;">RECEBEDOR:</span><br>
                        <span style="font-size: 28px; font-weight: bold;">${pallet.recebedor}</span>
                    </div>
                </div>
                <div>
                    <div style="margin-bottom: 20px;">
                        <span style="font-size: 18px; color: #555;">NOTA FISCAL:</span><br>
                        <span style="font-size: 28px; font-weight: bold;">${pallet.notaFiscal}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <span style="font-size: 18px; color: #555;">UF:</span><br>
                            <span style="font-size: 24px; font-weight: bold;">${pallet.estado}</span>
                        </div>
                        <div>
                            <span style="font-size: 18px; color: #555;">CIDADE:</span><br>
                            <span style="font-size: 24px; font-weight: bold;">${pallet.cidade}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style="
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 25px;
                margin-bottom: 35px;
            ">
                <div style="
                    text-align: center;
                    padding: 25px;
                    background: #e8f4f8;
                    border-radius: 15px;
                    border: 2px solid #3498db;
                ">
                    <span style="font-size: 22px; font-weight: bold; color: #2c3e50;">VOLUMES</span><br>
                    <span style="font-size: 58px; font-weight: bold; color: #3498db;">_____</span>
                    <span style="font-size: 48px; font-weight: bold; color: #2c3e50;"> / </span>
                    <span style="font-size: 58px; font-weight: bold; color: #2c3e50;">${pallet.maxVolumes}</span>
                </div>
                <div style="
                    text-align: center;
                    padding: 25px;
                    background: #f0f0f0;
                    border-radius: 15px;
                    border: 2px solid #7f8c8d;
                ">
                    <span style="font-size: 22px; font-weight: bold; color: #2c3e50;">PALLETS</span><br>
                    <span style="font-size: 58px; font-weight: bold; color: #7f8c8d;">_____</span>
                    <span style="font-size: 48px; font-weight: bold; color: #2c3e50;"> / </span>
                    <span style="font-size: 58px; font-weight: bold; color: #2c3e50;">___</span>
                </div>
            </div>

            <div style="margin-bottom: 30px; border: 2px solid #333; padding: 20px; border-radius: 10px;">
                <h2 style="margin: 0 0 20px 0; font-size: 28px;">SERVIÇO:</h2>

                <div style="margin-bottom: 15px; font-size: 22px;">
                    <span style="border: 3px solid #333; display: inline-block; width: 28px; height: 28px; margin-right: 15px; vertical-align: middle;"></span>
                    <span style="vertical-align: middle;">Entrega direta para o recebedor</span>
                </div>

                <div style="margin-bottom: 15px; font-size: 22px;">
                    <span style="border: 3px solid #333; display: inline-block; width: 28px; height: 28px; margin-right: 15px; vertical-align: middle;"></span>
                    <span style="vertical-align: middle;">Envio para a unidade ou ponto de encontro</span>
                </div>

                <div style="font-size: 22px;">
                    <span style="border: 3px solid #333; display: inline-block; width: 28px; height: 28px; margin-right: 15px; vertical-align: middle;"></span>
                    <span style="vertical-align: middle;">Interhub / Entrega para o recebedor</span>
                </div>
            </div>

            <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; font-size: 28px;">TIPO DE VEÍCULO:</h2>
                <div style="border-bottom: 3px solid #333; margin-top: 5px; height: 40px;"></div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px;">
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <span style="font-size: 22px; font-weight: bold; color: #555;">DATA SEPARAÇÃO:</span><br>
                    <span style="font-size: 32px; font-weight: bold;">${dataSeparacao}</span>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
                    <span style="font-size: 22px; font-weight: bold; color: #555;">DATA PREV. EMBARQUE:</span><br>
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${dataEmBranco}</span>
                </div>
            </div>

            <div style="margin-bottom: 30px; border-top: 3px solid #333; padding-top: 20px;">
                <h2 style="margin: 0 0 20px 0; font-size: 32px;">VIAGEM</h2>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 20px;">
                    <div>
                        <span style="font-size: 22px; font-weight: bold;">Motorista previsto:</span><br>
                        <div style="border-bottom: 2px solid #333; margin-top: 10px; height: 35px;"></div>
                    </div>
                    <div>
                        <span style="font-size: 22px; font-weight: bold;">Liberado por:</span><br>
                        <div style="border-bottom: 2px solid #333; margin-top: 10px; height: 35px;"></div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
                    <div>
                        <span style="font-size: 22px; font-weight: bold;">Data realizada entrega:</span><br>
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${dataEmBranco}</span>
                    </div>
                    <div>
                        <span style="font-size: 22px; font-weight: bold;">Hora:</span><br>
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">${horaEmBranco}</span>
                    </div>
                </div>
            </div>

            <div style="margin-bottom: 30px;">
                <h2 style="margin: 0 0 10px 0; font-size: 28px;">VINCULAR NOTA FISCAL:</h2>
                <div style="border-bottom: 2px solid #333; height: 40px;"></div>
            </div>

            <div style="margin-bottom: 30px;">
                <div style="display: flex; gap: 50px; align-items: center;">
                    <div style="font-size: 28px;">
                        <span style="border: 3px solid #333; display: inline-block; width: 32px; height: 32px; margin-right: 15px; vertical-align: middle; ${isAgendado ? 'background: #333;' : ''}"></span>
                        <span style="vertical-align: middle;"><strong>AGENDAMENTO</strong></span>
                    </div>
                    <div style="font-size: 28px;">
                        <span style="border: 3px solid #333; display: inline-block; width: 32px; height: 32px; margin-right: 15px; vertical-align: middle; ${!isAgendado ? 'background: #333;' : ''}"></span>
                        <span style="vertical-align: middle;"><strong>BOLSÃO</strong></span>
                    </div>
                </div>
            </div>

            <div>
                <h2 style="margin: 0 0 10px 0; font-size: 28px;">OBSERVAÇÃO:</h2>
                <div style="border: 2px solid #333; min-height: 80px; padding: 15px; border-radius: 8px;"></div>
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
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        display: flex;
                        justify-content: center;
                        align-items: flex-start;
                        min-height: 100vh;
                        padding: 20px;
                        background: #f0f0f0;
                        font-family: Arial, sans-serif;
                    }
                    @media print {
                        body {
                            background: white;
                            padding: 0.5cm;
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
                    padding: 15px 30px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    z-index: 1000;
                ">🖨️ IMPRIMIR</button>
            </body>
        </html>
    `);
    janela.document.close();
  }
}
