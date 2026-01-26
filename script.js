// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyB6pkQZNuLiYidKqstJdMXRl2OYW4JWmfs",
  authDomain: "funeraria-niteroi.firebaseapp.com",
  projectId: "funeraria-niteroi",
  storageBucket: "funeraria-niteroi.firebasestorage.app",
  messagingSenderId: "232673521828",
  appId: "1:232673521828:web:f25a77f27ba1924cb77631"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// VARIÁVEIS GLOBAIS
let unsubscribe = null;
let statsUnsubscribe = null;
let equipeUnsubscribe = null;
let logsUnsubscribe = null;
let sepulturaOriginal = ""; 
let dadosAtendimentoAtual = null;
let dadosEstatisticasExportacao = [];
let chartInstances = {};
let usuarioLogado = null; 

const dimensoesUrna = {
    'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70',
    'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80',
    'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85',
    '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95',
    'PERPETUA': ''
};

function gerarProtocolo() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const min = String(agora.getMinutes()).padStart(2, '0');
    return `${ano}${mes}${dia}-${hora}${min}`;
}

window.fazerLogin = function() {
    const userIn = document.getElementById('login-usuario').value.trim();
    const passIn = document.getElementById('login-senha').value.trim();
    const erro = document.getElementById('msg-erro-login');

    if (passIn === "2026") {
        usuarioLogado = { nome: "Administrador (Master)", login: "admin" };
        liberarAcesso();
        return;
    }

    db.collection("equipe")
        .where("login", "==", userIn)
        .where("senha", "==", passIn)
        .get()
        .then((querySnapshot) => {
            if (!querySnapshot.empty) {
                const doc = querySnapshot.docs[0];
                usuarioLogado = doc.data();
                liberarAcesso();
            } else {
                erro.style.display = 'block';
                erro.innerText = "Usuário ou senha incorretos.";
            }
        })
        .catch((e) => {
            console.error("Erro login:", e);
            erro.style.display = 'block';
            erro.innerText = "Erro de conexão.";
        });
}

function liberarAcesso() {
    document.getElementById('tela-bloqueio').style.display = 'none';
    document.getElementById('msg-erro-login').style.display = 'none';
    document.getElementById('user-display').innerText = `Olá, ${usuarioLogado.nome.split(' ')[0]}`;
    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
    const hj = new Date().toISOString().split('T')[0];
    const il = document.getElementById('filtro-local');
    if(il) atualizarListener(hj, il.value);
}

window.fazerLogout = function() {
    sessionStorage.removeItem('usuarioLogado');
    window.location.reload();
}

window.checarLoginEnter = function(e) { if(e.key==='Enter') window.fazerLogin(); }
window.bloquearTela = function() { document.getElementById('tela-bloqueio').style.display = 'flex'; }
window.abrirAdmin = function() { document.getElementById('modal-admin').style.display = 'block'; abrirAba('tab-equipe'); }
window.fecharModalAdmin = function() { document.getElementById('modal-admin').style.display = 'none'; if(equipeUnsubscribe) equipeUnsubscribe(); if(statsUnsubscribe) statsUnsubscribe(); if(logsUnsubscribe) logsUnsubscribe(); }

window.abrirAba = function(tabId) {
    const panes = document.getElementsByClassName('tab-pane'); for(let p of panes) p.classList.remove('active');
    const btns = document.getElementsByClassName('tab-btn'); for(let b of btns) b.classList.remove('active');
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'tab-equipe') { btns[0].classList.add('active'); listarEquipe(); }
    if(tabId === 'tab-stats') { btns[1].classList.add('active'); carregarEstatisticas(7); }
    if(tabId === 'tab-logs') { btns[2].classList.add('active'); carregarLogs(); }
}

window.listarEquipe = function() {
    const lista = document.getElementById('lista-equipe');
    lista.innerHTML = 'Carregando...';
    equipeUnsubscribe = db.collection("equipe").orderBy("nome").onSnapshot((snapshot) => {
        lista.innerHTML = '';
        snapshot.forEach((doc) => {
            const user = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `<div><strong>${user.nome}</strong><br><span style="font-size:10px; color:#777;">Login: ${user.login || '-'}</span></div><button class="btn-remove-user" onclick="excluirFuncionario('${doc.id}')">🗑️</button>`;
            lista.appendChild(li);
        });
    });
}

window.adicionarFuncionario = function() {
    const nome = document.getElementById('novo-nome').value.trim().toUpperCase();
    const login = document.getElementById('novo-login').value.trim();
    const senha = document.getElementById('nova-senha').value.trim();
    if(nome && login && senha) {
        db.collection("equipe").add({ nome: nome, login: login, senha: senha }).then(() => { 
            document.getElementById('novo-nome').value = ''; document.getElementById('novo-login').value = ''; document.getElementById('nova-senha').value = ''; alert("Usuário cadastrado!");
        }).catch((e) => alert("Erro: " + e));
    } else { alert("Preencha todos os campos."); }
}

window.excluirFuncionario = function(id) { if(confirm("Remover?")) db.collection("equipe").doc(id).delete(); }

