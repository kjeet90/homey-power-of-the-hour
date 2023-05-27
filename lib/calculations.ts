'use strict';

export function getElapsedHour(timestamp: Date) {
    const time = new Date(timestamp);
    return time.getMinutes() / 60 + time.getSeconds() / 3600;
}

export const getHoursBetween = (newest: Date, oldest: Date | null) => {
    if (!oldest) return getElapsedHour(newest);
    const secondsDifference = (new Date(newest).getTime() - new Date(oldest).getTime()) / 1000;
    const hourDifference = secondsDifference / 3600;
    return hourDifference;
};

export const getRemainingHour = (timestamp: Date) => {
    const minutesToSeconds = timestamp.getMinutes() * 60;
    const totalSeconds = minutesToSeconds + timestamp.getSeconds();
    return 1 - totalSeconds / 3600;
};

export const isNewHour = (newestTimestamp: Date, oldestTimestamp: Date | null) => {
    if (!oldestTimestamp) return true;
    if (newestTimestamp.getHours() !== oldestTimestamp.getHours()) {
        return true;
    }
    return (newestTimestamp.getTime() - oldestTimestamp.getTime()) / (1000 * 3600) >= 1;
};

export const getReadingsYoungerThan = (readings: { consumption: number; timestamp: Date }[] = [], minutes = 5) => {
    if (readings.length < 1 || !minutes) {
        return [];
    }

    const keep: { consumption: number; timestamp: Date }[] = [];
    const latest = readings[0];
    for (let i = 0; i < readings.length; i++) {
        const isWithinTimeFrame = getHoursBetween(latest.timestamp, readings[i].timestamp) < minutes / 60;
        if (isWithinTimeFrame) {
            keep.push(readings[i]);
        } else {
            break;
        }
    }
    return keep;
};

export const predictRemainingHour = (referenceReadings: { consumption: number; timestamp: Date }[] = []) => {
    if (referenceReadings.length < 2) return referenceReadings[0]?.consumption || 0;
    let current: { consumption: number; timestamp: Date };
    let previous: { consumption: number; timestamp: Date };
    let wattHours = 0;

    for (let i = 1; i < referenceReadings.length; i++) {
        previous = referenceReadings[i];
        current = referenceReadings[i - 1];
        wattHours += previous.consumption * getHoursBetween(current.timestamp, previous.timestamp);
    }
    const timespan = getHoursBetween(referenceReadings[0].timestamp, referenceReadings[referenceReadings.length - 1].timestamp);
    const averageWattUsage = wattHours / timespan;
    return Math.round(averageWattUsage * getRemainingHour(referenceReadings[0].timestamp));
};

export const getPrediction = (readings: { consumption: number; timestamp: Date }[] = [], number = 5, type = 'time') => {
    if (readings.length < 1 || number < 1) {
        return 0;
    }

    let referenceReadings: { consumption: number; timestamp: Date }[] = [readings[0]];

    if (type === 'time') {
        referenceReadings = getReadingsYoungerThan(readings, number);
    } else if (type === 'count') {
        referenceReadings = readings.slice(0, number);
    }

    if (referenceReadings.length === 1) {
        return Math.round(referenceReadings[0].consumption * getRemainingHour(referenceReadings[0].timestamp));
    }
    return predictRemainingHour(referenceReadings);
};

export const getPowerAvailable = (consumptionLimit: number, consumption: number, timestamp: Date) => {
    return (consumptionLimit - consumption) / getRemainingHour(timestamp);
};
