"""
Enhanced analysis service with Lichess Cloud Eval + Stockfish fallback + caching
"""
import os
import json
import hashlib
from typing import Optional, Dict, Any, List
import asyncio
import chess
import chess.engine
import requests
from redis import Redis
import logging
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AnalysisResult(BaseModel):
    source: str  # "lichess", "stockfish", or "cache"
    fen: str
    evaluation: Dict[str, Any]
    depth: Optional[int] = None
    time_taken: Optional[float] = None

class EnhancedAnalysisService:
    def __init__(self):
        self.lichess_url = "https://lichess.org/api/cloud-eval"
        self.stockfish_path = self._find_stockfish()
        self.engine = None
        self.redis_client = self._init_redis()
        self.cache_ttl = 86400 * 7  # 7 days cache
        
    def _find_stockfish(self) -> Optional[str]:
        """Find Stockfish executable in common locations"""
        # First check environment variable
        env_path = os.getenv("STOCKFISH_PATH")
        if env_path and os.path.exists(env_path):
            logger.info(f"Found Stockfish from environment: {env_path}")
            return env_path
        
        # Check local engines directory
        current_dir = os.path.dirname(os.path.dirname(__file__))  # Go up to backend/
        local_stockfish = os.path.join(current_dir, "engines", "stockfish.exe")
        if os.path.exists(local_stockfish):
            logger.info(f"Found local Stockfish: {local_stockfish}")
            return local_stockfish
        
        # Fallback to common system paths
        possible_paths = [
            "/usr/bin/stockfish",
            "/usr/local/bin/stockfish", 
            "/opt/homebrew/bin/stockfish",
            "stockfish",  # if in PATH
            "C:\\Program Files\\Stockfish\\stockfish.exe",
            "stockfish.exe"
        ]
        
        for path in possible_paths:
            try:
                # Test if the path works
                import subprocess
                result = subprocess.run([path, "--help"], 
                                      capture_output=True, 
                                      timeout=5)
                if result.returncode == 0:
                    logger.info(f"Found Stockfish at: {path}")
                    return path
            except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
                continue
                
        logger.warning("Stockfish not found. Run setup_stockfish.py to install.")
        return None
    
    def _init_redis(self) -> Optional[Redis]:
        """Initialize Redis connection for caching"""
        try:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            client = Redis.from_url(redis_url, decode_responses=True)
            client.ping()  # Test connection
            logger.info("Redis connected successfully")
            return client
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Continuing without cache.")
            return None
    
    def _init_stockfish_sync(self):
        """Initialize Stockfish engine synchronously"""
        if self.stockfish_path and not self.engine:
            try:
                logger.info(f"Initializing Stockfish engine at: {self.stockfish_path}")
                
                # On Windows, we need to be more careful with subprocess handling
                import asyncio
                import platform
                
                if platform.system() == "Windows":
                    # Set the event loop policy for Windows
                    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
                
                self.engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)
                logger.info("Stockfish engine initialized successfully")
                return True
            except Exception as e:
                logger.error(f"Failed to initialize Stockfish: {e}")
                import traceback
                logger.error(traceback.format_exc())
                self.engine = None
                return False
        return self.engine is not None

    async def _init_stockfish(self):
        """Initialize Stockfish engine"""
        if self.stockfish_path and not self.engine:
            # Run synchronous initialization in executor
            loop = asyncio.get_event_loop()
            success = await loop.run_in_executor(None, self._init_stockfish_sync)
            return success
        return self.engine is not None
    
    def _get_cache_key(self, fen: str, multi_pv: int = 1) -> str:
        """Generate cache key for FEN + multiPV"""
        key_data = f"{fen}:{multi_pv}"
        return f"analysis:{hashlib.md5(key_data.encode()).hexdigest()}"
    
    def _get_from_cache(self, fen: str, multi_pv: int = 1) -> Optional[Dict[str, Any]]:
        """Get analysis from Redis cache"""
        if not self.redis_client:
            return None
            
        try:
            cache_key = self._get_cache_key(fen, multi_pv)
            cached = self.redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Cache read error: {e}")
        return None
    
    def _save_to_cache(self, fen: str, analysis: Dict[str, Any], multi_pv: int = 1):
        """Save analysis to Redis cache"""
        if not self.redis_client:
            return
            
        try:
            cache_key = self._get_cache_key(fen, multi_pv)
            self.redis_client.setex(
                cache_key, 
                self.cache_ttl,
                json.dumps(analysis)
            )
        except Exception as e:
            logger.error(f"Cache write error: {e}")
    
    async def _query_lichess(self, fen: str, multi_pv: int = 1) -> Optional[Dict[str, Any]]:
        """Query Lichess Cloud Eval API"""
        try:
            params = {"fen": fen, "multiPv": multi_pv}
            response = requests.get(self.lichess_url, params=params, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if "pvs" in data and data["pvs"]:
                    logger.info(f"Lichess analysis found for FEN: {fen[:20]}...")
                    return data
                    
        except Exception as e:
            logger.error(f"Lichess API error: {e}")
        
        return None
    
    async def _analyze_with_stockfish(self, fen: str, depth: int = 15, time_limit: float = 5.0) -> Optional[Dict[str, Any]]:
        """Analyze position with Stockfish using subprocess"""
        if not self.stockfish_path:
            logger.error("Stockfish path not found")
            return None
            
        try:
            # Run Stockfish via subprocess to avoid asyncio issues
            def run_stockfish_analysis():
                import subprocess
                import chess
                
                # Validate FEN first
                try:
                    board = chess.Board(fen)
                    if not board.is_valid():
                        logger.error(f"Invalid FEN: {fen}")
                        return None
                except Exception as e:
                    logger.error(f"FEN validation error: {e}")
                    return None
                
                logger.info(f"Starting Stockfish analysis for FEN: {fen[:30]}... at depth {depth}")
                
                try:
                    # Start Stockfish process
                    process = subprocess.Popen(
                        [self.stockfish_path],
                        stdin=subprocess.PIPE,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        bufsize=0
                    )
                    
                    # Send UCI initialization commands and wait for responses
                    process.stdin.write("uci\n")
                    process.stdin.flush()
                    
                    # Read until we get "uciok"
                    uci_ready = False
                    while not uci_ready:
                        line = process.stdout.readline()
                        if "uciok" in line:
                            uci_ready = True
                    
                    # Send isready and wait for readyok
                    process.stdin.write("isready\n")
                    process.stdin.flush()
                    
                    ready = False
                    while not ready:
                        line = process.stdout.readline()
                        if "readyok" in line:
                            ready = True
                    
                    # Configure Stockfish for deterministic results
                    process.stdin.write("setoption name Hash value 16\n")
                    process.stdin.flush()
                    process.stdin.write("setoption name Threads value 1\n") 
                    process.stdin.flush()
                    process.stdin.write("isready\n")
                    process.stdin.flush()
                    
                    # Wait for ready after configuration
                    ready = False
                    while not ready:
                        line = process.stdout.readline()
                        if "readyok" in line:
                            ready = True
                    
                    # Set position
                    process.stdin.write(f"position fen {fen}\n")
                    process.stdin.flush()
                    
                    # Start analysis with both depth and time limits for consistency
                    process.stdin.write(f"go depth {depth} movetime 3000\n")
                    process.stdin.flush()
                    
                    # Read analysis output until we get bestmove
                    analysis_lines = []
                    best_move = None
                    
                    while True:
                        line = process.stdout.readline()
                        if not line:
                            break
                            
                        line = line.strip()
                        analysis_lines.append(line)
                        
                        if line.startswith('bestmove'):
                            parts = line.split()
                            if len(parts) >= 2:
                                best_move = parts[1]
                            break
                    
                    # Send quit command
                    process.stdin.write("quit\n")
                    process.stdin.flush()
                    
                    # Wait for process to finish
                    process.wait(timeout=5)
                    
                    logger.info(f"Stockfish analysis lines: {len(analysis_lines)} lines collected")
                    logger.info(f"Sample analysis lines: {analysis_lines[:3] if analysis_lines else 'None'}")
                    
                    # Parse the analysis output
                    score = None
                    pv_moves = []
                    depth_reached = depth
                    
                    # Look for the best info line (last one with highest depth)
                    best_info_line = None
                    max_depth = 0
                    
                    for line in analysis_lines:
                        if line.startswith('info') and 'depth' in line and 'score' in line:
                            # Extract depth from this line
                            parts = line.split()
                            current_depth = 0
                            for i, part in enumerate(parts):
                                if part == 'depth' and i + 1 < len(parts):
                                    try:
                                        current_depth = int(parts[i + 1])
                                        break
                                    except ValueError:
                                        pass
                            
                            # Keep the line with the highest depth
                            if current_depth >= max_depth:
                                max_depth = current_depth
                                best_info_line = line
                                depth_reached = current_depth
                        elif line.startswith('bestmove'):
                            parts = line.split()
                            if len(parts) >= 2:
                                best_move = parts[1]
                    
                    # Parse the best info line for score and PV
                    if best_info_line:
                        parts = best_info_line.split()
                        
                        # Parse score
                        for i, part in enumerate(parts):
                            if part == 'cp' and i + 1 < len(parts):
                                try:
                                    raw_score = int(parts[i + 1])
                                    # Stockfish gives score from current player's perspective
                                    # If it's Black's turn, we need to flip the score for consistency
                                    if ' b ' in fen:  # Black to move
                                        score = -raw_score
                                        logger.info(f"Black to move: flipping score from {raw_score} to {score}")
                                    else:  # White to move
                                        score = raw_score
                                        logger.info(f"White to move: keeping score {score}")
                                    break
                                except ValueError:
                                    pass
                            elif part == 'mate' and i + 1 < len(parts):
                                try:
                                    mate_value = int(parts[i + 1])
                                    # Convert mate to centipawns equivalent for consistency
                                    raw_mate_score = 30000 if mate_value > 0 else -30000
                                    # Same perspective adjustment for mate
                                    if ' b ' in fen:  # Black to move
                                        score = -raw_mate_score
                                        logger.info(f"Black to move: flipping mate score from {raw_mate_score} to {score}")
                                    else:  # White to move  
                                        score = raw_mate_score
                                        logger.info(f"White to move: keeping mate score {score}")
                                    break
                                except ValueError:
                                    pass
                        
                        # Parse PV
                        pv_start = -1
                        for i, part in enumerate(parts):
                            if part == 'pv':
                                pv_start = i + 1
                                break
                        if pv_start > 0:
                            pv_moves = parts[pv_start:]
                    
                    logger.info(f"Parsed Stockfish output: score={score}, best_move={best_move}, depth={depth_reached}, pv_moves={pv_moves[:5]}")
                    
                    if best_move and best_move != '(none)' and score is not None:
                        # Create result structure
                        moves_str = " ".join(pv_moves) if pv_moves else best_move
                        
                        stockfish_result = {
                            "fen": fen,
                            "knodes": 100,  # Approximate
                            "depth": depth_reached,
                            "pvs": [{
                                "moves": moves_str,
                                "cp": score,
                                "mate": None
                            }]
                        }
                        
                        logger.info(f"Stockfish analysis complete: cp={score}, moves={moves_str}")
                        return stockfish_result
                    else:
                        logger.error(f"No valid analysis from Stockfish: best_move={best_move}, score={score}")
                        return None
                        
                except subprocess.TimeoutExpired:
                    process.kill()
                    logger.error("Stockfish analysis timed out")
                    return None
                except Exception as e:
                    logger.error(f"Stockfish subprocess error: {e}")
                    import traceback
                    logger.error(traceback.format_exc())
                    return None
            
            # Run in executor
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, run_stockfish_analysis)
            return result
            
        except Exception as e:
            logger.error(f"Stockfish analysis error: {e}")
            return None
    
    async def analyze_position(self, fen: str, multi_pv: int = 1, depth: int = 15) -> AnalysisResult:
        """
        Analyze a chess position with fallback strategy:
        1. Check cache
        2. Try Lichess Cloud Eval
        3. Fallback to Stockfish
        """
        import time
        start_time = time.time()
        
        logger.info(f"🔍 Starting analysis for FEN: {fen[:50]}...")
        logger.info(f"📊 Analysis parameters: multi_pv={multi_pv}, depth={depth}")
        logger.info(f"🔑 Full FEN: {fen}")

        # Step 1: Check cache
        logger.info("1️⃣ Checking cache...")
        cached_result = self._get_from_cache(fen, multi_pv)
        if cached_result:
            logger.info("✅ Cache hit!")
            return AnalysisResult(
                source="cache",
                fen=fen,
                evaluation=cached_result,
                time_taken=time.time() - start_time
            )
        else:
            logger.info("❌ Cache miss")

        # Step 2: Try Lichess
        logger.info("2️⃣ Trying Lichess Cloud Eval...")
        lichess_result = await self._query_lichess(fen, multi_pv)
        if lichess_result:
            logger.info(f"✅ Lichess analysis successful! Score from first PV: {lichess_result.get('pvs', [{}])[0].get('cp', 'N/A')}")
            # Cache the result
            self._save_to_cache(fen, lichess_result, multi_pv)
            return AnalysisResult(
                source="lichess",
                fen=fen,
                evaluation=lichess_result,
                depth=lichess_result.get("depth"),
                time_taken=time.time() - start_time
            )
        else:
            logger.info("❌ Lichess analysis failed")

        # Step 3: Fallback to Stockfish
        logger.info("3️⃣ Falling back to Stockfish...")
        logger.info(f"🔧 Stockfish path: {self.stockfish_path}")
        logger.info(f"🔧 Engine initialized: {self.engine is not None}")
        
        stockfish_result = await self._analyze_with_stockfish(fen, depth)
        if stockfish_result:
            logger.info("✅ Stockfish analysis successful!")
            # Cache the result
            self._save_to_cache(fen, stockfish_result, multi_pv)
            return AnalysisResult(
                source="stockfish",
                fen=fen,
                evaluation=stockfish_result,
                depth=depth,
                time_taken=time.time() - start_time
            )
        else:
            logger.info("❌ Stockfish analysis failed")

        # Fallback: return empty analysis
        logger.error(f"🚨 ALL ANALYSIS METHODS FAILED for FEN: {fen}")
        return AnalysisResult(
            source="none",
            fen=fen,
            evaluation={"fen": fen, "pvs": []},
            time_taken=time.time() - start_time
        )

    async def analyze_multiple_positions(self, fens: List[str], depth: int = 12) -> List[AnalysisResult]:
        """Analyze multiple positions efficiently"""
        logger.info(f"Analyzing {len(fens)} positions")
        
        # Process in batches to avoid overwhelming the system
        batch_size = 5
        results = []
        
        for i in range(0, len(fens), batch_size):
            batch_fens = fens[i:i + batch_size]
            batch_tasks = [
                self.analyze_position(fen, depth=depth) 
                for fen in batch_fens
            ]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Batch analysis error: {result}")
                    continue
                results.append(result)
        
        return results
    
    async def cleanup(self):
        """Clean up resources"""
        if self.engine:
            await asyncio.get_event_loop().run_in_executor(
                None,
                self.engine.quit
            )
            self.engine = None
        
        if self.redis_client:
            self.redis_client.close()

# Global instance - lazy initialization
analysis_service = None

def get_analysis_service():
    """Get or create the analysis service instance"""
    global analysis_service
    if analysis_service is None:
        analysis_service = EnhancedAnalysisService()
    return analysis_service