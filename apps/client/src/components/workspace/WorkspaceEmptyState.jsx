import { motion } from 'framer-motion';
import AppIcon from '../AppIcon';

export default function WorkspaceEmptyState({ onAddSource }) {
  // Generate random coordinates for floating particles
  const particles = Array.from({ length: 12 }).map((_, i) => ({
    id: i,
    x: Math.random() * 400 - 200,
    y: Math.random() * 400 - 200,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5,
  }));

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-[#030305] select-none relative overflow-hidden">
      {/* Background Animated Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-indigo-500/20"
            style={{
              width: p.size,
              height: p.size,
              left: '50%',
              top: '50%',
            }}
            animate={{
              x: [0, p.x, 0],
              y: [0, p.y, 0],
              opacity: [0.1, 0.6, 0.1],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      <div className="max-w-2xl text-center relative z-10 flex flex-col items-center">
        {/* Animated Siri-like AI Orb Container */}
        <div className="mb-8">
          <div className="ai-orb-container">
            <div className="ai-orb-glow" />
            <div className="ai-orb-body" />
            <div className="absolute z-10 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              <AppIcon name="brain" size={24} strokeWidth={2.5} className="animate-pulse" />
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-2xl font-bold text-slate-100 tracking-tight mb-3"
        >
          Initialize Cognitive Workspace
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed mb-10"
        >
          Ground SheryAI's cognitive reasoning engine strictly in your personal files.
          Upload study guides, past lectures, video transcripts, or PDFs to begin.
        </motion.p>

        {/* Asymmetrical Suggested Actions Grid */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-2 gap-4 w-full max-w-xl mb-10 text-left"
        >
          {[
            {
              title: 'Ground on YouTube',
              desc: 'Convert any online video lecture or tutorial into chat-ready study content.',
              icon: 'video',
              color: 'text-indigo-400 border-indigo-500/10 hover:border-indigo-500/25 hover:bg-indigo-500/5',
            },
            {
              title: 'Ground on Documents',
              desc: 'Process textbook chapters, research PDFs, summaries, or manuals.',
              icon: 'file',
              color: 'text-purple-400 border-purple-500/10 hover:border-purple-500/25 hover:bg-purple-500/5',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={onAddSource}
              className={`p-4 border rounded-2xl cursor-pointer transition-all duration-300 ${item.color}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <AppIcon name={item.icon} size={15} />
                <span className="text-xs font-bold text-slate-200">{item.title}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Primary CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          onClick={onAddSource}
          className="inline-flex items-center gap-2.5 px-6 py-3.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg hover:shadow-indigo-500/10 hover:scale-[1.01] cursor-pointer transition-all duration-200"
        >
          <AppIcon name="upload" size={14} />
          <span>Upload grounding files</span>
        </motion.button>
      </div>
    </div>
  );
}
