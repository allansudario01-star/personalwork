// Estado global
let currentUser = null;
let editingAgendamentoId = null;
let serviceReady = false;
let retryCount = 0;
const MAX_RETRIES = 30; // 30 tentativas (15 segundos)

// Aguardar carregamento do DOM
document.addEventListener('DOMContentLoaded', function () {
    console.log('🔐 Iniciando painel admin...');

    // Aguardar o service carregar
    waitForService();

    // Configurar eventos de autenticação
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            currentUser = user;
            console.log('✅ Usuário logado:', user.email);
            showAdminPanel();
            if (serviceReady) {
                carregarAgendamentos();
            }
        } else {
            showLoginScreen();
        }
    });

    // Configurar eventos de UI (serão ativados quando o service estiver pronto)
    configurarEventosQuandoPronto();
});

function waitForService() {
    if (window.agendamentoService) {
        console.log('✅ AgendamentoService carregado!');
        serviceReady = true;

        // Se já está logado, carrega os agendamentos
        if (currentUser) {
            carregarAgendamentos();
        }
        return;
    }

    retryCount++;
    if (retryCount < MAX_RETRIES) {
        console.log(`⏳ Aguardando agendamentoService... (${retryCount}/${MAX_RETRIES})`);
        setTimeout(waitForService, 500);
    } else {
        console.error('❌ Erro: AgendamentoService não carregou após várias tentativas');
        document.getElementById('agendamentos-list').innerHTML =
            '<div style="text-align: center; padding: 50px; color: #e74c3c;">❌ Erro ao carregar serviço. Recarregue a página.</div>';
    }
}

function configurarEventosQuandoPronto() {
    // Verificar periodicamente se o service está pronto
    const checkAndSetup = setInterval(() => {
        if (serviceReady && window.agendamentoService) {
            clearInterval(checkAndSetup);
            setupEventos();
        }
    }, 200);
}

function setupEventos() {
    console.log('🎯 Configurando eventos...');

    // Login
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        try {
            errorDiv.textContent = '';
            await firebase.auth().signInWithEmailAndPassword(email, password);
        } catch (error) {
            console.error('Erro no login:', error);
            if (error.code === 'auth/user-not-found') {
                errorDiv.textContent = '❌ Usuário não encontrado';
            } else if (error.code === 'auth/wrong-password') {
                errorDiv.textContent = '❌ Senha incorreta';
            } else if (error.code === 'auth/invalid-email') {
                errorDiv.textContent = '❌ Email inválido';
            } else {
                errorDiv.textContent = '❌ Erro ao fazer login. Tente novamente.';
            }
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await firebase.auth().signOut();
        showLoginScreen();
    });

    // Criar novo agendamento
    document.getElementById('create-agendamento-btn').addEventListener('click', () => {
        editingAgendamentoId = null;
        document.getElementById('modal-title').textContent = 'Novo Agendamento';
        document.getElementById('modal-uf').value = '';
        document.getElementById('modal-hub').value = '';
        document.getElementById('modal-recebedor').value = '';
        document.getElementById('modal-tipo').value = 'PADRÃO';
        document.getElementById('agendamento-modal').classList.remove('hidden');
    });

    // Fechar modal
    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('agendamento-modal').classList.add('hidden');
    });

    // Salvar agendamento (criar ou editar)
    document.getElementById('agendamento-form-modal').addEventListener('submit', async (e) => {
        e.preventDefault();

        const uf = document.getElementById('modal-uf').value;
        const hub = document.getElementById('modal-hub').value;
        const recebedor = document.getElementById('modal-recebedor').value;
        const tipo = document.getElementById('modal-tipo').value;

        if (!window.agendamentoService) {
            alert('❌ Serviço não disponível. Aguarde um momento e tente novamente.');
            return;
        }

        try {
            if (editingAgendamentoId) {
                await editarAgendamento(editingAgendamentoId, uf, hub, recebedor, tipo);
            } else {
                await window.agendamentoService.create(uf, hub, recebedor, tipo);
            }

            document.getElementById('agendamento-modal').classList.add('hidden');
            carregarAgendamentos();
        } catch (error) {
            console.error('Erro ao salvar agendamento:', error);
            alert('❌ Erro ao salvar agendamento. Verifique sua conexão.');
        }
    });

    // Importar CSV
    document.getElementById('import-btn').addEventListener('click', async () => {
        if (!window.agendamentoService) {
            alert('❌ Serviço não disponível. Aguarde um momento e tente novamente.');
            return;
        }

        const fileInput = document.getElementById('import-csv');
        const file = fileInput.files[0];

        if (!file) {
            alert('📁 Selecione um arquivo CSV primeiro!');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const conteudo = event.target.result;
                const resultados = await window.agendamentoService.importarDoExcel(conteudo);
                alert(`✅ ${resultados.length} agendamentos importados com sucesso!`);
                carregarAgendamentos();
                fileInput.value = '';
            } catch (error) {
                console.error('Erro ao importar:', error);
                alert('❌ Erro ao importar. Verifique o formato do arquivo CSV.\n\nFormato esperado:\nUF,Hub,Recebedor,Tipo\nMG,BET,EMPRESA X,PADRÃO');
            }
        };
        reader.readAsText(file);
    });

    // Limpar todos os agendamentos
    document.getElementById('clear-all-btn').addEventListener('click', async () => {
        if (!window.agendamentoService) {
            alert('❌ Serviço não disponível. Aguarde um momento e tente novamente.');
            return;
        }

        if (confirm('⚠️ ATENÇÃO: Isso vai apagar TODOS os agendamentos. Tem certeza?')) {
            if (confirm('Última confirmação: TEM CERTEZA ABSOLUTA?')) {
                try {
                    window.agendamentoService.limparTodos();
                    carregarAgendamentos();
                    alert('✅ Todos os agendamentos foram removidos!');
                } catch (error) {
                    console.error('Erro ao limpar:', error);
                    alert('❌ Erro ao limpar agendamentos.');
                }
            }
        }
    });

    // Buscar agendamentos
    document.getElementById('search-agendamentos').addEventListener('input', () => {
        renderizarAgendamentos();
    });
}

