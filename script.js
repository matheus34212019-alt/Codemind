/**
 * SISTEMA DE GESTÃO DE ESTUDOS PRF - MATHEUS CONCEIÇÃO
 * VERSÃO 120 - FOCO TOTAL NA APROVAÇÃO
 */

// ==========================================
// 1. BANCO DE DADOS E VARIÁVEIS GLOBAIS
// ==========================================
let db = JSON.parse(localStorage.getItem('prf_v120')) || { 
    lista: [], 
    ciclo: [], 
    h: {1:4, 2:4, 3:4, 4:4, 5:4, 6:4, 0:4}, 
    metaFixa: {} 
};
let vDate = new Date();
let timers = {};
let exPendente = null;

const save = () => localStorage.setItem('prf_v120', JSON.stringify(db));

// ==========================================
// 2. ACESSO E INICIALIZAÇÃO
// ==========================================
function checkAccess() { 
    if(document.getElementById('pass-input').value === "123") { 
        document.getElementById('login-screen').style.display='none'; 
        init(); 
    } 
}

function init() { 
    renderDiario(vDate); 
    updateDashboard(); 
}

// ==========================================
// 3. NAVEGAÇÃO DE ABAS
// ==========================================
function showTab(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active'); 
    if(el) el.classList.add('active');
    
    if(id === 'semanal') renderSemanal();
    if(id === 'ciclo') renderCiclo();
    if(id === 'config-h') renderHInputs();
    if(id === 'sinalizar') renderTree();
    if(id === 'fluxo') renderFluxo();
    updateDashboard();
}

function toggleSub() { document.getElementById('sub-plano').classList.toggle('show'); }

// ==========================================
// 4. DASHBOARD E INDICADORES
// ==========================================
function updateDashboard() {
    let hoje = new Date(); 
    let pD = new Date(hoje); pD.setDate(hoje.getDate() - hoje.getDay());
    let tT=0, cT=0, hS=0, tQ=0, aQ=0;

    for (let i=0; i<7; i++) {
        let d = new Date(pD); d.setDate(pD.getDate() + i);
        let tasks = db.metaFixa[d.toLocaleDateString()] || [];
        tasks.forEach(t => {
            tT++; 
            if(t.c) { 
                cT++; hS+=t.h; 
                if(t.perf){ tQ+=t.perf.t; aQ+=t.perf.a; }
            }
        });
    }

    document.getElementById('prog-dia').innerText = tT>0 ? Math.round((cT/tT)*100)+"%" : "0%";
    document.getElementById('bar-dia').style.width = tT>0 ? (cT/tT)*100+"%" : "0%";
    document.getElementById('horas-hoje').innerText = hS.toFixed(1)+"h";
    document.getElementById('precisao-dia').innerText = tQ>0 ? Math.round((aQ/tQ)*100)+"%" : "0%";
    
    atualizarProgressoCiclo();
    checkStreak();
}

