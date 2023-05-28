import { it, describe, expect, vi, beforeEach, afterEach } from 'vitest';
import * as calculations from './calculations';

describe('getHoursBetween', () => {
    it('Hours between 12:00-14:00 the same day to equal 2', () => {
        const oldest = new Date('2020-10-21T12:00:00.000Z');
        const newest = new Date('2020-10-21T14:00:00.000Z');
        expect(calculations.getHoursBetween(newest, oldest)).toBe(2);
    });

    it('Hours between 12:00-14:00 the next day to equal 26', () => {
        const oldest = new Date('2020-10-21T12:00:00.000Z');
        const newest = new Date('2020-10-22T14:00:00.000Z');
        expect(calculations.getHoursBetween(newest, oldest)).toBe(26);
    });

    it('Hours between 12:00-12:30 the same day to equal 0.5', () => {
        const oldest = new Date('2020-10-21T12:00:00.000Z');
        const newest = new Date('2020-10-21T12:30:00.000Z');
        expect(calculations.getHoursBetween(newest, oldest)).toBe(0.5);
    });

    it('Hours between 12:00-12:30 the next day to equal 24.5', () => {
        const oldest = new Date('2020-10-21T12:00:00.000Z');
        const newest = new Date('2020-10-22T12:30:00.000Z');
        expect(calculations.getHoursBetween(newest, oldest)).toBe(24.5);
    });

    it('Hours between 12:00-12:00 the next day to equal 24', () => {
        const oldest = new Date('2020-10-21T12:00:00.000Z');
        const newest = new Date('2020-10-22T12:00:00.000Z');
        expect(calculations.getHoursBetween(newest, oldest)).toBe(24);
    });

    it('Hours between 12:00-12:00 the same day to equal 0', () => {
        const oldest = new Date('2020-10-21T12:00:00.000Z');
        const newest = new Date('2020-10-21T12:00:00.000Z');
        expect(calculations.getHoursBetween(newest, oldest)).toBe(0);
    });

    it('Hours between undefined-12:30 the same day to equal 0.5', () => {
        const oldest = null;
        const newest = new Date('2020-10-21T12:30:00.000Z');
        expect(calculations.getHoursBetween(newest, oldest)).toBe(0.5);
    });
});

describe('getReadingsYoungerThan', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2020-10-21T12:36:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });
    describe('Invalid values', () => {
        it('should return a empty array when two invalid readings are passed in', () => {
            expect(calculations.getReadingsYoungerThan(undefined, undefined)).toEqual([]);
        });

        it('should return a empty array when no readings are passed in and number is undefined', () => {
            expect(calculations.getReadingsYoungerThan([], undefined)).toEqual([]);
        });

        it('should return a empty array when invalid readings and minutes is valid', () => {
            expect(calculations.getReadingsYoungerThan(undefined, 5)).toEqual([]);
        });
    });

    it('should return two values', () => {
        expect(
            calculations.getReadingsYoungerThan(
                [
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:35:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:34:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:33:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:32:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:31:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:30:00.000Z') }
                ],
                2
            )
        ).toEqual([
            { consumption: 1000, timestamp: new Date('2020-10-21T12:35:00.000Z') },
            { consumption: 1000, timestamp: new Date('2020-10-21T12:34:00.000Z') }
        ]);
    });

    it('should return three values', () => {
        expect(
            calculations.getReadingsYoungerThan(
                [
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:35:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:34:30.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:34:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:33:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:31:00.000Z') },
                    { consumption: 1000, timestamp: new Date('2020-10-21T12:30:00.000Z') }
                ],
                2
            )
        ).toEqual([
            { consumption: 1000, timestamp: new Date('2020-10-21T12:35:00.000Z') },
            { consumption: 1000, timestamp: new Date('2020-10-21T12:34:30.000Z') },
            { consumption: 1000, timestamp: new Date('2020-10-21T12:34:00.000Z') }
        ]);
    });
});

