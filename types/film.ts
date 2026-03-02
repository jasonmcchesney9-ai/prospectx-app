// TypeScript interfaces for Film Room API responses

export interface VideoUpload {
  id: string;
  title: string;
  description: string | null;
  upload_source: string;
  source_url: string | null;
  status: string;
  mux_asset_id: string | null;
  playback_id: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  original_filename: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface VideoClip {
  id: string;
  upload_id: string;
  session_id: string;
  title: string;
  start_time_seconds: number;
  end_time_seconds: number;
  clip_type: string;
  tags: string | null;
  tagged_player_name: string | null;
  tagged_player_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface VideoEvent {
  id: string;
  upload_id: string;
  session_id: string | null;
  event_type: string;
  event_label: string | null;
  time_seconds: number;
  end_time_seconds: number | null;
  player_id: string | null;
  player_name: string | null;
  team_id: string | null;
  coordinates_x: number | null;
  coordinates_y: number | null;
  metadata: string | null;
  created_at: string;
}

export interface FilmSession {
  id: string;
  title: string;
  session_type: string;
  description: string | null;
  game_id: string | null;
  team_id: string | null;
  player_id: string | null;
  opponent_team_id: string | null;
  pxi_output: string | null;
  pxi_status: string | null;
  visibility: string;
  status: string;
  shared_link_token: string | null;
  created_at: string;
  updated_at: string | null;
  clip_count?: number;
}

export interface FilmComment {
  id: string;
  session_id: string;
  user_id: string;
  comment_text: string;
  timestamp_seconds: number | null;
  created_at: string;
}

export interface ChalkTalkComment {
  id: string;
  chalk_talk_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
}

export interface MuxUploadResponse {
  upload_url: string;
  upload_id: string;
}

export interface MuxUploadStatus {
  upload_id: string;
  status: string;
  asset_id: string | null;
  playback_id: string | null;
  duration: number | null;
}
