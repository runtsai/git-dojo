import { motion } from 'framer-motion';

export const Scene1 = () => {
  const steps = ["WHAT", "WHERE", "WHY", "WHEN", "HOW"];
  
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center z-10"
      initial={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
      animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-5xl px-8 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-accent uppercase tracking-widest font-mono text-sm mb-4"
          >
            Track A // Visual Tiers
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="font-display text-4xl md:text-6xl font-bold mb-6"
          >
            Context Before Command.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-text-secondary text-xl max-w-md"
          >
            Never run a command without understanding the business reason. Simulated UI with zero gating.
          </motion.p>
        </div>

        <div className="flex-1 flex flex-col gap-3 w-full">
          {steps.map((step, i) => (
            <motion.div
              key={step}
              className="bg-bg-panel border border-bg-border rounded-lg p-4 flex items-center justify-between"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + i * 0.2, type: 'spring', stiffness: 200, damping: 20 }}
            >
              <span className="font-mono text-primary font-bold">{step}</span>
              <div className="w-full max-w-[200px] h-2 bg-bg-dark rounded-full overflow-hidden ml-4">
                <motion.div 
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - i * 15}%` }}
                  transition={{ delay: 1.2 + i * 0.2, duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
