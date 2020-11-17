
const calculations = require('../lib/calculations');

// getHoursBetween
test('Hours between 12:00-14:00 the same day to equal 2', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-21T14:00:00.000Z'
    expect(calculations.getHoursBetween(newest,oldest)).toBe(2);
});

test('Hours between 12:00-14:00 the next day to equal 26', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-22T14:00:00.000Z'
    expect(calculations.getHoursBetween(newest,oldest)).toBe(26);
});

test('Hours between 12:00-12:30 the same day to equal 0.5', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-21T12:30:00.000Z'
    expect(calculations.getHoursBetween(newest,oldest)).toBe(0.5);
});

test('Hours between 12:00-12:30 the next day to equal 24.5', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-22T12:30:00.000Z'
    expect(calculations.getHoursBetween(newest,oldest)).toBe(24.5);
});

test('Hours between 12:00-12:00 the next day to equal 24', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-22T12:00:00.000Z'
    expect(calculations.getHoursBetween(newest,oldest)).toBe(24);
});

test('Hours between 12:00-12:00 the same day to equal 0', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-21T12:00:00.000Z'
    expect(calculations.getHoursBetween(newest,oldest)).toBe(0);
});

// getElapsedHour
test('Elapsed hour 12:00 to equal 0', () => {
    const timestamp = '2020-10-21T12:00:00.000Z'
    expect(calculations.getElapsedHour(timestamp)).toBe(0);
});

test('Elapsed hour 12:12 to equal 0.2', () => {
    const timestamp = '2020-10-21T12:12:00.000Z'
    expect(calculations.getElapsedHour(timestamp)).toBe(0.2);
});

test('Elapsed hour 12:45 to equal 0.75', () => {
    const timestamp = '2020-10-21T12:45:00.000Z'
    expect(calculations.getElapsedHour(timestamp)).toBe(0.75);
});

// getRemainingHour
test('Remaining hour 12:00 to equal 1', () => {
    const timestamp = '2020-10-21T12:00:00.000Z'
    expect(calculations.getRemainingHour(timestamp)).toBe(1);
});

test('Remaining hour 12:12 to equal 0.8', () => {
    const timestamp = '2020-10-21T12:12:00.000Z'
    expect(calculations.getRemainingHour(timestamp)).toBe(0.8);
});

test('Remaining hour 12:45 to equal 0.25', () => {
    const timestamp = '2020-10-21T12:45:00.000Z'
    expect(calculations.getRemainingHour(timestamp)).toBe(0.25);
});

// isNewHour
// same day
test('Is new hour between 12:00 and 12:30 the same day to equal false', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-21T12:30:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(false);
})

test('Is new hour between 12:15 and 12:20 the same day to equal false', () => {
    const oldest = '2020-10-21T12:15:00.000Z'
    const newest = '2020-10-21T12:20:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(false);
})

test('Is new hour between 12:00 and 13:00 the same day to equal true', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-21T13:00:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(true);
})

test('Is new hour between 12:15 and 13:20 the same day to equal true', () => {
    const oldest = '2020-10-21T12:15:00.000Z'
    const newest = '2020-10-21T13:20:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(true);
})
// next day
test('Is new hour between 12:00 and 12:30 the next day to equal true', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-22T12:30:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(true);
})

test('Is new hour between 12:15 and 12:20 the next day to equal true', () => {
    const oldest = '2020-10-21T12:15:00.000Z'
    const newest = '2020-10-22T12:20:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(true);
})

test('Is new hour between 12:00 and 11:00 the next day to equal true', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-22T11:00:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(true);
})

test('Is new hour between 12:10 and 11:10 the next day to equal true', () => {
    const oldest = '2020-10-21T12:10:00.000Z'
    const newest = '2020-10-22T11:10:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(true);
})

test('Is new hour between 12:15 and 13:10 the next day to equal true', () => {
    const oldest = '2020-10-21T12:15:00.000Z'
    const newest = '2020-10-22T13:10:00.000Z'
    expect(calculations.isNewHour(newest,oldest)).toBe(true);
})

test('Prediction: 1 minute history, 1 reading, 1 valid, at 12:00 to equal 1000W', () => {
    const readings = [
        {consumption: 1000, timestamp: '2020-10-21T12:00:00.000Z'},
    ]
    const number = 1;
    const type = 'time';
    expect(calculations.getPrediction(readings, number, type)).toBe(1000);
});

test('Prediction: 1 minute history, 3 reading, 3 valid, at 12:12 to equal 8000W', () => {
    const readings = [
        {consumption: 1000, timestamp: '2020-10-21T12:12:00.000Z'},
        {consumption: 1000, timestamp: '2020-10-21T12:00:08.000Z'},
        {consumption: 1000, timestamp: '2020-10-21T12:00:00.000Z'}
    ]
    const number = 1;
    const type = 'time';
    expect(calculations.getPrediction(readings, number, type)).toBe(800);
});

test('Prediction: 1 minute history, 5 reading, 3 valid, at 12:30 to equal 500', () => {
    const readings = [
        {consumption: 1000, timestamp: '2020-10-21T12:30:00.000Z'},
        {consumption: 1000, timestamp: '2020-10-21T12:29:45.000Z'},
        {consumption: 1000, timestamp: '2020-10-21T12:29:35.000Z'},
        {consumption: 5218, timestamp: '2020-10-21T12:00:08.000Z'},
        {consumption: 5190, timestamp: '2020-10-21T12:00:00.000Z'}
    ]
    const number = 1;
    const type = 'time';
    expect(calculations.getPrediction(readings, number, type)).toBe(500);
});