describe('predict', () => {
    it('should predict 0W consumption if nothing is passed in', () => {
        expect(calculations.predictRemainingHour([])).toBe(0);
    });
    it('should predict 0W consumption if undefined is passed in', () => {
        expect(calculations.predictRemainingHour(undefined)).toBe(0);
    });

    it('should predict 1000W consumption if that is the only consumption this far', () => {
        expect(calculations.predictRemainingHour([{ consumption: 1000, timestamp: new Date('2020-10-21T12:30:00.000Z') }])).toBe(1000);
    });

    it('should predict 250W for the remaining hour', () => {
        expect(
            calculations.predictRemainingHour([
                { consumption: 1000, timestamp: new Date('2020-10-21T12:45:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:00:00.000Z') }
            ])
        ).toBe(250);
    });

    it('should predict 500W for the remaining hour', () => {
        expect(
            calculations.predictRemainingHour([
                { consumption: 2000, timestamp: new Date('2020-10-21T12:45:00.000Z') },
                { consumption: 2000, timestamp: new Date('2020-10-21T12:00:00.000Z') }
            ])
        ).toBe(500);
    });

    it('should predict 375W for the remaining hour', () => {
        expect(
            calculations.predictRemainingHour([
                { consumption: 2000, timestamp: new Date('2020-10-21T12:45:00.000Z') },
                { consumption: 1500, timestamp: new Date('2020-10-21T12:30:00.000Z') },
                { consumption: 1500, timestamp: new Date('2020-10-21T12:00:00.000Z') }
            ])
        ).toBe(375);
    });

    it('should predict 900W for the remaining hour', () => {
        expect(
            calculations.predictRemainingHour([
                { consumption: 2000, timestamp: new Date('2020-10-21T12:30:00.000Z') },
                { consumption: 2000, timestamp: new Date('2020-10-21T12:10:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:05:00.000Z') }
            ])
        ).toBe(900);
    });

    it('should predict 1000W for the remaining hour', () => {
        expect(
            calculations.predictRemainingHour([
                { consumption: 1000, timestamp: new Date('2020-10-21T12:00:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:10:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:15:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:20:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:25:00.000Z') }
            ])
        ).toBe(1000);
    });
});

describe('getElapsedHour', () => {
    it('Elapsed hour 12:00 to equal 0', () => {
        const timestamp = new Date('2020-10-21T12:00:00.000Z');
        expect(calculations.getElapsedHour(timestamp)).toBe(0);
    });

    it('Elapsed hour 12:12 to equal 0.2', () => {
        const timestamp = new Date('2020-10-21T12:12:00.000Z');
        expect(calculations.getElapsedHour(timestamp)).toBe(0.2);
    });

    it('Elapsed hour 12:45 to equal 0.75', () => {
        const timestamp = new Date('2020-10-21T12:45:00.000Z');
        expect(calculations.getElapsedHour(timestamp)).toBe(0.75);
    });
});

describe('getRemainingHour', () => {
    it('Remaining hour 12:00 to equal 1', () => {
        const timestamp = new Date('2020-10-21T12:00:00.000Z');
        expect(calculations.getRemainingHour(timestamp)).toBe(1);
    });

    it('Remaining hour 12:12 to equal 0.8', () => {
        const timestamp = new Date('2020-10-21T12:12:00.000Z');
        expect(calculations.getRemainingHour(timestamp)).toBe(0.8);
    });

    it('Remaining hour 12:45 to equal 0.25', () => {
        const timestamp = new Date('2020-10-21T12:45:00.000Z');
        expect(calculations.getRemainingHour(timestamp)).toBe(0.25);
    });
});

