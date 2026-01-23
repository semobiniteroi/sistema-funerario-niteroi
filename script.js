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

// --- FUNÇÃO VISUALIZAR (CORRIGIDA E ROBUSTA) ---
window.visualizar = function(id) {
    // Busca o modal apenas no momento do clique para garantir que existe
    const modalVis = document.getElementById('modal-visualizar');
    
    if (!modalVis) {
        alert("Erro: Janela de visualização não encontrada. Recarregue a página.");
        return;
    }

    // Feedback visual que está carregando (opcional, mas bom para UX)
    document.body.style.cursor = 'wait';

    db.collection("atendimentos").doc(id).get()
    .then((doc) => {
        document.body.style.cursor = 'default';
        
        if (doc.exists) {
            const item = doc.data();
            dadosAtendimentoAtual = item; // Salva dados para comprovante/etiqueta

            // Função segura para preencher texto (evita erro se elemento não existir)
            const setText = (id, text) => {
                const el = document.getElementById(id);
                if (el) el.innerText = text || '-';
            };

            setText('view_hora', item.hora);
            
            let respTexto = item.resp_nome || '-';
            if (item.parentesco) respTexto += ` (${item.parentesco})`;
            setText('view_resp_completo', respTexto);
            
            setText('view_funeraria', item.funeraria);
            
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

            modalVis.style.display = 'block';
        } else {
            alert("Atendimento não encontrado no sistema.");
        }
    })
    .catch((error) => {
        document.body.style.cursor = 'default';
        console.error("Erro ao abrir visualização:", error);
        alert("Erro ao abrir agendamento: " + error.message);
    });
}

// --- FUNÇÃO GERAR ETIQUETA ---
window.gerarEtiqueta = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const fmtData = (dataStr) => { if (!dataStr) return ""; const p = dataStr.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

    const htmlEtiqueta = `
    <html><head><title>Etiqueta</title><style>
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
            <div class="header">Prefeitura Municipal de Niterói<br>Identificação de Velório</div>
            <div class="label">Falecido(a)</div><div class="value-name">${d.nome}</div>
            <div class="label">Horário de Sepultamento</div><div class="value-time">${fmtData(d.data_ficha)} às ${d.hora}</div>
            <div class="label">Local</div><div class="value-location">${d.cap} <br> ${d.local || "CEMITÉRIO DO MARUÍ"}</div>
        </div>
        <script>window.onload = function() { window.print(); }</script></body></html>`;
    const win = window.open('', '_blank'); win.document.write(htmlEtiqueta); win.document.close();
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

        if (ranking.length === 0) { divLista.innerHTML = '<p style="text-align:center;">Nenhum dado.</p>'; return; }
        let htmlTable = `<div style="margin-bottom:10px; font-weight:bold;">Total: ${totalMortes}</div><table class="table-stats"><thead><tr><th>Causa</th><th>Qtd</th></tr></thead><tbody>`;
        ranking.forEach(([c, q]) => { htmlTable += `<tr><td>${c}</td><td style="text-align:center;">${q}</td></tr>`; });
        htmlTable += `</tbody></table>`;
        divLista.innerHTML = htmlTable;
    });
}

function renderizarGrafico(labels, dataValues) {
    const ctx = document.getElementById('grafico-causas').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels.slice(0, 10), datasets: [{ label: 'Ocorrências', data: dataValues.slice(0, 10), backgroundColor: '#3699ff' }] }, options: { responsive: true, maintainAspectRatio: false } });
}

window.baixarExcel = function() {
    if (dadosEstatisticasExportacao.length === 0) { alert("Sem dados."); return; }
    const worksheet = XLSX.utils.json_to_sheet(dadosEstatisticasExportacao);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Estatísticas");
    XLSX.writeFile(workbook, "Relatorio.xlsx");
}

