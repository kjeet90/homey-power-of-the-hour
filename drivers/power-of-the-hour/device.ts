import Homey from 'homey';
import { isNewHour, getHoursBetween, getPowerAvailable, getRemainingHour, getPrediction, getElapsedHour } from '../../lib/calculations';

class PowerOfTheHourDevice extends Homey.Device {
    previousTimestamp: Date | null = null;
    previousConsumption = 0;

    newSettings: { [index: string]: string | number | boolean | null | undefined } = {};
    setSettingsTimeout: NodeJS.Timeout | null = null;
    recalculationTimeout: NodeJS.Timeout | null = null;

    isProcessing = false;
    processingQueue: { watt: number; timeNow: Date }[] = [];
    history: { consumption: number; timestamp: Date }[] = [];

    latest: { timestamp: Date | null } = { timestamp: null };

    async onInit() {
        try {
            this.latest = (await this.getStoreValue('latest')) ?? {};
        } catch (err) {
            this.log('Failed to get latest: ', err);
            this.error(err);
        }
        const validTimeStamp = !!(this.latest.timestamp && !isNewHour(new Date(), new Date(this.latest.timestamp)));
        await this.upgradeExistingDevice();
        await this.setInitialValues(validTimeStamp);
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
        if (!this.hasCapability('meter_consumption_remaining')) await this.addCapability('meter_consumption_remaining');
        if (!this.hasCapability('meter_prediction_remaining')) await this.addCapability('meter_prediction_remaining');
    }

    async setInitialValues(validTimeStamp = false) {
        if (validTimeStamp) {
            this.log('Found valid timestamp in store, using existing capabilities.');
            this.previousTimestamp = this.latest.timestamp ? new Date(this.latest.timestamp) : null;
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
            await this.updateCapabilityValue('meter_consumption_remaining', null);
            await this.updateCapabilityValue('meter_prediction_remaining', null);
        }
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

    async onActionPriceChanged(args: { price: number }) {
        if (this.previousConsumption) await this.checkReading(this.previousConsumption, new Date()); // To calculate cost so far before new price is applied
        await this.updateCapabilityValue('meter_price', args.price);
        this.predict();
    }

    async onActionConsumptionChanged(args: { unit: 'kW' | 'W'; consumption: number }) {
        this.checkReading(args.unit === 'kW' ? args.consumption * 1000 : args.consumption, new Date());
    }

    onActionSettingChanged(args: { [index: string]: number }, setting: string) {
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
            this.newSettings = {};
        }
    }

    onActionResetAllValues() {
        this.setInitialValues();
        this.log('Reset all values');
    }

    isLimitAbove(args: { limit: number }, capability: string) {
        return this.getSetting(capability) > args.limit;
    }

    async checkReading(watt: number, timeNow: Date) {
        if (!this.isProcessing) {
            this.isProcessing = true;
            try {
                const hoursSincePreviousReading = getHoursBetween(timeNow, this.previousTimestamp);
                if (isNewHour(timeNow, this.previousTimestamp)) {
                    await this.startNewHour(watt, timeNow);
                } else {
                    const wattHours = watt * hoursSincePreviousReading;
                    await this.updateCapabilityValue('meter_consumption', this.getCapabilityValue('meter_consumption') + wattHours);
                    await this.updateCapabilityValue('meter_cost', this.getCapabilityValue('meter_cost') + (wattHours / 1000) * this.getCapabilityValue('meter_price'));
                    this.checkIfPeak(watt);
                }
                this.updateHistory(watt, timeNow);
                await this.predict();
                await this.updateRemaining(timeNow);
                await this.checkNotify();
                this.storeLatest(timeNow, watt);
                this.scheduleRecalculation(watt);
            } catch (err) {
                this.log('Failed to check readings: ', err);
            }
            this.isProcessing = false;
            if (this.processingQueue.length > 0) {
                const reading = this.processingQueue.shift();
                if (reading) {
                    await this.checkReading(reading.watt, reading.timeNow);
                }
            }
        } else {
            this.processingQueue.push({ watt, timeNow });
            this.processingQueue.sort((a: { watt: number; timeNow: Date }, b: { watt: number; timeNow: Date }) => a.timeNow.getTime() - b.timeNow.getTime());
        }
    }