describe('isNewHour', () => {
    describe('Same day', () => {
        it('Is new hour when previous hour is undefined', () => {
            const oldest = null;
            const newest = new Date('2020-10-21T13:20:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(true);
        });

        it('Is new hour between 12:00 and 12:30 the same day to equal false', () => {
            const oldest = new Date('2020-10-21T12:00:00.000Z');
            const newest = new Date('2020-10-21T12:30:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(false);
        });

        it('Is new hour between 12:15 and 12:20 the same day to equal false', () => {
            const oldest = new Date('2020-10-21T12:15:00.000Z');
            const newest = new Date('2020-10-21T12:20:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(false);
        });

        it('Is new hour between 12:00 and 13:00 the same day to equal true', () => {
            const oldest = new Date('2020-10-21T12:00:00.000Z');
            const newest = new Date('2020-10-21T13:00:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(true);
        });

        it('Is new hour between 12:15 and 13:20 the same day to equal true', () => {
            const oldest = new Date('2020-10-21T12:15:00.000Z');
            const newest = new Date('2020-10-21T13:20:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(true);
        });
    });

    describe('Next day', () => {
        it('Is new hour between 12:00 and 12:30 the next day to equal true', () => {
            const oldest = new Date('2020-10-21T12:00:00.000Z');
            const newest = new Date('2020-10-22T12:30:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(true);
        });

        it('Is new hour between 12:15 and 12:20 the next day to equal true', () => {
            const oldest = new Date('2020-10-21T12:15:00.000Z');
            const newest = new Date('2020-10-22T12:20:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(true);
        });

        it('Is new hour between 12:00 and 11:00 the next day to equal true', () => {
            const oldest = new Date('2020-10-21T12:00:00.000Z');
            const newest = new Date('2020-10-22T11:00:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(true);
        });

        it('Is new hour between 12:10 and 11:10 the next day to equal true', () => {
            const oldest = new Date('2020-10-21T12:10:00.000Z');
            const newest = new Date('2020-10-22T11:10:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(true);
        });

        it('Is new hour between 12:15 and 13:10 the next day to equal true', () => {
            const oldest = new Date('2020-10-21T12:15:00.000Z');
            const newest = new Date('2020-10-22T13:10:00.000Z');
            expect(calculations.isNewHour(newest, oldest)).toBe(true);
        });
    });
});

describe('ion', () => {
    it('Prediction: no valid values', () => {
        expect(calculations.getPrediction(undefined, undefined, undefined)).toBe(0);
    });

    it('Prediction: only valid history', () => {
        const readings = [{ consumption: 1000, timestamp: new Date('2020-10-21T12:00:00.000Z') }];
        expect(calculations.getPrediction(readings, undefined, undefined)).toBe(1000);
    });

    it('Prediction: only valid number', () => {
        const number = 1;
        expect(calculations.getPrediction(undefined, number, undefined)).toBe(0);
    });

    describe('Time based prediction', () => {
        it('Prediction: only valid time', () => {
            const time = 'time';
            expect(calculations.getPrediction(undefined, undefined, time)).toBe(0);
        });

        it('Prediction: 1 minute history, 0 reading, 0 valid', () => {
            const readings = [] as { consumption: number; timestamp: Date }[];
            const number = 1;
            const type = 'time';
            expect(calculations.getPrediction(readings, number, type)).toBe(0);
        });

        it('Prediction: 1 minute history, 1 reading, 1 valid, at 12:00 to equal 1000W', () => {
            const readings = [{ consumption: 1000, timestamp: new Date('2020-10-21T12:00:00.000Z') }];
            const number = 1;
            const type = 'time';
            expect(calculations.getPrediction(readings, number, type)).toBe(1000);
        });

        it('Prediction: 1 minute history, 3 reading, 3 valid, at 12:12 to equal 8000W', () => {
            const readings = [
                { consumption: 1000, timestamp: new Date('2020-10-21T12:12:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:00:08.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:00:00.000Z') }
            ];
            const number = 1;
            const type = 'time';
            expect(calculations.getPrediction(readings, number, type)).toBe(800);
        });

        it('Prediction: 1 minute history, 5 reading, 3 valid, at 12:30 to equal 500', () => {
            const readings = [
                { consumption: 1000, timestamp: new Date('2020-10-21T12:30:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:29:45.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:29:35.000Z') },
                { consumption: 5218, timestamp: new Date('2020-10-21T12:00:08.000Z') },
                { consumption: 5190, timestamp: new Date('2020-10-21T12:00:00.000Z') }
            ];
            const number = 1;
            const type = 'time';
            expect(calculations.getPrediction(readings, number, type)).toBe(500);
        });
    });

    describe('Count based prediction', () => {
        it('Prediction: only valid count', () => {
            const count = 'count';
            expect(calculations.getPrediction(undefined, undefined, count)).toBe(0);
        });

        it('Prediction: 1 count history, 0 reading, 0 valid', () => {
            const readings: { consumption: number; timestamp: Date }[] = [];
            const number = 1;
            const type = 'count';
            expect(calculations.getPrediction(readings, number, type)).toBe(0);
        });

        it('Prediction: 1 count history, 1 reading, 1 valid, at 12:00 to equal 1000W', () => {
            const readings = [{ consumption: 1000, timestamp: new Date('2020-10-21T12:00:00.000Z') }];
            const number = 1;
            const type = 'count';
            expect(calculations.getPrediction(readings, number, type)).toBe(1000);
        });

        it('Prediction: 1 count history, 3 reading, 3 valid, at 12:12 to equal 8000W', () => {
            const readings = [
                { consumption: 1000, timestamp: new Date('2020-10-21T12:12:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:00:08.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:00:00.000Z') }
            ];
            const number = 1;
            const type = 'count';
            expect(calculations.getPrediction(readings, number, type)).toBe(800);
        });

        it('Prediction: 3 count history, 5 reading, 3 valid, at 12:30 to equal 500', () => {
            const readings = [
                { consumption: 1000, timestamp: new Date('2020-10-21T12:30:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:29:45.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:29:35.000Z') },
                { consumption: 5218, timestamp: new Date('2020-10-21T12:00:08.000Z') },
                { consumption: 5190, timestamp: new Date('2020-10-21T12:00:00.000Z') }
            ];
            const number = 3;
            const type = 'count';
            expect(calculations.getPrediction(readings, number, type)).toBe(500);
        });

        it('Prediction: 5 count history, 3 reading, 3 valid, at 12:30 to equal 500', () => {
            const readings = [
                { consumption: 1000, timestamp: new Date('2020-10-21T12:30:00.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:29:45.000Z') },
                { consumption: 1000, timestamp: new Date('2020-10-21T12:29:35.000Z') }
            ];
            const number = 5;
            const type = 'count';
            expect(calculations.getPrediction(readings, number, type)).toBe(500);
        });
    });
});

describe('getPowerAvailable', () => {
    it('PowerAvailable: Limit: 4000, used 0, 60 minutes left = 4000', () => {
        expect(calculations.getPowerAvailable(4000, 0, new Date('2020-10-21T12:00:00.000Z'))).toBe(4000);
    });

    it('PowerAvailable: Limit: 4000, used 2000, 60 minutes left = 4000', () => {
        expect(calculations.getPowerAvailable(4000, 2000, new Date('2020-10-21T12:00:00.000Z'))).toBe(2000);
    });

    it('PowerAvailable: Limit: 4000, used 2000, 30 minutes left = 4000', () => {
        expect(calculations.getPowerAvailable(4000, 2000, new Date('2020-10-21T12:30:00.000Z'))).toBe(4000);
    });

    it('PowerAvailable: Limit: 4000, used 2000, 15 minutes left = 8000', () => {
        expect(calculations.getPowerAvailable(4000, 2000, new Date('2020-10-21T12:45:00.000Z'))).toBe(8000);
    });

    it('PowerAvailable: Limit: 4000, used 0, 30 minutes left = 8000', () => {
        expect(calculations.getPowerAvailable(4000, 0, new Date('2020-10-21T12:30:00.000Z'))).toBe(8000);
    });

    it('PowerAvailable: Limit: 2000, used 4000, 30 minutes left = -4000 (need to deliver back to grid)', () => {
        expect(calculations.getPowerAvailable(2000, 4000, new Date('2020-10-21T12:30:00.000Z'))).toBe(-4000);
    });

    it('PowerAvailable: Limit: 0, used -1000 (produced more than used), 30 minutes left = 2000', () => {
        expect(calculations.getPowerAvailable(0, -1000, new Date('2020-10-21T12:30:00.000Z'))).toBe(2000);
    });

    it('PowerAvailable: Limit: 1000, used -1000 (produced more than used), 30 minutes left = 4000', () => {
        expect(calculations.getPowerAvailable(1000, -1000, new Date('2020-10-21T12:30:00.000Z'))).toBe(4000);
    });

    it('PowerAvailable: Limit: -1000, used -1000 (produced more than used), 30 minutes left = 0', () => {
        expect(calculations.getPowerAvailable(-1000, -1000, new Date('2020-10-21T12:30:00.000Z'))).toBe(0);
    });

    it('PowerAvailable: Limit: -1000, used 1000 (want to deliver back to grid but has used), 30 minutes left = -4000', () => {
        expect(calculations.getPowerAvailable(-1000, 1000, new Date('2020-10-21T12:30:00.000Z'))).toBe(-4000);
    });
});