window.baixarRelatorioCompleto = function() {
    if(!confirm("Baixar relatório?")) return;
    db.collection("atendimentos").get().then((querySnapshot) => {
        let dados = [];
        querySnapshot.forEach((doc) => {
            let d = doc.data();
            let dataExibicao = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-';
            let ano = "", mes = "";
            if (d.data_ficha) { let partes = d.data_ficha.split('-'); ano = partes[0]; mes = partes[1]; }
            dados.push([dataExibicao, d.hora || "", mes, ano, (d.nome || "").toUpperCase(), (d.causa || "").toUpperCase(), (d.resp_nome || "").toUpperCase(), d.telefone || "", (d.funeraria || "").toUpperCase(), (d.local || "").toUpperCase(), d.sepul || "", d.protocolo || "", (d.atendente_sistema || "").toUpperCase()]);
        });
        dados.sort((a,b) => { if (a[3] < b[3]) return 1; if (a[3] > b[3]) return -1; if (a[2] < b[2]) return 1; if (a[2] > b[2]) return -1; return 0; });
        const headers = ["Data", "Hora", "Mês", "Ano", "Falecido", "Causa Morte", "Responsável", "Telefone", "Funerária", "Local", "Sepultura", "Protocolo", "Atendente"];
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dados]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório Geral");
        XLSX.writeFile(workbook, "Relatorio_Completo_Atendimentos.xlsx");
    }).catch((e) => alert("Erro: " + e));
}

window.baixarExcel = function() {
    if (dadosEstatisticasExportacao.length === 0) { alert("Sem dados."); return; }
    const cabecalho = ["Causa da Morte", "Quantidade", "Porcentagem"];
    const linhas = dadosEstatisticasExportacao.map(item => [item["Causa da Morte"], item["Quantidade"], item["Porcentagem"]]);
    const worksheet = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estatísticas");
    XLSX.writeFile(workbook, "Relatorio_Causas_Morte.xlsx");
}

