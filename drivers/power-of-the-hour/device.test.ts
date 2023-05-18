import { describe, it, expect, vi } from 'vitest';

import PowerOfTheHourDevice from './device';

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

    Device.prototype.homey = {
        clearTimeout: vi.fn().mockImplementation((cb) => {
            return clearTimeout(cb);
        }),
        setTimeout: vi.fn().mockImplementation((cb, ms) => {
            return setTimeout(cb, ms);
        })
    };

    const Homey = { Device };

    return { default: Homey };
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

        it('should call setCapabilityValue with empty values when invalid timestamp is found', async () => {
            const unit = new PowerOfTheHourDevice();

            vi.useFakeTimers();
            vi.setSystemTime(new Date('2023-05-15T11:58:00.000Z'));
            vi.spyOn(unit, 'getStoreValue').mockResolvedValue({ timestamp: '2023-05-15T12:02:00.000Z' });
            vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();
            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');

            await unit.onInit();

            expect(setInitialValuesSpy).toHaveBeenCalledWith(false);
            expect(unit.previousTimestamp).toBe(undefined);
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
            expect(unit.previousTimestamp).toBe(undefined);
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

            expect(setInitialValuesSpy).toHaveBeenCalledTimes(1);
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
            expect(queueSettingsSpy).toHaveBeenCalledTimes(1);
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
            expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
            expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
            expect(unit.newSettings).toEqual({ someSetting: 1234, someOtherSetting: 567 });

            vi.advanceTimersByTime(400);

            expect(writeNewSettingsSpy).not.toHaveBeenCalled();

            vi.advanceTimersByTime(101);

            expect(writeNewSettingsSpy).toHaveBeenCalledTimes(1);
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
            expect(setInitialValuesSpy).toHaveBeenCalledTimes(1);
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
});
