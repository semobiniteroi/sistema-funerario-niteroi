// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyB6pkQZNuLiYidKqstJdMXRl2OYW4JWmfs",
  authDomain: "funeraria-niteroi.firebaseapp.com",
  projectId: "funeraria-niteroi",
  storageBucket: "funeraria-niteroi.firebasestorage.app",
  messagingSenderId: "232673521828",
  appId: "1:232673521828:web:f25a77f27ba1924cb77631"
};

// Inicialização Segura
let db = null;
try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    } else {
        console.error("Firebase SDK não carregado.");
    }
} catch (e) {
    console.error("Erro ao iniciar Firebase:", e);
}

// --- VARIÁVEIS GLOBAIS ---
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

// --- UTILITÁRIO: GERAR PROTOCOLO ---
function gerarProtocolo() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const min = String(agora.getMinutes()).padStart(2, '0');
    return `${ano}${mes}${dia}-${hora}${min}`;
}

// --- HELPER DATA LOCAL ---
function pegarDataAtualLocal() {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

// --- FUNÇÃO AUXILIAR: MUDAR LABEL QD/RUA ---
function atualizarLabelQuadra(local) {
    const inputQd = document.getElementById('qd');
    if (inputQd) {
        const label = inputQd.previousElementSibling;
        if (label) {
            if (local && local.includes('MARUÍ')) {
                label.innerText = 'QD';
            } else {
                label.innerText = 'RUA';
            }
        }
    }
}

// --- LOGIN DO SISTEMA ---
window.fazerLogin = function() {
    const userIn = document.getElementById('login-usuario').value.trim();
    const passIn = document.getElementById('login-senha').value.trim();
    const erro = document.getElementById('msg-erro-login');

    if (passIn === "2026") {
        usuarioLogado = { nome: "Administrador (Master)", login: "admin" };
        liberarAcesso();
        return;
    }

    if (!db) {
        alert("Erro: Banco de dados desconectado. Use a senha mestra.");
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
                if(erro) {
                    erro.style.display = 'block';
                    erro.innerText = "Usuário ou senha incorretos.";
                } else {
                    alert("Dados incorretos.");
                }
            }
        })
        .catch((e) => {
            console.error("Erro login:", e);
            if(erro) {
                erro.style.display = 'block';
                erro.innerText = "Erro de conexão.";
            } else {
                alert("Erro de conexão.");
            }
        });
}

function liberarAcesso() {
    document.getElementById('tela-bloqueio').style.display = 'none';
    document.getElementById('msg-erro-login').style.display = 'none';
    document.getElementById('user-display').innerText = `Olá, ${usuarioLogado.nome.split(' ')[0]}`;
    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
    
    const hj = pegarDataAtualLocal();
    const il = document.getElementById('filtro-local');
    if(il) {
        atualizarListener(hj, il.value);
        atualizarLabelQuadra(il.value);
    }
}

window.fazerLogout = function() {
    sessionStorage.removeItem('usuarioLogado');
    window.location.reload();
}

window.checarLoginEnter = function(e) { if(e.key==='Enter') window.fazerLogin(); }
window.bloquearTela = function() { document.getElementById('tela-bloqueio').style.display = 'flex'; }

// --- ADMINISTRAÇÃO ---
window.abrirAdmin = function() {
    const m = document.getElementById('modal-admin');
    if(m) {
        m.style.display = 'block';
        abrirAba('tab-equipe');
    }
}

window.fecharModalAdmin = function() {
    const m = document.getElementById('modal-admin');
    if(m) {
        m.style.display = 'none';
        if(equipeUnsubscribe) equipeUnsubscribe();
        if(statsUnsubscribe) statsUnsubscribe();
        if(typeof logsUnsubscribe === 'function') logsUnsubscribe();
    }
}

window.abrirAba = function(tabId) {
    const panes = document.getElementsByClassName('tab-pane');
    for(let p of panes) p.classList.remove('active');
    const btns = document.getElementsByClassName('tab-btn');
    for(let b of btns) b.classList.remove('active');

    document.getElementById(tabId).classList.add('active');
    if(tabId === 'tab-equipe') { if(btns[0]) btns[0].classList.add('active'); listarEquipe(); }
    if(tabId === 'tab-stats') { if(btns[1]) btns[1].classList.add('active'); carregarEstatisticas(7); }
    if(tabId === 'tab-logs') { if(btns[2]) btns[2].classList.add('active'); carregarLogs(); }
}

