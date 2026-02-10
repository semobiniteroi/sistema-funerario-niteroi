// --- 1. CONFIGURAÇÃO E INICIALIZAÇÃO ---
const firebaseConfig = {
  apiKey: "AIzaSyB6pkQZNuLiYidKqstJdMXRl2OYW4JWmfs",
  authDomain: "funeraria-niteroi.firebaseapp.com",
  projectId: "funeraria-niteroi",
  storageBucket: "funeraria-niteroi.firebasestorage.app",
  messagingSenderId: "232673521828",
  appId: "1:232673521828:web:f25a77f27ba1924cb77631"
};

let db = null;
let unsubscribe = null;
let statsUnsubscribe = null;
let equipeUnsubscribe = null;
let logsUnsubscribe = null;
let sepulturaOriginal = ""; 
let dadosAtendimentoAtual = null;
let dadosEstatisticasExportacao = [];
let chartInstances = {}; 
let usuarioLogado = null; 

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("Conectado ao Firebase.");
    }
} catch (e) { console.error("Erro Firebase:", e); }

function getDB() {
    if (!db && typeof firebase !== 'undefined') {
        try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); } 
        catch(e) { if(firebase.apps.length) db = firebase.firestore(); }
    }
    return db;
}

const dimensoesUrna = { 'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70', 'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80', 'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85', '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95', 'PERPETUA': '' };

function safeDisplay(id, displayType) {
    const el = document.getElementById(id);
    if (el) el.style.display = displayType;
}

// --- 2. UTILITÁRIOS GLOBAIS ---
window.gerarProtocolo = function() {
    const elData = document.getElementById('data_ficha_modal');
    const agora = new Date();
    let ano, mes, dia;
    if (elData && elData.value) { const p = elData.value.split('-'); ano = p[0]; mes = p[1]; dia = p[2]; } 
    else { ano = agora.getFullYear(); mes = String(agora.getMonth()+1).padStart(2,'0'); dia = String(agora.getDate()).padStart(2,'0'); }
    return `${ano}${mes}${dia}-${String(agora.getHours()).padStart(2,'0')}${String(agora.getMinutes()).padStart(2,'0')}`;
}

window.pegarDataAtualLocal = function() {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`;
}

window.atualizarLabelQuadra = function(local) {
    const inputQd = document.getElementById('qd');
    if (inputQd) {
        const label = inputQd.previousElementSibling;
        if (label) label.innerText = (local && local.includes('MARUÍ')) ? 'QD' : 'RUA';
    }
}

window.carregarCidades = function(uf) {
    const elCidade = document.getElementById('cidade_obito');
    if(!uf) { if(elCidade) { elCidade.innerHTML = '<option value="">UF</option>'; elCidade.disabled = true; } return; }
    if(elCidade) {
        elCidade.innerHTML = '<option>...</option>'; elCidade.disabled = true;
        fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`).then(r=>r.json()).then(c=>{
            elCidade.innerHTML = '<option>Selecione</option>';
            c.sort((a,b)=>a.nome.localeCompare(b.nome));
            c.forEach(i=>{ const o=document.createElement('option'); o.value=i.nome.toUpperCase(); o.text=i.nome.toUpperCase(); elCidade.appendChild(o); });
            elCidade.disabled=false;
        });
    }
}

