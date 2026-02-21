import React, { useState } from "react";

interface BuyInModalProps {
  seatIndex: number;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}

export const BuyInModal = ({
  seatIndex,
  onClose,
  onSubmit,
}: BuyInModalProps) => {
  const [amount, setAmount] = useState(1000);

  const handleSubmit = () => {
    if (amount > 0) {
      onSubmit(amount);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center animate-fade-in-down">
        <h2 className="text-2xl font-bold text-white mb-2">Take a Seat</h2>
        <p className="text-gray-400 text-sm mb-6">
          How many chips would you like to bring to Seat {seatIndex + 1}?
        </p>

        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 font-bold text-xl">
            $
          </span>
          <input
            autoFocus
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 pl-10 text-white text-center font-bold text-2xl focus:border-green-500 outline-none transition-all"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-4 rounded-xl font-bold transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold text-white transition-all active:scale-95 shadow-lg shadow-green-900/20">
            Request Seat
          </button>
        </div>
      </div>
    </div>
  );
};
