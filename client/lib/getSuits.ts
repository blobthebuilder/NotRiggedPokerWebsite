// Helper to get suit icon and color
export const getSuitDetails = (suit: string) => {
  switch (suit?.toLowerCase()) {
    case "hearts":
      return { icon: "♥", color: "text-red-600" };
    case "diamonds":
      return { icon: "♦", color: "text-blue-500" }; // Or text-red-600 if you prefer classic 2-color
    case "clubs":
      return { icon: "♣", color: "text-green-600" }; // Or text-black if you prefer classic 2-color
    case "spades":
      return { icon: "♠", color: "text-black" };
    default:
      return { icon: "?", color: "text-gray-400" };
  }
};