window.carregarLogs = function() {
    const tbody = document.getElementById('tabela-logs');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Carregando...</td></tr>';
    logsUnsubscribe = db.collection("atendimentos").limit(50).get().then((snapshot) => {
        let logs = [];
        snapshot.forEach(doc => { logs.push(doc.data()); });
        logs.sort((a,b) => (a.data_ficha < b.data_ficha ? 1 : -1));
        tbody.innerHTML = '';
        if(logs.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum registro.</td></tr>'; return; }
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td style="font-weight:bold;">${log.data_ficha?log.data_ficha.split('-').reverse().join('/'):'-'}</td><td>${log.nome}</td><td style="color:${log.atendente_sistema ? '#333' : '#ccc'}">${log.atendente_sistema || 'N/A'}</td>`;
            tbody.appendChild(tr);
        });
    });
}

window.abrirModal = function() {
    const f = document.getElementById('form-atendimento'); f.reset();
    document.getElementById('docId').value = '';
    document.getElementById('do_24h').value = "NAO"; 
    document.getElementById('hora').value = ""; 
    document.getElementById('chk_tanato').checked = false;
    document.getElementById('chk_invol').checked = false;
    document.getElementById('chk_translado').checked = false;
    document.getElementById('chk_urna_opc').checked = false;
    document.getElementById('div-local-domicilio').classList.add('hidden');
    document.getElementById('div-motivo-sepultura').classList.add('hidden');
    document.getElementById('estado_obito').value = "";
    document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>';
    document.getElementById('cidade_obito').disabled = true;
    if(usuarioLogado) { document.getElementById('atendente_sistema').value = usuarioLogado.nome; }
    sepulturaOriginal = ""; 
    document.getElementById('modal').style.display = 'block';
}

window.fecharModal = function() { document.getElementById('modal').style.display = 'none'; }
window.fecharModalVisualizar = function() { document.getElementById('modal-visualizar').style.display = 'none'; }
window.abrirModalEstatisticas = function() { document.getElementById('modal-estatisticas').style.display = 'block'; carregarEstatisticas(7); }
window.fecharModalEstatisticas = function() { document.getElementById('modal-estatisticas').style.display = 'none'; }

document.addEventListener('DOMContentLoaded', () => {
    const sessao = sessionStorage.getItem('usuarioLogado');
    if (sessao) {
        usuarioLogado = JSON.parse(sessao);
        document.getElementById('tela-bloqueio').style.display = 'none';
        document.getElementById('user-display').innerText = `Olá, ${usuarioLogado.nome.split(' ')[0]}`;
    }
    if (localStorage.getItem('designMode') === 'classico') { document.body.classList.add('design-classico'); }
    const selectHora = document.getElementById('hora');
    if(selectHora) {
        selectHora.innerHTML = '<option value="">--:--</option>';
        for (let h = 0; h < 24; h++) { for (let m = 0; m < 60; m += 30) { const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; const opt = document.createElement('option'); opt.value = val; opt.text = val; selectHora.appendChild(opt); } }
    }
    const hj = new Date().toISOString().split('T')[0];
    const inputData = document.getElementById('filtro-data'); const inputLocal = document.getElementById('filtro-local');
    if(inputData && inputLocal) {
        inputData.value = hj; atualizarListener(hj, inputLocal.value);
        inputData.addEventListener('change', (e) => atualizarListener(e.target.value, inputLocal.value));
        inputLocal.addEventListener('change', (e) => atualizarListener(inputData.value, e.target.value));
    }
    const inputBusca = document.getElementById('input-busca');
    if(inputBusca) inputBusca.addEventListener('keypress', function (e) { if (e.key === 'Enter') window.realizarBusca(); });

    const seletorCausas = document.getElementById('seletor_causas');
    if (seletorCausas) {
        seletorCausas.addEventListener('change', function() {
            const inputCausa = document.getElementById("causa");
            if (this.value) {
                const val = this.value.toUpperCase();
                const doencasContagiosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HEPATITE', 'HIV', 'SIDA', 'INFLUENZA', 'SARAMPO', 'FEBRE AMARELA', 'LEPTOSPIROSE', 'SEPCEMIA'];
                const ehContagioso = doencasContagiosas.some(doenca => val.includes(doenca));
                if(ehContagioso) alert("⚠️ ATENÇÃO: DOENÇA INFECTOCONTAGIOSA!");
                inputCausa.value = inputCausa.value ? inputCausa.value + " / " + this.value : this.value;
                this.value = "";
            }
        });
    }
    
    const inputHospital = document.getElementById('hospital');
    const divDomicilio = document.getElementById('div-local-domicilio');
    if(inputHospital) {
        inputHospital.addEventListener('input', function() {
            const val = this.value.toUpperCase();
            if (val.includes('DOMICÍLIO') || val.includes('DOMICILIO')) { divDomicilio.classList.remove('hidden'); } else { divDomicilio.classList.add('hidden'); document.getElementById('estado_obito').value = ""; document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>'; document.getElementById('cidade_obito').disabled = true; }
        });
    }
    document.getElementById('estado_obito').addEventListener('change', function() { carregarCidades(this.value); });
    const inputSepul = document.getElementById('sepul'); const divMotivo = document.getElementById('div-motivo-sepultura');
    if(inputSepul) inputSepul.addEventListener('input', function() { if (sepulturaOriginal && this.value !== sepulturaOriginal) { divMotivo.classList.remove('hidden'); } else { divMotivo.classList.add('hidden'); document.getElementById('motivo_troca_sepultura').value = ""; } });
});

window.realizarBusca = function() {
    const input = document.getElementById('input-busca'); const termo = input.value.trim().toUpperCase();
    if (!termo) { alert("Digite um nome ou protocolo."); return; }
    if (unsubscribe) unsubscribe();
    const tbody = document.getElementById('tabela-corpo'); tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Buscando...</td></tr>';
    if (termo.match(/[0-9]/)) {
        db.collection("atendimentos").where("protocolo", "==", termo).get().then((snapshot) => {
            if (!snapshot.empty) { let lista = []; snapshot.forEach((doc) => { let d = doc.data(); d.id = doc.id; lista.push(d); }); renderizarTabela(lista); } else { buscarPorNome(termo); }
        });
    } else { buscarPorNome(termo); }
}

function buscarPorNome(termo) {
    db.collection("atendimentos").orderBy("nome").startAt(termo).endAt(termo + "\uf8ff").limit(50).get().then((querySnapshot) => {
        let lista = []; querySnapshot.forEach((doc) => { let d = doc.data(); d.id = doc.id; lista.push(d); });
        if (lista.length === 0) { document.getElementById('tabela-corpo').innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 20px;">Nenhum registro encontrado.</td></tr>`; } else { renderizarTabela(lista); }
    }).catch((e) => { console.error(e); document.getElementById('tabela-corpo').innerHTML = '<tr><td colspan="11" style="text-align:center;">Erro na busca.</td></tr>'; });
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = ''; 
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="11" style="padding: 40px; text-align:center; color:#b5b5c3;">Nenhum atendimento registrado.</td></tr>'; return; }
    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => window.visualizar(item.id);
        const doencasContagiosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HEPATITE', 'HIV', 'SIDA', 'INFLUENZA', 'SARAMPO', 'FEBRE AMARELA', 'LEPTOSPIROSE', 'SEPCEMIA'];
        let isContagioso = false;
        if(item.causa) { const causaUpper = item.causa.toUpperCase(); isContagioso = doencasContagiosas.some(doenca => causaUpper.includes(doenca)); }
        if (isContagioso) tr.classList.add('alerta-doenca');
        const iconAlert = isContagioso ? '<span class="icone-alerta" title="Doença Contagiosa">⚠️</span>' : '';
        let btnMap = '';
        if (item.geo_coords && item.geo_coords.includes(',')) btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('https://www.google.com/maps/search/?api=1&query=${item.geo_coords}', '_blank')" title="Ver Localização">📍</button>`;
        let displayResponsavel = "";
        if (item.isencao === "50") { displayResponsavel += `ACOLHIMENTO <span style="font-weight:900;">50% DE ISENÇÃO</span>`; if(item.requisito) displayResponsavel += `<br>REQ: ${item.requisito.toUpperCase()}`; displayResponsavel += `<br>`; } 
        else if (item.isencao === "SIM") { displayResponsavel += `ACOLHIMENTO <span style="font-weight:900;">100% DE ISENÇÃO</span>`; if(item.requisito) displayResponsavel += `<br>REQ: ${item.requisito.toUpperCase()}`; displayResponsavel += `<br>`; } 
        else { if (item.funeraria) displayResponsavel += `${item.funeraria.toUpperCase()}<br>`; else if (item.resp_nome) displayResponsavel += `${item.resp_nome.toUpperCase()}<br>`; else displayResponsavel += 'S/D<br>'; }
        if (item.tipo_urna_detalhe) displayResponsavel += `<span style="font-weight:bold;">${item.tipo_urna_detalhe.toUpperCase()}</span><br>`;
        if (item.combo_urna && dimensoesUrna[item.combo_urna]) displayResponsavel += `URNA ${item.combo_urna}<br>${dimensoesUrna[item.combo_urna]}<br>`; else if (item.combo_urna) displayResponsavel += `URNA ${item.combo_urna}<br>`;
        let servicosExtras = [];
        if (item.tanato === 'SIM') servicosExtras.push('TANATOPRAXIA');
        if (item.invol === 'SIM') servicosExtras.push('INVOL');
        if (item.translado === 'SIM') servicosExtras.push('TRANSLADO');
        if (item.urna_opc === 'SIM') servicosExtras.push('URNA');
        if (servicosExtras.length > 0) displayResponsavel += `<div style="margin-top:2px; font-weight:bold; font-size:10px;">SERVIÇOS: ${servicosExtras.join(', ')}</div>`;
        const conteudoNome = `<div style="font-weight:700; font-size:12px;">${iconAlert}${item.nome ? item.nome.toUpperCase() : 'NOME NÃO INFORMADO'}</div><div class="texto-vermelho" style="font-size:11px; margin-top:2px;">(${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})</div>${item.classificacao_obito === 'ANJO' ? '<span style="font-size:10px; color:blue;">(ANJO)</span>' : ''}`;
        let displayFalecimento = '';
        if (item.data_obito && item.data_ficha) { const partes = item.data_obito.split('-'); const dataFormatada = `${partes[2]}/${partes[1]}`; let textoTempo = ""; if (item.hora_obito && item.hora) { const inicio = new Date(`${item.data_obito}T${item.hora_obito}`); const fim = new Date(`${item.data_ficha}T${item.hora}`); if (!isNaN(inicio) && !isNaN(fim)) { const diffMs = fim - inicio; const diffHrs = Math.floor(diffMs / 3600000); const diffMins = Math.round(((diffMs % 3600000) / 60000)); textoTempo = `<br><span style="font-weight:bold; font-size:10px;">INTERVALO: ${diffHrs}H ${diffMins}M</span>`; } } displayFalecimento = `<div style="line-height:1.3;"><span class="texto-vermelho">DIA:</span> ${dataFormatada}<br><span class="texto-vermelho">AS:</span> ${item.hora_obito || '--:--'}${textoTempo}</div>`; } else if (item.falecimento) displayFalecimento = `<div>${item.falecimento}</div>`;
        tr.innerHTML = `<td>${displayResponsavel}</td><td style="text-align: center;">${item.hora || ''}</td><td style="text-align: center; vertical-align: middle;">${conteudoNome}</td><td style="text-align: center;">${item.gav || ''}</td><td style="text-align: center;">${item.car || ''}</td><td style="text-align: center;">${item.sepul || ''}</td><td style="text-align: center;">${item.qd || ''}</td><td style="text-align: center;">${item.hospital || ''}</td><td style="text-align: center;">${item.cap || ''}</td><td style="text-align: center;">${displayFalecimento}</td><td style="text-align: right;"><div class="t-acoes">${btnMap}<button class="btn-icon btn-editar-circle" onclick="event.stopPropagation(); window.editar('${item.id}')">✏️</button><button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation(); window.excluir('${item.id}')">🗑️</button></div></td>`;
        tbody.appendChild(tr);
    });
}

