import LessonContract from '../contracts/lesson.contract.js';

class LessonRepository extends LessonContract {
  constructor(dbProvider) {
    super();
    this.dbProvider = dbProvider;
  }

  collection() {
    return this.dbProvider().collection('lessons');
  }

  async create(data) {
    await this.collection().doc(data.lessonId).set(data);
    return data;
  }

  async findById(lessonId) {
    const doc = await this.collection().doc(lessonId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async findAllByCourseId(courseId) {
    const snapshot = await this.collection()
      .where('courseId', '==', courseId)
      .get();

    const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return list.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  }

  async updateById(lessonId, data) {
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await this.collection().doc(lessonId).update(updateData);
    return this.findById(lessonId);
  }

  async deleteById(lessonId) {
    await this.collection().doc(lessonId).delete();
    return true;
  }
}

export default LessonRepository;
