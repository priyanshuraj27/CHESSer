"use client";

import { useState } from "react";
import { fetchRecentGames } from "../../lib/chessAPI";
import GameCard from "../../components/gameCard";
import GameViewer from "../../components/chessboard";
import { Game } from "../../types/chess";
import React from "react";

// --- Icon ---
const Spinner = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

export default function GamesPage() {
    const [username, setUsername] = useState("GMHikaru");
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [searched, setSearched] = useState(false);
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);

    const handleFetch = async () => {
        if (!username.trim()) return;
        setLoading(true);
        setError("");
        setGames([]);
        setSearched(true);

        try {
            const data = await fetchRecentGames(username.trim().toLowerCase());
            if (data.length === 0) {
                setError(`No recent games found for "${username}".`);
            } else {
                const sortedGames = data.sort((a: Game, b: Game) => b.end_time - a.end_time);
                setGames(sortedGames);
            }
        } catch (err) {
            setError("Failed to fetch games. Please check the username and try again.");
            setGames([]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === "Enter") {
            handleFetch();
        }
    };

    return (
        <div className="bg-slate-900 min-h-screen text-slate-300 font-sans">
            <div className={`transition-all duration-300 ${selectedGame ? 'flex' : 'block'}`}>
                {/* Left side - Game list */}
                <div className={`${selectedGame ? 'w-1/2 pr-4' : 'max-w-3xl mx-auto'} p-6 pt-10`}>
                    <div className="text-center">
                        <h1 className="text-4xl font-extrabold text-white">Chess Game Explorer</h1>
                        <p className="mt-2 text-slate-400">Find recent games from any Chess.com player.</p>
                    </div>

                    <div className="flex gap-2 mt-8 sticky top-6 z-10 bg-slate-900/80 backdrop-blur-sm py-4">
                        <input
                            type="text"
                            placeholder="e.g., MagnusCarlsen"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                        <button
                            onClick={handleFetch}
                            disabled={loading || !username.trim()}
                            className="bg-indigo-600 text-white px-5 py-3 rounded-lg font-semibold flex items-center justify-center hover:bg-indigo-500 transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            {loading ? <Spinner /> : "Search"}
                        </button>
                    </div>

                    <div className="mt-8">
                        {error && <p className="text-red-400 text-center p-4">{error}</p>}
                        {games.length === 0 && searched && !loading && !error && (
                             <p className="text-slate-500 text-center p-4">No results found.</p>
                        )}
                        {games.map((game) => (
                            <GameCard 
                                key={game.url} 
                                game={game} 
                                onShowBoard={(game) => setSelectedGame(game)}
                                onHideBoard={() => setSelectedGame(null)}
                                isSelected={selectedGame?.url === game.url}
                            />
                        ))}
                    </div>
                </div>

                {/* Right side - Large chessboard */}
                {selectedGame && (
                    <div className="w-1/2 p-6 pt-10 bg-slate-800/30 border-l border-slate-700">
                        <div className="sticky top-10">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-bold text-white">Game Analysis</h2>
                                <button
                                    onClick={() => setSelectedGame(null)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            
                            <div className="bg-slate-800 rounded-lg p-4 mb-4">
                                <div className="text-sm text-slate-400 mb-2">
                                    {selectedGame.white.username} ({selectedGame.white.rating}) vs {selectedGame.black.username} ({selectedGame.black.rating})
                                </div>
                                <div className="text-xs text-slate-500">
                                    {selectedGame.time_class} • {new Date(selectedGame.end_time * 1000).toLocaleDateString()}
                                </div>
                            </div>
                            
                            {selectedGame.pgn && (
                                <GameViewer pgn={selectedGame.pgn} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}