import { FieldValue } from 'firebase-admin/firestore';

class WorkspaceChatRepository {
  constructor(dbProvider) {
    this.dbProvider = dbProvider;
  }

  collection(workspaceId) {
    return this.dbProvider().collection('workspaces').doc(workspaceId).collection('chats');
  }

  async create(workspaceId, { mode, title }) {
    const now = new Date().toISOString();
    const ref = this.collection(workspaceId).doc();
    const data = {
      mode,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(data);
    return { id: ref.id, ...data };
  }

  async findById(workspaceId, chatId) {
    const doc = await this.collection(workspaceId).doc(chatId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async findByWorkspace(workspaceId) {
    const snapshot = await this.collection(workspaceId)
      .orderBy('updatedAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async appendMessage(workspaceId, chatId, message) {
    const ref = this.collection(workspaceId).doc(chatId);
    await ref.update({
      messages: FieldValue.arrayUnion(message),
      updatedAt: new Date().toISOString(),
    });

    // Read back and cap at 40 messages
    const doc = await ref.get();
    const messages = doc.data()?.messages || [];
    if (messages.length > 40) {
      await ref.update({ messages: messages.slice(-40) });
    }
  }

  async delete(workspaceId, chatId) {
    await this.collection(workspaceId).doc(chatId).delete();
    return true;
  }
}

export default WorkspaceChatRepository;
