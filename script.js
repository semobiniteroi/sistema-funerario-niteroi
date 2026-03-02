// --- FUNÇÕES GLOBAIS DE LOGIN ---
function fazerLogin() {
    const u = document.getElementById('login-usuario').value.trim();
    const p = document.getElementById('login-senha').value.trim();
    if (p === "2026") { usuarioLogado = {nome:"Admin", login:"admin"}; liberarAcesso(); return; }
    const database = getDB();
    if (!database) { alert("Sem conexão com banco."); return; }
    database.collection("equipe").where("login", "==", u).where("senha", "==", p).get().then(snap => {
        if (!snap.empty) { usuarioLogado = snap.docs[0].data(); liberarAcesso(); } 
        else { alert("Dados incorretos."); const elErr = document.getElementById('msg-erro-login'); if(elErr) elErr.style.display = 'block'; }
    }).catch(err => { console.error(err); alert("Erro ao logar."); });
}
function checarLoginEnter(e) { if(e.key === 'Enter') fazerLogin(); }
window.fazerLogin = fazerLogin; window.checarLoginEnter = checarLoginEnter;

// --- 1. CONFIGURAÇÃO E INICIALIZAÇÃO ---
const firebaseConfig = {
  apiKey: "AIzaSyB6pkQZNuLiYidKqstJdMXRl2OYW4JWmfs",
  authDomain: "funeraria-niteroi.firebaseapp.com",
  projectId: "funeraria-niteroi",
  storageBucket: "funeraria-niteroi.firebasestorage.app",
  messagingSenderId: "232673521828",
  appId: "1:232673521828:web:f25a77f27ba1924cb77631"
};

let db = null, unsubscribe = null, statsUnsubscribe = null, equipeUnsubscribe = null, logsUnsubscribe = null;
let sepulturaOriginal = "", dadosAtendimentoAtual = null, dadosEstatisticasExportacao = [], chartInstances = {}; 
let usuarioLogado = null, signaturePad = null, isDrawing = false, assinaturaResponsavelImg = null, assinaturaAtendenteImg = null;
let tipoAssinaturaAtual = '', dashboardAtual = 'acolhimento';
window.idLiberacaoAtual = null; window.idTransferenciaResponsavelAtual = null; window.nomePastaPadrao = 'PROTOCOLO_NOME';

try { if (typeof firebase !== 'undefined') { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); } } catch (e) { console.error("Erro Firebase:", e); }
function getDB() {
    if (!db && typeof firebase !== 'undefined') { try { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); } catch(e) { if(firebase.apps.length) db = firebase.firestore(); } }
    return db;
}

const dimensoesUrna = { 'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70', 'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80', 'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85', '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95', 'PERPETUA': '' };

function safeDisplay(id, displayType) { const el = document.getElementById(id); if (el) el.style.display = displayType; }

window.alternarDashboard = function(dash) {
    dashboardAtual = dash;
    const btnAcolhimento = document.getElementById('nav-btn-acolhimento'), btnAgencia = document.getElementById('nav-btn-agencia');
    const divAcolhimento = document.getElementById('dashboard-acolhimento'), divAgencia = document.getElementById('dashboard-agencia');
    if (dash === 'agencia') {
        btnAcolhimento.classList.remove('active'); btnAgencia.classList.add('active');
        divAcolhimento.classList.add('hidden'); divAgencia.classList.remove('hidden');
    } else {
        btnAgencia.classList.remove('active'); btnAcolhimento.classList.add('active');
        divAgencia.classList.add('hidden'); divAcolhimento.classList.remove('hidden');
    }
    const dataFiltro = document.getElementById('filtro-data').value, localFiltro = document.getElementById('filtro-local').value;
    window.atualizarListener(dataFiltro, localFiltro);
}

// --- BUSCA CEP E CPF ---
window.buscarCEP = function(cep) {
    cep = cep.replace(/\D/g, '');
    if (cep.length === 8) {
        fetch(`https://viacep.com.br/ws/${cep}/json/`).then(res => res.json()).then(data => {
            if (!data.erro) {
                document.getElementById('resp_endereco').value = data.logradouro.toUpperCase(); document.getElementById('resp_bairro').value = data.bairro.toUpperCase();
                document.getElementById('resp_cidade').value = data.localidade.toUpperCase(); document.getElementById('resp_uf').value = data.uf.toUpperCase();
                document.getElementById('resp_numero').focus();
            }
        }).catch(err => console.error(err));
    }
}

window.buscarPorCPF = function() {
    let cpfInput = document.getElementById('resp_cpf').value.replace(/\D/g, '');
    if (!cpfInput) { alert("Digite um CPF válido."); return; }
    getDB().collection("atendimentos").where("resp_cpf", "==", cpfInput).limit(1).get().then(snap => {
        if (!snap.empty) {
            const d = snap.docs[0].data();
            if(d.resp_nome) document.getElementById('resp_nome').value = d.resp_nome; if(d.resp_rg) document.getElementById('resp_rg').value = d.resp_rg;
            if(d.telefone) document.getElementById('telefone').value = d.telefone; if(d.resp_cep) document.getElementById('resp_cep').value = d.resp_cep;
            if(d.resp_endereco) document.getElementById('resp_endereco').value = d.resp_endereco; if(d.resp_numero) document.getElementById('resp_numero').value = d.resp_numero;
            if(d.resp_complemento) document.getElementById('resp_complemento').value = d.resp_complemento; if(d.resp_bairro) document.getElementById('resp_bairro').value = d.resp_bairro;
            if(d.resp_cidade) document.getElementById('resp_cidade').value = d.resp_cidade; if(d.resp_uf) document.getElementById('resp_uf').value = d.resp_uf;
            alert("Dados do contribuinte preenchidos com sucesso!");
        } else { alert("Nenhum cadastro prévio encontrado."); }
    });
}

window.toggleIndigente = function() {
    const chk = document.getElementById('chk_indigente');
    const camposObrigatorios = ['resp_nome', 'resp_cpf', 'resp_endereco', 'resp_numero', 'resp_bairro', 'resp_cidade', 'telefone', 'funeraria', 'isencao', 'tipo_sepultura', 'sepul', 'qd', 'hospital', 'cap', 'data_obito', 'nome', 'causa', 'hora'];
    camposObrigatorios.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (chk && chk.checked) { if (el.hasAttribute('required')) { el.removeAttribute('required'); el.setAttribute('data-was-required', 'true'); } } 
            else { if (el.getAttribute('data-was-required') === 'true') { el.setAttribute('required', ''); el.removeAttribute('data-was-required'); } }
        }
    });
}

