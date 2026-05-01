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

// DASHBOARD SEMANAL (DOMINGO A SÁBADO)
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

// PAINEL HOJE (COM BLOQUEIO E CRONÔMETRO)
function renderDiario(date) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const curStr = date.toLocaleDateString();
    
    // 1. Verificação de Atrasos
    let temAtr = false;
    let pD = new Date(hoje); pD.setDate(hoje.getDate() - hoje.getDay());
    for(let i=0; i < hoje.getDay(); i++) {
        let dP = new Date(pD); dP.setDate(pD.getDate() + i);
        if(db.metaFixa[dP.toLocaleDateString()]?.some(t => !t.c)) { temAtr = true; break; }
    }

    // 2. BLOQUEIO DE SEGURANÇA (Se houver atraso e tentar ver o futuro)
    if(date > hoje && temAtr) {
        document.getElementById('lista-diaria').innerHTML = `
            <div class="stat-card" style="text-align:center; border:2px solid red;">
                <h3 style="color:red;">ACESSO BLOQUEADO 🚫</h3>
                <p>Matheus, conclua os plantões atrasados desta semana antes de avançar.</p>
            </div>`;
        return;
    }

    // 3. GERAÇÃO DA LISTA DE TAREFAS
    if(!db.metaFixa[curStr]) db.metaFixa[curStr] = getNeuralPool(parseFloat(db.h[date.getDay()]), JSON.parse(JSON.stringify(db.lista)));
    const tasks = db.metaFixa[curStr];
    document.getElementById('meta-status').innerText = `${tasks.reduce((a,b)=>a+b.h,0).toFixed(1)}h / ${db.h[date.getDay()]}h meta`;
    
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

    // 4. LÓGICA DO BOTÃO DE REPLANEJAR (Independente)
    const btnReplanejar = document.querySelector('.replan-btn');
    if (btnReplanejar) {
        if (temAtr) {
            btnReplanejar.style.display = "inline-flex";
            btnReplanejar.innerHTML = "<i class='fas fa-exclamation-triangle'></i> REPLANEJAR ATRASOS PENDENTES";
            btnReplanejar.style.backgroundColor = "#fee2e2"; 
        } else {
            btnReplanejar.style.display = "none";
        }
    }

    // 5. LÓGICA DO PARABÉNS (Só se tudo estiver OK)
    const tarefasConcluidas = tasks.length > 0 && tasks.every(x => x.c);
    if (tarefasConcluidas && ehHoje) {
        const lista = document.getElementById('lista-diaria');
        const divFim = document.createElement('div');
        divFim.className = "stat-card";
        divFim.style = "text-align:center; background: #f0fdf4; border: 2px dashed #16a34a; margin-top: 20px; padding: 30px; border-radius: 20px;";
        divFim.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 10px;">🏆</div>
            <h2 style="color: #16a34a; font-weight: 800; margin-bottom: 10px;">MISSÃO CUMPRIDA!</h2>
            <p style="color: #15803d; font-weight: 600; margin-bottom: 20px;">Excelente trabalho, Matheus! Todos os alvos de hoje foram atingidos.</p>
            <button class="btn" onclick="navDay(1)" style="background: #16a34a;"><i class="fas fa-arrow-right"></i> ADIANTAR ESTUDOS DE AMANHÃ</button>
        `;
        lista.appendChild(divFim);
    }
}

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

// MODAIS E EXERCÍCIOS CEBRASPE
function fecharModais() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }
function abrirModalExtra() {
    const selectMat = document.getElementById('extra-mat');
    const materiasUnicas = [...new Set(db.lista.map(x => x.m))];
    
    selectMat.innerHTML = '<option value="">Selecione a Matéria</option>' + 
        materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
    
    document.getElementById('modal-extra').style.display = 'flex';
}
function atualizarAssuntosExtra() {
    const matSelecionada = document.getElementById('extra-mat').value;
    const selectAss = document.getElementById('extra-ass');
    
    if (!matSelecionada) {
        selectAss.innerHTML = '<option value="">Selecione o Assunto</option>';
        return;
    }
    
    const assuntos = db.lista.filter(x => x.m === matSelecionada).map(x => x.a);
    selectAss.innerHTML = assuntos.map(a => `<option value="${a}">${a}</option>`).join('');
}

function cliqueTask(dateStr, index) {
    const task = db.metaFixa[dateStr][index];
    task.c = !task.c; 

    if (task.k === 'E' && task.l === 'Ciclo 1') {
        const mat = db.lista.find(m => m.materia === task.m && m.assunto === task.a);
        if (mat) {
            if (task.c) {
                mat.horasEstudadas = (mat.horasEstudadas || 0) + task.h;
            } else {
                mat.horasEstudadas = Math.max(0, (mat.horasEstudadas || 0) - task.h);
            }
            if (mat.horasEstudadas >= mat.horasMeta) {
                mat.estudoConcluido = true; 
            }
        }
    }

    if (task.l === 'Ciclo 1') {
        const mat = db.lista.find(m => m.materia === task.m && m.assunto === task.a);
        if (mat) {
            if (task.k === 'Rev') mat.revisaoFeita = task.c;
            if (task.k === 'Ex') {
                mat.exerciciosFeitos = task.c;
                if (task.c && mat.estudoConcluido && mat.revisaoFeita) {
                    mat.concluidoCiclo1 = true;
                }
            }
        }
    }

    save();
    renderDiario(vDate); 
}

function calcCebraspe() {
    const t = parseInt(document.getElementById('ex-total').value) || 0;
    const a = parseInt(document.getElementById('ex-acertos').value) || 0;
    const liq = a - (t - a);
    const perc = t > 0 ? Math.round((liq / t) * 100) : 0;
    document.getElementById('cebraspe-feedback').innerHTML = `
        Nota Líquida: ${liq} | Aproveitamento: ${perc}%<br>
        ${perc >= 75 ? 'ALTO DESEMPENHO 🔥' : 'PRECISA REFORÇAR ⚠️'}`;
}

function confirmarExercicio() {
    const t = db.metaFixa[exPendente.dK][exPendente.idx];
    t.c = true; 
    t.perf = { t: parseInt(document.getElementById('ex-total').value), a: parseInt(document.getElementById('ex-acertos').value) };
    save(); fecharModais(); updateDashboard(); renderDiario(vDate);
}

// REPLANEJAMENTO
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
    let rest = 6 - h.getDay();
    if(rest > 0 && atr.length > 0) {
        atr.forEach((t, idx) => {
            let dAl = new Date(h); dAl.setDate(h.getDate() + (idx % (rest + 1)));
            let kAl = dAl.toLocaleDateString();
            if(!db.metaFixa[kAl]) db.metaFixa[kAl] = [];
            db.metaFixa[kAl].push(t);
        });
    }
    save(); alert("Plantão Replanejado!"); init();
}

function renderSemanal() {
    const dN = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
    let hoje = new Date(); hoje.setHours(0,0,0,0);
    let pD = new Date(hoje); pD.setDate(hoje.getDate() - hoje.getDay());

    if(!db.inicioCiclo) { db.inicioCiclo = hoje.toLocaleDateString(); save(); }
    const parts = db.inicioCiclo.split('/');
    const dataInicio = new Date(parts[2], parts[1] - 1, parts[0]);

    document.getElementById('grid-semanal').innerHTML = [0,1,2,3,4,5,6].map(off => {
        let d = new Date(pD); d.setDate(pD.getDate() + off);
        let k = d.toLocaleDateString();
        const limiteDiario = parseFloat(db.h[d.getDay()]) || 0;
        
        if (d >= dataInicio && !db.metaFixa[k] && limiteDiario > 0) {
            db.metaFixa[k] = getNeuralPool(limiteDiario, db.lista, d);
        }

        let tasks = db.metaFixa[k] || [];
        let isAtr = d < hoje && tasks.some(t => !t.c);

        return `
            <div class="day-column">
                <div class="day-head ${isAtr ? 'atrasado' : ''}" style="${d.getTime() === hoje.getTime() ? 'background: #dbeafe; border-bottom: 2px solid #2563eb;' : ''}">
                    <span style="font-weight:800; font-size:0.65rem;">${dN[d.getDay()]}</span><br>
                    <span style="font-size:0.55rem; opacity:0.7;">${k.slice(0,5)}</span>
                </div>
                <div class="tasks-container-semanal" style="padding: 6px; display: flex; flex-direction: column; gap: 6px; background: ${d < dataInicio ? '#f8fafc' : '#fff'}; min-height: 250px;">
                    ${tasks.map(x => {
                        const cores = { 'E': '#3b82f6', 'Rev': '#f59e0b', 'Ex': '#10b981' };
                        const corCard = (d < hoje && !x.c) ? '#ef4444' : (cores[x.k] || '#3b82f6');
                        return `
                        <div style="background: ${corCard}; color: white; padding: 6px 8px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); ${x.c ? 'opacity:0.5' : ''}; min-height: 50px;">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 4px;">
                                <b style="font-size: 0.55rem; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">${x.m}</b>
                                <span style="font-size: 0.5rem; background: rgba(0,0,0,0.2); padding: 1px 3px; border-radius: 3px; font-weight: 800;">${x.h}h</span>
                            </div>
                            <div style="font-size: 0.55rem; line-height: 1.1; opacity: 0.9; margin: 2px 0;">${x.a}</div>
                            <div style="font-size: 0.45rem; font-weight: 700; text-transform: uppercase; opacity: 0.8;">${x.l}</div>
                        </div>`;
                    }).join('')}
                    ${d < dataInicio ? '<div style="text-align:center; margin-top:20px; font-size:0.5rem; color:#cbd5e1; font-weight:700;">FORA DO CICLO</div>' : ''}
                </div>
            </div>`;
    }).join('');
    save();
}

function getNeuralPool(limiteHoras, listaMaterias, dataAlvo) {
    let pool = [];
    let horasAcumuladas = 0;
    listaMaterias.sort((a, b) => (b.hF || 0) - (a.hF || 0));

    for (let mat of listaMaterias) {
        if (horasAcumuladas >= limiteHoras) break;
        if (!mat.concluidoCiclo1) {
            if ((mat.hF || 0) < 3.0) { // Exemplo de meta de 3h
                let horasRestantes = 3.0 - (mat.hF || 0);
                let horasHoje = Math.min(horasRestantes, limiteHoras - horasAcumuladas);
                pool.push({ m: mat.m, a: mat.a, h: horasHoje, k: 'E', l: 'Ciclo 1' });
                horasAcumuladas += horasHoje;
            } else if (!mat.done?.Rev) {
                if (horasAcumuladas + 1 <= limiteHoras) {
                    pool.push({ m: mat.m, a: mat.a, h: 1, k: 'Rev', l: 'Ciclo 1' });
                    horasAcumuladas += 1;
                }
            } else if (!mat.done?.Ex) {
                if (horasAcumuladas + 1 <= limiteHoras) {
                    pool.push({ m: mat.m, a: mat.a, h: 1, k: 'Ex', l: 'Ciclo 1' });
                    horasAcumuladas += 1;
                }
            }
        } else {
            if (horasAcumuladas + 1 <= limiteHoras) {
                pool.push({ m: mat.m, a: mat.a, h: 1, k: 'Rev', l: 'Ciclo 2' });
                horasAcumuladas += 1;
            }
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
            if (task.c) mat.hF = (mat.hF || 0) + task.h;
            else mat.hF = Math.max(0, (mat.hF || 0) - task.h);
            if (mat.hF >= 3.0) mat.done.E = true; 
        }
        if (task.l === 'Ciclo 1') {
            if (task.k === 'Rev') mat.done.Rev = task.c;
            if (task.k === 'Ex') {
                mat.done.Ex = task.c;
                if (task.c && mat.done.E && mat.done.Rev) mat.concluidoCiclo1 = true;
            }
        }
    }
    save();
    renderDiario(vDate); 
}

function getNeuralPool(limiteHoras, listaMaterias, dataAlvo) {
    let pool = [];
    let horasAcumuladas = 0;

    // Ordena matérias para priorizar o que começou e não terminou
    listaMaterias.sort((a, b) => (b.horasEstudadas || 0) - (a.horasEstudadas || 0));

    for (let mat of listaMaterias) {
        if (horasAcumuladas >= limiteHoras) break;

        // LÓGICA DO CICLO 1
        if (!mat.concluidoCiclo1) {
            // 1. ESTUDO: Só sai daqui quando horasEstudadas >= horasMeta
            if ((mat.horasEstudadas || 0) < mat.horasMeta) {
                let horasRestantes = mat.horasMeta - (mat.horasEstudadas || 0);
                let horasHoje = Math.min(horasRestantes, limiteHoras - horasAcumuladas);
                
                pool.push({
                    m: mat.materia,
                    a: mat.assunto,
                    h: horasHoje,
                    k: 'E', // Estudo
                    l: 'Ciclo 1'
                });
                horasAcumuladas += horasHoje;
            } 
            // 2. REVISÃO: Só aparece após o estudo completo
            else if (!mat.revisaoFeita) {
                if (horasAcumuladas + 1 <= limiteHoras) {
                    pool.push({ m: mat.materia, a: mat.assunto, h: 1, k: 'Rev', l: 'Ciclo 1' });
                    horasAcumuladas += 1;
                }
            }
            // 3. EXERCÍCIOS: O "Grand Finale" do Ciclo 1
            else if (!mat.exerciciosFeitos) {
                if (horasAcumuladas + 1 <= limiteHoras) {
                    pool.push({ m: mat.materia, a: mat.assunto, h: 1, k: 'Ex', l: 'Ciclo 1' });
                    horasAcumuladas += 1;
                }
            }
        } 
        // LÓGICA DO CICLO 2 (Repetição Espaçada)
        else {
            // Aqui entra a regra dos 3, 7, 21 dias (Rev + Ex)
            // Implementação simplificada para o pool:
            if (horasAcumuladas + 1 <= limiteHoras) {
                pool.push({ m: mat.materia, a: mat.assunto, h: 1, k: 'Rev', l: 'Ciclo 2' });
                horasAcumuladas += 1;
            }
        }
    }
    return pool;
}


// FERRAMENTAS DE CONFIGURAÇÃO E PERFORMANCE
function impEdital() {
    const m = document.getElementById('add-mat').value.toUpperCase(); 
    const txt = document.getElementById('add-ass').value;
    if(!m || !txt.trim()) return;
    txt.split('\n').filter(l => l.trim().length > 1).forEach(a => { 
        db.lista.push({ m, a: a.trim(), h: {E:1.5, Rev:1.0, Ex:1.0}, f: false, done: {E:false, Rev:false, Ex:false}, hF: 0 }); 
    });
    db.metaFixa = {}; save(); alert("Matéria Integrada!"); 
}

function renderTree() {
    const mats = [...new Set(db.lista.map(x => x.m))];
    document.getElementById('tree').innerHTML = mats.map(m => {
        const ass = db.lista.filter(x => x.m === m);
        return `
            <div class="folder">
                <div class="folder-header" onclick="this.nextElementSibling.classList.toggle('open')"><b>${m}</b></div>
                <div class="folder-content">
                    ${ass.map(a => `<div class="sinal-row"><span>${a.a}</span><input type="checkbox" ${a.done.Ex?'checked':''} disabled></div>`).join('')}
                </div>
            </div>`;
    }).join('');
}

function renderFluxo() {
    const mats = [...new Set(db.lista.map(x => x.m))];
    document.getElementById('fluxo-content').innerHTML = mats.map(m => `
        <div class="stat-card">
            <b>${m}</b>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:10px;">
                <div><small>Estudo</small><input type="number" step="0.5" value="1.5" onchange="alterarH('${m}', 'E', this.value)"></div>
                <div><small>Revisão</small><input type="number" step="0.5" value="1.0" onchange="alterarH('${m}', 'Rev', this.value)"></div>
                <div><small>Exercício</small><input type="number" step="0.5" value="1.0" onchange="alterarH('${m}', 'Ex', this.value)"></div>
            </div>
        </div>`).join('');
}

function alterarH(m, k, v) { 
    db.lista.filter(x => x.m === m).forEach(x => x.h[k] = parseFloat(v)); 
    save(); 
}

function renderCiclo() {
    const mats = [...new Set(db.lista.map(x => x.m))];
    document.getElementById('check-c').innerHTML = mats.map(m => `
        <label style="display:flex; gap:8px; margin-bottom:10px;"><input type="checkbox" class="ckc" value="${m}" ${db.ciclo.includes(m)?'checked':''}> ${m}</label>`).join('');
}

function saveC() { 
    db.ciclo = Array.from(document.querySelectorAll('.ckc:checked')).map(c => c.value); 
    db.metaFixa = {}; save(); init(); 
}

function renderHInputs() {
    const dN = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    document.getElementById('grid-h-in').innerHTML = dN.map((n,i) => `
        <div style="text-align:center;"><small>${n}</small><br><input type="number" id="h-in-${i}" value="${db.h[i]}" style="width:50px;"></div>`).join('');
}

function saveH() { 
    for(let i=0; i<7; i++) db.h[i] = parseFloat(document.getElementById(`h-in-${i}`).value); 
    db.metaFixa = {}; save(); init(); 
}

function atualizarProgressoCiclo() {
    const itens = db.lista.filter(x => db.ciclo.includes(x.m)); 
    if (!itens.length) return;
    let concl = 0; 
    itens.forEach(a => { if(a.done.E) concl++; if(a.done.Rev) concl++; if(a.done.Ex) concl++; });
    let p = Math.round((concl/(itens.length*3))*100);
    
    document.getElementById('bar-ciclo-total').style.width = p+"%";
    document.getElementById('viatura-progresso').style.left = (p * 0.95) + "%";
    document.getElementById('perc-ciclo').innerText = p+"% cumprido";
    
    const hF = itens.reduce((acc, curr) => acc + (curr.done.Ex ? 0 : 2), 0);
    document.getElementById('ciclo-estimativa').innerText = `Faltam aprox. ${Math.ceil(hF/4)} dias para girar`;
}

function checkStreak() {
    let streak = 0; let d = new Date();
    while(true) {
        let k = d.toLocaleDateString(); let tasks = db.metaFixa[k];
        if (tasks && tasks.length > 0 && tasks.every(t => t.c)) { streak++; d.setDate(d.getDate() - 1); } 
        else { break; }
    }
    document.getElementById('streak-val').innerText = streak;
}

function navDay(dir) {
    const h = new Date(); h.setHours(0,0,0,0);
    if (dir === 0) vDate = new Date(); else { let am = new Date(h); am.setDate(h.getDate() + 1); vDate = am; }
    const ehH = vDate.toLocaleDateString() === h.toLocaleDateString();
    document.getElementById('btn-hoje').style.display = ehH ? 'none' : 'inline-flex';
    document.getElementById('btn-amanha').style.display = ehH ? 'inline-flex' : 'none';
    renderDiario(vDate);
}

function salvarExtra() {
    const m = document.getElementById('extra-mat').value;
    const a = document.getElementById('extra-ass').value;
    const tipoK = document.getElementById('extra-tipo').value;
    const tempo = parseFloat(document.getElementById('extra-tempo').value);
    
    if(!m || !a) { alert("Selecione matéria e assunto!"); return; }
    
    const tiposL = { "E": "Estudo", "Rev": "Revisão", "Ex": "Exercícios" };
    const hj = new Date().toLocaleDateString();
    
    if(!db.metaFixa[hj]) db.metaFixa[hj] = [];
    
    db.metaFixa[hj].push({ 
        m: m.toUpperCase(), 
        a: a, 
        l: tiposL[tipoK], 
        k: tipoK, 
        h: tempo, 
        c: false, 
        extra: true 
    });
    
    save(); 
    fecharModais(); 
    renderDiario(vDate);
    updateDashboard();
}