// --- 3. CORE (TABELA PRINCIPAL) ---
window.renderizarTabela = function(lista) {
    const tbody = document.getElementById('tabela-corpo'); if(!tbody) return;
    tbody.innerHTML = ''; 
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="11" style="padding:40px; text-align:center;">Nenhum registro.</td></tr>'; return; }

    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => window.visualizar(item.id);
        
        let isContagioso = false;
        if(item.causa) { const c = item.causa.toUpperCase(); isContagioso = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HIV', 'SIDA', 'SARAMPO'].some(d => c.includes(d)); }
        if (isContagioso) tr.classList.add('alerta-doenca');
        
        // Coluna 1
        let displayResponsavel = "";
        if (item.isencao === "50") displayResponsavel += `<span style="font-weight:900;">ACOLHIMENTO 50%</span>`;
        else if (item.isencao === "SIM") displayResponsavel += `<span style="font-weight:900;">ACOLHIMENTO 100%</span>`;
        else {
             if (item.funeraria) displayResponsavel += `<span style="font-weight:bold;">${item.funeraria.toUpperCase()}</span>`;
             else if (item.resp_nome) displayResponsavel += `<span style="font-weight:bold;">${item.resp_nome.toUpperCase()}</span>`;
             else displayResponsavel = 'S/D';
        }
        displayResponsavel += '<br>';
        if (item.tipo_urna_detalhe) displayResponsavel += `<span style="font-weight:bold; font-size:11px;">${item.tipo_urna_detalhe.toUpperCase()}</span>`;
        if (item.combo_urna) {
            displayResponsavel += `<br><span style="font-size:10px;">URNA ${item.combo_urna}</span>`;
            if (dimensoesUrna[item.combo_urna]) displayResponsavel += `<br><span style="font-size:9px; color:#666;">${dimensoesUrna[item.combo_urna]}</span>`;
        }
        let servicosExtras = [];
        if (item.tanato === 'SIM') servicosExtras.push('TANATOPRAXIA');
        if (item.invol === 'SIM') servicosExtras.push('INVOL');
        if (item.translado === 'SIM') servicosExtras.push('TRANSLADO');
        if (item.urna_opc === 'SIM') servicosExtras.push('URNA');
        if (servicosExtras.length > 0) { displayResponsavel += `<br><span style="font-size:10px; font-weight:bold;">SERVIÇOS: ${servicosExtras.join(', ')}</span>`; }

        // Coluna 3
        const conteudoNome = `<div style="font-weight:bold;">${isContagioso ? '⚠️ ' : ''}${item.nome ? item.nome.toUpperCase() : 'NOME NÃO INFORMADO'}</div>
                              <div style="color:red; font-size:10px; font-weight:bold; margin-top:2px;">(${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})</div>
                              ${item.classificacao_obito === 'ANJO' ? '<div style="font-size:9px; color:blue; font-weight:bold;">(ANJO)</div>' : ''}`;

        // Coluna 6
        let conteudoSepultura = `<div style="font-weight:bold; font-size:13px; color:#333;">${item.sepul||''}</div>`;
        const tipoSep = (item.tipo_sepultura || "").toUpperCase();
        if (item.perpetua === 'X' || tipoSep.includes('PERPETU')) {
             let labelPerpetua = tipoSep.replace('PERPETUA', 'PERPÉTUA').replace('PERPETUO', 'PERPÉTUO');
             if(labelPerpetua === "") labelPerpetua = "PERPÉTUA";
             conteudoSepultura += `
                <div style="font-weight:bold; font-size:10px; color:#2196F3; margin-top:2px;">${labelPerpetua}</div>
                <div style="font-weight:bold; font-size:10px; color:#2196F3;">L: ${item.livro_perpetua||''} F: ${item.folha_perpetua||''}</div>
             `;
        }

        // Coluna 10
        let displayFalecimento = '';
        if (item.data_obito && item.data_ficha) {
            const partes = item.data_obito.split('-'); 
            const dataFormatada = `${partes[2]}/${partes[1]}`; 
            let textoTempo = "";
            if (item.hora_obito && item.hora) {
                const inicio = new Date(`${item.data_obito}T${item.hora_obito}`); 
                const fim = new Date(`${item.data_ficha}T${item.hora}`);
                if (!isNaN(inicio) && !isNaN(fim)) { 
                    const diffMs = fim - inicio; 
                    const diffHrs = Math.floor(diffMs / 3600000); 
                    const diffMins = Math.round(((diffMs % 3600000) / 60000)); 
                    textoTempo = `<br><span style="font-weight:bold; font-size:10px;">TEMPO DE FALECIMENTO: ${diffHrs}H ${diffMins}M</span>`; 
                }
            }
            displayFalecimento = `<div style="line-height:1.3;"><span style="color:#c0392b; font-weight:bold;">DIA:</span> ${dataFormatada}<br><span style="color:#c0392b; font-weight:bold;">AS:</span> ${item.hora_obito || '--:--'}${textoTempo}</div>`;
        } else if (item.falecimento) { 
            displayFalecimento = `<div>${item.falecimento}</div>`; 
        }

        let btnMap = '';
        const cleanCoords = item.geo_coords ? item.geo_coords.replace(/\s/g, '') : '';
        if (cleanCoords && cleanCoords.includes(',')) {
             btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('https://www.google.com/maps/search/?api=1&query=${cleanCoords}', '_blank')" title="Ver Localização">📍</button>`;
        }

        tr.innerHTML = `
            <td style="vertical-align:middle;">${displayResponsavel}</td>
            <td style="text-align: center; vertical-align:middle;">${item.hora||''}</td>
            <td style="text-align: center; vertical-align:middle;">${conteudoNome}</td>
            <td style="text-align: center; vertical-align:middle;">${item.gav||''}</td>
            <td style="text-align: center; vertical-align:middle;">${item.car||''}</td>
            <td style="text-align: center; vertical-align:middle;">${conteudoSepultura}</td>
            <td style="text-align: center; vertical-align:middle;">${item.qd||''}</td>
            <td style="text-align: center; vertical-align:middle; font-size:11px;">${item.hospital||''}</td>
            <td style="text-align: center; vertical-align:middle;">${item.cap||''}</td>
            <td style="text-align: center; vertical-align:middle;">${displayFalecimento}</td>
            <td style="text-align:right; vertical-align:middle;">
                <div style="display:flex; gap:5px; justify-content:flex-end;">
                    ${btnMap}
                    <button class="btn-icon btn-editar-circle" onclick="event.stopPropagation();window.editar('${item.id}')">✏️</button>
                    <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation();window.excluir('${item.id}')">🗑️</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

window.atualizarListener = function(data, local) {
    const database = getDB(); if(!database) return;
    if (unsubscribe) unsubscribe();
    unsubscribe = database.collection("atendimentos").where("data_ficha", "==", data).onSnapshot((snap) => {
        let lista = [];
        snap.forEach(doc => { let d = doc.data(); d.id = doc.id; if ((d.local || "CEMITÉRIO DO MARUÍ") === local) lista.push(d); });
        lista.sort((a,b) => (a.hora < b.hora ? -1 : 1));
        window.renderizarTabela(lista);
    });
}

// --- 4. LOGIN E ADMIN ---
window.fazerLogin = function() {
    const u = document.getElementById('login-usuario').value.trim();
    const p = document.getElementById('login-senha').value.trim();
    if (p === "2026") { usuarioLogado={nome:"Admin", login:"admin"}; window.liberarAcesso(); return; }
    
    const database = getDB();
    if (!database) { alert("Sem conexão com banco."); return; }
    
    database.collection("equipe").where("login", "==", u).where("senha", "==", p).get().then(snap => {
        if (!snap.empty) { usuarioLogado = snap.docs[0].data(); window.liberarAcesso(); } 
        else { alert("Dados incorretos."); }
    });
}

window.liberarAcesso = function() {
    safeDisplay('tela-bloqueio', 'none');
    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
    const il = document.getElementById('filtro-local');
    if(il) { window.atualizarListener(window.pegarDataAtualLocal(), il.value); window.atualizarLabelQuadra(il.value); }
}

window.abrirAdmin = function() { safeDisplay('modal-admin', 'block'); window.abrirAba('tab-equipe'); }
window.fecharModalAdmin = function() { safeDisplay('modal-admin', 'none'); }

window.abrirAba = function(id) {
    Array.from(document.getElementsByClassName('tab-pane')).forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    const buttons = document.querySelectorAll('.tab-header .tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (id === 'tab-equipe') buttons[0].classList.add('active');
    if (id === 'tab-stats') buttons[1].classList.add('active');
    if (id === 'tab-logs') buttons[2].classList.add('active');

    if(id==='tab-equipe') window.listarEquipe();
    if(id==='tab-logs') window.carregarLogs();
    if(id==='tab-stats') window.carregarEstatisticas('7');
}

window.carregarLogs = function() {
    const database = getDB();
    const tbody = document.getElementById('tabela-logs');
    if(!database || !tbody) return;
    tbody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    logsUnsubscribe = database.collection("atendimentos").limit(50).orderBy("data_ficha", "desc").onSnapshot(snap => {
        tbody.innerHTML = '';
        if(snap.empty) { tbody.innerHTML = '<tr><td colspan="3">Nenhum registro encontrado.</td></tr>'; return; }
        let logs = [];
        snap.forEach(doc => { logs.push(doc.data()); });
        logs.forEach(log => {
            const dataF = log.data_ficha ? log.data_ficha.split('-').reverse().join('/') : '-';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="font-weight:bold;">${dataF}</td><td>${log.nome}</td><td>${log.atendente_sistema || 'N/A'}</td>`;
            tbody.appendChild(tr);
        });
    });
}

