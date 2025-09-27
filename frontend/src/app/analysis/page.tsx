"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import GameViewer from "../../components/chessboard";
import { Game } from "../../types/chess";

function AnalysisContent() {
    const searchParams = useSearchParams();
    const [game, setGame] = useState<Game | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get game data from URL parameters
        const gameData = searchParams.get('game');
        if (gameData) {
            try {
                // Try base64 decoding first (new method), fallback to URL decoding (old method)
                let parsedGame: Game;
                try {
                    // Decode from base64
                    const decodedData = atob(gameData);
                    parsedGame = JSON.parse(decodedData);
                } catch (base64Error) {
                    try {
                        // Fallback to URL decoding for backward compatibility
                        parsedGame = JSON.parse(decodeURIComponent(gameData));
                    } catch (urlError) {
                        // Last resort: try parsing directly
                        parsedGame = JSON.parse(gameData);
                    }
                }
                setGame(parsedGame);
            } catch (error) {
                console.error('Error parsing game data:', error);
                console.error('Game data received:', gameData?.substring(0, 200) + '...');
            }
        }
        setLoading(false);
    }, [searchParams]);

    if (loading) {
        return (
            <div className="bg-slate-900 min-h-screen text-slate-300 font-sans flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading analysis...</p>
                </div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="bg-slate-900 min-h-screen text-slate-300 font-sans flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">No Game Selected</h1>
                    <p className="text-slate-400 mb-6">Please select a game to analyze.</p>
                    <a
                        href="/games"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                    >
                        Back to Games
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-900 min-h-screen text-slate-300 font-sans">
            <div className="max-w-4xl mx-auto p-6">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-4xl font-extrabold text-white">Game Analysis</h1>
                        <a
                            href="/games"
                            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Games
                        </a>
                    </div>
                    
                    {/* Game Info */}
                    <div className="bg-slate-800 rounded-lg p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-3">Players</h3>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className={`font-bold ${game.white.result === 'win' ? 'text-green-400' : 'text-slate-300'}`}>
                                            {game.white.username}
                                        </span>
                                        <span className="text-slate-400">({game.white.rating || 'N/A'})</span>
                                        {game.white.result === 'win' && (
                                            <span className="text-xs font-bold text-green-400 bg-green-900/50 px-2 py-1 rounded-md">
                                                WIN
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-slate-500 text-sm text-center">vs</div>
                                    <div className="flex items-center justify-between">
                                        <span className={`font-bold ${game.black.result === 'win' ? 'text-green-400' : 'text-slate-300'}`}>
                                            {game.black.username}
                                        </span>
                                        <span className="text-slate-400">({game.black.rating || 'N/A'})</span>
                                        {game.black.result === 'win' && (
                                            <span className="text-xs font-bold text-green-400 bg-green-900/50 px-2 py-1 rounded-md">
                                                WIN
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-3">Game Details</h3>
                                <div className="space-y-2 text-slate-400">
                                    <div className="flex justify-between">
                                        <span>Time Control:</span>
                                        <span className="text-slate-300">{game.time_class}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Date:</span>
                                        <span className="text-slate-300">
                                            {new Date(game.end_time * 1000).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Result:</span>
                                        <span className="text-slate-300">
                                            {game.white.result === 'win' ? '1-0' : 
                                             game.black.result === 'win' ? '0-1' : '½-½'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="mt-4">
                                    <a
                                        href={game.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        View on Chess.com
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis Section */}
                <div className="bg-slate-800/30 rounded-lg p-6">
                    <h2 className="text-2xl font-bold text-white mb-6">Interactive Analysis</h2>
                    {game.pgn ? (
                        <div className="flex justify-center">
                            <GameViewer pgn={game.pgn} gameData={game} />
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 py-8">
                            <p>No PGN data available for this game.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AnalysisPage() {
    return (
        <Suspense fallback={
            <div className="bg-slate-900 min-h-screen text-slate-300 font-sans flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading analysis...</p>
                </div>
            </div>
        }>
            <AnalysisContent />
        </Suspense>
    );
}
