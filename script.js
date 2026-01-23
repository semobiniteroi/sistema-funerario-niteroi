// --- FIREBASE CONFIGURATION (Your Keys) ---
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

// Urn Dimensions Map
const dimensoesUrna = {
    'NORMAL': 'COMP: 2.00<br>ALT: 0.41<br>LARG: 0.70',
    'G': 'COMP: 2.00<br>ALT: 0.45<br>LARG: 0.80',
    'GG': 'COMP: 2.00<br>ALT: 0.56<br>LARG: 0.85',
    '3G': 'COMP: 2.00<br>ALT: 0.65<br>LARG: 0.95',
    'PERPETUA': ''
};

document.addEventListener('DOMContentLoaded', () => {
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
});

function atualizarListener(dataSelecionada, localSelecionado) {
    if (unsubscribe) {
        unsubscribe();
    }

    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">Carregando dados...</td></tr>';

    unsubscribe = db.collection("atendimentos")
      .where("data_ficha", "==", dataSelecionada) 
      .onSnapshot((snapshot) => {
          let listaAtendimentos = [];
          
          snapshot.forEach(doc => {
              let dado = doc.data();
              dado.id = doc.id;
              
              // --- FIX IS HERE ---
              // If the record has NO location (it's old), we assume it is "CEMITÉRIO DO MARUÍ".
              // This makes the old data appear when "MARUÍ" is selected.
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

        // --- COLUMN 1: RESPONSIBLE / URN ---
        let displayResponsavel = "";
        
        // Priority: Exemption / Funeral Home / Responsible
        if (item.isencao === "50") {
            displayResponsavel += `ACOLHIMENTO 50% TX`;
            if(item.requisito) displayResponsavel += `<br>${item.requisito.toUpperCase()}`;
            displayResponsavel += `<br>`;
        } else if (item.isencao === "SIM") {
            displayResponsavel += `ACOLHIMENTO 100% TX`;
            if(item.requisito) displayResponsavel += `<br>${item.requisito.toUpperCase()}`;
            displayResponsavel += `<br>`;
        } else {
            if (item.funeraria) {
                displayResponsavel += `${item.funeraria.toUpperCase()}<br>`;
            } else if (item.resp_nome) {
                displayResponsavel += `${item.resp_nome.toUpperCase()}<br>`;
            }
        }

        // Urn Data
        if (item.combo_urna && dimensoesUrna[item.combo_urna]) {
            displayResponsavel += `URNA<br>${dimensoesUrna[item.combo_urna]}<br>`;
        } else if (item.combo_urna) {
            displayResponsavel += `URNA ${item.combo_urna}<br>`;
        }

        if (item.urna_info) {
            displayResponsavel += `<span style="font-weight:normal; font-size:11px;">${item.urna_info.toUpperCase()}</span>`;
        }

        // --- COLUMN 3: NAME / CAUSE ---
        const conteudoNome = `<div style="font-weight:700; font-size:12px;">${item.nome.toUpperCase()}</div>
                              <div class="texto-vermelho" style="font-size:11px; margin-top:2px;">
                                (${item.causa ? item.causa.toUpperCase() : 'CAUSA NÃO INFORMADA'})
                              </div>`;
        
        // --- COLUMN DEATH (Vertical) ---
        let displayFalecimento = '';
        if (item.data_obito) {
            const partes = item.data_obito.split('-');
            const dataFormatada = `${partes[2]}/${partes[1]}`; 
            // Format: DAY: dd/mm AT: hh:mm
            displayFalecimento = `
                <div style="line-height:1.5;">
                    <span class="texto-vermelho">DIA:</span><br>
                    ${dataFormatada}<br>
                    <span class="texto-vermelho">AS:</span><br>
                    ${item.hora_obito || '--:--'}
                </div>
            `;
        } else if (item.falecimento) {
            displayFalecimento = `<div>${item.falecimento}</div>`;
        }

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
                    <button class="btn-icon btn-editar-circle" onclick="event.stopPropagation(); editar('${item.id}')" title="Editar">
                        ✏️
                    </button>
                    <button class="btn-icon btn-excluir-circle" onclick="event.stopPropagation(); excluir('${item.id}')" title="Excluir">
                        🗑️
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- MODALS ---

const modal = document.getElementById('modal');
const modalVisualizar = document.getElementById('modal-visualizar');
const form = document.getElementById('form-atendimento');

function abrirModal() {
    form.reset();
    document.getElementById('docId').value = '';
    document.getElementById('tipo_sepultura').value = "";
    document.getElementById('isencao').value = "NAO"; 
    document.getElementById('combo_urna').value = ""; 
    document.getElementById('requisito').value = "";
    modal.style.display = 'block';
}

function fecharModal() { modal.style.display = 'none'; }
function fecharModalVisualizar() { modalVisualizar.style.display = 'none'; }

window.visualizar = function(id) {
    db.collection("atendimentos").doc(id).get().then((doc) => {
        if (doc.exists) {
            const item = doc.data();
            
            document.getElementById('view_hora').innerText = item.hora || '-';
            document.getElementById('view_resp_nome').innerText = item.resp_nome || '-';
            document.getElementById('view_funeraria').innerText = item.funeraria || '-';
            
            let textoIsencao = "NÃO (Pago)";
            if (item.isencao === "SIM") textoIsencao = "SIM (Gratuidade)";
            if (item.isencao === "50") textoIsencao = "SIM (50%)";
            if (item.requisito) textoIsencao += ` - ${item.requisito}`;
            
            document.getElementById('view_isencao_completa').innerText = textoIsencao;
            document.getElementById('view_urna_info').innerText = item.urna_info || '-';
            document.getElementById('view_combo_urna').innerText = item.combo_urna || '-';
            
            document.getElementById('view_nome').innerText = item.nome || '-';
            document.getElementById('view_causa').innerText = item.causa || '-';
            
            let tipo = '';
            if (item.gav && item.gav.includes('X')) tipo = 'GAVETA';
            else if (item.car && item.car.includes('X')) tipo = 'CARNEIRO';
            else if (item.cova_rasa === 'X') tipo = 'COVA RASA';
            else if (item.perpetua === 'X') tipo = 'PERPÉTUA';
            
            document.getElementById('view_tipo_sepultura').innerText = tipo || '-';
            document.getElementById('view_sepul').innerText = item.sepul || '-';
            document.getElementById('view_qd').innerText = item.qd || '-';
            document.getElementById('view_hospital').innerText = item.hospital || '-';
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
            document.getElementById('hora').value = item.hora;
            document.getElementById('nome').value = item.nome;
            document.getElementById('causa').value = item.causa;
            document.getElementById('resp_nome').value = item.resp_nome || '';
            document.getElementById('urna_info').value = item.urna_info || item.responsavel || '';
            document.getElementById('combo_urna').value = item.combo_urna || ""; 
            document.getElementById('funeraria').value = item.funeraria || '';
            document.getElementById('isencao').value = item.isencao || 'NAO';
            document.getElementById('requisito').value = item.requisito || '';
            document.getElementById('data_obito').value = item.data_obito || '';
            document.getElementById('hora_obito').value = item.hora_obito || '';
            
            const selectTipo = document.getElementById('tipo_sepultura');
            if (item.gav && item.gav.includes('X')) selectTipo.value = 'GAVETA';
            else if (item.car && item.car.includes('X')) selectTipo.value = 'CARNEIRO';
            else if (item.cova_rasa === 'X') selectTipo.value = 'COVA RASA';
            else if (item.perpetua === 'X') selectTipo.value = 'PERPETUA';
            else selectTipo.value = '';

            document.getElementById('sepul').value = item.sepul;
            document.getElementById('qd').value = item.qd;
            document.getElementById('hospital').value = item.hospital;
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
        urna_info: document.getElementById('urna_info').value,
        combo_urna: document.getElementById('combo_urna').value, 
        funeraria: document.getElementById('funeraria').value,
        isencao: document.getElementById('isencao').value,
        requisito: document.getElementById('requisito').value, 
        nome: document.getElementById('nome').value,
        causa: document.getElementById('causa').value,
        gav: (tipoSelecionado === 'GAVETA') ? 'X' : '',
        car: (tipoSelecionado === 'CARNEIRO') ? 'X' : '',
        cova_rasa: (tipoSelecionado === 'COVA RASA') ? 'X' : '',
        perpetua: (tipoSelecionado === 'PERPETUA') ? 'X' : '',
        sepul: document.getElementById('sepul').value,
        qd: document.getElementById('qd').value,
        hospital: document.getElementById('hospital').value,
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