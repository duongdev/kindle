export interface RoomState {
  key: string;
  name: string;
  tempC?: number;
  humidity?: number;
  ac?: { mode: string; setpoint?: number; fanMode?: string };
}

export interface DeviceState {
  name: string;
  reachable: boolean;
  on?: boolean;
  // State detail when on, e.g. "10%" or "số 2".
  detail?: string;
}

export interface Weather {
  tempC: number;
  apparentC: number;
  code: number;
  highC: number;
  lowC: number;
  hourly: { time: Date; tempC: number; rainPct: number; code: number }[];
}

export interface CalEvent {
  calendar: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  tentative: boolean;
}

export interface Source<T> {
  value?: T;
  okAt?: Date;
  error?: string;
}

export interface Snapshot {
  rooms: Source<RoomState[]>;
  lamp: Source<DeviceState>;
  fan: Source<DeviceState>;
  weather: Source<Weather>;
  events: Source<CalEvent[]>;
}

// What the Kindle tells us when it asks for a screen.
export interface ClientInfo {
  battery?: number;
  charging?: boolean;
  wifi?: boolean;
  nextAt?: Date;
}
