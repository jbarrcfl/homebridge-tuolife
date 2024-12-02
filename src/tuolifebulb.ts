import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { ExampleHomebridgePlatform } from './platform.js';
import { TuoLifeBulbDevice, deviceModes } from './types.js';

/**
 * TuoLife Bulb
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TuoLifeBulbAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  
  private lastChanged: number = 0;

  // Get TuoLife Group States
  private bulb: TuoLifeBulbDevice;

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    
    // set defaults
    this.bulb = {
      brightness: 0,
      modeId: deviceModes.off,
      nickname: '',
      generation: '',
      userId: '',
      groupId: '',
      bulbId: '',
      deviceId: '',
      firmwareVersion: '',
      isAvailable: false,
      red: 0,
      green: 0,
      blue: 0,
      violet: 100,
      whiteColor: 0,
    };
    
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'TuoLife')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.generation)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.bulbId);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.nickname);

    this.bulb.brightness = accessory.context.device.brightness as number;
    this.bulb.groupId = accessory.context.device.groupId;
    //this.deviceStates.On = accessory.context.device.modeId !== 'off';
    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb
    
    // Set current brightness wihtout triggering the setBrightness handler
    //this.service.updateCharacteristic(this.platform.Characteristic.Brightness, accessory.context.device.brightness);
    // Set current on/off without triggering the setOn handler
    //this.service.updateCharacteristic(this.platform.Characteristic.On, accessory.context.device.modeId !== 'off');

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this)); // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this)); // SET - bind to the `setBrightness` method below

  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    this.platform.log.debug('setOn called with value:', value);

    const bodyVal: string = '';
    // Optimistically update the device state
    this.bulb.modeId = value ? deviceModes.on : deviceModes.off;
    this.lastChanged = Date.now();
    
    // send to server to turn on device
    const modeId = value ? deviceModes.on : deviceModes.off;
    const brightness = value ? Number(this.bulb.brightness) : 5; // default brightness when off

    this.platform.log.debug(value ? 'Turning on device' : 'Turning off device');

    // create tuolife bulb object with mix of defaults and current values
    const aBulb : TuoLifeBulbDevice = {
      nickname: this.bulb.nickname,
      generation: this.bulb.generation,
      userId: this.bulb.userId,
      groupId: this.bulb.groupId,
      bulbId: this.bulb.bulbId,
      deviceId: this.bulb.deviceId,
      firmwareVersion: this.bulb.firmwareVersion,
      isAvailable: this.bulb.isAvailable,
      modeId: modeId, // New modeId
      brightness: Number(brightness), // New brightness
      red: this.bulb.red,
      green: this.bulb.green,
      blue: this.bulb.blue,
      violet: this.bulb.violet,
      whiteColor: this.bulb.whiteColor,
    };

    try {
      await this.platform.sendBulbUpdateToServer(aBulb);
      this.platform.log.debug('Successfully sent update to server', bodyVal);
    } catch (error) {
      this.platform.log.error('Error sending setOn to server:', error);
      this.platform.log.debug('Device body:', bodyVal);
    }

    this.platform.log.debug('Set Characteristic On ->', value);
    
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possible. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.
   * In this case, you may decide not to implement `onGet` handlers, which may speed up
   * the responsiveness of your device in the Home app.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    // return the local device state
    const isOn = this.bulb.modeId !== deviceModes.off;
    return isOn;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    // implement your own code to set the brightness
    
    this.bulb.brightness = Number(value);
    // save timestamp of last changed locally
    this.lastChanged = Date.now();

    const aBulb : TuoLifeBulbDevice = {
      nickname: this.bulb.nickname,
      generation: this.bulb.generation,
      userId: this.bulb.userId,
      groupId: this.bulb.groupId,
      bulbId: this.bulb.bulbId,
      deviceId: this.bulb.deviceId,
      firmwareVersion: this.bulb.firmwareVersion,
      isAvailable: this.bulb.isAvailable,
      modeId: deviceModes.on, // New modeId
      brightness: Number(value), // New brightness
      red: this.bulb.red,
      green: this.bulb.green,
      blue: this.bulb.blue,
      violet: this.bulb.violet,
      whiteColor: this.bulb.whiteColor,
    };
    //post brightness to tuolife
    try {
      await this.platform.sendBulbUpdateToServer(aBulb);
      this.platform.log.debug('Successfully sent update to server', aBulb);
    } catch (error) {
      this.platform.log.error('Error sending setBrightness to server:', error);
      this.platform.log.debug('Device body:', aBulb);
    }
    
    this.accessory.context.device.brightness = value;
    this.platform.log.debug('Set Characteristic Brightness -> ', value);
    
  }

  
}