// --- GERENCIAMENTO DE EQUIPE ---
window.listarEquipe = function() {
    const database = getDB();
    const ul = document.getElementById('lista-equipe');
    if(!database || !ul) return;
    
    equipeUnsubscribe = database.collection("equipe").orderBy("nome").onSnapshot(snap => {
        ul.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            ul.innerHTML += `<li style="display:flex; justify-content:space-between; align-items:center; padding:5px; border-bottom:1px solid #eee;">
                <span style="flex-grow:1;">${u.nome} (${u.login})</span>
                <div>
                    <button class="btn-icon" onclick="window.editarFuncionario('${doc.id}')" style="margin-right:5px; cursor:pointer;" title="Editar">✏️</button>
                    <button class="btn-icon" onclick="window.excluirFuncionario('${doc.id}')" style="color:red; cursor:pointer;" title="Excluir">🗑️</button>
                </div>
            </li>`;
        });
    });
}

window.adicionarFuncionario = function() {
    const nome = document.getElementById('novo-nome').value;
    const login = document.getElementById('novo-login').value;
    const email = document.getElementById('novo-email').value;
    const senha = document.getElementById('nova-senha').value;
    
    if(!nome || !login || !senha) { alert("Preencha nome, login e senha."); return; }
    
    getDB().collection("equipe").add({ nome, login, email, senha })
        .then(() => {
            alert("Usuário adicionado!");
            document.getElementById('novo-nome').value = "";
            document.getElementById('novo-login').value = "";
            document.getElementById('novo-email').value = "";
            document.getElementById('nova-senha').value = "";
        })
        .catch(e => alert("Erro: " + e));
}

window.excluirFuncionario = function(id) {
    if(confirm("Tem certeza que deseja excluir este usuário?")) {
        getDB().collection("equipe").doc(id).delete();
    }
}

window.editarFuncionario = function(id) {
    getDB().collection("equipe").doc(id).get().then(doc => {
        if(doc.exists) {
            const u = doc.data();
            document.getElementById('edit-id').value = doc.id;
            document.getElementById('edit-nome').value = u.nome;
            document.getElementById('edit-login').value = u.login;
            document.getElementById('edit-email').value = u.email;
            document.getElementById('edit-senha').value = u.senha;
            
            document.getElementById('box-novo-usuario').classList.add('hidden');
            document.getElementById('div-editar-usuario').classList.remove('hidden');
        }
    });
}

window.salvarEdicaoUsuario = function() {
    const id = document.getElementById('edit-id').value;
    const nome = document.getElementById('edit-nome').value;
    const email = document.getElementById('edit-email').value;
    const senha = document.getElementById('edit-senha').value;
    
    if(!nome || !senha) { alert("Nome e senha são obrigatórios."); return; }
    
    getDB().collection("equipe").doc(id).update({ nome, email, senha })
        .then(() => {
            alert("Usuário atualizado!");
            window.cancelarEdicao();
        })
        .catch(e => alert("Erro: " + e));
}

window.cancelarEdicao = function() {
    document.getElementById('edit-id').value = "";
    document.getElementById('edit-nome').value = "";
    document.getElementById('edit-login').value = "";
    document.getElementById('edit-email').value = "";
    document.getElementById('edit-senha').value = "";
    
    document.getElementById('div-editar-usuario').classList.add('hidden');
    document.getElementById('box-novo-usuario').classList.remove('hidden');
}