window.baixarPDF = function() {
    if (dadosEstatisticasExportacao.length === 0) { alert("Sem dados."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatório de Causas", 14, 15);
    const tableColumn = ["Causa", "Qtd", "%"];
    const tableRows = dadosEstatisticasExportacao.map(i => [i["Causa da Morte"], i["Quantidade"], i["Porcentagem"]]);
    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    doc.save("Relatorio.pdf");
}

window.gerarComprovante = function() {
    if (!dadosAtendimentoAtual) return;
    const d = dadosAtendimentoAtual;
    const chk = (c) => c ? '( X )' : '(  )';
    const fmt = (s) => { if (!s) return ""; const p = s.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
    const h = new Date();
    const dHoje = `${h.getDate().toString().padStart(2,'0')}/${(h.getMonth()+1).toString().padStart(2,'0')}/${h.getFullYear()}`;
    const hHoje = `${h.getHours().toString().padStart(2,'0')}:${h.getMinutes().toString().padStart(2,'0')}`;

    const html = `<html><head><title>Comprovante</title><style>body{font-family:"Courier New",Courier,monospace;font-size:12px;margin:20px}.header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}.titulo{font-weight:bold;font-size:16px;text-align:center;margin:10px 0}.linha{display:block;margin:5px 0;line-height:1.5}.campo{font-weight:bold}.box{border:1px solid #000;padding:10px;margin:10px 0}.assinaturas{margin-top:50px;display:flex;justify-content:space-between}.assinatura-box{border-top:1px solid #000;width:45%;text-align:center;padding-top:5px}.obs-box{border:1px solid #000;padding:5px;font-size:11px;margin-top:10px}@media print{@page{size:portrait;margin:10mm}}</style></head><body>
    <div class="header"><h2>PREFEITURA MUNICIPAL DE NITERÓI</h2><p>ACOLHIMENTO - SERVIÇOS FUNERÁRIOS</p></div>
    <div class="titulo">COMPROVANTE DE ATENDIMENTO</div>
    <div class="box"><span class="linha"><span class="campo">FALECIDO:</span> ${d.nome.toUpperCase()}</span><span class="linha"><span class="campo">FUNERÁRIA:</span> ${d.funeraria.toUpperCase()}</span><span class="linha"><span class="campo">DATA ATENDIMENTO:</span> ${dHoje} <span class="campo">HORA:</span> ${hHoje}</span></div>
    <div class="box"><span class="linha"><span class="campo">SEPULTAMENTO:</span> ${fmt(d.data_ficha)} <span class="campo">HORA:</span> ${d.hora}</span><span class="linha"><span class="campo">CEMITÉRIO:</span> ${chk(d.local.includes('MARUÍ'))} MARUÍ ${chk(d.local.includes('SÃO FRANCISCO'))} SÃO FRANCISCO ${chk(d.local.includes('ITAIPU'))} ITAIPU</span><span class="linha"><span class="campo">SEPULTURA:</span> ${d.sepul} <span class="campo">QUADRA:</span> ${d.qd} <span class="campo">CAPELA:</span> ${d.cap}</span><span class="linha"><span class="campo">DATA FALECIMENTO:</span> ${fmt(d.data_obito)} <span class="campo">HORA:</span> ${d.hora_obito}</span></div>
    <div class="box"><div class="linha"><span class="campo">ESTADO CIVIL:</span> ( ) SOLTEIRO ( ) CASADO ( ) VÍUVO ( ) UNIÃO ESTÁVEL ( ) DIVORCIADO</div><div class="linha" style="margin-top:10px;font-weight:bold">TIPO DE SEPULTURA:</div><div class="linha">${chk(d.tipo_sepultura==='GAVETA' && d.classificacao_obito==='ADULTO')} Gaveta Adulto ${chk(d.tipo_sepultura==='CARNEIRO' && d.classificacao_obito==='ADULTO')} Carneira Adulto ${chk(d.tipo_sepultura==='COVA RASA' && d.classificacao_obito==='ADULTO')} Cova Rasa Adulto</div><div class="linha">${chk(d.tipo_sepultura==='GAVETA' && d.classificacao_obito==='ANJO')} Gaveta Anjo ${chk(d.tipo_sepultura==='CARNEIRO' && d.classificacao_obito==='ANJO')} Carneira Anjo ${chk(d.tipo_sepultura==='PERPETUA')} Perpétuo</div><div class="linha" style="margin-top:10px"><span class="campo">TANATOPRAXIA:</span> ${chk(d.tanato==='SIM')} SIM ${chk(d.tanato!=='SIM')} NÃO</div></div>
    <div class="obs-box"><strong>OBSERVAÇÕES:</strong><br>1. PASSANDO DAS 36 HORAS...<br>2. VELÓRIO COM DURAÇÃO DE DUAS HORAS...<br>3. EM CASO DE ATRASO...<br>4. TAXAS MUNICIPAIS E INVOL DEVEM SER PAGOS...</div>
    <div class="assinaturas"><div class="assinatura-box">Assinatura Funcionário</div><div class="assinatura-box">Assinatura Responsável<br><span style="font-size:10px">${d.resp_nome.toUpperCase()}</span></div></div>
    <script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
}

window.alternarDesign = function() {
    document.body.classList.toggle('design-classico');
    localStorage.setItem('designMode', document.body.classList.contains('design-classico') ? 'classico' : 'moderno');
}

window.imprimirRelatorio = function(modo) {
    const s = document.createElement('style'); s.innerHTML = `@page { size: ${modo}; margin: 5mm; }`;
    document.head.appendChild(s); setTimeout(() => window.print(), 200);
}

function carregarCidades(uf, sel = "") {
    const el = document.getElementById('cidade_obito');
    if(!uf) { el.innerHTML='<option value="">Selecione a UF</option>'; el.disabled=true; return; }
    el.innerHTML='<option value="">Carregando...</option>'; el.disabled=true;
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`).then(r=>r.json()).then(c=>{
        el.innerHTML='<option value="">Selecione...</option>'; c.sort((a,b)=>a.nome.localeCompare(b.nome));
        c.forEach(i=>{ const o=document.createElement('option'); o.value=i.nome.toUpperCase(); o.text=i.nome.toUpperCase(); if(i.nome.toUpperCase()===sel)o.selected=true; el.appendChild(o); });
        el.disabled=false;
    }).catch(e=>{console.error(e); el.innerHTML='<option value="">Erro</option>';});
}

document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('designMode')==='classico') document.body.classList.add('design-classico');
    const h=document.getElementById('hora'); h.innerHTML='<option value="">--:--</option>';
    for(let i=0;i<24;i++) for(let m=0;m<60;m+=30) { const v=`${String(i).padStart(2,'0')}:${String(m).padStart(2,'0')}`; const o=document.createElement('option'); o.value=v; o.text=v; h.appendChild(o); }
    
    const dt = document.getElementById('filtro-data'); const loc = document.getElementById('filtro-local');
    dt.value = new Date().toISOString().split('T')[0];
    atualizarListener(dt.value, loc.value);
    dt.addEventListener('change', (e)=>atualizarListener(e.target.value, loc.value));
    loc.addEventListener('change', (e)=>atualizarListener(dt.value, e.target.value));

    const sc = document.getElementById('seletor_causas');
    if(sc) sc.addEventListener('change', function(){ const c=document.getElementById("causa"); if(this.value) { c.value=c.value?c.value+" / "+this.value:this.value; this.value=""; } });

    document.getElementById('hospital').addEventListener('input', function(){ const v=this.value.toUpperCase(); const d=document.getElementById('div-local-domicilio'); if(v.includes('DOMICÍLIO')||v.includes('DOMICILIO')) d.classList.remove('hidden'); else { d.classList.add('hidden'); document.getElementById('estado_obito').value=""; document.getElementById('cidade_obito').innerHTML='<option value="">Selecione a UF</option>'; document.getElementById('cidade_obito').disabled=true; } });
    document.getElementById('estado_obito').addEventListener('change', function(){ carregarCidades(this.value); });
    
    const sep = document.getElementById('sepul'); const dm = document.getElementById('div-motivo-sepultura');
    sep.addEventListener('input', function(){ if(sepulturaOriginal && this.value!==sepulturaOriginal) dm.classList.remove('hidden'); else { dm.classList.add('hidden'); document.getElementById('motivo_troca_sepultura').value=""; } });
});

