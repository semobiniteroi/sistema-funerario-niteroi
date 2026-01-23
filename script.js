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

// --- FUNÇÃO GERAR ETIQUETA (IDENTIFICAÇÃO PORTA) ---
window.gerarEtiqueta = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;

    const fmtData = (dataStr) => {
        if (!dataStr) return "";
        const p = dataStr.split('-');
        return `${p[2]}/${p[1]}/${p[0]}`;
    };

    const htmlEtiqueta = `
    <html>
    <head>
        <title>Etiqueta Capela</title>
        <style>
            body { font-family: 'Arial', sans-serif; text-align: center; margin: 0; padding: 20px; }
            .container { border: 5px solid #000; padding: 20px; height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; }
            .header { font-size: 20px; text-transform: uppercase; margin-bottom: 30px; font-weight: bold; }
            .label { font-size: 24px; color: #555; margin-bottom: 5px; text-transform: uppercase; }
            .value-name { font-size: 60px; font-weight: 900; text-transform: uppercase; line-height: 1.1; margin-bottom: 40px; }
            .value-time { font-size: 50px; font-weight: 800; margin-bottom: 40px; }
            .value-location { font-size: 35px; font-weight: bold; text-transform: uppercase; }
            @media print {
                @page { size: landscape; margin: 0; }
                .container { border: none; height: 100vh; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">Prefeitura Municipal de Niterói<br>Identificação de Velório</div>
            <div class="label">Falecido(a)</div>
            <div class="value-name">${d.nome}</div>
            <div class="label">Horário de Sepultamento</div>
            <div class="value-time">${fmtData(d.data_ficha)} às ${d.hora}</div>
            <div class="label">Local</div>
            <div class="value-location">
                ${d.cap} <br>
                ${d.local || "CEMITÉRIO DO MARUÍ"}
            </div>
        </div>
        <script>
            window.onload = function() { window.print(); }
        </script>
    </body>
    </html>
    `;

    const win = window.open('', '_blank');
    win.document.write(htmlEtiqueta);
    win.document.close();
}

// --- FUNÇÕES DE ESTATÍSTICAS E EXPORTAÇÃO ---
window.abrirModalEstatisticas = function() {
    document.getElementById('modal-estatisticas').style.display = 'block';
    carregarEstatisticas(7);
}

window.fecharModalEstatisticas = function() {
    document.getElementById('modal-estatisticas').style.display = 'none';
    if (statsUnsubscribe) statsUnsubscribe();
}

