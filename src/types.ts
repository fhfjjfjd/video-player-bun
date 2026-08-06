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

export type FeedbackType = "feature" | "bug" | "other";
export type FeedbackStatus = "open" | "closed";

/**
 * A single suggestion stored on disk as a Markdown file in the `feedback/`
 * folder. `status: "open"` means the item is still actionable and can be
 * worked on; `status: "closed"` means it is done and must not be changed.
 */
export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  body: string;
  status: FeedbackStatus;
  created_at: string;
  author?: string;
  /** Agent's reply explaining what was done — required when an item is closed. */
  reply?: string;
}
