export const HostSidebar = ({
  isOpen,
  setIsOpen,
  isHost,
  pendingRequests,
  gameState,
  resolveRequest,
  startGame,
  updateSettings,
  sbState,
  bbState,
  timeoutState,
  settingsStatus,
}: any) => {
  if (!isHost) return null;

  return (
    <>
      {/* Toggle Button (Stays in Top Left) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-6 left-6 z-[60] bg-gray-800/80 backdrop-blur border border-gray-600 px-4 py-2 rounded-lg shadow-xl hover:bg-gray-700 transition-all">
          <span className="text-yellow-500 font-bold text-xs uppercase">
            Host Menu
          </span>
        </button>
      )}

      {/* Floating Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-start p-6 pointer-events-none">
          <div className="pointer-events-auto w-80 max-h-[90vh] bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-down">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950/50">
              <h2 className="text-sm font-black text-yellow-500 uppercase tracking-widest">
                Host Controls
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-white text-xl px-2">
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-4 custom-scrollbar space-y-6">
              {/* Seat Requests */}
              <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter mb-3">
                  Requests ({pendingRequests.length})
                </h3>
                {pendingRequests.length > 0 ? (
                  <div className="space-y-2">
                    {pendingRequests.map((req: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-gray-800/50 p-2 rounded-lg border border-gray-700">
                        <p className="text-xs mb-2">
                          <b>{req.playerInfo.name}</b> Seat {req.seatIndex + 1}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => resolveRequest(req, true)}
                            className="flex-1 bg-green-600 text-[10px] py-1 rounded font-bold">
                            Approve
                          </button>
                          <button
                            onClick={() => resolveRequest(req, false)}
                            className="flex-1 bg-red-600 text-[10px] py-1 rounded font-bold">
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-600 italic">
                    No pending requests
                  </p>
                )}
              </div>

              {/* Settings */}
              <div className="relative">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter mb-3">
                  Settings
                </h3>
                {settingsStatus && (
                  <div className="absolute -top-8 left-0 right-0 bg-blue-600 text-white text-[10px] py-1 rounded animate-fade-in-down text-center">
                    {settingsStatus}
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-[10px] text-gray-400">
                      Small Blind
                    </label>
                    <input
                      type="number"
                      value={sbState[0]}
                      onChange={(e) => sbState[1](Number(e.target.value))}
                      className="w-20 bg-gray-950 rounded p-1 text-right text-xs border border-gray-700"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-[10px] text-gray-400">
                      Big Blind
                    </label>
                    <input
                      type="number"
                      value={bbState[0]}
                      onChange={(e) => bbState[1](Number(e.target.value))}
                      className="w-20 bg-gray-950 rounded p-1 text-right text-xs border border-gray-700"
                    />
                  </div>
                  <button
                    onClick={updateSettings}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-1.5 rounded text-[10px] font-bold">
                    Apply Changes
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="p-4 bg-gray-950/50 border-t border-gray-800">
              <button
                onClick={startGame}
                disabled={gameState.phase !== "waiting"}
                className={`w-full py-2 rounded font-bold text-sm ${gameState.phase === "waiting" ? "bg-green-600 hover:bg-green-500" : "bg-gray-800 text-gray-600"}`}>
                {gameState.phase === "waiting"
                  ? "Start Game"
                  : "Hand in Progress"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
