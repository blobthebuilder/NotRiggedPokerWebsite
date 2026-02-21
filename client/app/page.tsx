"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateGame = async () => {
    setIsCreating(true);
    try {
      const response = await fetch("http://localhost:3001/api/games", {
        method: "POST",
      });

      const { gameId, hostToken } = await response.json();
      // Save the host token so this user has admin rights when they join
      document.cookie = `poker_host_${gameId}=${hostToken}; path=/; max-age=86400; SameSite=Strict`;

      // Navigate to the dynamic game route
      router.push(`/${gameId}`);
    } catch (error) {
      console.error("Failed to create game:", error);
      setIsCreating(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-green-900 text-white">
      <h1 className="text-5xl font-bold mb-8">Next.js Poker</h1>
      <button
        onClick={handleCreateGame}
        disabled={isCreating}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-semibold transition">
        {isCreating ? "Dealing..." : "Create New Game"}
      </button>
    </main>
  );
}
