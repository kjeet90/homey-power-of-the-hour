'use strict';

const Homey = require('homey');

module.exports = class PowerOfTheHour extends Homey.App {
  async onInit() {
    this.log('Power of the hour is running...');  
  }
}