function atualizarListener(d, l) {
    if(unsubscribe) unsubscribe();
    const tb = document.getElementById('tabela-corpo'); tb.innerHTML='<tr><td colspan="11" style="text-align:center;">Carregando...</td></tr>';
    unsubscribe = db.collection("atendimentos").where("data_ficha","==",d).onSnapshot(s=>{
        let arr=[]; s.forEach(doc=>{ let i=doc.data(); i.id=doc.id; if((i.local||"CEMITÉRIO DO MARUÍ")===l) arr.push(i); });
        arr.sort((a,b)=>(a.hora<b.hora?-1:1)); renderizarTabela(arr);
    }, e=>{ console.error(e); tb.innerHTML='<tr><td colspan="11" style="text-align:center;color:red;">Erro ao carregar.</td></tr>'; });
}

function renderizarTabela(l) {
    const tb = document.getElementById('tabela-corpo'); tb.innerHTML='';
    if(l.length===0) { tb.innerHTML='<tr><td colspan="11" style="padding:40px;text-align:center;">Nenhum atendimento.</td></tr>'; return; }
    l.forEach(i => {
        const tr=document.createElement('tr'); tr.onclick=()=>visualizar(i.id);
        
        // Coluna 1
        let c1=""; if(i.isencao==="50") c1+=`ACOLHIMENTO <b>50% ISENÇÃO</b><br>REQ: ${i.requisito}<br>`; else if(i.isencao==="SIM") c1+=`ACOLHIMENTO <b>100% ISENÇÃO</b><br>REQ: ${i.requisito}<br>`; else c1+=i.funeraria?`${i.funeraria.toUpperCase()}<br>`:`${i.resp_nome.toUpperCase()}<br>`;
        if(i.tipo_urna_detalhe) c1+=`<b>${i.tipo_urna_detalhe.toUpperCase()}</b><br>`;
        if(i.combo_urna) c1+=`URNA ${i.combo_urna}<br>`;
        let ext=[]; if(i.tanato==='SIM') ext.push('TANATOPRAXIA'); if(i.invol==='SIM') ext.push('INVOL'); if(i.translado==='SIM') ext.push('TRANSLADO'); if(i.urna_opc==='SIM') ext.push('URNA');
        if(ext.length>0) c1+=`<div style="font-size:10px;font-weight:bold">SERVIÇOS: ${ext.join(', ')}</div>`;
        if(i.urna_info) c1+=`<span style="font-size:11px">${i.urna_info.toUpperCase()}</span>`;

        // Coluna 3
        const c3=`<div style="font-weight:700">${i.nome.toUpperCase()}</div><div class="texto-vermelho" style="font-size:11px">(${i.causa?i.causa.toUpperCase():'N/D'})</div>${i.classificacao_obito==='ANJO'?'<span style="font-size:10px;color:blue">(ANJO)</span>':''}`;

        // Coluna 10 (Falecimento)
        let c10=''; if(i.data_obito && i.data_ficha) {
            const ini=new Date(`${i.data_obito}T${i.hora_obito}`); const fim=new Date(`${i.data_ficha}T${i.hora}`);
            let t=""; if(!isNaN(ini)&&!isNaN(fim)){ const df=fim-ini; const h=Math.floor(df/3600000); const m=Math.round((df%3600000)/60000); t=`<br><span style="font-weight:bold;font-size:10px">INTERVALO: ${h}H ${m}M</span>`; }
            const p=i.data_obito.split('-'); c10=`<div style="line-height:1.3"><span class="texto-vermelho">DIA:</span> ${p[2]}/${p[1]}<br><span class="texto-vermelho">AS:</span> ${i.hora_obito}${t}</div>`;
        } else if(i.falecimento) c10=`<div>${i.falecimento}</div>`;

        tr.innerHTML=`<td>${c1}</td><td style="text-align:center">${i.hora}</td><td>${c3}</td><td style="text-align:center">${i.gav||''}</td><td style="text-align:center">${i.car||''}</td><td style="text-align:center">${i.sepul||''}</td><td style="text-align:center">${i.qd||''}</td><td style="text-align:center">${i.hospital||''}</td><td style="text-align:center">${i.cap||''}</td><td style="text-align:center">${c10}</td><td style="text-align:right"><div class="t-acoes"><button class="btn-icon btn-editar-circle" onclick="event.stopPropagation();editar('${i.id}')">✏️</button><button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation();excluir('${i.id}')">🗑️</button></div></td>`;
        tb.appendChild(tr);
    });
}

