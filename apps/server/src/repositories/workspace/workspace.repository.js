class WorkspaceRepository {
  constructor(dbProvider) {
    this.dbProvider = dbProvider;
  }

  collection() {
    return this.dbProvider().collection('workspaces');
  }

  async create({ name, emoji, userId }) {
    const now = new Date().toISOString();
    const ref = this.collection().doc();
    const data = {
      name,
      emoji,
      userId,
      sourceCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(data);
    return { id: ref.id, ...data };
  }

  async findById(id) {
    const doc = await this.collection().doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async findByUser(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .get();

    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return list.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }

  async update(id, data) {
    const updateData = { ...data, updatedAt: new Date().toISOString() };
    await this.collection().doc(id).update(updateData);
    return this.findById(id);
  }

  async delete(id) {
    await this.collection().doc(id).delete();
    return true;
  }

  async countByUser(userId) {
    const snapshot = await this.collection()
      .where('userId', '==', userId)
      .get();

    return snapshot.size;
  }
}

export default WorkspaceRepository;
