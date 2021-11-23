'use strict';

const Homey = require('homey');
const calculations = require('../../lib/calculations');

module.exports = class PowerOfTheHour extends Homey.Device {

  async onInit() {
    this.setInitialValues();
    this.settings = await this.getSettings();
    this.log('Initialized device', this.getName());
    this.predict();
  }

  setInitialValues() {
    this.wattHours = 0;
    this.wattPeak = 0;
    this.referenceReadings = [];
    this.totalPreviousHour = 0;
    this.consumptionNotified = false;
    this.predictionNotified = false;
    this.predictedWattHours = 0;
    this.previousTimestamp = undefined;
    this.updateCapabilityValue('alarm_consumption_notified', this.consumptionNotified);
    this.updateCapabilityValue('alarm_prediction_notified', this.predictionNotified);
    this.updateCapabilityValue('meter_consumption', this.wattHours);
    this.updateCapabilityValue('meter_consumption_peak', this.wattPeak);
    this.updateCapabilityValue('meter_consumption_previous_hour', this.totalPreviousHour);
    this.updateCapabilityValue('meter_predictor', this.predictedWattHours);
  }

  async onAdded() {
    this.setInitialValues();
  }

  onActionConsumptionChanged(args, state) {
    this.checkReading(args.consumption);
  }

  async checkReading(watt) {
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
      this.scheduleRecalculation(watt);
    } catch (err) {
      this.log('Failed to check readings: ', err);
    }
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
    this.homey.flow.getDeviceTriggerCard('hour_reset').trigger(this, this.getFlowCardTokens('previous'));
  }

  setTotalPreviousHour(watt) {
    this.totalPreviousHour = watt;
  }

  checkIfPeak(watt) {
    if (watt > this.wattPeak) {
      this.setNewPeak(watt);
      this.updateCapabilityValue('meter_consumption_peak', this.wattPeak);
      this.homey.flow.getDeviceTriggerCard('new_peak').trigger(this, this.getFlowCardTokens('peak'), {});
    }
  }

  checkNotify() {
    if (this.getWattHours() > this.settings.consumption_limit && this.isNotifyAllowed('consumption') && !this.consumptionNotified) {
      this.consumptionNotified = true;
      this.updateCapabilityValue('alarm_consumption_notified', this.consumptionNotified);
      this.homey.flow.getDeviceTriggerCard('consumption_limit_reached').trigger(this, this.getFlowCardTokens('consumption'), {});
    }
    if (this.getPredictedWattHours() > this.settings.prediction_limit && this.isNotifyAllowed('prediction') && !this.predictionNotified) {
      this.predictionNotified = true;
      this.updateCapabilityValue('alarm_prediction_notified', this.predictionNotified);
      this.homey.flow.getDeviceTriggerCard('prediction_limit_reached').trigger(this, this.getFlowCardTokens('prediction'), {});
    }
    if (this.settings.prediction_reset_enabled && this.getPredictedWattHours() < this.settings.prediction_reset_limit) {
      this.resetPredictionNotification();
    }
  }

  resetPredictionNotification(isNewHour = false) {
    this.updateCapabilityValue('alarm_prediction_notified', false);
    if (this.predictionNotified && (!isNewHour || (isNewHour && this.settings.prediction_reset_new_hour_enabled))) {
      this.homey.flow.getDeviceTriggerCard('prediction_reset').trigger(this, this.getFlowCardTokens('prediction'), {});
    }
    this.predictionNotified = false;
  }

  resetConsumptionNotification() {
    this.updateCapabilityValue('alarm_consumption_notified', false);
    if (this.consumptionNotified) {
      this.homey.flow.getDeviceTriggerCard('consumption_reset').trigger(this, this.getFlowCardTokens('previous'), {});
    }
    this.consumptionNotified = false;
  }

  getFlowCardTokens(type) {
    if (type === 'prediction') {
      return {
        predicted: this.getPredictedWattHours(),
      };
    } if (type === 'peak') {
      return {
        peak: this.getPeak(),
      };
    } if (type === 'previous') {
      return {
        previous: this.getTotalPreviousHour(),
      };
    }
    return {
      consumption: this.getWattHours(),
    };
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
