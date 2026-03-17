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
        const atendimentosSnap = await db.collection("atendimentos").get();
        const sepulturasMap = {};
        
        atendimentosSnap.forEach(doc => {
            const d = doc.data();
            
            // Ignora atendimentos particulares (que vão para cemitérios privados) 
            // e fichas que não tenham o número da sepultura definido.
            if (!d.local || !d.sepul || d.tipo_registro === 'PARTICULAR') return;
            
            const local = d.local.toUpperCase().trim();
            const sepul = d.sepul.toUpperCase().trim();
            const qd = (d.qd || '').toUpperCase().trim();
            const tipo = (d.tipo_sepultura || '').toUpperCase().trim();
            
            // Cria uma Chave Única para identificar a cova no Firebase 
            // Ex: CEMITÉRIO DO MARUÍ_QD 2_105
            const key = `${local}_${qd}_${sepul}`.replace(/\//g, '-');
            
            // Se a sepultura ainda não existe no mapa, cria a estrutura básica dela
            if (!sepulturasMap[key]) {
                sepulturasMap[key] = {
                    cemiterio: local,
                    quadra: qd,
                    numero: sepul,
                    tipo: tipo,
                    perpetua: (tipo.includes('PERPETU') || d.perpetua === 'X'),
                    ocupantes: []
                };
            }
            
            // Adiciona o falecido como um ocupante no histórico daquela sepultura
            sepulturasMap[key].ocupantes.push({
                atendimento_id: doc.id,
                nome: d.nome || 'NÃO INFORMADO',
                data_sepultamento: d.data_ficha || '',
                classificacao: d.classificacao_obito || 'ADULTO'
            });
        });
        
        // Vamos enviar para o Firebase em lotes (batch) por segurança e velocidade
        let batch = db.batch();
        let count = 0;
        let totalSalvo = 0;
        
        for (const key in sepulturasMap) {
            const sepDados = sepulturasMap[key];
            
            // Ordena os ocupantes do mais recente (último enterrado) para o mais antigo
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
                    
                    // Calcula a diferença em anos exatos
                    const diffTime = Math.abs(hoje - dataSep);
                    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
                    
                    // Regra de exumação de Niterói (3 anos adulto, 2 anos anjo)
                    const anosCarencia = ultimoOcupante.classificacao === 'ANJO' ? 2 : 3;
                    
                    if (diffYears < anosCarencia) {
                        status = "OCUPADA";
                    } else {
                        status = "EXUMAÇÃO PENDENTE";
                    }
                } else {
                    // Se a ficha antiga não tinha data, assumimos que está ocupada por segurança
                    status = "OCUPADA"; 
                }
            }
            
            sepDados.status = status;
            
            const docRef = db.collection("sepulturas").doc(key);
            batch.set(docRef, sepDados);
            
            count++;
            totalSalvo++;
            
            // O Firestore permite no máximo 500 operações por Batch
            if (count >= 490) { 
                await batch.commit();
                batch = db.batch();
                count = 0;
            }
        }
        
        // Salva as remanescentes
        if (count > 0) {
            await batch.commit();
        }
        
        alert(`Sincronização concluída com sucesso! ${totalSalvo} sepulturas únicas foram catalogadas baseadas no seu histórico.`);
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
window.carregarSepulturas = function() {
    const filtroLocal = document.getElementById('filtro-local-sepulturas');
    const inputBusca = document.getElementById('input-busca-sepulturas');
    const tbody = document.getElementById('tabela-corpo-sepulturas');
    
    if (!tbody || !filtroLocal) return; // Se a tabela não existir na tela atual, ignora
    
    const local = filtroLocal.value;
    const busca = inputBusca ? inputBusca.value.trim().toUpperCase() : '';
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color:#64748b; font-weight:500;">⏳ Buscando banco de sepulturas no servidor...</td></tr>';
    
    let query = window.getDB().collection("sepulturas").where("cemiterio", "==", local);
    
    query.get().then(snap => {
        let lista = [];
        snap.forEach(doc => lista.push({...doc.data(), id: doc.id}));
        
        if (busca) {
            lista = lista.filter(s => 
                (s.numero && s.numero.includes(busca)) || 
                (s.quadra && s.quadra.includes(busca))
            );
        }
        
        // Ordena por quadra e depois por número da sepultura inteligentemente
        lista.sort((a, b) => {
            if (a.quadra < b.quadra) return -1;
            if (a.quadra > b.quadra) return 1;
            return a.numero.localeCompare(b.numero, undefined, {numeric: true});
        });
        
        tbody.innerHTML = '';
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px; color:#64748b; font-weight:500;">Nenhuma sepultura encontrada neste cemitério. Clique no botão "Sincronizar" acima.</td></tr>';
            return;
        }
        
        const fragment = document.createDocumentFragment();
        
        lista.forEach(s => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            tr.onclick = () => window.abrirModalSepultura(s.id);
            
            // Lógica de cores (Badge) para o Status
            let badgeColor = '#f1f5f9';
            let textColor = '#475569';
            
            if (s.status === 'LIVRE') {
                badgeColor = '#dcfce3'; textColor = '#16a34a'; // Verde
            } else if (s.status === 'OCUPADA') {
                badgeColor = '#fee2e2'; textColor = '#dc2626'; // Vermelho
            } else if (s.status === 'EXUMAÇÃO PENDENTE') {
                badgeColor = '#fef3c7'; textColor = '#d97706'; // Amarelo/Laranja
            }
            
            let badge = `<span style="background:${badgeColor}; color:${textColor}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">${s.status}</span>`;
            
            // Resumo do último ocupante
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
    window.getDB().collection("sepulturas").doc(id).get().then(doc => {
        if (doc.exists) {
            const s = doc.data();
            
            // Gera o HTML do histórico de ocupantes
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

            const conteudo = `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px; text-align:center;">
                        <span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">CEMITÉRIO</span>
                        <span style="font-size:14px; font-weight:bold; color:#1e293b;">${s.cemiterio}</span>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px; text-align:center;">
                        <span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">QUADRA / NÚMERO</span>
                        <span style="font-size:16px; font-weight:900; color:#3b82f6;">QD ${s.quadra || '-'} | Nº ${s.numero}</span>
                    </div>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:15px; text-align:center;">
                        <span style="font-size:10px; color:#64748b; font-weight:bold; display:block;">STATUS</span>
                        <span style="font-size:14px; font-weight:bold; background:${badgeColor}; color:${textColor}; padding: 2px 8px; border-radius: 4px;">${s.status}</span>
                    </div>
                </div>
                <div style="margin-bottom:20px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <span style="font-size:11px; color:#3b82f6; font-weight:bold; text-transform:uppercase; margin-bottom: 8px; display:block;">ESTRUTURA</span>
                    <div style="display: flex; gap: 20px;">
                        <div><span style="font-size:11px; color:#64748b; font-weight:bold;">TIPO DA SEPULTURA:</span> <span style="font-size:13px; font-weight:600; color:#334155;">${s.tipo || 'NÃO INFORMADO'}</span></div>
                        <div><span style="font-size:11px; color:#64748b; font-weight:bold;">COMPRADA (PERPÉTUA):</span> <span style="font-size:13px; font-weight:600; color:#334155;">${s.perpetua ? 'SIM ✅' : 'NÃO (ALUGUEL 3 ANOS)'}</span></div>
                    </div>
                </div>
                <div>
                    <span style="font-size:11px; color:#f59e0b; font-weight:bold; text-transform:uppercase; display: block; margin-bottom: 8px;">HISTÓRICO DE OCUPAÇÃO</span>
                    <div style="background: #f1f5f9; border-radius: 8px; padding: 10px; border: 1px solid #e2e8f0; max-height:250px; overflow-y:auto;">
                        ${ocupantesHtml}
                    </div>
                </div>
            `;

            const elConteudo = document.getElementById('detalhes-sepultura-conteudo');
            if (elConteudo) elConteudo.innerHTML = conteudo;
            
            // Certifica-se de que a função utilitária global do script.js esteja acessível
            if(typeof safeDisplay !== 'undefined') safeDisplay('modal-sepultura', 'block', '10005');
        }
    });
}

window.fecharModalSepultura = function() {
    if(typeof safeDisplay !== 'undefined') safeDisplay('modal-sepultura', 'none');
}