function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
}

async function carregarAgendamentos() {
    if (!window.agendamentoService) {
        console.log('Aguardando service para carregar agendamentos...');
        setTimeout(() => carregarAgendamentos(), 500);
        return;
    }

    try {
        // Escutar mudanças em tempo real
        if (window.db) {
            // Remover listener anterior se existir
            if (window.agendamentosUnsubscribe) {
                window.agendamentosUnsubscribe();
            }

            window.agendamentosUnsubscribe = window.db.collection('agendamentos').onSnapshot(() => {
                renderizarAgendamentos();
                atualizarStats();
            });
        }

        renderizarAgendamentos();
        atualizarStats();
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        document.getElementById('agendamentos-list').innerHTML =
            '<div style="text-align: center; padding: 50px; color: #e74c3c;">❌ Erro ao carregar agendamentos</div>';
    }
}

function renderizarAgendamentos() {
    if (!window.agendamentoService) {
        document.getElementById('agendamentos-list').innerHTML =
            '<div class="loading">⏳ Carregando serviço...</div>';
        return;
    }

    const busca = document.getElementById('search-agendamentos').value.toLowerCase();
    let agendamentos = window.agendamentoService.listar();

    if (busca) {
        agendamentos = agendamentos.filter(a => a.displayString.toLowerCase().includes(busca));
    }

    const listaDiv = document.getElementById('agendamentos-list');

    if (agendamentos.length === 0) {
        listaDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #7f8c8d;">📋 Nenhum agendamento cadastrado</div>';
        return;
    }

    let html = '';
    agendamentos.forEach(a => {
        html += `
            <div class="agendamento-card">
                <div>
                    <strong>${a.displayString}</strong>
                    <div style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">
                        Tipo: ${a.tipo} | Criado: ${new Date(a.criadoEm).toLocaleString()}
                    </div>
                </div>
                <div class="agendamento-actions">
                    <button class="edit-btn" onclick="editarAgendamentoUI('${a.id}')">✏️ Editar</button>
                    <button class="delete-btn" onclick="deletarAgendamento('${a.id}')">🗑️ Excluir</button>
                </div>
            </div>
        `;
    });

    listaDiv.innerHTML = html;
}

function atualizarStats() {
    if (!window.agendamentoService) return;

    const agendamentos = window.agendamentoService.listar();
    const statsDiv = document.getElementById('stats');
    statsDiv.innerHTML = `📊 Total de agendamentos: <strong>${agendamentos.length}</strong>`;
}

// Função global para editar
window.editarAgendamentoUI = function (id) {
    if (!window.agendamentoService) {
        alert('❌ Serviço não disponível.');
        return;
    }

    const agendamentos = window.agendamentoService.listar();
    const agendamento = agendamentos.find(a => a.id === id);

    if (agendamento) {
        editingAgendamentoId = id;
        document.getElementById('modal-title').textContent = 'Editar Agendamento';
        document.getElementById('modal-uf').value = agendamento.uf;
        document.getElementById('modal-hub').value = agendamento.hub;
        document.getElementById('modal-recebedor').value = agendamento.recebedor;
        document.getElementById('modal-tipo').value = agendamento.tipo;
        document.getElementById('agendamento-modal').classList.remove('hidden');
    }
};

async function editarAgendamento(id, uf, hub, recebedor, tipo) {
    if (!window.agendamentoService) {
        throw new Error('Serviço não disponível');
    }

    // Para editar, primeiro deletamos o antigo e criamos um novo com os dados atualizados
    await window.agendamentoService.delete(id);
    await window.agendamentoService.create(uf, hub, recebedor, tipo);
}

// Função global para deletar
window.deletarAgendamento = async function (id) {
    if (!window.agendamentoService) {
        alert('❌ Serviço não disponível.');
        return;
    }

    if (confirm('🗑️ Remover este agendamento?')) {
        try {
            await window.agendamentoService.delete(id);
            carregarAgendamentos();
        } catch (error) {
            console.error('Erro ao deletar:', error);
            alert('❌ Erro ao deletar agendamento.');
        }
    }
};

// Monitorar conexão
window.addEventListener('online', () => {
    document.getElementById('offline-banner').classList.add('hidden');
    if (currentUser && serviceReady) {
        carregarAgendamentos();
    }
});

window.addEventListener('offline', () => {
    document.getElementById('offline-banner').classList.remove('hidden');
});
