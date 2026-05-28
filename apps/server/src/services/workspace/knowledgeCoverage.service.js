import logger from '../../loggers/logger.js';

class KnowledgeCoverageService {
  constructor({ sourceGraphService, workspaceSourceRepository }) {
    this.sourceGraphService = sourceGraphService;
    this.sourceRepo = workspaceSourceRepository;
  }

  /**
   * Calculates knowledge coverage, density heatmaps, and source overlaps
   * @param {string} workspaceId 
   * @returns {Promise<Object>} Coverage analysis report
   */
  async calculateCoverage(workspaceId) {
    const startMs = Date.now();

    // 1. Fetch graph details (clusters, relationships)
    const graph = await this.sourceGraphService.buildGraph(workspaceId);
    const clusters = graph.clusters || [];
    const relationships = graph.relationships || [];
    const overallCoverage = graph.coverage || {};

    // 2. Fetch all sources
    const sources = await this.sourceRepo.findByWorkspace(workspaceId);
    const readySources = sources.filter(s => s.status === 'ready');

    if (readySources.length === 0) {
      return {
        completeness: 0,
        sourceOverlapPercentage: 0,
        conceptHeatmap: [],
        coverageDistribution: [],
        gaps: [],
        metrics: { totalSources: 0, totalConcepts: 0, totalClusters: 0 }
      };
    }

    // 3. Completeness score
    // Derived from count of concept clusters mapped vs avg concepts per source
    const completeness = Math.min(
      100,
      Math.round(((clusters.length * 8) + (overallCoverage.avgConceptsPerSource || 0) * 4))
    );

    // 4. Source Overlap Percentage
    // Average pairwise relationship similarity
    let totalSimilarity = 0;
    relationships.forEach(r => {
      totalSimilarity += r.similarity || 0;
    });
    const avgOverlap = relationships.length > 0 
      ? Math.round((totalSimilarity / relationships.length) * 100) 
      : 0;

    // 5. Grid mapping: Concept Heatmap (2D matrix of Sources x Concept Clusters)
    const activeClusters = clusters.slice(0, 8); // top 8 clusters
    const activeSources = readySources.slice(0, 8); // top 8 sources

    const conceptHeatmap = activeClusters.map(cluster => {
      const clusterConcepts = new Set(cluster.concepts.map(c => c.toLowerCase()));

      const sourceDensities = activeSources.map(source => {
        // Count how many concepts in this cluster are referenced by the source
        const sourceConcepts = this.sourceGraphService.extractSourceConcepts(source);
        let intersectionCount = 0;
        sourceConcepts.forEach(sc => {
          if (clusterConcepts.has(sc.toLowerCase())) intersectionCount++;
        });

        // Compute a raw score based on intersection and total segments
        const segmentsCount = source.topicSegments?.length || 1;
        const rawScore = intersectionCount / Math.max(1, cluster.concepts.length);
        const densityScore = Math.min(1.0, rawScore * 1.5); // Boost scale slightly

        return {
          sourceId: source.id,
          sourceTitle: source.title,
          density: Math.round(densityScore * 100) / 100,
        };
      });

      return {
        conceptName: cluster.name,
        sources: sourceDensities,
      };
    });

    // 6. Coverage Distribution
    // How concept densities are balanced across material types
    const typeDistribution = { youtube: 0, pdf: 0, text: 0 };
    readySources.forEach(s => {
      if (typeDistribution[s.type] !== undefined) {
        typeDistribution[s.type] += s.topicSegments?.length || 5; // segments or default weight
      }
    });
    const totalWeight = Object.values(typeDistribution).reduce((a, b) => a + b, 0) || 1;
    const coverageDistribution = Object.keys(typeDistribution).map(type => ({
      type,
      percentage: Math.round((typeDistribution[type] / totalWeight) * 100),
      count: readySources.filter(s => s.type === type).length
    }));

    // 7. Find Knowledge Gaps (concept clusters that are sparse or heavily lopsided to one document)
    const gaps = [];
    conceptHeatmap.forEach(row => {
      const activeDensities = row.sources.filter(s => s.density > 0.1);
      
      if (activeDensities.length === 0) {
        gaps.push({
          type: 'empty_coverage',
          concept: row.conceptName,
          title: `No Grounding for "${row.conceptName}"`,
          description: `You have identified the topic "${row.conceptName}" in your metadata, but none of your active source materials contain dense details about it.`
        });
      } else if (activeDensities.length === 1) {
        gaps.push({
          type: 'single_point_failure',
          concept: row.conceptName,
          title: `Single-Source Dependency on "${row.conceptName}"`,
          description: `This concept is solely grounded in "${activeDensities[0].sourceTitle}". Upload alternative materials to avoid biased answers.`
        });
      }
    });

    logger.info('Knowledge coverage matrix mapped successfully', {
      workspaceId,
      completeness,
      heatmapRows: conceptHeatmap.length,
      durationMs: Date.now() - startMs
    });

    return {
      completeness,
      sourceOverlapPercentage: avgOverlap,
      conceptHeatmap,
      coverageDistribution,
      gaps,
      metrics: {
        totalSources: readySources.length,
        totalConcepts: overallCoverage.totalConcepts || 0,
        totalClusters: clusters.length
      }
    };
  }
}

export default KnowledgeCoverageService;
