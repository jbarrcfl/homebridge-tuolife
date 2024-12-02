// TuoLife Rooms
export type TuolifeRoom = {
    groupName: string,
    roomDefaults: object[],
    brightness: string,
    id: string,
    userId: string,
    modeId: string,
    devices: TuoLifeBulbDevice[]
};

// Tuolife devices
export type TuoLifeBulbDevice = {
  brightness: number;
  nickname: string; 
  generation: string;
  userId: string;
  groupId: string;
  bulbId: string;
  deviceId: string;
  firmwareVersion: string;
  isAvailable: boolean;
  modeId: string;
  red: number;
  green: number;
  blue: number;
  violet: number;
  whiteColor: number;
}; 

export const deviceModes = {
  off: 'off',
  on: 'calm5',
  active5: 'active5',
};