function atualizarListener(dataSelecionada, localSelecionado) {
    if (unsubscribe) unsubscribe();
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Carregando dados...</td></tr>';
    unsubscribe = db.collection("atendimentos").where("data_ficha", "==", dataSelecionada).onSnapshot((snapshot) => {
        let listaAtendimentos = [];
        snapshot.forEach(doc => {
            let dado = doc.data(); dado.id = doc.id;
            const localDoRegistro = dado.local || "CEMITÉRIO DO MARUÍ";
            if (localDoRegistro === localSelecionado) listaAtendimentos.push(dado);
        });
        listaAtendimentos.sort((a, b) => { if (a.hora < b.hora) return -1; if (a.hora > b.hora) return 1; return 0; });
        renderizarTabela(listaAtendimentos);
    }, (error) => { console.error("Erro ao ler dados:", error); tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>'; });
}

window.visualizar = function(id) {
    if(!document.getElementById('modal-visualizar')) return;
    document.body.style.cursor = 'wait';
    db.collection("atendimentos").doc(id).get().then((doc) => {
        document.body.style.cursor = 'default';
        if (doc.exists) {
            const item = doc.data(); dadosAtendimentoAtual = item;
            const setText = (k, v) => { const el = document.getElementById(k); if(el) el.innerText = v || '-'; };
            setText('view_protocolo', item.protocolo || '-');
            setText('view_hora', item.hora);
            let respTexto = item.resp_nome || '-'; if (item.parentesco) respTexto += ` (${item.parentesco})`; setText('view_resp_completo', respTexto);
            setText('view_funeraria', item.funeraria);
            setText('view_atendente', item.atendente_sistema || '-');
            setText('view_telefone', item.telefone);
            let textoIsencao = "NÃO (Pago)"; if (item.isencao === "SIM") textoIsencao = "SIM (100% Isenção)"; if (item.isencao === "50") textoIsencao = "SIM (50% Isenção)"; if (item.requisito) textoIsencao += ` - ${item.requisito}`; setText('view_isencao_completa', textoIsencao);
            let infoUrna = item.urna_info || '-'; if(item.motivo_troca_sepultura) infoUrna += `\n[TROCA SEPULTURA: ${item.motivo_troca_sepultura}]`; setText('view_urna_info', infoUrna);
            setText('view_combo_urna', item.combo_urna); setText('view_tipo_urna_detalhe', item.tipo_urna_detalhe);
            let servicosView = []; if (item.tanato === 'SIM') servicosView.push('Tanatopraxia'); if (item.invol === 'SIM') servicosView.push('Invol'); if (item.translado === 'SIM') servicosView.push('Translado'); if (item.urna_opc === 'SIM') servicosView.push('Urna'); setText('view_servicos_adicionais', servicosView.length > 0 ? servicosView.join(', ') : '-');
            let nomeView = item.nome || '-'; if (item.classificacao_obito === "ANJO") nomeView += " (ANJO)"; setText('view_nome', nomeView); setText('view_causa', item.causa);
            const elDo24h = document.getElementById('view_do_24h'); if(elDo24h) { if (item.do_24h === 'SIM') elDo24h.innerText = "[LIBERAÇÃO < 24H]"; else elDo24h.innerText = ""; }
            let tipo = ''; if (item.gav && item.gav.includes('X')) tipo = 'GAVETA'; else if (item.car && item.car.includes('X')) tipo = 'CARNEIRO'; else if (item.cova_rasa === 'X') tipo = 'COVA RASA'; else if (item.perpetua === 'X') tipo = 'PERPÉTUA'; setText('view_local_sepul', `Tipo: ${tipo} | Nº: ${item.sepul||'-'} | QD: ${item.qd||'-'}`);
            setText('view_hospital_completo', item.hospital); setText('view_cap', item.cap);
            let dataFormatada = item.data_obito; if (dataFormatada && dataFormatada.includes('-')) { const p = dataFormatada.split('-'); dataFormatada = `${p[2]}/${p[1]}/${p[0]}`; } setText('view_data_obito', dataFormatada); setText('view_hora_obito', item.hora_obito);
            const mapContainer = document.getElementById('view_map_container'); const mapFrame = document.getElementById('mapa-frame'); const mapLink = document.getElementById('link-gps');
            if (item.geo_coords && item.geo_coords.includes(',')) { mapContainer.style.display = 'block'; mapFrame.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=${item.geo_coords}&z=17&output=embed"></iframe>`; mapLink.href = `https://www.google.com/maps/search/?api=1&query=${item.geo_coords}`; } else { mapContainer.style.display = 'none'; mapFrame.innerHTML = ''; }
            document.getElementById('modal-visualizar').style.display = 'block';
        } else { alert("Atendimento não encontrado."); }
    }).catch((error) => { document.body.style.cursor = 'default'; alert("Erro: " + error.message); });
}

window.editar = function(id) {
    db.collection("atendimentos").doc(id).get().then((doc) => {
        if (doc.exists) {
            const item = doc.data(); document.getElementById('docId').value = doc.id;
            document.getElementById('protocolo_hidden').value = item.protocolo || "";
            const selectHora = document.getElementById('hora'); const horaSalva = item.hora; let optionExists = false; for(let i=0; i<selectHora.options.length; i++){ if(selectHora.options[i].value == horaSalva) optionExists = true; } if(!optionExists && horaSalva) { const opt = document.createElement('option'); opt.value = horaSalva; opt.text = horaSalva; selectHora.add(opt); } selectHora.value = horaSalva || "";
            const setVal = (k, v) => { const el=document.getElementById(k); if(el) el.value=v||''; };
            setVal('nome', item.nome); setVal('causa', item.causa); setVal('resp_nome', item.resp_nome); setVal('telefone', item.telefone); setVal('parentesco', item.parentesco);
            setVal('atendente_sistema', item.atendente_sistema); setVal('classificacao_obito', item.classificacao_obito || 'ADULTO'); setVal('do_24h', item.do_24h || 'NAO'); 
            setVal('urna_info', item.urna_info); setVal('combo_urna', item.combo_urna); setVal('tipo_urna_detalhe', item.tipo_urna_detalhe);
            setVal('funeraria', item.funeraria); setVal('isencao', item.isencao || 'NAO'); setVal('requisito', item.requisito);
            setVal('data_obito', item.data_obito); setVal('hora_obito', item.hora_obito); setVal('geo_coords', item.geo_coords);
            document.getElementById('chk_tanato').checked = (item.tanato === 'SIM'); document.getElementById('chk_invol').checked = (item.invol === 'SIM');
            document.getElementById('chk_translado').checked = (item.translado === 'SIM'); document.getElementById('chk_urna_opc').checked = (item.urna_opc === 'SIM');
            const selectTipo = document.getElementById('tipo_sepultura');
            if (item.gav && item.gav.includes('X')) selectTipo.value = 'GAVETA'; else if (item.car && item.car.includes('X')) selectTipo.value = 'CARNEIRO'; else if (item.cova_rasa === 'X') selectTipo.value = 'COVA RASA'; else if (item.perpetua === 'X') selectTipo.value = 'PERPETUA'; else selectTipo.value = '';
            sepulturaOriginal = item.sepul; setVal('sepul', item.sepul); setVal('motivo_troca_sepultura', item.motivo_troca_sepultura);
            setVal('qd', item.qd); setVal('hospital', item.hospital); setVal('estado_obito', item.estado_obito);
            if (item.estado_obito) { carregarCidades(item.estado_obito, item.cidade_obito); } else { document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>'; document.getElementById('cidade_obito').disabled = true; }
            document.getElementById('hospital').dispatchEvent(new Event('input')); document.getElementById('sepul').dispatchEvent(new Event('input')); setVal('cap', item.cap);
            document.getElementById('modal').style.display = 'block';
        }
    });
}

window.carregarEstatisticas = function(dias) {
    const loading = document.getElementById('loading-stats'); const divLista = document.getElementById('lista-estatisticas');
    if(divLista) divLista.innerHTML = ''; if(loading) loading.style.display = 'block'; if (statsUnsubscribe) statsUnsubscribe();
    const di = new Date(); di.setDate(di.getDate() - dias); const dis = di.toISOString().split('T')[0];
    statsUnsubscribe = db.collection("atendimentos").where("data_ficha", ">=", dis).onSnapshot((snapshot) => {
        if(loading) loading.style.display = 'none'; let cc = {}; let ca = {}; let tm = 0;
        snapshot.forEach(doc => {
            const d = doc.data();
            if (d.causa) { d.causa.split(/[\/+,]/).forEach(p => { const c = p.trim().toUpperCase(); if(c) cc[c] = (cc[c] || 0) + 1; }); }
            const at = d.atendente_sistema || "N/A"; ca[at] = (ca[at] || 0) + 1; tm++;
        });
        const r = Object.entries(cc).sort((a, b) => b[1] - a[1]); const ra = Object.entries(ca).sort((a, b) => b[1] - a[1]);
        atualizarGrafico('grafico-causas', 'bar', r.map(x=>x[0]), r.map(x=>x[1]), 'Ocorrências');
        atualizarGrafico('grafico-causas-modal', 'bar', r.map(x=>x[0]), r.map(x=>x[1]), 'Ocorrências');
        atualizarGrafico('grafico-atendentes', 'pie', ra.map(x=>x[0]), ra.map(x=>x[1]), 'Atendimentos');
        atualizarGrafico('grafico-atendentes-modal', 'pie', ra.map(x=>x[0]), ra.map(x=>x[1]), 'Atendimentos');
        dadosEstatisticasExportacao = r.map(([c,q]) => ({"Causa da Morte": c, "Quantidade": q, "Porcentagem": ((q/tm)*100).toFixed(2)+'%' }));
        if(divLista) {
             if(tm === 0) divLista.innerHTML = '<p style="text-align:center;">Nenhum dado no período.</p>';
             else { let html = `<div style="margin-bottom:10px;">Total: ${tm} registros</div><table class="table-stats"><thead><tr><th>Causa</th><th>Qtd</th></tr></thead><tbody>`; r.forEach(([c,q]) => { html += `<tr><td>${c}</td><td>${q}</td></tr>`; }); html += '</tbody></table>'; divLista.innerHTML = html; }
        }
    }, (error) => { console.error("Erro stats:", error); if(loading) loading.innerText = "Erro ao carregar."; });
}

function atualizarGrafico(canvasId, tipo, labels, data, labelData) {
    const canvas = document.getElementById(canvasId); if (!canvas) return; const ctx = canvas.getContext('2d');
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    chartInstances[canvasId] = new Chart(ctx, { type: tipo, data: { labels: labels.slice(0, 10), datasets: [{ label: labelData, data: data.slice(0, 10), backgroundColor: ['#3699ff', '#1bc5bd', '#f64e60', '#ffa800', '#8950fc', '#ccc'] }] }, options: { responsive: true, maintainAspectRatio: false } });
}

window.baixarPDF = function() { if (dadosEstatisticasExportacao.length === 0) { alert("Sem dados."); return; } const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text("Relatório de Causas de Morte", 14, 15); const tableColumn = ["Causa da Morte", "Quantidade", "Porcentagem"]; const tableRows = dadosEstatisticasExportacao.map(item => [item["Causa da Morte"], item["Quantidade"], item["Porcentagem"]]); doc.autoTable({ head: [tableColumn], body: tableRows, startY: 20 }); doc.save("Relatorio_Causas_Morte.pdf"); }
window.gerarEtiqueta = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '';
    const h = `
    <html><head><title>Etiqueta</title><style>@page{size:landscape;margin:0}body{font-family:Arial,sans-serif;margin:0;padding:0;height:100vh;width:100vw;display:flex;justify-content:center;align-items:center;overflow:hidden}.box{width:95vw;height:90vh;border:5px solid #000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center;padding:10px}.header-img{max-height:80px;margin-bottom:5px}.title{font-size:24px;font-weight:900;text-transform:uppercase;margin-bottom:5px;border-bottom:3px solid #000;display:inline-block;padding-bottom:5px}.label{font-size:20px;color:#333;font-weight:bold;text-transform:uppercase;margin-bottom:2px}.val-nome{font-size:60px;font-weight:900;text-transform:uppercase;line-height:1.1;margin-bottom:15px}.val-data{font-size:35px;font-weight:800;margin-bottom:15px}.val-local{font-size:30px;font-weight:800;text-transform:uppercase}</style></head><body><div class="box"><div><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="header-img"><br><div class="title">Identificação de Velório</div></div><div style="width:100%"><div class="label">Falecido(a)</div><div class="val-nome">${d.nome}</div></div><div><div class="label">Sepultamento</div><div class="val-data">${dataF} às ${d.hora}</div></div><div><div class="label">Local</div><div class="val-local">${d.cap}<br>${d.local||"CEMITÉRIO DO MARUÍ"}</div></div></div><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`;
    const w = window.open('','_blank'); if(w) { w.document.write(h); w.document.close(); } else { alert("Desbloqueie os pop-ups."); }
}

window.enviarWhatsapp = function() {
    if (!dadosAtendimentoAtual) return; const tel = dadosAtendimentoAtual.telefone ? dadosAtendimentoAtual.telefone.replace(/\D/g, '') : ''; const coords = dadosAtendimentoAtual.geo_coords;
    if (!tel) { alert("Sem telefone cadastrado."); return; } if (!coords) { alert("Sem GPS cadastrado."); return; }
    const msg = `Localização sepultura *${dadosAtendimentoAtual.nome}*: https://www.google.com/maps/search/?api=1&query=${coords}`; window.open(`https://api.whatsapp.com/send?phone=55${tel}&text=${encodeURIComponent(msg)}`, '_blank');
}

window.enviarSMS = function() {
    if (!dadosAtendimentoAtual) return; const tel = dadosAtendimentoAtual.telefone ? dadosAtendimentoAtual.telefone.replace(/\D/g, '') : ''; const coords = dadosAtendimentoAtual.geo_coords;
    if (!tel) { alert("Sem telefone cadastrado."); return; } const msg = `Localização sepultura: https://www.google.com/maps/search/?api=1&query=${coords}`; window.location.href = `sms:${tel}?body=${encodeURIComponent(msg)}`;
}

window.gerarComprovante = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const chk = (cond) => cond ? '(X)' : '( )';
    const fmtData = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
    const dataHoje = new Date(); const dataAtualFmt = `${dataHoje.getDate().toString().padStart(2,'0')}/${(dataHoje.getMonth()+1).toString().padStart(2,'0')}/${dataHoje.getFullYear()}`; const horaAtualFmt = `${dataHoje.getHours().toString().padStart(2,'0')}:${dataHoje.getMinutes().toString().padStart(2,'0')}`;
    const protocolo = d.protocolo || "S/N"; const isMarui = (d.local && d.local.includes("MARUÍ")); const isSaoFrancisco = (d.local && d.local.includes("SÃO FRANCISCO")); const isItaipu = (d.local && d.local.includes("ITAIPU")); const comCapela = (d.cap && !d.cap.toUpperCase().includes("SEM"));
    const htmlComprovante = `<html><head><title>Comprovante</title><style>@page{size:A4 portrait;margin:15mm}body{font-family:Arial,sans-serif;font-size:11px;margin:0;padding:10px;line-height:1.4}.header{text-align:center;margin-bottom:20px}.header h2{font-size:14px;text-decoration:underline;margin:0;font-weight:bold;text-transform:uppercase}.protocolo{position:absolute;top:10px;right:10px;font-size:12px;font-weight:bold;border:1px solid #000;padding:5px}.content{width:100%}.line{margin-bottom:8px}.bold{font-weight:bold}.section-title{font-weight:bold;margin-top:15px;margin-bottom:5px;text-transform:uppercase}.box-lateral{float:right;width:220px;border:1px solid #000;padding:5px;font-size:10px;font-weight:bold;margin-left:10px;margin-bottom:10px;text-align:left}.termo-texto{text-align:justify;margin-right:240px}.assinaturas{margin-top:40px;display:flex;justify-content:space-between;gap:20px}.assinatura-linha{border-top:1px solid #000;flex:1;text-align:center;padding-top:5px}.obs-box{margin-top:15px;font-weight:bold}.footer-info{margin-top:30px;border-top:1px solid #000;pt:10px}.aviso-final{margin-top:20px;font-weight:bold;text-align:justify;border:1px solid #000;padding:5px}</style></head><body><div class="protocolo">PROTOCOLO: ${protocolo}</div><div class="header"><h2>Comprovante de Atendimento</h2></div><div class="content"><div class="line"><span class="bold">Nome do FALECIDO:</span> ${d.nome.toUpperCase()}</div><div class="line"><span class="bold">Funerária:</span> ${d.funeraria.toUpperCase()}</div><div class="line"><span class="bold">Atendente Responsável:</span> ${(d.atendente_sistema||'SISTEMA').toUpperCase()}<span style="margin-left:20px" class="bold">DATA DE HORARIO DE ATENDIMENTO:</span> ${dataAtualFmt} AS ${horaAtualFmt}</div><div class="line"><span class="bold">Data:</span> ${fmtData(d.data_ficha)} <span class="bold" style="margin-left:10px">Hora:</span> ${d.hora} <span class="bold" style="margin-left:10px">SEPULTURA:</span> ${d.sepul} <span class="bold" style="margin-left:10px">QUADRA:</span> ${d.qd} <span class="bold" style="margin-left:10px">RUA:</span> - <span class="bold" style="margin-left:10px">CAPELA:</span> ${d.cap}</div><div class="line"><span class="bold">COM CAPELA</span> ${chk(comCapela)} <span class="bold">SEM CAPELA</span> ${chk(!comCapela)} <span class="bold" style="margin-left:20px">DATA DO FALECIMENTO:</span> ${fmtData(d.data_obito)} AS ${d.hora_obito}</div><div class="line"><span class="bold">Cemitério:</span> (${isMarui?'X':' '}) MARUÍ (${isSaoFrancisco?'X':' '}) SÃO FRANCISCO XAVIER (${isItaipu?'X':' '}) SÃO LÁZARO DE ITAIPÚ</div><div class="line">( ) SOLTEIRO ( ) CASADO ( ) VÍUVO ( ) UNIÃO ESTÁVEL ( ) DIVORCIADO ( ) IGNORADO</div><div class="section-title">ASSINAR TERMO DE COMPROMISSO NO CEMITÉRIO</div><div class="line">${chk(d.tipo_sepultura==='GAVETA'&&d.classificacao_obito==='ADULTO')} Gaveta Adulto ${chk(d.tipo_sepultura==='CARNEIRO'&&d.classificacao_obito==='ADULTO')} Carneira Adulto ${chk(d.tipo_sepultura==='COVA RASA'&&d.classificacao_obito==='ADULTO')} Cova Rasa Adulto ${chk(d.tipo_sepultura==='GAVETA'&&d.classificacao_obito==='ANJO')} Gaveta Anjo</div><div class="line">${chk(d.tipo_sepultura==='CARNEIRO'&&d.classificacao_obito==='ANJO')} Carneira Anjo ${chk(d.tipo_sepultura==='COVA RASA'&&d.classificacao_obito==='ANJO')} Cova Rasa Anjo ${chk(d.tipo_sepultura==='PERPETUA')} Perpétuo ( ) L: F:</div><div class="line" style="margin-top:10px"><span class="bold">TANATO:</span> (${d.tanato==='SIM'?'X':' '}) SIM (${d.tanato==='NAO'?'X':' '}) NÃO</div><div class="assinaturas"><div class="assinatura-linha">Acolhimento / Atendente:<br><b>${d.atendente_sistema||''}</b></div><div class="assinatura-linha">Assinatura do responsável/família</div></div><div class="obs-box">OBS: PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.</div><div class="obs-box">OBS.: VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.</div><div style="margin-top:20px;overflow:auto"><div class="box-lateral">CAPELAS MUNICIPAIS E PARTICULARES:<br><br>PAGAMENTO E NOTA FISCAL DAS TAXAS MUNICIPAIS E INVOL COM DUAS HORAS ANTES DO SEPULTAMENTO<br><br>CIENTE: ___________________</div><div class="termo-texto"><div style="text-align:center;font-weight:bold;text-decoration:underline;margin-bottom:10px">TERMO DE COMPROMISSO CEMITÉRIOS MUNICIPAIS</div>Sendo o <span class="bold">FALECIDO CASADO</span>, o responsável perante, o Cemitério do MARUÍ, SÃO FRANCISCO E ITAIPU será obrigatoriamente o <span class="bold">CONJUGE</span>.<br>Sendo o <span class="bold">FALECIDO VIÚVO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU serão obrigatoriamente os <span class="bold">FILHOS</span>.<br>Sendo o <span class="bold">FALECIDO SOLTEIRO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU obrigatoriamente os <span class="bold">FILHOS, PAIS, IRMÃOS</span>.<br>Será exigida a apresentação de documentos de <span class="bold" style="text-decoration:underline">IDENTIDADE e CPF</span>.</div></div><div class="assinaturas" style="margin-top:30px"><div class="assinatura-linha" style="border:none"></div><div class="assinatura-linha">Assinatura funcionário/família</div></div><div class="footer-info">MARCADO: ________________________________ PERMISSIONÁRIO: __________________________________<br><br>TEL: ${d.telefone||'______________________'}</div><div class="aviso-final"><span style="text-decoration:underline">COMUNICADO AOS FAMILIARES DO FALECIDO E AS EMPRESAS FUNERÁRIAS RESPONSÁVEIS PELO SEPULTAMENTO.</span>Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos:<span class="bold">GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL PELO SERVIÇO), TAXAS MUNICIPAIS PAGAS e INVOL.</span></div></div><script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('','_blank'); w.document.write(htmlComprovante); w.document.close();
}

window.alternarDesign=function(){document.body.classList.toggle('design-classico');localStorage.setItem('designMode',document.body.classList.contains('design-classico')?'classico':'moderno');};
window.imprimirRelatorio=function(m){const s=document.createElement('style');s.id='print-style';s.innerHTML=`@page{size:${m};margin:5mm}`;document.head.appendChild(s);setTimeout(()=>window.print(),200);};
function carregarCidades(u,s=""){const e=document.getElementById('cidade_obito');if(!u){e.innerHTML='<option value="">UF</option>';e.disabled=true;return;}e.innerHTML='<option>...</option>';e.disabled=true;fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${u}/municipios`).then(r=>r.json()).then(c=>{e.innerHTML='<option>Selecione</option>';c.sort((a,b)=>a.nome.localeCompare(b.nome));c.forEach(i=>{const o=document.createElement('option');o.value=i.nome.toUpperCase();o.text=i.nome.toUpperCase();if(i.nome.toUpperCase()===s)o.selected=true;e.appendChild(o);});e.disabled=false;});}
function atualizarListener(d,l){if(unsubscribe)unsubscribe();const t=document.getElementById('tabela-corpo');t.innerHTML='<tr><td colspan="11" style="text-align:center">Carregando...</td></tr>';unsubscribe=db.collection("atendimentos").where("data_ficha","==",d).onSnapshot(s=>{let a=[];s.forEach(o=>{let i=o.data();i.id=o.id;if((i.local||"CEMITÉRIO DO MARUÍ")===l)a.push(i);});a.sort((x,y)=>(x.hora<y.hora?-1:1));renderizarTabela(a);});}
window.pegarLocalizacaoGPS=function(){if(navigator.geolocation){navigator.geolocation.getCurrentPosition(function(p){const l=p.coords.latitude;const g=p.coords.longitude;const c=`${l}, ${g}`;document.getElementById('geo_coords').value=c;alert("Localização capturada: "+c);},function(e){alert("Erro ao obter localização: "+e.message);});}else{alert("Navegador não suporta GPS.");}};

const form = document.getElementById('form-atendimento');
form.onsubmit=(e)=>{e.preventDefault();const id=document.getElementById('docId').value;const g=(k)=>document.getElementById(k).value;const d={data_ficha:g('filtro-data'),local:g('filtro-local'),hora:g('hora'),atendente_sistema:g('atendente_sistema'),resp_nome:g('resp_nome'),telefone:g('telefone'),parentesco:g('parentesco'),classificacao_obito:g('classificacao_obito'),do_24h:g('do_24h'),urna_info:g('urna_info'),combo_urna:g('combo_urna'),tipo_urna_detalhe:g('tipo_urna_detalhe'),funeraria:g('funeraria'),isencao:g('isencao'),requisito:g('requisito'),tanato:document.getElementById('chk_tanato').checked?'SIM':'NAO',invol:document.getElementById('chk_invol').checked?'SIM':'NAO',translado:document.getElementById('chk_translado').checked?'SIM':'NAO',urna_opc:document.getElementById('chk_urna_opc').checked?'SIM':'NAO',nome:g('nome'),causa:g('causa'),gav:document.getElementById('tipo_sepultura').value==='GAVETA'?'X':'',car:document.getElementById('tipo_sepultura').value==='CARNEIRO'?'X':'',cova_rasa:document.getElementById('tipo_sepultura').value==='COVA RASA'?'X':'',perpetua:document.getElementById('tipo_sepultura').value==='PERPETUA'?'X':'',sepul:g('sepul'),motivo_troca_sepultura:g('motivo_troca_sepultura'),qd:g('qd'),hospital:g('hospital'),cidade_obito:g('cidade_obito'),estado_obito:g('estado_obito'),cap:g('cap'),data_obito:g('data_obito'),hora_obito:g('hora_obito'),geo_coords:g('geo_coords'),protocolo:document.getElementById('protocolo_hidden').value};if(!id&&!d.protocolo){d.protocolo=gerarProtocolo();}if(id){db.collection("atendimentos").doc(id).update(d).then(()=>window.fecharModal()).catch(e=>alert("Erro atualização: "+e));}else{db.collection("atendimentos").add(d).then(()=>window.fecharModal()).catch(e=>alert("Erro salvar: "+e));}};
window.excluir=function(i){if(confirm('Tem certeza?'))db.collection("atendimentos").doc(i).delete();};
window.onclick=function(e){const t=e.target;if(t==document.getElementById('modal'))window.fecharModal();if(t==document.getElementById('modal-visualizar'))window.fecharModalVisualizar();if(t==document.getElementById('modal-estatisticas'))window.fecharModalEstatisticas();if(t==document.getElementById('modal-equipe'))window.fecharModalEquipe();if(t==document.getElementById('modal-admin'))window.fecharModalAdmin();};