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
let statsUnsubscribe = null;
let sepulturaOriginal = ""; 
let dadosAtendimentoAtual = null;
let dadosEstatisticasExportacao = [];
let chartInstance = null;

const dimensoesUrna = {
    'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70',
    'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80',
    'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85',
    '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95',
    'PERPETUA': ''
};

// --- NOVA FUNÇÃO DE BUSCA GLOBAL ---
window.realizarBusca = function() {
    const input = document.getElementById('input-busca');
    const termo = input.value.trim().toUpperCase();

    if (!termo) {
        alert("Digite um nome para buscar.");
        return;
    }

    if (unsubscribe) unsubscribe();

    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Buscando em todo o histórico...</td></tr>';

    db.collection("atendimentos")
        .orderBy("nome")
        .startAt(termo)
        .endAt(termo + "\uf8ff")
        .limit(50)
        .get()
        .then((querySnapshot) => {
            let lista = [];
            querySnapshot.forEach((doc) => {
                let d = doc.data();
                d.id = doc.id;
                lista.push(d);
            });

            if (lista.length === 0) {
                tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 20px;">Nenhum registro encontrado para "${termo}".</td></tr>`;
            } else {
                renderizarTabela(lista);
            }
        })
        .catch((error) => {
            console.error("Erro na busca:", error);
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Erro ao buscar dados.</td></tr>';
        });
}

// --- FUNÇÃO GERAR ETIQUETA ---
window.gerarEtiqueta = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const fmtData = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

    const htmlEtiqueta = `
    <html><head><title>Etiqueta Capela</title><style>
        body { font-family: 'Arial', sans-serif; text-align: center; margin: 0; padding: 20px; }
        .container { border: 5px solid #000; padding: 20px; height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .header { font-size: 20px; text-transform: uppercase; margin-bottom: 30px; font-weight: bold; }
        .label { font-size: 24px; color: #555; margin-bottom: 5px; text-transform: uppercase; }
        .value-name { font-size: 60px; font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-bottom: 40px; }
        .value-time { font-size: 50px; font-weight: 800; margin-bottom: 40px; }
        .value-location { font-size: 35px; font-weight: bold; text-transform: uppercase; }
        @media print { @page { size: landscape; margin: 0; } .container { border: none; height: 100vh; } }
    </style></head><body>
        <div class="container">
            <div class="header">
                <img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height: 80px;"><br>
                Identificação de Velório
            </div>
            <div class="label">Falecido(a)</div><div class="value-name">${d.nome}</div>
            <div class="label">Horário de Sepultamento</div><div class="value-time">${fmtData(d.data_ficha)} às ${d.hora}</div>
            <div class="label">Local</div><div class="value-location">${d.cap} <br> ${d.local || "CEMITÉRIO DO MARUÍ"}</div>
        </div>
        <script>window.onload = function() { window.print(); }</script></body></html>`;
    const win = window.open('', '_blank'); win.document.write(htmlEtiqueta); win.document.close();
}

// --- FUNÇÃO ENVIAR WHATSAPP (CORRIGIDA) ---
window.enviarWhatsapp = function() {
    if (!dadosAtendimentoAtual) return;
    
    // Remove tudo que não é número
    const tel = dadosAtendimentoAtual.telefone ? dadosAtendimentoAtual.telefone.replace(/\D/g, '') : '';
    const coords = dadosAtendimentoAtual.geo_coords;
    
    if (!tel) { alert("Telefone não cadastrado para este atendimento."); return; }
    if (!coords) { alert("Geolocalização da sepultura não cadastrada."); return; }
    
    // Monta a mensagem
    const msg = `Olá, segue a localização da sepultura de *${dadosAtendimentoAtual.nome}*: https://www.google.com/maps/search/?api=1&query=${coords}`;
    
    // Link API universal (tenta abrir app, senão web)
    const url = `https://api.whatsapp.com/send?phone=55${tel}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
}

// --- FUNÇÃO ENVIAR SMS (GRATUITA VIA PROTOCOLO) ---
window.enviarSMS = function() {
    if (!dadosAtendimentoAtual) return;
    
    const tel = dadosAtendimentoAtual.telefone ? dadosAtendimentoAtual.telefone.replace(/\D/g, '') : '';
    const coords = dadosAtendimentoAtual.geo_coords;
    
    if (!tel) { alert("Telefone não cadastrado."); return; }
    if (!coords) { alert("Geolocalização não cadastrada."); return; }
    
    const msg = `Localização sepultura ${dadosAtendimentoAtual.nome}: https://www.google.com/maps/search/?api=1&query=${coords}`;
    
    // Detecta sistema para usar o separador correto
    const ua = navigator.userAgent.toLowerCase();
    let separator = '?';
    if (ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1) { separator = '&'; }
    
    window.location.href = `sms:55${tel}${separator}body=${encodeURIComponent(msg)}`;
}