window.listarEquipe = function() {
    const lista = document.getElementById('lista-equipe');
    if(!lista || !db) return;
    lista.innerHTML = 'Carregando...';
    equipeUnsubscribe = db.collection("equipe").orderBy("nome").onSnapshot((snapshot) => {
        lista.innerHTML = '';
        snapshot.forEach((doc) => {
            const user = doc.data();
            const emailExibir = user.email ? user.email : '<span style="color:#999; font-style:italic;">Sem e-mail</span>';
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${user.nome}</strong> (${emailExibir})<br>
                    <span style="font-size:10px; color:#777;">Login: ${user.login || '-'}</span>
                </div>
                <div style="display:flex; gap:5px;">
                    <button class="btn-icon btn-editar-circle" onclick="prepararEdicao('${doc.id}', '${user.nome}', '${user.login}', '${user.email || ''}', '${user.senha}')">✏️</button>
                    <button class="btn-remove-user" onclick="excluirFuncionario('${doc.id}')">🗑️</button>
                </div>
            `;
            lista.appendChild(li);
        });
    });
}

window.adicionarFuncionario = function() {
    if(!db) return;
    const nome = document.getElementById('novo-nome').value.trim().toUpperCase();
    const login = document.getElementById('novo-login').value.trim();
    const email = document.getElementById('novo-email').value.trim();
    const senha = document.getElementById('nova-senha').value.trim();

    if(nome && login && senha) {
        db.collection("equipe").add({ nome: nome, login: login, email: email, senha: senha })
        .then(() => { 
            document.getElementById('novo-nome').value = '';
            document.getElementById('novo-login').value = '';
            document.getElementById('novo-email').value = '';
            document.getElementById('nova-senha').value = '';
            alert("Usuário cadastrado!");
        })
        .catch((e) => alert("Erro: " + e));
    } else {
        alert("Preencha Nome, Login e Senha.");
    }
}

window.excluirFuncionario = function(id) {
    if(!db) return;
    if(confirm("Remover este usuário?")) db.collection("equipe").doc(id).delete();
}

window.prepararEdicao = function(id, nome, login, email, senha) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-nome').value = nome;
    document.getElementById('edit-login').value = login;
    document.getElementById('edit-email').value = email;
    document.getElementById('edit-senha').value = senha;
    document.getElementById('box-novo-usuario').classList.add('hidden');
    document.getElementById('div-editar-usuario').classList.remove('hidden');
}

window.cancelarEdicao = function() {
    document.getElementById('box-novo-usuario').classList.remove('hidden');
    document.getElementById('div-editar-usuario').classList.add('hidden');
    document.getElementById('edit-id').value = '';
    document.getElementById('edit-nome').value = '';
    document.getElementById('edit-login').value = '';
    document.getElementById('edit-email').value = '';
    document.getElementById('edit-senha').value = '';
}

window.salvarEdicaoUsuario = function() {
    const id = document.getElementById('edit-id').value;
    const nome = document.getElementById('edit-nome').value.trim().toUpperCase();
    const email = document.getElementById('edit-email').value.trim();
    const senha = document.getElementById('edit-senha').value.trim();
    if(!id || !nome || !senha) { alert("Nome e Senha são obrigatórios."); return; }
    db.collection("equipe").doc(id).update({ nome: nome, email: email, senha: senha }).then(() => {
        alert("Usuário atualizado com sucesso!");
        cancelarEdicao();
    }).catch((e) => { alert("Erro ao atualizar: " + e); });
}

// --- ESTATÍSTICAS E EXPORTAÇÃO EXCEL ---
window.baixarRelatorioCompleto = function() {
    if(!db) return;
    if(!confirm("Deseja baixar o relatório completo?")) return;

    db.collection("atendimentos").get().then((querySnapshot) => {
        let dados = [];
        querySnapshot.forEach((doc) => {
            let d = doc.data();
            let dataExibicao = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-';
            let ano = "", mes = "";
            if (d.data_ficha) { let partes = d.data_ficha.split('-'); ano = partes[0]; mes = partes[1]; }
            dados.push([
                dataExibicao, d.hora || "", mes, ano,
                (d.nome || "").toUpperCase(), (d.causa || "").toUpperCase(), (d.resp_nome || "").toUpperCase(),
                d.telefone || "", (d.funeraria || "").toUpperCase(), (d.local || "").toUpperCase(),
                d.sepul || "", d.protocolo || "", (d.atendente_sistema || "").toUpperCase()
            ]);
        });
        dados.sort((a,b) => {
             if (a[3] < b[3]) return 1; if (a[3] > b[3]) return -1;
             if (a[2] < b[2]) return 1; if (a[2] > b[2]) return -1;
             return 0;
        });
        const headers = ["Data", "Hora", "Mês", "Ano", "Falecido", "Causa Morte", "Responsável", "Telefone", "Funerária", "Local", "Sepultura", "Protocolo", "Atendente"];
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dados]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório Geral");
        XLSX.writeFile(workbook, "Relatorio_Completo_Atendimentos.xlsx");
    }).catch((e) => alert("Erro ao gerar relatório: " + e));
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
    if(!tbody || !db) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Carregando registros...</td></tr>';
    logsUnsubscribe = db.collection("atendimentos").limit(50).orderBy("data_ficha", "desc").onSnapshot((snapshot) => {
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

// --- FUNÇÕES GERAIS ---
window.abrirModal = function() {
    const f = document.getElementById('form-atendimento'); 
    if(f) f.reset();
    
    const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
    
    safeSet('docId', ''); safeSet('do_24h', 'NAO'); safeSet('hora', ''); safeSet('estado_obito', ''); safeSet('estado_civil', ''); safeSet('func_funeraria', ''); safeSet('membro_amputado', '');
    safeSet('livro_perpetua', ''); safeSet('folha_perpetua', '');

    // Resetar checkbox Ignorar Hora
    const chkHora = document.getElementById('chk_ignorar_hora');
    if(chkHora) chkHora.checked = false;

    const elCidade = document.getElementById('cidade_obito');
    if(elCidade) { elCidade.innerHTML = '<option value="">Selecione a UF primeiro</option>'; elCidade.disabled = true; }
    
    const idsChk = ['chk_tanato', 'chk_invol', 'chk_translado', 'chk_urna_opc', 'chk_membro'];
    idsChk.forEach(id => { const el = document.getElementById(id); if(el) el.checked = false; });
    
    const divs = ['div-local-domicilio', 'div-motivo-sepultura', 'div-membro', 'div-perpetua'];
    divs.forEach(id => { const el = document.getElementById(id); if(el) el.classList.add('hidden'); });

    const selMembro = document.getElementById('tipo_membro_select');
    if(selMembro) { selMembro.value = ""; selMembro.disabled = true; }

    const filtroLocal = document.getElementById('filtro-local');
    // Preenche a data do modal com a data do filtro (se existir)
    const filtroData = document.getElementById('filtro-data');
    if(filtroData) safeSet('data_ficha_modal', filtroData.value);

    if(filtroLocal) atualizarLabelQuadra(filtroLocal.value);

    if(usuarioLogado) safeSet('atendente_sistema', usuarioLogado.nome);
    sepulturaOriginal = ""; 
    document.getElementById('modal').style.display = 'block';
}

window.fecharModal = function() { const m=document.getElementById('modal'); if(m) m.style.display = 'none'; }
window.fecharModalVisualizar = function() { const m=document.getElementById('modal-visualizar'); if(m) m.style.display = 'none'; }
window.abrirModalEstatisticas = function() { document.getElementById('modal-estatisticas').style.display = 'block'; carregarEstatisticas(7); }
window.fecharModalEstatisticas = function() { document.getElementById('modal-estatisticas').style.display = 'none'; if(typeof statsUnsubscribe === 'function') statsUnsubscribe(); }

document.addEventListener('DOMContentLoaded', () => {
    const sessao = sessionStorage.getItem('usuarioLogado');
    if (sessao) {
        usuarioLogado = JSON.parse(sessao);
        const tb = document.getElementById('tela-bloqueio');
        if(tb) tb.style.display = 'none';
        const ud = document.getElementById('user-display');
        if(ud) ud.innerText = `Olá, ${usuarioLogado.nome.split(' ')[0]}`;
    }

    if (localStorage.getItem('designMode') === 'classico') { document.body.classList.add('design-classico'); }
    
    const selectHora = document.getElementById('hora');
    if(selectHora) {
        selectHora.innerHTML = '<option value="">--:--</option>';
        for (let h = 0; h < 24; h++) { 
            for (let m = 0; m < 60; m += 30) { 
                const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; 
                const opt = document.createElement('option'); 
                opt.value = val; 
                opt.text = val; 
                selectHora.appendChild(opt); 
            } 
        }
    }

    const hj = pegarDataAtualLocal();
    const inputData = document.getElementById('filtro-data'); const inputLocal = document.getElementById('filtro-local');
    if(inputData && inputLocal) {
        inputData.value = hj; 
        atualizarListener(hj, inputLocal.value);
        atualizarLabelQuadra(inputLocal.value);
        inputData.addEventListener('change', (e) => atualizarListener(e.target.value, inputLocal.value));
        inputLocal.addEventListener('change', (e) => { atualizarListener(inputData.value, e.target.value); atualizarLabelQuadra(e.target.value); });
    }

    const inputBusca = document.getElementById('input-busca');
    if(inputBusca) { inputBusca.addEventListener('keypress', function (e) { if (e.key === 'Enter') window.realizarBusca(); }); }

    const seletorCausas = document.getElementById('seletor_causas');
    if (seletorCausas) {
        seletorCausas.addEventListener('change', function() {
            const inputCausa = document.getElementById("causa");
            if (this.value) {
                const val = this.value.toUpperCase();
                const doencasContagiosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HEPATITE', 'HIV', 'SIDA', 'INFLUENZA', 'SARAMPO', 'FEBRE AMARELA', 'LEPTOSPIROSE', 'SEPCEMIA'];
                const ehContagioso = doencasContagiosas.some(doenca => val.includes(doenca));
                if(ehContagioso) { alert("⚠️ ATENÇÃO: DOENÇA INFECTOCONTAGIOSA SELECIONADA!"); }
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
    inputSepul.addEventListener('input', function() { if (sepulturaOriginal && this.value !== sepulturaOriginal) { divMotivo.classList.remove('hidden'); } else { divMotivo.classList.add('hidden'); document.getElementById('motivo_troca_sepultura').value = ""; } });

    const chkMembro = document.getElementById('chk_membro');
    const selMembro = document.getElementById('tipo_membro_select');
    if(chkMembro && selMembro) {
        chkMembro.addEventListener('change', function() {
            selMembro.disabled = !this.checked;
            if(!this.checked) selMembro.value = "";
        });
    }
    
    const selectTipoSep = document.getElementById('tipo_sepultura');
    const divPerpetua = document.getElementById('div-perpetua');
    if(selectTipoSep && divPerpetua) {
        selectTipoSep.addEventListener('change', function() {
            if (this.value === 'PERPETUA') { divPerpetua.classList.remove('hidden'); } else {
                divPerpetua.classList.add('hidden');
                const elL = document.getElementById('livro_perpetua'); if(elL) elL.value = '';
                const elF = document.getElementById('folha_perpetua'); if(elF) elF.value = '';
            }
        });
    }
});

window.realizarBusca = function() {
    const input = document.getElementById('input-busca'); const termo = input.value.trim().toUpperCase();
    if (!termo) { alert("Digite um nome ou protocolo."); return; }
    if (unsubscribe) unsubscribe();
    const tbody = document.getElementById('tabela-corpo'); tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Buscando...</td></tr>';
    
    if (termo.match(/[0-9]/)) {
        db.collection("atendimentos").where("protocolo", "==", termo).get().then((snapshot) => {
            if (!snapshot.empty) {
                let lista = []; snapshot.forEach((doc) => { let d = doc.data(); d.id = doc.id; lista.push(d); });
                renderizarTabela(lista);
            } else { buscarPorNome(termo); }
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
    const tbody = document.getElementById('tabela-corpo'); if(!tbody) return;
    tbody.innerHTML = ''; 
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="11" style="padding: 40px; text-align:center; color:#b5b5c3;">Nenhum atendimento registrado neste local e data.</td></tr>'; return; }

    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => window.visualizar(item.id);
        
        const doencasContagiosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HEPATITE', 'HIV', 'SIDA', 'INFLUENZA', 'SARAMPO', 'FEBRE AMARELA', 'LEPTOSPIROSE'];
        let isContagioso = false;
        if(item.causa) { const causaUpper = item.causa.toUpperCase(); isContagioso = doencasContagiosas.some(doenca => causaUpper.includes(doenca)); }
        if (isContagioso) { tr.classList.add('alerta-doenca'); }
        const iconAlert = isContagioso ? '<span class="icone-alerta" title="Doença Contagiosa">⚠️</span>' : '';
        const estiloCausa = 'color:red !important; font-weight:700; font-size:11px; margin-top:2px;';

        let btnMap = '';
        const cleanCoords = item.geo_coords ? item.geo_coords.replace(/\s/g, '') : '';
        if (cleanCoords && cleanCoords.includes(',')) {
             btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('https://www.google.com/maps/search/?api=1&query=${cleanCoords}', '_blank')" title="Ver Localização">📍</button>`;
        }

        let displayResponsavel = "";
        if (item.isencao === "50") { displayResponsavel += `ACOLHIMENTO <span style="font-weight:900;">50% DE ISENÇÃO</span>`; if(item.requisito) displayResponsavel += `<br>REQ: ${item.requisito.toUpperCase()}`; displayResponsavel += `<br>`; } 
        else if (item.isencao === "SIM") { displayResponsavel += `ACOLHIMENTO <span style="font-weight:900;">100% DE ISENÇÃO</span>`; if(item.requisito) displayResponsavel += `<br>REQ: ${item.requisito.toUpperCase()}`; displayResponsavel += `<br>`; } 
        else { 
            if (item.funeraria) { displayResponsavel += `${item.funeraria.toUpperCase()}<br>`; } 
            else if (item.resp_nome) { displayResponsavel += `${item.resp_nome.toUpperCase()}<br>`; } 
            else { displayResponsavel += 'S/D<br>'; } 
        }

        if (item.tipo_urna_detalhe) { displayResponsavel += `<span style="font-weight:bold;">${item.tipo_urna_detalhe.toUpperCase()}</span><br>`; }
        if (item.combo_urna && dimensoesUrna[item.combo_urna]) { displayResponsavel += `URNA ${item.combo_urna}<br>${dimensoesUrna[item.combo_urna]}<br>`; } else if (item.combo_urna) { displayResponsavel += `URNA ${item.combo_urna}<br>`; }
        
        let servicosExtras = [];
        if (item.tanato === 'SIM') servicosExtras.push('TANATOPRAXIA');
        if (item.invol === 'SIM') servicosExtras.push('INVOL');
        if (item.translado === 'SIM') servicosExtras.push('TRANSLADO');
        if (item.urna_opc === 'SIM') servicosExtras.push('URNA');
        if (servicosExtras.length > 0) { displayResponsavel += `<div style="margin-top:2px; font-weight:bold; font-size:10px;">SERVIÇOS: ${servicosExtras.join(', ')}</div>`; }

        const conteudoNome = `<div style="font-weight:700; font-size:12px;">${iconAlert}${item.nome ? item.nome.toUpperCase() : 'NOME NÃO INFORMADO'}</div>
                              <div style="${estiloCausa}">(${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})</div>
                              ${item.classificacao_obito === 'ANJO' ? '<span style="font-size:10px; color:blue;">(ANJO)</span>' : ''}`;
        
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
                    textoTempo = `<br><span style="font-weight:bold; font-size:10px;">INTERVALO: ${diffHrs}H ${diffMins}M</span>`;
                }
            }
            displayFalecimento = `<div style="line-height:1.3;"><span class="texto-vermelho">DIA:</span> ${dataFormatada}<br><span class="texto-vermelho">AS:</span> ${item.hora_obito || '--:--'}${textoTempo}</div>`;
        } else if (item.falecimento) {
            displayFalecimento = `<div>${item.falecimento}</div>`;
        }
        
        let conteudoSepultura = item.sepul || '';
        if (item.perpetua === 'X' || item.tipo_sepultura === 'PERPETUA') {
            conteudoSepultura += `<div style="font-size:10px; font-weight:bold; color:var(--primary-color); margin-top:2px;">PERPÉTUA<br>L: ${item.livro_perpetua || ''} F: ${item.folha_perpetua || ''}</div>`;
        }

        tr.innerHTML = `
            <td>${displayResponsavel}</td>
            <td style="text-align: center;">${item.hora || ''}</td>
            <td style="text-align: center; vertical-align: middle;">${conteudoNome}</td>
            <td style="text-align: center;">${item.gav || ''}</td>
            <td style="text-align: center;">${item.car || ''}</td>
            <td style="text-align: center;">${conteudoSepultura}</td>
            <td style="text-align: center;">${item.qd || ''}</td>
            <td style="text-align: center;">${item.hospital || ''}</td>
            <td style="text-align: center;">${item.cap || ''}</td>
            <td style="text-align: center;">${displayFalecimento}</td>
            <td style="text-align: right;">
                <div class="t-acoes">
                    ${btnMap}
                    <button class="btn-icon btn-editar-circle" onclick="event.stopPropagation(); window.editar('${item.id}')">✏️</button>
                    <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation(); window.excluir('${item.id}')">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarListener(dataSelecionada, localSelecionado) {
    if(!db) return;
    if (unsubscribe) unsubscribe();
    const tbody = document.getElementById('tabela-corpo');
    if(tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Carregando dados...</td></tr>';
    
    unsubscribe = db.collection("atendimentos")
        .where("data_ficha", "==", dataSelecionada)
        .onSnapshot((snapshot) => {
            let listaAtendimentos = [];
            snapshot.forEach(doc => {
                let dado = doc.data();
                dado.id = doc.id;
                const localDoRegistro = dado.local || "CEMITÉRIO DO MARUÍ";
                if (localDoRegistro === localSelecionado) {
                    listaAtendimentos.push(dado);
                }
            });
            listaAtendimentos.sort((a, b) => {
                if (a.hora < b.hora) return -1;
                if (a.hora > b.hora) return 1;
                return 0;
            });
            renderizarTabela(listaAtendimentos);
        }, (error) => {
            console.error("Erro ao ler dados:", error);
            if(tbody) tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>';
        });
}

// --- VISUALIZAR E AÇÕES ---
window.visualizar = function(id) {
    if(!document.getElementById('modal-visualizar')) return;
    document.body.style.cursor = 'wait';
    db.collection("atendimentos").doc(id).get().then((doc) => {
        document.body.style.cursor = 'default';
        if (doc.exists) {
            const i = doc.data(); 
            dadosAtendimentoAtual = i;
            const setText = (k, v) => { const el = document.getElementById(k); if(el) el.innerText = v || '-'; };
            setText('view_protocolo', i.protocolo || '-');
            setText('view_hora', i.hora);
            let respTexto = i.resp_nome || '-'; 
            if (i.parentesco) respTexto += ` (${i.parentesco})`; 
            setText('view_resp_completo', respTexto);
            setText('view_funeraria', i.funeraria + (i.func_funeraria ? ` - Rep: ${i.func_funeraria}` : ''));
            setText('view_atendente', i.atendente_sistema || '-');
            setText('view_telefone', i.telefone);
            let textoIsencao = "NÃO (Pago)"; if (i.isencao === "SIM") textoIsencao = "SIM (100% Isenção)"; if (i.isencao === "50") textoIsencao = "SIM (50% Isenção)"; if (i.requisito) textoIsencao += ` - ${i.requisito}`; setText('view_isencao_completa', textoIsencao);
            let infoUrna = i.urna_info || '-'; if(i.motivo_troca_sepultura) infoUrna += `\n[TROCA SEPULTURA: ${i.motivo_troca_sepultura}]`; setText('view_urna_info', infoUrna);
            setText('view_combo_urna', i.combo_urna); setText('view_tipo_urna_detalhe', i.tipo_urna_detalhe);
            let servicosView = []; if (i.tanato === 'SIM') servicosView.push('Tanatopraxia'); if (i.invol === 'SIM') servicosView.push('Invol'); if (i.translado === 'SIM') servicosView.push('Translado'); if (i.urna_opc === 'SIM') servicosView.push('Urna'); setText('view_servicos_adicionais', servicosView.length > 0 ? servicosView.join(', ') : '-');
            let nomeView = i.nome || '-'; if (i.classificacao_obito === "ANJO") nomeView += " (ANJO)"; setText('view_nome', nomeView); setText('view_causa', i.causa);
            let tipo = ''; if (i.gav && i.gav.includes('X')) tipo = 'GAVETA'; else if (i.car && i.car.includes('X')) tipo = 'CARNEIRO'; else if (i.cova_rasa === 'X') tipo = 'COVA RASA'; else if (i.perpetua === 'X') tipo = 'PERPÉTUA'; else if (i.membro_opc === 'SIM') tipo = 'MEMBRO AMPUTADO';
            if(document.getElementById('view_local_sepul')) {
                 let localTexto = `Tipo: ${tipo} | Nº: ${i.sepul||'-'} | QD: ${i.qd||'-'}`;
                 if(i.membro_opc === 'SIM' && i.tipo_membro) { localTexto += ` | MEMBRO: ${i.tipo_membro}`; }
                 if(i.tipo_sepultura === 'PERPETUA' && i.livro_perpetua) { localTexto += ` | L: ${i.livro_perpetua} F: ${i.folha_perpetua}`; }
                 document.getElementById('view_local_sepul').innerText = localTexto;
            }
            setText('view_hospital_completo', i.hospital); setText('view_cap', i.cap);
            let dataFormatada = i.data_obito; if (dataFormatada && dataFormatada.includes('-')) { const p = dataFormatada.split('-'); dataFormatada = `${p[2]}/${p[1]}/${p[0]}`; } setText('view_data_obito', dataFormatada); 
            
            // VISUALIZAR: HORA ÓBITO (COM LÓGICA DE IGNORADO)
            setText('view_hora_obito', i.ignorar_hora_obito === 'SIM' ? (i.hora_obito + ' (IGNORADO)') : i.hora_obito);

            const mapContainer = document.getElementById('view_map_container'); const mapFrame = document.getElementById('mapa-frame'); const mapLink = document.getElementById('link-gps');
            const cleanCoords = i.geo_coords ? i.geo_coords.replace(/\s/g, '') : '';
            if (cleanCoords && cleanCoords.includes(',')) { mapContainer.style.display = 'block'; mapFrame.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="https://www.google.com/maps?q=${cleanCoords}&z=17&output=embed"></iframe>`; mapLink.href = `https://www.google.com/maps/search/?api=1&query=${cleanCoords}`; } else { mapContainer.style.display = 'none'; mapFrame.innerHTML = ''; }
            document.getElementById('modal-visualizar').style.display = 'block';
        } else { alert("Atendimento não encontrado."); }
    }).catch((error) => { document.body.style.cursor = 'default'; alert("Erro: " + error.message); });
}