// ==========================================
// 5. PAINEL DIÁRIO (LÓGICA DE BLOQUEIO E CARDS)
// ==========================================
function renderDiario(date) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const curStr = date.toLocaleDateString();
    
    // Lógica de Bloqueio por plantão atrasado
    let temAtr = false;
    let pD = new Date(hoje); pD.setDate(hoje.getDate() - hoje.getDay());
    for(let i=0; i < hoje.getDay(); i++) {
        let dP = new Date(pD); dP.setDate(pD.getDate() + i);
        if(db.metaFixa[dP.toLocaleDateString()]?.some(t => !t.c)) { temAtr = true; break; }
    }

    const btnReplan = document.querySelector('.replan-btn');
    if (btnReplan) btnReplan.style.display = temAtr ? "inline-flex" : "none";

    if(date > hoje && temAtr) {
        document.getElementById('lista-diaria').innerHTML = `
            <div class="stat-card" style="text-align:center; border:2px solid red;">
                <h3 style="color:red;">ACESSO BLOQUEADO 🚫</h3>
                <p>Matheus, conclua os plantões atrasados desta semana antes de avançar.</p>
            </div>`;
        return;
    }

    if(!db.metaFixa[curStr]) {
        db.metaFixa[curStr] = getNeuralPool(parseFloat(db.h[date.getDay()]), JSON.parse(JSON.stringify(db.lista)));
    }

    const tasks = db.metaFixa[curStr];
    document.getElementById('meta-status').innerText = `${tasks.reduce((a,b)=>a+b.h,0).toFixed(1)}h / ${db.h[date.getDay()]}h meta`;
    
    // Renderização dos cards com correção de layout
    document.getElementById('lista-diaria').innerHTML = tasks.map((t, i) => `
        <div class="task-card" style="border-left-color:var(--color-${t.k==='Ex'?'ex':(t.k==='Rev'?'rev':'e')})">
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span class="tag tag-${t.k==='Ex'?'ex':(t.k==='Rev'?'rev':'e')}">${t.l}</span>
                    <small style="font-weight:700;">${curStr}</small>
                </div>
                <div style="font-weight:800; font-size:1.1rem;">${t.m}</div>
                <div style="font-size:0.85rem; color:var(--text-sec); margin-bottom:10px;">${t.a}</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <button class="btn btn-sm btn-outline" id="btn-t-${i}" onclick="toggleTimer(${i})">
                        <i class="fas fa-play"></i>
                    </button>
                    <span id="time-${i}" style="font-family:monospace; font-weight:800; color:var(--accent);">00:00</span>
                </div>
            </div>
            <input type="checkbox" ${t.c ? 'checked' : ''} onclick="cliqueTask('${curStr}', ${i})">
        </div>`).join('');

    // Botão extra azul tracejado
    document.getElementById('lista-diaria').innerHTML += `
        <button class="btn-extra-diario" onclick="abrirModalExtra()">
            <i class="fas fa-plus-circle"></i> ESTUDOU ALGO FORA DO PLANEJADO?
        </button>
    `;

    const ehHoje = curStr === hoje.toLocaleDateString();
    document.getElementById('view-title').innerText = ehHoje ? "Missão de Hoje 🚓" : "Missão de Amanhã 📅";

    const concluidas = tasks.length > 0 && tasks.every(x => x.c);
    if(concluidas && ehHoje) {
        const divFim = document.createElement('div');
        divFim.className = "stat-card";
        divFim.style = "text-align:center; background:#eff6ff; border:2px dashed var(--accent); margin-top:20px;";
        divFim.innerHTML = `
            <h3>🚀 Missão Cumprida!</h3>
            <p>Matheus, parabéns pelo plantão finalizado.</p>
            <button class="btn" onclick="navDay(1)">ADIANTAR MATÉRIAS DE AMANHÃ</button>
        `;
        document.getElementById('lista-diaria').appendChild(divFim);
    }
}

// ==========================================
// 6. CRONÔMETRO
// ==========================================
function toggleTimer(id) {
    if (timers[id]) { 
        clearInterval(timers[id].interval); delete timers[id]; 
        document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-play"></i>'; 
    } else {
        let display = document.getElementById(`time-${id}`);
        let parts = display.innerText.split(':');
        let sec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        timers[id] = { 
            interval: setInterval(() => { 
                sec++; 
                let m = Math.floor(sec/60).toString().padStart(2,'0'); 
                let s = (sec%60).toString().padStart(2,'0'); 
                display.innerText = `${m}:${s}`; 
            }, 1000) 
        };
        document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-pause"></i>';
    }
}

// ==========================================
// 7. MODAIS E EXERCÍCIOS
// ==========================================
function fecharModais() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }

function abrirModalExtra() {
    const selectMat = document.getElementById('extra-mat');
    const materiasUnicas = [...new Set(db.lista.map(x => x.m))];
    selectMat.innerHTML = '<option value="">Selecione a Matéria</option>' + materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
    document.getElementById('modal-extra').style.display = 'flex';
}

function atualizarAssuntosExtra() {
    const mat = document.getElementById('extra-mat').value;
    const selectAss = document.getElementById('extra-ass');
    if (!mat) { selectAss.innerHTML = '<option value="">Selecione o Assunto</option>'; return; }
    const assuntos = [...new Set(db.lista.filter(x => x.m === mat).map(x => x.a))];
    selectAss.innerHTML = assuntos.map(a => `<option value="${a}">${a}</option>`).join('');
}

