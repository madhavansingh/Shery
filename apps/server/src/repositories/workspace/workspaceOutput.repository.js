class WorkspaceOutputRepository {
  constructor(dbProvider) {
    this.dbProvider = dbProvider;
  }

  collection(workspaceId) {
    return this.dbProvider().collection('workspaces').doc(workspaceId).collection('outputs');
  }

  async create(workspaceId, data) {
    const now = new Date().toISOString();
    const ref = this.collection(workspaceId).doc();
    const outputData = {
      ...data,
      status: 'generating',
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(outputData);
    return { id: ref.id, ...outputData };
  }

  async findByWorkspace(workspaceId) {
    const snapshot = await this.collection(workspaceId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async findById(workspaceId, outputId) {
    const doc = await this.collection(workspaceId).doc(outputId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async update(workspaceId, outputId, data) {
    const updateData = { ...data, updatedAt: new Date().toISOString() };
    await this.collection(workspaceId).doc(outputId).update(updateData);
    return this.findById(workspaceId, outputId);
  }

  async delete(workspaceId, outputId) {
    await this.collection(workspaceId).doc(outputId).delete();
    return true;
  }
}

export default WorkspaceOutputRepository;
