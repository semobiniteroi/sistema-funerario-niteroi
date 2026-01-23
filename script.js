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
let sepulturaOriginal = ""; 

// Mapa de Dimensões das Urnas
const dimensoesUrna = {
    'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70',
    'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80',
    'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85',
    '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95',
    'PERPETUA': ''
};

// --- FUNÇÃO PARA BUSCAR CIDADES NO IBGE ---
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
            // Ordena alfabeticamente
            cidades.sort((a, b) => a.nome.localeCompare(b.nome));
            
            cidades.forEach(cidade => {
                const opt = document.createElement('option');
                opt.value = cidade.nome.toUpperCase(); // Salva em caixa alta
                opt.text = cidade.nome.toUpperCase();
                
                if (cidade.nome.toUpperCase() === cidadeSelecionada) {
                    opt.selected = true;
                }
                selectCidade.appendChild(opt);
            });
            selectCidade.disabled = false;
        })
        .catch(err => {
            console.error("Erro ao buscar cidades:", err);
            selectCidade.innerHTML = '<option value="">Erro ao carregar</option>';
        });
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. GERAÇÃO DO RELÓGIO
    const selectHora = document.getElementById('hora');
    selectHora.innerHTML = '<option value="">--:--</option>';
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const horaFormatada = String(h).padStart(2, '0');
            const minFormatado = String(m).padStart(2, '0');
            const valor = `${horaFormatada}:${minFormatado}`;
            const option = document.createElement('option');
            option.value = valor;
            option.text = valor;
            selectHora.appendChild(option);
        }
    }

    const hoje = new Date().toISOString().split('T')[0];
    const inputData = document.getElementById('filtro-data');
    const inputLocal = document.getElementById('filtro-local');
    
    inputData.value = hoje;

    atualizarListener(hoje, inputLocal.value);

    inputData.addEventListener('change', (e) => {
        atualizarListener(e.target.value, inputLocal.value);
    });

    inputLocal.addEventListener('change', (e) => {
        atualizarListener(inputData.value, e.target.value);
    });

    // Listener Seletor Causas
    const seletorCausas = document.getElementById('seletor_causas');
    if (seletorCausas) {
        seletorCausas.addEventListener('change', function() {
            const inputCausa = document.getElementById("causa");
            const valorSelecionado = this.value;
            if (valorSelecionado) {
                if (inputCausa.value) inputCausa.value += " / " + valorSelecionado;
                else inputCausa.value = valorSelecionado;
                this.value = ""; 
            }
        });
    }

    // Listener Hospital (DOMICÍLIO)
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

    // Listener Estado (Carregar Cidades)
    const selectEstado = document.getElementById('estado_obito');
    selectEstado.addEventListener('change', function() {
        carregarCidades(this.value);
    });

    // Listener Mudança Sepultura
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
    document.getElementById('hora').value = ""; 
    
    document.getElementById('chk_tanato').checked = false;
    document.getElementById('chk_invol').checked = false;
    document.getElementById('chk_translado').checked = false;
    document.getElementById('chk_urna_opc').checked = false;

    // Reset campos ocultos
    document.getElementById('div-local-domicilio').classList.add('hidden');
    document.getElementById('div-motivo-sepultura').classList.add('hidden');
    
    // Reset cidades
    document.getElementById('estado_obito').value = "";
    document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>';
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
            if(item.motivo_troca_sepultura) {
                document.getElementById('view_urna_info').innerText += `\n[TROCA SEPULTURA: ${item.motivo_troca_sepultura}]`;
            }

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
                opt.value = horaSalva;
                opt.text = horaSalva;
                selectHora.add(opt);
            }
            selectHora.value = horaSalva || "";

            document.getElementById('nome').value = item.nome;
            document.getElementById('causa').value = item.causa;
            document.getElementById('resp_nome').value = item.resp_nome || '';
            document.getElementById('parentesco').value = item.parentesco || ''; 
            document.getElementById('classificacao_obito').value = item.classificacao_obito || 'ADULTO';

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

            // Lógica Sepultura
            sepulturaOriginal = item.sepul; 
            document.getElementById('sepul').value = item.sepul;
            document.getElementById('motivo_troca_sepultura').value = item.motivo_troca_sepultura || '';
            
            document.getElementById('qd').value = item.qd;
            
            // Lógica Hospital e Cidade
            document.getElementById('hospital').value = item.hospital;
            
            // Configura os campos de cidade/estado
            document.getElementById('estado_obito').value = item.estado_obito || '';
            
            // Se tiver estado, carrega as cidades e seleciona a correta
            if (item.estado_obito) {
                carregarCidades(item.estado_obito, item.cidade_obito);
            } else {
                document.getElementById('cidade_obito').innerHTML = '<option value="">Selecione a UF primeiro</option>';
                document.getElementById('cidade_obito').disabled = true;
            }
            
            // Dispara eventos para visualização
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
        data_ficha: dataFicha,
        local: localSelecionado,
        hora: document.getElementById('hora').value,
        resp_nome: document.getElementById('resp_nome').value,
        parentesco: document.getElementById('parentesco').value, 
        classificacao_obito: document.getElementById('classificacao_obito').value, 
        
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
        
        // Novos campos de endereço
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
        db.collection("atendimentos").doc(id).delete()
          .catch((error) => alert("Erro ao excluir: " + error));
    }
}

window.onclick = function(event) {
    if (event.target == modal) fecharModal();
    if (event.target == modalVisualizar) fecharModalVisualizar();
}