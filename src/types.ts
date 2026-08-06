export interface User {
  id: number;
  username: string;
}

export interface Video {
  id: number;
  title: string;
  /** Encrypted media token — the client must decode it to get the real URL. */
  url: string;
  size: number;
  content_type: string;
  created_at: string;
  owner_id: number;
  is_mine: boolean;
}
