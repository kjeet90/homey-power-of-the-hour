'use strict';

const Homey = require('homey');
const calculations = require('../../lib/calculations');

class PowerOfTheHourDriver extends Homey.Driver {

  async onInit() {
    this.log('Power of the hour driver has been initialized');
  }

  async onPairListDevices() {
    return [{
      name: 'Power of the hour',
      data: {
        id: calculations.uuid(),
      }
    }];
  }

  async onPair(socket) {
    socket.on("list_devices", () => {
      socket.emit("list_devices", [{
        name: 'Power of the hour',
        data: {
          id: calculations.uuid(),
        }
      }]);
    });
  }

}

module.exports = PowerOfTheHourDriver;