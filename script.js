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
window.idLiberacaoAtual = null;

// VARIÁVEIS GLOBAIS PARA ASSINATURA E DASHBOARD
let signaturePad = null;
let isDrawing = false;
let assinaturaResponsavelImg = null;
let assinaturaAtendenteImg = null;
let tipoAssinaturaAtual = ''; 
let dashboardAtual = 'acolhimento'; // Controla qual painel está ativo

try {
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("Conectado ao Firebase.");
    }
} catch (e) { 
    console.error("Erro Firebase:", e); 
}

function getDB() {
    if (!db && typeof firebase !== 'undefined') {
        try { 
            firebase.initializeApp(firebaseConfig); 
            db = firebase.firestore(); 
        } catch(e) { 
            if(firebase.apps.length) db = firebase.firestore(); 
        }
    }
    return db;
}

const dimensoesUrna = { 
    'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70', 
    'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80', 
    'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85', 
    '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95', 
    'PERPETUA': '' 
};

function safeDisplay(id, displayType) {
    const el = document.getElementById(id);
    if (el) el.style.display = displayType;
}

// --- NAVEGAÇÃO DE DASHBOARDS (ACOLHIMENTO x AGÊNCIA) ---
window.alternarDashboard = function(dash) {
    dashboardAtual = dash;
    const btnAcolhimento = document.getElementById('nav-btn-acolhimento');
    const btnAgencia = document.getElementById('nav-btn-agencia');
    const divAcolhimento = document.getElementById('dashboard-acolhimento');
    const divAgencia = document.getElementById('dashboard-agencia');

    if (dash === 'agencia') {
        btnAcolhimento.classList.remove('active');
        btnAgencia.classList.add('active');
        divAcolhimento.classList.add('hidden');
        divAgencia.classList.remove('hidden');
    } else {
        btnAgencia.classList.remove('active');
        btnAcolhimento.classList.add('active');
        divAgencia.classList.add('hidden');
        divAcolhimento.classList.remove('hidden');
    }

    // Força a atualização da lista ativa para renderizar a tabela certa
    const dataFiltro = document.getElementById('filtro-data').value;
    const localFiltro = document.getElementById('filtro-local').value;
    window.atualizarListener(dataFiltro, localFiltro);
}

// --- BUSCA CEP E CPF ---
window.buscarCEP = function(cep) {
    cep = cep.replace(/\D/g, '');
    if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(res => res.json())
            .then(data => {
                if (!data.erro) {
                    document.getElementById('resp_endereco').value = data.logradouro.toUpperCase();
                    document.getElementById('resp_bairro').value = data.bairro.toUpperCase();
                    document.getElementById('resp_cidade').value = data.localidade.toUpperCase();
                    document.getElementById('resp_uf').value = data.uf.toUpperCase();
                    document.getElementById('resp_numero').focus();
                }
            })
            .catch(err => console.error("Erro ao buscar CEP:", err));
    }
}

window.buscarPorCPF = function() {
    let cpfInput = document.getElementById('resp_cpf').value.replace(/\D/g, '');
    if (!cpfInput) { alert("Digite um CPF válido."); return; }
    
    const db = getDB();
    db.collection("atendimentos").where("resp_cpf", "==", cpfInput).limit(1).get()
        .then(snap => {
            if (!snap.empty) {
                const d = snap.docs[0].data();
                if(d.resp_nome) document.getElementById('resp_nome').value = d.resp_nome;
                if(d.resp_rg) document.getElementById('resp_rg').value = d.resp_rg;
                if(d.telefone) document.getElementById('telefone').value = d.telefone;
                if(d.resp_cep) document.getElementById('resp_cep').value = d.resp_cep;
                if(d.resp_endereco) document.getElementById('resp_endereco').value = d.resp_endereco;
                if(d.resp_numero) document.getElementById('resp_numero').value = d.resp_numero;
                if(d.resp_complemento) document.getElementById('resp_complemento').value = d.resp_complemento;
                if(d.resp_bairro) document.getElementById('resp_bairro').value = d.resp_bairro;
                if(d.resp_cidade) document.getElementById('resp_cidade').value = d.resp_cidade;
                if(d.resp_uf) document.getElementById('resp_uf').value = d.resp_uf;
                alert("Dados do contribuinte preenchidos com sucesso!");
            } else {
                alert("Nenhum cadastro prévio encontrado com este CPF.");
            }
        });
}

// --- LÓGICA DE INDIGENTE ---
window.toggleIndigente = function() {
    const chk = document.getElementById('chk_indigente');
    const camposObrigatorios = [
        'resp_nome', 'resp_cpf', 'resp_endereco', 'resp_numero', 'resp_bairro', 'resp_cidade',
        'telefone', 'funeraria', 'isencao', 'tipo_sepultura', 
        'sepul', 'qd', 'hospital', 'cap', 'data_obito', 'nome', 'causa', 'hora'
    ];

    camposObrigatorios.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (chk && chk.checked) {
                if (el.hasAttribute('required')) {
                    el.removeAttribute('required');
                    el.setAttribute('data-was-required', 'true');
                }
            } else {
                if (el.getAttribute('data-was-required') === 'true') {
                     el.setAttribute('required', '');
                     el.removeAttribute('data-was-required');
                }
            }
        }
    });
}