function cliqueTask(dK, idx) {
    const t = db.metaFixa[dK][idx];
    if(!t.c && t.k === 'Ex') {
        exPendente = { dK, idx };
        document.getElementById('label-ex-assunto').innerText = `${t.m} - ${t.a}`;
        document.getElementById('modal-exercicio').style.display = 'flex';
    } else { 
        t.c = !t.c; save(); updateDashboard(); renderDiario(vDate); 
    }
}

function calcCebraspe() {
    const t = parseInt(document.getElementById('ex-total').value) || 0;
    const a = parseInt(document.getElementById('ex-acertos').value) || 0;
    const liq = a - (t - a);
    const perc = t > 0 ? Math.round((liq / t) * 100) : 0;
    document.getElementById('cebraspe-feedback').innerHTML = `Líquido: ${liq} | Aproveitamento: ${perc}%`;
}

function confirmarExercicio() {
    const t = db.metaFixa[exPendente.dK][exPendente.idx];
    t.c = true; 
    t.perf = { t: parseInt(document.getElementById('ex-total').value), a: parseInt(document.getElementById('ex-acertos').value) };
    save(); fecharModais(); updateDashboard(); renderDiario(vDate);
}

// ==========================================
// 8. REPLANEJAMENTO E CRONOGRAMA SEMANAL
// ==========================================
function replanejarAgora() {
    let h = new Date(); h.setHours(0,0,0,0);
    let pD = new Date(h); pD.setDate(h.getDate() - h.getDay());
    let atr = [];
    for(let i=0; i <= h.getDay(); i++) {
        let d = new Date(pD); d.setDate(pD.getDate() + i);
        let k = d.toLocaleDateString();
        if(db.metaFixa[k]) { 
            db.metaFixa[k].filter(t => !t.c).forEach(t => atr.push(t)); 
            db.metaFixa[k] = db.metaFixa[k].filter(t => t.c); 
        }
    }
    save(); alert("Plantão Replanejado!"); init();
}

function renderSemanal() {
    const dN = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
    let h = new Date(); h.setHours(0,0,0,0);
    let pD = new Date(h); pD.setDate(h.getDate() - h.getDay());
    document.getElementById('grid-semanal').innerHTML = [0,1,2,3,4,5,6].map(off => {
        let d = new Date(pD); d.setDate(pD.getDate() + off);
        let k = d.toLocaleDateString();
        let tasks = db.metaFixa[k] || [];
        let isAtr = d < h && tasks.some(t => !t.c);
        return `
            <div class="day-column">
                <div class="day-head ${isAtr ? 'atrasado' : ''}">${dN[d.getDay()]}<br>${k.slice(0,5)}</div>
                ${tasks.map(x => `<div class="sim-task tag-${x.k==='Ex'?'ex':(x.k==='Rev'?'rev':'e')} ${!x.c && d < h ? 'atrasado' : ''}">${x.m}</div>`).join('')}
            </div>`;
    }).join('');
}

// ==========================================
// 9. MOTOR NEURAL E CONFIGURAÇÕES
// ==========================================
function getNeuralPool(limit, simList) {
    let pool = []; let somaH = 0; if(!db.ciclo.length) return pool;
    let localList = JSON.parse(JSON.stringify(simList));
    let safety = 0;
    while(somaH < limit && safety < 100) {
        safety++; let added = false;
        for(let m of db.ciclo) {
            if(somaH >= limit) break;
            let pending = localList.find(x => x.m === m && !x.f);
            if(pending) {
                const rito = [{k:'E', l:'Estudo', h:pending.h.E}, {k:'Rev', l:'Revisão', h:pending.h.Rev}, {k:'Ex', l:'Exercícios', h:pending.h.Ex}];
                for(let s of rito) {
                    if(!pending.done[s.k]) {
                        if(s.k === 'E') {
                            let al = Math.min(s.h - (pending.hF || 0), limit - somaH);
                            if(al > 0) { 
                                pool.push({ m: pending.m, a: pending.a, l: s.l, k: s.k, h: al, c: false }); 
                                pending.hF = (pending.hF || 0) + al; if(pending.hF >= s.h - 0.05) pending.done.E = true; 
                                somaH += al; added = true; 
                            }
                        } else if(somaH + s.h <= limit + 0.1) {
                            pool.push({ m: pending.m, a: pending.a, l: s.l, k: s.k, h: s.h, c: false });
                            pending.done[s.k] = true; somaH += s.h; added = true; if(s.k === 'Ex') pending.f = true;
                        }
                        break; 
                    }
                }
            }
        }
        if(!added) break;
    }
    return pool;
}

