export const ActionHUD = ({
  gameState,
  myCards,
  playerId,
  isMyTurn,
  handleAction,
  isRaising,
  setIsRaising,
  raiseAmount,
  setRaiseAmount,
}: any) => {
  const mySeatIndex = gameState.seats.findIndex(
    (s: any) => s && s.id === playerId,
  );
  if (gameState.phase === "waiting" || mySeatIndex === -1) return null;

  const myPlayer = gameState.seats[mySeatIndex];
  const myChips = myPlayer?.chips || 0;

  // 1. Calculate the real "Total Pot" (Main pot + all current bets on the table)
  const mainPot = gameState.pots[0]?.amount || 0;
  const currentBetsOnTable = gameState.seats.reduce(
    (acc: number, s: any) => acc + (s?.currentBet || 0),
    0,
  );
  const totalPotNow = mainPot + currentBetsOnTable;

  const currentBetToMatch = gameState.highestBet - (myPlayer?.currentBet || 0);

  // 2. Helper for Pot-Sized Raise
  // Logic: (Total Pot + 2 * what you need to call) * percentage
  const handlePotSizedClick = (percent: number) => {
    const potRaise = (totalPotNow + currentBetToMatch * 2) * percent;
    // We add the currentBetToMatch to ensure the total amount is correct
    const finalAmount = Math.min(myChips, Math.floor(potRaise));
    setRaiseAmount(finalAmount);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-between items-end pointer-events-none z-30">
      <div className="w-1/3"></div>

      {/* Center: Hero Cards */}
      <div
        className={`w-1/3 flex justify-center space-x-2 pointer-events-auto transition-transform duration-500`}>
        {myCards?.map((card: any, i: number) => {
          const isRed = card.suit === "hearts" || card.suit === "diamonds";
          return (
            <div
              key={i}
              className="w-20 h-32 bg-white rounded-xl border border-gray-300 flex flex-col items-center justify-center text-black font-bold text-2xl shadow-2xl">
              <span>{card.value === "T" ? "10" : card.value}</span>
              <span
                className={`${isRed ? "text-red-600" : "text-black"} text-3xl`}>
                {card.suit === "hearts"
                  ? "♥"
                  : card.suit === "diamonds"
                    ? "♦"
                    : card.suit === "spades"
                      ? "♠"
                      : "♣"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right: Betting Controls */}
      <div className="w-1/3 flex justify-end pointer-events-auto relative">
        {isRaising && (
          <div className="absolute bottom-full mb-6 right-0 bg-gray-800 p-5 rounded-2xl border border-gray-600 shadow-2xl w-[26rem] backdrop-blur-md bg-opacity-95 z-50 animate-fade-in-down">
            <div className="flex space-x-2 mb-5">
              <button
                onClick={() => handlePotSizedClick(0.33)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tighter">
                1/3 Pot
              </button>
              <button
                onClick={() => handlePotSizedClick(0.5)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tighter">
                1/2 Pot
              </button>
              <button
                onClick={() => handlePotSizedClick(0.75)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tighter">
                3/4 Pot
              </button>
              <button
                onClick={() => handlePotSizedClick(1.0)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tighter">
                Pot
              </button>
              <button
                onClick={() => setRaiseAmount(myChips)}
                className="flex-1 bg-red-900/50 hover:bg-red-800 py-2 rounded-lg text-[10px] font-bold uppercase tracking-tighter text-red-200 border border-red-700">
                Max
              </button>
            </div>

            <div className="flex items-center space-x-4 mb-6">
              <input
                type="number"
                value={raiseAmount}
                onChange={(e) =>
                  setRaiseAmount(
                    Math.min(myChips, Math.max(0, Number(e.target.value))),
                  )
                }
                className="w-28 bg-gray-950 border border-gray-600 rounded-lg p-3 text-white font-bold"
              />
              <input
                type="range"
                min={gameState.highestBet * 2}
                max={myChips}
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="flex-1 accent-green-500 cursor-pointer"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setIsRaising(false)}
                className="flex-1 bg-gray-600 py-3 rounded-xl font-bold">
                Cancel
              </button>
              <button
                onClick={() => handleAction("raise", raiseAmount)}
                className="flex-1 bg-green-600 py-3 rounded-xl font-bold transition-all active:scale-95">
                Confirm $
                {Number(raiseAmount).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </button>
            </div>
          </div>
        )}

        <div
          className={`bg-gray-800 p-4 rounded-2xl border border-gray-600 shadow-2xl flex space-x-3 backdrop-blur-sm bg-opacity-90 transition-all ${isRaising ? "opacity-30 pointer-events-none" : ""} ${isMyTurn ? "border-green-500" : "opacity-60 grayscale"}`}>
          <button
            onClick={() => handleAction("fold")}
            disabled={!isMyTurn}
            className={`px-6 py-4 rounded-xl font-bold text-lg transition ${isMyTurn ? "bg-red-600 hover:bg-red-500" : "bg-gray-700"}`}>
            Fold
          </button>
          <button
            onClick={() => handleAction("call")}
            disabled={!isMyTurn}
            className={`px-6 py-4 rounded-xl font-bold text-lg transition ${isMyTurn ? "bg-blue-600 hover:bg-blue-500" : "bg-gray-700"}`}>
            {currentBetToMatch > 0
              ? `Call $${currentBetToMatch.toLocaleString()}`
              : "Check"}
          </button>
          <button
            onClick={() => {
              const minRaise = gameState.highestBet * 2;
              setRaiseAmount(Math.min(myChips, minRaise));
              setIsRaising(true);
            }}
            disabled={!isMyTurn}
            className={`px-6 py-4 rounded-xl font-bold text-lg transition ${isMyTurn ? "bg-green-600 hover:bg-green-500" : "bg-gray-700"}`}>
            Raise
          </button>
        </div>
      </div>
    </div>
  );
};
