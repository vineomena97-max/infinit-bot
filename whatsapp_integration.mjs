/**
 * Integração com WhatsApp Business API
 * Webhook para receber e processar mensagens
 */

import express from 'express';
import https from 'https';
import { processMessage, isStoreOpen } from './infinit_whatsapp_chatbot.mjs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'infinit_celulares_2024';

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verificado com sucesso');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages) {
      const message = value.messages[0];
      const sender = message.from;
      const messageId = message.id;
      const timestamp = message.timestamp;

      console.log(`📨 Mensagem recebida de ${sender} às ${new Date(timestamp * 1000).toLocaleString('pt-BR')}`);

      if (message.type === 'text') {
        await handleTextMessage(sender, message.text.body, messageId);
      } else if (message.type === 'image') {
        await handleImageMessage(sender, message.image.link, message.image.caption, messageId);
      } else if (message.type === 'document') {
        await handleDocumentMessage(sender, message.document.link, messageId);
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

async function handleTextMessage(sender, text, messageId) {
  console.log(`💬 Texto: "${text}"`);

  if (text.toLowerCase().includes('agendar')) {
    await sendMessage(sender, '📅 Para agendar um atendimento, por favor forneça:\n1. Seu nome\n2. Horário preferido\n3. Descrição do problema');
    return;
  }

  if (text.toLowerCase().includes('atendente')) {
    await sendMessage(sender, '👨‍💼 Um atendente humano entrará em contato em breve. Obrigado pela paciência!');
    return;
  }

  const response = await processMessage(text);
  await sendMessage(sender, response);
}

async function handleImageMessage(sender, imageUrl, caption, messageId) {
  console.log(`📸 Imagem recebida: ${imageUrl}`);
  console.log(`📝 Legenda: ${caption || '(sem legenda)'}`);

  const response = await processMessage(caption || 'Analisando a imagem do celular', imageUrl);
  await sendMessage(sender, response);
}

async function handleDocumentMessage(sender, documentUrl, messageId) {
  console.log(`📄 Documento recebido: ${documentUrl}`);
  await sendMessage(sender, '📄 Recebemos seu documento. Um atendente analisará em breve.');
}

async function sendMessage(recipientPhone, messageText) {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    console.error('❌ Credenciais do WhatsApp não configuradas');
    return;
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: {
        body: messageText,
      },
    });

    const options = {
      hostname: 'graph.instagram.com',
      port: 443,
      path: `/v18.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
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
          if (result.messages?.[0]?.id) {
            console.log(`✅ Mensagem enviada para ${recipientPhone}`);
            resolve(true);
          } else {
            console.error('❌ Erro ao enviar mensagem:', result);
            resolve(false);
          }
        } catch (error) {
          console.error('❌ Erro ao processar resposta:', error);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição:', error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    store: 'Infinit Celulares',
    storeOpen: isStoreOpen(),
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor WhatsApp Bot rodando na porta ${PORT}`);
  console.log(`📍 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
});

export { sendMessage, handleTextMessage, handleImageMessage };
