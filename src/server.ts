import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { MeetingAgent, MeetingAgentConfig } from './services/meeting-agent';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const agentConfig: MeetingAgentConfig = {
  recallApiKey: process.env.RECALL_API_KEY!,
  openaiApiKey: process.env.OPENAI_API_KEY!,
  webhookUrl: process.env.WEBHOOK_URL || `http://localhost:${PORT}/webhook`,
  autoRespond: true,
  summaryInterval: 10,
  persona: {
    name: 'AI Meeting Assistant',
    role: 'Intelligent meeting facilitator',
    personality: 'Professional, helpful, and proactive. Focuses on capturing key points and facilitating productive discussions.',
    knowledgeBase: 'Expert in meeting management, project management, and team collaboration.'
  }
};

const meetingAgent = new MeetingAgent(agentConfig);

meetingAgent.on('transcript', (data) => {
  console.log(`[${data.speaker}]: ${data.text}`);
});

meetingAgent.on('message_sent', (data) => {
  console.log(`[Bot Message]: ${data.message}`);
});

meetingAgent.on('meeting_summary', (data) => {
  console.log('\n=== Meeting Summary ===');
  console.log(data.summary);
  console.log('=====================\n');
});

app.post('/webhook', (req, res) => {
  try {
    meetingAgent.processWebhookEvent(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Error processing webhook');
  }
});

app.post('/join-meeting', async (req, res) => {
  const { meetingUrl, botName } = req.body;

  if (!meetingUrl) {
    return res.status(400).json({ error: 'Meeting URL is required' });
  }

  try {
    const botId = await meetingAgent.joinMeeting(meetingUrl, botName);
    res.json({ 
      success: true, 
      botId,
      message: 'Bot successfully joined the meeting' 
    });
  } catch (error: any) {
    console.error('Failed to join meeting:', error);
    res.status(500).json({ 
      error: 'Failed to join meeting',
      details: error.message 
    });
  }
});

app.post('/leave-meeting/:botId', async (req, res) => {
  const { botId } = req.params;

  try {
    await meetingAgent.leaveMeeting(botId);
    res.json({ 
      success: true,
      message: 'Bot successfully left the meeting' 
    });
  } catch (error: any) {
    console.error('Failed to leave meeting:', error);
    res.status(500).json({ 
      error: 'Failed to leave meeting',
      details: error.message 
    });
  }
});

app.post('/send-message/:botId', async (req, res) => {
  const { botId } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    await meetingAgent.sendMessage(botId, message);
    res.json({ 
      success: true,
      message: 'Message sent successfully' 
    });
  } catch (error: any) {
    console.error('Failed to send message:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

app.post('/ask-question/:botId', async (req, res) => {
  const { botId } = req.params;
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const answer = await meetingAgent.askQuestion(botId, question);
    res.json({ 
      success: true,
      answer 
    });
  } catch (error: any) {
    console.error('Failed to process question:', error);
    res.status(500).json({ 
      error: 'Failed to process question',
      details: error.message 
    });
  }
});

app.get('/active-bots', (req, res) => {
  const bots = meetingAgent.getActiveBots();
  res.json({
    count: bots.length,
    bots: bots.map(bot => ({
      id: bot.id,
      meetingUrl: bot.meeting_url,
      status: bot.status,
      createdAt: bot.created_at
    }))
  });
});

app.get('/transcript/:botId', (req, res) => {
  const { botId } = req.params;
  const history = meetingAgent.getTranscriptionHistory(botId);
  
  res.json({
    botId,
    transcriptCount: history.length,
    transcript: history
  });
});

app.put('/update-persona', (req, res) => {
  const persona = req.body;
  
  if (!persona.name || !persona.role) {
    return res.status(400).json({ error: 'Name and role are required for persona' });
  }

  meetingAgent.updatePersona(persona);
  res.json({ 
    success: true,
    message: 'Persona updated successfully' 
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Meeting Agent Bot server running on port ${PORT}`);
  console.log(`Webhook URL: ${agentConfig.webhookUrl}`);
  console.log('\nAvailable endpoints:');
  console.log('  POST /join-meeting - Join a Google Meet');
  console.log('  POST /leave-meeting/:botId - Leave a meeting');
  console.log('  POST /send-message/:botId - Send a message to the meeting');
  console.log('  POST /ask-question/:botId - Ask a question about the meeting');
  console.log('  GET  /active-bots - List active bots');
  console.log('  GET  /transcript/:botId - Get meeting transcript');
  console.log('  PUT  /update-persona - Update bot persona');
  console.log('  GET  /health - Health check');
});