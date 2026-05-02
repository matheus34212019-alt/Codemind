/**
 * SISTEMA DE GESTÃO DE ESTUDOS PRF - VERSÃO FULL STACK
 * Foco: Matheus Conceição | Meta: Aprovação PRF
 * Lógicas: Neural Pool, Ciclo Adaptativo, Cronômetro Multi-Thread e Gamificação.
 */

// ==========================================================================
// 1. ESTADO GLOBAL E CONFIGURAÇÕES
// ==========================================================================
let db = JSON.parse(localStorage.getItem('prf_v120')) || { 
    perfil: { nome: "Matheus", streak: 0, nivel: 1, xp: 0 },
    lista: [], 
    ciclo: [], 
    h: { 1:4, 2:4, 3:4, 4:4, 5:4, 6:4, 0:4 }, 
    metaFixa: {},
    historico: [],
    config: { bloqueioAtraso: true, somCronometro: false }
};

let vDate = new Date();
let timers = {};
let activeIntervals = {};
let exPendente = null;

const save = () => {
    localStorage.setItem('prf_v120', JSON.stringify(db));
    // Sincronização opcional com Firebase aqui
};

// ==========================================================================
// 2. MOTOR DE INTELIGÊNCIA (NEURAL POOL & CICLOS)
// ==========================================================================
function getNeuralPool(metaHoras, pool) {
    let dia = [];
    let hRestante = metaHoras;
    let limitador = 0;

    // Prioriza revisões e exercícios antes de novos conteúdos
    pool.sort((a, b) => (a.k === 'Rev' ? -1 : 1));

    while (hRestante > 0 && pool.length > 0 && limitador < 50) {
        let t = pool.shift();
        if (t.h <= hRestante) {
            dia.push(t);
            hRestante -= t.h;
        } else {
            // Se a matéria for maior que o tempo restante, mantém no pool para o próximo dia
            pool.unshift(t);
            break;
        }
        limitador++;
    }
    return dia;
}

// ==========================================================================
// 3. CORE: RENDERIZAÇÃO DO PAINEL DIÁRIO (MISSÃO DE HOJE)
// ==========================================================================
function renderDiario(date) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const curStr = date.toLocaleDateString();

    // Lógica de Bloqueio por Plantão Atrasado
    let temAtraso = false;
    let pD = new Date(hoje);
    pD.setDate(hoje.getDate() - hoje.getDay()); // Início da semana (Domingo)

    for (let i = 0; i < hoje.getDay(); i++) {
        let dP = new Date(pD);
        dP.setDate(pD.getDate() + i);
        let sP = dP.toLocaleDateString();
        if (db.metaFixa[sP] && db.metaFixa[sP].some(t => !t.c)) {
            temAtraso = true;
            break;
        }
    }

    const container = document.getElementById('lista-diaria');
    if (!container) return;

    // Tela de Bloqueio
    if (date > hoje && temAtraso && db.config.bloqueioAtraso) {
        container.innerHTML = `
            <div class="stat-card" style="text-align:center; border:3px solid #e74c3c; background:#fdf2f2;">
                <div style="font-size:3rem; margin-bottom:15px;">🚫</div>
                <h3 style="color:#c0392b; font-weight:900;">ACESSO NEGADO</h3>
                <p>Matheus, existem <b>missões pendentes</b> nesta semana. Conclua seus atrasos para liberar o cronograma futuro.</p>
                <button class="btn" onclick="navDay(-1)" style="background:#c0392b;">VOLTAR PARA O PLANTÃO ATUAL</button>
            </div>`;
        return;
    }

    // Geração do Planejamento do Dia
    if (!db.metaFixa[curStr]) {
        let poolCopy = JSON.parse(JSON.stringify(db.lista));
        db.metaFixa[curStr] = getNeuralPool(parseFloat(db.h[date.getDay()]), poolCopy);
        save();
    }

    const tasks = db.metaFixa[curStr];

    // RENDERIZAÇÃO DOS CARDS DE ESTUDO
    container.innerHTML = tasks.length > 0 ? tasks.map((t, i) => `
        <div class="task-card" style="border-left: 6px solid var(--color-${t.k === 'Ex' ? 'ex' : (t.k === 'Rev' ? 'rev' : 'a')})">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="tag tag-${t.k === 'Ex' ? 'ex' : (t.k === 'Rev' ? 'rev' : 'e')}">${t.l || 'TEORIA'}</span>
                    <span style="font-size:11px; font-weight:700; color:#999;">${t.h}h planejadas</span>
                </div>
                <div style="font-weight:900; font-size:1.2rem; color:var(--primary); line-height:1.2;">${t.m}</div>
                <div style="font-size:0.9rem; color:var(--text-sec); margin: 5px 0 15px 0; font-weight:600;">${t.a}</div>
                
                <div style="display:flex; align-items:center; gap:12px;">
                    <button class="btn-timer" id="btn-t-${i}" onclick="toggleTimer(${i})">
                        <i class="fas ${activeIntervals[i] ? 'fa-pause' : 'fa-play'}"></i>
                    </button>
                    <span id="time-${i}" class="timer-display">${t.tempoReal || '00:00:00'}</span>
                </div>
            </div>
            <div class="check-container">
                <input type="checkbox" class="task-check" ${t.c ? 'checked' : ''} onclick="cliqueTask('${curStr}', ${i})">
            </div>
        </div>`).join('') : '<div class="stat-card">Nenhuma matéria para este dia. Aproveite para descansar ou revisar!</div>';

    // BOTÃO EXTRA (EXIGÊNCIA: VISUAL AZUL TRACEJADO)
    container.innerHTML += `
        <button class="btn-extra-diario" onclick="abrirModalExtra()">
            <i class="fas fa-plus-circle"></i> ESTUDOU ALGO FORA DO PLANEJADO?
        </button>`;

    // Atualização do Cabeçalho e Título
    const ehHoje = curStr === hoje.toLocaleDateString();
    document.getElementById('view-title').innerText = ehHoje ? "Missão de Hoje 🚓" : "Missão de Amanhã 📅";
    updateDashboard();
}

