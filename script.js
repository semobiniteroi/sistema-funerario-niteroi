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

let unsubscribe = null;
let statsUnsubscribe = null; // Unsubscribe para as estatísticas
let sepulturaOriginal = ""; 
let dadosAtendimentoAtual = null;

const dimensoesUrna = {
    'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70',
    'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80',
    'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85',
    '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95',
    'PERPETUA': ''
};

// --- ESTATÍSTICAS EM TEMPO REAL ---
window.abrirModalEstatisticas = function() {
    document.getElementById('modal-estatisticas').style.display = 'block';
    // Carrega 7 dias por padrão ao abrir
    carregarEstatisticas(7);
}

window.fecharModalEstatisticas = function() {
    document.getElementById('modal-estatisticas').style.display = 'none';
    if (statsUnsubscribe) {
        statsUnsubscribe(); // Para de ouvir o banco para economizar dados
    }
}

window.carregarEstatisticas = function(dias) {
    const loading = document.getElementById('loading-stats');
    const divLista = document.getElementById('lista-estatisticas');
    
    // Limpa lista anterior e mostra loading
    divLista.innerHTML = '';
    loading.style.display = 'block';

    if (statsUnsubscribe) statsUnsubscribe();

    // Calcula data inicial (Hoje - X dias)
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const dataInicioString = dataInicio.toISOString().split('T')[0];

    // Query em tempo real
    statsUnsubscribe = db.collection("atendimentos")
        .where("data_ficha", ">=", dataInicioString)
        .onSnapshot((snapshot) => {
            loading.style.display = 'none';
            let contagemCausas = {};
            let totalMortes = 0;

            snapshot.forEach(doc => {
                const dados = doc.data();
                if (dados.causa) {
                    // Separa causas múltiplas (ex: "Infarto / Diabetes")
                    const partes = dados.causa.split('/');
                    partes.forEach(parte => {
                        const causaLimpa = parte.trim().toUpperCase();
                        if (causaLimpa) {
                            contagemCausas[causaLimpa] = (contagemCausas[causaLimpa] || 0) + 1;
                        }
                    });
                    totalMortes++;
                }
            });

            // Converte para array e ordena
            const ranking = Object.entries(contagemCausas)
                .sort((a, b) => b[1] - a[1]); // Do maior para o menor

            // Renderiza Tabela
            if (ranking.length === 0) {
                divLista.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum dado neste período.</p>';
                return;
            }

            let htmlTable = `
                <div style="margin-bottom:10px; font-weight:bold; color:#555;">
                    Total de Óbitos no período: ${totalMortes}
                </div>
                <table class="table-stats">
                    <thead><tr><th>Causa da Morte</th><th width="80">Qtd</th><th width="100">Gráfico</th></tr></thead>
                    <tbody>
            `;

            ranking.forEach(([causa, qtd]) => {
                // Calcula porcentagem para a barra
                const percent = Math.min(100, (qtd / totalMortes) * 100); 
                htmlTable += `
                    <tr>
                        <td>${causa}</td>
                        <td style="text-align:center; font-size:14px;">${qtd}</td>
                        <td>
                            <div class="progress-bar-bg">
                                <div class="progress-bar-fill" style="width: ${percent}%"></div>
                            </div>
                        </td>
                    </tr>
                `;
            });

            htmlTable += `</tbody></table>`;
            divLista.innerHTML = htmlTable;

        }, (error) => {
            console.error("Erro estatisticas:", error);
            loading.innerText = "Erro ao carregar dados.";
        });
}

