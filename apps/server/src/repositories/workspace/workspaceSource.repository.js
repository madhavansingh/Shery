class WorkspaceSourceRepository {
  constructor(dbProvider) {
    this.dbProvider = dbProvider;
  }

  collection(workspaceId) {
    return this.dbProvider().collection('workspaces').doc(workspaceId).collection('sources');
  }

  async create(workspaceId, data, sourceId = null) {
    const now = new Date().toISOString();
    const ref = sourceId ? this.collection(workspaceId).doc(sourceId) : this.collection(workspaceId).doc();
    const sourceData = {
      ...data,
      status: 'pending',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(sourceData);
    return { id: ref.id, ...sourceData };
  }

  async findById(workspaceId, sourceId) {
    const doc = await this.collection(workspaceId).doc(sourceId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async findByWorkspace(workspaceId) {
    const snapshot = await this.collection(workspaceId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async update(workspaceId, sourceId, data) {
    const updateData = { ...data, updatedAt: new Date().toISOString() };
    await this.collection(workspaceId).doc(sourceId).update(updateData);
    return this.findById(workspaceId, sourceId);
  }

  async delete(workspaceId, sourceId) {
    await this.collection(workspaceId).doc(sourceId).delete();
    return true;
  }

  async countByWorkspace(workspaceId) {
    const snapshot = await this.collection(workspaceId).get();
    return snapshot.size;
  }

  async findByStatus(workspaceId, status) {
    const snapshot = await this.collection(workspaceId)
      .where('status', '==', status)
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}

export default WorkspaceSourceRepository;