// --- ESTATÍSTICAS ---
window.abrirModalEstatisticas = function() { document.getElementById('modal-estatisticas').style.display = 'block'; carregarEstatisticas(7); }
window.fecharModalEstatisticas = function() { document.getElementById('modal-estatisticas').style.display = 'none'; if (statsUnsubscribe) statsUnsubscribe(); }

window.carregarEstatisticas = function(dias) {
    const loading = document.getElementById('loading-stats');
    const divLista = document.getElementById('lista-estatisticas');
    divLista.innerHTML = ''; loading.style.display = 'block';
    if (statsUnsubscribe) statsUnsubscribe();

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const dataInicioString = dataInicio.toISOString().split('T')[0];

    statsUnsubscribe = db.collection("atendimentos").where("data_ficha", ">=", dataInicioString).onSnapshot((snapshot) => {
        loading.style.display = 'none';
        let contagemCausas = {}; let totalMortes = 0;
        snapshot.forEach(doc => {
            const dados = doc.data();
            if (dados.causa) {
                const partes = dados.causa.split('/');
                partes.forEach(parte => {
                    const causaLimpa = parte.trim().toUpperCase();
                    if (causaLimpa) contagemCausas[causaLimpa] = (contagemCausas[causaLimpa] || 0) + 1;
                });
                totalMortes++;
            }
        });
        const ranking = Object.entries(contagemCausas).sort((a, b) => b[1] - a[1]);
        dadosEstatisticasExportacao = ranking.map(([causa, qtd]) => ({ "Causa da Morte": causa, "Quantidade": qtd, "Porcentagem": ((qtd / totalMortes) * 100).toFixed(2) + '%' }));
        const labels = ranking.map(r => r[0]); const dataValues = ranking.map(r => r[1]);
        renderizarGrafico(labels, dataValues);
        if (ranking.length === 0) { divLista.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum dado neste período.</p>'; return; }
        let htmlTable = `<div style="margin-bottom:10px; font-weight:bold; color:#555;">Total: ${totalMortes} registros</div><table class="table-stats"><thead><tr><th>Causa da Morte</th><th width="80">Qtd</th></tr></thead><tbody>`;
        ranking.forEach(([causa, qtd]) => { htmlTable += `<tr><td>${causa}</td><td style="text-align:center;">${qtd}</td></tr>`; });
        htmlTable += `</tbody></table>`;
        divLista.innerHTML = htmlTable;
    }, (error) => { console.error("Erro stats:", error); loading.innerText = "Erro ao carregar."; });
}

function renderizarGrafico(labels, dataValues) {
    const ctx = document.getElementById('grafico-causas').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels.slice(0, 10), datasets: [{ label: 'Ocorrências', data: dataValues.slice(0, 10), backgroundColor: '#3699ff', borderColor: '#187de4', borderWidth: 1 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { ticks: { font: { size: 10 } } } }, plugins: { legend: { display: false }, title: { display: true, text: 'Top 10 Causas de Morte' } } } });
}

window.baixarExcel = function() {
    if (dadosEstatisticasExportacao.length === 0) { alert("Sem dados."); return; }
    const worksheet = XLSX.utils.json_to_sheet(dadosEstatisticasExportacao);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estatísticas");
    XLSX.writeFile(workbook, "Relatorio_Causas_Morte.xlsx");
}