// --- FUNÇÃO GERAR COMPROVANTE ---
window.gerarComprovante = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;

    const chk = (cond) => cond ? '( X )' : '(  )';
    
    const fmtData = (dataStr) => {
        if (!dataStr) return "";
        const p = dataStr.split('-');
        return `${p[2]}/${p[1]}/${p[0]}`;
    };
    
    const dataHoje = new Date();
    const dataAtualFmt = `${dataHoje.getDate().toString().padStart(2,'0')}/${(dataHoje.getMonth()+1).toString().padStart(2,'0')}/${dataHoje.getFullYear()}`;
    const horaAtualFmt = `${dataHoje.getHours().toString().padStart(2,'0')}:${dataHoje.getMinutes().toString().padStart(2,'0')}`;

    const htmlComprovante = `
    <html>
    <head>
        <title>Comprovante de Atendimento</title>
        <style>
            body { font-family: "Courier New", Courier, monospace; font-size: 12px; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .titulo { font-weight: bold; font-size: 16px; margin: 10px 0; text-align: center; }
            .linha { margin: 5px 0; display: block; line-height: 1.5; }
            .campo { font-weight: bold; }
            .box { border: 1px solid #000; padding: 10px; margin: 10px 0; }
            .assinaturas { margin-top: 50px; display: flex; justify-content: space-between; }
            .assinatura-box { text-align: center; border-top: 1px solid #000; width: 45%; padding-top: 5px; }
            .obs-box { border: 1px solid #000; padding: 5px; font-size: 11px; margin-top: 10px; }
            @media print {
                @page { size: portrait; margin: 10mm; }
                .no-print { display: none; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>PREFEITURA MUNICIPAL DE NITERÓI</h2>
            <p>ACOLHIMENTO - SERVIÇOS FUNERÁRIOS</p>
        </div>

        <div class="titulo">COMPROVANTE DE ATENDIMENTO</div>

        <div class="box">
            <span class="linha"><span class="campo">FALECIDO:</span> ${d.nome.toUpperCase()}</span>
            <span class="linha"><span class="campo">FUNERÁRIA:</span> ${d.funeraria.toUpperCase()}</span>
            <span class="linha"><span class="campo">DATA ATENDIMENTO:</span> ${dataAtualFmt} <span class="campo">HORA:</span> ${horaAtualFmt}</span>
        </div>

        <div class="box">
            <span class="linha"><span class="campo">SEPULTAMENTO:</span> ${fmtData(d.data_ficha)} <span class="campo">HORA:</span> ${d.hora}</span>
            <span class="linha">
                <span class="campo">CEMITÉRIO:</span> 
                ${chk(d.local.includes('MARUÍ'))} MARUÍ 
                ${chk(d.local.includes('SÃO FRANCISCO'))} SÃO FRANCISCO 
                ${chk(d.local.includes('ITAIPU'))} ITAIPU
            </span>
            <span class="linha">
                <span class="campo">SEPULTURA:</span> ${d.sepul} 
                <span class="campo">QUADRA:</span> ${d.qd} 
                <span class="campo">CAPELA:</span> ${d.cap}
            </span>
            <span class="linha">
                <span class="campo">DATA FALECIMENTO:</span> ${fmtData(d.data_obito)} <span class="campo">HORA:</span> ${d.hora_obito}
            </span>
        </div>

        <div class="box">
            <div class="linha"><span class="campo">ESTADO CIVIL:</span> ( ) SOLTEIRO ( ) CASADO ( ) VÍUVO ( ) UNIÃO ESTÁVEL ( ) DIVORCIADO</div>
            <div class="linha" style="margin-top: 10px; font-weight:bold;">TIPO DE SEPULTURA:</div>
            <div class="linha">
                ${chk(d.tipo_sepultura === 'GAVETA' && d.classificacao_obito === 'ADULTO')} Gaveta Adulto 
                ${chk(d.tipo_sepultura === 'CARNEIRO' && d.classificacao_obito === 'ADULTO')} Carneira Adulto 
                ${chk(d.tipo_sepultura === 'COVA RASA' && d.classificacao_obito === 'ADULTO')} Cova Rasa Adulto
            </div>
            <div class="linha">
                ${chk(d.tipo_sepultura === 'GAVETA' && d.classificacao_obito === 'ANJO')} Gaveta Anjo 
                ${chk(d.tipo_sepultura === 'CARNEIRO' && d.classificacao_obito === 'ANJO')} Carneira Anjo 
                ${chk(d.tipo_sepultura === 'PERPETUA')} Perpétuo
            </div>
            <div class="linha" style="margin-top: 10px;">
                <span class="campo">TANATOPRAXIA:</span> ${chk(d.tanato === 'SIM')} SIM ${chk(d.tanato !== 'SIM')} NÃO
            </div>
        </div>

        <div class="obs-box">
            <strong>OBSERVAÇÕES:</strong><br>
            1. PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.<br>
            2. VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO.<br>
            3. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.<br>
            4. TAXAS MUNICIPAIS E INVOL DEVEM SER PAGOS COM DUAS HORAS DE ANTECEDÊNCIA.
        </div>

        <div style="margin-top: 20px; font-size: 11px;">
            <strong>TERMO DE COMPROMISSO CEMITÉRIOS MUNICIPAIS:</strong><br>
            Sendo o FALECIDO CASADO, o responsável será obrigatoriamente o CÔNJUGE.<br>
            Sendo o FALECIDO VIÚVO, os responsáveis serão obrigatoriamente os FILHOS.<br>
            Sendo o FALECIDO SOLTEIRO, os responsáveis serão obrigatoriamente FILHOS, PAIS ou IRMÃOS.<br>
            <em>Será exigida a apresentação de documentos de IDENTIDADE e CPF.</em>
        </div>

        <div class="assinaturas">
            <div class="assinatura-box">
                Assinatura Funcionário (Acolhimento)
            </div>
            <div class="assinatura-box">
                Assinatura Responsável / Família<br>
                <span style="font-size:10px;">${d.resp_nome.toUpperCase()}</span>
            </div>
        </div>

        <div class="obs-box" style="margin-top: 20px;">
            <strong>COMUNICADO:</strong><br>
            Somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação:
            GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL), TAXAS MUNICIPAIS PAGAS e INVOL.
        </div>

        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(htmlComprovante);
    win.document.close();
}

window.alternarDesign = function() {
    document.body.classList.toggle('design-classico');
    const isClassic = document.body.classList.contains('design-classico');
    localStorage.setItem('designMode', isClassic ? 'classico' : 'moderno');
}

window.imprimirRelatorio = function(modo) {
    const oldStyle = document.getElementById('print-style');
    if (oldStyle) oldStyle.remove();
    const style = document.createElement('style');
    style.id = 'print-style';
    style.innerHTML = `@page { size: ${modo}; margin: 5mm; }`;
    document.head.appendChild(style);
    setTimeout(() => { window.print(); }, 200);
}

function carregarCidades(uf, cidadeSelecionada = "") {
    const selectCidade = document.getElementById('cidade_obito');
    if(!uf) {
        selectCidade.innerHTML = '<option value="">Selecione a UF primeiro</option>';
        selectCidade.disabled = true;
        return;
    }
    selectCidade.innerHTML = '<option value="">Carregando...</option>';
    selectCidade.disabled = true;

    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
        .then(response => response.json())
        .then(cidades => {
            selectCidade.innerHTML = '<option value="">Selecione...</option>';
            cidades.sort((a, b) => a.nome.localeCompare(b.nome));
            cidades.forEach(cidade => {
                const opt = document.createElement('option');
                opt.value = cidade.nome.toUpperCase(); 
                opt.text = cidade.nome.toUpperCase();
                if (cidade.nome.toUpperCase() === cidadeSelecionada) opt.selected = true;
                selectCidade.appendChild(opt);
            });
            selectCidade.disabled = false;
        })
        .catch(err => {
            console.error(err);
            selectCidade.innerHTML = '<option value="">Erro ao carregar</option>';
        });
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('designMode') === 'classico') {
        document.body.classList.add('design-classico');
    }

    const selectHora = document.getElementById('hora');
    selectHora.innerHTML = '<option value="">--:--</option>';
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
            const opt = document.createElement('option');
            opt.value = val; opt.text = val;
            selectHora.appendChild(opt);
        }
    }

    const hoje = new Date().toISOString().split('T')[0];
    const inputData = document.getElementById('filtro-data');
    const inputLocal = document.getElementById('filtro-local');
    
    inputData.value = hoje;
    atualizarListener(hoje, inputLocal.value);

    inputData.addEventListener('change', (e) => atualizarListener(e.target.value, inputLocal.value));
    inputLocal.addEventListener('change', (e) => atualizarListener(inputData.value, e.target.value));

    const seletorCausas = document.getElementById('seletor_causas');
    if (seletorCausas) {
        seletorCausas.addEventListener('change', function() {
            const inputCausa = document.getElementById("causa");
            if (this.value) {
                inputCausa.value = inputCausa.value ? inputCausa.value + " / " + this.value : this.value;
                this.value = ""; 
            }
        });
    }

    const inputHospital = document.getElementById('hospital');
    const divDomicilio = document.getElementById('div-local-domicilio');
    inputHospital.addEventListener('input', function() {
        const val = this.value.toUpperCase();
        if (val.includes('DOMICÍLIO') || val.includes('DOMICILIO')) {
            divDomicilio.classList.remove('hidden');
        } else {
            divDomicilio.classList.add('hidden');
            document.getElementById('estado_obito').value = "";
            document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF</option>';
            document.getElementById('cidade_obito').disabled = true;
        }
    });

    document.getElementById('estado_obito').addEventListener('change', function() {
        carregarCidades(this.value);
    });

    const inputSepul = document.getElementById('sepul');
    const divMotivo = document.getElementById('div-motivo-sepultura');
    inputSepul.addEventListener('input', function() {
        if (sepulturaOriginal && this.value !== sepulturaOriginal) {
            divMotivo.classList.remove('hidden');
        } else {
            divMotivo.classList.add('hidden');
            document.getElementById('motivo_troca_sepultura').value = "";
        }
    });
});

function atualizarListener(dataSelecionada, localSelecionado) {
    if (unsubscribe) unsubscribe();
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Carregando dados...</td></tr>';

    unsubscribe = db.collection("atendimentos")
      .where("data_ficha", "==", dataSelecionada) 
      .onSnapshot((snapshot) => {
          let lista = [];
          snapshot.forEach(doc => {
              let dado = doc.data();
              dado.id = doc.id;
              const localReg = dado.local || "CEMITÉRIO DO MARUÍ";
              if (localReg === localSelecionado) lista.push(dado);
          });
          lista.sort((a, b) => {
              if (a.hora < b.hora) return -1;
              if (a.hora > b.hora) return 1;
              return 0;
          });
          renderizarTabela(lista);
      }, (err) => {
          console.error(err);
          tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>';
      });
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = ''; 

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="padding: 40px; text-align:center; color:#b5b5c3;">Nenhum atendimento.</td></tr>';
        return;
    }

    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => visualizar(item.id);
        tr.title = "Clique para ver detalhes";

        let displayResponsavel = "";
        if (item.isencao === "50") {
            displayResponsavel += `ACOLHIMENTO <span style="font-weight:900;">50% DE ISENÇÃO</span>`;
            if(item.requisito) displayResponsavel += `<br>REQ: ${item.requisito.toUpperCase()}`;
            displayResponsavel += `<br>`;
        } else if (item.isencao === "SIM") {
            displayResponsavel += `ACOLHIMENTO <span style="font-weight:900;">100% DE ISENÇÃO</span>`;
            if(item.requisito) displayResponsavel += `<br>REQ: ${item.requisito.toUpperCase()}`;
            displayResponsavel += `<br>`;
        } else {
            if (item.funeraria) displayResponsavel += `${item.funeraria.toUpperCase()}<br>`;
            else if (item.resp_nome) displayResponsavel += `${item.resp_nome.toUpperCase()}<br>`;
        }

        if (item.tipo_urna_detalhe) displayResponsavel += `<span style="font-weight:bold;">${item.tipo_urna_detalhe.toUpperCase()}</span><br>`;
        if (item.combo_urna && dimensoesUrna[item.combo_urna]) displayResponsavel += `URNA ${item.combo_urna}<br>${dimensoesUrna[item.combo_urna]}<br>`;
        else if (item.combo_urna) displayResponsavel += `URNA ${item.combo_urna}<br>`;

        let servicosExtras = [];
        if (item.tanato === 'SIM') servicosExtras.push('TANATOPRAXIA');
        if (item.invol === 'SIM') servicosExtras.push('INVOL');
        if (item.translado === 'SIM') servicosExtras.push('TRANSLADO');
        if (item.urna_opc === 'SIM') servicosExtras.push('URNA');
        if (servicosExtras.length > 0) displayResponsavel += `<div style="margin-top:2px; font-weight:bold; font-size:10px;">SERVIÇOS: ${servicosExtras.join(', ')}</div>`;

        if (item.urna_info) displayResponsavel += `<span style="font-weight:normal; font-size:11px;">${item.urna_info.toUpperCase()}</span>`;

        const conteudoNome = `<div style="font-weight:700; font-size:12px;">${item.nome.toUpperCase()}</div>
                              <div class="texto-vermelho" style="font-size:11px; margin-top:2px;">
                                (${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})
                              </div>
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
        } else if (item.falecimento) displayFalecimento = `<div>${item.falecimento}</div>`;

        tr.innerHTML = `
            <td style="white-space: normal; vertical-align: top;">${displayResponsavel}</td>
            <td style="text-align: center;">${item.hora || ''}</td>
            <td style="text-align: center; vertical-align: middle;">${conteudoNome}</td>
            <td style="text-align: center;">${item.gav || ''}</td>
            <td style="text-align: center;">${item.car || ''}</td>
            <td style="text-align: center;">${item.sepul || ''}</td>
            <td style="text-align: center;">${item.qd || ''}</td>
            <td style="text-align: center;">${item.hospital || ''}</td>
            <td style="text-align: center;">${item.cap || ''}</td>
            <td style="text-align: center;">${displayFalecimento}</td>
            <td style="text-align: right;">
                <div class="t-acoes">
                    <button class="btn-icon btn-editar-circle" onclick="event.stopPropagation(); editar('${item.id}')">✏️</button>
                    <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation(); excluir('${item.id}')">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODAIS ---
const modal = document.getElementById('modal');
const modalVisualizar = document.getElementById('modal-visualizar');
const form = document.getElementById('form-atendimento');

function abrirModal() {
    form.reset();
    document.getElementById('docId').value = '';
    document.getElementById('tipo_sepultura').value = "";
    document.getElementById('isencao').value = "NAO"; 
    document.getElementById('combo_urna').value = ""; 
    document.getElementById('tipo_urna_detalhe').value = "";
    document.getElementById('requisito').value = "";
    document.getElementById('seletor_causas').value = "";
    document.getElementById('classificacao_obito').value = "ADULTO";
    document.getElementById('do_24h').value = "NAO"; 
    document.getElementById('hora').value = ""; 
    
    document.getElementById('chk_tanato').checked = false;
    document.getElementById('chk_invol').checked = false;
    document.getElementById('chk_translado').checked = false;
    document.getElementById('chk_urna_opc').checked = false;

    document.getElementById('div-local-domicilio').classList.add('hidden');
    document.getElementById('div-motivo-sepultura').classList.add('hidden');
    document.getElementById('estado_obito').value = "";
    document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF</option>';
    document.getElementById('cidade_obito').disabled = true;
    sepulturaOriginal = ""; 
    modal.style.display = 'block';
}

function fecharModal() { modal.style.display = 'none'; }
function fecharModalVisualizar() { modalVisualizar.style.display = 'none'; }

window.visualizar = function(id) {
    db.collection("atendimentos").doc(id).get().then((doc) => {
        if (doc.exists) {
            const item = doc.data();
            dadosAtendimentoAtual = item;
            document.getElementById('view_hora').innerText = item.hora || '-';
            let respTexto = item.resp_nome || '-';
            if (item.parentesco) respTexto += ` (${item.parentesco})`;
            document.getElementById('view_resp_completo').innerText = respTexto;
            document.getElementById('view_funeraria').innerText = item.funeraria || '-';
            
            let textoIsencao = "NÃO (Pago)";
            if (item.isencao === "SIM") textoIsencao = "SIM (100% Isenção)";
            if (item.isencao === "50") textoIsencao = "SIM (50% Isenção)";
            if (item.requisito) textoIsencao += ` - ${item.requisito}`;
            document.getElementById('view_isencao_completa').innerText = textoIsencao;

            document.getElementById('view_urna_info').innerText = item.urna_info || '-';
            if(item.motivo_troca_sepultura) document.getElementById('view_urna_info').innerText += `\n[TROCA SEPULTURA: ${item.motivo_troca_sepultura}]`;

            document.getElementById('view_combo_urna').innerText = item.combo_urna || '-';
            document.getElementById('view_tipo_urna_detalhe').innerText = item.tipo_urna_detalhe || '-';
            
            let servicosView = [];
            if (item.tanato === 'SIM') servicosView.push('Tanatopraxia');
            if (item.invol === 'SIM') servicosView.push('Invol');
            if (item.translado === 'SIM') servicosView.push('Translado');
            if (item.urna_opc === 'SIM') servicosView.push('Urna');
            document.getElementById('view_servicos_adicionais').innerText = servicosView.length > 0 ? servicosView.join(', ') : '-';

            let nomeView = item.nome || '-';
            if (item.classificacao_obito === "ANJO") nomeView += " (ANJO)";
            document.getElementById('view_nome').innerText = nomeView;
            document.getElementById('view_causa').innerText = item.causa || '-';
            
            if (item.do_24h === 'SIM') document.getElementById('view_do_24h').innerText = "[LIBERAÇÃO < 24H]";
            else document.getElementById('view_do_24h').innerText = "";

            let tipo = '';
            if (item.gav && item.gav.includes('X')) tipo = 'GAVETA';
            else if (item.car && item.car.includes('X')) tipo = 'CARNEIRO';
            else if (item.cova_rasa === 'X') tipo = 'COVA RASA';
            else if (item.perpetua === 'X') tipo = 'PERPÉTUA';
            document.getElementById('view_tipo_sepultura').innerText = tipo || '-';
            
            document.getElementById('view_sepul').innerText = item.sepul || '-';
            document.getElementById('view_qd').innerText = item.qd || '-';
            
            let hospitalView = item.hospital || '-';
            if ((item.hospital && item.hospital.includes('DOMICÍLIO')) || (item.hospital && item.hospital.includes('DOMICILIO'))) {
                hospitalView += ` (${item.cidade_obito || ''} - ${item.estado_obito || ''})`;
            }
            document.getElementById('view_hospital_completo').innerText = hospitalView;
            document.getElementById('view_cap').innerText = item.cap || '-';
            
            let dataFormatada = item.data_obito;
            if (dataFormatada && dataFormatada.includes('-')) {
                const p = dataFormatada.split('-');
                dataFormatada = `${p[2]}/${p[1]}/${p[0]}`;
            }
            document.getElementById('view_data_obito').innerText = dataFormatada || '-';
            document.getElementById('view_hora_obito').innerText = item.hora_obito || '-';

            modalVisualizar.style.display = 'block';
        }
    });
}

window.editar = function(id) {
    db.collection("atendimentos").doc(id).get().then((doc) => {
        if (doc.exists) {
            const item = doc.data();
            document.getElementById('docId').value = doc.id;
            
            const selectHora = document.getElementById('hora');
            const horaSalva = item.hora;
            let optionExists = false;
            for(let i=0; i<selectHora.options.length; i++){
                if(selectHora.options[i].value == horaSalva) optionExists = true;
            }
            if(!optionExists && horaSalva) {
                const opt = document.createElement('option');
                opt.value = horaSalva; opt.text = horaSalva;
                selectHora.add(opt);
            }
            selectHora.value = horaSalva || "";

            document.getElementById('nome').value = item.nome;
            document.getElementById('causa').value = item.causa;
            document.getElementById('resp_nome').value = item.resp_nome || '';
            document.getElementById('parentesco').value = item.parentesco || ''; 
            document.getElementById('classificacao_obito').value = item.classificacao_obito || 'ADULTO';
            document.getElementById('do_24h').value = item.do_24h || 'NAO'; 

            document.getElementById('urna_info').value = item.urna_info || item.responsavel || '';
            document.getElementById('combo_urna').value = item.combo_urna || ""; 
            document.getElementById('tipo_urna_detalhe').value = item.tipo_urna_detalhe || "";
            document.getElementById('funeraria').value = item.funeraria || '';
            document.getElementById('isencao').value = item.isencao || 'NAO';
            document.getElementById('requisito').value = item.requisito || '';
            document.getElementById('data_obito').value = item.data_obito || '';
            document.getElementById('hora_obito').value = item.hora_obito || '';
            
            document.getElementById('chk_tanato').checked = (item.tanato === 'SIM');
            document.getElementById('chk_invol').checked = (item.invol === 'SIM');
            document.getElementById('chk_translado').checked = (item.translado === 'SIM');
            document.getElementById('chk_urna_opc').checked = (item.urna_opc === 'SIM');

            const selectTipo = document.getElementById('tipo_sepultura');
            if (item.gav && item.gav.includes('X')) selectTipo.value = 'GAVETA';
            else if (item.car && item.car.includes('X')) selectTipo.value = 'CARNEIRO';
            else if (item.cova_rasa === 'X') selectTipo.value = 'COVA RASA';
            else if (item.perpetua === 'X') selectTipo.value = 'PERPETUA';
            else selectTipo.value = '';

            sepulturaOriginal = item.sepul; 
            document.getElementById('sepul').value = item.sepul;
            document.getElementById('motivo_troca_sepultura').value = item.motivo_troca_sepultura || '';
            
            document.getElementById('qd').value = item.qd;
            document.getElementById('hospital').value = item.hospital;
            document.getElementById('estado_obito').value = item.estado_obito || '';
            
            if (item.estado_obito) {
                carregarCidades(item.estado_obito, item.cidade_obito);
            } else {
                document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>';
                document.getElementById('cidade_obito').disabled = true;
            }
            
            document.getElementById('hospital').dispatchEvent(new Event('input'));
            document.getElementById('sepul').dispatchEvent(new Event('input'));
            document.getElementById('cap').value = item.cap;
            
            modal.style.display = 'block';
        }
    });
}

form.onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('docId').value;
    const tipoSelecionado = document.getElementById('tipo_sepultura').value;
    const dataFicha = document.getElementById('filtro-data').value;
    const localSelecionado = document.getElementById('filtro-local').value;

    const dados = {
        data_ficha: dataFicha, local: localSelecionado,
        hora: document.getElementById('hora').value,
        resp_nome: document.getElementById('resp_nome').value,
        parentesco: document.getElementById('parentesco').value, 
        classificacao_obito: document.getElementById('classificacao_obito').value, 
        do_24h: document.getElementById('do_24h').value,
        urna_info: document.getElementById('urna_info').value,
        combo_urna: document.getElementById('combo_urna').value, 
        tipo_urna_detalhe: document.getElementById('tipo_urna_detalhe').value,
        funeraria: document.getElementById('funeraria').value,
        isencao: document.getElementById('isencao').value,
        requisito: document.getElementById('requisito').value, 
        tanato: document.getElementById('chk_tanato').checked ? 'SIM' : 'NAO',
        invol: document.getElementById('chk_invol').checked ? 'SIM' : 'NAO',
        translado: document.getElementById('chk_translado').checked ? 'SIM' : 'NAO',
        urna_opc: document.getElementById('chk_urna_opc').checked ? 'SIM' : 'NAO',
        nome: document.getElementById('nome').value,
        causa: document.getElementById('causa').value,
        gav: (tipoSelecionado === 'GAVETA') ? 'X' : '',
        car: (tipoSelecionado === 'CARNEIRO') ? 'X' : '',
        cova_rasa: (tipoSelecionado === 'COVA RASA') ? 'X' : '',
        perpetua: (tipoSelecionado === 'PERPETUA') ? 'X' : '',
        sepul: document.getElementById('sepul').value,
        motivo_troca_sepultura: document.getElementById('motivo_troca_sepultura').value, 
        qd: document.getElementById('qd').value,
        hospital: document.getElementById('hospital').value,
        cidade_obito: document.getElementById('cidade_obito').value, 
        estado_obito: document.getElementById('estado_obito').value, 
        cap: document.getElementById('cap').value,
        data_obito: document.getElementById('data_obito').value,
        hora_obito: document.getElementById('hora_obito').value
    };

    if (id) {
        db.collection("atendimentos").doc(id).update(dados)
          .then(() => fecharModal())
          .catch((error) => alert("Erro ao atualizar: " + error));
    } else {
        db.collection("atendimentos").add(dados)
          .then(() => fecharModal())
          .catch((error) => alert("Erro ao salvar: " + error));
    }
};

window.excluir = function(id) {
    if(confirm('Tem certeza?')) {
        db.collection("atendimentos").doc(id).delete().catch((e) => alert("Erro: " + e));
    }
}

window.onclick = function(event) {
    if (event.target == modal) fecharModal();
    if (event.target == modalVisualizar) fecharModalVisualizar();
    if (event.target == document.getElementById('modal-estatisticas')) fecharModalEstatisticas();
}