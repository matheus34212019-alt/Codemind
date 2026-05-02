// ==========================================================================
// BANCO DE DADOS, CICLOS E VARIÁVEIS GLOBAIS
// ==========================================================================
let db = JSON.parse(localStorage.getItem('prf_v120')) || { 
    lista: [], 
    ciclo: [], 
    h: { 1:4, 2:4, 3:4, 4:4, 5:4, 6:4, 0:4 }, 
    metaFixa: {} 
};

let vDate = new Date();
let timers = {};
let exPendente = null;

const save = () => localStorage.setItem('prf_v120', JSON.stringify(db));

// ==========================================================================
// ACESSO E CONTROLE DE TELAS
// ==========================================================================
function checkAccess() {
    const input = document.getElementById('pass-input');
    if (input && input.value === "123") {
        document.getElementById('login-screen').style.display = 'none';
        init();
    }
}

function init() {
    renderDiario(vDate);
    updateDashboard();
}

// ==========================================================================
// SISTEMA DE NAVEGAÇÃO (PAGINAÇÃO)
// ==========================================================================
function showTab(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-el').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');

    // Gatilhos de renderização por aba
    if (id === 'semanal') renderSemanal();
    if (id === 'ciclo') renderCiclo();
    if (id === 'config-h') renderHInputs();
    if (id === 'sinalizar') renderTree();
    if (id === 'fluxo') renderFluxo();
    updateDashboard();
}

// ==========================================================================
// INTELIGÊNCIA DO CICLO (NEURAL POOL)
// ==========================================================================
function getNeuralPool(metaHoras, pool) {
    let dia = [];
    let hRestante = metaHoras;
    let limit = 0;
    while (hRestante > 0 && pool.length > 0 && limit < 20) {
        let t = pool.shift();
        if (t.h <= hRestante) {
            dia.push(t);
            hRestante -= t.h;
        } else {
            pool.unshift(t);
            break;
        }
        limit++;
    }
    return dia;
}

// ==========================================================================
// DASHBOARD E INDICADORES
// ==========================================================================
function updateDashboard() {
    let hoje = new Date();
    let tT = 0, cT = 0, hS = 0, tQ = 0, aQ = 0;
    
    // Cálculo da semana (Domingo a Sábado)
    let pd = new Date(hoje);
    pd.setDate(hoje.getDate() - hoje.getDay());

    for (let i = 0; i < 7; i++) {
        let d = new Date(pd);
        d.setDate(pd.getDate() + i);
        let tasks = db.metaFixa[d.toLocaleDateString()] || [];
        tasks.forEach(t => {
            tT++;
            if (t.c) cT++;
            hS += t.h;
            if (t.perf) {
                tQ += t.perf.t;
                aQ += t.perf.a;
            }
        });
    }

    document.getElementById('prog-dia').innerText = tT > 0 ? Math.round((cT / tT) * 100) + "%" : "0%";
    document.getElementById('bar-dia').style.width = tT > 0 ? (cT / tT) * 100 + "%" : "0%";
    document.getElementById('horas-hoje').innerText = hS.toFixed(1) + "h";
    document.getElementById('precisao-dia').innerText = tQ > 0 ? Math.round((aQ / tQ) * 100) + "%" : "0%";
}

// ==========================================================================
// PAINEL DIÁRIO (MISSÃO DE HOJE) - ONDE ESTAVA O ERRO
// ==========================================================================
function renderDiario(date) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const curStr = date.toLocaleDateString();

    // Verificação de Atrasos para Bloqueio
    let temAtraso = false;
    let pD = new Date(hoje);
    pD.setDate(hoje.getDate() - hoje.getDay());
    for (let i = 0; i < hoje.getDay(); i++) {
        let dP = new Date(pD);
        dP.setDate(pD.getDate() + i);
        if (db.metaFixa[dP.toLocaleDateString()]?.some(t => !t.c)) {
            temAtraso = true;
            break;
        }
    }

    // Lógica de bloqueio de tela
    if (date > hoje && temAtraso) {
        document.getElementById('lista-diaria').innerHTML = `
            <div class="stat-card" style="text-align:center; border:2px solid #ff4444; background:#fff5f5;">
                <h3 style="color:#cc0000;">ACESSO BLOQUEADO 🚫</h3>
                <p>Matheus, conclua os plantões atrasados antes de avançar para o próximo dia.</p>
                <button class="btn" onclick="navDay(-1)">VOLTAR PARA HOJE</button>
            </div>`;
        return;
    }

    // Inicialização da meta do dia se não existir
    if (!db.metaFixa[curStr]) {
        let poolCopy = JSON.parse(JSON.stringify(db.lista));
        db.metaFixa[curStr] = getNeuralPool(parseFloat(db.h[date.getDay()]), poolCopy);
    }

    const tasks = db.metaFixa[curStr];
    
    // Renderização dos cards de matérias
    document.getElementById('lista-diaria').innerHTML = tasks.map((t, i) => `
        <div class="task-card" style="border-left: 5px solid var(--color-${t.k === 'Ex' ? 'ex' : (t.k === 'Rev' ? 'rev' : 'a')})">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span class="tag tag-${t.k === 'Ex' ? 'ex' : (t.k === 'Rev' ? 'rev' : 'e')}">${t.l}</span>
                    <small style="font-weight:700;">${curStr}</small>
                </div>
                <div style="font-weight:800; font-size:1.1rem; color:var(--primary);">${t.m}</div>
                <div style="font-size:0.85rem; color:var(--text-sec); margin-bottom:10px;">${t.a}</div>
                
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn btn-sm btn-outline" id="btn-t-${i}" onclick="toggleTimer(${i})">
                        <i class="fas fa-play"></i>
                    </button>
                    <span id="time-${i}" style="font-family:monospace; font-weight:800; color:var(--accent);">00:00</span>
                </div>
            </div>
            <input type="checkbox" class="task-check" ${t.c ? 'checked' : ''} onclick="cliqueTask('${curStr}', ${i})">
        </div>`).join('');

    // BOTÃO EXTRA (EXIGÊNCIA: VISUAL AZUL TRACEJADO)
    document.getElementById('lista-diaria').innerHTML += `
        <button class="btn-extra-diario" onclick="abrirModalExtra()">
            <i class="fas fa-plus-circle"></i> ESTUDOU ALGO FORA DO PLANEJADO?
        </button>`;

    // Atualização do título e Status de Finalização
    const ehHoje = curStr === hoje.toLocaleDateString();
    document.getElementById('view-title').innerText = ehHoje ? "Missão de Hoje 🚓" : "Missão de Amanhã 📅";

    if (tasks.length > 0 && tasks.every(x => x.c) && ehHoje) {
        const checkFinal = document.createElement('div');
        checkFinal.className = "stat-card";
        checkFinal.style = "text-align:center; background:#e3f2fd; border:2px dashed #2196f3; margin-top:20px;";
        checkFinal.innerHTML = `<h3>🚀 Plantão Concluído!</h3><p>Todas as metas batidas.</p>`;
        document.getElementById('lista-diaria').appendChild(checkFinal);
    }
}

