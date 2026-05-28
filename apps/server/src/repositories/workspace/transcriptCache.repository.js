class TranscriptCacheRepository {
  constructor(dbProvider) {
    this.dbProvider = dbProvider;
  }

  collection() {
    return this.dbProvider().collection('transcriptCache');
  }

  async findByContentHash(hash) {
    const doc = await this.collection().doc(hash).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async save(hash, data) {
    const cacheData = {
      ...data,
      createdAt: new Date().toISOString(),
    };
    await this.collection().doc(hash).set(cacheData);
    return { id: hash, ...cacheData };
  }

  async findByYoutubeId(videoId) {
    const snapshot = await this.collection()
      .where('youtubeId', '==', videoId)
      .limit(1)
      .get();

    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }
}

export default TranscriptCacheRepository;