// --- LÓGICA DE ASSINATURA DIGITAL ---
function setupSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    function getPos(canvas, evt) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        
        if (evt.touches && evt.touches.length > 0) {
            clientX = evt.touches[0].clientX;
            clientY = evt.touches[0].clientY;
        } else {
            clientX = evt.clientX;
            clientY = evt.clientY;
        }

        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startDraw(e) {
        if(e.type === 'touchstart') e.preventDefault();
        isDrawing = true;
        const pos = getPos(canvas, e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        if(e.type === 'touchmove') e.preventDefault();
        const pos = getPos(canvas, e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }

    function endDraw(e) {
        if(e.type === 'touchend') e.preventDefault();
        isDrawing = false;
    }

    canvas.removeEventListener('mousedown', startDraw);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', endDraw);
    canvas.removeEventListener('mouseout', endDraw);
    canvas.removeEventListener('touchstart', startDraw);
    canvas.removeEventListener('touchmove', draw);
    canvas.removeEventListener('touchend', endDraw);

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseout', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw, { passive: false });
}

window.abrirModalAssinatura = function(tipo) {
    tipoAssinaturaAtual = tipo;
    const titulo = document.getElementById('titulo-assinatura');
    if(titulo) {
        titulo.innerText = (tipo === 'responsavel') ? 'Assinatura do Responsável' : 'Assinatura da Equipe';
    }
    safeDisplay('modal-assinatura', 'flex');
    window.limparAssinatura(); 
    setTimeout(setupSignaturePad, 200); 
}

window.fecharModalAssinatura = function() {
    safeDisplay('modal-assinatura', 'none');
}

window.limparAssinatura = function() {
    const canvas = document.getElementById('signature-pad');
    if(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

window.salvarAssinatura = function() {
    const canvas = document.getElementById('signature-pad');
    if (canvas) {
        const imgData = canvas.toDataURL('image/png');
        const db = getDB();
        
        if (dadosAtendimentoAtual && dadosAtendimentoAtual.id) {
            let updateData = {};
            
            if (tipoAssinaturaAtual === 'responsavel') {
                assinaturaResponsavelImg = imgData; 
                dadosAtendimentoAtual.assinatura_responsavel = imgData; 
                updateData = { assinatura_responsavel: imgData };
            } else {
                assinaturaAtendenteImg = imgData; 
                dadosAtendimentoAtual.assinatura_atendente = imgData; 
                updateData = { assinatura_atendente: imgData };
            }

            db.collection("atendimentos").doc(dadosAtendimentoAtual.id).update(updateData)
                .then(() => console.log("Assinatura salva no banco."))
                .catch(err => console.error("Erro ao salvar:", err));
        } else {
            console.error("ID não encontrado para salvar assinatura.");
        }
        window.fecharModalAssinatura();
    }
}

// --- LÓGICA DE TRANSFERÊNCIA DE CEMITÉRIO ---
window.abrirModalTransferir = function() {
    if(!dadosAtendimentoAtual) return;
    const select = document.getElementById('novo_cemiterio_transferencia');
    if(select) select.value = dadosAtendimentoAtual.local || "CEMITÉRIO DO MARUÍ";
    safeDisplay('modal-transferir', 'flex');
}

window.fecharModalTransferir = function() {
    safeDisplay('modal-transferir', 'none');
}

window.confirmarTransferencia = function() {
    if(!dadosAtendimentoAtual || !dadosAtendimentoAtual.id) return;
    const novoLocal = document.getElementById('novo_cemiterio_transferencia').value;
    const localAntigo = dadosAtendimentoAtual.local || "CEMITÉRIO DO MARUÍ";
    
    if(novoLocal === localAntigo) {
        alert("O atendimento já está neste cemitério.");
        return;
    }

    if(confirm(`Confirmar transferência de ${localAntigo} para ${novoLocal}?`)) {
        const db = getDB();
        db.collection("atendimentos").doc(dadosAtendimentoAtual.id).update({ local: novoLocal })
        .then(() => {
            db.collection("auditoria").add({ 
                data_log: new Date().toISOString(), 
                usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', 
                acao: "TRANSFERÊNCIA", 
                detalhe: `ID: ${dadosAtendimentoAtual.id} | De: ${localAntigo} Para: ${novoLocal}` 
            });
            alert("Atendimento transferido com sucesso!");
            window.fecharModalTransferir();
            window.fecharModalVisualizar();
        })
        .catch(err => {
            console.error("Erro na transferência:", err);
            alert("Erro ao transferir.");
        });
    }
}

// --- 2. UTILITÁRIOS GLOBAIS ---
window.gerarProtocolo = function() {
    const elData = document.getElementById('data_ficha_modal');
    const agora = new Date();
    let ano, mes, dia;
    if (elData && elData.value) { 
        const p = elData.value.split('-'); 
        ano = p[0]; 
        mes = p[1]; 
        dia = p[2]; 
    } else { 
        ano = agora.getFullYear(); 
        mes = String(agora.getMonth()+1).padStart(2,'0'); 
        dia = String(agora.getDate()).padStart(2,'0'); 
    }
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
    if(!uf) { 
        if(elCidade) { 
            elCidade.innerHTML = '<option value="">UF</option>'; 
            elCidade.disabled = true; 
        } 
        return; 
    }
    if(elCidade) {
        elCidade.innerHTML = '<option>...</option>'; 
        elCidade.disabled = true;
        fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
        .then(r=>r.json())
        .then(c=>{
            elCidade.innerHTML = '<option>Selecione</option>';
            c.sort((a,b)=>a.nome.localeCompare(b.nome));
            c.forEach(i=>{ 
                const o=document.createElement('option'); 
                o.value=i.nome.toUpperCase(); 
                o.text=i.nome.toUpperCase(); 
                elCidade.appendChild(o); 
            });
            elCidade.disabled=false;
        });
    }
}

window.carregarListaHorarios = function() {
    const select = document.getElementById('hora');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione...</option>';
    const horarios = [ 
        "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30", "09:45", 
        "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45", 
        "12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45", 
        "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45", 
        "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30" 
    ];
    horarios.forEach(hora => { 
        const option = document.createElement('option'); 
        option.value = hora; 
        option.textContent = hora; 
        select.appendChild(option); 
    });
}

// --- 3. CORE (TABELAS PRINCIPAIS) ---

window.renderizarTabela = function(lista) {
    const tbody = document.getElementById('tabela-corpo-acolhimento'); 
    if(!tbody) return;
    
    tbody.innerHTML = ''; 
    
    if (lista.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="11" style="padding:40px; text-align:center;">Nenhum registro encontrado no acolhimento.</td></tr>'; 
        return; 
    }

    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => window.visualizar(item.id);
        
        let isContagioso = false;
        if(item.causa) { 
            const c = item.causa.toUpperCase(); 
            isContagioso = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HIV', 'SIDA', 'SARAMPO'].some(d => c.includes(d)); 
        }
        if (isContagioso) tr.classList.add('alerta-doenca');
        
        let displayResponsavel = "";
        if (item.isencao === "50") {
            displayResponsavel += `<span style="font-weight:900;">ACOLHIMENTO 50%</span>`;
        } else if (item.isencao === "SIM") {
            displayResponsavel += `<span style="font-weight:900;">ACOLHIMENTO 100%</span>`;
        } else {
             if (item.funeraria) displayResponsavel += `<span style="font-weight:bold;">${item.funeraria.toUpperCase()}</span>`;
             else if (item.resp_nome) displayResponsavel += `<span style="font-weight:bold;">${item.resp_nome.toUpperCase()}</span>`;
             else displayResponsavel = 'S/D';
        }
        displayResponsavel += '<br>';
        
        if (item.tipo_urna_detalhe) {
            displayResponsavel += `<span style="font-weight:bold; font-size:11px;">${item.tipo_urna_detalhe.toUpperCase()}</span>`;
        }
        if (item.combo_urna) {
            displayResponsavel += `<br><span style="font-size:10px;">URNA ${item.combo_urna}</span>`;
            if (dimensoesUrna[item.combo_urna]) {
                displayResponsavel += `<br><span style="font-size:9px; color:#666;">${dimensoesUrna[item.combo_urna]}</span>`;
            }
        }
        
        let servicosExtras = [];
        if (item.tanato === 'SIM') servicosExtras.push('TANATOPRAXIA');
        if (item.invol === 'SIM') servicosExtras.push('INVOL');
        if (item.translado === 'SIM') servicosExtras.push('TRANSLADO');
        if (item.urna_opc === 'SIM') servicosExtras.push('URNA');
        if (servicosExtras.length > 0) { 
            displayResponsavel += `<br><span style="font-size:10px; font-weight:bold;">SERVIÇOS: ${servicosExtras.join(', ')}</span>`; 
        }

        const conteudoNome = `
            <div style="font-weight:bold;">${isContagioso ? '⚠️ ' : ''}${item.nome ? item.nome.toUpperCase() : 'NOME NÃO INFORMADO'}</div>
            <div style="color:red; font-size:10px; font-weight:bold; margin-top:2px;">(${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})</div>
            ${item.classificacao_obito === 'ANJO' ? '<div style="font-size:9px; color:blue; font-weight:bold;">(ANJO)</div>' : ''}
        `;

        let labelPerpetua = "";
        const tipoSep = (item.tipo_sepultura || "").toUpperCase();
        if (item.perpetua === 'X' || tipoSep.includes('PERPETU')) {
             let labelTexto = tipoSep.replace('PERPETUA', 'PERPÉTUA').replace('PERPETUO', 'PERPÉTUO');
             if(labelTexto === "") labelTexto = "PERPÉTUA";
             labelPerpetua = `
                <div style="font-weight:bold; font-size:10px; color:#2196F3; margin-top:2px;">${labelTexto}</div>
                <div style="font-weight:bold; font-size:10px; color:#2196F3;">L: ${item.livro_perpetua||''} F: ${item.folha_perpetua||''}</div>
             `;
        }
        let conteudoSepultura = `<div style="font-weight:bold; font-size:13px; color:#333;">${item.sepul||''}</div>${labelPerpetua}`;

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
        const cleanCoords = item.geo_coords ? item.geo_coords.replace(/[^0-9.,\-]/g, '') : '';
        if (cleanCoords && cleanCoords.includes(',')) {
             btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('https://maps.google.com/maps?q=${cleanCoords}', '_blank')" title="Ver Localização">📍</button>`;
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
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Renderiza a Tabela da Agência Funerária (CARDS)
window.renderizarTabelaAgencia = function(lista) {
    const container = document.getElementById('tabela-corpo-agencia'); 
    if(!container) return;
    
    container.innerHTML = ''; 
    
    if (lista.length === 0) { 
        container.innerHTML = '<div style="grid-column: 1 / -1; padding:40px; text-align:center; color:#64748b; font-weight:500;">Nenhum registro encontrado para a Agência.</div>'; 
        return; 
    }

    lista.forEach(item => {
        const card = document.createElement('div');
        card.className = 'agencia-card';
        
        let statusGRM = item.agencia_grm || 'PENDENTE';
        let badgeGRM = `<span class="badge-status ${statusGRM === 'PENDENTE' ? 'badge-pendente' : 'badge-sucesso'}">${statusGRM}</span>`;
        
        let statusLib = item.agencia_status_liberacao || 'PENDENTE';
        let badgeLib = `<span class="badge-status ${statusLib === 'PENDENTE' ? 'badge-pendente' : 'badge-sucesso'}">${statusLib === 'LIBERADO' ? 'LIBERADO' : 'AGUARDANDO'}</span>`;

        let docsHTML = "";
        docsHTML += `<span class="doc-chip ${item.agencia_chk_invol ? 'tem' : ''}">INVOL</span>`;
        docsHTML += `<span class="doc-chip ${item.agencia_chk_nf ? 'tem' : ''}">NF</span>`;
        docsHTML += `<span class="doc-chip ${item.agencia_chk_tanato ? 'tem' : ''}">TANATO</span>`;
        docsHTML += `<span class="doc-chip ${item.agencia_chk_comprovante ? 'tem' : ''}">COMP. PGTO</span>`;

        let borderColor = statusLib === 'LIBERADO' ? '#10b981' : (statusGRM !== 'PENDENTE' ? '#f59e0b' : '#3b82f6');
        card.style.borderTopColor = borderColor;

        let btnAssumir = '';
        if (!item.agencia_atendente) {
            btnAssumir = `<button class="btn-novo" style="background:#3b82f6; color:white; width:auto; padding: 6px 12px; font-size: 12px;" onclick="window.assumirProcessoAgencia('${item.id}')" title="Assumir Atendimento">🙋‍♂️ Assumir</button>`;
        }

        card.innerHTML = `
            <div class="agencia-card-header">
                <div class="agencia-card-title">${(item.nome || 'NÃO INFORMADO').toUpperCase()}</div>
                <div class="agencia-card-subtitle">Sepultamento: ${item.data_ficha || ''} às ${item.hora || ''}</div>
            </div>
            <div class="agencia-card-body">
                <div class="agencia-info-row">
                    <span class="agencia-info-label">E-CIGA:</span>
                    <span class="agencia-info-value" style="font-family:monospace; font-size:13px; color:#0ea5e9;">${item.agencia_processo || 'S/ PROCESSO'}</span>
                </div>
                <div class="agencia-info-row">
                    <span class="agencia-info-label">Resp. Agência:</span>
                    <span class="agencia-info-value" style="color: #3b82f6;">${(item.agencia_atendente || 'AGUARDANDO').toUpperCase()}</span>
                </div>
                <div class="agencia-info-row">
                    <span class="agencia-info-label">Funerária:</span>
                    <span class="agencia-info-value">${(item.funeraria || 'N/I').toUpperCase()}</span>
                </div>
                <div class="agencia-info-row">
                    <span class="agencia-info-label">GRM:</span>
                    <span class="agencia-info-value">${badgeGRM}</span>
                </div>
                <div class="agencia-info-row">
                    <span class="agencia-info-label">Liberação:</span>
                    <span class="agencia-info-value">${badgeLib}</span>
                </div>
                <div style="margin-top: 5px;">
                    <span class="agencia-info-label" style="display:block; margin-bottom:5px; font-size:10px;">ANEXOS FÍSICOS/DIGITAIS:</span>
                    <div>${docsHTML}</div>
                </div>
            </div>
            <div class="agencia-card-footer">
                <div style="display:flex; gap:5px;">
                    ${btnAssumir}
                    <button class="btn-novo" style="background:#f1f5f9; color:#ea580c; border: 1px solid #cbd5e1; width:auto; padding: 6px 12px; font-size: 12px;" onclick="window.abrirModalAgencia('${item.id}')" title="Trâmites E-Ciga / GRM">✏️ Editar</button>
                </div>
                <button class="btn-novo" style="background:${statusLib === 'LIBERADO' ? '#10b981' : '#e2e8f0'}; color:${statusLib === 'LIBERADO' ? 'white' : '#94a3b8'}; width:auto; padding: 6px 12px; font-size: 12px;" onclick="window.abrirModalLiberacao('${item.id}')" ${statusLib !== 'LIBERADO' ? 'disabled style="cursor:not-allowed;"' : ''} title="Imprimir Liberação">✅ Liberação</button>
            </div>
        `;
        container.appendChild(card);
    });
}

window.assumirProcessoAgencia = function(id) {
    if (!usuarioLogado || !usuarioLogado.nome) { alert("Você precisa estar logado para assumir um processo."); return; }
    if (confirm("Deseja assumir a responsabilidade por este processo?")) {
        const db = getDB();
        db.collection("atendimentos").doc(id).update({
            agencia_atendente: usuarioLogado.nome
        }).then(() => {
            db.collection("auditoria").add({
                data_log: new Date().toISOString(),
                usuario: usuarioLogado.nome,
                acao: "ASSUMIU AGÊNCIA",
                detalhe: `ID: ${id}`
            });
        }).catch(e => {
            console.error("Erro ao assumir:", e);
            alert("Erro ao assumir atendimento.");
        });
    }
}

window.assumirProcessoAgenciaModal = function() {
    if (!usuarioLogado || !usuarioLogado.nome) { alert("Faça login."); return; }
    const id = document.getElementById('agencia_docId').value;
    if(confirm("Deseja assumir este processo para você?")) {
         getDB().collection("atendimentos").doc(id).update({ 
             agencia_atendente: usuarioLogado.nome 
         }).then(() => {
             document.getElementById('agencia_atendente_modal').innerText = usuarioLogado.nome.toUpperCase();
         });
    }
}

// FUNÇÃO DE BUSCA
window.realizarBusca = function() {
    const termo = document.getElementById('input-busca').value.trim().toUpperCase();
    if (!termo) { 
        alert("Digite um nome para buscar."); 
        return; 
    }
    
    const database = getDB();
    if (!database) return;

    if (unsubscribe) unsubscribe();
    
    unsubscribe = database.collection("atendimentos")
        .orderBy("nome")
        .startAt(termo)
        .endAt(termo + "\uf8ff")
        .limit(20)
        .onSnapshot((snap) => {
            let lista = [];
            snap.forEach(doc => {
                let d = doc.data();
                d.id = doc.id;
                lista.push(d);
            });
            if (dashboardAtual === 'acolhimento') {
                window.renderizarTabela(lista);
            } else {
                window.renderizarTabelaAgencia(lista);
            }
        });
}

window.atualizarListener = function(data, local) {
    const database = getDB(); 
    if(!database) return;
    
    if (unsubscribe) unsubscribe();
    
    unsubscribe = database.collection("atendimentos")
        .where("data_ficha", "==", data)
        .onSnapshot((snap) => {
            let lista = [];
            snap.forEach(doc => { 
                let d = doc.data(); 
                d.id = doc.id; 
                if ((d.local || "CEMITÉRIO DO MARUÍ") === local) {
                    lista.push(d); 
                }
            });
            lista.sort((a,b) => (a.hora < b.hora ? -1 : 1));
            
            if (dashboardAtual === 'acolhimento') {
                window.renderizarTabela(lista);
            } else {
                window.renderizarTabelaAgencia(lista);
            }
        });
}

// --- 4. LOGIN E ADMIN ---
window.fazerLogin = function() {
    const u = document.getElementById('login-usuario').value.trim();
    const p = document.getElementById('login-senha').value.trim();
    
    if (p === "2026") { 
        usuarioLogado = {nome:"Admin", login:"admin"}; 
        window.liberarAcesso(); 
        return; 
    }
    
    const database = getDB();
    if (!database) { 
        alert("Sem conexão com banco."); 
        return; 
    }
    
    database.collection("equipe").where("login", "==", u).where("senha", "==", p).get()
        .then(snap => {
            if (!snap.empty) { 
                usuarioLogado = snap.docs[0].data(); 
                window.liberarAcesso(); 
            } else { 
                alert("Dados incorretos."); 
            }
        });
}

window.liberarAcesso = function() {
    safeDisplay('tela-bloqueio', 'none');
    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
    const il = document.getElementById('filtro-local');
    if(il) { 
        window.atualizarListener(window.pegarDataAtualLocal(), il.value); 
        window.atualizarLabelQuadra(il.value); 
    }
}

window.abrirAdmin = function() { 
    safeDisplay('modal-admin', 'block'); 
    window.abrirAba('tab-equipe'); 
}

window.fecharModalAdmin = function() { 
    safeDisplay('modal-admin', 'none'); 
}

window.abrirAba = function(id) {
    Array.from(document.getElementsByClassName('tab-pane')).forEach(e => e.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    const buttons = document.querySelectorAll('.tab-header .tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (id === 'tab-equipe') buttons[0].classList.add('active');
    if (id === 'tab-contribuintes') buttons[1].classList.add('active');
    if (id === 'tab-backup') buttons[2].classList.add('active');
    if (id === 'tab-stats') buttons[3].classList.add('active');
    if (id === 'tab-logs') buttons[4].classList.add('active');

    if(id==='tab-equipe') window.listarEquipe();
    if(id==='tab-logs') window.carregarLogs();
    if(id==='tab-stats') window.carregarEstatisticas('7');
}

// --- ESTATÍSTICAS ---
window.carregarEstatisticas = function(modo) {
    const database = getDB();
    if(!database) return;
    
    let dInicio = new Date();
    let dString = "";

    if (modo === 'custom') {
        const inputMonth = document.getElementById('filtro-mes-ano');
        if(inputMonth && inputMonth.value) {
            dString = inputMonth.value; 
        } else { 
            alert("Selecione Mês e Ano."); 
            return; 
        }
    } else {
        if (modo === 'mes') {
            dInicio = new Date(dInicio.getFullYear(), dInicio.getMonth(), 1);
        } else {
            dInicio.setDate(dInicio.getDate() - parseInt(modo));
        }
        dString = dInicio.toISOString().split('T')[0];
    }
    
    database.collection("atendimentos").where("data_ficha", ">=", dString).onSnapshot(snap => {
        let causas = {};
        let atendentes = {};
        
        snap.forEach(doc => {
            const d = doc.data();
            
            if (modo === 'custom') { 
                const checkStr = document.getElementById('filtro-mes-ano').value;
                if (!d.data_ficha.startsWith(checkStr)) return; 
            }
            
            // Contagem Causas
            if(d.causa) { 
                d.causa.split('/').forEach(c => { 
                    const k = c.trim().toUpperCase(); 
                    if(k) causas[k] = (causas[k] || 0) + 1; 
                }); 
            }

            // Contagem Atendentes
            if(d.atendente_sistema) {
                const func = d.atendente_sistema.trim().toUpperCase();
                if(func) atendentes[func] = (atendentes[func] || 0) + 1;
            }
        });
        
        // Renderizar Gráfico de Causas
        const ctxCausas = document.getElementById('grafico-causas');
        if(ctxCausas && window.Chart) {
            const sortedCausas = Object.entries(causas).sort((a,b) => b[1] - a[1]).slice(0, 10);
            if(chartInstances['causas']) chartInstances['causas'].destroy();
            chartInstances['causas'] = new Chart(ctxCausas, {
                type: 'bar',
                data: { 
                    labels: sortedCausas.map(x => x[0]), 
                    datasets: [{ label: 'Top 10 Causas', data: sortedCausas.map(x => x[1]), backgroundColor: '#3b82f6' }] 
                },
                options: { indexAxis: 'y', maintainAspectRatio: false }
            });
            dadosEstatisticasExportacao = sortedCausas.map(([c,q]) => ({"Causa": c, "Qtd": q}));
        }

        // Renderizar Gráfico de Atendentes
        const ctxAtend = document.getElementById('grafico-atendentes');
        if(ctxAtend && window.Chart) {
            const sortedAtend = Object.entries(atendentes).sort((a,b) => b[1] - a[1]);
            if(chartInstances['atendentes']) chartInstances['atendentes'].destroy();
            chartInstances['atendentes'] = new Chart(ctxAtend, {
                type: 'bar',
                data: { 
                    labels: sortedAtend.map(x => x[0]), 
                    datasets: [{ label: 'Atendimentos por Funcionário', data: sortedAtend.map(x => x[1]), backgroundColor: '#10b981' }] 
                },
                options: { indexAxis: 'y', maintainAspectRatio: false }
            });
        }
    });
}

// --- BUSCA CONTRIBUINTES (ADMIN) ---
window.buscarContribuintes = function() {
    const termo = document.getElementById('input-busca-contribuinte').value.trim().toUpperCase();
    const ul = document.getElementById('lista-contribuintes');
    
    if (!termo) {
        ul.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b; font-weight: 500;">Digite um termo para buscar.</li>';
        return;
    }

    ul.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b;">Buscando...</li>';

    const db = getDB();
    db.collection("atendimentos").get().then(snap => {
        let contribuintesMap = {};

        snap.forEach(doc => {
            let d = doc.data();
            let cpf = d.resp_cpf ? d.resp_cpf.replace(/\D/g, '') : '';
            let nome = (d.resp_nome || '').toUpperCase();
            let rg = d.resp_rg || '';
            let tel = d.telefone || '';

            if (cpf.includes(termo.replace(/\D/g, '')) || nome.includes(termo) || rg.includes(termo) || tel.includes(termo)) {
                let key = cpf || nome;
                if (key && !contribuintesMap[key]) {
                    contribuintesMap[key] = {
                        id: doc.id, 
                        cpf: d.resp_cpf || '',
                        nome: d.resp_nome || '',
                        rg: d.resp_rg || '',
                        telefone: d.telefone || '',
                        endereco: d.resp_endereco || '',
                        numero: d.resp_numero || '',
                        bairro: d.resp_bairro || '',
                        cidade: d.resp_cidade || '',
                        uf: d.resp_uf || '',
                        cep: d.resp_cep || '',
                        complemento: d.resp_complemento || ''
                    };
                }
            }
        });

        let results = Object.values(contribuintesMap);
        
        ul.innerHTML = '';
        if (results.length === 0) {
            ul.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b;">Nenhum contribuinte encontrado.</li>';
            return;
        }

        results.forEach(c => {
            let enderecoCompleto = c.endereco ? `${c.endereco}, ${c.numero} - ${c.bairro}` : 'Não informado';
            ul.innerHTML += `
            <li class="table-equipe-row">
                <div style="flex: 2; font-weight: 600; color: #1e293b;">${c.nome}</div>
                <div style="flex: 1.5; color: #475569; font-size: 13px;">${c.cpf} <br> <span style="font-size: 11px; color: #94a3b8;">RG: ${c.rg || '-'}</span></div>
                <div style="flex: 1.5; color: #475569; font-size: 13px;">${c.telefone}</div>
                <div style="flex: 2; color: #475569; font-size: 12px; line-height: 1.2;">${enderecoCompleto}</div>
                <div style="width: 60px; display: flex; justify-content: flex-end;">
                    <button class="btn-action-edit" onclick="editarContribuinte('${c.cpf}', '${c.nome}')" title="Editar Contribuinte">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
            </li>`;
        });
    });
}

window.editarContribuinte = function(cpf, nome) {
    const db = getDB();
    let query = db.collection("atendimentos");
    
    if (cpf) {
        query = query.where("resp_cpf", "==", cpf);
    } else {
        query = query.where("resp_nome", "==", nome);
    }

    query.limit(1).get().then(snap => {
        if (!snap.empty) {
            let d = snap.docs[0].data();
            document.getElementById('edit-contribuinte-cpf-original').value = cpf || nome; 
            
            document.getElementById('edit-contribuinte-nome').value = d.resp_nome || '';
            document.getElementById('edit-contribuinte-cpf').value = d.resp_cpf || '';
            document.getElementById('edit-contribuinte-rg').value = d.resp_rg || '';
            document.getElementById('edit-contribuinte-telefone').value = d.telefone || '';
            document.getElementById('edit-contribuinte-cep').value = d.resp_cep || '';
            document.getElementById('edit-contribuinte-endereco').value = d.resp_endereco || '';
            document.getElementById('edit-contribuinte-numero').value = d.resp_numero || '';
            document.getElementById('edit-contribuinte-complemento').value = d.resp_complemento || '';
            document.getElementById('edit-contribuinte-bairro').value = d.resp_bairro || '';
            document.getElementById('edit-contribuinte-cidade').value = d.resp_cidade || '';
            document.getElementById('edit-contribuinte-uf').value = d.resp_uf || '';

            document.getElementById('div-tabela-contribuintes').classList.add('hidden');
            document.getElementById('box-busca-contribuinte').classList.add('hidden');
            document.getElementById('div-editar-contribuinte').classList.remove('hidden');
        }
    });
}

window.cancelarEdicaoContribuinte = function() {
    document.getElementById('div-editar-contribuinte').classList.add('hidden');
    document.getElementById('div-tabela-contribuintes').classList.remove('hidden');
    document.getElementById('box-busca-contribuinte').classList.remove('hidden');
}

window.buscarCEPEdicao = function(cep) {
    cep = cep.replace(/\D/g, '');
    if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(res => res.json())
            .then(data => {
                if (!data.erro) {
                    document.getElementById('edit-contribuinte-endereco').value = data.logradouro.toUpperCase();
                    document.getElementById('edit-contribuinte-bairro').value = data.bairro.toUpperCase();
                    document.getElementById('edit-contribuinte-cidade').value = data.localidade.toUpperCase();
                    document.getElementById('edit-contribuinte-uf').value = data.uf.toUpperCase();
                    document.getElementById('edit-contribuinte-numero').focus();
                }
            });
    }
}

window.salvarEdicaoContribuinte = function() {
    const originalKey = document.getElementById('edit-contribuinte-cpf-original').value;
    
    const novoDados = {
        resp_nome: document.getElementById('edit-contribuinte-nome').value,
        resp_rg: document.getElementById('edit-contribuinte-rg').value,
        telefone: document.getElementById('edit-contribuinte-telefone').value,
        resp_cep: document.getElementById('edit-contribuinte-cep').value,
        resp_endereco: document.getElementById('edit-contribuinte-endereco').value,
        resp_numero: document.getElementById('edit-contribuinte-numero').value,
        resp_complemento: document.getElementById('edit-contribuinte-complemento').value,
        resp_bairro: document.getElementById('edit-contribuinte-bairro').value,
        resp_cidade: document.getElementById('edit-contribuinte-cidade').value,
        resp_uf: document.getElementById('edit-contribuinte-uf').value,
    };

    const db = getDB();
    let query = db.collection("atendimentos");
    
    if (originalKey.match(/\d/)) {
        query = query.where("resp_cpf", "==", originalKey);
    } else {
        query = query.where("resp_nome", "==", originalKey);
    }

    query.get().then(snap => {
        let batch = db.batch();
        snap.forEach(doc => {
            batch.update(doc.ref, novoDados);
        });
        
        batch.commit().then(() => {
            alert("Dados do contribuinte atualizados em todos os atendimentos vinculados!");
            cancelarEdicaoContribuinte();
            buscarContribuintes(); 
        }).catch(err => {
            console.error("Erro ao atualizar contribuinte", err);
            alert("Erro ao atualizar.");
        });
    });
}

// --- AUDITORIA ---
window.carregarLogs = function() {
    const database = getDB();
    const tbody = document.getElementById('tabela-logs');
    if(!database || !tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="3">Carregando...</td></tr>';
    
    logsUnsubscribe = database.collection("atendimentos")
        .limit(50)
        .orderBy("data_ficha", "desc")
        .onSnapshot(snap => {
            tbody.innerHTML = '';
            if(snap.empty) { 
                tbody.innerHTML = '<tr><td colspan="3">Nenhum registro encontrado.</td></tr>'; 
                return; 
            }
            
            let logs = [];
            snap.forEach(doc => { logs.push(doc.data()); });
            
            logs.forEach(log => {
                let displayDataHora = '-';
                if (log.data_hora_atendimento) {
                    const dh = new Date(log.data_hora_atendimento);
                    if(!isNaN(dh)) {
                        displayDataHora = `${dh.getDate().toString().padStart(2,'0')}/${(dh.getMonth()+1).toString().padStart(2,'0')}/${dh.getFullYear()} <br> <span style="font-size:11px; color:#666;">${dh.getHours().toString().padStart(2,'0')}:${dh.getMinutes().toString().padStart(2,'0')}</span>`;
                    }
                } else {
                    const p = log.data_ficha ? log.data_ficha.split('-').reverse().join('/') : '-';
                    displayDataHora = p;
                }
                const atendente = log.atendente_sistema ? log.atendente_sistema.toUpperCase() : 'SISTEMA';
                const detalhe = `Cadastro: <b>${log.nome}</b>`;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${displayDataHora}</td><td>${atendente}</td><td>${detalhe}</td>`;
                tbody.appendChild(tr);
            });
        });
}

// --- FUNÇÕES DE EXPORTAÇÃO E BACKUP ---
window.baixarRelatorioCompleto = function() {
    if(!getDB()) return; 
    if(!confirm("Baixar relatório?")) return;
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
    if(typeof XLSX === 'undefined' || dadosEstatisticasExportacao.length === 0) { 
        alert("Sem dados ou biblioteca."); 
        return; 
    }
    const ws = XLSX.utils.json_to_sheet(dadosEstatisticasExportacao);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stats");
    XLSX.writeFile(wb, "Estatisticas.xlsx");
}

window.baixarLogsExcel = function() { 
    if(typeof XLSX === 'undefined') { alert("Erro: Biblioteca Excel ausente."); return; } 
    const db = getDB(); 
    db.collection("atendimentos").limit(100).orderBy("data_ficha", "desc").get().then(snap => { 
        let dados = []; 
        snap.forEach(doc => { 
            const d = doc.data(); 
            const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-'; 
            const atendente = d.atendente_sistema ? d.atendente_sistema.toUpperCase() : 'SISTEMA'; 
            dados.push({ "Data": dataF, "Usuário": atendente, "Ação/Detalhes": `Cadastro: ${d.nome}` }); 
        }); 
        const ws = XLSX.utils.json_to_sheet(dados); 
        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Auditoria"); 
        XLSX.writeFile(wb, "Logs_Auditoria.xlsx"); 
    }); 
}

window.baixarLogsPDF = function() { 
    if(!window.jspdf) { alert("Erro: Biblioteca PDF ausente."); return; } 
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF(); 
    const db = getDB(); 
    
    db.collection("atendimentos").limit(100).orderBy("data_ficha", "desc").get().then(snap => { 
        let body = []; 
        snap.forEach(doc => { 
            const d = doc.data(); 
            const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-'; 
            const atendente = d.atendente_sistema ? d.atendente_sistema.toUpperCase() : 'SISTEMA'; 
            body.push([dataF, atendente, `Cadastro: ${d.nome}`]); 
        }); 
        doc.text("Relatório de Auditoria", 14, 10); 
        doc.autoTable({ 
            head: [['Data', 'Usuário', 'Ação/Detalhes']], 
            body: body, 
            startY: 20 
        }); 
        doc.save("Logs_Auditoria.pdf"); 
    }); 
}

window.baixarTodosExcel = function() {
    if(typeof XLSX === 'undefined') { alert("Biblioteca Excel não carregada."); return; }
    getDB().collection("atendimentos").get().then(snap => {
        let dados = [];
        snap.forEach(doc => {
            let d = doc.data();
            dados.push({
                "ID": doc.id,
                "Protocolo": d.protocolo || '',
                "Data Registro": d.data_hora_atendimento || '',
                "Data Sepultamento": d.data_ficha || '',
                "Hora": d.hora || '',
                "Nome": d.nome || '',
                "Causa": d.causa || '',
                "Responsável": d.resp_nome || '',
                "Telefone": d.telefone || '',
                "Funerária": d.funeraria || '',
                "Cemitério": d.local || '',
                "Sepultura": d.sepul || '',
                "Quadra": d.qd || '',
                "Atendente": d.atendente_sistema || ''
            });
        });
        const ws = XLSX.utils.json_to_sheet(dados);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Todos_Atendimentos");
        XLSX.writeFile(wb, "Backup_Atendimentos.xlsx");
    });
}

window.baixarTodosPDF = function() {
    if(!window.jspdf) { alert("Biblioteca PDF não carregada."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    getDB().collection("atendimentos").get().then(snap => {
        let body = [];
        snap.forEach(doc => {
            let d = doc.data();
            const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-';
            body.push([
                dataF, 
                d.hora || '-', 
                (d.nome || '').substring(0,20), 
                (d.causa || '').substring(0,20), 
                (d.resp_nome || '').substring(0,15), 
                d.telefone || '-', 
                (d.local || '').replace('CEMITÉRIO DO ', '').replace('CEMITÉRIO DE ', '').trim(), 
                d.sepul || '-', 
                d.protocolo || '-'
            ]);
        });
        doc.text("Backup Completo de Atendimentos", 14, 10);
        doc.autoTable({ 
            head: [['Data', 'Hora', 'Nome', 'Causa', 'Responsável', 'Tel', 'Local', 'Sepul', 'Protocolo']], 
            body: body, 
            startY: 15,
            styles: { fontSize: 8 }
        });
        doc.save("Backup_Atendimentos.pdf");
    });
}

window.gerarBackup = async function() {
    const db = getDB();
    if(!db) return;
    
    try {
        const btn = event.target;
        const originalText = btn.innerText;
        btn.innerText = "⏳ Gerando...";
        btn.disabled = true;

        let backupData = {
            atendimentos: [],
            equipe: [],
            auditoria: []
        };

        const atendimentosSnap = await db.collection("atendimentos").get();
        atendimentosSnap.forEach(doc => backupData.atendimentos.push({ id: doc.id, ...doc.data() }));

        const equipeSnap = await db.collection("equipe").get();
        equipeSnap.forEach(doc => backupData.equipe.push({ id: doc.id, ...doc.data() }));

        const auditoriaSnap = await db.collection("auditoria").get();
        auditoriaSnap.forEach(doc => backupData.auditoria.push({ id: doc.id, ...doc.data() }));

        const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0,10);
        a.download = `backup_funeraria_${date}.json`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        
        btn.innerText = originalText;
        btn.disabled = false;
    } catch (e) {
        console.error("Erro no backup:", e);
        alert("Erro ao gerar backup.");
    }
}

window.restaurarBackup = function() {
    const fileInput = document.getElementById('file-restore');
    const file = fileInput.files[0];
    if (!file) {
        alert("Por favor, selecione um arquivo de backup (.json).");
        return;
    }

    if (!confirm("⚠️ ATENÇÃO! Isso irá RESTAURAR o banco de dados. Registros com o mesmo ID serão sobrescritos. Deseja continuar?")) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const backupData = JSON.parse(e.target.result);
            const db = getDB();
            let count = 0;

            const restaurarColecao = async (nomeColecao, dados) => {
                if (dados && dados.length > 0) {
                    for (let item of dados) {
                        const id = item.id;
                        delete item.id; 
                        await db.collection(nomeColecao).doc(id).set(item);
                        count++;
                    }
                }
            };

            await restaurarColecao("atendimentos", backupData.atendimentos);
            await restaurarColecao("equipe", backupData.equipe);
            await restaurarColecao("auditoria", backupData.auditoria);

            alert(`Restaurado com sucesso! ${count} registros processados.`);
            fileInput.value = ""; 
        } catch (error) {
            console.error("Erro ao restaurar:", error);
            alert("Erro ao ler o arquivo. Certifique-se de que é um backup válido.");
        }
    };
    reader.readAsText(file);
}

// --- GERENCIAMENTO DE EQUIPE ---
window.listarEquipe = function() {
    const database = getDB();
    const ul = document.getElementById('lista-equipe');
    if(!database || !ul) return;
    
    if (equipeUnsubscribe) equipeUnsubscribe();

    equipeUnsubscribe = database.collection("equipe").orderBy("nome").onSnapshot(snap => {
        ul.innerHTML = '';
        snap.forEach(doc => {
            const u = doc.data();
            
            // Lógica para capturar as Iniciais do Nome
            let nomeSeguro = (u.nome || '').trim();
            if (!nomeSeguro) nomeSeguro = 'Usuário';

            const names = nomeSeguro.split(' ').filter(n => n.length > 0);
            let iniciais = 'U';
            if (names.length > 0) {
                iniciais = names[0][0].toUpperCase();
                if (names.length > 1) {
                    iniciais += names[names.length - 1][0].toUpperCase();
                } else if (names[0].length > 1) {
                    iniciais += names[0][1].toUpperCase();
                }
            }

            const colors = ['#e0f2fe', '#fef3c7', '#dcfce3', '#f3e8ff', '#ffe4e6', '#ccfbf1'];
            const textColors = ['#0284c7', '#d97706', '#16a34a', '#9333ea', '#e11d48', '#0d9488'];
            const colorIndex = nomeSeguro.length % colors.length;
            const bgColor = colors[colorIndex];
            const txtColor = textColors[colorIndex];

            const emailText = u.email ? u.email : 'Sem e-mail';

            ul.innerHTML += `
            <li class="table-equipe-row">
                <div class="col-user">
                    <div class="avatar-circle" style="background-color: ${bgColor}; color: ${txtColor};">
                        ${iniciais}
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <span style="color:#1e293b; font-size:14px; font-weight:600;">${nomeSeguro}</span>
                        <span style="color:#94a3b8; font-size:12px;">${emailText}</span>
                    </div>
                </div>
                <div class="col-login">${u.login || 'S/ Login'}</div>
                <div class="col-pass">
                    <span style="letter-spacing: 2px;">••••••</span>
                    <button class="btn-icon" style="background:#f8fafc; padding:6px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;" title="Visualizar Senha" onclick="alert('Senha: ${u.senha}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                </div>
                <div class="col-actions">
                    <button class="btn-action-edit" onclick="window.editarFuncionario('${doc.id}')" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-action-delete" onclick="window.excluirFuncionario('${doc.id}')" title="Excluir">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
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
    
    if(!nome || !login || !senha) { 
        alert("Preencha nome, login e senha."); 
        return; 
    }
    
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
    
    if(!nome || !senha) { 
        alert("Nome e senha são obrigatórios."); 
        return; 
    }
    
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

// --- MODAIS E AÇÕES PRINCIPAIS (ACOLHIMENTO) ---
window.abrirModal = function() {
    document.getElementById('form-atendimento').reset();
    document.getElementById('docId').value = ""; 
    document.getElementById('protocolo_hidden').value = "";
    document.getElementById('div-motivo-edicao').classList.add('hidden');
    
    if (usuarioLogado && usuarioLogado.nome) {
        const elAtendente = document.getElementById('atendente_sistema');
        if (elAtendente) elAtendente.value = usuarioLogado.nome;
    }

    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    document.getElementById('data_hora_atendimento').value = (new Date(now - offset)).toISOString().slice(0, 16);
    
    const fd = document.getElementById('filtro-data');
    if(fd) document.getElementById('data_ficha_modal').value = fd.value;
    
    const chkInd = document.getElementById('chk_indigente');
    if(chkInd) { 
        chkInd.checked = false; 
        window.toggleIndigente(); 
    }

    const chkMembro = document.getElementById('chk_membro');
    const tipoMembroSelect = document.getElementById('tipo_membro_select');
    if (chkMembro && tipoMembroSelect) {
        chkMembro.checked = false;
        tipoMembroSelect.disabled = true;
        tipoMembroSelect.value = '';
    }

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
            
            ['tanato', 'invol', 'translado', 'urna_opc', 'membro'].forEach(k => { 
                const chk = document.getElementById('chk_'+k); 
                if(chk) chk.checked = (d[k] === 'SIM'); 
            });
            
            const chkInd = document.getElementById('chk_indigente');
            if(chkInd) { 
                chkInd.checked = (d.indigente === 'SIM'); 
                window.toggleIndigente(); 
            }

            const chkMembro = document.getElementById('chk_membro');
            const tipoMembroSelect = document.getElementById('tipo_membro_select');
            if(chkMembro && tipoMembroSelect) {
                if(d.tipo_membro) {
                    chkMembro.checked = true;
                    tipoMembroSelect.disabled = false;
                    tipoMembroSelect.value = d.tipo_membro;
                } else {
                    chkMembro.checked = false;
                    tipoMembroSelect.disabled = true;
                    tipoMembroSelect.value = '';
                }
            }

            if(d.data_hora_atendimento) { 
                document.getElementById('data_hora_atendimento').value = d.data_hora_atendimento; 
            } else if(d.protocolo && d.protocolo.length >= 13) {
                 const p = d.protocolo; 
                 const y = p.substring(0,4), m = p.substring(4,6), day = p.substring(6,8); 
                 const h = p.substring(9,11), min = p.substring(11,13);
                 document.getElementById('data_hora_atendimento').value = `${y}-${m}-${day}T${h}:${min}`;
            }
            
            const tipoSep = (d.tipo_sepultura || "").toUpperCase();
            const divP = document.getElementById('div-perpetua');
            if (tipoSep.includes('PERPETU')) divP.classList.remove('hidden'); 
            else divP.classList.add('hidden');
            
            document.getElementById('div-motivo-edicao').classList.remove('hidden');
            safeDisplay('modal', 'block');
            
            assinaturaResponsavelImg = d.assinatura_responsavel || null;
            assinaturaAtendenteImg = d.assinatura_atendente || null;
        }
    });
}

window.fecharModal = function() { 
    safeDisplay('modal', 'none'); 
}

const formAcolhimento = document.getElementById('form-atendimento');
if(formAcolhimento) {
    formAcolhimento.onsubmit = (e) => {
        e.preventDefault();
        const database = getDB();
        const id = document.getElementById('docId').value;
        const motivo = document.getElementById('motivo_edicao').value;
        const tipoSep = document.getElementById('tipo_sepultura').value;
        let dados = {};
        
        Array.from(formAcolhimento.elements).forEach(el => {
            if(el.id && el.type !== 'submit' && el.type !== 'button') {
                if(el.type === 'checkbox') dados[el.id.replace('chk_', '')] = el.checked ? 'SIM' : 'NAO';
                else dados[el.id] = el.value;
            }
        });
        
        if(!dados.atendente_sistema && usuarioLogado) { 
            dados.atendente_sistema = usuarioLogado.nome; 
        }

        const chkMembro = document.getElementById('chk_membro');
        const tipoMembroSelect = document.getElementById('tipo_membro_select');
        if(chkMembro && chkMembro.checked && tipoMembroSelect) {
            dados.tipo_membro = tipoMembroSelect.value;
        } else {
            dados.tipo_membro = "";
        }

        dados.data_hora_atendimento = document.getElementById('data_hora_atendimento').value;
        dados.data_ficha = document.getElementById('data_ficha_modal').value;
        dados.local = document.getElementById('filtro-local').value;
        dados.gav = tipoSep.includes('GAVETA') ? 'X' : '';
        dados.car = tipoSep.includes('CARNEIRO') ? 'X' : '';
        dados.cova_rasa = tipoSep.includes('COVA') ? 'X' : '';
        dados.perpetua = (tipoSep.includes('PERPETUA') || tipoSep.includes('PERPETUO')) ? 'X' : '';
        dados.indigente = document.getElementById('chk_indigente').checked ? 'SIM' : 'NAO';

        if(!id && !dados.protocolo) dados.protocolo = window.gerarProtocolo();

        if(id) {
            if(!motivo) { 
                alert("Motivo obrigatório na edição."); 
                return; 
            }
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

// --- FUNÇÕES DA AGÊNCIA FUNERÁRIA ---
window.abrirModalAgencia = function(id) {
    const database = getDB();
    if(!database) return;

    database.collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            document.getElementById('agencia_docId').value = doc.id;
            document.getElementById('agencia_nome_falecido').innerText = (d.nome || 'Nome Não Informado').toUpperCase();
            
            document.getElementById('agencia_processo').value = d.agencia_processo || '';
            document.getElementById('agencia_grm').value = d.agencia_grm || 'PENDENTE';
            document.getElementById('agencia_status_liberacao').value = d.agencia_status_liberacao || 'PENDENTE';
            
            document.getElementById('agencia_chk_invol').checked = (d.agencia_chk_invol === true);
            document.getElementById('agencia_chk_nf').checked = (d.agencia_chk_nf === true);
            document.getElementById('agencia_chk_tanato').checked = (d.agencia_chk_tanato === true);
            document.getElementById('agencia_chk_comprovante').checked = (d.agencia_chk_comprovante === true);

            document.getElementById('agencia_atendente_modal').innerText = (d.agencia_atendente || 'NÃO ASSUMIDO').toUpperCase();

            safeDisplay('modal-agencia', 'block');
        }
    });
}

window.fecharModalAgencia = function() {
    safeDisplay('modal-agencia', 'none');
}

window.salvarDadosAgencia = function() {
    const id = document.getElementById('agencia_docId').value;
    if(!id) return;

    const database = getDB();
    const dadosAtualizados = {
        agencia_processo: document.getElementById('agencia_processo').value,
        agencia_grm: document.getElementById('agencia_grm').value,
        agencia_status_liberacao: document.getElementById('agencia_status_liberacao').value,
        agencia_chk_invol: document.getElementById('agencia_chk_invol').checked,
        agencia_chk_nf: document.getElementById('agencia_chk_nf').checked,
        agencia_chk_tanato: document.getElementById('agencia_chk_tanato').checked,
        agencia_chk_comprovante: document.getElementById('agencia_chk_comprovante').checked,
    };

    database.collection("atendimentos").doc(id).update(dadosAtualizados).then(() => {
        database.collection("auditoria").add({ 
            data_log: new Date().toISOString(), 
            usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', 
            acao: "ATUALIZAÇÃO AGÊNCIA", 
            detalhe: `Processo: ${dadosAtualizados.agencia_processo} | Status Liberação: ${dadosAtualizados.agencia_status_liberacao}` 
        });
        window.fecharModalAgencia();
    }).catch(e => {
        alert("Erro ao salvar trâmites da agência.");
        console.error(e);
    });
}

window.assumirProcessoAgencia = function(id) {
    if (!usuarioLogado || !usuarioLogado.nome) { alert("Você precisa estar logado para assumir um processo."); return; }
    if (confirm("Deseja assumir a responsabilidade por este processo na Agência?")) {
        const db = getDB();
        db.collection("atendimentos").doc(id).update({
            agencia_atendente: usuarioLogado.nome
        }).then(() => {
            db.collection("auditoria").add({
                data_log: new Date().toISOString(),
                usuario: usuarioLogado.nome,
                acao: "ASSUMIU AGÊNCIA",
                detalhe: `ID: ${id}`
            });
        }).catch(e => {
            console.error("Erro ao assumir:", e);
            alert("Erro ao assumir atendimento.");
        });
    }
}

window.assumirProcessoAgenciaModal = function() {
    if (!usuarioLogado || !usuarioLogado.nome) { alert("Faça login para assumir."); return; }
    const id = document.getElementById('agencia_docId').value;
    if(confirm("Deseja assumir este processo para você?")) {
         getDB().collection("atendimentos").doc(id).update({ 
             agencia_atendente: usuarioLogado.nome 
         }).then(() => {
             document.getElementById('agencia_atendente_modal').innerText = usuarioLogado.nome.toUpperCase();
         });
    }
}

// LÓGICA DO MODAL DE LIBERAÇÃO
window.abrirModalLiberacao = function(id) {
    window.idLiberacaoAtual = id;
    safeDisplay('modal-liberacao', 'flex');
}

window.fecharModalLiberacao = function() {
    safeDisplay('modal-liberacao', 'none');
}

window.gerarFormularioLiberacao = function(tipo) {
    if (!window.idLiberacaoAtual) return;
    const database = getDB();
    
    database.collection("atendimentos").doc(window.idLiberacaoAtual).get().then(doc => {
        if (doc.exists) {
            const d = doc.data();
            
            const dataFichaFormatada = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '';
            const agora = new Date();
            const horaAtual = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
            
            const processoEcode = d.agencia_processo || '';
            const tipoProcesso = tipo === 'municipal' ? 'SEPULTAMENTO' : 'CREMAÇÃO';
            const atendenteNome = (d.agencia_atendente || (usuarioLogado ? usuarioLogado.nome : (d.atendente_sistema || ''))).toUpperCase();
            
            let sepulturaCompleta = "";
            if(tipo === 'municipal') {
                 sepulturaCompleta = `${d.tipo_sepultura || ''} ${d.sepul ? 'Nº ' + d.sepul : ''}`.toUpperCase();
            }

            let blocoAssinaturaAtendente = "";
            if (d.assinatura_atendente) {
                blocoAssinaturaAtendente = `<img src="${d.assinatura_atendente}" style="max-height: 50px; margin-bottom: 5px;">`;
            } else {
                blocoAssinaturaAtendente = `<div style="height: 50px;"></div>`;
            }

            const html = `
            <html>
            <head>
                <title>Liberação - ${tipo === 'municipal' ? 'Municipais' : 'Outros'}</title>
                <style>
                    @page { size: A4 portrait; margin: 15mm; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; font-size: 13px; }
                    table { border-collapse: collapse; width: 100%; }
                    td { border: 2px solid #000; }
                    .bg-gray { background-color: #ebebeb; font-weight: bold; text-align: center; text-transform: uppercase; }
                    .label-cell { padding: 8px 10px; font-weight: normal; }
                    .value-cell { padding: 8px 10px; }
                </style>
            </head>
            <body>
                <table style="border: 2px solid #000;">
                    <tr>
                        <td style="width: 35%; border-bottom: 2px solid #000; text-align: center; padding: 15px;">
                            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height: 80px;">
                        </td>
                        <td style="width: 65%; border-bottom: 2px solid #000; text-align: center; font-weight: bold; line-height: 1.8; font-size: 14px; padding: 15px;">
                            SECRETARIA DE MOBILIDADE E INFRAESTRUTURA - SEMOBI<br><br>
                            SUBSECRETARIA DE INFRAESTRUTURA - SSINFRA<br><br>
                            COORDENADORIA MUNICIPAL DE SERVIÇOS FUNERÁRIOS<br><br>
                            AGÊNCIA FUNERÁRIA MUNICIPAL
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border-bottom: 2px solid #000; text-align: center; font-weight: bold; padding: 8px;">
                            CERTIFICO e dou fé que, nesta data, estamos finalizando o Processo Administrativo
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border-bottom: 2px solid #000; padding: 0;">
                            <table>
                                <tr>
                                    <td style="width: 10%; border: none; border-right: 2px solid #000; padding: 10px; text-align: center;">Nº</td>
                                    <td style="width: 35%; border: none; border-right: 2px solid #000; padding: 10px;" class="bg-gray">${processoEcode}</td>
                                    <td style="width: 20%; border: none; border-right: 2px solid #000; padding: 10px; text-align: center;">, processo de</td>
                                    <td style="width: 35%; border: none; padding: 10px;" class="bg-gray">${tipoProcesso}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr>
                    <tr>
                        <td colspan="2" style="border-bottom: 2px solid #000; padding: 0;">
                            <table>
                                <tr>
                                    <td style="width: 15%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Falecido:</td>
                                    <td style="width: 85%; border: none; padding: 10px;" class="bg-gray">${(d.nome || '').toUpperCase()}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr>
                    <tr>
                        <td colspan="2" style="border-bottom: 2px solid #000; padding: 0;">
                            <table>
                                <tr>
                                    <td style="width: 15%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Data:</td>
                                    <td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="bg-gray">${dataFichaFormatada}</td>
                                    <td style="width: 55%; border: none;"></td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr>
                    <tr>
                        <td colspan="2" style="border-bottom: 2px solid #000; padding: 0;">
                            <table>
                                <tr>
                                    <td style="width: 35%; border: none; border-right: 2px solid #000; padding: 10px; text-align: center;" class="label-cell">Sepultamento/Crematório no Cemitério<br>Municipal/Privado:</td>
                                    <td style="width: 65%; border: none; padding: 10px; vertical-align: middle;" class="bg-gray">${(d.local || '').toUpperCase()}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr>
                    <tr>
                        <td colspan="2" style="border-bottom: 2px solid #000; padding: 0;">
                            <table>
                                <tr>
                                    <td style="width: 15%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Horário:</td>
                                    <td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="bg-gray">${d.hora || ''}</td>
                                    <td style="width: 25%; border: none; border-right: 2px solid #000; padding: 10px; text-align: center;" class="label-cell">Horário da Liberação:</td>
                                    <td style="width: 30%; border: none; padding: 10px;" class="bg-gray">${horaAtual}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr>
                    <tr>
                        <td colspan="2" style="border-bottom: 2px solid #000; padding: 0;">
                            <table>
                                <tr>
                                    <td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Saindo o féretro da Capela:</td>
                                    <td style="width: 70%; border: none; padding: 10px;" class="bg-gray">${(d.cap || '').toUpperCase()}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr>
                    <tr>
                        <td colspan="2" style="border-bottom: 2px solid #000; padding: 0;">
                            <table>
                                <tr>
                                    <td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Para a Sepultura:</td>
                                    <td style="width: 70%; border: none; padding: 10px;" class="bg-gray">${sepulturaCompleta}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr>
                    <tr>
                        <td colspan="2" style="padding: 0;">
                            <table>
                                <tr>
                                    <td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Funerária:</td>
                                    <td style="width: 70%; border: none; padding: 10px;" class="bg-gray">${(d.funeraria || '').toUpperCase()}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <div style="text-align: center; margin-top: 40px;">
                    ${blocoAssinaturaAtendente}
                    <div style="border-top: 1px dashed #000; width: 350px; margin: 0 auto; margin-bottom: 5px;"></div>
                    <span style="font-weight: bold; font-size: 13px;">Assinatura do Responsável</span><br>
                    <span style="font-size: 13px;">${atendenteNome}</span><br><br>
                    <span style="font-weight: bold; font-size: 13px;">Matrícula</span><br>
                    <span style="font-size: 13px;">_________________</span>
                </div>
            </body>
            <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
            </html>`;
            
            const w = window.open('','_blank');
            w.document.write(html);
            w.document.close();
            fecharModalLiberacao();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    window.carregarListaHorarios();
    
    const chkIndigente = document.getElementById('chk_indigente');
    if(chkIndigente) { 
        chkIndigente.addEventListener('change', window.toggleIndigente); 
    }

    const chkMembro = document.getElementById('chk_membro');
    const tipoMembroSelect = document.getElementById('tipo_membro_select');
    if (chkMembro && tipoMembroSelect) {
        chkMembro.addEventListener('change', function() {
            tipoMembroSelect.disabled = !this.checked;
            if (!this.checked) tipoMembroSelect.value = '';
        });
    }

    const seletorCausas = document.getElementById('seletor_causas');
    const inputCausa = document.getElementById('causa');
    if (seletorCausas && inputCausa) { 
        seletorCausas.addEventListener('change', function() { 
            if (this.value) { 
                if (inputCausa.value === "") { inputCausa.value = this.value; } 
                else { inputCausa.value += " / " + this.value; } 
                this.value = ""; 
            } 
        }); 
    }
    
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

window.visualizar = function(id) {
    const database = getDB();
    const modalView = document.getElementById('modal-visualizar');
    if(!modalView || !database) return;
    
    assinaturaResponsavelImg = null;
    assinaturaAtendenteImg = null;

    database.collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            d.id = doc.id; 
            dadosAtendimentoAtual = d;
            
            if(d.assinatura_responsavel) assinaturaResponsavelImg = d.assinatura_responsavel;
            if(d.assinatura_atendente) assinaturaAtendenteImg = d.assinatura_atendente;

            const map = {
                'view_protocolo': d.protocolo, 
                'view_hora': d.hora, 
                'view_nome': d.nome, 
                'view_causa': d.causa, 
                'view_resp_completo': d.resp_nome + (d.parentesco ? ` (${d.parentesco})` : ''), 
                'view_resp_cpf': d.resp_cpf || '-',
                'view_resp_rg': d.resp_rg || '-',
                'view_telefone': d.telefone, 
                'view_funeraria': d.funeraria, 
                'view_atendente': d.atendente_sistema, 
                'view_combo_urna': d.combo_urna, 
                'view_hospital_completo': d.hospital, 
                'view_cap': d.cap, 
                'view_urna_info': d.urna_info
            };
            
            for(let k in map) { 
                const el = document.getElementById(k); 
                if(el) el.innerText = map[k] || '-'; 
            }
            
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
                const cleanCoords = d.geo_coords ? d.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; 
                if (cleanCoords && cleanCoords.includes(',')) { 
                    mapContainer.style.display = 'block'; 
                    mapFrame.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=${cleanCoords}&z=17&output=embed"></iframe>`; 
                    mapLink.href = `https://maps.google.com/maps?q=${cleanCoords}`; 
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

window.excluir = function(id) { 
    if(confirm('Tem certeza?')) { 
        getDB().collection("atendimentos").doc(id).delete(); 
    } 
};

window.onclick = function(event) { 
    const t = event.target; 
    if (t == document.getElementById('modal-visualizar')) window.fecharModalVisualizar(); 
    if (t == document.getElementById('modal-estatisticas')) window.fecharModalEstatisticas(); 
    if (t == document.getElementById('modal-equipe')) window.fecharModalEquipe(); 
    if (t == document.getElementById('modal-admin')) window.fecharModalAdmin(); 
    if (t == document.getElementById('modal-transferir')) window.fecharModalTransferir(); 
    if (t == document.getElementById('modal-whatsapp')) window.fecharModalWpp(); 
    if (t == document.getElementById('modal-agencia')) window.fecharModalAgencia(); 
    if (t == document.getElementById('modal-liberacao')) window.fecharModalLiberacao(); 
}

window.fazerLogout = function() { 
    sessionStorage.removeItem('usuarioLogado'); 
    window.location.reload(); 
}

window.checarLoginEnter = function(e) { 
    if(e.key==='Enter') window.fazerLogin(); 
}

window.bloquearTela = function() { 
    const t = document.getElementById('tela-bloqueio'); 
    if(t) t.style.display = 'flex'; 
}

window.gerarEtiqueta = function() { 
    if (!dadosAtendimentoAtual) return; 
    const d = dadosAtendimentoAtual; 
    const fd = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; }; 
    const dataF = fd(d.data_ficha); 
    const h = `<html><head><style>@page{size:landscape;margin:0}body{font-family:Arial,sans-serif;margin:0;padding:0;height:100vh;width:100vw;display:flex;justify-content:center;align-items:center;overflow:hidden}.box{width:95vw;height:90vh;border:5px solid #000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center;padding:10px}.header-img{max-height:100px;margin-bottom:10px}.title{font-size:24px;font-weight:900;text-transform:uppercase;border-bottom:3px solid #000;padding-bottom:5px;display:inline-block;margin-bottom:30px}.group{margin-bottom:30px;width:100%}.label{font-size:18px;color:#333;font-weight:bold;text-transform:uppercase;margin-bottom:5px}.val-nome{font-size:55px;font-weight:900;text-transform:uppercase;line-height:1.1}.val-data{font-size:40px;font-weight:800}.val-local{font-size:35px;font-weight:800;text-transform:uppercase}</style></head><body><div class="box"><div><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="header-img"><br><div class="title">IDENTIFICAÇÃO DE VELÓRIO</div></div><div class="group"><div class="label">FALECIDO(A)</div><div class="val-nome">${d.nome}</div></div><div class="group"><div class="label">SEPULTAMENTO</div><div class="val-data">${dataF} às ${d.hora}</div></div><div class="group"><div class="label">LOCAL</div><div class="val-local">${d.cap}<br>${d.local || "CEMITÉRIO DO MARUÍ"}</div></div></div><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`; 
    const w = window.open('','_blank'); 
    if(w) { w.document.write(h); w.document.close(); } 
}

// --- WHATSAPP TEMPLATES ---
window.abrirModalWpp = function() {
    if (!dadosAtendimentoAtual) return;
    safeDisplay('modal-whatsapp', 'flex');
}

window.fecharModalWpp = function() {
    safeDisplay('modal-whatsapp', 'none');
}

window.enviarWppTemplate = function(tipo) {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    let t = d.telefone ? d.telefone.replace(/\D/g, '') : '';
    
    let texto = "";
    const fd = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

    if (tipo === 'gps') {
        const c = d.geo_coords ? d.geo_coords.replace(/[^0-9.,\-]/g, '') : '';
        if (!t) { alert("Sem telefone cadastrado."); return; }
        if (!c) { alert("Sem GPS cadastrado."); return; }
        texto = `Localização da Sepultura: https://maps.google.com/maps?q=${c}`;
    } 
    else if (tipo === 'info') {
        if (!t) { alert("Sem telefone cadastrado."); return; }
        
        let dataExumacao = ""; 
        if (d.data_ficha) { 
            const parts = d.data_ficha.split('-'); 
            let ano = parseInt(parts[0]); 
            const mes = parts[1]; 
            const dia = parts[2]; 
            const addAnos = (d.classificacao_obito === 'ANJO') ? 2 : 3; 
            dataExumacao = `${dia}/${mes}/${ano + addAnos}`; 
        }

        texto = `*PREFEITURA MUNICIPAL DE NITERÓI*\n`+
                `_Serviços Funerários_\n\n`+
                `Olá, seguem as informações úteis do seu atendimento:\n\n`+
                `📄 *Protocolo:* ${d.protocolo || '-'}\n`+
                `👤 *Falecido(a):* ${d.nome || '-'}\n`+
                `⚰️ *Local:* ${d.local || '-'}\n`+
                `✝️ *Capela:* ${d.cap || '-'}\n`+
                `🕒 *Horário Previsto:* ${d.hora || '-'}\n`+
                `📍 *Sepultura:* ${d.sepul || '-'} | *QD/Rua:* ${d.qd || '-'}\n\n`+
                `⏳ *Previsão de Exumação:* A partir de ${dataExumacao}\n\n`+
                `⚠️ *ATENÇÃO:* Compareça ou entre em contato no prazo mínimo de *90 dias ANTES* da data de exumação para abertura de processo.\n\n`+
                `Agradecemos a compreensão.`;
    } 
    else if (tipo === 'convite') {
        texto = `Informamos com pesar o falecimento de *${d.nome || '_______________'}*.\n\n`+
                `O velório e sepultamento serão realizados conforme abaixo:\n\n`+
                `📍 *Cemitério:* ${d.local || '-'}\n`+
                `✝️ *Capela:* ${d.cap || '-'}\n`+
                `📅 *Data:* ${fd(d.data_ficha)}\n`+
                `🕒 *Horário do Sepultamento:* ${d.hora || '-'}\n\n`+
                `Agradecemos a todos que puderem comparecer para prestar as últimas homenagens.`;
    }

    let url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    if (t) {
        url = `https://api.whatsapp.com/send?phone=55${t}&text=${encodeURIComponent(texto)}`;
    }
    
    window.open(url, '_blank');
    fecharModalWpp();
}

window.enviarSMS = function() { 
    if (!dadosAtendimentoAtual) return; 
    const t = dadosAtendimentoAtual.telefone ? dadosAtendimentoAtual.telefone.replace(/\D/g, '') : ''; 
    const c = dadosAtendimentoAtual.geo_coords ? dadosAtendimentoAtual.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; 
    if (!t) { alert("Sem telefone."); return; } 
    window.location.href = `sms:55${t}?body=${encodeURIComponent('Localização da Sepultura: https://maps.google.com/maps?q=$' + c)}`; 
}

window.gerarAutorizacao = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const fd = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
    
    let txtSep = (d.tipo_sepultura || "").toUpperCase(); 
    const co = d.classificacao_obito || "ADULTO"; 
    let classificacao = co; 
    if (txtSep.includes("ANJO")) classificacao = "ANJO";
    
    let condicaoSepultura = "ALUGUEL (3 ANOS)";
    if (txtSep.includes("PERPETUA") || txtSep.includes("PERPETUO")) { 
        txtSep = `${txtSep} - ${classificacao}`; 
        condicaoSepultura = `PERPÉTUA (LIVRO: ${d.livro_perpetua||'-'} / FOLHA: ${d.folha_perpetua||'-'})`;
    } else if (txtSep.includes("MEMBRO")) { 
        txtSep = `MEMBRO AMPUTADO (${d.tipo_membro || d.tipo_membro_select || 'Não informado'})`; 
        condicaoSepultura = "N/A";
    } else { 
        txtSep = `${txtSep} - ${classificacao}`; 
    }

    const htmlAutorizacao = `
    <html>
    <head>
        <title>Autorização para Funeral</title>
        <style>
            @page { size: A4 portrait; margin: 10mm; } 
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; line-height: 1.2; color: #000; text-align: justify; } 
            .header { text-align: center; margin-bottom: 10px; } 
            .header img { max-height: 50px; margin-bottom: 5px; }
            .header h2 { font-size: 16px; margin: 0; font-weight: bold; text-transform: uppercase; } 
            .content { margin-top: 5px; }
            .bold { font-weight: bold; text-transform: uppercase; }
            .assinatura-area { margin-top: 15px; text-align: center; width: 60%; margin-left: auto; margin-right: auto; }
            .ass-linha { border-top: 1px solid #000; padding-top: 3px; font-weight: normal; font-size: 11px; display: inline-block; width: 100%; }
            p { margin: 5px 0; }
            h3 { font-size: 12px; text-decoration: underline; margin-top: 10px; margin-bottom: 5px; text-align: left; }
            .info-box { margin: 8px 0; padding: 8px; border: 1px solid #333; background: #fafafa; border-radius: 4px; }
            .info-box h4 { margin: 0 0 5px 0; font-size: 12px; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 3px; text-transform: uppercase; color: #333; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 11px; }
            .info-grid-full { grid-column: span 2; }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png">
            <h2>AUTORIZAÇÃO PARA TRÂMITES DE FUNERAL</h2>
        </div>
        <div class="content">
            <p>Eu, <span class="bold">${d.resp_nome || '___________________________________'}</span>, 
            RG: <span class="bold">${d.resp_rg || '_______________'}</span> CPF n° <span class="bold">${d.resp_cpf || '_______________'}</span>, 
            residente na <span class="bold">${d.resp_endereco || '___________________________________'}</span> n° <span class="bold">${d.resp_numero || '_____'}</span> 
            complemento <span class="bold">${d.resp_complemento || '_____'}</span> bairro <span class="bold">${d.resp_bairro || '_______________'}</span> 
            Município <span class="bold">${d.resp_cidade || '_______________'}</span> Estado <span class="bold">${d.resp_uf || '___'}</span> 
            CEP: <span class="bold">${d.resp_cep || '_________'}</span>, telefones de contato: <span class="bold">${d.telefone || '________________'}</span>, 
            grau de parentesco <span class="bold">${(d.parentesco || '_______________').toUpperCase()}</span>, 
            a tratar junto à Agência Funerária dos Cemitérios Municipais de Niterói do Sepultamento do(a) Sr(a) qualificado(a) abaixo:</p>

            <div class="info-box">
                <h4>DADOS DO FALECIDO</h4>
                <div class="info-grid">
                    <div class="info-grid-full"><strong>NOME:</strong> ${(d.nome || 'Não Informado').toUpperCase()}</div>
                    <div><strong>DATA DO ÓBITO:</strong> ${fd(d.data_obito)}</div>
                    <div><strong>LOCAL DO ÓBITO:</strong> ${(d.hospital || '_________________________').toUpperCase()}</div>
                    <div class="info-grid-full"><strong>CAUSA DA MORTE:</strong> ${(d.causa || 'Não Informada').toUpperCase()}</div>
                </div>
            </div>

            <div class="info-box">
                <h4>DADOS DO SEPULTAMENTO</h4>
                <div class="info-grid">
                    <div class="info-grid-full"><strong>CEMITÉRIO:</strong> ${(d.local || '_________________________').toUpperCase()}</div>
                    <div><strong>DATA PREVISTA:</strong> ${fd(d.data_ficha) || '___/___/_____'}</div>
                    <div><strong>HORÁRIO PREVISTO:</strong> ${d.hora || '_____'} HORAS</div>
                    <div class="info-grid-full"><strong>TIPO DE SEPULTURA:</strong> ${txtSep}</div>
                    <div><strong>Nº SEPULTURA:</strong> ${d.sepul || '______'}</div>
                    <div><strong>QUADRA / RUA:</strong> ${d.qd || '______'}</div>
                    <div><strong>CONDIÇÃO:</strong> ${condicaoSepultura}</div>
                    <div><strong>AUTORIZAÇÃO P/ SEPULTAR < 24 HORAS:</strong> ${(d.do_24h === 'SIM' ? 'SIM' : 'NÃO')}</div>
                </div>
            </div>

            <p style="font-weight:bold; text-align:center; margin: 10px 0;">* ESTOU CIENTE E ACEITO A SEPULTURA DISPONÍVEL.</p>

            <p>Por meio deste documento, <span class="bold">AUTORIZO</span> a agência funerária <span class="bold">${(d.funeraria || '_________________________').toUpperCase()}</span> a realizar a remoção, o preparo e todos os demais trâmites legais e logísticos necessários para o sepultamento do corpo acima identificado, junto à Coordenadoria Municipal de Serviços Funerários e à administração do Cemitério Municipal.</p>

            <p>Declaro assumir inteira responsabilidade civil e criminal pela veracidade das informações ora prestadas e pela presente autorização.</p>

            <p style="text-align: right; margin-top: 15px; font-style: italic;">Niterói, ${new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

            <div class="assinatura-area">
                <div style="height:40px;"></div>
                <div class="ass-linha">Assinatura do(a) autorizador(a)</div>
            </div>

            <div style="border-top: 1px dashed #999; margin: 10px 0;"></div>

            <h3>AUTORIZAÇÃO PARA PAGAMENTO DAS TAXAS</h3>
            <p>Autorizo a Funerária <span class="bold">${(d.funeraria || '_________________________').toUpperCase()}</span> a entregar toda e qualquer documentação exigida, bem como a efetuar o pagamento das taxas inerentes ao funeral (capela, entrada de corpo, sepultamento e afins), agendamento e liberação de corpo na agência para o Cemitério de destino.</p>

            <div class="assinatura-area" style="margin-top: 15px;">
                <div style="height:40px;"></div>
                <div class="ass-linha">Assinatura do(a) autorizador(a)</div>
            </div>

            <div style="border-top: 1px dashed #999; margin: 10px 0;"></div>

            <h3>NÃO AUTORIZAÇÃO PARA PAGAMENTO DAS TAXAS</h3>
            <p>NÃO autorizo a Funerária <span class="bold">${(d.funeraria || '_________________________').toUpperCase()}</span> a efetuar o pagamento das taxas inerentes ao funeral (capela, entrada de corpo, sepultamento e afins), sendo de minha inteira responsabilidade efetuar o pagamento das taxas bem como entregar a documentação exigida para liberação do corpo na agência para o Cemitério de destino. Importante frisar que toda a documentação posterior ao pagamento, a família deverá entregar a Funerária para que seja autorizado junto ao Cemitério a entrada do corpo na capela do Cemitério escolhido.</p>
            <p>Sendo de responsabilidade da Funerária contratada tão somente a entrega dos documentos obrigatórios da empresa, bem como realizar o agendamento do sepultamento.</p>

            <div class="assinatura-area" style="margin-top: 15px;">
                <div style="height:40px;"></div>
                <div class="ass-linha">Assinatura do(a) autorizador(a)<br><span style="font-size: 9px; font-weight: normal;">(Apenas se não autorizar o pagamento pela Funerária)</span></div>
            </div>
        </div>
    </body>
    <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
    </html>`;

    const w = window.open('','_blank');
    w.document.write(htmlAutorizacao);
    w.document.close();
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
    
    const im = (d.local && d.local.includes("MARUÍ")); 
    const is = (d.local && d.local.includes("SÃO FRANCISCO")); 
    const ii = (d.local && d.local.includes("ITAIPU")); 
    const cc = (d.cap && !d.cap.toUpperCase().includes("SEM"));
    
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
    
    let txtSep = (d.tipo_sepultura || "").toUpperCase(); 
    const co = d.classificacao_obito || "ADULTO"; 
    let txtHoraObito = d.hora_obito; 
    
    if (d.ignorar_hora_obito === 'SIM') txtHoraObito += " (IGNORADO)"; 
    let classificacao = co; 
    if (txtSep.includes("ANJO")) classificacao = "ANJO";
    
    if (txtSep.includes("PERPETUA") || txtSep.includes("PERPETUO")) { 
        txtSep = `${txtSep} (LIVRO: ${d.livro_perpetua||'-'} / FOLHA: ${d.folha_perpetua||'-'}) - ${classificacao}`; 
    } else if (txtSep.includes("MEMBRO")) { 
        txtSep = `MEMBRO AMPUTADO (${d.tipo_membro || d.tipo_membro_select || 'Não informado'})`; 
    } else { 
        txtSep = `${txtSep} - ${classificacao}`; 
    }
    
    let dataExumacao = ""; 
    if (d.data_ficha) { 
        const parts = d.data_ficha.split('-'); 
        let ano = parseInt(parts[0]); 
        const mes = parts[1]; 
        const dia = parts[2]; 
        const addAnos = (d.classificacao_obito === 'ANJO') ? 2 : 3; 
        dataExumacao = `${dia}/${mes}/${ano + addAnos}`; 
    }

    let blocoAssinaturaFamilia = "";
    if (assinaturaResponsavelImg) {
        blocoAssinaturaFamilia = `<div style="text-align:center; height:45px;"><img src="${assinaturaResponsavelImg}" style="max-height:40px; max-width:80%;"></div>`;
    } else {
        blocoAssinaturaFamilia = `<div style="height:45px;"></div>`;
    }

    let blocoAssinaturaAtendente = "";
    if (assinaturaAtendenteImg) {
        blocoAssinaturaAtendente = `<div style="text-align:center; height:45px;"><img src="${assinaturaAtendenteImg}" style="max-height:40px; max-width:80%;"></div>`;
    } else {
        blocoAssinaturaAtendente = `<div style="height:45px;"></div>`;
    }

    let nomeAtendente = (d.atendente_sistema || (usuarioLogado ? usuarioLogado.nome : 'N/A')).toUpperCase();

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
            .line { margin-bottom: 4px; white-space: normal; word-wrap: break-word; overflow: visible; } 
            .bold { font-weight: 900; } 
            .red { color: red; font-weight: bold; } 
            .section-title { font-weight: 900; margin-top: 15px; margin-bottom: 2px; text-transform: uppercase; font-size: 14px; } 
            .two-columns { display: flex; justify-content: space-between; margin-top: 10px; } 
            .col-left { width: 60%; } 
            .col-right { width: 38%; } 
            .assinaturas-block { display: flex; justify-content: space-between; margin-top: 25px; margin-bottom: 10px; gap: 20px; } 
            .ass-line { text-align: center; padding-top: 2px; flex: 1; font-size: 12px; } 
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
            <div class="line"><span class="bold">Atendente Responsável:</span> ${nomeAtendente}<span class="bold" style="margin-left:20px">DATA DE HORARIO DE ATENDIMENTO:</span> ${dataHoraAtendimentoTexto}</div>
            <div class="line"><span class="bold">Data:</span> ${fd(d.data_ficha)} <span class="bold spacer">Hora:</span> ${d.hora} <span class="bold spacer">SEPULTURA:</span> ${d.sepul} <span class="bold spacer">${(d.local && d.local.includes("MARUÍ")) ? "QUADRA:" : "RUA:"}</span> ${d.qd} <span class="bold spacer">CAPELA:</span> ${d.cap}</div>
            <div class="line"><span class="bold">COM CAPELA</span> ${chk(cc)} <span class="bold">SEM CAPELA</span> ${chk(!cc)} <span class="bold spacer">DATA DO FALECIMENTO:</span> ${fd(d.data_obito)} AS ${txtHoraObito} <span class="red spacer">[${tempoDecorrido}]</span></div>
            <div class="line"><span class="bold">Cemitério:</span> (${im?'X':' '}) MARUÍ (${is?'X':' '}) SÃO FRANCISCO XAVIER (${ii?'X':' '}) SÃO LÁZARO DE ITAIPÚ</div>
            <div class="line">${chkEC('SOLTEIRO')} SOLTEIRO ${chkEC('CASADO')} CASADO ${chkEC('VIUVO')} VÍUVO ${chkEC('UNIAO_ESTAVEL')} UNIÃO ESTÁVEL ${chkEC('DIVORCIADO')} DIVORCIADO ${chkEC('IGNORADO')} IGNORADO</div>
            
            <div class="section-title">ASSINAR TERMO DE COMPROMISSO NO CEMITÉRIO</div>
            <div class="line" style="margin-top:5px; font-size:14px; border: 1px solid #000; padding: 5px;"><span class="bold">TIPO DE SEPULTURA SELECIONADA:</span> ${txtSep}</div>
            <div class="line" style="margin-top:10px"><span class="bold">TANATO:</span> (${d.tanato==='SIM'?'X':' '}) SIM (${d.tanato==='NAO'?'X':' '}) NÃO</div>
            
            <div class="assinaturas-block">
                <div class="ass-line">
                    ${blocoAssinaturaAtendente}
                    <div style="border-top:1px solid #000;">Acolhimento / Atendente:<br><b>${nomeAtendente}</b></div>
                </div>
                <div class="ass-line">
                    ${blocoAssinaturaFamilia}
                    <div style="border-top:1px solid #000;">Assinatura do responsável/família<br><b>${(d.resp_nome||'').toUpperCase()}</b></div>
                </div>
            </div>
            
            <div class="obs-box">OBS: PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.</div>
            <div class="obs-box">OBS.: VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.</div>
            
            <div class="line" style="margin-top: 15px; border: 2px solid #000; padding: 5px;">
                <span class="bold">PREVISÃO DE EXUMAÇÃO:</span> A partir de <span class="red" style="font-size:16px;">${dataExumacao}</span><br>
                <span style="font-size:10px;">(Legislação: 3 anos para Adultos / 2 anos para Crianças até 11 anos)</span>
                
                <div style="margin-top: 12px; margin-bottom: 8px; border: 2px dashed #000; padding: 8px; text-align: center; font-weight: 900; font-size: 13px;">
                    ⚠️ ATENÇÃO: COMPAREÇA OU ENTRE EM CONTATO NO PRAZO MÍNIMO DE 90 DIAS ANTES DA DATA DE EXUMAÇÃO PARA ABERTURA DE PROCESSO.
                </div>

                <div style="margin-top: 15px; text-align: center;">
                    ${blocoAssinaturaFamilia}
                    <div style="border-top: 1px solid #000; width: 60%; margin: 0 auto;">Assinatura do Responsável (Ciência do Prazo)</div>
                </div>
            </div>
            
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
                        <div class="ass-line">
                            ${blocoAssinaturaFamilia}
                            <div style="border-top: 1px solid #000;">Assinatura funcionário/família</div>
                        </div>
                    </div>
                </div>
                <div class="col-right">
                    <div class="box-lateral">
                        <div>CAPELAS MUNICIPAIS E PARTICULARES:</div><br>
                        <div>PAGAMENTO E NOTA FISCAL DAS TAXAS MUNICIPAIS E INVOL COM DUAS HORAS ANTES DO SEPULTAMENTO</div><br><br>
                        <div>CLIENTE: _____________________</div>
                    </div>
                </div>
            </div>
            
            <div class="footer-line">
                MARCADO: ________________________ PERMISSIONÁRIO: ${(d.resp_nome || '').toUpperCase()}
            </div>
            
            <div style="font-weight:bold; font-size:12px; margin-top:5px;">TEL: ${d.telefone||''}</div>
            
            <div class="aviso-final">
                <span style="text-decoration:underline">COMUNICADO AOS FAMILIARES DO FALECIDO E AS EMPRESAS FUNERÁRIAS RESPONSÁVEIS PELO SEPULTAMENTO.</span><br>
                Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos:<span class="bold">GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL PELO SERVIÇO), TAXAS MUNICIPAIS PAGAS e INVOL.</span>
            </div>
        </div>
    </body>
    <script>window.onload=function(){setTimeout(function(){window.print()},500)}</script>
    </html>`;
    
    const w = window.open('','_blank'); 
    w.document.write(htmlComprovante); 
    w.document.close();
}