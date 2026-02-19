const plotDiv = document.getElementById('plot-div');
const simulateBtn = document.getElementById('simulate-btn');
const trainBtn = document.getElementById('train-btn');
const uploadBtn = document.getElementById('upload-btn');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');

// Endereço do seu servidor Flask.
// É vital que este seja o endereço onde 'app.py' está a ser executado.
const SERVER_URL = 'http://127.0.0.1:5000';

// --- Simulação ---
simulateBtn.addEventListener('click', async () => {
    showLoader("Simulando evento...");
    const n_particles = parseInt(document.getElementById('n_particles').value);
    const start_event = parseInt(document.getElementById('start_event').value)

    try {
        // CORREÇÃO VITAL: Usar o URL completo do servidor
        const response = await fetch(`${SERVER_URL}/simulate/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                "start_event": start_event,
                "num_events": n_particles
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || `Erro no servidor: ${response.statusText}`);
        }

        const figJson = await response.text();
        const fig = JSON.parse(figJson);

        // Limpa o plot antigo e renderiza o novo
        Plotly.newPlot(plotDiv, fig.data, fig.layout, { responsive: true }).then(() => {
            // Adiciona os frames para a animação
            Plotly.addFrames(plotDiv, fig.frames);
        });

    } catch (error) {
        console.error("Erro ao simular:", error);
        plotDiv.innerHTML = `<div class="text-red-500 p-8"><b>Erro ao simular:</b> ${error.message}. <br><br><b>Verifique se o servidor 'app.py' está a ser executado no seu terminal.</b></div>`;
    } finally {
        hideLoader();
    }
});

// --- Treinamento ---
// trainBtn.addEventListener('click', async () => {
//     showLoader("Treinando Rede Neural... (Isto pode demorar alguns minutos)");
//     const trainStatus = document.getElementById('train-status');
//     const resultsDiv = document.getElementById('train-results');

//     trainStatus.textContent = "Treinando... (A gerar dados e a ajustar pesos)";
//     trainStatus.classList.remove('text-green-400', 'text-red-500');
//     trainStatus.classList.add('text-yellow-400');
//     resultsDiv.classList.add('hidden');

//     try {
//         // CORREÇÃO VITAL: Usar o URL completo do servidor
//         const response = await fetch(`${SERVER_URL}/train/`, { method: 'POST' });
//         if (!response.ok) {
//             const err = await response.json();
//             throw new Error(err.error || `Erro no servidor: ${response.statusText}`);
//         }

//         const results = await response.json();

//         trainStatus.textContent = "Treinamento Concluído!";
//         trainStatus.classList.add('text-green-400');

//         document.getElementById('res-accuracy').textContent = `${(results.accuracy * 100).toFixed(2)}%`;
//         document.getElementById('res-loss').textContent = results.loss.toFixed(4);
//         document.getElementById('res-classes').textContent = results.classes.join(', ');
//         resultsDiv.classList.remove('hidden');

//     } catch (error) {
//         console.error("Erro ao treinar:", error);
//         trainStatus.textContent = `Erro no treinamento: ${error.message}`;
//         trainStatus.classList.remove('text-green-400');
//         trainStatus.classList.add('text-red-500');
//     } finally {
//         hideLoader();
//     }
// });

// --- Upload ---
uploadBtn.addEventListener('click', async () => {
    const fileInput = document.getElementById('root-file-input');
    const uploadStatus = document.getElementById('upload-status');
    console.log("clicou")

    const file = fileInput.files[0];

    if (!file) {
        uploadStatus.textContent = "Por favor, selecione um arquivo .root para upload.";
        uploadStatus.className = "mt-3 text-sm text-red-500";
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    showLoader("Enviando e processando arquivo ROOT...");
    uploadStatus.textContent = "Enviando...";
    uploadStatus.className = "mt-3 text-sm text-yellow-400";

    try {
        // CORREÇÃO VITAL: Usar o URL completo do servidor
        const response = await fetch(`${SERVER_URL}/upload/`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro desconhecido');
        }

        uploadStatus.textContent = `Sucesso: ${result.message}. Árvore: ${result.tree_name} (${result.num_entries} entradas).`;
        uploadStatus.className = "mt-3 text-sm text-green-400";
        console.log("Colunas do ROOT:", result.columns);

    } catch (error) {
        console.error("Erro no upload:", error);
        uploadStatus.textContent = `Erro no upload: ${error.message}`;
        uploadStatus.className = "mt-3 text-sm text-red-500";
    } finally {
        hideLoader();
    }
});


// --- Funções Auxiliares (Loader) ---
function showLoader(message) {
    loaderText.textContent = message || "Carregando...";
    loader.classList.remove('hidden');
}

function hideLoader() {
    loader.classList.add('hidden');
}

// Simula um evento ao carregar a página
window.onload = () => {
    // Atrasar o primeiro clique para dar tempo ao servidor (se estiver a reiniciar)
    setTimeout(() => {
        simulateBtn.click();
    }, 500);
};