window.baixarPDF = function() {
    if (dadosEstatisticasExportacao.length === 0) { alert("Sem dados."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatório de Causas de Morte", 14, 15);
    const tableColumn = ["Causa da Morte", "Quantidade", "Porcentagem"];
    const tableRows = dadosEstatisticasExportacao.map(item => [item["Causa da Morte"], item["Quantidade"], item["Porcentagem"]]);
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    doc.save("Relatorio_Causas_Morte.pdf");
}

// --- FUNÇÃO GERAR COMPROVANTE (COM LOGO) ---
window.gerarComprovante = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const chk = (cond) => cond ? '( X )' : '(  )';
    const fmtData = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
    const dataHoje = new Date();
    const dataAtualFmt = `${dataHoje.getDate().toString().padStart(2,'0')}/${(dataHoje.getMonth()+1).toString().padStart(2,'0')}/${dataHoje.getFullYear()}`;
    const horaAtualFmt = `${dataHoje.getHours().toString().padStart(2,'0')}:${dataHoje.getMinutes().toString().padStart(2,'0')}`;

    const htmlComprovante = `
    <html><head><title>Comprovante de Atendimento</title><style>body { font-family: "Courier New", Courier, monospace; font-size: 12px; margin: 20px; } .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; } .titulo { font-weight: bold; font-size: 16px; margin: 10px 0; text-align: center; } .linha { margin: 5px 0; display: block; line-height: 1.5; } .campo { font-weight: bold; } .box { border: 1px solid #000; padding: 10px; margin: 10px 0; } .assinaturas { margin-top: 50px; display: flex; justify-content: space-between; } .assinatura-box { text-align: center; border-top: 1px solid #000; width: 45%; padding-top: 5px; } .obs-box { border: 1px solid #000; padding: 5px; font-size: 11px; margin-top: 10px; } @media print { @page { size: portrait; margin: 10mm; } .no-print { display: none; } }</style></head><body><div class="header"><img src="https://niteroi.rj.gov.br/wp-content/uploads/2025/06/pmnlogo-2.png" style="max-height: 70px; max-width: 300px; margin-bottom: 10px;"><p style="margin: 0; font-weight: bold;">ACOLHIMENTO - SERVIÇOS FUNERÁRIOS</p></div><div class="titulo">COMPROVANTE DE ATENDIMENTO</div><div class="box"><span class="linha"><span class="campo">FALECIDO:</span> ${d.nome.toUpperCase()}</span><span class="linha"><span class="campo">FUNERÁRIA:</span> ${d.funeraria.toUpperCase()}</span><span class="linha"><span class="campo">DATA ATENDIMENTO:</span> ${dataAtualFmt} <span class="campo">HORA:</span> ${horaAtualFmt}</span></div><div class="box"><span class="linha"><span class="campo">SEPULTAMENTO:</span> ${fmtData(d.data_ficha)} <span class="campo">HORA:</span> ${d.hora}</span><span class="linha"><span class="campo">CEMITÉRIO:</span> ${chk(d.local.includes('MARUÍ'))} MARUÍ ${chk(d.local.includes('SÃO FRANCISCO'))} SÃO FRANCISCO ${chk(d.local.includes('ITAIPU'))} ITAIPU</span><span class="linha"><span class="campo">SEPULTURA:</span> ${d.sepul} <span class="campo">QUADRA:</span> ${d.qd} <span class="campo">CAPELA:</span> ${d.cap}</span><span class="linha"><span class="campo">DATA FALECIMENTO:</span> ${fmtData(d.data_obito)} <span class="campo">HORA:</span> ${d.hora_obito}</span></div><div class="box"><div class="linha"><span class="campo">ESTADO CIVIL:</span> ( ) SOLTEIRO ( ) CASADO ( ) VÍUVO ( ) UNIÃO ESTÁVEL ( ) DIVORCIADO</div><div class="linha" style="margin-top: 10px; font-weight:bold;">TIPO DE SEPULTURA:</div><div class="linha">${chk(d.tipo_sepultura === 'GAVETA' && d.classificacao_obito === 'ADULTO')} Gaveta Adulto ${chk(d.tipo_sepultura === 'CARNEIRO' && d.classificacao_obito === 'ADULTO')} Carneira Adulto ${chk(d.tipo_sepultura === 'COVA RASA' && d.classificacao_obito === 'ADULTO')} Cova Rasa Adulto</div><div class="linha">${chk(d.tipo_sepultura === 'GAVETA' && d.classificacao_obito === 'ANJO')} Gaveta Anjo ${chk(d.tipo_sepultura === 'CARNEIRO' && d.classificacao_obito === 'ANJO')} Carneira Anjo ${chk(d.tipo_sepultura === 'PERPETUA')} Perpétuo</div><div class="linha" style="margin-top: 10px;"><span class="campo">TANATOPRAXIA:</span> ${chk(d.tanato === 'SIM')} SIM ${chk(d.tanato !== 'SIM')} NÃO</div></div><div class="obs-box"><strong>OBSERVAÇÕES:</strong><br>1. PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.<br>2. VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO.<br>3. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.<br>4. TAXAS MUNICIPAIS E INVOL DEVEM SER PAGOS COM DUAS HORAS DE ANTECEDÊNCIA.</div><div class="assinaturas"><div class="assinatura-box">Assinatura Funcionário (Acolhimento)</div><div class="assinatura-box">Assinatura Responsável / Família<br><span style="font-size:10px;">${d.resp_nome.toUpperCase()}</span></div></div><div class="obs-box" style="margin-top: 20px;"><strong>COMUNICADO:</strong><br>Somente será autorizada a entrada do corpo para velório e sepultamento mediante a apresentação: GUIA DE SEPULTAMENTO, NOTA FISCAL (EMPRESA RESPONSÁVEL), TAXAS MUNICIPAIS PAGAS e INVOL.</div><script>window.onload = function() { window.print(); }</script></body></html>`;
    const win = window.open('', '_blank'); win.document.write(htmlComprovante); win.document.close();
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

    // Nova Busca Global
    const inputBusca = document.getElementById('input-busca');
    if(inputBusca) {
        inputBusca.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                window.realizarBusca();
            }
        });
        inputBusca.addEventListener('input', function() {
            if (this.value.trim() === "") {
                atualizarListener(inputData.value, inputLocal.value);
            }
        });
    }

    // --- LISTENER DO SELETOR DE CAUSAS (COM ALERTA AMPLIADO) ---
    const seletorCausas = document.getElementById('seletor_causas');
    if (seletorCausas) {
        seletorCausas.addEventListener('change', function() {
            const inputCausa = document.getElementById("causa");
            if (this.value) {
                // Alerta de Doença Contagiosa
                const val = this.value.toUpperCase();
                const doencasContagiosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HEPATITE', 'HIV', 'SIDA', 'INFLUENZA', 'SARAMPO', 'FEBRE AMARELA', 'LEPTOSPIROSE', 'SEPCEMIA'];
                const ehContagioso = doencasContagiosas.some(doenca => val.includes(doenca));
                if(ehContagioso) {
                    alert("⚠️ ATENÇÃO: DOENÇA INFECTOCONTAGIOSA SELECIONADA!\n\nProtocolo Sugerido:\n- Urna Lacrada\n- Restrição de Velório\n- Uso obrigatório de EPIs");
                }
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
            document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>';
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

// --- NOVA FUNÇÃO DE BUSCA GLOBAL ---
window.realizarBusca = function() {
    const input = document.getElementById('input-busca');
    const termo = input.value.trim().toUpperCase();

    if (!termo) {
        alert("Digite um nome para buscar.");
        return;
    }

    if (unsubscribe) unsubscribe();

    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Buscando em todo o histórico...</td></tr>';

    db.collection("atendimentos")
        .orderBy("nome")
        .startAt(termo)
        .endAt(termo + "\uf8ff")
        .limit(50)
        .get()
        .then((querySnapshot) => {
            let lista = [];
            querySnapshot.forEach((doc) => {
                let d = doc.data();
                d.id = doc.id;
                lista.push(d);
            });

            if (lista.length === 0) {
                tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; padding: 20px;">Nenhum registro encontrado para "${termo}".</td></tr>`;
            } else {
                renderizarTabela(lista);
            }
        })
        .catch((error) => {
            console.error("Erro na busca:", error);
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Erro ao buscar dados.</td></tr>';
        });
}

function atualizarListener(dataSelecionada, localSelecionado) {
    if (unsubscribe) unsubscribe();
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Carregando dados...</td></tr>';

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
          tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Erro ao carregar dados.</td></tr>';
      });
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = ''; 

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="padding: 40px; text-align:center; color:#b5b5c3;">Nenhum atendimento registrado neste local e data.</td></tr>';
        return;
    }

    lista.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => window.visualizar(item.id);
        
        // Verifica se é contagioso para aplicar estilo na linha (Lista Expandida)
        const doencasContagiosas = ['COVID', 'MENINGITE', 'TUBERCULOSE', 'H1N1', 'HEPATITE', 'HIV', 'SIDA', 'INFLUENZA', 'SARAMPO', 'FEBRE AMARELA', 'LEPTOSPIROSE', 'SEPCEMIA'];
        let isContagioso = false;
        if(item.causa) {
            const causaUpper = item.causa.toUpperCase();
            isContagioso = doencasContagiosas.some(doenca => causaUpper.includes(doenca));
        }

        if (isContagioso) {
            tr.classList.add('alerta-doenca');
        }

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
            if (item.funeraria) {
                displayResponsavel += `${item.funeraria.toUpperCase()}<br>`;
            } else if (item.resp_nome) {
                displayResponsavel += `${item.resp_nome.toUpperCase()}<br>`;
            }
        }

        if (item.tipo_urna_detalhe) {
            displayResponsavel += `<span style="font-weight:bold;">${item.tipo_urna_detalhe.toUpperCase()}</span><br>`;
        }

        if (item.combo_urna && dimensoesUrna[item.combo_urna]) {
            displayResponsavel += `URNA ${item.combo_urna}<br>${dimensoesUrna[item.combo_urna]}<br>`;
        } else if (item.combo_urna) {
            displayResponsavel += `URNA ${item.combo_urna}<br>`;
        }

        let servicosExtras = [];
        if (item.tanato === 'SIM') servicosExtras.push('TANATOPRAXIA');
        if (item.invol === 'SIM') servicosExtras.push('INVOL');
        if (item.translado === 'SIM') servicosExtras.push('TRANSLADO');
        if (item.urna_opc === 'SIM') servicosExtras.push('URNA');

        if (servicosExtras.length > 0) {
            displayResponsavel += `<div style="margin-top:2px; font-weight:bold; font-size:10px;">SERVIÇOS: ${servicosExtras.join(', ')}</div>`;
        }

        if (item.urna_info) {
            displayResponsavel += `<span style="font-weight:normal; font-size:11px;">${item.urna_info.toUpperCase()}</span>`;
        }

        // Ícone de alerta se for contagioso
        const iconAlert = isContagioso ? '<span class="icone-alerta" title="Doença Contagiosa">⚠️</span>' : '';

        const conteudoNome = `<div style="font-weight:700; font-size:12px;">${iconAlert}${item.nome.toUpperCase()}</div>
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
        } else if (item.falecimento) {
            displayFalecimento = `<div>${item.falecimento}</div>`;
        }

        // Botão do Google Maps (se houver coordenadas)
        let btnMap = '';
        if (item.geo_coords && item.geo_coords.includes(',')) {
             btnMap = `<button class="btn-icon btn-mapa-circle" onclick="event.stopPropagation(); window.open('https://www.google.com/maps/search/?api=1&query=${item.geo_coords}', '_blank')" title="Ver Localização">📍</button>`;
        }

        tr.innerHTML = `
            <td>${displayResponsavel}</td>
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
                    ${btnMap}
                    <button class="btn-icon btn-editar-circle" onclick="event.stopPropagation(); window.editar('${item.id}')">✏️</button>
                    <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation(); window.excluir('${item.id}')">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODAIS GLOBAIS ---
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

    sepulturaOriginal = ""; 

    document.getElementById('modal').style.display = 'block';
}

