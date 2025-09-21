export interface Player {
  username: string;
  rating?: number;
  result?: string;
}

export interface Game {
  url: string;
  time_class: string;
  end_time: number;
  rules: string;
  pgn: string;
  white: Player;
  black: Player;
}
