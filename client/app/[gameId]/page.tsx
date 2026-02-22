"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { HostSidebar } from "@/components/HostSidebar";
import { PokerTable } from "@/components/PokerTable";
import { PlayerSeat } from "@/components/PlayerSeat";
import { ActionHUD } from "@/components/ActionHUD";
import { NameModal } from "@/components/NameModal";
import { BuyInModal } from "@/components/BuyInModal";
import { GameLogModal } from "@/components/GameLogModal";

interface RouteParams {
  gameId: string;
}

export default function GameRoom({ params }: { params: Promise<RouteParams> }) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;

  const router = useRouter();

  const [gameState, setGameState] = useState<any>(null);
  const [gameExists, setGameExists] = useState(true);
  const [serverDown, setServerDown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [hostToken, setHostToken] = useState<string | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState("");

  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const [newSmallBlind, setNewSmallBlind] = useState(10);
  const [newBigBlind, setNewBigBlind] = useState(20);
  const [newTimeout, setNewTimeout] = useState(30);

  const socketRef = useRef<Socket | null>(null);

  // Gameplay info
  const [myCards, setMyCards] = useState<any[]>([]);
  const [isRaising, setIsRaising] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);

  // NEW: State to hold the winner and revealed cards during showdown
  const [showdownData, setShowdownData] = useState<any>(null);

  // menu info
  const [isHostSidebarOpen, setIsHostSidebarOpen] = useState(true);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showBuyInModal, setShowBuyInModal] = useState(false);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(
    null,
  );
  const [showLogModal, setShowLogModal] = useState(false);

  // --- VIDEO STATES ---
  const [isVideoEnabled, setIsVideoEnabled] = useState(false); // Default to off
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [peerStreams, setPeerStreams] = useState<Record<string, MediaStream>>(
    {},
  );
  const peerInstance = useRef<any>(null);

  // --- VIDEO CHAT INITIALIZATION (LAZY LOADED) ---
  useEffect(() => {
    // If the user hasn't toggled the camera on, do nothing!
    if (!isVideoEnabled || !playerId) return;

    let localStream: MediaStream;
    let peer: any;

    const initVideo = async () => {
      try {
        // 1. Request camera ONLY NOW
        localStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 160 },
            height: { ideal: 120 },
            frameRate: { ideal: 15 },
          },
          audio: false,
        });
        setMyStream(localStream);

        // 2. Start PeerJS
        const Peer = (await import("peerjs")).default;
        peer = new Peer();
        peerInstance.current = peer;

        peer.on("open", (id: string) => {
          socketRef.current?.emit("video_peer_ready", {
            gameId,
            peerId: id,
            playerId,
          });
        });

        peer.on("call", (call: any) => {
          call.answer(localStream);
          call.on("stream", (remoteStream: MediaStream) => {
            setPeerStreams((prev) => ({
              ...prev,
              [call.metadata.playerId]: remoteStream,
            }));
          });
        });

        socketRef.current?.on(
          "user_video_joined",
          ({ peerId: remotePeerId, playerId: remotePlayerId }: any) => {
            const call = peer.call(remotePeerId, localStream, {
              metadata: { playerId },
            });
            call.on("stream", (remoteStream: MediaStream) => {
              setPeerStreams((prev) => ({
                ...prev,
                [remotePlayerId]: remoteStream,
              }));
            });
          },
        );
      } catch (e) {
        console.error("Camera access denied or unavailable:", e);
        setIsVideoEnabled(false); // Reset the button if they click "Deny" on the popup
      }
    };

    initVideo();

    // CLEANUP: When they toggle the camera off, kill the stream and close connections
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop()); // Turns off the webcam light
      }
      if (peer) {
        peer.destroy(); // Disconnects from the mesh
      }
      socketRef.current?.off("user_video_joined");
      setMyStream(null);
      setPeerStreams({});
    };
  }, [isVideoEnabled, gameId, playerId]);

  // load game
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift();
      return null;
    };

    const token = getCookie(`poker_host_${gameId}`);
    if (token) {
      setIsHost(true);
      setHostToken(token);
    }

    let localPlayerId = getCookie("poker_playerId");
    if (!localPlayerId) {
      localPlayerId = Math.random().toString(36).substring(2, 9);
      document.cookie = `poker_playerId=${localPlayerId}; path=/; max-age=86400; SameSite=Strict`;
    }
    setPlayerId(localPlayerId);

    let localPlayerName = getCookie("poker_playerName");
    if (!localPlayerName) {
      setShowNameModal(true);
      document.cookie = `poker_playerName=${localPlayerName}; path=/; max-age=86400; SameSite=Strict`;
    } else {
      setPlayerName(localPlayerName);
    }

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
      reconnectionAttempts: 2, // Try to connect 3 times before giving up
      timeout: 5000, // 10 second connection timeout
    });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("Socket connection failed:", err.message);
      clearTimeout(connectionTimeout); // Stop the watchdog
      setServerDown(true); // <--- SPECIFIC SERVER DOWN STATE
      setIsLoading(false);
    });

    socket.on("connect", () => {
      setServerDown(false);
      socket.emit("join_game", { gameId, playerId: localPlayerId });
      if (token) {
        socket.emit("join_host_room", { gameId, hostToken: token });
      }
    });

    // If we don't get a game_state_sync within 7 seconds, trigger the error
    const connectionTimeout = setTimeout(() => {
      if (isLoading) {
        console.error("No game state received - Table likely missing");
        setGameExists(false); // <--- SPECIFIC GAME MISSING STATE
        setIsLoading(false);
      }
    }, 7000);

    socket.on("game_state_sync", (state) => {
      clearTimeout(connectionTimeout);
      // If the server sends an empty state, treat it as a missing game.
      if (!state) {
        console.error("Received null game state");
        setGameExists(false);
        setIsLoading(false);
        return;
      }

      setGameState(state);
      setIsLoading(false);
      setNewSmallBlind(state.settings.smallBlind);
      setNewBigBlind(state.settings.bigBlind);
      setNewTimeout(state.settings.turnTimeoutMs / 1000);

      // Clear showdown data if we move to a new hand
      if (state.phase !== "showdown") {
        setShowdownData(null);
      }
    });

    // NEW: Listen for the round end to display winner & cards
    socket.on("round_ended", (data) => {
      setShowdownData(data);
    });

    socket.on("seat_request_pending", (request) => {
      setPendingRequests((prev) => [...prev, request]);
    });

    socket.on("seat_updated", ({ seatIndex, player }) => {
      setGameState((prev: any) => {
        if (!prev) return prev;
        const newSeats = [...prev.seats];
        newSeats[seatIndex] = player;
        return { ...prev, seats: newSeats };
      });
    });

    socket.on("seat_approved", () => setHasPendingRequest(false));

    socket.on("seat_rejected", ({ reason }) => {
      setHasPendingRequest(false);
      alert(reason || "Your seat request was rejected.");
    });

    socket.on("settings_updated", (newSettings) => {
      setGameState((prev: any) => {
        if (!prev) return prev;
        return { ...prev, settings: newSettings };
      });
    });

    socket.on("private_cards", (cards) => {
      setMyCards(cards);
    });

    socket.on("stand_up_queued", () => {
      setIsLeaving(true);
    });

    socket.on("stood_up", () => {
      setIsLeaving(false);
      setMyCards([]); // Clear your private cards just in case
    });

    socket.on("settings_updated", (newSettings) => {
      setGameState((prev: any) => ({ ...prev, settings: newSettings }));
      showStatus("Settings Applied!");
    });

    socket.on("settings_queued", () => {
      showStatus("Queued for next hand");
    });

    socket.on("chips_adjusted", ({ seatIndex, newTotal }) => {
      setGameState((prev: any) => {
        if (!prev) return prev;
        const newSeats = [...prev.seats];
        if (newSeats[seatIndex]) {
          // Update total chips and clear any local pending status
          newSeats[seatIndex] = {
            ...newSeats[seatIndex],
            chips: newTotal,
            queuedAdjustment: 0,
          };
        }
        return { ...prev, seats: newSeats };
      });
    });

    socket.on("adjustment_queued", ({ seatIndex, amountDelta }) => {
      setGameState((prev: any) => {
        if (!prev) return prev;
        const newSeats = [...prev.seats];
        if (newSeats[seatIndex]) {
          // Track the pending amount locally so the UI can show it
          const currentQueued = newSeats[seatIndex].queuedAdjustment || 0;
          newSeats[seatIndex] = {
            ...newSeats[seatIndex],
            queuedAdjustment: currentQueued + amountDelta,
          };
        }
        return { ...prev, seats: newSeats };
      });
    });

    socket.on("error", (msg) => {
      if (msg === "Game not found") {
        setGameExists(false);
      }
    });

    socket.on("new_log", (entry) => {
      setGameState((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          logs: [entry, ...(prev.logs || [])], // Add to the top of the array locally
        };
      });
    });

    // Helper to hide status after 3 seconds
    const showStatus = (msg: string) => {
      setSettingsStatus(msg);
      setTimeout(() => setSettingsStatus(null), 3000);
    };

    return () => {
      clearTimeout(connectionTimeout);
      socket.disconnect();
    };
  }, [gameId]);

  useEffect(() => {
    setInviteLink(window.location.href);
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setSettingsStatus("copied"); // Use a specific string to trigger the tiny bubble
    setTimeout(() => setSettingsStatus(null), 2000);
  };
  const handleNameSubmit = (name: string) => {
    document.cookie = `poker_playerName=${name}; path=/; max-age=86400; SameSite=Strict`;
    setPlayerName(name);
    setShowNameModal(false);

    // If socket is already connected, you might want to emit a name update here
    socketRef.current?.emit("update_player_name", { gameId, name });
  };

  const handleAdjustChips = (seatIndex: number, amountDelta: number) => {
    if (!socketRef.current || !isHost) return;

    socketRef.current.emit("host_adjust_chips", {
      gameId,
      hostToken,
      seatIndex,
      amountDelta,
    });
  };
  const handleAction = (actionType: string, amount: number = 0) => {
    if (!socketRef.current) return;
    socketRef.current.emit("player_action", {
      gameId,
      action: actionType,
      amount,
    });
    setIsRaising(false);
  };

  const startGame = () => {
    if (!socketRef.current || !hostToken) return;
    socketRef.current.emit("start_game", { gameId, hostToken });
  };

  const requestSeat = (seatIndex: number) => {
    const alreadySeated = gameState.seats.some(
      (s: any) => s && s.id === playerId,
    );
    if (alreadySeated || hasPendingRequest) return;

    setSelectedSeatIndex(seatIndex);
    setShowBuyInModal(true);
  };

  // The new handler for when the modal is submitted
  const handleBuyInSubmit = (amount: number) => {
    if (!socketRef.current || selectedSeatIndex === null) return;

    if (!isHost) setHasPendingRequest(true);

    socketRef.current.emit("request_seat", {
      gameId,
      seatIndex: selectedSeatIndex,
      buyInAmount: amount,
      playerInfo: { id: playerId, name: playerName },
      hostToken,
    });

    setShowBuyInModal(false);
    setSelectedSeatIndex(null);
  };

  const resolveRequest = (req: any, approved: boolean) => {
    if (!socketRef.current || !hostToken) return;
    socketRef.current.emit("resolve_seat_request", {
      gameId,
      hostToken,
      approved,
      targetSocketId: req.socketId,
      seatIndex: req.seatIndex,
      buyInAmount: req.buyInAmount,
      playerInfo: req.playerInfo,
    });
    setPendingRequests((prev) =>
      prev.filter((r) => r.socketId !== req.socketId),
    );
  };

  const updateSettings = () => {
    if (!socketRef.current || !hostToken) return;
    socketRef.current.emit("update_settings", {
      gameId,
      hostToken,
      settings: {
        smallBlind: newSmallBlind,
        bigBlind: newBigBlind,
        turnTimeoutMs: newTimeout * 1000,
      },
    });
  };

  const standUp = () => {
    if (!socketRef.current) return;
    socketRef.current.emit("stand_up", { gameId });
  };

  // SCREEN A: Server is literally offline (Render sleeping or URL wrong)
  if (serverDown) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-6">
        <div className="bg-gray-900 border border-red-900/50 p-10 rounded-[2rem] shadow-2xl text-center max-w-md border-b-4 border-b-red-600">
          <h2 className="text-3xl font-black mb-3 text-red-500 text-shadow-glow">
            Server Offline
          </h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            The poker server is unreachable. It might be waking up or having
            trouble connecting.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-2xl font-bold transition-all">
            Try Reconnecting
          </button>
        </div>
      </div>
    );
  }

  // SCREEN B: Server is online, but this table ID doesn't exist
  if (!gameExists) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white p-6">
        <div className="bg-gray-900 border border-gray-800 p-10 rounded-[2rem] shadow-2xl text-center max-w-md border-b-4 border-b-blue-600">
          <h2 className="text-3xl font-black mb-3 text-white">
            Table Not Found
          </h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            The table session has ended or the link is invalid.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold transition-all">
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !gameState) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-blue-400 font-bold animate-pulse uppercase tracking-widest text-xs">
          Syncing with Table...
        </p>
      </div>
    );
  }

  // 3. NOW IT IS SAFE TO READ gameState
  const mySeatIndex = gameState.seats.findIndex(
    (s: any) => s && s.id === playerId,
  );
  const alreadySeated = mySeatIndex !== -1;
  const disableSeating = alreadySeated || hasPendingRequest;
  const isMyTurn =
    mySeatIndex === gameState.currentTurnIndex &&
    gameState.phase !== "waiting" &&
    gameState.phase !== "showdown";

  return (
    <div className="min-h-screen bg-gray-900 flex text-white overflow-hidden">
      {showNameModal && <NameModal onNameSubmit={handleNameSubmit} />}
      {showBuyInModal && selectedSeatIndex !== null && (
        <BuyInModal
          seatIndex={selectedSeatIndex}
          onClose={() => setShowBuyInModal(false)}
          onSubmit={handleBuyInSubmit}
        />
      )}
      <HostSidebar
        isOpen={isHostSidebarOpen}
        setIsOpen={setIsHostSidebarOpen}
        isHost={isHost}
        pendingRequests={pendingRequests}
        gameState={gameState}
        resolveRequest={resolveRequest}
        startGame={startGame}
        updateSettings={updateSettings}
        sbState={[newSmallBlind, setNewSmallBlind]}
        bbState={[newBigBlind, setNewBigBlind]}
        timeoutState={[newTimeout, setNewTimeout]}
        settingsStatus={settingsStatus}
        handleAdjustChips={handleAdjustChips}
      />

      <div className="flex-1 p-8 flex flex-col overflow-y-auto relative">
        <div className="mb-4 flex justify-between items-start">
          {/* TOP HEADER AREA */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none z-50">
            {/* Left Side: Host Toggle (Handled inside HostSidebar) */}
            <div className="pointer-events-auto">
              {/* This space is where the Host "Controls" button lives */}
            </div>

            {/* Right Side: Stand Up & Ledger Buttons */}
            <div className="pointer-events-auto flex gap-3">
              {/* --- NEW: CAMERA TOGGLE BUTTON --- */}
              <button
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                className={`px-4 py-2 rounded-lg font-bold text-sm shadow-lg transition-all border flex items-center gap-2 ${
                  isVideoEnabled
                    ? "bg-green-600/20 text-green-400 border-green-600 hover:bg-green-600 hover:text-white"
                    : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700 hover:text-white"
                }`}>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  {isVideoEnabled ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z M3 3l18 18"
                    />
                  )}
                </svg>
                {isVideoEnabled ? "Cam On" : "Cam Off"}
              </button>
              {alreadySeated && (
                <button
                  onClick={standUp}
                  disabled={gameState.seats[mySeatIndex]?.queuedToLeave}
                  className={`px-4 py-2 rounded-lg font-bold text-sm shadow-lg transition-all border ${
                    gameState.seats[mySeatIndex]?.queuedToLeave
                      ? "bg-red-900/80 text-red-400 border-red-700 cursor-not-allowed"
                      : "bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700 hover:text-white"
                  }`}>
                  {gameState.seats[mySeatIndex]?.queuedToLeave
                    ? "Leaving after hand..."
                    : "Stand Up"}
                </button>
              )}

              {/* MOVED LEDGER BUTTON INSIDE THE POINTER-EVENTS-AUTO DIV */}
              <button
                onClick={() => setShowLogModal(true)}
                className="bg-gray-800 text-gray-300 border border-gray-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-700 hover:text-white transition-all shadow-lg flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Ledger
              </button>
            </div>
          </div>

          {/* Keep the modal rendering logic here */}
          {showLogModal && (
            <GameLogModal
              logs={gameState.logs || []}
              onClose={() => setShowLogModal(false)}
            />
          )}

          {/* BOTTOM LEFT: Invite Link */}
          <div className="absolute bottom-6 left-6 z-40 bg-gray-900/60 backdrop-blur-sm p-3 rounded-xl border border-gray-700 hover:border-gray-500 transition-colors group">
            {/* TINY COPY BUBBLE */}
            {settingsStatus === "copied" && (
              <div className="absolute -top-10 left-0 bg-blue-600 text-white text-[10px] font-black py-1 px-3 rounded-full shadow-lg animate-bounce border border-blue-400">
                COPIED!
              </div>
            )}
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
              Invite Players
            </h2>
            <div className="flex items-center space-x-3">
              <a
                href={inviteLink}
                className="text-blue-400 font-mono text-sm hover:text-blue-300 underline underline-offset-4 decoration-blue-900">
                {gameId}
              </a>
              <button
                onClick={copyLink}
                className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700 hover:bg-gray-700 hover:text-white transition-all">
                Copy Link
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              Share this URL with your friends to join.
            </p>
          </div>
        </div>

        <PokerTable gameState={gameState}>
          {gameState.seats.map((seat: any, index: number) => {
            let angle = (index / 10) * (2 * Math.PI);
            if (gameState.phase !== "waiting" && mySeatIndex !== -1) {
              const relativeSeat = (index - mySeatIndex + 10) % 10;
              angle = (relativeSeat / 10) * (2 * Math.PI) + Math.PI / 2;
            }

            return (
              <PlayerSeat
                key={index}
                seat={seat}
                index={index}
                angle={angle}
                isGameActive={gameState.phase !== "waiting"}
                isWinner={
                  gameState.phase === "showdown" &&
                  showdownData?.winners?.some((w: any) => w.id === seat?.id)
                }
                showdownData={showdownData}
                playerId={playerId}
                requestSeat={requestSeat}
                disableSeating={disableSeating}
                hasPendingRequest={hasPendingRequest}
                alreadySeated={alreadySeated}
                turnIndex={gameState.currentTurnIndex}
                phase={gameState.phase}
                dealerIndex={gameState.dealerButtonIndex}
                videoStream={
                  seat?.id === playerId ? myStream : peerStreams[seat?.id]
                }
              />
            );
          })}
        </PokerTable>

        <ActionHUD
          gameState={gameState}
          myCards={myCards}
          playerId={playerId}
          isMyTurn={isMyTurn}
          handleAction={handleAction}
          isRaising={isRaising}
          setIsRaising={setIsRaising}
          raiseAmount={raiseAmount}
          setRaiseAmount={setRaiseAmount}
          showdownData={showdownData}
          handleRevealCard={(cardIndex: number) => {
            socketRef.current?.emit("reveal_card", { gameId, cardIndex });
          }}
          handleRevealAllCards={() => {
            socketRef.current?.emit("reveal_all_cards", { gameId });
          }}
        />
      </div>
    </div>
  );
}
