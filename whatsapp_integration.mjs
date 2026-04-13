/**
 * Servidor Web + Chatbot IA
 * Integração com WhatsApp Business API
 */

import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processMessage, isStoreOpen } from './infinit_whatsapp_chatbot_corrigido.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'infinit_celulares_2024';

/**
 * Serve a página principal
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Webhook GET - Verificação do WhatsApp
 */
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

/**
 * Webhook POST - Receber mensagens do WhatsApp
 */
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages) {
      const message = value.messages[0];
      const sender = message.from;

      console.log(`📨 Mensagem recebida de ${sender}`);

      if (message.type === 'text') {
        const response = await processMessage(message.text.body);
        await sendWhatsAppMessage(sender, response);
      } else if (message.type === 'image') {
        const response = await processMessage(
          message.image.caption || 'Analisando imagem do celular',
          message.image.link
        );
        await sendWhatsAppMessage(sender, response);
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

/**
 * API para chat web
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.json({ success: false, error: 'Mensagem vazia' });
    }

    const response = await processMessage(message);

    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    console.error('Erro no chat:', error);
    res.json({
      success: false,
      error: 'Erro ao processar mensagem'
    });
  }
});

/**
 * API para análise de imagem
 */
app.post('/api/analyze-image', async (req, res) => {
  try {
    // Como estamos em ambiente web, vamos processar como descrição
    const response = await processMessage('Analisando imagem do celular para identificação de modelo e problemas');

    res.json({
      success: true,
      response: response
    });
  } catch (error) {
    console.error('Erro ao analisar imagem:', error);
    res.json({
      success: false,
      error: 'Erro ao analisar imagem'
    });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    store: 'Infinit Celulares',
    storeOpen: isStoreOpen(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Envia mensagem via WhatsApp Business API
 */
async function sendWhatsAppMessage(recipientPhone, messageText) {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_BUSINESS_ACCOUNT_ID) {
    console.error('❌ Credenciais do WhatsApp não configuradas');
    return false;
  }

  return new Promise((resolve) => {
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
            console.error('❌ Erro ao enviar:', result);
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
      resolve(false);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Inicia servidor
 */
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor Infinit Celulares rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
  console.log(`📍 Webhook: http://localhost:${PORT}/webhook`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
