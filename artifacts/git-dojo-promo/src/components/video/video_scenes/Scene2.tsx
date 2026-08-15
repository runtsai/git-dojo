import { motion } from 'framer-motion';

export const Scene2 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ x: '100%', opacity: 0, filter: 'blur(20px)' }}
      animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
      exit={{ y: '-100%', opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-6xl px-12 flex flex-col items-center relative">
        {/* Background target graphic */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/5 rounded-full pointer-events-none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/[0.03] rounded-full pointer-events-none"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 1.5, ease: 'easeOut' }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-primary font-mono text-sm tracking-[0.3em] uppercase mb-6 flex items-center gap-4"
        >
          <div className="w-8 h-[1px] bg-primary" />
          Track B // Command Test Center
          <div className="w-8 h-[1px] bg-primary" />
        </motion.div>
        
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="font-display text-6xl md:text-8xl font-bold mb-16 text-center text-white"
          style={{ textShadow: '0 0 40px rgba(255,255,255,0.15)' }}
        >
          Live Graded <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Repos</span>
        </motion.h2>

        <div className="relative w-full max-w-5xl aspect-[16/7] perspective-[1200px]">
          {/* Main Terminal window */}
          <motion.div
            className="absolute left-0 top-0 w-[65%] h-full bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden z-20 flex flex-col transform-gpu"
            initial={{ x: -100, opacity: 0, rotateY: 25, z: -100 }}
            animate={{ x: 0, opacity: 1, rotateY: 5, z: 0 }}
            transition={{ delay: 0.9, type: 'spring', stiffness: 90, damping: 20 }}
          >
            <div className="h-10 bg-white/[0.02] border-b border-white/10 px-6 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-error shadow-[0_0_10px_var(--color-error)]" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning shadow-[0_0_10px_var(--color-warning)]" />
              <div className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_10px_var(--color-success)]" />
              <span className="ml-4 font-mono text-xs text-white/40 tracking-wider">check.sh running...</span>
            </div>
            <div className="p-8 font-mono text-base md:text-lg text-white/80 flex flex-col gap-3 relative z-10">
              <motion.div initial={{opacity: 0, x: -10}} animate={{opacity: 1, x: 0}} transition={{delay: 1.3}} className="text-success">$ git rebase -i HEAD~3</motion.div>
              <motion.div initial={{opacity: 0, x: -10}} animate={{opacity: 1, x: 0}} transition={{delay: 1.6}} className="text-white/40">Rebasing (3/3)</motion.div>
              <motion.div initial={{opacity: 0, x: -10}} animate={{opacity: 1, x: 0}} transition={{delay: 1.9}} className="text-success">Successfully rebased and updated.</motion.div>
              <motion.div initial={{opacity: 0, x: -10}} animate={{opacity: 1, x: 0}} transition={{delay: 2.3}} className="text-primary mt-4 flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Running server-side grader...
              </motion.div>
              <motion.div initial={{opacity: 0, scale: 0.9, y: 10}} animate={{opacity: 1, scale: 1, y: 0}} transition={{delay: 2.9, type: 'spring'}} className="bg-success/10 text-success p-4 mt-6 rounded-xl border border-success/30 font-bold flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(35,134,54,0.2)]">
                <span className="text-xl">✅</span> LESSON PASSED: BADGE EARNED
              </motion.div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/[0.02] to-white/0 pointer-events-none" />
          </motion.div>

          {/* Visual Repo State Glass Panel */}
          <motion.div
            className="absolute right-0 top-12 w-[45%] h-[75%] bg-white/[0.04] backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] p-8 z-10 flex flex-col justify-center transform-gpu"
            initial={{ x: 100, opacity: 0, rotateY: -20, z: -200 }}
            animate={{ x: 0, opacity: 1, rotateY: -5, z: -50 }}
            transition={{ delay: 1.1, type: 'spring', stiffness: 90, damping: 20 }}
          >
            <div className="font-mono text-primary/70 mb-8 tracking-[0.2em] text-xs flex justify-between items-center border-b border-white/10 pb-4">
              <span>STATE VISUALIZER</span>
              <span className="text-white/30">LIVE</span>
            </div>
            
            <div className="flex flex-col gap-6 relative pl-4">
              <div className="absolute left-7 top-4 bottom-4 w-[2px] bg-white/10 z-0" />
              <motion.div 
                className="absolute left-7 top-4 bottom-4 w-[2px] bg-primary z-0 origin-top shadow-[0_0_10px_var(--color-primary)]"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 2.2, duration: 0.8, ease: 'linear' }}
              />
              
              {[1, 2, 3].map((node, i) => (
                <motion.div 
                  key={node}
                  className="flex items-center gap-6 z-10 relative"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2.3 + i * 0.2 }}
                >
                  <div className={`w-7 h-7 rounded-full border-[3px] flex items-center justify-center ${i === 0 ? 'border-primary bg-bg-light shadow-[0_0_15px_var(--color-primary)]' : 'border-white/20 bg-bg-light'}`}>
                    {i === 0 && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div className={`font-mono text-sm px-4 py-2 rounded-lg backdrop-blur-md ${i === 0 ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(88,166,255,0.1)]' : 'bg-white/[0.02] text-white/50 border border-white/10'}`}>
                    {i === 0 ? 'feature-branch' : `commit-${node}a4f`}
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
