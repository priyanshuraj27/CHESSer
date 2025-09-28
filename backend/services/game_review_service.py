import chess
import chess.pgn
import chess.engine
import asyncio
import io
import math
from typing import List, Dict, Any, Optional, Tuple
import os
from config import STOCKFISH_PATH

class GameReviewService:
    def __init__(self):
        # Use environment variable or local stockfish executable
        if STOCKFISH_PATH and os.path.exists(STOCKFISH_PATH):
            self.stockfish_path = STOCKFISH_PATH
            print(f"🔧 [GAME REVIEW SERVICE] Using STOCKFISH_PATH from environment: {STOCKFISH_PATH}")
        else:
            # Try multiple possible paths to find Stockfish
            possible_paths = [
                # Path relative to current service file
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "engines", "stockfish.exe"),
                # Path relative to current working directory
                os.path.join(os.getcwd(), "engines", "stockfish.exe"),
                # Path in the same directory as main.py
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "engines", "stockfish", "stockfish.exe"),
                # System PATH
                "stockfish.exe",
                "stockfish"
            ]
            
            print(f"🔍 [GAME REVIEW SERVICE] Searching for Stockfish...")
            self.stockfish_path = None
            
            for path in possible_paths:
                print(f"   🔎 Checking: {path}")
                if os.path.exists(path):
                    self.stockfish_path = path
                    print(f"   ✅ Found Stockfish at: {path}")
                    break
                else:
                    print(f"   ❌ Not found at: {path}")
            
            if not self.stockfish_path:
                print(f"💥 [GAME REVIEW SERVICE] No valid Stockfish found in any of the paths!")
                print(f"🔍 [GAME REVIEW SERVICE] Current working directory: {os.getcwd()}")
                print(f"� [GAME REVIEW SERVICE] Script directory: {os.path.dirname(os.path.abspath(__file__))}")
                raise FileNotFoundError("Stockfish executable not found")
        
        print(f"✅ [GAME REVIEW SERVICE] Using Stockfish at: {self.stockfish_path}")
        
        self.analysis_depth = 15
        self.analysis_time = 0.5  # seconds per position
        
        print(f"🤖 [GAME REVIEW SERVICE] Stockfish path: {self.stockfish_path}")
        print(f"📊 [GAME REVIEW SERVICE] Analysis depth: {self.analysis_depth}")
        print(f"⏱️  [GAME REVIEW SERVICE] Analysis time per position: {self.analysis_time}s")
        
    def classify_move(self, eval_before: float, eval_after: float, best_eval: float, is_book_move: bool = False) -> str:
        """
        Chess.com-exact move classification with precise thresholds
        """
        if is_book_move:
            return "book"
            
        # Calculate centipawn loss (Chess.com method)
        eval_loss = abs(best_eval - eval_after) * 100  # Convert to centipawns
        
        # Special case for brilliant moves (Chess.com logic)
        # A brilliant move is a sacrifice that leads to a better position
        eval_gain = (eval_after - eval_before) * 100
        if eval_gain < -100 and eval_loss <= 15:  # Sacrifice but still best/near-best
            return "brilliant"
        
        # Chess.com exact thresholds (community verified)
        if eval_loss <= 15:      # 0-15 centipawns
            return "best"
        elif eval_loss <= 25:    # 16-25 centipawns
            return "excellent"
        elif eval_loss <= 50:    # 26-50 centipawns
            return "good"
        elif eval_loss <= 100:   # 51-100 centipawns
            return "inaccuracy"
        elif eval_loss <= 200:   # 101-200 centipawns
            return "mistake"
        else:                    # 201+ centipawns
            return "blunder"
    
    async def analyze_position(self, board: chess.Board) -> Tuple[Optional[float], Optional[str]]:
        """
        Analyze a single position and return evaluation and best move
        """
        try:
            print(f"   🔧 [ENGINE] Opening Stockfish at: {self.stockfish_path}")
            with chess.engine.SimpleEngine.popen_uci(self.stockfish_path) as engine:
                # Set engine options for faster analysis
                engine.configure({"Threads": 1, "Hash": 128})
                print(f"   🔧 [ENGINE] Analyzing position: {board.fen()}")
                
                info = engine.analyse(
                    board, 
                    chess.engine.Limit(depth=self.analysis_depth, time=self.analysis_time)
                )
                
                print(f"   🔧 [ENGINE] Analysis info: {info}")
                
                score = info["score"].relative
                if score.is_mate():
                    # Convert mate score to large centipawn value
                    eval_cp = 2000 if score.mate() > 0 else -2000
                    print(f"   🔧 [ENGINE] Mate score: {eval_cp}")
                else:
                    eval_cp = score.score()
                    print(f"   🔧 [ENGINE] Centipawn score: {eval_cp}")
                
                best_move = str(info["pv"][0]) if "pv" in info and info["pv"] else None
                print(f"   🔧 [ENGINE] Best move: {best_move}")
                
                return eval_cp / 100.0, best_move  # Convert to pawns
                
        except Exception as e:
            print(f"   ❌ [ENGINE] Analysis error: {e}")
            print(f"   🔍 [ENGINE] Error type: {type(e).__name__}")
            import traceback
            print(f"   📋 [ENGINE] Stack trace:\n{traceback.format_exc()}")
            return None, None
    
    def clean_pgn(self, pgn_string: str) -> str:
        """
        Clean PGN string to handle Chess.com format with timestamps and comments
        """
        print("🧹 [PGN CLEANER] Cleaning Chess.com PGN format...")
        
        try:
            # Remove control characters that might cause issues
            cleaned = ''.join(char for char in pgn_string if ord(char) >= 32 or char in '\n\r\t')
            print(f"🧹 [PGN CLEANER] After control char removal: {len(cleaned)} chars")
            
            # Remove timestamp comments like {[%clk 0:02:30.1]} and other annotations
            import re
            cleaned = re.sub(r'\{[^}]*\}', '', cleaned)
            print(f"🧹 [PGN CLEANER] After comment removal: {len(cleaned)} chars")
            
            # Also remove any remaining curly braces and their contents (more aggressive)
            cleaned = re.sub(r'\{.*?\}', '', cleaned)
            
            # Remove any stray characters that might interfere
            cleaned = re.sub(r'[{}]', '', cleaned)
            
            # Chess.com PGNs often come as one long line, so we need to split headers and moves properly
            import re
            
            # First, let's properly separate headers and moves using regex
            # Headers are like [Event "..."] and moves start with numbers like "1. e4"
            header_pattern = r'\[([^\]]+)\]'
            headers = re.findall(header_pattern, cleaned)
            
            # Remove all headers from the string to get just the moves
            moves_part = re.sub(header_pattern, '', cleaned).strip()
            
            print(f"🧹 [PGN CLEANER] Found {len(headers)} headers")
            print(f"🧹 [PGN CLEANER] Moves part preview: {moves_part[:200]}...")
            print(f"🧹 [PGN CLEANER] Moves part length: {len(moves_part)}")
            print(f"🧹 [PGN CLEANER] Full moves part: {moves_part}")
            
            # Reconstruct headers properly
            header_lines = []
            for header in headers:
                header_lines.append(f'[{header}]')
            
            print(f"🧹 [PGN CLEANER] Reconstructed {len(header_lines)} header lines")
            
            # Clean up the moves part - remove extra spaces
            moves_text = ' '.join(moves_part.split())
            print(f"🧹 [PGN CLEANER] Cleaned moves text: {moves_text[:200]}...")
            print(f"🧹 [PGN CLEANER] Full cleaned moves text: {moves_text}")
            print(f"🧹 [PGN CLEANER] Does moves text contain '1. e4'? {('1. e4' in moves_text)}")
            
            # Reconstruct PGN with proper formatting
            if header_lines and moves_text.strip():
                result = '\n'.join(header_lines) + '\n\n' + moves_text
                print(f"✅ [PGN CLEANER] Successfully reconstructed PGN with {len(header_lines)} headers and moves")
            elif moves_text.strip():
                # If no headers but have moves, create minimal PGN
                result = '[Event "Unknown"]\n[Site "Unknown"]\n[Date "????.??.??"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "*"]\n\n' + moves_text
                print(f"✅ [PGN CLEANER] Created minimal PGN with moves")
            else:
                print("❌ [PGN CLEANER] No valid moves found!")
                result = pgn_string  # Return original if cleaning failed
            
            print(f"🧹 [PGN CLEANER] Final result length: {len(result)}")
            print(f"🧹 [PGN CLEANER] Final PGN preview:\n{result[:300]}...")
            
            return result
            
        except Exception as e:
            print(f"❌ [PGN CLEANER] Error during cleaning: {e}")
            return pgn_string  # Return original on error
    
    def is_opening_move(self, board: chess.Board, move_number: int) -> bool:
        """
        Chess.com-style opening book detection.
        Uses comprehensive opening database and move popularity.
        """
        # Chess.com typically considers first 10-15 moves as potential book moves
        if move_number > 15:
            return False
            
        # Get position without move counters for comparison
        fen_base = ' '.join(board.fen().split()[:4])
        
        # Comprehensive Chess.com-style opening database
        # These are the most common positions from master games
        opening_book = {
            # Starting position
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq": True,
            
            # After 1.e4
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq": True,
            # After 1...e5
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq": True,
            # After 1...c5 (Sicilian)
            "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq": True,
            # After 1...e6 (French)
            "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq": True,
            # After 1...c6 (Caro-Kann)
            "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq": True,
            
            # After 1.d4
            "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq": True,
            # After 1...d5
            "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq": True,
            # After 1...Nf6
            "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq": True,
            # After 1...f5 (Dutch)
            "rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR w KQkq": True,
            
            # After 1.Nf3
            "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq": True,
            # After 1...d5
            "rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R w KQkq": True,
            # After 1...Nf6
            "rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq": True,
            
            # After 1.c4 (English)
            "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq": True,
            # After 1...e5
            "rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq": True,
            # After 1...c5
            "rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq": True,
            
            # King's Indian Attack setup
            "rnbqkb1r/pppppppp/5n2/8/8/5NP1/PPPPPP1P/RNBQKB1R b KQkq": True,
            
            # Italian Game
            "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq": True,
            
            # Spanish/Ruy Lopez
            "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq": True,
            
            # Queen's Gambit
            "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq": True,
            
            # Sicilian Dragon setup
            "rnbqkb1r/pp2pppp/3p1n2/2p5/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq": True,
        }
        
        # Check if position is in opening book
        if fen_base in opening_book:
            return True
            
        # For very early moves (first 6 moves), be more permissive
        # but still check basic principles
        if move_number <= 6:
            return self._is_reasonable_opening_move(board)
            
        return False
        
    def _is_reasonable_opening_move(self, board: chess.Board) -> bool:
        """
        Check if the current position follows basic opening principles
        (development, center control, king safety)
        """
        # Count center pawns and developed pieces
        center_control = 0
        developed_pieces = 0
        
        piece_map = board.piece_map()
        for square, piece in piece_map.items():
            # Count center pawns (e4, d4, e5, d5)
            if piece.piece_type == chess.PAWN:
                if square in [chess.E4, chess.D4, chess.E5, chess.D5]:
                    center_control += 1
            
            # Count developed minor pieces
            elif piece.piece_type in [chess.KNIGHT, chess.BISHOP]:
                starting_squares = {
                    chess.WHITE: [chess.B1, chess.C1, chess.F1, chess.G1],
                    chess.BLACK: [chess.B8, chess.C8, chess.F8, chess.G8]
                }
                if square not in starting_squares[piece.color]:
                    developed_pieces += 1
        
        # Reasonable opening if there's some center control or development
        return center_control > 0 or developed_pieces > 0
    
    async def analyze_game(self, pgn_string: str) -> Dict[str, Any]:
        """
        Analyze an entire game and return comprehensive statistics
        """
        try:
            print("🎯 Starting Game Review Analysis...")
            print(f"📊 PGN Length: {len(pgn_string)} characters")
            
            print("🔍 [PGN PARSER] Attempting to parse PGN...")
            print(f"📝 [PGN PARSER] First 500 chars: {pgn_string[:500]}...")
            
            # Try parsing PGN directly first
            pgn_io = io.StringIO(pgn_string)
            game = chess.pgn.read_game(pgn_io)
            
            # Check if we got moves from the original parsing
            original_moves = []
            if game:
                try:
                    original_moves = list(game.mainline_moves())
                    print(f"🔍 [PGN PARSER] Original parsing got {len(original_moves)} moves")
                except:
                    original_moves = []
            
            # If parsing failed OR we got no moves, try cleaning and parsing again  
            if not game or len(original_moves) == 0:
                print("🧹 [PGN PARSER] Direct parsing failed or no moves found, trying with cleaning...")
                cleaned_pgn = self.clean_pgn(pgn_string)
                print(f"🧹 [PGN PARSER] Cleaned PGN length: {len(cleaned_pgn)}")
                
                pgn_io = io.StringIO(cleaned_pgn)
                game = chess.pgn.read_game(pgn_io)
            
            if not game:
                print("❌ [PGN PARSER] Invalid PGN format after cleaning")
                print(f"🔍 [PGN PARSER] Cleaned PGN preview: {cleaned_pgn[:500]}...")
                raise ValueError("Invalid PGN format")
            
            print(f"✅ [PGN PARSER] PGN loaded successfully")
            print(f"🎮 [PGN PARSER] Game Info: {game.headers.get('White', 'Unknown')} vs {game.headers.get('Black', 'Unknown')}")
            print(f"📅 [PGN PARSER] Date: {game.headers.get('Date', 'Unknown')}")
            print(f"⏱️  [PGN PARSER] Time Control: {game.headers.get('TimeControl', 'Unknown')}")
            
            # Extract moves using proper game traversal
            moves_data = []
            
            # Try multiple methods to extract moves
            print("🔍 [PGN PARSER] Attempting move extraction...")
            
            # Method 1: Direct mainline_moves (most reliable)
            try:
                board = game.board()
                moves = list(game.mainline_moves())
                
                if moves:
                    print(f"✅ [PGN PARSER] Method 1 success: Found {len(moves)} moves via mainline_moves()")
                    
                    for i, move in enumerate(moves):
                        try:
                            san_move = board.san(move)
                            moves_data.append({
                                'move': move,
                                'san': san_move,
                                'board_before': board.copy(),
                                'index': i
                            })
                            board.push(move)
                        except Exception as e:
                            print(f"⚠️  [PGN PARSER] Error processing move {i}: {e}")
                            continue
                else:
                    print("🔍 [PGN PARSER] Method 1 failed: mainline_moves() returned empty")
            except Exception as e:
                print(f"❌ [PGN PARSER] Method 1 error: {e}")
            
            # Method 2: Node traversal (fallback)
            if not moves_data:
                print("🔍 [PGN PARSER] Trying Method 2: Node traversal...")
                try:
                    board = game.board()
                    node = game
                    move_index = 0
                    
                    while node.variations:
                        next_node = node.variation(0)
                        move = next_node.move
                        
                        try:
                            san_move = board.san(move)
                            moves_data.append({
                                'move': move,
                                'san': san_move,
                                'board_before': board.copy(),
                                'index': move_index
                            })
                            board.push(move)
                            node = next_node
                            move_index += 1
                        except Exception as e:
                            print(f"⚠️  [PGN PARSER] Error in node traversal at move {move_index}: {e}")
                            break
                            
                    print(f"✅ [PGN PARSER] Method 2: Found {len(moves_data)} moves via node traversal")
                except Exception as e:
                    print(f"❌ [PGN PARSER] Method 2 error: {e}")
            
            print(f"🔢 [PGN PARSER] Final result: Extracted {len(moves_data)} moves from PGN")
            if moves_data:
                first_moves = [m['san'] for m in moves_data[:10]]
                print(f"🎯 [PGN PARSER] First few moves: {first_moves}")
            
            if not moves_data:
                print("❌ [PGN PARSER] All methods failed - No moves found in PGN")
                print(f"🔍 [PGN PARSER] Game object: {game}")
                print(f"🔍 [PGN PARSER] Game headers: {dict(game.headers)}")
                print(f"🔍 [PGN PARSER] Has variations: {bool(game.variations)}")
                if game.variations:
                    print(f"🔍 [PGN PARSER] First variation: {game.variation(0)}")
                raise ValueError("No moves found in PGN")
            
            print(f"🔢 Total moves to analyze: {len(moves_data)}")
            print(f"🏁 Expected completion time: ~{len(moves_data) * 0.7:.1f} seconds")
            
            # Initialize statistics
            move_classifications = []
            white_stats = {"best": 0, "excellent": 0, "good": 0, "book": 0, "brilliant": 0, 
                          "inaccuracy": 0, "mistake": 0, "blunder": 0}
            black_stats = {"best": 0, "excellent": 0, "good": 0, "book": 0, "brilliant": 0, 
                          "inaccuracy": 0, "mistake": 0, "blunder": 0}
            
            white_eval_losses = []
            black_eval_losses = []
            
            print("\n" + "="*60)
            print("🚀 STARTING MOVE-BY-MOVE ANALYSIS")
            print("="*60)
            
            for move_data in moves_data:
                try:
                    i = move_data['index']
                    move = move_data['move']
                    san_move = move_data['san']
                    board_before = move_data['board_before']
                    
                    move_number = (i // 2) + 1
                    color = "White" if i % 2 == 0 else "Black"
                    
                    print(f"\n📍 Move {i+1}/{len(moves_data)}: {move_number}.{'.' if i % 2 == 0 else '...'} {san_move} ({color})")
                    print(f"   🔍 Analyzing position before move...")
                    
                    # Get evaluation before the move
                    eval_before, _ = await self.analyze_position(board_before)
                    
                    if eval_before is None:
                        print(f"   ⚠️  Skipping move - couldn't analyze position")
                        continue
                    
                    print(f"   📈 Position evaluation: {eval_before:+.2f}")
                    print(f"   🤖 Finding best move...")
                    
                    # Get the best move in this position
                    _, best_move_str = await self.analyze_position(board_before)
                    
                    # Create position after the move
                    board_after = board_before.copy()
                    board_after.push(move)
                    
                    print(f"   🔄 Evaluating after {san_move}...")
                    
                    # Get evaluation after the move (from opponent's perspective, so negate)
                    eval_after_raw, _ = await self.analyze_position(board_after)
                    eval_after = -eval_after_raw if eval_after_raw is not None else None
                    
                    if eval_after is None:
                        print(f"   ⚠️  Couldn't evaluate position after move")
                        continue
                    
                    best_eval = eval_before
                    if best_move_str:
                        try:
                            best_move = chess.Move.from_uci(best_move_str)
                            if best_move in board_before.legal_moves:
                                temp_board = board_before.copy()
                                temp_board.push(best_move)
                                best_eval_raw, _ = await self.analyze_position(temp_board)
                                best_eval = -best_eval_raw if best_eval_raw is not None else eval_before
                        except:
                            best_eval = eval_before
                    
                    # Check if it's an opening move
                    is_book = self.is_opening_move(board_before, i // 2 + 1)
                    
                    # Classify the move
                    classification = self.classify_move(eval_before, eval_after, best_eval, is_book)
                    
                    # Calculate evaluation loss
                    eval_loss = abs(best_eval - eval_after) * 100  # In centipawns
                    
                    # Determine classification icon and color for logging
                    classification_icons = {
                        "best": "✅", "excellent": "💡", "good": "👍", "book": "📚",
                        "brilliant": "❗", "inaccuracy": "🤔", "mistake": "❌", "blunder": "🫣"
                    }
                    
                    icon = classification_icons.get(classification, "❓")
                    
                    print(f"   {icon} Classification: {classification.upper()}")
                    print(f"   📊 Eval change: {eval_before:+.2f} → {eval_after:+.2f} (Loss: {eval_loss:.1f}cp)")
                    if best_move_str and best_move_str != move.uci():
                        print(f"   💡 Best move was: {best_move_str}")
                    
                    move_info = {
                        "moveIndex": i,
                        "move": move.uci(),
                        "san": san_move,
                        "classification": classification,
                        "evalBefore": round(eval_before, 2),
                        "evalAfter": round(eval_after, 2),
                        "evalDrop": round(eval_loss, 1),
                        "bestMove": best_move_str,
                        "color": "white" if i % 2 == 0 else "black"
                    }
                    
                    move_classifications.append(move_info)
                    
                    # Update statistics
                    if i % 2 == 0:  # White move
                        white_stats[classification] += 1
                        # Only add to eval_losses if NOT a book move (Chess.com method)
                        if classification != "book" and eval_loss > 0:
                            white_eval_losses.append(eval_loss)
                    else:  # Black move
                        black_stats[classification] += 1
                        # Only add to eval_losses if NOT a book move (Chess.com method)
                        if classification != "book" and eval_loss > 0:
                            black_eval_losses.append(eval_loss)
                    
                    # Progress update every 10 moves
                    if (i + 1) % 10 == 0:
                        progress = ((i + 1) / len(moves_data)) * 100
                        print(f"\n📊 PROGRESS UPDATE: {i + 1}/{len(moves_data)} moves analyzed ({progress:.1f}%)")
                        print(f"   ⚡ White accuracy so far: {white_stats}")
                        print(f"   ⚫ Black accuracy so far: {black_stats}")
                        
                except Exception as e:
                    print(f"❌ ERROR analyzing move {i+1}: {e}")
                    continue
            
            # Calculate accuracy scores using Chess.com-exact formula
            def calculate_accuracy(eval_losses: List[float], non_book_moves: int) -> float:
                if non_book_moves == 0 or not eval_losses:
                    # Chess.com shows 100% if all moves were book moves
                    return 100.0
                
                # Calculate Average Centipawn Loss (AvgCPL) - Chess.com method
                # Only count non-book moves in the average
                avg_cpl = sum(eval_losses) / len(eval_losses)
                
                # Chess.com's exact accuracy formula (reverse-engineered)
                accuracy = 103.0 - 7.0 * math.log(avg_cpl + 1.0)
                
                # Chess.com clamps to [0, 100] range
                accuracy = max(0.0, min(100.0, accuracy))
                
                print(f"   📊 Non-book moves: {len(eval_losses)}, Average CPL: {avg_cpl:.1f}, Accuracy: {accuracy:.1f}%")
                return round(accuracy, 1)
            
            # Count non-book moves for each side
            white_non_book_moves = sum(1 for move in move_classifications if move['color'] == 'white' and move['classification'] != 'book')
            black_non_book_moves = sum(1 for move in move_classifications if move['color'] == 'black' and move['classification'] != 'book')
            
            white_accuracy = calculate_accuracy(white_eval_losses, white_non_book_moves)
            black_accuracy = calculate_accuracy(black_eval_losses, black_non_book_moves)
            
            print("\n" + "="*60)
            print("🏆 ANALYSIS COMPLETE!")
            print("="*60)
            print(f"📈 White Accuracy: {white_accuracy}% ({white_non_book_moves} non-book moves)")
            print(f"📉 Black Accuracy: {black_accuracy}% ({black_non_book_moves} non-book moves)")
            print("\n📊 WHITE MOVE BREAKDOWN:")
            for move_type, count in white_stats.items():
                if count > 0:
                    icon = {"best": "✅", "excellent": "💡", "good": "👍", "book": "📚", 
                           "brilliant": "❗", "inaccuracy": "🤔", "mistake": "❌", "blunder": "🫣"}.get(move_type, "❓")
                    print(f"   {icon} {move_type.capitalize()}: {count}")
            
            print("\n📊 BLACK MOVE BREAKDOWN:")
            for move_type, count in black_stats.items():
                if count > 0:
                    icon = {"best": "✅", "excellent": "💡", "good": "👍", "book": "📚", 
                           "brilliant": "❗", "inaccuracy": "🤔", "mistake": "❌", "blunder": "🫣"}.get(move_type, "❓")
                    print(f"   {icon} {move_type.capitalize()}: {count}")
            
            print(f"\n🎯 Total moves analyzed: {len(move_classifications)}/{len(moves_data)}")
            print(f"✅ Analysis success rate: {(len(move_classifications)/len(moves_data))*100:.1f}%")
            
            result = {
                "accuracy": {
                    "white": white_accuracy,
                    "black": black_accuracy
                },
                "classifications": {
                    "white": white_stats,
                    "black": black_stats
                },
                "moves": move_classifications,
                "totalMoves": len(moves_data)
            }
            
            print(f"🚀 Returning analysis results to frontend...")
            return result
            
        except Exception as e:
            print(f"💥 CRITICAL ERROR during game analysis: {e}")
            print(f"🔍 Error type: {type(e).__name__}")
            import traceback
            print(f"📋 Stack trace:\n{traceback.format_exc()}")
            raise ValueError(f"Failed to analyze game: {str(e)}")

# Global instance - lazy initialization
game_review_service = None

def get_game_review_service():
    """Get or create the game review service instance"""
    global game_review_service
    if game_review_service is None:
        game_review_service = GameReviewService()
    return game_review_service