// Funções de Edição e Salvar mantidas iguais, mas garantindo acesso aos elementos
window.editar = function(id) {
    db.collection("atendimentos").doc(id).get().then(doc => {
        if(doc.exists) {
            const i=doc.data(); document.getElementById('docId').value=doc.id;
            // Preenche hora se não existir no select
            const sh=document.getElementById('hora'); let hx=false; for(let o of sh.options) if(o.value==i.hora) hx=true;
            if(!hx && i.hora) { const o=document.createElement('option'); o.value=i.hora; o.text=i.hora; sh.add(o); } sh.value=i.hora||"";
            
            const setVal = (k, v) => { const e=document.getElementById(k); if(e) e.value=v||''; };
            setVal('nome', i.nome); setVal('causa', i.causa); setVal('resp_nome', i.resp_nome);
            setVal('parentesco', i.parentesco); setVal('classificacao_obito', i.classificacao_obito||'ADULTO');
            setVal('do_24h', i.do_24h||'NAO'); setVal('urna_info', i.urna_info);
            setVal('combo_urna', i.combo_urna); setVal('tipo_urna_detalhe', i.tipo_urna_detalhe);
            setVal('funeraria', i.funeraria); setVal('isencao', i.isencao||'NAO'); setVal('requisito', i.requisito);
            setVal('data_obito', i.data_obito); setVal('hora_obito', i.hora_obito);
            
            document.getElementById('chk_tanato').checked = (i.tanato==='SIM');
            document.getElementById('chk_invol').checked = (i.invol==='SIM');
            document.getElementById('chk_translado').checked = (i.translado==='SIM');
            document.getElementById('chk_urna_opc').checked = (i.urna_opc==='SIM');

            const ts = document.getElementById('tipo_sepultura');
            if(i.gav && i.gav.includes('X')) ts.value='GAVETA'; else if(i.car && i.car.includes('X')) ts.value='CARNEIRO'; else if(i.cova_rasa==='X') ts.value='COVA RASA'; else if(i.perpetua==='X') ts.value='PERPETUA'; else ts.value='';

            sepulturaOriginal=i.sepul; setVal('sepul', i.sepul); setVal('motivo_troca_sepultura', i.motivo_troca_sepultura);
            setVal('qd', i.qd); setVal('hospital', i.hospital);
            setVal('estado_obito', i.estado_obito);
            if(i.estado_obito) carregarCidades(i.estado_obito, i.cidade_obito); else { document.getElementById('cidade_obito').innerHTML='<option value="">Selecione a UF</option>'; document.getElementById('cidade_obito').disabled=true; }
            
            document.getElementById('hospital').dispatchEvent(new Event('input'));
            document.getElementById('sepul').dispatchEvent(new Event('input'));
            setVal('cap', i.cap);
            
            document.getElementById('modal').style.display='block';
        }
    });
}

