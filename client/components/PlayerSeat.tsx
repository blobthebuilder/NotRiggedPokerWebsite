import { getSuitDetails } from "@/lib/getSuits";
import { useRef, useEffect } from "react";

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
  videoStream,
}: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Bind the MediaStream to the actual HTML video element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

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
          // REMOVED overflow-hidden from here!
          className={`w-24 h-24 bg-gray-800 rounded-full flex flex-col items-center justify-center border-4 shadow-xl relative transition-all duration-300 ${
            turnIndex === index && phase !== "waiting" && phase !== "showdown"
              ? "border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.6)] scale-110"
              : isWinner
                ? "border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.8)] scale-110"
                : "border-gray-600"
          }`}>
          {/* --- NEW VIDEO OVERLAY --- */}
          {videoStream && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted // Always muted since we dropped audio
              // ADDED rounded-full here to clip the video perfectly inside the border
              className="absolute inset-0 w-full h-full object-cover rounded-full z-0 pointer-events-none"
            />
          )}

          {seat ? (
            <div className="z-10 flex flex-col items-center w-full h-full justify-center relative">
              {/* PENDING CHIPS INDICATOR */}
              {seat.queuedAdjustment !== 0 &&
                seat.queuedAdjustment !== undefined && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black py-1 px-3 rounded-full shadow-xl animate-pulse whitespace-nowrap z-50 border border-blue-400 flex items-center gap-1">
                    <span>{seat.queuedAdjustment > 0 ? "+" : ""}</span>
                    <span>{seat.queuedAdjustment}</span>
                    <span className="ml-0.5">PENDING</span>
                  </div>
                )}
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

              {/* Added drop-shadows so text is readable over the video feed */}
              <span className="text-xs truncate w-20 text-center text-gray-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-bold z-10">
                {seat.name}
              </span>
              <span className="font-black text-yellow-400 mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] z-10">
                ${seat.chips}
              </span>

              {/* Cards */}
              {isGameActive && seat.publicCards && seat.id !== playerId && (
                // Adjusted to -bottom-10 because the cards are bigger now
                <div className="absolute -bottom-10 flex space-x-1 shadow-lg z-30">
                  {(seat.inHand ||
                    phase === "showdown" ||
                    seat.revealedCards?.some((r: boolean) => r)) && (
                    <>
                      {seat.publicCards.map((card: any, cIdx: number) => {
                        if (card.hidden) {
                          return (
                            <div
                              key={cIdx}
                              className="w-12 h-16 bg-red-800 rounded-md border border-white/50 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                          );
                        }

                        const { icon, color } = getSuitDetails(card.suit);
                        return (
                          <div
                            key={cIdx}
                            className="w-12 h-16 bg-white rounded-md border-2 border-gray-300 flex flex-col items-center justify-center text-black font-bold text-sm shadow-xl animate-flip-in">
                            <span>
                              {card.value === "T" ? "10" : card.value}
                            </span>
                            <span className={`${color} text-xl mt-0.5`}>
                              {icon}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => requestSeat(index)}
              disabled={disableSeating}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition z-10 ${disableSeating ? "bg-gray-600 text-gray-400 opacity-50 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white"}`}>
              {hasPendingRequest && !alreadySeated ? "Pending..." : "Sit Here"}
            </button>
          )}
        </div>
      </div>
    </>
  );
};
