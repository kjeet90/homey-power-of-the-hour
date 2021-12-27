'use strict';

const Homey = require('homey');
const calculations = require('../../lib/calculations');

module.exports = class PowerOfTheHour extends Homey.Device {

  async onInit() {
    this.latest = await this.getStoreValue('latest') || {};
    const validTimeStamp = this.latest.timestamp && !calculations.isNewHour(new Date(), this.latest.timestamp);
    await this.upgradeExistingDevice();
    await this.setInitialValues(validTimeStamp);
    this.settings = await this.getSettings() || {};
    this.log('Initialized device', this.getName());
    this.predict();
  }

  async upgradeExistingDevice() {
    if (!this.hasCapability('meter_cost')) await this.addCapability('meter_cost');
    if (!this.hasCapability('alarm_cost_notified')) {
      await this.addCapability('alarm_cost_notified');
    }
    if (!this.hasCapability('meter_cost_prediction')) await this.addCapability('meter_cost_prediction');
    if (!this.hasCapability('alarm_cost_prediction_notified')) {
      await this.addCapability('alarm_cost_prediction_notified');
    }
    if (!this.hasCapability('meter_price')) await this.addCapability('meter_price');
    if (!this.hasCapability('meter_cost_previous_hour')) await this.addCapability('meter_cost_previous_hour');
  }

  async setInitialValues(validTimeStamp = false) {
    if (validTimeStamp) {
      this.log('Found valid timestamp in store, using existing capabilities.');
      this.previousTimestamp = this.latest.timestamp;
    } else {
      this.log('Did not find any valid timestamp in store. Clearing capabilities.');
      await this.updateCapabilityValue('alarm_consumption_notified', false);
      await this.updateCapabilityValue('alarm_prediction_notified', false);
      await this.updateCapabilityValue('alarm_cost_notified', false);
      await this.updateCapabilityValue('alarm_cost_prediction_notified', false);
      await this.updateCapabilityValue('meter_consumption', null);
      await this.updateCapabilityValue('meter_predictor', null);
      await this.updateCapabilityValue('meter_consumption_peak', null);
      await this.updateCapabilityValue('meter_consumption_previous_hour', null);
      await this.updateCapabilityValue('meter_cost', null);
      await this.updateCapabilityValue('meter_cost_prediction', null);
      await this.updateCapabilityValue('meter_price', null);
    }
    this.newSettings = {};
    this.history = [];
  }

  async onAdded() {
    await this.setInitialValues();
  }

  onDeleted() {
    this.log('Deleting device');
    if (this.recalculationTimeout) {
      this.homey.clearTimeout(this.recalculationTimeout);
      this.recalculationTimeout = null;
      this.log('Cleared timeout on device removal');
    }
  }

  async onActionPriceChanged(args, state) {
    if (this.previousConsumption) await this.checkReading(this.previousConsumption); // To calculate cost so far before new price is applied
    await this.updateCapabilityValue('meter_price', args.price);
    this.predict();
  }

  async onActionConsumptionChanged(args, state) {
    this.checkReading(args.consumption);
  }

  async onActionSettingChanged(args, state, setting) {
    if (setting) {
      this.newSettings[setting] = args[setting];
      this.queueSettings();
      this.log(`Got new setting: ${setting}: ${args[setting]}`);
    }
  }

  // To avoid calling setSettings three times if all three settings are updated in same flow. Found it not setting them correct every time then.
  async queueSettings() {
    if (this.setSettingsTimeout) {
      this.homey.clearTimeout(this.setSettingsTimeout);
      this.setSettingsTimeout = null;
    }
    this.setSettingsTimeout = this.homey.setTimeout(() => {
      this.writeNewSettings();
    }, 500);
  }

  async writeNewSettings() {
    if (Object.values(this.newSettings).length) {
      this.log('Writing new settings');
      await this.setSettings(this.newSettings).catch(this.error);
      this.settings = await this.getSettings();
      this.newSettings = {};
    }
  }

  async onActionResetAllValues(args, state) {
    await this.setInitialValues();
    this.log('Reset all values');
  }

  async isLimitAbove(args, state, capability) {
    return this.settings[capability] > args.limit;
  }

  async checkReading(watt) {
    try {
      const timeNow = new Date();
      const hoursSincePreviousReading = calculations.getHoursBetween(timeNow, this.previousTimestamp);
      if (calculations.isNewHour(timeNow, this.previousTimestamp)) {
        await this.startNewHour(watt, timeNow);
      } else {
        const wattHours = watt * hoursSincePreviousReading;
        await this.updateCapabilityValue('meter_consumption', this.getCapabilityValue('meter_consumption') + wattHours);
        await this.updateCapabilityValue('meter_cost', this.getCapabilityValue('meter_cost') + (((wattHours) / 1000) * this.getCapabilityValue('meter_price')));
        this.checkIfPeak(watt);
      }
      this.updateHistory(watt, timeNow);
      await this.predict();
      await this.checkNotify();
      this.storeLatest(timeNow, watt);
      this.scheduleRecalculation(watt);
    } catch (err) {
      this.log('Failed to check readings: ', err);
    }
  }

  async storeLatest(timeNow, watt) {
    this.previousTimestamp = timeNow;
    this.previousConsumption = watt;
    this.setStoreValue('latest', { timestamp: this.previousTimestamp }); // Object to keep open for future implementations and also to support v1.0.0 implementation
  }

  async startNewHour(watt, timeNow) {
    const remainingWattHours = watt * calculations.getRemainingHour(this.previousTimestamp);
    await this.updateCapabilityValue('meter_consumption_previous_hour', this.getCapabilityValue('meter_consumption') + remainingWattHours);
    await this.updateCapabilityValue('meter_cost_previous_hour', this.getCapabilityValue('meter_cost') + ((remainingWattHours / 1000) * this.getCapabilityValue('meter_price')));
    await this.updateCapabilityValue('meter_consumption_peak', watt);
    const wattHours = watt * calculations.getElapsedHour(timeNow);
    await this.updateCapabilityValue('meter_consumption', wattHours);
    await this.updateCapabilityValue('meter_cost', (wattHours / 1000) * this.getCapabilityValue('meter_price'));
    if (!this.settings.prediction_consumption_reset_transfer_enabled) {
      await this.updateCapabilityValue('meter_predictor', 0);
      this.resetPredictionNotification(true);
    }
    if (!this.settings.prediction_cost_reset_transfer_enabled) {
      await this.updateCapabilityValue('meter_cost_prediction', 0);
      this.resetCostPredictionNotification(true);
    }
    this.resetConsumptionNotification();
    this.resetCostNotification();
    this.homey.flow.getDeviceTriggerCard('hour_reset').trigger(this, { previous: this.decimals(this.getCapabilityValue('meter_consumption_previous_hour'), 0), previousCost: this.decimals(this.getCapabilityValue('meter_cost_previous_hour'), 2) }, {});
  }

  async checkIfPeak(watt) {
    if (watt > this.getCapabilityValue('meter_consumption_peak')) {
      await this.updateCapabilityValue('meter_consumption_peak', watt);
      this.homey.flow.getDeviceTriggerCard('new_peak').trigger(this, { peak: this.decimals(this.getCapabilityValue('meter_consumption_peak'), 0) }, {});
    }
  }

  async checkNotify() {
    // Predicted consumption
    if (this.getCapabilityValue('meter_predictor') > this.settings.prediction_limit && this.isNotifyAllowed('prediction') && !this.getCapabilityValue('alarm_prediction_notified')) {
      await this.updateCapabilityValue('alarm_prediction_notified', true);
      this.homey.flow.getDeviceTriggerCard('prediction_limit_reached').trigger(this, { predicted: this.decimals(this.getCapabilityValue('meter_predictor'), 0) }, {});
      this.log(`Triggering prediction with the value ${this.decimals(this.getCapabilityValue('meter_predictor'), 0)} and the limit was set to ${this.settings.prediction_limit}`);
    }
    // Consumption
    if (this.getCapabilityValue('meter_consumption') > this.settings.consumption_limit && this.isNotifyAllowed('consumption') && !this.getCapabilityValue('alarm_consumption_notified')) {
      await this.updateCapabilityValue('alarm_consumption_notified', true);
      this.homey.flow.getDeviceTriggerCard('consumption_limit_reached').trigger(this, { consumption: this.decimals(this.getCapabilityValue('meter_consumption'), 0) }, {});
      this.log(`Triggering consumption with the value ${this.decimals(this.getCapabilityValue('meter_consumption'), 0)} and the limit was set to ${this.settings.consumption_limit}`);
    }
    // Reset predicted consumption
    if (this.settings.prediction_reset_enabled && this.getCapabilityValue('meter_predictor') < this.settings.prediction_reset_limit) {
      this.resetPredictionNotification();
    }
    // Predicted cost
    if (this.getCapabilityValue('meter_cost_prediction') > this.settings.prediction_cost_limit && this.isNotifyAllowed('cost_prediction') && !this.getCapabilityValue('alarm_cost_prediction_notified')) {
      await this.updateCapabilityValue('alarm_cost_prediction_notified', true);
      this.homey.flow.getDeviceTriggerCard('prediction_cost_limit_reached').trigger(this, { predicted: this.decimals(this.getCapabilityValue('meter_cost_prediction'), 2) }, {});
      this.log(`Triggering cost prediction with the value ${this.decimals(this.getCapabilityValue('meter_cost_prediction'), 2)} and the limit was set to ${this.settings.prediction_cost_limit}`);
    }
    // Cost
    if (this.getCapabilityValue('meter_cost') > this.settings.cost_limit && this.isNotifyAllowed('cost') && !this.getCapabilityValue('alarm_cost_notified')) {
      await this.updateCapabilityValue('alarm_cost_notified', true);
      this.homey.flow.getDeviceTriggerCard('cost_limit_reached').trigger(this, { cost: this.decimals(this.getCapabilityValue('meter_cost'), 2) }, {});
      this.log(`Triggering cost with the value ${this.decimals(this.getCapabilityValue('meter_cost'), 2)} and the limit was set to ${this.settings.cost_limit}`);
    }
    // Reset predicted cost
    if (this.settings.prediction_cost_reset_enabled && this.getCapabilityValue('meter_cost_prediction') < this.settings.prediction_cost_reset_limit) {
      this.resetCostPredictionNotification();
    }
  }

  async resetPredictionNotification(isNewHour = false) {
    if (this.getCapabilityValue('alarm_prediction_notified') && (!isNewHour || (isNewHour && this.settings.prediction_reset_new_hour_enabled))) {
      this.homey.flow.getDeviceTriggerCard('prediction_reset').trigger(this, { predicted: this.decimals(this.getCapabilityValue('meter_predictor'), 0) }, {});
      this.log(`Triggering prediction reset with the value ${this.decimals(this.getCapabilityValue('meter_predictor'), 0)} and the limit was set to ${this.settings.prediction_reset_limit}`);
    }
    await this.updateCapabilityValue('alarm_prediction_notified', false);
  }

  async resetCostPredictionNotification(isNewHour = false) {
    if (this.getCapabilityValue('alarm_cost_prediction_notified') && (!isNewHour || (isNewHour && this.settings.prediction_cost_reset_new_hour_enabled))) {
      this.homey.flow.getDeviceTriggerCard('prediction_cost_reset').trigger(this, { predicted: this.decimals(this.getCapabilityValue('meter_cost_prediction'), 2) }, {});
      this.log(`Triggering cost prediction reset with the value ${this.decimals(this.getCapabilityValue('meter_cost_prediction'), 2)} and the limit was set to ${this.settings.prediction_cost_reset_limit}`);
    }
    await this.updateCapabilityValue('alarm_cost_prediction_notified', false);
  }

  async resetConsumptionNotification() {
    if (this.getCapabilityValue('alarm_consumption_notified')) {
      this.log(`Triggering consumption reset with the value ${this.decimals(this.getCapabilityValue('meter_consumption'), 0)}`);
      this.homey.flow.getDeviceTriggerCard('consumption_reset').trigger(this, { previous: this.decimals(this.getCapabilityValue('meter_consumption_previous_hour'), 0) }, {});
    }
    await this.updateCapabilityValue('alarm_consumption_notified', false);
  }

  async resetCostNotification() {
    if (this.getCapabilityValue('alarm_cost_notified')) {
      this.log(`Triggering cost reset with the value ${this.decimals(this.getCapabilityValue('meter_cost'), 2)}`);
      this.homey.flow.getDeviceTriggerCard('cost_reset').trigger(this, { previousCost: this.decimals(this.getCapabilityValue('meter_cost_previous_hour'), 2) }, {});
    }
    await this.updateCapabilityValue('alarm_cost_notified', false);
  }

  decimals(value, decimals) {
    return Number(value.toFixed(decimals));
  }

  isNotifyAllowed(setting) {
    let earliest;
    let latest;
    let enabled;
    if (setting === 'prediction') {
      earliest = this.settings.notification_prediction_time_earliest;
      latest = this.settings.notification_prediction_time_latest;
      enabled = this.settings.notification_prediction_enabled;
    } else if (setting === 'consumption') {
      earliest = this.settings.notification_consumption_time_earliest;
      latest = this.settings.notification_consumption_time_latest;
      enabled = this.settings.notification_consumption_enabled;
    } else if (setting === 'cost') {
      earliest = this.settings.notification_cost_time_earliest;
      latest = this.settings.notification_cost_time_latest;
      enabled = this.settings.notification_cost_enabled;
    } else if (setting === 'cost_prediction') {
      earliest = this.settings.notification_cost_prediction_time_earliest;
      latest = this.settings.notification_cost_prediction_time_latest;
      enabled = this.settings.notification_cost_prediction_enabled;
    } else {
      return false;
    }
    const currentTime = new Date().getMinutes();
    return enabled && currentTime <= Number(latest) && currentTime >= Number(earliest);
  }

  async predict() {
    const prediction = calculations.getPrediction(this.history, this.settings.prediction_age, this.settings.prediction_type);
    await this.updateCapabilityValue('meter_predictor', this.getCapabilityValue('meter_consumption') + prediction);
    await this.updateCapabilityValue('meter_cost_prediction', this.getCapabilityValue('meter_cost') + ((prediction / 1000) * this.getCapabilityValue('meter_price')));
  }

  updateHistory(watt, timeOfReading) {
    const newReading = { consumption: watt, timestamp: timeOfReading };
    if (this.history.length > this.settings.prediction_history_count) {
      this.history.pop();
    }
    this.history.unshift(newReading);
  }

  updateCapabilityValue(parameter, value) {
    return this.setCapabilityValue(parameter, value).then().catch(err => this.log(`Failed to set capability value ${parameter} with the value ${value}`));
  }

  scheduleRecalculation(watt) {
    if (this.recalculationTimeout) {
      this.homey.clearTimeout(this.recalculationTimeout);
    }
    this.recalculationTimeout = this.homey.setTimeout(() => {
      this.log(`No data received within the last 60 seconds. Recalculating with previous received value: ${watt}W`);
      this.checkReading(watt);
    }, 60 * 1000);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.settings = newSettings;
    if (changedKeys.includes('prediction_age')) {
      this.predict();
    }
    if (changedKeys.includes('prediction_history_count')) {
      this.history = this.history.slice(0, newSettings.prediction_history_count);
    }
  }

};
