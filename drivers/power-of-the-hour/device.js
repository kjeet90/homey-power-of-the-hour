'use strict';

const Homey = require('homey');
const calculations = require('../../lib/calculations');

const maxStoredReadings = 360; // given a update of every 5 seconds -> 60/12 = 12 * 30 minutes = 360 readings


module.exports = class PowerOfTheHour extends Homey.Device {

  async onInit() {
    this.setInitialValues();
    this.log('Initialized device', this.getName());
  }

  setInitialValues() {
    this.referenceReadings = [];
    this.wattHours = 0;
    this.wattPeak = 0;
    this.totalPreviousHour = 0;
    this.consumptionNotified = false;
    this.predictionNotified = false;
    this.predictedWattHours = 0;
    this.previousTimestamp = new Date();
    this.setCapabilityValue('consumption_notified', false);
    this.setCapabilityValue('prediction_notified', false);
    this.setCapabilityValue('consumption', this.wattHours);
    this.setCapabilityValue('consumption_peak', this.wattPeak);
    this.setCapabilityValue('consumption_previous_hour', this.totalPreviousHour);
    this.setCapabilityValue('predictor', this.predictedWattHours);
  }

  async onAdded() {
    this.setInitialValues();
  }

  onActionConsumptionChanged(args, state) {
    this.checkReading(args.consumption);
  }

  checkReading(watt) {
    const timeNow = new Date();
    const hoursSincePreviousReading = calculations.getHoursBetween(timeNow, this.previousTimestamp);
    const isNewHour = calculations.isNewHour(timeNow, this.previousTimestamp);

    if (isNewHour) {
      this.startNewHour(watt, timeNow);
    } else {
      this.wattHours += (watt * hoursSincePreviousReading);
      this.checkIfPeak(watt);
    }
    this.updateReferenceReadings(watt, timeNow);
    this.predict();
    this.checkNotify();
    this.setCapabilityValue('consumption', this.getWattHours());
    this.previousTimestamp = timeNow;
  }

  startNewHour(watt, timeNow) {
    this.totalPreviousHour = this.wattHours + (watt * calculations.getRemainingHour(this.previousTimestamp));
    this.consumptionNotified = false;
    this.predictionNotified = false;
    this.wattHours = watt * calculations.getDecimalHour(timeNow);
    this.checkIfPeak(watt, true);
    this.setCapabilityValue('consumption_previous_hour', this.totalPreviousHour);
    this.setCapabilityValue('consumption_notified', false);
    this.setCapabilityValue('prediction_notified', false);
  }

  checkIfPeak(watt, forceUpdate) {
    if (forceUpdate || watt > this.wattPeak) {
      this.wattPeak = watt;
      this.setCapabilityValue('consumption_peak', this.wattPeak);
    }
  }

  checkNotify() {
    if (this.getWattHours() > this.getSetting('consumption_limit') && this.isNotifyAllowed('notification_consumption_time') && !this.consumptionNotified) {
      Homey.app.consumptionLimitTrigger.trigger(this, this.getFlowCardTokens('consumption'), {});
      this.consumptionNotified = true;
      this.setCapabilityValue('consumption_notified', this.consumptionNotified);
    }
    if (this.getPredictedWattHours() > this.getSetting('prediction_limit') && this.isNotifyAllowed('notification_prediction_time') && !this.predictionNotified) {
      Homey.app.predictionLimitTrigger.trigger(this, this.getFlowCardTokens('prediction'), {}).then();
      this.predictionNotified = true;
      this.setCapabilityValue('prediction_notified', this.predictionNotified);
    }
  }

  getFlowCardTokens(type) {
    if (type === 'prediction') {
      return {
        predicted: this.getPredictedWattHours()
      }
    } else {
      return {
        consumption: this.getWattHours()
      };
    }
  }

  getPredictedWattHours() {
    return Math.ceil(this.predictedWattHours);
  }

  getWattHours() {
    return Math.ceil(this.wattHours);
  }

  isNotifyAllowed(setting) {
    const currentTime = new Date().getMinutes();
    const selectedTime = this.getSetting(setting);
    if (selectedTime === 'always') {
      return true;
    } else if (selectedTime === 'off') {
      return false;
    } else {
      return currentTime <= Number(selectedTime);
    }
  }

  predict() {
    if (this.referenceReadings.length > 1) {
      const prediction = calculations.getPrediction(this.referenceReadings, this.getSetting('prediction_age'));
      this.predictedWattHours = this.wattHours + prediction;
      this.setCapabilityValue('predictor', this.predictedWattHours);
    }
  }

  updateReferenceReadings(watt, timeOfReading) {
    if (this.referenceReadings.length > maxStoredReadings) {
      this.referenceReadings.pop();
    }
    this.referenceReadings.unshift(
      {
        consumption: watt,
        timestamp: timeOfReading
      });
  }

  async onSettings(oldSettings, newSettings, changedKeys) {
    if (changedKeys.includes('prediction_age')) {
      this.predict();
    }
  }
}
