import { describe, it, expect, vi, beforeEach } from 'vitest';

import PowerOfTheHourDevice from './device';
import * as calculations from '../../lib/calculations';

const flowTriggerValues: { [index: string]: any[] } = {};

const clearFlowTriggerValues = () => {
    Object.keys(flowTriggerValues).forEach((k) => delete flowTriggerValues[k]);
};

vi.mock('homey', () => {
    const Device = vi.fn();

    Device.prototype.getAppId = vi.fn();

    Device.prototype.hasCapability = vi.fn();

    Device.prototype.setCapabilityValue = vi.fn();

    Device.prototype.getCapabilityValue = vi.fn();

    Device.prototype.addCapability = vi.fn();

    Device.prototype.log = vi.fn();

    Device.prototype.error = vi.fn();

    Device.prototype.getName = vi.fn();

    Device.prototype.getSetting = vi.fn();

    Device.prototype.getStoreValue = vi.fn();

    Device.prototype.setSettings = vi.fn();

    Device.prototype.setStoreValue = vi.fn();

    Device.prototype.homey = {
        clearTimeout: vi.fn().mockImplementation((cb) => {
            return clearTimeout(cb);
        }),
        setTimeout: vi.fn().mockImplementation((cb, ms) => {
            return setTimeout(cb, ms);
        }),
        flow: {
            getDeviceTriggerCard: vi.fn().mockImplementation((flowCard: string) => ({
                trigger: vi.fn().mockImplementation((_device, tokens) => {
                    return new Promise<void>((resolve, _reject) => {
                        if (!flowTriggerValues[flowCard]) flowTriggerValues[flowCard] = [tokens];
                        else flowTriggerValues[flowCard].push(tokens);
                        resolve();
                    });
                })
            }))
        }
    };

    const Homey = { Device };

    return { default: Homey };
});

beforeEach(() => {
    clearFlowTriggerValues();
});

