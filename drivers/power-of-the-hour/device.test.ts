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
            vi.spyOn(unit, 'getStoreValue').mockResolvedValue(undefined);

            const spy = vi.spyOn(unit, 'setCapabilityValue').mockResolvedValue();

            const setInitialValuesSpy = vi.spyOn(unit, 'setInitialValues');

            await unit.onInit();

            expect(setInitialValuesSpy).toHaveBeenCalledWith(false);

            expect(spy).toBeCalledTimes(14);

            expect(spy).toBeCalledWith('meter_prediction_remaining', null);
        });
    });
});
