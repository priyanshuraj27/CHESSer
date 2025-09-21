import httpx

async def calculate_accuracy(pgn: str):
    """
    Calculates real accuracy using Lichess analysis API.
    Returns accuracy %, blunders, mistakes, inaccuracies, and move analysis list.
    """
    async with httpx.AsyncClient() as client:
        # Send PGN to Lichess Cloud Analysis
        url = "https://lichess.org/api/cloud-eval"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {"pgn": pgn}
        response = await client.post(url, data=data, headers=headers)

    if response.status_code != 200:
        raise ValueError("Failed to fetch Lichess analysis")

    eval_data = response.json()  # contains per-move evaluation
    move_analysis = []
    blunders = mistakes = inaccuracies = 0

    for move_info in eval_data["moves"]:
        move = move_info["san"]
        eval_cp = move_info.get("cp", 0)  # centipawn evaluation
        # Determine type based on centipawn loss
        cp_loss = abs(move_info.get("loss", 0))  # Lichess sometimes gives 'loss'
        if cp_loss > 100:
            move_type = "blunder"
            blunders += 1
        elif cp_loss > 50:
            move_type = "mistake"
            mistakes += 1
        elif cp_loss > 20:
            move_type = "inaccuracy"
            inaccuracies += 1
        else:
            move_type = "good"

        move_analysis.append({
            "move": move,
            "eval": round(eval_cp / 100, 2),  # convert to pawns
            "best_move": move_info.get("best", move),
            "type": move_type
        })

    total_moves = len(move_analysis)
    accuracy = round(100 - ((blunders*3 + mistakes*2 + inaccuracies*1)/total_moves)*100/3, 2)
    return accuracy, blunders, mistakes, inaccuracies, move_analysis
