export type EggServer = "JP" | "NA";

export type EggBadge = "JP" | "NA" | "Might skip";

export type EggWindow = {
  server: EggServer;
  start: number;
  end: number;
  cost: number;
};

export type EggMachineEvent = {
  id: string;
  name: string;
  collab: boolean;
  windows: EggWindow[];
  badges: EggBadge[];
  jpOnlyIds: number[];
  sharedIds: number[];
};

export type EggMachineList = {
  events: EggMachineEvent[];
};