// ==========================================================================
// CRONÔMETRO INDIVIDUAL
// ==========================================================================
function toggleTimer(id) {
    if (timers[id]) {
        clearInterval(timers[id].interval);
        delete timers[id];
        document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-play"></i>';
    } else {
        let display = document.getElementById(`time-${id}`);
        let p = display.innerText.split(':');
        let sec = parseInt(p[0]) * 60 + parseInt(p[1]);
        timers[id] = {
            interval: setInterval(() => {
                sec++;
                let m = Math.floor(sec / 60).toString().padStart(2, '0');
                let s = (sec % 60).toString().padStart(2, '0');
                display.innerText = `${m}:${s}`;
            }, 1000)
        };
        document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-pause"></i>';
    }
}

// ==========================================================================
// CRONOGRAMA SEMANAL (PLANTÃO)
// ==========================================================================
function renderSemanal() {
    const diasSemana = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
    let hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let primeiroDia = new Date(hoje);
    primeiroDia.setDate(hoje.getDate() - hoje.getDay());

    let html = `
        <table class="semanal-table">
            <thead>
                <tr>
                    <th>DIA</th>
                    <th>PLANTÃO PREVISTO</th>
                    <th>STATUS</th>
                </tr>
            </thead>
            <tbody>`;

    for (let i = 0; i < 7; i++) {
        let d = new Date(primeiroDia);
        d.setDate(primeiroDia.getDate() + i);
        let s = d.toLocaleDateString();
        let tasks = db.metaFixa[s] || [];
        let atrasado = d < hoje && tasks.some(t => !t.c);
        
        html += `
            <tr>
                <td style="font-weight:800; color:${atrasado ? '#ff4444' : 'var(--primary)'}">${diasSemana[i]}</td>
                <td><small>${tasks.length > 0 ? tasks.map(t => t.m).slice(0, 2).join(', ') : 'Folga'}</small></td>
                <td><span class="status-badge" style="background:${atrasado ? '#ff4444' : '#4CAF50'}">
                    ${atrasado ? 'PENDENTE' : (tasks.length > 0 && tasks.every(t => t.c) ? 'OK' : 'ATIVO')}
                </span></td>
            </tr>`;
    }

    html += `</tbody></table>`;
    document.getElementById('grid-semanal').innerHTML = html;
}

// ==========================================================================
// FUNÇÕES DE APOIO E MODAIS
// ==========================================================================
function navDay(dir) {
    vDate.setDate(vDate.getDate() + dir);
    renderDiario(vDate);
}

function cliqueTask(data, idx) {
    const t = db.metaFixa[data][idx];
    if (!t.c && t.k === 'Ex') {
        exPendente = { dK: data, idx };
        document.getElementById('label-ex-assunto').innerText = `${t.m} - ${t.a}`;
        document.getElementById('modal-exercicio').style.display = 'flex';
    } else {
        t.c = !t.c;
        save();
        updateDashboard();
        renderDiario(vDate);
    }
}

function abrirModalExtra() {
    const modal = document.getElementById('modal-extra');
    if(modal) modal.style.display = 'flex';
}

function fecharModais() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

// Função de salvar exercícios Cebraspe (A-E ou C/E)
function confirmarExercicio() {
    if (exPendente) {
        const t = db.metaFixa[exPendente.dK][exPendente.idx];
        t.c = true;
        t.perf = {
            t: parseInt(document.getElementById('ex-total').value) || 0,
            a: parseInt(document.getElementById('ex-acertos').value) || 0
        };
        save();
        fecharModais();
        updateDashboard();
        renderDiario(vDate);
    }
}