// --- ESTATÍSTICAS ---
window.carregarEstatisticas = function(modo) {
    const database = getDB();
    if(!database) return;
    
    let dInicio = new Date();
    let filtroMes = null, filtroAno = null;
    let dString = "";

    if (modo === 'custom') {
        const inputMonth = document.getElementById('filtro-mes-ano');
        if(inputMonth && inputMonth.value) {
             dString = inputMonth.value + "-01";
             filtroAno = inputMonth.value.split('-')[0];
             filtroMes = inputMonth.value.split('-')[1];
        } else { 
             alert("Selecione Mês e Ano."); return; 
        }
    } else {
        if (modo === 'mes') dInicio = new Date(dInicio.getFullYear(), dInicio.getMonth(), 1);
        else dInicio.setDate(dInicio.getDate() - parseInt(modo));
        dString = dInicio.toISOString().split('T')[0];
    }
    
    database.collection("atendimentos").where("data_ficha", ">=", dString).onSnapshot(snap => {
        let causas = {};
        snap.forEach(doc => {
            const d = doc.data();
            if (modo === 'custom') { 
                const checkStr = (document.getElementById('filtro-mes-ano') && document.getElementById('filtro-mes-ano').value) ? document.getElementById('filtro-mes-ano').value : `${filtroAno}-${filtroMes}`;
                if (!d.data_ficha.startsWith(checkStr)) return; 
            }
            if(d.causa) { 
                d.causa.split('/').forEach(c => { 
                    const k = c.trim().toUpperCase(); 
                    if(k) causas[k] = (causas[k] || 0) + 1; 
                });
            }
        });
        
        const sorted = Object.entries(causas).sort((a,b) => b[1] - a[1]).slice(0, 10);
        const labels = sorted.map(x => x[0]);
        const data = sorted.map(x => x[1]);

        const ctx = document.getElementById('grafico-causas');
        if(ctx && window.Chart) {
            if(chartInstances['causas']) chartInstances['causas'].destroy();
            chartInstances['causas'] = new Chart(ctx, {
                type: 'bar',
                data: { labels: labels, datasets: [{ label: 'Top 10 Causas', data: data, backgroundColor: '#3699ff' }] },
                options: { indexAxis: 'y', maintainAspectRatio: false, scales: { x: { beginAtZero: true } } }
            });
        }
        
        dadosEstatisticasExportacao = sorted.map(([c,q]) => ({"Causa": c, "Qtd": q}));
    });
}

window.baixarRelatorioCompleto = function() {
    if(!getDB()) return; if(!confirm("Baixar relatório?")) return;
    if(typeof XLSX === 'undefined') { alert("Biblioteca Excel não carregada."); return; }
    
    getDB().collection("atendimentos").get().then(snap => {
        let dados = [];
        snap.forEach(doc => {
            let d = doc.data();
            dados.push([d.data_ficha, d.hora, d.nome, d.causa, d.resp_nome, d.telefone, d.funeraria, d.local, d.sepul, d.protocolo, d.atendente_sistema]);
        });
        const ws = XLSX.utils.aoa_to_sheet([["Data","Hora","Nome","Causa","Resp","Tel","Funeraria","Local","Sepul","Proto","Atendente"], ...dados]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Geral");
        XLSX.writeFile(wb, "Relatorio_Geral.xlsx");
    });
}

window.baixarExcel = function() {
    if(typeof XLSX === 'undefined' || dadosEstatisticasExportacao.length === 0) { alert("Sem dados ou biblioteca."); return; }
    const ws = XLSX.utils.json_to_sheet(dadosEstatisticasExportacao);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stats");
    XLSX.writeFile(wb, "Estatisticas.xlsx");
}

// --- MODAIS E AÇÕES ---
window.abrirModal = function() {
    document.getElementById('form-atendimento').reset();
    document.getElementById('docId').value = "";
    document.getElementById('protocolo_hidden').value = "";
    document.getElementById('div-motivo-edicao').classList.add('hidden');
    
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    document.getElementById('data_hora_atendimento').value = (new Date(now - offset)).toISOString().slice(0, 16);
    
    const fd = document.getElementById('filtro-data');
    if(fd) document.getElementById('data_ficha_modal').value = fd.value;
    safeDisplay('modal', 'block');
}

window.editar = function(id) {
    const database = getDB();
    if(!database) return;
    
    database.collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            for (let key in d) {
                const el = document.getElementById(key);
                if(el) el.value = d[key];
            }
            document.getElementById('docId').value = doc.id;
            document.getElementById('protocolo_hidden').value = d.protocolo;
            document.getElementById('data_ficha_modal').value = d.data_ficha;
            
            ['tanato', 'invol', 'translado', 'urna_opc'].forEach(k => {
                const chk = document.getElementById('chk_'+k);
                if(chk) chk.checked = (d[k] === 'SIM');
            });

            // DATA/HORA
            if(d.data_hora_atendimento) {
                 document.getElementById('data_hora_atendimento').value = d.data_hora_atendimento;
            } else if(d.protocolo && d.protocolo.length >= 13) {
                 const p = d.protocolo;
                 const y = p.substring(0,4), m = p.substring(4,6), day = p.substring(6,8);
                 const h = p.substring(9,11), min = p.substring(11,13);
                 document.getElementById('data_hora_atendimento').value = `${y}-${m}-${day}T${h}:${min}`;
            }

            const tipoSep = (d.tipo_sepultura || "").toUpperCase();
            if (tipoSep.includes('PERPETU')) {
                document.getElementById('div-perpetua').classList.remove('hidden');
            } else {
                document.getElementById('div-perpetua').classList.add('hidden');
            }

            document.getElementById('div-motivo-edicao').classList.remove('hidden');
            safeDisplay('modal', 'block');
        }
    });
}

