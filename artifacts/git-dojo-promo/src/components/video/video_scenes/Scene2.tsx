import { motion } from 'framer-motion';

export const Scene2 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ y: '-100%', opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-5xl px-8 flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-primary font-mono text-lg mb-2"
        >
          Track B // Command Test Center
        </motion.div>
        
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display text-5xl md:text-7xl font-bold mb-12 text-center"
        >
          Live Graded Repos
        </motion.h2>

        <div className="relative w-full max-w-4xl aspect-[16/7]">
          {/* Main Terminal window */}
          <motion.div
            className="absolute left-0 top-0 w-2/3 h-full bg-bg-dark border border-bg-border rounded-xl shadow-2xl overflow-hidden z-20 flex flex-col"
            initial={{ x: -50, opacity: 0, rotateY: 15 }}
            animate={{ x: 0, opacity: 1, rotateY: 0 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 100 }}
            style={{ perspective: 1000 }}
          >
            <div className="h-8 bg-bg-panel border-b border-bg-border px-4 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-error" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning" />
              <div className="w-2.5 h-2.5 rounded-full bg-success" />
              <span className="ml-2 font-mono text-xs text-text-secondary">check.sh running...</span>
            </div>
            <div className="p-4 font-mono text-sm text-text-primary flex flex-col gap-2">
              <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 1.0}} className="text-success">$ git rebase -i HEAD~3</motion.div>
              <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 1.4}} className="text-text-secondary">Rebasing (3/3)</motion.div>
              <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 1.8}} className="text-success">Successfully rebased and updated.</motion.div>
              <motion.div initial={{opacity: 0}} animate={{opacity: 1}} transition={{delay: 2.2}} className="text-primary mt-2">Running server-side grader...</motion.div>
              <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} transition={{delay: 2.8}} className="bg-success/20 text-success p-2 mt-2 rounded border border-success/30 font-bold flex items-center justify-center">
                ✅ LESSON PASSED: BADGE EARNED
              </motion.div>
            </div>
          </motion.div>

          {/* Visual Repo State */}
          <motion.div
            className="absolute right-0 top-8 w-1/2 h-[80%] bg-bg-panel border border-bg-border rounded-xl shadow-xl p-6 z-10 flex flex-col justify-center items-center"
            initial={{ x: 50, opacity: 0, rotateY: -15 }}
            animate={{ x: 0, opacity: 1, rotateY: 0 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 100 }}
          >
            <div className="font-display text-text-secondary mb-6 tracking-wider text-sm">STATE VISUALIZER</div>
            
            <div className="flex flex-col gap-3 relative">
              <div className="absolute left-3 top-4 bottom-4 w-0.5 bg-bg-border z-0" />
              
              {[1, 2, 3].map((node, i) => (
                <motion.div 
                  key={node}
                  className="flex items-center gap-4 z-10 relative"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2.0 + i * 0.15 }}
                >
                  <div className={`w-6 h-6 rounded-full border-4 ${i === 0 ? 'border-primary bg-bg-panel' : 'border-bg-border bg-bg-dark'}`} />
                  <div className={`font-mono text-sm px-3 py-1 rounded ${i === 0 ? 'bg-primary text-bg-dark font-bold' : 'bg-bg-dark text-text-secondary border border-bg-border'}`}>
                    {i === 0 ? 'feature-branch' : `commit-a${i}b`}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