    async updateRemaining(timeNow: Date) {
        const consumptionRemaining = this.getCapabilityValue('meter_consumption_remaining');
        const predictionRemaining = this.getCapabilityValue('meter_prediction_remaining');
        const newConsumptionRemaining = getPowerAvailable(this.getSetting('consumption_limit'), this.getCapabilityValue('meter_consumption'), timeNow);
        const newPredictionRemaining = getPowerAvailable(this.getSetting('prediction_limit'), this.getCapabilityValue('meter_consumption'), timeNow);
        if (consumptionRemaining !== newConsumptionRemaining) {
            await this.updateCapabilityValue('meter_consumption_remaining', newConsumptionRemaining);
            this.homey.flow
                .getDeviceTriggerCard('meter_consumption_remaining_changed')
                .trigger(this, { remaining: this.decimals(this.getCapabilityValue('meter_consumption_remaining'), 0) })
                .catch(this.error);
        }
        if (predictionRemaining !== newPredictionRemaining) {
            await this.updateCapabilityValue('meter_prediction_remaining', newPredictionRemaining);
            this.homey.flow
                .getDeviceTriggerCard('meter_prediction_remaining_changed')
                .trigger(this, { remaining: this.decimals(this.getCapabilityValue('meter_prediction_remaining'), 0) })
                .catch(this.error);
        }
    }

    async storeLatest(timeNow: Date, watt: number) {
        this.previousTimestamp = timeNow;
        this.previousConsumption = watt;
        await this.setStoreValue('latest', { timestamp: this.previousTimestamp }).catch(this.error); // Object to keep open for future implementations and also to support v1.0.0 implementation
    }

    async startNewHour(watt: number, timeNow: Date) {
        const remainingWattHours = this.previousTimestamp ? watt * getRemainingHour(this.previousTimestamp) : 0;
        await this.updateCapabilityValue('meter_consumption_previous_hour', this.getCapabilityValue('meter_consumption') + remainingWattHours);
        await this.updateCapabilityValue('meter_cost_previous_hour', this.getCapabilityValue('meter_cost') + (remainingWattHours / 1000) * this.getCapabilityValue('meter_price'));
        await this.updateCapabilityValue('meter_consumption_peak', watt);
        const wattHours = watt * getElapsedHour(timeNow);
        await this.updateCapabilityValue('meter_consumption', wattHours);
        await this.updateCapabilityValue('meter_cost', (wattHours / 1000) * this.getCapabilityValue('meter_price'));
        if (!this.getSetting('prediction_consumption_reset_transfer_enabled')) {
            await this.updateCapabilityValue('meter_predictor', 0);
            this.resetPredictionNotification(true);
        }
        if (!this.getSetting('prediction_cost_reset_transfer_enabled')) {
            await this.updateCapabilityValue('meter_cost_prediction', 0);
            this.resetCostPredictionNotification(true);
        }
        this.resetConsumptionNotification();
        this.resetCostNotification();
        this.homey.flow
            .getDeviceTriggerCard('hour_reset')
            .trigger(
                this,
                { previous: this.decimals(this.getCapabilityValue('meter_consumption_previous_hour'), 0), previousCost: this.decimals(this.getCapabilityValue('meter_cost_previous_hour'), 2) },
                {}
            )
            .catch(this.error);
    }

    async checkIfPeak(watt: number) {
        if (watt > this.getCapabilityValue('meter_consumption_peak')) {
            await this.updateCapabilityValue('meter_consumption_peak', watt);
            this.homey.flow
                .getDeviceTriggerCard('new_peak')
                .trigger(this, { peak: this.decimals(this.getCapabilityValue('meter_consumption_peak'), 0) }, {})
                .catch(this.error);
        }
    }

