"use client";

import { useState } from "react";
import { Game } from "../types/chess";
import GameViewer from "./chessboard"; 
const ChessboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a1 1 0 011 1v1h-2V3a1 1 0 011-1zM9 5v1H7V5h2zm2 0h2V5h-2v1zM5 7v2h1V7H5zM4 9a1 1 0 01-1-1V7a1 1 0 011-1h1v2H4zm1 2v2H4v-2h1zm0 2h1v2H5v-2zm2 2v-2h2v2H7zm2 0h2v-2H9v2zm2-2v2h1v-2h-1zm1-2h-1V9h1v2zm1-2a1 1 0 00-1-1h-1v2h2V8a1 1 0 00-1-1zm-4 4H9v2h2v-2zm-2-2H7v2h2V9zM7 7h2v2H7V7zm2-2h2v2H9V5zm4 4h-2V9h2v2zm2-2V7h-2v2h2z" />
        <path fillRule="evenodd" d="M18 3a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1h2a1 1 0 001-1V3zM3 14a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1H4a1 1 0 00-1 1v2zm0-7a1 1 0 001 1h2a1 1 0 001-1V6a1 1 0 00-1-1H4a1 1 0 00-1 1v2zm12 7a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 00-1-1h-2a1 1 0 00-1 1v2z" clipRule="evenodd" />
    </svg>
);

const ExternalLinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
);

const PlayerInfo = ({ username, rating, result }: { username: string; rating?: number; result?: string }) => {
    const isWinner = result === 'win';
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <span className={`font-bold text-lg ${isWinner ? 'text-white' : 'text-slate-300'}`}>
                    {username}
                </span>
                <span className="text-slate-400">({rating || 'N/A'})</span>
            </div>
            {isWinner && (
                <span className="text-xs font-bold text-green-400 bg-green-900/50 px-2 py-1 rounded-md">
                    WIN
                </span>
            )}
        </div>
    );
};

type GameCardProps = {
    game: Game;
    onShowBoard?: (game: Game) => void;
    onHideBoard?: () => void;
    isSelected?: boolean;
};

export default function GameCard({ game, onShowBoard, onHideBoard, isSelected = false }: GameCardProps) {
    const [showBoard, setShowBoard] = useState(false);

    const handleToggleBoard = () => {
        if (showBoard || isSelected) {
            // Hide board
            setShowBoard(false);
            onHideBoard?.();
        } else {
            // Show board
            setShowBoard(true);
            onShowBoard?.(game);
        }
    };

    const gameDate = new Date(game.end_time * 1000).toLocaleDateString("en-US", {
        year: '2-digit', month: 'short', day: 'numeric'
    });

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl shadow-lg mb-6 overflow-hidden transition-all duration-300 hover:border-slate-500">
          
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                   
                    <div className="md:col-span-2 space-y-3">
                        <PlayerInfo username={game.white.username} rating={game.white.rating} result={game.white.result} />
                        <div className="pl-4 text-slate-500 text-sm">vs</div>
                        <PlayerInfo username={game.black.username} rating={game.black.rating} result={game.black.result} />
                    </div>

                    <div className="md:col-span-1 md:border-l md:pl-4 border-slate-700 flex flex-col items-start md:items-end h-full">
                        <div className="text-right text-slate-400 text-sm">
                            <div>{game.time_class}</div>
                            <div className="font-mono">{gameDate}</div>
                        </div>
                        <div className="flex-grow" />
                        <div className="w-full mt-4 flex flex-col space-y-2">
                             <button
                                onClick={handleToggleBoard}
                                className={`w-full flex items-center justify-center ${
                                    isSelected ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'
                                } rounded-lg px-4 py-2 font-semibold text-white transition-colors duration-200`}
                            >
                                <ChessboardIcon />
                                {isSelected ? "Hide Board" : "Show Board"}
                            </button>
                             <a
                                href={game.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-lg px-4 py-2 font-semibold text-slate-200 transition-colors duration-200"
                            >
                                View on Chess.com
                                <ExternalLinkIcon />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}