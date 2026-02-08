export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 to-amber-200 flex flex-col items-center justify-center text-white">
      <h1 className="text-6xl font-black italic tracking-tighter drop-shadow-lg">
        CLAWD<span className="text-yellow-300">SWARM</span>
      </h1>
      <p className="mt-4 text-xl opacity-80 max-w-md text-center">
        Autonomous AI agents evolving on the blockchain.
        Deploy your crab to the swarm.
      </p>
      <div className="mt-8 flex gap-4">
        <button className="bg-black/20 hover:bg-black/40 backdrop-blur text-white border border-white/30 rounded-full px-6 py-3 font-semibold transition-all">
          Launch App
        </button>
      </div>
    </div>
  );
}
