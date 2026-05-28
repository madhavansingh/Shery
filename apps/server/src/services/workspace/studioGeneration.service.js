import logger from '../../loggers/logger.js';
import { buildStudioPrompt } from '../../lib/prompt/workspace-chat.js';
import AppError from '../../utils/AppError.js';

class StudioGenerationService {
  constructor({
    vectorSearchService,
    contextManagerService,
    workspaceOutputRepository,
    geminiFlash,
  }) {
    this.vectorSearch = vectorSearchService;
    this.contextManager = contextManagerService;
    this.outputRepo = workspaceOutputRepository;
    this.geminiFlash = geminiFlash;
  }

  async generate(workspaceId, type, opts = {}) {
    const outputTypeLabels = {
      study_guide: 'Study Guide',
      flashcards: 'Active-Recall Flashcards',
      faq: 'Frequently Asked Questions',
      timeline: 'Progression Timeline',
      key_insights: 'Key Concept Insights',
      key_definitions: 'Technical Glossary & Definitions',
      interview_questions: 'Practice Interview Sheet',
      topic_breakdown: 'Hierarchical Mind-Map Breakdown',
      exam_prep: 'Practice Exam Prep',
      revision_sheet: 'Condensed Revision Sheet',
    };

    const label = outputTypeLabels[type] || 'Study Guide';
    
    // Create pending output doc
    const outputDoc = await this.outputRepo.create(workspaceId, {
      type,
      title: opts.title || `${label}`,
      content: '',
      sourcesUsed: [],
      status: 'generating',
    });

    const outputId = outputDoc.id;

    // Run generation asynchronously or in context of background request
    // We do it synchronously inside the request context but with try/catch to save error state
    try {
      logger.info('Starting studio generation', { workspaceId, outputId, type });

      // Step 1: Hybrid retrieval scoped to get general overview of the workspace
      // We search for key technical ideas using concept-dense search queries or broad conceptual searches
      const broadSearchQuery = opts.topicFocus || 'main concepts, technical definitions, key details and core architecture';
      
      const matchedChunks = await this.vectorSearch.hybridSearch(workspaceId, broadSearchQuery, {
        topK: 25,
      });

      if (!matchedChunks || matchedChunks.length === 0) {
        throw new AppError('Could not retrieve any content from the uploaded documents. Please upload sources first.', 400);
      }

      // Step 2: Context assembly
      const { contextText, sourcesUsed } = await this.contextManager.assembleContext(matchedChunks, broadSearchQuery, {
        maxTokens: 6000, // allocate larger context limit for robust study guides
        diversityWeight: 0.6,
      });

      // Step 3: Run Gemini generation
      const studioPrompt = buildStudioPrompt(type, contextText);
      
      const response = await this.geminiFlash.generateContent({
        contents: [{ role: 'user', parts: [{ text: studioPrompt }] }],
        generationConfig: {
          temperature: 0.25,
        },
      });

      let content = response.response?.text() || '';
      
      // If type is flashcards, attempt parsing JSON or format clean markdown otherwise
      if (type === 'flashcards') {
        const jsonMatch = content.trim().match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          content = jsonMatch[0]; // extract clean JSON array
        }
      }

      // Step 4: Update output to ready
      const finalOutput = await this.outputRepo.update(workspaceId, outputId, {
        content,
        sourcesUsed,
        status: 'ready',
      });

      logger.info('Studio generation completed successfully', { workspaceId, outputId, type });
      return finalOutput;
    } catch (error) {
      logger.error('Studio generation failed', { error: error.message, workspaceId, outputId });
      
      await this.outputRepo.update(workspaceId, outputId, {
        content: `Generation failed: ${error.message || 'Unknown generation error'}`,
        status: 'error',
      });
      
      throw error;
    }
  }

  async getOutput(workspaceId, outputId) {
    return this.outputRepo.findById(workspaceId, outputId);
  }

  async listOutputs(workspaceId) {
    return this.outputRepo.findByWorkspace(workspaceId);
  }

  async deleteOutput(workspaceId, outputId) {
    return this.outputRepo.delete(workspaceId, outputId);
  }
}

export default StudioGenerationService;
