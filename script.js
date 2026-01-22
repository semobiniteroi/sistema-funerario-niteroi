// --- CONFIGURAÇÃO DO FIREBASE (Suas Chaves) ---
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

// --- LÓGICA DO SISTEMA ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Data e Local iniciais
    const hoje = new Date().toISOString().split('T')[0];
    const inputData = document.getElementById('filtro-data');
    const inputLocal = document.getElementById('filtro-local');
    
    inputData.value = hoje;

    // 2. Carrega dados
    atualizarListener(hoje, inputLocal.value);

    // 3. Monitora mudanças
    inputData.addEventListener('change', (e) => {
        atualizarListener(e.target.value, inputLocal.value);
    });

    // ALTERAÇÃO: Ao mudar o local, recarrega a tabela filtrando pelo novo local
    inputLocal.addEventListener('change', (e) => {
        atualizarListener(inputData.value, e.target.value);
    });
});

function atualizarListener(dataSelecionada, localSelecionado) {
    if (unsubscribe) {
        unsubscribe();
    }

    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = '<tr><td colspan="11">Carregando...</td></tr>';

    // Busca por data
    unsubscribe = db.collection("atendimentos")
      .where("data_ficha", "==", dataSelecionada) 
      .onSnapshot((snapshot) => {
          let listaAtendimentos = [];
          
          snapshot.forEach(doc => {
              let dado = doc.data();
              dado.id = doc.id;
              
              // ALTERAÇÃO CRÍTICA: Filtro de Local no Cliente (Segurança contra dados antigos)
              // Se o dado não tiver 'local', assume que é MARUÍ (para não quebrar dados antigos)
              const localDoRegistro = dado.local || "CEMITÉRIO DO MARUÍ";

              // Só adiciona na lista se for do cemitério selecionado
              if (localDoRegistro === localSelecionado) {
                  listaAtendimentos.push(dado);
              }
          });

          // Ordena
          listaAtendimentos.sort((a, b) => {
              if (a.hora < b.hora) return -1;
              if (a.hora > b.hora) return 1;
              return 0;
          });

          renderizarTabela(listaAtendimentos);
      }, (error) => {
          console.error("Erro ao ler dados:", error);
          tbody.innerHTML = '<tr><td colspan="11">Erro ao carregar dados. Verifique o console.</td></tr>';
      });
}

function renderizarTabela(lista) {
    const tbody = document.getElementById('tabela-corpo');
    tbody.innerHTML = ''; 

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="padding: 20px; text-align:center; color:#777;">Nenhum atendimento registrado neste local/data.</td></tr>';
        return;
    }

    lista.forEach(item => {
        const tr = document.createElement('tr');
        
        // Responsável / Urna
        let displayResponsavel = '';
        if (item.resp_nome || item.urna_info) {
            displayResponsavel = `<b>${item.resp_nome || ''}</b><br>${(item.urna_info || '').replace(/\n/g, '<br>')}`;
        } else {
            displayResponsavel = (item.responsavel || '').replace(/\n/g, '<br>');
        }

        const conteudoNome = `<div>${item.nome || ''}</div>
                              <div class="destaque-vermelho">${item.causa || ''}</div>`;
        
        // Falecimento
        let displayFalecimento = '';
        if (item.data_obito) {
            const partes = item.data_obito.split('-');
            const dataFormatada = `${partes[2]}/${partes[1]}`;
            displayFalecimento = `<div class="destaque-vermelho">DIA: <br>${dataFormatada}<br>AS: ${item.hora_obito || ''} HS</div>`;
        } else if (item.falecimento) {
            displayFalecimento = `<div class="destaque-vermelho">${item.falecimento}</div>`;
        }

        tr.innerHTML = `
            <td style="text-align: left; font-size: 11px;">${displayResponsavel}</td>
            <td>${item.hora || ''}</td>
            <td>${conteudoNome}</td>
            <td>${item.gav || ''}</td>
            <td>${item.car || ''}</td>
            <td>${item.sepul || ''}</td>
            <td>${item.qd || ''}</td>
            <td>${item.hospital || ''}</td>
            <td>${item.cap || ''}</td>
            <td>${displayFalecimento}</td>
            <td class="t-acoes">
                <button class="btn-editar" onclick="editar('${item.id}')">✏️</button>
                <button class="btn-excluir" onclick="excluir('${item.id}')">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

const modal = document.getElementById('modal');
const form = document.getElementById('form-atendimento');

function abrirModal() {
    form.reset();
    document.getElementById('docId').value = '';
    document.getElementById('tipo_sepultura').value = "";
    modal.style.display = 'block';
}

function fecharModal() {
    modal.style.display = 'none';
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

            document.getElementById('data_obito').value = item.data_obito || '';
            document.getElementById('hora_obito').value = item.hora_obito || '';
            
            const selectTipo = document.getElementById('tipo_sepultura');
            if (item.gav && item.gav.includes('X')) selectTipo.value = 'GAVETA';
            else if (item.car && item.car.includes('X')) selectTipo.value = 'CARNEIRO';
            else if (item.cova_rasa === 'X') selectTipo.value = 'COVA RASA';
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
    // ALTERAÇÃO: Captura qual o local que está selecionado no topo para salvar no registro
    const localSelecionado = document.getElementById('filtro-local').value;

    const dados = {
        data_ficha: dataFicha,
        local: localSelecionado, // Salva se é Maruí, Itaipu ou São Francisco
        
        hora: document.getElementById('hora').value,
        resp_nome: document.getElementById('resp_nome').value,
        urna_info: document.getElementById('urna_info').value,
        nome: document.getElementById('nome').value,
        causa: document.getElementById('causa').value,
        
        gav: (tipoSelecionado === 'GAVETA') ? 'X' : '',
        car: (tipoSelecionado === 'CARNEIRO') ? 'X' : '',
        cova_rasa: (tipoSelecionado === 'COVA RASA') ? 'X' : '',
        
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
    if(confirm('Tem certeza que deseja excluir este registro permanentemente?')) {
        db.collection("atendimentos").doc(id).delete()
          .catch((error) => alert("Erro ao excluir: " + error));
    }
}

window.onclick = function(event) {
    if (event.target == modal) fecharModal();
}