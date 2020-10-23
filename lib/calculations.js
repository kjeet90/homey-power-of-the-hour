'use strict'

function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getHoursBetween(newest, oldest) {
    const secondsDifference = (new Date(newest) - new Date(oldest)) / 1000;
    const hourDifference = secondsDifference / 3600;
    return hourDifference;
}

function getElapsedHour(timestamp) {
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
    if (readings.length < 1 || !minutes) {
        return [];
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
    if(readings.length < 1 || number < 1) {
        return 0;
    }

    let referenceReadings = [readings[0]];

    if(type === 'time') {
        referenceReadings = getReadingsYoungerThan(readings, number);
    } else if(type === 'count') { 
        referenceReadings = readings.slice(0, number);
    }

    if (referenceReadings.length === 1) {
        return Math.round(referenceReadings[0].consumption * getRemainingHour(referenceReadings[0].timestamp));
    }
    return predict(referenceReadings);
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
    return Math.round(averageWattUsage * getRemainingHour(referenceReadings[0].timestamp));
}

module.exports = {
    uuid: uuid,
    getHoursBetween: getHoursBetween,
    getElapsedHour, getElapsedHour,
    getRemainingHour: getRemainingHour,
    isNewHour: isNewHour,
    getPrediction: getPrediction
}