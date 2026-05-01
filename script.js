// BANCO DE DADOS E VARIÁVEIS GLOBAIS
let db = JSON.parse(localStorage.getItem('prf_v120')) || { 
    lista: [], ciclo: [], h: {1:4, 2:4, 3:4, 4:4, 5:4, 6:4, 0:4}, metaFixa: {} 
};
let vDate = new Date();
let timers = {};
let exPendente = null;

const save = () => localStorage.setItem('prf_v120', JSON.stringify(db));

// ACESSO E INICIALIZAÇÃO
function checkAccess() { 
    if(document.getElementById('pass-input').value === "123") { 
        document.getElementById('login-screen').style.display='none'; 
        init(); 
    } 
}

function init() { 
    vDate = new Date();
    vDate.setHours(0,0,0,0);
    renderDiario(vDate); 
    updateDashboard(); 
}

// NAVEGAÇÃO DE ABAS
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

// DASHBOARD
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

    if(document.getElementById('prog-dia')) document.getElementById('prog-dia').innerText = tT>0 ? Math.round((cT/tT)*100)+"%" : "0%";
    if(document.getElementById('bar-dia')) document.getElementById('bar-dia').style.width = tT>0 ? (cT/tT)*100+"%" : "0%";
    if(document.getElementById('horas-hoje')) document.getElementById('horas-hoje').innerText = hS.toFixed(1)+"h";
    if(document.getElementById('precisao-dia')) document.getElementById('precisao-dia').innerText = tQ>0 ? Math.round((aQ/tQ)*100)+"%" : "0%";
    
    atualizarProgressoCiclo();
    checkStreak();
}

