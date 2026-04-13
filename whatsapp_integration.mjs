import express from 'express';
import multer from 'multer';
import https from 'https';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Função para chamar a IA Manus (gratuita)
async function callMausAI(prompt) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `Você é um assistente de triagem de celulares para a loja Infinit Celulares. 
Você deve:
1. Identificar o modelo do celular (marca, linha, modelo)
2. Diagnosticar os problemas descritos
3. Classificar a severidade (BAIXA, MÉDIA, ALTA)
4. Dar recomendações profissionais
5. Ser conciso e direto

Responda sempre no formato:
📱 MODELO: [marca e modelo]
⚠️ PROBLEMAS IDENTIFICADOS:
• [problema 1]
• [problema 2]

🔴/🟡/🟢 SEVERIDADE: [ALTA/MÉDIA/BAIXA]

💡 RECOMENDAÇÃO: [recomendação]`
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const options = {
      hostname: 'api.manus.im',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MANUS_API_KEY || 'demo'}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          const message = result.choices?.[0]?.message?.content || 'Erro ao processar resposta';
          resolve(message);
        } catch (error) {
          resolve(getLocalResponse(prompt));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Erro na IA:', error);
      resolve(getLocalResponse(prompt));
    });

    req.write(data);
    req.end();
  });
}

// Função de fallback com IA local simples
function getLocalResponse(message) {
  const msg = message.toLowerCase();
  
  // Análise de palavras-chave para diagnóstico
  const problems = [];
  const keywords = {
    'não liga': { problem: 'Celular não liga', severity: 'ALTA' },
    'não carrega': { problem: 'Não carrega', severity: 'ALTA' },
    'tela quebrada': { problem: 'Tela quebrada', severity: 'MÉDIA' },
    'tela trincada': { problem: 'Tela trincada', severity: 'MÉDIA' },
    'tela preta': { problem: 'Tela preta/sem imagem', severity: 'ALTA' },
    'bateria': { problem: 'Problema na bateria', severity: 'BAIXA' },
    'descarrega rápido': { problem: 'Bateria descarrega rápido', severity: 'MÉDIA' },
    'travado': { problem: 'Celular travado', severity: 'MÉDIA' },
    'lento': { problem: 'Celular lento', severity: 'BAIXA' },
    'quente': { problem: 'Celular esquentando', severity: 'MÉDIA' },
    'molhado': { problem: 'Dano por água', severity: 'ALTA' },
    'câmera': { problem: 'Problema na câmera', severity: 'BAIXA' },
    'áudio': { problem: 'Problema de áudio', severity: 'BAIXA' },
    'microfone': { problem: 'Microfone com defeito', severity: 'BAIXA' },
    'conectividade': { problem: 'Problema de conectividade', severity: 'MÉDIA' },
    'wifi': { problem: 'WiFi não funciona', severity: 'BAIXA' },
    'bluetooth': { problem: 'Bluetooth com defeito', severity: 'BAIXA' },
  };

  let maxSeverity = 'BAIXA';
  const severityOrder = { 'BAIXA': 1, 'MÉDIA': 2, 'ALTA': 3 };

  for (const [keyword, data] of Object.entries(keywords)) {
    if (msg.includes(keyword)) {
      problems.push(data.problem);
      if (severityOrder[data.severity] > severityOrder[maxSeverity]) {
        maxSeverity = data.severity;
      }
    }
  }

  // Identificar marca
  let brand = 'Desconhecido';
  if (msg.includes('iphone') || msg.includes('apple')) brand = 'iPhone';
  else if (msg.includes('samsung')) brand = 'Samsung';
  else if (msg.includes('xiaomi')) brand = 'Xiaomi';
  else if (msg.includes('motorola') || msg.includes('moto')) brand = 'Motorola';
  else if (msg.includes('lg')) brand = 'LG';
  else if (msg.includes('huawei')) brand = 'Huawei';
  else if (msg.includes('nokia')) brand = 'Nokia';
  else if (msg.includes('sony')) brand = 'Sony';

  let response = `📱 TRIAGEM INFINIT CELULARES\n\n`;

  if (brand !== 'Desconhecido') {
    response += `✅ MARCA IDENTIFICADA: ${brand}\n\n`;
  }

  if (problems.length > 0) {
    response += `⚠️ PROBLEMAS IDENTIFICADOS:\n`;
    problems.forEach(p => response += `• ${p}\n`);
    response += `\n`;
    
    const severityEmoji = maxSeverity === 'ALTA' ? '🔴' : maxSeverity === 'MÉDIA' ? '🟡' : '🟢';
    response += `${severityEmoji} SEVERIDADE: ${maxSeverity}\n\n`;
  } else {
    response += `📝 Descrição recebida\n\n`;
  }

  response += `💡 RECOMENDAÇÃO:\n`;
  if (maxSeverity === 'ALTA') {
    response += `Trazer o celular para análise URGENTE!`;
  } else if (maxSeverity === 'MÉDIA') {
    response += `Pode ser consertado em poucas horas.`;
  } else {
    response += `Problema simples, rápido de resolver!`;
  }

  response += `\n\n📞 Ligue: (11) 99999-9999\n⏰ Horário: 09:00 - 18:00`;

  return response;
}

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Infinit Celulares - Chatbot IA</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            width: 100%;
            max-width: 600px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            height: 90vh;
            max-height: 800px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px 12px 0 0;
            text-align: center;
        }
        .header h1 { font-size: 24px; margin-bottom: 5px; }
        .header p { font-size: 14px; opacity: 0.9; }
        .chat-box {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .message {
            margin-bottom: 15px;
            display: flex;
            animation: slideIn 0.3s ease-in-out;
        }
        @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message.user { justify-content: flex-end; }
        .message.bot { justify-content: flex-start; }
        .message-content {
            max-width: 70%;
            padding: 12px 16px;
            border-radius: 12px;
            word-wrap: break-word;
            line-height: 1.6;
            white-space: pre-wrap;
            font-size: 14px;
        }
        .message.user .message-content {
            background: #667eea;
            color: white;
            border-bottom-right-radius: 4px;
        }
        .message.bot .message-content {
            background: white;
            color: #333;
            border: 1px solid #ddd;
            border-bottom-left-radius: 4px;
        }
        .message img {
            max-width: 100%;
            border-radius: 8px;
            margin-top: 5px;
        }
        .input-area {
            padding: 20px;
            border-top: 1px solid #ddd;
            background: white;
            border-radius: 0 0 12px 12px;
        }
        .input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }
        input[type="text"] {
            flex: 1;
            padding: 12px 16px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 14px;
        }
        input[type="text"]:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            padding: 12px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }
        button:hover { background: #5568d3; }
        .file-btn {
            background: #48bb78;
        }
        .file-btn:hover { background: #38a169; }
        .share-btn {
            width: 100%;
            padding: 12px;
            background: #25d366;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 10px;
            font-weight: 600;
        }
        .share-btn:hover { background: #1fb854; }
        .share-btn:disabled { background: #ccc; cursor: not-allowed; }
        .info-text {
            font-size: 12px;
            color: #666;
            margin-top: 10px;
            text-align: center;
        }
        #fileInput { display: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Infinit Celulares</h1>
            <p>Triagem Automática com IA</p>
        </div>

        <div class="chat-box" id="chatBox">
            <div class="message bot">
                <div class="message-content">👋 Olá! Bem-vindo à Infinit Celulares!

Sou um assistente de IA inteligente. Posso ajudar você a:
• 📱 Identificar o modelo do seu celular
• 🔍 Diagnosticar problemas
• 📋 Gerar um relatório de triagem

Descreva o problema do seu celular!</div>
            </div>
        </div>

        <div class="input-area">
            <div class="input-group">
                <input 
                    type="text" 
                    id="messageInput" 
                    placeholder="Ex: iPhone 11 com tela quebrada..."
                    onkeypress="if(event.key==='Enter') sendMessage()"
                >
                <button onclick="sendMessage()">Enviar</button>
            </div>

            <div class="input-group">
                <button class="file-btn" onclick="document.getElementById('fileInput').click()">
                    📸 Enviar Foto
                </button>
            </div>

            <input type="file" id="fileInput" accept="image/*" onchange="handleFileUpload(event)">

            <button class="share-btn" id="shareBtn" onclick="shareViaWhatsApp()" disabled>
                📱 Compartilhar via WhatsApp
            </button>

            <div class="info-text">
                ⏰ Horário: 09:00 - 18:00 | 📞 (11) 99999-9999
            </div>
        </div>
    </div>

    <script>
        let lastResponse = '';

        function addMessage(text, isUser = false, imageData = null) {
            const chatBox = document.getElementById('chatBox');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + (isUser ? 'user' : 'bot');
            
            let content = '<div class="message-content">' + text;
            if (imageData) {
                content += '<br><img src="' + imageData + '" style="max-width: 200px; margin-top: 10px;">';
            }
            content += '</div>';
            
            messageDiv.innerHTML = content;
            chatBox.appendChild(messageDiv);
            chatBox.scrollTop = chatBox.scrollHeight;
        }

        async function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();

            if (!message) return;

            addMessage(message, true);
            input.value = '';

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message })
                });

                const data = await response.json();

                if (data.success) {
                    lastResponse = data.response;
                    addMessage(data.response, false);
                    document.getElementById('shareBtn').disabled = false;
                } else {
                    addMessage('❌ Erro ao processar. Tente novamente!', false);
                }
            } catch (error) {
                addMessage('❌ Erro de conexão!', false);
                console.error('Erro:', error);
            }
        }

        async function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const imageData = e.target.result;
                addMessage('📸 Foto enviada!', true, imageData);

                const formData = new FormData();
                formData.append('image', file);

                try {
                    const response = await fetch('/api/analyze-image', {
                        method: 'POST',
                        body: formData
                    });

                    const data = await response.json();

                    if (data.success) {
                        lastResponse = data.response;
                        addMessage(data.response, false);
                        document.getElementById('shareBtn').disabled = false;
                    } else {
                        addMessage('❌ Erro ao analisar a imagem!', false);
                    }
                } catch (error) {
                    addMessage('❌ Erro ao enviar a imagem!', false);
                    console.error('Erro:', error);
                }
            };
            reader.readAsDataURL(file);

            event.target.value = '';
        }

        function shareViaWhatsApp() {
            if (!lastResponse) return;
            const text = encodeURIComponent(lastResponse);
            window.open('https://wa.me/?text=' + text, '_blank');
        }
    </script>
</body>
</html>
  `);
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.json({ success: false });
  }

  // Tentar usar IA Manus, se falhar usa local
  const response = await callMausAI(message);

  res.json({
    success: true,
    response: response
  });
});

app.post('/api/analyze-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.json({ success: false, error: 'Nenhuma imagem enviada' });
  }

  const prompt = `Analise esta imagem de um celular e identifique:
1. Marca e modelo (se possível)
2. Possíveis problemas visíveis
3. Severidade do dano

Seja conciso e profissional.`;

  const response = await callMausAI(prompt);

  res.json({
    success: true,
    response: response
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
});
