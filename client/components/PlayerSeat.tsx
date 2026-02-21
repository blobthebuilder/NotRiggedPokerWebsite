export const PlayerSeat = ({
  seat,
  index,
  angle,
  isGameActive,
  isWinner,
  showdownData,
  playerId,
  requestSeat,
  disableSeating,
  hasPendingRequest,
  alreadySeated,
  turnIndex,
  phase,
  dealerIndex,
}: any) => {
  const x = 50 + 42 * Math.cos(angle);
  const y = 50 + 38 * Math.sin(angle);
  const betX = 50 + 26 * Math.cos(angle);
  const betY = 50 + 23 * Math.sin(angle);

  // Position for the Dealer Button (Offset from the avatar)
  const dealerX = 50 + 33 * Math.cos(angle + 0.35);
  const dealerY = 50 + 29 * Math.sin(angle + 0.35);

  return (
    <>
      {/* DEALER BUTTON */}
      {isGameActive && dealerIndex === index && (
        <div
          style={{
            top: `${dealerY}%`,
            left: `${dealerX}%`,
            transform: "translate(-50%, -50%)",
          }}
          className="absolute z-30 w-6 h-6 bg-white rounded-full border-2 border-gray-400 flex items-center justify-center shadow-lg pointer-events-none">
          <span className="text-[10px] font-black text-gray-800">D</span>
        </div>
      )}

      {/* Bet Chips */}
      {isGameActive && seat?.currentBet > 0 && phase !== "showdown" && (
        <div
          style={{
            top: `${betY}%`,
            left: `${betX}%`,
            transform: "translate(-50%, -50%)",
          }}
          className="absolute z-10 flex items-center space-x-1.5 bg-black/80 px-2.5 py-1 rounded-full border border-gray-600 shadow-md">
          <div className="w-3 h-3 rounded-full border-[2px] border-dashed border-yellow-300 bg-yellow-500" />
          <span className="text-white font-bold text-xs">
            ${seat.currentBet}
          </span>
        </div>
      )}

      {/* Avatar */}
      <div
        style={{
          top: `${y}%`,
          left: `${x}%`,
          transform: "translate(-50%, -50%)",
        }}
        className="absolute z-20 flex flex-col items-center">
        <div
          className={`w-24 h-24 bg-gray-800 rounded-full flex flex-col items-center justify-center border-4 shadow-xl relative transition-all duration-300 ${
            turnIndex === index && phase !== "waiting" && phase !== "showdown"
              ? "border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.6)] scale-110"
              : isWinner
                ? "border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.8)] scale-110"
                : "border-gray-600"
          }`}>
          {seat ? (
            <>
              {isWinner && (
                <div className="absolute -top-6 bg-yellow-500 text-black font-extrabold text-[10px] px-3 py-1 rounded-full shadow-lg z-40 animate-bounce whitespace-nowrap border-2 border-yellow-200">
                  WINNER: {showdownData.winningDescription}
                </div>
              )}
              {turnIndex === index &&
                phase !== "waiting" &&
                phase !== "showdown" && (
                  <div className="absolute -top-3 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
                    TURN
                  </div>
                )}
              {seat.queuedToLeave && (
                <div className="absolute -bottom-3 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50">
                  Leaving next hand
                </div>
              )}

              <span className="text-xs truncate w-20 text-center text-gray-300">
                {seat.name}
              </span>
              <span className="font-bold text-yellow-400 mt-1">
                ${seat.chips}
              </span>

              {/* Cards */}
              {isGameActive && seat.inHand && seat.id !== playerId && (
                <div className="absolute -bottom-5 flex space-x-1 shadow-lg z-30">
                  {phase === "showdown" && showdownData?.allHoleCards ? (
                    showdownData.allHoleCards
                      .find((p: any) => p.id === seat.id)
                      ?.cards.map((card: any, cIdx: number) => (
                        <div
                          key={cIdx}
                          className="w-8 h-12 bg-white rounded border border-gray-300 flex flex-col items-center justify-center text-black font-bold text-[10px] shadow-md">
                          <span>{card.value === "T" ? "10" : card.value}</span>
                          <span
                            className={
                              card.suit === "hearts" || card.suit === "diamonds"
                                ? "text-red-600"
                                : ""
                            }>
                            {card.suit === "hearts" || card.suit === "diamonds"
                              ? "♥"
                              : "♠"}
                          </span>
                        </div>
                      ))
                  ) : (
                    <>
                      <div className="w-8 h-12 bg-red-800 rounded border border-white/50 pattern-diagonal-lines"></div>
                      <div className="w-8 h-12 bg-red-800 rounded border border-white/50 pattern-diagonal-lines"></div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => requestSeat(index)}
              disabled={disableSeating}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition ${disableSeating ? "bg-gray-600 text-gray-400 opacity-50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
              {hasPendingRequest && !alreadySeated ? "Pending..." : "Sit Here"}
            </button>
          )}
        </div>
      </div>
    </>
  );
};
