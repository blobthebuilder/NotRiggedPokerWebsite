import React, { useState } from "react";

interface AdjustChipsModalProps {
  seats: any[];
  onClose: () => void;
  onAdjust: (seatIndex: number, amount: number) => void;
}

export const AdjustChipsModal = ({
  seats,
  onClose,
  onAdjust,
}: AdjustChipsModalProps) => {
  // We track local changes before hitting "Apply"
  const [adjustments, setAdjustments] = useState<{ [key: number]: number }>({});

  const handleChange = (index: number, val: string) => {
    setAdjustments({ ...adjustments, [index]: parseInt(val) || 0 });
  };

  const handleApply = () => {
    Object.entries(adjustments).forEach(([index, amount]) => {
      if (amount !== 0) {
        onAdjust(parseInt(index), amount);
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 p-6 rounded-3xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Adjust Player Chips</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-2xl">
            &times;
          </button>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
          {seats.map((seat, index) => {
            if (!seat) return null;
            return (
              <div
                key={index}
                className="flex items-center justify-between bg-gray-850 p-3 rounded-xl border border-gray-800">
                <div className="flex flex-col">
                  <span className="text-white font-bold text-sm">
                    {seat.name}
                  </span>
                  <span className="text-gray-500 text-xs">
                    Current: ${seat.chips}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500 font-mono">
                    Add/Sub:
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    onChange={(e) => handleChange(index, e.target.value)}
                    className="w-20 bg-black border border-gray-700 rounded-lg p-2 text-center text-sm text-blue-400 font-bold focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 py-3 rounded-xl font-bold text-gray-400">
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold text-white transition-all">
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
