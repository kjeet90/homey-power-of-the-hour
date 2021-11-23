'use strict';

const { v4 : uuid } = require('uuid');
const Homey = require('homey');

class PowerOfTheHourDriver extends Homey.Driver {

  async onInit() {
    this.log('Power of the hour driver has been initialized');
  }

  async onPairListDevices() {
    return [{
      name: 'Power of the hour',
      data: {
        id: uuid(),
      },
    }];
  }

  async onPair(session) {
    session.setHandler('list_devices', async () => {
      return {
        name: 'Power of the hour',
        data: {
          id: uuid(),
        },
      };
    });
  }

}

module.exports = PowerOfTheHourDriver;