window.fecharModal = function() { document.getElementById('modal').style.display = 'none'; }
window.fecharModalVisualizar = function() { document.getElementById('modal-visualizar').style.display = 'none'; }

window.visualizar = function(id) {
    if(!document.getElementById('modal-visualizar')) { alert("Erro de carregamento. Recarregue a página."); return; }
    
    document.body.style.cursor = 'wait';

    db.collection("atendimentos").doc(id).get().then((doc) => {
        document.body.style.cursor = 'default';
        if (doc.exists) {
            const item = doc.data();
            dadosAtendimentoAtual = item;

            const setText = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text || '-'; };

            setText('view_hora', item.hora);
            let respTexto = item.resp_nome || '-';
            if (item.parentesco) respTexto += ` (${item.parentesco})`;
            setText('view_resp_completo', respTexto);
            setText('view_funeraria', item.funeraria);
            setText('view_telefone', item.telefone); // ADICIONADO AQUI
            
            let textoIsencao = "NÃO (Pago)";
            if (item.isencao === "SIM") textoIsencao = "SIM (100% Isenção)";
            if (item.isencao === "50") textoIsencao = "SIM (50% Isenção)";
            if (item.requisito) textoIsencao += ` - ${item.requisito}`;
            setText('view_isencao_completa', textoIsencao);

            let infoUrna = item.urna_info || '-';
            if(item.motivo_troca_sepultura) infoUrna += `\n[TROCA SEPULTURA: ${item.motivo_troca_sepultura}]`;
            setText('view_urna_info', infoUrna);

            setText('view_combo_urna', item.combo_urna);
            setText('view_tipo_urna_detalhe', item.tipo_urna_detalhe);
            
            let servicosView = [];
            if (item.tanato === 'SIM') servicosView.push('Tanatopraxia');
            if (item.invol === 'SIM') servicosView.push('Invol');
            if (item.translado === 'SIM') servicosView.push('Translado');
            if (item.urna_opc === 'SIM') servicosView.push('Urna');
            setText('view_servicos_adicionais', servicosView.length > 0 ? servicosView.join(', ') : '-');

            let nomeView = item.nome || '-';
            if (item.classificacao_obito === "ANJO") nomeView += " (ANJO)";
            setText('view_nome', nomeView);
            setText('view_causa', item.causa);
            
            const elDo24h = document.getElementById('view_do_24h');
            if(elDo24h) {
                if (item.do_24h === 'SIM') elDo24h.innerText = "[LIBERAÇÃO < 24H]";
                else elDo24h.innerText = "";
            }

            let tipo = '';
            if (item.gav && item.gav.includes('X')) tipo = 'GAVETA';
            else if (item.car && item.car.includes('X')) tipo = 'CARNEIRO';
            else if (item.cova_rasa === 'X') tipo = 'COVA RASA';
            else if (item.perpetua === 'X') tipo = 'PERPÉTUA';
            setText('view_tipo_sepultura', tipo);
            
            setText('view_sepul', item.sepul);
            setText('view_qd', item.qd);
            
            let hospitalView = item.hospital || '-';
            if ((item.hospital && item.hospital.includes('DOMICÍLIO')) || (item.hospital && item.hospital.includes('DOMICILIO'))) {
                hospitalView += ` (${item.cidade_obito || ''} - ${item.estado_obito || ''})`;
            }
            setText('view_hospital_completo', hospitalView);
            setText('view_cap', item.cap);
            
            let dataFormatada = item.data_obito;
            if (dataFormatada && dataFormatada.includes('-')) {
                const p = dataFormatada.split('-');
                dataFormatada = `${p[2]}/${p[1]}/${p[0]}`;
            }
            setText('view_data_obito', dataFormatada);
            setText('view_hora_obito', item.hora_obito);

            // MAPA NO MODAL
            const mapContainer = document.getElementById('view_map_container');
            const mapFrame = document.getElementById('mapa-frame');
            const mapLink = document.getElementById('link-gps');
            if (item.geo_coords && item.geo_coords.includes(',')) {
                mapContainer.style.display = 'block';
                mapFrame.innerHTML = `<iframe width="100%" height="100%" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=${item.geo_coords}&z=17&output=embed"></iframe>`;
                mapLink.href = `https://www.google.com/maps/search/?api=1&query=${item.geo_coords}`;
            } else {
                mapContainer.style.display = 'none';
                mapFrame.innerHTML = '';
            }

            document.getElementById('modal-visualizar').style.display = 'block';
        } else {
            alert("Atendimento não encontrado.");
        }
    }).catch((error) => {
        document.body.style.cursor = 'default';
        console.error("Erro:", error);
        alert("Erro ao abrir agendamento: " + error.message);
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
                opt.value = horaSalva;
                opt.text = horaSalva;
                selectHora.add(opt);
            }
            selectHora.value = horaSalva || "";

            const setVal = (k, v) => { const el=document.getElementById(k); if(el) el.value=v||''; };

            setVal('nome', item.nome);
            setVal('causa', item.causa);
            setVal('resp_nome', item.resp_nome);
            setVal('telefone', item.telefone); // ADICIONADO AQUI
            setVal('parentesco', item.parentesco);
            setVal('classificacao_obito', item.classificacao_obito || 'ADULTO');
            setVal('do_24h', item.do_24h || 'NAO'); 

            setVal('urna_info', item.urna_info);
            setVal('combo_urna', item.combo_urna);
            setVal('tipo_urna_detalhe', item.tipo_urna_detalhe);
            setVal('funeraria', item.funeraria);
            setVal('isencao', item.isencao || 'NAO');
            setVal('requisito', item.requisito);
            setVal('data_obito', item.data_obito);
            setVal('hora_obito', item.hora_obito);
            setVal('geo_coords', item.geo_coords);
            
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
            setVal('sepul', item.sepul);
            setVal('motivo_troca_sepultura', item.motivo_troca_sepultura);
            
            setVal('qd', item.qd);
            setVal('hospital', item.hospital);
            setVal('estado_obito', item.estado_obito);
            
            if (item.estado_obito) {
                carregarCidades(item.estado_obito, item.cidade_obito);
            } else {
                document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>';
                document.getElementById('cidade_obito').disabled = true;
            }
            
            document.getElementById('hospital').dispatchEvent(new Event('input'));
            document.getElementById('sepul').dispatchEvent(new Event('input'));

            setVal('cap', item.cap);
            
            document.getElementById('modal').style.display = 'block';
        }
    });
}

