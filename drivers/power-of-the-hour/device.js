'use strict';

const Homey = require('homey');
const calculations = require('../../lib/calculations');

let maxStoredReadings = 360; // given a update of every 5 seconds -> 60/12 = 12 * 30 minutes = 360 readings


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
    this.wattHours = watt * calculations.getElapsedHour(timeNow);
    this.wattPeak = watt;
    this.setCapabilityValue('consumption_previous_hour', this.totalPreviousHour);
    this.setCapabilityValue('consumption_notified', false);
    this.setCapabilityValue('prediction_notified', false);
    this.setCapabilityValue('consumption_peak', this.wattPeak);
    Homey.app.hourResetTrigger.trigger(this);
  }

  checkIfPeak(watt) {
    if (watt > this.wattPeak) {
      this.wattPeak = watt;
      Homey.app.newPeakTrigger.trigger(this, this.getFlowCardTokens('peak'), {});
      this.setCapabilityValue('consumption_peak', this.wattPeak);
    }
  }

  checkNotify() {
    if (this.getWattHours() > this.getSetting('consumption_limit') && this.isNotifyAllowed('consumption') && !this.consumptionNotified) {
      Homey.app.consumptionLimitTrigger.trigger(this, this.getFlowCardTokens('consumption'), {});
      this.consumptionNotified = true;
      this.setCapabilityValue('consumption_notified', this.consumptionNotified);
    }
    if (this.getPredictedWattHours() > this.getSetting('prediction_limit') && this.isNotifyAllowed('prediction') && !this.predictionNotified) {
      Homey.app.predictionLimitTrigger.trigger(this, this.getFlowCardTokens('prediction'), {});
      this.predictionNotified = true;
      this.setCapabilityValue('prediction_notified', this.predictionNotified);
    }
    if(this.predictionNotified && this.getSetting('prediction_reset_enabled') && this.getPredictedWattHours() < this.getSetting('prediction_reset_limit')) {
      Homey.app.predictionResetLimitTrigger.trigger(this, this.getFlowCardTokens('prediction'), {});
      this.predictionNotified = false;
      this.setCapabilityValue('prediction_notified', this.predictionNotified);
    }
  }

  getFlowCardTokens(type) {
    if (type === 'prediction') {
      return {
        predicted: this.getPredictedWattHours()
      }
    } else if(type === 'peak') {
      return {
        peak: this.getPeak()
      }
    } 
    else {
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

  getPeak() {
    return Math.ceil(this.wattPeak);
  }

  isNotifyAllowed(setting) {
    let earliest;
    let latest;
    let enabled;
    if(setting === 'prediction') { 
      earliest = this.getSetting('notification_prediction_time_earliest');
      latest = this.getSetting('notification_prediction_time_latest');
      enabled = this.getSetting('notification_prediction_enabled');
    } else {
      earliest = this.getSetting('notification_consumption_time_earliest');
      latest = this.getSetting('notification_consumption_time_latest');
      enabled = this.getSetting('notification_consumption_enabled');
    }
    const currentTime = new Date().getMinutes();
    return enabled && currentTime <= Number(latest) && currentTime >= Number(earliest);
  }

  predict() {    
      const prediction = calculations.getPrediction(this.referenceReadings, this.getSetting('prediction_age'), this.getSetting('prediction_type'));
      this.predictedWattHours = this.wattHours + prediction;
      this.setCapabilityValue('predictor', this.predictedWattHours);
  }

  updateReferenceReadings(watt, timeOfReading) {
    if (this.referenceReadings.length > this.getSetting('prediction_history_count')) {
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
    if(changedKeys.includes('prediction_history_count')) {
      this.referenceReadings = this.referenceReadings.slice(0, newSettings.prediction_history_count);
    }
    // TODO: Add check on prediction_limit vs prediction_reset_limit. Reset should not be allowed to be higher
  }
}
