// ============================================================================
// CONFIGURAÇÕES GLOBAIS E FIREBASE
// ============================================================================
const SYSTEM_VERSION = "1.5";
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

window.chatListenerAtivo = false;
window.primeiroLoadChat = true;
window.chatAberto = false;
window.unreadMessages = 0;

window.idLiberacaoAtual = null; 
window.idTransferenciaResponsavelAtual = null; 
window.nomePastaPadrao = 'PROTOCOLO_NOME';

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

// ============================================================================
// FUNÇÃO DE EXIBIÇÃO SEGURA COM Z-INDEX (Correção de Sobreposição)
// ============================================================================
function safeDisplay(id, type, zIndex = null) { 
    const el = document.getElementById(id); 
    if (el) {
        el.style.display = type; 
        if (zIndex && type !== 'none') {
            el.style.zIndex = zIndex;
        }
    }
}

// ============================================================================
// INTEGRAÇÃO DE E-MAIL AUTOMÁTICO (EMAILJS)
// ============================================================================
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
        dEx = `${ps[2]}/${ps[1]}/${parseInt(ps[0])+(c==='ANJO'?2:3)}`; 
    }
    
    let nA = (window.usuarioLogado && window.usuarioLogado.nome ? window.usuarioLogado.nome : (dados.atendente_sistema || 'N/A')).toUpperCase();
    let isTanato = (dados.tanato === 'SIM' || dados.chk_tanato === 'SIM');

    let linkGpsHtml = "";
    if (dados.geo_coords) {
        const cleanCoords = dados.geo_coords.replace(/[^0-9.,\-]/g, '');
        if (cleanCoords && cleanCoords.includes(',')) {
            linkGpsHtml = `<p style="margin: 0 0 8px 0;"><b>📍 Localização da Sepultura:</b> <a href="https://www.google.com/maps/search/?api=1&query=${cleanCoords}" target="_blank" style="color: #3b82f6; text-decoration: none;">Abrir no Google Maps</a></p>`;
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
            <p style="font-size: 11px; margin-top: 5px;">(Legislação: 3 anos para Adultos / 2 anos para Crianças até 11 anos)</p>
            <p style="font-weight: bold; margin-top: 15px; color: #b91c1c;">⚠️ ATENÇÃO: COMPAREÇA OU ENTRE EM CONTATO NO PRAZO MÍNIMO DE 90 DIAS ANTES DA DATA DE EXUMAÇÃO PARA ABERTURA DE PROCESSO.</p>
        </div>
        
        <div style="margin-top: 20px; font-size: 12px; text-align: justify; background: #fef2f2; padding: 15px; border: 1px solid #fca5a5; border-radius: 6px;">
            <p style="margin: 0 0 5px 0;"><b>COMUNICADO AOS FAMILIARES E FUNERÁRIAS:</b></p>
            <p style="margin: 0; line-height: 1.5;">Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos na agência: <b>GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL), TAXAS MUNICIPAIS PAGAS e INVOL.</b></p>
        </div>
    </div>
    `;
    
    const templateParams = {
        to_email: emailDestino,
        nome_falecido: (dados.nome || '').toUpperCase(),
        protocolo: p,
        html_comprovante: htmlEmail
    };
    
    emailjs.send("default_service", "template_knlaoh1", templateParams)
        .then(function(res) {
            window.registrarHistorico(dados.id, 'DOCUMENTO', `E-mail c/ comprovante enviado para ${emailDestino}`);
            console.log("E-mail automático enviado com sucesso!", res.status);
        })
        .catch(function(err) {
            console.error("Falha ao enviar e-mail:", err);
        });
};

// ============================================================================
// CHAT INTERNO (MESSENGER INTRANET)
// ============================================================================
window.toggleChat = function() {
    const panel = document.getElementById('chat-panel');
    if (!panel) return;
    
    window.chatAberto = !window.chatAberto;
    
    if (window.chatAberto) {
        panel.classList.add('open');
        const badge = document.getElementById('chat-badge');
        if (badge) {
            badge.style.display = 'none';
        }
        window.unreadMessages = 0;
        
        setTimeout(() => {
            const body = document.getElementById('chat-body');
            if (body) {
                body.scrollTop = body.scrollHeight;
            }
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.focus();
            }
        }, 100);
    } else {
        panel.classList.remove('open');
    }
}

window.enviarMensagemChat = function() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    
    const destSelect = document.getElementById('chat-destinatario');
    const text = input.value.trim();
    
    if (!text || !window.usuarioLogado || !window.usuarioLogado.nome) return;
    
    let dest = destSelect ? destSelect.value : 'Todos';

    getDB().collection('mensagens').add({ 
        texto: text, 
        usuario: window.usuarioLogado.nome, 
        destinatario: dest, 
        data: new Date().toISOString() 
    }).then(() => {
        input.value = '';
        setTimeout(() => { 
            const body = document.getElementById('chat-body'); 
            if (body) {
                body.scrollTop = body.scrollHeight; 
            }
        }, 50);
    }).catch(e => {
        console.error("Erro ao enviar mensagem no chat:", e); 
        alert("Erro ao enviar a mensagem. Verifique sua conexão.");
    });
}

window.checarChatEnter = function(e) { 
    if (e.key === 'Enter') {
        window.enviarMensagemChat(); 
    }
}

// ============================================================================
// MODAL DE NOVIDADES
// ============================================================================
window.fecharModalNovidades = function() {
    localStorage.setItem('versao_sistema_lida', SYSTEM_VERSION);
    safeDisplay('modal-novidades', 'none');
}

// ============================================================================
// IMPORTAÇÃO E BUSCA DE BENEFÍCIOS (Com proteção Null Check)
// ============================================================================
window.importarBeneficiarios = function() {
    const fileInput = document.getElementById('file-import-beneficios');
    if (!fileInput) return;
    
    const file = fileInput.files[0];
    
    if (!file) { 
        alert("Por favor, selecione um arquivo Excel ou CSV."); 
        return; 
    }

    const statusEl = document.getElementById('import-status');
    if (statusEl) {
        statusEl.innerText = "Lendo arquivo na memória... Aguarde."; 
        statusEl.style.color = "#d97706";
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rows = window.XLSX.utils.sheet_to_json(worksheet, {defval: ""});
            
            if (rows.length === 0) { 
                if (statusEl) statusEl.innerText = "A planilha parece estar vazia."; 
                return; 
            }
            
            if (statusEl) {
                statusEl.innerText = `Processando ${rows.length} registros. Iniciando envio para o servidor (lotes de 500)...`;
            }
            
            const dbInstance = getDB(); 
            if (!dbInstance) return;
            
            let batch = dbInstance.batch(); 
            let count = 0;
            let cpfsSalvos = 0;
            
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
                
                if (cpfStr.length === 11) {
                    cpfParcial = cpfStr.substring(3, 9); 
                } else if (cpfStr.length === 6) {
                    cpfParcial = cpfStr; 
                }
                
                if (cpfParcial && nomeRaw) {
                    let nomeLimpo = String(nomeRaw).toUpperCase().trim();
                    let docId = nisStr ? nisStr : (cpfParcial + "_" + nomeLimpo.replace(/[^A-Z0-9]/g, '').substring(0, 15)); 
                    
                    let docRef = dbInstance.collection("beneficiarios").doc(docId);
                    
                    batch.set(docRef, { 
                        cpf_parcial: cpfParcial, 
                        nis: nisStr, 
                        nome: nomeLimpo, 
                        data_importacao: new Date().toISOString() 
                    });
                    
                    count++; 
                    cpfsSalvos++;
                    
                    if (count === 490) { 
                        await batch.commit(); 
                        if (statusEl) {
                            statusEl.innerText = `Enviando... ${cpfsSalvos} registros salvos de ${rows.length}.`; 
                        }
                        batch = dbInstance.batch(); 
                        count = 0; 
                    }
                }
            }
            if (count > 0) {
                await batch.commit();
            }
            
            if (statusEl) {
                statusEl.innerText = `✅ Importação concluída! ${cpfsSalvos} beneficiários cadastrados na base.`; 
                statusEl.style.color = "#10b981"; 
            }
            
            fileInput.value = ""; 
            window.beneficiariosCache = null; 
            
            window.registrarHistorico("SISTEMA", "CADASTRO", `Base de benefícios importada: ${cpfsSalvos} registros`);
        } catch (err) { 
            console.error("Erro na importação:", err);
            if (statusEl) {
                statusEl.innerText = "❌ Erro ao processar a planilha. Verifique o formato."; 
                statusEl.style.color = "red"; 
            }
        }
    };
    reader.readAsArrayBuffer(file);
};

window.abrirModalBuscaBeneficio = function() {
    const inputBusca = document.getElementById('input_busca_beneficio');
    
    if (inputBusca && !document.getElementById('btn-api-gov')) {
        const btnGov = document.createElement('button');
        btnGov.id = 'btn-api-gov'; 
        btnGov.type = 'button'; 
        btnGov.className = 'btn-novo';
        btnGov.style.backgroundColor = '#0369a1'; 
        btnGov.style.width = '35%'; 
        btnGov.style.justifyContent = 'center';
        btnGov.innerHTML = '🌐 API Federal'; 
        btnGov.onclick = window.consultarApiGoverno;
        inputBusca.parentNode.appendChild(btnGov); 
        inputBusca.style.width = '45%';
    }
    
    if (inputBusca) {
        inputBusca.value = '';
    }
    
    const resDiv = document.getElementById('resultado-busca-beneficio');
    if (resDiv) {
        resDiv.innerHTML = '<span style="color:#64748b; font-size:12px;">Use a busca acima para encontrar o beneficiário.</span>';
    } 
    
    safeDisplay('modal-busca-beneficio', 'block', '10005');
}

window.fecharModalBuscaBeneficio = function() { 
    safeDisplay('modal-busca-beneficio', 'none'); 
}

window.realizarBuscaBeneficio = function() {
    const tipoElem = document.getElementById('tipo_busca_beneficio');
    const termoElem = document.getElementById('input_busca_beneficio');
    const divRes = document.getElementById('resultado-busca-beneficio');
    
    if (!divRes || !tipoElem || !termoElem) return;
    
    const tipo = tipoElem.value;
    let termo = termoElem.value.trim();

    if (!termo || (tipo !== 'NOME' && termo.length < 3)) { 
        divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">Digite um termo válido para buscar.</span>'; 
        return; 
    }
    
    divRes.innerHTML = '<span style="color:#64748b; font-size:12px;">⏳ Buscando na Base Local...</span>';
    
    if (!getDB()) {
        divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Sem conexão com o banco de dados.</span>';
        return;
    }
    
    if (tipo === 'NOME') {
        termo = termo.toUpperCase();
        
        const renderResultados = (lista) => {
            let filtrados = lista.filter(d => d.nome && d.nome.includes(termo)).slice(0, 30);
            
            if (filtrados.length === 0) { 
                divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Nenhum beneficiário encontrado com estes dados parciais na Base Local.</span>'; 
                return; 
            }
            
            let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
            filtrados.forEach(d => { 
                let safeName = d.nome.replace(/'/g, "\\'"); 
                html += `
                    <div style="background:#fff; border:1px solid #cbd5e1; padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold; color:#1e293b; font-size:13px;">${d.nome}</div>
                            <div style="font-size:11px; color:#64748b;">NIS: ${d.nis || '-'} | CPF: ***.${d.cpf_parcial || '---'}.***-**</div>
                        </div>
                        <button type="button" class="btn-novo" style="background-color:#10b981; padding:4px 8px; font-size:11px; width:auto;" onclick="window.aplicarIsencaoBeneficio('${safeName}', '${d.cpf_parcial || ''}', '${d.nis || ''}')">Aplicar Isenção</button>
                    </div>
                `; 
            });
            html += '</div>';
            divRes.innerHTML = html;
        };
        
        if (window.beneficiariosCache) {
            renderResultados(window.beneficiariosCache);
        } else {
            getDB().collection("beneficiarios").get().then(snap => { 
                window.beneficiariosCache = []; 
                snap.forEach(doc => window.beneficiariosCache.push(doc.data())); 
                renderResultados(window.beneficiariosCache); 
            }).catch(e => {
                console.error("Erro na busca de nome:", e);
                divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Erro ao realizar a busca de nomes.</span>';
            });
        }
    } else {
        let query = getDB().collection("beneficiarios");
        
        if (tipo === 'NIS') {
            query = query.where("nis", "==", termo.replace(/\D/g, ''));
        } else if (tipo === 'CPF') {
            let cpfLimpo = termo.replace(/\D/g, '');
            if (cpfLimpo.length === 11) {
                cpfLimpo = cpfLimpo.substring(3, 9);
            }
            query = query.where("cpf_parcial", "==", cpfLimpo);
        }
        
        query.limit(20).get().then(snap => {
            if (snap.empty) { 
                divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Nenhum beneficiário encontrado na base local. Tente pela API Federal ao lado.</span>'; 
                return; 
            }
            
            let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
            snap.forEach(doc => { 
                const d = doc.data(); 
                let safeName = d.nome.replace(/'/g, "\\'"); 
                html += `
                    <div style="background:#fff; border:1px solid #cbd5e1; padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold; color:#1e293b; font-size:13px;">${d.nome}</div>
                            <div style="font-size:11px; color:#64748b;">NIS: ${d.nis || '-'} | CPF: ***.${d.cpf_parcial || '---'}.***-**</div>
                        </div>
                        <button type="button" class="btn-novo" style="background-color:#10b981; padding:4px 8px; font-size:11px; width:auto;" onclick="window.aplicarIsencaoBeneficio('${safeName}', '${d.cpf_parcial || ''}', '${d.nis || ''}')">Aplicar Isenção</button>
                    </div>
                `; 
            });
            html += '</div>';
            divRes.innerHTML = html;
        }).catch(e => {
            console.error("Erro na consulta local:", e);
            divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Erro ao realizar a busca. Tente novamente.</span>';
        });
    }
}

window.consultarApiGoverno = async function() {
    const btn = document.getElementById('btn-api-gov');
    if(!btn) return;
    
    const originalText = btn.innerHTML; 
    btn.innerHTML = "⏳ Consultando..."; 
    btn.disabled = true;
    
    const cpfBuscaElem = document.getElementById('input_busca_beneficio');
    let cpfBusca = cpfBuscaElem ? cpfBuscaElem.value.replace(/\D/g, '') : '';
    const divRes = document.getElementById('resultado-busca-beneficio');
    
    if(!divRes) {
        btn.innerHTML = originalText; 
        btn.disabled = false;
        return;
    }

    if (cpfBusca.length !== 11 && cpfBusca.length !== 14) { 
        divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Para a API do Governo, digite o CPF completo (11 dígitos) ou NIS (14 dígitos) válido. Nomes não são suportados na busca Federal.</span>'; 
        btn.innerHTML = originalText; 
        btn.disabled = false; 
        return; 
    }
    
    try {
        const configDoc = await getDB().collection("config").doc("geral").get();
        const apiKey = (configDoc.exists && configDoc.data().api_transparencia) ? configDoc.data().api_transparencia : 'a76cec9a4e5d2b8d928a608b52f8f36d';
        
        const headers = new Headers(); 
        headers.append('chave-api-dados', apiKey); 
        headers.append('Accept', 'application/json');
        
        divRes.innerHTML = '<span style="color:#0369a1; font-size:12px;">⏳ Conectando aos servidores de Brasília... (Pode levar alguns segundos)</span>';
        
        let mesesParaTestar = [];
        for(let i=1; i<=3; i++) { 
            let d = new Date(); 
            d.setMonth(d.getMonth() - i); 
            mesesParaTestar.push(d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0')); 
        }
        
        let beneficiosEncontrados = [];
        let mesRefEncontrado = '';
        let nomeExtraidoApi = 'DADOS OBTIDOS DA API FEDERAL';
        
        const proxyUrl = 'https://corsproxy.io/?';
        
        for (let anoMes of mesesParaTestar) {
            let resBolsa = await fetch(proxyUrl + encodeURIComponent(`https://api.portaldatransparencia.gov.br/api-de-dados/bolsa-familia-disponivel-por-cpf-ou-nis?codigo=${cpfBusca}&anoMesCompetencia=${anoMes}&pagina=1`), { headers }).catch(() => null);
            let resBpc = await fetch(proxyUrl + encodeURIComponent(`https://api.portaldatransparencia.gov.br/api-de-dados/bpc-por-cpf-ou-nis?codigo=${cpfBusca}&anoMesCompetencia=${anoMes}&pagina=1`), { headers }).catch(() => null);
            
            if (resBolsa && resBolsa.ok) { 
                let data = await resBolsa.json(); 
                if (data && data.length > 0) { 
                    beneficiosEncontrados.push("Bolsa Família"); 
                    if(data[0].titularBolsaFamilia && data[0].titularBolsaFamilia.nome) {
                        nomeExtraidoApi = data[0].titularBolsaFamilia.nome; 
                    }
                } 
            }
            
            if (resBpc && resBpc.ok) { 
                let data = await resBpc.json(); 
                if (data && data.length > 0) { 
                    beneficiosEncontrados.push("BPC / LOAS"); 
                    if(data[0].beneficiario && data[0].beneficiario.nomePessoa) {
                        nomeExtraidoApi = data[0].beneficiario.nomePessoa; 
                    }
                } 
            }
            
            if (beneficiosEncontrados.length > 0) { 
                mesRefEncontrado = anoMes; 
                break; 
            }
        }
        
        if (beneficiosEncontrados.length > 0) {
            let benefText = `${nomeExtraidoApi} (${beneficiosEncontrados.join(', ')})`;
            divRes.innerHTML = `
                <div style="background:#ecfdf5; border:1px solid #10b981; padding:15px; border-radius:6px; text-align:center;">
                    <div style="font-weight:bold; color:#065f46; font-size:14px; margin-bottom:5px;">✅ BENEFÍCIO ATIVO (BASE FEDERAL)</div>
                    <div style="font-size:12px; color:#047857; margin-bottom:15px;">Programas: <b>${beneficiosEncontrados.join(', ')}</b><br>Ref: ${mesRefEncontrado}</div>
                    <button type="button" class="btn-novo" style="background-color:#10b981; padding:8px 15px; font-size:12px; width:100%;" onclick="window.aplicarIsencaoBeneficio('${benefText.replace(/'/g, "\\'")}', '${cpfBusca}', '')">✅ Aplicar Isenção Oficial</button>
                </div>
            `;
        } else { 
            divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Nenhum benefício ativo encontrado para este número na API Federal nos últimos 3 meses.<br>A API pode ter atrasos de atualização ou o navegador está bloqueando. Tente a busca Local.</span>'; 
        }
    } catch (error) { 
        console.error("Erro na API de Governo:", error);
        divRes.innerHTML = '<span style="color:#ef4444; font-size:12px;">❌ Erro ao conectar com o Governo (Verifique sua conexão ou bloqueio CORS). Tente usar a busca Local.</span>'; 
    }
    
    btn.innerHTML = originalText; 
    btn.disabled = false;
}