const form = document.getElementById('form-atendimento');
form.onsubmit = (e) => {
    e.preventDefault();
    
    const id = document.getElementById('docId').value;
    const getVal = (k) => document.getElementById(k).value;

    const dados = {
        data_ficha: getVal('filtro-data'),
        local: getVal('filtro-local'),
        hora: getVal('hora'),
        resp_nome: getVal('resp_nome'),
        telefone: getVal('telefone'), // ADICIONADO AQUI
        parentesco: getVal('parentesco'),
        classificacao_obito: getVal('classificacao_obito'),
        do_24h: getVal('do_24h'),
        
        urna_info: getVal('urna_info'),
        combo_urna: getVal('combo_urna'), 
        tipo_urna_detalhe: getVal('tipo_urna_detalhe'),
        funeraria: getVal('funeraria'),
        isencao: getVal('isencao'),
        requisito: getVal('requisito'), 
        
        tanato: document.getElementById('chk_tanato').checked ? 'SIM' : 'NAO',
        invol: document.getElementById('chk_invol').checked ? 'SIM' : 'NAO',
        translado: document.getElementById('chk_translado').checked ? 'SIM' : 'NAO',
        urna_opc: document.getElementById('chk_urna_opc').checked ? 'SIM' : 'NAO',

        nome: getVal('nome'),
        causa: getVal('causa'),
        gav: getVal('tipo_sepultura') === 'GAVETA' ? 'X' : '',
        car: getVal('tipo_sepultura') === 'CARNEIRO' ? 'X' : '',
        cova_rasa: getVal('tipo_sepultura') === 'COVA RASA' ? 'X' : '',
        perpetua: getVal('tipo_sepultura') === 'PERPETUA' ? 'X' : '',
        
        sepul: getVal('sepul'),
        motivo_troca_sepultura: getVal('motivo_troca_sepultura'), 
        
        qd: getVal('qd'),
        hospital: getVal('hospital'),
        cidade_obito: getVal('cidade_obito'), 
        estado_obito: getVal('estado_obito'), 
        
        cap: getVal('cap'),
        data_obito: getVal('data_obito'),
        hora_obito: getVal('hora_obito'),
        geo_coords: getVal('geo_coords')
    };

    if (id) {
        db.collection("atendimentos").doc(id).update(dados)
          .then(() => window.fecharModal())
          .catch((error) => alert("Erro ao atualizar: " + error));
    } else {
        db.collection("atendimentos").add(dados)
          .then(() => window.fecharModal())
          .catch((error) => alert("Erro ao salvar: " + error));
    }
};

window.excluir = function(id) {
    if(confirm('Tem certeza?')) {
        db.collection("atendimentos").doc(id).delete()
          .catch((error) => alert("Erro ao excluir: " + error));
    }
}

window.onclick = function(event) {
    if (event.target == document.getElementById('modal')) window.fecharModal();
    if (event.target == document.getElementById('modal-visualizar')) window.fecharModalVisualizar();
    if (event.target == document.getElementById('modal-estatisticas')) window.fecharModalEstatisticas();
}