window.carregarEstatisticas = function(dias) {
    const loading = document.getElementById('loading-stats');
    const divLista = document.getElementById('lista-estatisticas');
    
    divLista.innerHTML = '';
    loading.style.display = 'block';
    if (statsUnsubscribe) statsUnsubscribe();

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    const dataInicioString = dataInicio.toISOString().split('T')[0];

    statsUnsubscribe = db.collection("atendimentos")
        .where("data_ficha", ">=", dataInicioString)
        .onSnapshot((snapshot) => {
            loading.style.display = 'none';
            let contagemCausas = {};
            let totalMortes = 0;

            snapshot.forEach(doc => {
                const dados = doc.data();
                if (dados.causa) {
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

            const ranking = Object.entries(contagemCausas).sort((a, b) => b[1] - a[1]);
            
            dadosEstatisticasExportacao = ranking.map(([causa, qtd]) => ({
                "Causa da Morte": causa,
                "Quantidade": qtd,
                "Porcentagem": ((qtd / totalMortes) * 100).toFixed(2) + '%'
            }));

            const labels = ranking.map(r => r[0]);
            const dataValues = ranking.map(r => r[1]);
            renderizarGrafico(labels, dataValues);

            if (ranking.length === 0) {
                divLista.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum dado neste período.</p>';
                return;
            }

            let htmlTable = `
                <div style="margin-bottom:10px; font-weight:bold; color:#555;">Total: ${totalMortes} registros</div>
                <table class="table-stats">
                    <thead><tr><th>Causa da Morte</th><th width="80">Qtd</th></tr></thead>
                    <tbody>
            `;
            ranking.forEach(([causa, qtd]) => {
                htmlTable += `<tr><td>${causa}</td><td style="text-align:center;">${qtd}</td></tr>`;
            });
            htmlTable += `</tbody></table>`;
            divLista.innerHTML = htmlTable;

        }, (error) => {
            console.error("Erro stats:", error);
            loading.innerText = "Erro ao carregar.";
        });
}

function renderizarGrafico(labels, dataValues) {
    const ctx = document.getElementById('grafico-causas').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.slice(0, 10),
            datasets: [{
                label: 'Ocorrências',
                data: dataValues.slice(0, 10),
                backgroundColor: '#3699ff',
                borderColor: '#187de4',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { ticks: { font: { size: 10 } } }
            },
            plugins: { legend: { display: false }, title: { display: true, text: 'Top 10 Causas de Morte' } }
        }
    });
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

window.gerarComprovante = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const chk = (cond) => cond ? '( X )' : '(  )';
    const fmtData = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
    const dataHoje = new Date();
    const dataAtualFmt = `${dataHoje.getDate().toString().padStart(2,'0')}/${(dataHoje.getMonth()+1).toString().padStart(2,'0')}/${dataHoje.getFullYear()}`;
    const horaAtualFmt = `${dataHoje.getHours().toString().padStart(2,'0')}:${dataHoje.getMinutes().toString().padStart(2,'0')}`;

    const htmlComprovante = `
    <html><head><title>Comprovante</title><style>body { font-family: "Courier New", Courier, monospace; font-size: 12px; margin: 20px; } .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; } .titulo { font-weight: bold; font-size: 16px; margin: 10px 0; text-align: center; } .linha { margin: 5px 0; display: block; line-height: 1.5; } .campo { font-weight: bold; } .box { border: 1px solid #000; padding: 10px; margin: 10px 0; } .assinaturas { margin-top: 50px; display: flex; justify-content: space-between; } .assinatura-box { text-align: center; border-top: 1px solid #000; width: 45%; padding-top: 5px; } .obs-box { border: 1px solid #000; padding: 5px; font-size: 11px; margin-top: 10px; } @media print { @page { size: portrait; margin: 10mm; } }</style></head><body><div class="header"><h2>PREFEITURA MUNICIPAL DE NITERÓI</h2><p>ACOLHIMENTO - SERVIÇOS FUNERÁRIOS</p></div><div class="titulo">COMPROVANTE DE ATENDIMENTO</div><div class="box"><span class="linha"><span class="campo">FALECIDO:</span> ${d.nome.toUpperCase()}</span><span class="linha"><span class="campo">FUNERÁRIA:</span> ${d.funeraria.toUpperCase()}</span><span class="linha"><span class="campo">DATA ATENDIMENTO:</span> ${dataAtualFmt} <span class="campo">HORA:</span> ${horaAtualFmt}</span></div><div class="box"><span class="linha"><span class="campo">SEPULTAMENTO:</span> ${fmtData(d.data_ficha)} <span class="campo">HORA:</span> ${d.hora}</span><span class="linha"><span class="campo">CEMITÉRIO:</span> ${chk(d.local.includes('MARUÍ'))} MARUÍ ${chk(d.local.includes('SÃO FRANCISCO'))} SÃO FRANCISCO ${chk(d.local.includes('ITAIPU'))} ITAIPU</span><span class="linha"><span class="campo">SEPULTURA:</span> ${d.sepul} <span class="campo">QUADRA:</span> ${d.qd} <span class="campo">CAPELA:</span> ${d.cap}</span><span class="linha"><span class="campo">DATA FALECIMENTO:</span> ${fmtData(d.data_obito)} <span class="campo">HORA:</span> ${d.hora_obito}</span></div><div class="box"><div class="linha"><span class="campo">ESTADO CIVIL:</span> ( ) SOLTEIRO ( ) CASADO ( ) VÍUVO ( ) UNIÃO ESTÁVEL ( ) DIVORCIADO</div><div class="linha" style="margin-top: 10px; font-weight:bold;">TIPO DE SEPULTURA:</div><div class="linha">${chk(d.tipo_sepultura === 'GAVETA' && d.classificacao_obito === 'ADULTO')} Gaveta Adulto ${chk(d.tipo_sepultura === 'CARNEIRO' && d.classificacao_obito === 'ADULTO')} Carneira Adulto ${chk(d.tipo_sepultura === 'COVA RASA' && d.classificacao_obito === 'ADULTO')} Cova Rasa Adulto</div><div class="linha">${chk(d.tipo_sepultura === 'GAVETA' && d.classificacao_obito === 'ANJO')} Gaveta Anjo ${chk(d.tipo_sepultura === 'CARNEIRO' && d.classificacao_obito === 'ANJO')} Carneira Anjo ${chk(d.tipo_sepultura === 'PERPETUA')} Perpétuo</div><div class="linha" style="margin-top: 10px;"><span class="campo">TANATOPRAXIA:</span> ${chk(d.tanato === 'SIM')} SIM ${chk(d.tanato !== 'SIM')} NÃO</div></div><div class="obs-box"><strong>OBSERVAÇÕES:</strong><br>1. PASSANDO DAS 36 HORAS DO FALECIMENTO SOMENTE COM TANATOPRAXIA.<br>2. VELÓRIO COM DURAÇÃO DE DUAS HORAS ANTES DO SEPULTAMENTO.<br>3. EM CASO DE ATRASO DO SERVIÇO FUNERÁRIO NÃO SERÁ ESTENDIDO O HORÁRIO ESTABELECIDO.<br>4. TAXAS MUNICIPAIS E INVOL DEVEM SER PAGOS COM DUAS HORAS DE ANTECEDÊNCIA.</div><div class="assinaturas"><div class="assinatura-box">Assinatura Funcionário (Acolhimento)</div><div class="assinatura-box">Assinatura Responsável / Família<br><span style="font-size:10px;">${d.resp_nome.toUpperCase()}</span></div></div><script>window.onload = function() { window.print(); }</script></body></html>`;
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
    if(!uf) { selectCidade.innerHTML = '<option value="">Selecione a UF primeiro</option>'; selectCidade.disabled = true; return; }
    selectCidade.innerHTML = '<option value="">Carregando...</option>'; selectCidade.disabled = true;
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`).then(r => r.json()).then(c => {
        selectCidade.innerHTML = '<option value="">Selecione...</option>'; c.sort((a,b)=>a.nome.localeCompare(b.nome));
        c.forEach(cid => { const opt = document.createElement('option'); opt.value = cid.nome.toUpperCase(); opt.text = cid.nome.toUpperCase(); if (cid.nome.toUpperCase() === cidadeSelecionada) opt.selected = true; selectCidade.appendChild(opt); }); selectCidade.disabled = false;
    }).catch(e => { console.error(e); selectCidade.innerHTML = '<option value="">Erro</option>'; });
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('designMode') === 'classico') document.body.classList.add('design-classico');
    const selectHora = document.getElementById('hora'); selectHora.innerHTML = '<option value="">--:--</option>';
    for (let h = 0; h < 24; h++) { for (let m = 0; m < 60; m += 30) { const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; const opt = document.createElement('option'); opt.value = val; opt.text = val; selectHora.appendChild(opt); } }
    const hoje = new Date().toISOString().split('T')[0];
    const inputData = document.getElementById('filtro-data'); const inputLocal = document.getElementById('filtro-local');
    inputData.value = hoje; atualizarListener(hoje, inputLocal.value);
    inputData.addEventListener('change', (e) => atualizarListener(e.target.value, inputLocal.value));
    inputLocal.addEventListener('change', (e) => atualizarListener(inputData.value, e.target.value));
    
    const seletorCausas = document.getElementById('seletor_causas');
    if (seletorCausas) seletorCausas.addEventListener('change', function() { const inputCausa = document.getElementById("causa"); if (this.value) { inputCausa.value = inputCausa.value ? inputCausa.value + " / " + this.value : this.value; this.value = ""; } });
    
    const inputHospital = document.getElementById('hospital'); const divDomicilio = document.getElementById('div-local-domicilio');
    inputHospital.addEventListener('input', function() { const val = this.value.toUpperCase(); if (val.includes('DOMICÍLIO') || val.includes('DOMICILIO')) { divDomicilio.classList.remove('hidden'); } else { divDomicilio.classList.add('hidden'); document.getElementById('estado_obito').value = ""; document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF</option>'; document.getElementById('cidade_obito').disabled = true; } });
    document.getElementById('estado_obito').addEventListener('change', function() { carregarCidades(this.value); });
    
    const inputSepul = document.getElementById('sepul'); const divMotivo = document.getElementById('div-motivo-sepultura');
    inputSepul.addEventListener('input', function() { if (sepulturaOriginal && this.value !== sepulturaOriginal) { divMotivo.classList.remove('hidden'); } else { divMotivo.classList.add('hidden'); document.getElementById('motivo_troca_sepultura').value = ""; } });
});

function atualizarListener(data, local) {
    if (unsubscribe) unsubscribe();
    const tbody = document.getElementById('tabela-corpo'); tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Carregando...</td></tr>';
    unsubscribe = db.collection("atendimentos").where("data_ficha", "==", data).onSnapshot((s) => {
        let l = []; s.forEach(d => { let i = d.data(); i.id = d.id; if ((i.local || "CEMITÉRIO DO MARUÍ") === local) l.push(i); });
        l.sort((a,b) => (a.hora < b.hora ? -1 : 1)); renderizarTabela(l);
    }, (e) => tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Erro.</td></tr>');
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo'); tbody.innerHTML = '';
    if (lista.length === 0) { tbody.innerHTML = '<tr><td colspan="11" style="padding: 40px; text-align:center;">Nenhum atendimento.</td></tr>'; return; }
    lista.forEach(item => {
        const tr = document.createElement('tr'); tr.onclick = () => window.visualizar(item.id);
        let resp = "";
        if (item.isencao === "50") resp += `ACOLHIMENTO <span style="font-weight:900;">50% DE ISENÇÃO</span><br>REQ: ${item.requisito}<br>`;
        else if (item.isencao === "SIM") resp += `ACOLHIMENTO <span style="font-weight:900;">100% DE ISENÇÃO</span><br>REQ: ${item.requisito}<br>`;
        else resp += item.funeraria ? `${item.funeraria.toUpperCase()}<br>` : `${item.resp_nome.toUpperCase()}<br>`;
        if (item.tipo_urna_detalhe) resp += `<span style="font-weight:bold;">${item.tipo_urna_detalhe.toUpperCase()}</span><br>`;
        resp += item.combo_urna ? `URNA ${item.combo_urna}<br>` : "";
        let extras = []; if (item.tanato === 'SIM') extras.push('TANATOPRAXIA'); if (item.invol === 'SIM') extras.push('INVOL'); if (item.translado === 'SIM') extras.push('TRANSLADO'); if (item.urna_opc === 'SIM') extras.push('URNA');
        if (extras.length > 0) resp += `<div style="font-size:10px; font-weight:bold;">SERVIÇOS: ${extras.join(', ')}</div>`;
        if (item.urna_info) resp += `<span style="font-size:11px;">${item.urna_info.toUpperCase()}</span>`;
        const nome = `<div style="font-weight:700;">${item.nome.toUpperCase()}</div><div class="texto-vermelho" style="font-size:11px;">(${item.causa ? item.causa.toUpperCase() : 'N/D'})</div>${item.classificacao_obito === 'ANJO' ? '<span style="font-size:10px; color:blue;">(ANJO)</span>' : ''}`;
        let falec = '';
        if (item.data_obito && item.data_ficha) {
            const ini = new Date(`${item.data_obito}T${item.hora_obito}`); const fim = new Date(`${item.data_ficha}T${item.hora}`);
            let tempo = ""; if (!isNaN(ini) && !isNaN(fim)) { const diff = fim - ini; const h = Math.floor(diff/3600000); const m = Math.round((diff%3600000)/60000); tempo = `<br><span style="font-weight:bold; font-size:10px;">INTERVALO: ${h}H ${m}M</span>`; }
            const p = item.data_obito.split('-'); falec = `<div style="line-height:1.3;"><span class="texto-vermelho">DIA:</span> ${p[2]}/${p[1]}<br><span class="texto-vermelho">AS:</span> ${item.hora_obito}${tempo}</div>`;
        } else if (item.falecimento) falec = `<div>${item.falecimento}</div>`;
        tr.innerHTML = `<td>${resp}</td><td style="text-align:center;">${item.hora}</td><td>${nome}</td><td style="text-align:center;">${item.gav||''}</td><td style="text-align:center;">${item.car||''}</td><td style="text-align:center;">${item.sepul||''}</td><td style="text-align:center;">${item.qd||''}</td><td style="text-align:center;">${item.hospital||''}</td><td style="text-align:center;">${item.cap||''}</td><td style="text-align:center;">${falec}</td><td style="text-align:right;"><div class="t-acoes"><button class="btn-icon btn-editar-circle" onclick="event.stopPropagation(); window.editar('${item.id}')">✏️</button><button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation(); window.excluir('${item.id}')">🗑️</button></div></td>`;
        tbody.appendChild(tr);
    });
}

