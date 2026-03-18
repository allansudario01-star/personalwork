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
    const data = new Date().toLocaleDateString('pt-BR');
    const hora = new Date().toLocaleTimeString('pt-BR');

    return `
            <div style="
                font-family: Arial, sans-serif;
                width: 300px;
                padding: 20px;
                border: 2px solid #333;
                border-radius: 10px;
                background: white;
                margin: 10px auto;
            ">
                <div style="text-align: center; margin-bottom: 15px;">
                    <h2 style="margin: 0; color: #333;">PALLET</h2>
                    <p style="color: #666; margin: 5px 0;">${data} ${hora}</p>
                </div>

                <div style="margin: 15px 0;">
                    <p><strong>NF:</strong> ${pallet.notaFiscal}</p>
                    <p><strong>Recebedor:</strong> ${pallet.recebedor}</p>
                    <p><strong>Hub/UF:</strong> ${pallet.hub} - ${pallet.estado}</p>
                    <p><strong>Cidade:</strong> ${pallet.cidade}</p>
                </div>

                <div style="
                    background: ${isAgendado ? '#f39c12' : '#3498db'};
                    color: white;
                    padding: 10px;
                    text-align: center;
                    border-radius: 5px;
                    margin: 15px 0;
                ">
                    ${isAgendado ? '⚠️ AGENDADO' : '📦 NÃO AGENDADO'}
                </div>

                <div style="
                    border-top: 2px dashed #333;
                    padding-top: 15px;
                    margin-top: 15px;
                ">
                    <p style="text-align: center; font-size: 18px; font-weight: bold;">
                        ${pallet.volumesAtuais} / ${pallet.maxVolumes} Volumes
                    </p>
                    <p style="text-align: center; font-size: 24px;">📦</p>
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
