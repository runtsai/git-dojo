import { motion } from 'framer-motion';

export const Scene3 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8"
      initial={{ y: '100%', opacity: 0, filter: 'blur(20px)' }}
      animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
      exit={{ scale: 1.2, opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-12 text-center"
      >
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 64 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="h-[2px] bg-error mb-6 shadow-[0_0_15px_var(--color-error)] mx-auto"
        />
        <h2 className="font-display text-5xl md:text-7xl font-bold mb-4 text-white" style={{ textShadow: '0 0 30px rgba(255,255,255,0.1)' }}>
          Visceral Danger Feedback.
        </h2>
        <p className="text-white/60 text-xl font-light">The simulator feels as strict as the real platform.</p>
      </motion.div>

      <motion.div
        className="w-full max-w-3xl bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.6)] p-8 relative overflow-hidden transform-gpu"
        initial={{ opacity: 0, rotateX: 20, y: 50, z: -100 }}
        animate={{ opacity: 1, rotateX: 0, y: 0, z: 0 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 90, damping: 20 }}
        style={{ perspective: 1200 }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/[0.02] to-white/0 pointer-events-none" />
        
        {/* Normal PR view that gets interrupted */}
        <div className="flex justify-between items-start mb-8 relative z-10">
          <div>
            <div className="text-2xl font-bold font-display flex items-center gap-4 text-white">
              Update authentication logic <span className="text-white/40 font-normal">#42</span>
            </div>
            <div className="text-white/50 mt-3 flex items-center gap-3 text-sm">
              <span className="bg-white/5 px-3 py-1 rounded font-mono text-xs border border-white/10">main</span>
              <span>←</span>
              <span className="bg-white/5 px-3 py-1 rounded font-mono text-xs border border-white/10">auth-fix</span>
            </div>
          </div>
          <div className="bg-success/20 text-success border border-success/30 font-bold px-4 py-1.5 rounded-full text-sm shadow-[0_0_15px_rgba(35,134,54,0.2)]">Open</div>
        </div>

        {/* Placeholder code block */}
        <div className="bg-bg-dark rounded-lg p-4 font-mono text-xs text-white/50 border border-white/5 mb-4 opacity-50">
          <div>import AWS from 'aws-sdk';</div>
          <div className="mt-2 text-warning">// TODO: remove before prod</div>
          <div className="mt-1 text-white">const accessKey = "AKIAIOSFODNN7EXAMPLE";</div>
        </div>

        {/* Secret leaked alert - visceral reveal */}
        <motion.div
          className="absolute inset-0 bg-error/10 backdrop-blur-3xl flex flex-col items-center justify-center p-10 text-center border-2 border-error/50 z-20"
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.8, type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(248,81,73,0.15),transparent)] pointer-events-none" />
          
          <motion.div
            animate={{ scale: [1, 1.15, 1], filter: ['drop-shadow(0 0 10px rgba(248,81,73,0))', 'drop-shadow(0 0 30px rgba(248,81,73,0.8))', 'drop-shadow(0 0 10px rgba(248,81,73,0))'] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-6 relative z-10"
          >
            ⚠️
          </motion.div>
          <h3 className="font-display font-bold text-4xl text-error mb-4 tracking-widest uppercase shadow-error z-10" style={{ textShadow: '0 0 20px rgba(248,81,73,0.5)' }}>Push Rejected</h3>
          <p className="font-mono text-white/90 text-sm bg-black/60 p-6 rounded-xl border border-error/40 shadow-[0_0_30px_rgba(0,0,0,0.5)] z-10 leading-relaxed text-left">
            <span className="text-white/50">remote: error: GH013: Repository rule violations found.</span><br/>
            <span className="text-white/50">remote: </span><span className="text-error font-bold tracking-wide">Secret scanning alert:</span> AWS Access Key exposed!
          </p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5 }}
            className="mt-8 text-white font-bold px-8 py-3 bg-error rounded-lg shadow-[0_0_30px_rgba(248,81,73,0.6)] uppercase tracking-[0.2em] z-10"
          >
            Action Halted
          </motion.div>
        </motion.div>

      </motion.div>
    </motion.div>
  );
};