describe('POTH', () => {
    it('should be defined', () => {
        const unit = new PowerOfTheHourDevice();
        expect(unit).toBeDefined();
    });

    describe('onInit', () => {
        it('should call setCapabilityValue with empty values when no valid timestamp is found', async () => {
            const unit = new PowerOfTheHourDevice();

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            vi.spyOn(unit, 'getStoreValue').mockResolvedValue(undefined);
            vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');

            await unit.onInit();

            expect(setInitialValuesSpy).toHaveBeenCalledWith(false);
        });

        it('should call setCapabilityValue with empty values when no valid timestamp is found', async () => {
            const unit = new PowerOfTheHourDevice();

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            vi.spyOn(unit, 'getStoreValue').mockResolvedValue({ timestamp: null });
            vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');

            await unit.onInit();

            expect(setInitialValuesSpy).toHaveBeenCalledWith(false);
        });

        it('should call setCapabilityValue with empty values when a too old timestamp is found', async () => {
            const unit = new PowerOfTheHourDevice();

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T11:58:00.000Z'));
            vi.spyOn(unit, 'getStoreValue').mockResolvedValue({ timestamp: '2023-05-15T12:02:00.000Z' });
            vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');

            await unit.onInit();

            expect(setInitialValuesSpy).toHaveBeenCalledWith(false);
            expect(unit.previousTimestamp).toBe(null);
        });

        it('should call setCapabilityValue with empty values it fails to get latest store value', async () => {
            const unit = new PowerOfTheHourDevice();

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T11:58:00.000Z'));
            vi.spyOn(unit, 'getStoreValue').mockRejectedValue('Nope');
            vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');
            const logSpy = vi.spyOn(unit, 'log');

            await unit.onInit();

            expect(logSpy).toHaveBeenCalledWith('Failed to get latest: ', 'Nope');
            expect(setInitialValuesSpy).toHaveBeenCalledWith(false);
            expect(unit.previousTimestamp).toBe(null);
        });

        it('should use the existing values if timestamp is found and is valid', async () => {
            const unit = new PowerOfTheHourDevice();

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            vi.spyOn(unit, 'getStoreValue').mockResolvedValue({ timestamp: '2023-05-15T12:02:00.000Z' });
            vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');

            await unit.onInit();

            expect(setInitialValuesSpy).toHaveBeenCalledWith(true);
            expect(unit.previousTimestamp).toEqual(new Date('2023-05-15T12:02:00.000Z'));
        });
    });

    describe('upgradeExistingDevice', () => {
        it('should only call addCapability of non-existing capabilities', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'addCapability').mockResolvedValue();
            vi.spyOn(unit, 'hasCapability').mockImplementation((capability: string) => {
                return capability === 'alarm_cost_notified';
            });

            await unit.upgradeExistingDevice();

            expect(unit.addCapability).toHaveBeenCalledTimes(7);
            expect(unit.addCapability).not.toHaveBeenCalledWith('alarm_cost_notified');
            expect(unit.addCapability).toHaveBeenCalledWith('meter_cost');
            expect(unit.addCapability).toHaveBeenCalledWith('meter_cost_prediction');
            expect(unit.addCapability).toHaveBeenCalledWith('alarm_cost_prediction_notified');
            expect(unit.addCapability).toHaveBeenCalledWith('meter_price');
            expect(unit.addCapability).toHaveBeenCalledWith('meter_cost_previous_hour');
            expect(unit.addCapability).toHaveBeenCalledWith('meter_consumption_remaining');
            expect(unit.addCapability).toHaveBeenCalledWith('meter_prediction_remaining');
        });
    });

    describe('setInitialValues', async () => {
        it('should clear capabilities if called with nothing', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            const setCapabilitySpy = vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            await unit.setInitialValues();
            expect(setCapabilitySpy).toHaveBeenCalledTimes(13);
        });
        it('should clear capabilities if called with false', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            const setCapabilitySpy = vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            await unit.setInitialValues(false);
            expect(setCapabilitySpy).toHaveBeenCalledTimes(13);
        });

        it('should set previous timestamp to current time', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            const setCapabilitySpy = vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            await unit.setInitialValues(true);
            expect(setCapabilitySpy).not.toHaveBeenCalled();
        });
    });

    describe('onAdded', () => {
        it('should set initial values when a new device is added', () => {
            const unit = new PowerOfTheHourDevice();
            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');
            vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();

            unit.onAdded();

            expect(setInitialValuesSpy).toHaveBeenCalledOnce();
        });
    });

    describe('onDeleted', () => {
        it('should clear recalculation timeout if it is defined', () => {
            const unit = new PowerOfTheHourDevice();
            unit.recalculationTimeout = setTimeout(() => console.log('this timeout should be cancelled'), 2000);
            const spyClearTimeout = vi.spyOn(unit.homey, 'clearTimeout');
            expect(unit.recalculationTimeout).not.toBe(null);
            unit.onDeleted();
            expect(spyClearTimeout).toHaveBeenCalledWith(expect.any(Object));
            expect(unit.recalculationTimeout).toBe(null);
        });

        it('should not clear recalculation timeout if it is not defined', () => {
            const unit = new PowerOfTheHourDevice();
            unit.recalculationTimeout = null;
            const spyClearTimeout = vi.spyOn(unit.homey, 'clearTimeout');
            expect(unit.recalculationTimeout).toBe(null);
            unit.onDeleted();
            expect(spyClearTimeout).not.toHaveBeenCalled();
            expect(unit.recalculationTimeout).toBe(null);
        });
    });

    describe('onActionPriceChanged', () => {
        it('should call checkReading if previousConsumption is defined', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            const checkReadingSpy = vi.spyOn(unit, 'checkReading');
            const setCapabilitySpy = vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            unit.previousConsumption = 1233;
            await unit.onActionPriceChanged({ price: 1.25 });
            expect(checkReadingSpy).toHaveBeenCalledWith(1233, new Date('2023-05-15T12:05:00.000Z'));
            expect(setCapabilitySpy).toHaveBeenCalledWith('meter_price', 1.25);
        });

        it('should not call checkReading if previousConsumption is not defined', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            const checkReadingSpy = vi.spyOn(unit, 'checkReading');
            const setCapabilitySpy = vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            unit.previousConsumption = 0;
            await unit.onActionPriceChanged({ price: 1.25 });
            expect(checkReadingSpy).not.toHaveBeenCalled();
            expect(setCapabilitySpy).toHaveBeenCalledWith('meter_price', 1.25);
        });
    });

    describe('onActionConsumptionChanged', () => {
        it('should call checkReading with consumption in W', () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            const checkReadingSpy = vi.spyOn(unit, 'checkReading');
            unit.onActionConsumptionChanged({ unit: 'W', consumption: 1337 });
            expect(checkReadingSpy).toHaveBeenCalledWith(1337, new Date('2023-05-15T12:05:00.000Z'));
        });

        it('should call checkReading with consumption * 1000 in kW', () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));
            const checkReadingSpy = vi.spyOn(unit, 'checkReading');
            unit.onActionConsumptionChanged({ unit: 'kW', consumption: 1337 });
            expect(checkReadingSpy).toHaveBeenCalledWith(1337000, new Date('2023-05-15T12:05:00.000Z'));
        });
    });

    describe('onActionSettingsChanged', () => {
        it('should add settings to queue and call queueSettings', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'setSettings').mockResolvedValue();
            const queueSettingsSpy = vi.spyOn(unit, 'queueSettings');
            expect(unit.newSettings).toEqual({});
            unit.onActionSettingChanged({ someSetting: 1234 }, 'someSetting');
            expect(unit.newSettings).toEqual({ someSetting: 1234 });
            expect(queueSettingsSpy).toHaveBeenCalledOnce();
        });

        it('should append to the newSettings if onActionSettingsChanged is called multiple times', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'setSettings').mockResolvedValue();
            const queueSettingsSpy = vi.spyOn(unit, 'queueSettings');
            expect(unit.newSettings).toEqual({});
            unit.onActionSettingChanged({ someSetting: 1234 }, 'someSetting');
            unit.onActionSettingChanged({ someOtherSetting: 567 }, 'someOtherSetting');
            expect(unit.newSettings).toEqual({ someSetting: 1234, someOtherSetting: 567 });
            expect(queueSettingsSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('queueSettings', () => {
        it('should queue settings and call writeSettings after 500ms', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'setSettings').mockResolvedValue();
            const queueSettingsSpy = vi.spyOn(unit, 'queueSettings');
            const writeNewSettingsSpy = vi.spyOn(unit, 'writeNewSettings');
            const setTimeoutSpy = vi.spyOn(unit.homey, 'setTimeout');
            const clearTimeoutSpy = vi.spyOn(unit.homey, 'clearTimeout');
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:05:00.000Z'));

            expect(unit.setSettingsTimeout).toBe(null);
            unit.onActionSettingChanged({ someSetting: 1234 }, 'someSetting');
            expect(unit.newSettings).toEqual({ someSetting: 1234 });
            expect(unit.setSettingsTimeout).toBeDefined();
            unit.onActionSettingChanged({ someOtherSetting: 567 }, 'someOtherSetting');
            expect(queueSettingsSpy).toHaveBeenCalledTimes(2);
            expect(clearTimeoutSpy).toHaveBeenCalledOnce();
            expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(unit.newSettings).toEqual({ someSetting: 1234, someOtherSetting: 567 });

            vi.advanceTimersByTime(400);

            expect(writeNewSettingsSpy).not.toHaveBeenCalled();

            vi.advanceTimersByTime(101);

            expect(writeNewSettingsSpy).toHaveBeenCalledOnce();
        });
    });

    describe('writeNewSettings', () => {
        it('should call setSettings if newSettings is not empty and clear new settings', async () => {
            const unit = new PowerOfTheHourDevice();
            const setSettingsSpy = vi.spyOn(unit, 'setSettings').mockResolvedValue();
            unit.newSettings = { someSetting: 1234, someOtherSetting: 567 };

            await unit.writeNewSettings();

            expect(unit.newSettings).toEqual({});
            expect(setSettingsSpy).toHaveBeenCalledOnce();
            expect(setSettingsSpy).toHaveBeenCalledWith({ someSetting: 1234, someOtherSetting: 567 });
        });

        it('should not call setSettings if newSettings is empty', async () => {
            const unit = new PowerOfTheHourDevice();
            const setSettingsSpy = vi.spyOn(unit, 'setSettings').mockResolvedValue();
            unit.newSettings = {};

            await unit.writeNewSettings();

            expect(unit.newSettings).toEqual({});
            expect(setSettingsSpy).not.toHaveBeenCalled();
        });
    });

    describe('onActionResetAllValues', () => {
        it('should call setInitialValues', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');
            unit.onActionResetAllValues();
            expect(setInitialValuesSpy).toHaveBeenCalledOnce();
        });
    });

    describe('isLimitAbove', () => {
        it('should return true if value is higher than setting', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'getSetting').mockImplementation(() => 3500);
            const result = unit.isLimitAbove({ limit: 3000 }, 'prediction_limit');
            expect(result).toBe(true);
        });

        it('should return false if value is lower than setting', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'getSetting').mockImplementation(() => 2800);
            const result = unit.isLimitAbove({ limit: 3000 }, 'prediction_limit');
            expect(result).toBe(false);
        });

        it('should return false if value is equal to setting', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'getSetting').mockImplementation(() => 3000);
            const result = unit.isLimitAbove({ limit: 3000 }, 'prediction_limit');
            expect(result).toBe(false);
        });
    });

    describe('checkReading', () => {
        it('should call start new hour if no previous timestamp is found when processing', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(calculations, 'isNewHour');

            const startNewHourSpy = vi.spyOn(unit, 'startNewHour').mockResolvedValue();
            vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const checkIfPeakSpy = vi.spyOn(unit, 'checkIfPeak').mockResolvedValue();

            expect(unit.previousTimestamp).toBe(null);

            await unit.checkReading(1000, new Date('2023-05-15T12:05:01.000Z'));

            expect(startNewHourSpy).toHaveBeenCalledOnce();
            expect(checkIfPeakSpy).not.toHaveBeenCalledOnce();
        });

        it('should not call start new hour if previous timestamp is found when processing', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T12:05:01.000Z');

            const logSpy = vi.spyOn(unit, 'log');
            const startNewHourSpy = vi.spyOn(unit, 'startNewHour').mockResolvedValue();
            vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'updateHistory').mockResolvedValue();
            vi.spyOn(unit, 'predict').mockResolvedValue();
            vi.spyOn(unit, 'updateRemaining').mockResolvedValue();
            vi.spyOn(unit, 'checkNotify').mockResolvedValue();
            vi.spyOn(unit, 'storeLatest').mockResolvedValue();
            vi.spyOn(unit, 'scheduleRecalculation');
            const checkIfPeakSpy = vi.spyOn(unit, 'checkIfPeak').mockResolvedValue();

            expect(unit.previousTimestamp).toEqual(new Date('2023-05-15T12:05:01.000Z'));

            await unit.checkReading(1000, new Date('2023-05-15T12:05:01.000Z'));

            expect(startNewHourSpy).not.toHaveBeenCalled();
            expect(checkIfPeakSpy).toHaveBeenCalledOnce();
            expect(logSpy).not.toHaveBeenCalled();
        });

        it('should catch a error thrown', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T12:05:01.000Z');

            const startNewHourSpy = vi.spyOn(unit, 'startNewHour').mockResolvedValue();
            const logSpy = vi.spyOn(unit, 'log');
            vi.spyOn(unit, 'updateCapabilityValue').mockRejectedValueOnce('#err');
            const checkIfPeakSpy = vi.spyOn(unit, 'checkIfPeak').mockResolvedValue();

            expect(unit.previousTimestamp).toEqual(new Date('2023-05-15T12:05:01.000Z'));
            await unit.checkReading(1000, new Date('2023-05-15T12:05:01.000Z'));

            expect(startNewHourSpy).not.toHaveBeenCalled();
            expect(checkIfPeakSpy).not.toHaveBeenCalledOnce();
            expect(logSpy).toHaveBeenCalledWith('Failed to check readings: ', '#err');
        });

        it('should add to processing queue if it is already processing', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T12:05:01.000Z');

            unit.processingQueue = [
                { watt: 1000, timeNow: new Date('2023-05-15T12:05:02.000Z') },
                { watt: 1001, timeNow: new Date('2023-05-15T12:05:03.000Z') },
                { watt: 1002, timeNow: new Date('2023-05-15T12:05:04.000Z') }
            ];
            unit.isProcessing = true;
            unit.checkReading(1003, new Date('2023-05-15T12:05:05.000Z'));
            expect(unit.processingQueue.length).toBe(4);
            expect(unit.processingQueue[3]).toEqual({ watt: 1003, timeNow: new Date('2023-05-15T12:05:05.000Z') });
        });

        it('should process next in processing queue until queue is empty', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T12:05:01.000Z');
            const checkReadingSpy = vi.spyOn(unit, 'checkReading');
            unit.processingQueue = [
                { watt: 1000, timeNow: new Date('2023-05-15T12:05:02.000Z') },
                { watt: 1001, timeNow: new Date('2023-05-15T12:05:03.000Z') },
                { watt: 1002, timeNow: new Date('2023-05-15T12:05:04.000Z') }
            ];
            unit.isProcessing = false;
            await unit.checkReading(1003, new Date('2023-05-15T12:05:05.000Z'));
            expect(unit.processingQueue.length).toBe(0);
            expect(checkReadingSpy).toHaveBeenCalledTimes(4);
        });
    });

    describe('updateRemaining', () => {
        it('should trigger meter_consumption_remaining_changed if new value is not equal to previous', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const deviceTriggerSpy = vi.spyOn(unit.homey.flow, 'getDeviceTriggerCard');
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption_remaining') return 1000;
                else if (c === 'meter_consumption') return 100;
                else if (c === 'meter_prediction_remaining') return 4400;
            });
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'consumption_limit') return 4300;
                else if (s === 'prediction_limit') return 4500;
            });
            await unit.updateRemaining(new Date('2023-05-15T12:00:00.000Z'));
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_consumption_remaining', 4200);
            expect(updateCapabilitySpy).not.toHaveBeenCalledWith('meter_prediction_remaining', expect.anything());
            expect(deviceTriggerSpy).toHaveBeenCalledWith('meter_consumption_remaining_changed');
            expect(deviceTriggerSpy).not.toHaveBeenCalledWith('meter_prediction_remaining_changed');

            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                meter_consumption_remaining_changed: [{ remaining: 1000 }]
            });
            /* eslint-enable camelcase */
        });

        it('should trigger meter_prediction_remaining_changed if new value is not equal to previous', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const deviceTriggerSpy = vi.spyOn(unit.homey.flow, 'getDeviceTriggerCard');
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption_remaining') return 4200;
                else if (c === 'meter_consumption') return 100;
                else if (c === 'meter_prediction_remaining') return 1500;
            });
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'consumption_limit') return 4300;
                else if (s === 'prediction_limit') return 4500;
            });
            await unit.updateRemaining(new Date('2023-05-15T12:00:00.000Z'));
            expect(updateCapabilitySpy).not.toHaveBeenCalledWith('meter_consumption_remaining', expect.anything());
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_prediction_remaining', 4400);
            expect(deviceTriggerSpy).not.toHaveBeenCalledWith('meter_consumption_remaining_changed');
            expect(deviceTriggerSpy).toHaveBeenCalledWith('meter_prediction_remaining_changed');

            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                meter_prediction_remaining_changed: [{ remaining: 1500 }]
            });
            /* eslint-enable camelcase */
        });

        it('should trigger both meter_consumption_remaining_changed and meter_prediction_remaining_changed if new value is not equal to previous', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const deviceTriggerSpy = vi.spyOn(unit.homey.flow, 'getDeviceTriggerCard');
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption_remaining') return 1000;
                else if (c === 'meter_consumption') return 100;
                else if (c === 'meter_prediction_remaining') return 1500;
            });
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'consumption_limit') return 4300;
                else if (s === 'prediction_limit') return 4500;
            });
            await unit.updateRemaining(new Date('2023-05-15T12:00:00.000Z'));
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_consumption_remaining', 4200);
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_prediction_remaining', 4400);
            expect(deviceTriggerSpy).toHaveBeenCalledWith('meter_consumption_remaining_changed');
            expect(deviceTriggerSpy).toHaveBeenCalledWith('meter_prediction_remaining_changed');

            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                meter_consumption_remaining_changed: [{ remaining: 1000 }],
                meter_prediction_remaining_changed: [{ remaining: 1500 }]
            });
            /* eslint-enable camelcase */
        });
    });

    describe('storeLatest', () => {
        it('should update the previousTimestamp when a new one is sent in', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'setStoreValue').mockResolvedValue();
            unit.previousTimestamp = new Date('2023-05-15T12:00:00.000Z');
            await unit.storeLatest(new Date('2023-05-15T12:05:00.000Z'), 1002);
            expect(unit.previousTimestamp).toEqual(new Date('2023-05-15T12:05:00.000Z'));
        });

        it('should update the previousConsumption when a new one is sent in', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'setStoreValue').mockResolvedValue();
            unit.previousConsumption = 1337;
            await unit.storeLatest(new Date('2023-05-15T12:05:00.000Z'), 2222);
            expect(unit.previousConsumption).toBe(2222);
        });

        it('should call setStoreValue with the new timestamp', async () => {
            const unit = new PowerOfTheHourDevice();
            const setStoreValueSpy = vi.spyOn(unit, 'setStoreValue').mockResolvedValue();
            unit.previousConsumption = 1337;
            await unit.storeLatest(new Date('2023-05-15T12:05:00.000Z'), 2222);
            expect(setStoreValueSpy).toHaveBeenCalledWith('latest', { timestamp: new Date('2023-05-15T12:05:00.000Z') });
        });

        it('should catch error when calling setStoreValue', async () => {
            const unit = new PowerOfTheHourDevice();
            const errorSpy = vi.spyOn(unit, 'error');
            vi.spyOn(unit, 'setStoreValue').mockRejectedValue('Oh noes');
            unit.previousConsumption = 1337;
            await unit.storeLatest(new Date('2023-05-15T12:05:00.000Z'), 2222);
            expect(errorSpy).toHaveBeenCalledWith('Oh noes');
        });
    });

    describe('startNewHour', () => {
        it('should handle having no previousTimeStamp for calculating the remainingWattHours', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = null;
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption') return 340;
                else if (c === 'meter_cost') return 3;
                else if (c === 'meter_price') return 0.5;
                else if (c === 'meter_consumption_previous_hour') return 340;
                else if (c === 'meter_cost_previous_hour') return 3.5;
            });
            await unit.startNewHour(100, new Date('2023-05-15T12:00:00.000Z'));
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_consumption_previous_hour', 340);
        });
        it('should handle having previousTimeStamp for calculating the remainingWattHours', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T11:45:00.000Z');
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption') return 1000;
                else if (c === 'meter_cost') return 3;
                else if (c === 'meter_price') return 0.5;
                else if (c === 'meter_consumption_previous_hour') return 1025;
                else if (c === 'meter_cost_previous_hour') return 3.5;
            });
            await unit.startNewHour(100, new Date('2023-05-15T12:00:00.000Z'));
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_consumption_previous_hour', 1025);
        });

        it('should update all the meter capabilities and trigger hour_reset', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T11:45:00.000Z');
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const resetConsumptionNotificationSpy = vi.spyOn(unit, 'resetConsumptionNotification');
            const resetCostNotificationSpy = vi.spyOn(unit, 'resetCostNotification');
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption') return 1000;
                else if (c === 'meter_cost') return 3;
                else if (c === 'meter_price') return 0.5;
                else if (c === 'meter_consumption_previous_hour') return 1025;
                else if (c === 'meter_cost_previous_hour') return 3.5;
            });
            await unit.startNewHour(100, new Date('2023-05-15T12:00:10.000Z'));
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_consumption_previous_hour', 1025);
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_cost_previous_hour', 3.0125);
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_consumption_peak', 100);
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_consumption', 0.2777777777777778);
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_cost', 0.0001388888888888889);
            expect(resetConsumptionNotificationSpy).toHaveBeenCalledOnce();
            expect(resetCostNotificationSpy).toHaveBeenCalledOnce();
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                hour_reset: [
                    {
                        previous: 1025,
                        previousCost: 3.5
                    }
                ]
            });
            /* eslint-enable camelcase */
        });

        it('should call resetPredictionNotification if prediction_consumption_reset_transfer_enabled is false', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T11:45:00.000Z');
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const resetPredictionNotificationSpy = vi.spyOn(unit, 'resetPredictionNotification');
            vi.spyOn(unit, 'getSetting').mockImplementation((c) => {
                if (c === 'prediction_consumption_reset_transfer_enabled') return false;
            });
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c.startsWith('meter')) return 0;
            });
            await unit.startNewHour(100, new Date('2023-05-15T12:00:10.000Z'));
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_predictor', 0);
            expect(resetPredictionNotificationSpy).toHaveBeenCalledWith(true);
        });

        it('should NOT call resetPredictionNotification if prediction_consumption_reset_transfer_enabled is true', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T11:45:00.000Z');
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const resetPredictionNotificationSpy = vi.spyOn(unit, 'resetPredictionNotification');
            vi.spyOn(unit, 'getSetting').mockImplementation((c) => {
                if (c === 'prediction_consumption_reset_transfer_enabled') return true;
            });
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c.startsWith('meter')) return 0;
            });
            await unit.startNewHour(100, new Date('2023-05-15T12:00:10.000Z'));
            expect(updateCapabilitySpy).not.toHaveBeenCalledWith('meter_predictor', expect.anything());
            expect(resetPredictionNotificationSpy).not.toHaveBeenCalled();
        });

        it('should call resetCostPredictionNotification if prediction_cost_reset_transfer_enabled is false', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T11:45:00.000Z');
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const resetCostPredictionNotificationSpy = vi.spyOn(unit, 'resetCostPredictionNotification');
            vi.spyOn(unit, 'getSetting').mockImplementation((c) => {
                if (c === 'prediction_cost_reset_transfer_enabled') return false;
            });
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c.startsWith('meter')) return 0;
            });
            await unit.startNewHour(100, new Date('2023-05-15T12:00:10.000Z'));
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_cost_prediction', 0);
            expect(resetCostPredictionNotificationSpy).toHaveBeenCalledWith(true);
        });

        it('should NOT call resetCostPredictionNotification if prediction_cost_reset_transfer_enabled is false', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.previousTimestamp = new Date('2023-05-15T11:45:00.000Z');
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            const resetCostPredictionNotificationSpy = vi.spyOn(unit, 'resetCostPredictionNotification');
            vi.spyOn(unit, 'getSetting').mockImplementation((c) => {
                if (c === 'prediction_cost_reset_transfer_enabled') return true;
            });
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c.startsWith('meter')) return 0;
            });
            await unit.startNewHour(100, new Date('2023-05-15T12:00:10.000Z'));
            expect(updateCapabilitySpy).not.toHaveBeenCalledWith('meter_cost_prediction', expect.anything());
            expect(resetCostPredictionNotificationSpy).not.toHaveBeenCalled();
        });
    });

    describe('checkIfPeak', () => {
        it('should NOT update capability and NOT trigger flow card if watt is lower than meter_consumption_peak', async () => {
            const unit = new PowerOfTheHourDevice();
            let peak = 1000;
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption_peak') return peak;
            });
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockImplementation((c, v) => {
                return new Promise<void>((resolve, _reject) => {
                    if (c === 'meter_consumption_peak') peak = Number(v);
                    resolve();
                });
            });
            await unit.checkIfPeak(999);
            expect(updateCapabilitySpy).not.toHaveBeenCalled();
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({});
            /* eslint-enable camelcase */
        });

        it('should NOT update capability and NOT trigger flow card if watt is equal to meter_consumption_peak', async () => {
            const unit = new PowerOfTheHourDevice();
            let peak = 1000;
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption_peak') return peak;
            });
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockImplementation((c, v) => {
                return new Promise<void>((resolve, _reject) => {
                    if (c === 'meter_consumption_peak') peak = Number(v);
                    resolve();
                });
            });
            await unit.checkIfPeak(1000);
            expect(updateCapabilitySpy).not.toHaveBeenCalled();
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({});
            /* eslint-enable camelcase */
        });

        it('should update capability and trigger flow card if watt is greater than meter_consumption_peak', async () => {
            const unit = new PowerOfTheHourDevice();
            let peak = 1000;
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption_peak') return peak;
            });
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockImplementation((c, v) => {
                return new Promise<void>((resolve, _reject) => {
                    if (c === 'meter_consumption_peak') peak = Number(v);
                    resolve();
                });
            });
            await unit.checkIfPeak(1001);
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_consumption_peak', 1001); // 1000 since updateCapabilityValue does not update anything
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                new_peak: [{ peak: 1001 }]
            });
            /* eslint-enable camelcase */
        });
    });

    describe('checkIfNotify', () => {
        describe('predicted notification', () => {
            it('should not notify if meter_predictor is less than the prediction_limit, allowed to notify and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_limit') return 1500;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_predictor') return 1000;
                    else if (c === 'alarm_prediction_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                expect(flowTriggerValues).toEqual({});
            });

            it('shoul notify if meter_predictor is greater than the prediction_limit, allowed to notify and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_limit') return 1000;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_predictor') return 1500;
                    else if (c === 'alarm_prediction_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_prediction_notified', true);
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({ prediction_limit_reached: [{ predicted: 1500 }] });
                /* eslint-enable camelcase */
            });

            it('shoul NOT notify if meter_predictor is greater than the prediction_limit, allowed to notify is FALSE and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => false);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_limit') return 1000;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_predictor') return 1500;
                    else if (c === 'alarm_prediction_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({});
                /* eslint-enable camelcase */
            });

            it('shoul NOT notify if meter_predictor is greater than the prediction_limit, allowed to notify but notified is TRUE', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => false);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_limit') return 1000;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_predictor') return 1500;
                    else if (c === 'alarm_prediction_notified') return true;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({});
                /* eslint-enable camelcase */
            });
        });

        describe('consumption notification', () => {
            it('should not notify if meter_consumption is less than the consumption_limit, allowed to notify and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'consumption_limit') return 1500;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_consumption') return 1000;
                    else if (c === 'alarm_consumption_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({});
                /* eslint-enable camelcase */
            });

            it('shoul notify if meter_consumption is greater than the consumption_limit, allowed to notify and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'consumption_limit') return 1000;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_consumption') return 1500;
                    else if (c === 'alarm_consumption_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_consumption_notified', true);
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({
                    consumption_limit_reached: [{ consumption: 1500 }]
                });
                /* eslint-enable camelcase */
            });

            it('shoul NOT notify if meter_consumption is greater than the consumption_limit, allowed to notify is FALSE and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => false);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'consumption_limit') return 1000;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_consumption') return 1500;
                    else if (c === 'alarm_consumption_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
            });

            it('shoul NOT notify if meter_consumption is greater than the consumption_limit, allowed to notify but notified is TRUE', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'consumption_limit') return 1000;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_consumption') return 1500;
                    else if (c === 'alarm_consumption_notified') return true;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({});
                /* eslint-enable camelcase */
            });
        });

        describe('Reset predicted notifiction', () => {
            it('should call resetPredictionNotification if prediction_reset_enabled is true, meter_predictor is less than the prediction_reset_limit', async () => {
                const unit = new PowerOfTheHourDevice();
                vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                const resetPredictionNotificationSpy = vi.spyOn(unit, 'resetPredictionNotification');
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_reset_limit') return 1500;
                    else if (s === 'prediction_reset_enabled') return true;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_predictor') return 1000;
                });

                await unit.checkNotify();
                expect(resetPredictionNotificationSpy).toHaveBeenCalled();
            });

            it('should NOT call resetPredictionNotification if prediction_reset_enabled is false, meter_predictor is less than the prediction_reset_limit', async () => {
                const unit = new PowerOfTheHourDevice();
                vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                const resetPredictionNotificationSpy = vi.spyOn(unit, 'resetPredictionNotification');
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_reset_limit') return 1500;
                    else if (s === 'prediction_reset_enabled') return false;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_predictor') return 1000;
                });

                await unit.checkNotify();
                expect(resetPredictionNotificationSpy).not.toHaveBeenCalled();
            });

            it('should NOT call resetPredictionNotification if prediction_reset_enabled is true, meter_predictor is greater than the prediction_reset_limit', async () => {
                const unit = new PowerOfTheHourDevice();
                vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                const resetPredictionNotificationSpy = vi.spyOn(unit, 'resetPredictionNotification');
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_reset_limit') return 1000;
                    else if (s === 'prediction_reset_enabled') return true;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_predictor') return 1500;
                });

                await unit.checkNotify();
                expect(resetPredictionNotificationSpy).not.toHaveBeenCalled();
            });
        });

        describe('predicted cost', () => {
            it('should not notify if meter_cost_predictor is less than the prediction_cost_limit, allowed to notify and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_cost_limit') return 1.5;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost_predictor') return 1;
                    else if (c === 'alarm_cost_prediction_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                expect(flowTriggerValues).toEqual({});
            });

            it('shoul notify if meter_cost_predictor is greater than the prediction_cost_limit, allowed to notify and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_cost_limit') return 1;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost_prediction') return 1.5;
                    else if (c === 'alarm_cost_prediction_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_cost_prediction_notified', true);
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({ prediction_cost_limit_reached: [{ predicted: 1.5 }] });
                /* eslint-enable camelcase */
            });

            it('shoul NOT notify if meter_predictor is greater than the prediction_limit, allowed to notify is FALSE and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => false);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_cost_limit') return 1;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost_prediction') return 1.5;
                    else if (c === 'alarm_cost_prediction_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({});
                /* eslint-enable camelcase */
            });

            it('shoul NOT notify if meter_predictor is greater than the prediction_limit, allowed to notify but notified is TRUE', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_cost_limit') return 1;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost_prediction') return 1.5;
                    else if (c === 'alarm_cost_prediction_notified') return true;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({});
                /* eslint-enable camelcase */
            });
        });

        describe('cost notification', () => {
            it('should not notify if meter_cost is less than the cost_limit, allowed to notify and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'cost_limit') return 1.5;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost') return 1;
                    else if (c === 'alarm_cost_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({});
                /* eslint-enable camelcase */
            });

            it('shoul notify if meter_cost is greater than the cost_limit, allowed to notify and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'cost_limit') return 1;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost') return 1.5;
                    else if (c === 'alarm_cost_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_cost_notified', true);
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({
                    cost_limit_reached: [{ cost: 1.5 }]
                });
                /* eslint-enable camelcase */
            });

            it('shoul NOT notify if meter_cost is greater than the cost_limit, allowed to notify is FALSE and not notified', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => false);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'cost_limit') return 1;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost') return 1.5;
                    else if (c === 'alarm_cost_notified') return false;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
            });

            it('shoul NOT notify if meter_cost is greater than the cost_limit, allowed to notify but notified is TRUE', async () => {
                const unit = new PowerOfTheHourDevice();
                const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                vi.spyOn(unit, 'isNotifyAllowed').mockImplementation(() => true);
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'cost_limit') return 1000;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost') return 1500;
                    else if (c === 'alarm_cost_notified') return true;
                });

                await unit.checkNotify();
                expect(updateCapabilityValueSpy).not.toHaveBeenCalled();
                /* eslint-disable camelcase */
                expect(flowTriggerValues).toEqual({});
                /* eslint-enable camelcase */
            });
        });

        describe('Reset predicted cost notifiction', () => {
            it('should call resetCostPredictionNotification if prediction_cost_reset_enabled is true, meter_cost_prediction is less than the prediction_cost_reset_limit', async () => {
                const unit = new PowerOfTheHourDevice();
                vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                const resetCostPredictionNotificationSpy = vi.spyOn(unit, 'resetCostPredictionNotification');
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_cost_reset_limit') return 1.5;
                    else if (s === 'prediction_cost_reset_enabled') return true;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost_prediction') return 1;
                });

                await unit.checkNotify();
                expect(resetCostPredictionNotificationSpy).toHaveBeenCalled();
            });

            it('should NOT call resetPredictionNotification if prediction_cost_reset_enabled is false, meter_cost_prediction is less than the prediction_cost_reset_limit', async () => {
                const unit = new PowerOfTheHourDevice();
                vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                const resetCostPredictionNotificationSpy = vi.spyOn(unit, 'resetCostPredictionNotification');
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_cost_reset_limit') return 1.5;
                    else if (s === 'prediction_cost_reset_enabled') return false;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost_prediction') return 1;
                });

                await unit.checkNotify();
                expect(resetCostPredictionNotificationSpy).not.toHaveBeenCalled();
            });

            it('should NOT call resetPredictionNotification if prediction_cost_reset_enabled is true, meter_cost_prediction is greater than the prediction_cost_reset_limit', async () => {
                const unit = new PowerOfTheHourDevice();
                vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
                const resetCostPredictionNotificationSpy = vi.spyOn(unit, 'resetCostPredictionNotification');
                vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                    if (s === 'prediction_cost_reset_limit') return 1;
                    else if (s === 'prediction_cost_reset_enabled') return true;
                });
                vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                    if (c === 'meter_cost_prediction') return 1.5;
                });

                await unit.checkNotify();
                expect(resetCostPredictionNotificationSpy).not.toHaveBeenCalled();
            });
        });
    });

    describe('resetPredictionNotification', () => {
        it('should trigger prediction_reset if alarm_prediction_notified and not a new hour and set alarm_prediction_notified to false', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();

            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_prediction_notified') return true;
                else if (c === 'meter_predictor') return 1337;
            });

            await unit.resetPredictionNotification(false);

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_prediction_notified', false);
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                prediction_reset: [{ predicted: 1337 }]
            });
            /* eslint-enable camelcase */
        });

        it('should NOT trigger prediction_reset if alarm_prediction_notified is false and not a new hour, but set alarm_prediction_notified to false', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();

            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_prediction_notified') return false;
                else if (c === 'meter_predictor') return 1337;
            });

            await unit.resetPredictionNotification(false);

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_prediction_notified', false);
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({});
            /* eslint-enable camelcase */
        });

        it('should trigger prediction_reset if alarm_prediction_notified, new hour and prediction_reset_new_hour_enabled is true', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'prediction_reset_new_hour_enabled') return true;
            });
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_prediction_notified') return true;
                else if (c === 'meter_predictor') return 1337;
            });

            await unit.resetPredictionNotification(true);

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_prediction_notified', false);
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                prediction_reset: [{ predicted: 1337 }]
            });
            /* eslint-enable camelcase */
        });

        it('should NOT trigger prediction_reset if alarm_prediction_notified, new hour and prediction_reset_new_hour_enabled is false', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'prediction_reset_new_hour_enabled') return false;
            });
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_prediction_notified') return true;
                else if (c === 'meter_predictor') return 1337;
            });

            await unit.resetPredictionNotification(true);

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_prediction_notified', false);
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({});
            /* eslint-enable camelcase */
        });
    });

    describe('resetCostPredictionNotification', () => {
        it('should trigger prediction_reset if alarm_cost_prediction_notified and not a new hour and set alarm_cost_prediction_notified to false', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();

            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_cost_prediction_notified') return true;
                else if (c === 'meter_cost_prediction') return 13.37;
            });

            await unit.resetCostPredictionNotification(false);

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_cost_prediction_notified', false);
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                prediction_cost_reset: [{ predicted: 13.37 }]
            });
            /* eslint-enable camelcase */
        });

        it('should NOT trigger prediction_reset if alarm_cost_prediction_notified is false and not a new hour, but set alarm_cost_prediction_notified to false', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();

            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_cost_prediction_notified') return false;
                else if (c === 'meter_cost_prediction') return 1337;
            });

            await unit.resetCostPredictionNotification(false);

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_cost_prediction_notified', false);
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({});
            /* eslint-enable camelcase */
        });

        it('should trigger prediction_reset if alarm_cost_prediction_notified, new hour and prediction_cost_reset_new_hour_enabled is true', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'prediction_cost_reset_new_hour_enabled') return true;
            });
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_cost_prediction_notified') return true;
                else if (c === 'meter_cost_prediction') return 13.37;
            });

            await unit.resetCostPredictionNotification(true);

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_cost_prediction_notified', false);
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                prediction_cost_reset: [{ predicted: 13.37 }]
            });
            /* eslint-enable camelcase */
        });

        it('should NOT trigger prediction_reset if alarm_cost_prediction_notified, new hour and prediction_cost_reset_new_hour_enabled is false', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'prediction_cost_reset_new_hour_enabled') return false;
            });
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_cost_prediction_notified') return true;
                else if (c === 'meter_cost_prediction') return 13.37;
            });

            await unit.resetCostPredictionNotification(true);

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_cost_prediction_notified', false);
            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({});
            /* eslint-enable camelcase */
        });
    });

    describe('resetConsumptionNotification', () => {
        it('should trigger flowCard consumption_reset if alarm_consumption_notified is true', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_consumption_notified') return true;
                else if (c === 'meter_consumption_previous_hour') return 1337;
            });

            await unit.resetConsumptionNotification();

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_consumption_notified', false);

            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                consumption_reset: [{ previous: 1337 }]
            });
            /* eslint-enable camelcase */
        });

        it('should NOT trigger flowCard consumption_reset if alarm_consumption_notified is false', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_consumption_notified') return false;
                else if (c === 'meter_consumption_previous_hour') return 1337;
            });

            await unit.resetConsumptionNotification();

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_consumption_notified', false);

            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({});
            /* eslint-enable camelcase */
        });
    });

    describe('resetCostNotification', () => {
        it('should trigger flowCard cost_reset if alarm_cost_notified is true', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_cost_notified') return true;
                else if (c === 'meter_cost_previous_hour') return 13.37;
            });

            await unit.resetCostNotification();

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_cost_notified', false);

            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({
                cost_reset: [{ previousCost: 13.37 }]
            });
            /* eslint-enable camelcase */
        });

        it('should NOT trigger flowCard consumption_reset if alarm_cost_notified is false', async () => {
            const unit = new PowerOfTheHourDevice();
            const updateCapabilityValueSpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'alarm_cost_notified') return false;
                else if (c === 'meter_cost_previous_hour') return 13.37;
            });

            await unit.resetCostNotification();

            expect(updateCapabilityValueSpy).toHaveBeenCalledWith('alarm_cost_notified', false);

            /* eslint-disable camelcase */
            expect(flowTriggerValues).toEqual({});
            /* eslint-enable camelcase */
        });
    });

    describe('decimals', () => {
        it('should cut to two decimals', () => {
            const unit = new PowerOfTheHourDevice();
            const result = unit.decimals(12.37272871, 2);
            expect(result).toBe(12.37);
        });

        it('should cut all decimals', () => {
            const unit = new PowerOfTheHourDevice();
            const result = unit.decimals(12.37272871, 0);
            expect(result).toBe(12);
        });
    });

    describe('isNotifyAllowed', () => {
        it('should return true when time is between earliest and latest and notification is enabled', () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:35:00.000Z'));
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'notification_prediction_time_earliest') return 30;
                if (s === 'notification_prediction_time_latest') return 60;
                if (s === 'notification_prediction_enabled') return true;
            });
            expect(unit.isNotifyAllowed('prediction')).toBe(true);
        });

        it('should return false when time is not between earliest and latest and notification is enabled', () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:25:00.000Z'));
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'notification_consumption_time_earliest') return 30;
                if (s === 'notification_consumption_time_latest') return 60;
                if (s === 'notification_consumption_enabled') return true;
            });
            expect(unit.isNotifyAllowed('consumption')).toBe(false);
        });

        it('should return false when time is between earliest and latest and notification is false', () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:35:00.000Z'));
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'notification_cost_time_earliest') return 30;
                if (s === 'notification_cost_time_latest') return 60;
                if (s === 'notification_cost_enabled') return false;
            });
            expect(unit.isNotifyAllowed('cost')).toBe(false);
        });

        it('should return false when time is not between earliest and latest and notification is false', () => {
            const unit = new PowerOfTheHourDevice();
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:25:00.000Z'));
            vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
                if (s === 'notification_cost_prediction_time_earliest') return 30;
                if (s === 'notification_cost_prediction_time_latest') return 60;
                if (s === 'notification_cost_prediction_enabled') return false;
            });
            expect(unit.isNotifyAllowed('cost_prediction')).toBe(false);
        });
    });

    describe('predict', () => {
        it('should add prediction to meter_predictor', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(calculations, 'getPrediction').mockImplementation(() => 1000);
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_consumption') return 1337;
            });
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            await unit.predict();
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_predictor', 2337);
        });

        it('should add prediction to meter_cost_prediction', async () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(calculations, 'getPrediction').mockImplementation(() => 1000);
            vi.spyOn(unit, 'getCapabilityValue').mockImplementation((c) => {
                if (c === 'meter_cost') return 1.37;
                else if (c === 'meter_price') return 2;
            });
            const updateCapabilitySpy = vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            await unit.predict();
            expect(updateCapabilitySpy).toHaveBeenCalledWith('meter_cost_prediction', 3.37);
        });
    });

    describe('updateHistory', () => {
        it('should add new reading to the empty history', () => {
            const unit = new PowerOfTheHourDevice();
            expect(unit.history).toEqual([]);
            unit.updateHistory(1000, new Date('2023-05-15T12:25:00.000Z'));
            expect(unit.history).toEqual([{ consumption: 1000, timestamp: new Date('2023-05-15T12:25:00.000Z') }]);
        });

        it('should prepend new reading to the empty history', () => {
            const unit = new PowerOfTheHourDevice();
            unit.updateHistory(1000, new Date('2023-05-15T12:25:00.000Z'));
            expect(unit.history).toEqual([{ consumption: 1000, timestamp: new Date('2023-05-15T12:25:00.000Z') }]);
            unit.updateHistory(1337, new Date('2023-05-15T12:26:00.000Z'));
            expect(unit.history).toEqual([
                { consumption: 1337, timestamp: new Date('2023-05-15T12:26:00.000Z') },
                { consumption: 1000, timestamp: new Date('2023-05-15T12:25:00.000Z') }
            ]);
        });

        it('should remove last reading from history if count exceeds history_count', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'getSetting').mockImplementation((c) => {
                if (c === 'prediction_history_count') return 4;
            });
            unit.history = [
                { consumption: 1337, timestamp: new Date('2023-05-15T12:26:00.000Z') },
                { consumption: 1200, timestamp: new Date('2023-05-15T12:25:00.000Z') },
                { consumption: 1300, timestamp: new Date('2023-05-15T12:24:00.000Z') },
                { consumption: 1400, timestamp: new Date('2023-05-15T12:23:00.000Z') }
            ];
            unit.updateHistory(1234, new Date('2023-05-15T12:27:00.000Z'));
            expect(unit.history).toEqual([
                { consumption: 1234, timestamp: new Date('2023-05-15T12:27:00.000Z') },
                { consumption: 1337, timestamp: new Date('2023-05-15T12:26:00.000Z') },
                { consumption: 1200, timestamp: new Date('2023-05-15T12:25:00.000Z') },
                { consumption: 1300, timestamp: new Date('2023-05-15T12:24:00.000Z') }
            ]);
        });

        it('should not remove last reading from history if count does not exceeds history_count', () => {
            const unit = new PowerOfTheHourDevice();
            vi.spyOn(unit, 'getSetting').mockImplementation((c) => {
                if (c === 'prediction_history_count') return 5;
            });
            unit.history = [
                { consumption: 1337, timestamp: new Date('2023-05-15T12:26:00.000Z') },
                { consumption: 1200, timestamp: new Date('2023-05-15T12:25:00.000Z') },
                { consumption: 1300, timestamp: new Date('2023-05-15T12:24:00.000Z') },
                { consumption: 1400, timestamp: new Date('2023-05-15T12:23:00.000Z') }
            ];
            unit.updateHistory(1234, new Date('2023-05-15T12:27:00.000Z'));
            expect(unit.history).toEqual([
                { consumption: 1234, timestamp: new Date('2023-05-15T12:27:00.000Z') },
                { consumption: 1337, timestamp: new Date('2023-05-15T12:26:00.000Z') },
                { consumption: 1200, timestamp: new Date('2023-05-15T12:25:00.000Z') },
                { consumption: 1300, timestamp: new Date('2023-05-15T12:24:00.000Z') },
                { consumption: 1400, timestamp: new Date('2023-05-15T12:23:00.000Z') }
            ]);
        });
    });

    describe('updateCapabilityValue', () => {
        it('should call setCapabilityValue with the capability and value', async () => {
            const unit = new PowerOfTheHourDevice();
            const setCapabilitySpy = vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            const logSpy = vi.spyOn(unit, 'log');
            await unit.updateCapabilityValue('meter_prediction', 1234);
            expect(setCapabilitySpy).toHaveBeenCalledWith('meter_prediction', 1234);
            expect(logSpy).not.toHaveBeenCalled();
        });

        it('should catch error on setCapabilityValue with the capability and value and log error', async () => {
            const unit = new PowerOfTheHourDevice();
            const logSpy = vi.spyOn(unit, 'log');
            const setCapabilitySpy = vi.spyOn(unit, 'setCapabilityValue').mockRejectedValue('I failed');
            await unit.updateCapabilityValue('meter_prediction', 1234);
            expect(setCapabilitySpy).toHaveBeenCalledWith('meter_prediction', 1234);
            expect(logSpy).toHaveBeenCalledWith('Failed to set capability value meter_prediction with the value 1234. --> I failed');
        });
    });

    describe('scheduleRecalculation', () => {
        it('should not call clear timeout if no pending timeout exists', () => {
            const unit = new PowerOfTheHourDevice();
            const clearTimeoutSpy = vi.spyOn(unit.homey, 'clearTimeout');
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:27:00.000Z'));
            unit.scheduleRecalculation(1234);
            expect(clearTimeoutSpy).not.toHaveBeenCalled();
        });

        it('should call clear timeout if pending timeout exists', () => {
            const unit = new PowerOfTheHourDevice();
            const clearTimeoutSpy = vi.spyOn(unit.homey, 'clearTimeout');
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:27:00.000Z'));
            unit.scheduleRecalculation(1234);
            unit.scheduleRecalculation(1235);
            expect(clearTimeoutSpy).toHaveBeenCalledOnce();
        });

        it('should call checkReading if timeout finishes (after 60 seconds)', () => {
            const unit = new PowerOfTheHourDevice();
            const checkReadingSpy = vi.spyOn(unit, 'checkReading');
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T12:27:00.000Z'));
            unit.scheduleRecalculation(1234);
            vi.advanceTimersByTime(59000);
            expect(checkReadingSpy).not.toHaveBeenCalled();
            vi.advanceTimersByTime(1000);
            expect(checkReadingSpy).toHaveBeenCalledWith(1234, new Date('2023-05-15T12:28:00.000Z'));
        });
    });

    describe('onSettings', () => {
        it('should call predict if new setting contains prediction_age', async () => {
            const unit = new PowerOfTheHourDevice();
            const predictionSpy = vi.spyOn(unit, 'predict');
            vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            /* eslint-disable camelcase */
            await unit.onSettings({ oldSettings: { prediction_age: 5 }, newSettings: { prediction_age: 6 }, changedKeys: ['prediction_age'] });
            /* eslint-enable camelcase */
            expect(predictionSpy).toHaveBeenCalledOnce();
        });

        it('should NOT call predict if new setting does not contain prediction_age', async () => {
            const unit = new PowerOfTheHourDevice();
            const predictionSpy = vi.spyOn(unit, 'predict');
            vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            /* eslint-disable camelcase */
            await unit.onSettings({ oldSettings: { notification_cost_enabled: false }, newSettings: { notification_cost_enabled: true }, changedKeys: ['notification_cost_enabled'] });
            /* eslint-enable camelcase */
            expect(predictionSpy).not.toHaveBeenCalledOnce();
        });

        it('should call slice the history if new setting contains prediction_history_count', async () => {
            const unit = new PowerOfTheHourDevice();
            unit.history = [
                { consumption: 1234, timestamp: new Date('2023-05-15T12:27:00.000Z') },
                { consumption: 1337, timestamp: new Date('2023-05-15T12:26:00.000Z') },
                { consumption: 1200, timestamp: new Date('2023-05-15T12:25:00.000Z') },
                { consumption: 1300, timestamp: new Date('2023-05-15T12:24:00.000Z') },
                { consumption: 1400, timestamp: new Date('2023-05-15T12:23:00.000Z') }
            ];
            vi.spyOn(unit, 'updateCapabilityValue').mockResolvedValue();
            /* eslint-disable camelcase */
            await unit.onSettings({ oldSettings: { prediction_history_count: 10 }, newSettings: { prediction_history_count: 3 }, changedKeys: ['prediction_history_count'] });
            /* eslint-enable camelcase */
            expect(unit.history).toEqual([
                { consumption: 1234, timestamp: new Date('2023-05-15T12:27:00.000Z') },
                { consumption: 1337, timestamp: new Date('2023-05-15T12:26:00.000Z') },
                { consumption: 1200, timestamp: new Date('2023-05-15T12:25:00.000Z') }
            ]);
        });
    });
});
