'use strict';

const Homey = require('homey');
const calculations = require('../../lib/calculations');

module.exports = class PowerOfTheHour extends Homey.Device {

  async onInit() {
    this.latest = await this.getStoreValue('latest') || {};
    const latestValid = (this.latest.timestamp !== undefined && !calculations.isNewHour(new Date(), this.latest.timestamp));
    await this.setInitialValues(latestValid);
    this.settings = await this.getSettings() || {};
    this.log('Initialized device', this.getName());
    this.predict();
  }

  async setInitialValues(latestValid = false) {
    if (latestValid) {
      this.previousTimestamp = this.latest.timestamp;
      this.wattHours = this.latest.wattHours;
      this.wattPeak = this.latest.wattPeak;
      this.totalPreviousHour = this.latest.totalPreviousHour;
      this.log(`Found valid values in store: time: ${this.latest.timestamp}, wattHours: ${this.latest.wattHours}`);
    } else {
      this.log('Did not find any valid values in store. Starting fresh');
    }
    this.newSettings = {};
    this.wattHours = latestValid ? this.latest.wattHours : 0;
    this.wattPeak = latestValid ? this.latest.wattPeak : 0;
    this.referenceReadings = [];
    this.totalPreviousHour = latestValid ? this.latest.totalPreviousHour : 0;
    this.predictedWattHours = 0;
    this.previousTimestamp = latestValid ? this.latest.timestamp : undefined;
    this.updateCapabilityValue('alarm_consumption_notified', latestValid ? this.latest.consumption_trigged : false);
    this.updateCapabilityValue('alarm_prediction_notified', latestValid ? this.latest.prediction_trigged : false);
    this.updateCapabilityValue('meter_consumption', this.wattHours);
    this.updateCapabilityValue('meter_consumption_peak', this.wattPeak);
    this.updateCapabilityValue('meter_consumption_previous_hour', this.totalPreviousHour);
    this.updateCapabilityValue('meter_predictor', this.predictedWattHours);
  }

  async onAdded() {
    await this.setInitialValues();
  }

  async onActionConsumptionChanged(args, state) {
    this.checkReading(args.consumption);
  }

  async onActionSetConsumptionLimit(args, state) {
    this.newSettings['consumption_limit'] = args.consumption_limit;
    this.queueSettings();
    this.log(`Got new setting: consumption limit: ${args.consumption_limit}`);
  }

  async onActionSetPredictionLimit(args, state) {
    this.newSettings['prediction_limit'] = args.prediction_limit;
    this.queueSettings();
    this.log(`Got new setting: prediction limit: ${args.prediction_limit}`);
  }

  async onActionSetPredictionResetLimit(args, state) {
    this.newSettings['prediction_reset_limit'] = args.prediction_reset_limit;
    this.queueSettings();
    this.log(`Got new setting: reset prediction limit: ${args.prediction_reset_limit}`);
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

  async isConsumptionLimitAbove(args, state) {
    return this.settings.consumption_limit > args.limit;
  }

  async isPredictionLimitAbove(args, state) {
    return this.settings.prediction_limit > args.limit;
  }

  async isPredictionResetLimitAbove(args, state) {
    return this.settings.prediction_reset_limit > args.limit;
  }

  checkReading(watt) {
    try {
      const timeNow = new Date();
      const hoursSincePreviousReading = calculations.getHoursBetween(timeNow, this.previousTimestamp);
      if (calculations.isNewHour(timeNow, this.previousTimestamp)) {
        this.startNewHour(watt, timeNow);
      } else {
        this.setWattHours(this.wattHours + (watt * hoursSincePreviousReading));
        this.checkIfPeak(watt);
      }
      this.updateReferenceReadings(watt, timeNow);
      this.predict();
      this.checkNotify();
      this.updateCapabilityValue('meter_consumption', this.getWattHours());
      this.previousTimestamp = timeNow;
      this.storeLatest();
      this.scheduleRecalculation(watt);
    } catch (err) {
      this.log('Failed to check readings: ', err);
    }
  }

  async storeLatest() {
    this.latest = {
      timestamp: this.previousTimestamp,
      wattHours: this.wattHours,
      wattPeak: this.wattPeak,
      totalPreviousHour: this.totalPreviousHour,
      consumption_trigged: this.getCapabilityValue('alarm_consumption_notified'),
      prediction_trigged: this.getCapabilityValue('alarm_prediction_notified'),
    };
    this.setStoreValue('latest', this.latest);
  }

  startNewHour(watt, timeNow) {
    this.setTotalPreviousHour(this.wattHours + (watt * calculations.getRemainingHour(this.previousTimestamp)));
    this.setWattHours(watt * calculations.getElapsedHour(timeNow));
    this.setNewPeak(watt);
    this.predictedWattHours = 0;
    this.resetPredictionNotification(true);
    this.resetConsumptionNotification();
    this.updateCapabilityValue('meter_consumption_previous_hour', this.totalPreviousHour);
    this.updateCapabilityValue('meter_consumption_peak', this.wattPeak);
    this.homey.flow.getDeviceTriggerCard('hour_reset').trigger(this, { previous: this.getTotalPreviousHour() }, {});
  }

  setTotalPreviousHour(watt) {
    this.totalPreviousHour = watt;
  }

  checkIfPeak(watt) {
    if (watt > this.wattPeak) {
      this.setNewPeak(watt);
      this.updateCapabilityValue('meter_consumption_peak', this.wattPeak);
      this.homey.flow.getDeviceTriggerCard('new_peak').trigger(this, { peak: this.getPeak() }, {});
    }
  }

  checkNotify() {
    if (this.getWattHours() > this.settings.consumption_limit && this.isNotifyAllowed('consumption') && !this.getCapabilityValue('alarm_consumption_notified')) {
      this.updateCapabilityValue('alarm_consumption_notified', true);
      this.homey.flow.getDeviceTriggerCard('consumption_limit_reached').trigger(this, { consumption: this.getWattHours() }, {});
      this.log(`Triggering consumption with the value ${this.getWattHours()} and the limit was set to ${this.settings.consumption_limit}`);
    }
    if (this.getPredictedWattHours() > this.settings.prediction_limit && this.isNotifyAllowed('prediction') && !this.getCapabilityValue('alarm_prediction_notified')) {
      this.updateCapabilityValue('alarm_prediction_notified', true);
      this.log(`Triggering prediction with the value ${this.getPredictedWattHours()} and the limit was set to ${this.settings.prediction_limit}`);
      this.homey.flow.getDeviceTriggerCard('prediction_limit_reached').trigger(this, { predicted: this.getPredictedWattHours() }, {});
    }
    if (this.settings.prediction_reset_enabled && this.getPredictedWattHours() < this.settings.prediction_reset_limit) {
      this.resetPredictionNotification();
    }
  }

  resetPredictionNotification(isNewHour = false) {
    if (this.getCapabilityValue('alarm_prediction_notified') && (!isNewHour || (isNewHour && this.settings.prediction_reset_new_hour_enabled))) {
      this.log(`Triggering prediction reset with the value ${this.getPredictedWattHours()} and the limit was set to ${this.settings.prediction_reset_limit}`);
      this.homey.flow.getDeviceTriggerCard('prediction_reset').trigger(this, { predicted: this.getPredictedWattHours() }, {});
    }
    this.updateCapabilityValue('alarm_prediction_notified', false);
  }

  resetConsumptionNotification() {
    if (this.getCapabilityValue('alarm_consumption_notified')) {
      this.homey.flow.getDeviceTriggerCard('consumption_reset').trigger(this, { previous: this.getTotalPreviousHour() }, {});
    }
    this.updateCapabilityValue('alarm_consumption_notified', false);
  }

  getTotalPreviousHour() {
    return Math.ceil(this.totalPreviousHour);
  }

  getPredictedWattHours() {
    return Math.ceil(this.predictedWattHours);
  }

  getWattHours() {
    return Math.ceil(this.wattHours);
  }

  getPeak() {
    return Math.ceil(this.wattPeak);
  }

  setNewPeak(watt) {
    this.wattPeak = watt;
  }

  setWattHours(watt) {
    this.wattHours = watt;
  }

  isNotifyAllowed(setting) {
    let earliest;
    let latest;
    let enabled;
    if (setting === 'prediction') {
      earliest = this.settings.notification_prediction_time_earliest;
      latest = this.settings.notification_prediction_time_latest;
      enabled = this.settings.notification_prediction_enabled;
    } else {
      earliest = this.settings.notification_consumption_time_earliest;
      latest = this.settings.notification_consumption_time_latest;
      enabled = this.settings.notification_consumption_enabled;
    }
    const currentTime = new Date().getMinutes();
    return enabled && currentTime <= Number(latest) && currentTime >= Number(earliest);
  }

  predict() {
    const prediction = calculations.getPrediction(this.referenceReadings, this.settings.prediction_age, this.settings.prediction_type);
    this.predictedWattHours = this.wattHours + prediction;
    this.updateCapabilityValue('meter_predictor', this.predictedWattHours);
  }

  updateReferenceReadings(watt, timeOfReading) {
    const newReading = { consumption: watt, timestamp: timeOfReading };
    if (this.referenceReadings.length > this.settings.prediction_history_count) {
      this.referenceReadings.pop();
    }
    this.referenceReadings.unshift(newReading);
  }

  async updateCapabilityValue(parameter, value) {
    this.setCapabilityValue(parameter, value).then().catch(err => this.log(`Failed to set capability value ${parameter} with the value ${value}`));
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
      this.referenceReadings = this.referenceReadings.slice(0, newSettings.prediction_history_count);
    }
  }

};