window.fecharModal = function() { safeDisplay('modal', 'none'); }

const form = document.getElementById('form-atendimento');
if(form) {
    form.onsubmit = (e) => {
        e.preventDefault();
        const database = getDB();
        const id = document.getElementById('docId').value;
        const motivo = document.getElementById('motivo_edicao').value;
        const tipoSep = document.getElementById('tipo_sepultura').value;
        
        let dados = {};
        Array.from(form.elements).forEach(el => {
            if(el.id && el.type !== 'submit' && el.type !== 'button') {
                if(el.type === 'checkbox') dados[el.id.replace('chk_', '')] = el.checked ? 'SIM' : 'NAO';
                else dados[el.id] = el.value;
            }
        });
        dados.data_hora_atendimento = document.getElementById('data_hora_atendimento').value;
        dados.data_ficha = document.getElementById('data_ficha_modal').value;
        dados.local = document.getElementById('filtro-local').value;
        
        dados.gav = tipoSep.includes('GAVETA') ? 'X' : '';
        dados.car = tipoSep.includes('CARNEIRO') ? 'X' : '';
        dados.cova_rasa = tipoSep.includes('COVA') ? 'X' : '';
        dados.perpetua = (tipoSep.includes('PERPETUA') || tipoSep.includes('PERPETUO')) ? 'X' : '';

        if(!id && !dados.protocolo) dados.protocolo = window.gerarProtocolo();

        if(id) {
            if(!motivo) { alert("Motivo obrigatório na edição."); return; }
            database.collection("auditoria").add({
                data_log: new Date().toISOString(),
                usuario: usuarioLogado ? usuarioLogado.nome : 'Anon',
                acao: "EDIÇÃO",
                detalhe: `ID: ${id} | Motivo: ${motivo}`
            });
            database.collection("atendimentos").doc(id).update(dados).then(() => window.fecharModal());
        } else {
             database.collection("auditoria").add({
                data_log: new Date().toISOString(),
                usuario: usuarioLogado ? usuarioLogado.nome : 'Anon',
                acao: "CRIAÇÃO",
                detalhe: `Novo: ${dados.nome}`
            });
            database.collection("atendimentos").add(dados).then(() => window.fecharModal());
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const selectTipo = document.getElementById('tipo_sepultura');
    if (selectTipo) {
        selectTipo.addEventListener('change', function() {
            const val = this.value.toUpperCase();
            const divP = document.getElementById('div-perpetua');
            if (val.includes('PERPETUA') || val.includes('PERPETUO')) {
                divP.classList.remove('hidden');
            } else {
                divP.classList.add('hidden');
            }
        });
    }
    
    const fl = document.getElementById('filtro-local');
    if(fl) fl.addEventListener('change', (e) => {
        window.atualizarListener(document.getElementById('filtro-data').value, e.target.value);
        window.atualizarLabelQuadra(e.target.value);
    });

    const sessao = sessionStorage.getItem('usuarioLogado');
    if (sessao) { 
        usuarioLogado = JSON.parse(sessao);
        safeDisplay('tela-bloqueio', 'none');
        if(document.getElementById('filtro-local')) window.atualizarListener(window.pegarDataAtualLocal(), document.getElementById('filtro-local').value);
    }
    const fd = document.getElementById('filtro-data');
    if(fd) fd.addEventListener('change', (e) => window.atualizarListener(e.target.value, document.getElementById('filtro-local').value));
});

// VISUALIZAR
window.visualizar = function(id) {
    const database = getDB();
    const modalView = document.getElementById('modal-visualizar');
    if(!modalView || !database) return;
    
    database.collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            dadosAtendimentoAtual = d;
            
            const map = {
                'view_protocolo': d.protocolo, 'view_hora': d.hora, 'view_nome': d.nome, 'view_causa': d.causa,
                'view_telefone': d.telefone, 'view_funeraria': d.funeraria,
                'view_atendente': d.atendente_sistema, 'view_combo_urna': d.combo_urna, 
                'view_hospital_completo': d.hospital, 'view_cap': d.cap, 'view_urna_info': d.urna_info
            };
            for(let k in map) { const el = document.getElementById(k); if(el) el.innerText = map[k] || '-'; }
            
            const respCompleto = d.resp_nome + (d.parentesco ? ` (${d.parentesco})` : '');
            if(document.getElementById('view_resp_completo')) document.getElementById('view_resp_completo').innerText = respCompleto;

            let localSep = `Tipo: ${d.tipo_sepultura || ''} | Nº: ${d.sepul||''} | QD: ${d.qd||''}`;
            if(d.tipo_sepultura && d.tipo_sepultura.toUpperCase().includes('PERPETU')) {
                localSep += ` (L: ${d.livro_perpetua||'-'} F: ${d.folha_perpetua||'-'})`;
            }
            if(document.getElementById('view_local_sepul')) document.getElementById('view_local_sepul').innerText = localSep;

            let dtObitoF = d.data_obito ? d.data_obito.split('-').reverse().join('/') : '';
            let hrObitoF = d.hora_obito || '';
            if(d.ignorar_hora_obito === 'SIM') hrObitoF += ' (IGNORADO)';
            if(document.getElementById('view_data_obito')) document.getElementById('view_data_obito').innerText = `${dtObitoF} às ${hrObitoF}`;

            let dataHoraFinal = "";
            if (d.data_hora_atendimento) { 
                 const date = new Date(d.data_hora_atendimento);
                 dataHoraFinal = `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()} AS ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
            } else if (d.protocolo && d.protocolo.length >= 13) {
                 const p = d.protocolo;
                 if(p.indexOf('-') === 8) {
                    dataHoraFinal = `${p.substring(6,8)}/${p.substring(4,6)}/${p.substring(0,4)} AS ${p.substring(9,11)}:${p.substring(11,13)}`;
                 }
            }
            if(document.getElementById('view_data_registro')) document.getElementById('view_data_registro').innerText = dataHoraFinal;

            const mapContainer = document.getElementById('view_map_container');
            const mapFrame = document.getElementById('mapa-frame');
            const mapLink = document.getElementById('link-gps');
            if (mapContainer && mapFrame && mapLink) {
                 const cleanCoords = d.geo_coords ? d.geo_coords.replace(/\s/g, '') : '';
                 if (cleanCoords && cleanCoords.includes(',')) {
                     mapContainer.style.display = 'block';
                     mapFrame.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="https://www.google.com/maps?q=${cleanCoords}&z=17&output=embed"></iframe>`;
                     mapLink.href = `https://www.google.com/maps/search/?api=1&query=${cleanCoords}`;
                 } else {
                     mapContainer.style.display = 'none';
                 }
            }

            safeDisplay('modal-visualizar', 'block');
        }
    });
}

