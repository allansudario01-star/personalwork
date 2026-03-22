let currentUser = null;
let editingAgendamentoId = null;

document.addEventListener('DOMContentLoaded', function () {
    console.log('🔐 Iniciando painel admin...');

    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {

            currentUser = user;
            console.log('✅ Usuário logado:', user.email);
            showAdminPanel();
            carregarAgendamentos();
        } else {

            showLoginScreen();
        }
    });

    configurarEventos();
});

function configurarEventos() {

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
            } else {
                errorDiv.textContent = '❌ Erro ao fazer login. Tente novamente.';
            }
        }
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await firebase.auth().signOut();
        showLoginScreen();
    });

    document.getElementById('create-agendamento-btn').addEventListener('click', () => {
        editingAgendamentoId = null;
        document.getElementById('modal-title').textContent = 'Novo Agendamento';
        document.getElementById('modal-uf').value = '';
        document.getElementById('modal-hub').value = '';
        document.getElementById('modal-recebedor').value = '';
        document.getElementById('modal-tipo').value = 'PADRÃO';
        document.getElementById('agendamento-modal').classList.remove('hidden');
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        document.getElementById('agendamento-modal').classList.add('hidden');
    });

    document.getElementById('agendamento-form-modal').addEventListener('submit', async (e) => {
        e.preventDefault();

        const uf = document.getElementById('modal-uf').value;
        const hub = document.getElementById('modal-hub').value;
        const recebedor = document.getElementById('modal-recebedor').value;
        const tipo = document.getElementById('modal-tipo').value;

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
            alert('Erro ao salvar agendamento. Verifique sua conexão.');
        }
    });

    document.getElementById('import-btn').addEventListener('click', async () => {
        const fileInput = document.getElementById('import-csv');
        const file = fileInput.files[0];

        if (!file) {
            alert('Selecione um arquivo CSV primeiro!');
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
                alert('❌ Erro ao importar. Verifique o formato do arquivo CSV.');
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('clear-all-btn').addEventListener('click', async () => {
        if (confirm('⚠️ ATENÇÃO: Isso vai apagar TODOS os agendamentos. Tem certeza?')) {
            if (confirm('Última confirmação: TEM CERTEZA ABSOLUTA?')) {
                window.agendamentoService.limparTodos();
                carregarAgendamentos();
                alert('✅ Todos os agendamentos foram removidos!');
            }
        }
    });

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
    try {

        if (!window.agendamentoService) {
            console.log('Aguardando agendamentoService...');
            setTimeout(carregarAgendamentos, 500);
            return;
        }

        if (window.db) {
            window.db.collection('agendamentos').onSnapshot(() => {
                renderizarAgendamentos();
                atualizarStats();
            });
        }

        renderizarAgendamentos();
        atualizarStats();
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
    }
}

function renderizarAgendamentos() {
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
                        Criado em: ${new Date(a.criadoEm).toLocaleString()}
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
    const agendamentos = window.agendamentoService.listar();
    const statsDiv = document.getElementById('stats');
    statsDiv.innerHTML = `📊 Total de agendamentos: <strong>${agendamentos.length}</strong>`;
}

window.editarAgendamentoUI = function (id) {
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

    await window.agendamentoService.delete(id);
    await window.agendamentoService.create(uf, hub, recebedor, tipo);
}

window.deletarAgendamento = async function (id) {
    if (confirm('🗑️ Remover este agendamento?')) {
        await window.agendamentoService.delete(id);
        carregarAgendamentos();
    }
};

window.addEventListener('online', () => {
    document.getElementById('offline-banner').classList.add('hidden');
    carregarAgendamentos();
});

window.addEventListener('offline', () => {
    document.getElementById('offline-banner').classList.remove('hidden');
});
