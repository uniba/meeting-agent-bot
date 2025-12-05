import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

export interface BotConfig {
  meetingUrl: string;
  botName?: string;
  transcriptionOptions?: {
    provider?: string;
    language?: string;
  };
  webhookUrl: string;
  outputMediaUrl?: string;
}

export interface Bot {
  id: string;
  meeting_url: string;
  status: string;
  created_at: string;
  updated_at: string;
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

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
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
              // meeting_captions: {
              //   language_code: "ja"
              // }
              recallai_streaming: {
                mode: 'prioritize_low_latency',
                language_code: 'en',
              }
            }
          },
          realtime_endpoints: [
            {
              type: 'webhook',
              url: config.webhookUrl,
              events: ['transcript.data']
            }
          ]
        }
      };

      // Add output_media if URL is provided
      if (config.outputMediaUrl) {
        requestData.output_media = {
          camera: {
            kind: 'webpage',
            config: {
              url: config.outputMediaUrl
            }
          }
        };
      }

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
}