// --- MODAIS GLOBAIS ---
// Definindo no escopo global para garantir acesso pelo HTML
window.abrirModal = function() {
    const f = document.getElementById('form-atendimento'); f.reset();
    document.getElementById('docId').value = '';
    document.getElementById('do_24h').value = "NAO"; 
    document.getElementById('hora').value = ""; 
    document.getElementById('div-local-domicilio').classList.add('hidden');
    document.getElementById('div-motivo-sepultura').classList.add('hidden');
    document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF</option>';
    document.getElementById('cidade_obito').disabled = true;
    sepulturaOriginal = ""; 
    document.getElementById('modal').style.display = 'block';
}

window.fecharModal = function() { document.getElementById('modal').style.display = 'none'; }
window.fecharModalVisualizar = function() { document.getElementById('modal-visualizar').style.display = 'none'; }

window.visualizar = function(id) {
    db.collection("atendimentos").doc(id).get().then((doc) => {
        if (doc.exists) {
            const item = doc.data(); dadosAtendimentoAtual = item;
            document.getElementById('view_hora').innerText = item.hora || '-';
            document.getElementById('view_resp_completo').innerText = (item.resp_nome || '-') + (item.parentesco ? ` (${item.parentesco})` : '');
            document.getElementById('view_funeraria').innerText = item.funeraria || '-';
            let txtIsencao = "NÃO (Pago)"; if (item.isencao === "SIM") txtIsencao = "SIM (100%)"; if (item.isencao === "50") txtIsencao = "SIM (50%)";
            document.getElementById('view_isencao_completa').innerText = txtIsencao + (item.requisito ? ` - ${item.requisito}` : '');
            document.getElementById('view_urna_info').innerText = (item.urna_info || '-') + (item.motivo_troca_sepultura ? `\n[TROCA SEPULTURA: ${item.motivo_troca_sepultura}]` : '');
            document.getElementById('view_combo_urna').innerText = item.combo_urna || '-';
            document.getElementById('view_tipo_urna_detalhe').innerText = item.tipo_urna_detalhe || '-';
            
            let servs = []; if (item.tanato === 'SIM') servs.push('Tanatopraxia'); if (item.invol === 'SIM') servs.push('Invol'); if (item.translado === 'SIM') servs.push('Translado'); if (item.urna_opc === 'SIM') servs.push('Urna');
            document.getElementById('view_servicos_adicionais').innerText = servs.length ? servs.join(', ') : '-';
            
            document.getElementById('view_nome').innerText = (item.nome || '-') + (item.classificacao_obito === "ANJO" ? " (ANJO)" : "");
            document.getElementById('view_causa').innerText = item.causa || '-';
            document.getElementById('view_do_24h').innerText = item.do_24h === 'SIM' ? "[LIBERAÇÃO < 24H]" : "";
            
            let tpSep = ""; if (item.gav && item.gav.includes('X')) tpSep = 'GAVETA'; else if (item.car && item.car.includes('X')) tpSep = 'CARNEIRO'; else if (item.cova_rasa === 'X') tpSep = 'COVA RASA'; else if (item.perpetua === 'X') tpSep = 'PERPÉTUA';
            document.getElementById('view_tipo_sepultura').innerText = tpSep || '-';
            document.getElementById('view_sepul').innerText = item.sepul || '-';
            document.getElementById('view_qd').innerText = item.qd || '-';
            
            let hosp = item.hospital || '-'; if (hosp.includes('DOMICÍLIO') || hosp.includes('DOMICILIO')) hosp += ` (${item.cidade_obito || ''}-${item.estado_obito || ''})`;
            document.getElementById('view_hospital_completo').innerText = hosp;
            document.getElementById('view_cap').innerText = item.cap || '-';
            
            let dtOb = item.data_obito; if(dtOb) dtOb = dtOb.split('-').reverse().join('/');
            document.getElementById('view_data_obito').innerText = dtOb || '-';
            document.getElementById('view_hora_obito').innerText = item.hora_obito || '-';
            
            document.getElementById('modal-visualizar').style.display = 'block';
        }
    });
}

