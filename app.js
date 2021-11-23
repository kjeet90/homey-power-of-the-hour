'use strict';

const Homey = require('homey');

module.exports = class PowerOfTheHour extends Homey.App {
  async onInit() {
    await this.initFlows();
    this.log('Power of the hour is running...');
  }

  async initFlows() {
    this.log('Initializing flows...');

    this.homey.flow.getActionCard('consumption_updated')
      .registerRunListener((args, state) => args.device.onActionConsumptionChanged(args, state));
    this.homey.flow.getConditionCard('is_prediction_trigged')
      .registerRunListener((args, state) => args.device.getCapabilityValue('alarm_prediction_notified'));
    this.homey.flow.getConditionCard('is_consumption_trigged')
      .registerRunListener((args, state) => args.device.getCapabilityValue('alarm_consumption_notified'));
  }

};
