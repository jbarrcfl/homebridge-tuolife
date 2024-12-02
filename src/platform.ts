import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { TuoLifeBulbAccessory } from './tuolifebulb.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { TuoLifeBulbDevice, TuolifeRoom } from './types.js';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class ExampleHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];
  public readonly apiKey: string;
  private isDiscoveryInProgress = false;
  public readonly syncInterval: NodeJS.Timeout;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {

    // set sync interval
    this.syncInterval = setInterval(() => this.syncBulbsWithServer(), 5000);

    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    // Load API key from config
    this.apiKey = config.apiKey || '';
    if (!this.apiKey) {
      this.log.error('No API key provided in config. Plugin may not function correctly.');
    }
    this.log.debug('API key:', this.apiKey);
  

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    // get modeId and brightness from TuoLife API
    this.accessories.set(accessory.UUID, accessory);
    this.log.info('Accessory brightness:', accessory.context.device.brightness);
    this.log.info('Accessory state:', accessory.context.device.modeId);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {

    if (this.isDiscoveryInProgress) {
      this.log.debug('Device discovery already in progress, skipping...');
      return;
    }
    this.isDiscoveryInProgress = true;
    // Discover devices from TuoLife API
    this.getDevicesAndStatesFromServer().then(devices => {
      this.registerDevices(devices);
    });
    
  }
  registerDevices(devices: Array<TuoLifeBulbDevice>) {
    this.log.debug('Registering devices:', devices.length);
    
    for (const device of devices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      if (!device.bulbId) {
        this.log.error('Device missing bulbId:', device);
        continue;
      }

      // Convert bulbId to string to ensure valid input for UUID generation
      const uuid = this.api.hap.uuid.generate(device.bulbId.toString());
      
      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.get(uuid);

      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        
        // preserve brightness update modeId based on device.modeId
        existingAccessory.context.device.brightness = Number(device.brightness);
        existingAccessory.context.device.on = device.modeId !== 'off';

        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. e.g.:
        //existingAccessory.context.device = device;
        //this.api.updatePlatformAccessories([existingAccessory]);

        // create the accessory handler for the restored accessory
        // this is imported from `platformAccessory.ts`
        new TuoLifeBulbAccessory(this, existingAccessory);

        // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, e.g.:
        // remove platform accessories when no longer present
        // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
        // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.nickname);

        // create a new accessory
        const accessory = new this.api.platformAccessory(device.nickname, uuid);

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.device = device;

        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        new TuoLifeBulbAccessory(this, accessory);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }

      // push into discoveredCacheUUIDs
      this.discoveredCacheUUIDs.push(uuid);
    }

    // you can also deal with accessories from the cache which are no longer present by removing them from Homebridge
    // for example, if your plugin logs into a cloud account to retrieve a device list, and a user has previously removed a device
    // from this cloud account, then this device will no longer be present in the device list but will still be in the Homebridge cache
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
    
  }

  async getDevicesAndStatesFromServer(): Promise<TuoLifeBulbDevice[]> {
    try {
      // Get state from server
      const response = await fetch('https://mobileapi.thetuolife.com/group/roomsByUser', {
        method: 'GET',
        headers: {
          'Authorization': this.apiKey,
        },
      });
      const data = await response.json();
      
      // Check if data is an array
      if (!Array.isArray(data)) {
        this.log.error('Unexpected API response format - expected array of rooms');
        this.log.error('Response:', data);
        return [];
      }

      // Type guard to ensure data is TuolifeRoom[]
      const rooms = data as TuolifeRoom[];
      
      // combine all rooms.devices into one array
      // map bulb_ID to bulbId, 
      const allDevices: TuoLifeBulbDevice[] = this.getAllDevicesFromRooms(rooms);

      return allDevices;
    } catch (error) {
      this.log.error('Failed to fetch devices from server:', error);
      return [];
    }
  }

  // Get all bulbs from server and update on/off state, brightness
  async syncBulbsWithServer() {
    try {
      // Get current devices from server
      const devices = await this.getDevicesAndStatesFromServer();
      
      // Update each device in our accessories cache
      for (const device of devices) {
        const uuid = this.api.hap.uuid.generate(device.bulbId);
        const accessory = this.accessories.get(uuid);
        
        if (accessory) {
          // Update the context with new values
          accessory.context.device.brightness = Number(device.brightness);
          accessory.context.device.on = device.modeId !== 'off';
          
          // Get the bulb handler and trigger an update
          const bulb = new TuoLifeBulbAccessory(this, accessory);
          this.updateHomeKit(bulb); // Note: You'll need to implement this method in tuolifebulb.ts
        }
      }
    } catch (error) {
      this.log.error('Failed to sync bulbs with server:', error);
    }
  }
  // todo: tuolifebulb.ts updateHomeKit()
  async updateHomeKit(aBulb: TuoLifeBulbAccessory) {
    this.log.debug('Updating HomeKit for bulb:', aBulb);
  }

  // Send bulb update to server
  public async sendBulbUpdateToServer(bulb: TuoLifeBulbDevice): Promise<void> {
    const bodyValue = JSON.stringify({
      groupId: bulb.groupId,
      modeId: bulb.modeId,
      brightness: bulb.brightness,
      red: bulb.red,
      green: bulb.green,
      blue: bulb.blue,
      violet: bulb.violet,
      whiteColor: bulb.whiteColor,
    });
    // Send update to server
    fetch('https://mobileapi.thetuolife.com/mode/roomModeStart', {
      method: 'POST',
      headers: {
        'Authorization': this.apiKey,
      },
      body: bodyValue,
    });
  }

  // Helper function to map raw device data to TuoLifeBulbDevice
  private mapDevice(device: any): TuoLifeBulbDevice {
    this.log.debug('Raw device data:', device);
    if (!device.bulb_ID) {
      this.log.warn('Device missing bulb_ID:', device);
    }
    return {
      bulbId: device.bulb_ID,
      groupId: device.groupId,
      nickname: device.nickname,
      modeId: device.modeId || 'off',
      generation: device.generation || 1,
      userId: device.userId || '',
      deviceId: device.deviceId || '',
      firmwareVersion: device.firmwareVersion || '',
      isAvailable: device.isAvailable || false,
      brightness: device.brightness || 0,
      red: device.red || 0,
      green: device.green || 0,
      blue: device.blue || 0,
      violet: device.violet || 0,
      whiteColor: device.whiteColor || 0,
    };
  }

  // Helper function to extract devices from a room
  private extractDevicesFromRoom(room: TuolifeRoom): TuoLifeBulbDevice[] {
    if (room.devices && Array.isArray(room.devices)) {
      return room.devices.map(this.mapDevice.bind(this));
    }
    return [];
  }

  // Main function to get all devices from rooms
  private getAllDevicesFromRooms(rooms: TuolifeRoom[]): TuoLifeBulbDevice[] {
    return rooms.reduce((acc: TuoLifeBulbDevice[], room) => {
      const devices = this.extractDevicesFromRoom(room);
      return [...acc, ...devices];
    }, []);
  }
}
