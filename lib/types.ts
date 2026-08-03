export type TrackPoint = {
  lat: number;
  lon: number;
  t?: string;
  spd?: number;
};

export type Trip = {
  id: string;
  uuid: string;
  device_id: string | null;
  user_uuid: string | null;
  trip_number: number;
  start_time: string;
  end_time: string | null;
  start_address: string | null;
  end_address: string | null;
  distance_meters: number;
  moving_seconds: number;
  paused_seconds: number;
  max_speed_mps: number;
  stop_count: number;
  /** Fare in rupees, entered on the phone before the journey could be saved. */
  amount: number | null;
  status: string;
  track: TrackPoint[];
  uploaded_at: string;
};

export type Driver = {
  id: string;
  uuid: string;
  username: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
  /** Present in the row but never rendered — the phone needs it to verify. */
  pin_hash?: string | null;
  pin_salt?: string | null;
};
