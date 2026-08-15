import { motion } from 'framer-motion';

export const Scene3 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8"
      initial={{ y: '100%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ scale: 1.2, opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-8 text-center"
      >
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-2">Visceral Danger Feedback.</h2>
        <p className="text-text-secondary text-xl">The simulator feels as strict as the real platform.</p>
      </motion.div>

      <motion.div
        className="w-full max-w-2xl bg-bg-panel border border-bg-border rounded-xl shadow-2xl p-6 relative overflow-hidden"
        initial={{ opacity: 0, rotateX: 20, y: 50 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 120 }}
      >
        {/* Normal PR view that gets interrupted */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-2xl font-bold font-display flex items-center gap-3">
              Update authentication logic <span className="text-text-secondary font-normal">#42</span>
            </div>
            <div className="text-text-secondary mt-1 flex items-center gap-2 text-sm">
              <span className="bg-bg-dark px-2 py-0.5 rounded font-mono text-xs border border-bg-border">main</span>
              <span>←</span>
              <span className="bg-bg-dark px-2 py-0.5 rounded font-mono text-xs border border-bg-border">auth-fix</span>
            </div>
          </div>
          <div className="bg-success text-bg-dark font-bold px-3 py-1 rounded-full text-sm">Open</div>
        </div>

        {/* Secret leaked alert - visceral reveal */}
        <motion.div
          className="absolute inset-0 bg-danger-bg backdrop-blur-md flex flex-col items-center justify-center p-8 text-center border-4 border-error/50"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5, type: 'spring', stiffness: 300, damping: 20 }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1], color: ['var(--color-error)', '#ff8080', 'var(--color-error)'] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-6xl mb-4"
          >
            ⚠️
          </motion.div>
          <h3 className="font-display font-bold text-3xl text-error mb-2 tracking-tight uppercase">Push Rejected</h3>
          <p className="font-mono text-text-primary text-sm bg-bg-dark/80 p-4 rounded border border-error/30 inline-block">
            remote: error: GH013: Repository rule violations found.<br/>
            remote: <span className="text-error font-bold">Secret scanning alert:</span> AWS Access Key exposed!
          </p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2 }}
            className="mt-6 text-text-primary font-bold px-6 py-2 bg-error rounded shadow-[0_0_20px_rgba(248,81,73,0.5)] cursor-not-allowed"
          >
            ACTION HALTED
          </motion.div>
        </motion.div>

      </motion.div>
    </motion.div>
  );
};