    async checkNotify() {
        // Predicted consumption
        if (this.getCapabilityValue('meter_predictor') > this.getSetting('prediction_limit') && this.isNotifyAllowed('prediction') && !this.getCapabilityValue('alarm_prediction_notified')) {
            await this.updateCapabilityValue('alarm_prediction_notified', true);
            this.homey.flow
                .getDeviceTriggerCard('prediction_limit_reached')
                .trigger(this, { predicted: this.decimals(this.getCapabilityValue('meter_predictor'), 0) }, {})
                .catch(this.error);
            this.log(`Triggering prediction with the value ${this.decimals(this.getCapabilityValue('meter_predictor'), 0)} and the limit was set to ${this.getSetting('prediction_limit')}`);
        }
        // Consumption
        if (this.getCapabilityValue('meter_consumption') > this.getSetting('consumption_limit') && this.isNotifyAllowed('consumption') && !this.getCapabilityValue('alarm_consumption_notified')) {
            await this.updateCapabilityValue('alarm_consumption_notified', true);
            this.homey.flow
                .getDeviceTriggerCard('consumption_limit_reached')
                .trigger(this, { consumption: this.decimals(this.getCapabilityValue('meter_consumption'), 0) }, {})
                .catch(this.error);
            this.log(`Triggering consumption with the value ${this.decimals(this.getCapabilityValue('meter_consumption'), 0)} and the limit was set to ${this.getSetting('consumption_limit')}`);
        }
        // Reset predicted consumption
        if (this.getSetting('prediction_reset_enabled') && this.getCapabilityValue('meter_predictor') < this.getSetting('prediction_reset_limit')) {
            this.resetPredictionNotification();
        }
        // Predicted cost
        if (
            this.getCapabilityValue('meter_cost_prediction') > this.getSetting('prediction_cost_limit') &&
            this.isNotifyAllowed('cost_prediction') &&
            !this.getCapabilityValue('alarm_cost_prediction_notified')
        ) {
            await this.updateCapabilityValue('alarm_cost_prediction_notified', true);
            this.homey.flow
                .getDeviceTriggerCard('prediction_cost_limit_reached')
                .trigger(this, { predicted: this.decimals(this.getCapabilityValue('meter_cost_prediction'), 2) }, {})
                .catch(this.error);
            this.log(
                `Triggering cost prediction with the value ${this.decimals(this.getCapabilityValue('meter_cost_prediction'), 2)} and the limit was set to ${this.getSetting('prediction_cost_limit')}`
            );
        }
        // Cost
        if (this.getCapabilityValue('meter_cost') > this.getSetting('cost_limit') && this.isNotifyAllowed('cost') && !this.getCapabilityValue('alarm_cost_notified')) {
            await this.updateCapabilityValue('alarm_cost_notified', true);
            this.homey.flow
                .getDeviceTriggerCard('cost_limit_reached')
                .trigger(this, { cost: this.decimals(this.getCapabilityValue('meter_cost'), 2) }, {})
                .catch(this.error);
            this.log(`Triggering cost with the value ${this.decimals(this.getCapabilityValue('meter_cost'), 2)} and the limit was set to ${this.getSetting('cost_limit')}`);
        }
        // Reset predicted cost
        if (this.getSetting('prediction_cost_reset_enabled') && this.getCapabilityValue('meter_cost_prediction') < this.getSetting('prediction_cost_reset_limit')) {
            this.resetCostPredictionNotification();
        }
    }

    async resetPredictionNotification(isNewHour = false) {
        if (this.getCapabilityValue('alarm_prediction_notified') && (!isNewHour || (isNewHour && this.getSetting('prediction_reset_new_hour_enabled')))) {
            this.homey.flow
                .getDeviceTriggerCard('prediction_reset')
                .trigger(this, { predicted: this.decimals(this.getCapabilityValue('meter_predictor'), 0) }, {})
                .catch(this.error);
            this.log(
                `Triggering prediction reset with the value ${this.decimals(this.getCapabilityValue('meter_predictor'), 0)} and the limit was set to ${this.getSetting('prediction_reset_limit')}`
            );
        }
        await this.updateCapabilityValue('alarm_prediction_notified', false);
    }

    async resetCostPredictionNotification(isNewHour = false) {
        if (this.getCapabilityValue('alarm_cost_prediction_notified') && (!isNewHour || (isNewHour && this.getSetting('prediction_cost_reset_new_hour_enabled')))) {
            this.homey.flow
                .getDeviceTriggerCard('prediction_cost_reset')
                .trigger(this, { predicted: this.decimals(this.getCapabilityValue('meter_cost_prediction'), 2) }, {})
                .catch(this.error);
            this.log(
                `Triggering cost prediction reset with the value ${this.decimals(this.getCapabilityValue('meter_cost_prediction'), 2)} and the limit was set to ${this.getSetting(
                    'prediction_cost_reset_limit'
                )}`
            );
        }
        await this.updateCapabilityValue('alarm_cost_prediction_notified', false);
    }