window.aplicarIsencaoBeneficio = function(nome, cpf, nis) {
    const selIsencao = document.getElementById('isencao'); 
    const inReq = document.getElementById('requisito');
    
    if(selIsencao) {
        selIsencao.value = "SIM"; 
    }
    if(inReq) {
        inReq.value = "CADUNICO / GOVERNO (SISTEMA)";
    }
    
    let msg = `✅ Isenção aplicada com sucesso na ficha!\n\n👤 Beneficiário(a): ${nome}`;
    
    if (cpf && String(cpf).trim() !== '' && cpf !== 'undefined') { 
        let cpfFmt = String(cpf); 
        if (cpfFmt.length === 6) {
            cpfFmt = `***.${cpfFmt}.***-**`; 
        } else if (cpfFmt.length === 11) {
            cpfFmt = cpfFmt.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"); 
        }
        msg += `\n📄 CPF: ${cpfFmt}`; 
    }
    
    if (nis && String(nis).trim() !== '' && nis !== 'undefined') {
        msg += `\n🔢 NIS: ${nis}`;
    }
    
    alert(msg); 
    window.fecharModalBuscaBeneficio();
}

// ============================================================================
// HISTÓRICO DE MOVIMENTAÇÕES
// ============================================================================
window.registrarHistorico = function(atendimentoId, tipo, descricao) {
    if (!getDB() || !atendimentoId) return;
    
    const registro = { 
        data: new Date().toISOString(), 
        usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Sistema', 
        tipo: tipo, 
        descricao: descricao 
    };
    
    getDB().collection("atendimentos").doc(atendimentoId).collection("historico").add(registro)
        .catch(e => console.warn("Erro ao registrar histórico:", e.message));
}

