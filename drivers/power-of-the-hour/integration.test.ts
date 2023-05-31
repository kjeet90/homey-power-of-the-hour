import { describe, it, expect, vi, beforeEach } from 'vitest';

import PowerOfTheHourDevice from './device';

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
                    if (!flowTriggerValues[flowCard]) flowTriggerValues[flowCard] = [tokens];
                    else flowTriggerValues[flowCard].push(tokens);
                })
            }))
        }
    };

    const Homey = { Device };

    return { default: Homey };
});

const newReading = async (unit: PowerOfTheHourDevice, watt: number, time: Date) => {
    vi.setSystemTime(time);
    await unit.checkReading(watt, time);
};

const getDefaultSetting = (setting: string) => {
    const s = require(`../../.homeycompose/drivers/settings/${setting}`);
    return s.value;
};

beforeEach(() => {
    clearFlowTriggerValues();
});

describe('Predicted consumption', () => {
    it('should change prediction when new readings come in', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await unit.checkReading(1000, new Date('2023-05-15T12:00:00.000Z'));
        expect(unit.getCapabilityValue('meter_consumption_previous_hour')).toBe(0);
        expect(unit.getCapabilityValue('meter_consumption')).toBe(0);
        expect(unit.getCapabilityValue('meter_predictor')).toBe(1000);
        await unit.checkReading(1000, new Date('2023-05-15T12:20:00.000Z'));
        expect(unit.getCapabilityValue('meter_consumption')).toBe(333);
        expect(unit.getCapabilityValue('meter_predictor')).toBe(1000);
        await unit.checkReading(4000, new Date('2023-05-15T12:25:00.000Z'));
    });

    it('should trigger prediction notification if enabled and limit is exceeded by reading after earliest notification', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4480, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:32:00.000Z'));

        expect(unit.getCapabilityValue('meter_consumption_previous_hour')).toBe(0);
        expect(unit.getCapabilityValue('meter_consumption')).toBe(2389);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(unit.getCapabilityValue('meter_predictor')).toBe(4480);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 12000, new Date('2023-05-15T12:33:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4605);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 4605
            }
        ]);
    });

    it('should not trigger prediction notification if enabled and limit is exceeded by reading before earliest notification', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4480, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:15:00.000Z'));

        expect(unit.getCapabilityValue('meter_consumption_previous_hour')).toBe(0);
        expect(unit.getCapabilityValue('meter_consumption')).toBe(1120);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(unit.getCapabilityValue('meter_predictor')).toBe(4480);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 12000, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(10120);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);
    });

    it('should trigger prediction notification if enabled and earliest is passed', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4480, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 12000, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(10120);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 12000, new Date('2023-05-15T12:30:05.000Z'));

        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 10120
            }
        ]);
    });

    it('should reset prediction notification if enabled and prediction goes below limit again', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4480, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 4480, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4480);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 6200, new Date('2023-05-15T12:30:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4538);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 4538
            }
        ]);

        await newReading(unit, 200, new Date('2023-05-15T12:40:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(2399);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_reset']).toEqual([
            {
                predicted: 2399
            }
        ]);
    });

    it('should not trigger reset prediction notification if disabled and prediction goes below limit again', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            if (s === 'prediction_reset_enabled') return false;
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4500, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4500);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 4591, new Date('2023-05-15T12:30:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4503);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 4503
            }
        ]);

        await newReading(unit, 200, new Date('2023-05-15T12:40:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(2354);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_reset']).toBe(undefined);
    });

    it('should trigger reset prediction notification on new hour if prediction_reset_new_hour_enabled is enabled with value 0', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4500, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4500);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 4591, new Date('2023-05-15T12:30:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4503);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 4503
            }
        ]);

        await newReading(unit, 12000, new Date('2023-05-15T13:05:00.000Z'));

        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_reset']).toEqual([
            {
                predicted: 0
            }
        ]);
    });

    it('should NOT reset prediction notification on new hour if prediction_reset_new_hour_enabled is disabled', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            if (s === 'prediction_reset_new_hour_enabled') return false;
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4500, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4500);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 4591, new Date('2023-05-15T12:30:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4503);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 4503
            }
        ]);

        await newReading(unit, 12000, new Date('2023-05-15T13:05:00.000Z'));

        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_reset']).toBe(undefined);
    });

    it('should transfer prediction warning into next hour if prediction_consumption_reset_transfer_enabled is enabled', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            if (s === 'prediction_consumption_reset_transfer_enabled') return true;
            else if (s === 'prediction_reset_enabled') return false;
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4500, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4500);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 4591, new Date('2023-05-15T12:30:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4503);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 4503
            }
        ]);

        await newReading(unit, 12000, new Date('2023-05-15T13:05:00.000Z'));

        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_reset']).toBe(undefined);
    });

    it('should NOT transfer prediction warning into next hour if prediction_consumption_reset_transfer_enabled is disabled', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            if (s === 'prediction_consumption_reset_transfer_enabled') return false;
            else if (s === 'prediction_reset_enabled') return false;
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4500, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4500);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 4591, new Date('2023-05-15T12:30:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4503);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 4503
            }
        ]);

        await newReading(unit, 12000, new Date('2023-05-15T13:05:00.000Z'));

        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_reset']).toEqual([{ predicted: 0 }]);
    });

    it('should NOT transfer prediction warning into next hour if prediction_consumption_reset_transfer_enabled is disabled, but prediction_reset_enabled is enabled', async () => {
        const capabilities: { [index: string]: any } = {};
        const unit = new PowerOfTheHourDevice();
        vi.spyOn(unit, 'getSetting').mockImplementation((s) => {
            if (s === 'prediction_consumption_reset_transfer_enabled') return false;
            else if (s === 'prediction_reset_enabled') return true;
            return getDefaultSetting(s);
        });
        vi.spyOn(unit, 'getCapabilityValue').mockImplementation((id: string) => {
            if (typeof capabilities[id] === 'number') return Number(capabilities[id].toFixed(0));
            return capabilities[id];
        });
        vi.spyOn(unit, 'setCapabilityValue').mockImplementation((id: string, value: string | number | boolean | null) => {
            return new Promise<void>((resolve, _reject) => {
                capabilities[id] = value;
                resolve();
            });
        });

        vi.useFakeTimers();
        await unit.onInit();
        await newReading(unit, 4500, new Date('2023-05-15T12:00:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:10:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:15:00.000Z'));
        await newReading(unit, 4500, new Date('2023-05-15T12:28:00.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4500);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_limit_reached']).toBe(undefined);

        await newReading(unit, 4591, new Date('2023-05-15T12:30:01.000Z'));

        expect(unit.getCapabilityValue('meter_predictor')).toBe(4503);
        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(true);
        expect(flowTriggerValues['prediction_limit_reached']).toEqual([
            {
                predicted: 4503
            }
        ]);

        await newReading(unit, 12000, new Date('2023-05-15T13:05:00.000Z'));

        expect(unit.getCapabilityValue('alarm_prediction_notified')).toBe(false);
        expect(flowTriggerValues['prediction_reset']).toEqual([{ predicted: 0 }]);
    });
});
