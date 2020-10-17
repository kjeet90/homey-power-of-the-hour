'use strict';

const Homey = require('homey');

module.exports = class PowerOfTheHour extends Homey.App {
  async onInit() {
    this.log('Power of the hour is running...');

    this.consumptionLimitTrigger = new Homey.FlowCardTriggerDevice('consumption_limit_reached');
    this.consumptionLimitTrigger.register();

    this.predictionLimitTrigger = new Homey.FlowCardTriggerDevice('prediction_limit_reached');
    this.predictionLimitTrigger.register();

    this.predictionResetLimitTrigger = new Homey.FlowCardTriggerDevice('prediction_reset');
    this.predictionResetLimitTrigger.register();

    this.hourResetTrigger = new Homey.FlowCardTriggerDevice('hour_reset');
    this.hourResetTrigger.register();

    this.newPeakTrigger = new Homey.FlowCardTriggerDevice('new_peak');
    this.newPeakTrigger.register();

    new Homey.FlowCardAction('consumption_updated')
      .register()
      .registerRunListener((args, state) => { args.device.onActionConsumptionChanged(args, state) });

    this.log('Done initializing flows...');
  }
}
