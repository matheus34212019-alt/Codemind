// ==========================================
// CONFIGURAÇÕES GLOBAIS E ESTADO DO SISTEMA
// ==========================================
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let cronogramaSemanal = JSON.parse(localStorage.getItem('cronogramaSemanal')) || {};
let timers = {};
let intervals = {};
let currentTab = 'diario';

// ==========================================
// INICIALIZAÇÃO
// ==========================================
window.onload = () => {
    carregarDados();
    renderDiario();
    renderSemanal();
    configurarAbas();
};

function carregarDados() {
    // Aqui você pode integrar com seu Firebase ou LocalStorage real
    console.log("Sistema Carregado - Preparado para Missão PRF");
}

// ==========================================
// 1. PAINEL DIÁRIO (MISSÃO DE HOJE)
// ==========================================
function renderDiario(dataStr) {
    const hoje = new Date();
    const curStr = dataStr || hoje.toLocaleDateString();
    const container = document.getElementById('lista-diaria');
    
    if (!container) return;

    // Renderização das Matérias e Assuntos
    container.innerHTML = tasks.length > 0 ? tasks.map((t, i) => `
        <div class="task-card">
            <div style="flex:1;">
                <div style="font-weight:800; color:var(--primary); margin-bottom:5px; text-transform:uppercase;">
                    ${t.materia || 'Matéria Não Definida'}
                </div>
                <div style="font-size:13px; color:#555; font-weight:600;">
                    ${t.assunto || 'Assunto pendente'}
                </div>
                <div style="display:flex; align-items:center; gap:12px; margin-top:10px;">
                    <button class="btn btn-sm btn-outline" id="btn-t-${i}" onclick="toggleTimer(${i})">
                        <i class="fas fa-play"></i>
                    </button>
                    <span id="time-${i}" style="font-family:'Courier New', monospace; font-weight:800; color:var(--accent); font-size:16px;">
                        ${t.tempo || '00:00:00'}
                    </span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
                <input type="checkbox" class="task-check" ${t.concluido ? 'checked' : ''} 
                    onclick="cliqueTask('${curStr}', ${i})">
                <span style="font-size:10px; color:#999;">${t.meta || '60min'}</span>
            </div>
        </div>`).join('') : '<p style="text-align:center; color:#999; padding:20px;">Nenhuma missão para hoje.</p>';

    // ADIÇÃO DO BOTÃO EXTRA (EXIGÊNCIA: VISUAL AZUL TRACEJADO)
    container.innerHTML += `
        <button class="btn-extra-diario" onclick="abrirModalExtra()">
            <i class="fas fa-plus-circle"></i> ESTUDOU ALGO FORA DO PLANEJADO?
        </button>
    `;

    // Atualização do Título Dinâmico
    const ehHoje = curStr === hoje.toLocaleDateString();
    const viewTitle = document.getElementById('view-title');
    if (viewTitle) {
        viewTitle.innerText = ehHoje ? "Missão de Hoje 🚓" : "Missão de Amanhã 📅";
    }
}

// ==========================================
// 2. CRONOGRAMA SEMANAL (TABELA DE PLANTÃO)
// ==========================================
function renderSemanal() {
    const container = document.getElementById('cronograma-semanal');
    if (!container) return;

    const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
    
    let html = `
        <div class="semanal-wrapper">
            <table class="semanal-table">
                <thead>
                    <tr>
                        <th>DIA DA SEMANA</th>
                        <th>CONTEÚDO PROGRAMADO</th>
                        <th>STATUS</th>
                    </tr>
                </thead>
                <tbody>
    `;

    dias.forEach(dia => {
        const conteudo = cronogramaSemanal[dia] || "Revisão Geral / Exercícios";
        html += `
            <tr>
                <td style="font-weight:800; color:var(--primary);">${dia.toUpperCase()}</td>
                <td>${conteudo}</td>
                <td><span class="status-badge">ATIVO</span></td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

// ==========================================
// 3. SISTEMA DE CRONÔMETRO
// ==========================================
function toggleTimer(id) {
    const btn = document.getElementById(`btn-t-${id}`);
    const icon = btn.querySelector('i');
    
    if (intervals[id]) {
        clearInterval(intervals[id]);
        delete intervals[id];
        icon.className = 'fas fa-play';
        btn.classList.remove('active-timer');
    } else {
        if (!timers[id]) timers[id] = parseTimeToSeconds(tasks[id].tempo || "00:00:00");
        
        intervals[id] = setInterval(() => {
            timers[id]++;
            const formatado = formatSeconds(timers[id]);
            document.getElementById(`time-${id}`).innerText = formatado;
            tasks[id].tempo = formatado;
        }, 1000);
        
        icon.className = 'fas fa-pause';
        btn.classList.add('active-timer');
    }
}

function parseTimeToSeconds(tempo) {
    const p = tempo.split(':');
    return (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]);
}

function formatSeconds(s) {
    return new Date(s * 1000).toISOString().substr(11, 8);
}

// ==========================================
// 4. GESTÃO DE MODAIS E INTERAÇÃO
// ==========================================
function abrirModalExtra() {
    const modal = document.getElementById('modal-extra');
    if (modal) {
        modal.style.display = 'flex';
    } else {
        console.log("Modal não encontrado no HTML");
    }
}

function cliqueTask(data, index) {
    tasks[index].concluido = !tasks[index].concluido;
    salvarProgresso();
    renderDiario(data);
}

function salvarProgresso() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
    // Se usar Firebase: db.collection('usuarios').doc(uid).update({ tasks });
}

// ==========================================
// 5. NAVEGAÇÃO ENTRE ABAS
// ==========================================
function configurarAbas() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.target;
            mostrarSecao(target);
        });
    });
}

function mostrarSecao(secao) {
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    const target = document.getElementById(`section-${secao}`);
    if (target) target.style.display = 'block';
}

// ==========================================
// 6. FUNÇÕES ADICIONAIS (ESTRUTURA COMPLETA)
// ==========================================
// Aqui entram as lógicas de ciclo, gráficos e impEdital se necessário
function calcularDesempenho() {
    const total = tasks.length;
    const concluidas = tasks.filter(t => t.concluido).length;
    return (concluidas / total) * 100;
}
