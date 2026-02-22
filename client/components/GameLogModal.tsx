import React from "react";

interface GameLogModalProps {
  logs: any[];
  onClose: () => void;
}

export const GameLogModal = ({ logs, onClose }: GameLogModalProps) => {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 p-6 rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white">Table Ledger</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-3xl leading-none">
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
          {(!logs || logs.length === 0) && (
            <p className="text-gray-500 text-center italic mt-10">
              No history yet.
            </p>
          )}

          {logs?.map((log) => (
            <div
              key={log.id}
              className="bg-gray-800/50 border border-gray-700/50 p-4 rounded-xl text-sm">
              <span className="text-[10px] text-gray-500 block mb-2 font-mono">
                {new Date(log.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              {log.type === "HOST_ADJUSTMENT" && (
                <div className="text-yellow-500 font-bold flex items-center gap-2">
                  <span>🛠️</span> {log.message}
                </div>
              )}

              {log.type === "HAND_RESULT" && (
                <div className="space-y-2">
                  {log.winners?.map((w: any, i: number) => (
                    <div
                      key={`w-${i}`}
                      className="text-green-400 font-bold flex justify-between bg-green-900/20 p-2 rounded">
                      <span>
                        🏆 {w.name} won ${w.won}
                      </span>
                      <span className="text-green-500/70 text-xs uppercase">
                        {w.reason}
                      </span>
                    </div>
                  ))}

                  {log.losers?.length > 0 && (
                    <div className="text-gray-400 text-xs border-t border-gray-700 pt-2 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="font-bold text-gray-500">Lost:</span>
                      {log.losers.map((l: any, i: number) => (
                        <span
                          key={`l-${i}`}
                          className="text-red-400/80">
                          {l.name} (-${l.lost})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
