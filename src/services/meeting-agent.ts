import { EventEmitter } from 'events';
import { RecallClient, Bot } from './recall-client';
import { TranscriptionHandler } from './transcription-handler';
import { LLMService, AgentPersona } from './llm-service';

export interface MeetingAgentConfig {
  recallApiKey: string;
  openaiApiKey: string;
  webhookUrl: string;
  persona?: AgentPersona;
  autoRespond?: boolean;
  summaryInterval?: number;
}

export class MeetingAgent extends EventEmitter {
  private recallClient: RecallClient;
  private transcriptionHandler: TranscriptionHandler;
  private llmService: LLMService;
  private activeBots: Map<string, Bot>;
  private config: MeetingAgentConfig;
  private summaryTimers: Map<string, NodeJS.Timeout>;

  constructor(config: MeetingAgentConfig) {
    super();
    this.config = config;
    this.recallClient = new RecallClient(config.recallApiKey);
    this.transcriptionHandler = new TranscriptionHandler();
    this.llmService = new LLMService(config.openaiApiKey, config.persona);
    this.activeBots = new Map();
    this.summaryTimers = new Map();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Transcription handler events
    this.transcriptionHandler.on('trigger_detected', async (event) => {
      if (this.config.autoRespond !== false) {
        await this.handleTriggerDetected(event);
      }
    });

    this.transcriptionHandler.on('meeting_joined', (event) => {
      console.log(`Agent joined meeting: ${event.botId}`);
      this.startSummaryTimer(event.botId);
    });

    this.transcriptionHandler.on('meeting_left', (event) => {
      console.log(`Agent left meeting: ${event.botId}`);
      this.stopSummaryTimer(event.botId);
      this.generateFinalSummary(event.botId);
    });

    this.transcriptionHandler.on('final_transcript', async (event) => {
      this.emit('transcript', {
        botId: event.botId,
        speaker: event.segment.speaker,
        text: event.segment.text,
        timestamp: event.segment.timestamp
      });

      // Echo transcript to meeting chat
      try {
        const message = `[${event.segment.speaker}]: ${event.segment.text}`;
        await this.sendMessage(event.botId, message);
        console.log(`Echoed to chat: ${message}`);
      } catch (error) {
        console.error('Failed to echo transcript to chat:', error);
      }
    });

  }

  async joinMeeting(meetingUrl: string, botName?: string): Promise<string> {
    try {
      const bot = await this.recallClient.createBot({
        meetingUrl,
        botName: botName || this.config.persona?.name || 'AI Assistant',
        transcriptionOptions: {
          language: 'ja'
        },
        webhookUrl: this.config.webhookUrl
      });

      this.activeBots.set(bot.id, bot);
      console.log(`Bot created with ID: ${bot.id}`);
      console.log(`Transcripts will be received via webhook: ${this.config.webhookUrl}`);

      return bot.id;
    } catch (error) {
      console.error('Failed to join meeting:', error);
      throw error;
    }
  }

  async leaveMeeting(botId: string): Promise<void> {
    try {
      await this.recallClient.deleteBot(botId);
      this.activeBots.delete(botId);
      this.stopSummaryTimer(botId);
    } catch (error) {
      console.error('Failed to leave meeting:', error);
      throw error;
    }
  }

  processWebhookEvent(payload: any): void {
    this.transcriptionHandler.processWebhookEvent(payload);
  }

  private async handleTriggerDetected(event: any): Promise<void> {
    const { botId, segment, context } = event;
    
    console.log(`Trigger detected in bot ${botId}: ${segment.text}`);

    const response = await this.llmService.generateResponse({
      transcriptHistory: context,
      currentSpeaker: segment.speaker,
      triggerPhrase: segment.text
    });

    if (response && response.trim()) {
      await this.sendMessage(botId, response);
    }
  }

  async sendMessage(botId: string, message: string): Promise<void> {
    try {
      await this.recallClient.sendChatMessage(botId, message);
      this.emit('message_sent', { botId, message });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  }

  private startSummaryTimer(botId: string): void {
    if (this.config.summaryInterval && this.config.summaryInterval > 0) {
      const timer = setInterval(async () => {
        await this.generatePeriodicSummary(botId);
      }, this.config.summaryInterval * 60 * 1000);

      this.summaryTimers.set(botId, timer);
    }
  }

  private stopSummaryTimer(botId: string): void {
    const timer = this.summaryTimers.get(botId);
    if (timer) {
      clearInterval(timer);
      this.summaryTimers.delete(botId);
    }
  }

  private async generatePeriodicSummary(botId: string): Promise<void> {
    const history = this.transcriptionHandler.getTranscriptionHistory(botId);
    if (history.length === 0) return;

    const transcript = history
      .map(seg => `${seg.speaker}: ${seg.text}`)
      .join('\n');

    const actionItems = await this.llmService.detectActionItems(transcript);
    
    if (actionItems.length > 0) {
      const message = `📝 Action items detected:\n${actionItems.map(item => `• ${item}`).join('\n')}`;
      await this.sendMessage(botId, message);
    }
  }

  private async generateFinalSummary(botId: string): Promise<void> {
    const history = this.transcriptionHandler.getTranscriptionHistory(botId);
    if (history.length === 0) return;

    const transcript = history
      .map(seg => `${seg.speaker}: ${seg.text}`)
      .join('\n');

    const summary = await this.llmService.generateMeetingSummary(transcript);
    
    this.emit('meeting_summary', {
      botId,
      summary,
      transcript
    });
  }

  async askQuestion(botId: string, question: string): Promise<string> {
    const history = this.transcriptionHandler.getTranscriptionHistory(botId);
    const context = history
      .slice(-10)
      .map(seg => `${seg.speaker}: ${seg.text}`)
      .join('\n');

    const response = await this.llmService.generateResponse({
      transcriptHistory: context,
      currentSpeaker: 'User',
      triggerPhrase: question
    });

    return response;
  }

  getActiveBots(): Bot[] {
    return Array.from(this.activeBots.values());
  }

  getTranscriptionHistory(botId: string) {
    return this.transcriptionHandler.getTranscriptionHistory(botId);
  }

  updatePersona(persona: AgentPersona): void {
    this.llmService.updatePersona(persona);
  }
}