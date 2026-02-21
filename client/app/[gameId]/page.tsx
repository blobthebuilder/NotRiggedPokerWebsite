"use client";

import { useEffect, useState, useRef, use } from "react";
import { io, Socket } from "socket.io-client";
import { HostSidebar } from "@/components/HostSidebar";
import { PokerTable } from "@/components/PokerTable";
import { PlayerSeat } from "@/components/PlayerSeat";
import { ActionHUD } from "@/components/ActionHUD";
import { NameModal } from "@/components/NameModal";
import { BuyInModal } from "@/components/BuyInModal";

interface RouteParams {
  gameId: string;
}

export default function GameRoom({ params }: { params: Promise<RouteParams> }) {
  const resolvedParams = use(params);
  const gameId = resolvedParams.gameId;

  const [gameState, setGameState] = useState<any>(null);
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

  // NEW: State to hold the winner and revealed cards during showdown
  const [showdownData, setShowdownData] = useState<any>(null);

  const [isLeaving, setIsLeaving] = useState(false);
  const [isHostSidebarOpen, setIsHostSidebarOpen] = useState(true);

  const [showNameModal, setShowNameModal] = useState(false);

  const [showBuyInModal, setShowBuyInModal] = useState(false);
  const [selectedSeatIndex, setSelectedSeatIndex] = useState<number | null>(
    null,
  );

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

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_game", { gameId, playerId: localPlayerId });
      if (token) {
        socket.emit("join_host_room", { gameId, hostToken: token });
      }
    });

    socket.on("game_state_sync", (state) => {
      setGameState(state);
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

    // Helper to hide status after 3 seconds
    const showStatus = (msg: string) => {
      setSettingsStatus(msg);
      setTimeout(() => setSettingsStatus(null), 3000);
    };

    return () => {
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

  if (!gameState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        Loading Table...
      </div>
    );
  }

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
      />

      <div className="flex-1 p-8 flex flex-col overflow-y-auto relative">
        <div className="mb-4 flex justify-between items-start">
          {/* TOP HEADER AREA */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none z-50">
            {/* Left Side: Host Toggle (Handled inside HostSidebar) */}
            <div className="pointer-events-auto">
              {/* This space is where the Host "Controls" button lives */}
            </div>

            {/* Right Side: Stand Up Button */}
            <div className="pointer-events-auto">
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
            </div>
          </div>

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
        />
      </div>
    </div>
  );
}