window.editar = function(id) {
    db.collection("atendimentos").doc(id).get().then((doc) => {
        if (doc.exists) {
            const i = doc.data(); document.getElementById('docId').value = doc.id;
            const sh = document.getElementById('hora'); let hx=false; for(let o of sh.options) if(o.value==i.hora) hx=true;
            if(!hx && i.hora) { const o=document.createElement('option'); o.value=i.hora; o.text=i.hora; sh.add(o); } sh.value=i.hora||"";
            
            const sVal = (k, v) => { const el=document.getElementById(k); if(el) el.value=v||''; };
            sVal('nome', i.nome); sVal('causa', i.causa); sVal('resp_nome', i.resp_nome); sVal('parentesco', i.parentesco);
            sVal('classificacao_obito', i.classificacao_obito||'ADULTO'); sVal('do_24h', i.do_24h||'NAO');
            sVal('urna_info', i.urna_info); sVal('combo_urna', i.combo_urna); sVal('tipo_urna_detalhe', i.tipo_urna_detalhe);
            sVal('funeraria', i.funeraria); sVal('isencao', i.isencao||'NAO'); sVal('requisito', i.requisito);
            sVal('data_obito', i.data_obito); sVal('hora_obito', i.hora_obito);
            
            document.getElementById('chk_tanato').checked = (i.tanato==='SIM'); document.getElementById('chk_invol').checked = (i.invol==='SIM');
            document.getElementById('chk_translado').checked = (i.translado==='SIM'); document.getElementById('chk_urna_opc').checked = (i.urna_opc==='SIM');
            
            const ts = document.getElementById('tipo_sepultura');
            if(i.gav && i.gav.includes('X')) ts.value='GAVETA'; else if(i.car && i.car.includes('X')) ts.value='CARNEIRO'; else if(i.cova_rasa==='X') ts.value='COVA RASA'; else if(i.perpetua==='X') ts.value='PERPETUA'; else ts.value='';
            
            sepulturaOriginal = i.sepul; sVal('sepul', i.sepul); sVal('motivo_troca_sepultura', i.motivo_troca_sepultura);
            sVal('qd', i.qd); sVal('hospital', i.hospital); sVal('estado_obito', i.estado_obito); sVal('cap', i.cap);
            if(i.estado_obito) carregarCidades(i.estado_obito, i.cidade_obito); else { document.getElementById('cidade_obito').innerHTML='<option value="">Selecione a UF</option>'; document.getElementById('cidade_obito').disabled=true; }
            document.getElementById('hospital').dispatchEvent(new Event('input')); document.getElementById('sepul').dispatchEvent(new Event('input'));
            
            document.getElementById('modal').style.display = 'block';
        }
    });
}