// ==========================================================================
// 4. CRONOGRAMA SEMANAL DE PLANTÃO (TABELA)
// ==========================================================================
function renderSemanal() {
    const grid = document.getElementById('grid-semanal');
    if (!grid) return;

    const diasNomes = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
    let h = new Date(); h.setHours(0,0,0,0);
    let pD = new Date(h); pD.setDate(h.getDate() - h.getDay());

    let html = `
        <div class="table-container">
            <table class="semanal-table">
                <thead>
                    <tr>
                        <th>DIA / DATA</th>
                        <th>PLANTÃO PREVISTO</th>
                        <th>STATUS</th>
                    </tr>
                </thead>
                <tbody>`;

    for (let i = 0; i < 7; i++) {
        let d = new Date(pD);
        d.setDate(pD.getDate() + i);
        let s = d.toLocaleDateString();
        let tasks = db.metaFixa[s] || [];
        let isAtrasado = d < h && tasks.some(t => !t.c);
        let isHoje = d.getTime() === h.getTime();

        html += `
            <tr class="${isHoje ? 'row-hoje' : ''}">
                <td style="font-weight:900;">
                    <span style="color:${isAtrasado ? '#e74c3c' : 'var(--primary)'}">${diasNomes[i]}</span><br>
                    <small style="color:#999;">${s.split('/')[0]}/${s.split('/')[1]}</small>
                </td>
                <td>
                    <div style="font-size:12px; font-weight:600;">
                        ${tasks.length > 0 ? tasks.map(t => t.m).join(' • ') : '<span style="color:#ccc;">Sem carga horária</span>'}
                    </div>
                </td>
                <td>
                    <span class="status-badge" style="background:${isAtrasado ? '#e74c3c' : (tasks.length > 0 && tasks.every(t => t.c) ? '#2ecc71' : '#3498db')}">
                        ${isAtrasado ? 'PENDENTE' : (tasks.length > 0 && tasks.every(t => t.c) ? 'CONCLUÍDO' : 'EM ANDAMENTO')}
                    </span>
                </td>
            </tr>`;
    }

    html += `</tbody></table></div>`;
    grid.innerHTML = html;
}

// ==========================================================================
// 5. CRONÔMETRO MULTI-THREAD
// ==========================================================================
function toggleTimer(id) {
    const curStr = vDate.toLocaleDateString();
    const task = db.metaFixa[curStr][id];

    if (activeIntervals[id]) {
        clearInterval(activeIntervals[id]);
        delete activeIntervals[id];
        renderDiario(vDate);
    } else {
        let [hh, mm, ss] = (task.tempoReal || "00:00:00").split(':').map(Number);
        let totalSegundos = hh * 3600 + mm * 60 + ss;

        activeIntervals[id] = setInterval(() => {
            totalSegundos++;
            let h = Math.floor(totalSegundos / 3600).toString().padStart(2, '0');
            let m = Math.floor((totalSegundos % 3600) / 60).toString().padStart(2, '0');
            let s = (totalSegundos % 60).toString().padStart(2, '0');
            
            task.tempoReal = `${h}:${m}:${s}`;
            const display = document.getElementById(`time-${id}`);
            if (display) display.innerText = task.tempoReal;
            
            if (totalSegundos % 60 === 0) save(); // Salva a cada minuto
        }, 1000);
        
        document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-pause"></i>';
    }
}

// ==========================================================================
// 6. DASHBOARD, GRÁFICOS E GAMIFICAÇÃO
// ==========================================================================
function updateDashboard() {
    let tGeral = 0, cGeral = 0;
    Object.values(db.metaFixa).forEach(dia => {
        dia.forEach(t => { tGeral++; if(t.c) cGeral++; });
    });

    const perc = tGeral > 0 ? Math.round((cGeral / tGeral) * 100) : 0;
    
    // Atualiza elementos da UI
    const progDia = document.getElementById('prog-dia');
    const barDia = document.getElementById('bar-dia');
    if (progDia) progDia.innerText = perc + "%";
    if (barDia) barDia.style.width = perc + "%";

    // Lógica de Nível/XP
    db.perfil.xp = cGeral * 50; 
    db.perfil.nivel = Math.floor(db.perfil.xp / 1000) + 1;
}

// ==========================================================================
// 7. INICIALIZAÇÃO E NAVEGAÇÃO
// ==========================================================================
window.onload = () => {
    // Verifica se os IDs principais existem antes de rodar
    if (document.getElementById('lista-diaria')) {
        renderDiario(vDate);
    }
    configurarAbas();
};

function configurarAbas() {
    document.querySelectorAll('.nav-el').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
            // Lógica interna de showTab integrada
            if (target === 'semanal') renderSemanal();
        });
    });
}

function navDay(dir) {
    vDate.setDate(vDate.getDate() + dir);
    renderDiario(vDate);
}

function abrirModalExtra() {
    const modal = document.getElementById('modal-extra');
    if(modal) modal.style.display = 'flex';
}

function fecharModais() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

function cliqueTask(data, idx) {
    const task = db.metaFixa[data][idx];
    task.c = !task.c;
    save();
    renderDiario(vDate);
}
