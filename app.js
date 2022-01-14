'use strict';

const Homey = require('homey');

module.exports = class PowerOfTheHour extends Homey.App {

  async onInit() {
    await this.initFlows();
    this.log('Power of the hour is running...');
  }

  async initFlows() {
    this.log('Initializing flows...');

    // Actions
    this.homey.flow.getActionCard('consumption_updated')
      .registerRunListener((args, state) => args.device.onActionConsumptionChanged(args, state));
    this.homey.flow.getActionCard('price_updated')
      .registerRunListener((args, state) => args.device.onActionPriceChanged(args, state));
    this.homey.flow.getActionCard('set_consumption_limit')
      .registerRunListener((args, state) => args.device.onActionSettingChanged(args, state, 'consumption_limit'));
    this.homey.flow.getActionCard('set_prediction_limit')
      .registerRunListener((args, state) => args.device.onActionSettingChanged(args, state, 'prediction_limit'));
    this.homey.flow.getActionCard('set_prediction_reset_limit')
      .registerRunListener((args, state) => args.device.onActionSettingChanged(args, state, 'prediction_reset_limit'));
    this.homey.flow.getActionCard('set_cost_limit')
      .registerRunListener((args, state) => args.device.onActionSettingChanged(args, state, 'cost_limit'));
    this.homey.flow.getActionCard('set_prediction_cost_limit')
      .registerRunListener((args, state) => args.device.onActionSettingChanged(args, state, 'prediction_cost_limit'));
    this.homey.flow.getActionCard('set_prediction_cost_reset_limit')
      .registerRunListener((args, state) => args.device.onActionSettingChanged(args, state, 'prediction_cost_reset_limit'));
    this.homey.flow.getActionCard('reset_all_values')
      .registerRunListener((args, state) => args.device.onActionResetAllValues(args, state));
    // Conditions
    this.homey.flow.getConditionCard('is_prediction_trigged')
      .registerRunListener((args, state) => args.device.getCapabilityValue('alarm_prediction_notified'));
    this.homey.flow.getConditionCard('is_consumption_trigged')
      .registerRunListener((args, state) => args.device.getCapabilityValue('alarm_consumption_notified'));
    this.homey.flow.getConditionCard('is_prediction_cost_trigged')
      .registerRunListener((args, state) => args.device.getCapabilityValue('alarm_prediction_cost_notified'));
    this.homey.flow.getConditionCard('is_cost_trigged')
      .registerRunListener((args, state) => args.device.getCapabilityValue('alarm_cost_notified'));
    this.homey.flow.getConditionCard('is_consumption_limit_above')
      .registerRunListener((args, state) => args.device.isLimitAbove(args, state, 'consumption_limit'));
    this.homey.flow.getConditionCard('is_prediction_limit_above')
      .registerRunListener((args, state) => args.device.isLimitAbove(args, state, 'prediction_limit'));
    this.homey.flow.getConditionCard('is_prediction_reset_limit_above')
      .registerRunListener((args, state) => args.device.isLimitAbove(args, state, 'prediction_reset_limit'));
    this.homey.flow.getConditionCard('is_cost_limit_above')
      .registerRunListener((args, state) => args.device.isLimitAbove(args, state, 'cost_limit'));
    this.homey.flow.getConditionCard('is_prediction_cost_limit_above')
      .registerRunListener((args, state) => args.device.isLimitAbove(args, state, 'prediction_cost_limit'));
    this.homey.flow.getConditionCard('is_prediction_cost_reset_limit_above')
      .registerRunListener((args, state) => args.device.isLimitAbove(args, state, 'prediction_cost_reset_limit'));
  }

};
