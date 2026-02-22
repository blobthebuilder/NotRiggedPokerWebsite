import { getSuitDetails } from "@/lib/getSuits";

export const PokerTable = ({ gameState, children }: any) => {
  return (
    <div className="relative w-full max-w-5xl mx-auto h-[650px] mt-4 flex items-center justify-center shrink-0">
      {/* The Felt */}
      <div className="absolute inset-8 bg-green-800 rounded-[200px] border-[12px] border-yellow-900 shadow-2xl"></div>

      {/* Center Pot & Community Cards */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10">
        {gameState.phase !== "waiting" && (
          <div className="flex space-x-2 mb-6">
            {[...Array(5)].map((_, i) => {
              const card = gameState.communityCards[i];
              const suitDetails = card ? getSuitDetails(card.suit) : null;

              return card ? (
                <div
                  key={i}
                  className="w-20 h-28 sm:w-24 sm:h-32 bg-white rounded-xl border-2 border-gray-300 flex flex-col items-center justify-center text-black font-extrabold text-2xl sm:text-3xl shadow-2xl animate-flip-in">
                  <span>{card.value === "T" ? "10" : card.value}</span>
                  <span
                    className={`${suitDetails?.color} text-4xl sm:text-5xl mt-1`}>
                    {suitDetails?.icon}
                  </span>
                </div>
              ) : (
                <div
                  key={i}
                  className="w-20 h-28 sm:w-24 sm:h-32 bg-black/20 border-2 border-green-900/40 rounded-xl shadow-inner"></div>
              );
            })}
          </div>
        )}

        <div className="text-center bg-black/60 px-6 py-3 rounded-full border border-green-900/50 shadow-lg">
          <p className="text-xl font-bold text-yellow-400">
            Pot: $
            {Number(gameState.pots[0].amount).toFixed(2).replace(/\.00$/, "")}
          </p>
          <p className="text-xs text-green-300 mt-1 uppercase tracking-widest">
            Blinds: {gameState.settings.smallBlind}/
            {gameState.settings.bigBlind}
          </p>
        </div>
      </div>

      {/* Players are passed as children */}
      {children}
    </div>
  );
};
