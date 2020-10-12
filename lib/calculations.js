'use strict'

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getHoursBetween(newest, oldest) {
    const secondsDifference = (newest - oldest) / 1000;
    const hourDifference = secondsDifference / 3600;
    return hourDifference;
}

function getDecimalHour(timestamp) {
    const time = new Date(timestamp);
    return (time.getMinutes() / 60) + (time.getSeconds() / 3600);
}

function getRemainingHour(timestamp) {
    const time = new Date(timestamp);
    const minutesToSeconds = time.getMinutes() * 60;
    const totalSeconds = minutesToSeconds + time.getSeconds();
    return 1 - (totalSeconds / 3600);
}

function isNewHour(newestTimestamp, oldestTimestamp) {
    const newest = new Date(newestTimestamp);
    const oldest = new Date(oldestTimestamp);
    if (newest.getHours() !== oldest.getHours()) {
        return true;
    } else {
        return (((newest - oldest) / (1000 * 3600)) >= 1);
    }
}

function getReadingsYoungerThan(readings, minutes) {
    if (readings.length <= 0) {
        return [];
    }
    minutes = minutes;
    if (!minutes) {
        return [readings[0]]
    }

    let keep = [];
    const latest = readings[0];
    for (let i = 0; i < readings.length; i++) {
        const isWithinTimeFrame = getHoursBetween(latest.timestamp, readings[i].timestamp) < (minutes / 60);
        if (isWithinTimeFrame) {
            keep.push(readings[i]);
        } else {
            break;
        }
    }
    return keep;
}

function getPrediction(readings, number, type) {
    if (readings.length < 1) {
        return 0; // Just a safety
    }

    let referenceReadings = [readings[0]];

    if(type === 'time') {
        referenceReadings = getReadingsYoungerThan(readings, number);
    } else if(type === 'count'){ 
        referenceReadings = readings.slice(0, number);
    }
    if (referenceReadings.length <= 1) {
        referenceReadings = createFalseMissingReading(readings[0], number);
    }
    return predict(referenceReadings);
}

function createFalseMissingReading(latestReading, minutes) {
    let falseTimestamp = new Date(latestReading.timestamp);
    falseTimestamp = new Date(falseTimestamp.getTime() - (minutes * 60 * 1000)); // 60 * 1000 --> 60 000 milliseconds
    const falseReading = {
        consumption: latestReading.consumption,
        timestamp: falseTimestamp
    };
    return [latestReading, falseReading];
}

function predict(referenceReadings) {
    let current;
    let previous;
    let wattHours = 0;

    for (let i = 1; i < referenceReadings.length; i++) {
        previous = referenceReadings[i];
        current = referenceReadings[i - 1];
        wattHours += (previous.consumption * getHoursBetween(current.timestamp, previous.timestamp));
    }
    const timespan = getHoursBetween(referenceReadings[0].timestamp, referenceReadings[referenceReadings.length - 1].timestamp);
    const averageWattUsage = wattHours / timespan;
    return (averageWattUsage * getRemainingHour(referenceReadings[0].timestamp));
}

module.exports = {
    uuid: uuid,
    getHoursBetween: getHoursBetween,
    getDecimalHour, getDecimalHour,
    getRemainingHour: getRemainingHour,
    isNewHour: isNewHour,
    getPrediction: getPrediction
}