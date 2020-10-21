
const calculations = require('../lib/calculations');

test('Hours between 12:00-14:00 to equal 2', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-21T14:00:00.000Z'
    expect(calculations.getHoursBetween(newest,oldest)).toBe(2);
});

test('Hours between 12:00-12:30 to equal 0.5', () => {
    const oldest = '2020-10-21T12:00:00.000Z'
    const newest = '2020-10-21T12:30:00.000Z'
    expect(calculations.getHoursBetween(newest,oldest)).toBe(0.5);
});