function impEdital() {
    const m = document.getElementById('add-mat').value.toUpperCase(); 
    const txt = document.getElementById('add-ass').value;
    const hTeoria = parseFloat(document.getElementById('add-horas').value) || 1.5;

    if(!m || !txt.trim()) return;

    txt.split('\n').filter(l => l.trim().length > 1).forEach(a => { 
        db.lista.push({ 
            m, 
            a: a.trim(), 
            h: {E: hTeoria, Rev: 1.0, Ex: 1.0}, 
            f: false, 
            done: {E: false, Rev: false, Ex: false}, 
            hF: 0 
        }); 
    });
    
    db.metaFixa = {}; 
    save(); 
    alert("Matéria Integrada com " + hTeoria + "h de teoria!"); 
    
    document.getElementById('add-mat').value = '';
    document.getElementById('add-ass').value = '';
}

function renderTree() {
    const mats = [...new Set(db.lista.map(x => x.m))];
    document.getElementById('tree').innerHTML = mats.map(m => `
        <div class="folder">
            <div class="folder-header" onclick="this.nextElementSibling.classList.toggle('open')"><b>${m}</b></div>
            <div class="folder-content">
                ${db.lista.filter(x => x.m === m).map(a => `<div class="sinal-row"><span>${a.a}</span><input type="checkbox" ${a.done.Ex?'checked':''} disabled></div>`).join('')}
            </div>
        </div>`).join('');
}

function renderFluxo() {
    const mats = [...new Set(db.lista.map(x => x.m))];
    document.getElementById('fluxo-content').innerHTML = mats.map(m => `
        <div class="stat-card"><b>${m}</b><br><small>Estudo | Rev | Ex</small></div>`).join('');
}

// 1. FUNÇÕES DE SUPORTE AO ARRASTO (ADICIONE NO FINAL DO ARQUIVO)
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("text", ev.target.innerText); }
function drop(ev) {
    ev.preventDefault();
    let data = ev.dataTransfer.getData("text");
    // Evita duplicados na área do ciclo
    if(![...document.getElementById('area-ciclo').children].some(el => el.innerText === data)) {
        renderItemCiclo(data, 'area-ciclo');
    }
}

function renderItemCiclo(nome, containerId) {
    const div = document.createElement('div');
    div.className = 'drag-item';
    div.draggable = true;
    div.ondragstart = drag;
    div.innerHTML = `${nome} <i class="fas fa-bars" style="color:#cbd5e1"></i>`;
    document.getElementById(containerId).appendChild(div);
}

// 2. SUBSTITUA A FUNÇÃO renderCiclo ATUAL POR ESTA:
function renderCiclo() {
    const todas = [...new Set(db.lista.map(x => x.m))];
    const pool = document.getElementById('pool-materias');
    const area = document.getElementById('area-ciclo');
    if(!pool || !area) return;
    pool.innerHTML = ''; area.innerHTML = '';
    
    todas.forEach(m => renderItemCiclo(m, 'pool-materias'));
    db.ciclo.forEach(m => renderItemCiclo(m, 'area-ciclo'));
}

// 3. SUBSTITUA A FUNÇÃO saveC ATUAL POR ESTA:
function saveC() {
    const itens = document.getElementById('area-ciclo').children;
    db.ciclo = Array.from(itens).map(el => el.innerText.trim());
    db.metaFixa = {}; // Reseta o cronograma para aplicar a nova ordem
    save();
    init();
    alert("Ordem do Ciclo salva! O cronograma foi atualizado.");
}


