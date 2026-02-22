"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "waking">("idle");

  // BACKGROUND PING: Wake the server as soon as the user lands on the page
  useEffect(() => {
    const wakeServer = async () => {
      try {
        // Just a simple GET request to the base URL or any endpoint
        await fetch(`${process.env.NEXT_PUBLIC_SOCKET_URL}/api/games`, {
          method: "GET",
          mode: "no-cors", // We don't even need to read the response, just "hit" it
        });
        console.log("Server wakeup ping sent.");
      } catch (e) {
        // Ignore errors, we just want to trigger the boot process
      }
    };
    wakeServer();
  }, []);

  const handleCreateGame = async () => {
    setStatus("loading");

    // If the server doesn't respond in 3.5 seconds, show the "Waking" message
    const wakingTimer = setTimeout(() => {
      setStatus("waking");
    }, 3500);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SOCKET_URL}/api/games`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      clearTimeout(wakingTimer);

      if (response.status === 503) {
        const data = await response.json();
        alert(data.message);
        setStatus("idle");
        return;
      }

      if (!response.ok) throw new Error("Server error");

      const { gameId, hostToken } = await response.json();
      document.cookie = `poker_host_${gameId}=${hostToken}; path=/; max-age=86400; SameSite=Strict`;

      router.push(`/${gameId}`);
    } catch (error) {
      console.error("Failed to create game:", error);
      clearTimeout(wakingTimer);
      setStatus("idle");

      // Feedback for the cold start
      alert(
        "The game server is waking up from standby. Please wait about 30 seconds and try again!",
      );
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-green-950 text-white relative overflow-hidden">
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>

      {/* Decorative Table Border */}
      <div className="absolute w-[120%] h-[120%] border-[40px] border-amber-900/40 rounded-[100%] pointer-events-none"></div>

      <div className="text-center z-10">
        <h1 className="text-7xl font-black mb-2 tracking-tighter italic drop-shadow-2xl">
          POKER<span className="text-blue-500">NIGHT</span>
        </h1>
        <p className="text-green-400 mb-12 font-medium tracking-widest uppercase text-xs">
          Private Tables • Real-Time Action • Instant Play
        </p>

        <div className="flex flex-col items-center">
          <button
            onClick={handleCreateGame}
            disabled={status !== "idle"}
            className={`group relative px-10 py-5 rounded-2xl text-xl font-bold transition-all shadow-2xl overflow-hidden ${
              status !== "idle"
                ? "bg-gray-800 text-gray-500 cursor-wait"
                : "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white"
            }`}>
            <span className="relative z-10 flex items-center gap-2">
              {status === "idle" && "Create New Game"}
              {status === "loading" && "Connecting..."}
              {status === "waking" && "Waking Server..."}
            </span>

            {/* Glossy Button Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>

          {status === "waking" && (
            <div className="mt-6 flex flex-col items-center animate-fade-in-down">
              <div className="w-12 h-1 bg-gray-800 rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-blue-500 animate-[loading_2s_ease-in-out_infinite]"></div>
              </div>
              <p className="text-xs text-blue-300 font-bold uppercase tracking-widest">
                Standby: Waking the dealer...
              </p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes loading {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </main>
  );
}
