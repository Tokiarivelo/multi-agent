import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService as CommonEncryptionService } from '@multi-agent/common';

@Injectable()
export class EncryptionService {
  private readonly encryptionService: CommonEncryptionService;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('ENCRYPTION_SECRET');
    if (!secret || secret.length < 32) {
      throw new Error('ENCRYPTION_SECRET must be at least 32 characters long');
    }
    this.encryptionService = new CommonEncryptionService(secret);
  }

  encrypt(text: string): string {
    return this.encryptionService.encrypt(text);
  }

  decrypt(encryptedText: string): string {
    return this.encryptionService.decrypt(encryptedText);
  }
}