function renderHInputs() {
    const dN = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    document.getElementById('grid-h-in').innerHTML = dN.map((n,i) => `<div><small>${n}</small><br><input type="number" id="h-in-${i}" value="${db.h[i]}" style="width:50px;"></div>`).join('');
}

function saveH() { for(let i=0; i<7; i++) db.h[i] = parseFloat(document.getElementById(`h-in-${i}`).value); db.metaFixa = {}; save(); init(); }

function atualizarProgressoCiclo() {
    const itens = db.lista.filter(x => db.ciclo.includes(x.m)); 
    if (!itens.length) return;
    let concl = 0; itens.forEach(a => { if(a.done.E) concl++; if(a.done.Rev) concl++; if(a.done.Ex) concl++; });
    let p = Math.round((concl/(itens.length*3))*100);
    document.getElementById('bar-ciclo-total').style.width = p+"%";
    document.getElementById('perc-ciclo').innerText = p+"% cumprido";
}

function checkStreak() {
    let streak = 0; let d = new Date();
    while(true) {
        let k = d.toLocaleDateString();
        if (db.metaFixa[k]?.every(t => t.c)) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
    document.getElementById('streak-val').innerText = streak;
}

function navDay(dir) {
    if (dir === 0) vDate = new Date(); 
    else { let am = new Date(); am.setDate(am.getDate() + 1); vDate = am; }
    renderDiario(vDate);
}

function salvarExtra() {
    const m = document.getElementById('extra-mat').value;
    const a = document.getElementById('extra-ass').value;
    const tK = document.getElementById('extra-tipo').value;
    const tH = parseFloat(document.getElementById('extra-tempo').value);
    if(!m || !a || isNaN(tH)) return;
    const hj = new Date().toLocaleDateString();
    if(!db.metaFixa[hj]) db.metaFixa[hj] = [];
    db.metaFixa[hj].push({ m: m.toUpperCase(), a: a, l: "Extra", k: tK, h: tH, c: true });
    save(); fecharModais(); renderDiario(vDate); updateDashboard();
}
// --- FUNÇÕES DE SUPORTE AO ARRASTO (DRAG AND DROP) ---
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("text", ev.target.innerText); }
function drop(ev) {
    ev.preventDefault();
    let data = ev.dataTransfer.getData("text").trim(); // Limpa espaços
    
    // Verifica se a matéria já está na lista visual do ciclo
    const itensAtuais = [...document.getElementById('area-ciclo').children];
    const jaExiste = itensAtuais.some(el => el.innerText.trim() === data);
    
    if(!jaExiste) {
        renderItemCiclo(data, 'area-ciclo');
    } else {
        alert("Esta matéria já está no ciclo!");
    }
}

}

function renderItemCiclo(nome, containerId) {
    const div = document.createElement('div');
    div.className = 'drag-item';
    div.draggable = true;
    div.ondragstart = drag;
    div.innerHTML = `${nome} <i class="fas fa-bars" style="color:#cbd5e1"></i>`;
    document.getElementById(containerId).appendChild(div);
}

// --- SUBSTITUIÇÃO DAS FUNÇÕES DE CICLO ---
function renderCiclo() {
    const todas = [...new Set(db.lista.map(x => x.m))];
    const pool = document.getElementById('pool-materias');
    const area = document.getElementById('area-ciclo');
    if(!pool || !area) return;
    pool.innerHTML = ''; area.innerHTML = '';
    
    todas.forEach(m => renderItemCiclo(m, 'pool-materias'));
    db.ciclo.forEach(m => renderItemCiclo(m, 'area-ciclo'));
}

function saveC() {
    const itens = document.getElementById('area-ciclo').children;
    db.ciclo = Array.from(itens).map(el => el.innerText.trim());
    db.metaFixa = {}; 
    save();
    init();
    alert("Ordem do Ciclo salva! O cronograma foi atualizado.");
}
