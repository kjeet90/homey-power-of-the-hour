'use strict';

const Homey = require('homey');

module.exports = class PowerOfTheHour extends Homey.App {
  async onInit() {
    this.log('Power of the hour is running...');

    this.homey.flow.getActionCard('consumption_updated')
      .registerRunListener((args, state) => { args.device.onActionConsumptionChanged(args, state) });

    this.log('Done initializing flows...');
  }
}
