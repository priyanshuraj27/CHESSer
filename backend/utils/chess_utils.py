import chess
import chess.pgn
from io import StringIO
from typing import List

def parse_pgn_moves(pgn_text: str):
    game = chess.pgn.read_game(StringIO(pgn_text))
    if not game:
        raise ValueError("No valid moves found in PGN.")

    board = game.board()
    moves = []

    # Detect UCI-style moves (like e2e4)
    for node in game.mainline():
        move = node.move
        try:
            san_move = board.san(move)
            moves.append(san_move)
            board.push(move)
        except ValueError:
            # Attempt to parse UCI/LAN move
            try:
                uci_move = chess.Move.from_uci(str(move))
                san_move = board.san(uci_move)
                moves.append(san_move)
                board.push(uci_move)
            except Exception as e:
                raise ValueError(f"Illegal move or error parsing move {move}: {e}")
    return moves

def pgn_to_fens(pgn_text: str, every_n_moves: int = 1) -> List[str]:
    """
    Convert PGN to list of FEN strings, sampling every N moves
    """
    try:
        game = chess.pgn.read_game(StringIO(pgn_text))
        if not game:
            raise ValueError("No valid game found in PGN.")
        
        board = game.board()
        fens = [board.fen()]  # Starting position
        move_count = 0
        
        for node in game.mainline():
            board.push(node.move)
            move_count += 1
            
            # Sample every N moves
            if move_count % every_n_moves == 0:
                fens.append(board.fen())
        
        # Always include final position if not already included
        if move_count % every_n_moves != 0:
            fens.append(board.fen())
            
        return fens
        
    except Exception as e:
        raise ValueError(f"Error parsing PGN: {e}")

def fen_to_move_number(pgn_text: str, target_fen: str) -> int:
    """
    Find which move number corresponds to a given FEN
    """
    try:
        game = chess.pgn.read_game(StringIO(pgn_text))
        if not game:
            return 0
        
        board = game.board()
        if board.fen() == target_fen:
            return 0
        
        move_number = 0
        for node in game.mainline():
            board.push(node.move)
            move_number += 1
            if board.fen() == target_fen:
                return move_number
                
        return -1  # FEN not found
        
    except Exception:
        return -1
