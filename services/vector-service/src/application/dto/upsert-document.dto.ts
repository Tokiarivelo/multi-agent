import { IsString, IsObject, IsArray, IsOptional, IsNumber } from 'class-validator';

export class UpsertDocumentDto {
  @IsString()
  collectionId!: string;

  @IsString()
  @IsOptional()
  documentId?: string;

  @IsString()
  content!: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  embedding?: number[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpsertDocumentsDto {
  @IsString()
  collectionId!: string;

  @IsArray()
  documents!: Array<{
    documentId?: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, any>;
  }>;
}
