import logger from '../../loggers/logger.js';

class SourceGraphService {
  constructor({ workspaceSourceRepository, vectorSearchService }) {
    this.sourceRepo = workspaceSourceRepository;
    this.vectorSearch = vectorSearchService;
  }

  async buildGraph(workspaceId) {
    const sources = await this.sourceRepo.findByWorkspace(workspaceId);
    const readySources = sources.filter((s) => s.status === 'ready');

    if (readySources.length < 1) {
      return { clusters: [], relationships: [], coverage: {}, overlapping: [] };
    }

    // Extract concept tags from all sources
    const sourceConceptMap = new Map();
    const allConcepts = new Map();

    for (const source of readySources) {
      const concepts = this.extractSourceConcepts(source);
      sourceConceptMap.set(source.id, { source, concepts });

      for (const concept of concepts) {
        if (!allConcepts.has(concept)) {
          allConcepts.set(concept, []);
        }
        allConcepts.get(concept).push(source.id);
      }
    }

    // Build concept clusters
    const clusters = this.buildConceptClusters(allConcepts, sourceConceptMap);

    // Calculate pairwise source relationships
    const relationships = this.calculateSourceRelationships(sourceConceptMap);

    // Knowledge coverage metrics
    const coverage = this.calculateCoverage(allConcepts, sourceConceptMap);

    // Overlapping concepts (appear in multiple sources)
    const overlapping = this.findOverlappingConcepts(allConcepts);

    logger.info('Source graph built', {
      workspaceId,
      sources: readySources.length,
      concepts: allConcepts.size,
      clusters: clusters.length,
      relationships: relationships.length,
    });

    return { clusters, relationships, coverage, overlapping };
  }

  extractSourceConcepts(source) {
    const concepts = new Set();

    // From topic segments
    if (source.topicSegments?.length) {
      for (const segment of source.topicSegments) {
        if (segment.keywords?.length) {
          for (const kw of segment.keywords) {
            concepts.add(kw.toLowerCase().trim());
          }
        }
        // Extract key nouns from segment title
        const titleWords = (segment.title || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 3);
        for (const word of titleWords) {
          concepts.add(word);
        }
      }
    }

    // From source title
    const titleConcepts = (source.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4);
    for (const word of titleConcepts) {
      concepts.add(word);
    }

    return Array.from(concepts);
  }

  buildConceptClusters(allConcepts, sourceConceptMap) {
    // Group concepts that frequently co-occur in the same sources
    const clusters = [];
    const assigned = new Set();

    const conceptEntries = Array.from(allConcepts.entries())
      .sort((a, b) => b[1].length - a[1].length);

    for (const [concept, sourceIds] of conceptEntries) {
      if (assigned.has(concept)) continue;

      const cluster = {
        name: concept,
        concepts: [concept],
        sourceIds: [...new Set(sourceIds)],
        size: sourceIds.length,
      };

      assigned.add(concept);

      // Find related concepts (appear in same sources)
      for (const [otherConcept, otherSourceIds] of conceptEntries) {
        if (assigned.has(otherConcept)) continue;

        const overlap = sourceIds.filter((id) => otherSourceIds.includes(id));
        if (overlap.length >= Math.min(sourceIds.length, otherSourceIds.length) * 0.5) {
          cluster.concepts.push(otherConcept);
          cluster.sourceIds = [...new Set([...cluster.sourceIds, ...otherSourceIds])];
          assigned.add(otherConcept);
        }

        if (cluster.concepts.length >= 8) break;
      }

      if (cluster.concepts.length >= 2 || cluster.size >= 2) {
        clusters.push(cluster);
      }
    }

    return clusters.slice(0, 15);
  }

  calculateSourceRelationships(sourceConceptMap) {
    const relationships = [];
    const sourceIds = Array.from(sourceConceptMap.keys());

    for (let i = 0; i < sourceIds.length; i++) {
      for (let j = i + 1; j < sourceIds.length; j++) {
        const a = sourceConceptMap.get(sourceIds[i]);
        const b = sourceConceptMap.get(sourceIds[j]);

        const setA = new Set(a.concepts);
        const setB = new Set(b.concepts);

        let intersection = 0;
        for (const concept of setA) {
          if (setB.has(concept)) intersection++;
        }

        const union = new Set([...a.concepts, ...b.concepts]).size;
        const similarity = union > 0 ? intersection / union : 0;

        if (similarity > 0.05) {
          relationships.push({
            sourceA: { id: sourceIds[i], title: a.source.title },
            sourceB: { id: sourceIds[j], title: b.source.title },
            similarity: Math.round(similarity * 100) / 100,
            sharedConcepts: a.concepts.filter((c) => setB.has(c)),
          });
        }
      }
    }

    return relationships.sort((a, b) => b.similarity - a.similarity);
  }

  calculateCoverage(allConcepts, sourceConceptMap) {
    const totalConcepts = allConcepts.size;
    const totalSources = sourceConceptMap.size;

    // Topic areas with coverage
    const topicAreas = {};
    for (const [concept, sourceIds] of allConcepts) {
      const coverage = sourceIds.length / totalSources;
      topicAreas[concept] = {
        concept,
        sourceCount: sourceIds.length,
        coverage: Math.round(coverage * 100),
      };
    }

    // Overall metrics
    const avgConceptsPerSource = totalSources > 0
      ? Math.round(
        Array.from(sourceConceptMap.values())
          .reduce((sum, s) => sum + s.concepts.length, 0) / totalSources,
      )
      : 0;

    return {
      totalConcepts,
      totalSources,
      avgConceptsPerSource,
      topicAreas: Object.values(topicAreas)
        .sort((a, b) => b.sourceCount - a.sourceCount)
        .slice(0, 20),
    };
  }

  findOverlappingConcepts(allConcepts) {
    return Array.from(allConcepts.entries())
      .filter(([, sourceIds]) => sourceIds.length >= 2)
      .map(([concept, sourceIds]) => ({
        concept,
        sourceCount: sourceIds.length,
        sourceIds,
      }))
      .sort((a, b) => b.sourceCount - a.sourceCount)
      .slice(0, 20);
  }

  async getConceptClusters(workspaceId) {
    const graph = await this.buildGraph(workspaceId);
    return graph.clusters;
  }

  async getSourceRelationships(workspaceId) {
    const graph = await this.buildGraph(workspaceId);
    return graph.relationships;
  }

  async getKnowledgeCoverage(workspaceId) {
    const graph = await this.buildGraph(workspaceId);
    return graph.coverage;
  }
}

export default SourceGraphService;
