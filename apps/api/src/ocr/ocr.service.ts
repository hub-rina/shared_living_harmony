import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker } from 'tesseract.js';

// Self-hosted receipt OCR. The image never leaves our server: Tesseract runs
// in-process. A single worker is created lazily and reused across requests
// (creating one per scan is slow). OCR only ever produces a rough draft the
// resident corrects, so any failure degrades gracefully to empty text and the
// form falls back to manual entry.
@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private workerPromise?: Promise<Worker>;

  async read(buffer: Buffer): Promise<string> {
    try {
      const worker = await this.worker();
      const { data } = await worker.recognize(buffer);
      return data.text ?? '';
    } catch (error) {
      this.logger.warn(`OCR failed, falling back to manual entry: ${String(error)}`);
      return '';
    }
  }

  private worker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker('eng');
    }
    return this.workerPromise;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.workerPromise) return;
    const worker = await this.workerPromise.catch(() => null);
    await worker?.terminate();
  }
}
