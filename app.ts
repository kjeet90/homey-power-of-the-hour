'use strict';

import Homey from 'homey';

module.exports = class PowerOfTheHour extends Homey.App {
    async onInit() {
        await this.initFlows();
        this.log('Power of the hour is running...');
    }

    async initFlows() {
        this.log('Initializing flows...');

        // Actions
        this.homey.flow.getActionCard('consumption_updated').registerRunListener((args, state) => args.device.onActionConsumptionChanged(args, state));
        this.homey.flow.getActionCard('price_updated').registerRunListener((args, state) => args.device.onActionPriceChanged(args, state));
        this.homey.flow.getActionCard('set_consumption_limit').registerRunListener((args, _state) => args.device.onActionSettingChanged(args, 'consumption_limit'));
        this.homey.flow.getActionCard('set_prediction_limit').registerRunListener((args, _state) => args.device.onActionSettingChanged(args, 'prediction_limit'));
        this.homey.flow.getActionCard('set_prediction_reset_limit').registerRunListener((args, _state) => args.device.onActionSettingChanged(args, 'prediction_reset_limit'));
        this.homey.flow.getActionCard('set_cost_limit').registerRunListener((args, _state) => args.device.onActionSettingChanged(args, 'cost_limit'));
        this.homey.flow.getActionCard('set_prediction_cost_limit').registerRunListener((args, _state) => args.device.onActionSettingChanged(args, 'prediction_cost_limit'));
        this.homey.flow.getActionCard('set_prediction_cost_reset_limit').registerRunListener((args, _state) => args.device.onActionSettingChanged(args, 'prediction_cost_reset_limit'));
        this.homey.flow.getActionCard('reset_all_values').registerRunListener((args, _state) => args.device.onActionResetAllValues());
        // Conditions
        this.homey.flow.getConditionCard('is_prediction_trigged').registerRunListener((args, _state) => args.device.getCapabilityValue('alarm_prediction_notified'));
        this.homey.flow.getConditionCard('is_consumption_trigged').registerRunListener((args, _state) => args.device.getCapabilityValue('alarm_consumption_notified'));
        this.homey.flow.getConditionCard('is_prediction_cost_trigged').registerRunListener((args, _state) => args.device.getCapabilityValue('alarm_prediction_cost_notified'));
        this.homey.flow.getConditionCard('is_cost_trigged').registerRunListener((args, _state) => args.device.getCapabilityValue('alarm_cost_notified'));
        this.homey.flow.getConditionCard('is_consumption_limit_above').registerRunListener((args, _state) => args.device.isLimitAbove(args, 'consumption_limit'));
        this.homey.flow.getConditionCard('is_prediction_limit_above').registerRunListener((args, _state) => args.device.isLimitAbove(args, 'prediction_limit'));
        this.homey.flow.getConditionCard('is_prediction_reset_limit_above').registerRunListener((args, _state) => args.device.isLimitAbove(args, 'prediction_reset_limit'));
        this.homey.flow.getConditionCard('is_cost_limit_above').registerRunListener((args, _state) => args.device.isLimitAbove(args, 'cost_limit'));
        this.homey.flow.getConditionCard('is_prediction_cost_limit_above').registerRunListener((args, _state) => args.device.isLimitAbove(args, 'prediction_cost_limit'));
        this.homey.flow.getConditionCard('is_prediction_cost_reset_limit_above').registerRunListener((args, _state) => args.device.isLimitAbove(args, 'prediction_cost_reset_limit'));
    }
};