const form = document.getElementById('form-atendimento');
form.onsubmit = (e) => {
    e.preventDefault(); const id=document.getElementById('docId').value;
    const getVal = (k) => document.getElementById(k).value;
    const d = {
        data_ficha: getVal('filtro-data'), local: getVal('filtro-local'),
        hora: getVal('hora'), resp_nome: getVal('resp_nome'), parentesco: getVal('parentesco'),
        classificacao_obito: getVal('classificacao_obito'), do_24h: getVal('do_24h'),
        urna_info: getVal('urna_info'), combo_urna: getVal('combo_urna'), tipo_urna_detalhe: getVal('tipo_urna_detalhe'),
        funeraria: getVal('funeraria'), isencao: getVal('isencao'), requisito: getVal('requisito'),
        tanato: document.getElementById('chk_tanato').checked?'SIM':'NAO',
        invol: document.getElementById('chk_invol').checked?'SIM':'NAO',
        translado: document.getElementById('chk_translado').checked?'SIM':'NAO',
        urna_opc: document.getElementById('chk_urna_opc').checked?'SIM':'NAO',
        nome: getVal('nome'), causa: getVal('causa'),
        gav: getVal('tipo_sepultura')==='GAVETA'?'X':'', car: getVal('tipo_sepultura')==='CARNEIRO'?'X':'',
        cova_rasa: getVal('tipo_sepultura')==='COVA RASA'?'X':'', perpetua: getVal('tipo_sepultura')==='PERPETUA'?'X':'',
        sepul: getVal('sepul'), motivo_troca_sepultura: getVal('motivo_troca_sepultura'),
        qd: getVal('qd'), hospital: getVal('hospital'), cidade_obito: getVal('cidade_obito'), estado_obito: getVal('estado_obito'),
        cap: getVal('cap'), data_obito: getVal('data_obito'), hora_obito: getVal('hora_obito')
    };
    if(id) db.collection("atendimentos").doc(id).update(d).then(()=>{fecharModal()}).catch(e=>alert("Erro ao atualizar: "+e));
    else db.collection("atendimentos").add(d).then(()=>{fecharModal()}).catch(e=>alert("Erro ao salvar: "+e));
};

function fecharModal() { document.getElementById('modal').style.display='none'; }
function fecharModalVisualizar() { document.getElementById('modal-visualizar').style.display='none'; }
window.excluir = function(id) { if(confirm('Tem certeza?')) db.collection("atendimentos").doc(id).delete().catch(e=>alert("Erro: "+e)); }
window.onclick = function(e) { 
    if(e.target == document.getElementById('modal')) fecharModal();
    if(e.target == document.getElementById('modal-visualizar')) fecharModalVisualizar();
    if(e.target == document.getElementById('modal-estatisticas')) fecharModalEstatisticas();
}