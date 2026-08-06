export interface User {
  id: number;
  username: string;
}

export interface Video {
  id: number;
  title: string;
  url: string;
  size: number;
  content_type: string;
  created_at: string;
  owner_id: number;
  is_mine: boolean;
}
