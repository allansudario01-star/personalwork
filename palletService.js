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

    gerarEtiquetaHTML(pallet, isAgendado, qrCodeImage = null) {
        const dataAtual = new Date();
        const dataSeparacao = dataAtual.toLocaleDateString('pt-BR');
        const horaAtual = dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const dataEmBranco = '__/__/____';
        const horaEmBranco = '__:__';

        const qrCodeHTML = qrCodeImage ? `
    <div style="
      display: flex;
      justify-content: center;
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
    ">
      <img src="${qrCodeImage}" style="
        max-width: 150px;
        height: auto;
        border-radius: 10px;
      " alt="QR Code">
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
      border-radius: 20px;
      background: white;
      box-sizing: border-box;
      font-size: 14px;
      page-break-inside: avoid;
      position: relative;
    ">

      <div style="text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 8px;">
        <h1 style="margin: 0; font-size: 32px;">PALLET</h1>
        <p style="color: #666; margin: 5px 0 0 0; font-size: 12px;">${dataSeparacao} ${horaAtual}</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div>
          <div style="margin-bottom: 8px;">
            <span style="font-size: 12px; color: #555;">UNIDADE:</span><br>
            <span style="font-size: 18px; font-weight: bold;">${pallet.hub}</span>
          </div>
          <div>
            <span style="font-size: 12px; color: #555;">RECEBEDOR:</span><br>
            <span style="font-size: 18px; font-weight: bold;">${pallet.recebedor}</span>
          </div>
        </div>
        <div>
          <div style="margin-bottom: 8px;">
            <span style="font-size: 12px; color: #555;">NOTA FISCAL:</span><br>
            <span style="font-size: 18px; font-weight: bold;">${pallet.notaFiscal}</span>
          </div>
          <div>
            <span style="font-size: 12px; color: #555;">UF/CIDADE:</span><br>
            <span style="font-size: 18px; font-weight: bold;">${pallet.estado} - ${pallet.cidade}</span>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div style="text-align: center; background: #e8f4f8; padding: 10px; border-radius: 8px; border: 1px solid #3498db;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">VOLUMES</div>
          <div>
            <span style="font-size: 32px; font-weight: bold;">_____</span>
            <span style="font-size: 24px;"> / ${pallet.maxVolumes}</span>
          </div>
        </div>
        <div style="text-align: center; background: #f0f0f0; padding: 10px; border-radius: 8px; border: 1px solid #7f8c8d;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">PALLETS</div>
          <div>
            <span style="font-size: 32px; font-weight: bold;">_____</span>
            <span style="font-size: 24px;"> / ___</span>
          </div>
        </div>
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

      <div style="display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 15px; margin-bottom: 12px;">
        <div>
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">VINCULAR NF:</div>
          <div style="border-bottom: 2px solid #333; height: 24px;"></div>
        </div>
        <div style="display: flex; gap: 25px; align-items: center;">
          <div style="font-size: 14px;">
            <span style="border: 2px solid #333; display: inline-block; width: 18px; height: 18px; margin-right: 8px; vertical-align: middle; ${isAgendado ? 'background-color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact;' : ''}"></span>
            <span style="vertical-align: middle; font-weight: bold;">AGENDAMENTO</span>
          </div>
          <div style="font-size: 14px;">
            <span style="border: 2px solid #333; display: inline-block; width: 18px; height: 18px; margin-right: 8px; vertical-align: middle; ${!isAgendado ? 'background-color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact;' : ''}"></span>
            <span style="vertical-align: middle; font-weight: bold;">BOLSÃO</span>
          </div>
        </div>
      </div>

      <div>
        <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">OBSERVAÇÃO:</div>
        <div style="border: 1px solid #333; min-height: 45px; border-radius: 4px;"></div>
      </div>

      ${qrCodeHTML}
    </div>
  `;
    }

    imprimirEtiqueta(pallet, isAgendado) {
        const qrCodeImage = window.imageManager ? window.imageManager.getImagem() : null;
        const html = this.gerarEtiquetaHTML(pallet, isAgendado, qrCodeImage);

        const janela = window.open('', '_blank');
        janela.document.write(`
    <html>
      <head>
        <title>Etiqueta Pallet - NF ${pallet.notaFiscal}</title>
        <style>
          @page {
            size: A4;
            margin: 1cm;
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
            .checkbox-filled {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
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

    imprimirEtiqueta(pallet, isAgendado) {
        const qrCodeImage = window.imageManager ? window.imageManager.getImagem() : null;
        const html = this.gerarEtiquetaHTML(pallet, isAgendado, qrCodeImage);

        const janela = window.open('', '_blank');
        janela.document.write(`
    <html>
      <head>
        <title>Etiqueta Pallet - NF ${pallet.notaFiscal}</title>
        <style>
          @page {
            size: A4;
            margin: 1cm;
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
            .checkbox-filled {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
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