// --- ASSINATURAS ---
function setupSignaturePad() {
    const canvas = document.getElementById('signature-pad'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    function getPos(canvas, evt) {
        const rect = canvas.getBoundingClientRect(); let clientX = evt.touches ? evt.touches[0].clientX : evt.clientX; let clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
        return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    }
    function startDraw(e) { if(e.type === 'touchstart') e.preventDefault(); isDrawing = true; const pos = getPos(canvas, e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
    function draw(e) { if (!isDrawing) return; if(e.type === 'touchmove') e.preventDefault(); const pos = getPos(canvas, e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
    function endDraw(e) { if(e.type === 'touchend') e.preventDefault(); isDrawing = false; }
    canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', endDraw); canvas.addEventListener('mouseout', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false }); canvas.addEventListener('touchmove', draw, { passive: false }); canvas.addEventListener('touchend', endDraw, { passive: false });
}

window.abrirModalAssinatura = function(tipo) {
    tipoAssinaturaAtual = tipo; const titulo = document.getElementById('titulo-assinatura');
    if(titulo) titulo.innerText = (tipo === 'responsavel') ? 'Assinatura do Responsável' : 'Assinatura da Equipe';
    safeDisplay('modal-assinatura', 'flex'); window.limparAssinatura(); setTimeout(setupSignaturePad, 200); 
}
window.fecharModalAssinatura = function() { safeDisplay('modal-assinatura', 'none'); }
window.limparAssinatura = function() { const canvas = document.getElementById('signature-pad'); if(canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); } }

window.salvarAssinatura = function() {
    const canvas = document.getElementById('signature-pad');
    if (canvas && dadosAtendimentoAtual && dadosAtendimentoAtual.id) {
        const imgData = canvas.toDataURL('image/png'); let updateData = {};
        if (tipoAssinaturaAtual === 'responsavel') { assinaturaResponsavelImg = imgData; updateData = { assinatura_responsavel: imgData }; } 
        else { assinaturaAtendenteImg = imgData; updateData = { assinatura_atendente: imgData }; }
        getDB().collection("atendimentos").doc(dadosAtendimentoAtual.id).update(updateData).then(() => window.fecharModalAssinatura());
    }
}

// --- TRANSFERÊNCIA DE CEMITÉRIO ---
window.abrirModalTransferir = function() {
    if(!dadosAtendimentoAtual) return; const select = document.getElementById('novo_cemiterio_transferencia');
    if(select) select.value = dadosAtendimentoAtual.local || "CEMITÉRIO DO MARUÍ"; safeDisplay('modal-transferir', 'flex');
}
window.fecharModalTransferir = function() { safeDisplay('modal-transferir', 'none'); }
window.confirmarTransferencia = function() {
    if(!dadosAtendimentoAtual || !dadosAtendimentoAtual.id) return;
    const novoLocal = document.getElementById('novo_cemiterio_transferencia').value, localAntigo = dadosAtendimentoAtual.local || "CEMITÉRIO DO MARUÍ";
    if(novoLocal === localAntigo) { alert("O atendimento já está neste cemitério."); return; }
    if(confirm(`Confirmar transferência de ${localAntigo} para ${novoLocal}?`)) {
        getDB().collection("atendimentos").doc(dadosAtendimentoAtual.id).update({ local: novoLocal }).then(() => {
            getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', acao: "TRANSFERÊNCIA", detalhe: `ID: ${dadosAtendimentoAtual.id} | De: ${localAntigo} Para: ${novoLocal}` });
            alert("Atendimento transferido com sucesso!"); window.fecharModalTransferir(); window.fecharModalVisualizar();
        });
    }
}

window.gerarProtocolo = function() {
    const elData = document.getElementById('data_ficha_modal'); const agora = new Date(); let ano, mes, dia;
    if (elData && elData.value) { const p = elData.value.split('-'); ano = p[0]; mes = p[1]; dia = p[2]; } 
    else { ano = agora.getFullYear(); mes = String(agora.getMonth()+1).padStart(2,'0'); dia = String(agora.getDate()).padStart(2,'0'); }
    return `${ano}${mes}${dia}-${String(agora.getHours()).padStart(2,'0')}${String(agora.getMinutes()).padStart(2,'0')}`;
}
window.pegarDataAtualLocal = function() { const agora = new Date(); return `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}-${String(agora.getDate()).padStart(2,'0')}`; }
window.atualizarLabelQuadra = function(local) { const inputQd = document.getElementById('qd'); if (inputQd) { const label = inputQd.previousElementSibling; if (label) label.innerText = (local && local.includes('MARUÍ')) ? 'QD' : 'RUA'; } }

window.carregarCidades = function(uf) {
    const elCidade = document.getElementById('cidade_obito');
    if(!uf) { if(elCidade) { elCidade.innerHTML = '<option value="">UF</option>'; elCidade.disabled = true; } return; }
    if(elCidade) {
        elCidade.innerHTML = '<option>...</option>'; elCidade.disabled = true;
        fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`).then(r=>r.json()).then(c=>{
            elCidade.innerHTML = '<option>Selecione</option>'; c.sort((a,b)=>a.nome.localeCompare(b.nome));
            c.forEach(i=>{ const o=document.createElement('option'); o.value=i.nome.toUpperCase(); o.text=i.nome.toUpperCase(); elCidade.appendChild(o); });
            elCidade.disabled=false;
        });
    }
}
window.carregarListaHorarios = function() {
    const select = document.getElementById('hora'); if (!select) return; select.innerHTML = '<option value="">Selecione...</option>';
    const horarios = [ "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45", "12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45", "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45", "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30" ];
    horarios.forEach(hora => { const option = document.createElement('option'); option.value = hora; option.textContent = hora; select.appendChild(option); });
}

// --- RENDERIZAÇÃO DA TABELA ACOLHIMENTO ---
window.renderizarTabela = function(lista) {
    const tbody = document.getElementById('tabela-corpo-acolhimento'); if(!tbody) return; tbody.innerHTML = ''; 
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="11" style="padding:40px; text-align:center;">Nenhum registro encontrado no acolhimento.</td></tr>'; return; }
    lista.forEach(item => {
        const tr = document.createElement('tr'); tr.onclick = () => window.visualizar(item.id);
        let isContagioso = false; if(item.causa) { isContagioso = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HIV', 'SIDA', 'SARAMPO'].some(d => item.causa.toUpperCase().includes(d)); }
        if (isContagioso) tr.classList.add('alerta-doenca');
        
        let displayResponsavel = item.isencao === "50" ? `<span style="font-weight:900;">ACOLHIMENTO 50%</span>` : item.isencao === "SIM" ? `<span style="font-weight:900;">ACOLHIMENTO 100%</span>` : `<span style="font-weight:bold;">${item.funeraria ? item.funeraria.toUpperCase() : (item.resp_nome || 'S/D').toUpperCase()}</span>`;
        displayResponsavel += `<br><span style="font-weight:bold; font-size:11px;">${(item.tipo_urna_detalhe||'').toUpperCase()}</span>`;
        if (item.combo_urna) { displayResponsavel += `<br><span style="font-size:10px;">URNA ${item.combo_urna}</span>`; if (dimensoesUrna[item.combo_urna]) displayResponsavel += `<br><span style="font-size:9px; color:#666;">${dimensoesUrna[item.combo_urna]}</span>`; }
        
        let servicosExtras = [];
        if (item.tanato === 'SIM') servicosExtras.push('TANATOPRAXIA'); if (item.invol === 'SIM') servicosExtras.push('INVOL');
        if (item.translado === 'SIM') servicosExtras.push('TRANSLADO'); if (item.urna_opc === 'SIM') servicosExtras.push('URNA');
        if (servicosExtras.length > 0) displayResponsavel += `<br><span style="font-size:10px; font-weight:bold;">SERVIÇOS: ${servicosExtras.join(', ')}</span>`; 

        const conteudoNome = `<div style="font-weight:bold;">${isContagioso ? '⚠️ ' : ''}${item.nome ? item.nome.toUpperCase() : 'NOME NÃO INFORMADO'}</div><div style="color:red; font-size:10px; font-weight:bold; margin-top:2px;">(${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})</div>${item.classificacao_obito === 'ANJO' ? '<div style="font-size:9px; color:blue; font-weight:bold;">(ANJO)</div>' : ''}`;
        let statusDocs = item.url_docs_acolhimento ? `<span style="font-size:9px; color:#10b981; font-weight:bold; border: 1px solid #10b981; padding: 2px 4px; border-radius: 4px; display:inline-block; margin-top: 4px;">✅ DOCS NUVEM</span>` : `<span style="font-size:9px; color:#ef4444; font-weight:bold; border: 1px solid #ef4444; padding: 2px 4px; border-radius: 4px; display:inline-block; margin-top: 4px;">⚠️ DOCS PENDENTES</span>`;
        
        let conteudoSepultura = `<div style="font-weight:bold; font-size:13px; color:#333;">${item.sepul||''}</div>`;
        if (item.perpetua === 'X' || (item.tipo_sepultura || "").toUpperCase().includes('PERPETU')) { conteudoSepultura += `<div style="font-weight:bold; font-size:10px; color:#2196F3; margin-top:2px;">PERPÉTUA</div><div style="font-weight:bold; font-size:10px; color:#2196F3;">L: ${item.livro_perpetua||''} F: ${item.folha_perpetua||''}</div>`; }

        let displayFalecimento = '';
        if (item.data_obito && item.data_ficha) {
            const p = item.data_obito.split('-'); const dFmt = `${p[2]}/${p[1]}`; let txtT = "";
            if (item.hora_obito && item.hora) {
                const ini = new Date(`${item.data_obito}T${item.hora_obito}`), fim = new Date(`${item.data_ficha}T${item.hora}`);
                if (!isNaN(ini) && !isNaN(fim)) { const dMs = fim - ini; txtT = `<br><span style="font-weight:bold; font-size:10px;">TEMPO DE FALECIMENTO: ${Math.floor(dMs / 3600000)}H ${Math.round(((dMs % 3600000) / 60000))}M</span>`; }
            }
            displayFalecimento = `<div style="line-height:1.3;"><span style="color:#c0392b; font-weight:bold;">DIA:</span> ${dFmt}<br><span style="color:#c0392b; font-weight:bold;">AS:</span> ${item.hora_obito || '--:--'}${txtT}</div>`;
        } else if (item.falecimento) { displayFalecimento = `<div>${item.falecimento}</div>`; }

        let btnMap = ''; const clCoords = item.geo_coords ? item.geo_coords.replace(/[^0-9.,\-]/g, '') : '';
        if (clCoords.includes(',')) btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('http://googleusercontent.com/maps.google.com/?q=${clCoords}', '_blank')" title="Ver Localização">📍</button>`;

        tr.innerHTML = `<td style="vertical-align:middle;">${displayResponsavel}</td><td style="text-align: center; vertical-align:middle;">${item.hora||''}</td><td style="text-align: center; vertical-align:middle;">${conteudoNome}<br>${statusDocs}</td><td style="text-align: center; vertical-align:middle;">${item.gav||''}</td><td style="text-align: center; vertical-align:middle;">${item.car||''}</td><td style="text-align: center; vertical-align:middle;">${conteudoSepultura}</td><td style="text-align: center; vertical-align:middle;">${item.qd||''}</td><td style="text-align: center; vertical-align:middle; font-size:11px;">${item.hospital||''}</td><td style="text-align: center; vertical-align:middle;">${item.cap||''}</td><td style="text-align: center; vertical-align:middle;">${displayFalecimento}</td><td style="text-align:right; vertical-align:middle;"><div style="display:flex; gap:5px; justify-content:flex-end;">${btnMap}<button class="btn-icon btn-editar-circle" onclick="event.stopPropagation();window.editar('${item.id}')">✏️</button><button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation();window.excluir('${item.id}')">🗑️</button></div></td>`;
        tbody.appendChild(tr);
    });
}

// --- RENDERIZAÇÃO DA TABELA AGÊNCIA (CARDS) ---
window.renderizarTabelaAgencia = function(lista) {
    const container = document.getElementById('tabela-corpo-agencia'); 
    if(!container) return; container.innerHTML = ''; 
    if (lista.length === 0) { container.innerHTML = '<div style="grid-column: 1 / -1; padding:40px; text-align:center; color:#64748b; font-weight:500;">Nenhum registro encontrado para a Agência.</div>'; return; }

    const renderChip = (key, label, item) => {
        const url = item[`url_${key}`];
        if (item[`agencia_chk_${key}`]) {
            if (url) return `<a href="${url}" target="_blank" onclick="event.stopPropagation();" style="text-decoration:none;"><span class="doc-chip tem" style="cursor:pointer;" title="Ver Anexo">📎 ${label}</span></a>`;
            return `<span class="doc-chip tem">${label}</span>`;
        }
        return `<span class="doc-chip">${label}</span>`;
    };

    lista.forEach(item => {
        const card = document.createElement('div'); card.className = 'agencia-card'; card.style.cursor = 'pointer'; card.onclick = () => window.visualizar(item.id);
        let statusGRM = item.agencia_grm || 'PENDENTE', badgeGRM = `<span class="badge-status ${statusGRM === 'PENDENTE' ? 'badge-pendente' : 'badge-sucesso'}">${statusGRM}</span>`;
        let statusLib = item.agencia_status_liberacao || 'PENDENTE', badgeLib = `<span class="badge-status ${statusLib === 'PENDENTE' ? 'badge-pendente' : 'badge-sucesso'}">${statusLib === 'LIBERADO' ? 'LIBERADO' : 'AGUARDANDO'}</span>`;
        let docsHTML = renderChip('invol', 'INVOL', item) + renderChip('nf', 'NF', item) + renderChip('tanato', 'TANATO', item) + renderChip('comprovante', 'COMP. PGTO', item) + renderChip('guia_grm', 'GRM', item);
        card.style.borderTopColor = statusLib === 'LIBERADO' ? '#10b981' : (statusGRM !== 'PENDENTE' ? '#f59e0b' : '#3b82f6');

        let statusDocsAcolhimento = item.url_docs_acolhimento ? `<span class="badge-status badge-sucesso" title="Documentos anexados pelo Acolhimento">OK</span>` : `<span class="badge-status badge-pendente" title="Acolhimento ainda não anexou os documentos">PENDENTE</span>`;
        let btnAssumir = ''; let btnRepassar = `<button class="btn-novo" style="background:#8b5cf6; color:white; padding: 6px 12px; font-size: 12px; width:auto;" onclick="event.stopPropagation(); window.abrirModalTransferirResponsavel('${item.id}')" title="Repassar para outro colaborador">👤 Repassar</button>`;
        
        if (!item.agencia_atendente) btnAssumir = `<button class="btn-novo" style="background:#3b82f6; color:white; padding: 6px 12px; font-size: 12px; width:auto;" onclick="event.stopPropagation(); window.assumirProcessoAgencia('${item.id}', false)">🙋‍♂️ Assumir</button>`;
        else if (!usuarioLogado || item.agencia_atendente !== usuarioLogado.nome) btnAssumir = `<button class="btn-novo" style="background:#f59e0b; color:white; padding: 6px 12px; font-size: 12px; width:auto;" onclick="event.stopPropagation(); window.assumirProcessoAgencia('${item.id}', true)">🔄 Assumir</button>`;

        card.innerHTML = `<div class="agencia-card-header"><div class="agencia-card-title">${(item.nome || 'NÃO INFORMADO').toUpperCase()}</div><div class="agencia-card-subtitle">Sepultamento: ${item.data_ficha || ''} às ${item.hora || ''}</div></div><div class="agencia-card-body"><div class="agencia-info-row"><span class="agencia-info-label">E-CIGA:</span><span class="agencia-info-value" style="font-family:monospace; font-size:13px; color:#0ea5e9;">${item.agencia_processo || 'S/ PROCESSO'}</span></div><div class="agencia-info-row"><span class="agencia-info-label">Resp. Agência:</span><span class="agencia-info-value" style="color:#3b82f6;">${(item.agencia_atendente || 'AGUARDANDO').toUpperCase()}</span></div><div class="agencia-info-row"><span class="agencia-info-label">Funerária:</span><span class="agencia-info-value">${(item.funeraria || 'N/I').toUpperCase()}</span></div><div class="agencia-info-row"><span class="agencia-info-label">Docs Acolhimento:</span><span class="agencia-info-value">${statusDocsAcolhimento}</span></div><div class="agencia-info-row"><span class="agencia-info-label">GRM:</span><span class="agencia-info-value">${badgeGRM}</span></div><div class="agencia-info-row"><span class="agencia-info-label">Liberação:</span><span class="agencia-info-value">${badgeLib}</span></div><div style="margin-top: 5px;"><span class="agencia-info-label" style="display:block; margin-bottom:5px; font-size:10px;">ANEXOS FÍSICOS/DIGITAIS:</span><div>${docsHTML}</div></div></div><div class="agencia-card-footer" style="flex-wrap: wrap;"><div style="display:flex; gap:5px; flex-wrap: wrap;">${btnAssumir}${btnRepassar}<button class="btn-novo" style="background:#f1f5f9; color:#ea580c; border: 1px solid #cbd5e1; padding: 6px 12px; font-size: 12px; width:auto;" onclick="event.stopPropagation(); window.abrirModalAgencia('${item.id}')">✏️ Editar</button></div><button class="btn-novo" style="background:${statusLib === 'LIBERADO' ? '#10b981' : '#e2e8f0'}; color:${statusLib === 'LIBERADO' ? 'white' : '#94a3b8'}; padding: 6px 12px; font-size: 12px; margin-top: 5px; width:auto;" onclick="event.stopPropagation(); window.abrirModalLiberacao('${item.id}')" ${statusLib !== 'LIBERADO' ? 'disabled' : ''}>✅ Liberação</button></div>`;
        container.appendChild(card);
    });
}

// --- FUNÇÕES DA AGÊNCIA E ONEDRIVE ---
window.assumirProcessoAgencia = function(id, isTransfer = false) {
    if (!usuarioLogado || !usuarioLogado.nome) { alert("Faça login."); return; }
    if (confirm(isTransfer ? `Deseja transferir a responsabilidade deste processo para você?` : `Deseja assumir a responsabilidade por este processo na Agência?`)) {
        getDB().collection("atendimentos").doc(id).update({ agencia_atendente: usuarioLogado.nome }).then(() => { getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado.nome, acao: isTransfer ? "TRANSFERIU RESPONSABILIDADE (AGÊNCIA)" : "ASSUMIU AGÊNCIA", detalhe: `ID: ${id}` }); }).catch(e => { alert("Erro ao assumir atendimento."); });
    }
}
window.assumirProcessoAgenciaModal = function() {
    if (!usuarioLogado || !usuarioLogado.nome) return; const id = document.getElementById('agencia_docId').value;
    if(confirm("Deseja assumir este processo para você?")) { getDB().collection("atendimentos").doc(id).update({ agencia_atendente: usuarioLogado.nome }).then(() => { document.getElementById('agencia_atendente_modal').innerText = usuarioLogado.nome.toUpperCase(); }); }
}
window.abrirModalTransferirResponsavel = function(id) {
    window.idTransferenciaResponsavelAtual = id; const select = document.getElementById('novo_responsavel_agencia'); select.innerHTML = '<option value="">Carregando...</option>';
    getDB().collection("equipe").orderBy("nome").get().then(snap => {
        select.innerHTML = '<option value="">Selecione o colaborador...</option>'; snap.forEach(doc => { if(doc.data().nome) select.innerHTML += `<option value="${doc.data().nome}">${doc.data().nome.toUpperCase()}</option>`; });
        safeDisplay('modal-transferir-responsavel', 'flex');
    }).catch(e => { alert("Erro ao carregar lista de equipe."); });
}
window.abrirModalTransferirResponsavelModal = function() { const id = document.getElementById('agencia_docId').value; if(id) window.abrirModalTransferirResponsavel(id); }
window.fecharModalTransferirResponsavel = function() { safeDisplay('modal-transferir-responsavel', 'none'); }

window.confirmarTransferenciaResponsavel = function() {
    if(!window.idTransferenciaResponsavelAtual) return; const novoResponsavel = document.getElementById('novo_responsavel_agencia').value; if(!novoResponsavel) { alert("Selecione um usuário na lista."); return; }
    getDB().collection("atendimentos").doc(window.idTransferenciaResponsavelAtual).update({ agencia_atendente: novoResponsavel }).then(() => {
        getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', acao: "REPASSOU PROCESSO (AGÊNCIA)", detalhe: `ID: ${window.idTransferenciaResponsavelAtual} | Para: ${novoResponsavel}` });
        alert("Processo repassado com sucesso!"); const el = document.getElementById('agencia_atendente_modal'); if (el && document.getElementById('modal-agencia').style.display === 'block') el.innerText = novoResponsavel.toUpperCase(); window.fecharModalTransferirResponsavel();
    }).catch(e => { alert("Erro ao transferir processo."); });
}
window.abrirModalOneDrive = function() { const el = document.getElementById('onedrive_nome_pasta'); if(el) el.innerText = window.nomePastaPadrao || 'PROTOCOLO_NOME'; safeDisplay('modal-onedrive', 'flex'); }
window.fecharModalOneDrive = function() { safeDisplay('modal-onedrive', 'none'); }
window.copiarNomePasta = function() {
    const texto = document.getElementById('onedrive_nome_pasta').innerText;
    navigator.clipboard.writeText(texto).then(() => { alert("Nome copiado! Vá para o OneDrive, crie a pasta e cole este nome."); }).catch(err => { alert("Erro ao copiar automaticamente. Selecione o texto e copie manualmente."); });
}

// --- BUSCA E OUVINTES ---
window.realizarBusca = function() {
    const termo = document.getElementById('input-busca').value.trim().toUpperCase(); if (!termo) { alert("Digite um nome para buscar."); return; }
    if (unsubscribe) unsubscribe();
    unsubscribe = getDB().collection("atendimentos").orderBy("nome").startAt(termo).endAt(termo + "\uf8ff").limit(20).onSnapshot((snap) => {
        let lista = []; snap.forEach(doc => { let d = doc.data(); d.id = doc.id; lista.push(d); });
        dashboardAtual === 'acolhimento' ? window.renderizarTabela(lista) : window.renderizarTabelaAgencia(lista);
    });
}
window.atualizarListener = function(data, local) {
    if(!getDB()) return; if (unsubscribe) unsubscribe();
    unsubscribe = getDB().collection("atendimentos").where("data_ficha", "==", data).onSnapshot((snap) => {
        let lista = []; snap.forEach(doc => { let d = doc.data(); d.id = doc.id; if ((d.local || "CEMITÉRIO DO MARUÍ") === local) lista.push(d); });
        lista.sort((a,b) => (a.hora < b.hora ? -1 : 1));
        dashboardAtual === 'acolhimento' ? window.renderizarTabela(lista) : window.renderizarTabelaAgencia(lista);
    });
}
window.liberarAcesso = function() {
    safeDisplay('tela-bloqueio', 'none'); sessionStorage.setItem('usuarioLogado', JSON.stringify(usuarioLogado));
    const il = document.getElementById('filtro-local'); if(il) { window.atualizarListener(window.pegarDataAtualLocal(), il.value); window.atualizarLabelQuadra(il.value); }
}

// --- ADMIN E ESTATÍSTICAS ---
window.abrirAdmin = function() { safeDisplay('modal-admin', 'block'); window.abrirAba('tab-equipe'); }
window.fecharModalAdmin = function() { safeDisplay('modal-admin', 'none'); }
window.abrirAba = function(id) {
    Array.from(document.getElementsByClassName('tab-pane')).forEach(e => e.classList.remove('active')); document.getElementById(id).classList.add('active');
    document.querySelectorAll('.tab-header .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (id === 'tab-equipe') document.querySelectorAll('.tab-btn')[0].classList.add('active');
    if (id === 'tab-contribuintes') document.querySelectorAll('.tab-btn')[1].classList.add('active');
    if (id === 'tab-backup') document.querySelectorAll('.tab-btn')[2].classList.add('active');
    if (id === 'tab-stats') document.querySelectorAll('.tab-btn')[3].classList.add('active');
    if (id === 'tab-logs') document.querySelectorAll('.tab-btn')[4].classList.add('active');
    if(id==='tab-equipe') window.listarEquipe(); if(id==='tab-logs') window.carregarLogs(); if(id==='tab-stats') window.carregarEstatisticas('7');
}

window.carregarEstatisticas = function(modo) {
    const database = getDB(); if(!database) return; let dInicio = new Date(); let dString = "";
    if (modo === 'custom') { const inputMonth = document.getElementById('filtro-mes-ano'); if(inputMonth && inputMonth.value) dString = inputMonth.value; else { alert("Selecione Mês e Ano."); return; } } 
    else { if (modo === 'mes') { dInicio = new Date(dInicio.getFullYear(), dInicio.getMonth(), 1); } else { dInicio.setDate(dInicio.getDate() - parseInt(modo)); } dString = dInicio.toISOString().split('T')[0]; }
    
    database.collection("atendimentos").where("data_ficha", ">=", dString).onSnapshot(snap => {
        let causas = {}, atendentes = {}, sepulturas = {}, funerarias = {}, tempos = {"Menos de 12h":0, "12h a 24h":0, "24h a 48h":0, "Mais de 48h":0}, isencoes = {"PAGO":0, "GRATUIDADE (100%)":0, "DESCONTO (50%)":0};
        let quadras = {}, hospitais = {}, bairros = {}, municipios = {}, valores = {"Até R$ 500":0, "R$ 501 a R$ 1000":0, "R$ 1001 a R$ 2000":0, "Acima de R$ 2000":0};
        let totalValores = 0, qtdValores = 0;

        snap.forEach(doc => {
            const d = doc.data(); if (modo === 'custom' && !d.data_ficha.startsWith(document.getElementById('filtro-mes-ano').value)) return;
            if(d.causa) { d.causa.split('/').forEach(c => { const k = c.trim().toUpperCase(); if(k) causas[k] = (causas[k] || 0) + 1; }); }
            if(d.atendente_sistema) { const func = d.atendente_sistema.trim().toUpperCase(); if(func) atendentes[func] = (atendentes[func] || 0) + 1; }
            if(d.tipo_sepultura) { const t = d.tipo_sepultura.trim().toUpperCase(); if(t) sepulturas[t] = (sepulturas[t] || 0) + 1; }
            if(d.funeraria) { const f = d.funeraria.trim().toUpperCase(); if(f) funerarias[f] = (funerarias[f] || 0) + 1; }
            if(d.isencao) { if(d.isencao === 'SIM') isencoes["GRATUIDADE (100%)"]++; else if(d.isencao === '50') isencoes["DESCONTO (50%)"]++; else isencoes["PAGO"]++; }
            
            if(d.qd) { const q = d.qd.trim().toUpperCase(); if(q) quadras[q] = (quadras[q] || 0) + 1; }
            if(d.hospital) { const h = d.hospital.trim().toUpperCase(); if(h) hospitais[h] = (hospitais[h] || 0) + 1; }
            if(d.resp_bairro) { const b = d.resp_bairro.trim().toUpperCase(); if(b) bairros[b] = (bairros[b] || 0) + 1; }
            if(d.resp_cidade) { const c = d.resp_cidade.trim().toUpperCase(); if(c) municipios[c] = (municipios[c] || 0) + 1; }
            
            if(d.agencia_valor_grm) {
                let v = parseFloat(d.agencia_valor_grm);
                if(!isNaN(v)) {
                    totalValores += v; qtdValores++;
                    if(v <= 500) valores["Até R$ 500"]++; else if(v <= 1000) valores["R$ 501 a R$ 1000"]++; else if(v <= 2000) valores["R$ 1001 a R$ 2000"]++; else valores["Acima de R$ 2000"]++;
                }
            }

            if(d.data_hora_atendimento && d.data_ficha && d.hora) {
                const start = new Date(d.data_hora_atendimento), end = new Date(d.data_ficha + 'T' + d.hora);
                if(!isNaN(start) && !isNaN(end)) {
                    const diffHrs = (end - start) / 3600000;
                    if(diffHrs < 12) tempos["Menos de 12h"]++; else if(diffHrs <= 24) tempos["12h a 24h"]++; else if(diffHrs <= 48) tempos["24h a 48h"]++; else tempos["Mais de 48h"]++;
                }
            }
        });

        const draw = (id, dataObj, lbl, type='bar', color='#3b82f6') => {
            const ctx = document.getElementById(id); if(!ctx || !window.Chart) return;
            const sorted = Object.entries(dataObj).sort((a,b) => b[1] - a[1]).slice(0, 10);
            if(chartInstances[id]) chartInstances[id].destroy();
            chartInstances[id] = new Chart(ctx, { type: type, data: { labels: sorted.map(x=>x[0]), datasets: [{ label: lbl, data: sorted.map(x=>x[1]), backgroundColor: (type==='doughnut'||type==='pie')?['#10b981','#3b82f6','#f59e0b','#ef4444']:color }] }, options: { indexAxis: type==='bar'?'y':'x', maintainAspectRatio: false } });
            if(id === 'grafico-causas') dadosEstatisticasExportacao = sorted.map(([c,q]) => ({"Causa": c, "Qtd": q}));
        };
        
        draw('grafico-causas', causas, 'Top 10 Causas', 'bar', '#3b82f6'); draw('grafico-atendentes', atendentes, 'Atendimentos por Funcionário', 'bar', '#10b981'); 
        draw('grafico-sepulturas', sepulturas, 'Tipos de Sepultura', 'bar', '#f59e0b'); draw('grafico-funerarias', funerarias, 'Top Funerárias', 'bar', '#8b5cf6'); 
        draw('grafico-tempo-resolucao', tempos, 'Tempo de Resolução', 'doughnut'); draw('grafico-isencao', isencoes, 'Perfil Social (Isenções)', 'pie');
        draw('grafico-quadras', quadras, 'Quadras Mais Utilizadas', 'bar', '#0ea5e9'); draw('grafico-hospitais', hospitais, 'Hospitais (Local Óbito)', 'bar', '#ec4899'); 
        draw('grafico-bairros', bairros, 'Bairros dos Contribuintes', 'bar', '#14b8a6'); draw('grafico-municipios', municipios, 'Municípios', 'bar', '#f43f5e');
        
        let mediaValor = qtdValores > 0 ? (totalValores / qtdValores).toFixed(2) : "0.00";
        draw('grafico-valores', valores, `Valores Pagos GRM (Média: R$ ${mediaValor})`, 'bar', '#eab308');
    });
}

// --- CONTRIBUINTES E LOGS ---
window.buscarContribuintes = function() {
    const termo = document.getElementById('input-busca-contribuinte').value.trim().toUpperCase(); const ul = document.getElementById('lista-contribuintes');
    if (!termo) { ul.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b; font-weight: 500;">Digite um termo para buscar.</li>'; return; }
    ul.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b;">Buscando...</li>';
    getDB().collection("atendimentos").get().then(snap => {
        let contribuintesMap = {};
        snap.forEach(doc => {
            let d = doc.data(); let cpf = d.resp_cpf ? d.resp_cpf.replace(/\D/g, '') : ''; let nome = (d.resp_nome || '').toUpperCase(); let rg = d.resp_rg || ''; let tel = d.telefone || '';
            if (cpf.includes(termo.replace(/\D/g, '')) || nome.includes(termo) || rg.includes(termo) || tel.includes(termo)) {
                let key = cpf || nome;
                if (key && !contribuintesMap[key]) { contribuintesMap[key] = { id: doc.id, cpf: d.resp_cpf || '', nome: d.resp_nome || '', rg: d.resp_rg || '', telefone: d.telefone || '', endereco: d.resp_endereco || '', numero: d.resp_numero || '', bairro: d.resp_bairro || '', cidade: d.resp_cidade || '', uf: d.resp_uf || '', cep: d.resp_cep || '', complemento: d.resp_complemento || '' }; }
            }
        });
        let results = Object.values(contribuintesMap); ul.innerHTML = '';
        if (results.length === 0) { ul.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b;">Nenhum contribuinte encontrado.</li>'; return; }
        results.forEach(c => {
            let enderecoCompleto = c.endereco ? `${c.endereco}, ${c.numero} - ${c.bairro}` : 'Não informado';
            ul.innerHTML += `<li class="table-equipe-row"><div style="flex: 2; font-weight: 600; color: #1e293b;">${c.nome}</div><div style="flex: 1.5; color: #475569; font-size: 13px;">${c.cpf} <br> <span style="font-size: 11px; color: #94a3b8;">RG: ${c.rg || '-'}</span></div><div style="flex: 1.5; color: #475569; font-size: 13px;">${c.telefone}</div><div style="flex: 2; color: #475569; font-size: 12px; line-height: 1.2;">${enderecoCompleto}</div><div style="width: 60px; display: flex; justify-content: flex-end;"><button class="btn-action-edit" onclick="editarContribuinte('${c.cpf}', '${c.nome}')" title="Editar Contribuinte">✏️</button></div></li>`;
        });
    });
}
window.editarContribuinte = function(cpf, nome) {
    let query = getDB().collection("atendimentos"); if (cpf) query = query.where("resp_cpf", "==", cpf); else query = query.where("resp_nome", "==", nome);
    query.limit(1).get().then(snap => {
        if (!snap.empty) {
            let d = snap.docs[0].data();
            document.getElementById('edit-contribuinte-cpf-original').value = cpf || nome; document.getElementById('edit-contribuinte-nome').value = d.resp_nome || '';
            document.getElementById('edit-contribuinte-cpf').value = d.resp_cpf || ''; document.getElementById('edit-contribuinte-rg').value = d.resp_rg || '';
            document.getElementById('edit-contribuinte-telefone').value = d.telefone || ''; document.getElementById('edit-contribuinte-cep').value = d.resp_cep || '';
            document.getElementById('edit-contribuinte-endereco').value = d.resp_endereco || ''; document.getElementById('edit-contribuinte-numero').value = d.resp_numero || '';
            document.getElementById('edit-contribuinte-complemento').value = d.resp_complemento || ''; document.getElementById('edit-contribuinte-bairro').value = d.resp_bairro || '';
            document.getElementById('edit-contribuinte-cidade').value = d.resp_cidade || ''; document.getElementById('edit-contribuinte-uf').value = d.resp_uf || '';
            document.getElementById('div-tabela-contribuintes').classList.add('hidden'); document.getElementById('box-busca-contribuinte').classList.add('hidden'); document.getElementById('div-editar-contribuinte').classList.remove('hidden');
        }
    });
}
window.cancelarEdicaoContribuinte = function() { document.getElementById('div-editar-contribuinte').classList.add('hidden'); document.getElementById('div-tabela-contribuintes').classList.remove('hidden'); document.getElementById('box-busca-contribuinte').classList.remove('hidden'); }
window.buscarCEPEdicao = function(cep) { window.buscarCEP(cep); }
window.salvarEdicaoContribuinte = function() {
    const originalKey = document.getElementById('edit-contribuinte-cpf-original').value;
    const novoDados = { resp_nome: document.getElementById('edit-contribuinte-nome').value, resp_rg: document.getElementById('edit-contribuinte-rg').value, telefone: document.getElementById('edit-contribuinte-telefone').value, resp_cep: document.getElementById('edit-contribuinte-cep').value, resp_endereco: document.getElementById('edit-contribuinte-endereco').value, resp_numero: document.getElementById('edit-contribuinte-numero').value, resp_complemento: document.getElementById('edit-contribuinte-complemento').value, resp_bairro: document.getElementById('edit-contribuinte-bairro').value, resp_cidade: document.getElementById('edit-contribuinte-cidade').value, resp_uf: document.getElementById('edit-contribuinte-uf').value };
    let query = getDB().collection("atendimentos"); if (originalKey.match(/\d/)) query = query.where("resp_cpf", "==", originalKey); else query = query.where("resp_nome", "==", originalKey);
    query.get().then(snap => {
        let batch = getDB().batch(); snap.forEach(doc => { batch.update(doc.ref, novoDados); });
        batch.commit().then(() => { alert("Contribuinte atualizado com sucesso!"); cancelarEdicaoContribuinte(); buscarContribuintes(); }).catch(err => alert("Erro ao atualizar."));
    });
}

window.carregarLogs = function() { 
    const tbody = document.getElementById('tabela-logs'); if(!tbody) return; 
    getDB().collection("atendimentos").limit(50).orderBy("data_ficha", "desc").onSnapshot(snap => { 
        tbody.innerHTML = ''; 
        snap.forEach(doc => { 
            let log = doc.data(); let displayDataHora = '-';
            if (log.data_hora_atendimento) { const parts = log.data_hora_atendimento.split('T'); if (parts.length === 2) { const dateParts = parts[0].split('-'); displayDataHora = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} <br> <span style="font-size:11px; color:#666;">${parts[1]}</span>`; } } else { displayDataHora = log.data_ficha ? log.data_ficha.split('-').reverse().join('/') : '-'; }
            const tr = document.createElement('tr'); tr.innerHTML = `<td>${displayDataHora}</td><td>${log.atendente_sistema||'SISTEMA'}</td><td>Cadastro: ${log.nome}</td>`; tbody.appendChild(tr); 
        }); 
    }); 
}

// --- EXPORTAÇÕES E BACKUP ---
window.baixarRelatorioCompleto = function() {
    if(!getDB()) return; if(!confirm("Baixar relatório?")) return;
    if(typeof XLSX === 'undefined') { alert("Biblioteca Excel não carregada."); return; }
    getDB().collection("atendimentos").get().then(snap => {
        let dados = []; snap.forEach(doc => { let d = doc.data(); dados.push([d.data_ficha, d.hora, d.nome, d.causa, d.resp_nome, d.telefone, d.funeraria, d.local, d.sepul, d.protocolo, d.atendente_sistema]); });
        const ws = XLSX.utils.aoa_to_sheet([["Data","Hora","Nome","Causa","Resp","Tel","Funeraria","Local","Sepul","Proto","Atendente"], ...dados]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Geral"); XLSX.writeFile(wb, "Relatorio_Geral.xlsx");
    });
}
window.baixarExcel = function() { if(typeof XLSX === 'undefined' || dadosEstatisticasExportacao.length === 0) { alert("Sem dados ou biblioteca."); return; } const ws = XLSX.utils.json_to_sheet(dadosEstatisticasExportacao); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Stats"); XLSX.writeFile(wb, "Estatisticas.xlsx"); }
window.baixarLogsExcel = function() { 
    if(typeof XLSX === 'undefined') { alert("Erro: Biblioteca Excel ausente."); return; } 
    getDB().collection("atendimentos").limit(100).orderBy("data_ficha", "desc").get().then(snap => { 
        let dados = []; snap.forEach(doc => { const d = doc.data(); const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-'; const atendente = d.atendente_sistema ? d.atendente_sistema.toUpperCase() : 'SISTEMA'; dados.push({ "Data": dataF, "Usuário": atendente, "Ação/Detalhes": `Cadastro: ${d.nome}` }); }); 
        const ws = XLSX.utils.json_to_sheet(dados); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Auditoria"); XLSX.writeFile(wb, "Logs_Auditoria.xlsx"); 
    }); 
}
window.baixarLogsPDF = function() { 
    if(!window.jspdf) { alert("Erro: Biblioteca PDF ausente."); return; } 
    const { jsPDF } = window.jspdf; const doc = new jsPDF(); 
    getDB().collection("atendimentos").limit(100).orderBy("data_ficha", "desc").get().then(snap => { 
        let body = []; snap.forEach(doc => { const d = doc.data(); const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-'; const atendente = d.atendente_sistema ? d.atendente_sistema.toUpperCase() : 'SISTEMA'; body.push([dataF, atendente, `Cadastro: ${d.nome}`]); }); 
        doc.text("Relatório de Auditoria", 14, 10); doc.autoTable({ head: [['Data', 'Usuário', 'Ação/Detalhes']], body: body, startY: 20 }); doc.save("Logs_Auditoria.pdf"); 
    }); 
}
window.baixarTodosExcel = function() {
    if(typeof XLSX === 'undefined') { alert("Biblioteca Excel não carregada."); return; }
    getDB().collection("atendimentos").get().then(snap => {
        let dados = []; snap.forEach(doc => { let d = doc.data(); dados.push({ "ID": doc.id, "Protocolo": d.protocolo || '', "Data Registro": d.data_hora_atendimento || '', "Data Sepultamento": d.data_ficha || '', "Hora": d.hora || '', "Nome": d.nome || '', "Causa": d.causa || '', "Responsável": d.resp_nome || '', "Telefone": d.telefone || '', "Funerária": d.funeraria || '', "Cemitério": d.local || '', "Sepultura": d.sepul || '', "Quadra": d.qd || '', "Atendente": d.atendente_sistema || '' }); });
        const ws = XLSX.utils.json_to_sheet(dados); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Todos_Atendimentos"); XLSX.writeFile(wb, "Backup_Atendimentos.xlsx");
    });
}
window.baixarTodosPDF = function() {
    if(!window.jspdf) { alert("Biblioteca PDF não carregada."); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF('landscape');
    getDB().collection("atendimentos").get().then(snap => {
        let body = []; snap.forEach(doc => { let d = doc.data(); const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-'; body.push([ dataF, d.hora || '-', (d.nome || '').substring(0,20), (d.causa || '').substring(0,20), (d.resp_nome || '').substring(0,15), d.telefone || '-', (d.local || '').replace('CEMITÉRIO DO ', '').replace('CEMITÉRIO DE ', '').trim(), d.sepul || '-', d.protocolo || '-' ]); });
        doc.text("Backup Completo de Atendimentos", 14, 10); doc.autoTable({ head: [['Data', 'Hora', 'Nome', 'Causa', 'Responsável', 'Tel', 'Local', 'Sepul', 'Protocolo']], body: body, startY: 15, styles: { fontSize: 8 } }); doc.save("Backup_Atendimentos.pdf");
    });
}
window.gerarBackup = async function() {
    if(!getDB()) return;
    try {
        const btn = event.target; const originalText = btn.innerText; btn.innerText = "⏳ Gerando..."; btn.disabled = true;
        let backupData = { atendimentos: [], equipe: [], auditoria: [] };
        const atendimentosSnap = await getDB().collection("atendimentos").get(); atendimentosSnap.forEach(doc => backupData.atendimentos.push({ id: doc.id, ...doc.data() }));
        const equipeSnap = await getDB().collection("equipe").get(); equipeSnap.forEach(doc => backupData.equipe.push({ id: doc.id, ...doc.data() }));
        const auditoriaSnap = await getDB().collection("auditoria").get(); auditoriaSnap.forEach(doc => backupData.auditoria.push({ id: doc.id, ...doc.data() }));
        const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; const date = new Date().toISOString().slice(0,10); a.download = `backup_funeraria_${date}.json`;
        document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove(); btn.innerText = originalText; btn.disabled = false;
    } catch (e) { alert("Erro ao gerar backup."); }
}
window.restaurarBackup = function() {
    const fileInput = document.getElementById('file-restore'); const file = fileInput.files[0];
    if (!file) { alert("Por favor, selecione um arquivo de backup (.json)."); return; }
    if (!confirm("⚠️ ATENÇÃO! Isso irá RESTAURAR o banco de dados. Registros com o mesmo ID serão sobrescritos. Deseja continuar?")) { return; }
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const backupData = JSON.parse(e.target.result); let count = 0;
            const restaurarColecao = async (nomeColecao, dados) => { if (dados && dados.length > 0) { for (let item of dados) { const id = item.id; delete item.id; await getDB().collection(nomeColecao).doc(id).set(item); count++; } } };
            await restaurarColecao("atendimentos", backupData.atendimentos); await restaurarColecao("equipe", backupData.equipe); await restaurarColecao("auditoria", backupData.auditoria);
            alert(`Restaurado com sucesso! ${count} registros processados.`); fileInput.value = ""; 
        } catch (error) { alert("Erro ao ler o arquivo. Certifique-se de que é um backup válido."); }
    }; reader.readAsText(file);
}

// --- ADMIN EQUIPE ---
window.listarEquipe = function() { 
    const ul = document.getElementById('lista-equipe'); 
    getDB().collection("equipe").onSnapshot(snap => { 
        ul.innerHTML = ''; 
        snap.forEach(doc => { 
            const u = doc.data(); let nomeSeguro = (u.nome || '').trim(); if (!nomeSeguro) nomeSeguro = 'Usuário';
            const names = nomeSeguro.split(' ').filter(n => n.length > 0); let iniciais = 'U';
            if (names.length > 0) { iniciais = names[0][0].toUpperCase(); if (names.length > 1) iniciais += names[names.length - 1][0].toUpperCase(); else if (names[0].length > 1) iniciais += names[0][1].toUpperCase(); }
            const colors = ['#e0f2fe', '#fef3c7', '#dcfce3', '#f3e8ff', '#ffe4e6', '#ccfbf1']; const textColors = ['#0284c7', '#d97706', '#16a34a', '#9333ea', '#e11d48', '#0d9488'];
            const colorIndex = nomeSeguro.length % colors.length; const bgColor = colors[colorIndex]; const txtColor = textColors[colorIndex];
            ul.innerHTML += `<li class="table-equipe-row"><div class="col-user"><div class="avatar-circle" style="background-color: ${bgColor}; color: ${txtColor};">${iniciais}</div><div style="display: flex; flex-direction: column;"><span style="color:#1e293b; font-size:14px; font-weight:600;">${nomeSeguro}</span><span style="color:#94a3b8; font-size:12px;">${u.email||''}</span></div></div><div class="col-login">${u.login||''}</div><div class="col-pass">*** <button class="btn-icon" style="background:#f8fafc; padding:6px; border-radius:50%; border:none; cursor:pointer;" onclick="alert('Senha: ${u.senha}')">👁️</button></div><div class="col-actions"><button class="btn-action-edit" onclick="window.editarFuncionario('${doc.id}')">✏️</button><button class="btn-action-delete" onclick="window.excluirFuncionario('${doc.id}')">🗑️</button></div></li>`; 
        }); 
    }); 
}
window.adicionarFuncionario = function() { 
    const nome = document.getElementById('novo-nome').value, login = document.getElementById('novo-login').value, email = document.getElementById('novo-email').value, senha = document.getElementById('nova-senha').value;
    if(!nome || !login || !senha) { alert("Preencha nome, login e senha."); return; }
    getDB().collection("equipe").add({ nome, login, email, senha }).then(() => { alert("Usuário adicionado!"); document.getElementById('novo-nome').value = ""; document.getElementById('novo-login').value = ""; document.getElementById('novo-email').value = ""; document.getElementById('nova-senha').value = ""; }).catch(e => alert("Erro: " + e));
}
window.excluirFuncionario = function(id) { if(confirm("Excluir?")) getDB().collection("equipe").doc(id).delete(); }
window.editarFuncionario = function(id) {
    getDB().collection("equipe").doc(id).get().then(doc => {
        if(doc.exists) { const u = doc.data(); document.getElementById('edit-id').value = doc.id; document.getElementById('edit-nome').value = u.nome; document.getElementById('edit-login').value = u.login; document.getElementById('edit-email').value = u.email; document.getElementById('edit-senha').value = u.senha; document.getElementById('box-novo-usuario').classList.add('hidden'); document.getElementById('div-editar-usuario').classList.remove('hidden'); }
    });
}
window.salvarEdicaoUsuario = function() {
    const id = document.getElementById('edit-id').value, nome = document.getElementById('edit-nome').value, email = document.getElementById('edit-email').value, senha = document.getElementById('edit-senha').value;
    if(!nome || !senha) { alert("Nome e senha são obrigatórios."); return; }
    getDB().collection("equipe").doc(id).update({ nome, email, senha }).then(() => { alert("Usuário atualizado!"); window.cancelarEdicao(); }).catch(e => alert("Erro: " + e));
}
window.cancelarEdicao = function() { document.getElementById('edit-id').value = ""; document.getElementById('edit-nome').value = ""; document.getElementById('edit-login').value = ""; document.getElementById('edit-email').value = ""; document.getElementById('edit-senha').value = ""; document.getElementById('div-editar-usuario').classList.add('hidden'); document.getElementById('box-novo-usuario').classList.remove('hidden'); }

// --- MODAL ACOLHIMENTO E CADASTRO ---
window.abrirModal = function() {
    document.getElementById('form-atendimento').reset(); document.getElementById('docId').value = ""; document.getElementById('div-motivo-edicao').classList.add('hidden');
    if (usuarioLogado) document.getElementById('atendente_sistema').value = usuarioLogado.nome;
    document.getElementById('data_hora_atendimento').value = (new Date(new Date() - new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    if(document.getElementById('filtro-data')) document.getElementById('data_ficha_modal').value = document.getElementById('filtro-data').value;
    safeDisplay('modal', 'block');
}
window.editar = function(id) {
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); for (let key in d) { const el = document.getElementById(key); if(el) el.value = d[key]; }
            document.getElementById('docId').value = doc.id;
            ['tanato', 'invol', 'translado', 'urna_opc'].forEach(k => { const chk = document.getElementById('chk_'+k); if(chk) chk.checked = (d[k] === 'SIM'); });
            const chkInd = document.getElementById('chk_indigente'); if(chkInd) { chkInd.checked = (d.indigente === 'SIM'); window.toggleIndigente(); }
            document.getElementById('div-motivo-edicao').classList.remove('hidden'); safeDisplay('modal', 'block');
        }
    });
}
window.fecharModal = function() { safeDisplay('modal', 'none'); }

const formAcolhimento = document.getElementById('form-atendimento');
if(formAcolhimento) {
    formAcolhimento.onsubmit = (e) => {
        e.preventDefault(); const id = document.getElementById('docId').value; let dados = {};
        Array.from(formAcolhimento.elements).forEach(el => { if(el.id && el.type !== 'submit' && el.type !== 'button') { dados[el.id] = el.type === 'checkbox' ? (el.checked ? 'SIM' : 'NAO') : el.value; } });
        if(!dados.atendente_sistema && usuarioLogado) dados.atendente_sistema = usuarioLogado.nome; dados.local = document.getElementById('filtro-local').value;
        if(!id && !dados.protocolo) dados.protocolo = window.gerarProtocolo();
        if(id) {
            if(!document.getElementById('motivo_edicao').value) { alert("Motivo obrigatório na edição."); return; }
            getDB().collection("atendimentos").doc(id).update(dados).then(() => { window.fecharModal(); window.abrirModalDocsAcolhimento(id); });
        } else { getDB().collection("atendimentos").add(dados).then((docRef) => { window.fecharModal(); window.abrirModalDocsAcolhimento(docRef.id); }); }
    }
}

// --- CHECKLIST E MESCLAR PDFS (ACOLHIMENTO) ---
window.abrirModalDocsAcolhimento = function(id) {
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); document.getElementById('docs_acolhimento_id').value = id;
            const campos = ['autorizacao', 'rg_perm', 'obito', 'rg_falecido', 'residencia', 'guia_cartorio', 'moeda', 'bolsa', 'loas', 'cadunico', 'cras', 'parentesco', 'casamento', 'locacao', 'procuracao'];
            campos.forEach(c => { const chk = document.getElementById(`chk_doc_${c}`); if(chk) chk.checked = (d[`chk_doc_${c}`] === true); });
            const elLnk = document.getElementById('link_docs_acolhimento'); if(elLnk) elLnk.value = d.url_docs_acolhimento || '';
            let nAj = (d.nome || 'NAO_INFORMADO').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); let pAj = d.protocolo || 'SEM_PROTO'; window.nomePastaPadrao = `${pAj}_${nAj}`;
            safeDisplay('modal-docs-acolhimento', 'block');
        }
    });
}
window.abrirModalDocsAcolhimentoModal = function() { if(dadosAtendimentoAtual && dadosAtendimentoAtual.id) { window.fecharModalVisualizar(); window.abrirModalDocsAcolhimento(dadosAtendimentoAtual.id); } }
window.fecharModalDocsAcolhimento = function() { safeDisplay('modal-docs-acolhimento', 'none'); }

window.salvarDocsAcolhimento = function() {
    const id = document.getElementById('docs_acolhimento_id').value; if(!id) return;
    const campos = ['autorizacao', 'rg_perm', 'obito', 'rg_falecido', 'residencia', 'guia_cartorio', 'moeda', 'bolsa', 'loas', 'cadunico', 'cras', 'parentesco', 'casamento', 'locacao', 'procuracao'];
    let updates = {}; campos.forEach(c => { const chk = document.getElementById(`chk_doc_${c}`); if(chk) updates[`chk_doc_${c}`] = chk.checked; });
    const elLnk = document.getElementById('link_docs_acolhimento'); if(elLnk) updates.url_docs_acolhimento = elLnk.value.trim();
    getDB().collection("atendimentos").doc(id).update(updates).then(() => {
        getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', acao: "ATUALIZOU DOCS ACOLHIMENTO", detalhe: `ID: ${id}` });
        alert("Checklist salvo com sucesso!"); window.fecharModalDocsAcolhimento();
    }).catch(e => { alert("Erro ao salvar os documentos."); });
}

window.mesclarEBaixarPDFsAcolhimento = async function(event) {
    event.preventDefault(); const fileInput = document.getElementById('pdf_merger_input_acolhimento');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) { alert("Selecione pelo menos um arquivo PDF."); return; }
    try {
        const btn = event.target; const oldTxt = btn.innerText; btn.innerText = "Mesclando..."; btn.disabled = true;
        const pdfDoc = await window.PDFLib.PDFDocument.create();
        for (let i = 0; i < fileInput.files.length; i++) {
            const f = fileInput.files[i]; if (f.type !== "application/pdf") { alert("Selecione apenas PDFs."); btn.innerText = oldTxt; btn.disabled = false; return; }
            const arr = await f.arrayBuffer(); const currentPdf = await window.PDFLib.PDFDocument.load(arr);
            const copiedPages = await pdfDoc.copyPages(currentPdf, currentPdf.getPageIndices()); copiedPages.forEach((page) => pdfDoc.addPage(page));
        }
        const mergedPdfBytes = await pdfDoc.save(); const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' }); const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; const docId = document.getElementById('docs_acolhimento_id').value; let fileName = "Documentos_Acolhimento.pdf";
        if(docId) {
            const docSnap = await getDB().collection("atendimentos").doc(docId).get();
            if(docSnap.exists) { const d = docSnap.data(); let n = (d.nome || 'NAO_INFORMADO').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); let p = d.protocolo || 'SEM_PROTO'; fileName = `${p}_${n}.pdf`; }
        }
        a.download = fileName; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove(); btn.innerText = oldTxt; btn.disabled = false; alert("PDFs mesclados e baixados!"); fileInput.value = "";
    } catch (err) { console.error(err); alert("Erro ao mesclar arquivos."); event.target.innerText = "Mesclar e Baixar PDF"; event.target.disabled = false; }
};

// --- MODAL AGÊNCIA (EDIÇÃO DE LINKS E E-CIGA) ---
window.abrirModalAgencia = function(id) {
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); document.getElementById('agencia_docId').value = doc.id; document.getElementById('agencia_nome_falecido').innerText = (d.nome || 'N/I').toUpperCase();
            document.getElementById('agencia_processo').value = d.agencia_processo || ''; document.getElementById('agencia_grm').value = d.agencia_grm || 'PENDENTE'; document.getElementById('agencia_status_liberacao').value = d.agencia_status_liberacao || 'PENDENTE';
            document.getElementById('agencia_valor_grm').value = d.agencia_valor_grm || '';
            ['invol', 'nf', 'tanato', 'comprovante', 'guia_grm'].forEach(k => { document.getElementById(`agencia_chk_${k}`).checked = (d[`agencia_chk_${k}`] === true); document.getElementById(`link_input_${k}`).value = d[`url_${k}`] || ''; });
            let nomeAjustado = (d.nome || 'NAO_INFORMADO').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); let protocoloAjustado = d.protocolo || 'SEM_PROTO'; window.nomePastaPadrao = `${protocoloAjustado}_${nomeAjustado}`;
            document.getElementById('agencia_atendente_modal').innerText = (d.agencia_atendente || 'NÃO ASSUMIDO').toUpperCase(); safeDisplay('modal-agencia', 'block');
        }
    });
}
window.fecharModalAgencia = function() { safeDisplay('modal-agencia', 'none'); }
window.salvarDadosAgencia = function() {
    const id = document.getElementById('agencia_docId').value; if(!id) return;
    const dados = { agencia_processo: document.getElementById('agencia_processo').value, agencia_grm: document.getElementById('agencia_grm').value, agencia_status_liberacao: document.getElementById('agencia_status_liberacao').value, agencia_valor_grm: document.getElementById('agencia_valor_grm').value, agencia_chk_invol: document.getElementById('agencia_chk_invol').checked, agencia_chk_nf: document.getElementById('agencia_chk_nf').checked, agencia_chk_tanato: document.getElementById('agencia_chk_tanato').checked, agencia_chk_comprovante: document.getElementById('agencia_chk_comprovante').checked, agencia_chk_guia_grm: document.getElementById('agencia_chk_guia_grm').checked, url_invol: document.getElementById('link_input_invol').value.trim(), url_nf: document.getElementById('link_input_nf').value.trim(), url_tanato: document.getElementById('link_input_tanato').value.trim(), url_comprovante: document.getElementById('link_input_comprovante').value.trim(), url_guia_grm: document.getElementById('link_input_guia_grm').value.trim() };
    getDB().collection("atendimentos").doc(id).update(dados).then(() => { getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: usuarioLogado ? usuarioLogado.nome : 'Anon', acao: "ATUALIZAÇÃO AGÊNCIA", detalhe: `Processo: ${dados.agencia_processo}` }); window.fecharModalAgencia(); }).catch(e => alert("Erro ao salvar trâmites da agência."));
}

// --- IMPRESSÃO DOS DOCUMENTOS (COMPACTADOS PARA CABER NO LIMITE) ---
window.abrirModalLiberacao = function(id) { window.idLiberacaoAtual = id; safeDisplay('modal-liberacao', 'flex'); }
window.fecharModalLiberacao = function() { safeDisplay('modal-liberacao', 'none'); }

window.gerarFormularioLiberacao = function(tipo) {
    if (!window.idLiberacaoAtual) return;
    getDB().collection("atendimentos").doc(window.idLiberacaoAtual).get().then(doc => {
        if (doc.exists) {
            const d = doc.data(); const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : ''; const ag = new Date(); const hAt = String(ag.getHours()).padStart(2,'0')+':'+String(ag.getMinutes()).padStart(2,'0'); const at = (d.agencia_atendente || (usuarioLogado ? usuarioLogado.nome : '')).toUpperCase(); const tp = tipo === 'municipal' ? 'SEPULTAMENTO' : 'CREMAÇÃO'; const sep = tipo === 'municipal' ? `${d.tipo_sepultura||''} ${d.sepul?'Nº '+d.sepul:''}`.toUpperCase() : ''; const sig = d.assinatura_atendente ? `<img src="${d.assinatura_atendente}" style="max-height:50px; margin-bottom:5px;">` : `<div style="height:50px;"></div>`;
            const html = `<html><head><title>Liberação</title><style>@page{size: A4 portrait; margin: 15mm;}body{font-family: Arial, sans-serif; margin: 0; padding: 0; color: #000; font-size: 13px;}table{border-collapse: collapse; width: 100%;}td{border: 2px solid #000;}.bg-gray{background-color: #ebebeb; font-weight: bold; text-align: center; text-transform: uppercase;}.label-cell{padding: 8px 10px; font-weight: normal;}.value-cell{padding: 8px 10px;}</style></head><body><table style="border: 2px solid #000;"><tr><td style="width: 35%; border-bottom: 2px solid #000; text-align: center; padding: 15px;"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height: 80px;"></td><td style="width: 65%; border-bottom: 2px solid #000; text-align: center; font-weight: bold; line-height: 1.8; font-size: 14px; padding: 15px;">SECRETARIA DE MOBILIDADE E INFRAESTRUTURA - SEMOBI<br><br>SUBSECRETARIA DE INFRAESTRUTURA - SSINFRA<br><br>COORDENADORIA MUNICIPAL DE SERVIÇOS FUNERÁRIOS<br><br>AGÊNCIA FUNERÁRIA MUNICIPAL</td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; text-align: center; font-weight: bold; padding: 8px;">CERTIFICO e dou fé que, nesta data, estamos finalizando o Processo Administrativo</td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; padding: 0;"><table><tr><td style="width: 10%; border: none; border-right: 2px solid #000; padding: 10px; text-align: center;">Nº</td><td style="width: 35%; border: none; border-right: 2px solid #000; padding: 10px;" class="bg-gray">${d.agencia_processo||''}</td><td style="width: 20%; border: none; border-right: 2px solid #000; padding: 10px; text-align: center;">, processo de</td><td style="width: 35%; border: none; padding: 10px;" class="bg-gray">${tp}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; padding: 0;"><table><tr><td style="width: 15%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Falecido:</td><td style="width: 85%; border: none; padding: 10px;" class="bg-gray">${(d.nome||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; padding: 0;"><table><tr><td style="width: 15%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Data:</td><td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="bg-gray">${dataF}</td><td style="width: 55%; border: none;"></td></tr></table></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; padding: 0;"><table><tr><td style="width: 35%; border: none; border-right: 2px solid #000; padding: 10px; text-align: center;" class="label-cell">Sepultamento/Crematório no Cemitério<br>Municipal/Privado:</td><td style="width: 65%; border: none; padding: 10px; vertical-align: middle;" class="bg-gray">${(d.local||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; padding: 0;"><table><tr><td style="width: 15%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Horário:</td><td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="bg-gray">${d.hora||''}</td><td style="width: 25%; border: none; border-right: 2px solid #000; padding: 10px; text-align: center;" class="label-cell">Horário da Liberação:</td><td style="width: 30%; border: none; padding: 10px;" class="bg-gray">${hAt}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; padding: 0;"><table><tr><td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Saindo o féretro da Capela:</td><td style="width: 70%; border: none; padding: 10px;" class="bg-gray">${(d.cap||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; padding: 0;"><table><tr><td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Para a Sepultura:</td><td style="width: 70%; border: none; padding: 10px;" class="bg-gray">${sep}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom: 2px solid #000; height: 15px; border-left: none; border-right: none;"></td></tr><tr><td colspan="2" style="padding: 0;"><table><tr><td style="width: 30%; border: none; border-right: 2px solid #000; padding: 10px;" class="label-cell">Funerária:</td><td style="width: 70%; border: none; padding: 10px;" class="bg-gray">${(d.funeraria||'').toUpperCase()}</td></tr></table></td></tr></table><div style="text-align: center; margin-top: 40px;">${sig}<div style="border-top: 1px dashed #000; width: 350px; margin: 0 auto; margin-bottom: 5px;"></div><span style="font-weight: bold; font-size: 13px;">Assinatura do Responsável</span><br><span style="font-size: 13px;">${at}</span><br><br><span style="font-weight: bold; font-size: 13px;">Matrícula</span><br><span style="font-size: 13px;">_________________</span></div></body><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></html>`;
            const w = window.open('','_blank'); w.document.write(html); w.document.close(); fecharModalLiberacao();
        }
    });
}

window.gerarAutorizacao = function() {
    if (!dadosAtendimentoAtual) return; const d = dadosAtendimentoAtual; const fd = (dStr) => dStr ? dStr.split('-').reverse().join('/') : '';
    let txtSep = (d.tipo_sepultura || "").toUpperCase(); const co = d.classificacao_obito || "ADULTO"; let c = co === "ANJO" ? "ANJO" : "ADULTO";
    let cond = "ALUGUEL (3 ANOS)"; if (txtSep.includes("PERPETU")) { txtSep += " - " + c; cond = `PERPÉTUA (L: ${d.livro_perpetua||'-'} / F: ${d.folha_perpetua||'-'})`; } else if (txtSep.includes("MEMBRO")) { txtSep = `MEMBRO AMPUTADO`; cond = "N/A"; } else { txtSep += " - " + c; }
    const hoje = new Date(); const dExt = `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
    const chk = (tipo, classe, alvoTipo, alvoClasse) => { let t = (tipo||'').toUpperCase(); let cx = (classe||'ADULTO').toUpperCase(); return (t.includes(alvoTipo) && cx === alvoClasse) ? 'X' : '  '; };
    const html = `<html><head><title>Autorização</title><style>@page{size: A4 portrait; margin: 10mm;}body{font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 0; line-height: 1.2;} .bold{font-weight: bold; text-transform: uppercase;} .ass{margin-top: 15px; text-align: center; width: 60%; margin-left: auto; margin-right: auto;} .box{margin: 8px 0; padding: 8px; border: 1px solid #333;} .box h4{margin: 0 0 5px 0; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 3px;}</style></head><body><div style="text-align:center; margin-bottom:10px;"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height: 50px;"><h2>AUTORIZAÇÃO PARA TRÂMITES DE FUNERAL</h2></div><p>Eu, <span class="bold">${d.resp_nome||''}</span>, RG: <span class="bold">${d.resp_rg||''}</span> CPF n° <span class="bold">${d.resp_cpf||''}</span>, residente na <span class="bold">${d.resp_endereco||''}</span> n° <span class="bold">${d.resp_numero||''}</span> complemento <span class="bold">${d.resp_complemento||''}</span> bairro <span class="bold">${d.resp_bairro||''}</span> Município <span class="bold">${d.resp_cidade||''}</span> Estado <span class="bold">${d.resp_uf||''}</span> CEP: <span class="bold">${d.resp_cep||''}</span>, telefone: <span class="bold">${d.telefone||''}</span>, parentesco <span class="bold">${(d.parentesco||'').toUpperCase()}</span>, a tratar junto à Agência Funerária dos Cemitérios Municipais de Niterói do Sepultamento do(a) Sr(a) qualificado(a) abaixo:</p><div class="box"><h4>DADOS DO FALECIDO</h4><div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;"><div style="grid-column:span 2"><strong>NOME:</strong> ${(d.nome||'').toUpperCase()}</div><div><strong>DATA DO ÓBITO:</strong> ${fd(d.data_obito)}</div><div><strong>LOCAL:</strong> ${(d.hospital||'').toUpperCase()}</div><div style="grid-column:span 2"><strong>CAUSA:</strong> ${(d.causa||'').toUpperCase()}</div></div></div><div class="box"><h4>DADOS DO SEPULTAMENTO</h4><div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;"><div style="grid-column:span 2"><strong>CEMITÉRIO:</strong> ${(d.local||'').toUpperCase()}</div><div><strong>DATA:</strong> ${fd(d.data_ficha)}</div><div><strong>HORA:</strong> ${d.hora||''}</div><div style="grid-column:span 2"><strong>TIPO:</strong> ${txtSep}</div><div><strong>Nº:</strong> ${d.sepul||''}</div><div><strong>QD/RUA:</strong> ${d.qd||''}</div><div><strong>CONDIÇÃO:</strong> ${cond}</div><div><strong>AUTORIZAÇÃO P/ SEPULTAR < 24 HORAS:</strong> ${(d.do_24h==='SIM'?'SIM':'NÃO')}</div></div></div><p style="font-weight:bold; text-align:center;">* ESTOU CIENTE E ACEITO A SEPULTURA DISPONÍVEL.</p><p>AUTORIZO a agência funerária <span class="bold">${(d.funeraria||'').toUpperCase()}</span> a realizar a remoção e trâmites legais.</p><p style="text-align: right;">Niterói, ${dExt}</p><div class="ass"><div style="height:35px;"></div><div style="border-top:1px solid #000;">Assinatura do(a) autorizador(a)</div></div><div style="border-top:1px dashed #999; margin:10px 0;"></div><h3>AUTORIZAÇÃO PARA PAGAMENTO DAS TAXAS</h3><p>Autorizo a Funerária <span class="bold">${(d.funeraria||'').toUpperCase()}</span> a efetuar o pagamento das taxas inerentes ao funeral.</p><div class="ass"><div style="height:35px;"></div><div style="border-top:1px solid #000;">Assinatura</div></div><div style="border-top:1px dashed #999; margin:10px 0;"></div><h3>NÃO AUTORIZAÇÃO PARA PAGAMENTO DAS TAXAS</h3><p>NÃO autorizo a Funerária <span class="bold">${(d.funeraria||'').toUpperCase()}</span> a efetuar o pagamento das taxas. Sendo de minha inteira responsabilidade.</p><div class="ass"><div style="height:35px;"></div><div style="border-top:1px solid #000;">Assinatura (Apenas se NÃO autorizar)</div></div></body><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}

window.gerarComprovante = function() {
    if (!dadosAtendimentoAtual) return; const d = dadosAtendimentoAtual; const chk = (cond) => cond ? '(X)' : '( )'; const fd = (dataStr) => dataStr ? dataStr.split('-').reverse().join('/') : '';
    const p = d.protocolo || ""; let dhT = "";
    if (d.data_hora_atendimento) { const parts = d.data_hora_atendimento.split('T'); if (parts.length === 2) { const dp = parts[0].split('-'); dhT = `${dp[2]}/${dp[1]}/${dp[0]} AS ${parts[1]}`; } } 
    else { const now = new Date(); dhT = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} AS ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`; }
    const im = (d.local && d.local.includes("MARUÍ")), is = (d.local && d.local.includes("SÃO FRANCISCO")), ii = (d.local && d.local.includes("ITAIPU")), cc = (d.cap && !d.cap.toUpperCase().includes("SEM"));
    let tempD = ""; if (d.data_obito && d.hora_obito && d.hora && d.data_ficha) { const diff = new Date(d.data_ficha+'T'+d.hora) - new Date(d.data_obito+'T'+d.hora_obito); if (diff > 0) tempD = `${Math.floor(diff/3600000)}h ${Math.round(((diff%3600000)/60000))}min`; }
    const chkEC = (val) => (d.estado_civil||"") === val ? '(X)' : '( )'; const rel = d.parentesco ? `(${d.parentesco})` : '';
    let txtSep = (d.tipo_sepultura || "").toUpperCase(), co = d.classificacao_obito || "ADULTO", txtHO = d.hora_obito || ""; if (d.ignorar_hora_obito === 'SIM') txtHO += " (IGNORADO)"; 
    let c = co === "ANJO" ? "ANJO" : "ADULTO";
    if (txtSep.includes("PERPETU")) txtSep = `${txtSep} (L: ${d.livro_perpetua||'-'} / F: ${d.folha_perpetua||'-'}) - ${c}`; else if (txtSep.includes("MEMBRO")) txtSep = `MEMBRO AMPUTADO (${d.tipo_membro || d.tipo_membro_select || 'N/I'})`; else txtSep = `${txtSep} - ${c}`;
    let dEx = ""; if (d.data_ficha) { const parts = d.data_ficha.split('-'); dEx = `${parts[2]}/${parts[1]}/${parseInt(parts[0]) + (c==='ANJO'?2:3)}`; }
    let bFam = assinaturaResponsavelImg ? `<div style="text-align:center;height:45px;"><img src="${assinaturaResponsavelImg}" style="max-height:40px;max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    let bAte = assinaturaAtendenteImg ? `<div style="text-align:center;height:45px;"><img src="${assinaturaAtendenteImg}" style="max-height:40px;max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    let nAte = (d.atendente_sistema || (usuarioLogado ? usuarioLogado.nome : 'N/A')).toUpperCase();
    const htmlComprovante = `<html><head><title>Comprovante</title><style>@page{size:A4 portrait;margin:8mm;}body{font-family:Arial,sans-serif;font-size:14px;margin:0;padding:10px;line-height:1.3;color:#000;}.header{text-align:center;margin-bottom:25px;position:relative;}.header h2{font-size:20px;text-decoration:underline;margin:0;font-weight:bold;text-transform:uppercase;color:#000;}.protocolo{position:absolute;top:-5px;right:0;font-size:14px;font-weight:bold;border:2px solid #000;padding:5px 10px;}.line{margin-bottom:4px;white-space:normal;word-wrap:break-word;overflow:visible;}.bold{font-weight:900;}.red{color:red;font-weight:bold;}.section-title{font-weight:900;margin-top:15px;margin-bottom:2px;text-transform:uppercase;font-size:14px;}.two-columns{display:flex;justify-content:space-between;margin-top:10px;}.col-left{width:60%;}.col-right{width:38%;}.assinaturas-block{display:flex;justify-content:space-between;margin-top:25px;margin-bottom:10px;gap:20px;}.ass-line{text-align:center;padding-top:2px;flex:1;font-size:12px;}.box-lateral{border:2px solid #000;padding:5px;font-weight:900;font-size:12px;height:100%;display:flex;flex-direction:column;justify-content:space-between;}.termo-juridico{text-align:justify;font-size:12px;line-height:1.3;}.footer-line{margin-top:10px;border-top:1px solid #000;padding-top:5px;font-weight:900;font-size:12px;}.aviso-final{border:2px solid #000;padding:5px;margin-top:10px;font-weight:900;text-align:justify;font-size:12px;line-height:1.3;}.spacer{margin-left:10px;}</style></head><body><div class="header"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height:60px;margin-bottom:5px;"><h2>Comprovante de Atendimento</h2><div class="protocolo">PROTOCOLO: ${p}</div></div><div class="content"><div class="line"><span class="bold">Nome do FALECIDO:</span> ${(d.nome||'').toUpperCase()}</div><div class="line"><span class="bold">Nome do RESPONSÁVEL:</span> ${(d.resp_nome||'').toUpperCase()} <span style="margin-left:5px;font-weight:normal;">${rel}</span></div><div class="line"><span class="bold">Funerária:</span> ${(d.funeraria||'').toUpperCase()} <span style="margin-left:15px">(Rep: ${d.func_funeraria||'N/A'})</span></div><div class="line"><span class="bold">Atendente Responsável:</span> ${nAte}<span class="bold" style="margin-left:20px">DATA DE HORARIO DE ATENDIMENTO:</span> ${dhT}</div><div class="line"><span class="bold">Data:</span> ${fd(d.data_ficha)} <span class="bold spacer">Hora:</span> ${d.hora||''} <span class="bold spacer">SEPULTURA:</span> ${d.sepul||''} <span class="bold spacer">${im?"QUADRA:":"RUA:"}</span> ${d.qd||''} <span class="bold spacer">CAPELA:</span> ${d.cap||''}</div><div class="line"><span class="bold">COM CAPELA</span> ${chk(cc)} <span class="bold">SEM CAPELA</span> ${chk(!cc)} <span class="bold spacer">DATA DO FALECIMENTO:</span> ${fd(d.data_obito)} AS ${txtHO} <span class="red spacer">[${tempD}]</span></div><div class="line"><span class="bold">Cemitério:</span> (${im?'X':' '}) MARUÍ (${is?'X':' '}) SÃO FRANCISCO XAVIER (${ii?'X':' '}) SÃO LÁZARO DE ITAIPÚ</div><div class="line">${chkEC('SOLTEIRO')} SOLTEIRO ${chkEC('CASADO')} CASADO ${chkEC('VIUVO')} VÍUVO ${chkEC('UNIAO_ESTAVEL')} UNIÃO ESTÁVEL ${chkEC('DIVORCIADO')} DIVORCIADO ${chkEC('IGNORADO')} IGNORADO</div><div class="section-title">ASSINAR TERMO DE COMPROMISSO NO CEMITÉRIO</div><div class="line" style="margin-top:5px;font-size:14px;border:1px solid #000;padding:5px;"><span class="bold">TIPO DE SEPULTURA SELECIONADA:</span> ${txtSep}</div><div class="line" style="margin-top:10px"><span class="bold">TANATO:</span> (${d.tanato==='SIM'?'X':' '}) SIM (${d.tanato==='NAO'?'X':' '}) NÃO</div><div class="assinaturas-block"><div class="ass-line">${bAte}<div style="border-top:1px solid #000;">Acolhimento / Atendente:<br><b>${nAte}</b></div></div><div class="ass-line">${bFam}<div style="border-top:1px solid #000;">Assinatura do responsável/família<br><b>${(d.resp_nome||'').toUpperCase()}</b></div></div></div><div style="font-weight:bold;font-size:12px;margin-top:5px;">OBS: PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.</div><div style="font-weight:bold;font-size:12px;margin-top:5px;">OBS.: VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.</div><div class="line" style="margin-top:15px;border:2px solid #000;padding:5px;"><span class="bold">PREVISÃO DE EXUMAÇÃO:</span> A partir de <span class="red" style="font-size:16px;">${dEx}</span><br><span style="font-size:10px;">(Legislação: 3 anos para Adultos / 2 anos para Crianças até 11 anos)</span><div style="margin-top:12px;margin-bottom:8px;border:2px dashed #000;padding:8px;text-align:center;font-weight:900;font-size:13px;">⚠️ ATENÇÃO: COMPAREÇA OU ENTRE EM CONTATO NO PRAZO MÍNIMO DE 90 DIAS ANTES DA DATA DE EXUMAÇÃO PARA ABERTURA DE PROCESSO.</div><div style="margin-top:15px;text-align:center;">${bFam}<div style="border-top:1px solid #000;width:60%;margin:0 auto;">Assinatura do Responsável (Ciência do Prazo)</div></div></div><div class="two-columns"><div class="col-left"><div style="text-align:center;font-weight:bold;text-decoration:underline;margin-bottom:5px;">TERMO DE COMPROMISSO CEMITÉRIOS MUNICIPAIS</div><div class="termo-juridico">Sendo o <span class="bold">FALECIDO CASADO</span>, o responsável perante, o Cemitério do MARUÍ, SÃO FRANCISCO E ITAIPU será obrigatoriamente o <span class="bold">CONJUGE</span>.<br>Sendo o <span class="bold">FALECIDO VIÚVO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU serão obrigatoriamente os <span class="bold">FILHOS</span>.<br>Sendo o <span class="bold">FALECIDO SOLTEIRO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU obrigatoriamente os <span class="bold">FILHOS, PAIS, IRMÃOS</span>.<br>Será exigida a apresentação de documentos de <span class="bold" style="text-decoration:underline">IDENTIDADE e CPF</span>.</div><div class="assinaturas-block" style="margin-top:40px;"><div style="flex:1;"></div><div class="ass-line">${bFam}<div style="border-top:1px solid #000;">Assinatura funcionário/família</div></div></div></div><div class="col-right"><div class="box-lateral"><div>CAPELAS MUNICIPAIS E PARTICULARES:</div><br><div>PAGAMENTO E NOTA FISCAL DAS TAXAS MUNICIPAIS E INVOL COM DUAS HORAS ANTES DO SEPULTAMENTO</div><br><br><div>CLIENTE: _____________________</div></div></div></div><div class="footer-line">MARCADO: ________________________ PERMISSIONÁRIO: ${(d.resp_nome||'').toUpperCase()}</div><div style="font-weight:bold;font-size:12px;margin-top:5px;">TEL: ${d.telefone||''}</div><div class="aviso-final"><span style="text-decoration:underline">COMUNICADO AOS FAMILIARES DO FALECIDO E AS EMPRESAS FUNERÁRIAS RESPONSÁVEIS PELO SEPULTAMENTO.</span><br>Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos:<span class="bold">GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL PELO SERVIÇO), TAXAS MUNICIPAIS PAGAS e INVOL.</span></div></div></body><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></html>`;
    const w = window.open('','_blank'); w.document.write(htmlComprovante); w.document.close();
}

// --- DOM INIT E VISUALIZAR ---
document.addEventListener('DOMContentLoaded', () => {
    window.carregarListaHorarios();
    const chkMembro = document.getElementById('chk_membro'); const ts = document.getElementById('tipo_membro_select');
    if (chkMembro && ts) chkMembro.addEventListener('change', function() { ts.disabled = !this.checked; if (!this.checked) ts.value = ''; });
    const secCausas = document.getElementById('seletor_causas'); const inCausa = document.getElementById('causa');
    if (secCausas && inCausa) secCausas.addEventListener('change', function() { if (this.value) { inCausa.value = inCausa.value === "" ? this.value : inCausa.value + " / " + this.value; this.value = ""; } });
    const selTipo = document.getElementById('tipo_sepultura');
    if (selTipo) selTipo.addEventListener('change', function() { const divP = document.getElementById('div-perpetua'); if (this.value.toUpperCase().includes('PERPETU')) divP.classList.remove('hidden'); else divP.classList.add('hidden'); });
    const sf = document.getElementById('filtro-local'); if(sf) sf.addEventListener('change', (e) => { window.atualizarListener(document.getElementById('filtro-data').value, e.target.value); window.atualizarLabelQuadra(e.target.value); });
    const fd = document.getElementById('filtro-data'); if(fd) fd.addEventListener('change', (e) => window.atualizarListener(e.target.value, document.getElementById('filtro-local').value));
    const sessao = sessionStorage.getItem('usuarioLogado'); if (sessao) { usuarioLogado = JSON.parse(sessao); safeDisplay('tela-bloqueio', 'none'); if(sf) window.atualizarListener(window.pegarDataAtualLocal(), sf.value); }
});

window.visualizar = function(id) {
    if(!getDB()) return;
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); d.id = doc.id; dadosAtendimentoAtual = d;
            let isenStr = (d.isencao === '50') ? "50% DESCONTO" : (d.isencao === 'SIM' ? "100% GRATUIDADE" : "NÃO (PAGO)"); if (d.requisito) isenStr += ` - ${d.requisito}`;
            let servs = []; if (d.tanato === 'SIM') servs.push('TANATOPRAXIA'); if (d.invol === 'SIM') servs.push('INVOL'); if (d.translado === 'SIM') servs.push('TRANSLADO'); if (d.urna_opc === 'SIM') servs.push('URNA OPCIONAL');
            const m = { 
                'view_protocolo': d.protocolo || 'S/ PROTOCOLO', 'view_hora': d.hora || '--:--', 'view_nome': (d.nome || 'NÃO INFORMADO').toUpperCase(), 'view_causa': (d.causa || 'NÃO INFORMADA').toUpperCase(), 
                'view_resp_completo': (d.resp_nome || 'N/I').toUpperCase() + (d.parentesco ? ` (${d.parentesco})` : ''), 'view_resp_cpf': d.resp_cpf || '-', 'view_resp_rg': d.resp_rg || '-', 'view_telefone': d.telefone || '-', 
                'view_funeraria': (d.funeraria || 'N/I').toUpperCase(), 'view_atendente': (d.atendente_sistema || 'N/I').toUpperCase(), 'view_combo_urna': d.combo_urna || '-', 'view_hospital_completo': (d.hospital || 'N/I').toUpperCase(), 
                'view_cap': (d.cap || 'N/I').toUpperCase(), 'view_urna_info': d.urna_info || 'Sem observações adicionais.', 'view_isencao_completa': isenStr, 'view_servicos_adicionais': servs.length > 0 ? servs.join(', ') : 'NENHUM', 
                'view_data_sepultamento': d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '--/--/----', 'view_tipo_urna_detalhe': (d.tipo_urna_detalhe || '').toUpperCase() 
            };
            for(let k in m) { const el = document.getElementById(k); if(el) el.innerText = m[k] || '-'; }
            if(document.getElementById('view_local_sepul')) document.getElementById('view_local_sepul').innerText = `Tipo: ${d.tipo_sepultura || ''} | Nº: ${d.sepul||''} | QD: ${d.qd||''}`;
            if(document.getElementById('view_data_obito')) document.getElementById('view_data_obito').innerText = `${d.data_obito ? d.data_obito.split('-').reverse().join('/') : ''} às ${d.hora_obito || ''}`;
            let dataHoraFinal = ""; if (d.data_hora_atendimento) { const parts = d.data_hora_atendimento.split('T'); if (parts.length === 2) { const dp = parts[0].split('-'); dataHoraFinal = `${dp[2]}/${dp[1]}/${dp[0]} AS ${parts[1]}`; } }
            if(document.getElementById('view_data_registro')) document.getElementById('view_data_registro').innerText = dataHoraFinal;

            let docsAcolhimento = [];
            if (d.chk_doc_autorizacao) docsAcolhimento.push("Autorização p/ Sepul."); if (d.chk_doc_rg_perm) docsAcolhimento.push("RG Perm.");
            if (d.chk_doc_obito) docsAcolhimento.push("Dec. Óbito"); if (d.chk_doc_rg_falecido) docsAcolhimento.push("RG Falecido");
            if (d.chk_doc_residencia) docsAcolhimento.push("Comp. Resid."); if (d.chk_doc_guia_cartorio) docsAcolhimento.push("Guia Cartório");
            if (d.chk_doc_moeda) docsAcolhimento.push("Moeda Araribóia"); if (d.chk_doc_bolsa) docsAcolhimento.push("Bolsa Família");
            if (d.chk_doc_loas) docsAcolhimento.push("LOAS/BPC"); if (d.chk_doc_cadunico) docsAcolhimento.push("CadÚnico");
            if (d.chk_doc_cras) docsAcolhimento.push("Isenção CRAS"); if (d.chk_doc_parentesco) docsAcolhimento.push("Parentesco");
            if (d.chk_doc_casamento) docsAcolhimento.push("Casamento"); if (d.chk_doc_locacao) docsAcolhimento.push("Locação");
            if (d.chk_doc_procuracao) docsAcolhimento.push("Procuração");
            const elDocs = document.getElementById('view_docs_acolhimento');
            if(elDocs) {
                let textoDocs = docsAcolhimento.length > 0 ? docsAcolhimento.join(' • ') : 'NENHUM DOCUMENTO MARCADO';
                if(d.url_docs_acolhimento) { textoDocs += `<br><a href="${d.url_docs_acolhimento}" target="_blank" style="display:inline-block; margin-top:5px; background:#eff6ff; color:#3b82f6; padding:4px 8px; border-radius:4px; text-decoration:none;">🔗 Acessar Documentos Mesclados (Nuvem)</a>`; } 
                else { textoDocs += `<br><span style="display:inline-block; margin-top:5px; background:#fee2e2; color:#ef4444; padding:4px 8px; border-radius:4px;">⚠️ Nuvem Pendente (Acolhimento não gerou o link)</span>`; }
                elDocs.innerHTML = textoDocs;
            }

            let linksHtml = "";
            if(d.url_invol) linksHtml += `<a href="${d.url_invol}" target="_blank" style="color:#3b82f6; font-weight:bold; text-decoration:none; background:#eff6ff; padding:4px 8px; border-radius:4px; font-size: 11px;">📎 INVOL</a>`;
            if(d.url_nf) linksHtml += `<a href="${d.url_nf}" target="_blank" style="color:#3b82f6; font-weight:bold; text-decoration:none; background:#eff6ff; padding:4px 8px; border-radius:4px; font-size: 11px;">📎 NF</a>`;
            if(d.url_tanato) linksHtml += `<a href="${d.url_tanato}" target="_blank" style="color:#3b82f6; font-weight:bold; text-decoration:none; background:#eff6ff; padding:4px 8px; border-radius:4px; font-size: 11px;">📎 TANATO</a>`;
            if(d.url_comprovante) linksHtml += `<a href="${d.url_comprovante}" target="_blank" style="color:#3b82f6; font-weight:bold; text-decoration:none; background:#eff6ff; padding:4px 8px; border-radius:4px; font-size: 11px;">📎 COMPROVANTE</a>`;
            if(d.url_guia_grm) linksHtml += `<a href="${d.url_guia_grm}" target="_blank" style="color:#3b82f6; font-weight:bold; text-decoration:none; background:#eff6ff; padding:4px 8px; border-radius:4px; font-size: 11px;">📎 GRM</a>`;
            const elRow = document.getElementById('linha_anexos_view'); const elLinks = document.getElementById('view_anexos_links');
            if(elRow && elLinks) { if(linksHtml !== "") { elLinks.innerHTML = linksHtml; elRow.style.display = "flex"; } else { elRow.style.display = "none"; } }
            
            const mapContainer = document.getElementById('view_map_container'), mapFrame = document.getElementById('mapa-frame'), mapLink = document.getElementById('link-gps');
            if (mapContainer && mapFrame && mapLink) { 
                const cleanCoords = d.geo_coords ? d.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; 
                if (cleanCoords && cleanCoords.includes(',')) { mapContainer.style.display = 'block'; mapFrame.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="http://googleusercontent.com/maps.google.com/?q=${cleanCoords}&hl=pt-BR&z=16&output=embed"></iframe>`; mapLink.href = `http://googleusercontent.com/maps.google.com/?q=${cleanCoords}`; } 
                else { mapContainer.style.display = 'none'; } 
            }
            safeDisplay('modal-visualizar', 'block');
        }
    });
}

window.gerarEtiqueta = function() { 
    if (!dadosAtendimentoAtual) return; const d = dadosAtendimentoAtual; const fd = (dataStr) => dataStr ? dataStr.split('-').reverse().join('/') : ''; const dataF = fd(d.data_ficha); 
    const h = `<html><head><title>Etiqueta</title><style>@page{size:landscape;margin:0}body{font-family:Arial,sans-serif;margin:0;padding:0;height:100vh;width:100vw;display:flex;justify-content:center;align-items:center;overflow:hidden}.box{width:95vw;height:90vh;border:5px solid #000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center;padding:10px}.header-img{max-height:100px;margin-bottom:10px}.title{font-size:24px;font-weight:900;text-transform:uppercase;border-bottom:3px solid #000;padding-bottom:5px;display:inline-block;margin-bottom:30px}.group{margin-bottom:30px;width:100%}.label{font-size:18px;color:#333;font-weight:bold;text-transform:uppercase;margin-bottom:5px}.val-nome{font-size:55px;font-weight:900;text-transform:uppercase;line-height:1.1}.val-data{font-size:40px;font-weight:800}.val-local{font-size:35px;font-weight:800;text-transform:uppercase}</style></head><body><div class="box"><div><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="header-img"><br><div class="title">IDENTIFICAÇÃO DE VELÓRIO</div></div><div class="group"><div class="label">FALECIDO(A)</div><div class="val-nome">${d.nome}</div></div><div class="group"><div class="label">SEPULTAMENTO</div><div class="val-data">${dataF} às ${d.hora}</div></div><div class="group"><div class="label">LOCAL</div><div class="val-local">${d.cap}<br>${d.local || "CEMITÉRIO DO MARUÍ"}</div></div></div><script>window.onload=function(){setTimeout(function(){window.print()},500)}</script></body></html>`; 
    const w = window.open('','_blank'); if(w) { w.document.write(h); w.document.close(); } 
}

// --- WHATSAPP E UTILITARIOS ---
window.abrirModalWpp = function() { if (!dadosAtendimentoAtual) return; safeDisplay('modal-whatsapp', 'flex'); }
window.fecharModalWpp = function() { safeDisplay('modal-whatsapp', 'none'); }
window.enviarWppTemplate = function(tipo) {
    if (!dadosAtendimentoAtual) return; const d = dadosAtendimentoAtual; let t = d.telefone ? d.telefone.replace(/\D/g, '') : ''; let texto = ""; const fd = (dataStr) => dataStr ? dataStr.split('-').reverse().join('/') : '';
    if (tipo === 'gps') {
        const c = d.geo_coords ? d.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; if (!t) { alert("Sem telefone."); return; } if (!c) { alert("Sem GPS."); return; }
        texto = `Localização da Sepultura: http://googleusercontent.com/maps.google.com/?q=${c}`;
    } else if (tipo === 'info') {
        if (!t) { alert("Sem telefone."); return; } let dataExumacao = ""; 
        if (d.data_ficha) { const parts = d.data_ficha.split('-'); const addAnos = (d.classificacao_obito === 'ANJO') ? 2 : 3; dataExumacao = `${parts[2]}/${parts[1]}/${parseInt(parts[0]) + addAnos}`; }
        texto = `*PREFEITURA MUNICIPAL DE NITERÓI*\n_Serviços Funerários_\n\nOlá, seguem as informações úteis do seu atendimento:\n\n📄 *Protocolo:* ${d.protocolo || '-'}\n👤 *Falecido(a):* ${d.nome || '-'}\n⚰️ *Local:* ${d.local || '-'}\n✝️ *Capela:* ${d.cap || '-'}\n🕒 *Horário Previsto:* ${d.hora || '-'}\n📍 *Sepultura:* ${d.sepul || '-'} | *QD/Rua:* ${d.qd || '-'}\n\n⏳ *Previsão de Exumação:* A partir de ${dataExumacao}\n\n⚠️ *ATENÇÃO:* Compareça ou entre em contato no prazo mínimo de *90 dias ANTES* da data de exumação para abertura de processo.\n\nAgradecemos a compreensão.`;
    } else if (tipo === 'convite') {
        texto = `Informamos com pesar o falecimento de *${d.nome || '_______________'}*.\n\nO velório e sepultamento serão realizados conforme abaixo:\n\n📍 *Cemitério:* ${d.local || '-'}\n✝️ *Capela:* ${d.cap || '-'}\n📅 *Data:* ${fd(d.data_ficha)}\n🕒 *Horário do Sepultamento:* ${d.hora || '-'}\n\nAgradecemos a todos que puderem comparecer para prestar as últimas homenagens.`;
    }
    let url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`; if (t) url = `https://api.whatsapp.com/send?phone=55${t}&text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank'); fecharModalWpp();
}

window.enviarSMS = function() { 
    if (!dadosAtendimentoAtual) return; const t = dadosAtendimentoAtual.telefone ? dadosAtendimentoAtual.telefone.replace(/\D/g, '') : ''; const c = dadosAtendimentoAtual.geo_coords ? dadosAtendimentoAtual.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; 
    if (!t) { alert("Sem telefone."); return; } window.location.href = `sms:55${t}?body=${encodeURIComponent('Localização da Sepultura: http://googleusercontent.com/maps.google.com/?q=' + c)}`; 
}

window.fecharModalVisualizar = function() { safeDisplay('modal-visualizar', 'none'); };
window.fecharModalEstatisticas = function() { safeDisplay('modal-estatisticas', 'none'); };
window.alternarDesign = function() { document.body.classList.toggle('design-classico'); };
window.imprimirRelatorio = function(m) { const s = document.createElement('style'); s.innerHTML = `@page { size: ${m}; }`; document.head.appendChild(s); window.print(); setTimeout(() => document.head.removeChild(s), 1000); };
window.excluir = function(id) { if(confirm('Tem certeza?')) getDB().collection("atendimentos").doc(id).delete(); };
window.onclick = function(e) { const m = ['modal-visualizar', 'modal-estatisticas', 'modal-admin', 'modal-transferir', 'modal-whatsapp', 'modal-agencia', 'modal-liberacao', 'modal-transferir-responsavel', 'modal-onedrive', 'modal-docs-acolhimento']; if (m.includes(e.target.id)) safeDisplay(e.target.id, 'none'); }
window.fazerLogout = function() { sessionStorage.removeItem('usuarioLogado'); window.location.reload(); }
window.bloquearTela = function() { safeDisplay('tela-bloqueio', 'flex'); }