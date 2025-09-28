"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import GameViewer from "../../components/chessboard";
import { Game } from "../../types/chess";

function AnalysisContent() {
    const searchParams = useSearchParams();
    const [game, setGame] = useState<Game | null>(null);
    const [initialMoveIndex, setInitialMoveIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get game data from URL parameters
        const gameData = searchParams.get('game');
        const moveParam = searchParams.get('move');
        
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
                
                // Set initial move index if provided
                if (moveParam) {
                    const moveIndex = parseInt(moveParam, 10);
                    if (!isNaN(moveIndex)) {
                        setInitialMoveIndex(moveIndex);
                    }
                }
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
                    
                    {/* Enhanced Game Info */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-6 shadow-lg">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Players */}
                            <div className="lg:col-span-2">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-white">Match Details</h3>
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {new Date(game.end_time * 1000).toLocaleDateString('en-US', { 
                                            year: 'numeric', 
                                            month: 'long', 
                                            day: 'numeric' 
                                        })}
                                    </div>
                                </div>
                                
                                <div className="bg-slate-900/50 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 bg-white rounded-full"></div>
                                            <div>
                                                <span className={`font-bold text-lg ${game.white.result === 'win' ? 'text-green-400' : 'text-slate-200'}`}>
                                                    {game.white.username}
                                                </span>
                                                <span className="text-slate-400 ml-2">({game.white.rating || 'Unrated'})</span>
                                            </div>
                                        </div>
                                        {game.white.result === 'win' && (
                                            <span className="text-xs font-bold text-green-400 bg-green-900/50 px-3 py-1 rounded-full">
                                                WINNER
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="text-center py-2">
                                        <span className="text-2xl font-bold text-slate-300">
                                            {game.white.result === 'win' ? '1' : 
                                             game.black.result === 'win' ? '0' : '½'}
                                            -
                                            {game.black.result === 'win' ? '1' : 
                                             game.white.result === 'win' ? '0' : '½'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 bg-gray-900 rounded-full border border-gray-600"></div>
                                            <div>
                                                <span className={`font-bold text-lg ${game.black.result === 'win' ? 'text-green-400' : 'text-slate-200'}`}>
                                                    {game.black.username}
                                                </span>
                                                <span className="text-slate-400 ml-2">({game.black.rating || 'Unrated'})</span>
                                            </div>
                                        </div>
                                        {game.black.result === 'win' && (
                                            <span className="text-xs font-bold text-green-400 bg-green-900/50 px-3 py-1 rounded-full">
                                                WINNER
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Game Stats */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Game Info</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                                        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <div>
                                            <div className="text-slate-400 text-xs">Time Control</div>
                                            <div className="text-white font-semibold capitalize">{game.time_class}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                                        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <div>
                                            <div className="text-slate-400 text-xs">Game Type</div>
                                            <div className="text-white font-semibold">Live Chess</div>
                                        </div>
                                    </div>
                                    
                                    <a
                                        href={game.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-lg font-medium transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        View on Chess.com
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
                            <GameViewer pgn={game.pgn} gameData={game} initialMoveIndex={initialMoveIndex} />
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