// PAINEL HOJE
function renderDiario(date) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const curStr = date.toLocaleDateString();
    
    let temAtr = false;
    let pD = new Date(hoje); pD.setDate(hoje.getDate() - hoje.getDay());
    for(let i=0; i < hoje.getDay(); i++) {
        let dP = new Date(pD); dP.setDate(pD.getDate() + i);
        if(db.metaFixa[dP.toLocaleDateString()]?.some(t => !t.c)) { temAtr = true; break; }
    }

    if(date > hoje && temAtr) {
        document.getElementById('lista-diaria').innerHTML = `
            <div class="stat-card" style="text-align:center; border:2px solid red;">
                <h3 style="color:red;">ACESSO BLOQUEADO 🚫</h3>
                <p>Matheus, conclua os atrasados antes de avançar.</p>
            </div>`;
        return;
    }

    if(!db.metaFixa[curStr]) db.metaFixa[curStr] = getNeuralPool(parseFloat(db.h[date.getDay()]), db.lista);
    const tasks = db.metaFixa[curStr];
    
    if(document.getElementById('meta-status')) document.getElementById('meta-status').innerText = `${tasks.reduce((a,b)=>a+b.h,0).toFixed(1)}h / ${db.h[date.getDay()]}h meta`;
    
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
                    <button class="btn btn-sm btn-outline" id="btn-t-${i}" onclick="toggleTimer(${i})"><i class="fas fa-play"></i></button>
                    <span id="time-${i}" style="font-family:monospace; font-weight:800; color:var(--accent);">00:00</span>
                </div>
            </div>
            <input type="checkbox" ${t.c ? 'checked' : ''} onclick="cliqueTask('${curStr}', ${i})">
        </div>`).join('');
    
    const ehHoje = curStr === hoje.toLocaleDateString();
    document.getElementById('view-title').innerText = ehHoje ? "Missão de Hoje 🚓" : "Missão de Amanhã 📅";
    document.getElementById('btn-hoje').style.display = ehHoje ? 'none' : 'inline-flex';
    document.getElementById('btn-amanha').style.display = ehHoje ? 'inline-flex' : 'none';
}

function renderSemanal() {
    const dN = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
    let hoje = new Date(); hoje.setHours(0,0,0,0);
    let pD = new Date(hoje); pD.setDate(hoje.getDate() - hoje.getDay());

    let grid = document.getElementById('grid-semanal');
    if(!grid) return;

    grid.innerHTML = [0,1,2,3,4,5,6].map(off => {
        let d = new Date(pD); d.setDate(pD.getDate() + off);
        let k = d.toLocaleDateString();
        let tasks = db.metaFixa[k] || [];
        let isAtr = d < hoje && tasks.some(t => !t.c);

        return `
            <div class="day-column">
                <div class="day-head ${isAtr ? 'atrasado' : ''}" style="${d.getTime() === hoje.getTime() ? 'background: #dbeafe;' : ''}">
                    <b>${dN[d.getDay()]}</b><br><small>${k.slice(0,5)}</small>
                </div>
                <div class="tasks-container-semanal">
                    ${tasks.map(x => `
                        <div class="mini-card" style="background: var(--color-${x.k==='Ex'?'ex':(x.k==='Rev'?'rev':'e')}); ${x.c ? 'opacity:0.5' : ''}">
                            <b>${x.m}</b><br><span>${x.a}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }).join('');
}

function getNeuralPool(limiteHoras, listaMaterias) {
    let pool = []; let horasAcumuladas = 0;
    listaMaterias.sort((a, b) => (b.hF || 0) - (a.hF || 0));

    for (let mat of listaMaterias) {
        if (horasAcumuladas >= limiteHoras) break;
        if (!mat.concluidoCiclo1) {
            if ((mat.hF || 0) < 3.0) {
                let hH = Math.min(3.0 - (mat.hF || 0), limiteHoras - horasAcumuladas);
                pool.push({ m: mat.m, a: mat.a, h: hH, k: 'E', l: 'Ciclo 1' });
                horasAcumuladas += hH;
            } else if (!mat.done?.Rev) {
                if (horasAcumuladas + 1 <= limiteHoras) { pool.push({ m: mat.m, a: mat.a, h: 1, k: 'Rev', l: 'Ciclo 1' }); horasAcumuladas += 1; }
            } else if (!mat.done?.Ex) {
                if (horasAcumuladas + 1 <= limiteHoras) { pool.push({ m: mat.m, a: mat.a, h: 1, k: 'Ex', l: 'Ciclo 1' }); horasAcumuladas += 1; }
            }
        } else {
            if (horasAcumuladas + 1 <= limiteHoras) { pool.push({ m: mat.m, a: mat.a, h: 1, k: 'Rev', l: 'Ciclo 2' }); horasAcumuladas += 1; }
        }
    }
    return pool;
}

function cliqueTask(dateStr, index) {
    const task = db.metaFixa[dateStr][index];
    task.c = !task.c; 
    const mat = db.lista.find(m => m.m === task.m && m.a === task.a);
    if (mat) {
        if (task.k === 'E' && task.l === 'Ciclo 1') {
            mat.hF = task.c ? (mat.hF || 0) + task.h : Math.max(0, (mat.hF || 0) - task.h);
            if (mat.hF >= 3.0) mat.done.E = true; 
        }
        if (task.l === 'Ciclo 1') {
            if (task.k === 'Rev') mat.done.Rev = task.c;
            if (task.k === 'Ex') { mat.done.Ex = task.c; if (task.c && mat.done.E && mat.done.Rev) mat.concluidoCiclo1 = true; }
        }
    }
    save(); renderDiario(vDate); updateDashboard();
}

function navDay(dir) {
    let target = new Date(); target.setHours(0,0,0,0);
    if (dir === 1) target.setDate(target.getDate() + 1);
    vDate = target;
    renderDiario(vDate);
}

function toggleTimer(id) {
    if (timers[id]) { clearInterval(timers[id].interval); delete timers[id]; document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-play"></i>'; } 
    else {
        let display = document.getElementById(`time-${id}`);
        let sec = 0;
        timers[id] = { interval: setInterval(() => { 
            sec++; 
            let m = Math.floor(sec/60).toString().padStart(2,'0'); 
            let s = (sec%60).toString().padStart(2,'0'); 
            display.innerText = `${m}:${s}`; 
        }, 1000) };
        document.getElementById(`btn-t-${id}`).innerHTML = '<i class="fas fa-pause"></i>';
    }
}

function salvarExtra() {
    const m = document.getElementById('extra-mat').value;
    const a = document.getElementById('extra-ass').value;
    const tK = document.getElementById('extra-tipo').value;
    const tempo = parseFloat(document.getElementById('extra-tempo').value);
    const hj = new Date().toLocaleDateString();
    if(!m || !a) return alert("Selecione os dados!");
    if(!db.metaFixa[hj]) db.metaFixa[hj] = [];
    db.metaFixa[hj].push({ m: m.toUpperCase(), a: a, l: "Extra", k: tK, h: tempo, c: false });
    save(); fecharModais(); renderDiario(vDate); updateDashboard();
}

// RESTANTE DAS FUNÇÕES ORIGINAIS (Tree, Fluxo, Config)
function saveH() { for(let i=0; i<7; i++) db.h[i] = parseFloat(document.getElementById(`h-in-${i}`).value); db.metaFixa = {}; save(); init(); }
function renderHInputs() { const dN = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]; document.getElementById('grid-h-in').innerHTML = dN.map((n,i) => `<div style="text-align:center;"><small>${n}</small><br><input type="number" id="h-in-${i}" value="${db.h[i]}" style="width:45px;"></div>`).join(''); }
function impEdital() { const m = document.getElementById('add-mat').value.toUpperCase(); const txt = document.getElementById('add-ass').value; if(!m || !txt.trim()) return; txt.split('\n').filter(l => l.trim().length > 1).forEach(a => { db.lista.push({ m, a: a.trim(), done: {E:false, Rev:false, Ex:false}, hF: 0 }); }); db.metaFixa = {}; save(); alert("Matéria Integrada!"); }
function renderTree() { const mats = [...new Set(db.lista.map(x => x.m))]; document.getElementById('tree').innerHTML = mats.map(m => { const ass = db.lista.filter(x => x.m === m); return `<div class="folder"><b>${m}</b><div class="content">${ass.map(a => `<div>${a.a}</div>`).join('')}</div></div>`; }).join(''); }
function atualizarProgressoCiclo() { const itens = db.lista; if (!itens.length) return; let concl = itens.filter(a => a.concluidoCiclo1).length; let p = Math.round((concl/itens.length)*100); if(document.getElementById('bar-ciclo-total')) document.getElementById('bar-ciclo-total').style.width = p+"%"; }
function fecharModais() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }
function renderCiclo() {}
function renderFluxo() {}
function checkStreak() {}
function saveC() {}
