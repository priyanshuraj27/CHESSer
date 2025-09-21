import { Game } from "@/types/chess";

export async function fetchRecentGames(username: string): Promise<Game[]> {
  // Get archives first
  const archiveRes = await fetch(
    `https://api.chess.com/pub/player/${username}/games/archives`
  );
  if (!archiveRes.ok) throw new Error("Failed to fetch archives");
  const archives = await archiveRes.json();

  // Get the latest month archive
  const latestArchive = archives.archives.pop();
  if (!latestArchive) return [];

  const gamesRes = await fetch(latestArchive);
  if (!gamesRes.ok) throw new Error("Failed to fetch games");
  const data = await gamesRes.json();

  return data.games || [];
}