window.abrirModalHistorico = function(atendimentoId) {
    if (!getDB() || !atendimentoId) {
        alert("Erro: Atendimento não selecionado.");
        return;
    }
    
    const container = document.getElementById('historico-lista'); 
    if (!container) {
        console.error("Painel de histórico não encontrado no HTML.");
        return;
    }
    
    container.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;">Carregando histórico...</div>'; 
    safeDisplay('modal-historico', 'flex', '10005');
    
    getDB().collection("atendimentos").doc(atendimentoId).collection("historico").orderBy("data", "desc").get().then(snap => {
        if (snap.empty) { 
            container.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px;">Nenhuma movimentação registrada ainda.</div>'; 
            return; 
        }
        
        let html = '';
        snap.forEach(doc => {
            const h = doc.data(); 
            const dt = h.data ? new Date(h.data) : null;
            
            const dataFormatada = dt ? `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}` : '';
            
            const icones = { 
                'WHATSAPP': '📱', 
                'DOCUMENTO': '📄', 
                'EDICAO': '✏️', 
                'TRANSFERENCIA': '🔄', 
                'ASSINATURA': '✍️', 
                'CHECKLIST': '📋', 
                'CADASTRO': '📝', 
                'AGENCIA': '🏢', 
                'EXCLUSAO': '🗑️', 
                'SMS': '📨', 
                'LIBERACAO': '🔓' 
            };
            
            const icone = icones[h.tipo] || '📌';
            
            html += `
                <div class="historico-item">
                    <div class="historico-icon" style="background:#f1f5f9;color:#64748b;">${icone}</div>
                    <div class="historico-content">
                        <div class="historico-header-row">
                            <span class="historico-tipo" style="color:#64748b;border-color:#64748b;">${h.tipo || 'AÇÃO'}</span>
                            <span class="historico-data">${dataFormatada}</span>
                        </div>
                        <div class="historico-desc">${h.descricao || ''}</div>
                        <div class="historico-user">por ${h.usuario || 'Sistema'}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }).catch(e => {
        console.error("Erro ao carregar histórico:", e);
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;">Erro ao carregar histórico.</div>';
    });
}

window.fecharModalHistorico = function() { 
    safeDisplay('modal-historico', 'none'); 
}

// ============================================================================
// LOGIN E ACESSO VIA FIREBASE AUTH
// ============================================================================
window.fazerLogin = async function() {
    const inputU = document.getElementById('login-usuario');
    const inputP = document.getElementById('login-senha');
    const msgErro = document.getElementById('msg-erro-login');
    
    if(!inputU || !inputP) return; 
    
    const u = inputU.value.trim();
    const p = inputP.value; 
    
    if (msgErro) {
        msgErro.style.display = 'none';
    }

    if (p === "2026" && (u === "admin" || u === "Admin")) { 
        window.usuarioLogado = {
            nome: "Admin", 
            login: "admin", 
            nivel: "COMPLETO"
        }; 
        if(msgErro) { 
            msgErro.innerText = "Login com sucesso! Bem-vindo(a), Admin."; 
            msgErro.style.color = "#10b981"; 
            msgErro.style.display = 'block'; 
        }
        setTimeout(() => window.liberarAcesso(), 1200); 
        return; 
    }
    
    if (!getDB() || !window.auth) { 
        alert("Sem conexão com banco de dados Firebase."); 
        return; 
    }
    
    if (!u.includes('@')) { 
        if(msgErro) { 
            msgErro.innerText = "Digite o e-mail completo para login."; 
            msgErro.style.color = "red"; 
            msgErro.style.display = 'block'; 
        } 
        return; 
    }
    
    if(msgErro) { 
        msgErro.innerText = "Autenticando..."; 
        msgErro.style.color = "#64748b"; 
        msgErro.style.display = 'block'; 
    }
    
    try {
        await window.auth.signOut().catch(() => {});
        const userCredential = await window.auth.signInWithEmailAndPassword(u, p); 
        const userEmail = userCredential.user.email.toLowerCase();
        
        const dbInstance = getDB();
        if(!dbInstance) throw new Error("DB offline");
        
        const snapshot = await dbInstance.collection("equipe").where("email", "==", userEmail).get();
        
        if (!snapshot.empty) { 
            window.usuarioLogado = snapshot.docs[0].data(); 
            window.usuarioLogado.id = snapshot.docs[0].id; 
        } else {
            const allUsers = await dbInstance.collection("equipe").get(); 
            let foundUser = null;
            
            allUsers.forEach(doc => { 
                const d = doc.data(); 
                if (d.email && d.email.toLowerCase() === userEmail) { 
                    foundUser = d; 
                    foundUser.id = doc.id; 
                } 
            });
            
            if (foundUser) {
                window.usuarioLogado = foundUser; 
            } else {
                window.usuarioLogado = { 
                    nome: userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1), 
                    email: userEmail, 
                    login: userEmail.split('@')[0], 
                    nivel: "COMPLETO" 
                };
            }
        }
        
        if(msgErro) { 
            msgErro.innerText = `Sucesso! Bem-vindo, ${window.usuarioLogado.nome.split(' ')[0]}.`; 
            msgErro.style.color = "#10b981"; 
            msgErro.style.display = 'block'; 
        }
        
        setTimeout(() => { 
            if(msgErro) { 
                msgErro.style.display = 'none'; 
                msgErro.style.color = "red"; 
            } 
            window.liberarAcesso(); 
        }, 1200);
    } catch (error) { 
        console.error("Erro Auth:", error);
        if(msgErro) { 
            msgErro.innerText = "Credenciais incorretas ou problema de rede."; 
            msgErro.style.color = "red"; 
            msgErro.style.display = 'block';
        } 
    }
}

window.checarLoginEnter = function(e) { 
    if(e.key === 'Enter') {
        window.fazerLogin(); 
    }
}

window.getNivelAcesso = function() { 
    if (!window.usuarioLogado) return 'COMPLETO'; 
    let n = window.usuarioLogado.nivel || 'COMPLETO'; 
    if (n === 'ACOLHIMENTO') return 'ACOLHIMENTO_AGENCIA'; 
    if (n === 'AGENCIA') return 'AGENCIA_ACOLHIMENTO'; 
    return n; 
}

window.liberarAcesso = function() { 
    safeDisplay('tela-bloqueio', 'none'); 
    
    sessionStorage.setItem('usuarioLogado', JSON.stringify(window.usuarioLogado)); 
    
    const elUserDisplay = document.getElementById('user-display');
    if (elUserDisplay && window.usuarioLogado && window.usuarioLogado.nome) {
        elUserDisplay.innerHTML = `<span style="font-size: 13px; color: #3b82f6; margin-right: 15px; font-weight: 600;">👋 Olá, ${window.usuarioLogado.nome.split(' ')[0]}</span>`;
    }
    
    const btnChat = document.getElementById('btn-chat-flutuante'); 
    if(btnChat) {
        btnChat.style.display = 'flex';
    }
    
    if(getDB()) {
        getDB().collection("equipe").get().then(snap => {
            const destSelect = document.getElementById('chat-destinatario');
            if (destSelect) {
                let options = '<option value="Todos">Todos</option>';
                snap.forEach(doc => { 
                    const u = doc.data(); 
                    if (u.nome && (!window.usuarioLogado || u.nome !== window.usuarioLogado.nome)) {
                        options += `<option value="${u.nome}">${u.nome.split(' ')[0]}</option>`; 
                    }
                });
                destSelect.innerHTML = options;
            }
        }).catch(e => {
            console.error("Erro na lista do chat:", e);
        });
    }
    
    if (!window.chatListenerAtivo && getDB()) {
        window.chatListenerAtivo = true;
        
        getDB().collection('mensagens').orderBy('data', 'desc').limit(50).onSnapshot(snap => {
            let html = '';
            let msgs = [];
            
            snap.forEach(doc => {
                msgs.push(doc.data());
            }); 
            
            msgs.reverse();
            
            msgs.forEach(m => {
                let isDestinedToMe = (m.destinatario === window.usuarioLogado.nome);
                let isSentByMe = (window.usuarioLogado && m.usuario === window.usuarioLogado.nome);
                let isPublic = (!m.destinatario || m.destinatario === 'Todos');
                
                if (isPublic || isDestinedToMe || isSentByMe) {
                    let d = new Date(m.data);
                    let hora = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
                    let cClass = isSentByMe ? 'me' : 'other';
                    let uName = isSentByMe ? 'Você' : m.usuario;
                    let badgePrivado = '';
                    
                    if (!isPublic) {
                        badgePrivado = isSentByMe ? `<br><span style="font-size:8px; color:#b91c1c; font-weight:bold;">(Privado p/ ${m.destinatario.split(' ')[0]})</span>` : `<br><span style="font-size:8px; color:#b91c1c; font-weight:bold;">(Privado)</span>`;
                        cClass += ' private-msg';
                    }
                    
                    let bgStyle = !isPublic ? (isSentByMe ? 'background-color:#fecaca; color:#7f1d1d;' : 'background-color:#fef2f2; border-color:#fca5a5;') : '';
                    
                    html += `
                        <div class="chat-message ${cClass}" style="${bgStyle}">
                            <span class="chat-user">${uName} ${badgePrivado}</span>
                            ${m.texto}
                            <span class="chat-time">${hora}</span>
                        </div>
                    `;
                }
            });
            
            const body = document.getElementById('chat-body');
            if(body) { 
                let wasAtBottom = (body.scrollTop + body.clientHeight) >= (body.scrollHeight - 20); 
                body.innerHTML = html; 
                if (window.chatAberto || wasAtBottom) {
                    setTimeout(() => {
                        body.scrollTop = body.scrollHeight;
                    }, 50); 
                }
            }
            
            if (!window.chatAberto && msgs.length > 0) {
                let lastMsg = msgs[msgs.length - 1];
                let isDestToMe = (lastMsg.destinatario === window.usuarioLogado.nome);
                let isPub = (!lastMsg.destinatario || lastMsg.destinatario === 'Todos');

                if (window.usuarioLogado && lastMsg.usuario !== window.usuarioLogado.nome && !window.primeiroLoadChat && (isPub || isDestToMe)) {
                    window.unreadMessages++; 
                    const badge = document.getElementById('chat-badge'); 
                    if(badge) { 
                        badge.innerText = window.unreadMessages; 
                        badge.style.display = 'block'; 
                    }
                }
            }
            window.primeiroLoadChat = false;
        });
    }
    
    if(getDB()) {
        getDB().collection("config").doc("geral").get().then(doc => { 
            if(doc.exists && doc.data().wpp_fixo) {
                window.numeroWppFixo = doc.data().wpp_fixo; 
            }
        }).catch(e => {
            console.error("Configurações não carregadas");
        });
    }

    const btnAcolhimento = document.getElementById('nav-btn-acolhimento');
    const btnAgencia = document.getElementById('nav-btn-agencia');
    const btnAdmin = document.querySelector('.btn-admin');
    const btnNovoAcolhimento = document.querySelector('#dashboard-acolhimento .btn-novo');
    const btnNovoAgencia = document.querySelector('#dashboard-agencia .btn-novo');
    
    let nAcesso = window.getNivelAcesso();

    if(btnAcolhimento) btnAcolhimento.style.display = ''; 
    if(btnAgencia) btnAgencia.style.display = ''; 
    if(btnAdmin) btnAdmin.style.display = (nAcesso === 'COMPLETO') ? '' : 'none';
    if(btnNovoAcolhimento) btnNovoAcolhimento.style.display = (nAcesso === 'AGENCIA_ACOLHIMENTO') ? 'none' : ''; 
    if(btnNovoAgencia) btnNovoAgencia.style.display = (nAcesso === 'ACOLHIMENTO_AGENCIA') ? 'none' : '';

    if (nAcesso === 'AGENCIA_ACOLHIMENTO') {
        window.alternarDashboard('agencia'); 
    } else {
        window.alternarDashboard('acolhimento');
    }
    
    const filtroLocal = document.getElementById('filtro-local');
    const filtroData = document.getElementById('filtro-data'); 
    
    if (filtroData && !filtroData.value) {
        filtroData.value = window.pegarDataAtualLocal();
    }
    
    if(filtroLocal && filtroData) { 
        window.atualizarListener(filtroData.value, filtroLocal.value); 
        window.atualizarLabelQuadra(filtroLocal.value); 
    } 
    
    setTimeout(() => { 
        if (localStorage.getItem('versao_sistema_lida') !== SYSTEM_VERSION) {
            safeDisplay('modal-novidades', 'flex', '10005'); 
        }
    }, 500);
}

// ============================================================================
// INICIALIZADOR DO SISTEMA E COMPONENTES
// ============================================================================
function inicializarSistema() {
    window.carregarListaHorarios();
    
    const chkMembro = document.getElementById('chk_membro');
    const ts = document.getElementById('tipo_membro_select');
    
    if (chkMembro && ts) { 
        chkMembro.addEventListener('change', function() { 
            ts.disabled = !this.checked; 
            if (!this.checked) ts.value = ''; 
        }); 
    }
    
    const secCausas = document.getElementById('seletor_causas');
    const inCausa = document.getElementById('causa');
    
    if (secCausas && inCausa) { 
        secCausas.addEventListener('change', function() { 
            if (this.value) { 
                inCausa.value = inCausa.value === "" ? this.value : inCausa.value + " / " + this.value; 
                this.value = ""; 
            } 
        }); 
    }
    
    const selTipo = document.getElementById('tipo_sepultura');
    if (selTipo) { 
        selTipo.addEventListener('change', function() { 
            const divP = document.getElementById('div-perpetua'); 
            if (this.value.toUpperCase().includes('PERPETU')) {
                if(divP) divP.classList.remove('hidden'); 
            } else {
                if(divP) divP.classList.add('hidden'); 
            }
        }); 
    }
    
    const sf = document.getElementById('filtro-local');
    const fd = document.getElementById('filtro-data'); 
    
    if(fd) { 
        fd.value = window.pegarDataAtualLocal(); 
        fd.addEventListener('change', (e) => {
            window.atualizarListener(e.target.value, sf ? sf.value : 'CEMITÉRIO DO MARUÍ');
        }); 
    }
    
    if(sf) { 
        sf.addEventListener('change', (e) => { 
            window.atualizarListener(fd ? fd.value : window.pegarDataAtualLocal(), e.target.value); 
            window.atualizarLabelQuadra(e.target.value); 
        }); 
    }

    const sessao = sessionStorage.getItem('usuarioLogado'); 
    
    if (sessao) { 
        const uTemp = JSON.parse(sessao); 
        
        if(uTemp.login === 'admin') { 
            window.usuarioLogado = uTemp; 
            window.liberarAcesso(); 
        } else {
            const dbInst = getDB();
            if(dbInst) { 
                const authReady = window.auth ? new Promise((resolve) => { 
                    const unsub = window.auth.onAuthStateChanged((user) => { 
                        unsub(); 
                        resolve(user); 
                    }); 
                }) : Promise.resolve(null);
                
                authReady.then((user) => { 
                    let queryEmail = (user && user.email) ? user.email : (uTemp.email || ""); 
                    
                    if (queryEmail) { 
                        dbInst.collection("equipe").where("email", "==", queryEmail).get().then(snap => { 
                            if (!snap.empty) {
                                window.usuarioLogado = snap.docs[0].data(); 
                            } else {
                                window.usuarioLogado = uTemp; 
                            }
                            window.liberarAcesso(); 
                        }).catch(e => { 
                            window.usuarioLogado = uTemp; 
                            window.liberarAcesso(); 
                        }); 
                    } else { 
                        window.usuarioLogado = uTemp; 
                        window.liberarAcesso(); 
                    } 
                });
            } else { 
                window.usuarioLogado = uTemp; 
                window.liberarAcesso(); 
            }
        }
    }
    
    setTimeout(() => { 
        if(getDB() && window.usuarioLogado) { 
            getDB().collection("atendimentos").orderBy("data_hora_atendimento", "desc").limit(50).get().then(snap => { 
                snap.forEach(doc => { 
                    const d = doc.data(); 
                    if(d.data_ficha_modal && !d.data_ficha) {
                        getDB().collection("atendimentos").doc(doc.id).update({ data_ficha: d.data_ficha_modal }); 
                    }
                }); 
            }).catch(e => {
                console.warn("Aviso Background:", e.message);
            }); 
        } 
    }, 3000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSistema); 
} else {
    inicializarSistema();
}

window.alternarDashboard = function(dash) {
    let nAcesso = window.getNivelAcesso(); 
    window.dashboardAtual = dash; 
    
    const btnAcolhimento = document.getElementById('nav-btn-acolhimento');
    const btnAgencia = document.getElementById('nav-btn-agencia');
    const divAcolhimento = document.getElementById('dashboard-acolhimento');
    const divAgencia = document.getElementById('dashboard-agencia');
    
    if (dash === 'agencia') { 
        if(btnAcolhimento) btnAcolhimento.classList.remove('active'); 
        if(btnAgencia) btnAgencia.classList.add('active'); 
        if(divAcolhimento) divAcolhimento.classList.add('hidden'); 
        if(divAgencia) divAgencia.classList.remove('hidden'); 
    } else { 
        if(btnAgencia) btnAgencia.classList.remove('active'); 
        if(btnAcolhimento) btnAcolhimento.classList.add('active'); 
        if(divAgencia) divAgencia.classList.add('hidden'); 
        if(divAcolhimento) divAcolhimento.classList.remove('hidden'); 
    }
    
    const fd = document.getElementById('filtro-data');
    const fl = document.getElementById('filtro-local');
    if (fd && fl) {
        window.atualizarListener(fd.value, fl.value);
    }
}

window.realizarBusca = function() {
    const inputBusca = document.getElementById('input-busca');
    if(!inputBusca) return;
    
    const termo = inputBusca.value.trim().toUpperCase(); 
    if (!termo) { 
        alert("Digite um nome para buscar."); 
        return; 
    }
    
    if (window.unsubscribe) {
        window.unsubscribe();
    }
    
    window.unsubscribe = getDB().collection("atendimentos")
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
            if (window.dashboardAtual === 'acolhimento') {
                window.renderizarTabela(lista); 
            } else {
                window.renderizarTabelaAgencia(lista);
            }
        });
}

window.atualizarListener = function(data, local) {
    if(!getDB()) return; 
    
    if (window.unsubscribe) {
        window.unsubscribe();
    }
    
    window.unsubscribe = getDB().collection("atendimentos")
        .where("data_ficha", "==", data)
        .onSnapshot((snap) => { 
            let lista = []; 
            snap.forEach(doc => { 
                let d = doc.data(); 
                d.id = doc.id; 
                if ((d.local || "CEMITÉRIO DO MARUÍ") === local || d.tipo_registro === 'PARTICULAR') { 
                    lista.push(d); 
                } 
            }); 
            
            lista.sort((a,b) => {
                if(a.hora < b.hora) return -1;
                if(a.hora > b.hora) return 1;
                return 0;
            }); 
            
            window.renderizarTabela(lista); 
            window.renderizarTabelaAgencia(lista); 
        });
}

window.copiarTexto = function(id) { 
    const el = document.getElementById(id);
    if(el) {
        navigator.clipboard.writeText(el.innerText).then(() => {
            alert("Copiado com sucesso!");
        }).catch(e => {
            alert("Erro ao copiar.");
        }); 
    }
}

window.buscarCEP = function(cep) { 
    cep = cep.replace(/\D/g, ''); 
    if (cep.length === 8) { 
        fetch(`https://viacep.com.br/ws/${cep}/json/`)
            .then(r => r.json())
            .then(data => { 
                if (!data.erro) { 
                    const idEnd = document.getElementById('resp_endereco'); 
                    if(idEnd) idEnd.value = data.logradouro.toUpperCase(); 
                    
                    const idBai = document.getElementById('resp_bairro'); 
                    if(idBai) idBai.value = data.bairro.toUpperCase(); 
                    
                    const idCid = document.getElementById('resp_cidade'); 
                    if(idCid) idCid.value = data.localidade.toUpperCase(); 
                    
                    const idUf = document.getElementById('resp_uf'); 
                    if(idUf) idUf.value = data.uf.toUpperCase(); 
                    
                    const idNum = document.getElementById('resp_numero'); 
                    if(idNum) idNum.focus(); 
                } 
            }).catch(err => console.error(err)); 
    } 
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
        const clCoords = item.geo_coords ? item.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; 
        if (clCoords && clCoords.includes(',')) { 
            btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('https://maps.google.com/?q={clCoords}', '_blank')" title="Ver Localização">📍</button>`; 
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

        tr.onclick = () => window.visualizar(item.id);
        
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
            card.onclick = () => window.abrirFichaParticular(item.id);
            fragment.appendChild(card); 
            return;
        }

        card.onclick = () => window.visualizar(item.id);
        
        let statusGRM = item.agencia_grm || 'PENDENTE'; 
        if (item.isencao === 'SIM') {
            statusGRM = 'ISENTO'; 
        }
        
        let badgeGRM = `<span class="badge-status ${statusGRM === 'PENDENTE' ? 'badge-pendente' : 'badge-sucesso'}">${statusGRM}</span>`;
        
        let statusLib = item.agencia_status_liberacao || 'PENDENTE'; 
        let badgeLib = `<span class="badge-status ${statusLib === 'PENDENTE' ? 'badge-pendente' : 'badge-sucesso'}">${statusLib === 'LIBERADO' ? 'LIBERADO' : 'AGUARDANDO'}</span>`;
        
        let isAcolhimento = item.funeraria && (item.funeraria.toUpperCase().includes('SOCIAL') || item.funeraria.toUpperCase().includes('ACOLHIMENTO'));

        let docsHTML = renderChip('invol', 'INVOL', item);
        if (!isAcolhimento) {
            docsHTML += renderChip('nf', 'NF', item);
        }
        docsHTML += renderChip('tanato', 'TANATO', item);
        
        if (item.isencao !== 'SIM') { 
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
            
            if (item.isencao !== 'SIM') { 
                if(!item.agencia_chk_invol) pendentes.push("INVOL"); 
                if(!isAcolhimento && !item.agencia_chk_nf) pendentes.push("NF"); 
                if(!item.agencia_chk_comprovante) pendentes.push("PGTO"); 
                if(!item.agencia_chk_guia_grm) pendentes.push("GRM"); 
                if(!item.url_docs_agencia) pendentes.push("NUVEM");
                
                if(pendentes.length > 0) { 
                    avisoDocs = `<div style="background:#fee2e2; color:#ef4444; padding:6px; border-radius:4px; font-size:10px; font-weight:bold; margin-top:8px; text-align:center; border: 1px solid #fca5a5;">⚠️ LIBERADO FALTANDO: ${pendentes.join(', ')}</div>`; 
                }
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
            
            // Disparo automático do E-mail
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

window.fecharModalParticularFicha = function() { 
    safeDisplay('modal-particular-ficha', 'none'); 
}

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
        getDB().collection("auditoria").add({ 
            data_log: new Date().toISOString(), 
            usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', 
            acao: "ATUALIZOU FICHA PARTICULAR", 
            detalhe: `ID: ${id}` 
        }); 
        
        window.registrarHistorico(id, 'CHECKLIST', 'Checklist da ficha particular atualizado');
        alert("Ficha salva com sucesso!");
        window.fecharModalParticularFicha();
    }).catch(e => alert("Erro ao salvar ficha."));
}

window.enviarWppParticular = function() {
    if (!window.dadosAtendimentoAtual) return;
    
    const d = window.dadosAtendimentoAtual;
    
    if (!d.chk_pessoa_fisica) {
        alert("O envio de WhatsApp só é aplicável para responsáveis Pessoa Física.");
        return;
    }
    
    let t = d.part_pf_tel ? d.part_pf_tel.replace(/\D/g, '') : '';
    if (!t) {
        alert("Sem telefone cadastrado para o responsável.");
        return;
    }

    let texto = `*PREFEITURA MUNICIPAL DE NITERÓI*\n_Serviços Funerários - Agência_\n\nOlá, seguem as informações do seu atendimento particular:\n\n📄 *Protocolo:* ${d.protocolo || 'Pendente'}\n👤 *Falecido(a):* ${(d.nome || '-').toUpperCase()}\n⚰️ *Cemitério Destino:* ${(d.part_cemiterio || '-').toUpperCase()}\n🕒 *Hora de Liberação:* ${d.part_hora_liberacao || '-'}\n\nAgradecemos a compreensão.`;

    let url = `https://wa.me/55${t}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
    
    window.registrarHistorico(d.id, 'WHATSAPP', `WhatsApp particular enviado para ${d.part_pf_nome || 'responsável'} (${t})`);
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
            let nfInput = document.getElementById('agencia_chk_nf');
            if(nfInput) {
                let labelNf = nfInput.closest('label');
                if (labelNf) {
                    labelNf.style.display = isAcolhimento ? 'none' : 'flex';
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

window.fecharModalAgencia = function() { 
    safeDisplay('modal-agencia', 'none'); 
}

window.toggleCamposAgencia = function(enable) {
    const form = document.getElementById('form-agencia'); 
    if(!form) return;
    
    const inputs = form.querySelectorAll('input, select, textarea'); 
    inputs.forEach(inp => { 
        if (inp.type !== 'hidden') inp.disabled = !enable; 
    });
    
    const btnSalvar = form.querySelector('button[onclick="salvarDadosAgencia()"]'); 
    if(btnSalvar) { 
        btnSalvar.disabled = !enable; 
        btnSalvar.style.opacity = enable ? '1' : '0.5'; 
        btnSalvar.style.cursor = enable ? 'pointer' : 'not-allowed'; 
        btnSalvar.title = enable ? '' : 'Assuma o processo para editar e salvar'; 
    }
    
    const btnMesclar = form.querySelector('button[onclick="mesclarEBaixarPDFsAgencia(event)"]'); 
    if(btnMesclar) { 
        btnMesclar.disabled = !enable; 
        btnMesclar.style.opacity = enable ? '1' : '0.5'; 
        btnMesclar.style.cursor = enable ? 'pointer' : 'not-allowed'; 
    }
}

window.salvarDadosAgencia = function() {
    const idElem = document.getElementById('agencia_docId');
    if(!idElem) return;
    
    const id = idElem.value; 
    if(!id) return;
    
    const procElem = document.getElementById('agencia_processo');
    const grmElem = document.getElementById('agencia_grm');
    const statElem = document.getElementById('agencia_status_liberacao');
    const valElem = document.getElementById('agencia_valor_grm');
    const chkInvol = document.getElementById('agencia_chk_invol');
    const chkNf = document.getElementById('agencia_chk_nf');
    const chkTanato = document.getElementById('agencia_chk_tanato');
    const chkComp = document.getElementById('agencia_chk_comprovante');
    const chkGuia = document.getElementById('agencia_chk_guia_grm');
    
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
    
    const elLnk = document.getElementById('link_docs_agencia'); 
    if(elLnk) {
        dados.url_docs_agencia = elLnk.value.trim();
    }
    
    getDB().collection("atendimentos").doc(id).update(dados).then(() => { 
        getDB().collection("auditoria").add({ 
            data_log: new Date().toISOString(), 
            usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', 
            acao: "ATUALIZAÇÃO AGÊNCIA", 
            detalhe: `Processo: ${dados.agencia_processo}` 
        }); 
        
        window.registrarHistorico(id, 'AGENCIA', `Trâmites da agência atualizados - Processo: ${dados.agencia_processo} | GRM: ${dados.agencia_grm} | Status: ${dados.agencia_status_liberacao}`);
        
        window.fecharModalAgencia(); 
    }).catch(e => alert("Erro ao salvar trâmites da agência."));
}

window.mesclarEBaixarPDFsAgencia = async function(event) {
    event.preventDefault(); 
    const fileInput = document.getElementById('pdf_merger_input_agencia');
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) { 
        alert("Selecione PDFs."); 
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
                alert("Apenas PDFs."); 
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
        
        const docIdElem = document.getElementById('agencia_docId');
        const docId = docIdElem ? docIdElem.value : null; 
        let fileName = "Documentos_Agencia.pdf";
        
        if(docId) { 
            const docSnap = await getDB().collection("atendimentos").doc(docId).get(); 
            if(docSnap.exists) { 
                const d = docSnap.data(); 
                let n = (d.nome || 'S_N').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); 
                fileName = `${d.protocolo || 'PROTO'}_${n}_AGENCIA.pdf`; 
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

window.assumirProcessoAgencia = function(id, isTransfer = false) {
    if (!window.usuarioLogado || !window.usuarioLogado.nome) { 
        alert("Faça login."); 
        return; 
    }
    
    if (confirm(isTransfer ? `Deseja transferir a responsabilidade deste processo para você?` : `Deseja assumir a responsabilidade por este processo na Agência?`)) {
        getDB().collection("atendimentos").doc(id).update({ 
            agencia_atendente: window.usuarioLogado.nome 
        }).then(() => { 
            getDB().collection("auditoria").add({ 
                data_log: new Date().toISOString(), 
                usuario: window.usuarioLogado.nome, 
                acao: isTransfer ? "TRANSFERIU RESPONSABILIDADE (AGÊNCIA)" : "ASSUMIU AGÊNCIA", 
                detalhe: `ID: ${id}` 
            }); 
            
            window.registrarHistorico(id, 'AGENCIA', isTransfer ? `Responsabilidade transferida para ${window.usuarioLogado.nome}` : `${window.usuarioLogado.nome} assumiu o processo na Agência`);
        }).catch(e => { 
            alert("Erro ao assumir atendimento."); 
        });
    }
}

window.assumirProcessoAgenciaModal = function() {
    if (!window.usuarioLogado || !window.usuarioLogado.nome) return; 
    
    const idElem = document.getElementById('agencia_docId');
    if(!idElem) return;
    
    const id = idElem.value;
    
    if(confirm("Deseja assumir este processo para você? Apenas após isso a edição será habilitada.")) { 
        getDB().collection("atendimentos").doc(id).update({ 
            agencia_atendente: window.usuarioLogado.nome 
        }).then(() => { 
            const modElem = document.getElementById('agencia_atendente_modal');
            if(modElem) modElem.innerText = window.usuarioLogado.nome.toUpperCase(); 
            
            window.toggleCamposAgencia(true); 
        }); 
    }
}

window.abrirModalTransferirResponsavel = function(id) {
    window.idTransferenciaResponsavelAtual = id; 
    const select = document.getElementById('novo_responsavel_agencia'); 
    if(!select) return;
    
    select.innerHTML = '<option value="">Carregando...</option>'; 
    
    const justifica = document.getElementById('justificativa_repasse');
    if(justifica) justifica.value = '';
    
    getDB().collection("equipe").orderBy("nome").get().then(snap => { 
        select.innerHTML = '<option value="">Selecione o colaborador...</option>'; 
        snap.forEach(doc => { 
            if(doc.data().nome) { 
                select.innerHTML += `<option value="${doc.data().nome}">${doc.data().nome.toUpperCase()}</option>`; 
            } 
        }); 
        safeDisplay('modal-transferir-responsavel', 'flex', '10005'); 
    }).catch(e => { 
        alert("Erro ao carregar lista de equipe."); 
    });
}

window.abrirModalTransferirResponsavelModal = function() { 
    const idElem = document.getElementById('agencia_docId'); 
    if(idElem) {
        window.abrirModalTransferirResponsavel(idElem.value); 
    }
}

window.fecharModalTransferirResponsavel = function() { 
    safeDisplay('modal-transferir-responsavel', 'none'); 
}

window.confirmarTransferenciaResponsavel = function() {
    if(!window.idTransferenciaResponsavelAtual) return; 
    
    const resElem = document.getElementById('novo_responsavel_agencia');
    const jusElem = document.getElementById('justificativa_repasse');
    
    const novoResponsavel = resElem ? resElem.value : ''; 
    const justificativa = jusElem ? jusElem.value.trim() : '';
    
    if(!novoResponsavel) { 
        alert("Selecione um usuário na lista."); 
        return; 
    } 
    
    if(!justificativa) { 
        alert("Informe a justificativa do repasse (Obrigatório)."); 
        return; 
    }
    
    getDB().collection("atendimentos").doc(window.idTransferenciaResponsavelAtual).update({ 
        agencia_atendente: novoResponsavel, 
        justificativa_repasse: justificativa 
    }).then(() => {
        getDB().collection("auditoria").add({ 
            data_log: new Date().toISOString(), 
            usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', 
            acao: "REPASSOU PROCESSO (AGÊNCIA)", 
            detalhe: `ID: ${window.idTransferenciaResponsavelAtual} | Para: ${novoResponsavel} | Motivo: ${justificativa}` 
        });
        
        window.registrarHistorico(window.idTransferenciaResponsavelAtual, 'TRANSFERENCIA', `Processo repassado para ${novoResponsavel} - Motivo: ${justificativa}`);
        
        alert("Processo repassado com sucesso!"); 
        
        const el = document.getElementById('agencia_atendente_modal'); 
        if (el && document.getElementById('modal-agencia').style.display === 'block') { 
            el.innerText = novoResponsavel.toUpperCase(); 
        } 
        
        window.fecharModalTransferirResponsavel();
    }).catch(e => { 
        alert("Erro ao transferir processo."); 
    });
}

window.abrirModalOneDrive = function() { 
    const el = document.getElementById('onedrive_nome_pasta'); 
    if(el) el.innerText = window.nomePastaPadrao || 'PROTOCOLO_NOME'; 
    
    safeDisplay('modal-onedrive', 'flex', '10005'); 
    
    const savedRoot = localStorage.getItem('onedrive_root'); 
    if(savedRoot) { 
        const inputRoot = document.getElementById('input_root_onedrive');
        if(inputRoot) inputRoot.value = savedRoot; 
        
        const iframe = document.getElementById('iframe_onedrive');
        if(iframe) iframe.src = savedRoot; 
        
        const btnNova = document.getElementById('btn_nova_aba_onedrive');
        if(btnNova) btnNova.href = savedRoot; 
    } 
}

window.salvarRootOneDrive = function() { 
    const linkElem = document.getElementById('input_root_onedrive');
    const link = linkElem ? linkElem.value : ''; 
    localStorage.setItem('onedrive_root', link); 
    
    const iframe = document.getElementById('iframe_onedrive');
    if(iframe) iframe.src = link || 'https://onedrive.live.com/'; 
    
    const btnNova = document.getElementById('btn_nova_aba_onedrive');
    if(btnNova) btnNova.href = link || 'https://onedrive.live.com/'; 
    
    alert('Pasta raiz salva com sucesso!'); 
}

window.fecharModalOneDrive = function() { 
    safeDisplay('modal-onedrive', 'none'); 
}

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
    Array.from(document.getElementsByClassName('tab-pane')).forEach(e => e.classList.remove('active')); 
    const el = document.getElementById(id); 
    if (el) el.classList.add('active'); 
    
    document.querySelectorAll('.tab-header .tab-btn').forEach(btn => btn.classList.remove('active'));
    
    if (id === 'tab-equipe') document.querySelectorAll('.tab-btn')[0].classList.add('active'); 
    if (id === 'tab-contribuintes') document.querySelectorAll('.tab-btn')[1].classList.add('active'); 
    if (id === 'tab-backup') document.querySelectorAll('.tab-btn')[2].classList.add('active'); 
    if (id === 'tab-stats') document.querySelectorAll('.tab-btn')[3].classList.add('active'); 
    if (id === 'tab-logs') document.querySelectorAll('.tab-btn')[4].classList.add('active');
    if (id === 'tab-config') document.querySelectorAll('.tab-btn')[5].classList.add('active');
    
    if(id === 'tab-equipe') window.listarEquipe(); 
    if(id === 'tab-logs') window.carregarLogs(); 
    if(id === 'tab-stats') window.carregarEstatisticas('7');
    
    if(id === 'tab-config') {
        getDB().collection("config").doc("geral").get().then(doc => {
            if(doc.exists) {
                const configWpp = document.getElementById('config_wpp_fixo');
                if(configWpp) configWpp.value = doc.data().wpp_fixo || '';
                
                const configApi = document.getElementById('config_api_transparencia');
                if(configApi) configApi.value = doc.data().api_transparencia || '';
            }
        });
    }
}

window.salvarConfiguracoesGerais = function() {
    const wppElem = document.getElementById('config_wpp_fixo');
    const apiElem = document.getElementById('config_api_transparencia');
    
    const num = wppElem ? wppElem.value.replace(/\D/g, '') : window.numeroWppFixo;
    const api = apiElem ? apiElem.value.trim() : '';
    
    getDB().collection("config").doc("geral").set({ 
        wpp_fixo: num, 
        api_transparencia: api 
    }, { merge: true }).then(() => {
        window.numeroWppFixo = num; 
        alert("Configurações atualizadas com sucesso!");
    }).catch(e => alert("Erro ao salvar configurações."));
}

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
        let localDate = new Date(dInicio.getTime() - (dInicio.getTimezoneOffset() * 60000)); 
        dString = localDate.toISOString().split('T')[0]; 
    }
    
    database.collection("atendimentos").where("data_ficha", ">=", dString).onSnapshot(snap => {
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
        let totalValores = 0;
        let qtdValores = 0;
        let cemiterios = {"MARUÍ":0, "SÃO FRANCISCO":0, "ITAIPU":0};
        let linhasTempo = {};
        let totalAcolhimento = 0; 
        let totalAgencia = 0;

        snap.forEach(doc => {
            const d = doc.data(); 
            const filtroMes = document.getElementById('filtro-mes-ano');
            if (modo === 'custom' && filtroMes && !d.data_ficha.startsWith(filtroMes.value)) return;
            
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
            Valores_GRM: valores 
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

            if(window.chartInstances[id]) {
                window.chartInstances[id].destroy();
            }
            
            window.chartInstances[id] = new Chart(ctx, { 
                type: type, 
                data: { 
                    labels: displayLabels, 
                    datasets: [{ 
                        label: lbl, 
                        data: sorted.map(x=>x[1]), 
                        backgroundColor: (type==='doughnut'||type==='pie') ? ['#10b981','#3b82f6','#f59e0b','#ef4444'] : color, 
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
    });
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
        { name: 'Valores GRM', data: formatData(window.dadosGraficosAtuais.Valores_GRM, 'Faixa de Valor') } 
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
            let li = document.createElement('li'); 
            li.className = 'table-equipe-row';
            li.innerHTML = `<div style="flex: 2; font-weight: 600; color: #1e293b;">${c.nome}</div><div style="flex: 1.5; color: #475569; font-size: 13px;">${c.cpf} <br> <span style="font-size: 11px; color: #94a3b8;">RG: ${c.rg || '-'}</span></div><div style="flex: 1.5; color: #475569; font-size: 13px;">${c.telefone}</div><div style="flex: 2; color: #475569; font-size: 12px; line-height: 1.2;">${enderecoCompleto}</div><div style="width: 60px; display: flex; justify-content: flex-end;"><button class="btn-action-edit" onclick="window.editarContribuinte('${c.cpf}', '${c.nome}')" title="Editar Contribuinte">✏️</button></div>`; 
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

window.listarEquipe = function() { 
    const ul = document.getElementById('lista-equipe'); 
    if(!ul) return;
    
    getDB().collection("equipe").onSnapshot(snap => { 
        ul.innerHTML = ''; 
        const fragment = document.createDocumentFragment();
        
        snap.forEach(doc => { 
            const u = doc.data(); 
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
            
            let badgeNivel = `<span style="font-size:10px; background:#e2e8f0; color:#475569; padding:2px 6px; border-radius:4px; margin-left:5px; vertical-align:middle;">${u.nivel || 'COMPLETO'}</span>`;
            let li = document.createElement('li'); 
            li.className = 'table-equipe-row';
            li.innerHTML = `<div class="col-user"><div class="avatar-circle" style="background-color: ${bgColor}; color: ${txtColor};">${iniciais}</div><div style="display: flex; flex-direction: column;"><span style="color:#1e293b; font-size:14px; font-weight:600;">${nomeSeguro} ${badgeNivel}</span><span style="color:#94a3b8; font-size:12px;">${u.email||''}</span></div></div><div class="col-login">${u.login||''}</div><div class="col-pass">*** <button class="btn-icon" style="background:#f8fafc; padding:6px; border-radius:50%; border:none; cursor:pointer;" onclick="alert('Senha: ${u.senha}')">👁️</button></div><div class="col-actions"><button class="btn-action-edit" onclick="window.editarFuncionario('${doc.id}')">✏️</button><button class="btn-action-delete" onclick="window.excluirFuncionario('${doc.id}')">🗑️</button></div>`; 
            fragment.appendChild(li);
        }); 
        
        ul.appendChild(fragment);
    }); 
}

window.adicionarFuncionario = function() { 
    const nome = document.getElementById('novo-nome').value; 
    const login = document.getElementById('novo-login').value; 
    const email = document.getElementById('novo-email').value; 
    const senha = document.getElementById('nova-senha').value; 
    const nivel = document.getElementById('novo-nivel').value;
    
    if(!nome || !login || !senha) { 
        alert("Preencha nome, login e senha."); 
        return; 
    }
    
    getDB().collection("equipe").add({ 
        nome, login, email, senha, nivel 
    }).then(() => { 
        alert("Usuário adicionado!"); 
        document.getElementById('novo-nome').value = ""; 
        document.getElementById('novo-login').value = ""; 
        document.getElementById('novo-email').value = ""; 
        document.getElementById('nova-senha').value = ""; 
        document.getElementById('novo-nivel').value = "COMPLETO"; 
    }).catch(e => alert("Erro: " + e)); 
}

window.excluirFuncionario = function(id) { 
    if(confirm("Excluir usuário?")) {
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
            document.getElementById('edit-nivel').value = u.nivel || 'COMPLETO'; 
            
            const boxNovo = document.getElementById('box-novo-usuario');
            if(boxNovo) boxNovo.classList.add('hidden'); 
            
            const divEdit = document.getElementById('div-editar-usuario');
            if(divEdit) divEdit.classList.remove('hidden'); 
        } 
    }); 
}

window.salvarEdicaoUsuario = function() { 
    const id = document.getElementById('edit-id').value; 
    const nome = document.getElementById('edit-nome').value; 
    const email = document.getElementById('edit-email').value; 
    const senha = document.getElementById('edit-senha').value; 
    const nivel = document.getElementById('edit-nivel').value;
    
    if(!nome || !senha) { 
        alert("Nome e senha são obrigatórios."); 
        return; 
    }
    
    getDB().collection("equipe").doc(id).update({ 
        nome, email, senha, nivel 
    }).then(() => { 
        alert("Usuário atualizado!"); 
        window.cancelarEdicao(); 
    }).catch(e => alert("Erro: " + e)); 
}

window.cancelarEdicao = function() { 
    document.getElementById('edit-id').value = ""; 
    document.getElementById('edit-nome').value = ""; 
    document.getElementById('edit-login').value = ""; 
    document.getElementById('edit-email').value = ""; 
    document.getElementById('edit-senha').value = ""; 
    document.getElementById('edit-nivel').value = "COMPLETO"; 
    
    const divEdit = document.getElementById('div-editar-usuario');
    if(divEdit) divEdit.classList.add('hidden'); 
    
    const boxNovo = document.getElementById('box-novo-usuario');
    if(boxNovo) boxNovo.classList.remove('hidden'); 
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

const listaDocsPadrao = [
    'autorizacao', 'rg_perm', 'obito', 'rg_falecido', 'residencia', 
    'guia_cartorio', 'moeda', 'bolsa', 'loas', 'cadunico', 'cras', 
    'parentesco', 'casamento', 'locacao', 'procuracao'
];

window.abrirModalDocsAcolhimento = function(id) {
    getDB().collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const d = doc.data(); 
            
            const docsIdElem = document.getElementById('docs_acolhimento_id');
            if(docsIdElem) docsIdElem.value = id;
            
            listaDocsPadrao.forEach(c => { 
                const chk = document.getElementById(`chk_doc_${c}`); 
                if(chk) chk.checked = (d[`chk_doc_${c}`] === true); 
            });
            
            const elLnk = document.getElementById('link_docs_acolhimento'); 
            if(elLnk) elLnk.value = d.url_docs_acolhimento || '';
            
            let nAj = (d.nome || 'NAO_INFORMADO').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().replace(/\s+/g, '_'); 
            let pAj = d.protocolo || 'SEM_PROTO'; 
            window.nomePastaPadrao = `${pAj}_${nAj}`;
            
            const dNd = document.getElementById('nome_pasta_checklist_display'); 
            if(dNd) dNd.innerText = window.nomePastaPadrao;
            
            safeDisplay('modal-docs-acolhimento', 'block', '10005');
        }
    });
}

window.abrirModalDocsAcolhimentoModal = function() { 
    if(window.dadosAtendimentoAtual && window.dadosAtendimentoAtual.id) { 
        window.fecharModalVisualizar(); 
        window.abrirModalDocsAcolhimento(window.dadosAtendimentoAtual.id); 
    } 
}

window.fecharModalDocsAcolhimento = function() { 
    safeDisplay('modal-docs-acolhimento', 'none'); 
}

window.salvarDocsAcolhimento = function() {
    const idElem = document.getElementById('docs_acolhimento_id');
    if(!idElem) return;
    
    const id = idElem.value; 
    if(!id) return; 
    
    let updates = {}; 
    
    listaDocsPadrao.forEach(c => { 
        const chk = document.getElementById(`chk_doc_${c}`); 
        if(chk) updates[`chk_doc_${c}`] = chk.checked; 
    });
    
    const elLnk = document.getElementById('link_docs_acolhimento'); 
    if(elLnk) updates.url_docs_acolhimento = elLnk.value.trim();
    
    getDB().collection("atendimentos").doc(id).update(updates).then(() => { 
        getDB().collection("auditoria").add({ 
            data_log: new Date().toISOString(), 
            usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Anon', 
            acao: "ATUALIZOU DOCS ACOLHIMENTO", 
            detalhe: `ID: ${id}` 
        }); 
        
        const docsMarc = listaDocsPadrao.filter(c => { 
            const chk = document.getElementById(`chk_doc_${c}`); 
            return chk && chk.checked; 
        });
        
        window.registrarHistorico(id, 'CHECKLIST', `Checklist acolhimento atualizado (${docsMarc.length} docs marcados)`);
        
        alert("Checklist salvo com sucesso!"); 
        window.fecharModalDocsAcolhimento(); 
    }).catch(e => { 
        alert("Erro ao salvar os documentos."); 
    });
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

window.abrirModalLiberacao = function(id) { 
    window.idLiberacaoAtual = id; 
    safeDisplay('modal-liberacao', 'flex', '10005'); 
}

window.fecharModalLiberacao = function() { 
    safeDisplay('modal-liberacao', 'none'); 
}

window.gerarFormularioLiberacao = function(tipoImpressao) {
    if(!window.idLiberacaoAtual) return;
    
    const w = window.open('', '_blank'); 
    if(!w) { 
        alert("O seu navegador bloqueou o pop-up. Por favor, permita pop-ups para imprimir a liberação."); 
        return; 
    }
    
    w.document.write("<html><head><title>Carregando...</title></head><body style='font-family: sans-serif; text-align: center; padding-top: 50px; color: #3b82f6;'><h2>Gerando documento de liberação...</h2></body></html>");
    
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
            
            const html = `<html><head><title>Liberação</title>${cssPrint}</head><body><table style="border:2px solid #000;"><tr><td style="width:35%;border-bottom:2px solid #000;text-align:center;padding:15px;"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height:80px;"></td><td style="width:65%;border-bottom:2px solid #000;text-align:center;font-weight:bold;line-height:1.8;font-size:14px;padding:15px;">SECRETARIA DE MOBILIDADE E INFRAESTRUTURA - SEMOBI<br><br>SUBSECRETARIA DE INFRAESTRUTURA - SSINFRA<br><br>COORDENADORIA MUNICIPAL DE SERVIÇOS FUNERÁRIOS<br><br>AGÊNCIA FUNERÁRIA MUNICIPAL</td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;text-align:center;font-weight:bold;padding:8px;">CERTIFICO e dou fé que, nesta data, estamos finalizando o Processo Administrativo</td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:10%;border:none;border-right:2px solid #000;padding:10px;text-align:center;">Nº</td><td style="width:35%;border:none;border-right:2px solid #000;padding:10px;" class="bg-gray">${d.agencia_processo||''}</td><td style="width:20%;border:none;border-right:2px solid #000;padding:10px;text-align:center;">, processo de</td><td style="width:35%;border:none;padding:10px;" class="bg-gray">${tp}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:15%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Falecido:</td><td style="width:85%;border:none;padding:10px;" class="bg-gray">${(d.nome||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:15%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Data:</td><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="bg-gray">${dF}</td><td style="width:55%;border:none;"></td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:35%;border:none;border-right:2px solid #000;padding:10px;text-align:center;" class="label-cell">Sepultamento/Crematório no Cemitério<br>Municipal/Privado:</td><td style="width:65%;border:none;padding:10px;vertical-align:middle;" class="bg-gray">${(d.local||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:15%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Horário:</td><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="bg-gray">${d.hora||''}</td><td style="width:25%;border:none;border-right:2px solid #000;padding:10px;text-align:center;" class="label-cell">Horário da Liberação:</td><td style="width:30%;border:none;padding:10px;" class="bg-gray">${hA}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Saindo o féretro da Capela:</td><td style="width:70%;border:none;padding:10px;" class="bg-gray">${(d.cap||'').toUpperCase()}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;padding:0;"><table><tr><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Para a Sepultura:</td><td style="width:70%;border:none;padding:10px;" class="bg-gray">${se}</td></tr></table></td></tr><tr><td colspan="2" style="border-bottom:2px solid #000;height:15px;border-left:none;border-right:none;"></td></tr><tr><td colspan="2" style="padding:0;"><table><tr><td style="width:30%;border:none;border-right:2px solid #000;padding:10px;" class="label-cell">Funerária:</td><td style="width:70%;border:none;padding:10px;" class="bg-gray">${(d.funeraria||'').toUpperCase()}</td></tr></table></td></tr></table><div style="text-align:center;margin-top:40px;">${si}<div style="border-top:1px dashed #000;width:350px;margin:0 auto;margin-bottom:5px;"></div><span style="font-weight:bold;font-size:13px;">Assinatura do Responsável</span><br><span style="font-size:13px;">${at}</span><br><br><span style="font-weight:bold;font-size:13px;">Matrícula</span><br><span style="font-size:13px;">_________________</span></div><script>window.onload = function() { setTimeout(function() { window.print(); }, 800); };</script></body></html>`;
            
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            w.location.href = url;
            
            window.registrarHistorico(window.idLiberacaoAtual, 'LIBERACAO', `Documento de Liberação gerado (${tipoImpressao === 'municipal' ? 'Sepultamento' : 'Cremação'})`);
            
            window.fecharModalLiberacao(); 

        } else {
            w.close();
            alert("Atendimento não encontrado.");
        }
    }).catch(err => {
        w.close();
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
        <script>window.onload=function(){setTimeout(function(){window.print();},800)}</script>
    </body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank'); 
    
    if(!w) { 
        alert("O seu navegador bloqueou o pop-up. Por favor, permita pop-ups para imprimir o recibo."); 
        return; 
    }
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
    
    const html = `<html><head><title>Autorização para Funeral</title><style>@page{size:A4 portrait;margin:10mm;}body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:10px;line-height:1.5;}.bold{font-weight:bold;text-transform:uppercase;}.ass{margin-top:30px;text-align:center;width:60%;margin-left:auto;margin-right:auto;}h3{text-decoration:underline;text-align:center;margin-bottom:10px;margin-top:10px;font-size:14px;}.section-title{font-weight:bold;text-decoration:underline;margin-top:20px;display:block;font-size:12px;}p{margin:5px 0;text-align:justify;}.ul-texto{border-bottom:1px solid #000;display:inline-block;min-width:40px;text-align:center;font-weight:bold;text-transform:uppercase;}.checkboxes{margin:10px 0;font-size:11px;}.checkboxes span{margin-right:5px;}.obs{font-size:11px;margin-top:10px;text-align:justify;display:flex;gap:10px;line-height:1.3;}.logo-container{text-align:center;margin-bottom:10px;}</style></head><body><div class="logo-container"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height:60px;"></div><h3>AUTORIZAÇÃO PARA FUNERAL</h3><p>Eu, <span class="ul-texto" style="width:45%;">${d.resp_nome||''}</span> CPF nº <span class="ul-texto" style="width:20%;">${d.resp_cpf||''}</span><br>RG: <span class="ul-texto" style="width:20%;">${d.resp_rg||''}</span> residente <span class="ul-texto" style="width:35%;">${d.resp_endereco||''}</span> nº <span class="ul-texto" style="width:5%;">${d.resp_numero||''}</span> bairro <span class="ul-texto" style="width:15%;">${d.resp_bairro||''}</span><br><span class="ul-texto" style="width:20%;">${d.resp_cidade||''}</span> Município <span class="ul-texto" style="width:10%;">${d.resp_uf||''}</span> Estado CEP: <span class="ul-texto" style="width:15%;">${d.resp_cep||''}</span> grau de parentesco <span class="ul-texto" style="width:20%;">${d.parentesco||''}</span></p><p><b>AUTORIZO a FUNERÁRIA</b> <span class="ul-texto" style="width:40%;">${d.funeraria||''}</span>, a tratar junto à Agência Funerária dos Cemitérios Municipais de Niterói do Sepultamento do Sr(a) <span class="ul-texto" style="width:50%;">${d.nome||''}</span> falecido no dia <span class="ul-texto" style="width:15%;">${formatarData(d.data_obito)||''}</span>,<br>tendo como local de óbito <span class="ul-texto" style="width:30%;">${d.hospital||''}</span>, sendo o sepultamento no Cemitério <span class="ul-texto" style="width:20%;">${(d.local||'').replace('CEMITÉRIO DO ','').replace('CEMITÉRIO DE ','')}</span> Tipo de Sepultura ${checkForm(d.tipo_sepultura,'CRA')} Cova Rasa Adulto</p><div class="checkboxes"><span>${checkForm(d.tipo_sepultura,'CRJ')} Cova Rasa Anjo</span> <span>${checkForm(d.tipo_sepultura,'GA')} GAVETA ADULTO</span> <span>${checkForm(d.tipo_sepultura,'GJ')} GAVETA ANJO</span> <span>${checkForm(d.tipo_sepultura,'CA')} CARNEIRA ADULTO</span> <span>${checkForm(d.tipo_sepultura,'CJ')} CARNEIRA ANJO</span> <span>Nº Sepultura <span class="ul-texto" style="width:8%;">${d.sepul||''}</span></span> <span>Qd. <span class="ul-texto" style="width:8%;">${d.qd||''}</span></span> <span>Rua <span class="ul-texto" style="width:8%;"></span></span></div><p>Aluguel ${checkForm(d.tipo_sepultura,'ALUGUEL')} Perpétuo ${checkForm(d.tipo_sepultura,'PERPETU')} Livro nº <span class="ul-texto" style="width:10%;">${d.livro_perpetua||''}</span> Folha nº <span class="ul-texto" style="width:10%;">${d.folha_perpetua||''}</span> <b>Autorização de 24 Horas para sepultamento, SIM ${d.do_24h==='SIM'?'(X)':'( )'} NÃO ${d.do_24h!=='SIM'?'(X)':'( )'}</b></p><p>Telefones para Contato 1º <span class="ul-texto" style="width:20%;">${d.telefone||''}</span> 2º <span class="ul-texto" style="width:20%;"></span></p><p><b>DATA E HORÁRIO DO SEPULTAMENTO: <span class="ul-texto" style="width:15%;">${formatarData(d.data_ficha)||''}</span> ÁS <span class="ul-texto" style="width:10%;">${d.hora||''}</span> HORAS</b></p><p><b>*ESTOU CIENTE E ACEITO A SEPULTURA DISPONÍVEL.</b></p><p style="text-align:right;">Niterói, <span class="ul-texto" style="width:30%;border:none;">${dExtenso}</span></p><div class="ass">${sigResp}<div style="border-top:1px solid #000;padding-top:3px;">Assinatura do(a) autorizador (a)</div></div><span class="section-title">AUTORIZAÇÃO PARA PAGAMENTO DAS TAXAS</span><p>Autorizo a Funerária <span class="ul-texto" style="width:30%;"></span> a entregar toda e qualquer documentação exigida, bem como a efetuar o pagamento das taxas inerentes ao funeral (capela, entrada de corpo, sepultamento e afins), agendamento e liberação de corpo na agência para o Cemitério de destino.</p><div class="ass">${sigResp}<div style="border-top:1px solid #000;padding-top:3px;">Assinatura do(a) autorizador (a)</div></div><span class="section-title">NÃO AUTORIZAÇÃO PARA PAGAMENTO DAS TAXAS</span><p><b>NÃO</b> autorizo a Funerária <span class="ul-texto" style="width:30%;"></span> a efetuar o pagamento das taxas inerentes ao funeral (capela, entrada de corpo, sepultamento e afins), sendo de minha inteira responsabilidade efetuar o pagamento das taxas bem como entregar a documentação exigida para liberação do corpo na agência para o Cemitério de destino. Importante frisar que toda a documentação posterior ao pagamento, a família deverá entregar a Funerária para que seja autorizado junto ao Cemitério a entrada do corpo na capela do Cemitério escolhido.</p><p>Sendo de responsabilidade da Funerária <span class="ul-texto" style="width:30%;"></span> tão somente a entrega dos documentos obrigatórios da empresa contratada bem como realizar o agendamento do sepultamento.</p><div class="ass">${sigResp}<div style="border-top:1px solid #000;padding-top:3px;">Assinatura do(a) autorizador (a)</div></div><div class="obs"><span style="font-size:18px;">→</span><div><b>OBS.:</b> Importante frisar que a Funerária ou a Família terá o prazo de no <b>MÁXIMO 01 (uma) horas</b> antes do sepultamento para pagar as taxas. Caso não seja cumprido no horário o pagamento o sepultamento será <b>SUSPENSO</b>.</div></div><div class="obs"><span style="font-size:18px;">→</span><div><b>OBS.:</b> Em se tratando do Cemitério de Itaipu e São Francisco, o pagamento das taxas deverão ser pagas no ato da liberação do corpo na Agência, tendo em vista se tratar de Cemitérios longe da Agência recebedora. Caso não seja realizado o pagamento, os Cemitérios não autorizarão a entrada do corpo.</div></div><script>window.onload=function(){setTimeout(function(){window.print();},800)}</script></body></html>`;
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank'); 
    
    if(!w) { 
        alert("O seu navegador bloqueou o pop-up. Por favor, permita pop-ups para imprimir a autorização."); 
        return; 
    }
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
        dEx = `${ps[2]}/${ps[1]}/${parseInt(ps[0])+(c==='ANJO'?2:3)}`; 
    }
    
    let bF = d.assinatura_responsavel ? `<div style="text-align:center;height:45px;"><img src="${d.assinatura_responsavel}" style="max-height:40px;max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    let bA = d.assinatura_atendente ? `<div style="text-align:center;height:45px;"><img src="${d.assinatura_atendente}" style="max-height:40px;max-width:80%;"></div>` : `<div style="height:45px;"></div>`;
    
    let nA = (window.usuarioLogado && window.usuarioLogado.nome ? window.usuarioLogado.nome : (d.atendente_sistema || 'N/A')).toUpperCase();
    let isTanato = (d.tanato === 'SIM' || d.chk_tanato === 'SIM');const htmlComprovante = `<html><head><title>Comprovante</title><style>@page{size:A4 portrait;margin:8mm;}body{font-family:Arial,sans-serif;font-size:14px;margin:0;padding:10px;line-height:1.3;color:#000;}.header{text-align:center;margin-bottom:25px;position:relative;}.header h2{font-size:20px;text-decoration:underline;margin:0;font-weight:bold;text-transform:uppercase;color:#000;}.protocolo{position:absolute;top:-5px;right:0;font-size:14px;font-weight:bold;border:2px solid #000;padding:5px 10px;}.line{margin-bottom:4px;white-space:normal;word-wrap:break-word;overflow:visible;}.bold{font-weight:900;}.red{color:red;font-weight:bold;}.section-title{font-weight:900;margin-top:15px;margin-bottom:2px;text-transform:uppercase;font-size:14px;}.two-columns{display:flex;justify-content:space-between;margin-top:10px;}.col-left{width:60%;}.col-right{width:38%;}.assinaturas-block{display:flex;justify-content:space-between;margin-top:25px;margin-bottom:10px;gap:20px;}.ass-line{text-align:center;padding-top:2px;flex:1;font-size:12px;}.box-lateral{border:2px solid #000;padding:5px;font-weight:900;font-size:12px;height:100%;display:flex;flex-direction:column;justify-content:space-between;}.termo-juridico{text-align:justify;font-size:12px;line-height:1.3;}.footer-line{margin-top:10px;border-top:1px solid #000;padding-top:5px;font-weight:900;font-size:12px;}.aviso-final{border:2px solid #000;padding:5px;margin-top:10px;font-weight:900;text-align:justify;font-size:12px;line-height:1.3;}.spacer{margin-left:10px;}</style></head><body><div class="header"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height:60px;margin-bottom:5px;"><h2>Comprovante de Atendimento</h2><div class="protocolo">PROTOCOLO: ${p}</div></div><div class="content"><div class="line"><span class="bold">Nome do FALECIDO:</span> ${(d.nome||'').toUpperCase()}</div><div class="line"><span class="bold">Nome do RESPONSÁVEL:</span> ${(d.resp_nome||'').toUpperCase()} <span style="margin-left:5px;font-weight:normal;">${rl}</span></div><div class="line"><span class="bold">Funerária:</span> ${(d.funeraria||'').toUpperCase()} <span style="margin-left:15px">(Rep: ${d.func_funeraria||'N/A'})</span></div><div class="line"><span class="bold">Atendente Responsável:</span> ${nA}<span class="bold" style="margin-left:20px">DATA DE HORARIO DE ATENDIMENTO:</span> ${dhT}</div><div class="line"><span class="bold">Data:</span> ${f(d.data_ficha)} <span class="bold spacer">Hora:</span> ${d.hora||''} <span class="bold spacer">SEPULTURA:</span> ${d.sepul||''} <span class="bold spacer">${im?"QUADRA:":"RUA:"}</span> ${d.qd||''} <span class="bold spacer">CAPELA:</span> ${d.cap||''}</div><div class="line"><span class="bold">COM CAPELA</span> ${ck(cc)} <span class="bold">SEM CAPELA</span> ${ck(!cc)} <span class="bold spacer">DATA DO FALECIMENTO:</span> ${f(d.data_obito)} AS ${tH} <span class="red spacer">[${tD}]</span></div><div class="line"><span class="bold">Cemitério:</span> (${im?'X':' '}) MARUÍ (${is?'X':' '}) SÃO FRANCISCO XAVIER (${ii?'X':' '}) SÃO LÁZARO DE ITAIPÚ</div><div class="line">${cE('SOLTEIRO')} SOLTEIRO ${cE('CASADO')} CASADO ${cE('VIUVO')} VÍUVO ${cE('UNIAO_ESTAVEL')} UNIÃO ESTÁVEL ${cE('DIVORCIADO')} DIVORCIADO ${cE('IGNORADO')} IGNORADO</div><div class="section-title">ASSINAR TERMO DE COMPROMISSO NO CEMITÉRIO</div><div class="line" style="margin-top:5px;font-size:14px;border:1px solid #000;padding:5px;"><span class="bold">TIPO DE SEPULTURA SELECIONADA:</span> ${tS}</div><div class="line" style="margin-top:10px"><span class="bold">TANATO:</span> (${isTanato?'X':' '}) SIM (${!isTanato?'X':' '}) NÃO</div><div class="assinaturas-block"><div class="ass-line">${bA}<div style="border-top:1px solid #000;">Acolhimento / Atendente:<br><b>${nA}</b></div></div><div class="ass-line">${bF}<div style="border-top:1px solid #000;">Assinatura do responsável/família<br><b>${(d.resp_nome||'').toUpperCase()}</b></div></div></div><div style="font-weight:bold;font-size:12px;margin-top:5px;">OBS: PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.</div><div style="font-weight:bold;font-size:12px;margin-top:5px;">OBS.: VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.</div><div class="line" style="margin-top:15px;border:2px solid #000;padding:5px;"><span class="bold">PREVISÃO DE EXUMAÇÃO:</span> A partir de <span class="red" style="font-size:16px;">${dEx}</span><br><span style="font-size:10px;">(Legislação: 3 anos para Adultos / 2 anos para Crianças até 11 anos)</span><div style="margin-top:12px;margin-bottom:8px;border:2px dashed #000;padding:8px;text-align:center;font-weight:900;font-size:13px;">⚠️ ATENÇÃO: COMPAREÇA OU ENTRE EM CONTATO NO PRAZO MÍNIMO DE 90 DIAS ANTES DA DATA DE EXUMAÇÃO PARA ABERTURA DE PROCESSO.</div><div style="margin-top:15px;text-align:center;">${bF}<div style="border-top:1px solid #000;width:60%;margin:0 auto;">Assinatura do Responsável (Ciência do Prazo)</div></div><div class="two-columns"><div class="col-left"><div style="text-align:center;font-weight:bold;text-decoration:underline;margin-bottom:5px;">TERMO DE COMPROMISSO CEMITÉRIOS MUNICIPAIS</div><div class="termo-juridico">Sendo o <span class="bold">FALECIDO CASADO</span>, o responsável perante, o Cemitério do MARUÍ, SÃO FRANCISCO E ITAIPU será obrigatoriamente o <span class="bold">CONJUGE</span>.<br>Sendo o <span class="bold">FALECIDO VIÚVO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU serão obrigatoriamente os <span class="bold">FILHOS</span>.<br>Sendo o <span class="bold">FALECIDO SOLTEIRO</span>, os responsáveis perante o CEMITÉRIO do MARUÍ, SÃO FRANCISCO E ITAIPU obrigatoriamente os <span class="bold">FILHOS, PAIS, IRMÃOS</span>.<br>Será exigida a apresentação de documentos de <span class="bold" style="text-decoration:underline">IDENTIDADE e CPF</span>.</div><div class="assinaturas-block" style="margin-top:40px;"><div style="flex:1;"></div><div class="ass-line">${bF}<div style="border-top:1px solid #000;">Assinatura funcionário/família</div></div></div></div><div class="col-right"><div class="box-lateral"><div>CAPELAS MUNICIPAIS E PARTICULARES:</div><br><div>PAGAMENTO E NOTA FISCAL DAS TAXAS MUNICIPAIS E INVOL COM DUAS HORAS ANTES DO SEPULTAMENTO</div><br><br><div>CLIENTE: _____________________</div></div></div></div><div class="footer-line">MARCADO: ________________________ PERMISSIONÁRIO: ${(d.resp_nome||'').toUpperCase()}</div><div style="font-weight:bold;font-size:12px;margin-top:5px;">TEL: ${d.telefone||''}</div><div class="aviso-final"><span style="text-decoration:underline">COMUNICADO AOS FAMILIARES DO FALECIDO E AS EMPRESAS FUNERÁRIAS RESPONSÁVEIS PELO SEPULTAMENTO.</span><br>Informamos que somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação dos seguintes documentos:<span class="bold">GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL PELO SERVIÇO), TAXAS MUNICIPAIS PAGAS e INVOL.</span></div></div><script>window.onload=function(){setTimeout(function(){window.print();},800)}</script></body></html>`;
    
    const blob = new Blob([htmlComprovante], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank'); 
    
    if(!w) { 
        alert("O seu navegador bloqueou o pop-up. Por favor, permita pop-ups para imprimir o comprovante."); 
        return; 
    }
}

window.gerarEtiqueta = function() {
    if(!window.dadosAtendimentoAtual) return;
    
    window.registrarHistorico(window.dadosAtendimentoAtual.id, 'DOCUMENTO', 'Etiqueta de Identificação gerada');
    
    const d = window.dadosAtendimentoAtual; 
    const fd = (s) => s ? s.split('-').reverse().join('/') : ''; 
    const dF = fd(d.data_ficha);
    
    const html = `<html><head><title>Etiqueta</title><style>@page{size:landscape;margin:0}body{font-family:Arial,sans-serif;margin:0;padding:0;height:100vh;width:100vw;display:flex;justify-content:center;align-items:center;overflow:hidden}.box{width:95vw;height:90vh;border:5px solid #000;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;text-align:center;padding:10px}.header-img{max-height:100px;margin-bottom:10px}.title{font-size:24px;font-weight:900;text-transform:uppercase;border-bottom:3px solid #000;padding-bottom:5px;display:inline-block;margin-bottom:30px}.group{margin-bottom:30px;width:100%}.label{font-size:18px;color:#333;font-weight:bold;text-transform:uppercase;margin-bottom:5px}.val-nome{font-size:55px;font-weight:900;text-transform:uppercase;line-height:1.1}.val-data{font-size:40px;font-weight:800}.val-local{font-size:35px;font-weight:800;text-transform:uppercase}</style></head><body><div class="box"><div><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" class="header-img"><br><div class="title">IDENTIFICAÇÃO DE VELÓRIO</div></div><div class="group"><div class="label">FALECIDO(A)</div><div class="val-nome">${d.nome}</div></div><div class="group"><div class="label">SEPULTAMENTO</div><div class="val-data">${dF} às ${d.hora}</div></div><div class="group"><div class="label">LOCAL</div><div class="val-local">${d.cap}<br>${d.local||"CEMITÉRIO DO MARUÍ"}</div></div></div><script>window.onload=function(){setTimeout(function(){window.print();},800)}</script></body></html>`;
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank'); 
    
    if(!w) { 
        alert("O seu navegador bloqueou o pop-up. Por favor, permita pop-ups para imprimir a etiqueta."); 
        return; 
    }
}

window.visualizar = function(id) {
    if(!getDB()) return;
    
    getDB().collection("atendimentos").doc(id).get().then(doc => {
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

            const mapCampos = { 
                'view_protocolo': d.protocolo || 'S/ PROTOCOLO', 
                'view_hora': d.hora || '--:--', 
                'view_nome': (d.nome || 'NÃO INFORMADO').toUpperCase(), 
                'view_causa': (d.causa || 'NÃO INFORMADA').toUpperCase(), 
                'view_resp_completo': (d.resp_nome || 'N/I').toUpperCase() + (d.parentesco ? ` (${d.parentesco})` : ''), 
                'view_resp_cpf': d.resp_cpf || '-', 
                'view_resp_rg': d.resp_rg || '-', 
                'view_telefone': d.telefone || '-', 
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
                const cleanCoords = d.geo_coords ? d.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; 
                if (cleanCoords && cleanCoords.includes(',')) { 
                    mapContainer.style.display = 'block'; 
                    mapFrame.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="https://maps.google.com/?q=${cleanCoords}&output=embed"></iframe>`; 
                    mapLink.href = `https://maps.google.com/?q=${cleanCoords}`; 
                } else { 
                    mapContainer.style.display = 'none'; 
                } 
            }
            safeDisplay('modal-visualizar', 'block', '10000');
        }
    });
}

window.enviarWppFixo = function(id) {
    if (!window.numeroWppFixo) {
        alert("O número da Central de Atendimento não está configurado. Aceda ao Painel Admin > Configurações para definir o número.");
        return;
    }
    
    getDB().collection("atendimentos").doc(id).get().then(doc => {
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
            mapaStr = "https://maps.google.com/?q=Rua+General+Castrioto,+414+-+Barreto,+Niterói+-+RJ"; 
        } 
        else if (d.local.includes('FRANCISCO')) { 
            enderecoStr = "Rua Tapajós, 75 - São Francisco, Niterói - RJ"; 
            mapaStr = "https://maps.google.com/?q=Rua+Tapajós,+75+-+São+Francisco,+Niterói+-+RJ"; 
        } 
        else if (d.local.includes('ITAIPU')) { 
            enderecoStr = "Estrada Engenho do Mato, s/n - Itaipu, Niterói - RJ"; 
            mapaStr = "https://maps.google.com/?q=Estrada+Engenho+do+Mato,+s/n+-+Itaipu,+Niterói+-+RJ"; 
        }
    }
    
    if (tipo === 'gps') {
        const c = d.geo_coords ? d.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; 
        if (!t) { alert("Sem telefone cadastrado."); return; } 
        if (!c) { alert("Sem GPS cadastrado na ficha."); return; }
        texto = `📍 *Localização Exata da Sepultura:*\n\nAbra o link abaixo para ver no mapa:\nhttps://maps.google.com/?q=${c}`;
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
    
    let t = d.part_pf_tel ? d.part_pf_tel.replace(/\D/g, '') : '';
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
    const t = window.dadosAtendimentoAtual.telefone ? window.dadosAtendimentoAtual.telefone.replace(/\D/g, '') : ''; 
    const c = window.dadosAtendimentoAtual.geo_coords ? window.dadosAtendimentoAtual.geo_coords.replace(/[^0-9.,\-]/g, '') : ''; 
    if (!t) { alert("Sem telefone cadastrado."); return; } 
    window.registrarHistorico(window.dadosAtendimentoAtual.id, 'SMS', `SMS enviado para ${t} com localização da sepultura`);
    window.location.href = `sms:+55${t}?body=${encodeURIComponent('Localização da Sepultura: https://maps.google.com/?q=' + c)}`; 
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
        getDB().collection("atendimentos").doc(id).delete(); 
    } 
};

window.onclick = function(e) { 
    const m = [
        'modal-visualizar', 'modal-estatisticas', 'modal-admin', 
        'modal-transferir', 'modal-whatsapp', 'modal-agencia', 
        'modal-liberacao', 'modal-transferir-responsavel', 'modal-onedrive', 
        'modal-docs-acolhimento', 'modal-particular', 'modal-assinatura', 
        'modal-particular-ficha', 'modal-historico', 'modal-busca-beneficio', 
        'modal-novidades'
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