window.editar = function(id) {
    db.collection("atendimentos").doc(id).get().then((doc) => {
        if (doc.exists) {
            const item = doc.data(); 
            document.getElementById('docId').value = doc.id;
            document.getElementById('protocolo_hidden').value = item.protocolo || "";
            const selectHora = document.getElementById('hora'); if(![...selectHora.options].some(o => o.value == item.hora)) { const opt = document.createElement('option'); opt.value = item.hora; opt.text = item.hora; selectHora.add(opt); } selectHora.value = item.hora || "";
            const setVal = (k, v) => { const el=document.getElementById(k); if(el) el.value=v||''; };
            setVal('nome', item.nome); setVal('causa', item.causa); setVal('resp_nome', item.resp_nome); setVal('telefone', item.telefone); setVal('parentesco', item.parentesco);
            setVal('atendente_sistema', item.atendente_sistema); setVal('classificacao_obito', item.classificacao_obito || 'ADULTO'); setVal('do_24h', item.do_24h || 'NAO'); 
            setVal('urna_info', item.urna_info); setVal('combo_urna', item.combo_urna); setVal('tipo_urna_detalhe', item.tipo_urna_detalhe);
            setVal('funeraria', item.funeraria); setVal('isencao', item.isencao || 'NAO'); setVal('requisito', item.requisito);
            setVal('data_obito', item.data_obito); setVal('hora_obito', item.hora_obito); setVal('geo_coords', item.geo_coords);
            setVal('estado_civil', item.estado_civil); setVal('func_funeraria', item.func_funeraria); setVal('tipo_membro_select', item.tipo_membro);
            setVal('livro_perpetua', item.livro_perpetua); setVal('folha_perpetua', item.folha_perpetua); 
            if(item.data_ficha) setVal('data_ficha_modal', item.data_ficha);
            
            // EDITAR: CHECKBOX IGNORAR
            document.getElementById('chk_ignorar_hora').checked = (item.ignorar_hora_obito === 'SIM');

            document.getElementById('chk_tanato').checked = (item.tanato === 'SIM'); document.getElementById('chk_invol').checked = (item.invol === 'SIM'); document.getElementById('chk_translado').checked = (item.translado === 'SIM'); document.getElementById('chk_urna_opc').checked = (item.urna_opc === 'SIM');
            const isMembro = (item.membro_opc === 'SIM'); document.getElementById('chk_membro').checked = isMembro;
            const selMembro = document.getElementById('tipo_membro_select'); if(selMembro) selMembro.disabled = !isMembro;
            const selectTipo = document.getElementById('tipo_sepultura');
            
            if (item.tipo_sepultura) {
                 selectTipo.value = item.tipo_sepultura;
            } else {
                 if (item.gav && item.gav.includes('X')) selectTipo.value = 'GAVETA'; 
                 else if (item.car && item.car.includes('X')) selectTipo.value = 'CARNEIRO'; 
                 else if (item.cova_rasa === 'X') selectTipo.value = 'COVA RASA'; 
                 else if (item.perpetua === 'X') selectTipo.value = 'PERPETUA';
            }
            
            const divMembro = document.getElementById('div-membro');
            const divPerpetua = document.getElementById('div-perpetua');
            if(divMembro) { if(selectTipo.value === 'MEMBRO') divMembro.classList.remove('hidden'); else divMembro.classList.add('hidden'); }
            if(divPerpetua) { if(selectTipo.value === 'PERPETUA') divPerpetua.classList.remove('hidden'); else divPerpetua.classList.add('hidden'); }

            sepulturaOriginal = item.sepul; setVal('sepul', item.sepul); setVal('motivo_troca_sepultura', item.motivo_troca_sepultura); setVal('qd', item.qd); setVal('hospital', item.hospital); setVal('estado_obito', item.estado_obito);
            if (item.estado_obito) { carregarCidades(item.estado_obito, item.cidade_obito); } else { document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>'; document.getElementById('cidade_obito').disabled = true; }
            document.getElementById('hospital').dispatchEvent(new Event('input')); document.getElementById('sepul').dispatchEvent(new Event('input')); setVal('cap', item.cap);
            document.getElementById('modal').style.display = 'block';
        }
    });
}

const form = document.getElementById('form-atendimento');
form.onsubmit = (e) => {
    e.preventDefault(); const id = document.getElementById('docId').value; 
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
    const tipoSep = getVal('tipo_sepultura');
    const dados = {
        data_ficha: getVal('data_ficha_modal'), 
        local: getVal('filtro-local'), hora: getVal('hora'),
        atendente_sistema: getVal('atendente_sistema'), resp_nome: getVal('resp_nome'), telefone: getVal('telefone'), parentesco: getVal('parentesco'),
        classificacao_obito: getVal('classificacao_obito'), do_24h: getVal('do_24h'), urna_info: getVal('urna_info'), combo_urna: getVal('combo_urna'), tipo_urna_detalhe: getVal('tipo_urna_detalhe'),
        funeraria: getVal('funeraria'), isencao: getVal('isencao'), requisito: getVal('requisito'),
        tanato: document.getElementById('chk_tanato').checked ? 'SIM' : 'NAO', invol: document.getElementById('chk_invol').checked ? 'SIM' : 'NAO',
        translado: document.getElementById('chk_translado').checked ? 'SIM' : 'NAO', urna_opc: document.getElementById('chk_urna_opc').checked ? 'SIM' : 'NAO',
        nome: getVal('nome'), causa: getVal('causa'),
        
        // SALVAR: CHECKBOX IGNORAR
        ignorar_hora_obito: document.getElementById('chk_ignorar_hora').checked ? 'SIM' : 'NAO',

        gav: (tipoSep.includes('GAVETA')) ? 'X' : '', 
        car: (tipoSep.includes('CARNEIRO')) ? 'X' : '', 
        cova_rasa: (tipoSep.includes('COVA')) ? 'X' : '', 
        perpetua: (tipoSep === 'PERPETUA') ? 'X' : '',
        
        tipo_sepultura: tipoSep,
        livro_perpetua: getVal('livro_perpetua'), folha_perpetua: getVal('folha_perpetua'), 
        sepul: getVal('sepul'), motivo_troca_sepultura: getVal('motivo_troca_sepultura'), qd: getVal('qd'),
        hospital: getVal('hospital'), cidade_obito: getVal('cidade_obito'), estado_obito: getVal('estado_obito'),
        cap: getVal('cap'), data_obito: getVal('data_obito'), hora_obito: getVal('hora_obito'), geo_coords: getVal('geo_coords'),
        protocolo: document.getElementById('protocolo_hidden').value, estado_civil: getVal('estado_civil'), func_funeraria: getVal('func_funeraria'),
        membro_opc: document.getElementById('chk_membro').checked ? 'SIM' : 'NAO', tipo_membro: getVal('tipo_membro_select')
    };
    if(!id && !dados.protocolo) { dados.protocolo = gerarProtocolo(); }
    if (id) { db.collection("atendimentos").doc(id).update(dados).then(() => window.fecharModal()).catch((error) => alert("Erro ao atualizar: " + error)); } 
    else { db.collection("atendimentos").add(dados).then(() => window.fecharModal()).catch((error) => alert("Erro ao salvar: " + error)); }
};

window.excluir = function(id) { if(confirm('Tem certeza?')) { db.collection("atendimentos").doc(id).delete().catch((error) => alert("Erro ao excluir: " + error)); } }
window.onclick = function(event) { const t = event.target; if (t == document.getElementById('modal-visualizar')) window.fecharModalVisualizar(); if (t == document.getElementById('modal-estatisticas')) window.fecharModalEstatisticas(); if (t == document.getElementById('modal-equipe')) window.fecharModalEquipe(); if (t == document.getElementById('modal-admin')) window.fecharModalAdmin(); }
window.alternarDesign = function() { document.body.classList.toggle('design-classico'); localStorage.setItem('designMode', document.body.classList.contains('design-classico') ? 'classico' : 'moderno'); }
window.imprimirRelatorio = function(modo) { const s = document.createElement('style'); s.id = 'print-style'; s.innerHTML = `@page { size: ${modo}; margin: 5mm; }`; document.head.appendChild(s); setTimeout(() => window.print(), 200); }
function carregarCidades(u,s=""){const e=document.getElementById('cidade_obito');if(!u){e.innerHTML='<option value="">UF</option>';e.disabled=true;return;}e.innerHTML='<option>...</option>';e.disabled=true;fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${u}/municipios`).then(r=>r.json()).then(c=>{e.innerHTML='<option>Selecione</option>';c.sort((a,b)=>a.nome.localeCompare(b.nome));c.forEach(i=>{const o=document.createElement('option');o.value=i.nome.toUpperCase();o.text=i.nome.toUpperCase();if(i.nome.toUpperCase()===s)o.selected=true;e.appendChild(o);});e.disabled=false;});}

window.carregarEstatisticas = function(dias) {
    const loading = document.getElementById('loading-stats'); const divLista = document.getElementById('lista-estatisticas');
    if(divLista) divLista.innerHTML = ''; if(loading) loading.style.display = 'block';
    if (statsUnsubscribe) statsUnsubscribe();
    const di = new Date(); di.setDate(di.getDate() - dias);
    const ano = di.getFullYear(); const mes = String(di.getMonth() + 1).padStart(2, '0'); const dia = String(di.getDate()).padStart(2, '0'); const dis = `${ano}-${mes}-${dia}`;
    statsUnsubscribe = db.collection("atendimentos").where("data_ficha", ">=", dis).onSnapshot((snapshot) => {
        if(loading) loading.style.display = 'none'; let cc = {}; let ca = {}; let tm = 0;
        snapshot.forEach(doc => { const d = doc.data(); if (d.causa) { d.causa.split(/[\/+,]/).forEach(p => { const c = p.trim().toUpperCase(); if(c) cc[c] = (cc[c] || 0) + 1; }); } const at = d.atendente_sistema || "N/A"; ca[at] = (ca[at] || 0) + 1; tm++; });
        const r = Object.entries(cc).sort((a, b) => b[1] - a[1]); const ra = Object.entries(ca).sort((a, b) => b[1] - a[1]);
        atualizarGrafico('grafico-causas', 'bar', r.map(x=>x[0]), r.map(x=>x[1]), 'Ocorrências');
        atualizarGrafico('grafico-causas-modal', 'bar', r.map(x=>x[0]), r.map(x=>x[1]), 'Ocorrências');
        atualizarGrafico('grafico-atendentes', 'pie', ra.map(x=>x[0]), ra.map(x=>x[1]), 'Atendimentos');
        atualizarGrafico('grafico-atendentes-modal', 'pie', ra.map(x=>x[0]), ra.map(x=>x[1]), 'Atendimentos');
        dadosEstatisticasExportacao = r.map(([c,q]) => ({"Causa da Morte": c, "Quantidade": q, "Porcentagem": ((q/tm)*100).toFixed(2)+'%' }));
        if(divLista) { if(tm === 0) divLista.innerHTML = '<p style="text-align:center;">Nenhum dado no período.</p>'; else { let html = `<div style="margin-bottom:10px;">Total: ${tm} registros</div><table class="table-stats"><thead><tr><th>Causa</th><th>Qtd</th></tr></thead><tbody>`; r.forEach(([c,q]) => { html += `<tr><td>${c}</td><td>${q}</td></tr>`; }); html += '</tbody></table>'; divLista.innerHTML = html; } }
    }, (error) => { console.error("Erro stats:", error); if(loading) loading.innerText = "Erro ao carregar."; });
}

function atualizarGrafico(canvasId, tipo, labels, data, labelData) {
    const canvas = document.getElementById(canvasId); if (!canvas) return; const ctx = canvas.getContext('2d');
    if (typeof Chart === 'undefined') { console.error("Chart.js não carregado."); return; }
    if (chartInstances[canvasId]) { chartInstances[canvasId].destroy(); }
    chartInstances[canvasId] = new Chart(ctx, { type: tipo, data: { labels: labels.slice(0, 10), datasets: [{ label: labelData, data: data.slice(0, 10), backgroundColor: ['#3699ff', '#1bc5bd', '#f64e60', '#ffa800', '#8950fc', '#ccc'] }] }, options: { responsive: true, maintainAspectRatio: false } });
}

window.pegarLocalizacaoGPS = function() { if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(function(position) { const lat = position.coords.latitude; const long = position.coords.longitude; document.getElementById('geo_coords').value = `${lat},${long}`; alert("Localização capturada!"); }, function(error) { alert("Erro ao obter localização: " + error.message); }); } else { alert("Geolocalização não suportada."); } }
window.baixarPDF = function() { if (dadosEstatisticasExportacao.length === 0) { alert("Sem dados."); return; } const { jsPDF } = window.jspdf; const d = new jsPDF(); d.text("Relatório", 14, 15); const r = dadosEstatisticasExportacao.map(i => [i["Causa da Morte"], i["Quantidade"], i["Porcentagem"]]); d.autoTable({ head: [["Causa", "Qtd", "%"]], body: r, startY: 20 }); d.save("Relatorio.pdf"); }
window.gerarEtiqueta = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const fd = (dataStr) => { 
        if (!dataStr) return ""; 
        const p = dataStr.split('-'); 
        return `${p[2]}/${p[1]}/${p[0]}`; 
    };
    const dataF = fd(d.data_ficha);
    const h = `<html><head><style>@page{size:landscape;margin:0}body{font-family:Arial,sans-serif;margin:0;padding:0;height:100vh;width:100vw;display:flex;justify-content:center;align-items:center;overflow:hidden}.box{width:95vw;height:90vh;border:5px solid #000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center;padding:10px}.header-img{max-height:80px;margin-bottom:5px}.title{font-size:24px;font-weight:900;text-transform:uppercase;margin-bottom:5px;border-bottom:3px solid #000;display:inline-block;padding-bottom:5px}.label{font-size:20px;color:#333;font-weight:bold;text-transform:uppercase;margin-bottom:2px}.val-nome{font-size:60px;font-weight:900;text-transform:uppercase;line-height:1.1;margin-bottom:15px}.val-data{font-size:35px;font-weight:800;margin-bottom:15px}.val-local{font-size:30px;font-weight:800;text-transform:uppercase}</style></head><body><div class="box"><div><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="header-img"><br><div class="title">Identificação de Velório</div></div><div style="width:100%"><div class="label">Falecido(a)</div><div class="val-nome">${d.nome}</div></div><div><div class="label">Sepultamento</div><div class="val-data">${dataF} às ${d.hora}</div></div><div><div class="label">Local</div><div class="val-local">${d.cap}<br>${d.local || "CEMITÉRIO DO MARUÍ"}</div></div></div><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`;
    const w = window.open('','_blank'); if(w) { w.document.write(h); w.document.close(); } else { alert("Desbloqueie os pop-ups."); }
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

// --- COMPROVANTE EXATO BASEADO NA IMAGEM (CORRIGIDO) ---
window.gerarComprovante = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;

    const chk = (cond) => cond ? '(X)' : '( )';
    
    // DEFINIÇÃO CORRETA DA FUNÇÃO FD DENTRO DO ESCOPO
    const fd = (dataStr) => { 
        if (!dataStr) return ""; 
        const p = dataStr.split('-'); 
        return `${p[2]}/${p[1]}/${p[0]}`; 
    };

    const dh = new Date();
    // Extrai data e hora do protocolo (formato YYYYMMDD-HHmm)
    const p = d.protocolo || "";
    let dataProtocolo = "";
    let horaProtocolo = "";
    
    if (p.length >= 13 && p.indexOf('-') === 8) {
        const ano = p.substring(0,4);
        const mes = p.substring(4,6);
        const dia = p.substring(6,8);
        const hora = p.substring(9,11);
        const min = p.substring(11,13);
        dataProtocolo = `${dia}/${mes}/${ano}`;
        horaProtocolo = `${hora}:${min}`;
    } else {
        // Fallback
        dataProtocolo = `${dh.getDate().toString().padStart(2,'0')}/${(dh.getMonth()+1).toString().padStart(2,'0')}/${dh.getFullYear()}`;
        horaProtocolo = `${dh.getHours().toString().padStart(2,'0')}:${dh.getMinutes().toString().padStart(2,'0')}`;
    }
    
    // Checkboxes locais
    const im = (d.local && d.local.includes("MARUÍ"));
    const is = (d.local && d.local.includes("SÃO FRANCISCO"));
    const ii = (d.local && d.local.includes("ITAIPU"));
    const cc = (d.cap && !d.cap.toUpperCase().includes("SEM"));
    
    // Tempo Decorrido
    let tempoDecorrido = "";
    if (d.data_obito && d.hora_obito && d.hora && d.data_ficha) {
        const dtObito = new Date(d.data_obito + 'T' + d.hora_obito);
        const dtSepul = new Date(d.data_ficha + 'T' + d.hora);
        const diff = dtSepul - dtObito;
        if (diff > 0) {
            const diffHrs = Math.floor(diff / 3600000);
            const diffMins = Math.round(((diff % 3600000) / 60000));
            tempoDecorrido = `${diffHrs}h ${diffMins}min`;
        }
    }
    
    const ec = d.estado_civil || "";
    const chkEC = (val) => ec === val ? '(X)' : '( )';
    const relacao = d.parentesco ? `(${d.parentesco})` : '';

    // --- LÓGICA DO TEXTO DA SEPULTURA SELECIONADA ---
    let txtSep = "";
    const ts = d.tipo_sepultura || ""; 
    const co = d.classificacao_obito || "ADULTO"; 

    // COMPROVANTE: HORA ÓBITO (COM LÓGICA DE IGNORADO)
    let txtHoraObito = d.hora_obito;
    if (d.ignorar_hora_obito === 'SIM') txtHoraObito += " (IGNORADO)";

    let base = "";
    if (ts.includes("GAVETA")) base = "GAVETA";
    else if (ts.includes("CARNEIRO")) base = "CARNEIRO";
    else if (ts.includes("COVA")) base = "COVA RASA";
    else if (ts.includes("PERPETUA")) base = "PERPÉTUA";
    else if (ts.includes("MEMBRO")) base = "MEMBRO AMPUTADO";
    else base = ts;

    let classificacao = co;
    if (ts.includes("ANJO")) {
        classificacao = "ANJO";
    }

    if (base === "PERPÉTUA") {
        txtSep = `PERPÉTUA (LIVRO: ${d.livro_perpetua||'-'} / FOLHA: ${d.folha_perpetua||'-'}) - ${classificacao}`;
    } else if (base === "MEMBRO AMPUTADO") {
        txtSep = `MEMBRO AMPUTADO (${d.tipo_membro || 'Não informado'})`;
    } else {
        txtSep = `${base} - ${classificacao}`;
    }

    const htmlComprovante = `
    <html>
    <head>
        <title>Comprovante</title>
        <style>
            @page { size: A4 portrait; margin: 8mm; }
            body { font-family: Arial, sans-serif; font-size: 14px; margin: 0; padding: 10px; line-height: 1.3; color: #000; }
            .header { text-align: center; margin-bottom: 25px; position: relative; }
            .header h2 { font-size: 20px; text-decoration: underline; margin: 0; font-weight: bold; text-transform: uppercase; color: #000; }
            .protocolo { position: absolute; top: -5px; right: 0; font-size: 14px; font-weight: bold; border: 2px solid #000; padding: 5px 10px; }
            .content { width: 100%; }
            .line { margin-bottom: 4px; white-space: nowrap; overflow: hidden; }
            .bold { font-weight: 900; }
            .red { color: red; font-weight: bold; }
            
            .section-title { font-weight: 900; margin-top: 15px; margin-bottom: 2px; text-transform: uppercase; font-size: 14px; }
            
            .two-columns { display: flex; justify-content: space-between; margin-top: 10px; }
            .col-left { width: 60%; }
            .col-right { width: 38%; }
            
            .assinaturas-block { display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 10px; gap: 20px; }
            .ass-line { border-top: 1px solid #000; text-align: center; padding-top: 2px; flex: 1; font-size: 12px; }
            
            .obs-text { font-weight: bold; font-size: 12px; margin-top: 5px; }
            
            .box-lateral { border: 2px solid #000; padding: 5px; font-weight: 900; font-size: 12px; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
            .termo-juridico { text-align: justify; font-size: 12px; line-height: 1.3; }
            
            .footer-line { margin-top: 10px; border-top: 1px solid #000; padding-top: 5px; font-weight: 900; font-size: 12px; }
            .aviso-final { border: 2px solid #000; padding: 5px; margin-top: 10px; font-weight: 900; text-align: justify; font-size: 12px; line-height: 1.3; }
            
            .spacer { margin-left: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height: 60px; margin-bottom: 5px;">
            <h2>Comprovante de Atendimento</h2>
            <div class="protocolo">PROTOCOLO: ${p}</div>
        </div>

        <div class="content">
            <div class="line"><span class="bold">Nome do FALECIDO:</span> ${d.nome.toUpperCase()}</div>
            <div class="line"><span class="bold">Nome do RESPONSÁVEL:</span> ${(d.resp_nome || '').toUpperCase()} <span style="margin-left:5px; font-weight:normal;">${relacao}</span></div>
            <div class="line"><span class="bold">Funerária:</span> ${d.funeraria.toUpperCase()} <span style="margin-left:15px">(Rep: ${d.func_funeraria || 'N/A'})</span></div>
            
            <div class="line">
                <span class="bold">Atendente Responsável:</span> ${(d.atendente_sistema||'SISTEMA').toUpperCase()}
                <span class="bold" style="margin-left:20px">DATA DE HORARIO DE ATENDIMENTO:</span> ${dataProtocolo} AS ${horaProtocolo}
            </div>
            
            <div class="line">
                <span class="bold">Data:</span> ${fd(d.data_ficha)} 
                <span class="bold spacer">Hora:</span> ${d.hora} 
                <span class="bold spacer">SEPULTURA:</span> ${d.sepul} 
                <span class="bold spacer">
                    ${(d.local && d.local.includes("MARUÍ")) ? "QUADRA:" : "RUA:"}
                </span> ${d.qd} 
                <span class="bold spacer">CAPELA:</span> ${d.cap}
            </div>
            
            <div class="line">
                <span class="bold">COM CAPELA</span> ${chk(cc)} <span class="bold">SEM CAPELA</span> ${chk(!cc)} 
                <span class="bold spacer">DATA DO FALECIMENTO:</span> ${fd(d.data_obito)} AS ${txtHoraObito} 
                <span class="red spacer">[${tempoDecorrido}]</span>
            </div>
            
            <div class="line">
                <span class="bold">Cemitério:</span> (${im?'X':' '}) MARUÍ (${is?'X':' '}) SÃO FRANCISCO XAVIER (${ii?'X':' '}) SÃO LÁZARO DE ITAIPÚ
            </div>
            
            <div class="line">
                ${chkEC('SOLTEIRO')} SOLTEIRO ${chkEC('CASADO')} CASADO ${chkEC('VIUVO')} VÍUVO ${chkEC('UNIAO_ESTAVEL')} UNIÃO ESTÁVEL ${chkEC('DIVORCIADO')} DIVORCIADO ${chkEC('IGNORADO')} IGNORADO
            </div>

            <div class="section-title">ASSINAR TERMO DE COMPROMISSO NO CEMITÉRIO</div>
            
            <div class="line" style="margin-top:5px; font-size:14px; border: 1px solid #000; padding: 5px;">
                <span class="bold">TIPO DE SEPULTURA SELECIONADA:</span> ${txtSep}
            </div>

            <div class="line" style="margin-top:10px">
                <span class="bold">TANATO:</span> (${d.tanato==='SIM'?'X':' '}) SIM (${d.tanato==='NAO'?'X':' '}) NÃO
            </div>

            <div class="assinaturas-block">
                <div class="ass-line">
                    Acolhimento / Atendente:<br>
                    <b>${(d.atendente_sistema||'').toUpperCase()}</b>
                </div>
                <div class="ass-line">
                    Assinatura do responsável/família<br>
                    <b>${(d.resp_nome||'').toUpperCase()}</b>
                </div>
            </div>

            <div class="obs-box">OBS: PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.</div>
            <div class="obs-box">OBS.: VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.</div>

            <div class="two-columns">
                <div class="col-left">
                    <div style="text-align:center; font-weight:bold; text-decoration:underline; margin-bottom:5px;">TERMO DE COMPROMISSO CEMITÉRIOS MUNICIPAIS</div>
                    <div class="termo-juridico">
                        Sendo o <span class="bold">FALECIDO CASADO</span>, o responsável perante, o Cemitério do MARUÍ, SÃO FRANCISCO E ITAIPU será obrigatoriamente o <span class="bold">CONJUGE</span>.<br>
                        Sendo o <span class="bold">FALECIDO VIÚVO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU serão obrigatoriamente os <span class="bold">FILHOS</span>.<br>
                        Sendo o <span class="bold">FALECIDO SOLTEIRO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU obrigatoriamente os <span class="bold">FILHOS, PAIS, IRMÃOS</span>.<br>
                        Será exigida a apresentação de documentos de <span class="bold" style="text-decoration:underline">IDENTIDADE e CPF</span>.
                    </div>
                    
                    <div class="assinaturas-block" style="margin-top: 40px;">
                         <div style="flex:1;"></div>
                         <div class="ass-line">Assinatura funcionário/família</div>
                    </div>
                </div>

                <div class="col-right">
                    <div class="box-lateral">
                        <div>CAPELAS MUNICIPAIS E PARTICULARES:</div>
                        <br>
                        <div>PAGAMENTO E NOTA FISCAL DAS TAXAS MUNICIPAIS E INVOL COM DUAS HORAS ANTES DO SEPULTAMENTO</div>
                        <br><br>
                        <div>CLIENTE: _____________________</div>
                    </div>
                </div>
            </div>

            <div class="footer-line">
                MARCADO: ________________________ PERMISSIONÁRIO: ${(d.resp_nome || '').toUpperCase()}
            </div>
            <div style="font-weight:bold; font-size:12px; margin-top:5px;">
                TEL: ${d.telefone||''}
            </div>

            <div class="aviso-final">
                <span style="text-decoration:underline">COMUNICADO AOS FAMILIARES DO FALECIDO E AS EMPRESAS FUNERÁRIAS RESPONSÁVEIS PELO SEPULTAMENTO.</span><br>
                Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos:<span class="bold">GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL PELO SERVIÇO), TAXAS MUNICIPAIS PAGAS e INVOL.</span>
            </div>
        </div>
    </body>
    <script>window.onload=function(){window.print()}</script>
    </html>`;
    
    const w = window.open('','_blank');
    w.document.write(htmlComprovante);
    w.document.close();
}