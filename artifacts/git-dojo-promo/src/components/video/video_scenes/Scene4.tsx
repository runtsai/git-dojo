import { motion } from 'framer-motion';

export const Scene4 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center z-10 p-8"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center text-center"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <motion.div
          className="w-24 h-24 rounded-2xl bg-bg-panel border border-bg-border shadow-[0_0_40px_rgba(88,166,255,0.2)] flex items-center justify-center mb-8 relative"
          initial={{ rotate: -10, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          {/* Animated graph lines inside icon */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="6" cy="6" r="3"></circle>
            <circle cx="18" cy="18" r="3"></circle>
            <line x1="6" y1="9" x2="6" y2="15"></line>
            <path d="M18 15V9a3 3 0 0 0-3-3H9"></path>
          </svg>
          <motion.div 
            className="absolute inset-0 rounded-2xl border-2 border-primary"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>

        <motion.h1
          className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          Git Dojo
        </motion.h1>

        <motion.div
          className="text-xl md:text-2xl text-text-secondary font-mono mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          The GitHub Mastery Path
        </motion.div>

        <div className="flex gap-4">
          <motion.div
            className="px-6 py-3 rounded-full bg-bg-panel border border-bg-border flex items-center gap-3 font-mono text-sm"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 1.0 }}
          >
            <div className="w-2 h-2 rounded-full bg-accent" /> Track A: Visual
          </motion.div>
          <motion.div
            className="px-6 py-3 rounded-full bg-bg-panel border border-bg-border flex items-center gap-3 font-mono text-sm"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <div className="w-2 h-2 rounded-full bg-warning" /> Track B: Terminal
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};
