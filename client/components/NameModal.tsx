import React, { useState } from "react";

interface NameModalProps {
  onNameSubmit: (name: string) => void;
}

export const NameModal = ({ onNameSubmit }: NameModalProps) => {
  const [tempName, setTempName] = useState("");

  const handleSubmit = () => {
    if (tempName.trim()) {
      onNameSubmit(tempName.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center animate-fade-in-down">
        <h2 className="text-2xl font-bold text-white mb-2">
          Welcome to the Table
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          Choose a display name to join the game.
        </p>

        <input
          autoFocus
          type="text"
          placeholder="Enter Name..."
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          className="w-full bg-gray-950 border border-gray-700 rounded-xl p-4 text-white text-center font-bold text-lg mb-4 focus:border-blue-500 outline-none transition-all"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />

        <button
          disabled={!tempName.trim()}
          onClick={handleSubmit}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 py-4 rounded-xl font-bold text-lg transition-all active:scale-95">
          Enter Table
        </button>
      </div>
    </div>
  );
};