window.fecharModalVisualizar = function() { safeDisplay('modal-visualizar', 'none'); };
window.fecharModalEstatisticas = function() { safeDisplay('modal-estatisticas', 'none'); };
window.alternarDesign = function() { document.body.classList.toggle('design-classico'); };
window.imprimirRelatorio = function(modo) { 
    const style = document.createElement('style');
    style.innerHTML = `@page { size: ${modo}; }`;
    document.head.appendChild(style);
    window.print(); 
    setTimeout(() => document.head.removeChild(style), 1000);
};
window.excluir = function(id) { if(confirm('Tem certeza?')) { getDB().collection("atendimentos").doc(id).delete(); } };
window.onclick = function(event) { const t = event.target; if (t == document.getElementById('modal-visualizar')) window.fecharModalVisualizar(); if (t == document.getElementById('modal-estatisticas')) window.fecharModalEstatisticas(); if (t == document.getElementById('modal-equipe')) window.fecharModalEquipe(); if (t == document.getElementById('modal-admin')) window.fecharModalAdmin(); }
window.fazerLogout = function() { sessionStorage.removeItem('usuarioLogado'); window.location.reload(); }
window.checarLoginEnter = function(e) { if(e.key==='Enter') window.fazerLogin(); }
window.bloquearTela = function() { const t = document.getElementById('tela-bloqueio'); if(t) t.style.display = 'flex'; }

window.gerarEtiqueta = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const fd = (dataStr) => { 
        if (!dataStr) return ""; 
        const p = dataStr.split('-'); 
        return `${p[2]}/${p[1]}/${p[0]}`; 
    };
    const dataF = fd(d.data_ficha);
    const h = `
    <html>
    <head>
    <style>
        @page { size: landscape; margin: 0; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; height: 100vh; width: 100vw; display: flex; justify-content: center; align-items: center; overflow: hidden; }
        .box { width: 95vw; height: 90vh; border: 5px solid #000; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; gap: 20px; }
        .header-img { max-height: 100px; margin-bottom: 10px; }
        .title { font-size: 24px; font-weight: 900; text-transform: uppercase; border-bottom: 3px solid #000; padding-bottom: 5px; display: inline-block; margin-bottom: 30px; }
        .group { margin-bottom: 30px; width: 100%; }
        .label { font-size: 18px; color: #333; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
        .val-nome { font-size: 55px; font-weight: 900; text-transform: uppercase; line-height: 1.1; }
        .val-data { font-size: 40px; font-weight: 800; }
        .val-local { font-size: 35px; font-weight: 800; text-transform: uppercase; }
    </style>
    </head>
    <body>
        <div class="box">
            <div>
                <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="header-img">
                <br>
                <div class="title">IDENTIFICAÇÃO DE VELÓRIO</div>
            </div>
            
            <div class="group">
                <div class="label">FALECIDO(A)</div>
                <div class="val-nome">${d.nome}</div>
            </div>

            <div class="group">
                <div class="label">SEPULTAMENTO</div>
                <div class="val-data">${dataF} às ${d.hora}</div>
            </div>

            <div class="group">
                <div class="label">LOCAL</div>
                <div class="val-local">${d.cap}<br>${d.local || "CEMITÉRIO DO MARUÍ"}</div>
            </div>
        </div>
        <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
    </body>
    </html>`;
    const w = window.open('','_blank'); 
    if(w) { w.document.write(h); w.document.close(); } else { alert("Desbloqueie os pop-ups."); }
}

window.enviarWhatsapp = function() {
    if (!dadosAtendimentoAtual) return;
    const t = dadosAtendimentoAtual.telefone ? dadosAtendimentoAtual.telefone.replace(/\D/g, '') : '';
    const c = dadosAtendimentoAtual.geo_coords ? dadosAtendimentoAtual.geo_coords.replace(/\s/g, '') : '';
    if (!t) { alert("Sem telefone."); return; }
    if (!c) { alert("Sem GPS."); return; }
    window.open(`https://api.whatsapp.com/send?phone=55${t}&text=${encodeURIComponent('Localização: https://www.google.com/maps/search/?api=1&query=$' + c)}`, '_blank');
}
window.enviarSMS = function() {
    if (!dadosAtendimentoAtual) return;
    const t = dadosAtendimentoAtual.telefone ? dadosAtendimentoAtual.telefone.replace(/\D/g, '') : '';
    const c = dadosAtendimentoAtual.geo_coords ? dadosAtendimentoAtual.geo_coords.replace(/\s/g, '') : '';
    if (!t) { alert("Sem telefone."); return; }
    window.location.href = `sms:55${t}?body=${encodeURIComponent('Localização: https://www.google.com/maps/search/?api=1&query=$' + c)}`;
}

