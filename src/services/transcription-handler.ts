import { EventEmitter } from 'events';

export interface TranscriptionSegment {
  speaker: string;
  text: string;
  timestamp: number;
  confidence?: number;
}

export interface WebhookPayload {
  event: string;
  bot_id: string;
  data: any;
}

export class TranscriptionHandler extends EventEmitter {
  private transcriptionBuffer: Map<string, TranscriptionSegment[]>;
  private speakerContext: Map<string, string>;

  constructor() {
    super();
    this.transcriptionBuffer = new Map();
    this.speakerContext = new Map();
  }

  processWebhookEvent(payload: WebhookPayload): void {
    const { event, bot_id, data } = payload;

    console.log(`Received webhook event: ${event} for bot ${bot_id}`);

    switch (event) {
      case 'bot.status_change':
        this.handleStatusChange(bot_id, data);
        break;

      case 'bot.join_call':
        console.log(`Bot ${bot_id} joined the call`);
        this.emit('meeting_joined', { botId: bot_id });
        break;

      case 'bot.leave_call':
        console.log(`Bot ${bot_id} left the call`);
        this.emit('meeting_left', { botId: bot_id });
        this.cleanupBot(bot_id);
        break;

      case 'bot.transcription.partial':
      case 'transcript.partial':
      case 'transcript.partial_data':
        this.handlePartialTranscript(bot_id, data);
        break;

      case 'bot.transcription.final':
      case 'transcript.final':
      case 'transcript.data':
        this.handleFinalTranscript(bot_id, data);
        break;

      case 'bot.participant_joined':
      case 'participant.joined':
        console.log(`Participant joined: ${data.name || data.participant_id}`);
        this.emit('participant_joined', { botId: bot_id, participant: data });
        break;

      case 'bot.participant_left':
      case 'participant.left':
        console.log(`Participant left: ${data.name || data.participant_id}`);
        this.emit('participant_left', { botId: bot_id, participant: data });
        break;

      default:
        console.log(`Unhandled event: ${event}`, JSON.stringify(data, null, 2));
    }
  }

  private handleStatusChange(botId: string, data: any): void {
    console.log(`Bot ${botId} status changed to: ${data.status?.code}`);

    if (data.status?.code === 'in_call_not_recording' || data.status?.code === 'in_call_recording') {
      this.emit('meeting_joined', { botId });
    } else if (data.status?.code === 'done' || data.status?.code === 'fatal') {
      this.emit('meeting_left', { botId });
      this.cleanupBot(botId);
    }
  }

  private handlePartialTranscript(botId: string, data: any): void {
    const text = this.extractTextFromData(data);
    if (!text) return;

    // Extract speaker name from various possible locations
    const speaker = data.speaker ||
                   data.speaker_id ||
                   data.participant?.name ||
                   data.participant?.id?.toString() ||
                   'Unknown';

    const segment: TranscriptionSegment = {
      speaker,
      text,
      timestamp: Date.now(),
      confidence: data.confidence
    };

    console.log(`Partial transcript [${segment.speaker}]: ${segment.text}`);
    this.emit('partial_transcript', { botId, segment });
  }

  private handleFinalTranscript(botId: string, data: any): void {
    const text = this.extractTextFromData(data);
    if (!text) return;

    // Extract speaker name from various possible locations
    const speaker = data.speaker ||
                   data.speaker_id ||
                   data.participant?.name ||
                   data.participant?.id?.toString() ||
                   'Unknown';

    const segment: TranscriptionSegment = {
      speaker,
      text,
      timestamp: Date.now(),
      confidence: data.confidence
    };

    console.log(`Final transcript [${segment.speaker}]: ${segment.text}`);

    if (!this.transcriptionBuffer.has(botId)) {
      this.transcriptionBuffer.set(botId, []);
    }

    this.transcriptionBuffer.get(botId)!.push(segment);

    this.updateSpeakerContext(segment.speaker, segment.text);

    this.emit('final_transcript', { botId, segment });

    this.checkForTriggerPhrases(botId, segment);
  }

  private extractTextFromData(data: any): string {
    // If text is directly provided
    if (data.text && typeof data.text === 'string') {
      return data.text.trim();
    }

    // If words array is provided (Recall.ai format)
    if (data.words && Array.isArray(data.words)) {
      return data.words
        .map((word: any) => word.text || word.word)
        .join(' ')
        .trim();
    }

    return '';
  }

  private updateSpeakerContext(speaker: string, text: string): void {
    const currentContext = this.speakerContext.get(speaker) || '';
    const updatedContext = `${currentContext} ${text}`.trim().slice(-500);
    this.speakerContext.set(speaker, updatedContext);
  }

  private checkForTriggerPhrases(botId: string, segment: TranscriptionSegment): void {
    const triggerPhrases = [
      'AIアシスタント',
      'アシスタント',
      'ボット',
      'AI',
      '質問があります',
      'ヘルプ'
    ];

    const lowerText = segment.text.toLowerCase();
    
    for (const trigger of triggerPhrases) {
      if (lowerText.includes(trigger.toLowerCase())) {
        this.emit('trigger_detected', {
          botId,
          segment,
          trigger,
          context: this.getSurroundingContext(botId)
        });
        break;
      }
    }
  }

  private getSurroundingContext(botId: string, windowSize: number = 5): string {
    const buffer = this.transcriptionBuffer.get(botId) || [];
    const recentSegments = buffer.slice(-windowSize);
    
    return recentSegments
      .map(seg => `${seg.speaker}: ${seg.text}`)
      .join('\n');
  }

  getTranscriptionHistory(botId: string): TranscriptionSegment[] {
    return this.transcriptionBuffer.get(botId) || [];
  }

  private cleanupBot(botId: string): void {
    this.transcriptionBuffer.delete(botId);
  }

  getSpeakerContext(speaker: string): string {
    return this.speakerContext.get(speaker) || '';
  }
}