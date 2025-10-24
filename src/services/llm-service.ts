import OpenAI from 'openai';

export interface ResponseContext {
  transcriptHistory: string;
  currentSpeaker: string;
  triggerPhrase: string;
  meetingContext?: string;
}

export interface AgentPersona {
  name: string;
  role: string;
  personality: string;
  knowledgeBase?: string;
}

export class LLMService {
  private openai: OpenAI;
  private persona: AgentPersona;
  private conversationHistory: Array<{ role: string; content: string }>;

  constructor(apiKey: string, persona?: AgentPersona) {
    this.openai = new OpenAI({ apiKey });
    this.persona = persona || this.getDefaultPersona();
    this.conversationHistory = [];
  }

  private getDefaultPersona(): AgentPersona {
    return {
      name: 'AI Meeting Assistant',
      role: 'Meeting facilitator and note-taker',
      personality: 'Professional, helpful, and concise. Focuses on clarity and action items.',
      knowledgeBase: 'General business knowledge with emphasis on meeting efficiency and collaboration.'
    };
  }

  async generateResponse(context: ResponseContext): Promise<string> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(context);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory.slice(-10) as any,
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const response = completion.choices[0].message.content || '';
      
      this.conversationHistory.push({ role: 'user', content: userPrompt });
      this.conversationHistory.push({ role: 'assistant', content: response });

      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      return 'I apologize, but I\'m having trouble processing that request at the moment.';
    }
  }

  private buildSystemPrompt(): string {
    return `You are ${this.persona.name}, a ${this.persona.role}.
Personality: ${this.persona.personality}
Knowledge: ${this.persona.knowledgeBase}

You are participating in a meeting through a bot. Your responsibilities include:
1. Answering questions when addressed directly
2. Providing summaries when requested
3. Identifying and highlighting action items
4. Facilitating discussion when appropriate
5. Taking notes on important points

Guidelines:
- Be concise and professional
- Focus on being helpful without being intrusive
- Only respond when directly addressed or when critical information needs to be shared
- Use Japanese when the conversation is in Japanese
- Keep responses under 100 words unless specifically asked for more detail`;
  }

  private buildUserPrompt(context: ResponseContext): string {
    return `Recent conversation context:
${context.transcriptHistory}

Current speaker: ${context.currentSpeaker}
They mentioned: "${context.triggerPhrase}"

${context.meetingContext ? `Additional meeting context: ${context.meetingContext}` : ''}

Provide an appropriate response based on what was said. If a question was asked, answer it. If action items were mentioned, acknowledge them. Be helpful but concise.`;
  }

  async generateMeetingSummary(transcriptHistory: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating concise meeting summaries. Extract key points, decisions, and action items.'
          },
          {
            role: 'user',
            content: `Please create a structured summary of the following meeting transcript:

${transcriptHistory}

Format the summary with:
1. Key Discussion Points
2. Decisions Made
3. Action Items (with owners if mentioned)
4. Next Steps`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Unable to generate meeting summary at this time.';
    }
  }

  async detectActionItems(transcript: string): Promise<string[]> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Extract action items from meeting transcripts. Return only the action items as a JSON array of strings.'
          },
          {
            role: 'user',
            content: `Extract action items from: ${transcript}`
          }
        ],
        temperature: 0.2,
        max_tokens: 200
      });

      const response = completion.choices[0].message.content || '[]';
      return JSON.parse(response);
    } catch (error) {
      console.error('Error detecting action items:', error);
      return [];
    }
  }

  updatePersona(persona: AgentPersona): void {
    this.persona = persona;
    this.conversationHistory = [];
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}