const form = document.getElementById('form-atendimento');
form.onsubmit = (e) => {
    e.preventDefault(); const id = document.getElementById('docId').value;
    const gv = (k) => document.getElementById(k).value;
    const d = {
        data_ficha: gv('filtro-data'), local: gv('filtro-local'), hora: gv('hora'), resp_nome: gv('resp_nome'),
        parentesco: gv('parentesco'), classificacao_obito: gv('classificacao_obito'), do_24h: gv('do_24h'),
        urna_info: gv('urna_info'), combo_urna: gv('combo_urna'), tipo_urna_detalhe: gv('tipo_urna_detalhe'),
        funeraria: gv('funeraria'), isencao: gv('isencao'), requisito: gv('requisito'),
        tanato: document.getElementById('chk_tanato').checked?'SIM':'NAO', invol: document.getElementById('chk_invol').checked?'SIM':'NAO',
        translado: document.getElementById('chk_translado').checked?'SIM':'NAO', urna_opc: document.getElementById('chk_urna_opc').checked?'SIM':'NAO',
        nome: gv('nome'), causa: gv('causa'),
        gav: gv('tipo_sepultura')==='GAVETA'?'X':'', car: gv('tipo_sepultura')==='CARNEIRO'?'X':'',
        cova_rasa: gv('tipo_sepultura')==='COVA RASA'?'X':'', perpetua: gv('tipo_sepultura')==='PERPETUA'?'X':'',
        sepul: gv('sepul'), motivo_troca_sepultura: gv('motivo_troca_sepultura'), qd: gv('qd'),
        hospital: gv('hospital'), cidade_obito: gv('cidade_obito'), estado_obito: gv('estado_obito'),
        cap: gv('cap'), data_obito: gv('data_obito'), hora_obito: gv('hora_obito')
    };
    if (id) db.collection("atendimentos").doc(id).update(d).then(() => window.fecharModal()).catch((e) => alert("Erro: " + e));
    else db.collection("atendimentos").add(d).then(() => window.fecharModal()).catch((e) => alert("Erro: " + e));
};

window.excluir = function(id) { if(confirm('Tem certeza?')) db.collection("atendimentos").doc(id).delete().catch(e=>alert("Erro: "+e)); }
window.onclick = function(e) { 
    if(e.target == document.getElementById('modal')) window.fecharModal();
    if(e.target == document.getElementById('modal-visualizar')) window.fecharModalVisualizar();
    if(e.target == document.getElementById('modal-estatisticas')) window.fecharModalEstatisticas();
}