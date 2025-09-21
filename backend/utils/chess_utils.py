import chess
import chess.pgn
from io import StringIO

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
