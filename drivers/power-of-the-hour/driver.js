'use strict';

const Homey = require('homey');
const calculations = require('../../lib/calculations');

class PowerOfTheHourDriver extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.devices = [{
      name: 'Power of the hour',
      data: {
        id: calculations.uuid(),
      }
    }]
    this.log('Power of the hour driver has been initialized');
  }

  async onPairListDevices() {
    return this.devices;
  }

  async onPair(socket) {
    socket.on("list_devices", () => {
      socket.emit("list_devices", this.devices);
    });
  }

}

module.exports = PowerOfTheHourDriver;