export interface User {
  id: number;
  username: string;
}

export interface Video {
  id: number;
  title: string;
  /** Signed media token — used as `/api/media?t=<token>`; validated server-side. */
  url: string;
  size: number;
  content_type: string;
  created_at: string;
  owner_id: number;
  is_mine: boolean;
}
