/**
 * Infinit Celulares - WhatsApp Business Chatbot
 * IA para identificação de modelos de celular e triagem de atendimento
 * Horário: 09:00 - 18:00
 */

import fetch from 'node-fetch';

const BUSINESS_HOURS = {
  start: 9,
  end: 18,
};

const STORE_NAME = "Infinit Celulares";
const STORE_PHONE = "(11) 99999-9999";

function isStoreOpen() {
  const now = new Date();
  const hours = now.getHours();
  const dayOfWeek = now.getDay();
  
  if (dayOfWeek === 0) return false;
  
  return hours >= BUSINESS_HOURS.start && hours < BUSINESS_HOURS.end;
}

async function identifyPhoneModel(imageUrl) {
  try {
    const response = await fetch('https://api.manus.im/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MANUS_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em identificação de modelos de celulares. Analise a imagem da parte traseira do celular e identifique: marca, linha, modelo específico e confiança (0-1 ). Responda em JSON com os campos: brand, line, model, confidence, features.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Por favor, identifique este modelo de celular pela foto da parte traseira.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'phone_identification',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                brand: { type: 'string' },
                line: { type: 'string' },
                model: { type: 'string' },
                confidence: { type: 'number' },
                features: { type: 'string' },
              },
              required: ['brand', 'line', 'model', 'confidence', 'features'],
            },
          },
        },
      }),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Erro ao identificar modelo:', error);
    return null;
  }
}

async function analyzeProblem(description, imageUrl = null) {
  try {
    const messageContent = imageUrl
      ? [
          {
            type: 'text',
            text: `Cliente relata o seguinte problema: "${description}"\n\nAnálise a imagem e descreva os possíveis problemas visíveis. Responda em JSON com: problems (array), severity (baixa/média/alta), recommendation (string).`,
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high',
            },
          },
        ]
      : `Cliente relata o seguinte problema: "${description}"\n\nIdentifique os possíveis problemas baseado na descrição. Responda em JSON com: problems (array), severity (baixa/média/alta), recommendation (string).`;

    const response = await fetch('https://api.manus.im/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MANUS_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'Você é um técnico especialista em celulares. Analise os problemas relatados e forneça uma triagem profissional. Seja conciso e prático.',
          },
          {
            role: 'user',
            content: messageContent,
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'problem_analysis',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                problems: {
                  type: 'array',
                  items: { type: 'string' },
                },
                severity: { type: 'string', enum: ['baixa', 'média', 'alta'] },
                recommendation: { type: 'string' },
              },
              required: ['problems', 'severity', 'recommendation'],
            },
          },
        },
      } ),
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    console.error('Erro ao analisar problema:', error);
    return null;
  }
}

async function generateTriageResponse(phoneModel, problemAnalysis) {
  try {
    const response = await fetch('https://api.manus.im/llm/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MANUS_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `Você é um atendente da ${STORE_NAME}. Gere uma resposta profissional e amigável para o cliente baseado na triagem. Seja conciso (máximo 3 linhas ). Inclua próximos passos.`,
          },
          {
            role: 'user',
            content: `Modelo identificado: ${phoneModel.brand} ${phoneModel.line} ${phoneModel.model}\nProblemas: ${problemAnalysis.problems.join(', ')}\nSeveridade: ${problemAnalysis.severity}\nRecomendação: ${problemAnalysis.recommendation}\n\nGere uma resposta de triagem para o cliente.`,
          },
        ],
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Erro ao gerar resposta:', error);
    return 'Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente.';
  }
}

async function processMessage(message, imageUrl = null) {
  if (!isStoreOpen()) {
    const now = new Date();
    return `🔴 Desculpe! ${STORE_NAME} está fechada no momento.\n\n⏰ Horário de funcionamento: 09:00 - 18:00\n\nEntre em contato conosco amanhã ou ligue para ${STORE_PHONE}`;
  }

  let phoneModel = null;
  if (imageUrl) {
    phoneModel = await identifyPhoneModel(imageUrl);
  }

  const problemAnalysis = await analyzeProblem(message, imageUrl);

  if (!problemAnalysis) {
    return 'Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente.';
  }

  let triageResponse = await generateTriageResponse(
    phoneModel || { brand: 'Desconhecido', line: '', model: '' },
    problemAnalysis
  );

  let finalResponse = `🤖 *TRIAGEM AUTOMÁTICA - ${STORE_NAME}*\n\n`;

  if (phoneModel) {
    finalResponse += `📱 *Modelo Identificado:*\n${phoneModel.brand} ${phoneModel.line} ${phoneModel.model}\n(Confiança: ${(phoneModel.confidence * 100).toFixed(0)}%)\n\n`;
  }

  finalResponse += `⚠️ *Problemas Detectados:*\n${problemAnalysis.problems.map((p) => `• ${p}`).join('\n')}\n\n`;
  finalResponse += `🔴 *Severidade:* ${problemAnalysis.severity}\n\n`;
  finalResponse += `💡 *Recomendação:*\n${triageResponse}\n\n`;
  finalResponse += `📞 *Próximos Passos:*\nDigite "agendar" para marcar um atendimento ou "falar com atendente" para conversar com um especialista.`;

  return finalResponse;
}

async function simulateConversation() {
  console.log('🤖 Infinit Celulares - Chatbot WhatsApp Business\n');
  console.log('Testando fluxo de triagem...\n');

  console.log('--- TESTE 1: Problema por descrição ---');
  const response1 = await processMessage('Meu celular não liga mais, tentei carregar mas não funciona');
  console.log(response1);
  console.log('\n');

  console.log('✅ Testes concluídos!');
}

simulateConversation().catch(console.error);

export { processMessage, identifyPhoneModel, analyzeProblem, isStoreOpen };
