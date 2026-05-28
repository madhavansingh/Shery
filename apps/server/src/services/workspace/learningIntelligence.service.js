import logger from '../../loggers/logger.js';

class LearningIntelligenceService {
  constructor({
    sourceGraphService,
    workspaceChatRepository,
    workspaceMemoryRepository,
  }) {
    this.sourceGraphService = sourceGraphService;
    this.chatRepo = workspaceChatRepository;
    this.memoryRepo = workspaceMemoryRepository;
  }

  /**
   * Evaluates learning performance and estimated concept mastery
   * @param {string} workspaceId 
   * @returns {Promise<Object>} Mastery report
   */
  async getLearningIntelligence(workspaceId) {
    const startMs = Date.now();

    // 1. Fetch graph details (for total concept clusters & mappings)
    const graph = await this.sourceGraphService.buildGraph(workspaceId);
    const clusters = graph.clusters || [];
    const relationships = graph.relationships || [];
    
    // 2. Fetch memory doc
    const memory = await this.memoryRepo.getOrCreate(workspaceId);
    const revisionHistory = memory.revisionHistory || [];
    const frequentConcepts = memory.frequentConcepts || [];

    // 3. Fetch chat history to extract queries and active discussions
    const chats = await this.chatRepo.findByWorkspace(workspaceId);
    const chatQueries = [];
    chats.forEach(c => {
      const messages = c.messages || [];
      messages.forEach(m => {
        if (m.role === 'user') chatQueries.push(m.content.toLowerCase());
      });
    });

    // 4. Estimate Concept Mastery percentages
    // Mastered = frequent concepts that have been referenced in questions & reviewed multiple times with positive feedback
    const estimatedMastery = clusters.map(cluster => {
      const clusterConcepts = new Set(cluster.concepts.map(c => c.toLowerCase()));
      
      // Calculate focus level (how much has user queried this cluster?)
      let queryHits = 0;
      chatQueries.forEach(query => {
        clusterConcepts.forEach(concept => {
          if (query.includes(concept)) queryHits++;
        });
      });

      // Calculate memory revision score
      let revisionScore = 0;
      revisionHistory.forEach(rev => {
        if (clusterConcepts.has(rev.topic?.toLowerCase())) {
          // revision rating between 1-5 maps to percentage weight
          revisionScore += (rev.confidence || 3) / 5;
        }
      });

      // Simple mastery estimation algorithm
      const frequencyWeight = frequentConcepts.find(f => clusterConcepts.has(f.term?.toLowerCase()))?.count || 0;
      
      const score = Math.min(
        100,
        Math.round(((queryHits * 15) + (revisionScore * 25) + (frequencyWeight * 10) + 15))
      );

      return {
        clusterName: cluster.name,
        masteryLevel: score,
        status: score > 75 ? 'Mastered' : score > 40 ? 'Learning' : 'Unexplored',
        concepts: cluster.concepts,
        queryHits,
      };
    });

    // 5. Detect Prerequisite Gaps
    // If a user queries advanced topics (e.g., 'embeddings', 'vector-stores') but has never uploaded or queried basic chapters ('indexing', 'tokens')
    const prerequisiteGaps = [];
    const advancedClusters = estimatedMastery.filter(e => e.queryHits > 0 && this._isAdvancedTopic(e.clusterName));
    
    for (const adv of advancedClusters) {
      const basicPrereqs = this._getPrerequisitesFor(adv.clusterName);
      for (const basic of basicPrereqs) {
        const basicStatus = estimatedMastery.find(e => e.clusterName.toLowerCase() === basic.toLowerCase());
        if (!basicStatus || basicStatus.masteryLevel < 35) {
          prerequisiteGaps.push({
            topic: adv.clusterName,
            missingPrerequisite: basic,
            impact: 'High',
            recommendation: `Upload introductory concepts or read chapters covering "${basic}" to better understand the foundations of "${adv.clusterName}".`
          });
        }
      }
    }

    // 6. Generate Adaptive Tutoring Suggestions
    const suggestions = [];
    if (estimatedMastery.length === 0) {
      suggestions.push({
        type: 'get_started',
        text: 'Welcome to your smart workspace! Upload course transcripts, PDFs or technical docs to start mapping your concept graph.',
        action: 'Upload Sources'
      });
    } else {
      // Find weakest explored topic
      const learningTopics = estimatedMastery.filter(e => e.status === 'Learning');
      if (learningTopics.length > 0) {
        const weakest = learningTopics.sort((a, b) => a.masteryLevel - b.masteryLevel)[0];
        suggestions.push({
          type: 'weak_topic',
          text: `You have been exploring "${weakest.clusterName}" (Mastery: ${weakest.masteryLevel}%), but your active source grounding remains weak. Would you like a grounded overview?`,
          action: `Study ${weakest.clusterName}`,
          topic: weakest.clusterName
        });
      }

      // Check unexplored topics
      const unexplored = estimatedMastery.filter(e => e.status === 'Unexplored');
      if (unexplored.length > 0) {
        suggestions.push({
          type: 'expansion',
          text: `You have highly reliable material covering "${unexplored[0].clusterName}", but you have not active discussed these concepts. Ready to connect them to what you know?`,
          action: `Examine ${unexplored[0].clusterName}`,
          topic: unexplored[0].clusterName
        });
      }
    }

    logger.info('Learning intelligence profiling complete', {
      workspaceId,
      masteryMapped: estimatedMastery.length,
      gapsFound: prerequisiteGaps.length,
      durationMs: Date.now() - startMs
    });

    return {
      mastery: estimatedMastery.sort((a, b) => b.masteryLevel - a.masteryLevel),
      gaps: prerequisiteGaps,
      suggestions,
      metrics: {
        conceptsMastered: estimatedMastery.filter(e => e.status === 'Mastered').length,
        conceptsLearning: estimatedMastery.filter(e => e.status === 'Learning').length,
        conceptsUnexplored: estimatedMastery.filter(e => e.status === 'Unexplored').length,
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Private helper utilities
  // ---------------------------------------------------------------------------

  _isAdvancedTopic(topic) {
    const adv = ['embedding', 'vector', 'agent', 'rag', 'chain', 'retrieval', 'llm', 'inference', 'optimization', 'architecture'];
    return adv.some(term => topic.toLowerCase().includes(term));
  }

  _getPrerequisitesFor(topic) {
    const t = topic.toLowerCase();
    const map = {
      'embedding': ['tokens', 'text analysis', 'vectors'],
      'vector': ['similarity', 'coordinates', 'indexing'],
      'rag': ['embedding', 'retrieval', 'prompts'],
      'agent': ['rag', 'chaining', 'memory', 'planning'],
      'chain': ['prompts', 'llm settings'],
      'retrieval': ['similarity', 'search indexes', 'grounding']
    };

    for (const key of Object.keys(map)) {
      if (t.includes(key)) return map[key];
    }
    return [];
  }
}

export default LearningIntelligenceService;