window.gerarComprovante = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const chk = (cond) => cond ? '(X)' : '( )';
    const fd = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

    const p = d.protocolo || "";
    let dataHoraAtendimentoTexto = "";
    if (d.data_hora_atendimento) {
        const dateObj = new Date(d.data_hora_atendimento);
        dataHoraAtendimentoTexto = `${dateObj.getDate().toString().padStart(2,'0')}/${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${dateObj.getFullYear()} AS ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
    } else {
        const now = new Date();
        dataHoraAtendimentoTexto = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} AS ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    }
    
    const im = (d.local && d.local.includes("MARUÍ")); const is = (d.local && d.local.includes("SÃO FRANCISCO")); const ii = (d.local && d.local.includes("ITAIPU")); const cc = (d.cap && !d.cap.toUpperCase().includes("SEM"));
    
    let tempoDecorrido = "";
    if (d.data_obito && d.hora_obito && d.hora && d.data_ficha) { const dtObito = new Date(d.data_obito + 'T' + d.hora_obito); const dtSepul = new Date(d.data_ficha + 'T' + d.hora); const diff = dtSepul - dtObito; if (diff > 0) { const diffHrs = Math.floor(diff / 3600000); const diffMins = Math.round(((diff % 3600000) / 60000)); tempoDecorrido = `${diffHrs}h ${diffMins}min`; } }
    
    const ec = d.estado_civil || "";
    const chkEC = (val) => ec === val ? '(X)' : '( )';
    const relacao = d.parentesco ? `(${d.parentesco})` : '';

    let txtSep = (d.tipo_sepultura || "").toUpperCase(); 
    const co = d.classificacao_obito || "ADULTO"; 
    let txtHoraObito = d.hora_obito; if (d.ignorar_hora_obito === 'SIM') txtHoraObito += " (IGNORADO)";
    let classificacao = co; if (txtSep.includes("ANJO")) classificacao = "ANJO";
    
    if (txtSep.includes("PERPETUA") || txtSep.includes("PERPETUO")) {
        txtSep = `${txtSep} (LIVRO: ${d.livro_perpetua||'-'} / FOLHA: ${d.folha_perpetua||'-'}) - ${classificacao}`;
    } else if (txtSep.includes("MEMBRO")) {
        txtSep = `MEMBRO AMPUTADO (${d.tipo_membro || 'Não informado'})`;
    } else {
        txtSep = `${txtSep} - ${classificacao}`;
    }

    // Cálculo da Data de Exumação
    let dataExumacao = "";
    if (d.data_ficha) {
        const parts = d.data_ficha.split('-');
        let ano = parseInt(parts[0]);
        const mes = parts[1];
        const dia = parts[2];
        
        // Se for ANJO (criança) = +2 anos, senão = +3 anos
        const addAnos = (d.classificacao_obito === 'ANJO') ? 2 : 3;
        dataExumacao = `${dia}/${mes}/${ano + addAnos}`;
    }

    const htmlComprovante = `<html><head><title>Comprovante</title><style>@page { size: A4 portrait; margin: 8mm; } body { font-family: Arial, sans-serif; font-size: 14px; margin: 0; padding: 10px; line-height: 1.3; color: #000; } .header { text-align: center; margin-bottom: 25px; position: relative; } .header h2 { font-size: 20px; text-decoration: underline; margin: 0; font-weight: bold; text-transform: uppercase; color: #000; } .protocolo { position: absolute; top: -5px; right: 0; font-size: 14px; font-weight: bold; border: 2px solid #000; padding: 5px 10px; } .content { width: 100%; } .line { margin-bottom: 4px; white-space: nowrap; overflow: hidden; } .bold { font-weight: 900; } .red { color: red; font-weight: bold; } .section-title { font-weight: 900; margin-top: 15px; margin-bottom: 2px; text-transform: uppercase; font-size: 14px; } .two-columns { display: flex; justify-content: space-between; margin-top: 10px; } .col-left { width: 60%; } .col-right { width: 38%; } .assinaturas-block { display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 10px; gap: 20px; } .ass-line { border-top: 1px solid #000; text-align: center; padding-top: 2px; flex: 1; font-size: 12px; } .obs-text { font-weight: bold; font-size: 12px; margin-top: 5px; } .box-lateral { border: 2px solid #000; padding: 5px; font-weight: 900; font-size: 12px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; } .termo-juridico { text-align: justify; font-size: 12px; line-height: 1.3; } .footer-line { margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; font-weight: 900; font-size: 12px; } .aviso-final { border: 2px solid #000; padding: 5px; margin-top: 10px; font-weight: 900; text-align: justify; font-size: 12px; line-height: 1.3; } .spacer { margin-left: 10px; } </style></head><body><div class="header"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height: 60px; margin-bottom: 5px;"><h2>Comprovante de Atendimento</h2><div class="protocolo">PROTOCOLO: ${p}</div></div><div class="content"><div class="line"><span class="bold">Nome do FALECIDO:</span> ${d.nome.toUpperCase()}</div><div class="line"><span class="bold">Nome do RESPONSÁVEL:</span> ${(d.resp_nome || '').toUpperCase()} <span style="margin-left:5px; font-weight:normal;">${relacao}</span></div><div class="line"><span class="bold">Funerária:</span> ${d.funeraria.toUpperCase()} <span style="margin-left:15px">(Rep: ${d.func_funeraria || 'N/A'})</span></div><div class="line"><span class="bold">Atendente Responsável:</span> ${(d.atendente_sistema||'SISTEMA').toUpperCase()}<span class="bold" style="margin-left:20px">DATA DE HORARIO DE ATENDIMENTO:</span> ${dataHoraAtendimentoTexto}</div><div class="line"><span class="bold">Data:</span> ${fd(d.data_ficha)} <span class="bold spacer">Hora:</span> ${d.hora} <span class="bold spacer">SEPULTURA:</span> ${d.sepul} <span class="bold spacer">${(d.local && d.local.includes("MARUÍ")) ? "QUADRA:" : "RUA:"}</span> ${d.qd} <span class="bold spacer">CAPELA:</span> ${d.cap}</div><div class="line"><span class="bold">COM CAPELA</span> ${chk(cc)} <span class="bold">SEM CAPELA</span> ${chk(!cc)} <span class="bold spacer">DATA DO FALECIMENTO:</span> ${fd(d.data_obito)} AS ${txtHoraObito} <span class="red spacer">[${tempoDecorrido}]</span></div><div class="line"><span class="bold">Cemitério:</span> (${im?'X':' '}) MARUÍ (${is?'X':' '}) SÃO FRANCISCO XAVIER (${ii?'X':' '}) SÃO LÁZARO DE ITAIPÚ</div><div class="line">${chkEC('SOLTEIRO')} SOLTEIRO ${chkEC('CASADO')} CASADO ${chkEC('VIUVO')} VÍUVO ${chkEC('UNIAO_ESTAVEL')} UNIÃO ESTÁVEL ${chkEC('DIVORCIADO')} DIVORCIADO ${chkEC('IGNORADO')} IGNORADO</div><div class="section-title">ASSINAR TERMO DE COMPROMISSO NO CEMITÉRIO</div><div class="line" style="margin-top:5px; font-size:14px; border: 1px solid #000; padding: 5px;"><span class="bold">TIPO DE SEPULTURA SELECIONADA:</span> ${txtSep}</div><div class="line" style="margin-top:10px"><span class="bold">TANATO:</span> (${d.tanato==='SIM'?'X':' '}) SIM (${d.tanato==='NAO'?'X':' '}) NÃO</div><div class="assinaturas-block"><div class="ass-line">Acolhimento / Atendente:<br><b>${(d.atendente_sistema||'').toUpperCase()}</b></div><div class="ass-line">Assinatura do responsável/família<br><b>${(d.resp_nome||'').toUpperCase()}</b></div></div><div class="obs-box">OBS: PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.</div><div class="obs-box">OBS.: VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.</div><div class="line" style="margin-top: 15px; border: 2px solid #000; padding: 5px;"><span class="bold">PREVISÃO DE EXUMAÇÃO:</span> A partir de <span class="red" style="font-size:16px;">${dataExumacao}</span><br><span style="font-size:10px;">(Legislação: 3 anos para Adultos / 2 anos para Crianças até 11 anos)</span><div style="margin-top: 25px; border-top: 1px solid #000; width: 50%; text-align: center;">Assinatura do Responsável (Ciência do Prazo)</div></div><div class="two-columns"><div class="col-left"><div style="text-align:center; font-weight:bold; text-decoration:underline; margin-bottom:5px;">TERMO DE COMPROMISSO CEMITÉRIOS MUNICIPAIS</div><div class="termo-juridico">Sendo o <span class="bold">FALECIDO CASADO</span>, o responsável perante, o Cemitério do MARUÍ, SÃO FRANCISCO E ITAIPU será obrigatoriamente o <span class="bold">CONJUGE</span>.<br>Sendo o <span class="bold">FALECIDO VIÚVO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU serão obrigatoriamente os <span class="bold">FILHOS</span>.<br>Sendo o <span class="bold">FALECIDO SOLTEIRO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU obrigatoriamente os <span class="bold">FILHOS, PAIS, IRMÃOS</span>.<br>Será exigida a apresentação de documentos de <span class="bold" style="text-decoration:underline">IDENTIDADE e CPF</span>.</div><div class="assinaturas-block" style="margin-top: 40px;"><div style="flex:1;"></div><div class="ass-line">Assinatura funcionário/família</div></div></div><div class="col-right"><div class="box-lateral"><div>CAPELAS MUNICIPAIS E PARTICULARES:</div><br><div>PAGAMENTO E NOTA FISCAL DAS TAXAS MUNICIPAIS E INVOL COM DUAS HORAS ANTES DO SEPULTAMENTO</div><br><br><div>CLIENTE: _____________________</div></div></div></div><div class="footer-line">MARCADO: ________________________ PERMISSIONÁRIO: ${(d.resp_nome || '').toUpperCase()}</div><div style="font-weight:bold; font-size:12px; margin-top:5px;">TEL: ${d.telefone||''}</div><div class="aviso-final"><span style="text-decoration:underline">COMUNICADO AOS FAMILIARES DO FALECIDO E AS EMPRESAS FUNERÁRIAS RESPONSÁVEIS PELO SEPULTAMENTO.</span><br>Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos:<span class="bold">GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL PELO SERVIÇO), TAXAS MUNICIPAIS PAGAS e INVOL.</span></div></div></body><script>window.onload=function(){window.print()}</script></html>`;
    
    const w = window.open('','_blank'); w.document.write(htmlComprovante); w.document.close();
}