// ============================================================================
// FIX ANTI-FIREWALL / PROXY CORPORATIVO 
// ============================================================================
if (typeof window.firebase !== 'undefined' && window.firebase.firestore) {
    const originalFirestore = window.firebase.firestore;
    window.firebase.firestore = function() {
        const db = originalFirestore.apply(this, arguments);
        if (!window._firewallFixApplied) {
            try {
                // Força o Firebase a usar um método de conexão que dribla bloqueadores
                db.settings({
                    experimentalForceLongPolling: true,
                    useFetchStreams: false
                });
                window._firewallFixApplied = true;
                console.log("✅ Rota Anti-Firewall ativada com sucesso!");
            } catch(e) {}
        }
        return db;
    };
    Object.assign(window.firebase.firestore, originalFirestore);
}
// ============================================================================
// CONFIGURAÇÕES GLOBAIS E FIREBASE
// ============================================================================
const SYSTEM_VERSION = "1.8";
const firebaseConfig = { 
    apiKey: "AIzaSyB6pkQZNuLiYidKqstJdMXRl2OYW4JWmfs", 
    authDomain: "funeraria-niteroi.firebaseapp.com", 
    projectId: "funeraria-niteroi", 
    storageBucket: "funeraria-niteroi.firebasestorage.app", 
    messagingSenderId: "232673521828", 
    appId: "1:232673521828:web:f25a77f27ba1924cb77631" 
};

window.db = null;
window.auth = null;
window.unsubscribe = null;
window.chartInstances = {}; 
window.usuarioLogado = null;
window.signaturePad = null;
window.isDrawing = false;
window.assinaturaResponsavelImg = null;
window.assinaturaAtendenteImg = null;
window.tipoAssinaturaAtual = '';
window.dashboardAtual = 'acolhimento';
window.dadosAtendimentoAtual = null;
window.dadosEstatisticasExportacao = [];
window.numeroWppFixo = ''; 
window.beneficiariosCache = null; 
window.versaoAvisoAtual = null; 

window.chatListenerAtivo = false;
window.primeiroLoadChat = true;
window.chatAberto = false;
window.unreadMessages = 0;

window.idLiberacaoAtual = null; 
window.idTransferenciaResponsavelAtual = null; 
window.nomePastaPadrao = 'PROTOCOLO_NOME';

// ============================================================================
// HISTÓRICO DE MOVIMENTAÇÕES
// ============================================================================
window.registrarHistorico = function(atendimentoId, categoria, descricao) {
    if (!atendimentoId) return;
    try {
        var db = getDB();
        if (!db) return;
        db.collection("atendimentos").doc(atendimentoId).collection("historico").add({
            data: new Date().toISOString(),
            usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Sistema',
            categoria: categoria || 'GERAL',
            descricao: descricao || ''
        }).catch(function(e) { console.log("Erro ao registrar histórico:", e); });
    } catch(e) { console.log("Erro ao registrar histórico:", e); }
};

window.abrirModalHistorico = function(atendimentoId) {
    if (!atendimentoId) return;
    var modal = document.getElementById('modal-historico');
    var lista = document.getElementById('historico-lista');
    if (!modal || !lista) return;
    lista.innerHTML = '<p style="text-align:center;color:#64748b;">Carregando...</p>';
    modal.style.display = 'flex';
    try {
        getDB().collection("atendimentos").doc(atendimentoId).collection("historico")
            .orderBy("data", "desc").get().then(function(snap) {
                if (snap.empty) {
                    lista.innerHTML = '<p style="text-align:center;color:#94a3b8;">Nenhuma movimentação registrada.</p>';
                    return;
                }
                var html = '';
                snap.forEach(function(doc) {
                    var h = doc.data();
                    var dataFormatada = h.data ? new Date(h.data).toLocaleString('pt-BR') : '';
                    html += '<div style="border-left:3px solid #3b82f6;padding:8px 12px;margin-bottom:10px;background:#f8fafc;border-radius:0 6px 6px 0;">';
                    html += '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">';
                    html += '<strong style="color:#1e293b;font-size:13px;">' + (h.categoria || '') + '</strong>';
                    html += '<span style="color:#94a3b8;font-size:11px;">' + dataFormatada + '</span>';
                    html += '</div>';
                    html += '<p style="margin:0;color:#475569;font-size:13px;">' + (h.descricao || '') + '</p>';
                    html += '<span style="color:#94a3b8;font-size:11px;">Por: ' + (h.usuario || '') + '</span>';
                    html += '</div>';
                });
                lista.innerHTML = html;
            }).catch(function(e) {
                lista.innerHTML = '<p style="text-align:center;color:red;">Erro ao carregar histórico.</p>';
            });
    } catch(e) {
        lista.innerHTML = '<p style="text-align:center;color:red;">Erro ao carregar histórico.</p>';
    }
};

window.fecharModalHistorico = function() {
    var modal = document.getElementById('modal-historico');
    if (modal) modal.style.display = 'none';
};

const dimensoesUrna = {
    'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70', 
    'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80', 
    'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85', 
    '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95', 
    'PERPETUA': '' 
};

try { 
    if (typeof firebase !== 'undefined') { 
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig); 
        }
        window.db = firebase.firestore(); 
        if (firebase.auth) {
            window.auth = firebase.auth();
        }
    } 
} catch (e) {
    console.error("Erro ao inicializar Firebase:", e); 
}

function getDB() { 
    if (!window.db && typeof firebase !== 'undefined') { 
        try { 
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig); 
            }
            window.db = firebase.firestore(); 
        } catch(e) {
            console.error("Erro ao obter banco de dados:", e);
        } 
    } 
    return window.db; 
}

function safeDisplay(id, type, zIndex = null) { 
    const el = document.getElementById(id); 
    if (el) {
        el.style.display = type; 
        if (zIndex && type !== 'none') {
            el.style.zIndex = zIndex;
        }
    }
}

if (typeof emailjs !== 'undefined') {
    emailjs.init("FGmNwg6qdRPh5WgOF");
}

window.enviarEmailAutomato = function(dados, emailDestino) {
    if (!emailDestino || typeof emailjs === 'undefined') return;
    
    const f = (s) => s ? s.split('-').reverse().join('/') : ''; 
    const p = dados.protocolo || "S/ PROTOCOLO"; 
    
    let dhT = ""; 
    if(dados.data_hora_atendimento){ 
        const ps = dados.data_hora_atendimento.split('T'); 
        if(ps.length === 2) {
            dhT = `${ps[0].split('-').reverse().join('/')} AS ${ps[1]}`; 
        }
    } else { 
        const n = new Date(); 
        dhT = `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()} AS ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; 
    }
    
    let tD = ""; 
    if(dados.data_obito && dados.hora_obito && dados.hora && dados.data_ficha){ 
        const df = new Date(dados.data_ficha+'T'+dados.hora) - new Date(dados.data_obito+'T'+dados.hora_obito); 
        if(df > 0) {
            tD = `${Math.floor(df/3600000)}h ${Math.round(((df%3600000)/60000))}min`; 
        }
    }
    
    const rl = dados.parentesco ? `(${dados.parentesco})` : '';
    
    let tS = (dados.tipo_sepultura||"").toUpperCase(); 
    const co = dados.classificacao_obito || "ADULTO"; 
    let tH = dados.hora_obito || ""; 
    
    if(dados.ignorar_hora_obito === 'SIM' || dados.chk_ignorar_hora === 'SIM') {
        tH += " (IGNORADO)";
    }
    
    let c = co === "ANJO" ? "ANJO" : "ADULTO"; 
    
    if(tS.includes("PERPETU")) { 
        tS = `${tS} (L: ${dados.livro_perpetua||'-'} / F: ${dados.folha_perpetua||'-'}) - ${c}`; 
    } else if(tS.includes("MEMBRO")) { 
        tS = `MEMBRO AMPUTADO (${dados.tipo_membro||dados.tipo_membro_select||'N/I'})`; 
    } else { 
        tS = `${tS} - ${c}`; 
    }
    
    let dEx = ""; 
    if(dados.data_ficha){ 
        const ps = dados.data_ficha.split('-'); 
        const addAnos = (c === 'ANJO') ? 2 : 3;
        dEx = `${ps[2]}/${ps[1]}/${parseInt(ps[0]) + addAnos}`; 
    }
    
    let nA = (window.usuarioLogado && window.usuarioLogado.nome ? window.usuarioLogado.nome : (dados.atendente_sistema || 'N/A')).toUpperCase();
    let isTanato = (dados.tanato === 'SIM' || dados.chk_tanato === 'SIM');

    let linkGpsHtml = "";
    if (dados.geo_coords) {
        const cleanCoords = String(dados.geo_coords).replace(/[^0-9.,\-]/g, '');
        if (cleanCoords && cleanCoords.includes(',')) {
            linkGpsHtml = `<p style="margin: 0 0 8px 0;"><b>📍 Localização da Sepultura:</b> <a href="http://googleusercontent.com/maps.google.com/maps?q=${cleanCoords}" target="_blank" style="color: #3b82f6; text-decoration: none;">Abrir no Google Maps</a></p>`;
        }
    }

    const htmlEmail = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #000; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;">
            <h2 style="font-size: 20px; margin: 0; text-transform: uppercase;">Comprovante de Atendimento</h2>
            <p style="font-size: 14px; font-weight: bold; margin: 5px 0 0 0;">PROTOCOLO: ${p}</p>
        </div>
        <p style="margin: 5px 0;"><b>FALECIDO(A):</b> ${(dados.nome||'').toUpperCase()}</p>
        <p style="margin: 5px 0;"><b>RESPONSÁVEL:</b> ${(dados.resp_nome||'').toUpperCase()} ${rl}</p>
        <p style="margin: 5px 0;"><b>FUNERÁRIA:</b> ${(dados.funeraria||'').toUpperCase()} (Rep: ${dados.func_funeraria||'N/A'})</p>
        <p style="margin: 5px 0;"><b>ATENDENTE RESPONSÁVEL:</b> ${nA}</p>
        <p style="margin: 5px 0;"><b>DATA E HORA DO ATENDIMENTO:</b> ${dhT}</p>
        <div style="background: #f8fafc; padding: 15px; border: 1px solid #cbd5e1; margin-top: 20px; border-radius: 6px;">
            <p style="margin: 0 0 8px 0;"><b>Data do Sepultamento:</b> ${f(dados.data_ficha)} &nbsp;|&nbsp; <b>Hora:</b> ${dados.hora||''}</p>
            <p style="margin: 0 0 8px 0;"><b>Cemitério:</b> ${(dados.local||'').toUpperCase()}</p>
            <p style="margin: 0 0 8px 0;"><b>Sepultura:</b> ${dados.sepul||''} &nbsp;|&nbsp; <b>Quadra/Rua:</b> ${dados.qd||''} &nbsp;|&nbsp; <b>Capela:</b> ${dados.cap||''}</p>
            ${linkGpsHtml}
            <p style="margin: 0 0 8px 0;"><b>Data do Falecimento:</b> ${f(dados.data_obito)} AS ${tH} <span style="color:red; font-weight:bold;">[${tD}]</span></p>
            <p style="margin: 0 0 8px 0;"><b>Tipo de Sepultura:</b> ${tS}</p>
            <p style="margin: 0;"><b>Tanatopraxia:</b> ${isTanato ? 'SIM' : 'NÃO'}</p>
        </div>
        <div style="margin-top: 20px; border: 2px solid #000; padding: 15px; text-align: center;">
            <p style="margin: 0; font-weight: bold; font-size: 14px;">PREVISÃO DE EXUMAÇÃO: A partir de <span style="color: red; font-size: 18px;">${dEx}</span></p>
            <p style="font-size: 11px; margin-top: 5px;">(Legislação: 3 anos para Adultos / 2 anos para Crianças abaixo de 12 anos)</p>
            <p style="font-weight: bold; margin-top: 15px; color: #b91c1c;">⚠️ ATENÇÃO: COMPAREÇA OU ENTRE EM CONTATO NO PRAZO MÍNIMO DE 90 DIAS ANTES DA DATA DE EXUMAÇÃO PARA ABERTURA DE PROCESSO.</p>
        </div>
        <div style="margin-top: 20px; font-size: 12px; text-align: justify; background: #fef2f2; padding: 15px; border: 1px solid #fca5a5; border-radius: 6px;">
            <p style="margin: 0 0 5px 0;"><b>COMUNICADO AOS FAMILIARES E FUNERÁRIAS:</b></p>
            <p style="margin: 0; line-height: 1.5;">Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos na agência: <b>GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL), TAXAS MUNICIPAIS PAGAS e INVOL.</b></p>
        </div>
    </div>`;
    
    const templateParams = { to_email: emailDestino, nome_falecido: (dados.nome || '').toUpperCase(), protocolo: p, html_comprovante: htmlEmail };
    emailjs.send("default_service", "template_knlaoh1", templateParams).then(function(res) {
        window.registrarHistorico(dados.id, 'DOCUMENTO', `E-mail c/ comprovante enviado para ${emailDestino}`);
    }).catch(function(err) { console.error("Falha ao enviar e-mail:", err); });
};

window.reenviarEmailAtual = function() {
    if (!window.dadosAtendimentoAtual) { alert("Nenhum atendimento selecionado."); return; }
    const emailDestino = window.dadosAtendimentoAtual.resp_email || window.dadosAtendimentoAtual.part_pf_email;
    if (!emailDestino) { alert("Não há e-mail cadastrado neste atendimento para reenviar o comprovante."); return; }
    if (confirm(`Deseja reenviar o comprovante para o e-mail: ${emailDestino}?`)) {
        window.enviarEmailAutomato(window.dadosAtendimentoAtual, emailDestino);
        alert("Comprovante enviado para a fila de disparo!");
    }
};

window.fecharModalNovidades = function() {
    if (window.versaoAvisoAtual) localStorage.setItem('versao_aviso_lida', window.versaoAvisoAtual);
    else localStorage.setItem('versao_sistema_lida', SYSTEM_VERSION);
    safeDisplay('modal-novidades', 'none');
}

window.importarBeneficiarios = function() {
    const fileInput = document.getElementById('file-import-beneficios');
    if (!fileInput) return;
    const file = fileInput.files[0];
    if (!file) { alert("Por favor, selecione um arquivo Excel ou CSV."); return; }
    const statusEl = document.getElementById('import-status');
    if (statusEl) { statusEl.innerText = "Lendo arquivo na memória... Aguarde."; statusEl.style.color = "#d97706"; }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            if (typeof window.XLSX === 'undefined') { alert("Biblioteca Excel não carregada. Atualize a página."); return; }
            const workbook = window.XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = window.XLSX.utils.sheet_to_json(worksheet, {defval: ""});
            
            if (!Array.isArray(rows) || rows.length === 0) { if (statusEl) statusEl.innerText = "A planilha parece estar vazia."; return; }
            if (statusEl) statusEl.innerText = `Processando ${rows.length} registros. Iniciando envio para o servidor (lotes de 500)...`;
            
            const dbInstance = getDB(); 
            if (!dbInstance) return;
            let batch = dbInstance.batch(); 
            let count = 0; let cpfsSalvos = 0;
            
            for (let i = 0; i < rows.length; i++) {
                let row = rows[i];
                let cpfKey = Object.keys(row).find(k => k.toUpperCase().includes("CPF"));
                let nomeKey = Object.keys(row).find(k => k.toUpperCase().includes("NOME") || k.toUpperCase().includes("BENEFICI"));
                let nisKey = Object.keys(row).find(k => k.toUpperCase().includes("NIS"));
                
                let cpfRaw = cpfKey ? row[cpfKey] : Object.values(row)[0];
                let nomeRaw = nomeKey ? row[nomeKey] : (Object.values(row)[1] || "Beneficiário");
                let nisRaw = nisKey ? row[nisKey] : "";
                
                let cpfStr = String(cpfRaw).replace(/\D/g, '');
                let nisStr = String(nisRaw).replace(/\D/g, '');
                let cpfParcial = "";
                
                if (cpfStr.length === 11) cpfParcial = cpfStr.substring(3, 9); 
                else if (cpfStr.length === 6) cpfParcial = cpfStr; 
                
                if (cpfParcial && nomeRaw) {
                    let nomeLimpo = String(nomeRaw).toUpperCase().trim();
                    let docId = nisStr ? nisStr : (cpfParcial + "_" + nomeLimpo.replace(/[^A-Z0-9]/g, '').substring(0, 15)); 
                    let docRef = dbInstance.collection("beneficiarios").doc(docId);
                    batch.set(docRef, { cpf_parcial: cpfParcial, nis: nisStr, nome: nomeLimpo, data_importacao: new Date().toISOString() });
                    count++; cpfsSalvos++;
                    if (count === 490) { await batch.commit(); if (statusEl) statusEl.innerText = `Enviando... ${cpfsSalvos} registros salvos de ${rows.length}.`; batch = dbInstance.batch(); count = 0; }
                }
            }
            if (count > 0) await batch.commit();
            if (statusEl) { statusEl.innerText = `✅ Importação concluída! ${cpfsSalvos} beneficiários cadastrados na base.`; statusEl.style.color = "#10b981"; }
            fileInput.value = ""; window.beneficiariosCache = null; 
            window.registrarHistorico("SISTEMA", "CADASTRO", `Base de benefícios importada: ${cpfsSalvos} registros`);
        } catch (err) { if (statusEl) { statusEl.innerText = "❌ Erro ao processar a planilha. Verifique o formato."; statusEl.style.color = "red"; } }
    };
    reader.readAsArrayBuffer(file);
};

window.abrirModalBuscaBeneficio = function() {
    const inputBusca = document.getElementById('input_busca_beneficio');
    if (inputBusca && !document.getElementById('btn-api-gov')) {
        const btnGov = document.createElement('button');
        btnGov.id = 'btn-api-gov'; btnGov.type = 'button'; btnGov.className = 'btn-novo'; btnGov.style.backgroundColor = '#0369a1'; btnGov.style.width = '35%'; btnGov.style.justifyContent = 'center'; btnGov.innerHTML = '🌐 API Federal'; btnGov.onclick = window.consultarApiGoverno;
        inputBusca.parentNode.appendChild(btnGov); inputBusca.style.width = '45%';
    }
    if (inputBusca) inputBusca.value = '';
    const resDiv = document.getElementById('resultado-busca-beneficio');
    if (resDiv) resDiv.innerHTML = '<span style="color:#64748b; font-size:12px;">Use a busca acima para encontrar o beneficiário.</span>'; 
    safeDisplay('modal-busca-beneficio', 'block', '10005');
}

window.fecharModalBuscaBeneficio = function() { safeDisplay('modal-busca-beneficio', 'none'); }

window.realizarBuscaBeneficio = function() {
    const tipoElem = document.getElementById('tipo_busca_beneficio');
    const termoElem = document.getElementById('input_busca_beneficio');
    const divRes = document.getElementById('resultado-busca-beneficio');
    if (!divRes || !tipoElem || !termoElem) return;
    const tipo = tipoElem.value; let termo = termoElem.value.trim();
    if (!termo || (tipo !== 'NOME' && termo.length < 3)) { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">Digite um termo válido para buscar.</span>'; return; }
    divRes.innerHTML = '<span style="color:#64748b; font-size:12px;">⏳ Buscando na Base Local...</span>';
    if (!getDB()) { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Sem conexão com o banco de dados.</span>'; return; }
    
    if (tipo === 'NOME') {
        termo = termo.toUpperCase();
        const renderResultados = (lista) => {
            if(!Array.isArray(lista)) return;
            let filtrados = lista.filter(d => d.nome && d.nome.includes(termo)).slice(0, 30);
            if (filtrados.length === 0) { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Nenhum beneficiário encontrado.</span>'; return; }
            let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
            filtrados.forEach(d => { 
                let safeName = d.nome.replace(/'/g, "\\'"); 
                html += `<div style="background:#fff; border:1px solid #cbd5e1; padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:bold; color:#1e293b; font-size:13px;">${d.nome}</div><div style="font-size:11px; color:#64748b;">NIS: ${d.nis || '-'} | CPF: ***.${d.cpf_parcial || '---'}.***-**</div></div><button type="button" class="btn-novo" style="background-color:#10b981; padding:4px 8px; font-size:11px; width:auto;" onclick="window.aplicarIsencaoBeneficio('${safeName}', '${d.cpf_parcial || ''}', '${d.nis || ''}')">Aplicar Isenção</button></div>`; 
            });
            html += '</div>'; divRes.innerHTML = html;
        };
        if (window.beneficiariosCache) renderResultados(window.beneficiariosCache);
        else {
            getDB().collection("beneficiarios").get().then(snap => { 
                window.beneficiariosCache = []; snap.forEach(doc => window.beneficiariosCache.push(doc.data())); renderResultados(window.beneficiariosCache); 
            }).catch(e => { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Erro ao realizar a busca.</span>'; });
        }
    } else {
        let query = getDB().collection("beneficiarios");
        if (tipo === 'NIS') query = query.where("nis", "==", termo.replace(/\D/g, ''));
        else if (tipo === 'CPF') {
            let cpfLimpo = termo.replace(/\D/g, '');
            if (cpfLimpo.length === 11) cpfLimpo = cpfLimpo.substring(3, 9);
            query = query.where("cpf_parcial", "==", cpfLimpo);
        }
        query.limit(20).get().then(snap => {
            if (snap.empty) { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Nenhum beneficiário encontrado.</span>'; return; }
            let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
            snap.forEach(doc => { 
                const d = doc.data(); let safeName = d.nome.replace(/'/g, "\\'"); 
                html += `<div style="background:#fff; border:1px solid #cbd5e1; padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;"><div><div style="font-weight:bold; color:#1e293b; font-size:13px;">${d.nome}</div><div style="font-size:11px; color:#64748b;">NIS: ${d.nis || '-'} | CPF: ***.${d.cpf_parcial || '---'}.***-**</div></div><button type="button" class="btn-novo" style="background-color:#10b981; padding:4px 8px; font-size:11px; width:auto;" onclick="window.aplicarIsencaoBeneficio('${safeName}', '${d.cpf_parcial || ''}', '${d.nis || ''}')">Aplicar Isenção</button></div>`; 
            });
            html += '</div>'; divRes.innerHTML = html;
        }).catch(e => { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Erro ao realizar a busca.</span>'; });
    }
}

window.consultarApiGoverno = async function() {
    const btn = document.getElementById('btn-api-gov');
    if(!btn) return;
    const originalText = btn.innerHTML; btn.innerHTML = "⏳ Consultando..."; btn.disabled = true;
    const cpfBuscaElem = document.getElementById('input_busca_beneficio');
    let cpfBusca = cpfBuscaElem ? cpfBuscaElem.value.replace(/\D/g, '') : '';
    const divRes = document.getElementById('resultado-busca-beneficio');
    if(!divRes) { btn.innerHTML = originalText; btn.disabled = false; return; }

    if (cpfBusca.length !== 11 && cpfBusca.length !== 14) { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Digite CPF completo ou NIS.</span>'; btn.innerHTML = originalText; btn.disabled = false; return; }
    
    try {
        const configDoc = await getDB().collection("config").doc("geral").get();
        const apiKey = (configDoc.exists && configDoc.data().api_transparencia) ? configDoc.data().api_transparencia : 'a76cec9a4e5d2b8d928a608b52f8f36d';
        const headers = new Headers(); headers.append('chave-api-dados', apiKey); headers.append('Accept', 'application/json');
        divRes.innerHTML = '<span style="color:#0369a1; font-size:12px;">⏳ Conectando aos servidores de Brasília...</span>';
        let mesesParaTestar = [];
        for(let i=1; i<=3; i++) { let d = new Date(); d.setMonth(d.getMonth() - i); mesesParaTestar.push(d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0')); }
        let beneficiosEncontrados = []; let mesRefEncontrado = ''; let nomeExtraidoApi = 'DADOS OBTIDOS DA API FEDERAL';
        const proxyUrl = 'https://corsproxy.io/?';
        
        for (let anoMes of mesesParaTestar) {
            let resBolsa = await fetch(proxyUrl + encodeURIComponent(`https://api.portaldatransparencia.gov.br/api-de-dados/bolsa-familia-disponivel-por-cpf-ou-nis?codigo=${cpfBusca}&anoMesCompetencia=${anoMes}&pagina=1`), { headers }).catch(() => null);
            let resBpc = await fetch(proxyUrl + encodeURIComponent(`https://api.portaldatransparencia.gov.br/api-de-dados/bpc-por-cpf-ou-nis?codigo=${cpfBusca}&anoMesCompetencia=${anoMes}&pagina=1`), { headers }).catch(() => null);
            
            if (resBolsa && resBolsa.ok) { let data = await resBolsa.json(); if (Array.isArray(data) && data.length > 0) { beneficiosEncontrados.push("Bolsa Família"); if(data[0].titularBolsaFamilia && data[0].titularBolsaFamilia.nome) nomeExtraidoApi = data[0].titularBolsaFamilia.nome; } }
            if (resBpc && resBpc.ok) { let data = await resBpc.json(); if (Array.isArray(data) && data.length > 0) { beneficiosEncontrados.push("BPC / LOAS"); if(data[0].beneficiario && data[0].beneficiario.nomePessoa) nomeExtraidoApi = data[0].beneficiario.nomePessoa; } }
            if (beneficiosEncontrados.length > 0) { mesRefEncontrado = anoMes; break; }
        }
        
        if (beneficiosEncontrados.length > 0) {
            let benefText = `${nomeExtraidoApi} (${beneficiosEncontrados.join(', ')})`;
            divRes.innerHTML = `<div style="background:#ecfdf5; border:1px solid #10b981; padding:15px; border-radius:6px; text-align:center;"><div style="font-weight:bold; color:#065f46; font-size:14px; margin-bottom:5px;">✅ BENEFÍCIO ATIVO (BASE FEDERAL)</div><div style="font-size:12px; color:#047857; margin-bottom:15px;">Programas: <b>${beneficiosEncontrados.join(', ')}</b><br>Ref: ${mesRefEncontrado}</div><button type="button" class="btn-novo" style="background-color:#10b981; padding:8px 15px; font-size:12px; width:100%;" onclick="window.aplicarIsencaoBeneficio('${benefText.replace(/'/g, "\\'")}', '${cpfBusca}', '')">✅ Aplicar Isenção Oficial</button></div>`;
        } else { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Nenhum benefício ativo encontrado.</span>'; }
    } catch (error) { divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Erro ao conectar com o Governo.</span>'; }
    btn.innerHTML = originalText; btn.disabled = false;
}

window.aplicarIsencaoBeneficio = function(nome, cpf, nis) {
    const selIsencao = document.getElementById('isencao'); const inReq = document.getElementById('requisito');
    if(selIsencao) selIsencao.value = "SIM"; if(inReq) inReq.value = "CADUNICO / GOVERNO (SISTEMA)";
    let msg = `✅ Isenção aplicada com sucesso na ficha!\n\n👤 Beneficiário(a): ${nome}`;
    if (cpf && String(cpf).trim() !== '' && cpf !== 'undefined') { let cpfFmt = String(cpf); if (cpfFmt.length === 6) { cpfFmt = `***.${cpfFmt}.***-**`; } else if (cpfFmt.length === 11) { cpfFmt = cpfFmt.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); } msg += `\n📄 CPF: ${cpfFmt}`; }
    if (nis && String(nis).trim() !== '' && nis !== 'undefined') { msg += `\n🔢 NIS: ${nis}`; }
    alert(msg); window.fecharModalBuscaBeneficio();
}
window.buscarCEP_PF = function(cep) { 
    cep = cep.replace(/\D/g, ''); 
    if (cep.length === 8) { 
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(r => r.json())
            .then(data => { 
                if (!data.erro) { 
                    const idEnd = document.getElementById('part_pf_endereco'); 
                    if(idEnd) idEnd.value = data.logradouro.toUpperCase(); 
                    
                    const idBai = document.getElementById('part_pf_bairro'); 
                    if(idBai) idBai.value = data.bairro.toUpperCase(); 
                    
                    const idCid = document.getElementById('part_pf_cidade'); 
                    if(idCid) idCid.value = data.localidade.toUpperCase(); 
                    
                    const idUf = document.getElementById('part_pf_uf'); 
                    if(idUf) idUf.value = data.uf.toUpperCase(); 
                    
                    const idNum = document.getElementById('part_pf_numero'); 
                    if(idNum) idNum.focus(); 
                } 
            }).catch(err => console.error(err)); 
    } 
}

window.buscarPorCPF = function() {
    const cpfElem = document.getElementById('resp_cpf');
    if(!cpfElem) return;
    
    let cpfBusca = cpfElem.value.replace(/\D/g, ''); 
    if (!cpfBusca) { 
        alert("Digite um CPF válido."); 
        return; 
    }
    
    getDB().collection("atendimentos").where("resp_cpf", "==", cpfBusca).limit(1).get().then(snap => {
        if (!snap.empty) { 
            const d = snap.docs[0].data(); 
            
            const idNome = document.getElementById('resp_nome'); 
            if(idNome) idNome.value = d.resp_nome || ''; 
            
            const idRg = document.getElementById('resp_rg'); 
            if(idRg) idRg.value = d.resp_rg || ''; 
            
            const idTel = document.getElementById('telefone'); 
            if(idTel) idTel.value = d.telefone || ''; 
            
            const idTel2 = document.getElementById('telefone2'); 
            if(idTel2) idTel2.value = d.telefone2 || ''; 
            
            const idEm = document.getElementById('resp_email'); 
            if(idEm) idEm.value = d.resp_email || ''; 
            
            const idCep = document.getElementById('resp_cep'); 
            if(idCep) idCep.value = d.resp_cep || ''; 
            
            const idEnd = document.getElementById('resp_endereco'); 
            if(idEnd) idEnd.value = d.resp_endereco || ''; 
            
            const idNum = document.getElementById('resp_numero'); 
            if(idNum) idNum.value = d.resp_numero || ''; 
            
            const idComp = document.getElementById('resp_complemento'); 
            if(idComp) idComp.value = d.resp_complemento || ''; 
            
            const idBai = document.getElementById('resp_bairro'); 
            if(idBai) idBai.value = d.resp_bairro || ''; 
            
            const idCid = document.getElementById('resp_cidade'); 
            if(idCid) idCid.value = d.resp_cidade || ''; 
            
            const idUf = document.getElementById('resp_uf'); 
            if(idUf) idUf.value = d.resp_uf || ''; 
            
            alert("Dados do contribuinte preenchidos!"); 
        } else { 
            alert("Nenhum cadastro prévio encontrado."); 
        }
    });
}

window.buscarPorCPF_PF = function() {
    const cpfElem = document.getElementById('part_pf_cpf');
    if(!cpfElem) return;
    
    let cpfBusca = cpfElem.value.replace(/\D/g, ''); 
    if (!cpfBusca) { 
        alert("Digite um CPF válido."); 
        return; 
    }
    
    getDB().collection("atendimentos").where("resp_cpf", "==", cpfBusca).limit(1).get().then(snap => {
        if (!snap.empty) { 
            const d = snap.docs[0].data(); 
            
            const idNome = document.getElementById('part_pf_nome'); 
            if(idNome) idNome.value = d.resp_nome || d.part_pf_nome || ''; 
            
            const idTel = document.getElementById('part_pf_tel'); 
            if(idTel) idTel.value = d.telefone || d.part_pf_tel || ''; 
            
            const idTel2 = document.getElementById('part_pf_tel2'); 
            if(idTel2) idTel2.value = d.part_pf_tel2 || ''; 
            
            const idCep = document.getElementById('part_pf_cep'); 
            if(idCep) idCep.value = d.resp_cep || d.part_pf_cep || ''; 
            
            const idEnd = document.getElementById('part_pf_endereco'); 
            if(idEnd) idEnd.value = d.resp_endereco || d.part_pf_endereco || ''; 
            
            const idNum = document.getElementById('part_pf_numero'); 
            if(idNum) idNum.value = d.resp_numero || d.part_pf_numero || ''; 
            
            const idComp = document.getElementById('part_pf_complemento'); 
            if(idComp) idComp.value = d.resp_complemento || d.part_pf_complemento || ''; 
            
            const idBai = document.getElementById('part_pf_bairro'); 
            if(idBai) idBai.value = d.resp_bairro || d.part_pf_bairro || ''; 
            
            const idCid = document.getElementById('part_pf_cidade'); 
            if(idCid) idCid.value = d.resp_cidade || d.part_pf_cidade || ''; 
            
            const idUf = document.getElementById('part_pf_uf'); 
            if(idUf) idUf.value = d.resp_uf || d.part_pf_uf || ''; 
            
            const idEm = document.getElementById('part_pf_email'); 
            if(idEm) idEm.value = d.resp_email || d.part_pf_email || ''; 
            
            alert("Dados preenchidos!"); 
        } else { 
            alert("Nenhum cadastro encontrado."); 
        }
    });
}

window.toggleIndigente = function() {
    const chk = document.getElementById('chk_indigente'); 
    const campos = [
        'resp_nome', 'resp_cpf', 'resp_endereco', 'resp_numero', 
        'resp_bairro', 'resp_cidade', 'telefone', 'funeraria', 
        'isencao', 'tipo_sepultura', 'sepul', 'qd', 'hospital', 
        'cap', 'data_obito', 'nome', 'causa', 'hora'
    ];
    
    campos.forEach(id => { 
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

window.gerarProtocolo = function() { 
    const elData = document.getElementById('data_ficha'); 
    const agora = new Date(); 
    let ano, mes, dia; 
    
    if (elData && elData.value) { 
        const partes = elData.value.split('-'); 
        ano = partes[0]; 
        mes = partes[1]; 
        dia = partes[2]; 
    } else { 
        ano = agora.getFullYear(); 
        mes = String(agora.getMonth() + 1).padStart(2, '0'); 
        dia = String(agora.getDate()).padStart(2, '0'); 
    } 
    
    const horaStr = String(agora.getHours()).padStart(2, '0');
    const minStr = String(agora.getMinutes()).padStart(2, '0');
    
    return `${ano}${mes}${dia}-${horaStr}${minStr}`; 
}

window.pegarDataAtualLocal = function() { 
    const agora = new Date(); 
    const ano = agora.getFullYear();
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`; 
}

window.atualizarLabelQuadra = function(local) { 
    const inputQd = document.getElementById('qd'); 
    if (inputQd && inputQd.previousElementSibling) { 
        if(local && local.includes('MARUÍ')) {
            inputQd.previousElementSibling.innerText = 'QD'; 
        } else {
            inputQd.previousElementSibling.innerText = 'RUA';
        }
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
        elCidade.innerHTML = '<option>Carregando...</option>'; 
        elCidade.disabled = true; 
        
        fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
            .then(res => res.json())
            .then(cidades => { 
                elCidade.innerHTML = '<option value="">Selecione a cidade</option>'; 
                
                cidades.sort((a, b) => a.nome.localeCompare(b.nome)); 
                
                cidades.forEach(cid => { 
                    const opt = document.createElement('option'); 
                    opt.value = cid.nome.toUpperCase(); 
                    opt.text = cid.nome.toUpperCase(); 
                    elCidade.appendChild(opt); 
                }); 
                
                elCidade.disabled = false; 
            })
            .catch(e => {
                console.error("Erro cidades:", e);
                elCidade.innerHTML = '<option value="">Erro</option>';
            }); 
    } 
}

window.carregarListaHorarios = function() { 
    const selectHora = document.getElementById('hora'); 
    if (!selectHora) return; 
    
    selectHora.innerHTML = '<option value="">Selecione...</option>'; 
    
    const horarios = [ 
        "08:00", "08:15", "08:30", "08:45", "09:00", "09:15", "09:30", "09:45", 
        "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "11:45", 
        "12:00", "12:15", "12:30", "12:45", "13:00", "13:15", "13:30", "13:45", 
        "14:00", "14:15", "14:30", "14:45", "15:00", "15:15", "15:30", "15:45", 
        "16:00", "16:15", "16:30", "16:45", "17:00", "17:15", "17:30" 
    ]; 
    
    horarios.forEach(hr => { 
        const opt = document.createElement('option'); 
        opt.value = hr; 
        opt.textContent = hr; 
        selectHora.appendChild(opt); 
    }); 
}

function setupSignaturePad() {
    const canvas = document.getElementById('signature-pad'); 
    if (!canvas || canvas.dataset.initialized === "true") return; 
    
    canvas.dataset.initialized = "true"; 
    const ctx = canvas.getContext('2d'); 
    
    ctx.lineWidth = 2; 
    ctx.lineJoin = 'round'; 
    ctx.lineCap = 'round'; 
    ctx.strokeStyle = '#000';
    
    function getPos(c, e) { 
        const rect = c.getBoundingClientRect(); 
        let x = e.touches ? e.touches[0].clientX : e.clientX; 
        let y = e.touches ? e.touches[0].clientY : e.clientY; 
        return { 
            x: (x - rect.left) * (c.width / rect.width), 
            y: (y - rect.top) * (c.height / rect.height) 
        }; 
    }
    
    function startDraw(e) { 
        if(e.type === 'touchstart') e.preventDefault(); 
        window.isDrawing = true; 
        const pos = getPos(canvas, e); 
        ctx.beginPath(); 
        ctx.moveTo(pos.x, pos.y); 
    }
    
    function draw(e) { 
        if (!window.isDrawing) return; 
        if(e.type === 'touchmove') e.preventDefault(); 
        const pos = getPos(canvas, e); 
        ctx.lineTo(pos.x, pos.y); 
        ctx.stroke(); 
    }
    
    function endDraw(e) { 
        if(e.type === 'touchend') e.preventDefault(); 
        window.isDrawing = false; 
    }
    
    canvas.addEventListener('mousedown', startDraw); 
    canvas.addEventListener('mousemove', draw); 
    canvas.addEventListener('mouseup', endDraw); 
    canvas.addEventListener('mouseout', endDraw); 
    canvas.addEventListener('touchstart', startDraw, { passive: false }); 
    canvas.addEventListener('touchmove', draw, { passive: false }); 
    canvas.addEventListener('touchend', endDraw, { passive: false });
}

window.limparAssinatura = function() { 
    const canvas = document.getElementById('signature-pad'); 
    if(canvas) { 
        const ctx = canvas.getContext('2d'); 
        ctx.fillStyle = "#f8fafc"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height); 
    } 
}

window.abrirModalAssinatura = function(tipo) { 
    if(!window.dadosAtendimentoAtual) {
        alert("Erro: Atendimento não selecionado na tela de visualização.");
        return;
    }
    
    window.tipoAssinaturaAtual = tipo; 
    const titulo = document.getElementById('titulo-assinatura'); 
    if(titulo) {
        titulo.innerText = (tipo === 'responsavel') ? 'Assinatura do Responsável' : 'Assinatura da Equipe'; 
    }
    
    safeDisplay('modal-assinatura', 'flex', '10005'); 
    
    setTimeout(() => {
        setupSignaturePad();
        window.limparAssinatura(); 
    }, 200); 
}

window.fecharModalAssinatura = function() { 
    safeDisplay('modal-assinatura', 'none'); 
}

window.salvarAssinatura = function() {
    const canvas = document.getElementById('signature-pad'); 
    
    if (canvas && window.dadosAtendimentoAtual && window.dadosAtendimentoAtual.id) { 
        const imgData = canvas.toDataURL('image/png'); 
        let updateData = {}; 
        
        if (window.tipoAssinaturaAtual === 'responsavel') { 
            updateData = { assinatura_responsavel: imgData }; 
        } else { 
            updateData = { assinatura_atendente: imgData }; 
        } 
        
        getDB().collection("atendimentos").doc(window.dadosAtendimentoAtual.id).update(updateData).then(() => {
            window.registrarHistorico(window.dadosAtendimentoAtual.id, 'ASSINATURA', `Assinatura registrada`);
            alert("Assinatura salva com sucesso!"); 
            window.fecharModalAssinatura();
            window.visualizar(window.dadosAtendimentoAtual.id); 
        }).catch(e => {
            console.error("Erro ass:", e);
            alert("Erro ao salvar assinatura. Verifique sua conexão.");
        }); 
    }
}

window.abrirModalTransferir = function() { 
    if(!window.dadosAtendimentoAtual) {
        alert("Erro: Atendimento não selecionado.");
        return;
    }
    
    const select = document.getElementById('novo_cemiterio_transferencia'); 
    if(select) {
        select.value = window.dadosAtendimentoAtual.local || "CEMITÉRIO DO MARUÍ"; 
    }
    
    safeDisplay('modal-transferir', 'flex', '10005'); 
}

window.fecharModalTransferir = function() { 
    safeDisplay('modal-transferir', 'none'); 
}

window.confirmarTransferencia = function() {
    if(!window.dadosAtendimentoAtual || !window.dadosAtendimentoAtual.id) return; 
    
    const novoLocalElem = document.getElementById('novo_cemiterio_transferencia');
    const novoLocal = novoLocalElem ? novoLocalElem.value : ''; 
    const localAntigo = window.dadosAtendimentoAtual.local || "CEMITÉRIO DO MARUÍ";
    
    if(novoLocal === localAntigo) { 
        alert("O atendimento já está neste cemitério."); 
        return; 
    }
    
    if(confirm(`Confirmar a transferência de ${localAntigo} para ${novoLocal}?`)) { 
        getDB().collection("atendimentos").doc(window.dadosAtendimentoAtual.id).update({ local: novoLocal }).then(() => { 
            getDB().collection("auditoria").add({ 
                data_log: new Date().toISOString(), 
                usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', 
                acao: "TRANSFERÊNCIA", 
                detalhe: `De: ${localAntigo} Para: ${novoLocal}` 
            }); 
            
            window.registrarHistorico(window.dadosAtendimentoAtual.id, 'TRANSFERENCIA', `Transferido de ${localAntigo} para ${novoLocal}`);
            
            alert("Atendimento transferido com sucesso!"); 
            window.fecharModalTransferir(); 
            window.fecharModalVisualizar(); 
        }).catch(e => {
            console.error("Erro Trans:", e);
            alert("Erro na transferência.");
        }); 
    }
}

window.abrirModal = function() {
    const formAtend = document.getElementById('form-atendimento');
    if(formAtend) formAtend.reset(); 
    
    const docIdElem = document.getElementById('docId');
    if(docIdElem) docIdElem.value = ""; 
    
    const divMotivo = document.getElementById('div-motivo-edicao');
    if(divMotivo) divMotivo.classList.add('hidden');
    
    if (window.usuarioLogado) {
        const atendSist = document.getElementById('atendente_sistema');
        if(atendSist) atendSist.value = window.usuarioLogado.nome;
    }
    
    const dataHoraElem = document.getElementById('data_hora_atendimento');
    if(dataHoraElem) {
        dataHoraElem.value = (new Date(new Date() - new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    
    const filtroData = document.getElementById('filtro-data');
    if(filtroData) {
        const dataFicha = document.getElementById('data_ficha');
        if(dataFicha) dataFicha.value = filtroData.value;
    }
    
    safeDisplay('modal', 'block', '10000');
}

window.editar = function(id) {
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); 
            for (let key in d) { 
                let targetId = key === 'data_ficha' ? 'data_ficha' : key; 
                const el = document.getElementById(targetId); 
                if(el) el.value = d[key]; 
            }
            
            const docIdElem = document.getElementById('docId');
            if(docIdElem) docIdElem.value = doc.id;
            
            const elTel2 = document.getElementById('telefone2');
            if(elTel2) elTel2.value = d.telefone2 || '';
            
            ['tanato', 'invol', 'translado', 'urna_opc'].forEach(k => { 
                const chk = document.getElementById('chk_'+k); 
                if(chk) chk.checked = (d[k] === 'SIM' || d['chk_'+k] === 'SIM'); 
            });
            
            const chkInd = document.getElementById('chk_indigente'); 
            if(chkInd) { 
                chkInd.checked = (d.indigente === 'SIM' || d.chk_indigente === 'SIM'); 
                window.toggleIndigente(); 
            }
            
            const chkIgn = document.getElementById('chk_ignorar_hora');
            if(chkIgn) {
                chkIgn.checked = (d.ignorar_hora_obito === 'SIM' || d.chk_ignorar_hora === 'SIM');
            }
            
            const chkMembro = document.getElementById('chk_membro');
            if(chkMembro) {
                chkMembro.checked = (d.membro === 'SIM' || d.chk_membro === 'SIM');
                const ts = document.getElementById('tipo_membro_select');
                if (ts) {
                    ts.disabled = !chkMembro.checked;
                    if (chkMembro.checked && d.tipo_membro_select) ts.value = d.tipo_membro_select;
                }
            }
            
            const divMotivo = document.getElementById('div-motivo-edicao');
            if(divMotivo) divMotivo.classList.remove('hidden'); 
            
            safeDisplay('modal', 'block', '10000');
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
        
        const idElem = document.getElementById('docId');
        const id = idElem ? idElem.value : ''; 
        
        let dados = {};
        
        Array.from(formAcolhimento.elements).forEach(el => { 
            if(el.id && el.type !== 'submit' && el.type !== 'button') { 
                let key = el.id === 'data_ficha_modal' ? 'data_ficha' : el.id; 
                
                if (key === 'chk_tanato') key = 'tanato';
                if (key === 'chk_invol') key = 'invol';
                if (key === 'chk_translado') key = 'translado';
                if (key === 'chk_urna_opc') key = 'urna_opc';
                if (key === 'chk_indigente') key = 'indigente';
                if (key === 'chk_ignorar_hora') key = 'ignorar_hora_obito';
                if (key === 'chk_membro') key = 'membro';

                dados[key] = el.type === 'checkbox' ? (el.checked ? 'SIM' : 'NAO') : el.value; 
            } 
        });
        
        const elTel2 = document.getElementById('telefone2');
        if(elTel2) dados['telefone2'] = elTel2.value;
        
        if(!dados.atendente_sistema && window.usuarioLogado) {
            dados.atendente_sistema = window.usuarioLogado.nome; 
        }
        
        const filtroLocal = document.getElementById('filtro-local');
        if(filtroLocal) {
            dados.local = filtroLocal.value;
        }
        
        if(!id && !dados.protocolo) {
            dados.protocolo = window.gerarProtocolo();
        }
        
        if(id) {
            const motivoEdicao = document.getElementById('motivo_edicao');
            if(!motivoEdicao || !motivoEdicao.value) { 
                alert("Motivo obrigatório na edição."); 
                return; 
            }
            
            getDB().collection("atendimentos").doc(id).update(dados).then(() => { 
                window.registrarHistorico(id, 'EDICAO', `Ficha editada - Motivo: ${motivoEdicao.value}`);
                window.fecharModal(); 
                window.abrirModalDocsAcolhimento(id); 
            });
        } else { 
            getDB().collection("atendimentos").add(dados).then((docRef) => { 
                window.registrarHistorico(docRef.id, 'CADASTRO', `Atendimento cadastrado - Falecido: ${dados.nome || 'N/I'} | Protocolo: ${dados.protocolo || ''}`);
                window.enviarEmailAutomato(dados, dados.resp_email);
                window.fecharModal(); 
                window.abrirModalDocsAcolhimento(docRef.id); 
            }); 
        }
    }
}

window.renderizarTabela = function(lista) {
    const tbody = document.getElementById('tabela-corpo-acolhimento'); 
    if(!tbody) return; 
    
    tbody.innerHTML = ''; 
    
    if (lista.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="11" style="padding:40px; text-align:center;">Nenhum registro encontrado no acolhimento.</td></tr>'; 
        return; 
    }
    
    let nAcesso = window.getNivelAcesso();
    let isReadOnlyAcolhimento = (nAcesso === 'AGENCIA_ACOLHIMENTO');

    const fragment = document.createDocumentFragment(); 
    const doencasInfecciosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HIV', 'SIDA', 'SARAMPO'];

    lista.forEach(item => {
        const tr = document.createElement('tr'); 
        
        let btnMap = ''; 
        const clCoords = item.geo_coords ? String(item.geo_coords).replace(/[^0-9.,\-]/g, '') : ''; 
        if (clCoords && clCoords.includes(',')) { 
            btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('http://googleusercontent.com/maps.google.com/maps?q=${clCoords}', '_blank')" title="Ver Localização">📍</button>`; 
        }

        if (item.tipo_registro === 'PARTICULAR') {
            let responsavelTxt = item.chk_pessoa_fisica ? `PF: ${item.part_pf_nome || ''}` : `FUNERÁRIA: ${item.part_funeraria || ''}`;
            tr.style.backgroundColor = '#f5f3ff';
            
            let acoesParticular = isReadOnlyAcolhimento ? 
                `<span style="font-size:10px;color:#94a3b8;">Apenas Visualização</span>` : 
                `<div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation();window.excluir('${item.id}')" title="Excluir">🗑️</button>
                </div>`;

            tr.innerHTML = `
                <td style="vertical-align:middle;"><b>${responsavelTxt}</b></td>
                <td style="text-align: center; vertical-align:middle;">${item.part_hora_liberacao||''}</td>
                <td style="text-align: center; vertical-align:middle;"><b>${(item.nome||'').toUpperCase()}</b><br><span style="font-size:9px; color:#8b5cf6; font-weight:bold; border: 1px solid #8b5cf6; padding: 2px 4px; border-radius: 4px; display:inline-block; margin-top: 4px;">ATEND. PARTICULAR</span></td>
                <td style="text-align: center; vertical-align:middle;" colspan="6"><b style="color:#6d28d9;">Cemitério:</b> ${item.part_cemiterio || ''} - ${item.part_tipo || ''}</td>
                <td style="text-align: center; vertical-align:middle;">${item.data_ficha ? item.data_ficha.split('-').reverse().join('/') : ''}</td>
                <td style="text-align:right; vertical-align:middle;">${acoesParticular}</td>`;
            fragment.appendChild(tr); 
            return;
        }

        tr.onclick = () => { if(typeof window.visualizar === 'function') window.visualizar(item.id); };
        
        let isContagioso = item.causa && doencasInfecciosas.some(d => item.causa.toUpperCase().includes(d)); 
        if (isContagioso) {
            tr.classList.add('alerta-doenca');
        }
        
        let displayResponsavel = item.isencao === "50" ? `<b>ACOLHIMENTO 50%</b>` : item.isencao === "SIM" ? `<b>ACOLHIMENTO 100%</b>` : `<b>${item.funeraria ? item.funeraria.toUpperCase() : (item.resp_nome || 'S/D').toUpperCase()}</b>`; 
        displayResponsavel += `<br><span style="font-weight:bold; font-size:11px;">${(item.tipo_urna_detalhe || '').toUpperCase()}</span>`;
        
        if (item.combo_urna) { 
            displayResponsavel += `<br><span style="font-size:10px;">URNA ${item.combo_urna}</span>`; 
            if (dimensoesUrna[item.combo_urna]) { 
                displayResponsavel += `<br><span style="font-size:9px; color:#666;">${dimensoesUrna[item.combo_urna]}</span>`; 
            } 
        }
        
        let servicosExtras = []; 
        if (item.tanato === 'SIM' || item.chk_tanato === 'SIM') servicosExtras.push('TANATO'); 
        if (item.invol === 'SIM' || item.chk_invol === 'SIM') servicosExtras.push('INVOL'); 
        if (item.translado === 'SIM' || item.chk_translado === 'SIM') servicosExtras.push('TRANS'); 
        if (item.urna_opc === 'SIM' || item.chk_urna_opc === 'SIM') servicosExtras.push('URNA'); 
        
        if (servicosExtras.length > 0) {
            displayResponsavel += `<br><span style="font-size:10px; font-weight:bold;">SERVIÇOS: ${servicosExtras.join(', ')}</span>`; 
        }

        const conteudoNome = `<b>${isContagioso ? '⚠️ ' : ''}${item.nome ? item.nome.toUpperCase() : 'NOME NÃO INFORMADO'}</b><div style="color:red; font-size:10px; font-weight:bold; margin-top:2px;">(${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})</div>${item.classificacao_obito === 'ANJO' ? '<div style="font-size:9px; color:blue; font-weight:bold;">(ANJO)</div>' : ''}`;
        
        let statusDocs = item.url_docs_acolhimento ? `<span style="font-size:9px; color:#10b981; font-weight:bold; border: 1px solid #10b981; padding: 2px 4px; border-radius: 4px; display:inline-block; margin-top: 4px;">✅ DOCS NUVEM</span>` : `<span style="font-size:9px; color:#ef4444; font-weight:bold; border: 1px solid #ef4444; padding: 2px 4px; border-radius: 4px; display:inline-block; margin-top: 4px;">⚠️ DOCS PENDENTES</span>`;
        
        let conteudoSepultura = `<b>${item.sepul||''}</b>`; 
        if (item.perpetua === 'X' || (item.tipo_sepultura || "").toUpperCase().includes('PERPETU')) { 
            conteudoSepultura += `<div style="font-weight:bold; font-size:10px; color:#2196F3; margin-top:2px;">PERPÉTUA</div><div style="font-weight:bold; font-size:10px; color:#2196F3;">L: ${item.livro_perpetua||''} F: ${item.folha_perpetua||''}</div>`; 
        }
        
        let displayFalecimento = ''; 
        if (item.data_obito && item.data_ficha) { 
            const p = item.data_obito.split('-'); 
            const dFmt = `${p[2]}/${p[1]}`; 
            let txtT = ""; 
            if (item.hora_obito && item.hora) { 
                const ini = new Date(`${item.data_obito}T${item.hora_obito}`); 
                const fim = new Date(`${item.data_ficha}T${item.hora}`); 
                if (!isNaN(ini) && !isNaN(fim)) { 
                    const dMs = fim - ini; 
                    txtT = `<br><span style="font-weight:bold; font-size:10px;">TEMPO DE FALECIMENTO: ${Math.floor(dMs / 3600000)}H ${Math.round(((dMs % 3600000) / 60000))}M</span>`; 
                } 
            } 
            displayFalecimento = `<div style="line-height:1.3;"><span style="color:#c0392b; font-weight:bold;">DIA:</span> ${dFmt}<br><span style="color:#c0392b; font-weight:bold;">AS:</span> ${item.hora_obito || '--:--'}${txtT}</div>`; 
        } else if (item.falecimento) { 
            displayFalecimento = `<div>${item.falecimento}</div>`; 
        }

        let acoesNormal = isReadOnlyAcolhimento ?
            `<div style="display:flex; gap:5px; justify-content:flex-end;">
                ${btnMap} <span style="font-size:10px;color:#94a3b8;line-height:32px;">Apenas Visualização</span>
            </div>` :
            `<div style="display:flex; gap:5px; justify-content:flex-end;">
                ${btnMap}
                <button class="btn-icon" style="background:#dcfce3; color:#16a34a; border-radius:50%; width:32px; height:32px; border:none; cursor:pointer;" onclick="event.stopPropagation();window.enviarWppFixo('${item.id}')" title="Notificar Central via WhatsApp">📲</button>
                <button class="btn-icon btn-editar-circle" onclick="event.stopPropagation();window.editar('${item.id}')">✏️</button>
                <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation();window.excluir('${item.id}')">🗑️</button>
            </div>`;
        
        tr.innerHTML = `
            <td style="vertical-align:middle;">${displayResponsavel}</td>
            <td style="text-align: center; vertical-align:middle;">${item.hora||''}</td>
            <td style="text-align: center; vertical-align:middle;">${conteudoNome}<br>${statusDocs}</td>
            <td style="text-align: center; vertical-align:middle;">${item.gav||''}</td>
            <td style="text-align: center; vertical-align:middle;">${item.car||''}</td>
            <td style="text-align: center; vertical-align:middle;">${conteudoSepultura}</td>
            <td style="text-align: center; vertical-align:middle;">${item.qd||''}</td>
            <td style="text-align: center; vertical-align:middle; font-size:11px;">${item.hospital||''}</td>
            <td style="text-align: center; vertical-align:middle;">${item.cap||''}</td>
            <td style="text-align: center; vertical-align:middle;">${displayFalecimento}</td>
            <td style="text-align:right; vertical-align:middle;">${acoesNormal}</td>`;
        
        fragment.appendChild(tr);
    });
    
    tbody.appendChild(fragment);
}

window.renderizarTabelaAgencia = function(lista) {
    const container = document.getElementById('tabela-corpo-agencia'); 
    if(!container) return; 
    
    container.innerHTML = ''; 
    
    if (lista.length === 0) { 
        container.innerHTML = '<div style="grid-column: 1 / -1; padding:40px; text-align:center; color:#64748b; font-weight:500;">Nenhum registro encontrado para a Agência.</div>'; 
        return; 
    }
    
    let nAcesso = window.getNivelAcesso();
    let isReadOnlyAgencia = (nAcesso === 'ACOLHIMENTO_AGENCIA');

    const renderChip = (key, label, item) => { 
        let isAnexado = !!item.url_docs_agencia; 
        let onClickStr = isAnexado ? `onclick="event.stopPropagation(); window.open('${item.url_docs_agencia}', '_blank');"` : `onclick="event.stopPropagation(); alert('Nenhum documento anexado na nuvem.')"`; 
        let curStr = isAnexado ? 'cursor:pointer;' : 'cursor:help;';
        
        return item[`agencia_chk_${key}`] 
            ? `<span class="doc-chip tem" style="${curStr}" title="${isAnexado ? 'Acessar Nuvem' : 'Marcado'}" ${onClickStr}>${label}</span>` 
            : `<span class="doc-chip" style="${curStr}" title="${isAnexado ? 'Acessar Nuvem' : 'Pendente'}" ${onClickStr}>${label}</span>`; 
    };
    
    const fragment = document.createDocumentFragment();

    lista.forEach(item => {
        const card = document.createElement('div'); 
        card.className = 'agencia-card'; 
        
        if (item.tipo_registro === 'PARTICULAR') {
            const responsavelTxt = item.chk_pessoa_fisica ? `PF: ${item.part_pf_nome || ''} (${item.part_pf_cpf || ''})` : `Funerária: ${item.part_funeraria || ''}`;
            
            let statusNuvem = item.part_link_nuvem ? `<a href="${item.part_link_nuvem}" target="_blank" onclick="event.stopPropagation();" style="text-decoration:none; font-size:10px; color:#3b82f6; font-weight:bold;">🔗 VER DOCUMENTOS (NUVEM)</a>` : `<span style="font-size:10px; color:#ef4444; font-weight:bold;">⚠️ NENHUM LINK ANEXADO</span>`;
            
            let footerPart = isReadOnlyAgencia ? 
                `<span style="font-size:10px;color:#94a3b8;margin-top:5px;display:block;text-align:center;font-weight:bold;">Apenas Visualização</span>` : 
                `<button class="btn-novo" style="background:#8b5cf6; color:white; padding: 6px 12px; font-size: 12px; flex:1;" onclick="event.stopPropagation(); window.abrirFichaParticular('${item.id}')">📝 Ficha / Docs</button>
                 <button class="btn-novo" style="background:#ef4444; color:white; padding: 6px 12px; font-size: 12px; flex:1;" onclick="event.stopPropagation(); window.excluir('${item.id}')">🗑️ Remover</button>`;

            card.style.borderTopColor = '#8b5cf6'; 
            card.style.background = '#faf5ff';
            card.innerHTML = `
                <div class="agencia-card-header" style="background: #f3e8ff; border-bottom: 1px solid #e9d5ff;">
                    <div class="agencia-card-title" style="color: #4c1d95;">${(item.nome || 'NÃO INFORMADO').toUpperCase()}</div>
                    <div class="agencia-card-subtitle" style="color: #7c3aed; font-weight: 700;">🌟 ATENDIMENTO PARTICULAR</div>
                </div>
                <div class="agencia-card-body">
                    <div class="agencia-info-row"><span class="agencia-info-label" style="color:#7c3aed;">Cemitério:</span><span class="agencia-info-value">${item.part_cemiterio || ''}</span></div>
                    <div class="agencia-info-row"><span class="agencia-info-label" style="color:#7c3aed;">Tipo:</span><span class="agencia-info-value">${item.part_tipo || ''}</span></div>
                    <div class="agencia-info-row"><span class="agencia-info-label" style="color:#7c3aed;">Liberação:</span><span class="agencia-info-value">${item.part_hora_liberacao || ''}</span></div>
                    <div class="agencia-info-row"><span class="agencia-info-label" style="color:#7c3aed;">Responsável:</span><span class="agencia-info-value" style="font-size:11px;">${responsavelTxt}</span></div>
                    <div class="agencia-info-row"><span class="agencia-info-label" style="color:#7c3aed;">Taxas (R$):</span><span class="agencia-info-value">${item.part_taxas ? `R$ ${item.part_taxas}` : 'Isento/Não inf.'}</span></div>
                    <div style="margin-top: 5px;">
                        <span class="agencia-info-label" style="display:block; margin-bottom:5px; font-size:10px; color:#7c3aed;">DOCUMENTAÇÃO:</span>
                        <div style="margin-top:5px;">${statusNuvem}</div>
                    </div>
                </div>
                <div class="agencia-card-footer" style="background: #f3e8ff; border-top: 1px solid #e9d5ff; display:flex; gap:10px;">
                    ${footerPart}
                </div>`;
            card.onclick = () => { if(typeof window.abrirFichaParticular === 'function') window.abrirFichaParticular(item.id); };
            fragment.appendChild(card); 
            return;
        }

        card.onclick = () => { if(typeof window.visualizar === 'function') window.visualizar(item.id); };
        
        let statusGRM = item.agencia_grm || 'PENDENTE'; 
        if (item.isencao === 'SIM') {
            statusGRM = 'ISENTO'; 
        }
        
        let badgeGRM = `<span class="badge-status ${statusGRM === 'PENDENTE' ? 'badge-pendente' : 'badge-sucesso'}">${statusGRM}</span>`;
        
        let statusLib = item.agencia_status_liberacao || 'PENDENTE'; 
        let badgeLib = `<span class="badge-status ${statusLib === 'PENDENTE' ? 'badge-pendente' : 'badge-sucesso'}">${statusLib === 'LIBERADO' ? 'LIBERADO' : 'AGUARDANDO'}</span>`;
        
        let isAcolhimento = item.funeraria && (item.funeraria.toUpperCase().includes('SOCIAL') || item.funeraria.toUpperCase().includes('ACOLHIMENTO'));
        
        // Regra baseada na isenção do atendimento
        let isIsento = (item.isencao === 'SIM' || item.isencao === '100' || item.isencao === '100%');

        let docsHTML = renderChip('invol', 'INVOL', item);
        if (!isAcolhimento && !isIsento) {
            docsHTML += renderChip('nf', 'NF', item);
        }
        docsHTML += renderChip('tanato', 'TANATO', item);
        
        if (!isIsento) { 
            docsHTML += renderChip('comprovante', 'COMP. PGTO', item);
            docsHTML += renderChip('guia_grm', 'GRM', item);
        }
        
        card.style.borderTopColor = statusLib === 'LIBERADO' ? '#10b981' : (statusGRM !== 'PENDENTE' ? '#f59e0b' : '#3b82f6');
        
        let statusDocsAcolhimento = item.url_docs_acolhimento ? `<span class="badge-status badge-sucesso" style="cursor:pointer;" onclick="event.stopPropagation(); window.open('${item.url_docs_acolhimento}', '_blank')" title="Acessar Documentos do Acolhimento">OK (NUVEM)</span>` : `<span class="badge-status badge-pendente" title="Acolhimento ainda não anexou os documentos">PENDENTE</span>`;
        
        let statusDocsAgencia = item.url_docs_agencia ? `<a href="${item.url_docs_agencia}" target="_blank" onclick="event.stopPropagation();" style="text-decoration:none; font-size:10px; color:#3b82f6; font-weight:bold;">🔗 VER DOCUMENTOS (NUVEM)</a>` : `<span class="badge-status badge-pendente" title="Nenhum link da Agência">PENDENTE</span>`;

        let btnAssumir = ''; 
        let btnRepassar = `<button class="btn-novo" style="background:#8b5cf6; color:white; padding: 6px 12px; font-size: 12px; width:auto;" onclick="event.stopPropagation(); window.abrirModalTransferirResponsavel('${item.id}')" title="Repassar para outro colaborador">👤 Repassar</button>`;
        
        if (!item.agencia_atendente) { 
            btnAssumir = `<button class="btn-novo" style="background:#3b82f6; color:white; padding: 6px 12px; font-size: 12px; width:auto;" onclick="event.stopPropagation(); window.assumirProcessoAgencia('${item.id}', false)">🙋‍♂️ Assumir</button>`; 
        } else if (!window.usuarioLogado || item.agencia_atendente !== window.usuarioLogado.nome) { 
            btnAssumir = `<button class="btn-novo" style="background:#f59e0b; color:white; padding: 6px 12px; font-size: 12px; width:auto;" onclick="event.stopPropagation(); window.assumirProcessoAgencia('${item.id}', true)">🔄 Assumir</button>`; 
        }

        let avisoDocs = '';
        if (statusLib === 'LIBERADO') {
            let pendentes = [];
            
            if(!item.agencia_chk_invol) pendentes.push("INVOL"); 
            if(!isAcolhimento && !isIsento && !item.agencia_chk_nf) pendentes.push("NF"); 
            
            if (!isIsento) { 
                if(!item.agencia_chk_comprovante) pendentes.push("PGTO"); 
                if(!item.agencia_chk_guia_grm) pendentes.push("GRM"); 
            }
            if(!item.url_docs_agencia) pendentes.push("NUVEM");
            
            // LÓGICA NOVA: Se for isento pela GRM ou isenção da ficha, o aviso não é montado.
            let statusGrmIsento = (item.agencia_grm === 'ISENTO' || isIsento);
            
            if(pendentes.length > 0 && !statusGrmIsento) { 
                avisoDocs = `<div style="background:#fee2e2; color:#ef4444; padding:6px; border-radius:4px; font-size:10px; font-weight:bold; margin-top:8px; text-align:center; border: 1px solid #fca5a5;">⚠️ LIBERADO FALTANDO: ${pendentes.join(', ')}</div>`; 
            }
        }

        let acoesAgenciaNormal = isReadOnlyAgencia ? 
            `<span style="font-size:10px;color:#94a3b8;text-align:center;width:100%;font-weight:bold;">Apenas Visualização</span>` : 
            `<div style="display:flex; gap:5px; flex-wrap: wrap;">
                ${btnAssumir}
                ${btnRepassar}
                <button class="btn-novo" style="background:#f1f5f9; color:#ea580c; border: 1px solid #cbd5e1; padding: 6px 12px; font-size: 12px; width:auto;" onclick="event.stopPropagation(); window.abrirModalAgencia('${item.id}')">✏️ Editar</button>
            </div>
            <button class="btn-novo" style="background:${statusLib === 'LIBERADO' ? '#10b981' : '#3b82f6'}; color:white; padding: 6px 12px; font-size: 12px; margin-top: 5px; width:auto; cursor:pointer;" onclick="event.stopPropagation(); window.abrirModalLiberacao('${item.id}')">✅ Liberação</button>`;

        card.innerHTML = `
            <div class="agencia-card-header">
                <div class="agencia-card-title">${(item.nome || 'NÃO INFORMADO').toUpperCase()}</div>
                <div class="agencia-card-subtitle">Sepultamento: ${item.data_ficha || ''} às ${item.hora || ''}</div>
            </div>
            <div class="agencia-card-body">
                <div class="agencia-info-row"><span class="agencia-info-label">E-CIGA:</span><span class="agencia-info-value" style="font-family:monospace; font-size:13px; color:#0ea5e9;">${item.agencia_processo || 'S/ PROCESSO'}</span></div>
                <div class="agencia-info-row"><span class="agencia-info-label">Resp. Agência:</span><span class="agencia-info-value" style="color:#3b82f6;">${(item.agencia_atendente || 'AGUARDANDO').toUpperCase()}</span></div>
                <div class="agencia-info-row"><span class="agencia-info-label">Funerária:</span><span class="agencia-info-value">${(item.funeraria || 'N/I').toUpperCase()}</span></div>
                <div class="agencia-info-row"><span class="agencia-info-label">Docs Acolhimento:</span><span class="agencia-info-value">${statusDocsAcolhimento}</span></div>
                <div class="agencia-info-row"><span class="agencia-info-label">GRM:</span><span class="agencia-info-value">${badgeGRM}</span></div>
                <div class="agencia-info-row"><span class="agencia-info-label">Liberação:</span><span class="agencia-info-value">${badgeLib}</span></div>
                <div style="margin-top: 5px;">
                    <span class="agencia-info-label" style="display:block; margin-bottom:5px; font-size:10px;">CHECKLIST AGÊNCIA (Clique p/ abrir Nuvem):</span>
                    <div>${docsHTML}</div>
                    <div style="margin-top:5px;">${statusDocsAgencia}</div>
                    ${avisoDocs}
                </div>
            </div>
            <div class="agencia-card-footer" style="flex-wrap: wrap;">
                ${acoesAgenciaNormal}
            </div>`;
        
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment);
}

window.abrirModalParticular = function() {
    if (window.getNivelAcesso() === 'ACOLHIMENTO_AGENCIA') return;
    
    const form = document.getElementById('form-particular'); 
    if(form) form.reset(); 
    
    const docIdElem = document.getElementById('part_docId');
    if(docIdElem) docIdElem.value = ""; 
    
    window.togglePessoaFisica(); 
    safeDisplay('modal-particular', 'block');
}

window.fecharModalParticular = function() { 
    safeDisplay('modal-particular', 'none'); 
}

window.togglePessoaFisica = function() {
    const chkElem = document.getElementById('chk_pessoa_fisica');
    if(!chkElem) return;
    
    const isPF = chkElem.checked;
    
    const divFun = document.getElementById('div_funeraria');
    if(divFun) divFun.style.display = isPF ? 'none' : 'flex'; 
    
    const divPF = document.getElementById('div_pessoa_fisica');
    if(divPF) divPF.style.display = isPF ? 'grid' : 'none';
}

const formParticular = document.getElementById('form-particular');
if(formParticular) {
    formParticular.onsubmit = (e) => {
        e.preventDefault(); 
        
        const dados = {
            tipo_registro: 'PARTICULAR', 
            protocolo: window.gerarProtocolo(),
            data_ficha: document.getElementById('filtro-data') ? document.getElementById('filtro-data').value : window.pegarDataAtualLocal(), 
            nome: document.getElementById('part_nome') ? document.getElementById('part_nome').value.trim() : '', 
            part_cemiterio: document.getElementById('part_cemiterio') ? document.getElementById('part_cemiterio').value.trim() : '', 
            local: document.getElementById('part_cemiterio') ? document.getElementById('part_cemiterio').value.trim() : '', 
            part_hora_liberacao: document.getElementById('part_hora_liberacao') ? document.getElementById('part_hora_liberacao').value : '', 
            part_tipo: document.getElementById('part_tipo') ? document.getElementById('part_tipo').value : '', 
            part_taxas: document.getElementById('part_taxas') ? document.getElementById('part_taxas').value : '', 
            chk_pessoa_fisica: document.getElementById('chk_pessoa_fisica') ? document.getElementById('chk_pessoa_fisica').checked : false, 
            part_funeraria: document.getElementById('part_funeraria') ? document.getElementById('part_funeraria').value.trim() : '', 
            funeraria: document.getElementById('part_funeraria') ? document.getElementById('part_funeraria').value.trim() : '', 
            part_pf_nome: document.getElementById('part_pf_nome') ? document.getElementById('part_pf_nome').value.trim() : '', 
            part_pf_cpf: document.getElementById('part_pf_cpf') ? document.getElementById('part_pf_cpf').value.trim() : '', 
            part_pf_tel: document.getElementById('part_pf_tel') ? document.getElementById('part_pf_tel').value.trim() : '', 
            part_pf_tel2: document.getElementById('part_pf_tel2') ? document.getElementById('part_pf_tel2').value.trim() : '', 
            part_pf_email: document.getElementById('part_pf_email') ? document.getElementById('part_pf_email').value.trim() : '', 
            part_pf_cep: document.getElementById('part_pf_cep') ? document.getElementById('part_pf_cep').value.trim() : '', 
            part_pf_endereco: document.getElementById('part_pf_endereco') ? document.getElementById('part_pf_endereco').value.trim() : '', 
            part_pf_numero: document.getElementById('part_pf_numero') ? document.getElementById('part_pf_numero').value.trim() : '', 
            part_pf_complemento: document.getElementById('part_pf_complemento') ? document.getElementById('part_pf_complemento').value.trim() : '', 
            part_pf_bairro: document.getElementById('part_pf_bairro') ? document.getElementById('part_pf_bairro').value.trim() : '', 
            part_pf_cidade: document.getElementById('part_pf_cidade') ? document.getElementById('part_pf_cidade').value.trim() : '', 
            part_pf_uf: document.getElementById('part_pf_uf') ? document.getElementById('part_pf_uf').value.trim() : '', 
            atendente_sistema: window.usuarioLogado ? window.usuarioLogado.nome : 'SISTEMA', 
            resp_nome: document.getElementById('part_pf_nome') ? document.getElementById('part_pf_nome').value.trim() : '', 
            resp_cpf: document.getElementById('part_pf_cpf') ? document.getElementById('part_pf_cpf').value.trim() : '', 
            telefone: document.getElementById('part_pf_tel') ? document.getElementById('part_pf_tel').value.trim() : '', 
            resp_cep: document.getElementById('part_pf_cep') ? document.getElementById('part_pf_cep').value.trim() : '', 
            resp_endereco: document.getElementById('part_pf_endereco') ? document.getElementById('part_pf_endereco').value.trim() : '', 
            resp_numero: document.getElementById('part_pf_numero') ? document.getElementById('part_pf_numero').value.trim() : '', 
            resp_complemento: document.getElementById('part_pf_complemento') ? document.getElementById('part_pf_complemento').value.trim() : '', 
            resp_bairro: document.getElementById('part_pf_bairro') ? document.getElementById('part_pf_bairro').value.trim() : '', 
            resp_cidade: document.getElementById('part_pf_cidade') ? document.getElementById('part_pf_cidade').value.trim() : '', 
            resp_uf: document.getElementById('part_pf_uf') ? document.getElementById('part_pf_uf').value.trim() : ''
        };
        
        getDB().collection("atendimentos").add(dados).then((docRef) => { 
            window.registrarHistorico(docRef.id, 'CADASTRO', `Atendimento particular registrado - Falecido: ${dados.nome} | Protocolo: ${dados.protocolo}`);
            window.enviarEmailAutomato(dados, dados.part_pf_email);
            window.fecharModalParticular(); 
            alert("Atendimento Particular registrado com sucesso!"); 
        }).catch(err => { 
            console.error(err); 
            alert("Erro ao salvar o registro particular."); 
        });
    }
}

window.abrirFichaParticular = function(id) {
    if(!getDB()) return;
    
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); 
            d.id = doc.id; 
            window.dadosAtendimentoAtual = d; 
            
            const docIdElem = document.getElementById('part_ficha_docId');
            if(docIdElem) docIdElem.value = id;
            
            let responsavelTxt = d.chk_pessoa_fisica ? `PF: ${d.part_pf_nome || ''} (CPF: ${d.part_pf_cpf || ''})` : `FUNERÁRIA: ${d.part_funeraria || ''}`;
            
            let dadosPF = '';
            if (d.chk_pessoa_fisica) {
                let enderecoCompleto = `${d.part_pf_endereco || ''}, ${d.part_pf_numero || 'S/N'}`;
                if (d.part_pf_complemento) enderecoCompleto += ` - ${d.part_pf_complemento}`;
                if (d.part_pf_bairro) enderecoCompleto += ` - ${d.part_pf_bairro}`;
                if (d.part_pf_cidade) enderecoCompleto += ` - ${d.part_pf_cidade}/${d.part_pf_uf || ''}`;
                if (d.part_pf_cep) enderecoCompleto += ` (CEP: ${d.part_pf_cep})`;

                dadosPF = `
                    <div style="grid-column: 1 / -1; border-top: 1px dashed #cbd5e1; margin-top: 5px; padding-top: 10px;">
                        <span style="font-size:10px; color:#d97706; font-weight:bold; display:block; margin-bottom: 5px;">DADOS DO RESPONSÁVEL (PESSOA FÍSICA):</span>
                        <div style="display:grid; grid-template-columns: 1fr; gap:10px;">
                            <div><span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">ENDEREÇO COMPLETO:</span><span style="font-size:12px; font-weight:600; color:#334155;">${enderecoCompleto}</span></div>
                            <div><span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">E-MAIL:</span><span style="font-size:12px; font-weight:600; color:#334155;">${d.part_pf_email || 'Não informado'}</span></div>
                        </div>
                    </div>
                `;
            }

            const resumoElem = document.getElementById('resumo-particular');
            if(resumoElem) {
                resumoElem.innerHTML = `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <div style="grid-column: 1 / -1; margin-bottom: 5px; text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
                            <span style="font-size:10px; color:#3b82f6; font-weight:bold; display:block;">Nº PROTOCOLO</span>
                            <span style="font-size:16px; font-weight:900; color:#1e3a8a; letter-spacing: 1px;">${d.protocolo || 'NÃO GERADO'}</span>
                        </div>
                        <div><span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">FALECIDO:</span><span style="font-size:13px; font-weight:bold; color:#1e293b;">${(d.nome||'N/I').toUpperCase()}</span></div>
                        <div><span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">CEMITÉRIO DESTINO:</span><span style="font-size:12px; font-weight:bold; color:#334155;">${(d.part_cemiterio||'N/I').toUpperCase()}</span></div>
                        <div><span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">TIPO:</span><span style="font-size:12px; font-weight:bold; color:#334155;">${(d.part_tipo||'N/I').toUpperCase()}</span></div>
                        <div><span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">HORA LIBERAÇÃO:</span><span style="font-size:12px; font-weight:bold; color:#334155;">${d.part_hora_liberacao||'--:--'}</span></div>
                        <div style="grid-column: 1 / -1;"><span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">RESPONSÁVEL:</span><span style="font-size:12px; font-weight:bold; color:#334155;">${responsavelTxt}</span></div>
                        <div style="grid-column: 1 / -1;"><span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">TELEFONES:</span><span style="font-size:12px; font-weight:bold; color:#334155;">${d.part_pf_tel||'-'} / ${d.part_pf_tel2||'-'}</span></div>
                        ${dadosPF}
                    </div>
                `;
            }
            
            ['rg_resp', 'comprovante', 'guia', 'invol', 'nf', 'taxas'].forEach(k => {
                const chk = document.getElementById(`part_chk_${k}`);
                if(chk) chk.checked = (d[`part_chk_${k}`] === true);
            });
            
            const linkNuvem = document.getElementById('part_link_nuvem');
            if (linkNuvem) linkNuvem.value = d.part_link_nuvem || '';
            
            safeDisplay('modal-particular-ficha', 'block');
        }
    });
}

window.fecharModalParticularFicha = function() { safeDisplay('modal-particular-ficha', 'none'); }

window.salvarFichaParticular = function() {
    const idElem = document.getElementById('part_ficha_docId');
    if(!idElem) return;
    const id = idElem.value;
    if(!id) return;
    
    let updates = {};
    ['rg_resp', 'comprovante', 'guia', 'invol', 'nf', 'taxas'].forEach(k => {
        const chk = document.getElementById(`part_chk_${k}`);
        if(chk) updates[`part_chk_${k}`] = chk.checked;
    });
    
    const linkNuvem = document.getElementById('part_link_nuvem');
    if(linkNuvem) updates.part_link_nuvem = linkNuvem.value.trim();
    
    getDB().collection("atendimentos").doc(id).update(updates).then(() => {
        getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', acao: "ATUALIZOU FICHA PARTICULAR", detalhe: `ID: ${id}` }); 
        window.registrarHistorico(id, 'CHECKLIST', 'Checklist da ficha particular atualizado');
        alert("Ficha salva com sucesso!");
        window.fecharModalParticularFicha();
    }).catch(e => alert("Erro ao salvar ficha."));
}

window.abrirModalAgencia = function(id) {
    if (window.getNivelAcesso() === 'ACOLHIMENTO_AGENCIA') return;
    
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); 
            
            const docIdElem = document.getElementById('agencia_docId'); 
            if(docIdElem) docIdElem.value = doc.id; 
            
            const nomeElem = document.getElementById('agencia_nome_falecido'); 
            if(nomeElem) nomeElem.innerText = (d.nome || 'N/I').toUpperCase(); 
            
            const procElem = document.getElementById('agencia_processo'); 
            if(procElem) procElem.value = d.agencia_processo || ''; 
            
            const grmElem = document.getElementById('agencia_grm'); 
            if(grmElem) grmElem.value = d.agencia_grm || 'PENDENTE'; 
            
            const statElem = document.getElementById('agencia_status_liberacao'); 
            if(statElem) statElem.value = d.agencia_status_liberacao || 'PENDENTE'; 
            
            const valElem = document.getElementById('agencia_valor_grm'); 
            if(valElem) valElem.value = d.agencia_valor_grm || '';
            
            ['invol', 'nf', 'tanato', 'comprovante', 'guia_grm'].forEach(k => { 
                const elChk = document.getElementById(`agencia_chk_${k}`); 
                if(elChk) elChk.checked = (d[`agencia_chk_${k}`] === true); 
            });
            
            let isAcolhimento = d.funeraria && (d.funeraria.toUpperCase().includes('SOCIAL') || d.funeraria.toUpperCase().includes('ACOLHIMENTO'));
            // Nova Regra de Isenção Aplicada
            let isIsento = (d.isencao === 'SIM' || d.isencao === '100' || d.isencao === '100%');

            let nfInput = document.getElementById('agencia_chk_nf');
            if(nfInput) {
                let labelNf = nfInput.closest('label');
                if (labelNf) {
                    labelNf.style.display = (isAcolhimento || isIsento) ? 'none' : 'flex';
                }
            }

            let compInput = document.getElementById('agencia_chk_comprovante');
            if(compInput) {
                let labelComp = compInput.closest('label');
                if (labelComp) {
                    labelComp.style.display = isIsento ? 'none' : 'flex';
                }
            }

            let grmInput = document.getElementById('agencia_chk_guia_grm');
            if(grmInput) {
                let labelGrm = grmInput.closest('label');
                if (labelGrm) {
                    labelGrm.style.display = isIsento ? 'none' : 'flex';
                }
            }

            const elLnk = document.getElementById('link_docs_agencia'); 
            if(elLnk) elLnk.value = d.url_docs_agencia || '';
            
            let nomeAjustado = (d.nome || 'NAO_INFORMADO').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); 
            let protocoloAjustado = d.protocolo || 'SEM_PROTO'; 
            window.nomePastaPadrao = `${protocoloAjustado}_${nomeAjustado}`;
            
            const eND = document.getElementById('nome_pasta_agencia_display'); 
            if(eND) eND.innerText = window.nomePastaPadrao;
            
            const atendModal = document.getElementById('agencia_atendente_modal');
            if(atendModal) atendModal.innerText = (d.agencia_atendente || 'NÃO ASSUMIDO').toUpperCase(); 
            
            let isOwner = window.usuarioLogado && d.agencia_atendente === window.usuarioLogado.nome; 
            window.toggleCamposAgencia(isOwner);
            
            safeDisplay('modal-agencia', 'block');
        }
    });
}

window.fecharModalAgencia = function() { safeDisplay('modal-agencia', 'none'); }

window.toggleCamposAgencia = function(enable) {
    const form = document.getElementById('form-agencia'); if(!form) return;
    const inputs = form.querySelectorAll('input, select, textarea'); 
    inputs.forEach(inp => { if (inp.type !== 'hidden') inp.disabled = !enable; });
    const btnSalvar = form.querySelector('button[onclick="salvarDadosAgencia()"]'); 
    if(btnSalvar) { btnSalvar.disabled = !enable; btnSalvar.style.opacity = enable ? '1' : '0.5'; btnSalvar.style.cursor = enable ? 'pointer' : 'not-allowed'; btnSalvar.title = enable ? '' : 'Assuma o processo para editar e salvar'; }
    const btnMesclar = form.querySelector('button[onclick="mesclarEBaixarPDFsAgencia(event)"]'); 
    if(btnMesclar) { btnMesclar.disabled = !enable; btnMesclar.style.opacity = enable ? '1' : '0.5'; btnMesclar.style.cursor = enable ? 'pointer' : 'not-allowed'; }
}

window.salvarDadosAgencia = function() {
    const idElem = document.getElementById('agencia_docId'); if(!idElem) return;
    const id = idElem.value; if(!id) return;
    const procElem = document.getElementById('agencia_processo'); const grmElem = document.getElementById('agencia_grm'); const statElem = document.getElementById('agencia_status_liberacao'); const valElem = document.getElementById('agencia_valor_grm');
    const chkInvol = document.getElementById('agencia_chk_invol'); const chkNf = document.getElementById('agencia_chk_nf'); const chkTanato = document.getElementById('agencia_chk_tanato'); const chkComp = document.getElementById('agencia_chk_comprovante'); const chkGuia = document.getElementById('agencia_chk_guia_grm');
    
    const dados = { 
        agencia_processo: procElem ? procElem.value : '', 
        agencia_grm: grmElem ? grmElem.value : '', 
        agencia_status_liberacao: statElem ? statElem.value : '', 
        agencia_valor_grm: valElem ? valElem.value : '', 
        agencia_chk_invol: chkInvol ? chkInvol.checked : false, 
        agencia_chk_nf: chkNf ? chkNf.checked : false, 
        agencia_chk_tanato: chkTanato ? chkTanato.checked : false, 
        agencia_chk_comprovante: chkComp ? chkComp.checked : false, 
        agencia_chk_guia_grm: chkGuia ? chkGuia.checked : false 
    };
    
    const elLnk = document.getElementById('link_docs_agencia'); if(elLnk) dados.url_docs_agencia = elLnk.value.trim();
    
    getDB().collection("atendimentos").doc(id).update(dados).then(() => { 
        getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', acao: "ATUALIZAÇÃO AGÊNCIA", detalhe: `Processo: ${dados.agencia_processo}` }); 
        window.registrarHistorico(id, 'AGENCIA', `Trâmites da agência atualizados - Processo: ${dados.agencia_processo} | GRM: ${dados.agencia_grm} | Status: ${dados.agencia_status_liberacao}`);
        window.fecharModalAgencia(); 
    }).catch(e => alert("Erro ao salvar trâmites da agência."));
}

window.mesclarEBaixarPDFsAgencia = async function(event) {
    event.preventDefault(); 
    const fileInput = document.getElementById('pdf_merger_input_agencia');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) { alert("Selecione PDFs."); return; }
    try {
        const btn = event.target; const oldTxt = btn.innerText; btn.innerText = "Mesclando..."; btn.disabled = true;
        const pdfDoc = await window.PDFLib.PDFDocument.create();
        for (let i = 0; i < fileInput.files.length; i++) { 
            const f = fileInput.files[i]; 
            if (f.type !== "application/pdf") { alert("Apenas PDFs."); btn.innerText = oldTxt; btn.disabled = false; return; } 
            const arr = await f.arrayBuffer(); const currentPdf = await window.PDFLib.PDFDocument.load(arr); const copiedPages = await pdfDoc.copyPages(currentPdf, currentPdf.getPageIndices()); copiedPages.forEach((page) => pdfDoc.addPage(page)); 
        }
        const mergedPdfBytes = await pdfDoc.save(); const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; 
        
        const docIdElem = document.getElementById('agencia_docId'); const docId = docIdElem ? docIdElem.value : null; let fileName = "Documentos_Agencia.pdf";
        if(docId) { const docSnap = await getDB().collection("atendimentos").doc(docId).get(); if(docSnap.exists) { const d = docSnap.data(); let n = (d.nome || 'S_N').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); fileName = `${d.protocolo || 'PROTO'}_${n}_AGENCIA.pdf`; } }
        a.download = fileName; document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); a.remove(); btn.innerText = oldTxt; btn.disabled = false; alert("PDFs mesclados e baixados com sucesso!"); fileInput.value = "";
    } catch (err) { console.error(err); alert("Erro ao mesclar arquivos."); if(event.target) { event.target.innerText = "Mesclar e Baixar PDF"; event.target.disabled = false; } }
};

window.assumirProcessoAgencia = function(id, isTransfer = false) {
    if (!window.usuarioLogado || !window.usuarioLogado.nome) { alert("Faça login."); return; }
    if (confirm(isTransfer ? `Deseja transferir a responsabilidade deste processo para você?` : `Deseja assumir a responsabilidade por este processo na Agência?`)) {
        getDB().collection("atendimentos").doc(id).update({ agencia_atendente: window.usuarioLogado.nome }).then(() => { 
            getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: window.usuarioLogado.nome, acao: isTransfer ? "TRANSFERIU RESPONSABILIDADE (AGÊNCIA)" : "ASSUMIU AGÊNCIA", detalhe: `ID: ${id}` }); 
            window.registrarHistorico(id, 'AGENCIA', isTransfer ? `Responsabilidade transferida para ${window.usuarioLogado.nome}` : `${window.usuarioLogado.nome} assumiu o processo na Agência`);
        }).catch(e => { alert("Erro ao assumir atendimento."); });
    }
}

window.assumirProcessoAgenciaModal = function() {
    if (!window.usuarioLogado || !window.usuarioLogado.nome) return; 
    const idElem = document.getElementById('agencia_docId'); if(!idElem) return;
    const id = idElem.value;
    if(confirm("Deseja assumir este processo para você? Apenas após isso a edição será habilitada.")) { 
        getDB().collection("atendimentos").doc(id).update({ agencia_atendente: window.usuarioLogado.nome }).then(() => { 
            const modElem = document.getElementById('agencia_atendente_modal'); if(modElem) modElem.innerText = window.usuarioLogado.nome.toUpperCase(); 
            window.toggleCamposAgencia(true); 
        }); 
    }
}

window.abrirModalTransferirResponsavel = function(id) {
    window.idTransferenciaResponsavelAtual = id; 
    const select = document.getElementById('novo_responsavel_agencia'); if(!select) return;
    select.innerHTML = '<option value="">Carregando...</option>'; 
    const justifica = document.getElementById('justificativa_repasse'); if(justifica) justifica.value = '';
    getDB().collection("equipe").orderBy("nome").get().then(snap => { 
        select.innerHTML = '<option value="">Selecione o colaborador...</option>'; 
        snap.forEach(doc => { if(doc.data().nome) { select.innerHTML += `<option value="${doc.data().nome}">${doc.data().nome.toUpperCase()}</option>`; } }); 
        safeDisplay('modal-transferir-responsavel', 'flex', '10005'); 
    }).catch(e => { alert("Erro ao carregar lista de equipe."); });
}

window.abrirModalTransferirResponsavelModal = function() { 
    const idElem = document.getElementById('agencia_docId'); if(idElem) window.abrirModalTransferirResponsavel(idElem.value); 
}

window.fecharModalTransferirResponsavel = function() { safeDisplay('modal-transferir-responsavel', 'none'); }

window.confirmarTransferenciaResponsavel = function() {
    if(!window.idTransferenciaResponsavelAtual) return; 
    const resElem = document.getElementById('novo_responsavel_agencia'); const jusElem = document.getElementById('justificativa_repasse');
    const novoResponsavel = resElem ? resElem.value : ''; const justificativa = jusElem ? jusElem.value.trim() : '';
    if(!novoResponsavel) { alert("Selecione um usuário na lista."); return; } 
    if(!justificativa) { alert("Informe a justificativa do repasse (Obrigatório)."); return; }
    
    getDB().collection("atendimentos").doc(window.idTransferenciaResponsavelAtual).update({ agencia_atendente: novoResponsavel, justificativa_repasse: justificativa }).then(() => {
        getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', acao: "REPASSOU PROCESSO (AGÊNCIA)", detalhe: `ID: ${window.idTransferenciaResponsavelAtual} | Para: ${novoResponsavel} | Motivo: ${justificativa}` });
        window.registrarHistorico(window.idTransferenciaResponsavelAtual, 'TRANSFERENCIA', `Processo repassado para ${novoResponsavel} - Motivo: ${justificativa}`);
        alert("Processo repassado com sucesso!"); 
        const el = document.getElementById('agencia_atendente_modal'); if (el && document.getElementById('modal-agencia').style.display === 'block') { el.innerText = novoResponsavel.toUpperCase(); } 
        window.fecharModalTransferirResponsavel();
    }).catch(e => { alert("Erro ao transferir processo."); });
}

const listaDocsPadrao = ['autorizacao', 'rg_perm', 'obito', 'rg_falecido', 'residencia', 'guia_cartorio', 'moeda', 'bolsa', 'loas', 'cadunico', 'cras', 'parentesco', 'casamento', 'locacao', 'procuracao'];

window.abrirModalDocsAcolhimento = function(id) {
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); 
            const docsIdElem = document.getElementById('docs_acolhimento_id'); if(docsIdElem) docsIdElem.value = id;
            listaDocsPadrao.forEach(c => { const chk = document.getElementById(`chk_doc_${c}`); if(chk) chk.checked = (d[`chk_doc_${c}`] === true); });
            const elLnk = document.getElementById('link_docs_acolhimento'); if(elLnk) elLnk.value = d.url_docs_acolhimento || '';
            let nAj = (d.nome || 'NAO_INFORMADO').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); 
            let pAj = d.protocolo || 'SEM_PROTO'; 
            window.nomePastaPadrao = `${pAj}_${nAj}`;
            const dNd = document.getElementById('nome_pasta_checklist_display'); if(dNd) dNd.innerText = window.nomePastaPadrao;
            safeDisplay('modal-docs-acolhimento', 'block', '10005');
        }
    });
}

window.abrirModalDocsAcolhimentoModal = function() { 
    if(window.dadosAtendimentoAtual && window.dadosAtendimentoAtual.id) { window.fecharModalVisualizar(); window.abrirModalDocsAcolhimento(window.dadosAtendimentoAtual.id); } 
}

window.fecharModalDocsAcolhimento = function() { safeDisplay('modal-docs-acolhimento', 'none'); }

window.salvarDocsAcolhimento = function() {
    const idElem = document.getElementById('docs_acolhimento_id'); if(!idElem) return;
    const id = idElem.value; if(!id) return; 
    let updates = {}; 
    listaDocsPadrao.forEach(c => { const chk = document.getElementById(`chk_doc_${c}`); if(chk) updates[`chk_doc_${c}`] = chk.checked; });
    const elLnk = document.getElementById('link_docs_acolhimento'); if(elLnk) updates.url_docs_acolhimento = elLnk.value.trim();
    
    getDB().collection("atendimentos").doc(id).update(updates).then(() => { 
        getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', acao: "ATUALIZOU DOCS ACOLHIMENTO", detalhe: `ID: ${id}` }); 
        const docsMarc = listaDocsPadrao.filter(c => { const chk = document.getElementById(`chk_doc_${c}`); return chk && chk.checked; });
        window.registrarHistorico(id, 'CHECKLIST', `Checklist acolhimento atualizado (${docsMarc.length} docs marcados)`);
        alert("Checklist salvo com sucesso!"); window.fecharModalDocsAcolhimento(); 
    }).catch(e => { alert("Erro ao salvar os documentos."); });
}
window.mesclarEBaixarPDFsAcolhimento = async function(event) {
    event.preventDefault(); 
    const fileInput = document.getElementById('pdf_merger_input_acolhimento');
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) { 
        alert("Selecione pelo menos um arquivo PDF."); 
        return; 
    }
    
    try {
        const btn = event.target; 
        const oldTxt = btn.innerText; 
        btn.innerText = "Mesclando..."; 
        btn.disabled = true;
        
        const pdfDoc = await window.PDFLib.PDFDocument.create();
        
        for (let i = 0; i < fileInput.files.length; i++) { 
            const f = fileInput.files[i]; 
            if (f.type !== "application/pdf") { 
                alert("Selecione apenas PDFs."); 
                btn.innerText = oldTxt; 
                btn.disabled = false; 
                return; 
            } 
            const arr = await f.arrayBuffer(); 
            const currentPdf = await window.PDFLib.PDFDocument.load(arr); 
            const copiedPages = await pdfDoc.copyPages(currentPdf, currentPdf.getPageIndices()); 
            copiedPages.forEach((page) => pdfDoc.addPage(page)); 
        }
        
        const mergedPdfBytes = await pdfDoc.save(); 
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' }); 
        const url = URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.href = url; 
        
        const docIdElem = document.getElementById('docs_acolhimento_id');
        const docId = docIdElem ? docIdElem.value : null; 
        let fileName = "Documentos_Acolhimento.pdf";
        
        if(docId) { 
            const docSnap = await getDB().collection("atendimentos").doc(docId).get(); 
            if(docSnap.exists) { 
                const d = docSnap.data(); 
                let n = (d.nome || 'NAO_INFORMADO').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); 
                let p = d.protocolo || 'SEM_PROTO'; 
                fileName = `${p}_${n}.pdf`; 
            } 
        }
        
        a.download = fileName; 
        document.body.appendChild(a); 
        a.click(); 
        URL.revokeObjectURL(url); 
        a.remove(); 
        btn.innerText = oldTxt; 
        btn.disabled = false; 
        alert("PDFs mesclados e baixados com sucesso!"); 
        fileInput.value = "";
    } catch (err) { 
        console.error(err); 
        alert("Erro ao mesclar arquivos."); 
        if(event.target) {
            event.target.innerText = "Mesclar e Baixar PDF"; 
            event.target.disabled = false; 
        }
    }
};

window.imprimirHTMLMovel = function(htmlContent) {
    let iframe = document.getElementById('iframe-impressao-universal');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'iframe-impressao-universal';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
    }
    
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(htmlContent);
    iframe.contentWindow.document.close();
    
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, 800); 
}

window.abrirModalLiberacao = function(id) { 
    window.idLiberacaoAtual = id; 
    safeDisplay('modal-liberacao', 'flex', '10005'); 
}

window.fecharModalLiberacao = function() { 
    safeDisplay('modal-liberacao', 'none'); 
}

window.gerarFormularioLiberacao = function(tipoImpressao) {
    if(!window.idLiberacaoAtual) return;
    
    getDB().collection("atendimentos").doc(window.idLiberacaoAtual).get().then(docRef => {
        if(docRef.exists){
            const d = docRef.data(); 
            const dF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : ''; 
            const ag = new Date(); 
            const hA = String(ag.getHours()).padStart(2,'0')+':'+String(ag.getMinutes()).padStart(2,'0'); 
            
            const at = (window.usuarioLogado && window.usuarioLogado.nome ? window.usuarioLogado.nome : (d.agencia_atendente || '')).toUpperCase(); 
            const tp = tipoImpressao === 'municipal' ? 'SEPULTAMENTO' : 'CREMAÇÃO';
            let se = ''; 
            
            if (tipoImpressao === 'municipal') { 
                let partesSepul = []; 
                if (d.tipo_sepultura) partesSepul.push(d.tipo_sepultura); 
                if (d.tipo_sepultura && d.tipo_sepultura.toUpperCase().includes('PERPETU')) { 
                    partesSepul.push(`(L: ${d.livro_perpetua || '-'} / F: ${d.folha_perpetua || '-'})`); 
                } 
                if (d.sepul) partesSepul.push(`Nº ${d.sepul}`); 
                if (d.qd) partesSepul.push(`QD/RUA: ${d.qd}`); 
                se = partesSepul.join(' ').toUpperCase(); 
            }
            
            const si = d.assinatura_atendente ? `<img src="${d.assinatura_atendente}" style="max-height:50px;margin-bottom:5px;">` : `<div style="height:50px;"></div>`;
            const cssPrint = `<style>@page{size:A4 portrait;margin:15mm;}body{font-family:Arial,sans-serif;margin:0;padding:0;color:#000;font-size:13px;}table{border-collapse:collapse;width:100%;}td{border:2px solid #000;}.bg-gray{background-color:#ebebeb;font-weight:bold;text-align:center;text-transform:uppercase;}.label-cell{padding:8px 10px;font-weight:normal;}.value-cell{padding:8px 10px;}</style>`;
            
            const html = `<html><head><title>Liberação</title>${cssPrint}</head><body><table style="border:2px solid #000;"><tr><td style="width:35%;border-bottom:2px solid #000;text-align:center;padding:15px;"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height:80px;"></td><td style="width:65%;border-bottom:2px solid #000;text-align:center;font-weight:bold;line-height:1.8;font-size:14px;padding:15px;">SECRETARIA DE MOBILIDADE E INFRAESTRUTURA - SEMOBI<br><br>SUBSECRETARIA DE INFRAESTRUTURA - SSINFRA<br><br>COORDENADORIA MUNICIPAL DE SERVIÇOS FUNERÁRIOS<br><br>AGÊNCIA FUNERÁRIA MUNICIPAL</td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;text-align:center;font-weight:bold;padding:8px;">CERTIFICO e dou fé que, nesta data, estamos finalizando o Processo Administrativo</td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:10%;border:none;border-right:2px solid #000;padding:10px;text-align:center;">Nº</td><td style="width:35%;border:none;border-right:2px solid #000;padding:10px;" class="bg-gray">${d.agencia_processo||''}</td><td style="width:20%;border:none;border-right:2px solid #000;padding:10px;text-align:center;">, processo de</td><td style="width:35%;border:none;padding:10px;" class="bg-gray">${tp}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:15%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Falecido:</td><td style="width:85%;border:none;padding:10px;" class="bg-gray">${(d.nome||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:15%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Data:</td><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="bg-gray">${dF}</td><td style="width:55%;border:none;"></td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:35%;border:none;border-right:2px solid #000;padding:10px;text-align:center;" class="label-cell">Sepultamento/Crematório no Cemitério<br>Municipal/Privado:</td><td style="width:65%;border:none;padding:10px;vertical-align:middle;" class="bg-gray">${(d.local||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:15%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Horário:</td><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="bg-gray">${d.hora||''}</td><td style="width:25%;border:none;border-right:2px solid #000;padding:10px;text-align:center;" class="label-cell">Horário da Liberação:</td><td style="width:30%;border:none;padding:10px;" class="bg-gray">${hA}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Saindo o féretro da Capela:</td><td style="width:70%;border:none;padding:10px;" class="bg-gray">${(d.cap||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Para a Sepultura:</td><td style="width:70%;border:none;padding:10px;" class="bg-gray">${se}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="padding:0;"><table><tr><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Funerária:</td><td style="width:70%;border:none;padding:10px;" class="bg-gray">${(d.funeraria||'').toUpperCase()}</td></tr></table></td></tr></table><div style="text-align:center;margin-top:40px;">${si}<div style="border-top:1px dashed #000;width:350px;margin:0 auto;margin-bottom:5px;"></div><span style="font-weight:bold;font-size:13px;">Assinatura do Responsável</span><br><span style="font-size:13px;">${at}</span><br><br><span style="font-weight:bold;font-size:13px;">Matrícula</span><br><span style="font-size:13px;">_________________</span></div></body></html>`;
            
            window.registrarHistorico(window.idLiberacaoAtual, 'LIBERACAO', `Documento de Liberação gerado (${tipoImpressao === 'municipal' ? 'Sepultamento' : 'Cremação'})`);
            window.imprimirHTMLMovel(html);
            window.fecharModalLiberacao(); 

        } else {
            alert("Atendimento não encontrado.");
        }
    }).catch(err => {
        console.error("Erro ao gerar liberação:", err);
        alert("Erro ao conectar com o banco de dados.");
    });
}

window.gerarReciboFuneraria = function() {
    if(!window.dadosAtendimentoAtual) return;
    
    window.registrarHistorico(window.dadosAtendimentoAtual.id, 'DOCUMENTO', 'Recibo de Funerária gerado');
    
    const d = window.dadosAtendimentoAtual; 
    const f = (s) => s ? s.split('-').reverse().join('/') : ''; 
    const p = d.protocolo || "S/ PROTOCOLO"; 
    
    let tS = (d.tipo_sepultura||"").toUpperCase(); 
    const co = d.classificacao_obito || "ADULTO"; 
    let c = co === "ANJO" ? "ANJO" : "ADULTO"; 
    
    if(tS.includes("PERPETU")) { 
        tS = `${tS} (L: ${d.livro_perpetua||'-'} / F: ${d.folha_perpetua||'-'}) - ${c}`; 
    } else if(tS.includes("MEMBRO")) { 
        tS = `MEMBRO AMPUTADO (${d.tipo_membro||d.tipo_membro_select||'N/I'})`; 
    } else { 
        tS = `${tS} - ${c}`; 
    }

    let nA = (window.usuarioLogado && window.usuarioLogado.nome ? window.usuarioLogado.nome : (d.atendente_sistema || 'N/A')).toUpperCase();
    let bA = d.assinatura_atendente ? `<div style="text-align:center;height:45px;"><img src="${d.assinatura_atendente}" style="max-height:40px;max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    
    let tanatoStr = (d.tanato === 'SIM' || d.chk_tanato === 'SIM') ? 'SIM' : 'NÃO'; 

    const html = `<html><head><title>Recibo Funerária</title>
    <style>
        @page{size:A4 portrait;margin:15mm;}
        body{font-family:Arial,sans-serif;font-size:14px;margin:0;padding:10px;line-height:1.5;color:#000;}
        .header{text-align:center;margin-bottom:20px; border-bottom: 2px solid #000; padding-bottom: 10px;}
        .header img{max-height:60px;margin-bottom:5px;}
        .header h2{font-size:18px;margin:0;font-weight:bold;text-transform:uppercase;}
        .content { border: 1px solid #000; padding: 15px; border-radius: 8px; }
        .line{margin-bottom:8px;}
        .bold{font-weight:bold;}
        .assinaturas-wrapper { display: flex; justify-content: space-between; margin-top: 50px; gap: 30px; }
        .ass-box { flex: 1; text-align: center; }
    </style>
    </head><body>
        <div class="header">
            <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png">
            <h2>RECIBO DE ACOLHIMENTO - FUNERÁRIA</h2>
            <p style="margin:5px 0 0 0; font-size:12px;">Protocolo: <b>${p}</b></p>
        </div>
        <div class="content">
            <div class="line"><span class="bold">FALECIDO(A):</span> ${(d.nome||'NÃO INFORMADO').toUpperCase()}</div>
            <div class="line"><span class="bold">DATA DO ÓBITO:</span> ${f(d.data_obito)} às ${d.hora_obito || '--:--'}</div>
            <div class="line"><span class="bold">FUNERÁRIA RESPONSÁVEL:</span> ${(d.funeraria||'NÃO INFORMADA').toUpperCase()}</div>
            <div class="line"><span class="bold">TANATOPRAXIA:</span> ${tanatoStr}</div>
            <hr style="border-top:1px dashed #ccc; margin: 15px 0;">
            <div class="line"><span class="bold">CEMITÉRIO DE DESTINO:</span> ${(d.local||'CEMITÉRIO DO MARUÍ').toUpperCase()}</div>
            <div class="line"><span class="bold">TIPO DE SEPULTURA:</span> ${tS}</div>
            <div class="line"><span class="bold">Nº SEPULTURA:</span> ${d.sepul||'N/I'} <span class="bold" style="margin-left:20px;">QUADRA/RUA:</span> ${d.qd||'N/I'}</div>
            <div class="line"><span class="bold">CAPELA:</span> ${(d.cap||'N/I').toUpperCase()}</div>
            <div class="line"><span class="bold">DATA DO SEPULTAMENTO:</span> ${f(d.data_ficha)} <span class="bold" style="margin-left:20px;">HORÁRIO:</span> ${d.hora||'--:--'}</div>
        </div>
        <p style="text-align:justify; font-size:12px; margin-top:20px;">Declaramos para os devidos fins que o atendimento e acolhimento familiar referente ao falecido acima qualificado foram realizados por este setor, estando os trâmites iniciais registrados no sistema sob o protocolo informado.</p>
        <div class="assinaturas-wrapper">
            <div class="ass-box">
                ${bA}
                <div style="border-top:1px solid #000; padding-top: 5px;">
                    Acolhimento / Atendente<br><b>${nA}</b>
                </div>
            </div>
            <div class="ass-box">
                <div style="height:45px;"></div>
                <div style="border-top:1px solid #000; padding-top: 5px;">
                    Responsável pela Funerária<br><b>${d.func_funeraria ? d.func_funeraria.toUpperCase() : '_________________________'}</b>
                </div>
            </div>
        </div>
    </body></html>`;

    window.imprimirHTMLMovel(html);
}

window.gerarAutorizacao = function(){
    if(!window.dadosAtendimentoAtual) return;
    
    window.registrarHistorico(window.dadosAtendimentoAtual.id, 'DOCUMENTO', 'Autorização para Funeral gerada');
    
    const d = window.dadosAtendimentoAtual; 
    const formatarData = (s) => s ? s.split('-').reverse().join('/') : '';
    
    let tipoSepul = (d.tipo_sepultura || "").toUpperCase(); 
    const classO = d.classificacao_obito || "ADULTO"; 
    let textClasse = classO === "ANJO" ? "ANJO" : "ADULTO"; 
    let condicao = "ALUGUEL (3 ANOS)";
    
    if(tipoSepul.includes("PERPETU")){ 
        tipoSepul += " - " + textClasse; 
        condicao = `PERPÉTUA (L: ${d.livro_perpetua||'-'} / F: ${d.folha_perpetua||'-'})`; 
    } else if(tipoSepul.includes("MEMBRO")){ 
        tipoSepul = `MEMBRO AMPUTADO`; 
        condicao = "N/A"; 
    } else { 
        tipoSepul += " - " + textClasse; 
    }
    
    const ho = new Date(); 
    const mesExtenso = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][ho.getMonth()]; 
    const dExtenso = `${String(ho.getDate()).padStart(2,'0')} de ${mesExtenso} de ${ho.getFullYear()}`;
    
    const checkForm = (val, checkType) => { 
        val = (val || '').toUpperCase(); 
        if(checkType === 'ALUGUEL') return (!val.includes('PERPETU') && d.perpetua !== 'X') ? '(X)' : '( )'; 
        if(checkType === 'PERPETU') return (val.includes('PERPETU') || d.perpetua === 'X') ? '(X)' : '( )'; 
        if(checkType === 'CRA') return (val === 'COVA RASA' || val === 'COVA RASA PERPETUA') ? '(X)' : '( )'; 
        if(checkType === 'CRJ') return (val === 'COVA RASA ANJO' || val === 'COVA_RASA_ANJO' || val === 'COVA RASA ANJO PERPETUA') ? '(X)' : '( )'; 
        if(checkType === 'GA') return (val === 'GAVETA' || val === 'GAVETA PERPETUA') ? '(X)' : '( )'; 
        if(checkType === 'GJ') return (val === 'GAVETA ANJO' || val === 'GAVETA_ANJO' || val === 'GAVETA ANJO PERPETUA') ? '(X)' : '( )'; 
        if(checkType === 'CA') return (val === 'CARNEIRO' || val === 'CARNEIRO PERPETUO') ? '(X)' : '( )'; 
        if(checkType === 'CJ') return (val === 'CARNEIRO ANJO' || val === 'CARNEIRO_ANJO' || val === 'CARNEIRO ANJO PERPETUO') ? '(X)' : '( )'; 
        return '( )'; 
    };
    
    const sigResp = d.assinatura_responsavel ? `<img src="${d.assinatura_responsavel}" style="max-height:40px;">` : '';
    
    const html = `<html><head><title>Autorização para Funeral</title><style>@page{size:A4 portrait;margin:10mm;}body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:10px;line-height:1.5;}.bold{font-weight:bold;text-transform:uppercase;}.ass{margin-top:30px;text-align:center;width:60%;margin-left:auto;margin-right:auto;}h3{text-decoration:underline;text-align:center;margin-bottom:10px;margin-top:10px;font-size:14px;}.section-title{font-weight:bold;text-decoration:underline;margin-top:20px;display:block;font-size:12px;}p{margin:5px 0;text-align:justify;}.ul-texto{border-bottom:1px solid #000;display:inline-block;min-width:40px;text-align:center;font-weight:bold;text-transform:uppercase;}.checkboxes{margin:10px 0;font-size:11px;}.checkboxes span{margin-right:5px;}.obs{font-size:11px;margin-top:10px;text-align:justify;display:flex;gap:10px;line-height:1.3;}.logo-container{text-align:center;margin-bottom:10px;}</style></head><body><div class="logo-container"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height:60px;"></div><h3>AUTORIZAÇÃO PARA FUNERAL</h3><p>Eu, <span class="ul-texto" style="width:45%;">${d.resp_nome||''}</span> CPF nº <span class="ul-texto" style="width:20%;">${d.resp_cpf||''}</span><br>RG: <span class="ul-texto" style="width:20%;">${d.resp_rg||''}</span> residente <span class="ul-texto" style="width:35%;">${d.resp_endereco||''}</span> nº <span class="ul-texto" style="width:5%;">${d.resp_numero||''}</span> bairro <span class="ul-texto" style="width:15%;">${d.resp_bairro||''}</span><br><span class="ul-texto" style="width:20%;">${d.resp_cidade||''}</span> Município <span class="ul-texto" style="width:10%;">${d.resp_uf||''}</span> Estado CEP: <span class="ul-texto" style="width:15%;">${d.resp_cep||''}</span> grau de parentesco <span class="ul-texto" style="width:20%;">${d.parentesco||''}</span></p><p><b>AUTORIZO a FUNERÁRIA</b> <span class="ul-texto" style="width:40%;">${d.funeraria||''}</span>, a tratar junto à Agência Funerária dos Cemitérios Municipais de Niterói do Sepultamento do Sr(a) <span class="ul-texto" style="width:50%;">${d.nome||''}</span> falecido no dia <span class="ul-texto" style="width:15%;">${formatarData(d.data_obito)||''}</span>,<br>tendo como local de óbito <span class="ul-texto" style="width:30%;">${d.hospital||''}</span>, sendo o sepultamento no Cemitério <span class="ul-texto" style="width:20%;">${(d.local||'').replace('CEMITÉRIO DO ','').replace('CEMITÉRIO DE ','')}</span> Tipo de Sepultura ${checkForm(d.tipo_sepultura,'CRA')} Cova Rasa Adulto</p><div class="checkboxes"><span>${checkForm(d.tipo_sepultura,'CRJ')} Cova Rasa Anjo</span> <span>${checkForm(d.tipo_sepultura,'GA')} GAVETA ADULTO</span> <span>${checkForm(d.tipo_sepultura,'GJ')} GAVETA ANJO</span> <span>${checkForm(d.tipo_sepultura,'CA')} CARNEIRA ADULTO</span> <span>${checkForm(d.tipo_sepultura,'CJ')} CARNEIRA ANJO</span> <span>Nº Sepultura <span class="ul-texto" style="width:8%;">${d.sepul||''}</span></span> <span>Qd. <span class="ul-texto" style="width:8%;">${d.qd||''}</span></span> <span>Rua <span class="ul-texto" style="width:8%;"></span></span></div><p>Aluguel ${checkForm(d.tipo_sepultura,'ALUGUEL')} Perpétuo ${checkForm(d.tipo_sepultura,'PERPETU')} Livro nº <span class="ul-texto" style="width:10%;">${d.livro_perpetua||''}</span> Folha nº <span class="ul-texto" style="width:10%;">${d.folha_perpetua||''}</span> <b>Autorização de 24 Horas para sepultamento, SIM ${d.do_24h==='SIM'?'(X)':'( )'} NÃO ${d.do_24h!=='SIM'?'(X)':'( )'}</b></p><p>Telefones para Contato 1º <span class="ul-texto" style="width:20%;">${d.telefone||''}</span> 2º <span class="ul-texto" style="width:20%;">${d.telefone2||''}</span></p><p><b>DATA E HORÁRIO DO SEPULTAMENTO: <span class="ul-texto" style="width:15%;">${formatarData(d.data_ficha)||''}</span> ÁS <span class="ul-texto" style="width:10%;">${d.hora||''}</span> HORAS</b></p><p><b>*ESTOU CIENTE E ACEITO A SEPULTURA DISPONÍVEL.</b></p><p style="text-align:right;">Niterói, <span class="ul-texto" style="width:30%;border:none;">${dExtenso}</span></p><div class="ass">${sigResp}<div style="border-top:1px solid #000;padding-top:3px;">Assinatura do(a) autorizador (a)</div></div><span class="section-title">AUTORIZAÇÃO PARA PAGAMENTO DAS TAXAS</span><p>Autorizo a Funerária <span class="ul-texto" style="width:30%;"></span> a entregar toda e qualquer documentação exigida, bem como a efetuar o pagamento das taxas inerentes ao funeral (capela, entrada de corpo, sepultamento e afins), agendamento e liberação de corpo na agência para o Cemitério de destino.</p><div class="ass">${sigResp}<div style="border-top:1px solid #000;padding-top:3px;">Assinatura do(a) autorizador (a)</div></div><span class="section-title">NÃO AUTORIZAÇÃO PARA PAGAMENTO DAS TAXAS</span><p><b>NÃO</b> autorizo a Funerária <span class="ul-texto" style="width:30%;"></span> a efetuar o pagamento das taxas inerentes ao funeral (capela, entrada de corpo, sepultamento e afins), sendo de minha inteira responsabilidade efetuar o pagamento das taxas bem como entregar a documentação exigida para liberação do corpo na agência para o Cemitério de destino. Importante frisar que toda a documentação posterior ao pagamento, a família deverá entregar a Funerária para que seja autorizado junto ao Cemitério a entrada do corpo na capela do Cemitério escolhido.</p><p>Sendo de responsabilidade da Funerária <span class="ul-texto" style="width:30%;"></span> tão somente a entrega dos documentos obrigatórios da empresa contratada bem como realizar o agendamento do sepultamento.</p><div class="ass">${sigResp}<div style="border-top:1px solid #000;padding-top:3px;">Assinatura do(a) autorizador (a)</div></div><div class="obs"><span style="font-size:18px;">→</span><div><b>OBS.:</b> Importante frisar que a Funerária ou a Família terá o prazo de no <b>MÁXIMO 01 (uma) horas</b> antes do sepultamento para pagar as taxas. Caso não seja cumprido no horário o pagamento o sepultamento será <b>SUSPENSO</b>.</div></div><div class="obs"><span style="font-size:18px;">→</span><div><b>OBS.:</b> Em se tratando do Cemitério de Itaipu e São Francisco, o pagamento das taxas deverão ser pagas no ato da liberação do corpo na Agência, tendo em vista se tratar de Cemitérios longe da Agência recebedora. Caso não seja realizado o pagamento, os Cemitérios não autorizarão a entrada do corpo.</div></div></body></html>`;
    
    window.imprimirHTMLMovel(html);
}

window.gerarComprovante = function() {
    if(!window.dadosAtendimentoAtual) return;
    
    window.registrarHistorico(window.dadosAtendimentoAtual.id, 'DOCUMENTO', 'Comprovante de Atendimento gerado');
    
    const d = window.dadosAtendimentoAtual; 
    const ck = (c) => c ? '(X)' : '( )'; 
    const f = (s) => s ? s.split('-').reverse().join('/') : ''; 
    const p = d.protocolo || ""; 
    
    let dhT = ""; 
    if(d.data_hora_atendimento){ 
        const ps = d.data_hora_atendimento.split('T'); 
        if(ps.length === 2) {
            dhT = `${ps[0].split('-').reverse().join('/')} AS ${ps[1]}`; 
        }
    } else { 
        const n = new Date(); 
        dhT = `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()} AS ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; 
    }
    
    const im = (d.local && d.local.includes("MARUÍ")); 
    const is = (d.local && d.local.includes("SÃO FRANCISCO")); 
    const ii = (d.local && d.local.includes("ITAIPU")); 
    const cc = (d.cap && !d.cap.toUpperCase().includes("SEM"));
    
    let tD = ""; 
    if(d.data_obito && d.hora_obito && d.hora && d.data_ficha){ 
        const df = new Date(d.data_ficha+'T'+d.hora) - new Date(d.data_obito+'T'+d.hora_obito); 
        if(df > 0) {
            tD = `${Math.floor(df/3600000)}h ${Math.round(((df%3600000)/60000))}min`; 
        }
    }
    
    const cE = (v) => (d.estado_civil||"") === v ? '(X)' : '( )'; 
    const rl = d.parentesco ? `(${d.parentesco})` : '';
    
    let tS = (d.tipo_sepultura||"").toUpperCase(); 
    const co = d.classificacao_obito || "ADULTO"; 
    let tH = d.hora_obito || ""; 
    
    if(d.ignorar_hora_obito === 'SIM' || d.chk_ignorar_hora === 'SIM') {
        tH += " (IGNORADO)";
    }
    
    let c = co === "ANJO" ? "ANJO" : "ADULTO"; 
    
    if(tS.includes("PERPETU")) { 
        tS = `${tS} (L: ${d.livro_perpetua||'-'} / F: ${d.folha_perpetua||'-'}) - ${c}`; 
    } else if(tS.includes("MEMBRO")) { 
        tS = `MEMBRO AMPUTADO (${d.tipo_membro||d.tipo_membro_select||'N/I'})`; 
    } else { 
        tS = `${tS} - ${c}`; 
    }
    
    let dEx = ""; 
    if(d.data_ficha){ 
        const ps = d.data_ficha.split('-'); 
        // REGRA 1: 2 anos para Anjos
        const addAnos = (c === 'ANJO') ? 2 : 3;
        dEx = `${ps[2]}/${ps[1]}/${parseInt(ps[0]) + addAnos}`; 
    }
    
    let bF = d.assinatura_responsavel ? `<div style="text-align:center;height:45px;"><img src="${d.assinatura_responsavel}" style="max-height:40px;max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    let bA = d.assinatura_atendente ? `<div style="text-align:center;height:45px;"><img src="${d.assinatura_atendente}" style="max-height:40px;max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    
    let nA = (window.usuarioLogado && window.usuarioLogado.nome ? window.usuarioLogado.nome : (d.atendente_sistema || 'N/A')).toUpperCase();
    let isTanato = (d.tanato === 'SIM' || d.chk_tanato === 'SIM');

    const htmlComprovante = `<html><head><title>Comprovante</title><style>@page{size:A4 portrait;margin:8mm;}body{font-family:Arial,sans-serif;font-size:14px;margin:0;padding:10px;line-height:1.3;color:#000;}.header{text-align:center;margin-bottom:25px;position:relative;}.header h2{font-size:20px;text-decoration:underline;margin:0;font-weight:bold;text-transform:uppercase;color:#000;}.protocolo{position:absolute;top:-5px;right:0;font-size:14px;font-weight:bold;border:2px solid #000;padding:5px 10px;}.line{margin-bottom:4px;white-space:normal;word-wrap:break-word;overflow:visible;}.bold{font-weight:900;}.red{color:red;font-weight:bold;}.section-title{font-weight:900;margin-top:15px;margin-bottom:2px;text-transform:uppercase;font-size:14px;}.two-columns{display:flex;justify-content:space-between;margin-top:10px;}.col-left{width:60%;}.col-right{width:38%;}.assinaturas-block{display:flex;justify-content:space-between;margin-top:25px;margin-bottom:10px;gap:20px;}.ass-line{text-align:center;padding-top:2px;flex:1;font-size:12px;}.box-lateral{border:2px solid #000;padding:5px;font-weight:900;font-size:12px;height:100%;display:flex;flex-direction:column;justify-content:space-between;}.termo-juridico{text-align:justify;font-size:12px;line-height:1.3;}.footer-line{margin-top:10px;border-top:1px solid #000;padding-top:5px;font-weight:900;font-size:12px;}.aviso-final{border:2px solid #000;padding:5px;margin-top:10px;font-weight:900;text-align:justify;font-size:12px;line-height:1.3;}.spacer{margin-left:10px;}</style></head><body><div class="header"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height:60px;margin-bottom:5px;"><h2>Comprovante de Atendimento</h2><div class="protocolo">PROTOCOLO: ${p}</div></div><div class="content"><div class="line"><span class="bold">Nome do FALECIDO:</span> ${(d.nome||'').toUpperCase()}</div><div class="line"><span class="bold">Nome do RESPONSÁVEL:</span> ${(d.resp_nome||'').toUpperCase()} <span style="margin-left:5px;font-weight:normal;">${rl}</span></div><div class="line"><span class="bold">Funerária:</span> ${(d.funeraria||'').toUpperCase()} <span style="margin-left:15px">(Rep: ${d.func_funeraria||'N/A'})</span></div><div class="line"><span class="bold">Atendente Responsável:</span> ${nA}<span class="bold" style="margin-left:20px">DATA DE HORARIO DE ATENDIMENTO:</span> ${dhT}</div><div class="line"><span class="bold">Data:</span> ${f(d.data_ficha)} <span class="bold spacer">Hora:</span> ${d.hora||''} <span class="bold spacer">SEPULTURA:</span> ${d.sepul||''} <span class="bold spacer">${im?"QUADRA:":"RUA:"}</span> ${d.qd||''} <span class="bold spacer">CAPELA:</span> ${d.cap||''}</div><div class="line"><span class="bold">COM CAPELA</span> ${ck(cc)} <span class="bold">SEM CAPELA</span> ${ck(!cc)} <span class="bold spacer">DATA DO FALECIMENTO:</span> ${f(d.data_obito)} AS ${tH} <span class="red spacer">[${tD}]</span></div><div class="line"><span class="bold">Cemitério:</span> (${im?'X':' '}) MARUÍ (${is?'X':' '}) SÃO FRANCISCO XAVIER (${ii?'X':' '}) SÃO LÁZARO DE ITAIPÚ</div><div class="line">${cE('SOLTEIRO')} SOLTEIRO ${cE('CASADO')} CASADO ${cE('VIUVO')} VÍUVO ${cE('UNIAO_ESTAVEL')} UNIÃO ESTÁVEL ${cE('DIVORCIADO')} DIVORCIADO ${cE('IGNORADO')} IGNORADO</div><div class="section-title">ASSINAR TERMO DE COMPROMISSO NO CEMITÉRIO</div><div class="line" style="margin-top:5px;font-size:14px;border:1px solid #000;padding:5px;"><span class="bold">TIPO DE SEPULTURA SELECIONADA:</span> ${tS}</div><div class="line" style="margin-top:10px"><span class="bold">TANATO:</span> (${isTanato?'X':' '}) SIM (${!isTanato?'X':' '}) NÃO</div><div class="assinaturas-block"><div class="ass-line">${bA}<div style="border-top:1px solid #000;">Acolhimento / Atendente:<br><b>${nA}</b></div></div><div class="ass-line">${bF}<div style="border-top:1px solid #000;">Assinatura do responsável/família<br><b>${(d.resp_nome||'').toUpperCase()}</b></div></div></div><div style="font-weight:bold;font-size:12px;margin-top:5px;">OBS: PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.</div><div style="font-weight:bold;font-size:12px;margin-top:5px;">OBS.: VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.</div><div class="line" style="margin-top:15px;border:2px solid #000;padding:5px;"><span class="bold">PREVISÃO DE EXUMAÇÃO:</span> A partir de <span class="red" style="font-size:16px;">${dEx}</span><br><span style="font-size:10px;">(Legislação: 3 anos para Adultos / 2 anos para Crianças abaixo de 12 anos)</span><div style="margin-top:12px;margin-bottom:8px;border:2px dashed #000;padding:8px;text-align:center;font-weight:900;font-size:13px;">⚠️ ATENÇÃO: COMPAREÇA OU ENTRE EM CONTATO NO PRAZO MÍNIMO DE 90 DIAS ANTES DA DATA DE EXUMAÇÃO PARA ABERTURA DE PROCESSO.</div><div style="margin-top:15px;text-align:center;">${bF}<div style="border-top:1px solid #000;width:60%;margin:0 auto;">Assinatura do Responsável (Ciência do Prazo)</div></div><div class="two-columns"><div class="col-left"><div style="text-align:center;font-weight:bold;text-decoration:underline;margin-bottom:5px;">TERMO DE COMPROMISSO CEMITÉRIOS MUNICIPAIS</div><div class="termo-juridico">Sendo o <span class="bold">FALECIDO CASADO</span>, o responsável perante, o Cemitério do MARUÍ, SÃO FRANCISCO E ITAIPU será obrigatoriamente o <span class="bold">CONJUGE</span>.<br>Sendo o <span class="bold">FALECIDO VIÚVO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU serão obrigatoriamente os <span class="bold">FILHOS</span>.<br>Sendo o <span class="bold">FALECIDO SOLTEIRO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU obrigatoriamente os <span class="bold">FILHOS, PAIS, IRMÃOS</span>.<br>Será exigida a apresentação de documentos de <span class="bold" style="text-decoration:underline">IDENTIDADE e CPF</span>.</div><div class="assinaturas-block" style="margin-top:40px;"><div style="flex:1;"></div><div class="ass-line">${bF}<div style="border-top:1px solid #000;">Assinatura funcionário/família</div></div></div></div><div class="col-right"><div class="box-lateral"><div>CAPELAS MUNICIPAIS E PARTICULARES:</div><br><div>PAGAMENTO E NOTA FISCAL DAS TAXAS MUNICIPAIS E INVOL COM DUAS HORAS ANTES DO SEPULTAMENTO</div><br><br><div>CLIENTE: _____________________</div></div></div></div><div class="footer-line">MARCADO: ________________________ PERMISSIONÁRIO: ${(d.resp_nome||'').toUpperCase()}</div><div style="font-weight:bold;font-size:12px;margin-top:5px;">TEL: ${d.telefone||''} ${d.telefone2 ? ' / ' + d.telefone2 : ''}</div><div class="aviso-final"><span style="text-decoration:underline">COMUNICADO AOS FAMILIARES DO FALECIDO E AS EMPRESAS FUNERÁRIAS RESPONSÁVEIS PELO SEPULTAMENTO.</span><br>Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos:<span class="bold">GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL PELO SERVIÇO), TAXAS MUNICIPAIS PAGAS e INVOL.</span></div></div></body></html>`;
    
    window.imprimirHTMLMovel(htmlComprovante);
}

window.gerarEtiqueta = function() {
    if(!window.dadosAtendimentoAtual) return;
    
    window.registrarHistorico(window.dadosAtendimentoAtual.id, 'DOCUMENTO', 'Etiqueta de Identificação gerada');
    
    const d = window.dadosAtendimentoAtual; 
    const fd = (s) => s ? s.split('-').reverse().join('/') : ''; 
    const dF = fd(d.data_ficha);
    
    const html = `<html><head><title>Etiqueta</title><style>@page{size:landscape;margin:0}body{font-family:Arial,sans-serif;margin:0;padding:0;height:100vh;width:100vw;display:flex;justify-content:center;align-items:center;overflow:hidden}.box{width:95vw;height:90vh;border:5px solid #000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center;padding:10px}.header-img{max-height:100px;margin-bottom:10px}.title{font-size:24px;font-weight:900;text-transform:uppercase;border-bottom:3px solid #000;padding-bottom:5px;display:inline-block;margin-bottom:30px}.group{margin-bottom:30px;width:100%}.label{font-size:18px;color:#333;font-weight:bold;text-transform:uppercase;margin-bottom:5px}.val-nome{font-size:55px;font-weight:900;text-transform:uppercase;line-height:1.1}.val-data{font-size:40px;font-weight:800}.val-local{font-size:35px;font-weight:800;text-transform:uppercase}</style></head><body><div class="box"><div><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="header-img"><br><div class="title">IDENTIFICAÇÃO DE VELÓRIO</div></div><div class="group"><div class="label">FALECIDO(A)</div><div class="val-nome">${d.nome}</div></div><div class="group"><div class="label">SEPULTAMENTO</div><div class="val-data">${dF} às ${d.hora}</div></div><div class="group"><div class="label">LOCAL</div><div class="val-local">${d.cap}<br>${d.local||"CEMITÉRIO DO MARUÍ"}</div></div></div></body></html>`;
    
    window.imprimirHTMLMovel(html);
}

window.visualizar = function(id) {
    if(!window.getDB()) return;
    
    window.getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); 
            d.id = doc.id; 
            window.dadosAtendimentoAtual = d;
            
            let isenStr = (d.isencao === '50') ? "50% DESCONTO" : (d.isencao === 'SIM' ? "100% GRATUIDADE" : "NÃO (PAGO)"); 
            if (d.requisito) isenStr += ` - ${d.requisito}`;
            
            let servs = []; 
            if (d.tanato === 'SIM' || d.chk_tanato === 'SIM') servs.push('TANATOPRAXIA'); 
            if (d.invol === 'SIM' || d.chk_invol === 'SIM') servs.push('INVOL'); 
            if (d.translado === 'SIM' || d.chk_translado === 'SIM') servs.push('TRANSLADO'); 
            if (d.urna_opc === 'SIM' || d.chk_urna_opc === 'SIM') servs.push('URNA OPCIONAL');

            let telefoneDisplay = d.telefone || '-';
            if (d.telefone2 && d.telefone2.trim() !== '') {
                telefoneDisplay += ` / ${d.telefone2}`;
            }

            const mapCampos = { 
                'view_protocolo': d.protocolo || 'S/ PROTOCOLO', 
                'view_hora': d.hora || '--:--', 
                'view_nome': (d.nome || 'NÃO INFORMADO').toUpperCase(), 
                'view_causa': (d.causa || 'NÃO INFORMADA').toUpperCase(), 
                'view_resp_completo': (d.resp_nome || 'N/I').toUpperCase() + (d.parentesco ? ` (${d.parentesco})` : ''), 
                'view_resp_cpf': d.resp_cpf || '-', 
                'view_resp_rg': d.resp_rg || '-', 
                'view_telefone': telefoneDisplay, 
                'view_funeraria': (d.funeraria || 'N/I').toUpperCase(), 
                'view_atendente': (d.atendente_sistema || 'N/I').toUpperCase(), 
                'view_combo_urna': d.combo_urna || '-', 
                'view_hospital_completo': (d.hospital || 'N/I').toUpperCase(), 
                'view_cap': (d.cap || 'N/I').toUpperCase(), 
                'view_urna_info': d.urna_info || 'Sem observações adicionais.', 
                'view_isencao_completa': isenStr, 
                'view_servicos_adicionais': servs.length > 0 ? servs.join(', ') : 'NENHUM', 
                'view_data_sepultamento': d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '--/--/----', 
                'view_tipo_urna_detalhe': (d.tipo_urna_detalhe || '').toUpperCase() 
            };
            
            for(let k in mapCampos) { 
                const el = document.getElementById(k); 
                if(el) el.innerText = mapCampos[k] || '-'; 
            }
            
            const elSepul = document.getElementById('view_local_sepul'); 
            if(elSepul) elSepul.innerText = `Tipo: ${d.tipo_sepultura || ''} | Nº: ${d.sepul||''} | QD: ${d.qd||''}`;
            
            const elObito = document.getElementById('view_data_obito'); 
            if(elObito) elObito.innerText = `${d.data_obito ? d.data_obito.split('-').reverse().join('/') : ''} às ${d.hora_obito || ''}`;
            
            let dataHoraFinal = ""; 
            if (d.data_hora_atendimento) { 
                const parts = d.data_hora_atendimento.split('T'); 
                if (parts.length === 2) { 
                    const dp = parts[0].split('-'); 
                    dataHoraFinal = `${dp[2]}/${dp[1]}/${dp[0]} AS ${parts[1]}`; 
                } 
            }
            const elDataReg = document.getElementById('view_data_registro'); 
            if(elDataReg) elDataReg.innerText = dataHoraFinal;

            let docsAcolhimento = [];
            if (d.chk_doc_autorizacao) docsAcolhimento.push("Autorização p/ Sepul."); 
            if (d.chk_doc_rg_perm) docsAcolhimento.push("RG Perm."); 
            if (d.chk_doc_obito) docsAcolhimento.push("Dec. Óbito"); 
            if (d.chk_doc_rg_falecido) docsAcolhimento.push("RG Falecido"); 
            if (d.chk_doc_residencia) docsAcolhimento.push("Comp. Resid."); 
            if (d.chk_doc_guia_cartorio) docsAcolhimento.push("Guia Cartório"); 
            if (d.chk_doc_moeda) docsAcolhimento.push("Moeda Araribóia"); 
            if (d.chk_doc_bolsa) docsAcolhimento.push("Bolsa Família"); 
            if (d.chk_doc_loas) docsAcolhimento.push("LOAS/BPC"); 
            if (d.chk_doc_cadunico) docsAcolhimento.push("CadÚnico"); 
            if (d.chk_doc_cras) docsAcolhimento.push("Isenção CRAS"); 
            if (d.chk_doc_parentesco) docsAcolhimento.push("Parentesco"); 
            if (d.chk_doc_casamento) docsAcolhimento.push("Casamento"); 
            if (d.chk_doc_locacao) docsAcolhimento.push("Locação"); 
            if (d.chk_doc_procuracao) docsAcolhimento.push("Procuração");
            
            const elDocs = document.getElementById('view_docs_acolhimento');
            if(elDocs) {
                let textoDocs = docsAcolhimento.length > 0 ? docsAcolhimento.join(' • ') : 'NENHUM DOCUMENTO MARCADO';
                if(d.url_docs_acolhimento) { 
                    textoDocs += `<br><a href="${d.url_docs_acolhimento}" target="_blank" style="display:inline-block; margin-top:5px; background:#eff6ff; color:#3b82f6; padding:4px 8px; border-radius:4px; text-decoration:none;">🔗 Acessar Documentos Mesclados (Nuvem)</a>`; 
                } else { 
                    textoDocs += `<br><span style="display:inline-block; margin-top:5px; background:#fee2e2; color:#ef4444; padding:4px 8px; border-radius:4px;">⚠️ Nuvem Pendente (Acolhimento não gerou o link)</span>`; 
                }
                elDocs.innerHTML = textoDocs;
            }

            let docsAgencia = [];
            if (d.agencia_chk_invol) docsAgencia.push("INVOL"); 
            if (d.agencia_chk_nf) docsAgencia.push("Nota Fiscal"); 
            if (d.agencia_chk_tanato) docsAgencia.push("Cert. Tanato"); 
            if (d.agencia_chk_comprovante) docsAgencia.push("Comp. Pagamento"); 
            if (d.agencia_chk_guia_grm) docsAgencia.push("Guia GRM");
            
            let linksHtml = "";
            if(docsAgencia.length > 0) { 
                linksHtml += `<div style="font-size:12px; font-weight:500; color:#334155; margin-bottom:5px;">Documentos Marcados: ${docsAgencia.join(' • ')}</div>`; 
            }
            
            if (d.url_docs_agencia) { 
                linksHtml += `<a href="${d.url_docs_agencia}" target="_blank" style="display:inline-block; margin-top:5px; background:#eff6ff; color:#3b82f6; padding:4px 8px; border-radius:4px; text-decoration:none;">🔗 Acessar Documentos Mesclados (Agência)</a>`; 
            } else if (docsAgencia.length > 0) { 
                linksHtml += `<span style="display:inline-block; margin-top:5px; background:#fee2e2; color:#ef4444; padding:4px 8px; border-radius:4px;">⚠️ Nuvem Pendente (Agência não gerou o link)</span>`; 
            }
            
            const elRow = document.getElementById('linha_anexos_view'); 
            const elLinks = document.getElementById('view_anexos_links');
            if(elRow && elLinks) { 
                if(linksHtml !== "") { 
                    elLinks.innerHTML = linksHtml; 
                    elRow.style.display = "flex"; 
                } else { 
                    elRow.style.display = "none"; 
                } 
            }
            
            const mapContainer = document.getElementById('view_map_container'); 
            const mapFrame = document.getElementById('mapa-frame'); 
            const mapLink = document.getElementById('link-gps');
            
            if (mapContainer && mapFrame && mapLink) { 
                const cleanCoords = d.geo_coords ? String(d.geo_coords).replace(/[^0-9.,\-]/g, '') : ''; 
                if (cleanCoords && cleanCoords.includes(',')) { 
                    mapContainer.style.display = 'block'; 
                    mapFrame.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="http://googleusercontent.com/maps.google.com/maps?q=${cleanCoords}&z=17&output=embed"></iframe>`; 
                    mapLink.href = `http://googleusercontent.com/maps.google.com/maps?q=${cleanCoords}`; 
                } else { 
                    mapContainer.style.display = 'none'; 
                } 
            }
            
            if (typeof safeDisplay !== 'undefined') safeDisplay('modal-visualizar', 'block', '10000');
        }
    });
}

window.enviarWppFixo = function(id) {
    if (!window.numeroWppFixo) {
        alert("O número da Central de Atendimento não está configurado. Aceda ao Painel Admin > Configurações para definir o número.");
        return;
    }
    
    window.getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data();
            const fd = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '';
            
            const doencasInfecciosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HIV', 'SIDA', 'SARAMPO'];
            let isContagioso = d.causa && doencasInfecciosas.some(doenca => d.causa.toUpperCase().includes(doenca));
            let alertaContagio = isContagioso ? `\n⚠️ *ATENÇÃO: CAUSA DE MORTE INFECTOCONTAGIOSA (${d.causa.toUpperCase()})*\n` : '';

            let texto = `*NOVO AGENDAMENTO - SERVIÇOS FUNERÁRIOS*\n${alertaContagio}\n📄 *Protocolo:* ${d.protocolo || '-'}\n👤 *Falecido(a):* ${(d.nome || '-').toUpperCase()}\n⚰️ *Cemitério:* ${d.local || '-'}\n📍 *Quadra/Rua:* ${d.qd || '-'}\n🪦 *Tipo de Sepultura:* ${d.tipo_sepultura || '-'}\n🔢 *Nº Sepultura:* ${d.sepul || '-'}\n✝️ *Capela:* ${d.cap || '-'}\n📅 *Data do Sepultamento:* ${fd}\n🕒 *Horário:* ${d.hora || '-'}\n👨‍💼 *Atendente:* ${(d.atendente_sistema || '-').toUpperCase()}`;
            
            let url = `https://wa.me/${window.numeroWppFixo}?text=${encodeURIComponent(texto)}`;
            window.open(url, '_blank');
            
            window.registrarHistorico(id, 'WHATSAPP', `Notificação de agendamento enviada para a Central (${window.numeroWppFixo})`);
        }
    });
}

window.enviarWppFixoAtual = function() {
    if (!window.dadosAtendimentoAtual || !window.dadosAtendimentoAtual.id) return;
    window.enviarWppFixo(window.dadosAtendimentoAtual.id);
}

window.abrirModalWpp = function() { 
    if (!window.dadosAtendimentoAtual) return; 
    safeDisplay('modal-whatsapp', 'flex', '10005'); 
}

window.fecharModalWpp = function() { 
    safeDisplay('modal-whatsapp', 'none'); 
}

window.enviarWppTemplate = function(tipo) {
    if (!window.dadosAtendimentoAtual) return; 
    const d = window.dadosAtendimentoAtual; 
    let t = d.telefone ? d.telefone.replace(/\D/g, '') : ''; 
    let texto = ""; 
    const fd = (dataStr) => dataStr ? dataStr.split('-').reverse().join('/') : '';
    
    let enderecoStr = ""; 
    let mapaStr = "";
    if (d.local) {
        if (d.local.includes('MARUÍ')) { 
            enderecoStr = "Rua General Castrioto, 414 - Barreto, Niterói - RJ"; 
            mapaStr = "http://googleusercontent.com/maps.google.com/maps?q=Cemitério+do+Maruí"; 
        } 
        else if (d.local.includes('FRANCISCO')) { 
            enderecoStr = "Rua Tapajós, 75 - São Francisco, Niterói - RJ"; 
            mapaStr = "http://googleusercontent.com/maps.google.com/maps?q=Cemitério+de+São+Francisco+Xavier"; 
        } 
        else if (d.local.includes('ITAIPU')) { 
            enderecoStr = "Estrada Engenho do Mato, s/n - Itaipu, Niterói - RJ"; 
            mapaStr = "http://googleusercontent.com/maps.google.com/maps?q=Cemitério+de+Itaipu"; 
        }
    }
    
    if (tipo === 'gps') {
        const c = d.geo_coords ? String(d.geo_coords).replace(/[^0-9.,\-]/g, '') : ''; 
        if (!t) { alert("Sem telefone cadastrado."); return; } 
        if (!c) { alert("Sem GPS cadastrado na ficha."); return; }
        texto = `📍 *Localização Exata da Sepultura:*\n\nAbra o link abaixo para ver no mapa:\nhttp://googleusercontent.com/maps.google.com/maps?q=${c}`;
    } else if (tipo === 'info') {
        if (!t) { alert("Sem telefone cadastrado."); return; } 
        let dataExumacao = ""; 
        if (d.data_ficha) { 
            const parts = d.data_ficha.split('-'); 
            const addAnos = (d.classificacao_obito === 'ANJO') ? 2 : 3; 
            dataExumacao = `${parts[2]}/${parts[1]}/${parseInt(parts[0]) + addAnos}`; 
        }
        texto = `*PREFEITURA MUNICIPAL DE NITERÓI*\n_Serviços Funerários_\n\nOlá, seguem as informações úteis do seu atendimento:\n\n📄 *Protocolo:* ${d.protocolo || '-'}\n👤 *Falecido(a):* ${d.nome || '-'}\n⚰️ *Local:* ${d.local || '-'}\n📍 *Endereço:* ${enderecoStr || 'Não informado'}\n🗺️ *Como chegar:* ${mapaStr || '-'}\n✝️ *Capela:* ${d.cap || '-'}\n🕒 *Horário Previsto:* ${d.hora || '-'}\n📍 *Sepultura:* ${d.sepul || '-'} | *QD/Rua:* ${d.qd || '-'}\n\n⏳ *Previsão de Exumação:* A partir de ${dataExumacao}\n\n⚠️ *ATENÇÃO:* Compareça ou entre em contato no prazo mínimo de *90 dias ANTES* da data de exumação para abertura de processo.\n\nAgradecemos a compreensão.`;
    } else if (tipo === 'convite') {
        texto = `Informamos com pesar o falecimento de *${d.nome || '_______________'}*.\n\nO velório e sepultamento serão realizados conforme abaixo:\n\n📍 *Cemitério:* ${d.local || '-'}\n📍 *Endereço:* ${enderecoStr || 'Não informado'}\n🗺️ *Como chegar:* ${mapaStr || '-'}\n✝️ *Capela:* ${d.cap || '-'}\n📅 *Data:* ${fd(d.data_ficha)}\n🕒 *Horário do Sepultamento:* ${d.hora || '-'}\n\nAgradecemos a todos que puderem comparecer para prestar as últimas homenagens.`;
    }
    
    let url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    if (t) url = `https://wa.me/55${t}?text=${encodeURIComponent(texto)}`;
    
    window.open(url, '_blank'); 
    const tiposLabel = { 'gps': 'Localização GPS', 'info': 'Informações do Atendimento', 'convite': 'Convite para Velório' };
    window.registrarHistorico(d.id, 'WHATSAPP', `WhatsApp enviado (${tiposLabel[tipo] || tipo}) para ${t ? t : 'sem número'}`);
    window.fecharModalWpp();
}

window.enviarWppParticular = function() {
    if (!window.dadosAtendimentoAtual) return;
    const d = window.dadosAtendimentoAtual;
    
    if (!d.chk_pessoa_fisica) {
        alert("O envio de WhatsApp só é aplicável para responsáveis Pessoa Física.");
        return;
    }
    
    let t = d.part_pf_tel ? String(d.part_pf_tel).replace(/\D/g, '') : '';
    if (!t) {
        alert("Sem telefone cadastrado para o responsável.");
        return;
    }

    let texto = `*PREFEITURA MUNICIPAL DE NITERÓI*\n_Serviços Funerários - Agência_\n\nOlá, seguem as informações do seu atendimento particular:\n\n📄 *Protocolo:* ${d.protocolo || 'Pendente'}\n👤 *Falecido(a):* ${(d.nome || '-').toUpperCase()}\n⚰️ *Cemitério Destino:* ${(d.part_cemiterio || '-').toUpperCase()}\n🕒 *Hora de Liberação:* ${d.part_hora_liberacao || '-'}\n\nAgradecemos a compreensão.`;

    let url = `https://wa.me/55${t}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
    window.registrarHistorico(d.id, 'WHATSAPP', `WhatsApp particular enviado para ${d.part_pf_nome || 'responsável'} (${t})`);
}

window.enviarSMS = function() { 
    if (!window.dadosAtendimentoAtual) return; 
    const t = window.dadosAtendimentoAtual.telefone ? String(window.dadosAtendimentoAtual.telefone).replace(/\D/g, '') : ''; 
    const c = window.dadosAtendimentoAtual.geo_coords ? String(window.dadosAtendimentoAtual.geo_coords).replace(/[^0-9.,\-]/g, '') : ''; 
    if (!t) { alert("Sem telefone cadastrado."); return; } 
    window.registrarHistorico(window.dadosAtendimentoAtual.id, 'SMS', `SMS enviado para ${t} com localização da sepultura`);
    window.location.href = `sms:+55${t}?body=${encodeURIComponent('Localização da Sepultura: http://googleusercontent.com/maps.google.com/maps?q=' + c)}`; 
}

window.fecharModalVisualizar = function() { 
    safeDisplay('modal-visualizar', 'none'); 
};

window.fecharModalEstatisticas = function() { 
    safeDisplay('modal-estatisticas', 'none'); 
};

window.alternarDesign = function() { 
    document.body.classList.toggle('design-classico'); 
};

window.imprimirRelatorio = function(m) { 
    const s = document.createElement('style'); 
    s.innerHTML = `@page { size: ${m}; }`; 
    document.head.appendChild(s); 
    window.print(); 
    setTimeout(() => document.head.removeChild(s), 1000); 
};

window.excluir = function(id) { 
    if(confirm('Tem certeza que deseja excluir este atendimento?')) { 
        window.registrarHistorico(id, 'EXCLUSAO', 'Atendimento excluído');
        window.getDB().collection("atendimentos").doc(id).delete(); 
    } 
};

window.onclick = function(e) { 
    const m = [
        'modal-visualizar', 'modal-estatisticas', 'modal-admin', 
        'modal-transferir', 'modal-whatsapp', 'modal-agencia', 
        'modal-liberacao', 'modal-transferir-responsavel', 'modal-onedrive', 
        'modal-docs-acolhimento', 'modal-particular', 'modal-assinatura', 
        'modal-particular-ficha', 'modal-historico', 'modal-busca-beneficio', 
        'modal-novidades', 'modal-sepultura', 'modal-mapa'
    ]; 
    if (m.includes(e.target.id)) {
        safeDisplay(e.target.id, 'none'); 
    }
}

window.fazerLogout = function() { 
    sessionStorage.removeItem('usuarioLogado'); 
    window.location.reload(); 
}

window.bloquearTela = function() { 
    safeDisplay('tela-bloqueio', 'flex'); 
}

// ============================================================================
// ADMINISTRAÇÃO E ADMIN TABS
// ============================================================================

window.abrirAdmin = function() { 
    if (window.usuarioLogado && window.usuarioLogado.nivel && window.usuarioLogado.nivel !== 'COMPLETO') { 
        alert("Acesso Negado: Apenas contas com nível 'Completo' podem acessar a Administração."); 
        return; 
    } 
    safeDisplay('modal-admin', 'block'); 
    window.abrirAba('tab-equipe'); 
}

window.fecharModalAdmin = function() { 
    safeDisplay('modal-admin', 'none'); 
}

window.salvarConfiguracoesGerais = function() {
    const wppElem = document.getElementById('config_wpp_fixo');
    const apiElem = document.getElementById('config_api_transparencia');
    const titElem = document.getElementById('config_aviso_titulo');
    const verElem = document.getElementById('config_aviso_versao');
    const contElem = document.getElementById('config_aviso_conteudo');
    const atiElem = document.getElementById('config_aviso_ativo');
    
    const num = wppElem ? wppElem.value.replace(/\D/g, '') : window.numeroWppFixo;
    const api = apiElem ? apiElem.value.trim() : '';
    const tit = titElem ? titElem.value.trim() : '';
    const ver = verElem ? verElem.value.trim() : '';
    const cont = contElem ? contElem.value : '';
    const ativ = atiElem ? atiElem.checked : false;
    
    getDB().collection("config").doc("geral").set({ 
        wpp_fixo: num, 
        api_transparencia: api,
        aviso_titulo: tit,
        aviso_versao: ver,
        aviso_conteudo: cont,
        aviso_ativo: ativ
    }, { merge: true }).then(() => {
        window.numeroWppFixo = num; 
        alert("Configurações atualizadas com sucesso!");
    }).catch(e => alert("Erro ao salvar configurações."));
}

window.baixarDadosGraficosExcel = function() {
    if(typeof XLSX === 'undefined') { 
        alert("Biblioteca Excel não carregada. Verifique a conexão com a internet."); 
        return; 
    }
    if(!window.dadosGraficosAtuais) { 
        alert("Aguarde o carregamento das estatísticas antes de exportar."); 
        return; 
    }
    
    const wb = XLSX.utils.book_new();
    
    const formatData = (obj, keyName) => { 
        let arr = Object.entries(obj).map(([k, v]) => ({ [keyName]: k, "Quantidade": v })); 
        if(keyName === 'Data') { 
            arr.sort((a,b) => { 
                let da = a['Data'].split('/').reverse().join('-'); 
                let db = b['Data'].split('/').reverse().join('-'); 
                return new Date(da) - new Date(db); 
            }); 
        } else { 
            arr.sort((a,b) => b.Quantidade - a.Quantidade); 
        } 
        return arr; 
    };
    
    const sheetsInfo = [ 
        { name: 'Cemitérios', data: formatData(window.dadosGraficosAtuais.Cemiterios, 'Cemitério') }, 
        { name: 'Volume por Período', data: formatData(window.dadosGraficosAtuais.Volume_Periodo, 'Data') }, 
        { name: 'Causas de Morte', data: formatData(window.dadosGraficosAtuais.Causas, 'Causa') }, 
        { name: 'Produtividade Acolhimento', data: formatData(window.dadosGraficosAtuais.Atendentes_Acolhimento, 'Atendente') }, 
        { name: 'Produtividade Agência', data: formatData(window.dadosGraficosAtuais.Atendentes_Agencia, 'Atendente') }, 
        { name: 'Tipos de Sepultura', data: formatData(window.dadosGraficosAtuais.Sepulturas, 'Sepultura') }, 
        { name: 'Funerárias', data: formatData(window.dadosGraficosAtuais.Funerarias, 'Funerária') }, 
        { name: 'Tempo de Resolução', data: formatData(window.dadosGraficosAtuais.Tempo_Resolucao, 'Tempo') }, 
        { name: 'Isenções', data: formatData(window.dadosGraficosAtuais.Isencoes, 'Perfil de Isenção') }, 
        { name: 'Quadras', data: formatData(window.dadosGraficosAtuais.Quadras, 'Quadra') }, 
        { name: 'Hospitais', data: formatData(window.dadosGraficosAtuais.Hospitais, 'Hospital/Local') }, 
        { name: 'Bairros', data: formatData(window.dadosGraficosAtuais.Bairros, 'Bairro') }, 
        { name: 'Municípios', data: formatData(window.dadosGraficosAtuais.Municipios, 'Município') }, 
        { name: 'Valores GRM', data: formatData(window.dadosGraficosAtuais.Valores_GRM, 'Faixa de Valor') },
        // NOVAS ABAS NO EXCEL
        { name: 'Classificação Etária', data: formatData(window.dadosGraficosAtuais.Classificacao, 'Classificação') },
        { name: 'Estado Civil', data: formatData(window.dadosGraficosAtuais.EstadoCivil, 'Estado Civil') },
        { name: 'Uso de Capelas', data: formatData(window.dadosGraficosAtuais.Capelas, 'Capela') },
        { name: 'Tipo de Atendimento', data: formatData(window.dadosGraficosAtuais.TiposAtendimento, 'Tipo') }
    ];
    
    sheetsInfo.forEach(s => { 
        if(s.data.length > 0) { 
            const ws = XLSX.utils.json_to_sheet(s.data); 
            XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31)); 
         } 
    });
    XLSX.writeFile(wb, "Dados_Graficos_Estatisticas.xlsx");
}   
 window.baixarDadosGraficosExcel = function() {
    if(typeof XLSX === 'undefined') { 
        alert("Biblioteca Excel não carregada. Verifique a conexão com a internet."); 
        return; 
    }
    if(!window.dadosGraficosAtuais) { 
        alert("Aguarde o carregamento das estatísticas antes de exportar."); 
        return; 
    }
    
    const wb = XLSX.utils.book_new();
    
    const formatData = (obj, keyName) => { 
        let arr = Object.entries(obj).map(([k, v]) => ({ [keyName]: k, "Quantidade": v })); 
        if(keyName === 'Data') { 
            arr.sort((a,b) => { 
                let da = a['Data'].split('/').reverse().join('-'); 
                let db = b['Data'].split('/').reverse().join('-'); 
                return new Date(da) - new Date(db); 
            }); 
        } else { 
            arr.sort((a,b) => b.Quantidade - a.Quantidade); 
        } 
        return arr; 
    };
    
    const sheetsInfo = [ 
        { name: 'Cemitérios', data: formatData(window.dadosGraficosAtuais.Cemiterios, 'Cemitério') }, 
        { name: 'Volume por Período', data: formatData(window.dadosGraficosAtuais.Volume_Periodo, 'Data') }, 
        { name: 'Causas de Morte', data: formatData(window.dadosGraficosAtuais.Causas, 'Causa') }, 
        { name: 'Produtividade Acolhimento', data: formatData(window.dadosGraficosAtuais.Atendentes_Acolhimento, 'Atendente') }, 
        { name: 'Produtividade Agência', data: formatData(window.dadosGraficosAtuais.Atendentes_Agencia, 'Atendente') }, 
        { name: 'Tipos de Sepultura', data: formatData(window.dadosGraficosAtuais.Sepulturas, 'Sepultura') }, 
        { name: 'Funerárias', data: formatData(window.dadosGraficosAtuais.Funerarias, 'Funerária') }, 
        { name: 'Tempo de Resolução', data: formatData(window.dadosGraficosAtuais.Tempo_Resolucao, 'Tempo') }, 
        { name: 'Isenções', data: formatData(window.dadosGraficosAtuais.Isencoes, 'Perfil de Isenção') }, 
        { name: 'Quadras', data: formatData(window.dadosGraficosAtuais.Quadras, 'Quadra') }, 
        { name: 'Hospitais', data: formatData(window.dadosGraficosAtuais.Hospitais, 'Hospital/Local') }, 
        { name: 'Bairros', data: formatData(window.dadosGraficosAtuais.Bairros, 'Bairro') }, 
        { name: 'Municípios', data: formatData(window.dadosGraficosAtuais.Municipios, 'Município') }, 
        { name: 'Valores GRM', data: formatData(window.dadosGraficosAtuais.Valores_GRM, 'Faixa de Valor') },
        // NOVAS ABAS NO EXCEL
        { name: 'Classificação Etária', data: formatData(window.dadosGraficosAtuais.Classificacao, 'Classificação') },
        { name: 'Estado Civil', data: formatData(window.dadosGraficosAtuais.EstadoCivil, 'Estado Civil') },
        { name: 'Uso de Capelas', data: formatData(window.dadosGraficosAtuais.Capelas, 'Capela') },
        { name: 'Tipo de Atendimento', data: formatData(window.dadosGraficosAtuais.TiposAtendimento, 'Tipo') }
    ];
    
    sheetsInfo.forEach(s => { 
        if(s.data.length > 0) { 
            const ws = XLSX.utils.json_to_sheet(s.data); 
            XLSX.utils.book_append_sheet(wb, ws, s.name.substring(0, 31)); 
        } 
    });
    XLSX.writeFile(wb, "Dados_Graficos_Estatisticas.xlsx");
}

window.buscarContribuintes = function() {
    const inputBusca = document.getElementById('input-busca-contribuinte');
    const termo = inputBusca ? inputBusca.value.trim().toUpperCase() : ''; 
    const ul = document.getElementById('lista-contribuintes');
    
    if (!ul) return;
    
    if (!termo) { 
        ul.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b; font-weight: 500;">Digite um termo para buscar.</li>'; 
        return; 
    }
    
    ul.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b;">Buscando...</li>';
    
    getDB().collection("atendimentos").get().then(snap => {
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
                        telefone2: d.telefone2 || '', 
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
        
        const fragment = document.createDocumentFragment();
        results.forEach(c => {
            let enderecoCompleto = c.endereco ? `${c.endereco}, ${c.numero} - ${c.bairro}` : 'Não informado'; 
            let telText = c.telefone;
            if (c.telefone2) telText += ` / ${c.telefone2}`;
            
            let li = document.createElement('li'); 
            li.className = 'table-equipe-row';
            li.innerHTML = `<div style="flex: 2; font-weight: 600; color: #1e293b;">${c.nome}</div><div style="flex: 1.5; color: #475569; font-size: 13px;">${c.cpf} <br> <span style="font-size: 11px; color: #94a3b8;">RG: ${c.rg || '-'}</span></div><div style="flex: 1.5; color: #475569; font-size: 13px;">${telText}</div><div style="flex: 2; color: #475569; font-size: 12px; line-height: 1.2;">${enderecoCompleto}</div><div style="width: 60px; display: flex; justify-content: flex-end;"><button class="btn-action-edit" onclick="window.editarContribuinte('${c.cpf}', '${c.nome}')" title="Editar Contribuinte">✏️</button></div>`; 
            fragment.appendChild(li);
        });
        ul.appendChild(fragment);
    });
}

window.editarContribuinte = function(cpf, nome) {
    let query = getDB().collection("atendimentos"); 
    if (cpf) {
        query = query.where("resp_cpf", "==", cpf); 
    } else {
        query = query.where("resp_nome", "==", nome);
    }
    
    query.limit(1).get().then(snap => {
        if (!snap.empty) {
            let d = snap.docs[0].data(); 
            
            const idOrig = document.getElementById('edit-contribuinte-cpf-original'); if(idOrig) idOrig.value = cpf || nome; 
            const idNome = document.getElementById('edit-contribuinte-nome'); if(idNome) idNome.value = d.resp_nome || ''; 
            const idCpf = document.getElementById('edit-contribuinte-cpf'); if(idCpf) idCpf.value = d.resp_cpf || ''; 
            const idRg = document.getElementById('edit-contribuinte-rg'); if(idRg) idRg.value = d.resp_rg || ''; 
            const idTel = document.getElementById('edit-contribuinte-telefone'); if(idTel) idTel.value = d.telefone || ''; 
            const idTel2 = document.getElementById('edit-contribuinte-telefone2'); if(idTel2) idTel2.value = d.telefone2 || ''; 
            const idCep = document.getElementById('edit-contribuinte-cep'); if(idCep) idCep.value = d.resp_cep || ''; 
            const idEnd = document.getElementById('edit-contribuinte-endereco'); if(idEnd) idEnd.value = d.resp_endereco || ''; 
            const idNum = document.getElementById('edit-contribuinte-numero'); if(idNum) idNum.value = d.resp_numero || ''; 
            const idComp = document.getElementById('edit-contribuinte-complemento'); if(idComp) idComp.value = d.resp_complemento || ''; 
            const idBai = document.getElementById('edit-contribuinte-bairro'); if(idBai) idBai.value = d.resp_bairro || ''; 
            const idCid = document.getElementById('edit-contribuinte-cidade'); if(idCid) idCid.value = d.resp_cidade || ''; 
            const idUf = document.getElementById('edit-contribuinte-uf'); if(idUf) idUf.value = d.resp_uf || ''; 
            
            const divTab = document.getElementById('div-tabela-contribuintes'); if(divTab) divTab.classList.add('hidden'); 
            const boxBusca = document.getElementById('box-busca-contribuinte'); if(boxBusca) boxBusca.classList.add('hidden'); 
            const divEdit = document.getElementById('div-editar-contribuinte'); if(divEdit) divEdit.classList.remove('hidden');
        }
    });
}

window.cancelarEdicaoContribuinte = function() { 
    const divEdit = document.getElementById('div-editar-contribuinte'); if(divEdit) divEdit.classList.add('hidden'); 
    const divTab = document.getElementById('div-tabela-contribuintes'); if(divTab) divTab.classList.remove('hidden'); 
    const boxBusca = document.getElementById('box-busca-contribuinte'); if(boxBusca) boxBusca.classList.remove('hidden'); 
}

window.salvarEdicaoContribuinte = function() {
    const origElem = document.getElementById('edit-contribuinte-cpf-original');
    if(!origElem) return;
    
    const originalKey = origElem.value;
    const novoDados = { 
        resp_nome: document.getElementById('edit-contribuinte-nome').value, 
        resp_rg: document.getElementById('edit-contribuinte-rg').value, 
        telefone: document.getElementById('edit-contribuinte-telefone').value, 
        telefone2: document.getElementById('edit-contribuinte-telefone2') ? document.getElementById('edit-contribuinte-telefone2').value : '',
        resp_cep: document.getElementById('edit-contribuinte-cep').value, 
        resp_endereco: document.getElementById('edit-contribuinte-endereco').value, 
        resp_numero: document.getElementById('edit-contribuinte-numero').value, 
        resp_complemento: document.getElementById('edit-contribuinte-complemento').value, 
        resp_bairro: document.getElementById('edit-contribuinte-bairro').value, 
        resp_cidade: document.getElementById('edit-contribuinte-cidade').value, 
        resp_uf: document.getElementById('edit-contribuinte-uf').value 
    };
    
    let query = getDB().collection("atendimentos"); 
    if (originalKey.match(/\d/)) {
        query = query.where("resp_cpf", "==", originalKey); 
    } else {
        query = query.where("resp_nome", "==", originalKey);
    }
    
    query.get().then(snap => { 
        let batch = getDB().batch(); 
        snap.forEach(doc => { 
            batch.update(doc.ref, novoDados); 
        }); 
        batch.commit().then(() => { 
            alert("Contribuinte atualizado com sucesso!"); 
            window.cancelarEdicaoContribuinte(); 
            window.buscarContribuintes(); 
        }).catch(err => alert("Erro ao atualizar.")); 
    });
}

window.carregarLogs = function() { 
    const tbody = document.getElementById('tabela-logs'); 
    if(!tbody) return; 
    
    getDB().collection("atendimentos").limit(50).orderBy("data_ficha", "desc").onSnapshot(snap => { 
        tbody.innerHTML = ''; 
        const fragment = document.createDocumentFragment();
        
        snap.forEach(doc => { 
            let log = doc.data(); 
            let displayDataHora = '-'; 
            
            if (log.data_hora_atendimento) { 
                const parts = log.data_hora_atendimento.split('T'); 
                if (parts.length === 2) { 
                    const dateParts = parts[0].split('-'); 
                    displayDataHora = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} <br> <span style="font-size:11px; color:#666;">${parts[1]}</span>`; 
                } 
            } else { 
                displayDataHora = log.data_ficha ? log.data_ficha.split('-').reverse().join('/') : '-'; 
            } 
            
            const tr = document.createElement('tr'); 
            tr.innerHTML = `<td>${displayDataHora}</td><td>${log.atendente_sistema||'SISTEMA'}</td><td>Cadastro: ${log.nome}</td>`; 
            fragment.appendChild(tr); 
        }); 
        
        tbody.appendChild(fragment);
    }); 
}

window.baixarRelatorioCompleto = function() { 
    if(!getDB()) return; 
    
    if(!confirm("Deseja baixar o relatório geral?")) return; 
    
    if(typeof window.XLSX === 'undefined') { 
        alert("Biblioteca Excel não carregada."); 
        return; 
    } 
    
    getDB().collection("atendimentos").get().then(snap => { 
        let dados = []; 
        snap.forEach(doc => { 
            let d = doc.data(); 
            dados.push([
                d.data_ficha, 
                d.hora, 
                d.nome, 
                d.causa, 
                d.resp_nome, 
                d.telefone, 
                d.funeraria, 
                d.local, 
                d.sepul, 
                d.protocolo, 
                d.atendente_sistema
            ]); 
        }); 
        
        const ws = window.XLSX.utils.aoa_to_sheet([["Data","Hora","Nome","Causa","Resp","Tel","Funeraria","Local","Sepul","Proto","Atendente"], ...dados]); 
        const wb = window.XLSX.utils.book_new(); 
        window.XLSX.utils.book_append_sheet(wb, ws, "Geral"); 
        window.XLSX.writeFile(wb, "Relatorio_Geral.xlsx"); 
    }); 
}

window.baixarExcel = function() { 
    if(typeof window.XLSX === 'undefined' || window.dadosEstatisticasExportacao.length === 0) { 
        alert("Sem dados para exportar."); 
        return; 
    } 
    
    const ws = window.XLSX.utils.json_to_sheet(window.dadosEstatisticasExportacao); 
    const wb = window.XLSX.utils.book_new(); 
    window.XLSX.utils.book_append_sheet(wb, ws, "Stats"); 
    window.XLSX.writeFile(wb, "Estatisticas.xlsx"); 
}

window.baixarLogsExcel = function() { 
    if(typeof window.XLSX === 'undefined') { 
        alert("Erro: Biblioteca Excel ausente."); 
        return; 
    } 
    
    getDB().collection("atendimentos").limit(100).orderBy("data_ficha", "desc").get().then(snap => { 
        let dados = []; 
        snap.forEach(doc => { 
            const d = doc.data(); 
            const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-'; 
            const atendente = d.atendente_sistema ? d.atendente_sistema.toUpperCase() : 'SISTEMA'; 
            dados.push({ "Data": dataF, "Usuário": atendente, "Ação/Detalhes": `Cadastro: ${d.nome}` }); 
        }); 
        
        const ws = window.XLSX.utils.json_to_sheet(dados); 
        const wb = window.XLSX.utils.book_new(); 
        window.XLSX.utils.book_append_sheet(wb, ws, "Auditoria"); 
        window.XLSX.writeFile(wb, "Logs_Auditoria.xlsx"); 
    }); 
}

window.baixarLogsPDF = function() { 
    if(!window.jspdf) { 
        alert("Erro: Biblioteca PDF ausente."); 
        return; 
    } 
    
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF(); 
    
    getDB().collection("atendimentos").limit(100).orderBy("data_ficha", "desc").get().then(snap => { 
        let body = []; 
        snap.forEach(doc => { 
            const d = doc.data(); 
            const dataF = d.data_ficha ? d.data_ficha.split('-').reverse().join('/') : '-'; 
            const atendente = d.atendente_sistema ? d.atendente_sistema.toUpperCase() : 'SISTEMA'; 
            body.push([dataF, atendente, `Cadastro: ${d.nome}`]); 
        }); 
        
        doc.text("Relatório de Auditoria", 14, 10); 
        doc.autoTable({ head: [['Data', 'Usuário', 'Ação/Detalhes']], body: body, startY: 20 }); 
        doc.save("Logs_Auditoria.pdf"); 
    }); 
}

window.baixarTodosExcel = function() { 
    if(typeof window.XLSX === 'undefined') { 
        alert("Biblioteca Excel não carregada."); 
        return; 
    } 
    
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
        
        const ws = window.XLSX.utils.json_to_sheet(dados); 
        const wb = window.XLSX.utils.book_new(); 
        window.XLSX.utils.book_append_sheet(wb, ws, "Todos_Atendimentos"); 
        window.XLSX.writeFile(wb, "Backup_Atendimentos.xlsx"); 
    }); 
}

window.baixarTodosPDF = function() { 
    if(!window.jspdf) { 
        alert("Biblioteca PDF não carregada."); 
        return; 
    } 
    
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

window.gerarBackup = async function(event) { 
    if(!getDB()) return; 
    
    try { 
        const btn = event.target; 
        const originalText = btn.innerText; 
        btn.innerText = "⏳ Gerando..."; 
        btn.disabled = true; 
        
        let backupData = { atendimentos: [], equipe: [], auditoria: [] }; 
        
        const atendimentosSnap = await getDB().collection("atendimentos").get(); 
        atendimentosSnap.forEach(doc => backupData.atendimentos.push({ id: doc.id, ...doc.data() })); 
        
        const equipeSnap = await getDB().collection("equipe").get(); 
        equipeSnap.forEach(doc => backupData.equipe.push({ id: doc.id, ...doc.data() })); 
        
        const auditoriaSnap = await getDB().collection("auditoria").get(); 
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
            let count = 0; 
            
            const restaurarColecao = async (nomeColecao, dados) => { 
                if (dados && dados.length > 0) { 
                    for (let item of dados) { 
                        const id = item.id; 
                        delete item.id; 
                        await getDB().collection(nomeColecao).doc(id).set(item); 
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
            alert("Erro ao ler o arquivo de backup."); 
        } 
    }; 
    
    reader.readAsText(file); 
}

// ============================================================================
// NOVO MÓDULO: GESTÃO DE SEPULTURAS (Sincronização, Importação e Leitura)
// ============================================================================

window.sincronizarSepulturasComAtendimentos = async function(event) {
    if (!confirm("Aviso: Esta ação irá varrer TODAS as fichas de atendimento atuais e gerar o banco de dados de sepulturas automaticamente. Isso pode levar alguns segundos. Deseja iniciar a sincronização?")) return;
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "⏳ Sincronizando... Aguarde";
    btn.disabled = true;
    
    try {
        const db = window.getDB();
        const sepulturasMap = {};
        
        // Puxa as sepulturas que já existem (Importadas do AutoCAD) para não apagá-las
        const sepAntigasSnap = await db.collection("sepulturas").get();
        sepAntigasSnap.forEach(doc => {
            sepulturasMap[doc.id] = doc.data();
            sepulturasMap[doc.id].ocupantes = []; // Zera ocupantes para recalcular
        });

        const atendimentosSnap = await db.collection("atendimentos").get();
        
        atendimentosSnap.forEach(doc => {
            const d = doc.data();
            
            // Ignora atendimentos particulares
            if (!d.local || !d.sepul || d.tipo_registro === 'PARTICULAR') return;
            
            const local = d.local.toUpperCase().trim();
            const sepul = d.sepul.toUpperCase().trim();
            const qd = (d.qd || '').toUpperCase().trim();
            const tipo = (d.tipo_sepultura || '').toUpperCase().trim();
            
            // Coordenada GPS individual salva na ficha de atendimento (se houver)
            const geoCoords = d.geo_coords || '';
            
            // Cria uma Chave Única para identificar a cova no Firebase 
            const key = `${local}_${qd}_${sepul}`.replace(/\//g, '-');
            
            // Se a sepultura ainda não existe no mapa, cria a estrutura básica dela
            if (!sepulturasMap[key]) {
                sepulturasMap[key] = {
                    cemiterio: local,
                    quadra: qd,
                    numero: sepul,
                    tipo: tipo,
                    geo_coords: geoCoords,
                    perpetua: (tipo.includes('PERPETU') || d.perpetua === 'X'),
                    ocupantes: []
                };
            }
            
            // Se encontrou uma coordenada GPS mais nova, atualiza
            if (geoCoords && !sepulturasMap[key].geo_coords) {
                sepulturasMap[key].geo_coords = geoCoords;
            }
            
            // Adiciona o falecido como um ocupante no histórico daquela sepultura
            sepulturasMap[key].ocupantes.push({
                atendimento_id: doc.id,
                nome: d.nome || 'NÃO INFORMADO',
                data_sepultamento: d.data_ficha || '',
                classificacao: d.classificacao_obito || 'ADULTO'
            });
        });
        
        // Vamos enviar para o Firebase em lotes (batch) por segurança
        let batch = db.batch();
        let count = 0;
        let totalSalvo = 0;
        
        for (const key in sepulturasMap) {
            const sepDados = sepulturasMap[key];
            
            // Ordena os ocupantes do mais recente para o mais antigo
            sepDados.ocupantes.sort((a, b) => {
                if (!a.data_sepultamento) return 1;
                if (!b.data_sepultamento) return -1;
                return new Date(b.data_sepultamento) - new Date(a.data_sepultamento);
            });
            
            let status = "LIVRE";
            
            // Lógica de cálculo de Prazos e Exumação
            if (sepDados.ocupantes.length > 0) {
                const ultimoOcupante = sepDados.ocupantes[0];
                
                if (ultimoOcupante.data_sepultamento) {
                    const dataSep = new Date(ultimoOcupante.data_sepultamento);
                    const hoje = new Date();
                    
                    const diffTime = Math.abs(hoje - dataSep);
                    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                    
                    // REGRA DE EXUMAÇÃO: 2 anos para anjos, 3 para adultos
                    const anosCarencia = ultimoOcupante.classificacao === 'ANJO' ? 2 : 3;
                    
                    if (diffYears < anosCarencia) {
                        status = "OCUPADA";
                    } else {
                        status = "EXUMAÇÃO PENDENTE";
                    }
                } else {
                    status = "OCUPADA"; 
                }
            }
            
            sepDados.status = status;
            
            const docRef = db.collection("sepulturas").doc(key);
            batch.set(docRef, sepDados);
            
            count++;
            totalSalvo++;
            
            if (count >= 490) { 
                await batch.commit();
                batch = db.batch();
                count = 0;
            }
        }
        
        if (count > 0) {
            await batch.commit();
        }
        
        alert(`Sincronização concluída com sucesso! ${totalSalvo} sepulturas foram organizadas com base no banco e topografia.`);
        if (window.carregarSepulturas) window.carregarSepulturas();
        
    } catch (err) {
        console.error(err);
        alert("Erro ao sincronizar as sepulturas. Verifique sua conexão com o banco de dados.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

/**
 * Função para ler e exibir as sepulturas no Painel Admin
 */
window.filtroStatusSepulturaAtual = ''; // Variável global para guardar o clique do card

window.filtrarPorStatusSepultura = function(status) {
    // Se clicar no mesmo card novamente, ele "desmarca" e mostra tudo
    if (window.filtroStatusSepulturaAtual === status) {
        window.filtroStatusSepulturaAtual = '';
    } else {
        window.filtroStatusSepulturaAtual = status;
    }
    window.carregarSepulturas(); // Recarrega a tabela e o mapa com o novo filtro
};

/**
 * Função para ler, filtrar e exibir as sepulturas no Painel Admin
 */
window.carregarSepulturas = function() {
    const filtroLocal = document.getElementById('filtro-local-sepulturas');
    const filtroQuadra = document.getElementById('filtro-quadra-sepulturas');
    const filtroTipo = document.getElementById('filtro-tipo-sepulturas');
    const inputBusca = document.getElementById('input-busca-sepulturas');
    const tbody = document.getElementById('tabela-corpo-sepulturas');
    
    if (!tbody || !filtroLocal) return; 
    
    const local = filtroLocal.value;
    const quadraSel = filtroQuadra ? filtroQuadra.value.toUpperCase() : '';
    const tipoSel = filtroTipo ? filtroTipo.value.toUpperCase() : '';
    const busca = inputBusca ? inputBusca.value.trim().toUpperCase() : '';
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color:#64748b; font-weight:500;">⏳ Buscando banco de sepulturas no servidor...</td></tr>';
    
    let query = window.getDB().collection("sepulturas").where("cemiterio", "==", local);
    
    query.get().then(snap => {
        let lista = [];
        snap.forEach(doc => lista.push({...doc.data(), id: doc.id}));
        
        window.ultimaListaSepulturas = lista;
        
        // Atualiza os contadores com os totais REAIS do cemitério (antes de aplicar os filtros visuais)
        let total = lista.length;
        let livres = 0;
        let ocupadas = 0;
        let alertas = 0;
        
        lista.forEach(s => {
            if (s.status === 'LIVRE') livres++;
            else if (s.status === 'OCUPADA') ocupadas++;
            else if (s.status === 'EXUMAÇÃO PENDENTE') alertas++;
        });

        const elTotal = document.getElementById('count-total-sep');
        const elLivres = document.getElementById('count-livres-sep');
        const elOcupadas = document.getElementById('count-ocupadas-sep');
        const elAlertas = document.getElementById('count-alertas-sep');

        if (elTotal) elTotal.innerText = total;
        if (elLivres) elLivres.innerText = livres;
        if (elOcupadas) elOcupadas.innerText = ocupadas;
        if (elAlertas) elAlertas.innerText = alertas;

        // Destaque visual no Card clicado
        ['card-total-sep', 'card-livres-sep', 'card-ocupadas-sep', 'card-alertas-sep'].forEach(id => {
            let el = document.getElementById(id);
            if (el) {
                el.style.borderWidth = '1px';
                el.style.borderColor = el.id.includes('livres') ? '#86efac' : (el.id.includes('ocupadas') ? '#fca5a5' : (el.id.includes('alertas') ? '#fcd34d' : '#e2e8f0'));
            }
        });

        if (window.filtroStatusSepulturaAtual === 'LIVRE') {
            document.getElementById('card-livres-sep').style.borderWidth = '3px';
            document.getElementById('card-livres-sep').style.borderColor = '#16a34a';
        } else if (window.filtroStatusSepulturaAtual === 'OCUPADA') {
            document.getElementById('card-ocupadas-sep').style.borderWidth = '3px';
            document.getElementById('card-ocupadas-sep').style.borderColor = '#dc2626';
        } else if (window.filtroStatusSepulturaAtual === 'EXUMAÇÃO PENDENTE') {
            document.getElementById('card-alertas-sep').style.borderWidth = '3px';
            document.getElementById('card-alertas-sep').style.borderColor = '#d97706';
        } else {
            document.getElementById('card-total-sep').style.borderWidth = '3px';
            document.getElementById('card-total-sep').style.borderColor = '#94a3b8';
        }
        
        // Aplicação dos Filtros na Lista que vai pra Tabela e pro Mapa
        if (window.filtroStatusSepulturaAtual) {
            lista = lista.filter(s => s.status === window.filtroStatusSepulturaAtual);
        }
        if (quadraSel) {
            lista = lista.filter(s => (s.quadra || '').toUpperCase() === quadraSel);
        }
        if (tipoSel) {
            lista = lista.filter(s => (s.tipo || '').toUpperCase().includes(tipoSel));
        }
        if (busca) {
            lista = lista.filter(s => 
                (s.numero && s.numero.includes(busca)) || 
                (s.quadra && s.quadra.includes(busca))
            );
        }

        // Atualiza o mapa interativo Leaflet (ele também respeitará os filtros selecionados!)
        if (typeof window.atualizarCoresDoMapa === 'function' && local === 'CEMITÉRIO DO MARUÍ') {
            window.atualizarCoresDoMapa(lista);
        }
        
        // Ordena por quadra e depois por número
        lista.sort((a, b) => {
            if ((a.quadra || '') < (b.quadra || '')) return -1;
            if ((a.quadra || '') > (b.quadra || '')) return 1;
            return (a.numero || '').localeCompare(b.numero || '', undefined, {numeric: true});
        });
        
        tbody.innerHTML = '';
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px; color:#64748b; font-weight:500;">Nenhuma sepultura encontrada com os filtros atuais.</td></tr>';
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        lista.forEach(s => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => window.abrirModalSepultura(s.id);
            
            let badgeColor = '#f1f5f9';
            let textColor = '#475569';
            
            if (s.status === 'LIVRE') {
                badgeColor = '#dcfce3'; textColor = '#16a34a'; 
            } else if (s.status === 'OCUPADA') {
                badgeColor = '#fee2e2'; textColor = '#dc2626'; 
            } else if (s.status === 'EXUMAÇÃO PENDENTE') {
                badgeColor = '#fef3c7'; textColor = '#d97706'; 
            }
            
            let badge = `<span style="background:${badgeColor}; color:${textColor}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${s.status}</span>`;
            
            let ultOcupante = "NENHUM (VAZIA)";
            if (s.ocupantes && s.ocupantes.length > 0) {
                const ult = s.ocupantes[0];
                const dSep = ult.data_sepultamento ? ult.data_sepultamento.split('-').reverse().join('/') : '--';
                ultOcupante = `<b>${ult.nome.substring(0, 20)}</b><br><span style="font-size:10px; color:#64748b;">Sepultado em: ${dSep}</span>`;
            }
            
            let tipoFmt = s.tipo || '-';
            if (s.perpetua) tipoFmt += ' <br><span style="font-size:9px; color:#3b82f6; font-weight:bold;">(PERPÉTUA)</span>';
            
            tr.innerHTML = `
                <td style="vertical-align:middle; font-size:12px;"><b>${s.cemiterio.replace('CEMITÉRIO DO ', '').replace('CEMITÉRIO DE ', '')}</b></td>
                <td style="text-align:center; vertical-align:middle;">${s.quadra || '-'}</td>
                <td style="text-align:center; vertical-align:middle; font-size:14px;"><b>${s.numero}</b></td>
                <td style="vertical-align:middle;">${tipoFmt}</td>
                <td style="text-align:center; vertical-align:middle;">${badge}</td>
                <td style="vertical-align:middle;">${ultOcupante}</td>
                <td style="text-align:right; vertical-align:middle;">
                    <button class="btn-icon btn-editar-circle" style="background:#f1f5f9; color:#475569;" onclick="event.stopPropagation(); window.abrirModalSepultura('${s.id}')" title="Ver Detalhes">👁️</button>
                </td>
            `;
            fragment.appendChild(tr);
        });
        tbody.appendChild(fragment);
        
    }).catch(err => {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red; padding: 20px;">Erro ao carregar banco de sepulturas.</td></tr>';
    });
}

/**
 * Abre o Modal com os detalhes completos da Sepultura e lista de pessoas lá dentro.
 */
window.abrirModalSepultura = function(id) {
    let modaisSepultura = document.querySelectorAll('[id="modal-sepultura"]');
    if (modaisSepultura.length === 0) {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'modal-sepultura';
        modalDiv.className = 'modal hidden';
        modalDiv.innerHTML = `
            <div class="modal-content" style="max-width: 700px; background: #fff; padding: 0;">
                <div class="modal-header" style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 15px 20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #1e293b; font-size: 16px;">Detalhes da Sepultura</h3>
                    <span class="close" onclick="window.fecharModalSepultura()" style="font-size: 24px; cursor: pointer; color: #64748b;">×</span>
                </div>
                <div style="padding: 20px; max-height: 65vh; overflow-y: auto;" id="detalhes-sepultura-conteudo"></div>
                <div class="modal-footer-custom" style="background: #f8fafc; padding: 15px 20px; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; display: flex; justify-content: flex-end;">
                    <button type="button" class="btn-close" onclick="window.fecharModalSepultura()">Fechar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
        modaisSepultura = document.querySelectorAll('[id="modal-sepultura"]');
    }

    modaisSepultura.forEach(modalSep => {
        modalSep.classList.remove('hidden');
        if (modalSep.parentNode !== document.body) {
            document.body.appendChild(modalSep);
        }
        modalSep.style.cssText = 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background-color: rgba(0,0,0,0.7) !important; z-index: 999999 !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;';
        
        const contentBox = modalSep.querySelector('.modal-content');
        if (contentBox) {
            contentBox.style.cssText = 'position: relative !important; width: 90% !important; max-width: 700px !important; max-height: 90vh !important; display: flex !important; flex-direction: column !important; background: #fff !important; border-radius: 12px !important; overflow: hidden !important; box-shadow: 0 10px 25px rgba(0,0,0,0.5) !important; margin: auto !important; pointer-events: auto !important;';
        }
    });

    const elConteudos = document.querySelectorAll('[id="detalhes-sepultura-conteudo"]');
    elConteudos.forEach(el => {
        el.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b; font-weight: bold; font-size: 14px;">⏳ Carregando dados da sepultura...</div>';
    });

    if(typeof safeDisplay !== 'undefined') safeDisplay('modal-sepultura', 'flex');

    window.getDB().collection("sepulturas").doc(id).get().then(doc => {
        if (doc.exists) {
            const s = doc.data();
            
            let ocupantesHtml = '';
            if (s.ocupantes && s.ocupantes.length > 0) {
                s.ocupantes.forEach((o, index) => {
                    const dSep = o.data_sepultamento ? o.data_sepultamento.split('-').reverse().join('/') : '--/--/----';
                    const avisoAtual = index === 0 ? '<span style="color:#ef4444; font-size:10px; font-weight:bold; border: 1px solid #fca5a5; padding: 2px 4px; border-radius: 4px; margin-left: 5px;">OCUPANTE ATUAL</span>' : '<span style="color:#64748b; font-size:10px; margin-left: 5px;">(Histórico Antigo)</span>';
                    
                    ocupantesHtml += `
                        <div style="background: #fff; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; margin-bottom: 8px; display:flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight:bold; color:#1e293b; font-size: 13px;">${o.nome} ${avisoAtual}</div>
                                <div style="font-size:11px; color:#64748b; margin-top:4px;">Data de Sepultamento: <b style="color:#334155;">${dSep}</b> | Cat: <b style="color:#334155;">${o.classificacao || 'ADULTO'}</b></div>
                            </div>
                            <button class="btn-novo" style="background:#e0f2fe; color:#0284c7; padding:6px 12px; font-size:11px; width:auto; border: 1px solid #bae6fd;" onclick="window.fecharModalSepultura(); window.visualizar('${o.atendimento_id}')">👁️ Ver Ficha de Origem</button>
                        </div>
                    `;
                });
            } else {
                ocupantesHtml = '<div style="color:#64748b; font-size:12px; text-align:center; padding: 20px; background: #fff; border: 1px dashed #cbd5e1; border-radius: 6px;">Sepultura Vazia. Nenhum histórico encontrado.</div>';
            }

            let badgeColor = '#f1f5f9'; let textColor = '#475569';
            if (s.status === 'LIVRE') { badgeColor = '#dcfce3'; textColor = '#16a34a'; }
            else if (s.status === 'OCUPADA') { badgeColor = '#fee2e2'; textColor = '#dc2626'; }
            else if (s.status === 'EXUMAÇÃO PENDENTE') { badgeColor = '#fef3c7'; textColor = '#d97706'; }

            let gpsBtnHtml = '';
            if (s.geo_coords) {
                const cleanCoords = s.geo_coords.replace(/[^0-9.,\-]/g, '');
                gpsBtnHtml = `<div style="text-align: right; margin-top: 10px;"><a href="http://googleusercontent.com/maps.google.com/maps?q=${cleanCoords}" target="_blank" class="btn-novo" style="background-color: #3b82f6; display: inline-flex; padding: 6px 12px; font-size: 11px; text-decoration: none; width: auto;">📍 Ver no Google Maps</a></div>`;
            }

            const conteudo = `
                <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                    <div style="flex: 1; min-width: 120px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px; text-align:center;">
                        <span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">CEMITÉRIO</span>
                        <span style="font-size:14px; font-weight:bold; color:#1e293b;">${s.cemiterio}</span>
                    </div>
                    <div style="flex: 1; min-width: 150px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px; text-align:center;">
                        <span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">QUADRA / NÚMERO</span>
                        <span style="font-size:16px; font-weight:900; color:#3b82f6;">QD ${s.quadra || '-'} | Nº ${s.numero}</span>
                    </div>
                    <div style="flex: 1; min-width: 120px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px; text-align:center;">
                        <span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">STATUS</span>
                        <span style="font-size:14px; font-weight:bold; background:${badgeColor}; color:${textColor}; padding: 2px 8px; border-radius: 4px;">${s.status}</span>
                    </div>
                </div>
                <div style="margin-bottom:20px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <span style="font-size:11px; color:#3b82f6; font-weight:bold; text-transform:uppercase; margin-bottom: 8px; display:block;">ESTRUTURA & LOCALIZAÇÃO</span>
                    <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                        <div style="flex: 1; min-width: 130px;"><span style="font-size:11px; color:#64748b; font-weight:bold;">TIPO DA SEPULTURA:</span><br> <span style="font-size:13px; font-weight:600; color:#334155;">${s.tipo || 'NÃO INFORMADO'}</span></div>
                        <div style="flex: 1; min-width: 130px;"><span style="font-size:11px; color:#64748b; font-weight:bold;">COMPRADA (PERPÉTUA):</span><br> <span style="font-size:13px; font-weight:600; color:#334155;">${s.perpetua ? 'SIM ✅' : 'NÃO (ALUGUEL 3 ANOS)'}</span></div>
                    </div>
                    ${gpsBtnHtml}
                </div>
                <div>
                    <span style="font-size:11px; color:#f59e0b; font-weight:bold; text-transform:uppercase; display: block; margin-bottom: 8px;">HISTÓRICO DE OCUPAÇÃO</span>
                    <div style="background: #f1f5f9; border-radius: 8px; padding: 10px; border: 1px solid #e2e8f0; max-height:250px; overflow-y:auto;">
                        ${ocupantesHtml}
                    </div>
                </div>
            `;

            elConteudos.forEach(el => el.innerHTML = conteudo);

        } else {
            elConteudos.forEach(el => {
                el.innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444; font-weight: bold; font-size: 14px;">❌ O sistema não encontrou os dados. Sincronize a base novamente.</div>';
            });
        }
    }).catch(err => {
        elConteudos.forEach(el => {
            el.innerHTML = '<div style="padding: 40px; text-align: center; color: #ef4444; font-weight: bold; font-size: 14px;">❌ Falha na conexão. Verifique sua rede e tente novamente.</div>';
        });
    });
}

window.fecharModalSepultura = function() {
    const modaisSepultura = document.querySelectorAll('[id="modal-sepultura"]');
    modaisSepultura.forEach(modalSep => {
        modalSep.classList.add('hidden');
        modalSep.style.setProperty('display', 'none', 'important');
    });
    if(typeof safeDisplay !== 'undefined') safeDisplay('modal-sepultura', 'none');
}

// ============================================================================
// MAPA VISUAL INTERATIVO (LEAFLET)
// ============================================================================

window.mapaLeaflet = null;
window.mapaMarkers = [];

window.abrirModalMapa = function() {
    let modaisMapa = document.querySelectorAll('[id="modal-mapa"]');
    
    const tituloArea = document.getElementById('titulo-mapa-marui');
    if (tituloArea && !document.getElementById('filtro-quadra-mapa')) {
        tituloArea.insertAdjacentHTML('afterend', `
            <select id="filtro-quadra-mapa" onchange="window.filtrarMapaPorQuadra(this.value)" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 12px; outline: none; background: #eff6ff; font-weight: bold; color: #1d4ed8; cursor: pointer; margin-left: 10px;">
                <option value="">Visualizar Todo o Cemitério</option>
                <option value="Quadra A">Focar Quadra A</option>
                <option value="Quadra B">Focar Quadra B</option>
                <option value="Quadra E">Focar Quadra E</option>
                <option value="Quadra F">Focar Quadra F</option>
                <option value="Quadra F2">Focar Quadra F2</option>
                <option value="Quadra F3">Focar Quadra F3</option>
                <option value="Quadra F4">Focar Quadra F4</option>
                <option value="Quadra F5">Focar Quadra F5</option>
                <option value="Quadra F6">Focar Quadra F6</option>
                <option value="Quadra F7">Focar Quadra F7</option>
                <option value="Quadra G">Focar Quadra G</option>
                <option value="Gaveta">Focar Gavetas</option>
                <option value="Nicho">Focar Nichos</option>
            </select>
        `);
    }

    const svgAntigo = document.getElementById('container-svg-marui');
    if (svgAntigo) {
        const wrapper = document.getElementById('wrapper-mapa');
        if(wrapper) {
            svgAntigo.remove();
            if (!document.getElementById('mapa-leaflet')) {
                const mapDiv = document.createElement('div');
                mapDiv.id = 'mapa-leaflet';
                mapDiv.style.cssText = 'width: 100%; height: 100%; background: #eef2f5; position: relative; z-index: 1;';
                wrapper.appendChild(mapDiv);
                wrapper.style.height = '60vh'; 
            }
        }
    }

    if (modaisMapa.length === 0) {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'modal-mapa';
        modalDiv.className = 'modal hidden';
        modalDiv.innerHTML = `
            <div class="modal-content" style="max-width: 90vw; background: #fff; padding: 0;">
                <div class="modal-header" style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 15px 20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #1e293b; font-size: 16px;">🗺️ Visão do Cemitério</h3>
                    <span class="close" onclick="window.fecharModalMapa()" style="font-size: 24px; cursor: pointer; color: #64748b;">×</span>
                </div>
                <div style="padding: 20px; max-height: 80vh; overflow-y: auto;">
                    <div id="painel-mapa-ocupacao" class="painel-mapa" style="margin-bottom: 0; display:flex; flex-direction:column; height: 70vh;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <h3 id="titulo-mapa-marui" style="color: #1e293b; margin: 0; font-size: 16px;">🗺️ Mapa Interativo de Localização</h3>
                                <button id="btn-voltar-mapa" class="btn-novo" style="display:none; background-color: #64748b; width: auto; padding: 4px 10px; font-size: 12px;" onclick="window.voltarMapaGeral()">⬅ Resetar Tela</button>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button onclick="window.zoomMapa(1)" class="btn-novo" style="background-color: #3b82f6; width: auto; padding: 4px 10px; font-size: 16px;" title="Aumentar Zoom">➕</button>
                                <button onclick="window.zoomMapa(-1)" class="btn-novo" style="background-color: #3b82f6; width: auto; padding: 4px 10px; font-size: 16px;" title="Diminuir Zoom">➖</button>
                                <button onclick="window.resetarZoomMapa()" class="btn-novo" style="background-color: #64748b; width: auto; padding: 4px 10px; font-size: 12px;" title="Tamanho Original">Resetar</button>
                            </div>
                        </div>
                        <div class="legenda-mapa">
                            <span class="legenda-item"><span class="cor-livre"></span> Livre</span>
                            <span class="legenda-item"><span class="cor-ocupada"></span> Ocupada</span>
                            <span class="legenda-item"><span class="cor-alerta"></span> Exumação Próxima</span>
                        </div>
                        
                        <div id="wrapper-mapa" style="flex-grow: 1; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; height: 100%;">
                            <div id="mapa-leaflet" style="width: 100%; height: 100%; background: #eef2f5;"></div>
                        </div>
                        <div id="mapa-interna-quadra" class="grade-interna-quadra hidden" style="flex-grow: 1;"></div>
                    </div>
                </div>
                <div class="modal-footer-custom" style="background: #f8fafc; padding: 15px 20px; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px; display: flex; justify-content: flex-end;">
                    <button type="button" class="btn-close" onclick="window.fecharModalMapa()">Fechar Mapa</button>
                </div>
            </div>
        `;
        document.body.appendChild(modalDiv);
        modaisMapa = document.querySelectorAll('[id="modal-mapa"]');
    }

    modaisMapa.forEach(modalMapa => {
        if (modalMapa.parentNode !== document.body) {
            document.body.appendChild(modalMapa);
        }
        modalMapa.classList.remove('hidden');
        modalMapa.style.cssText = 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background-color: rgba(0,0,0,0.7) !important; z-index: 999990 !important; align-items: center !important; justify-content: center !important; margin: 0 !important; padding: 0 !important; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important;';
        
        const contentBox = modalMapa.querySelector('.modal-content');
        if(contentBox) {
            contentBox.style.cssText = 'position: relative !important; width: 95% !important; max-width: 1200px !important; max-height: 95vh !important; display: flex !important; flex-direction: column !important; background: #fff !important; border-radius: 12px !important; overflow: hidden !important; box-shadow: 0 10px 25px rgba(0,0,0,0.5) !important; margin: auto !important; pointer-events: auto !important;';
        }
    });

    if(typeof safeDisplay !== 'undefined') safeDisplay('modal-mapa', 'flex');

    if (!window.mapaLeaflet) {
        window.renderizarMapaVisual();
    } else {
        setTimeout(() => { window.mapaLeaflet.invalidateSize(); }, 300);
        setTimeout(() => { window.mapaLeaflet.invalidateSize(); }, 600); 
    }
    
    if (window.ultimaListaSepulturas) {
        setTimeout(() => { window.atualizarCoresDoMapa(window.ultimaListaSepulturas); }, 400);
    }
};

window.fecharModalMapa = function() {
    let modaisMapa = document.querySelectorAll('[id="modal-mapa"]');
    modaisMapa.forEach(m => {
        m.classList.add('hidden');
        m.style.setProperty('display', 'none', 'important');
    });
    if(typeof safeDisplay !== 'undefined') safeDisplay('modal-mapa', 'none');
}

window.renderizarMapaVisual = async function() {
    const container = document.getElementById('mapa-leaflet');
    if (!container) return;

    if (window.mapaLeaflet) {
        setTimeout(() => window.mapaLeaflet.invalidateSize(), 300);
        return;
    }

    if (typeof L === 'undefined') {
        console.error("Biblioteca Leaflet não carregada.");
        return;
    }

    window.mapaLeaflet = L.map('mapa-leaflet', {
        zoomControl: false 
    }).setView([-22.8628, -43.1054], 18);

    L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 21,
        subdomains:['mt0','mt1','mt2','mt3'],
        attribution: '© Google'
    }).addTo(window.mapaLeaflet);

    setTimeout(() => window.mapaLeaflet.invalidateSize(), 300);
}

window.filtrarMapaPorQuadra = function(quadraNome) {
    const inputBusca = document.getElementById('input-busca-sepulturas');
    if (!inputBusca) return;

    const wrapperMapa = document.getElementById('wrapper-mapa');
    const mapaInterno = document.getElementById('mapa-interna-quadra');
    const titulo = document.getElementById('titulo-mapa-marui');
    const btnVoltar = document.getElementById('btn-voltar-mapa');

    if (wrapperMapa) wrapperMapa.style.display = 'block';
    if (mapaInterno) {
        mapaInterno.classList.add('hidden');
        mapaInterno.innerHTML = '';
    }
    if (titulo) titulo.innerHTML = `🗺️ Mapa Interativo de Localização`;

    if (quadraNome === "") {
        inputBusca.value = '';
        if (btnVoltar) btnVoltar.style.display = 'none';
    } else {
        let nomeBusca = quadraNome.replace('Quadra ', '').replace(' (ANJO)', '').trim();
        inputBusca.value = nomeBusca;
        if (btnVoltar) btnVoltar.style.display = 'none'; 
    }
    
    if(typeof window.carregarSepulturas === 'function') window.carregarSepulturas();

    if (window.mapaLeaflet) {
        setTimeout(() => window.mapaLeaflet.invalidateSize(), 200);
    }
};

window.zoomMapa = function(fator) {
    if (!window.mapaLeaflet) return;
    if (fator > 0) window.mapaLeaflet.zoomIn();
    else window.mapaLeaflet.zoomOut();
};

window.resetarZoomMapa = function() {
    if (!window.mapaLeaflet) return;
    window.mapaLeaflet.setView([-22.8628, -43.1054], 18);
};

window.atualizarCoresDoMapa = function(listaSepulturas) {
    // BLINDAGEM EVITANDO O ERRO DO .MAP NO LEAFLET (Utilizando Split seguro)
    if (!window.mapaLeaflet || typeof L === 'undefined') return;
    if (!Array.isArray(listaSepulturas)) return;

    window.mapaMarkers.forEach(m => m.remove());
    window.mapaMarkers = [];

    let bounds = L.latLngBounds();
    let temElementosVisiveis = false;

    const inputBusca = document.getElementById('input-busca-sepulturas');
    const temBuscaAtiva = inputBusca && inputBusca.value.trim() !== '';

    listaSepulturas.forEach(s => {
        if (s.geo_coords) {
            const cleanCoords = String(s.geo_coords).replace(/[^0-9.,\-]/g, '');
            if (cleanCoords && cleanCoords.includes(',')) {
                
                const parts = cleanCoords.split(',');
                if (parts.length >= 2) {
                    const lat = Number(parts[0]);
                    const lon = Number(parts[1]);
                    
                    if (!isNaN(lat) && !isNaN(lon)) {
                        let corTexto = '#475569';
                        let corPino = '#94a3b8'; 
                        if (s.status === 'LIVRE') { corTexto = '#16a34a'; corPino = '#4ade80'; }
                        else if (s.status === 'OCUPADA') { corTexto = '#dc2626'; corPino = '#f87171'; }
                        else if (s.status === 'EXUMAÇÃO PENDENTE') { corTexto = '#d97706'; corPino = '#fbbf24'; }

                        const iconePersonalizado = L.divIcon({
                            className: 'pino-sepultura',
                            html: `<div style="background-color: ${corPino}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;"><div style="background-color: ${corTexto}; width: 4px; height: 4px; border-radius: 50%;"></div></div>`,
                            iconSize: [14, 14],
                            iconAnchor: [7, 7]
                        });

                        const marker = L.marker([lat, lon], { icon: iconePersonalizado }).addTo(window.mapaLeaflet);
                        marker.bindPopup(`
                            <div style="text-align:center;">
                                <strong style="font-size:14px; color:#3b82f6;">QD ${s.quadra || '-'} - Nº ${s.numero}</strong><br>
                                <span style="font-size:11px; font-weight:bold; color:${corTexto};">${s.status}</span><br>
                                <button onclick="window.abrirModalSepultura('${s.id}')" style="margin-top:8px; padding:4px 8px; background:#3b82f6; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:11px;">Ver Ficha</button>
                            </div>
                        `);
                        window.mapaMarkers.push(marker);
                        
                        bounds.extend([lat, lon]);
                        temElementosVisiveis = true;
                    }
                }
            }
        }
    });

    if (temElementosVisiveis && bounds.isValid()) {
        if (temBuscaAtiva) {
            window.mapaLeaflet.fitBounds(bounds, { padding: [30, 30], maxZoom: 21, animate: true });
        } else {
            window.mapaLeaflet.fitBounds(bounds, { padding: [10, 10], maxZoom: 21, animate: true });
        }
    } else {
        window.mapaLeaflet.setView([-22.8628, -43.1054], 18, { animate: true });
    }
};

window.abrirVisaoInternaQuadra = function(nomeQuadra, sepulturas) {
    const wrapperMapa = document.getElementById('wrapper-mapa');
    const mapaInterno = document.getElementById('mapa-interna-quadra');
    const btnVoltar = document.getElementById('btn-voltar-mapa');
    const titulo = document.getElementById('titulo-mapa-marui');

    if (!wrapperMapa || !mapaInterno) return;
    if (!Array.isArray(sepulturas)) return;

    sepulturas.sort((a, b) => a.numero.localeCompare(b.numero, undefined, {numeric: true}));

    let html = '';
    sepulturas.forEach(s => {
        let classeCor = 'cova-ocupada';
        let labelStatus = 'OCUPADA';
        
        if (s.status === 'LIVRE') { 
            classeCor = 'cova-livre'; 
            labelStatus = 'LIVRE'; 
        } else if (s.status === 'EXUMAÇÃO PENDENTE') { 
            classeCor = 'cova-alerta'; 
            labelStatus = 'ALERTA'; 
        }

        html += `<button type="button" class="cova-btn ${classeCor}" onclick="window.abrirModalSepultura('${s.id}')" title="Tipo: ${s.tipo || '-'}">
                    <span>${s.numero}</span>
                    <small>${labelStatus}</small>
                 </button>`;
    });

    mapaInterno.innerHTML = html;
    
    wrapperMapa.style.display = 'none';
    mapaInterno.classList.remove('hidden');
    if (btnVoltar) btnVoltar.style.display = 'inline-block';
    if (titulo) titulo.innerHTML = `🗺️ Visão Interna - ${nomeQuadra}`;
};

window.voltarMapaGeral = function() {
    const wrapperMapa = document.getElementById('wrapper-mapa');
    const mapaInterno = document.getElementById('mapa-interna-quadra');
    const btnVoltar = document.getElementById('btn-voltar-mapa');
    const titulo = document.getElementById('titulo-mapa-marui');
    const selectFiltro = document.getElementById('filtro-quadra-mapa'); 

    if (wrapperMapa) wrapperMapa.style.display = 'block';
    if (mapaInterno) mapaInterno.classList.add('hidden');
    if (btnVoltar) btnVoltar.style.display = 'none';
    if (titulo) titulo.innerHTML = `🗺️ Mapa Interativo de Localização`;
    if (selectFiltro) selectFiltro.value = ''; 
    
    if (window.mapaLeaflet) {
        setTimeout(() => window.mapaLeaflet.invalidateSize(), 200);
    }

    const inputBusca = document.getElementById('input-busca-sepulturas');
    if (inputBusca) {
        inputBusca.value = '';
        window.carregarSepulturas();
    }
};

// NOTA: alternarDashboard com suporte a sepulturas está definido em sepulturas.js

// ============================================================================
// AUTO-DESIGNAÇÃO DE SEPULTURAS NO ACOLHIMENTO
// ============================================================================
document.addEventListener("DOMContentLoaded", function() {
    const selectTipoSepultura = document.getElementById('tipo_sepultura');
    
    if(selectTipoSepultura) {
        selectTipoSepultura.addEventListener('change', function() {
            const tipoSelecionado = this.value.toUpperCase();
            const cemiterioSelecionado = document.getElementById('filtro-local').value;
            const inputQd = document.getElementById('qd');
            const inputSepul = document.getElementById('sepul');
            const inputGeo = document.getElementById('geo_coords');

            if (!tipoSelecionado) return;

            if(inputQd) inputQd.value = "Buscando...";
            if(inputSepul) inputSepul.value = "Buscando...";

            window.getDB().collection("sepulturas")
                .where("cemiterio", "==", cemiterioSelecionado)
                .get()
                .then(snap => {
                    let sepulturaEncontrada = null;
                    
                    snap.forEach(doc => {
                        const s = doc.data();
                        if (!sepulturaEncontrada && s.status === "LIVRE" && s.tipo === tipoSelecionado) {
                            sepulturaEncontrada = s;
                        }
                    });

                    if (sepulturaEncontrada) {
                        if(inputQd) inputQd.value = sepulturaEncontrada.quadra || '';
                        if(inputSepul) inputSepul.value = sepulturaEncontrada.numero || '';
                        if(inputGeo && sepulturaEncontrada.geo_coords) inputGeo.value = sepulturaEncontrada.geo_coords;
                        
                        console.log(`Sepultura auto-designada: QD ${sepulturaEncontrada.quadra}, Nº ${sepulturaEncontrada.numero}`);
                    } else {
                        if(inputQd) inputQd.value = '';
                        if(inputSepul) inputSepul.value = '';
                        alert(`Atenção: Nenhuma sepultura LIVRE do tipo "${tipoSelecionado}" foi encontrada no ${cemiterioSelecionado}.`);
                    }
                }).catch(err => {
                    console.error("Erro ao buscar auto-designação de sepultura:", err);
                    if(inputQd) inputQd.value = '';
                    if(inputSepul) inputSepul.value = '';
                });
        });
    }
});

// ============================================================================
// FUNÇÕES CORE: LOGIN, AUTENTICAÇÃO, LISTENER PRINCIPAL
// ============================================================================

window.checarLoginEnter = function(e) { if (e.key === 'Enter') window.fazerLogin(); };

window.fazerLogin = function() {
    const loginElem = document.getElementById('login-usuario');
    const senhaElem = document.getElementById('login-senha');
    const msgErro = document.getElementById('msg-erro-login');
    
    if (!loginElem || !senhaElem) return;
    
    const login = loginElem.value.trim();
    const senha = senhaElem.value.trim();
    
    if (!login || !senha) {
        if (msgErro) { msgErro.innerText = "Preencha usuário e senha."; msgErro.style.display = 'block'; }
        return;
    }
    
    if (msgErro) msgErro.style.display = 'none';
    
    const db = getDB();
    if (!db) { alert("Banco de dados não disponível. Atualize a página."); return; }
    
    // Tenta autenticar via Firebase Auth primeiro (se disponível)
    const tentarFirebaseAuth = function() {
        if (window.auth && login.includes('@')) {
            return window.auth.signInWithEmailAndPassword(login, senha)
                .then(userCredential => {
                    // Login Firebase OK, agora busca na coleção equipe pelo prefixo do email
                    const emailPrefix = login.split('@')[0].toLowerCase();
                    return db.collection("equipe").get().then(snap => {
                        let encontrado = null;
                        snap.forEach(doc => {
                            const u = doc.data();
                            const uLogin = (u.login || '').toLowerCase();
                            const uEmail = (u.email || '').toLowerCase();
                            const uEmailPrefix = uEmail.split('@')[0];
                            if (uEmail === login.toLowerCase() || uLogin === login.toLowerCase() || uEmailPrefix === emailPrefix) {
                                encontrado = u;
                            }
                        });
                        if (encontrado) {
                            return encontrado;
                        } else {
                            // Cria um perfil básico baseado no Firebase Auth
                            return { nome: userCredential.user.displayName || emailPrefix, login: login, nivel: 'COMPLETO', email: login };
                        }
                    });
                })
                .catch(() => null); // Falha no Firebase Auth, tenta busca local
        }
        return Promise.resolve(null);
    };
    
    tentarFirebaseAuth().then(usuarioAuth => {
        if (usuarioAuth) {
            _loginSucesso(usuarioAuth);
            return;
        }
        
        // Fallback: busca na coleção equipe por login/senha
        // Garante sessão anônima para poder ler a coleção equipe
        const autenticarEBuscar = function() {
            return db.collection("equipe").get().then(snap => {
                let encontrado = null;
                snap.forEach(doc => {
                    const u = doc.data();
                    const uLogin = (u.login || '').toLowerCase();
                    const uEmail = (u.email || '').toLowerCase();
                    if ((uLogin === login.toLowerCase() || uEmail === login.toLowerCase()) && u.senha === senha) {
                        encontrado = u;
                    }
                });
                return encontrado;
            });
        };
        
        // Tenta com sessão anônima se necessário
        const doLogin = function() {
            return autenticarEBuscar().then(usuario => {
                if (usuario) {
                    _loginSucesso(usuario);
                } else {
                    if (msgErro) { msgErro.innerText = "Usuário ou senha incorretos."; msgErro.style.display = 'block'; }
                }
            });
        };
        
        if (window.auth) {
            // Garante sessão Firebase para acessar Firestore
            const currentUser = window.auth.currentUser;
            if (currentUser) {
                doLogin().catch(e => {
                    console.error("Erro no login:", e);
                    if (msgErro) { msgErro.innerText = "Erro ao conectar. Tente novamente."; msgErro.style.display = 'block'; }
                });
            } else {
                window.auth.signInAnonymously().then(() => {
                    doLogin().catch(e => {
                        console.error("Erro no login:", e);
                        if (msgErro) { msgErro.innerText = "Erro ao conectar. Tente novamente."; msgErro.style.display = 'block'; }
                    });
                }).catch(e => {
                    console.error("Erro auth anônimo:", e);
                    // Tenta mesmo sem auth
                    doLogin().catch(e2 => {
                        console.error("Erro no login:", e2);
                        if (msgErro) { msgErro.innerText = "Erro ao conectar. Verifique sua conexão."; msgErro.style.display = 'block'; }
                    });
                });
            }
        } else {
            doLogin().catch(e => {
                console.error("Erro no login:", e);
                if (msgErro) { msgErro.innerText = "Erro ao conectar. Tente novamente."; msgErro.style.display = 'block'; }
            });
        }
    });
};

function _loginSucesso(usuario) {
    window.usuarioLogado = usuario;
    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuario));
    
    safeDisplay('tela-bloqueio', 'none');
    
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.innerText = '👤 ' + (usuario.nome || '').toUpperCase();
    
    // Mostra/esconde botões de navegação baseado no nível
    const nivel = (usuario.nivel || '').toUpperCase();
    const btnSepulturas = document.getElementById('nav-btn-sepulturas');
    if (btnSepulturas && (nivel === 'COMPLETO' || !nivel)) {
        btnSepulturas.style.display = 'inline-block';
    }
    
    // Inicia o listener principal de dados
    window.escutarMudancas();
    
    // Inicia o chat
    if (typeof window.iniciarChat === 'function') window.iniciarChat();
    
    // Carrega configurações
    _carregarConfiguracoes();
    
    // Log de auditoria
    getDB().collection("auditoria").add({
        data_log: new Date().toISOString(),
        usuario: usuario.nome || 'Anon',
        acao: "LOGIN",
        detalhe: `Acesso ao sistema v${SYSTEM_VERSION}`
    }).catch(() => {});
    
    // Verifica avisos/novidades
    if (typeof window.verificarNovidades === 'function') window.verificarNovidades();
}

function _carregarConfiguracoes() {
    getDB().collection("config").doc("geral").get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            window.numeroWppFixo = data.wpp_fixo || '';
        }
    }).catch(() => {});
}

window.getNivelAcesso = function() {
    if (!window.usuarioLogado) return '';
    return (window.usuarioLogado.nivel || 'COMPLETO').toUpperCase();
};

window.escutarMudancas = function() {
    const db = getDB();
    if (!db) return;
    
    // Cancela listener anterior se existir
    if (window.unsubscribe) {
        window.unsubscribe();
        window.unsubscribe = null;
    }
    
    const filtroLocal = document.getElementById('filtro-local');
    const filtroData = document.getElementById('filtro-data');

    const local = filtroLocal ? filtroLocal.value : '';

    // Configura data padrão se não definida
    if (filtroData && !filtroData.value) {
        filtroData.value = window.pegarDataAtualLocal();
    }

    const data = filtroData ? filtroData.value : window.pegarDataAtualLocal();

    const normalizarTexto = (valor) => {
        return String(valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase();
    };

    const formatarDataISO = (dt) => {
        if (!(dt instanceof Date) || isNaN(dt.getTime())) return '';
        const ano = dt.getFullYear();
        const mes = String(dt.getMonth() + 1).padStart(2, '0');
        const dia = String(dt.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };

    const normalizarData = (valor) => {
        if (!valor) return '';

        if (valor instanceof Date) {
            return formatarDataISO(valor);
        }

        if (typeof valor.toDate === 'function') {
            return formatarDataISO(valor.toDate());
        }

        if (typeof valor === 'object' && typeof valor.seconds === 'number') {
            return formatarDataISO(new Date(valor.seconds * 1000));
        }

        if (typeof valor === 'string') {
            const bruto = valor.trim();
            if (!bruto) return '';

            const txt = bruto.split('T')[0].split(' ')[0].replace(/\./g, '/');

            if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(txt)) {
                const [ano, mes, dia] = txt.split('-');
                return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            }

            if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(txt)) {
                let [dia, mes, ano] = txt.split('/');
                if (ano.length === 2) ano = `20${ano}`;
                return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            }

            if (/^\d{8}$/.test(txt)) {
                return `${txt.slice(0, 4)}-${txt.slice(4, 6)}-${txt.slice(6, 8)}`;
            }

            const dt = new Date(bruto);
            return formatarDataISO(dt);
        }

        return '';
    };

    const simplificarLocal = (valor) => {
        return normalizarTexto(valor)
            .replace(/\bCEMITERIO\b/g, '')
            .replace(/\b(DO|DA|DE|DOS|DAS)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const localFiltroNormalizado = normalizarTexto(local);
    const localFiltroSimplificado = simplificarLocal(local);
    const dataFiltroNormalizada = normalizarData(data);
    
    let query = db.collection("atendimentos");
    
    window.unsubscribe = query.onSnapshot(snap => {
        let lista = [];
        let listaAgencia = [];
        let totalHoje = 0;
        let totalIsencoes = 0;
        let totalParticulares = 0;
        
        snap.forEach(doc => {
            const d = { id: doc.id, ...doc.data() };

            const dataRegistro = normalizarData(d.data_ficha) || normalizarData(d.data_hora_atendimento) || normalizarData(d.data_atendimento) || normalizarData(d.data);
            if (dataFiltroNormalizada && dataRegistro !== dataFiltroNormalizada) {
                return;
            }
            
            // Filtra por cemitério no cliente (evita necessidade de índice composto)
            if (d.tipo_registro !== 'PARTICULAR' && localFiltroNormalizado) {
                const localRegistroNormalizado = normalizarTexto(d.local);
                if (localRegistroNormalizado) {
                    const localRegistroSimplificado = simplificarLocal(d.local);
                    const localCompativel =
                        localRegistroNormalizado === localFiltroNormalizado ||
                        localRegistroSimplificado === localFiltroSimplificado ||
                        localRegistroNormalizado.includes(localFiltroNormalizado) ||
                        localFiltroNormalizado.includes(localRegistroNormalizado) ||
                        (localRegistroSimplificado && localFiltroSimplificado && (
                            localRegistroSimplificado.includes(localFiltroSimplificado) ||
                            localFiltroSimplificado.includes(localRegistroSimplificado)
                        ));

                    if (!localCompativel) {
                        return;
                    }
                }
            }
            
            if (d.tipo_registro === 'PARTICULAR') {
                totalParticulares++;
            } else {
                if (d.isencao === 'SIM') totalIsencoes++;
            }
            totalHoje++;
            
            lista.push(d);
            
            // Agência: todos os registros que não são particulares
            if (d.tipo_registro !== 'PARTICULAR') {
                listaAgencia.push(d);
            }
        });
        
        // Atualiza KPIs
        const kpiTotal = document.getElementById('kpi-hoje-total');
        const kpiIsencoes = document.getElementById('kpi-hoje-isencoes');
        const kpiParticulares = document.getElementById('kpi-hoje-particulares');
        if (kpiTotal) kpiTotal.innerText = totalHoje;
        if (kpiIsencoes) kpiIsencoes.innerText = totalIsencoes;
        if (kpiParticulares) kpiParticulares.innerText = totalParticulares;
        
        // Renderiza tabela acolhimento
        if (typeof window.renderizarTabela === 'function') {
            window.renderizarTabela(lista);
        }
        
        // Renderiza tabela agência
        if (typeof window.renderizarTabelaAgencia === 'function') {
            window.renderizarTabelaAgencia(listaAgencia);
        }
    }, err => {
        console.error("Erro no listener de atendimentos:", err);
    });
    
    // Adiciona listeners de mudança nos filtros
    if (filtroLocal && !filtroLocal._listenerAdded) {
        filtroLocal.addEventListener('change', () => window.escutarMudancas());
        filtroLocal._listenerAdded = true;
    }
    if (filtroData && !filtroData._listenerAdded) {
        filtroData.addEventListener('change', () => window.escutarMudancas());
        filtroData._listenerAdded = true;
    }
};

window.pegarDataAtualLocal = function() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offset);
    return local.toISOString().split('T')[0];
};

window.alternarDashboard = window.alternarDashboard || function(aba) {
    document.querySelectorAll('.main-content').forEach(el => {
        el.classList.add('hidden');
        el.style.display = 'none';
    });
    document.querySelectorAll('.btn-nav-dashboard').forEach(el => {
        el.classList.remove('active');
    });
    
    const telaAlvo = document.getElementById('dashboard-' + aba);
    const btnAlvo = document.getElementById('nav-btn-' + aba);
    
    if (telaAlvo) {
        telaAlvo.classList.remove('hidden');
        telaAlvo.style.display = 'block';
    }
    if (btnAlvo) btnAlvo.classList.add('active');
    
    window.dashboardAtual = aba;
};

// Verifica sessão salva ao carregar a página
(function() {
    const savedUser = sessionStorage.getItem('usuarioLogado');
    if (savedUser) {
        try {
            const usuario = JSON.parse(savedUser);
            window.usuarioLogado = usuario;
            
            // Garante sessão Firebase antes de conectar
            const iniciar = function() {
                safeDisplay('tela-bloqueio', 'none');
                const userDisplay = document.getElementById('user-display');
                if (userDisplay) userDisplay.innerText = '👤 ' + (usuario.nome || '').toUpperCase();
                
                const nivel = (usuario.nivel || '').toUpperCase();
                const btnSepulturas = document.getElementById('nav-btn-sepulturas');
                if (btnSepulturas && (nivel === 'COMPLETO' || !nivel)) btnSepulturas.style.display = 'inline-block';
                
                window.escutarMudancas();
                if (typeof window.iniciarChat === 'function') window.iniciarChat();
                _carregarConfiguracoes();
            };
            
            // Espera o DOM e Firebase estarem prontos
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    if (window.auth) {
                        window.auth.signInAnonymously().then(iniciar).catch(iniciar);
                    } else {
                        iniciar();
                    }
                });
            } else {
                setTimeout(function() {
                    if (window.auth) {
                        window.auth.signInAnonymously().then(iniciar).catch(iniciar);
                    } else {
                        iniciar();
                    }
                }, 500);
            }
        } catch(e) {
            console.error("Erro ao restaurar sessão:", e);
        }
    }
})();

window.verificarNovidades = function() {
    getDB().collection("config").doc("geral").get().then(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        if (!data.aviso_ativo) return;
        
        const versao = data.aviso_versao || SYSTEM_VERSION;
        const lida = localStorage.getItem('versao_aviso_lida');
        if (lida === versao) return;
        
        window.versaoAvisoAtual = versao;
        const titulo = document.getElementById('novidades-titulo');
        const conteudo = document.getElementById('novidades-conteudo');
        if (titulo) titulo.innerText = data.aviso_titulo || 'Novidades do Sistema';
        if (conteudo) conteudo.innerHTML = data.aviso_conteudo || '';
        safeDisplay('modal-novidades', 'flex');
    }).catch(() => {});
};

// ============================================================================
// BUSCA PERSONALIZADA NO BANCO DE DADOS
// ============================================================================

window.realizarBusca = function() {
    const tipoElem = document.getElementById('tipo-busca');
    const inputElem = document.getElementById('input-busca');
    if (!tipoElem || !inputElem) return;

    const campo = tipoElem.value;
    let termo = inputElem.value.trim();
    if (!termo) { 
        if (typeof window.limparBusca === 'function') window.limparBusca(); 
        else alert("Digite um termo para buscar."); 
        return; 
    }

    const db = getDB();
    if (!db) return;

    const tbody = document.getElementById('tabela-corpo-acolhimento');
    if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="padding:40px; text-align:center; color:#3b82f6; font-weight:600;">🔍 Buscando registros...</td></tr>';

    let termoBusca = termo.toUpperCase();
    let termoLower = termo.toLowerCase();
    let campoFirestore = campo;

    // Para busca por data no formato dd/mm/aaaa, converter para yyyy-mm-dd
    if (campo === 'data_ficha') {
        const partes = termo.replace(/\-/g, '/').split('/');
        if (partes.length === 3) {
            let ano = partes[2];
            if (ano.length === 2) ano = '20' + ano;
            termoBusca = `${ano}-${partes[1].padStart(2,'0')}-${partes[0].padStart(2,'0')}`;
        } else {
            termoBusca = termo;
        }
    }

    // Campos que permitem busca exata via Firestore query
    const camposExatos = ['protocolo', 'resp_cpf', 'data_ficha'];

    if (camposExatos.includes(campo)) {
        // Busca exata no Firestore (eficiente)
        let valorBusca = campo === 'resp_cpf' ? termo.replace(/\D/g, '') : termoBusca;
        
        db.collection("atendimentos").where(campoFirestore, "==", valorBusca).get().then(snap => {
            let resultados = [];
            snap.forEach(doc => { resultados.push({ id: doc.id, ...doc.data() }); });
            
            // Fallback inteligente para CPF: Tenta buscar com a máscara exata caso falhe sem a máscara
            if (resultados.length === 0 && campo === 'resp_cpf') {
                db.collection("atendimentos").where(campoFirestore, "==", termo).get().then(snap2 => {
                    snap2.forEach(doc => { resultados.push({ id: doc.id, ...doc.data() }); });
                    _exibirResultadosBusca(resultados, campo, termo);
                });
            } else {
                _exibirResultadosBusca(resultados, campo, termo);
            }
        }).catch(e => {
            console.error("Erro na busca:", e);
            if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="padding:40px; text-align:center; color:#ef4444;">❌ Erro ao buscar. Tente novamente.</td></tr>';
        });
    } else {
        // Busca textual inteligente (Case-insensitive) filtrando as fichas recentes
        db.collection("atendimentos").orderBy("data_hora_atendimento", "desc").limit(300).get().then(snap => {
            let resultados = [];
            snap.forEach(doc => {
                const d = doc.data();
                let valorCampo = '';

                if (campo === 'nome') valorCampo = (d.nome || '');
                else if (campo === 'resp_nome') valorCampo = (d.resp_nome || '');
                else if (campo === 'funeraria') valorCampo = (d.funeraria || '');
                else if (campo === 'causa') valorCampo = (d.causa || '');
                else if (campo === 'tipo_sepultura') valorCampo = (d.tipo_sepultura || '');
                else if (campo === 'qd') valorCampo = (d.qd || '');
                else if (campo === 'sepul') valorCampo = (d.sepul || '');
                else if (campo === 'hospital') valorCampo = (d.hospital || '');

                // Compara convertendo ambos para minúsculo, garantindo o match
                if (valorCampo.toLowerCase().includes(termoLower)) {
                    resultados.push({ id: doc.id, ...d });
                }
            });
            _exibirResultadosBusca(resultados, campo, termo);
        }).catch(e => {
            console.error("Erro na busca:", e);
            if (tbody) tbody.innerHTML = '<tr><td colspan="11" style="padding:40px; text-align:center; color:#ef4444;">❌ Erro ao buscar. Tente novamente.</td></tr>';
        });
    }
};

function _exibirResultadosBusca(resultados, campo, termo) {
    const tbody = document.getElementById('tabela-corpo-acolhimento');
    if (!tbody) return;

    if (resultados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" style="padding:40px; text-align:center;">
            <div style="color:#64748b; font-size:14px;">🔍 Nenhum resultado encontrado para <b>"${termo}"</b> no campo <b>${campo}</b></div>
            <button onclick="limparBusca()" class="btn-novo" style="margin-top:15px; background-color:#3b82f6; padding:8px 20px; font-size:12px;">↩ Voltar à listagem</button>
        </td></tr>`;
        return;
    }

    // Ordena por data_ficha desc
    resultados.sort((a, b) => (b.data_ficha || '').localeCompare(a.data_ficha || ''));

    // Adiciona banner de resultados
    tbody.innerHTML = '';
    const trBanner = document.createElement('tr');
    trBanner.innerHTML = `<td colspan="11" style="padding:10px 20px; background:#eff6ff; border-bottom:2px solid #3b82f6;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <span style="color:#1e40af; font-weight:700; font-size:13px;">🔍 ${resultados.length} resultado(s) para "${termo}" em "${campo}"</span>
            <button onclick="limparBusca()" class="btn-novo" style="background-color:#ef4444; padding:6px 12px; font-size:11px; width:auto;">✖ Limpar Busca</button>
        </div>
    </td>`;
    tbody.appendChild(trBanner);

    // Renderiza usando a função existente
    if (typeof window.renderizarTabela === 'function') {
        // Cria um tbody temporário para renderizar, depois move os elementos
        const tempTbody = document.createElement('tbody');
        tempTbody.id = 'tabela-corpo-acolhimento';
        
        // Substituímos temporariamente
        const parent = tbody.parentNode;
        parent.replaceChild(tempTbody, tbody);
        window.renderizarTabela(resultados);
        
        // Agora pegamos o conteúdo renderizado e movemos de volta
        const renderedRows = Array.from(tempTbody.childNodes);
        parent.replaceChild(tbody, tempTbody);
    }
    
    // Abordagem direta: renderizar manualmente os resultados
    _renderizarResultadosBusca(tbody, resultados);
}

function _renderizarResultadosBusca(tbody, lista) {
    let nAcesso = typeof window.getNivelAcesso === 'function' ? window.getNivelAcesso() : '';
    let isReadOnlyAcolhimento = (nAcesso === 'AGENCIA_ACOLHIMENTO');
    const doencasInfecciosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HIV', 'SIDA', 'SARAMPO'];

    lista.forEach(item => {
        const tr = document.createElement('tr');

        let btnMap = '';
        const clCoords = item.geo_coords ? String(item.geo_coords).replace(/[^0-9.,\-]/g, '') : '';
        if (clCoords && clCoords.includes(',')) {
            btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('http://googleusercontent.com/maps.google.com/maps?q=${clCoords}', '_blank')" title="Ver Localização">📍</button>`;
        }

        if (item.tipo_registro === 'PARTICULAR') {
            let responsavelTxt = item.chk_pessoa_fisica ? `PF: ${item.part_pf_nome || ''}` : `FUNERÁRIA: ${item.part_funeraria || ''}`;
            tr.style.backgroundColor = '#f5f3ff';
            let acoesParticular = isReadOnlyAcolhimento ?
                `<span style="font-size:10px;color:#94a3b8;">Apenas Visualização</span>` :
                `<div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation();window.excluir('${item.id}')" title="Excluir">🗑️</button>
                </div>`;
            tr.innerHTML = `
                <td style="vertical-align:middle;"><b>${responsavelTxt}</b></td>
                <td style="text-align:center; vertical-align:middle;">${item.part_hora_liberacao||''}</td>
                <td style="text-align:center; vertical-align:middle;"><b>${(item.nome||'').toUpperCase()}</b><br><span style="font-size:9px; color:#8b5cf6; font-weight:bold; border:1px solid #8b5cf6; padding:2px 4px; border-radius:4px; display:inline-block; margin-top:4px;">ATEND. PARTICULAR</span></td>
                <td style="text-align:center; vertical-align:middle;" colspan="6"><b style="color:#6d28d9;">Cemitério:</b> ${item.part_cemiterio || ''} - ${item.part_tipo || ''}</td>
                <td style="text-align:center; vertical-align:middle;">${item.data_ficha ? item.data_ficha.split('-').reverse().join('/') : ''}</td>
                <td style="text-align:right; vertical-align:middle;">${acoesParticular}</td>`;
            tbody.appendChild(tr);
            return;
        }

        tr.onclick = () => { if(typeof window.visualizar === 'function') window.visualizar(item.id); };

        let isContagioso = item.causa && doencasInfecciosas.some(d => item.causa.toUpperCase().includes(d));
        if (isContagioso) tr.classList.add('alerta-doenca');

        let displayResponsavel = item.isencao === "50" ? `<b>ACOLHIMENTO 50%</b>` : item.isencao === "SIM" ? `<b>ACOLHIMENTO 100%</b>` : `<b>${item.funeraria ? item.funeraria.toUpperCase() : (item.resp_nome || 'S/D').toUpperCase()}</b>`;
        displayResponsavel += `<br><span style="font-weight:bold; font-size:11px;">${(item.tipo_urna_detalhe || '').toUpperCase()}</span>`;
        if (item.combo_urna) {
            displayResponsavel += `<br><span style="font-size:10px;">URNA ${item.combo_urna}</span>`;
            if (typeof dimensoesUrna !== 'undefined' && dimensoesUrna[item.combo_urna]) {
                displayResponsavel += `<br><span style="font-size:9px; color:#666;">${dimensoesUrna[item.combo_urna]}</span>`;
            }
        }

        let servicosExtras = [];
        if (item.tanato === 'SIM' || item.chk_tanato === 'SIM') servicosExtras.push('TANATO');
        if (item.invol === 'SIM' || item.chk_invol === 'SIM') servicosExtras.push('INVOL');
        if (item.translado === 'SIM' || item.chk_translado === 'SIM') servicosExtras.push('TRANS');
        if (item.urna_opc === 'SIM' || item.chk_urna_opc === 'SIM') servicosExtras.push('URNA');
        if (servicosExtras.length > 0) {
            displayResponsavel += `<br><span style="font-size:10px; font-weight:bold;">SERVIÇOS: ${servicosExtras.join(', ')}</span>`;
        }

        const conteudoNome = `<b>${isContagioso ? '⚠️ ' : ''}${item.nome ? item.nome.toUpperCase() : 'NOME NÃO INFORMADO'}</b><div style="color:red; font-size:10px; font-weight:bold; margin-top:2px;">(${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})</div>${item.classificacao_obito === 'ANJO' ? '<div style="font-size:9px; color:blue; font-weight:bold;">(ANJO)</div>' : ''}`;

        let statusDocs = item.url_docs_acolhimento ? `<span style="font-size:9px; color:#10b981; font-weight:bold; border:1px solid #10b981; padding:2px 4px; border-radius:4px; display:inline-block; margin-top:4px;">✅ DOCS NUVEM</span>` : `<span style="font-size:9px; color:#ef4444; font-weight:bold; border:1px solid #ef4444; padding:2px 4px; border-radius:4px; display:inline-block; margin-top:4px;">⚠️ DOCS PENDENTES</span>`;

        let conteudoSepultura = `<b>${item.sepul||''}</b>`;
        if (item.perpetua === 'X' || (item.tipo_sepultura || "").toUpperCase().includes('PERPETU')) {
            conteudoSepultura += `<div style="font-weight:bold; font-size:10px; color:#2196F3; margin-top:2px;">PERPÉTUA</div><div style="font-weight:bold; font-size:10px; color:#2196F3;">L: ${item.livro_perpetua||''} F: ${item.folha_perpetua||''}</div>`;
        }

        let displayFalecimento = '';
        if (item.data_obito && item.data_ficha) {
            const p = item.data_obito.split('-');
            const dFmt = `${p[2]}/${p[1]}`;
            let txtT = "";
            if (item.hora_obito && item.hora) {
                const ini = new Date(`${item.data_obito}T${item.hora_obito}`);
                const fim = new Date(`${item.data_ficha}T${item.hora}`);
                if (!isNaN(ini) && !isNaN(fim)) {
                    const dMs = fim - ini;
                    txtT = `<br><span style="font-weight:bold; font-size:10px;">TEMPO: ${Math.floor(dMs / 3600000)}H ${Math.round(((dMs % 3600000) / 60000))}M</span>`;
                }
            }
            displayFalecimento = `<div style="line-height:1.3;"><span style="color:#c0392b; font-weight:bold;">DIA:</span> ${dFmt}<br><span style="color:#c0392b; font-weight:bold;">AS:</span> ${item.hora_obito || '--:--'}${txtT}</div>`;
        } else if (item.falecimento) {
            displayFalecimento = `<div>${item.falecimento}</div>`;
        }

        let acoesNormal = isReadOnlyAcolhimento ?
            `<div style="display:flex; gap:5px; justify-content:flex-end;">
                ${btnMap} <span style="font-size:10px;color:#94a3b8;line-height:32px;">Apenas Visualização</span>
            </div>` :
            `<div style="display:flex; gap:5px; justify-content:flex-end;">
                ${btnMap}
                <button class="btn-icon" style="background:#dcfce3; color:#16a34a; border-radius:50%; width:32px; height:32px; border:none; cursor:pointer;" onclick="event.stopPropagation();window.enviarWppFixo('${item.id}')" title="Notificar Central via WhatsApp">📲</button>
                <button class="btn-icon btn-editar-circle" onclick="event.stopPropagation();window.editar('${item.id}')">✏️</button>
                <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation();window.excluir('${item.id}')">🗑️</button>
            </div>`;

        tr.innerHTML = `
            <td style="vertical-align:middle;">${displayResponsavel}</td>
            <td style="text-align:center; vertical-align:middle;">${item.hora||''}</td>
            <td style="text-align:center; vertical-align:middle;">${conteudoNome}<br>${statusDocs}</td>
            <td style="text-align:center; vertical-align:middle;">${item.gav||''}</td>
            <td style="text-align:center; vertical-align:middle;">${item.car||''}</td>
            <td style="text-align:center; vertical-align:middle;">${conteudoSepultura}</td>
            <td style="text-align:center; vertical-align:middle;">${item.qd||''}</td>
            <td style="text-align:center; vertical-align:middle; font-size:11px;">${item.hospital||''}</td>
            <td style="text-align:center; vertical-align:middle;">${item.cap||''}</td>
            <td style="text-align:center; vertical-align:middle;">${displayFalecimento}</td>
            <td style="text-align:right; vertical-align:middle;">${acoesNormal}</td>`;

        tbody.appendChild(tr);
    });
}

window.limparBusca = function() {
    const inputElem = document.getElementById('input-busca');
    if (inputElem) inputElem.value = '';
    
    // Recarrega o listener normal (dispara o onSnapshot existente novamente)
    if (typeof window.escutarMudancas === 'function') {
        window.escutarMudancas();
    } else {
        // Fallback: recarregar a página
        window.location.reload();
    }
};
// ============================================================================
// PATCH DE ATUALIZAÇÃO - SISTEMA DE MATRÍCULAS (V3.1 - SINTAXE SEGURA)
// ============================================================================

// 0. Cache global para resgatar as matrículas de atendimentos antigos e atuais
window.equipeCacheMatriculas = {};
if (typeof window.getDB === 'function' && window.getDB()) {
    window.getDB().collection("equipe").onSnapshot(function(snap) {
        snap.forEach(function(doc) {
            var u = doc.data();
            if (u.nome) {
                window.equipeCacheMatriculas[u.nome.trim().toUpperCase()] = u.matricula || '';
            }
        });
    });
}



window.adicionarFuncionario = function() { 
    const nome = document.getElementById('novo-nome').value; 
    const login = document.getElementById('novo-login').value; 
    const email = document.getElementById('novo-email').value; 
    const senha = document.getElementById('nova-senha').value; 
    const nivel = document.getElementById('novo-nivel').value;
    const matElem = document.getElementById('novo-matricula');
    const matricula = matElem ? matElem.value.trim() : '';
    
    if(!nome || !login || !senha) { alert("Preencha nome, login e senha."); return; }
    
    window.getDB().collection("equipe").add({ nome: nome, login: login, email: email, senha: senha, nivel: nivel, matricula: matricula }).then(function() { 
        alert("Usuário adicionado!"); 
        document.getElementById('novo-nome').value = ""; 
        document.getElementById('novo-login').value = ""; 
        document.getElementById('novo-email').value = ""; 
        document.getElementById('nova-senha').value = ""; 
        document.getElementById('novo-nivel').value = "COMPLETO"; 
        if(matElem) matElem.value = "";
    }).catch(function(e) { alert("Erro: " + e); }); 
};

window.editarFuncionario = function(id) { 
    window.getDB().collection("equipe").doc(id).get().then(function(doc) { 
        if(doc.exists) { 
            const u = doc.data(); 
            document.getElementById('edit-id').value = doc.id; 
            document.getElementById('edit-nome').value = u.nome; 
            document.getElementById('edit-login').value = u.login; 
            document.getElementById('edit-email').value = u.email; 
            document.getElementById('edit-senha').value = u.senha; 
            document.getElementById('edit-nivel').value = u.nivel || 'COMPLETO'; 
            
            const matElem = document.getElementById('edit-matricula');
            if(matElem) matElem.value = u.matricula || '';
            
            const boxNovo = document.getElementById('box-novo-usuario');
            if(boxNovo) boxNovo.classList.add('hidden'); 
            const divEdit = document.getElementById('div-editar-usuario');
            if(divEdit) divEdit.classList.remove('hidden'); 
        } 
    }); 
};

window.salvarEdicaoUsuario = function() { 
    const id = document.getElementById('edit-id').value; 
    const nome = document.getElementById('edit-nome').value; 
    const email = document.getElementById('edit-email').value; 
    const senha = document.getElementById('edit-senha').value; 
    const nivel = document.getElementById('edit-nivel').value;
    const matElem = document.getElementById('edit-matricula');
    const matricula = matElem ? matElem.value.trim() : '';
    
    if(!nome || !senha) { alert("Nome e senha são obrigatórios."); return; }
    
    window.getDB().collection("equipe").doc(id).update({ nome: nome, email: email, senha: senha, nivel: nivel, matricula: matricula }).then(function() { 
        alert("Usuário atualizado!"); window.cancelarEdicao(); 
    }).catch(function(e) { alert("Erro: " + e); }); 
};

window.cancelarEdicao = function() { 
    document.getElementById('edit-id').value = ""; 
    document.getElementById('edit-nome').value = ""; 
    document.getElementById('edit-login').value = ""; 
    document.getElementById('edit-email').value = ""; 
    document.getElementById('edit-senha').value = ""; 
    document.getElementById('edit-nivel').value = "COMPLETO"; 
    const matElem = document.getElementById('edit-matricula');
    if(matElem) matElem.value = "";
    
    const divEdit = document.getElementById('div-editar-usuario');
    if(divEdit) divEdit.classList.add('hidden'); 
    const boxNovo = document.getElementById('box-novo-usuario');
    if(boxNovo) boxNovo.classList.remove('hidden'); 
};

// Interceptadores Inteligentes (Hooks)
setTimeout(function() {
    
    // Função auxiliar para buscar matrícula (seja do session ou do cache)
    function getMatriculaForUser(nome) {
        if (!nome) return '';
        let nomeUpper = nome.toUpperCase();
        if (window.equipeCacheMatriculas[nomeUpper]) {
            return window.equipeCacheMatriculas[nomeUpper];
        }
        if (window.usuarioLogado && window.usuarioLogado.nome.toUpperCase() === nomeUpper) {
            return window.usuarioLogado.matricula || '';
        }
        return '';
    }

    // 1. Hook para salvar a matrícula ao criar atendimento (Acolhimento e Particular)
    const dbOrig = window.getDB;
    if(dbOrig && !window._isHookedMatriculaDB) {
        window.getDB = function() {
            const db = dbOrig();
            if(!db || db._isHookedMatricula) return db;
            
            const colOrig = db.collection.bind(db);
            db.collection = function(colName) {
                const col = colOrig(colName);
                if (colName === "atendimentos") {
                    const addOrig = col.add.bind(col);
                    col.add = function(data) {
                        let mat = getMatriculaForUser(data.atendente_sistema);
                        if (mat) data.matricula_atendente = mat;
                        return addOrig(data);
                    };
                }
                return col;
            };
            db._isHookedMatricula = true;
            return db;
        };
        window._isHookedMatriculaDB = true;
    }

    // 2. Adicionar Matrícula ao assumir Processo Agência
    const assumirOrig = window.assumirProcessoAgencia;
    window.assumirProcessoAgencia = function(id, isTransfer) {
        if (!window.usuarioLogado || !window.usuarioLogado.nome) { alert("Faça login."); return; }
        if (confirm(isTransfer ? "Deseja transferir a responsabilidade deste processo para você?" : "Deseja assumir a responsabilidade por este processo na Agência?")) {
            let mat = getMatriculaForUser(window.usuarioLogado.nome);
            window.getDB().collection("atendimentos").doc(id).update({ 
                agencia_atendente: window.usuarioLogado.nome,
                matricula_agencia: mat
            }).then(function() { 
                window.getDB().collection("auditoria").add({ data_log: new Date().toISOString(), usuario: window.usuarioLogado.nome, acao: isTransfer ? "TRANSFERIU RESP. (AGÊNCIA)" : "ASSUMIU AGÊNCIA", detalhe: "ID: " + id }); 
                window.registrarHistorico(id, 'AGENCIA', isTransfer ? "Resp. transferida p/ " + window.usuarioLogado.nome : window.usuarioLogado.nome + " assumiu o processo (Agência)");
            });
        }
    };

    const assumirModOrig = window.assumirProcessoAgenciaModal;
    window.assumirProcessoAgenciaModal = function() {
        if (!window.usuarioLogado || !window.usuarioLogado.nome) return; 
        const idElem = document.getElementById('agencia_docId');
        if(!idElem) return;
        if(confirm("Deseja assumir este processo para você?")) { 
            let mat = getMatriculaForUser(window.usuarioLogado.nome);
            window.getDB().collection("atendimentos").doc(idElem.value).update({ 
                agencia_atendente: window.usuarioLogado.nome,
                matricula_agencia: mat
            }).then(function() { 
                const modElem = document.getElementById('agencia_atendente_modal');
                if(modElem) modElem.innerText = window.usuarioLogado.nome.toUpperCase(); 
                window.toggleCamposAgencia(true); 
            }); 
        }
    };

    // 3. Adicionar Matrícula na Visualização (Buscando do Cache para antigos)
    const visualizarOrig = window.visualizar;
    window.visualizar = function(id) {
        visualizarOrig(id);
        setTimeout(function() {
            if(window.dadosAtendimentoAtual) {
                const d = window.dadosAtendimentoAtual;
                const elAcolhimento = document.getElementById('view_atendente');
                let atendenteNome = d.atendente_sistema || '';
                let mat = d.matricula_atendente || getMatriculaForUser(atendenteNome);
                
                if(elAcolhimento && mat && !elAcolhimento.innerText.includes('Mat:')) {
                    elAcolhimento.innerText = atendenteNome.toUpperCase() + " (Mat: " + mat + ")";
                }
            }
        }, 500);
    };

    // Função mágica para injetar a matrícula
    function executarComNomeModificado(funcaoOriginal) {
        return function() {
            const args = arguments;
            const d = window.dadosAtendimentoAtual;
            if(!d) { return funcaoOriginal.apply(this, args); }

            let nomeLogadoOriginal = null;
            let nomeParaBuscar = d.atendente_sistema || '';
            
            // Prioriza o usuário logado se ele existir
            if (window.usuarioLogado && window.usuarioLogado.nome) {
                nomeLogadoOriginal = window.usuarioLogado.nome;
                nomeParaBuscar = nomeLogadoOriginal; 
            }

            let mat = d.matricula_atendente || getMatriculaForUser(nomeParaBuscar);

            if (mat && window.usuarioLogado) {
                // Modifica o nome na sessão APENAS durante a geração do PDF
                window.usuarioLogado.nome = nomeLogadoOriginal + " - Matrícula: " + mat;
            }

            // Executa a função original
            funcaoOriginal.apply(this, args);

            // Devolve o nome normal
            if (nomeLogadoOriginal !== null) {
                window.usuarioLogado.nome = nomeLogadoOriginal;
            }
        };
    }

    // 4. Hook para Comprovante e Recibo
    if(!window._isHookedComprovante) {
        window.gerarComprovante = executarComNomeModificado(window.gerarComprovante);
        window.gerarReciboFuneraria = executarComNomeModificado(window.gerarReciboFuneraria);
        window._isHookedComprovante = true;
    }

    // 5. Hook para Liberação PDF (Substitui os traços "_________" pela matrícula real)
    if(!window._isHookedLiberacao) {
        const liberacaoOrig = window.gerarFormularioLiberacao;
        window.gerarFormularioLiberacao = function(tipo) {
            const printOrig = window.imprimirHTMLMovel;
            window.imprimirHTMLMovel = function(html) {
                const d = window.dadosAtendimentoAtual || {};
                let atNome = (window.usuarioLogado && window.usuarioLogado.nome ? window.usuarioLogado.nome : (d.agencia_atendente || ''));
                let mat = d.matricula_agencia || getMatriculaForUser(atNome);

                if (mat) {
                    // Substitui os 17 underlines originais pela matrícula!
                    html = html.replace(/_{5,}/g, mat);
                }
                
                printOrig(html);
                window.imprimirHTMLMovel = printOrig; 
            };
            liberacaoOrig(tipo);
        };
        window._isHookedLiberacao = true;
    }

    // 6. Hook para mensagens de WhatsApp Retroativas
    if(!window._isHookedWpp) {
        const wppOrig = window.enviarWppFixo;
        window.enviarWppFixo = function(id) {
            window.getDB().collection("atendimentos").doc(id).get().then(function(doc) {
                if(doc.exists) {
                    const d = doc.data();
                    let mat = d.matricula_atendente || getMatriculaForUser(d.atendente_sistema);
                    if(mat) d.atendente_sistema = (d.atendente_sistema || '') + " (Mat: " + mat + ")";
                    
                    const origGet = window.getDB().collection("atendimentos").doc;
                    window.getDB().collection("atendimentos").doc = function() { return { get: function() { return Promise.resolve({ exists:true, data: function() { return d; } }); } }; };
                    wppOrig(id);
                    setTimeout(function() { window.getDB().collection("atendimentos").doc = origGet; }, 500);
                }
            });
        };
        window._isHookedWpp = true;
    }
}, 1000);
// ============================================================================
// RESTAURAÇÃO DE FUNÇÕES DE INTERFACE (MODAIS)
// ============================================================================
window.abrirAdmin = window.abrirAdmin || function() {
    const m = document.getElementById('modal-admin');
    if(m) { m.classList.remove('hidden'); m.style.display = 'flex'; }
    if(typeof window.listarEquipe === 'function') window.listarEquipe();
};

window.fecharModalAdmin = window.fecharModalAdmin || function() {
    const m = document.getElementById('modal-admin');
    if(m) { m.classList.add('hidden'); m.style.display = 'none'; }
};

window.abrirModal = window.abrirModal || function() {
    const m = document.getElementById('modal');
    if(m) { m.classList.remove('hidden'); m.style.display = 'flex'; }
    const form = document.getElementById('form-atendimento');
    if(form) form.reset();
    const id = document.getElementById('docId');
    if(id) id.value = '';
};

window.fecharModal = window.fecharModal || function() {
    const m = document.getElementById('modal');
    if(m) { m.classList.add('hidden'); m.style.display = 'none'; }
};

window.abrirModalParticular = window.abrirModalParticular || function() {
    const m = document.getElementById('modal-particular');
    if(m) { m.classList.remove('hidden'); m.style.display = 'flex'; }
};

window.fecharModalParticular = window.fecharModalParticular || function() {
    const m = document.getElementById('modal-particular');
    if(m) { m.classList.add('hidden'); m.style.display = 'none'; }
};
// ============================================================================
// FIX VISUAL: RESGATE DOS MODAIS "ENGOLIDOS" PELO HTML
// ============================================================================
function resgatarModais() {
    document.querySelectorAll('.modal').forEach(function(modal) {
        // Se o modal estiver preso dentro de alguma aba (como o dashboard-sepulturas), move de volta para a raiz (Body)
        if (modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }
        // Garante proteção blindada de visibilidade sobrepondo o menu
        modal.style.setProperty('z-index', '999999', 'important');
    });
}

// Executa automaticamente quando o sistema abre
document.addEventListener("DOMContentLoaded", resgatarModais);

// Varreduras de segurança extras
setTimeout(resgatarModais, 1000);
setTimeout(resgatarModais, 3000);
// ============================================================================
// FIX: LOGIN ORIGINAL RESTAURADO + ANIMAÇÕES E TELA DE BOAS VINDAS
// ============================================================================
window.fazerLogin = function() {
    var loginElem = document.getElementById('login-usuario');
    var senhaElem = document.getElementById('login-senha');
    var msgErro = document.getElementById('msg-erro-login');
    var btnLogin = document.getElementById('btn-login-entrar') || document.querySelector('button[onclick="fazerLogin()"]');

    var spinner = document.getElementById('login-spinner');
    if (!spinner && btnLogin) {
        spinner = document.createElement('div');
        spinner.id = 'login-spinner';
        spinner.style.cssText = 'display: none; justify-content: center; align-items: center; margin-top: 15px; flex-direction: column;';
        spinner.innerHTML = 
            '<div style="border: 4px solid #e2e8f0; width: 30px; height: 30px; border-radius: 50%; border-top-color: #3b82f6; animation: spinLogin 1s linear infinite;"></div>' +
            '<span style="font-size: 11px; color: #64748b; margin-top: 8px; font-weight: 600;">Verificando credenciais...</span>' +
            '<style>@keyframes spinLogin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>';
        btnLogin.parentNode.insertBefore(spinner, btnLogin.nextSibling);
    }

    if (!loginElem || !senhaElem) return;

    var login = loginElem.value.trim();
    var senha = senhaElem.value.trim();

    if (!login || !senha) {
        if (msgErro) { msgErro.innerText = "Preencha usuário e senha."; msgErro.style.display = 'block'; }
        return;
    }

    if (msgErro) msgErro.style.display = 'none';
    if (btnLogin) btnLogin.style.display = 'none';
    if (spinner) spinner.style.display = 'flex';

    var db = window.getDB ? window.getDB() : null;
    if (!db) {
        alert("Banco de dados não disponível. Atualize a página.");
        if (btnLogin) btnLogin.style.display = 'flex';
        if (spinner) spinner.style.display = 'none';
        return;
    }

    var timeStart = Date.now();

    var falhaLogin = function(msg) {
        var delay = Math.max(0, 1000 - (Date.now() - timeStart));
        setTimeout(function() {
            if (msgErro) { msgErro.innerText = msg; msgErro.style.display = 'block'; }
            if (btnLogin) btnLogin.style.display = 'flex';
            if (spinner) spinner.style.display = 'none';
        }, delay);
    };

    var sucessoLogin = function(usuario) {
        var delay = Math.max(0, 1200 - (Date.now() - timeStart));
        setTimeout(function() {
            window._loginSucessoAnimado(usuario);
        }, delay);
    };

    var tentarFirebaseAuth = function() {
        if (window.auth && login.includes('@')) {
            return window.auth.signInWithEmailAndPassword(login, senha)
                .then(function(userCredential) {
                    var emailPrefix = login.split('@')[0].toLowerCase();
                    return db.collection("equipe").get().then(function(snap) {
                        var encontrado = null;
                        snap.forEach(function(doc) {
                            var u = doc.data();
                            var uLogin = (u.login || '').toLowerCase();
                            var uEmail = (u.email || '').toLowerCase();
                            var uEmailPrefix = uEmail.split('@')[0];
                            if (uEmail === login.toLowerCase() || uLogin === login.toLowerCase() || uEmailPrefix === emailPrefix) {
                                encontrado = u;
                            }
                        });
                        if (encontrado) return encontrado;
                        else return { nome: userCredential.user.displayName || emailPrefix, login: login, nivel: 'COMPLETO', email: login };
                    });
                }).catch(function() { return null; });
        }
        return Promise.resolve(null);
    };

    tentarFirebaseAuth().then(function(usuarioAuth) {
        if (usuarioAuth) {
            sucessoLogin(usuarioAuth);
            return;
        }

        var autenticarEBuscar = function() {
            return db.collection("equipe").get().then(function(snap) {
                var encontrado = null;
                snap.forEach(function(doc) {
                    var u = doc.data();
                    var uLogin = (u.login || '').toLowerCase();
                    var uEmail = (u.email || '').toLowerCase();
                    if ((uLogin === login.toLowerCase() || uEmail === login.toLowerCase()) && u.senha === senha) {
                        encontrado = u;
                    }
                });
                return encontrado;
            });
        };

        var doLogin = function() {
            return autenticarEBuscar().then(function(usuario) {
                if (usuario) sucessoLogin(usuario);
                else falhaLogin("Usuário ou senha incorretos.");
            });
        };

        if (window.auth) {
            var currentUser = window.auth.currentUser;
            if (currentUser) {
                doLogin().catch(function() { falhaLogin("Erro ao conectar. Tente novamente."); });
            } else {
                window.auth.signInAnonymously()
                    .then(function() { doLogin().catch(function() { falhaLogin("Erro ao conectar. Tente novamente."); }); })
                    .catch(function() { doLogin().catch(function() { falhaLogin("Erro ao conectar. Verifique sua conexão."); }); });
            }
        } else {
            doLogin().catch(function() { falhaLogin("Erro ao conectar. Tente novamente."); });
        }
    });
};

window._loginSucessoAnimado = function(usuario) {
    window.usuarioLogado = usuario;
    sessionStorage.setItem('usuarioLogado', JSON.stringify(usuario));

    var telaBoasVindas = document.getElementById('tela-boas-vindas');
    if (!telaBoasVindas) {
        telaBoasVindas = document.createElement('div');
        telaBoasVindas.id = 'tela-boas-vindas';
        telaBoasVindas.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #ffffff; z-index: 999999; flex-direction: column; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.4s ease;';
        
        var fotoUrl = usuario.foto_url || '';
        var fotoHtml = fotoUrl ? '<img src="' + fotoUrl + '" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">' : '<span style="font-size: 40px;">👋</span>';

        telaBoasVindas.innerHTML = 
            '<div style="background: #e0f2fe; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.2); overflow: hidden;">' +
                fotoHtml +
            '</div>' +
            '<h2 style="color: #1e293b; font-size: 28px; margin: 0; font-weight: 800;">Bem-vindo(a)!</h2>' +
            '<h3 id="boas-vindas-nome" style="color: #3b82f6; font-size: 24px; margin: 5px 0 15px 0; font-weight: 700;"></h3>' +
            '<p style="color: #64748b; font-size: 14px; font-weight: 500;">Preparando seu ambiente de trabalho...</p>' +
            '<div style="width: 200px; height: 4px; background: #e2e8f0; border-radius: 4px; margin-top: 20px; overflow: hidden;">' +
                '<div style="height: 100%; width: 50%; background: #3b82f6; border-radius: 4px; animation: loadingBar 1s ease-in-out infinite alternate;"></div>' +
            '</div>' +
            '<style>@keyframes loadingBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }</style>';
        document.body.appendChild(telaBoasVindas);
    }

    var telaBloqueio = document.getElementById('tela-bloqueio');
    var nomeBoasVindas = document.getElementById('boas-vindas-nome');

    if (nomeBoasVindas) {
        var primeiroNome = (usuario.nome || 'Usuário').split(' ')[0];
        nomeBoasVindas.innerText = primeiroNome.toUpperCase();
    }

    if (telaBloqueio) {
        if(typeof safeDisplay !== 'undefined') { safeDisplay('tela-bloqueio', 'none'); }
        else { telaBloqueio.style.display = 'none'; }
    }

    telaBoasVindas.style.display = 'flex';
    void telaBoasVindas.offsetWidth;
    telaBoasVindas.style.opacity = '1';

    window._carregarSistemaAposLogin(usuario);

    setTimeout(function() {
        telaBoasVindas.style.opacity = '0';
        setTimeout(function() {
            telaBoasVindas.style.display = 'none';
        }, 400); 
    }, 1800);
};

window._carregarSistemaAposLogin = function(usuario) {
    var userDisplay = document.getElementById('user-display');
    
    if (userDisplay) {
        var fotoUrlUserDisplay = usuario.foto_url || '';
        var fotoUserDisplayHtml = fotoUrlUserDisplay ? '<img src="' + fotoUrlUserDisplay + '" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 8px;">' : '<span style="margin-right: 8px; vertical-align: middle;">👤</span>';
        
        userDisplay.innerHTML = fotoUserDisplayHtml + '<span style="vertical-align: middle;">' + (usuario.nome || '').toUpperCase() + '</span>';
        userDisplay.style.display = 'flex'; 
        userDisplay.style.alignItems = 'center';
    }

    var nivel = (usuario.nivel || '').toUpperCase();
    var btnSepulturas = document.getElementById('nav-btn-sepulturas');
    if (btnSepulturas && (nivel === 'COMPLETO' || !nivel)) {
        btnSepulturas.style.display = 'inline-block';
    }

    if(typeof window.escutarMudancas === 'function') window.escutarMudancas();
    if(typeof window.iniciarChat === 'function') window.iniciarChat();

    try {
        window.getDB().collection("config").doc("geral").get().then(function(doc) {
            if (doc.exists) window.numeroWppFixo = doc.data().wpp_fixo || '';
        });
    } catch(e) {}

    try {
        window.getDB().collection("auditoria").add({
            data_log: new Date().toISOString(),
            usuario: usuario.nome || 'Anon',
            acao: "LOGIN",
            detalhe: "Acesso ao sistema"
        });
    } catch(e) {}

    if (typeof window.verificarNovidades === 'function') window.verificarNovidades();
};


window.salvarEdicaoUsuario = function() {
    const id = document.getElementById('edit-id').value;
    const nome = document.getElementById('edit-nome').value;
    const email = document.getElementById('edit-email').value;
    const senha = document.getElementById('edit-senha').value;
    const nivel = document.getElementById('edit-nivel').value;
    const matElem = document.getElementById('edit-matricula');
    const matricula = matElem ? matElem.value.trim() : '';

    if(!nome || !senha) { alert("Nome e senha são obrigatórios."); return; }

    const fileInput = document.getElementById('edit-foto-upload');
    const urlEscondida = document.getElementById('edit-foto-url').value;
    const statusText = document.getElementById('upload-status');
    const btnSalvar = document.querySelector('button[onclick="salvarEdicaoUsuario()"]');

    // Função interna que salva no Firebase (executada após o upload, ou imediatamente se não houver foto nova)
    const finalizarSalvamento = function(linkDaFoto) {
        window.getDB().collection("equipe").doc(id).update({
            nome: nome,
            email: email,
            senha: senha,
            nivel: nivel,
            matricula: matricula,
            foto_url: linkDaFoto
        }).then(function() {
            if(statusText) statusText.innerText = "";
            if(btnSalvar) btnSalvar.innerText = "Salvar Alterações";
            alert("Usuário atualizado com sucesso!");
            
            // Atualiza o menu superior instantaneamente se for o próprio usuário
            if (window.usuarioLogado && window.usuarioLogado.login === document.getElementById('edit-login').value) {
                window.usuarioLogado.foto_url = linkDaFoto;
                sessionStorage.setItem('usuarioLogado', JSON.stringify(window.usuarioLogado));
                
                const userDisplay = document.getElementById('user-display');
                if (userDisplay) {
                    let fotoUserDisplayHtml = linkDaFoto ? `<img src="${linkDaFoto}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 8px;">` : '<span style="margin-right: 8px; vertical-align: middle;">👤</span>';
                    userDisplay.innerHTML = fotoUserDisplayHtml + '<span style="vertical-align: middle;">' + (window.usuarioLogado.nome || '').toUpperCase() + '</span>';
                }
            }
            window.cancelarEdicao();
        }).catch(function(e) { alert("Erro ao salvar: " + e); });
    };

    // SE O USUÁRIO ESCOLHEU UMA FOTO NOVA NO COMPUTADOR:
    if (fileInput && fileInput.files.length > 0) {
        if(statusText) statusText.innerText = "Fazendo upload da foto... Aguarde.";
        if(btnSalvar) btnSalvar.innerText = "Enviando...";
        
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);

        // ATENÇÃO: Substitua 'COLE_SUA_CHAVE_AQUI' pela chave que você vai gerar no ImgBB
        fetch('https://api.imgbb.com/1/upload?key=6bc2d85d2028a28f956ce8e386342c1c', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                // Upload deu certo! Pega o link gerado e finaliza o salvamento
                finalizarSalvamento(data.data.url);
            } else {
                alert("Erro ao fazer upload da foto. Tente novamente.");
                if(statusText) statusText.innerText = "";
                if(btnSalvar) btnSalvar.innerText = "Salvar Alterações";
            }
        })
        .catch(error => {
            alert("Erro de conexão ao enviar a foto.");
            if(statusText) statusText.innerText = "";
            if(btnSalvar) btnSalvar.innerText = "Salvar Alterações";
        });

    } else {
        // SE NÃO ESCOLHEU FOTO NOVA, SALVA NORMAL MANTENDO A ANTIGA
        finalizarSalvamento(urlEscondida);
    }
};

// Não esqueça de atualizar a função editarFuncionario para preencher a urlEscondida quando abrir a janela!
window.editarFuncionario = function(id) {
    window.getDB().collection("equipe").doc(id).get().then(function(doc) {
        if(doc.exists) {
            const u = doc.data();
            document.getElementById('edit-id').value = doc.id;
            document.getElementById('edit-nome').value = u.nome;
            document.getElementById('edit-login').value = u.login || '';
            document.getElementById('edit-email').value = u.email || '';
            document.getElementById('edit-senha').value = u.senha;
            document.getElementById('edit-nivel').value = u.nivel || 'COMPLETO';

            const matElem = document.getElementById('edit-matricula');
            if(matElem) matElem.value = u.matricula || '';

            // Guarda a URL antiga no campo escondido
            const urlEscondida = document.getElementById('edit-foto-url');
            if(urlEscondida) urlEscondida.value = u.foto_url || '';
            
            // Limpa o botão de arquivo para não mostrar fotos de edições anteriores
            const fileInput = document.getElementById('edit-foto-upload');
            if(fileInput) fileInput.value = '';

            const boxNovo = document.getElementById('box-novo-usuario');
            if(boxNovo) boxNovo.classList.add('hidden');
            const divEdit = document.getElementById('div-editar-usuario');
            if(divEdit) divEdit.classList.remove('hidden');
        }
    });
};

window.editarFuncionario = function(id) {
    window.getDB().collection("equipe").doc(id).get().then(function(doc) {
        if(doc.exists) {
            const u = doc.data();
            document.getElementById('edit-id').value = doc.id;
            document.getElementById('edit-nome').value = u.nome;
            document.getElementById('edit-login').value = u.login || '';
            document.getElementById('edit-email').value = u.email || '';
            document.getElementById('edit-senha').value = u.senha;
            document.getElementById('edit-nivel').value = u.nivel || 'COMPLETO';

            const matElem = document.getElementById('edit-matricula');
            if(matElem) matElem.value = u.matricula || '';

            // Preenche a foto ao abrir o painel de edição
            const fotoElem = document.getElementById('edit-foto') || document.querySelector('input[placeholder*="Link da imagem"]');
            if(fotoElem) fotoElem.value = u.foto_url || '';

            const boxNovo = document.getElementById('box-novo-usuario');
            if(boxNovo) boxNovo.classList.add('hidden');
            const divEdit = document.getElementById('div-editar-usuario');
            if(divEdit) divEdit.classList.remove('hidden');
        }
    });
};
// ============================================================================
// FIX: MEU PERFIL - EDIÇÃO DE DADOS DO PRÓPRIO USUÁRIO (NOME, FOTO, SENHA)
// ============================================================================

// Transforma o nome do usuário no topo em um botão clicável
setTimeout(function() {
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) {
        userDisplay.style.cursor = 'pointer';
        userDisplay.title = 'Editar Meu Perfil';
        userDisplay.onclick = window.abrirPerfilUsuario;
    }
}, 2000); // Aguarda o login concluir para aplicar o clique

window.abrirPerfilUsuario = function() {
    if (!window.usuarioLogado) return;
    
    const m = document.getElementById('modal-perfil');
    if(m) { m.classList.remove('hidden'); m.style.display = 'flex'; }
    
    // Preenche os campos com os dados atuais
    document.getElementById('perfil-nome').value = window.usuarioLogado.nome || '';
    document.getElementById('perfil-telefone').value = window.usuarioLogado.telefone || window.usuarioLogado.wpp || '';
    document.getElementById('perfil-matricula').value = window.usuarioLogado.matricula || '';
    document.getElementById('perfil-senha').value = ''; // Sempre vazio por segurança
    document.getElementById('perfil-foto-url').value = window.usuarioLogado.foto_url || '';
    
    const preview = document.getElementById('perfil-foto-preview');
    const emoji = document.getElementById('perfil-foto-emoji');
    
    // Mostra a foto atual ou o emoji se não tiver foto
    if (window.usuarioLogado.foto_url) {
        preview.src = window.usuarioLogado.foto_url;
        preview.style.display = 'block';
        emoji.style.display = 'none';
    } else {
        preview.style.display = 'none';
        emoji.style.display = 'flex';
    }
    
    const fileInput = document.getElementById('perfil-foto-upload');
    if(fileInput) fileInput.value = '';
    const statusText = document.getElementById('perfil-status');
    if(statusText) statusText.innerText = '';
};

window.fecharPerfilUsuario = function() {
    const m = document.getElementById('modal-perfil');
    if(m) { m.classList.add('hidden'); m.style.display = 'none'; }
};

window.salvarPerfilUsuario = function() {
    if (!window.usuarioLogado) return;
    
    const nome = document.getElementById('perfil-nome').value.trim();
    const telefone = document.getElementById('perfil-telefone').value.trim();
    const matricula = document.getElementById('perfil-matricula').value.trim();
    const senha = document.getElementById('perfil-senha').value.trim();
    
    if (!nome) { alert("O nome de exibição não pode ficar vazio."); return; }
    
    const fileInput = document.getElementById('perfil-foto-upload');
    const urlEscondida = document.getElementById('perfil-foto-url').value;
    const statusText = document.getElementById('perfil-status');
    const btnSalvar = document.getElementById('btn-salvar-perfil');
    
    const finalizarSalvamentoPerfil = function(linkDaFoto) {
        if(statusText) statusText.innerText = "Salvando no banco de dados...";
        
        // Busca o ID do documento do usuário atual no banco
        window.getDB().collection("equipe").where("login", "==", window.usuarioLogado.login).get()
        .then(function(snap) {
            if(snap.empty) {
                return window.getDB().collection("equipe").where("email", "==", window.usuarioLogado.email).get();
            }
            return snap;
        })
        .then(function(snap) {
            if (snap.empty) {
                alert("Erro: Cadastro do usuário não encontrado no banco de dados.");
                if(btnSalvar) btnSalvar.innerText = "Salvar Meu Perfil";
                return;
            }
            
            const docId = snap.docs[0].id;
            let dadosAtualizados = {
                nome: nome,
                telefone: telefone,
                matricula: matricula,
                foto_url: linkDaFoto
            };
            
            if (senha) dadosAtualizados.senha = senha;
            
            // 1. Atualiza no Firestore (Banco de Dados)
            window.getDB().collection("equipe").doc(docId).update(dadosAtualizados)
            .then(function() {
                
                // 2. Atualiza no Firebase Authentication (Apenas se a senha foi preenchida)
                if (senha && window.auth && window.auth.currentUser) {
                    window.auth.currentUser.updatePassword(senha).catch(function(e){ 
                        console.log("Aviso: Falha ao atualizar senha no Authentication interno. Faça login novamente.", e); 
                    });
                }
                
                // 3. Atualiza os dados locais para não precisar deslogar
                window.usuarioLogado.nome = nome;
                window.usuarioLogado.telefone = telefone;
                window.usuarioLogado.matricula = matricula;
                window.usuarioLogado.foto_url = linkDaFoto;
                if (senha) window.usuarioLogado.senha = senha;
                
                sessionStorage.setItem('usuarioLogado', JSON.stringify(window.usuarioLogado));
                
                // 4. Atualiza o visual do menu superior instantaneamente
                const userDisplay = document.getElementById('user-display');
                if (userDisplay) {
                    let fotoUserDisplayHtml = linkDaFoto ? `<img src="${linkDaFoto}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 8px;">` : '<span style="margin-right: 8px; vertical-align: middle;">👤</span>';
                    userDisplay.innerHTML = fotoUserDisplayHtml + '<span style="vertical-align: middle;">' + (nome).toUpperCase() + '</span>';
                }
                
                if(statusText) statusText.innerText = "";
                if(btnSalvar) btnSalvar.innerText = "Salvar Meu Perfil";
                alert("Perfil atualizado com sucesso!");
                window.fecharPerfilUsuario();
                
                // Atualiza a tabela de Admin no fundo, caso esteja aberta
                if(typeof window.listarEquipe === 'function') window.listarEquipe();
            })
            .catch(function(e) {
                alert("Erro ao salvar: " + e);
                if(btnSalvar) btnSalvar.innerText = "Salvar Meu Perfil";
            });
        });
    };
    
    // Verifica se escolheu arquivo de foto novo
    if (fileInput && fileInput.files.length > 0) {
        if(statusText) statusText.innerText = "Enviando imagem...";
        if(btnSalvar) btnSalvar.innerText = "Aguarde...";
        
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);

        // ATENÇÃO: COLOQUE A SUA CHAVE DO IMGBB AQUI!
        fetch('https://api.imgbb.com/1/upload?key=6bc2d85d2028a28f956ce8e386342c1c', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if(data.success) {
                finalizarSalvamentoPerfil(data.data.url);
            } else {
                alert("Erro no upload da foto. Tente novamente.");
                if(statusText) statusText.innerText = "";
                if(btnSalvar) btnSalvar.innerText = "Salvar Meu Perfil";
            }
        })
        .catch(error => {
            alert("Erro de conexão com o servidor de fotos.");
            if(statusText) statusText.innerText = "";
            if(btnSalvar) btnSalvar.innerText = "Salvar Meu Perfil";
        });
    } else {
        // Se não mudou a foto, salva rapidinho usando o link que já existia
        finalizarSalvamentoPerfil(urlEscondida);
    }
};
// ============================================================================
// FIX VISUAL: ALINHAMENTO HORIZONTAL DOS FILTROS E BARRA DE BUSCA
// ============================================================================
(function forcarAlinhamentoHorizontal() {
    const estiloAlinhamento = document.createElement('style');
    estiloAlinhamento.innerHTML = `
        /* Força a área que engloba os filtros e a busca a ficar em uma única linha */
        .info-area {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
            gap: 15px !important;
        }
        
        /* Força os botões de Local (Maruí) e Data a ficarem lado a lado */
        .controles-topo.filtros-minimalistas {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
            gap: 10px !important;
            margin-bottom: 0 !important; 
        }

        /* Garante que os itens individuais não empurrem os outros para baixo */
        .filtro-item {
            display: flex !important;
            align-items: center !important;
            margin-bottom: 0 !important;
        }
        
        /* Impede a barra de busca de quebrar a linha */
        .info-area > div {
            margin-bottom: 0 !important;
        }
    `;
    document.head.appendChild(estiloAlinhamento);
})();
// ============================================================================
// FIX VISUAL: ESCONDER BOTÃO DE TEMA DO TOPO
// ============================================================================
setTimeout(function() {
    const botoes = Array.from(document.querySelectorAll('button'));
    const btnTemaAntigo = botoes.find(function(btn) { 
        return btn.innerText.toUpperCase().includes('TEMA'); 
    });

    if (btnTemaAntigo) {
        btnTemaAntigo.style.display = 'none';
    }
}, 1500);
// ============================================================================
// FIX VISUAL: ABRIR EDIÇÃO DO ADMIN COMO MODAL FLUTUANTE
// ============================================================================
window.editarFuncionario = function(id) {
    window.getDB().collection("equipe").doc(id).get().then(function(doc) {
        if(doc.exists) {
            const u = doc.data();
            document.getElementById('edit-id').value = doc.id;
            document.getElementById('edit-nome').value = u.nome || '';
            document.getElementById('edit-login').value = u.login || '';
            document.getElementById('edit-email').value = u.email || '';
            document.getElementById('edit-senha').value = u.senha || '';
            document.getElementById('edit-nivel').value = u.nivel || 'COMPLETO';

            const matElem = document.getElementById('edit-matricula');
            if(matElem) matElem.value = u.matricula || '';

            const urlEscondida = document.getElementById('edit-foto-url');
            if(urlEscondida) urlEscondida.value = u.foto_url || '';
            
            const fileInput = document.getElementById('edit-foto-upload');
            if(fileInput) fileInput.value = '';

            // O pulo do gato: Força o modal a aparecer na frente de tudo
            const divEdit = document.getElementById('div-editar-usuario');
            if(divEdit) {
                divEdit.classList.remove('hidden');
                divEdit.style.display = 'flex'; 
            }
        }
    });
};

window.cancelarEdicao = function() {
    document.getElementById('edit-id').value = "";
    document.getElementById('edit-nome').value = "";
    document.getElementById('edit-login').value = "";
    document.getElementById('edit-email').value = "";
    document.getElementById('edit-senha').value = "";
    document.getElementById('edit-nivel').value = "COMPLETO";
    
    const matElem = document.getElementById('edit-matricula');
    if(matElem) matElem.value = "";
    
    const urlEscondida = document.getElementById('edit-foto-url');
    if(urlEscondida) urlEscondida.value = "";
    
    const fileInput = document.getElementById('edit-foto-upload');
    if(fileInput) fileInput.value = '';

    // Esconde o modal 
    const divEdit = document.getElementById('div-editar-usuario');
    if(divEdit) {
        divEdit.classList.add('hidden');
        divEdit.style.display = 'none';
    }
};
// ============================================================================
// FIX VISUAL: COMPORTAMENTO "BAIXAR/SUBIR" (INLINE) NA EDIÇÃO DO ADMIN
// ============================================================================

// Função que faz o formulário "baixar" e "subir"
window.toggleEdicaoInline = function(id) {
    const formInline = document.getElementById(`edit-inline-${id}`);
    if (!formInline) return;

    // Fecha qualquer outra janela de edição que esteja aberta para não virar bagunça
    document.querySelectorAll('.edit-form-inline.expanded').forEach(function(openForm) {
        if (openForm.id !== `edit-inline-${id}`) {
            openForm.classList.remove('expanded');
        }
    });

    // Se estiver fechado, "baixa" a janela. Se estiver aberto, "sobe" a janela.
    formInline.classList.toggle('expanded');
};

window.toggleEdicaoInline = function(id) {
    const formInline = document.getElementById(`edit-inline-${id}`);
    if (!formInline) return;
    document.querySelectorAll('.edit-form-inline.expanded').forEach(f => {
        if (f.id !== `edit-inline-${id}`) f.classList.remove('expanded');
    });
    formInline.classList.toggle('expanded');
};

// ============================================================================
// MOTOR DA ABA DE CONTRIBUINTES (BUSCA TURBINADA + DESENHO DA TABELA)
// ============================================================================

window.buscarListaContribuintes = function() {
    const termoOriginal = document.getElementById('busca-contribuinte').value.trim();
    if(!termoOriginal) {
        alert("⚠️ Por favor, digite um Nome ou CPF para buscar.");
        return;
    }

    // Cria uma versão do texto toda em minúsculo e sem pontos/traços para busca inteligente
    const termoMinusc = termoOriginal.toLowerCase();
    const termoLimpo = termoOriginal.replace(/[^\w\s]/gi, '').toLowerCase();

    const ul = document.getElementById('lista-contribuintes');
    ul.innerHTML = '<li style="padding: 30px; text-align: center; color: #3b82f6; font-weight: bold;">⏳ Vasculhando a base de dados (isso pode levar alguns segundos)...</li>';

    window.getDB().collection("atendimentos")
        .get()
        .then(function(snap) {
            let resultados = [];
            snap.forEach(function(doc) {
                const d = doc.data();
                const nome = (d.resp_nome || '').toLowerCase();
                const cpf = (d.resp_cpf || '');
                const cpfLimpo = cpf.replace(/[^\w\s]/gi, '').toLowerCase();
                
                if (nome.includes(termoMinusc) || cpf.includes(termoMinusc) || cpfLimpo.includes(termoLimpo)) {
                    resultados.push({id: doc.id, ...d});
                }
            });

            // Ordena do mais recente para o mais antigo
            resultados.sort(function(a, b) {
                let dataA = a.data_registro || "";
                let dataB = b.data_registro || "";
                return dataB.localeCompare(dataA); 
            });
            
            // AQUI ELE CHAMA A FUNÇÃO QUE TINHA SUMIDO!
            window.renderizarListaContribuintes(resultados);
        })
        .catch(function(e) {
            ul.innerHTML = `<li style="color:red; padding: 20px; text-align:center;">Erro ao buscar: ${e.message}</li>`;
        });
};

window.carregarUltimosContribuintes = function() {
    const ul = document.getElementById('lista-contribuintes');
    ul.innerHTML = '<li style="padding: 30px; text-align: center; color: #3b82f6; font-weight: bold;">⏳ Carregando últimos cadastros...</li>';

    window.getDB().collection("atendimentos")
        .orderBy("data_registro", "desc")
        .limit(30)
        .get()
        .then(function(snap) {
            let resultados = [];
            snap.forEach(function(doc) {
                resultados.push({id: doc.id, ...doc.data()});
            });
            window.renderizarListaContribuintes(resultados);
        });
};

// ============================================================================
// FUNÇÃO QUE DESENHA A TABELA DE CONTRIBUINTES (COM ACORDEÃO DE EDIÇÃO)
// ============================================================================
window.renderizarListaContribuintes = function(lista) {
    const ul = document.getElementById('lista-contribuintes');
    ul.innerHTML = '';
    
    if(lista.length === 0) {
        ul.innerHTML = '<li style="padding: 40px; text-align: center; color: #64748b; font-weight: bold;">Nenhum contribuinte encontrado com esses dados.</li>';
        return;
    }

    // Filtro inteligente para não repetir a mesma pessoa se ela fez vários atendimentos
    let cpfsVistos = new Set();
    const fragment = document.createDocumentFragment();
    
    lista.forEach(function(u) {
        if(!u.resp_nome) return; 
        
        if(u.resp_cpf) {
            if(cpfsVistos.has(u.resp_cpf)) return;
            cpfsVistos.add(u.resp_cpf);
        }

        const id = u.id; // Pegamos o ID da ficha para poder atualizar ela no banco

        let li = document.createElement('li');
        li.className = 'table-equipe-row';
        
        li.innerHTML = `
            <div class="row-data" style="display: flex; width: 100%; align-items: center; padding: 15px 0; gap: 10px; flex-wrap: wrap;">
                <div class="col-user" style="flex: 2; min-width: 200px; display: flex; flex-direction: column;">
                    <span style="color:#1e293b; font-size:14px; font-weight:700;">${u.resp_nome.toUpperCase()}</span>
                    <span style="color:#64748b; font-size:12px; margin-top:2px;">CPF: <b>${u.resp_cpf || 'Não informado'}</b></span>
                </div>
                <div class="col-login" style="flex: 1.5; min-width: 150px; display: flex; flex-direction: column;">
                    <span style="color:#334155; font-size:13px; font-weight: 600;">📱 ${u.telefone || 'Sem telefone'}</span>
                    <span style="color:#94a3b8; font-size:11px; margin-top:2px;">${u.resp_email || 'Sem e-mail'}</span>
                </div>
                <div class="col-pass" style="flex: 1.5; min-width: 150px; color: #475569; font-size: 12px; display: flex; flex-direction: column;">
                    <span style="font-weight:600;">📍 ${u.resp_bairro || 'Bairro não inf.'}</span>
                    <span>${u.resp_cidade || 'Niterói'} - ${u.resp_uf || 'RJ'}</span>
                </div>
                <div class="col-actions" style="width: 100px; text-align: right;">
                    <button class="btn-novo" style="background:#8b5cf6; padding: 6px 12px; font-size:11px; width: 100%; justify-content: center;" onclick="window.toggleEdicaoContribuinte('${id}')">✏️ Editar</button>
                </div>
            </div>

            <div id="edit-contribuinte-${id}" class="edit-form-inline">
                <div style="padding: 15px 20px; border-top: 1px solid #e2e8f0; background: #fafafa;">
                    <span style="font-size: 13px; font-weight: 700; color: #8b5cf6; display: block; margin-bottom: 15px;">✏️ Atualizar Dados de ${u.resp_nome.toUpperCase()}</span>
                    
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">NOME COMPLETO</label><input type="text" id="edit-cont-nome-${id}" value="${u.resp_nome||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">CPF</label><input type="text" id="edit-cont-cpf-${id}" value="${u.resp_cpf||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">RG</label><input type="text" id="edit-cont-rg-${id}" value="${u.resp_rg||''}"></div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">TELEFONE 1</label><input type="text" id="edit-cont-tel-${id}" value="${u.telefone||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">TELEFONE 2</label><input type="text" id="edit-cont-tel2-${id}" value="${u.telefone2||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">E-MAIL</label><input type="email" id="edit-cont-email-${id}" value="${u.resp_email||''}"></div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">CEP</label><input type="text" id="edit-cont-cep-${id}" value="${u.resp_cep||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">ENDEREÇO</label><input type="text" id="edit-cont-end-${id}" value="${u.resp_endereco||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">NÚMERO</label><input type="text" id="edit-cont-num-${id}" value="${u.resp_numero||''}"></div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1.5fr 1.5fr 1fr; gap: 10px; margin-bottom: 15px;">
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">COMPL.</label><input type="text" id="edit-cont-comp-${id}" value="${u.resp_complemento||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">BAIRRO</label><input type="text" id="edit-cont-bairro-${id}" value="${u.resp_bairro||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">CIDADE</label><input type="text" id="edit-cont-cidade-${id}" value="${u.resp_cidade||''}"></div>
                        <div><label style="font-size: 10px; font-weight: bold; color: #64748b;">UF</label><input type="text" id="edit-cont-uf-${id}" value="${u.resp_uf||''}"></div>
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="window.toggleEdicaoContribuinte('${id}')" style="padding: 8px 15px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; color: #64748b; cursor: pointer; font-weight: bold;">Cancelar</button>
                        <button onclick="window.salvarEdicaoContribuinte('${id}')" style="padding: 8px 15px; background: #8b5cf6; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold;">💾 Salvar Alterações</button>
                    </div>
                </div>
            </div>
        `;
        fragment.appendChild(li);
    });
    
    ul.appendChild(fragment);
};

// Faz a gaveta de edição descer ou subir
window.toggleEdicaoContribuinte = function(id) {
    const formInline = document.getElementById(`edit-contribuinte-${id}`);
    if (!formInline) return;
    
    // Fecha qualquer outra edição aberta
    document.querySelectorAll('.edit-form-inline.expanded').forEach(f => {
        if (f.id !== `edit-contribuinte-${id}`) f.classList.remove('expanded');
    });
    
    formInline.classList.toggle('expanded');
};

// Coleta os dados e salva no Firebase
window.salvarEdicaoContribuinte = function(id) {
    const nome = document.getElementById(`edit-cont-nome-${id}`).value.trim();
    const cpf = document.getElementById(`edit-cont-cpf-${id}`).value.trim();
    
    if(!nome) {
        alert("❌ O nome do contribuinte é obrigatório.");
        return;
    }

    const dadosAtualizados = {
        resp_nome: nome,
        resp_cpf: cpf,
        resp_rg: document.getElementById(`edit-cont-rg-${id}`).value.trim(),
        telefone: document.getElementById(`edit-cont-tel-${id}`).value.trim(),
        telefone2: document.getElementById(`edit-cont-tel2-${id}`).value.trim(),
        resp_email: document.getElementById(`edit-cont-email-${id}`).value.trim(),
        resp_cep: document.getElementById(`edit-cont-cep-${id}`).value.trim(),
        resp_endereco: document.getElementById(`edit-cont-end-${id}`).value.trim(),
        resp_numero: document.getElementById(`edit-cont-num-${id}`).value.trim(),
        resp_complemento: document.getElementById(`edit-cont-comp-${id}`).value.trim(),
        resp_bairro: document.getElementById(`edit-cont-bairro-${id}`).value.trim(),
        resp_cidade: document.getElementById(`edit-cont-cidade-${id}`).value.trim(),
        resp_uf: document.getElementById(`edit-cont-uf-${id}`).value.trim()
    };

    // Salva a alteração na ficha original desse responsável
    window.getDB().collection("atendimentos").doc(id).update(dadosAtualizados)
        .then(function() {
            alert("✅ Dados do contribuinte atualizados com sucesso!");
            window.toggleEdicaoContribuinte(id); // Esconde a janela
            
            // Recarrega a busca automaticamente
            const inputBusca = document.getElementById('busca-contribuinte').value.trim();
            if(inputBusca) {
                window.buscarListaContribuintes();
            } else {
                window.carregarUltimosContribuintes();
            }
        })
        .catch(function(erro) {
            alert("❌ Erro ao salvar: " + erro.message);
        });
};

window.adicionarContribuinteManual = function() {
    alert("Módulo de salvamento avulso em desenvolvimento. No momento, os contribuintes são salvos automaticamente ao gerar um Novo Atendimento.");
};
// ============================================================================
// FUNÇÃO MESTRE: CARREGAR ESTATÍSTICAS E GRÁFICOS (COM FILTRO DE/ATÉ)
// ============================================================================
window.carregarEstatisticas = function(modo) {
    const database = typeof window.getDB === 'function' ? window.getDB() : db; 
    if(!database) return; 
    
    let dInicio = new Date(); 
    let dString = "";
    let dFimString = "9999-12-31"; // Teto alto para quando não houver data "Até"
    
    // 1. LÓGICA DO NOVO CALENDÁRIO (DE / ATÉ)
    if (modo === 'custom-periodo') { 
        const inputInicio = document.getElementById('stat-data-inicio');
        const inputFim = document.getElementById('stat-data-fim');
        
        if(inputInicio && inputInicio.value) { 
            dString = inputInicio.value; 
        } else { 
            alert("⚠️ Selecione pelo menos a data de início (DE)."); 
            return; 
        } 
        
        if(inputFim && inputFim.value) {
            dFimString = inputFim.value;
        }
    } 
    // 2. LÓGICA DOS BOTÕES PRONTOS (Hoje, 7 Dias, 30 Dias, Mês)
    else { 
        if (modo === 'mes') { 
            dInicio = new Date(dInicio.getFullYear(), dInicio.getMonth(), 1); 
        } else { 
            dInicio.setDate(dInicio.getDate() - parseInt(modo)); 
        } 
        let localDate = new Date(dInicio.getTime() - (dInicio.getTimezoneOffset() * 60000)); 
        dString = localDate.toISOString().split('T')[0]; 
        
        if (modo === '0') {
            dFimString = dString;
        } else {
            let localHoje = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000));
            dFimString = localHoje.toISOString().split('T')[0];
        }
    }
    
    const loading = document.getElementById('loading-stats');
    if (loading) loading.style.display = 'block';

    // 3. BUSCA TURBINADA NO FIREBASE (DE / ATÉ)
    database.collection("atendimentos")
        .where("data_ficha", ">=", dString)
        .where("data_ficha", "<=", dFimString)
        .onSnapshot(snap => {
            
            if (loading) loading.style.display = 'none';

            let causas = {};
            let atendentesAcolhimento = {};
            let atendentesAgencia = {};
            let sepulturas = {};
            let funerarias = {};
            let tempos = {"Menos de 12h":0, "12h a 24h":0, "24h a 48h":0, "Mais de 48h":0};
            let isencoes = {"PAGO":0, "GRATUIDADE (100%)":0, "DESCONTO (50%)":0};
            let quadras = {};
            let hospitais = {};
            let bairros = {};
            let municipios = {};
            let valores = {"Até R$ 500":0, "R$ 501 a R$ 1000":0, "R$ 1001 a R$ 2000":0, "Acima de R$ 2000":0};
            
            let classificacoes = {};
            let estadosCivis = {};
            let capelas = {};
            let tiposAtendimento = {"MUNICIPAL / SOCIAL": 0, "PARTICULAR": 0};

            let totalValores = 0;
            let qtdValores = 0;
            let cemiterios = {"MARUÍ":0, "SÃO FRANCISCO":0, "ITAIPU":0};
            let linhasTempo = {};
            let totalAcolhimento = 0; 
            let totalAgencia = 0;

            snap.forEach(doc => {
                const d = doc.data(); 
                
                totalAcolhimento++; 
                if (d.agencia_atendente || d.agencia_processo || d.tipo_registro === 'PARTICULAR') { 
                    totalAgencia++; 
                }
                
                if(d.causa) { d.causa.split('/').forEach(c => { const k = c.trim().toUpperCase(); if(k) causas[k] = (causas[k] || 0) + 1; }); }
                if(d.atendente_sistema) { const func = d.atendente_sistema.trim().toUpperCase(); if(func) atendentesAcolhimento[func] = (atendentesAcolhimento[func] || 0) + 1; }
                if(d.agencia_atendente) { const funcAg = d.agencia_atendente.trim().toUpperCase(); if(funcAg) atendentesAgencia[funcAg] = (atendentesAgencia[funcAg] || 0) + 1; }
                if(d.tipo_sepultura) { const t = d.tipo_sepultura.trim().toUpperCase(); if(t) sepulturas[t] = (sepulturas[t] || 0) + 1; }
                if(d.funeraria) { const f = d.funeraria.trim().toUpperCase(); if(f) funerarias[f] = (funerarias[f] || 0) + 1; }
                if(d.isencao) { if(d.isencao === 'SIM') isencoes["GRATUIDADE (100%)"]++; else if(d.isencao === '50') isencoes["DESCONTO (50%)"]++; else isencoes["PAGO"]++; }
                if(d.qd) { const q = d.qd.trim().toUpperCase(); if(q) quadras[q] = (quadras[q] || 0) + 1; }
                if(d.hospital) { const h = d.hospital.trim().toUpperCase(); if(h) hospitais[h] = (hospitais[h] || 0) + 1; }
                if(d.resp_bairro) { const b = d.resp_bairro.trim().toUpperCase(); if(b) bairros[b] = (bairros[b] || 0) + 1; }
                if(d.resp_cidade) { const c = d.resp_cidade.trim().toUpperCase(); if(c) municipios[c] = (municipios[c] || 0) + 1; }
                
                if(d.local) { 
                    if(d.local.includes("MARUÍ")) cemiterios["MARUÍ"]++; 
                    else if(d.local.includes("FRANCISCO")) cemiterios["SÃO FRANCISCO"]++; 
                    else if(d.local.includes("ITAIPU")) cemiterios["ITAIPU"]++; 
                } else { 
                    cemiterios["MARUÍ"]++; 
                }
                
                if(d.data_ficha) { 
                    let dataStr = d.data_ficha.split('-').reverse().join('/'); 
                    linhasTempo[dataStr] = (linhasTempo[dataStr] || 0) + 1; 
                }
                
                if(d.agencia_valor_grm) { 
                    let v = parseFloat(d.agencia_valor_grm); 
                    if(!isNaN(v)) { 
                        totalValores += v; 
                        qtdValores++; 
                        if(v <= 500) valores["Até R$ 500"]++; 
                        else if(v <= 1000) valores["R$ 501 a R$ 1000"]++; 
                        else if(v <= 2000) valores["R$ 1001 a R$ 2000"]++; 
                        else valores["Acima de R$ 2000"]++; 
                    } 
                }
                
                if(d.data_hora_atendimento && d.data_ficha && d.hora) { 
                    const start = new Date(d.data_hora_atendimento); 
                    const end = new Date(d.data_ficha + 'T' + d.hora); 
                    if(!isNaN(start) && !isNaN(end)) { 
                        const diffHrs = (end - start) / 3600000; 
                        if(diffHrs < 12) tempos["Menos de 12h"]++; 
                        else if(diffHrs <= 24) tempos["12h a 24h"]++; 
                        else if(diffHrs <= 48) tempos["24h a 48h"]++; 
                        else tempos["Mais de 48h"]++; 
                    } 
                }

                let classif = d.classificacao_obito ? d.classificacao_obito.toUpperCase() : "ADULTO";
                classificacoes[classif] = (classificacoes[classif] || 0) + 1;

                let ec = d.estado_civil ? d.estado_civil.toUpperCase() : "NÃO INFORMADO";
                estadosCivis[ec] = (estadosCivis[ec] || 0) + 1;

                let capela = d.cap ? d.cap.toUpperCase() : "NÃO INFORMADA";
                capelas[capela] = (capelas[capela] || 0) + 1;

                if (d.tipo_registro === 'PARTICULAR') {
                    tiposAtendimento["PARTICULAR"]++;
                } else {
                    tiposAtendimento["MUNICIPAL / SOCIAL"]++;
                }
            });

            const elKpiAcolhimento = document.getElementById('kpi-acolhimento'); 
            if (elKpiAcolhimento) elKpiAcolhimento.innerText = totalAcolhimento;
            
            const elKpiAgencia = document.getElementById('kpi-agencia'); 
            if (elKpiAgencia) elKpiAgencia.innerText = totalAgencia;

            window.dadosGraficosAtuais = { 
                Cemiterios: cemiterios, 
                Volume_Periodo: linhasTempo, 
                Causas: causas, 
                Atendentes_Acolhimento: atendentesAcolhimento, 
                Atendentes_Agencia: atendentesAgencia, 
                Sepulturas: sepulturas, 
                Funerarias: funerarias, 
                Tempo_Resolucao: tempos, 
                Isencoes: isencoes, 
                Quadras: quadras, 
                Hospitais: hospitais, 
                Bairros: bairros, 
                Municipios: municipios, 
                Valores_GRM: valores,
                Classificacao: classificacoes,
                EstadoCivil: estadosCivis,
                Capelas: capelas,
                TiposAtendimento: tiposAtendimento
            };

            const draw = (id, dataObj, lbl, type='bar', color='#3b82f6') => {
                const ctx = document.getElementById(id); 
                if(!ctx || !window.Chart) return;
                
                let sorted = []; 
                if(id === 'grafico-linhas') { 
                    sorted = Object.entries(dataObj).sort((a,b) => { 
                        let da = a[0].split('/').reverse().join('-'); 
                        let db = b[0].split('/').reverse().join('-'); 
                        return new Date(da) - new Date(db); 
                    }); 
                } else if (id.includes('atendentes')) {
                    sorted = Object.entries(dataObj).sort((a,b) => b[1] - a[1]); 
                } else { 
                    sorted = Object.entries(dataObj).sort((a,b) => b[1] - a[1]).slice(0, 10); 
                }
                
                let displayLabels = sorted.map(x => {
                    let text = String(x[0]);
                    return text.length > 35 ? text.substring(0, 32) + '...' : text;
                });

                if(window.chartInstances && window.chartInstances[id]) {
                    window.chartInstances[id].destroy();
                } else if (!window.chartInstances) {
                    window.chartInstances = {};
                }
                
                window.chartInstances[id] = new Chart(ctx, { 
                    type: type, 
                    data: { 
                        labels: displayLabels, 
                        datasets: [{ 
                            label: lbl, 
                            data: sorted.map(x=>x[1]), 
                            backgroundColor: (type==='doughnut'||type==='pie') ? ['#10b981','#3b82f6','#f59e0b','#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9'] : color, 
                            borderColor: type==='line' ? color : undefined, 
                            fill: type==='line' ? false : true, 
                            tension: type==='line' ? 0.1 : 0 
                        }] 
                    }, 
                    options: { 
                        indexAxis: type==='bar'?'y':'x', 
                        maintainAspectRatio: false 
                    } 
                });
                
                if(id === 'grafico-causas') { 
                    window.dadosEstatisticasExportacao = sorted.map(([c,q]) => ({"Causa": c, "Qtd": q})); 
                }
            };
            
            draw('grafico-cemiterios', cemiterios, 'Sepultamentos por Cemitério', 'doughnut'); 
            draw('grafico-linhas', linhasTempo, 'Volume de Sepultamentos', 'line', '#8b5cf6'); 
            draw('grafico-causas', causas, 'Top 10 Causas', 'bar', '#3b82f6'); 
            draw('grafico-atendentes-acolhimento', atendentesAcolhimento, 'Produtividade: Acolhimento', 'bar', '#10b981'); 
            draw('grafico-atendentes-agencia', atendentesAgencia, 'Produtividade: Agência', 'bar', '#8b5cf6'); 
            draw('grafico-sepulturas', sepulturas, 'Tipos de Sepultura', 'bar', '#f59e0b'); 
            draw('grafico-funerarias', funerarias, 'Top Funerárias', 'bar', '#8b5cf6'); 
            draw('grafico-tempo-resolucao', tempos, 'Tempo de Resolução', 'doughnut'); 
            draw('grafico-isencao', isencoes, 'Perfil Social (Isenções)', 'pie'); 
            draw('grafico-quadras', quadras, 'Quadras Mais Utilizadas', 'bar', '#0ea5e9'); 
            draw('grafico-hospitais', hospitais, 'Hospitais (Local Óbito)', 'bar', '#ec4899'); 
            draw('grafico-bairros', bairros, 'Bairros dos Contribuintes', 'bar', '#14b8a6'); 
            draw('grafico-municipios', municipios, 'Municípios', 'bar', '#f43f5e');
            
            let mediaValor = qtdValores > 0 ? (totalValores / qtdValores).toFixed(2) : "0.00"; 
            const elT = document.getElementById('titulo-grafico-valores'); 
            if(elT) elT.innerText = `Faixas de Valores Pagos (Média: R$ ${mediaValor})`; 
            draw('grafico-valores', valores, `Valores Pagos GRM`, 'bar', '#eab308');

            draw('grafico-classificacao', classificacoes, 'Classificação (Adulto x Anjo)', 'doughnut');
            draw('grafico-estado-civil', estadosCivis, 'Estado Civil', 'bar', '#f43f5e');
            draw('grafico-capelas', capelas, 'Uso das Capelas', 'bar', '#8b5cf6');
            draw('grafico-tipo-atendimento', tiposAtendimento, 'Particular vs Municipal', 'pie');
        });
};
// ============================================================================
// ADMINISTRAÇÃO E ADMIN TABS (MÚLTIPLAS FUNCIONALIDADES INTEGRADAS)
// ============================================================================

window.abrirAdmin = function() { 
    if (window.usuarioLogado && window.usuarioLogado.nivel && window.usuarioLogado.nivel !== 'COMPLETO') { 
        alert("Acesso Negado: Apenas contas com nível 'Completo' podem acessar a Administração."); 
        return; 
    } 
    safeDisplay('modal-admin', 'block'); 
    window.abrirAba('tab-equipe'); 
}

window.fecharModalAdmin = function() { 
    safeDisplay('modal-admin', 'none'); 
}

window.abrirAba = function(id) {
    // 1. Esconde tudo e remove a classe "active" das abas e botões
    document.querySelectorAll('.tab-pane').forEach(e => {
        e.classList.remove('active');
        e.style.display = 'none';
    });
    document.querySelectorAll('.tab-header .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 2. Mostra a aba correta
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('active');
        el.style.display = 'block';
    }

    // 3. Pinta o botão correto (usando os índices originais do seu código)
    const botoesTop = document.querySelectorAll('.tab-btn');
    if(botoesTop.length >= 6) {
        if (id === 'tab-equipe') botoesTop[0].classList.add('active'); 
        if (id === 'tab-contribuintes') botoesTop[1].classList.add('active'); 
        if (id === 'tab-backup') botoesTop[2].classList.add('active'); 
        if (id === 'tab-stats') botoesTop[3].classList.add('active'); 
        if (id === 'tab-logs') botoesTop[4].classList.add('active');
        if (id === 'tab-config') botoesTop[5].classList.add('active');
    }

    // 4. GATILHOS AUTOMÁTICOS QUE PUXAM DADOS DO FIREBASE
    if (id === 'tab-equipe' && typeof window.listarEquipe === 'function') {
        window.listarEquipe(); 
    }
    
    if (id === 'tab-logs' && typeof window.carregarLogs === 'function') {
        window.carregarLogs(); 
    }
    
    if (id === 'tab-stats' && typeof window.carregarEstatisticas === 'function') {
        window.carregarEstatisticas('mes'); // Ou '7'
    }
    
    if (id === 'tab-config') {
        // Recuperamos a parte original de puxar as configurações que tinha sumido!
        const database = typeof window.getDB === 'function' ? window.getDB() : db;
        if(!database) return;

        database.collection("config").doc("geral").get().then(doc => {
            if (doc.exists) {
                const data = doc.data();
                
                const configWpp = document.getElementById('config_wpp_fixo');
                if(configWpp) configWpp.value = data.wpp_fixo || '';
                
                const configApi = document.getElementById('config_api_transparencia');
                if(configApi) configApi.value = data.api_transparencia || '';

                const configAvisoTit = document.getElementById('config_aviso_titulo');
                if(configAvisoTit) configAvisoTit.value = data.aviso_titulo || '';

                const configAvisoVer = document.getElementById('config_aviso_versao');
                if(configAvisoVer) configAvisoVer.value = data.aviso_versao || '';

                const configAvisoCont = document.getElementById('config_aviso_conteudo');
                if(configAvisoCont) configAvisoCont.value = data.aviso_conteudo || '';

                const configAvisoAtivo = document.getElementById('config_aviso_ativo');
                if(configAvisoAtivo) configAvisoAtivo.checked = data.aviso_ativo === true;
            }
        }).catch(err => console.log("Erro ao carregar config:", err));
    }
};
// ============================================================================
// LIGADOR UNIVERSAL (Chama o chat assim que detectar que você logou)
// ============================================================================
const radarFinal = setInterval(() => {
    if (window.usuarioLogado) {
        window.iniciarChat();
        clearInterval(radarFinal);
    }
}, 500);
// ============================================================================
// 4. RADAR DE LOGIN (À Prova de Erros do VS Code)
// ============================================================================
window.radarFinalChat = setInterval(() => {
    if (window.usuarioLogado) {
        if (typeof window.iniciarChat === 'function') {
            window.iniciarChat();
        }
        clearInterval(window.radarFinalChat);
    }
}, 500);
// ============================================================================
// CHAT INTERNO - MODO SOBREVIVÊNCIA EXTREMA 
// ============================================================================

window.chatListenerAtivo = false;
window.unreadMessages = 0;
window.primeiroLoadChat = true;

window.iniciarChat = function() {
    if (window.chatListenerAtivo) return;
    window.chatListenerAtivo = true;

    console.log("💣 Motor de Sobrevivência do Chat Iniciado!");

    // Destrói os elementos velhos e bugados
    const oldBtn = document.getElementById('btn-chat-flutuante');
    if (oldBtn) oldBtn.remove();
    const oldPanel = document.getElementById('chat-panel');
    if (oldPanel) oldPanel.remove();

    // 1. Cria o Painel
    const panel = document.createElement('div');
    panel.id = 'chat-panel';
    // O painel nasce escondido (display: none)
    panel.style.cssText = 'display: none !important; position: fixed !important; bottom: 80px !important; right: 20px !important; width: 340px !important; height: 480px !important; background: white !important; border-radius: 12px !important; box-shadow: 0 5px 25px rgba(0,0,0,0.3) !important; z-index: 9999998 !important; flex-direction: column !important; overflow: hidden !important; border: 1px solid #cbd5e1 !important; opacity: 1 !important; transform: scale(1) !important; visibility: visible !important;';
    
    panel.innerHTML = `
        <div style="background:linear-gradient(135deg, #3b82f6, #2563eb); color:white; padding:15px; font-weight:bold; font-size:15px; display:flex; justify-content:space-between; align-items:center;">
            Comunicação Interna <span onclick="document.getElementById('chat-panel').style.setProperty('display', 'none', 'important');" style="cursor:pointer; font-size:20px;">✖</span>
        </div>
        <div id="chat-body" style="flex:1; padding:15px; background:#f8fafc; overflow-y:auto; display:flex; flex-direction:column; gap:10px;"></div>
        <div style="padding:12px; background:white; border-top:1px solid #e2e8f0; display:flex; gap:8px; align-items:center;">
            <select id="chat-destinatario" style="padding:8px; border-radius:20px; border:1px solid #cbd5e1; font-size:11px; outline:none; background:#f8fafc; max-width:90px; cursor:pointer;"><option value="Todos">Todos</option></select>
            <input type="text" id="chat-input" placeholder="Mensagem..." style="flex:1; padding:10px 12px; border:1px solid #cbd5e1; border-radius:20px; font-size:13px; outline:none;">
            <button id="btn-enviar-msg" style="background:#3b82f6; color:white; border:none; width:40px; height:40px; border-radius:50%; cursor:pointer; font-size:16px;">➤</button>
        </div>
    `;
    document.body.appendChild(panel);

    // 2. Cria o Botão
    const btn = document.createElement('button');
    btn.id = 'btn-chat-flutuante';
    btn.innerHTML = '💬 Chat Interno <span id="chat-badge" style="display:none; position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; border-radius:50%; padding:2px 6px; font-size:10px; font-weight:bold; border:2px solid white;">0</span>';
    btn.style.cssText = 'position: fixed !important; bottom: 20px !important; right: 20px !important; background: #3b82f6 !important; color: white !important; border: none !important; padding: 12px 20px !important; border-radius: 50px !important; font-weight: bold !important; font-size: 14px !important; z-index: 9999999 !important; cursor: pointer !important; box-shadow: 0 4px 10px rgba(0,0,0,0.3) !important; display: flex !important; align-items: center !important; gap: 8px !important; opacity: 1 !important; visibility: visible !important;';
    
    // O Clique Inline: Não depende de funções externas, funciona mesmo com erro no Firebase!
    btn.addEventListener('click', function(e) {
        e.preventDefault();
        const p = document.getElementById('chat-panel');
        if (p.style.getPropertyValue('display') === 'none') {
            p.style.setProperty('display', 'flex', 'important'); // Abre
            document.getElementById('chat-badge').style.display = 'none';
            document.getElementById('chat-badge').innerText = '0';
            const b = document.getElementById('chat-body');
            b.scrollTop = b.scrollHeight;
        } else {
            p.style.setProperty('display', 'none', 'important'); // Fecha
        }
    });
    document.body.appendChild(btn);

    // =======================================================
    // Conexão com o Firebase
    const db = typeof window.getDB === 'function' ? window.getDB() : window.db;
    if (!db) return;

    db.collection("equipe").get().then(snap => {
        const select = document.getElementById('chat-destinatario');
        snap.forEach(doc => {
            const u = doc.data();
            if (u.nome) select.innerHTML += `<option value="${u.nome}">${u.nome.split(' ')[0]}</option>`;
        });
    }).catch(() => {});

    document.getElementById('btn-enviar-msg').onclick = function() {
        const input = document.getElementById('chat-input');
        const dest = document.getElementById('chat-destinatario').value;
        const texto = input.value.trim();
        if (!texto) return;

        input.value = '';
        db.collection("mensagens").add({
            usuario: (window.usuarioLogado && window.usuarioLogado.nome) ? window.usuarioLogado.nome : 'Usuário',
            destinatario: dest,
            texto: texto,
            data: new Date().toISOString()
        }).then(() => {
            document.getElementById('chat-body').scrollTop = document.getElementById('chat-body').scrollHeight;
        }).catch(err => {
            alert("Erro ao enviar: " + err.message);
            input.value = texto; 
        });
    };

    document.getElementById('chat-input').onkeypress = (e) => {
        if (e.key === 'Enter') document.getElementById('btn-enviar-msg').click();
    };

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    db.collection("mensagens").where("data", ">=", ontem.toISOString()).orderBy("data", "asc").onSnapshot(snap => {
        const body = document.getElementById('chat-body');
        if(!body) return;
        body.innerHTML = '';
        
        snap.forEach(doc => {
            const m = doc.data();
            const myName = (window.usuarioLogado && window.usuarioLogado.nome) ? window.usuarioLogado.nome : '';
            if (m.destinatario && m.destinatario !== 'Todos' && m.destinatario !== myName && m.usuario !== myName) return;
            
            const isMe = m.usuario === myName;
            const hora = m.data ? new Date(m.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
            const div = document.createElement('div');
            div.style.cssText = `margin-bottom:8px; padding:8px 12px; border-radius:${isMe ? '12px 12px 0 12px' : '12px 12px 12px 0'}; background:${isMe ? '#3b82f6' : '#fff'}; color:${isMe ? '#fff' : '#1e293b'}; border:${isMe ? 'none' : '1px solid #e2e8f0'}; max-width:85%; ${isMe ? 'margin-left:auto' : 'margin-right:auto'}; font-size:13px; line-height:1.4;`;
            div.innerHTML = `<div style="font-size:10px; font-weight:bold; opacity:0.8; margin-bottom:4px;">${m.usuario || 'Usuário'}</div>${m.texto}<div style="font-size:9px; opacity:0.6; text-align:right; margin-top:4px;">${hora}</div>`;
            body.appendChild(div);
        });
        
        body.scrollTop = body.scrollHeight;
        
        if (!window.primeiroLoadChat && document.getElementById('chat-panel').style.getPropertyValue('display') === 'none') {
            const badge = document.getElementById('chat-badge');
            badge.innerText = (parseInt(badge.innerText) || 0) + 1;
            badge.style.display = 'block';
        }
        window.primeiroLoadChat = false;
    });
};

window.radarNuclear = setInterval(() => {
    if (window.usuarioLogado) {
        window.iniciarChat();
        clearInterval(window.radarNuclear);
    }
}, 1000);
// ============================================================================
// GESTÃO DE EQUIPE - LISTAGEM E EDIÇÃO INLINE (COM PERMISSÕES GRANULARES)
// ============================================================================

window.listarEquipe = function() {
    const ul = document.getElementById('lista-equipe');
    if(!ul) return;

    window.getDB().collection("equipe").onSnapshot(function(snap) {
        ul.innerHTML = '';
        const fragment = document.createDocumentFragment();

        snap.forEach(function(doc) {
            const u = doc.data();
            const id = doc.id;

            let nomeSeguro = (u.nome || '').trim();
            if (!nomeSeguro) nomeSeguro = 'Usuário';

            const names = nomeSeguro.split(' ').filter(n => n.length > 0);
            let iniciais = 'U';
            if (names.length > 0) {
                iniciais = names[0][0].toUpperCase();
                if (names.length > 1) iniciais += names[names.length - 1][0].toUpperCase(); 
                else if (names[0].length > 1) iniciais += names[0][1].toUpperCase();
            }

            const colors = ['#e0f2fe', '#fef3c7', '#dcfce3', '#f3e8ff', '#ffe4e6', '#ccfbf1'];
            const textColors = ['#0284c7', '#d97706', '#16a34a', '#9333ea', '#e11d48', '#0d9488'];
            const colorIndex = nomeSeguro.length % colors.length;

            let badgeNivel = `<span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-left:5px; vertical-align:middle;">${u.nivel || 'COMPLETO'}</span>`;
            
            let avatarHtml = `<div class="avatar-circle" style="background-color: ${colors[colorIndex]}; color: ${textColors[colorIndex]};">${iniciais}</div>`;
            if (u.foto_url) {
                avatarHtml = `<img src="${u.foto_url}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid ${colors[colorIndex]};">`;
            }

            // Tradutor de Compatibilidade: Lê as permissões antigas e ajusta as caixas novas
            let p = u.permissoes || {};
            if (!u.permissoes) {
                let n = u.nivel || 'COMPLETO';
                p = {
                    admin: (n === 'COMPLETO'),
                    acolhimento: (n === 'AGENCIA_ACOLHIMENTO') ? 'VIEW' : 'EDIT',
                    agencia: (n === 'ACOLHIMENTO_AGENCIA') ? 'VIEW' : 'EDIT',
                    sepulturas: (n === 'COMPLETO') ? 'EDIT' : 'NONE'
                };
            }

            let li = document.createElement('li');
            li.className = 'table-equipe-row';
            
            li.innerHTML = `
                <div class="row-data" style="display: flex; width: 100%; align-items: center; padding: 5px 0;">
                    <div class="col-user" style="flex: 2; display: flex; align-items: center; gap: 15px;">
                        ${avatarHtml}
                        <div style="display: flex; flex-direction: column;">
                            <span style="color:#1e293b; font-size:14px; font-weight:600;">${nomeSeguro} ${badgeNivel}</span>
                            <span style="color:#94a3b8; font-size:12px;">${u.email||u.login||''}</span>
                        </div>
                    </div>
                    <div class="col-login" style="flex: 1.5; font-size: 13px;">${u.matricula ? 'Mat. ' + u.matricula : (u.login||'')}</div>
                    <div class="col-pass" style="flex: 1; font-size: 13px;">***</div>
                    <div class="col-actions" style="width: 100px; display: flex; gap: 8px; justify-content: flex-end;">
                        <button class="btn-action-edit" onclick="window.toggleEdicaoInline('${id}')" title="Editar Usuário">✏️</button>
                        <button class="btn-action-delete" onclick="window.excluirFuncionario('${id}')" title="Excluir">🗑️</button>
                    </div>
                </div>

                <div id="edit-inline-${id}" class="edit-form-inline">
                    <div style="padding: 15px; border-top: 1px solid #e2e8f0; border-bottom: 2px dashed #cbd5e1; margin-bottom: 10px; background: #fff;">
                        <span style="font-size: 13px; font-weight: 700; color: #f59e0b; display: block; margin-bottom: 15px;">✏️ Editando: ${nomeSeguro}</span>
                        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 10px;">
                            <div><label style="font-size: 11px; font-weight: bold;">NOME COMPLETO</label><input type="text" id="edit-nome-${id}" value="${u.nome||''}"></div>
                            <div><label style="font-size: 11px; font-weight: bold;">MATRÍCULA</label><input type="text" id="edit-matricula-${id}" value="${u.matricula||''}"></div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 10px;">
                            <div><label style="font-size: 11px; font-weight: bold;">NOVA SENHA (OPCIONAL)</label><input type="password" id="edit-senha-${id}" placeholder="Deixe em branco para manter"></div>
                            <div>
                                <label style="font-size: 11px; font-weight: bold;">ATUALIZAR FOTO</label>
                                <input type="file" id="edit-foto-upload-${id}" accept="image/png, image/jpeg, image/jpg" style="font-size: 11px; width: 100%; padding: 5px; border: 1px dashed #cbd5e1; border-radius: 6px; background: white;">
                                <input type="hidden" id="edit-foto-url-${id}" value="${u.foto_url||''}">
                                <span id="upload-status-${id}" style="font-size: 11px; color: #3b82f6; display: block; margin-top: 5px;"></span>
                            </div>
                        </div>

                        <div style="margin-bottom: 15px; margin-top: 15px; background: #fffbeb; padding: 15px; border-radius: 8px; border: 1px solid #fde68a;">
                            <label style="color: #d97706; font-size: 12px; margin-bottom: 10px; display: block;">PERMISSÕES DO SISTEMA (MÓDULOS)</label>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <div>
                                    <span style="font-size: 10px; font-weight: bold; color: #475569; display:block; margin-bottom:3px;">🏠 ACOLHIMENTO</span>
                                    <select id="edit-perm-acolhimento-${id}" style="padding: 6px; font-size: 11px; font-weight:bold;">
                                        <option value="EDIT" ${p.acolhimento === 'EDIT' ? 'selected' : ''}>Acesso Total</option>
                                        <option value="VIEW" ${p.acolhimento === 'VIEW' ? 'selected' : ''}>Apenas Visualizar</option>
                                        <option value="NONE" ${p.acolhimento === 'NONE' ? 'selected' : ''}>Sem Acesso</option>
                                    </select>
                                </div>
                                <div>
                                    <span style="font-size: 10px; font-weight: bold; color: #475569; display:block; margin-bottom:3px;">🏢 AGÊNCIA</span>
                                    <select id="edit-perm-agencia-${id}" style="padding: 6px; font-size: 11px; font-weight:bold;">
                                        <option value="EDIT" ${p.agencia === 'EDIT' ? 'selected' : ''}>Acesso Total</option>
                                        <option value="VIEW" ${p.agencia === 'VIEW' ? 'selected' : ''}>Apenas Visualizar</option>
                                        <option value="NONE" ${p.agencia === 'NONE' ? 'selected' : ''}>Sem Acesso</option>
                                    </select>
                                </div>
                                <div>
                                    <span style="font-size: 10px; font-weight: bold; color: #475569; display:block; margin-bottom:3px;">🪦 SEPULTURAS</span>
                                    <select id="edit-perm-sepulturas-${id}" style="padding: 6px; font-size: 11px; font-weight:bold;">
                                        <option value="EDIT" ${p.sepulturas === 'EDIT' ? 'selected' : ''}>Acesso Total</option>
                                        <option value="VIEW" ${p.sepulturas === 'VIEW' ? 'selected' : ''}>Apenas Visualizar</option>
                                        <option value="NONE" ${p.sepulturas === 'NONE' ? 'selected' : ''}>Sem Acesso</option>
                                    </select>
                                </div>
                            </div>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; text-transform:none; font-size: 12px; color: #ef4444; font-weight: bold; margin-top: 15px;">
                                <input type="checkbox" id="edit-perm-admin-${id}" ${p.admin ? 'checked' : ''}> 
                                Conceder acesso total à Engrenagem Admin (Configurações e Equipe)
                            </label>
                        </div>
                        
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button onclick="window.toggleEdicaoInline('${id}')" style="padding: 8px 15px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; color: #64748b; cursor: pointer; font-weight: bold;">Cancelar</button>
                            <button id="btn-salvar-inline-${id}" onclick="window.salvarEdicaoInline('${id}')" style="padding: 8px 15px; background: #3b82f6; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold;">Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            `;
            fragment.appendChild(li);
        });
        ul.appendChild(fragment);
    });
};

window.salvarEdicaoInline = function(id) {
    const nome = document.getElementById(`edit-nome-${id}`).value;
    const matricula = document.getElementById(`edit-matricula-${id}`).value;
    const senha = document.getElementById(`edit-senha-${id}`).value;
    const foto_url = document.getElementById(`edit-foto-url-${id}`).value;
    
    const permissoes = {
        admin: document.getElementById(`edit-perm-admin-${id}`).checked,
        acolhimento: document.getElementById(`edit-perm-acolhimento-${id}`).value,
        agencia: document.getElementById(`edit-perm-agencia-${id}`).value,
        sepulturas: document.getElementById(`edit-perm-sepulturas-${id}`).value
    };
    
    // Mantém a etiqueta (badge) da tabela compatível e bonita
    let nivelExibicao = "LIMITADO";
    if (permissoes.admin) nivelExibicao = "COMPLETO";
    else if (permissoes.acolhimento === 'EDIT' && permissoes.agencia === 'VIEW') nivelExibicao = "ACOLHIMENTO";
    else if (permissoes.agencia === 'EDIT' && permissoes.acolhimento === 'VIEW') nivelExibicao = "AGÊNCIA";

    if (!nome) { alert("Nome é obrigatório."); return; }

    const updateData = { nome, matricula, permissoes, nivel: nivelExibicao };
    if (senha) updateData.senha = senha;
    if (foto_url) updateData.foto_url = foto_url;

    window.getDB().collection("equipe").doc(id).update(updateData).then(() => {
        alert("Usuário atualizado com sucesso!");
        window.toggleEdicaoInline(id); // Fecha a sanfona
    }).catch(e => alert("Erro ao atualizar: " + e.message));
};