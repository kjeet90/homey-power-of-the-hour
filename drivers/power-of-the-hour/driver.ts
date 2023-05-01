'use strict';

import { v4 as uuid } from 'uuid';
import Homey from 'homey';

class PowerOfTheHourDriver extends Homey.Driver {
    async onInit() {
        this.log('Power of the hour driver has been initialized');
    }

    async onPairListDevices() {
        return [
            {
                name: 'Power of the hour',
                data: {
                    id: uuid()
                }
            }
        ];
    }
}

module.exports = PowerOfTheHourDriver;