    async resetConsumptionNotification() {
        if (this.getCapabilityValue('alarm_consumption_notified')) {
            this.log(`Triggering consumption reset with the value ${this.decimals(this.getCapabilityValue('meter_consumption_previous_hour'), 0)}`);
            this.homey.flow
                .getDeviceTriggerCard('consumption_reset')
                .trigger(this, { previous: this.decimals(this.getCapabilityValue('meter_consumption_previous_hour'), 0) }, {})
                .catch(this.error);
        }
        await this.updateCapabilityValue('alarm_consumption_notified', false);
    }

    async resetCostNotification() {
        if (this.getCapabilityValue('alarm_cost_notified')) {
            this.log(`Triggering cost reset with the value ${this.decimals(this.getCapabilityValue('meter_cost_previous_hour'), 2)}`);
            this.homey.flow
                .getDeviceTriggerCard('cost_reset')
                .trigger(this, { previousCost: this.decimals(this.getCapabilityValue('meter_cost_previous_hour'), 2) }, {})
                .catch(this.error);
        }
        await this.updateCapabilityValue('alarm_cost_notified', false);
    }

    decimals(value: number, decimals: number) {
        return Number(value.toFixed(decimals));
    }

    isNotifyAllowed(setting: 'prediction' | 'consumption' | 'cost' | 'cost_prediction') {
        const earliest = this.getSetting(`notification_${setting}_time_earliest`);
        const latest = this.getSetting(`notification_${setting}_time_latest`);
        const enabled = this.getSetting(`notification_${setting}_enabled`);
        const currentTime = new Date().getMinutes();
        return enabled && currentTime <= Number(latest) && currentTime >= Number(earliest);
    }

    async predict() {
        const prediction = getPrediction(this.history, this.getSetting('prediction_age'), this.getSetting('prediction_type'));
        await this.updateCapabilityValue('meter_predictor', this.getCapabilityValue('meter_consumption') + prediction);
        await this.updateCapabilityValue('meter_cost_prediction', this.getCapabilityValue('meter_cost') + (prediction / 1000) * this.getCapabilityValue('meter_price'));
    }

    updateHistory(watt: number, timeOfReading: Date) {
        const newReading = { consumption: watt, timestamp: timeOfReading };
        if (this.history.length + 1 > this.getSetting('prediction_history_count')) {
            this.history.pop();
        }
        this.history.unshift(newReading);
    }

    async updateCapabilityValue(parameter: string, value: string | number | boolean | null) {
        return this.setCapabilityValue(parameter, value).catch((err: Error) => this.log(`Failed to set capability value ${parameter} with the value ${value}. --> ${err}`));
    }

    scheduleRecalculation(watt: number) {
        if (this.recalculationTimeout) {
            this.homey.clearTimeout(this.recalculationTimeout);
        }
        this.recalculationTimeout = this.homey.setTimeout(() => {
            this.log(`No data received within the last 60 seconds. Recalculating with previous received value: ${watt}W`);
            this.checkReading(watt, new Date());
        }, 60 * 1000);
    }

    async onSettings({
        oldSettings,
        newSettings,
        changedKeys
    }: {
        oldSettings: { [key: string]: string | number | boolean | null | undefined };
        newSettings: { [key: string]: string | number | boolean | null | undefined };
        changedKeys: string[];
    }): Promise<string | void> {
        if (changedKeys.includes('prediction_age')) {
            this.log(`Old prediction age: ${oldSettings['prediction_age']}, new: ${newSettings['prediction_age']}`);
            this.predict();
        }
        if (changedKeys.includes('prediction_history_count') && typeof newSettings['prediction_history_count'] === 'number') {
            this.history = this.history.slice(0, newSettings['prediction_history_count']);
        }
        return;
    }
}

module.exports = PowerOfTheHourDevice;

export default PowerOfTheHourDevice;
