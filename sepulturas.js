// ============================================================================
// MÓDULO DE GESTÃO DE SEPULTURAS E EXUMAÇÕES (ADMINISTRAÇÃO)
// Este arquivo é carregado de forma independente para proteger o script principal.
// ============================================================================

/**
 * Função de Varredura e Sincronização
 * Lê todos os atendimentos já feitos e constrói o banco de sepulturas (eng. reversa).
 */
window.sincronizarSepulturasComAtendimentos = async function(event) {
    if (!confirm("Aviso: Esta ação irá varrer TODAS as fichas de atendimento atuais e gerar o banco de dados de sepulturas automaticamente. Isso pode levar alguns segundos. Deseja iniciar a sincronização?")) return;
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "⏳ Sincronizando... Aguarde";
    btn.disabled = true;
    
    try {
        const db = window.getDB();
        const sepulturasMap = {};
        
        // Puxa as sepulturas que já existem (Importadas do AutoCAD ou Manuais) para não apagá-las
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
window.filtroStatusSepulturaAtual = ''; 

window.filtrarPorStatusSepultura = function(status) {
    if (window.filtroStatusSepulturaAtual === status) {
        window.filtroStatusSepulturaAtual = '';
    } else {
        window.filtroStatusSepulturaAtual = status;
    }
    window.carregarSepulturas(); 
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

        ['card-total-sep', 'card-livres-sep', 'card-ocupadas-sep', 'card-alertas-sep'].forEach(id => {
            let el = document.getElementById(id);
            if (el) {
                el.style.borderWidth = '1px';
                el.style.borderColor = el.id.includes('livres') ? '#86efac' : (el.id.includes('ocupadas') ? '#fca5a5' : (el.id.includes('alertas') ? '#fcd34d' : '#e2e8f0'));
            }
        });

        if (window.filtroStatusSepulturaAtual === 'LIVRE') {
            let el = document.getElementById('card-livres-sep');
            if(el) { el.style.borderWidth = '3px'; el.style.borderColor = '#16a34a'; }
        } else if (window.filtroStatusSepulturaAtual === 'OCUPADA') {
            let el = document.getElementById('card-ocupadas-sep');
            if(el) { el.style.borderWidth = '3px'; el.style.borderColor = '#dc2626'; }
        } else if (window.filtroStatusSepulturaAtual === 'EXUMAÇÃO PENDENTE') {
            let el = document.getElementById('card-alertas-sep');
            if(el) { el.style.borderWidth = '3px'; el.style.borderColor = '#d97706'; }
        } else {
            let el = document.getElementById('card-total-sep');
            if(el) { el.style.borderWidth = '3px'; el.style.borderColor = '#94a3b8'; }
        }
        
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

        if (typeof window.atualizarCoresDoMapa === 'function' && local === 'CEMITÉRIO DO MARUÍ') {
            window.atualizarCoresDoMapa(lista);
        }
        
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

            // Lógica para link do Google Maps caso exista coordenada
            let gpsBtnHtml = '';
            if (s.geo_coords) {
                const cleanCoords = s.geo_coords.replace(/[^0-9.,\-]/g, '');
                gpsBtnHtml = `<div style="text-align: right; margin-top: 10px;"><a href="http://googleusercontent.com/maps.google.com/9{cleanCoords}" target="_blank" class="btn-novo" style="background-color: #3b82f6; display: inline-flex; padding: 6px 12px; font-size: 11px; text-decoration: none; width: auto;">📍 Ver no Google Maps</a></div>`;
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
// MAPA VISUAL INTERATIVO (LEAFLET) E VISÃO INTERNA DAS QUADRAS
// ============================================================================

window.mapaLeaflet = null;
window.mapaMarkers = [];

window.abrirModalMapa = function() {
    let modaisMapa = document.querySelectorAll('[id="modal-mapa"]');
    
    // BLINDAGEM: FORÇA A ATUALIZAÇÃO DO HTML E INJETA O MENU DROPDOWN
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
                    <button type="button" class="btn-close" onclick="fecharModalMapa()">Fechar Mapa</button>
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

window.renderizarMapaVisual = async function() {
    const container = document.getElementById('mapa-leaflet');
    if (!container) return;

    if (window.mapaLeaflet) {
        setTimeout(() => window.mapaLeaflet.invalidateSize(), 300);
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

// Função chamada pelo Select do Mapa para Filtrar e Focar a Quadra Exata
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
    
    window.carregarSepulturas();

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
    if (!window.mapaLeaflet) return;

    window.mapaMarkers.forEach(m => m.remove());
    window.mapaMarkers = [];

    let bounds = L.latLngBounds();
    let temElementosVisiveis = false;

    const inputBusca = document.getElementById('input-busca-sepulturas');
    const temBuscaAtiva = inputBusca && inputBusca.value.trim() !== '';

    listaSepulturas.forEach(s => {
        if (s.geo_coords) {
            const cleanCoords = s.geo_coords.replace(/[^0-9.,\-]/g, '');
            if (cleanCoords && cleanCoords.includes(',')) {
                const [lat, lon] = cleanCoords.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lon)) {
                    
                    let corTexto = '#475569';
                    let corPino = '#94a3b8'; // Default cinza
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

const originalAlternarDashboard = window.alternarDashboard;
window.alternarDashboard = function(aba) {
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
    if (btnAlvo) {
        btnAlvo.classList.add('active');
    }

    if (aba === 'sepulturas' && typeof window.carregarSepulturas === 'function') {
        window.carregarSepulturas();
    }

    if (typeof originalAlternarDashboard === 'function' && aba !== 'sepulturas') {
        try {
            originalAlternarDashboard(aba);
        } catch(e) {
            console.log("Erro na função original alternarDashboard:", e);
        }
    }
};

// ============================================================================
// AUTO-DESIGNAÇÃO, IMPORTAÇÃO E CADASTRO MANUAL DE SEPULTURAS
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

    // AJUSTA OS BOTÕES DO PAINEL DE SEPULTURAS (MANTÉM OS 2 LADO A LADO)
    const dashSep = document.getElementById('dashboard-sepulturas');
    if(dashSep) {
        const containerBtns = dashSep.querySelector('.controles div:nth-child(2)');
        if(containerBtns) {
            const btnCadastrar = Array.from(containerBtns.querySelectorAll('button')).find(b => b.innerText.includes('Cadastrar Sepultura'));
            if(btnCadastrar) {
                btnCadastrar.onclick = window.abrirModalCadastroSepultura;
                btnCadastrar.removeAttribute('onblur');
            }

            if(!document.getElementById('btn-importar-autocad')) {
                const btnAutoCAD = document.createElement('button');
                btnAutoCAD.id = 'btn-importar-autocad';
                btnAutoCAD.className = 'btn-novo';
                btnAutoCAD.style.backgroundColor = '#6366f1';
                btnAutoCAD.innerText = "📥 Importar CSV AutoCAD";
                btnAutoCAD.title = "Importa a planilha de topografia gerando as sepulturas no mapa";
                btnAutoCAD.onclick = window.importarBaseAutoCAD;
                containerBtns.appendChild(btnAutoCAD);
            }
        }
    }
});

// FUNÇÕES DO CADASTRO MANUAL DE SEPULTURAS
window.abrirModalCadastroSepultura = function() {
    let modalCad = document.getElementById('modal-cadastro-sepultura');
    if (!modalCad) {
        const modalDiv = document.createElement('div');
        modalDiv.id = 'modal-cadastro-sepultura';
        modalDiv.className = 'modal hidden';
        modalDiv.innerHTML = `
            <div class="modal-content" style="max-width: 500px; background: #fff; padding: 0;">
                <div class="modal-header" style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 15px 20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; color: #1e293b; font-size: 16px;">➕ Cadastrar Sepultura Manual</h3>
                    <span class="close" onclick="window.fecharModalCadastroSepultura()" style="font-size: 24px; cursor: pointer; color: #64748b;">×</span>
                </div>
                <form onsubmit="window.salvarNovaSepultura(event)" style="padding: 20px; max-height: 65vh; overflow-y: auto;">
                    <div class="form-grid">
                        <div class="input-group span-4">
                            <label>Cemitério</label>
                            <select id="cad_sep_cemiterio" required>
                                <option value="CEMITÉRIO DO MARUÍ">CEMITÉRIO DO MARUÍ</option>
                                <option value="CEMITÉRIO DE SÃO FRANCISCO">CEMITÉRIO DE SÃO FRANCISCO</option>
                                <option value="CEMITÉRIO DE ITAIPU">CEMITÉRIO DE ITAIPU</option>
                            </select>
                        </div>
                        <div class="input-group span-2">
                            <label>Tipo de Localização</label>
                            <select id="cad_sep_tipo_loc" onchange="document.getElementById('lbl_quadra_rua').innerText = this.value === 'RUA' ? 'Nome da Rua' : 'Nome/Número da Quadra';">
                                <option value="QUADRA">Quadra</option>
                                <option value="RUA">Rua</option>
                            </select>
                        </div>
                        <div class="input-group span-2">
                            <label id="lbl_quadra_rua">Nome/Número da Quadra</label>
                            <input type="text" id="cad_sep_quadra_rua" required placeholder="Ex: A, B, F2...">
                        </div>
                        <div class="input-group span-2">
                            <label>Nº Sepultura</label>
                            <input type="text" id="cad_sep_numero" required placeholder="Ex: 105">
                        </div>
                        <div class="input-group span-2">
                            <label>Tipo (Estrutura)</label>
                            <select id="cad_sep_tipo" required>
                                <option value="">Selecione...</option>
                                <option value="GAVETA">Gaveta</option>
                                <option value="CARNEIRO">Carneiro</option>
                                <option value="PERPETUA">Perpétua</option>
                                <option value="COVA RASA">Cova Rasa</option>
                                <option value="GAVETA_ANJO">Gaveta Anjo</option>
                                <option value="CARNEIRO_ANJO">Carneiro Anjo</option>
                                <option value="COVA_RASA_ANJO">Cova Rasa Anjo</option>
                                <option value="MEMBRO">Membro Amputado</option>
                                <option value="GAVETA PERPETUA">Gaveta Perpétua</option>
                                <option value="CARNEIRO PERPETUO">Carneiro Perpétuo</option>
                                <option value="COVA RASA PERPETUA">Cova Rasa Perpétua</option>
                            </select>
                        </div>
                        <div class="input-group span-4" style="background: #f1f5f9; padding: 10px; border-radius: 6px;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin:0; text-transform:none;">
                                <input type="checkbox" id="cad_sep_perpetua"> <b>Marcar como Perpétua</b> (Pertence à Família)
                            </label>
                        </div>
                        <div class="input-group span-4">
                            <label>Coordenadas GPS (Opcional)</label>
                            <div style="display:flex; gap:5px;">
                                <input type="text" id="cad_sep_geo" placeholder="Ex: -22.8628, -43.1054">
                                <button type="button" onclick="window.pegarGpsCadastroSepultura()" class="btn-novo" style="width:40px; padding:0; justify-content:center; border-radius:6px;" title="Pegar minha localização atual">📍</button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer-custom" style="justify-content: flex-end; gap: 10px; margin-top: 20px;">
                        <button type="button" class="btn-close" onclick="window.fecharModalCadastroSepultura()">Cancelar</button>
                        <button type="submit" class="btn-novo" style="background-color: #10b981; width:auto;">Salvar Sepultura</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modalDiv);
        modalCad = document.getElementById('modal-cadastro-sepultura');
    }
    
    modalCad.classList.remove('hidden');
    modalCad.style.cssText = 'display: flex !important; position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background-color: rgba(0,0,0,0.7) !important; z-index: 999999 !important; align-items: center !important; justify-content: center !important;';
    
    const contentBox = modalCad.querySelector('.modal-content');
    if (contentBox) contentBox.style.cssText = 'position: relative !important; width: 90% !important; max-width: 500px !important; display: flex !important; flex-direction: column !important; background: #fff !important; border-radius: 12px !important; overflow: hidden !important; box-shadow: 0 10px 25px rgba(0,0,0,0.5) !important; margin: auto !important;';
};

window.fecharModalCadastroSepultura = function() {
    const modalCad = document.getElementById('modal-cadastro-sepultura');
    if (modalCad) {
        modalCad.classList.add('hidden');
        modalCad.style.setProperty('display', 'none', 'important');
    }
};

window.pegarGpsCadastroSepultura = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const input = document.getElementById('cad_sep_geo');
                if(input) input.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
                alert("Localização obtida com sucesso!");
            },
            (err) => { alert("Erro ao obter localização: " + err.message); },
            { enableHighAccuracy: true }
        );
    } else {
        alert("Geolocalização não suportada pelo navegador.");
    }
};

window.salvarNovaSepultura = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Salvando...";
    btn.disabled = true;

    try {
        const cemiterio = document.getElementById('cad_sep_cemiterio').value;
        const quadraRua = document.getElementById('cad_sep_quadra_rua').value.trim().toUpperCase();
        const numero = document.getElementById('cad_sep_numero').value.trim().toUpperCase();
        const tipo = document.getElementById('cad_sep_tipo').value.trim().toUpperCase();
        const geo = document.getElementById('cad_sep_geo').value.trim();
        const perpetua = document.getElementById('cad_sep_perpetua').checked;

        if (!cemiterio || !quadraRua || !numero || !tipo) {
            alert("Preencha os campos obrigatórios.");
            return;
        }

        const key = `${cemiterio}_${quadraRua}_${numero}`.replace(/\//g, '-');
        const docRef = window.getDB().collection('sepulturas').doc(key);
        const doc = await docRef.get();
        
        if (doc.exists) {
            if(!confirm("Esta sepultura já existe no sistema. Deseja atualizar seus dados básicos (Tipo, GPS)? O histórico de ocupantes não será apagado.")) {
                btn.innerText = originalText;
                btn.disabled = false;
                return;
            }
            await docRef.set({
                tipo: tipo,
                geo_coords: geo,
                perpetua: perpetua
            }, { merge: true });
        } else {
            await docRef.set({
                cemiterio: cemiterio,
                quadra: quadraRua,
                numero: numero,
                tipo: tipo,
                geo_coords: geo,
                perpetua: perpetua,
                status: 'LIVRE',
                ocupantes: []
            });
        }
        
        alert("Sepultura salva com sucesso!");
        window.fecharModalCadastroSepultura();
        
        document.getElementById('cad_sep_quadra_rua').value = '';
        document.getElementById('cad_sep_numero').value = '';
        document.getElementById('cad_sep_tipo').value = '';
        document.getElementById('cad_sep_geo').value = '';
        document.getElementById('cad_sep_perpetua').checked = false;

        if (window.carregarSepulturas) window.carregarSepulturas();
    } catch(err) {
        console.error(err);
        alert("Erro ao salvar sepultura.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.importarBaseAutoCAD = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(event) {
            const text = event.target.result;
            const lines = text.split('\n');
            if (lines.length < 2) return alert("Arquivo vazio ou inválido.");

            const delimitador = lines[0].includes(';') ? ';' : ',';

            const headers = lines[0].split(delimitador).map(h => h.trim().replace(/"/g, '').replace(/^\uFEFF/, '').toUpperCase());
            
            const idxCamada = headers.findIndex(h => h.includes('CAMADA'));
            const idxX = headers.findIndex(h => h.includes('POSIÇÃO X') || h.includes('POSICAO X'));
            const idxY = headers.findIndex(h => h.includes('POSIÇÃO Y') || h.includes('POSICAO Y'));
            const idxValor = headers.findIndex(h => h.includes('VALOR'));

            if (idxCamada === -1 || idxX === -1 || idxY === -1 || idxValor === -1) {
                return alert("Colunas não encontradas. O CSV precisa ter: Camada, Posição X, Posição Y, Valor");
            }

            document.body.style.cursor = 'wait';
            alert("Iniciando importação da Topografia. Isso pode demorar alguns segundos, por favor, aguarde a mensagem de sucesso.");

            try {
                const db = window.getDB();
                let batch = db.batch();
                let count = 0;
                let totalSalvos = 0;

                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue; 
                    const colunas = lines[i].split(delimitador);
                    if (colunas.length < 4) continue;

                    const camada = colunas[idxCamada].trim().replace(/"/g, '');
                    const xStr = colunas[idxX].trim().replace(/"/g, '');
                    const yStr = colunas[idxY].trim().replace(/"/g, '');
                    const valor = colunas[idxValor].trim().replace(/"/g, '');

                    if (!valor || valor === '') continue;

                    const x = parseFloat(xStr);
                    const y = parseFloat(yStr);
                    if (isNaN(x) || isNaN(y)) continue;

                    const latlon = window.converterUTMparaLatLon(x, y, 23, true);
                    const geo_coords = latlon.lat.toFixed(6) + ", " + latlon.lon.toFixed(6);

                    const cemiterio = "CEMITÉRIO DO MARUÍ";
                    let quadra = camada.replace('NUMERAÇÃO DE ', '').replace('NUMERAÇÃO ', '').replace('_TOP_PTO_', '').trim();
                    let sepul = valor.replace(/^0+/, '') || valor; 

                    const key = `${cemiterio}_${quadra}_${sepul}`.replace(/\//g, '-');

                    const docRef = db.collection("sepulturas").doc(key);
                    
                    batch.set(docRef, {
                        cemiterio: cemiterio,
                        quadra: quadra,
                        numero: sepul,
                        geo_coords: geo_coords,
                        status: "LIVRE",
                        tipo: quadra.includes('GAVETA') ? 'GAVETA' : (quadra.includes('NICHO') ? 'NICHO' : 'NÃO INFORMADO')
                    }, { merge: true });

                    count++;
                    totalSalvos++;

                    if (count >= 490) {
                        await batch.commit();
                        batch = db.batch();
                        count = 0;
                    }
                }

                if (count > 0) {
                    await batch.commit();
                }

                document.body.style.cursor = 'default';
                alert(`Sucesso! ${totalSalvos} sepulturas topográficas foram inseridas/atualizadas no mapa.`);
                if (window.carregarSepulturas) window.carregarSepulturas();
            } catch (err) {
                console.error("Erro na importação:", err);
                alert("Ocorreu um erro ao importar a planilha.");
                document.body.style.cursor = 'default';
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
};

window.converterUTMparaLatLon = function(x, y, zone, southhemi) {
    const a = 6378137.0;
    const eccSquared = 0.00669438;
    const k0 = 0.9996;
    const e1 = (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));
    x = x - 500000.0;
    y = southhemi ? y - 10000000.0 : y;

    const M = y / k0;
    const mu = M / (a * (1 - eccSquared / 4 - 3 * Math.pow(eccSquared, 2) / 64 - 5 * Math.pow(eccSquared, 3) / 256));

    const phi1Rad = mu + (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu)
                + (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu)
                + (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu);

    const N1 = a / Math.sqrt(1 - eccSquared * Math.pow(Math.sin(phi1Rad), 2));
    const T1 = Math.pow(Math.tan(phi1Rad), 2);
    const C1 = (eccSquared / (1.0 - eccSquared)) * Math.pow(Math.cos(phi1Rad), 2);
    const R1 = a * (1 - eccSquared) / Math.pow(1 - eccSquared * Math.pow(Math.sin(phi1Rad), 2), 1.5);
    const D = x / (N1 * k0);

    let latRad = phi1Rad - (N1 * Math.tan(phi1Rad) / R1) * (Math.pow(D, 2) / 2 - (5 + 3 * T1 + 10 * C1 - 4 * Math.pow(C1, 2) - 9 * (eccSquared / (1.0 - eccSquared))) * Math.pow(D, 4) / 24
                + (61 + 90 * T1 + 298 * C1 + 45 * Math.pow(T1, 2) - 252 * (eccSquared / (1.0 - eccSquared)) - 3 * Math.pow(C1, 2)) * Math.pow(D, 6) / 720);
    const lat = latRad * 180 / Math.PI;

    let lonRad = (D - (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 + (5 - 2 * C1 + 28 * T1 - 3 * Math.pow(C1, 2) + 8 * (eccSquared / (1.0 - eccSquared)) + 24 * Math.pow(T1, 2)) * Math.pow(D, 5) / 120) / Math.cos(phi1Rad);
    const lon = ((zone - 1) * 6 - 180 + 3) + lonRad * 180 / Math.PI;

    return { lat: lat, lon: lon };
};