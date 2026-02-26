export class Document {
  constructor(
    public readonly id: string,
    public readonly collectionId: string,
    public readonly content: string,
    public readonly metadata: Record<string, any>,
    public readonly embedding: number[],
    public readonly createdAt: Date,
  ) {}

  public static create(
    collectionId: string,
    content: string,
    embedding: number[],
    metadata: Record<string, any> = {},
  ): Document {
    return new Document(
      '', // ID will be generated
      collectionId,
      content,
      metadata,
      embedding,
      new Date(),
    );
  }

  public toQdrantPoint(pointId: string): {
    id: string;
    vector: number[];
    payload: Record<string, any>;
  } {
    return {
      id: pointId,
      vector: this.embedding,
      payload: {
        content: this.content,
        collectionId: this.collectionId,
        metadata: this.metadata,
        createdAt: this.createdAt.toISOString(),
      },
    };
  }
}
