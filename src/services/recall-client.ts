import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

export interface BotConfig {
  meetingUrl: string;
  botName?: string;
  transcriptionOptions?: {
    provider?: string;
    language?: string;
  };
  webhookUrl: string;
}

export interface Bot {
  id: string;
  meeting_url: string;
  status: string;
  created_at: string;
  updated_at: string;
  real_time_transcription?: {
    websocket_url?: string;
  };
}

export interface Transcript {
  speaker: string;
  words: Array<{
    text: string;
    start_time: number;
    end_time: number;
  }>;
  language: string;
}

export class RecallClient extends EventEmitter {
  private client: AxiosInstance;
  private apiKey: string;
  private webSockets: Map<string, WebSocket>;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.webSockets = new Map();
    this.client = axios.create({
      baseURL: 'https://us-west-2.recall.ai/api/v1',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createBot(config: BotConfig): Promise<Bot> {
    try {
      const requestData: any = {
        meeting_url: config.meetingUrl,
        bot_name: config.botName || 'AI Meeting Assistant',
        recording_config: {
          transcript: {
            provider: {
              recallai_streaming: {}
            }
          },
          realtime_endpoints: [
            {
              type: 'webhook',
              url: config.webhookUrl,
              events: ['transcript.data', 'transcript.partial_data']
            }
          ]
        }
      };

      console.log('Creating bot with recallai_streaming transcript provider');
      console.log('Webhook URL:', config.webhookUrl);
      console.log('Request data:', JSON.stringify(requestData, null, 2));

      const response = await this.client.post('/bot', requestData);

      console.log('Bot created successfully!');
      console.log('Bot ID:', response.data.id);
      console.log('Full response:', JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error: any) {
      console.error('Error creating bot:', error.response?.data || error.message);
      throw error;
    }
  }

  async getBot(botId: string): Promise<Bot> {
    try {
      const response = await this.client.get(`/bot/${botId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching bot:', error.response?.data || error.message);
      throw error;
    }
  }

  async deleteBot(botId: string): Promise<void> {
    try {
      await this.client.delete(`/bot/${botId}`);
    } catch (error: any) {
      console.error('Error deleting bot:', error.response?.data || error.message);
      throw error;
    }
  }

  async getTranscript(botId: string): Promise<Transcript[]> {
    try {
      const response = await this.client.get(`/bot/${botId}/transcript`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching transcript:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendChatMessage(botId: string, message: string): Promise<void> {
    try {
      await this.client.post(`/bot/${botId}/send_chat_message`, {
        message: message
      });
    } catch (error: any) {
      console.error('Error sending chat message:', error.response?.data || error.message);
      throw error;
    }
  }

  async connectToStream(botId: string): Promise<void> {
    try {
      // Get bot info to retrieve WebSocket URL
      const bot = await this.getBot(botId);
      const wsUrl = bot.real_time_transcription?.websocket_url;

      if (!wsUrl) {
        console.error('No WebSocket URL available for bot:', botId);
        throw new Error('WebSocket URL not available. Bot may not be ready yet.');
      }

      console.log(`Connecting to streaming endpoint for bot ${botId}:`, wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        console.log(`WebSocket connected for bot ${botId}`);
        this.emit('stream_connected', { botId });
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`Received streaming data for bot ${botId}:`, message);
          this.emit('stream_data', { botId, data: message });
        } catch (error: any) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for bot ${botId}:`, error);
        this.emit('stream_error', { botId, error });
      });

      ws.on('close', () => {
        console.log(`WebSocket closed for bot ${botId}`);
        this.webSockets.delete(botId);
        this.emit('stream_disconnected', { botId });
      });

      this.webSockets.set(botId, ws);
    } catch (error: any) {
      console.error('Error connecting to stream:', error.response?.data || error.message);
      throw error;
    }
  }

  disconnectFromStream(botId: string): void {
    const ws = this.webSockets.get(botId);
    if (ws) {
      ws.close();
      this.webSockets.delete(botId);
      console.log(`Disconnected from stream for bot ${botId}`);
    }
  }

  isStreamConnected(botId: string): boolean {
    const ws = this.webSockets.get(botId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }
}