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
    this.homey.flow.getActionCard('set_consumption_limit')
      .registerRunListener((args, state) => args.device.onActionSetConsumptionLimit(args, state));
    this.homey.flow.getActionCard('set_prediction_limit')
      .registerRunListener((args, state) => args.device.onActionSetPredictionLimit(args, state));
    this.homey.flow.getActionCard('set_prediction_reset_limit')
      .registerRunListener((args, state) => args.device.onActionSetPredictionResetLimit(args, state));
    this.homey.flow.getActionCard('reset_all_values')
      .registerRunListener((args, state) => args.device.onActionResetAllValues(args, state));
    this.homey.flow.getConditionCard('is_prediction_trigged')
      .registerRunListener((args, state) => args.device.getCapabilityValue('alarm_prediction_notified'));
    this.homey.flow.getConditionCard('is_consumption_trigged')
      .registerRunListener((args, state) => args.device.getCapabilityValue('alarm_consumption_notified'));
    this.homey.flow.getConditionCard('is_consumption_limit_above')
      .registerRunListener((args, state) => args.device.isConsumptionLimitAbove(args, state));
    this.homey.flow.getConditionCard('is_prediction_limit_above')
      .registerRunListener((args, state) => args.device.isPredictionLimitAbove(args, state));
    this.homey.flow.getConditionCard('is_prediction_reset_limit_above')
      .registerRunListener((args, state) => args.device.isPredictionResetLimitAbove(args, state));
  }

};
