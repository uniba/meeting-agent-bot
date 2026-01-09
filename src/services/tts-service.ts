import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

export class TTSService {
  private openai: OpenAI;
  private audioDir: string;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.audioDir = path.join(__dirname, '../../public/audio');

    // Ensure audio directory exists
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }
  }

  /**
   * Detect if text is Japanese
   */
  private isJapanese(text: string): boolean {
    return /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(text);
  }

  /**
   * Generate speech audio file from text using OpenAI TTS
   * @param text Text to convert to speech
   * @param audioId Unique identifier for this audio file
   * @returns Path to the generated audio file (relative to public/)
   */
  async generateSpeech(text: string, audioId: string): Promise<string> {
    try {
      // Use OpenAI's TTS API
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
      });

      // Get the audio data as a buffer
      const buffer = Buffer.from(await mp3.arrayBuffer());

      // Write the audio content to a file
      const filename = `${audioId}.mp3`;
      const filepath = path.join(this.audioDir, filename);

      fs.writeFileSync(filepath, buffer);

      console.log(`Audio content written to file: ${filename}`);

      // Return the relative path for serving
      return `/audio/${filename}`;
    } catch (error) {
      console.error('Error generating speech:', error);
      throw error;
    }
  }

  /**
   * Delete an audio file
   */
  async deleteAudio(audioId: string): Promise<void> {
    const filename = `${audioId}.mp3`;
    const filepath = path.join(this.audioDir, filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`Deleted audio file: ${filename}`);
    }
  }

  /**
   * Clean up old audio files (older than 1 hour)
   */
  async cleanupOldAudioFiles(): Promise<void> {
    const files = fs.readdirSync(this.audioDir);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const file of files) {
      const filepath = path.join(this.audioDir, file);
      const stats = fs.statSync(filepath);

      if (now - stats.mtimeMs > oneHour) {
        fs.unlinkSync(filepath);
        console.log(`Cleaned up old audio file: ${file}`);
      }
    }
  }
}
