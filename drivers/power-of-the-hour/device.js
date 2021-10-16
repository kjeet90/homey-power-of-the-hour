'use strict';

const Homey = require('homey');
const { isNewHour } = require('../../lib/calculations');
const calculations = require('../../lib/calculations');

module.exports = class PowerOfTheHour extends Homey.Device {

  async onInit() {
    this.setInitialValues();
    this.log('Initialized device', this.getName());
    this.updateSimulation(this.getSetting('simulation_enabled'));
    this.predict();
  }

  setInitialValues() {
    if(!isNewHour(new Date(), this.getStoreValue('previousReadingTime'))) {
      this.wattHours = this.getStoreValue('wattHours') || 0;
      this.wattPeak = this.getStoreValue('wattPeak') || 0;
    } else {
      this.wattHours = 0;
      this.wattPeak = 0;
    }
    const referenceReading = this.getStoreValue('latestReading');
    this.referenceReadings = referenceReading ? [referenceReading] : [] 
    this.totalPreviousHour = this.getStoreValue('totalPreviousHour') || 0;
    this.consumptionNotified = false;
    this.predictionNotified = false;
    this.predictedWattHours = 0;
    this.previousTimestamp = new Date();
    this.setCapabilityValue('alarm_consumption_notified', this.consumptionNotified);
    this.setCapabilityValue('alarm_prediction_notified', this.predictionNotified);
    this.setCapabilityValue('meter_consumption', this.wattHours);
    this.setCapabilityValue('meter_consumption_peak', this.wattPeak);
    this.setCapabilityValue('meter_consumption_previous_hour', this.totalPreviousHour);
    this.setCapabilityValue('meter_predictor', this.predictedWattHours);
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
    if (calculations.isNewHour(timeNow, this.previousTimestamp)) {
      this.startNewHour(watt, timeNow);
    } else {
      this.setWattHours(this.wattHours + (watt * hoursSincePreviousReading));
      this.checkIfPeak(watt);
    }
    this.updateReferenceReadings(watt, timeNow);
    this.predict();
    this.checkNotify();
    this.setCapabilityValue('meter_consumption', this.getWattHours());
    this.setStoreValue('previousReadingTime', timeNow).catch(err => this.log(err));
    this.previousTimestamp = timeNow;
    this.runSimulation(watt);
  }

  startNewHour(watt, timeNow) {
    this.setTotalPreviousHour(this.wattHours + (watt * calculations.getRemainingHour(this.previousTimestamp)));
    this.consumptionNotified = false;
    this.setWattHours(watt * calculations.getElapsedHour(timeNow));
    this.setNewPeak(watt);
    this.predictedWattHours = 0;
    this.resetPredictionNotification(true);
    this.setCapabilityValue('meter_consumption_previous_hour', this.totalPreviousHour);
    this.setCapabilityValue('alarm_consumption_notified', false);
    this.setCapabilityValue('meter_consumption_peak', this.wattPeak);
    this.homey.flow.getDeviceTriggerCard('hour_reset').trigger(this, this.getFlowCardTokens('previous'));
  }

  setTotalPreviousHour(watt) {
    this.totalPreviousHour = watt;
    this.setStoreValue('totalPreviousHour', this.totalPreviousHour);
  }

  checkIfPeak(watt) {
    if (watt > this.wattPeak) {
      this.setNewPeak(watt);
      this.homey.flow.getDeviceTriggerCard('new_peak').trigger(this, this.getFlowCardTokens('peak'), {});
      this.setCapabilityValue('meter_consumption_peak', this.wattPeak);
    }
  }

  checkNotify() {
    if (this.getWattHours() > this.getSetting('consumption_limit') && this.isNotifyAllowed('consumption') && !this.consumptionNotified) {
      this.homey.flow.getDeviceTriggerCard('consumption_limit_reached').trigger(this, this.getFlowCardTokens('consumption'), {});
      this.consumptionNotified = true;
      this.setCapabilityValue('alarm_consumption_notified', this.consumptionNotified);
    }
    if (this.getPredictedWattHours() > this.getSetting('prediction_limit') && this.isNotifyAllowed('prediction') && !this.predictionNotified) {
      this.homey.flow.getDeviceTriggerCard('prediction_limit_reached').trigger(this, this.getFlowCardTokens('prediction'), {});
      this.predictionNotified = true;
      this.setCapabilityValue('alarm_prediction_notified', this.predictionNotified);
    }
    if (this.getPredictedWattHours() < this.getSetting('prediction_reset_limit')) {
      this.resetPredictionNotification();
    }
  }

  resetPredictionNotification(isNewHour = false) {
    if (this.predictionNotified && this.getSetting('prediction_reset_enabled')) {
      if(!isNewHour || (isNewHour && this.getSetting('prediction_reset_new_hour_enabled'))) {
        this.homey.flow.getDeviceTriggerCard('prediction_reset').trigger(this, this.getFlowCardTokens('prediction'), {});
      }
    }
    this.predictionNotified = false;
    this.setCapabilityValue('alarm_prediction_notified', this.predictionNotified);
  }

  getFlowCardTokens(type) {
    if (type === 'prediction') {
      return {
        predicted: this.getPredictedWattHours()
      }
    } else if (type === 'peak') {
      return {
        peak: this.getPeak()
      }
    } else if (type === 'previous') {
      return {
        previous: this.getTotalPreviousHour()
      }
    } else {
      return {
        consumption: this.getWattHours()
      };
    }
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
    this.setStoreValue('wattPeak', this.wattPeak).catch(err => this.log(err));
  }

  setWattHours(watt) {
    this.wattHours = watt;
    this.setStoreValue('wattHours', this.wattHours).catch(err => this.log(err));
  }

  isNotifyAllowed(setting) {
    let earliest;
    let latest;
    let enabled;
    if (setting === 'prediction') {
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
    this.setCapabilityValue('meter_predictor', this.predictedWattHours);
  }

  updateReferenceReadings(watt, timeOfReading) {
    const newReading = {consumption: watt, timestamp: timeOfReading}
    if (this.referenceReadings.length > this.getSetting('prediction_history_count')) {
      this.referenceReadings.pop();
    }
    this.referenceReadings.unshift(newReading);
    this.setStoreValue('latestReading', newReading).catch(err => this.log(err));
  }

  runSimulation(watt) {    
    if(this.timeoutHolder) {
      this.homey.clearTimeout(this.timeoutHolder)
    }
    if(this.getSetting('simulation_enabled')) {
      this.timeoutHolder = this.homey.setTimeout(() => {
        this.checkReading(watt, true)
      }, this.getSetting('simulation_interval') * 1000);
    }
  }

  updateSimulation(run) {
    if (run) this.runSimulation(this.referenceReadings[0] ? this.referenceReadings[0].consumption : 0);
    else this.homey.clearTimeout(this.timeoutHolder);
  }

  async onSettings({oldSettings, newSettings, changedKeys}) {
    if (changedKeys.includes('prediction_age')) {
      this.predict();
    }
    if (changedKeys.includes('prediction_history_count')) {
      this.referenceReadings = this.referenceReadings.slice(0, newSettings.prediction_history_count);
    }
    if (changedKeys.includes('simulation_enabled') || changedKeys.includes('simulation_interval')) {
      this.updateSimulation(newSettings['simulation_enabled'])
    }
  }
}
